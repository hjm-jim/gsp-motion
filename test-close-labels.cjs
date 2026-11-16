'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),L=require('./label-layout.cjs');
const model={scene:{objects:[{index:1,name:'Point',label:'P',dependencies:[],coordinates:[200,200]}]},width:500,height:500,labelSize:32,labelPlan:{1:280}};
const frame={objects:model.scene.objects};
test('远处的预规划位置在近处有空白时收近，仍保留点和文字安全间距',()=>{
  const obstacles={points:[{id:1,p:[200,200],radius:5}],paths:[]};
  const [label]=L.layout(model,frame,obstacles);
  assert.equal(label.collisions,0);assert.ok(L.pointGap(label,[200,200])>=8);assert.ok(L.pointGap(label,[200,200])<10);
});
test('临近线条消失后标签自动收近；保留正安全间隙，倒序求布局保持确定',()=>{
  const point={id:1,p:[200,200],radius:5},clear={points:[point],paths:[]};
  const blocked={points:[point],paths:[170,185,200,215,230].flatMap(v=>[{width:10,points:[[v,150],[v,250]]},{width:10,points:[[150,v],[250,v]]}])};
  const far=L.layout(model,frame,blocked)[0],near=L.layout(model,frame,clear)[0];
  assert.equal(far.collisions,0);assert.equal(near.collisions,0);assert.ok(L.pointGap(far,point.p)>L.pointGap(near,point.p)+20);
  assert.deepEqual(L.layout(model,frame,blocked)[0],far);
});
