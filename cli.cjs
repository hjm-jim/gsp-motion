#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const G=require('./geometry-core.cjs'),M=require('./motion.cjs');
const Info=require('./info.cjs');
function usage(){console.log(`GSP motion CLI (bundled runtime; source requires Node.js 20.9+)
  gsp-motion render <scene.gsp|scene.json> --point A --from -30 --to 30
    --background white|black --labels true|false --label-size 32 --effects effects.json --output clip.mp4 --json
  gsp-motion render --request request.json --json
    --mode static --visibility visibility.json (static hide/show demonstration)
  gsp-motion doctor --json
  node cli.cjs inspect <scene.gsp|scene.json>
    Automatically writes <input-stem>.info.md beside the input.
    --info-md custom/path.md overrides the automatic Markdown location.
  node cli.cjs animate <scene.gsp|scene.json> --point A --out output
    --duration 8 --fps 30 --width 1280 --height 720
    --from -30 --to 30 (circle: degrees; line: signed coordinate distance)
    --direction cw|ccw (circle only) [--turns 1 (legacy full revolution)]
    --concyclic A,B,C --fixed 1 --perpendicular 6,7
    --background white|black --labels true|false
    --frames [--mp4] [--ffmpeg path] [--sharp-module path]

animate always writes demo.html, scene.json, model.json and report.json.
--frames writes numbered PNGs; --mp4 also writes demo.mp4 (implies --frames).
Input JSON must use the existing viewer's {objects:[...]} schema.
Driver must be an existing PointOnObject on a circle or line-like object.
Default interval: circle -30..30 degrees, line -50..50 coordinate units.
Single pass from start to end; playback stops at the end without looping.`);}
const requestKeys=new Set(['input','output','point','from','to','background','labels','labelSize','duration','fps','width','height','direction','turns','fixed','concyclic','perpendicular','report','effects','visibility','mode','infoMd']);
function readRequest(file){
  const location=path.resolve(file),base=path.dirname(location),r=JSON.parse(fs.readFileSync(location,'utf8').replace(/^\uFEFF/,''));
  if(!r || typeof r!=='object' || Array.isArray(r))throw Error('需求文件必须为 JSON 对象');
  for(const key of Object.keys(r))if(!requestKeys.has(key))throw Error('需求文件未知字段 '+key);
  if(r.effects!==undefined&&!Array.isArray(r.effects))throw Error('需求文件 effects 必须为数组');
  if(r.visibility!==undefined&&!Array.isArray(r.visibility))throw Error('需求文件 visibility 必须为数组');
  if(r.labels!==undefined && typeof r.labels!=='boolean')throw Error('需求文件 labels 必须是布尔值');
  for(const key of ['from','to','duration','fps','width','height','turns','labelSize'])if(r[key]!==undefined && (typeof r[key]!=='number'||!Number.isFinite(r[key])))throw Error('需求文件 '+key+' 必须是有限数字');
  for(const key of ['background','direction','fixed','concyclic','perpendicular','mode'])if(r[key]!==undefined && typeof r[key]!=='string')throw Error('需求文件 '+key+' 必须是字符串');
  if(r.point!==undefined && typeof r.point!=='string' && !Number.isInteger(r.point))throw Error('需求文件 point 必须是标签字符串或整数编号');
  for(const key of ['input','output','report','infoMd'])if(r[key]!==undefined){if(typeof r[key]!=='string'||!r[key])throw Error(key+' 必须为非空路径字符串');r[key]=path.resolve(base,r[key]);}
  return r;
}
function load(file,infoMd){
  const bytes=fs.readFileSync(file);
  const scene=path.extname(file).toLowerCase()==='.gsp'?G.parseGsp(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),path.basename(file)):JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
  Object.assign(scene,Info.writeAutoInfo(scene,file,bytes,infoMd));
  return scene;
}
function html(model){
  const core=fs.readFileSync(path.join(__dirname,'geometry-core.cjs'),'utf8');
  const runtime=fs.readFileSync(path.join(__dirname,'motion.cjs'),'utf8');
  const effects=fs.readFileSync(path.join(__dirname,'effects.cjs'),'utf8');
  const visibility=fs.readFileSync(path.join(__dirname,'visibility.cjs'),'utf8');
  const labels=fs.readFileSync(path.join(__dirname,'label-layout.cjs'),'utf8');
  const json=JSON.stringify(model).replace(/</g,'\\u003c');
  return `<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GSP Motion Demo</title>
<style>body{margin:0;background:#080e19;color:#d6dfed;font:16px 'Segoe UI','Microsoft YaHei',sans-serif}main{max-width:1280px;margin:24px auto;padding:0 20px}#stage svg{width:100%;height:auto;display:block;border-radius:16px}nav{display:flex;gap:16px;align-items:center;padding:22px 0}input{flex:1;accent-color:#f6b85c}button,select{background:#1e304a;color:#eef5ff;border:1px solid #3a5272;border-radius:8px;padding:10px 16px}p{color:#9eafc5;font-size:14px}</style>
<main><div id="stage"></div><nav><button id="play">播放</button><button id="reset">重置</button><input id="seek" aria-label="动画进度" type="range" min="0" max="${model.duration}" step="0.001" value="0"><select id="speed" aria-label="播放速度"><option value="0.5">0.5×</option><option selected value="1">1×</option><option value="2">2×</option></select><button id="save">导出 SVG 帧</button></nav><p>${model.mode==='static'?'保持 GSP 原始几何位置，按指定时刻隐藏/显示对象，终态保持。':'相对 GSP 原始位置，从区间起点单向运动至终点，结束后停止，不往返、不循环。'} PNG / MP4 请通过 CLI 导出。</p></main>
<script>${core}\n${visibility}\n${labels}\n${effects}\n${runtime}\nconst model=${json};
let time=0,playing=false,last=null; const stage=document.getElementById('stage'),seek=document.getElementById('seek'),play=document.getElementById('play');
function controls(){play.disabled=time>=model.duration;play.textContent=play.disabled?'已结束':playing?'暂停':'播放';}
function render(t){time=Math.max(0,Math.min(model.duration,t));if(time>=model.duration){playing=false;last=null;}stage.innerHTML=Motion.svg(model,time);seek.value=time;controls();return Motion.frame(model,time);}
function seekTo(t){playing=false;last=null;return render(t);}
window.gspMotion={model,seek:seekTo,isPlaying:()=>playing,frame:t=>Motion.frame(model,t),svg:t=>Motion.svg(model,t)};
play.onclick=()=>{if(time>=model.duration)return;playing=!playing;last=null;controls();};
document.getElementById('reset').onclick=()=>seekTo(0);
seek.oninput=()=>seekTo(Number(seek.value));
document.getElementById('save').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([Motion.svg(model,time)],{type:'image/svg+xml'}));a.download='frame-'+time.toFixed(3)+'.svg';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
function tick(now){if(playing){if(last!==null)render(time+(now-last)/1000*Number(document.getElementById('speed').value));last=playing?now:null;}requestAnimationFrame(tick);}render(0);requestAnimationFrame(tick);
</script></html>`;
}
function getSharp(explicit){
  for(const location of [explicit,process.env.GSP_SHARP_MODULE,'sharp'].filter(Boolean)){
    try{return require(location);}catch{}
  }
  throw Error('PNG 导出需要 sharp。运行 npm install sharp，或传 --sharp-module <绝对路径>');
}
async function main(args){
  if(!args.length || ['-h','--help'].includes(args[0])){usage();return;}
  if(args[0]==='--version'){console.log(require('./package.json').version);return;}
  const command=args[0],rest=args.slice(1);let input=rest[0]&&!rest[0].startsWith('--')?rest.shift():undefined;
  if(!['inspect','animate','render','doctor'].includes(command))throw Error('需要 inspect/animate/render/doctor；详见 --help');
  let options={};const flags=new Set(['frames','mp4','json']);
  const allowed=new Set(['point','out','output','request','report','info-md','background','labels','label-size','effects','visibility','mode','duration','fps','width','height','from','to','turns','direction','concyclic','fixed','perpendicular','ffmpeg','sharp-module',...flags]);
  for(let i=0;i<rest.length;i++){
    const key=rest[i].replace(/^--/,'');if(!rest[i].startsWith('--')||!allowed.has(key))throw Error('未知参数 '+rest[i]);
    if(flags.has(key))options[key]=true;else {if(rest[i+1]===undefined||rest[i+1].startsWith('--'))throw Error('参数缺少值 '+rest[i]);options[key]=rest[++i];}
  }
  if(options.request){if(command!=='render')throw Error('request 仅用于 render');const request=readRequest(options.request);input=input || request.input;options={...request,...options};}
  if(typeof options.effects==='string')options.effects=JSON.parse(fs.readFileSync(path.resolve(options.effects),'utf8').replace(/^\uFEFF/,''));
  if(typeof options.visibility==='string')options.visibility=JSON.parse(fs.readFileSync(path.resolve(options.visibility),'utf8').replace(/^\uFEFF/,''));
  if(command==='doctor'){
    let sharp;try{sharp=getSharp(options['sharp-module']);}catch{}
    const ffmpeg=options.ffmpeg||process.env.FFMPEG_PATH||'ffmpeg',r=spawnSync(ffmpeg,['-version'],{encoding:'utf8',windowsHide:true});
    const result={ok:!!sharp&&!r.error&&r.status===0,version:require('./package.json').version,node:process.version,sharp:sharp?.versions?.sharp??null,ffmpeg:r.status===0?r.stdout.split(/\r?\n/)[0]:r.error?.message||r.stderr};
    console.log(JSON.stringify(result));if(!result.ok)process.exitCode=1;return;
  }
  if(!input)throw Error('缺少输入 GSP/JSON 文件路径');
  const scene=load(input,options['info-md']??options.infoMd);
  if(command==='render'){
    const result=await require('./render.cjs').renderMp4(scene,options,getSharp);
    console.log(JSON.stringify(result));return;
  }
  if(command==='inspect'){
    console.log(JSON.stringify({file:scene.fileName||path.basename(input),infoMd:scene.infoMd,sourceSha256:scene.sourceSha256,objects:Info.describe(scene.objects)},null,2));return;
  }
  const model=M.prepare(scene,options),out=path.resolve(options.out||'output');
  fs.mkdirSync(out,{recursive:true});
  const write=(name,value)=>fs.writeFileSync(path.join(out,name),typeof value==='string'?value:JSON.stringify(value,null,2));
  write('scene.json',scene);write('model.json',model);write('demo.html',html(model));
  const count=Math.max(2,Math.ceil(model.duration*model.fps)),report={input:path.resolve(input),driver:model.driver,parent:model.parent,motionKind:model.motionKind,from:model.from,to:model.to,unit:model.unit,loop:false,sampling:'inclusive-endpoints',firstSampleTime:0,lastSampleTime:model.duration,circle:model.circle,duration:model.duration,fps:model.fps,frames:count,width:model.width,height:model.height,unsupported:model.unsupported,maxConstraintError:null,maxRadialError:null,maxFixedDisplacement:null,maxCircumcenterError:null,degenerateSamples:0,invalidSamples:0};
  let sharp,dir;
  if(options.frames||options.mp4){sharp=getSharp(options['sharp-module']);dir=path.join(out,'frames');fs.mkdirSync(dir,{recursive:true});}
  for(let i=0;i<count;i++){
    const t=model.duration*i/(count-1),f=M.frame(model,t),m=f.metrics;
    if(m.constraintError!==null) report.maxConstraintError=Math.max(report.maxConstraintError??0,m.constraintError);
    if(m.radiusError!==null) report.maxRadialError=Math.max(report.maxRadialError??0,m.radiusError);
    for(const d of m.fixedDisplacement) if(d!==null)report.maxFixedDisplacement=Math.max(report.maxFixedDisplacement??0,d);
    if(m.circumcenterError!==null) report.maxCircumcenterError=Math.max(report.maxCircumcenterError??0,m.circumcenterError);
    report.degenerateSamples+=Number(m.degenerate);report.invalidSamples+=Number(m.invalid.length>0);
    if(sharp)await sharp(Buffer.from(M.svg(model,t))).png().toFile(path.join(dir,`frame-${String(i).padStart(6,'0')}.png`));
    if(sharp && (i%30===0||i===count-1))console.log(`PNG ${i+1}/${count}`);
  }
  report.videoExported=false;write('report.json',report);
  if(options.mp4){
    const ffmpeg=options.ffmpeg||process.env.FFMPEG_PATH||'ffmpeg';
    const result=spawnSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-framerate',String(model.fps),'-i',path.join(dir,'frame-%06d.png'),'-frames:v',String(count),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'demo.mp4')],{encoding:'utf8',windowsHide:true});
    if(result.error||result.status!==0)throw Error(`FFmpeg 导出失败，HTML 与 PNG 已保留：${result.error?.message||result.stderr}`);
    report.videoExported=true;write('report.json',report);
  }
  console.log(JSON.stringify({output:out,infoMd:scene.infoMd,sourceSha256:scene.sourceSha256,...report},null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(e=>{if(process.argv[2]==='render'||process.argv.includes('--json'))console.log(JSON.stringify({ok:false,error:{message:e.message}}));else console.error('错误: '+e.message);process.exitCode=1;});
module.exports={main,load,html,readRequest};
