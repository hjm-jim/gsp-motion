'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const M=require('./motion.cjs'),G=require('./geometry-core.cjs'),V=require('./visibility.cjs'),{load}=require('./cli.cjs');
const scene=load(path.join(__dirname,'examples/demo1_triangle_circumcircle.gsp'));
const events=[{at:0,hide:[7,8]},{at:2,show:[7]},{at:4,show:[8]},{at:6,hide:[7,8]}];
const model=M.prepare(scene,{mode:'static',visibility:events});
const drawn=(svg,id)=>svg.includes(`data-object="${id}"`);
test('显式列表按时刻隐藏/显示，结束保持隐藏，不恢复原状态',()=>{
  for(const [time,ab,ac] of [[0,false,false],[1.999,false,false],[2,true,false],[3,true,false],[4,true,true],[5,true,true],[6,false,false],[8,false,false],[80,false,false]]){
    const svg=M.svg(model,time);assert.equal(drawn(svg,7),ab);assert.equal(drawn(svg,8),ac);
    for(const id of [2,3,4,5,6])assert.equal(drawn(svg,id),true);
  }
});
test('static 不需要驱动点，所有几何位置在全片保持 GSP 原始位置',()=>{
  const baseline=M.frame(model,0).objects;
  for(const time of [0,1,2,4,6,8])assert.deepEqual(M.frame(model,time).objects,baseline);
  assert.equal(model.driver,null);assert.equal(model.motionKind,'static');
  assert.deepEqual(G.pointOf(baseline.find(o=>o.label==='A')),G.pointOf(scene.objects.find(o=>o.label==='A')));
  const onlyFree={objects:[{index:1,name:'Point',dependencies:[],coordinates:[0,0]},{index:2,name:'Point',dependencies:[],coordinates:[100,0]},{index:3,name:'Segment',dependencies:[1,2]}]};
  const m=M.prepare(onlyFree,{mode:'static',visibility:[{hide:[3]}]});assert.equal(drawn(M.svg(m,4),3),false);
});
test('彻底隐藏包含高亮描线，不影响点、圆及几何依赖',()=>{
  const m=M.prepare(scene,{mode:'static',visibility:events,effects:[{type:'line',objects:[7,8],enter:0,exit:0}]});
  assert.equal(/data-effect="line"/.test(M.svg(m,1)),false);
  assert.equal((M.svg(m,3).match(/data-effect="line"/g)||[]).length,1);
  assert.equal((M.svg(m,5).match(/data-effect="line"/g)||[]).length,2);
  assert.equal(/data-effect="line"/.test(M.svg(m,7)),false);
  const base=M.prepare(scene,{mode:'static'});assert.deepEqual(M.frame(m,7),M.frame(base,7));
});
test('显式 show 可显示 GSP 原本隐藏的线、点、圆，hide 点同时移除标签',()=>{
  const s=structuredClone(scene);for(const id of [3,5,7]){const o=s.objects.find(o=>o.index===id);o.hidden=true;o.visible=false;}
  const m=M.prepare(s,{mode:'static',visibility:[{at:2,show:[3,'A',7]},{at:4,hide:['A',3]}]});
  for(const id of [3,5,7]){assert.equal(drawn(M.svg(m,0),id),false);assert.equal(drawn(M.svg(m,2),id),true);}
  assert.equal(drawn(M.svg(m,4),3),false);assert.equal(drawn(M.svg(m,4),5),false);
  assert.equal(M.svg(m,4).includes('data-label-object="5"'),false);assert.equal(drawn(M.svg(m,4),7),true);
});
test('后续事件覆盖先前状态，相同时刻 hide 优先，不依赖配置顺序',()=>{
  for(const visibility of [[{at:2,hide:[7]},{at:2,show:[7]},{at:3,show:[7]}],[{at:3,show:[7]},{at:2,show:[7]},{at:2,hide:[7]}]]){
    const m=M.prepare(scene,{mode:'static',visibility});assert.equal(drawn(M.svg(m,2),7),false);assert.equal(drawn(M.svg(m,3),7),true);
  }
});
test('隐藏/显示取样可倒序跳转，无顺序依赖，不修改源图或默认显隐',()=>{
  const before=JSON.stringify(scene),svg=M.svg(model,3);M.svg(model,7);M.svg(model,1);assert.equal(M.svg(model,3),svg);
  assert.equal(JSON.stringify(scene),before);
  const m=M.prepare(scene,{mode:'static',visibility:[{at:2,hide:[7]},{at:8,show:[7]}]});
  assert.equal(drawn(M.svg(m,7.9),7),false);assert.equal(drawn(M.svg(m,8),7),true);
});
test('运动模式也支持显隐，但不改变原有运动及依赖重算',()=>{
  const a=M.prepare(scene,{visibility:[{hide:[7,8]}]}),b=M.prepare(scene,{});
  assert.deepEqual(M.frame(a,4),M.frame(b,4));assert.equal(drawn(M.svg(a,4),7),false);
  assert.notDeepEqual(G.pointOf(M.frame(a,0).objects.find(o=>o.index===5)),G.pointOf(M.frame(a,8).objects.find(o=>o.index===5)));
});
test('短时间显示窗口也计入固定镜头，不因原文件隐藏而跑出画面',()=>{
  const s=structuredClone(scene);s.objects.push({index:99,name:'Point',dependencies:[],coordinates:[9000,9000],hidden:true});
  const m=M.prepare(s,{mode:'static',visibility:[{at:1.01,show:[99]},{at:1.02,hide:[99]}]});
  assert.ok(m.bounds.x+m.bounds.width>9000);assert.ok(m.bounds.y+m.bounds.height>9000);assert.equal(drawn(M.svg(m,1.015),99),true);
});
test('列表格式、目标、时刻和静态模式冲突参数明确报错',()=>{
  for(const visibility of [[{}],[{hide:[]}],[{hide:'A'}],[{hide:[999]}],[{at:-1,hide:[7]}],[{at:9,show:[7]}],[{at:0,hied:[7]}]])assert.throws(()=>M.prepare(scene,{mode:'static',visibility}));
  assert.throws(()=>M.prepare(scene,{mode:'static',point:'A'}),/static/);
  assert.throws(()=>M.prepare(scene,{mode:'other'}),/mode/);
  assert.equal(V.visible(model,0,null),false);
});
