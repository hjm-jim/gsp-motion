'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('./geometry-core.cjs'),M=require('./motion.cjs'),S=require('./styles.cjs'),L=require('./label-layout.cjs'),I=require('./info.cjs');
const bytes=name=>fs.readFileSync(path.join(__dirname,'examples',`style-${name}.gsp`));
const scene=name=>G.parseGsp(bytes(name),name);
const object=(s,id)=>s.objects.find(o=>o.index===id);
test('用户五份真实样例：RGB、虚实线、四档线宽与四档点大小逐对象对应',()=>{
  const base=scene('base'),color=scene('color'),dash=scene('dash'),width=scene('width'),point=scene('point-size');
  assert.equal(base.fileVersion,5);assert.deepEqual(base.styleWarnings,[]);
  assert.deepEqual([4,7,11].map(id=>object(color,id).nativeStyle.color),['#ff0000','#00ffff','#808080']);
  assert.deepEqual([4,7,11].map(id=>object(dash,id).nativeStyle.dash),['dashed','dotted','solid']);
  assert.equal(object(base,4).nativeStyle.width,3);
  assert.deepEqual([4,7,11].map(id=>object(width,id).nativeStyle.width),[.5,1,5]);
  assert.deepEqual([8,5,1,2].map(id=>object(point,id).nativeStyle.pointRadius),[1.5,2,4,6]);
  assert.deepEqual([8,5,1,2].map(id=>object(point,id).nativeStyle.pointSizeIndex),[0,1,2,3]);
});
test('白底继承 GSP，黑底换配色且保留粗细/点大小/虚实线；不修改源图',()=>{
  const s=scene('dash'),before=JSON.stringify(s);
  const white=M.prepare(s,{mode:'static'}),black=M.prepare(s,{mode:'static',background:'black'});
  const w=M.svg(white,0),b=M.svg(black,0);
  assert.match(w,/<line data-object="4"[^>]*stroke="#000080"[^>]*stroke-width="3"[^>]*stroke-dasharray="18 12"/);
  assert.match(w,/<circle data-object="7"[^>]*stroke="#008000"[^>]*stroke-dasharray="0 6"[^>]*stroke-linecap="round"/);
  assert.match(b,/<line data-object="4"[^>]*stroke="#d9e2ed"[^>]*stroke-width="3"[^>]*stroke-dasharray="18 12"/);
  assert.match(w,/<circle data-object="1"[^>]*r="4"[^>]*fill="#ff0000"/);
  assert.equal(JSON.stringify(s),before);assert.deepEqual(M.frame(white,1),M.frame(black,1));
});
test('原始样式保留到运动和 JSON 中，名称避让使用真实粗细和点大小',()=>{
  const s=scene('point-size'),m=M.prepare(s,{mode:'static'});
  const obs=L.geometry(m.scene.objects,p=>p,m.bounds,()=>true,o=>S.appearance(m,o));
  assert.equal(obs.points.find(p=>p.id===2).radius,6.75);
  assert.equal(obs.points.find(p=>p.id===8).radius,1.5);
  const s2=G.parseGsp(fs.readFileSync(path.join(__dirname,'examples/demo1_triangle_circumcircle.gsp')),'circle');
  const motion=M.prepare(JSON.parse(JSON.stringify(s2)),{});
  for(const t of [0,2.7,8]){
    assert.match(M.svg(motion,t),/<line data-object="7"[^>]*stroke="#000080"/);
    assert.deepEqual(M.frame(motion,t).objects.map(o=>o.nativeStyle),motion.scene.objects.map(o=>o.nativeStyle));
  }
  assert.ok(I.markdown(s,'points.gsp','0'.repeat(64)).includes('## GSP 原始外观'));
  assert.equal(I.describe(s.objects).find(o=>o.index===2).nativeStyle.pointRadius,6);
});
test('未知文件版本或非法保留位不套用 v5 样式；旧 JSON 回退到默认外观',()=>{
  const b=Buffer.from(bytes('base'));
  let off=4;while(b.readUInt32LE(off+4)!==900)off+=8+b.readUInt32LE(off)+(b.readUInt32LE(off)&1);
  b.writeUInt16LE(4,off+8);
  const legacy=G.parseGsp(b,'legacy');assert.equal(legacy.objects[0].nativeStyle,null);assert.equal(legacy.styleWarnings.length,11);
  const invalid=Buffer.from(bytes('base')),first=object(scene('base'),1);
  invalid.writeUInt16LE(0xf221,Number(first.headerOffset)+8+10);
  assert.equal(G.parseGsp(invalid,'invalid').objects[0].nativeStyle,null);
  const old=scene('base');for(const o of old.objects)delete o.nativeStyle;
  const m=M.prepare(old,{mode:'static'});assert.equal(S.appearance(m,object(old,4)).color,'#303d4a');
});
test('JSON 中非法样式不可注入 SVG，未实现的 styles 字段仍被请求校验拒绝',()=>{
  const s=scene('base');s.objects[0].nativeStyle.color='red"/><script/>';
  assert.throws(()=>M.prepare(s,{mode:'static'}),/nativeStyle/);
  const os=require('node:os'),{readRequest}=require('./cli.cjs'),folder=fs.mkdtempSync(path.join(os.tmpdir(),'gsp-style-request-'));
  const file=path.join(folder,'request.json');
  try{fs.writeFileSync(file,JSON.stringify({styles:[]}));assert.throws(()=>readRequest(file),/未知字段 styles/);}
  finally{fs.unlinkSync(file);fs.rmdirSync(folder);}
});
