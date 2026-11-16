'use strict';
(function(root){
const G=typeof module!=='undefined'?require('./geometry-core.cjs'):root.Geometry;
function palette(background){return background==='black'
  ?{bg:'#000000',line:'#d9e2ed',moving:'#ffbd59',curve:'#62b7ed',point:'#8ddfeb',active:'#ffbd59',label:'#d9e2ed'}
  :{bg:'#ffffff',line:'#303d4a',moving:'#c75518',curve:'#286fa3',point:'#17617d',active:'#c75518',label:'#000000'};}
function validate(objects){
  for(const o of objects){
    const s=o.nativeStyle;if(s==null)continue;
    if(s.source!=='gsp-v5'||!/^#[0-9a-f]{6}$/i.test(s.color)||
      !Number.isInteger(s.widthIndex)||s.widthIndex<0||s.widthIndex>3||s.width!==[.5,1,3,5][s.widthIndex]||
      !['solid','dashed','dotted'].includes(s.dash)||
      !Number.isInteger(s.pointSizeIndex)||s.pointSizeIndex<0||s.pointSizeIndex>3||
      s.pointRadius!==[1.5,2,4,6][s.pointSizeIndex]||s.pointOutline!==[0,1,1.25,1.5][s.pointSizeIndex])
      throw Error(`对象 #${o.index} 的 nativeStyle 无效，请重新解析 GSP`);
  }
}
function appearance(model,o){
  const p=palette(model.background),point=G.POINT_TYPES.has(o.name),curve=['Circle','ArcThroughThreePoints'].includes(o.name),active=o.index===model.driver;
  const native=o.nativeStyle?.source==='gsp-v5'?o.nativeStyle:null;
  return {color:native&&model.background==='white'?native.color:point?(active?p.active:p.point):curve?p.curve:o.dependencies.includes(model.driver)?p.moving:p.line,
    width:native?.width??(curve?2:3),dash:native?.dash??'solid',
    pointRadius:native?.pointRadius??(active?8:5),pointOutline:native?.pointOutline??0};
}
function stroke(style){
  const dash=style.dash==='dashed'?` stroke-dasharray="${style.width*6} ${style.width*4}"`
    :style.dash==='dotted'?` stroke-dasharray="0 ${style.width*2}" stroke-linecap="round"`:'';
  return `stroke="${style.color}" stroke-width="${style.width}"${dash}`;
}
const api={palette,appearance,stroke,validate};
if(typeof module!=='undefined')module.exports=api;else root.Styles=api;
})(globalThis);
