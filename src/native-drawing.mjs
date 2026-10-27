/** Authored research drawings. Only known native scene primitives are emitted.
 * Local coordinates scale uniformly; values, labels and asset pixels are never inferred.
 */
import { assessFigurePlacement } from './figure-planning.mjs';
const list=v=>Array.isArray(v)?v:[];
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const boxOK=b=>b&&['x','y','w','h'].every(k=>finite(b[k]))&&b.w>0&&b.h>0;
const within=(b,w,h)=>boxOK(b)&&b.x>=0&&b.y>=0&&b.x+b.w<=w+1e-6&&b.y+b.h<=h+1e-6;
export const drawingAssetIds=slide=>[...new Set(list(slide.drawings).flatMap(d=>list(d.elements).filter(e=>e.kind==='image').map(e=>e.assetId)))];
export const drawingClaimIds=slide=>[...new Set(list(slide.drawings).flatMap(d=>[...list(d.claimIds),...list(d.elements).flatMap(e=>list(e.claimIds))]))];
function segmentCrossesBox(a,z,b){
  // Intersect the open interior; touching a label border is not an overlap.
  const pad=2, minX=b.x+pad,maxX=b.x+b.w-pad,minY=b.y+pad,maxY=b.y+b.h-pad;
  if(minX>=maxX||minY>=maxY)return false;
  let lo=0,hi=1;const dx=z.x-a.x,dy=z.y-a.y;
  for(const [p,q] of [[-dx,a.x-minX],[dx,maxX-a.x],[-dy,a.y-minY],[dy,maxY-a.y]]){
    if(Math.abs(p)<1e-9){if(q<0)return false;continue;}
    const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
    if(lo>hi)return false;
  }
  return hi-lo>1e-8;
}
export function renderNativeDrawing(b,project,drawing,target,{wrapText}={}){
  const key=`drawing/${drawing.id}`,errors=b.page.issues;
  const issue=(code,message,details={})=>errors.push({severity:'error',code,slideId:b.page.id,drawingId:drawing.id,...details,message});
  if(!boxOK(target)||!finite(drawing.width)||!finite(drawing.height)||drawing.width<=0||drawing.height<=0){issue('drawing-geometry','自由绘图须有正尺寸的局部画布与显示区域。');return;}
  const scale=Math.min(target.w/drawing.width,target.h/drawing.height),x0=target.x+(target.w-drawing.width*scale)/2,y0=target.y+(target.h-drawing.height*scale)/2;
  const box=e=>({x:x0+e.x*scale,y:y0+e.y*scale,w:e.w*scale,h:e.h*scale});
  const point=e=>({x:x0+e.x*scale,y:y0+e.y*scale});
  const seen=new Set(),elements=list(drawing.elements),rendered=[];
  let meaningful=false;
  for(const e of elements){
    if(!e.id||seen.has(e.id)){issue('drawing-element-id','同一自由绘图中的元素id须存在且唯一。',{elementId:e.id});continue;}seen.add(e.id);
    const id=`${key}/${e.id}`,meta={drawingId:drawing.id,drawingElementId:e.id,claimIds:[...new Set([...list(drawing.claimIds),...list(e.claimIds)])],role:e.role};
    if(e.kind!=='line'&&!within(e,drawing.width,drawing.height)){issue('drawing-element-bounds','绘图元素超出局部画布；不得依靠裁切隐藏内容。',{elementId:e.id});continue;}
    if(e.kind==='text'){
      const size=e.fontSize*scale;if(!finite(size)||size<=0){issue('drawing-font','绘图文字必须有明确字号。',{elementId:e.id});continue;}
      const n=b.text(id,e.text,box(e),size,{...meta,bold:!!e.bold,color:e.color||b.p.ink,align:e.align||'left',lineHeight:e.lineHeight||1.2,...(e.emphasis?{emphasis:e.emphasis}:{}),authored:true});
      if(n)rendered.push(n);meaningful=meaningful||Boolean(String(e.text||'').trim());
    }else if(e.kind==='rect'||e.kind==='ellipse'){
      if((!e.fill||e.fill==='none'||e.fillOpacity===0)&&(!e.stroke||e.stroke==='none'))issue('drawing-invisible-shape','形状须有可见填色或边线，不能以不可见对象占位。',{elementId:e.id});
      const props={...box(e),fill:e.fill??'none',stroke:e.stroke??'none',strokeWidth:(e.strokeWidth??1)*scale,...meta,semantic:!['group','decoration'].includes(e.role),...(e.fillOpacity!==undefined?{fillOpacity:e.fillOpacity}:{}),...(e.radius?{radius:e.radius*scale}:{}),...(e.dash&&e.dash!=='solid'?{dash:e.dash}:{}),...(e.shadow?{shadow:{...e.shadow,blur:e.shadow.blur*scale,offset:e.shadow.offset*scale}}:{})};
      if(e.kind==='ellipse'&&e.radius)issue('drawing-ellipse-radius','ellipse不支持radius，不能静默忽略。',{elementId:e.id});
      rendered.push(b.add(e.kind,id,props));meaningful=meaningful||e.role==='data';
    }else if(e.kind==='line'){
      const points=list(e.points);if(points.length<2||points.some(p=>!finite(p.x)||!finite(p.y)||p.x<0||p.y<0||p.x>drawing.width||p.y>drawing.height)){issue('drawing-line-bounds','关系线需至少两个位于局部画布内的有限坐标点。',{elementId:e.id});continue;}
      const segmentLengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));
      if(segmentLengths.some(n=>n<.01)){issue('drawing-line-empty-segment','关系线不能含重合的相邻点；这会产生不可见线段或错误箭头。',{elementId:e.id});continue;}
      for(let i=1;i<points.length;i++){
        const a=point(points[i-1]),z=point(points[i]);
        rendered.push(b.line(`${id}/segment-${i}`,a.x,a.y,z.x,z.y,e.stroke||b.p.accent,{...meta,strokeWidth:(e.strokeWidth??2)*scale,...(e.dash?{dash:e.dash}:{}),endArrow:!!e.endArrow&&i===points.length-1,semantic:e.role!=='decoration'}));
      }
      meaningful=meaningful||e.role!=='decoration';
    }else if(e.kind==='image'){
      const asset=list(project.assets).find(a=>a.id===e.assetId);
      if(!asset){issue('drawing-missing-asset','绘图图片须引用项目中已登记的资产。',{elementId:e.id,assetId:e.assetId});continue;}
      if(!asset.data&&!asset.dataUri){issue('drawing-image-data','图资产缺少已登记的图片数据；先通过资产导入读取来源，绘图不直接读取路径。',{elementId:e.id,assetId:e.assetId});continue;}
      const frame=box(e),assessment=assessFigurePlacement(asset,frame,{slideId:b.page.id,objectId:`${b.page.id}/${id}`});errors.push(...assessment.issues);
      if(!assessment.geometry){issue('drawing-image-dimensions','图资产必须有真实像素尺寸，不能以占位方框替代。',{assetId:e.assetId});continue;}
      const n=b.add('image',id,{...assessment.geometry.imageBox,...meta,role:'evidence-image',assetId:asset.id,data:asset.data||asset.dataUri,alt:asset.caption,source:{paperId:asset.paperId,figure:asset.figure,panel:asset.panel,sourceVersion:asset.sourceVersion},...(asset.viewport?{viewport:structuredClone(asset.viewport)}:{})});rendered.push(n);meaningful=true;
      b.page.notes+='\n\n原图来源：'+[asset.paperId,asset.figure,asset.panel,asset.caption,asset.sourceUrl,asset.sourceVersion,asset.license,asset.cropNote].filter(Boolean).join('\n');
    }else issue('drawing-unsupported-kind','绘图只支持明确声明的原生文字、形状、线与已登记图片。',{elementId:e.id});
  }
  if(!meaningful)issue('drawing-empty-content','背景与空框不能单独构成自由绘图，须保留实际研究内容。');
  for(const e of elements.filter(e=>e.kind==='line'&&e.role==='relationship'))for(const label of elements.filter(e=>e.kind==='text')){
    if(list(e.points).slice(1).some((p,i)=>segmentCrossesBox(e.points[i],p,label)))issue('drawing-line-label-overlap','关系线穿过文字区域；重排端口或折点，并同步移动线标签。',{elementId:e.id,relatedElementId:label.id});
  }
  b.page.drawings??=[];b.page.drawings.push({id:drawing.id,box:{x:x0,y:y0,w:drawing.width*scale,h:drawing.height*scale},scale,elementCount:elements.length,renderedObjectCount:rendered.length});
  return rendered;
}
