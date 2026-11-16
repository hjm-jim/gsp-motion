'use strict';
(function(root){
const G=typeof module!=='undefined'?require('./geometry-core.cjs'):root.Geometry;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function labelRuns(label){
  const text=String(label),runs=[];
  const add=(text,subscript)=>{if(!text)return;const last=runs.at(-1);if(last?.subscript===subscript)last.text+=text;else runs.push({text,subscript});};
  let start=0;
  for(let i=0;i<text.length;i++)if(text[i]==='['){
    let end=i+1,depth=1;
    for(;end<text.length&&depth;end++){if(text[end]==='[')depth++;else if(text[end]===']')depth--;}
    if(depth)break;
    const content=text.slice(i+1,end-1);
    if(i>0&&content.length&&!content.includes('[')){
      add(text.slice(start,i),false);add(content,true);start=end;
    }
    i=end-1;
  }
  add(text.slice(start),false);return runs;
}
function labelMarkup(label,size){
  const runs=labelRuns(label);
  if(!runs.some(r=>r.subscript))return escape(label);
  let baseline=0;
  return runs.map(r=>{
    const offset=r.subscript?size*.28:0,dy=offset-baseline;baseline=offset;
    return `<tspan${r.subscript?' data-subscript="true"':''} font-size="${size*(r.subscript?.7:1)}" dy="${dy}">${escape(r.text)}</tspan>`;
  }).join('');
}
// All coordinates below are pixels, shared by SVG export and browser playback.
function geometry(objects,pos,bounds,visible=()=>true,appearance=()=>({})){
  const paths=[],points=[];
  for(const o of objects){
    if(!visible(o)||o.derived?.valid===false)continue;
    const d=o.derived,p=G.POINT_TYPES.has(o.name)?G.pointOf(o):null,style=appearance(o);
    if(p){points.push({id:o.index,p:pos(p),radius:style.pointRadius===undefined?8:style.pointRadius+(style.pointOutline??0)/2});continue;}
    let ends=G.endpointsOf(o);
    if(ends){
      if(G.INFINITE_LINE_TYPES.has(o.name))ends=G.clipInfiniteLine(...ends,bounds);
      else if(o.name==='Ray')ends=G.clipRay(...ends,bounds);
      if(ends)paths.push({id:o.index,points:ends.map(pos),width:style.width??3});
    }else if(d?.center&&d.radius>0){
      const c=pos(d.center),r=Math.hypot(pos([d.center[0]+d.radius,d.center[1]])[0]-c[0],0);
      const start=o.name==='Circle'?0:Math.atan2(d.start[1]-d.center[1],d.start[0]-d.center[0]);
      const span=o.name==='Circle'?2*Math.PI:(d.sweepFlag?1:-1)*d.arcRadians;
      const n=Math.max(16,Math.ceil(Math.abs(span)*r/5));
      paths.push({id:o.index,width:style.width??2,center:c,radius:r,points:Array.from({length:n+1},(_,i)=>[c[0]+r*Math.cos(start+span*i/n),c[1]+r*Math.sin(start+span*i/n)])});
    }
  }
  return {paths,points};
}
function segmentHitsBox(a,b,r){
  if(Math.max(a[0],b[0])<r.x||Math.min(a[0],b[0])>r.x+r.w||Math.max(a[1],b[1])<r.y||Math.min(a[1],b[1])>r.y+r.h)return false;
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
  const clearance=box.clearance??5;
  if(box.x<8||box.y<8||box.x+box.w>W-8||box.y+box.h>H-8)count+=100;
  for(const path of obstacles.paths){const r=expand(box,clearance+path.width/2);if(path.points.some((p,i)=>i&&segmentHitsBox(path.points[i-1],p,r)))count++;}
  for(const p of obstacles.points)if(pointGap(box,p.p)<p.radius+clearance)count++;
  for(const b of boxes){if(overlap(expand(box,5),b))count+=2;if(b.leader&&segmentHitsBox(b.leader.a,b.leader.b,expand(box,2)))count++;}
  if(box.leader){
    const {a,b,target}=box.leader;
    for(const path of obstacles.paths)if(path.id!==target&&path.points.some((p,i)=>i&&segmentsCross(a,b,path.points[i-1],p)))count++;
    for(const p of obstacles.points)if(segmentHitsBox(a,b,{x:p.p[0]-p.radius-2,y:p.p[1]-p.radius-2,w:2*p.radius+4,h:2*p.radius+4}))count++;
    for(const r of boxes)if(segmentHitsBox(a,b,expand(r,2)))count++;
  }
  return count;
}
function segmentsCross(a,b,c,d){
  if(Math.max(a[0],b[0])<Math.min(c[0],d[0])||Math.max(c[0],d[0])<Math.min(a[0],b[0])||Math.max(a[1],b[1])<Math.min(c[1],d[1])||Math.max(c[1],d[1])<Math.min(a[1],b[1]))return false;
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  return cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(a[0],b[0])>=Math.min(c[0],d[0])&&Math.max(c[0],d[0])>=Math.min(a[0],b[0])&&Math.max(a[1],b[1])>=Math.min(c[1],d[1])&&Math.max(c[1],d[1])>=Math.min(a[1],b[1]);
}
function dimensions(label,size,kind){
  // Conservative Segoe UI / YaHei bounds include ascenders, descenders and italic-like overhang.
  const runs=labelRuns(label);
  const w=runs.reduce((sum,r)=>sum+Array.from(r.text).reduce((n,c)=>n+(kind==='circle'&&/[0-9]/.test(c)?.55:kind==='circle'&&c==='C'?.64:kind==='point'&&/[0-9]/.test(c)?.54:kind==='point'&&c==='P'?.7:/[MW@%]/.test(c)?1:/[ilI1.,'`|]/.test(c)?.45:/[\x00-\x7f]/.test(c)?.8:1.1)*size*(r.subscript?.7:1),0),0);
  return {w:w+8,h:size*(runs.some(r=>r.subscript)?1.55:1.3)+8};
}
function pointGap(box,point){
  return Math.hypot(Math.max(box.x-point[0],0,point[0]-box.x-box.w),Math.max(box.y-point[1],0,point[1]-box.y-box.h));
}
function typography(o){
  if(G.POINT_TYPES.has(o.name))return {family:'Times New Roman, serif',style:'italic',weight:'bold',kind:'point',ascent:.91,lineHeight:1.14};
  if(o.name==='Circle')return {family:'Segoe UI, Microsoft YaHei, sans-serif',style:'normal',weight:'normal',kind:'circle',ascent:1.1,lineHeight:1.35};
  return {family:'Georgia, serif',style:'italic',weight:'normal',kind:'line',ascent:.91,lineHeight:1.14};
}
function circleLeader(box,path,angle){
  const a=[path.center[0]+path.radius*Math.cos(angle),path.center[1]+path.radius*Math.sin(angle)];
  const ink=box.inkBox??box;
  const b=[Math.max(ink.x,Math.min(ink.x+ink.w,a[0])),Math.max(ink.y,Math.min(ink.y+ink.h,a[1]))];
  return {a,b,length:Math.hypot(b[0]-a[0],b[1]-a[1]),target:path.id};
}
function candidates(o,obstacles,size){
  const font=typography(o),measured=dimensions(o.label,size,font.kind),w=measured.w-(font.kind==='circle'?4:0),h=size*(font.lineHeight+(labelRuns(o.label).some(r=>r.subscript)?.28:0))+4,result=[];
  const point=obstacles.points.find(p=>p.id===o.index);
  if(point){
    // Fine steps near compact font bounds, with a positive 3px safety gap.
    // Retain distant fallbacks for crowded drawings.
    for(const offset of [0,2,4,6,10,16,26,40,64,100,150,200])for(let i=0;i<24;i++){
      const a=-Math.PI/4+i*Math.PI/12,dx=Math.cos(a),dy=Math.sin(a),gap=point.radius+3.25+offset;
      result.push({x:point.p[0]+dx*(gap+w/2)-w/2,y:point.p[1]+dy*(gap+h/2)-h/2,w,h,clearance:3});
    }
  }else if(o.name==='Circle'){
    const path=obstacles.paths.find(p=>p.id===o.index);if(!path?.center)return [];
    // Closed circles have coincident endpoints. Place names near their rim,
    // searching both sides and multiple angles with the existing collision planner.
    for(let ring=0;ring<6;ring++)for(let i=0;i<24;i++)for(const side of [1,-1]){
      const a=-Math.PI/4+i*Math.PI/12,dx=Math.cos(a),dy=Math.sin(a);
      const gap=8+ring*size*.25+(Math.abs(dx)*w+Math.abs(dy)*h)/2;
      const radius=Math.max(0,path.radius+side*gap);
      const box={x:path.center[0]+dx*radius-w/2,y:path.center[1]+dy*radius-h/2,w,h};
      if(/^C(?:\[[0-9]+\])?$/.test(o.label))box.inkBox={x:box.x+2,y:box.y+size*.35,w:w-4,h:h-size*.35-2};
      result.push({...box,leader:circleLeader(box,path,a)});
    }
  }else{
    const path=obstacles.paths.find(p=>p.id===o.index);if(!path)return [];
    const a=path.points[0],z=path.points.at(-1),length=Math.hypot(z[0]-a[0],z[1]-a[1]);
    if(length<1e-7)return [];
    const normal=[-(z[1]-a[1])/length,(z[0]-a[0])/length];
    for(let ring=0;ring<8;ring++)for(const t of [.5,.3,.7,.15,.85])for(const sign of [-1,1]){
      const gap=8+ring*size*.25+(Math.abs(normal[0])*w+Math.abs(normal[1])*h)/2;
      result.push({x:a[0]+(z[0]-a[0])*t+normal[0]*gap*sign-w/2,y:a[1]+(z[1]-a[1])*t+normal[1]*gap*sign-h/2,w,h});
    }
  }
  return result;
}
function labelled(objects){return objects.filter(o=>o.label&&(G.POINT_TYPES.has(o.name)||G.endpointsOf(o)||o.name==='Circle')).sort((a,b)=>Number(!G.POINT_TYPES.has(a.name))-Number(!G.POINT_TYPES.has(b.name))||a.index-b.index);}
function plan(model,samples){
  const result={},placed=samples.map(()=>[]);
  for(const o of labelled(model.scene.objects)){
    const lists=samples.map(s=>{const obj=s.f.objects.find(x=>x.index===o.index);return obj?candidates(obj,s.obstacles,model.labelSize):[];});
    let best=0,bestCost=Infinity;
    for(let i=0;i<Math.max(0,...lists.map(x=>x.length));i++){
      let total=0,worst=0,distance=0;
      for(let j=0;j<samples.length;j++)if(lists[j][i]){const n=collisions(lists[j][i],samples[j].obstacles,placed[j],model.width,model.height);total+=n;worst=Math.max(worst,n);const p=samples[j].obstacles.points.find(p=>p.id===o.index);if(p)distance+=pointGap(lists[j][i],p.p);}
      const leaderDistance=o.name==='Circle'?lists.reduce((n,list)=>n+(list[i]?.leader?.length??0),0)/samples.length:0;
      const cost=G.POINT_TYPES.has(o.name)?worst*1e9+total*1e6+distance/samples.length+i*.000001:worst*1e9+total*1e6+leaderDistance+i*.000001;
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
    const point=obstacles.points.find(p=>p.id===o.index);
    if(point){
      // A globally stable offset can remain far away after an obstacle moves.
      // Minimize actual point-to-box distance in this frame; prefer the planned
      // position only as a tie breaker. This is deterministic for arbitrary seeks.
      let best=n*1e6+pointGap(box,point.p);
      list.forEach((r,i)=>{const score=collisions(r,obstacles,boxes,model.width,model.height)*1e6+pointGap(r,point.p)+Math.hypot(r.x-box.x,r.y-box.y)*.000001;if(score<best){best=score;index=i;}});
      box=list[index];n=collisions(box,obstacles,boxes,model.width,model.height);
    }
    // Planned offsets are stable across time; repair only an actual unsampled collision.
    if(n){let best=n*1e6;list.forEach((r,i)=>{const score=collisions(r,obstacles,boxes,model.width,model.height)*1e6+Math.hypot(r.x-box.x,r.y-box.y);if(score<best){best=score;index=i;}});box=list[index];}
    const remaining=collisions(box,obstacles,boxes,model.width,model.height);
    boxes.push(box);labels.push({id:o.index,label:o.label,...box,collisions:remaining});
  }
  return labels;
}
const api={geometry,segmentHitsBox,collisions,candidates,plan,layout,labelRuns,labelMarkup,dimensions,pointGap,typography};
if(typeof module!=='undefined')module.exports=api;else root.LabelLayout=api;
})(globalThis);
