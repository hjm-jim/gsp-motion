'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('./geometry-core.cjs'),M=require('./motion.cjs'),L=require('./label-layout.cjs'),I=require('./info.cjs');
function scene(kind='circumcircle'){
  const file=`demo1_triangle_${kind}.gsp`,b=fs.readFileSync(path.join(__dirname,'examples',file));
  const s=G.parseGsp(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),file);
  for(const o of s.objects){if(o.label==='A')o.label='A[12]';if(o.label==='B')o.label='B[n]';}
  return s;
}
test('方括号数字和文本成为下标；原名称和编号仍可驱动、强调和显隐',()=>{
  const s=scene(),before=JSON.stringify(s),model=M.prepare(s,{point:'A[12]',effects:[{type:'angle',points:['B[n]','A[12]','C']}],visibility:[{at:6,hide:['B[n]']}]});
  assert.equal(model.driver,5);assert.equal(M.resolve(s.objects,'B[n]').index,4);
  assert.throws(()=>M.resolve(s.objects,'A₁₂'),/不存在/);
  assert.equal(JSON.stringify(s),before);
  const svg=M.svg(model,4);
  assert.ok(svg.includes('data-subscript="true"'));assert.ok(svg.includes('>12</tspan>'));assert.ok(svg.includes('>n</tspan>'));
  assert.equal(svg.includes('A[12]'),false);assert.equal(svg.includes('B[n]'),false);
  assert.ok(svg.includes('data-effect="angle"'));assert.equal(M.svg(model,7).includes('data-label-object="4"'),false);
  assert.equal(I.describe(s.objects).find(o=>o.index===5).label,'A[12]');
  assert.ok(I.markdown(s,'fixture.gsp','0'.repeat(64)).includes('<code>"A[12]"</code>'));
});
test('多位文本下标与后缀正常排版；不支持的括号段保留原样',()=>{
  assert.deepEqual(L.labelRuns('A[12]B[n]'),[{text:'A',subscript:false},{text:'12',subscript:true},{text:'B',subscript:false},{text:'n',subscript:true}]);
  assert.deepEqual(L.labelRuns('P[k+1]'),[{text:'P',subscript:false},{text:'k+1',subscript:true}]);
  for(const label of ['A','A[]','A[12','A[[n]]','[n]'])assert.equal(L.labelMarkup(label,32),label);
  const markup=L.labelMarkup('A[1]B',40);
  const shifts=[...markup.matchAll(/dy="([^"]+)"/g)].map(m=>Number(m[1]));
  assert.ok(shifts.at(-1)<0,'后缀从下标回到主基线');assert.equal(shifts.reduce((a,b)=>a+b,0),0);
});
test('下标内容仅作文字，转义 XML；隐藏标签同时移除所有下标',()=>{
  const markup=L.labelMarkup('A[<img onerror="x">&]',32);
  assert.equal(markup.includes('<img'),false);assert.ok(markup.includes('&lt;img'));assert.ok(markup.includes('&amp;'));
  const model=M.prepare(scene(),{point:'A[12]',labels:false});
  assert.equal(/<text\b|<tspan\b/.test(M.svg(model,4)),false);
});
test('下标尺寸参与避让；圆/直线运动、白黑底下均可重现任意帧',()=>{
  for(const kind of ['circumcircle','line'])for(const background of ['white','black']){
    const model=M.prepare(scene(kind),{point:'A[12]',background});
    for(let i=0;i<=80;i++)for(const label of M.labelLayout(model,i/10))assert.equal(label.collisions,0,`${kind}, ${background}, #${label.id}, t=${i/10}`);
    const svg=M.svg(model,2.51);M.svg(model,7.9);assert.equal(M.svg(model,2.51),svg);
  }
});
