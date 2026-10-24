'use strict';
(function (root) {
const G = typeof module !== 'undefined' ? require('./geometry-core.cjs') : root.Geometry;
const E = typeof module !== 'undefined' ? require('./effects.cjs') : root.Effects;
const V = typeof module !== 'undefined' ? require('./visibility.cjs') : root.Visibility;
const L = typeof module !== 'undefined' ? require('./label-layout.cjs') : root.LabelLayout;
const finitePoint = p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const clone = x => JSON.parse(JSON.stringify(x));
function resolve(objects, value) {
  const matches = objects.filter(o => String(o.index) === String(value) || o.label === String(value));
  if (matches.length !== 1) throw Error(`对象 ${value} 不存在或标签不唯一，请使用对象编号`);
  return matches[0];
}
function order(objects) {
  const byId = new Map(), visiting = new Set(), done = new Set(), result = [];
  for (const o of objects) {
    if (!Number.isInteger(o.index) || byId.has(o.index)) throw Error('对象编号必须是唯一整数');
    if (!Array.isArray(o.dependencies)) throw Error(`对象 #${o.index} 缺少 dependencies`);
    byId.set(o.index, o);
  }
  function visit(id) {
    if (visiting.has(id)) throw Error(`循环依赖 #${id}`);
    if (done.has(id)) return;
    const o = byId.get(id);
    if (!o) throw Error(`缺少依赖对象 #${id}`);
    visiting.add(id); o.dependencies.forEach(visit); visiting.delete(id);
    done.add(id); result.push(o);
  }
  objects.forEach(o => visit(o.index)); return result;
}
function recompute(objects) {
  for (const o of objects) {
    delete o.derived;
    if (o.dependencies.length) delete o.coordinates;
  }
  G.addDerivedGeometry(objects);
  const byId = new Map(objects.map(o => [o.index,o]));
  for (const o of objects) {
    let valid = !o.dependencies.some(id => byId.get(id).derived?.valid === false);
    const d = o.derived;
    if (G.POINT_TYPES.has(o.name)) valid &&= finitePoint(G.pointOf(o));
    else if (d?.p1 && d?.p2) valid &&= finitePoint(d.p1) && finitePoint(d.p2) && Math.hypot(d.p1[0]-d.p2[0],d.p1[1]-d.p2[1]) > 1e-9;
    else if (o.name === 'Circle' || o.name === 'ArcThroughThreePoints') valid &&= finitePoint(d?.center) && Number.isFinite(d?.radius) && d.radius > 1e-9;
    else valid = false;
    if (!valid || d?.valid === false) o.derived = {valid:false, reason:d?.reason || '退化、无交点、父对象失效或不支持的对象'};
  }
  return objects;
}
function prepare(scene, options = {}) {
  if (!scene || !Array.isArray(scene.objects) || !scene.objects.length) throw Error('输入必须包含非空 objects 数组');
  const objects = order(clone(scene.objects)); recompute(objects);
  const mode=options.mode??'motion';
  if(!['motion','static'].includes(mode))throw Error('mode 必须为 motion 或 static');
  if(mode==='static'&&['point','from','to','turns','direction'].some(k=>options[k]!==undefined))throw Error('static 模式不使用 point/from/to/turns/direction；保持 GSP 原始几何位置');
  const driver = mode==='static'?null:resolve(objects, options.point ?? 'A');
  const parent = driver?objects.find(o => o.index === driver.dependencies[0]):null;
  const circular = parent?.name === 'Circle';
  if (mode==='motion' && (driver.name !== 'PointOnObject' || !parent || (!circular && !G.endpointsOf(parent)) || parent.derived?.valid === false || driver.derived?.valid === false))
    throw Error('需要选择已有圆或直线型对象上的有效 PointOnObject；不允许强行移动派生交点或自由点');
  if (circular && (!finitePoint(driver.constraintParameters) || Math.abs(Math.hypot(...driver.constraintParameters)-1)>1e-6)) throw Error('驱动点圆约束参数必须是单位向量');
  const originalParameter = circular ? null : driver?.constraintParameters?.[0];
  const ends = circular ? null : G.endpointsOf(parent);
  const parentLength = ends ? Math.hypot(ends[1][0]-ends[0][0],ends[1][1]-ends[0][1]) : null;
  if (mode==='motion' && !circular && !Number.isFinite(originalParameter)) throw Error('驱动点直线约束参数无效');
  const duration = Number(options.duration ?? 8), fps = Number(options.fps ?? 30);
  const turns = options.turns === undefined ? null : Number(options.turns), width = Number(options.width ?? 1280), height = Number(options.height ?? 720);
  if (!(duration > 0 && duration <= 3600 && Number.isFinite(duration))) throw Error('duration 必须在 (0,3600] 秒');
  if (!(Number.isInteger(fps) && fps > 0 && fps <= 120)) throw Error('fps 必须为 1..120 的整数');
  if (turns !== null && (!Number.isFinite(turns) || turns === 0 || Math.abs(turns) > 1000)) throw Error('turns 必须为非零有限数，绝对值不大于 1000');
  if (turns !== null && (!circular || options.from !== undefined || options.to !== undefined)) throw Error('turns 仅用于圆，不能与 from/to 区间同时使用');
  if (![width,height].every(n => Number.isInteger(n) && n >= 320 && n <= 7680 && n % 2 === 0)) throw Error('画面宽高必须为 320..7680 的偶数');
  if (!['cw','ccw'].includes(options.direction ?? 'cw')) throw Error('direction 必须为 cw 或 ccw');
  if (!circular && options.direction !== undefined) throw Error('直线运动用 from/to 确定方向，不使用 direction');
  const from = mode==='static'?0:Number(options.from ?? (turns === null ? (circular ? -30 : -50) : 0));
  const to = mode==='static'?0:Number(options.to ?? (turns === null ? (circular ? 30 : 50) : turns*360));
  if (!Number.isFinite(from) || !Number.isFinite(to) || (mode==='motion' && from === to)) throw Error('from/to 必须为不同的有限数');
  if (mode==='motion' && !circular) {
    const limits = [from,to].map(d => originalParameter+d/parentLength);
    if (parent.name === 'Segment' && limits.some(t=>t<0 || t>1)) throw Error('运动区间超出父线段 [0,1]，请缩小 from/to');
    if (parent.name === 'Ray' && limits.some(t=>t<0)) throw Error('运动区间超出父射线 [0,+∞)，请缩小 from/to');
  }
  const ids = value => (value ? String(value).split(',').map(v => resolve(objects,v.trim()).index) : []);
  const concyclic = ids(options.concyclic);
  if (!circular && concyclic.length) throw Error('concyclic 当前需要圆约束驱动点；直线约束会自动显示在线误差');
  if (concyclic.length && concyclic.length < 3) throw Error('concyclic 至少需要三个点');
  for (const id of concyclic) if (!G.POINT_TYPES.has(resolve(objects,id).name)) throw Error('concyclic 只能指定点');
  const fixed = ids(options.fixed);
  for (const id of fixed) if (!finitePoint(G.pointOf(resolve(objects,id)))) throw Error('fixed 只能指定有效点');
  const perpendicular = ids(options.perpendicular);
  if (perpendicular.length && (perpendicular.length !== 2 || perpendicular.some(id => !G.endpointsOf(resolve(objects,id))))) throw Error('perpendicular 需要两个有效直线型对象');
  const unsupported = objects.filter(o => o.derived?.valid === false).map(o => o.index);
  const background=options.background ?? 'white';
  if(!['white','black'].includes(background)) throw Error('background 必须为 white 或 black');
  const labelOption=options.labels ?? true;
  if(![true,false,'true','false'].includes(labelOption)) throw Error('labels 必须为 true 或 false');
  const labelSize=Number(options['label-size']??options.labelSize??32);
  if(!Number.isFinite(labelSize)||labelSize<12||labelSize>96)throw Error('labelSize / --label-size 必须为 12..96 的有限数字');
  const model = {scene:{...scene,objects},mode,driver:driver?.index??null,parent:parent?.index??null,circle:circular?parent.index:null,
    visibility:V.compile(options.visibility,objects,duration,resolve),
    effects:E.compile(options.effects,objects,duration,resolve),
    background,labelSize,labels:labelOption===true || labelOption==='true',
    motionKind:mode==='static'?'static':circular?'circle':'line', from,to,unit:mode==='static'?null:circular?'degrees':'coordinate-units',loop:false,
    originalParameter,parentLength,originalPoint:G.pointOf(driver),
    startAngle:circular?Math.atan2(-driver.constraintParameters[1],driver.constraintParameters[0]):null,
    duration,fps,turns,width,height,direction:options.direction ?? 'cw',concyclic,fixed,perpendicular,unsupported};
  // 预先覆盖运动区间的采样几何，播放过程中保持固定镜头。
  const visible=(list,t)=>list.filter(o=>V.visible(model,t,o)&&o.derived?.valid!==false);
  const times=[...new Set([...Array.from({length:33},(_,i)=>duration*i/32),...model.visibility.flatMap(e=>[e.at,Math.max(0,e.at-.001)]),...model.effects.flatMap(e=>[e.start,e.start+e.enter,e.end-e.exit,Math.max(e.start,e.end-.001)])])].sort((a,b)=>a-b);
  const frames=times.map(t=>frame(model,t));
  const samples=frames.flatMap(f=>visible(f.objects,f.time));
  const all=[...visible(objects,0),...samples];
  const anchors=all.flatMap(o=>G.endpointsOf(o)??[]).map(coordinates=>({name:'Point',coordinates}));
  const arcAnchors=frames.flatMap(f=>E.extentPoints(model,f)).map(coordinates=>({name:'Point',coordinates}));
  const b = G.geometryBounds([...all,...anchors,...arcAnchors]);
  const aspect = (width * .88) / (height * .84);
  const spanX = Math.max(b.width,b.height*aspect), spanY = spanX/aspect;
  model.bounds = {x:b.x+b.width/2-spanX/2,y:b.y+b.height/2-spanY/2,width:spanX,height:spanY};
  const pos=p=>[width*.06+(p[0]-model.bounds.x)*width*.88/model.bounds.width,height*.08+(p[1]-model.bounds.y)*width*.88/model.bounds.width];
  E.planArcs(model,frames,pos,model.bounds);
  if(model.labels)model.labelPlan=L.plan(model,frames.map(f=>({f,obstacles:labelObstacles(model,f,pos)})));
  return model;
}
function labelObstacles(model,f,pos){
  const obstacles=L.geometry(f.objects,pos,model.bounds,o=>V.visible(model,f.time,o));
  E.layers(model,f,pos,model.bounds,obstacles.paths);
  return obstacles;
}
function labelLayout(model,time){
  const f=frame(model,time),b=model.bounds;
  const pos=p=>[model.width*.06+(p[0]-b.x)*model.width*.88/b.width,model.height*.08+(p[1]-b.y)*model.width*.88/b.width];
  return model.labels?L.layout(model,f,labelObstacles(model,f,pos)):[];
}
function frame(model, time) {
  if (!Number.isFinite(time)) throw Error('time 必须是有限数');
  time = Math.max(0,Math.min(model.duration,time));
  const objects = clone(model.scene.objects), driver = objects.find(o => o.index === model.driver);
  const offset = model.from+(model.to-model.from)*time/model.duration;
  if (model.motionKind === 'circle') {
    const angle = model.startAngle + (model.direction === 'cw' ? 1 : -1)*Math.PI/180*offset;
    driver.constraintParameters = [Math.cos(angle),-Math.sin(angle)];
  } else if(model.motionKind!=='static') driver.constraintParameters = [model.originalParameter+offset/model.parentLength];
  recompute(objects);
  const byId = new Map(objects.map(o => [o.index,o])), circle = byId.get(model.circle)?.derived;
  const driverPoint=G.pointOf(byId.get(model.driver)), parent=byId.get(model.parent);
  let constraintError=null;
  if(finitePoint(driverPoint) && parent.derived?.valid !== false) {
    if(model.motionKind==='circle') constraintError=Math.abs(Math.hypot(driverPoint[0]-circle.center[0],driverPoint[1]-circle.center[1])-circle.radius);
    else {const [a,b]=G.endpointsOf(parent);const dx=b[0]-a[0],dy=b[1]-a[1];constraintError=Math.abs(dx*(driverPoint[1]-a[1])-dy*(driverPoint[0]-a[0]))/Math.hypot(dx,dy);}
  }
  const points = model.concyclic.map(id => G.pointOf(byId.get(id)));
  const radiusError = points.length && points.every(finitePoint) && circle?.center && circle?.valid !== false
    ? Math.max(...points.map(p => Math.abs(Math.hypot(p[0]-circle.center[0],p[1]-circle.center[1])-circle.radius))) : null;
  const triangle = points.length === 3 && points.every(finitePoint) ? G.circumcircle(...points) : null;
  const area2 = points.length === 3 && points.every(finitePoint) ? Math.abs((points[1][0]-points[0][0])*(points[2][1]-points[0][1])-(points[1][1]-points[0][1])*(points[2][0]-points[0][0])) : null;
  const degenerate = area2 !== null && area2 <= 1e-8*Math.max(1,circle?.radius**2 || 1);
  const fixedDisplacement = model.fixed.map(id => {
    const a = G.pointOf(byId.get(id)), b = G.pointOf(model.scene.objects.find(o => o.index === id));
    return finitePoint(a) ? Math.hypot(a[0]-b[0],a[1]-b[1]) : null;
  });
  let perpendicularError = null;
  if (model.perpendicular.length) {
    const lines = model.perpendicular.map(id => G.endpointsOf(byId.get(id)));
    if (lines.every(Boolean)) {const v = lines.map(([a,b]) => [b[0]-a[0],b[1]-a[1]]); perpendicularError = Math.abs(v[0][0]*v[1][0]+v[0][1]*v[1][1])/(Math.hypot(...v[0])*Math.hypot(...v[1]));}
  }
  return {time,offset,objects,metrics:{constraintError,radiusError,fixedDisplacement,perpendicularError,degenerate,
    circumcenterError:triangle && !degenerate && circle?.center ? Math.hypot(triangle.center[0]-circle.center[0],triangle.center[1]-circle.center[1]) : null,
    invalid:objects.filter(o => o.derived?.valid === false).map(o => o.index)}};
}
function svg(model,time) {
  const f = frame(model,time), W=model.width,H=model.height,b=model.bounds;
  const palette=model.background==='black'
    ? {bg:'#000000',line:'#d9e2ed',moving:'#ffbd59',curve:'#62b7ed',point:'#8ddfeb',active:'#ffbd59'}
    : {bg:'#ffffff',line:'#303d4a',moving:'#c75518',curve:'#286fa3',point:'#17617d',active:'#c75518'};
  const parts=[], scale = W*.88/b.width;
  const pos=p=>[W*.06+(p[0]-b.x)*scale,H*.08+(p[1]-b.y)*scale];
  const line=(a,c,color='#93a6bb',id)=>{const p=pos(a),q=pos(c); return `<line data-object="${id}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${color}" stroke-width="3"/>`;};
  const text=(x,y,s,size,color,id)=>`<text data-label-object="${id}" x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="Segoe UI, Microsoft YaHei, sans-serif">${escape(s)}</text>`;
  const overlays=E.layers(model,f,pos,b);
  for (const o of f.objects) {
    if (!V.visible(model,f.time,o) || o.derived?.valid === false) continue;
    const d=o.derived;
    if (d?.p1 && d?.p2) {
      let ends = [d.p1,d.p2];
      if (G.INFINITE_LINE_TYPES.has(o.name)) ends=G.clipInfiniteLine(...ends,b);
      if (o.name === 'Ray') ends=G.clipRay(...ends,b);
      if (ends) parts.push(line(...ends,o.dependencies.includes(model.driver)?palette.moving:palette.line,o.index));
    } else if (o.name === 'Circle' && d?.center) {
      const p=pos(d.center); parts.push(`<circle data-object="${o.index}" cx="${p[0]}" cy="${p[1]}" r="${d.radius*scale}" fill="none" stroke="${palette.curve}" stroke-width="2"/>`);
    } else if(o.name === 'ArcThroughThreePoints' && d?.valid) {
      const a=pos(d.start),z=pos(d.end); parts.push(`<path data-object="${o.index}" d="M${a} A${d.radius*scale},${d.radius*scale} 0 ${d.largeArcFlag},${d.sweepFlag} ${z}" fill="none" stroke="${palette.curve}" stroke-width="2"/>`);
    }
  }
  parts.push(...overlays.strokes);
  // 将点最后画出，防止被边遮挡。
  for(const o of f.objects) {
    if(!V.visible(model,f.time,o) || o.derived?.valid === false || !G.POINT_TYPES.has(o.name)) continue;
    const p=G.pointOf(o); if(!finitePoint(p)) continue;
    const [x,y]=pos(p), active=o.index===model.driver;
    parts.push(`<circle data-object="${o.index}" cx="${x}" cy="${y}" r="${active?8:5}" fill="${active?palette.active:palette.point}"/>`);
  }
  if(model.labels)for(const label of L.layout(model,f,labelObstacles(model,f,pos))){
    const o=f.objects.find(o=>o.index===label.id),color=o.index===model.driver?palette.active:G.POINT_TYPES.has(o.name)?palette.point:palette.line;
    parts.push(text(label.x+4,label.y+4+model.labelSize, label.label,model.labelSize,color,label.id));
  }
  const body = `<rect width="${W}" height="${H}" fill="${palette.bg}"/>`+overlays.fills.join('')+parts.join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}
const api={prepare,frame,svg,labelLayout,order,recompute,resolve};
if(typeof module !== 'undefined') module.exports=api; else root.Motion=api;
})(globalThis);
