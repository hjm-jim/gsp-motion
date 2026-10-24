'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const G=require('./geometry-core.cjs'),M=require('./motion.cjs'),{load}=require('./cli.cjs');
const scene=load(path.join(__dirname,'examples/demo1_triangle_circumcircle.gsp'));
const options={point:'A',concyclic:'A,B,C',fixed:'1',turns:1};
const model=M.prepare(scene,options);
const at=(f,id)=>G.pointOf(f.objects.find(o=>o.index===id));
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
test('真实 GSP：驱动点圆周运动，依赖边跟随，固定点不动',()=>{
  const a=M.frame(model,0),b=M.frame(model,2);
  assert.notDeepEqual(at(a,5),at(b,5));
  for(const id of [1,2,4])assert.deepEqual(at(a,id),at(b,id));
  assert.deepEqual(b.objects.find(o=>o.index===7).derived.p1,at(b,5));
  assert.deepEqual(b.objects.find(o=>o.index===8).derived.p1,at(b,5));
  assert.deepEqual(a.objects.find(o=>o.index===6).derived,b.objects.find(o=>o.index===6).derived);
  const origin=at(a,1),p=at(a,5),q=at(b,5);
  near(q[0]-origin[0],-(p[1]-origin[1]));near(q[1]-origin[1],p[0]-origin[0]);
});
test('240 帧共圆误差和固定点位移，完整一周闭合',()=>{
  for(let i=0;i<240;i++){
    const f=M.frame(model,i/30);assert.ok(f.metrics.radiusError<1e-9);assert.deepEqual(f.metrics.fixedDisplacement,[0]);
  }
  const a=at(M.frame(model,0),5),z=at(M.frame(model,8),5);near(a[0],z[0]);near(a[1],z[1]);
});
test('无帧间状态：任意倒序跳帧与重复取样一致',()=>{
  const before=JSON.stringify(model),f=M.frame(model,3.3);M.frame(model,7);M.frame(model,0.1);
  assert.deepEqual(M.frame(model,3.3),f);assert.equal(JSON.stringify(model),before);
});
test('解析 JSON 顺序打乱、污染的派生坐标不会改变结果',()=>{
  const s=structuredClone(scene);s.objects.reverse();
  s.objects.find(o=>o.index===5).coordinates=[9999,9999];
  const m=M.prepare(s,options),a=M.frame(m,2),b=M.frame(model,2);
  assert.deepEqual(a.metrics,b.metrics);
  assert.deepEqual(a.objects.sort((x,y)=>x.index-y.index),b.objects.sort((x,y)=>x.index-y.index));
});
test('A 与 B/C 重合时标记退化，外接圆指标不可用',()=>{
  for(const id of [2,4]){
    const p=at(M.frame(model,0),id),center=at(M.frame(model,0),1);
    const theta=Math.atan2(p[1]-center[1],p[0]-center[0]);
    const delta=((theta-model.startAngle)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
    const f=M.frame(model,delta/(2*Math.PI)*model.duration);
    assert.equal(f.metrics.degenerate,true);assert.equal(f.metrics.circumcenterError,null);
    assert.ok(f.metrics.invalid.includes(id===2?8:7));assert.ok(!/NaN|Infinity/.test(M.svg(model,f.time)));
  }
});
test('循环依赖、缺失依赖、非圆约束驱动点与非法参数明确报错',()=>{
  assert.throws(()=>M.order([{index:1,dependencies:[2]},{index:2,dependencies:[1]}]),/循环/);
  assert.throws(()=>M.order([{index:1,dependencies:[9]}]),/缺少/);
  assert.throws(()=>M.prepare(scene,{point:'C'}),/PointOnObject/);
  assert.throws(()=>M.prepare(scene,{duration:0}),/duration/);
  assert.throws(()=>M.prepare(scene,{fps:NaN}),/fps/);
  assert.throws(()=>M.prepare(scene,{direction:'bad'}),/direction/);
});
test('失效父对象向子对象传播，删除旧坐标',()=>{
  const objects=[{index:1,name:'Point',dependencies:[],coordinates:[0,0]},{index:2,name:'Point',dependencies:[],coordinates:[0,0]},
    {index:3,name:'Line',dependencies:[1,2]}, {index:4,name:'Midpoint',dependencies:[3],coordinates:[12,34],derived:{point:[12,34]}}];
  M.recompute(objects);assert.equal(objects[2].derived.valid,false);assert.equal(objects[3].derived.valid,false);assert.equal(G.pointOf(objects[3]),null);
});
test('无交点帧不会保留上一次交点',()=>{
  const s=[{index:1,name:'Point',dependencies:[],coordinates:[0,0]},{index:2,name:'Point',dependencies:[],coordinates:[10,0]},
  {index:3,name:'Point',dependencies:[],coordinates:[0,-1]},{index:4,name:'Point',dependencies:[],coordinates:[0,1]},
  {index:5,name:'Line',dependencies:[1,2]},{index:6,name:'Line',dependencies:[3,4]},{index:7,name:'IntersectionPoint',dependencies:[5,6]}];
  M.recompute(s);G.pointOf(s[6]).forEach(n=>near(n,0));s[2].coordinates=[0,1];s[3].coordinates=[10,1];
  M.recompute(s);assert.equal(G.pointOf(s[6]),null);
});
test('线圆交点指定分支超出线段时不得跳到另一交点',()=>{
  const s=[{index:1,name:'Point',dependencies:[],coordinates:[0,0]},
    {index:2,name:'Point',dependencies:[],coordinates:[1,0]},
    {index:3,name:'Point',dependencies:[],coordinates:[-2,0]},
    {index:4,name:'Circle',dependencies:[1,2]},
    {index:5,name:'Segment',dependencies:[3,1]},
    {index:6,name:'LineCircleIntersection',dependencies:[5,4],branch:-1},
    {index:7,name:'LineCircleIntersection',dependencies:[5,4],branch:1}];
  M.recompute(s);assert.equal(G.pointOf(s[5]),null);near(G.pointOf(s[6])[0],-1);
});
test('垂直指标为数值观察，不把任意两边标成垂直',()=>{
  const m=M.prepare(scene,{...options,perpendicular:'6,7'});
  const error=M.frame(m,0).metrics.perpendicularError;
  assert.ok(error>0.1&&error<=1);
});
const lineScene=load(path.join(__dirname,'examples/demo1_triangle_line.gsp'));
test('圆默认区间：以原位置为参照，从 -30° 单向走到 +30°，中点是原位置',()=>{
  const m=M.prepare(scene,{point:'A'}),original=G.pointOf(scene.objects.find(o=>o.label==='A'));
  assert.equal(m.from,-30);assert.equal(m.to,30);assert.equal(m.loop,false);
  const middle=at(M.frame(m,4),5);near(middle[0],original[0]);near(middle[1],original[1]);
  const origin=at(M.frame(m,0),1);let previous=-Infinity;
  for(let i=0;i<=240;i++){
    const f=M.frame(m,8*i/240),p=at(f,5),angle=Math.atan2(p[1]-origin[1],p[0]-origin[0]);
    assert.ok(angle>previous);previous=angle;assert.ok(f.metrics.constraintError<1e-9);
  }
  const a=at(M.frame(m,0),5),z=at(M.frame(m,8),5);
  near(Math.hypot(a[0]-z[0],a[1]-z[1]),scene.objects.find(o=>o.index===3).derived.radius);
});
test('真实直线 GSP：原点两侧各50单位，沿直线单向走100单位，依赖边随动',()=>{
  const m=M.prepare(lineScene,{point:'A',fixed:'B,C'}),a=M.frame(m,0),b=M.frame(m,4),z=M.frame(m,8);
  assert.equal(m.motionKind,'line');assert.equal(m.circle,null);
  const original=G.pointOf(lineScene.objects.find(o=>o.label==='A'));
  near(at(b,7)[0],original[0]);near(at(b,7)[1],original[1]);
  near(Math.hypot(at(a,7)[0]-original[0],at(a,7)[1]-original[1]),50);
  near(Math.hypot(at(z,7)[0]-at(a,7)[0],at(z,7)[1]-at(a,7)[1]),100);
  for(let i=0;i<=240;i++) {
    const f=M.frame(m,8*i/240);assert.ok(f.metrics.constraintError<1e-9);assert.deepEqual(f.metrics.fixedDisplacement,[0,0]);
    assert.deepEqual(f.objects.find(o=>o.index===8).derived.p2,at(f,7));
    assert.deepEqual(f.objects.find(o=>o.index===9).derived.p1,at(f,7));
    if(i)assert.ok(at(f,7)[0]>at(M.frame(m,8*(i-1)/240),7)[0]);
  }
  assert.deepEqual(a.objects.find(o=>o.index===6).derived,z.objects.find(o=>o.index===6).derived);
  assert.ok(!/NaN|Infinity/.test(M.svg(m,8)));
});
test('圆与直线到终点后钳制，不回到起点；负时间钳制为起点',()=>{
  for(const s of [scene,lineScene]){
    const m=M.prepare(s,{point:'A'}),end=M.frame(m,8);
    assert.deepEqual(M.frame(m,9),end);assert.deepEqual(M.frame(m,80),end);
    assert.deepEqual(M.frame(m,-1),M.frame(m,0));
    assert.notDeepEqual(at(end,m.driver),at(M.frame(m,0),m.driver));
  }
});
test('反向区间仍只走一次，可配置不对称区间，原始参照不被改写',()=>{
  const before=JSON.stringify(lineScene),m=M.prepare(lineScene,{point:'A',from:80,to:-20});
  assert.equal(M.frame(m,0).offset,80);assert.equal(M.frame(m,8).offset,-20);
  assert.ok(at(M.frame(m,0),7)[0]>at(M.frame(m,8),7)[0]);
  assert.equal(JSON.stringify(lineScene),before);
  assert.deepEqual(M.frame(m,3),M.frame(m,3));
});
test('线段和射线不能越界；合法区间可运动',()=>{
  const s=structuredClone(lineScene);s.objects.find(o=>o.index===3).name='Segment';
  assert.throws(()=>M.prepare(s,{point:'A'}),/超出父线段/);
  const m=M.prepare(s,{point:'A',from:-10,to:10});assert.equal(M.frame(m,8).metrics.invalid.length,0);
  s.objects.find(o=>o.index===3).name='Ray';
  assert.throws(()=>M.prepare(s,{point:'A',from:-150,to:10}),/超出父射线/);
});
test('非法区间及互斥参数明确报错',()=>{
  assert.throws(()=>M.prepare(scene,{from:0,to:0}),/from\/to/);
  assert.throws(()=>M.prepare(scene,{from:NaN}),/from\/to/);
  assert.throws(()=>M.prepare(scene,{turns:1,from:-30}),/不能与/);
  assert.throws(()=>M.prepare(lineScene,{direction:'cw'}),/不使用 direction/);
  assert.throws(()=>M.prepare(lineScene,{concyclic:'A,B,C'}),/需要圆约束/);
});
