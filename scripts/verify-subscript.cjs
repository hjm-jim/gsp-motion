'use strict';
// Optional visual check: install Playwright or set GSP_PLAYWRIGHT_MODULE to its module path.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sharp=require('sharp'),pw=require(process.env.GSP_PLAYWRIGHT_MODULE||'playwright');
const G=require('../geometry-core.cjs'),M=require('../motion.cjs'),{html}=require('../cli.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'subscript-preview');
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const file='demo1_triangle_circumcircle.gsp',b=fs.readFileSync(path.join(root,'examples',file));
  const scene=G.parseGsp(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),file);
  for(const o of scene.objects){if(o.label==='A')o.label='A[12]';if(o.label==='B')o.label='B[n]';if(o.label==='C')o.label='C[k+1]';}
  fs.writeFileSync(path.join(out,'scene.json'),JSON.stringify(scene,null,2));
  const browser=await pw.chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1360,height:930}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    for(const background of ['white','black']){
      const model=M.prepare(scene,{point:'A[12]',background,duration:1,fps:12});
      fs.writeFileSync(path.join(out,background+'.html'),html(model));
      await page.goto('about:blank');await page.setContent(html(model));
      await page.waitForFunction(()=>Boolean(window.gspMotion));
      for(const t of [0,.125,.5,.9,1]){
        const actual=await page.evaluate(t=>{window.gspMotion.seek(t);return window.gspMotion.svg(t);},t);
        assert.equal(actual,M.svg(model,t));
        const data=await page.evaluate(()=>{
          const svg=document.querySelector('#stage svg'),labels=[...svg.querySelectorAll('text')];
          return labels.map(e=>{
            const spans=[...e.querySelectorAll('tspan')],base=spans.find(s=>!s.dataset.subscript),sub=spans.find(s=>s.dataset.subscript);
            const box=e.getBBox(),a=base.getBBox(),b=sub.getBBox(),hits=[];
            for(const shape of svg.querySelectorAll('line,circle,path[fill="none"]')){
              const len=shape.getTotalLength();
              for(let n=0;n<=len;n+=1){const p=shape.getPointAtLength(n);if(p.x>=box.x-4&&p.x<=box.x+box.width+4&&p.y>=box.y-4&&p.y<=box.y+box.height+4){hits.push(shape.dataset.object||shape.dataset.effect);break;}}
            }
            return {id:Number(e.dataset.labelObject),text:e.textContent,box:{x:box.x,y:box.y,w:box.width,h:box.height},base:{y:a.y,h:a.height},sub:{y:b.y,h:b.height},hits};
          });
        });
        assert.equal(data.length,3);
        const planned=M.labelLayout(model,t);
        for(const label of data){
          assert.equal(label.text.includes('[')||label.text.includes(']'),false);
          assert.ok(label.sub.y>label.base.y,'实际下标字形应低于主字形');
          assert.ok(label.sub.h<label.base.h,'实际下标字号应更小');
          assert.deepEqual(label.hits,[],`glyph collision #${label.id}, ${background}, t=${t}`);
          const p=planned.find(x=>x.id===label.id),q=label.box;
          assert.ok(q.x>=p.x&&q.y>=p.y&&q.x+q.w<=p.x+p.w&&q.y+q.h<=p.y+p.h,'字形范围应包含在避让框内');
        }
        assert.deepEqual(data.map(x=>x.text).sort(),['A12','Bn','Ck+1']);
      }
      await sharp(Buffer.from(M.svg(model,.5))).png().toFile(path.join(out,background+'.png'));
      console.log(`PASS ${background}: actual subscript size/baseline, glyph bounds, geometry clearance, browser/SVG parity`);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
