/** Coarse relationships in actual exported geometry. These review signals do
 * not grade aesthetics or prescribe a quota of different slide layouts. */
import { isBodySlide } from './design-quality.mjs';

const list=value=>Array.isArray(value)?value:[];
const finite=value=>Number.isFinite(value);
const skipRoles=new Set(['footer','citation','note','caption','source-details','reference-title','reference-index','identity','section-label','section-index','index','decoration','icon','logo','context-visual','title','subtitle','takeaway','cover-title','cover-metadata']);
const relationNames={
  'visual-left-explanation-right':'图证在左、解释在右',
  'visual-right-explanation-left':'图证在右、解释在左',
  'visual-top-explanation-bottom':'图证在上、解释在下',
  'visual-bottom-explanation-top':'图证在下、解释在上',
};
const comparableFamily=new Set(Object.keys(relationNames));
const validBox=b=>b&&[b.x,b.y,b.w,b.h].every(finite)&&b.w>0&&b.h>0;
// Horizontal/vertical native axes have a zero geometric dimension. Give only
// their stroke a small extent for grouping; leave the exported scene untouched.
const nodeBox=n=>n?.kind==='line'&&[n.x,n.y,n.w,n.h].every(finite)&&(n.w||n.h)
  ? {...n,x:Math.min(n.x,n.x+n.w),y:Math.min(n.y,n.y+n.h),w:Math.max(Math.abs(n.w),n.strokeWidth||1),h:Math.max(Math.abs(n.h),n.strokeWidth||1)}:n;
const area=b=>b.w*b.h;
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
const contains=(a,b)=>overlap(a,b)>=area(b)*.94;
const bounds=boxes=>{
  const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  return {x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};
};
const round=value=>Math.round(value*1000)/1000;
const explained=slide=>typeof slide.visualPlan?.repetitionReason==='string'&&[...slide.visualPlan.repetitionReason.replace(/\s/gu,'')].length>=16;

function profile(slide,page,assets) {
  const content=validBox(page.contentBox)?page.contentBox:{x:48,y:132,w:(page.width||1280)-96,h:(page.height||720)-207};
  const nodes=list(page.nodes).map(nodeBox).filter(n=>validBox(n)&&n.opacity!==0&&overlap(n,content)>area(n)*.5);
  const visual=[];
  for(const n of nodes){
    if(n.semantic===false||skipRoles.has(n.role)||(n.kind==='image'&&assets.get(n.assetId)?.usage==='decorative'))continue;
    if(['image','chart','table'].includes(n.kind)&&area(n)>=area(content)*.018)visual.push({...n,carrier:n.kind});
  }
  // Native plots and research relationships are groups of marks. Their labels
  // remain inside their evidence group instead of looking like a separate
  // right-hand explanatory panel. Rectangular backgrounds alone do not count.
  const groups=new Map();
  for(const n of nodes){
    if(n.semantic===false||!['rect','ellipse','line'].includes(n.kind))continue;
    const plot=/^(.*\/data-plot)\//.exec(n.id||'')?.[1];
    const key=plot||(['data','relationship'].includes(n.role)?n.drawingId?`drawing:${n.drawingId}`:'diagram':null);
    if(!key)continue;
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);
  }
  for(const [key,marks] of groups){
    if(marks.length<2)continue;
    const markBox=bounds(marks),labelArea={x:markBox.x-50,y:markBox.y-50,w:markBox.w+100,h:markBox.h+100};
    const related=nodes.filter(n=>n.kind==='text'&&overlap(n,labelArea)>area(n)*.2&&(key.startsWith('drawing:')?n.drawingId===key.slice(8):key==='diagram'?/\/node:/.test(n.id||''):(n.id||'').startsWith(key+'/')));
    const box=bounds([...marks,...related]);if(area(box)>=area(content)*.018)visual.push({...box,carrier:key.includes('data-plot')?'plot':'diagram'});
  }
  const words=nodes.filter(n=>n.kind==='text'&&n.semantic!==false&&!skipRoles.has(n.role)&&String(n.text||'').trim()&&
    !visual.some(v=>contains(v,n)));
  const textWeight=n=>Math.max(1,Math.min(240,[...String(n.text).replace(/\s/gu,'')].length));
  const weighted=(items,weight,axis)=>items.reduce((sum,n)=>sum+(n[axis]+n[axis==='x'?'w':'h']/2)*weight(n),0)/items.reduce((sum,n)=>sum+weight(n),0);
  const center=(items,weight)=>items.length?{x:(weighted(items,weight,'x')-content.x)/content.w,y:(weighted(items,weight,'y')-content.y)/content.h}:null;
  const visualCenter=center(visual,area),textCenter=center(words,textWeight);
  const totalTextWeight=words.reduce((sum,n)=>sum+textWeight(n),0);
  const onSide=(axis,cut,more)=>words.filter(n=>more?(n[axis]+n[axis==='x'?'w':'h']/2-content[axis])/content[axis==='x'?'w':'h']>=cut:(n[axis]+n[axis==='x'?'w':'h']/2-content[axis])/content[axis==='x'?'w':'h']<=cut).reduce((sum,n)=>sum+textWeight(n),0)/Math.max(1,totalTextWeight);
  let family=visual.length?'distributed-evidence':'text-led';
  if(visualCenter&&textCenter&&totalTextWeight>=20){
    if(visualCenter.x<.47&&textCenter.x>.64&&onSide('x',.56,true)>=.72)family='visual-left-explanation-right';
    else if(visualCenter.x>.53&&textCenter.x<.36&&onSide('x',.44,false)>=.72)family='visual-right-explanation-left';
    else if(visualCenter.y<.48&&textCenter.y>.65&&onSide('y',.56,true)>=.72)family='visual-top-explanation-bottom';
    else if(visualCenter.y>.52&&textCenter.y<.35&&onSide('y',.44,false)>=.72)family='visual-bottom-explanation-top';
  }
  const containers=nodes.filter(n=>n.kind==='rect'&&(n.role==='group'||n.cardId)&&area(n)>=area(content)*.018&&words.some(t=>contains(n,t)));
  const leaves=containers.filter(n=>!containers.some(other=>other!==n&&contains(n,other)&&area(other)<area(n)*.98));
  const explanatoryContainers=leaves.filter(n=>!visual.some(v=>contains(n,v)));
  return {slideId:slide.id,family,description:relationNames[family]|| (family==='text-led'?'文字主导':'分布式或复合图证'),
    visualCarrierCount:visual.length,visualCarrierKinds:[...new Set(visual.map(v=>v.carrier))],explanationTextBlocks:words.length,
    explanationContainers:explanatoryContainers.length,visualCenter:visualCenter?{x:round(visualCenter.x),y:round(visualCenter.y)}:null,
    explanationCenter:textCenter?{x:round(textCenter.x),y:round(textCenter.y)}:null,hasRepetitionReason:explained(slide)};
}

export function layoutDiversityReport(project,scenes) {
  const pages=new Map(list(scenes?.pages).map(p=>[p.id,p])),assets=new Map(list(project.assets).map(a=>[a.id,a])),slides=[],issues=[],sourceSlides=list(project.slides);
  for(const slide of sourceSlides){const page=pages.get(slide.id);if(page&&isBodySlide(slide))slides.push(profile(slide,page,assets));}
  const visual=slides.filter(s=>s.visualCarrierCount),byId=new Map(slides.map(s=>[s.slideId,s])),groups=[];
  for(const family of comparableFamily){
    const matched=visual.filter(s=>s.family===family);if(matched.length)groups.push({family,description:relationNames[family],slideIds:matched.map(s=>s.slideId),shareOfVisualPages:round(matched.length/Math.max(1,visual.length)),unexplainedSlideIds:matched.filter(s=>!s.hasRepetitionReason).map(s=>s.slideId)});
  }
  const faithful=project.design?.mode==='template-faithful';
  if(!faithful){
    for(const group of groups){
      if(visual.length<4||group.slideIds.length<3||group.shareOfVisualPages<.6||!group.unexplainedSlideIds.length)continue;
      const target=group.unexplainedSlideIds.at(-1);
      issues.push({severity:'warning',code:'visual-layout-family-dominance',path:`slides.${target}`,slideId:target,family:group.family,relatedSlideIds:group.slideIds,matchingSlides:group.slideIds.length,visualSlides:visual.length,
        message:`${visual.length} 张含实际图证的正文中有 ${group.slideIds.length} 张采用“${group.description}”的大骨架。卡片外观、图数量、ID和细微坐标变化仍可能沿用同一阅读路径。按逐页论证关系检查图文组合、嵌入式证据卡与主辅分配；同尺度比较可提供具体重复理由（有 visualPlan 时写入 repetitionReason），无需随机换版。`});
    }
    let run=[];const flush=()=>{
      if(run.length>=3&&run.some(s=>!s.hasRepetitionReason)){
        const target=run.filter(s=>!s.hasRepetitionReason).at(-1);
        if(!issues.some(i=>i.code==='visual-layout-family-dominance'&&i.family===target.family))issues.push({severity:'warning',code:'visual-layout-family-run',path:`slides.${target.slideId}`,slideId:target.slideId,family:target.family,relatedSlideIds:run.map(s=>s.slideId),
          message:`连续 ${run.length} 页重复“${relationNames[target.family]}”的图文大骨架。检查每页任务是否需要相同位置和共同尺度；具体比较可保留并记录理由，其余页面应按内容重组。`});
      }run=[];
    };
    for(const slide of sourceSlides){const current=byId.get(slide.id);if(!current||!comparableFamily.has(current.family)){flush();continue;}if(run.length&&run[0].family!==current.family)flush();run.push(current);}flush();
  }
  return {basis:'coarse-relative-geometry-of-actual-scene-carriers',summary:{bodySlideCount:slides.length,visualSlideCount:visual.length,families:[...new Set(visual.map(s=>s.family))],reviewSignals:issues.length},slides,groups,issues,
    limits:'相对位置是可审阅的几何信号，不判断原创性或科学内容，也不规定布局数量。完整图像的内部面板、遮挡及最终可读性仍需实际看图；具体同尺度比较和忠实模板可以合理重复。'};
}
