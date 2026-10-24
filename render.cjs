'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const M=require('./motion.cjs');
async function renderMp4(scene,options,getSharp) {
  if(!options.output || path.extname(options.output).toLowerCase()!=='.mp4') throw Error('render 需要 --output <文件.mp4> 或需求文件中的 output');
  const output=path.resolve(options.output),model=M.prepare(scene,options),sharp=getSharp(options['sharp-module']);
  if(options.report && (path.extname(options.report).toLowerCase()!=='.json' || path.resolve(options.report)===output))throw Error('report 必须是独立的 .json 文件路径');
  const count=Math.max(2,Math.ceil(model.duration*model.fps));
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gsp-motion-'));
  const report={ok:false,output,background:model.background,labels:model.labels,labelSize:model.labelSize,motionKind:model.motionKind,driver:model.driver,parent:model.parent,from:model.from,to:model.to,unit:model.unit,loop:false,duration:count/model.fps,fps:model.fps,width:model.width,height:model.height,frames:count,sampling:'inclusive-endpoints',maxConstraintError:null,invalidSamples:0,labelCollisionSamples:0};
  try {
    for(let i=0;i<count;i++) {
      const t=model.duration*i/(count-1),f=M.frame(model,t);
      if(f.metrics.constraintError!==null)report.maxConstraintError=Math.max(report.maxConstraintError??0,f.metrics.constraintError);
      report.invalidSamples+=Number(f.metrics.invalid.length>0);
      if(model.labels&&M.labelLayout(model,t).some(label=>label.collisions>0))report.labelCollisionSamples++;
      await sharp(Buffer.from(M.svg(model,t))).png().toFile(path.join(temp,`frame-${String(i).padStart(6,'0')}.png`));
      if(i%30===0 || i===count-1)process.stderr.write(`GSP motion: ${i+1}/${count}\n`);
    }
    const video=path.join(temp,'video.mp4');
    const result=spawnSync(options.ffmpeg || process.env.FFMPEG_PATH || 'ffmpeg',[
      '-y','-hide_banner','-loglevel','error','-framerate',String(model.fps),'-i',path.join(temp,'frame-%06d.png'),
      '-frames:v',String(count),'-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',video
    ],{encoding:'utf8',windowsHide:true});
    if(result.error || result.status!==0)throw Error(`FFmpeg 导出失败：${result.error?.message || result.stderr}`);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.copyFileSync(video,output);report.ok=true;
    if(options.report)fs.writeFileSync(path.resolve(options.report),JSON.stringify(report,null,2));
    return {...report,infoMd:scene.infoMd,sourceSha256:scene.sourceSha256};
  } finally {
    // 只清理由本次 mkdtemp 创建的临时目录；不删除用户的输出或帧文件夹。
    const resolved=path.resolve(temp);
    if(path.dirname(resolved)===path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('gsp-motion-'))fs.rmSync(resolved,{recursive:true,force:true});
  }
}
module.exports={renderMp4};
