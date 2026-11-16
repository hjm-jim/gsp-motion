'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('./geometry-core.cjs'),M=require('./motion.cjs');
const near=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const pointNear=(a,b)=>a.forEach((x,i)=>near(x,b[i]));
const fixture=()=>G.parseGsp(fs.readFileSync(path.join(__dirname,'examples/bug_report#1.gsp')),'bug_report#1.gsp');
const by=(objects,id)=>objects.find(o=>o.index===id);
test('垂/平行线定义端点与原生算术重放一致；锚点对应参数 .5，允许外插',()=>{
  for(const [name,expected] of [['PerpendicularLine',[[13,16],[7,24]]],['ParallelLine',[[6,17],[14,23]]]]){
    const objects=[{index:1,name:'Point',dependencies:[],coordinates:[1,2]},{index:2,name:'Point',dependencies:[],coordinates:[9,8]},
      {index:3,name:'Point',dependencies:[],coordinates:[10,20]},{index:4,name:'Line',dependencies:[1,2]},
      {index:5,name,dependencies:[3,4]},...[0,.5,1,-.25].map((t,i)=>({index:i+6,name:'PointOnObject',dependencies:[5],constraintParameters:[t]}))];
    M.recompute(objects);const [a,b]=G.endpointsOf(by(objects,5));pointNear(a,expected[0]);pointNear(b,expected[1]);
    pointNear(G.pointOf(by(objects,6)),a);pointNear(G.pointOf(by(objects,7)),[10,20]);pointNear(G.pointOf(by(objects,8)),b);
    pointNear(G.pointOf(by(objects,9)),[a[0]-.25*(b[0]-a[0]),a[1]-.25*(b[1]-a[1])]);
  }
});
test('bug_report#1：四个绿色圆恢复原半径，F 与 B 不再重合，四点在小圆上',()=>{
  const s=fixture();
  for(const [id,center,radius] of [[17,[829.5009686672347,349.3489803596229],207.8206100234069],
    [19,[420.8454032287348,334.48860077143223],238.47316814441174],
    [21,[491.6511470442747,718.9470486488228],213.89739329519313],
    [23,[741.147983041877,619.3772533430132],125.84509824218162]]){
    const d=by(s.objects,id).derived;pointNear(d.center,center);near(d.radius,radius);
  }
  const f=G.pointOf(by(s.objects,24)),b=G.pointOf(by(s.objects,6));
  pointNear(f,[570.5369717172009,520.1277298587444]);assert.ok(Math.hypot(f[0]-b[0],f[1]-b[1])>200);
  const {center,radius}=by(s.objects,35).derived;
  for(const id of [24,25,26,27]){const p=G.pointOf(by(s.objects,id));near(Math.hypot(p[0]-center[0],p[1]-center[1]),radius);}
});
test('真实图沿圆运动：圆经过定义点与共享点，交点回代正确，无失效帧/名称碰撞',()=>{
  const s=fixture(),m=M.prepare(s,{point:'A',from:-8,to:8,duration:2,width:1080,height:1080});
  for(let i=0;i<=40;i++){
    const f=M.frame(m,i/20);assert.deepEqual(f.metrics.invalid,[]);
    for(const [circle,points] of [[17,[4,5]],[19,[4,6]],[21,[6,7]],[23,[5,7]],[35,[24,25,26,27]]]){
      const d=by(f.objects,circle).derived;
      for(const id of points){const p=G.pointOf(by(f.objects,id));near(Math.hypot(p[0]-d.center[0],p[1]-d.center[1]),d.radius);}
    }
    for(const id of [24,25,26,27])for(const parent of by(f.objects,id).dependencies){
      const p=G.pointOf(by(f.objects,id)),d=by(f.objects,parent).derived;near(Math.hypot(p[0]-d.center[0],p[1]-d.center[1]),d.radius);
    }
    assert.equal(M.labelLayout(m,i/20).some(l=>l.collisions>0),false);
  }
});
test('已解析 JSON 的旧缓存被重算；直接直线上的点参数不受修复影响',()=>{
  const s=fixture();for(const o of s.objects)if(o.dependencies.length){o.coordinates=[99999,99999];o.derived={center:[99999,99999],radius:99999,point:[99999,99999]};}
  const m=M.prepare(s,{mode:'static'});pointNear(G.pointOf(by(M.frame(m,0).objects,24)),[570.5369717172009,520.1277298587444]);
  const line=[{index:1,name:'Point',dependencies:[],coordinates:[1,2]},{index:2,name:'Point',dependencies:[],coordinates:[9,8]},
    {index:3,name:'Line',dependencies:[1,2]},{index:4,name:'PointOnObject',dependencies:[3],constraintParameters:[.25]}];
  M.recompute(line);pointNear(G.pointOf(line[3]),[3,3.5]);
});
