'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('./geometry-core.cjs'),M=require('./motion.cjs'),L=require('./label-layout.cjs');
const scene=()=>G.parseGsp(fs.readFileSync(path.join(__dirname,'examples/bug_report#1.gsp')),'bug');
test('三类固定字体，只有圆名有短虚线，端点精确指向所属圆周',()=>{
  const s=scene();s.objects.find(o=>o.index===36).hidden=false;s.objects.find(o=>o.index===36).visible=true;s.objects.find(o=>o.index===36).label='l';
  const m=M.prepare(s,{mode:'static',width:1080,height:1080}),svg=M.svg(m,0),labels=M.labelLayout(m,0);
  assert.ok(svg.includes('font-family="Times New Roman, serif" font-style="italic" font-weight="bold"'));
  assert.ok(svg.includes('font-family="Georgia, serif" font-style="italic" font-weight="normal"'));
  assert.ok(svg.includes('font-family="Segoe UI, Microsoft YaHei, sans-serif" font-style="normal" font-weight="normal"'));
  for(const l of labels){assert.equal(l.collisions,0);const o=s.objects.find(o=>o.index===l.id);assert.equal(!!l.leader,o.name==='Circle');if(l.leader){assert.ok(l.leader.length<50);const d=o.derived,scale=m.viewport.width/m.bounds.width,c=M.project(m,d.center);assert.ok(Math.abs(Math.hypot(l.leader.a[0]-c[0],l.leader.a[1]-c[1])-d.radius*scale)<1e-8);}}
});
test('圆名虚线随圆显隐与 labels 开关同步；点名采用紧凑字形框',()=>{
  const s=scene(),m=M.prepare(s,{mode:'static',visibility:[{at:1,hide:[3]}]});
  assert.ok(M.svg(m,0).includes('data-label-leader="3"'));assert.ok(!M.svg(m,2).includes('data-label-leader="3"'));
  assert.ok(!M.svg(M.prepare(s,{mode:'static',labels:false}),0).includes('data-label-leader'));
  const o=s.objects.find(o=>o.index===4),obs={points:[{id:o.index,p:[100,100],radius:4}],paths:[]};
  assert.ok(L.candidates(o,obs,32)[0].h<L.dimensions(o.label,32).h);
});
test('圆名数字下标使用 Segoe UI 的窄数字宽度，引导线连到文字区域',()=>{
  assert.ok(L.dimensions('C[12356]',32,'circle').w<L.dimensions('C[12356]',32).w-20);
  const m=M.prepare(scene(),{mode:'static'});
  for(const label of M.labelLayout(m,0).filter(l=>l.leader)){
    assert.equal(label.collisions,0);assert.ok(label.leader.length<40);
    if(label.inkBox){const r=label.inkBox,p=label.leader.b;assert.ok(p[0]>=r.x-1e-8&&p[0]<=r.x+r.w+1e-8);assert.ok(p[1]>=r.y-1e-8&&p[1]<=r.y+r.h+1e-8);}
  }
});
