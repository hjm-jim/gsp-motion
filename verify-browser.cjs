'use strict';
// 可选的浏览器集成验证；不是 CLI 的运行依赖。
const assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const pw=require('playwright'); // Optional development dependency: npm install --no-save playwright
const M=require('./motion.cjs');
(async()=>{
  const browser=await pw.chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1360,height:930}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    for(const directory of (process.argv.slice(2).length?process.argv.slice(2):['output','output-line'])) {
    const folder=path.resolve(__dirname,directory);
    await page.goto(pathToFileURL(path.join(folder,'demo.html')).href);
    await page.waitForFunction(()=>Boolean(window.gspMotion));
    const model=JSON.parse(fs.readFileSync(path.join(folder,'model.json'),'utf8'));
    for(const t of [0,model.duration/4,model.duration*.75,0.25,model.duration]){
      const actual=await page.evaluate(t=>window.gspMotion.seek(t),t);
      assert.deepEqual(actual,JSON.parse(JSON.stringify(M.frame(model,t))));
      const actualSvg=await page.evaluate(t=>window.gspMotion.svg(t),t);
      assert.equal(actualSvg,M.svg(model,t));
    }
    await page.locator('#seek').evaluate(e=>{e.value='2';e.dispatchEvent(new Event('input'));});
    assert.equal(await page.locator('#seek').inputValue(),'2');
    await page.evaluate(t=>window.gspMotion.seek(t),model.duration/2);
    await page.screenshot({path:path.join(folder,'browser-preview.png'),fullPage:true});
    await page.evaluate(()=>window.gspMotion.seek(2));
    await page.locator('#play').click();await page.waitForFunction(()=>Number(document.getElementById('seek').value)>2.05);
    await page.locator('#play').click();
    await page.evaluate(t=>window.gspMotion.seek(t),model.duration-.05);
    await page.locator('#play').click();
    await page.waitForFunction(()=>document.getElementById('play').disabled);
    assert.equal(await page.locator('#seek').inputValue(),String(model.duration));
    await page.waitForTimeout(180);
    assert.equal(await page.locator('#seek').inputValue(),String(model.duration));
    assert.equal(await page.evaluate(()=>window.gspMotion.isPlaying()),false);
    assert.equal(await page.locator('#play').textContent(),'已结束');
    await page.screenshot({path:path.join(folder,'browser-ended.png'),fullPage:true});
    await page.locator('#reset').click();assert.equal(await page.locator('#seek').inputValue(),'0');
    assert.equal(await page.locator('#play').isEnabled(),true);
    assert.deepEqual(errors,[]);
    console.log(`PASS ${directory}: offline HTML, browser/CLI parity, playback/pause/seek, exact terminal stop without looping, reset; no JS errors`);
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
