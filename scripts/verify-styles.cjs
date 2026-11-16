'use strict';
// Optional headless SVG/browser check. No desktop application is opened or controlled.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const sharp=require('sharp'),pw=require(process.env.GSP_PLAYWRIGHT_MODULE||'playwright');
const G=require('../geometry-core.cjs'),M=require('../motion.cjs'),{html}=require('../cli.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'style-preview');
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const browser=await pw.chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    for(const name of ['base','color','dash','width','point-size'])for(const background of ['white','black']){
      const scene=G.parseGsp(fs.readFileSync(path.join(root,'examples',`style-${name}.gsp`)),name);
      const model=M.prepare(scene,{mode:'static',background,width:720,height:1280,duration:1,fps:12});
      await page.goto('about:blank');await page.setContent(html(model));
      await page.waitForFunction(()=>Boolean(window.gspMotion));
      for(const time of [0,.5,1]){
        const actual=await page.evaluate(t=>{window.gspMotion.seek(t);return window.gspMotion.svg(t);},time);
        assert.equal(actual,M.svg(model,time),'browser and exported SVG must match');
        const boxes=await page.evaluate(()=>[...document.querySelectorAll('#stage text')].map(e=>{
          const b=e.getBBox();return {id:Number(e.dataset.labelObject),x:b.x,y:b.y,w:b.width,h:b.height};
        }));
        const plan=M.labelLayout(model,time);
        for(const box of boxes){const p=plan.find(p=>p.id===box.id);assert.equal(p.collisions,0);assert.ok(box.x>=p.x&&box.y>=p.y&&box.x+box.w<=p.x+p.w&&box.y+box.h<=p.y+p.h);}
        const attributes=await page.evaluate(()=>[...document.querySelectorAll('#stage [data-object]')].map(e=>({id:Number(e.dataset.object),stroke:e.getAttribute('stroke'),fill:e.getAttribute('fill'),dash:e.getAttribute('stroke-dasharray')})));
        if(name==='color'&&background==='white')for(const [id,color] of [[4,'#ff0000'],[7,'#00ffff'],[11,'#808080']])assert.equal(attributes.find(a=>a.id===id).stroke,color);
        if(name==='dash'){assert.equal(attributes.find(a=>a.id===4).dash,'18 12');assert.equal(attributes.find(a=>a.id===7).dash,'0 6');}
      }
      const svg=M.svg(model,0),png=await sharp(Buffer.from(svg)).png().toBuffer();
      fs.writeFileSync(path.join(out,`${name}-${background}.png`),png);
      fs.writeFileSync(path.join(out,`${name}-${background}.html`),html(model));
      if(name==='color'&&background==='white'){
        const {data,info}=await sharp(png).removeAlpha().raw().toBuffer({resolveWithObject:true});
        for(const rgb of [[255,0,0],[0,255,255],[128,128,128]]){
          let count=0;for(let i=0;i<data.length;i+=info.channels)if(rgb.every((v,k)=>data[i+k]===v))count++;
          assert.ok(count>50,'native RGB must reach actual PNG pixels: '+rgb);
        }
      }
      console.log(`PASS ${name}/${background}: source style, glyph bounds, label clearance, browser/SVG parity, PNG`);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
