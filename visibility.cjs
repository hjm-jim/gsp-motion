'use strict';
(function(root){
const types=new Set(['Point','Midpoint','IntersectionPoint','LineCircleIntersection','CircleCircleIntersection','PointOnObject','Segment','Line','Ray','PerpendicularLine','ParallelLine','AngleBisector','Circle','ArcThroughThreePoints']);
function compile(spec,objects,duration,resolve){
  if(spec===undefined)return [];
  if(!Array.isArray(spec))throw Error('visibility 必须是显式 hide/show 列表的事件数组');
  return spec.map((raw,index)=>{
    const fail=s=>{throw Error(`visibility[${index}]: ${s}`);};
    if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('必须是对象');
    for(const key of Object.keys(raw))if(!['at','hide','show'].includes(key))fail('未知字段 '+key);
    const at=raw.at??0;
    if(typeof at!=='number'||!Number.isFinite(at)||at<0||at>duration)fail('at 必须在 0 到动画总时长之间');
    const ids=key=>{
      if(raw[key]===undefined)return [];
      if(!Array.isArray(raw[key]))fail(key+' 必须是对象标签/编号列表');
      return [...new Set(raw[key].map(ref=>{
        const object=resolve(objects,ref);
        if(!types.has(object.name))fail(`不支持 ${object.name} 的可见性控制`);
        return object.index;
      }))];
    };
    const hide=ids('hide'),show=ids('show');
    if(!hide.length&&!show.length)fail('必须显式指定至少一个 hide 或 show 目标');
    return {at,hide,show};
  }).sort((a,b)=>a.at-b.at);
}
function visible(model,time,object){
  if(!object)return false;
  let result=!object.hidden&&object.visible!==false,last=-Infinity;
  for(const e of model.visibility||[]){
    if(e.at>time)break;
    if(e.show.includes(object.index)&&e.at>last){result=true;last=e.at;}
    if(e.hide.includes(object.index)&&e.at>=last){result=false;last=e.at;}
  }
  return result;
}
const api={compile,visible};if(typeof module!=='undefined')module.exports=api;else root.Visibility=api;
})(globalThis);
