/** Reading-role checks on the final native scene, not a claim of live projection legibility. */
export const DEFAULT_PROJECTION=Object.freeze({bodyMin:28,labelMin:24,noteMin:18});
const notes=new Set(['note','caption','citation','footer','source-details','context-caption','cover-metadata','cover-occasion']);
const labels=new Set(['label','diagram-group','diagram-label','diagram-body','diagram-edge-label','figure-legend','plot-axis-label','plot-axis-tick','plot-group-label','plot-unit','plot-value-label','plot-reading-note','reference-title','reference-index','identity','section-label','section-index','index','metric-label']);
export function readingRole(node){
 if(notes.has(node.role))return 'note';
 if(labels.has(node.role))return 'label';
 if(node.role==='title'||String(node.role||'').endsWith('title')||['metric','cover-title','closing-statement'].includes(node.role))return 'title';
 return 'body';
}
export function projectionIssues(page,policy){
 if(!policy)return [];
 const issues=[];
 for(const node of page.nodes||[]){
  if(node.kind==='text'){
   const role=readingRole(node),minimum=role==='title'?policy.labelMin:policy[`${role}Min`];
   if(node.fontSize+1e-6<minimum)issues.push({severity:'error',code:'projection-font-too-small',slideId:page.id,objectId:node.id,role,fontSize:node.fontSize,minimum,message:`${role}文字最终为${Math.round(node.fontSize*100)/100}px，低于本工程${minimum}px阅读政策；调整布局或明确修改策略，不把必要正文改成注释。`});
  }else if(node.kind==='table'&&node.fontSize+1e-6<policy.labelMin)issues.push({severity:'error',code:'projection-font-too-small',slideId:page.id,objectId:node.id,role:'label',fontSize:node.fontSize,minimum:policy.labelMin,message:'表格单元格低于本工程必要标签字级；调整表格设计后重新渲染。'});
 }
 return [...issues,...sceneContrastIssues(page)];
}

const rgb = color => /^#[\da-f]{6}$/i.test(color||'') ? [1,3,5].map(i=>parseInt(color.slice(i,i+2),16)) : null;
const luminance = color => color.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
const hex = values => '#'+values.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase();
function containsPoint(node,x,y) {
 if(!(node.w>0&&node.h>0)||x<node.x||y<node.y||x>node.x+node.w||y>node.y+node.h)return false;
 if(node.kind==='ellipse')return ((x-node.x-node.w/2)/(node.w/2))**2+((y-node.y-node.h/2)/(node.h/2))**2<=1;
 if(node.cornerCut&&x-node.x-(y-node.y)>node.w-node.cornerCut)return false;
 return true;
}
function textSamples(node) {
 const lines=node.lines?.length?node.lines:String(node.text||'').split('\n'),points=[];
 lines.forEach((line,index)=>{
  if(!String(line).trim())return;
  const fallback=[...String(line)].reduce((sum,c)=>sum+(/^[\x00-\x7f]$/.test(c)?.58:1),0)*node.fontSize;
  const width=Math.min(node.w,node.estimatedLineWidths?.[index]??fallback);
  if(!(width>0))return;
  const x=node.align==='center'?node.x+(node.w-width)/2:node.align==='right'?node.x+node.w-width:node.x;
  const y=node.y+index*node.fontSize*(node.lineHeight||1.28);
  // Sample actual line extents, not the empty allocated textbox. Projection
  // remains a rendered review; these points cannot measure raster glyphs.
  for(const px of [.08,.5,.92])for(const py of [.3,.75])points.push([x+width*px,y+node.fontSize*py]);
 });
 return points;
}
function backingAt(page,nodes,x,y) {
 let color=rgb(page.background)||[255,255,255],unknown=false;
 for(const node of nodes){
  if(!containsPoint(node,x,y))continue;
  if(node.kind==='image'){unknown=true;continue;}
  if(!['rect','ellipse'].includes(node.kind))continue;
  const fill=rgb(node.fill);if(!fill)continue;
  const alpha=Math.max(0,Math.min(1,node.fillOpacity??1));
  color=fill.map((v,i)=>v*alpha+color[i]*(1-alpha));
  if(alpha===1)unknown=false;
 }
 return {color,unknown};
}

/** Inspect native text against its actual preceding paint, including dark
 * bands and translucent fills. The 4.5 / 3 luminance ratios are review floors
 * informed by https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html,
 * not certification of projected slides. Source-image text is not recolored.
 */
export function sceneContrastIssues(page) {
 const issues=[],preceding=[];
 for(const node of page.nodes||[]){
  if(node.kind==='text'&&String(node.text||'').trim()&&node.semantic!==false&&!['decoration','icon','logo'].includes(node.role)){
   const runs=(node.richLines||[]).flat().filter(run=>String(run.text||'').trim());
   const foregrounds=[...new Set((runs.length?runs.map(run=>run.color||node.color):[node.color]).filter(color=>rgb(color)))];
   const samples=textSamples(node).map(([x,y])=>backingAt(page,preceding,x,y));
   const role=readingRole(node),minimum=role==='title'?3:4.5;
   if(samples.some(sample=>sample.unknown))issues.push({severity:'warning',code:'text-image-contrast-review',slideId:page.id,objectId:node.id,role,basis:'scene-color-estimate',
    message:'文字叠在实际图片或未能确定的混合背景上；逐页看最终渲染，确认所有字的对比。必要时移动文字或增加有明确边界的实色衬底，不能仅凭 palette 宣称可读。'});
   const known=samples.filter(sample=>!sample.unknown);
   if(known.length&&foregrounds.length){
    const backgrounds=[...new Set(known.map(sample=>hex(sample.color)))];
    const ratios=foregrounds.flatMap(fg=>known.map(sample=>contrast(rgb(fg),sample.color)));
    const lowest=Math.min(...ratios);
    if(lowest+1e-6<minimum){
     // A mixed backing may place an emphasized run on a different color;
     // flag the uncertainty instead of making an unsupported blocking claim.
     const severe=lowest<3&&backgrounds.length===1&&!samples.some(sample=>sample.unknown);
     issues.push({severity:severe?'error':'warning',code:severe?'text-contrast-too-low':'text-contrast-review',slideId:page.id,objectId:node.id,role,foregrounds,backgrounds,contrast:Math.round(lowest*100)/100,minimum,basis:'scene-color-estimate',
      message:`${role}文字与实际底色的最低估计对比为 ${lowest.toFixed(2)}:1，需复核${minimum}:1阅读目标。调整前景或衬底的明暗；深色题签配浅字，浅色/中间色正文配深字，保留原图数据色义。修改后重渲染检查。`});
    }
   }
  }
  preceding.push(node);
 }
 return issues;
}
