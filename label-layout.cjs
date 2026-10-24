'use strict';
(function(root){
const G=typeof module!=='undefined'?require('./geometry-core.cjs'):root.Geometry;
// All coordinates below are pixels, shared by SVG export and browser playback.
function geometry(objects,pos,bounds,visible=()=>true){
  const paths=[],points=[];
  for(const o of objects){
    if(!visible(o)||o.derived?.valid===false)continue;
    const d=o.derived,p=G.POINT_TYPES.has(o.name)?G.pointOf(o):null;
    if(p){points.push({id:o.index,p:pos(p),radius:8});continue;}
    let ends=G.endpointsOf(o);
    if(ends){
      if(G.INFINITE_LINE_TYPES.has(o.name))ends=G.clipInfiniteLine(...ends,bounds);
      else if(o.name==='Ray')ends=G.clipRay(...ends,bounds);
      if(ends)paths.push({id:o.index,points:ends.map(pos),width:3});
    }else if(d?.center&&d.radius>0){
      const c=pos(d.center),r=Math.hypot(pos([d.center[0]+d.radius,d.center[1]])[0]-c[0],0);
      const start=o.name==='Circle'?0:Math.atan2(d.start[1]-d.center[1],d.start[0]-d.center[0]);
      const span=o.name==='Circle'?2*Math.PI:(d.sweepFlag?1:-1)*d.arcRadians;
      const n=Math.max(16,Math.ceil(Math.abs(span)*r/5));
      paths.push({id:o.index,width:2,points:Array.from({length:n+1},(_,i)=>[c[0]+r*Math.cos(start+span*i/n),c[1]+r*Math.sin(start+span*i/n)])});
    }
  }
  return {paths,points};
}
function segmentHitsBox(a,b,r){
  let lo=0,hi=1;
  for(let k=0;k<2;k++){
    const min=k?r.y:r.x,max=min+(k?r.h:r.w),delta=b[k]-a[k];
    if(Math.abs(delta)<1e-10){if(a[k]<min||a[k]>max)return false;}
    else {let t1=(min-a[k])/delta,t2=(max-a[k])/delta;if(t1>t2)[t1,t2]=[t2,t1];lo=Math.max(lo,t1);hi=Math.min(hi,t2);if(lo>hi)return false;}
  }
  return true;
}
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const expand=(r,p)=>({x:r.x-p,y:r.y-p,w:r.w+2*p,h:r.h+2*p});
function collisions(box,obstacles,boxes,W,H){
  let count=0;
  if(box.x<8||box.y<8||box.x+box.w>W-8||box.y+box.h>H-8)count+=100;
  for(const path of obstacles.paths){const r=expand(box,5+path.width/2);if(path.points.some((p,i)=>i&&segmentHitsBox(path.points[i-1],p,r)))count++;}
  for(const p of obstacles.points)if(overlap(expand(box,5),{x:p.p[0]-p.radius,y:p.p[1]-p.radius,w:p.radius*2,h:p.radius*2}))count++;
  for(const b of boxes)if(overlap(expand(box,5),b))count+=2;
  return count;
}
function dimensions(label,size){
  // Conservative Segoe UI / YaHei bounds include ascenders, descenders and italic-like overhang.
  const w=Array.from(String(label)).reduce((n,c)=>n+(/[MW@%]/.test(c)?1:/[ilI1.,'`|]/.test(c)?.45:/[\x00-\x7f]/.test(c)?.8:1.1)*size,0);
  return {w:w+8,h:size*1.3+8};
}
function candidates(o,obstacles,size){
  const {w,h}=dimensions(o.label,size),result=[];
  const point=obstacles.points.find(p=>p.id===o.index);
  if(point){
    // Prefer upper right, then explore directions before moving farther away.
    for(let ring=0;ring<8;ring++)for(let i=0;i<24;i++){
      const a=-Math.PI/4+i*Math.PI/12,dx=Math.cos(a),dy=Math.sin(a),gap=15+ring*size*.8;
      result.push({x:point.p[0]+dx*(gap+w/2)-w/2,y:point.p[1]+dy*(gap+h/2)-h/2,w,h});
    }
  }else{
    const path=obstacles.paths.find(p=>p.id===o.index);if(!path)return [];
    const a=path.points[0],z=path.points.at(-1),length=Math.hypot(z[0]-a[0],z[1]-a[1]);
    if(length<1e-7)return [];
    const normal=[-(z[1]-a[1])/length,(z[0]-a[0])/length];
    for(let ring=0;ring<8;ring++)for(const t of [.5,.3,.7,.15,.85])for(const sign of [-1,1]){
      const gap=12+ring*size*.75+(Math.abs(normal[0])*w+Math.abs(normal[1])*h)/2;
      result.push({x:a[0]+(z[0]-a[0])*t+normal[0]*gap*sign-w/2,y:a[1]+(z[1]-a[1])*t+normal[1]*gap*sign-h/2,w,h});
    }
  }
  return result;
}
function labelled(objects){return objects.filter(o=>o.label&&(G.POINT_TYPES.has(o.name)||G.endpointsOf(o))).sort((a,b)=>Number(!G.POINT_TYPES.has(a.name))-Number(!G.POINT_TYPES.has(b.name))||a.index-b.index);}
function plan(model,samples){
  const result={},placed=samples.map(()=>[]);
  for(const o of labelled(model.scene.objects)){
    const lists=samples.map(s=>{const obj=s.f.objects.find(x=>x.index===o.index);return obj?candidates(obj,s.obstacles,model.labelSize):[];});
    let best=0,bestCost=Infinity;
    for(let i=0;i<Math.max(0,...lists.map(x=>x.length));i++){
      let total=0,worst=0;
      for(let j=0;j<samples.length;j++)if(lists[j][i]){const n=collisions(lists[j][i],samples[j].obstacles,placed[j],model.width,model.height);total+=n;worst=Math.max(worst,n);}
      const cost=worst*1e6+total*100+i;
      if(cost<bestCost){bestCost=cost;best=i;}
    }
    result[o.index]=best;
    lists.forEach((list,j)=>{if(list[best])placed[j].push(list[best]);});
  }
  return result;
}
function layout(model,f,obstacles){
  const boxes=[],labels=[];
  for(const o of labelled(f.objects)){
    const list=candidates(o,obstacles,model.labelSize);if(!list.length)continue;
    const preferred=model.labelPlan?.[o.index]??0;
    let index=preferred,box=list[index]||list[0],n=collisions(box,obstacles,boxes,model.width,model.height);
    // Planned offsets are stable across time; repair only an actual unsampled collision.
    if(n){let best=n*1e6;list.forEach((r,i)=>{const score=collisions(r,obstacles,boxes,model.width,model.height)*1e6+Math.hypot(r.x-box.x,r.y-box.y);if(score<best){best=score;index=i;}});box=list[index];}
    const remaining=collisions(box,obstacles,boxes,model.width,model.height);
    boxes.push(box);labels.push({id:o.index,label:o.label,...box,collisions:remaining});
  }
  return labels;
}
const api={geometry,segmentHitsBox,collisions,candidates,plan,layout};
if(typeof module!=='undefined')module.exports=api;else root.LabelLayout=api;
})(globalThis);
