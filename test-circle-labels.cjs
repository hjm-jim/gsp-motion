'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('./geometry-core.cjs'),M=require('./motion.cjs');
const scene=()=>G.parseGsp(fs.readFileSync(path.join(__dirname,'examples/bug_report#1.gsp')),'bug_report#1.gsp');
const circleIds=[3,17,19,21,23,35];
test('真实 GSP 的六个圆名均渲染，下标与原始名称引用保持正确',()=>{
  const s=scene();for(const background of ['white','black']){
    const m=M.prepare(s,{mode:'static',width:1080,height:1080,background}),svg=M.svg(m,0),labels=M.labelLayout(m,0);
    for(const id of circleIds){assert.ok(labels.some(l=>l.id===id));assert.ok(svg.includes(`data-label-object="${id}"`));}
    assert.equal(labels.length,14);assert.ok(svg.includes('>23456</tspan>'));assert.equal(M.resolve(s.objects,'C[0]').index,3);
    assert.ok(labels.every(l=>l.collisions===0));
  }
});
test('圆隐藏时名称同步消失，重新显示恢复；labels=false 关闭全部文字',()=>{
  const s=scene(),m=M.prepare(s,{mode:'static',width:1080,height:1080,visibility:[{at:1,hide:[3]},{at:2,show:[3]}]});
  assert.ok(M.svg(m,0).includes('data-label-object="3"'));assert.ok(!M.svg(m,1.5).includes('data-label-object="3"'));assert.ok(M.svg(m,3).includes('data-label-object="3"'));
  assert.equal(/<text\b|<tspan\b/.test(M.svg(M.prepare(s,{mode:'static',labels:false}),0)),false);
  delete s.objects.find(o=>o.index===3).label;
  assert.ok(!M.svg(M.prepare(s,{mode:'static'}),0).includes('data-label-object="3"'),'无原始标签的圆不自动命名');
});
test('运动中圆标签跟随几何、跳帧确定，所有圆名均在画面内且无碰撞',()=>{
  const m=M.prepare(scene(),{point:'A',from:-8,to:8,duration:2,width:1080,height:1080});
  for(let i=0;i<=8;i++){const labels=M.labelLayout(m,i/4);for(const id of circleIds)assert.ok(labels.some(l=>l.id===id));assert.ok(labels.every(l=>l.collisions===0));}
  const first=M.svg(m,.4);M.svg(m,2);assert.equal(M.svg(m,.4),first);
});
