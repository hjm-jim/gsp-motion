'use strict';
// Development-only visual verification; does not write input .info.md files.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const sharp=require('sharp'),pw=require('playwright'); // Playwright is optional for visual checks.
const G=require('../geometry-core.cjs'),M=require('../motion.cjs'),{html}=require('../cli.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'label-arc-preview');
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await pw.chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1360,height:930}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    for(const [kind,background,ids] of [['circumcircle','white',[7,8]],['line','black',[8,9]]]){
      const file=`demo1_triangle_${kind}.gsp`,b=fs.readFileSync(path.join(root,'examples',file));
      const scene=G.parseGsp(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),file);
      const model=M.prepare(scene,{background,effects:[{type:'line',objects:ids,style:'arc',enter:.8,exit:.5}]});
      const name=kind==='line'?'line-black':'circle-white';
      await page.goto('about:blank');
      await page.setContent(html(model));
      await page.waitForFunction(()=>Boolean(window.gspMotion));
      for(const t of [0,.15,.4,1,2,3,4,5,6,7,7.9,8]){
        const actual=await page.evaluate(t=>{window.gspMotion.seek(t);return window.gspMotion.svg(t);},t);
        assert.equal(actual,M.svg(model,t),'browser and rasterizer SVG must agree');
        const hits=await page.evaluate(()=>{
          const svg=document.querySelector('#stage svg'),labels=[...svg.querySelectorAll('text')].map(e=>({id:e.dataset.labelObject,b:e.getBBox()}));
          const hits=[];
          // Independent check using actual browser glyph bounds and SVG path measurements.
          for(const {id,b} of labels){
            const inside=p=>p.x>=b.x-4&&p.x<=b.x+b.width+4&&p.y>=b.y-4&&p.y<=b.y+b.height+4;
            if(b.x<0||b.y<0||b.x+b.width>svg.viewBox.baseVal.width||b.y+b.height>svg.viewBox.baseVal.height)hits.push(`label ${id} outside frame`);
            for(const e of svg.querySelectorAll('line,circle,path[fill="none"]')){
              const len=e.getTotalLength();
              for(let s=0;s<=len;s+=1)if(inside(e.getPointAtLength(s))){hits.push(`label ${id} crosses ${e.dataset.object||e.dataset.effect}`);break;}
            }
            for(const other of labels)if(other.id!==id&&b.x<other.b.x+other.b.width&&b.x+b.width>other.b.x&&b.y<other.b.y+other.b.height&&b.y+b.height>other.b.y)hits.push(`labels ${id}/${other.id} overlap`);
          }
          return hits;
        });
        assert.deepEqual(hits,[],`${kind} at ${t}`);
      }
      await sharp(Buffer.from(M.svg(model,4))).png().toFile(path.join(out,name+'.png'));
      await page.evaluate(()=>window.gspMotion.seek(4));
      await page.locator('#stage svg').screenshot({path:path.join(out,name+'-browser.png')});
      assert.deepEqual(errors,[]);
      console.log(`PASS ${name}: native PNG, offline browser parity, actual glyph bounds clear of all strokes at 12 timestamps`);
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
