'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('./geometry-core.cjs'),M=require('./motion.cjs');
const scene=()=>G.parseGsp(fs.readFileSync(path.join(__dirname,'examples/demo1_triangle_circumcircle.gsp')),'demo');
const base=(svg,id)=>svg.includes(`data-object="${id}"`);
const effect=(svg,type,id)=>svg.includes(`data-effect="${type}" data-effect-object="${id}"`);
test('点和圆高亮添加叠加层，不改变基础对象、显隐、几何或其他对象',()=>{
  const s=scene(),p=M.prepare(s,{mode:'static'}),h=M.prepare(s,{mode:'static',effects:[{type:'point',objects:['A','B']},{type:'circle',objects:[3]}]});
  assert.deepEqual(M.frame(p,3),M.frame(h,3));
  const svg=M.svg(h,3);assert.ok(effect(svg,'point',5));assert.ok(effect(svg,'point',4));assert.ok(effect(svg,'circle',3));
  for(const id of [2,3,4,5,6,7,8])assert.ok(base(svg,id));
  assert.ok(!M.svg(h,8).includes('data-effect='));for(const id of [3,5])assert.ok(base(M.svg(h,8),id));
});
test('原图隐藏或事件隐藏的点/圆不会被高亮自动显示；独立 show 才恢复',()=>{
  const s=scene();for(const id of [3,5]){const o=s.objects.find(o=>o.index===id);o.hidden=true;o.visible=false;}
  const m=M.prepare(s,{mode:'static',effects:[{type:'point',objects:[5],enter:0},{type:'circle',objects:[3],enter:0}],visibility:[{at:2,show:[3,5]},{at:4,hide:[3,5]},{at:6,show:[3,5]}]});
  for(const t of [0,1,4,5]){const svg=M.svg(m,t);for(const id of [3,5])assert.ok(!base(svg,id));assert.ok(!effect(svg,'circle',3));assert.ok(!effect(svg,'point',5));}
  for(const t of [2,3,6,7]){const svg=M.svg(m,t);assert.ok(base(svg,3));assert.ok(base(svg,5));assert.ok(effect(svg,'circle',3));assert.ok(effect(svg,'point',5));}
});
test('初始显示在第一帧生效，显示不是白名单，高亮不把对象集合缩成目标集合',()=>{
  const s=scene(),m=M.prepare(s,{mode:'static',visibility:[{at:0,show:[2,4,5,6,7,8],hide:[1,3]},{at:2,show:[3]},{at:5,hide:[3]}],effects:[{type:'point',objects:[5],start:3,end:6},{type:'circle',objects:[3],start:3,end:6},{type:'line',objects:[7],start:3,end:6}]});
  assert.ok(!base(M.svg(m,0),3));assert.ok(base(M.svg(m,2),3));assert.ok(effect(M.svg(m,4),'circle',3));assert.ok(!effect(M.svg(m,5.5),'circle',3));assert.ok(!base(M.svg(m,8),3));assert.ok(base(M.svg(m,8),5));assert.ok(base(M.svg(m,8),7));
  const show=M.prepare(s,{mode:'static',visibility:[{at:0,show:[3]}]});assert.ok(base(M.svg(show,0),7),'show 不会自动隐藏其他线');
});
test('高亮目标类型校验，点不是驱动参数；动画可倒序取样且点名避开外圈',()=>{
  for(const e of [{type:'point',objects:[3]},{type:'circle',objects:['A']},{type:'point',points:['A']},{type:'circle',objects:[]}])assert.throws(()=>M.prepare(scene(),{mode:'static',effects:[e]}));
  for(const background of ['white','black']){
    const m=M.prepare(scene(),{point:'A',background,effects:[{type:'point',objects:['A'],width:12},{type:'circle',objects:[3],width:10}]});
    for(const t of [0,.25,1,3,7.8,8])assert.ok(M.labelLayout(m,t).every(l=>l.collisions===0));
    const first=M.svg(m,2);M.svg(m,7);assert.equal(M.svg(m,2),first);
  }
});
