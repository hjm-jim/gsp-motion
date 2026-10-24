'use strict';
const path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const sharp=require('sharp');
const folder=path.resolve(__dirname,'../visibility-output');
(async()=>{
  const tiles=[];
  for(const [i,time] of [1,3,5,7].entries()){
    const image=path.join(folder,`stage-${i+1}.png`);
    const r=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-ss',String(time),'-i',path.join(folder,'circle-white.mp4'),'-frames:v','1',image],{encoding:'utf8',windowsHide:true});
    if(r.error||r.status!==0)throw Error(r.error?.message||r.stderr);
    tiles.push({input:await sharp(image).resize(640,360).toBuffer(),left:(i%2)*640,top:Math.floor(i/2)*360});
  }
  await sharp({create:{width:1280,height:720,channels:3,background:'#fff'}}).composite(tiles).png().toFile(path.join(folder,'visibility-contact-sheet.png'));
  console.log('Captured actual video stages: none / AB / AB+AC / none');
})().catch(e=>{console.error(e);process.exitCode=1;});
