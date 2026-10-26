/** Geometry-based figure advice. Semantic inputs are observations supplied by a
 * reader, never inferred from a file name, a model name, or pixel dimensions.
 * Thresholds are this plugin's projection heuristics, not scientific standards.
 */
export const FIGURE_LABEL_TARGET_PX = 18;
export const FIGURE_LABEL_FLOOR_PX = 12;
const finitePositive = value => Number.isFinite(value) && value > 0;
const round = value => Math.round(value * 100) / 100;

export function figureGeometry(asset, box) {
  const width = Number(asset?.width), height = Number(asset?.height);
  if (!finitePositive(width) || !finitePositive(height) || !finitePositive(box?.w) || !finitePositive(box?.h)) return null;
  const v = asset.viewport || {x:0,y:0,w:1,h:1};
  if (![v.x,v.y,v.w,v.h].every(Number.isFinite) || v.x<0 || v.y<0 || v.w<=0 || v.h<=0 || v.x+v.w>1+1e-9 || v.y+v.h>1+1e-9) throw new Error('INVALID_VIEWPORT: figure advice requires a valid source viewport');
  const visibleWidth = width*v.w, visibleHeight = height*v.h;
  const scale = Math.min(box.w/visibleWidth,box.h/visibleHeight);
  const w=visibleWidth*scale,h=visibleHeight*scale;
  return {sourceWidth:width,sourceHeight:height,visibleWidth,visibleHeight,aspectRatio:visibleWidth/visibleHeight,scale,
    imageBox:{x:(box.x||0)+(box.w-w)/2,y:(box.y||0)+(box.h-h)/2,w,h},
    occupiedFraction:w*h/(box.w*box.h),cropped:v.x>1e-9||v.y>1e-9||v.w<1-1e-9||v.h<1-1e-9};
}

/** box is the image frame AFTER caption/padding allocation. No pixels are edited. */
export function assessFigurePlacement(asset, box, context = {}) {
  const geometry=figureGeometry(asset,box),reading=asset?.reading,issues=[];
  const add=(severity,code,message)=>issues.push({severity,code,...context,assetId:asset?.id,message});
  if(!geometry){add('warning','figure-dimensions-unverified','原始像素或目标区域未知，尚不能判断图片是否适合此布局。');return {status:'unverified',geometry:null,projectedLabelPx:null,issues};}
  if(asset.usage==='decorative'&&!reading)return {status:'not-evidence',geometry,projectedLabelPx:null,issues};
  if(!reading)add('warning','figure-reading-unspecified','先查看原图，记录 reading 中的图像内容、阅读任务和证据/定位职责，再判断布局。尺寸匹配不等于图可读。');
  else if(reading.verifiedBy==='unverified'||reading.contentType==='unknown')add('warning','figure-reading-unverified','图像内容尚未由具备图像能力的执行者或人核对；不能将布局建议写成视觉通过。');
  const locator=reading?.purpose==='locator';
  const projectedLabelPx=finitePositive(reading?.minLabelPx)?reading.minLabelPx*geometry.scale:null;
  if(locator&&reading.task!=='overview')add('error','locator-task-mismatch','定位图仅支持 overview；读数、面板比较或过程解释需要可读的证据图。');
  if(reading?.contentType==='dense-multipanel'&&!locator&&reading.task!=='overview'){
    // Panel count and an uncropped source do not establish illegibility. Keep
    // the measured label checks below, and require review of the actual task.
    add('warning','figure-multipanel-review','按本页读数或比较任务，核对所需面板、共同尺度、图例和关键标签是否能同时辨认。完整多面板可以保留；是否选择局部或拆页由实际可读性与科学上下文决定，不由面板数量或是否裁切决定。');
  }
  if(!locator&&projectedLabelPx!==null&&projectedLabelPx<FIGURE_LABEL_FLOOR_PX){
    add('error','figure-label-too-small',`关键标签投影高度估计只有 ${round(projectedLabelPx)} px，低于本插件 ${FIGURE_LABEL_FLOOR_PX} px 预检底线；扩大证据面板、换页型或寻找出版方放大图。`);
  }else if(!locator&&projectedLabelPx!==null&&projectedLabelPx<FIGURE_LABEL_TARGET_PX){
    add('warning','figure-label-needs-review',`关键标签投影高度估计 ${round(projectedLabelPx)} px，低于建议 ${FIGURE_LABEL_TARGET_PX} px；实际检查轴、图例和关键注释，必要时放大或拆页。`);
  }
  if(!locator&&reading&&['read-values','compare-panels'].includes(reading.task)&&projectedLabelPx===null)add('warning','figure-label-measurement-missing','此图需要读数或比较；记录原始像素中的关键标签高度，或在实际 PPTX 画面中逐项核对。不能仅以高分辨率判定可读。');
  if(!locator&&geometry.occupiedFraction<.48)add('warning','figure-slot-mismatch',`原图按比例显示后仅使用图框约 ${Math.round(geometry.occupiedFraction*100)}% 的面积；调整图框比例或使用已核对面板。该比例只描述图框适配，不是整页信息密度评分。`);
  if(!locator&&geometry.scale>2.5)add('warning','figure-source-resolution','显示需要将源图像素放大超过 2.5 倍；优先获取作者或出版方的高清/矢量原图，放大插值不能补回细节。');
  return {status:issues.some(i=>i.severity==='error')?'needs-change':!reading||reading.verifiedBy==='unverified'||reading.contentType==='unknown'?'unverified':'estimated',
    geometry,projectedLabelPx:projectedLabelPx===null?null:round(projectedLabelPx),issues,
    limits:'minLabelPx 为执行者测量声明；输出仅估计几何和投影字形高度。未验证裁切保留了科学上下文，也未独立检查视觉质量。'};
}

/** Rank a bounded set of actual catalogue slots. Larger area alone never proves readability. */
export function recommendFigureLayouts(figure, templates) {
  const candidates=[];
  for(const template of templates){
    if(!template.slots?.figures?.length)continue;
    const placements=template.slots.figures.map((box,slotIndex)=>{
      // Reserve one compact citation line. The renderer uses the actual caption.
      const frame={...box,h:Math.max(1,box.h-36)};
      const assessment=assessFigurePlacement(figure,frame);
      const g=assessment.geometry;
      const semantic=template.figureGuidance;
      const matchesType=!semantic||semantic.contentTypes.includes(figure.reading.contentType);
      const matchesTask=!semantic||semantic.readingTasks.includes(figure.reading.task);
      const errors=assessment.issues.filter(i=>i.severity==='error').length;
      // An engineering ordering, not a score of beauty or scientific validity.
      const priority=(matchesType?24:0)+(matchesTask?18:0)+(g?g.occupiedFraction*20+g.imageBox.w*g.imageBox.h/18000:0)-errors*100;
      return {slotIndex,frame,assessment,priority};
    }).sort((a,b)=>b.priority-a.priority);
    const best=placements[0];
    candidates.push({templateId:template.id,name:template.name,layout:template.layout,slotIndex:best.slotIndex,
      imageBox:best.assessment.geometry?.imageBox,projectedLabelPx:best.assessment.projectedLabelPx,
      occupiedFraction:best.assessment.geometry?round(best.assessment.geometry.occupiedFraction):null,
      status:best.assessment.status,issues:best.assessment.issues,requirements:template.requirements,
      figureGuidance:template.figureGuidance,priority:best.priority});
  }
  candidates.sort((a,b)=>b.priority-a.priority||a.templateId.localeCompare(b.templateId));
  const top=candidates.slice(0,3).map(({priority,...candidate})=>candidate);
  const needsChange=top.length>0&&top.every(c=>c.status==='needs-change');
  return {status:!top.length?'no-matching-figure-slots':needsChange?'select-panel-or-change-layout':top.some(c=>c.status==='unverified')?'unverified':'candidates',
    candidates:top,requiredElements:figure.reading.requiredElements||[],
    nextActions:needsChange?['先从原图/补充材料中选可读的独立面板，保留轴、图例、单位及必要比较对象。','将新 viewport 和对应 reading 重新传入 reference；不自动猜测科学裁切范围。']:['按任务与候选区域选择布局，再提供其他真实内容；不为满足槽位数增添无关面板。','检查实际 PPTX；所有候选均不合适时用受控自定义区域或拆页，不硬套排名第一项。'],
    basis:'依据已声明的图像任务、实际比例、图框和关键标签高度排序；最多返回三个候选，不判断科学语义或审美优劣。'};
}
