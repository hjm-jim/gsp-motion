'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const M=require('./motion.cjs'),G=require('./geometry-core.cjs'),E=require('./effects.cjs'),{load}=require('./cli.cjs');
const scene=load(path.join(__dirname,'examples/demo1_triangle_circumcircle.gsp'));
const specs=[
  {type:'line',objects:[7,8],start:0,end:8,enter:1,exit:1},
  {type:'angle',points:['B','A','C'],start:0,end:8,enter:1,exit:1},
  {type:'triangle',points:['A','B','C'],start:0,end:8,enter:1,exit:1}
];
const model=M.prepare(scene,{effects:specs});
test('多元素同时强调：两条线、一个角和三角形可在同帧重叠出现',()=>{
  const svg=M.svg(model,4);
  assert.equal((svg.match(/data-effect="line"/g)||[]).length,2);
  assert.equal((svg.match(/data-effect="angle"/g)||[]).length,1);
  assert.equal((svg.match(/data-effect="triangle"/g)||[]).length,1);
  assert.equal((svg.match(/<text\b/g)||[]).length,3);
});
test('高亮不改变原几何，跟随每帧重算位置而不是静态贴图',()=>{
  const plain=M.prepare(scene,{});
  for(const t of [1,4,7])assert.deepEqual(M.frame(model,t),M.frame(plain,t));
  const f=M.frame(model,4),layers=E.layers(model,f,p=>p,model.bounds),ab=f.objects.find(o=>o.index===7).derived;
  assert.ok(layers.strokes[0].includes(`x1="${ab.p1[0]}"`));assert.ok(layers.strokes[0].includes(`y2="${ab.p2[1]}"`));
  const points=['A','B','C'].map(label=>G.pointOf(f.objects.find(o=>o.label===label)));
  assert.ok(layers.fills.find(s=>s.includes('triangle')).includes(points.map(p=>p.join(',')).join(' ')));
  assert.notEqual(M.svg(model,1),M.svg(model,4));
});
test('入场描线与退场渐隐可跳帧，无帧间状态，起止时间外没有效果',()=>{
  const e=model.effects[0];assert.equal(E.state(e,-1).visible,false);assert.equal(E.state(e,0).visible,false);assert.equal(E.state(e,8).visible,false);
  assert.ok(E.state(e,.2).reveal<E.state(e,.8).reveal);
  assert.ok(E.state(e,7.2).opacity>E.state(e,7.8).opacity);
  const before=M.svg(model,.25);M.svg(model,7.9);assert.equal(M.svg(model,.25),before);
  assert.equal(/data-effect=/.test(M.svg(model,8)),false);
});
test('角的中间点为顶点，绘制较小角，正负转向均正确',()=>{
  const objects=[{index:1,name:'Point',dependencies:[],coordinates:[100,0]},
    {index:2,name:'Point',dependencies:[],coordinates:[0,0]},
    {index:3,name:'Point',dependencies:[],coordinates:[0,100]}];
  const effects=E.compile([{type:'angle',points:[1,2,3],start:0,end:3,enter:1,radius:20}],objects,3,M.resolve);
  const l=E.layers({effects,background:'white'},{objects,time:1},p=>p,{});
  assert.ok(l.strokes[0].includes('A20,20 0 0,1'));assert.ok(l.fills[0].includes('M0,0 L20,0'));
  objects[2].coordinates=[0,-100];
  assert.ok(E.layers({effects},{objects,time:1},p=>p,{}).strokes[0].includes('A20,20 0 0,0'));
});
test('退化时跳过角/三角形，无 NaN，也不遗留旧的高亮',()=>{
  const objects=[{index:1,name:'Point',dependencies:[],coordinates:[0,0]},
    {index:2,name:'Point',dependencies:[],coordinates:[0,0]},
    {index:3,name:'Point',dependencies:[],coordinates:[100,0]}];
  const effects=E.compile([{type:'angle',points:[1,2,3]},{type:'triangle',points:[1,2,3]}],objects,8,M.resolve);
  assert.deepEqual(E.layers({effects},{objects,time:2},p=>p,{}),{fills:[],strokes:[]});
});
test('错误目标、时间、颜色、字段明确报错',()=>{
  for(const effect of [
    {type:'line',objects:[3]}, {type:'angle',points:['A','A','C']},
    {type:'triangle',points:['A','B','none']}, {type:'line',objects:[7],start:3,end:1},
    {type:'line',objects:[7],start:0,end:1,enter:1,exit:1},
    {type:'line',objects:[7],color:'red"/>'}, {type:'triangle',points:['A','B','C'],colour:'#fff'}
  ])assert.throws(()=>M.prepare(scene,{effects:[effect]}));
});
