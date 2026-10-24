/** Compare explicitly supplied authored projects. Never scan other workspaces. */
import { structureOf, similarStructure, drawingStructure, isBodySlide } from './design-quality.mjs';

const list=value=>Array.isArray(value)?value:[];
const box=value=>value?['x','y','w','h'].map(k=>Math.round(value[k]/32)):null;
function coverStructure(slide,design) {
  if (!slide) return null;
  return JSON.stringify({variant:slide.cover?.variant||design?.system?.cover||'default',boxes:slide.cover?.boxes?Object.fromEntries(Object.entries(slide.cover.boxes).map(([k,v])=>[k,box(v)])):null,
    heading:box(slide.heading?.box),drawings:list(slide.drawings).map(d=>({box:box(d.box),elements:drawingStructure(d)}))});
}
function coverMainRegions(slide,design) {
  if(!slide)return null;
  const images=[];
  if(slide.cover?.assetId&&slide.cover?.boxes?.visual)images.push(slide.cover.boxes.visual);
  for(const d of list(slide.drawings)){
    if(!d.box)continue;
    const scale=Math.min(d.box.w/d.width,d.box.h/d.height),ox=d.box.x+(d.box.w-d.width*scale)/2,oy=d.box.y+(d.box.h-d.height*scale)/2;
    for(const e of list(d.elements).filter(e=>e.kind==='image'))images.push({x:ox+e.x*scale,y:oy+e.y*scale,w:e.w*scale,h:e.h*scale});
  }
  const title=slide.cover?.boxes?.title||slide.heading?.box;
  return {variant:slide.cover?.variant||design?.system?.cover||'default',title,images:images.filter(b=>b.w*b.h>=1280*720*.08)};
}
function boxIoU(a,b){
  if(!a||!b)return 0;
  const intersection=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  return intersection/(a.w*a.h+b.w*b.h-intersection);
}
function similarCoverMain(a,b){
  if(!a||!b||a.variant!==b.variant||boxIoU(a.title,b.title)<.70||a.images.length!==b.images.length)return false;
  if(!a.images.length)return false; // A matching title alone is insufficient.
  const used=new Set();
  return a.images.every(x=>{const i=b.images.findIndex((y,i)=>!used.has(i)&&boxIoU(x,y)>=.65);if(i<0)return false;used.add(i);return true;});
}

export function compareProjectStructures(entries) {
  const summaries=entries.map(({project,path})=>({projectId:project.id,title:project.title,path,revision:project.revision,
    slideCount:project.slides.length,bodySlides:project.slides.filter(isBodySlide).length}));
  const comparisons=[],issues=[];
  for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const left=entries[i].project,right=entries[j].project;
    const a=left.slides.filter(isBodySlide).map(s=>({slide:s,structure:structureOf(s)}));
    const b=right.slides.filter(isBodySlide).map(s=>({slide:s,structure:structureOf(s)}));
    // One-to-one matching prevents one generic page from inflating the whole
    // report's duplicate count. Text, identifiers and paint do not affect it.
    const used=new Set(),pairs=[];
    for(const x of a){const k=b.findIndex((y,k)=>!used.has(k)&&similarStructure(x.structure,y.structure));
      if(k<0)continue;used.add(k);pairs.push({leftSlideId:x.slide.id,rightSlideId:b[k].slide.id,
        leftTitle:x.slide.title,rightTitle:b[k].slide.title,
        comparisonReason:x.slide.visualPlan?.repetitionReason||b[k].slide.visualPlan?.repetitionReason||null});}
    const denominator=Math.min(a.length,b.length), fraction=denominator?pairs.length/denominator:0;
    const ac=left.slides.find(s=>s.layout==='cover'),bc=right.slides.find(s=>s.layout==='cover');
    const matchingCover=Boolean(ac&&bc&&coverStructure(ac,left.design)===coverStructure(bc,right.design));
    const similarMainCover=Boolean(ac&&bc&&similarCoverMain(coverMainRegions(ac,left.design),coverMainRegions(bc,right.design)));
    const high=denominator>=3&&pairs.length>=3&&fraction>=.65;
    comparisons.push({leftProjectId:left.id,rightProjectId:right.id,matchingBodyPages:pairs.length,
      smallerBodyPageCount:denominator,matchingBodyFraction:Number(fraction.toFixed(4)),matchingCover,similarMainCover,
      status:high||similarMainCover?'needs-visual-comparison':'no-high-similarity-detected',pairs});
    if(high)issues.push({severity:'warning',code:'cross-deck-structure-reuse',projectIds:[left.id,right.id],
      message:`两份报告较短稿的${denominator}张正文中，${pairs.length}张找到相同或近似的主体结构。并列查看实际画面；相同科学对照可保留共同尺度，其他页面应按研究内容调整。此结果不是抄袭判断或原创性评分。`});
    if(similarMainCover)issues.push({severity:'warning',code:'cross-deck-cover-main-reuse',projectIds:[left.id,right.id],
      message:'两份封面的题名区与主要图片区高度重合。底部文案、配色或轻微移位不能单独证明整体构图不同；并列查看，确认该组织是否适合各自研究问题。'});
  }
  return {ok:true,status:issues.length?'needs-visual-comparison':'no-high-similarity-detected',
    basis:'authored-structure-not-rendered-pixels',inputCount:entries.length,uniqueProjectCount:entries.length,
    projects:summaries,comparisons,issues,
    limits:'不同工程ID不证明独立作者；本工具不读取模型历史，不判断科学内容、像素相似或审美。没有高相似提示也不证明原创。请结合实际概览、来源与制作过程核对。'};
}
