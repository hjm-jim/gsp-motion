'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('./geometry-core.cjs'),M=require('./motion.cjs'),E=require('./effects.cjs');
function scene(file){const b=fs.readFileSync(path.join(__dirname,'examples',file));return G.parseGsp(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),file);}
const circle=scene('demo1_triangle_circumcircle.gsp'),line=scene('demo1_triangle_line.gsp');
test('大字号点名和原有线名避让整个运动区间，包含高亮弧线和黑白底',()=>{
  for(const s of [circle,line])for(const background of ['white','black']){
    const ids=s===circle?[7,8]:[8,9];
    const model=M.prepare(s,{background,effects:[{type:'line',objects:ids,style:'arc',enter:1}]});
    assert.equal(model.labelSize,32);
    for(let i=0;i<=120;i++)for(const label of M.labelLayout(model,8*i/120))assert.equal(label.collisions,0,`${s.fileName},${label.id},${i}`);
    const svg=M.svg(model,4);assert.ok(svg.includes('font-size="32"'));
    if(s===line)assert.ok(svg.includes('>l</text>'));
    const saved=M.svg(model,2.73);M.svg(model,7.9);assert.equal(M.svg(model,2.73),saved);
  }
});
test('字号可调整；标签显隐与所对应对象一致，完全无字模式仍生效',()=>{
  const m=M.prepare(line,{labelSize:40,visibility:[{at:0,hide:[3]},{at:4,show:[3]}]});
  assert.equal(M.svg(m,2).includes('data-label-object="3"'),false);
  assert.ok(M.svg(m,4).includes('data-label-object="3"'));
  assert.ok(M.svg(m,4).includes('font-size="40"'));
  assert.equal(/<text\b/.test(M.svg(M.prepare(line,{labels:false}),2)),false);
  for(const labelSize of [0,11,97,NaN,Infinity])assert.throws(()=>M.prepare(line,{labelSize}),/labelSize/);
});
test('弓形弧线两端与线段重合，左右对称，拱高与长度成比例',()=>{
  const a=[10,30],b=[110,30],left=E.arcGeometry(a,b,.2,'left'),right=E.arcGeometry(a,b,.2,'right');
  assert.deepEqual(left.points[0],a);assert.deepEqual(left.points.at(-1),b);
  assert.deepEqual(left.points[32],[60,10]);assert.deepEqual(right.points[32],[60,50]);
  assert.ok(left.length>100);assert.equal(left.length,right.length);
});
test('弧线与原描线共存、不改构造；隐藏目标时高亮同步隐藏；退场及跳帧确定',()=>{
  const spec=[{type:'line',style:'arc',objects:[7,8],side:'left',enter:1},{type:'line',objects:[6]}];
  const model=M.prepare(circle,{effects:spec,visibility:[{at:3,hide:[7]}]}),plain=M.prepare(circle,{});
  const svg=M.svg(model,2);assert.equal((svg.match(/data-effect="line-arc"/g)||[]).length,2);assert.ok(svg.includes('data-effect="line"'));
  for(const t of [0,2,4,8])assert.deepEqual(M.frame(model,t),M.frame(plain,t));
  assert.equal((M.svg(model,4).match(/data-effect="line-arc"/g)||[]).length,1);
  assert.equal(/data-effect=/.test(M.svg(model,8)),false);
  const paths=E.layers(model,M.frame(model,2),p=>p,model.bounds).strokes;
  const o=M.frame(model,2).objects.find(o=>o.index===7);
  assert.ok(paths[0].includes(`M${o.derived.p1} Q`));assert.ok(paths[0].includes(` ${o.derived.p2}"`));
  assert.ok(E.state(model.effects[0],.25).reveal<E.state(model.effects[0],.75).reveal);
});
test('弧线参数和目标验证：无限直线不冒充有端点线段',()=>{
  for(const e of [{type:'line',style:'arc',objects:[3]},{type:'line',style:'arc',objects:[8],side:'up'},
    {type:'line',style:'arc',objects:[8],bend:0},{type:'line',style:'stroke',objects:[8],side:'left'},
    {type:'line',style:'bad',objects:[8]}])assert.throws(()=>M.prepare(line,{effects:[e]}));
});
