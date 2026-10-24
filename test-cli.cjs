'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process'),M=require('./motion.cjs'),{load,readRequest}=require('./cli.cjs');
const scene=load(path.join(__dirname,'examples/demo1_triangle_circumcircle.gsp'));
test('纯净画面：只有原有点标签，所有取样均无说明、面板、时间和自动编号',()=>{
  for(const background of ['white','black'])for(const t of [0,1,4,8]){
    const svg=M.svg(M.prepare(scene,{background}),t);
    assert.deepEqual([...svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map(m=>m[1]).sort(),['A','B','C']);
    assert.equal((svg.match(/<rect /g)||[]).length,1);
    assert.ok(svg.includes(`fill="${background==='white'?'#ffffff':'#000000'}"`));
  }
});
test('完全无字模式移除全部 text，白黑底的几何配色不同且不影响几何',()=>{
  const a=M.prepare(scene,{background:'white',labels:false}),b=M.prepare(scene,{background:'black',labels:false});
  assert.equal(/<text\b/.test(M.svg(a,4)),false);assert.equal(/<text\b/.test(M.svg(b,4)),false);
  assert.deepEqual(M.frame(a,4),M.frame(b,4));assert.notEqual(M.svg(a,4),M.svg(b,4));
  assert.throws(()=>M.prepare(scene,{background:'gray'}),/background/);
});
test('需求 JSON 解析以文件目录为基准，拼错键和错误类型明确失败',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gsp-motion-test-'));const file=path.join(dir,'需求.json');
  try {
    fs.writeFileSync(file,JSON.stringify({input:'源图.gsp',output:'video.mp4',point:5,labels:false}));
    const r=readRequest(file);assert.equal(r.input,path.join(dir,'源图.gsp'));assert.equal(r.output,path.join(dir,'video.mp4'));
    fs.writeFileSync(file,JSON.stringify({backgroud:'white'}));assert.throws(()=>readRequest(file),/未知字段/);
    fs.writeFileSync(file,JSON.stringify({labels:'false'}));assert.throws(()=>readRequest(file),/布尔/);
    fs.writeFileSync(file,JSON.stringify({fps:'30'}));assert.throws(()=>readRequest(file),/数字/);
  } finally {if(path.dirname(dir)===path.resolve(os.tmpdir()))fs.rmSync(dir,{recursive:true,force:true});}
});
test('失败调用返回可解析 JSON 和非零退出码',()=>{
  const r=spawnSync(process.execPath,[path.join(__dirname,'cli.cjs'),'render','missing.gsp','--output','x.mp4','--json'],{encoding:'utf8'});
  assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).ok,false);
});
