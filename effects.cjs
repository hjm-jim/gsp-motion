'use strict';
(function(root){
const G=typeof module!=='undefined'?require('./geometry-core.cjs'):root.Geometry;
const V=typeof module!=='undefined'?require('./visibility.cjs'):root.Visibility;
const L=typeof module!=='undefined'?require('./label-layout.cjs'):root.LabelLayout;
const lineTypes=new Set(['Segment','Line','Ray','PerpendicularLine','ParallelLine','AngleBisector']);
const common=['type','start','end','enter','exit','color','opacity','width','fillOpacity'];
function compile(spec,objects,duration,resolve){
  if(spec===undefined)return [];
  if(!Array.isArray(spec))throw Error('effects 必须是效果数组');
  return spec.map((raw,index)=>{
    const fail=s=>{throw Error(`effects[${index}]: ${s}`);};
    if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('必须是对象');
    if(!['line','angle','triangle'].includes(raw.type))fail('type 必须为 line、angle 或 triangle');
    const allowed=new Set([...common,...(raw.type==='line'?['objects','style','side','bend']:['points']),...(raw.type==='angle'?['radius']:[])]);
    for(const key of Object.keys(raw))if(!allowed.has(key))fail('未知字段 '+key);
    const number=(key,fallback,min,max)=>{
      const value=raw[key]===undefined?fallback:raw[key];
      if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail(`${key} 必须是 ${min}..${max} 的有限数字`);
      return value;
    };
    const start=number('start',0,0,duration),end=number('end',duration,0,duration);
    if(end<=start)fail('end 必须大于 start');
    const enter=number('enter',Math.min(.5,(end-start)/2),0,end-start);
    const exit=number('exit',Math.min(.4,(end-start)/2),0,end-start);
    if(enter+exit>end-start+1e-10)fail('enter + exit 不能超过效果持续时间');
    if(raw.color!==undefined && (typeof raw.color!=='string'||!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw.color)))fail('color 必须是 #RGB 或 #RRGGBB');
    const e={type:raw.type,start,end,enter,exit,color:raw.color,opacity:number('opacity',1,0,1),width:number('width',raw.type==='line'?6:4,1,40),fillOpacity:number('fillOpacity',raw.type==='triangle'?.24:.16,0,1)};
    if(raw.type==='line'){
      if(!Array.isArray(raw.objects)||!raw.objects.length)fail('objects 需要一个或多个直线型对象的标签/编号');
      e.objects=[...new Set(raw.objects.map(id=>resolve(objects,id).index))];
      if(e.objects.some(id=>!lineTypes.has(resolve(objects,id).name)))fail('objects 只能引用线段、直线、射线等直线型对象');
      e.style=raw.style??'stroke';
      if(!['stroke','arc'].includes(e.style))fail('style 必须为 stroke 或 arc');
      if(e.style==='stroke'&&(raw.side!==undefined||raw.bend!==undefined))fail('side/bend 仅用于 style:arc');
      if(e.style==='arc'){
        if(e.objects.some(id=>resolve(objects,id).name!=='Segment'))fail('弧线高亮只能引用有两个端点的 Segment 线段');
        e.side=raw.side??'auto';if(!['auto','left','right'].includes(e.side))fail('side 必须为 auto、left 或 right');
        e.bend=number('bend',.16,.02,.6);
      }
    }else{
      if(!Array.isArray(raw.points)||raw.points.length!==3)fail('points 必须是三个点；角的中间点为顶点');
      e.points=raw.points.map(id=>resolve(objects,id).index);
      if(new Set(e.points).size!==3)fail('points 必须引用三个不同的点');
      if(e.points.some(id=>!G.POINT_TYPES.has(resolve(objects,id).name)))fail('points 只能引用点对象');
      if(raw.type==='angle')e.radius=number('radius',42,4,240);
    }
    return e;
  });
}
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function state(effect,time){
  if(time<effect.start || time>=effect.end)return {visible:false,reveal:0,opacity:0};
  const reveal=effect.enter===0?1:ease((time-effect.start)/effect.enter);
  const fade=effect.exit===0?1:ease((effect.end-time)/effect.exit);
  return {visible:reveal>0&&fade>0,reveal,opacity:effect.opacity*reveal*fade};
}
function quadratic(a,c,b,t){const u=1-t;return [u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]];}
function arcGeometry(a,b,bend,side){
  const dx=b[0]-a[0],dy=b[1]-a[1],sign=side==='right'?-1:1;
  const c=[(a[0]+b[0])/2+dy*2*bend*sign,(a[1]+b[1])/2-dx*2*bend*sign];
  const points=Array.from({length:65},(_,i)=>quadratic(a,c,b,i/64));
  const length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);
  return {a,b,c,points,length};
}
function extentPoints(model,frame){
  const result=[],byId=new Map(frame.objects.map(o=>[o.index,o]));
  for(const e of model.effects||[])if(e.style==='arc')for(const id of e.objects){
    const o=byId.get(id),ends=o?.derived?.valid===false?null:G.endpointsOf(o);
    if(!ends||!V.visible(model,frame.time,o))continue;
    for(const side of e.side==='auto'?['left','right']:[e.side])result.push(arcGeometry(...ends,e.bend,side).points[32]);
  }
  return result;
}
function planArcs(model,frames,pos,bounds){
  const samples=frames.map(frame=>({frame,obstacles:L.geometry(frame.objects,pos,bounds,o=>V.visible(model,frame.time,o)),byId:new Map(frame.objects.map(o=>[o.index,o]))}));
  for(const e of model.effects||[])if(e.style==='arc'){
    e.arcSides={};
    for(const id of e.objects){
      if(e.side!=='auto'){e.arcSides[id]=e.side;continue;}
      const scores=['left','right'].map(side=>{
        let score=0;
        for(const {frame,byId,obstacles} of samples){
          const o=byId.get(id),ends=G.endpointsOf(o);
          if(!ends||!V.visible(model,frame.time,o)||o.derived?.valid===false||frame.time<e.start||frame.time>e.end)continue;
          const arc=arcGeometry(...ends.map(pos),e.bend,side);
          for(const p of arc.points.slice(8,-8)){
            if(p[0]<12||p[1]<12||p[0]>model.width-12||p[1]>model.height-12)score+=100;
            const box={x:p[0]-14,y:p[1]-14,w:28,h:28};
            for(const path of obstacles.paths)if(path.id!==id&&path.points.some((z,i)=>i&&L.segmentHitsBox(path.points[i-1],z,box)))score++;
            for(const q of obstacles.points)if(Math.hypot(p[0]-q.p[0],p[1]-q.p[1])<22)score+=2;
          }
        }
        return score;
      });
      e.arcSides[id]=scores[0]<=scores[1]?'left':'right';
    }
  }
}
function layers(model,frame,pos,bounds,obstacles){
  const fills=[],strokes=[],byId=new Map(frame.objects.map(o=>[o.index,o]));
  const validPoint=id=>{const o=byId.get(id);if(!o||o.derived?.valid===false)return null;const p=G.pointOf(o);return p?.every(Number.isFinite)?pos(p):null;};
  for(const e of model.effects||[]){
    const s=state(e,frame.time);if(!s.visible)continue;
    const defaults=model.background==='black'?{line:'#ffe16b',angle:'#c69bff',triangle:'#42cdb0'}:{line:'#d52d32',angle:'#783bc5',triangle:'#168cbd'};
    const color=e.color||defaults[e.type];
    if(e.type==='line'){
      for(const id of e.objects){
        const o=byId.get(id);if(!o||!V.visible(model,frame.time,o)||o.derived?.valid===false)continue;
        let ends=G.endpointsOf(o);if(!ends)continue;
        if(G.INFINITE_LINE_TYPES.has(o.name))ends=G.clipInfiniteLine(...ends,bounds);
        else if(o.name==='Ray')ends=G.clipRay(...ends,bounds);
        if(!ends)continue;
        const a=pos(ends[0]),b=pos(ends[1]),length=Math.hypot(b[0]-a[0],b[1]-a[1]);
        if(length<1e-7)continue;
        if(e.style==='arc'){
          const arc=arcGeometry(a,b,e.bend,e.arcSides?.[id]??e.side);
          // Use measured pixel length rather than SVG pathLength (not supported by every rasterizer).
          strokes.push(`<path data-effect="line-arc" data-effect-object="${id}" d="M${a} Q${arc.c} ${b}" fill="none" stroke="${color}" stroke-width="${e.width}" stroke-linecap="round" opacity="${s.opacity}" stroke-dasharray="${arc.length} ${arc.length}" stroke-dashoffset="${arc.length*(1-s.reveal)}"/>`);
          obstacles?.push({id,points:arc.points,width:e.width});
          continue;
        }
        obstacles?.push({id,points:[a,b],width:e.width});
        strokes.push(`<line data-effect="line" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${e.width}" stroke-linecap="round" opacity="${s.opacity}" stroke-dasharray="${length} ${length}" stroke-dashoffset="${length*(1-s.reveal)}"/>`);
      }
    }else{
      const p=e.points.map(validPoint);if(p.some(x=>!x))continue;
      const [a,v,c]=p;
      const cross=(a[0]-v[0])*(c[1]-v[1])-(a[1]-v[1])*(c[0]-v[0]);
      if(e.type==='triangle'){
        if(Math.abs(cross)<1e-6)continue;
        fills.push(`<polygon data-effect="triangle" points="${p.map(x=>x.join(',')).join(' ')}" fill="${color}" opacity="${s.opacity*e.fillOpacity}"/>`);
      }else{
        const l1=Math.hypot(a[0]-v[0],a[1]-v[1]),l2=Math.hypot(c[0]-v[0],c[1]-v[1]);
        if(Math.min(l1,l2)<1e-6)continue;
        const theta=Math.atan2(a[1]-v[1],a[0]-v[0]);
        let delta=((Math.atan2(c[1]-v[1],c[0]-v[0])-theta)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
        if(delta>Math.PI)delta-=2*Math.PI;if(Math.abs(delta)<1e-8)continue;
        const r=Math.min(e.radius,l1*.25,l2*.25),end=theta+delta*s.reveal;
        const begin=[v[0]+r*Math.cos(theta),v[1]+r*Math.sin(theta)],finish=[v[0]+r*Math.cos(end),v[1]+r*Math.sin(end)];
        const arc=`M${begin} A${r},${r} 0 0,${delta>0?1:0} ${finish}`;
        obstacles?.push({points:Array.from({length:33},(_,i)=>[v[0]+r*Math.cos(theta+delta*i/32),v[1]+r*Math.sin(theta+delta*i/32)]),width:e.width});
        fills.push(`<path data-effect="angle-fill" d="M${v} L${begin} A${r},${r} 0 0,${delta>0?1:0} ${finish} Z" fill="${color}" opacity="${s.opacity*e.fillOpacity}"/>`);
        strokes.push(`<path data-effect="angle" d="${arc}" fill="none" stroke="${color}" stroke-width="${e.width}" stroke-linecap="round" opacity="${s.opacity}"/>`);
      }
    }
  }
  return {fills,strokes};
}
const api={compile,state,layers,arcGeometry,extentPoints,planArcs};if(typeof module!=='undefined')module.exports=api;else root.Effects=api;
})(globalThis);
