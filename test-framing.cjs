'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('./geometry-core.cjs'),M=require('./motion.cjs'),L=require('./label-layout.cjs');
const scene=()=>G.parseGsp(fs.readFileSync(path.join(__dirname,'examples/bug_report#1.gsp')),'bug');
test('默认全高清、去除重复留白，主体占画面高度96%，不变形且保留安全边距',()=>{
  const s=scene(),m=M.prepare(s,{mode:'static'});assert.equal(m.width,1920);assert.equal(m.height,1080);
  const b=G.geometryBounds(s.objects.filter(o=>!o.hidden),false),p=M.project(m,[b.x,b.y]),q=M.project(m,[b.x+b.width,b.y+b.height]);
  assert.ok(Math.abs((q[1]-p[1])/m.height-.96)<1e-8);assert.ok(p[1]>0&&q[1]<m.height);
  assert.ok(Math.abs((q[0]-p[0])/b.width-(q[1]-p[1])/b.height)<1e-8);
  const custom=M.prepare(s,{mode:'static',width:1280,height:720});assert.equal(custom.width,1280);assert.equal(custom.height,720);
});
test('五位下标长点名参与避让，不截断；数字宽度不再按宽字母过度留位',()=>{
  const s=scene();for(const o of s.objects)if(G.POINT_TYPES.has(o.name)&&o.label)o.label='P[12345]';
  const m=M.prepare(s,{point:4,from:-8,to:8,duration:2});
  for(const t of [0,1,2]){assert.ok(M.labelLayout(m,t).every(l=>l.collisions===0));assert.ok(M.svg(m,t).includes('>12345</tspan>'));}
  assert.ok(L.dimensions('P[12345]',32,'point').w<L.dimensions('P[12345]',32).w);
  assert.ok(L.labelMarkup('P[123456]',32).includes('123456'),'更长输入保留原文');
});
