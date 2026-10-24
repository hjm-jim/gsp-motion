'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'effects-output');
(async()=>{
  const samples=[['circle-white.mp4',1,'lines.png'],['circle-white.mp4',4,'angle.png'],['circle-white.mp4',6.4,'triangle-white.png'],['circle-black.mp4',6.4,'triangle-black.png']];
  const tiles=[];
  for(let i=0;i<samples.length;i++){
    const [file,time,image]=samples[i];
    const result=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-ss',String(time),'-i',path.join(folder,file),'-frames:v','1',path.join(folder,image)],{encoding:'utf8',windowsHide:true});
    if(result.error||result.status!==0)throw Error(result.error?.message||result.stderr);
    tiles.push({input:await sharp(path.join(folder,image)).resize(640,360).toBuffer(),left:(i%2)*640,top:Math.floor(i/2)*360});
  }
  await sharp({create:{width:1280,height:720,channels:3,background:'#ddd'}}).composite(tiles).png().toFile(path.join(folder,'effects-contact-sheet.png'));
  console.log('Captured actual video frames: lines / angle / triangle-white / triangle-black');
})().catch(e=>{console.error(e);process.exitCode=1;});
