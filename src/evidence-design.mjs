/** Reviewable signals over the actual export scene, not an aesthetic or scientific score. */
import { expandClaimIds } from './academic-quality.mjs';
import { readingRole } from './projection-quality.mjs';
import { isBodySlide } from './design-quality.mjs';
import { figureGeometry, FIGURE_LABEL_TARGET_PX, FIGURE_LABEL_FLOOR_PX } from './figure-planning.mjs';

const list = value => Array.isArray(value) ? value : [];
const roots = slide => [...list(slide.claimIds), ...list(slide.cards).flatMap(c => list(c.claimIds)),
  ...(slide.chart ? [slide.chart.sourceClaimId] : []), ...list(slide.plot?.sourceClaimIds),
  ...list(slide.plots).flatMap(p => list(p.sourceClaimIds)), ...list(slide.table?.sourceClaimIds),
  ...list(slide.drawings).flatMap(d => [...list(d.claimIds), ...list(d.elements).flatMap(e => list(e.claimIds))])];
const textsOf = node => node.kind === 'text' ? [String(node.text || '')]
  : node.kind === 'table' ? [...list(node.table?.columns), ...list(node.table?.rows).flat()].map(String)
  : node.kind === 'chart' ? [...list(node.chart?.categories), ...list(node.chart?.series).flatMap(s => [s.name, ...list(s.values)]), node.chart?.unit].filter(v=>v!==undefined).map(String)
  : [];

/** Normalise typography and whitespace; retain signs, decimals and units. */
const normalized = text => String(text ?? '').normalize('NFKC').replace(/−/g, '-')
  .replace(/\s+/gu, (space,offset,source) => /[\d.]/.test(source[offset-1]||'') && /[\d.+-]/.test(source[offset+space.length]||'') ? ' ' : '');
function visibleMatch(haystack, needle) {
  if (!needle) return false;
  const numbers = [...haystack.matchAll(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g)]
    .map(match => [match.index, match.index + match[0].length]);
  let offset = haystack.indexOf(needle);
  while (offset >= 0) {
    const end = offset + needle.length;
    // Never match a fragment of a signed decimal or scientific-notation token.
    // Unit case remains meaningful: mm/mM and mW/MW are different quantities.
    if (!numbers.some(([a,b]) => offset > a && offset < b || end > a && end < b)) return true;
    offset = haystack.indexOf(needle, offset + 1);
  }
  return false;
}

export function contentCoverageReport(project, scenes) {
  const pages = new Map(list(scenes?.pages).map(page => [page.id, page]));
  const issues = [], slides = [];
  for (const slide of list(project.slides)) {
    if (!list(slide.contentChecks).length) continue;
    const nodes = list(pages.get(slide.id)?.nodes).filter(n => n.semantic !== false && readingRole(n) !== 'note' &&
      !['reference-title', 'reference-index', 'identity', 'index', 'section-label', 'section-index', 'decoration'].includes(n.role));
    const chunks = nodes.flatMap(textsOf).filter(Boolean).map(normalized);
    const haystack = chunks.join(' ');
    const checks = slide.contentChecks.map(check => ({ id: check.id, text: check.text,
      visible: visibleMatch(haystack, normalized(check.text)) }));
    for (const check of checks.filter(c => !c.visible)) issues.push({ severity: 'error', code: 'required-visible-content-missing',
      path: `slides.${slide.id}.contentChecks.${check.id}`, slideId: slide.id,
      message: `主要视图中未找到必须可见的内容“${check.text}”。讲稿、脚注或来源记录不能代替正文；核对当前导出对象及措辞。` });
    slides.push({ slideId: slide.id, checks });
  }
  return { basis: 'author-specified-visible-text-not-fact-verification', slides, issues };
}

const finite = value => Number.isFinite(value);
const knownFigureTypes = new Set(['dense-multipanel','plot','diagram','photo','table','mixed']);
const dataFigureTypes = new Set(['dense-multipanel','plot','table','mixed']);
const nonContentRoles = new Set(['footer','citation','note','caption','source-details','reference-title','reference-index','identity','section-label','section-index','index','decoration','icon','logo','context-visual']);
const unique = values => [...new Set(values)];
const rounded = value => Math.round(value * 10000) / 10000;
const readingTasks = new Set(['read-values','compare-panels']);

/** Use the picture's native bounds, never its containing card, as the scale.
 * The scene exposes caption/legend costs for ordinary and nested figures.
 * Native drawings and older scenes remain measurable from their image node.
 */
function actualFigureReading(asset,node,placement) {
  const effectiveAsset=node.viewport?{...asset,viewport:node.viewport}:asset;
  // A malformed external/legacy scene is not allowed to crash the rest of a
  // quality report. The figure renderer independently rejects invalid crops.
  let geometry=null;
  try { geometry=figureGeometry(effectiveAsset,node); } catch { /* unmeasured below */ }
  const measured=finite(asset.reading?.minLabelPx)&&asset.reading.minLabelPx>0;
  const projectedLabelPx=geometry&&measured?rounded(asset.reading.minLabelPx*geometry.scale):null;
  return {
    task:asset.reading?.task||null,requiresLabels:readingTasks.has(asset.reading?.task),
    sourceLabelPx:measured?asset.reading.minLabelPx:null,projectedLabelPx,
    labelFloorPx:FIGURE_LABEL_FLOOR_PX,labelTargetPx:FIGURE_LABEL_TARGET_PX,
    status:projectedLabelPx===null?'unmeasured':projectedLabelPx<FIGURE_LABEL_FLOOR_PX?'below-floor':projectedLabelPx<FIGURE_LABEL_TARGET_PX?'needs-review':'estimated-readable',
    requiredImageAtTarget:geometry&&measured?{w:rounded(geometry.visibleWidth*FIGURE_LABEL_TARGET_PX/asset.reading.minLabelPx),h:rounded(geometry.visibleHeight*FIGURE_LABEL_TARGET_PX/asset.reading.minLabelPx)}:null,
    ...(placement?{slotBox:placement.slotBox,frameBox:placement.frameBox,captionHeight:placement.captionHeight,legendHeight:placement.legendHeight,slotUtilization:rounded(placement.slotUtilization)}:{}),
    basis:'source-label-measurement-and-final-image-geometry-not-visual-approval',
  };
}

/** This checks the recorded review, never independently interprets pixels. */
export function isReviewedScientificImage(asset) {
  return asset?.usage === 'figure' && asset.reading?.purpose === 'evidence' &&
    ['human','vision-model'].includes(asset.reading?.verifiedBy) && knownFigureTypes.has(asset.reading?.contentType);
}
export function isReviewedSourceFigure(asset) {
  return isReviewedScientificImage(asset) && (asset.provenance === undefined || asset.provenance === 'source') &&
    Boolean(asset.paperId && String(asset.figure || '').trim());
}
export function isScientificBodySlide(slide) {
  if (!isBodySlide(slide)) return false;
  if (slide.layout !== 'closing') return true;
  // The built-in closing object is a context/thank-you carrier. A closing
  // composed from actual research records still contributes to the evidence
  // story, including source-bearing native drawings beside that context.
  const researchDrawing=list(slide.drawings).some(d => list(d.claimIds).length ||
    list(d.elements).some(e => list(e.claimIds).length || e.kind==='image'&&list(slide.paperIds).length));
  if (slide.closing) return researchDrawing;
  return Boolean(roots(slide).some(Boolean) || list(slide.figureIds).length || list(slide.cards).some(card=>list(card.figureIds).length) ||
    slide.chart || slide.table || slide.plot || list(slide.plots).length ||
    researchDrawing);
}

function visibleBox(node, page) {
  if (!(finite(node.w) && finite(node.h) && node.w > 0 && node.h > 0)) return null;
  const x = finite(node.x) ? node.x : 0, y = finite(node.y) ? node.y : 0;
  const left = Math.max(0,x), top = Math.max(0,y);
  const right = Math.min(page.width || 1280,x+node.w), bottom = Math.min(page.height || 720,y+node.h);
  return right > left && bottom > top ? {x:left,y:top,w:right-left,h:bottom-top} : null;
}
function visibleNode(node, page) {
  if (node.semantic === false || node.opacity === 0 || nonContentRoles.has(node.role)) return false;
  if (node.kind === 'line') return !['x','y','w','h'].every(key => finite(node[key])) ||
    Math.hypot(node.w,node.h) > 0 && Math.max(node.x,node.x+node.w) >= 0 && Math.min(node.x,node.x+node.w) <= (page.width || 1280) &&
    Math.max(node.y,node.y+node.h) >= 0 && Math.min(node.y,node.y+node.h) <= (page.height || 720);
  // Real exported scenes have geometry. Keep old external diagnostic scenes
  // with geometry omitted reviewable, but explicitly zero/off-page boxes fail.
  if (finite(node.w) || finite(node.h)) return Boolean(visibleBox(node,page));
  return node.kind !== 'image';
}
function sourceBinding(slide, asset, knownPapers) {
  const declared = new Set([...list(slide.figureIds),...list(slide.cards).flatMap(card=>list(card.figureIds)),...list(slide.drawings).flatMap(d=>list(d.elements).filter(e=>e.kind==='image').map(e=>e.assetId))]);
  return declared.has(asset.id) && knownPapers.has(asset.paperId) && list(slide.paperIds).includes(asset.paperId);
}
function unionArea(boxes) {
  const xs=unique(boxes.flatMap(b=>[b.x,b.x+b.w])).sort((a,b)=>a-b); let area=0;
  for(let i=1;i<xs.length;i++){
    const spans=boxes.filter(b=>b.x<xs[i]&&b.x+b.w>xs[i-1]).map(b=>[b.y,b.y+b.h]).sort((a,b)=>a[0]-b[0]);
    let height=0,end=-Infinity;
    for(const [start,stop] of spans){height+=Math.max(0,stop-Math.max(start,end));end=Math.max(end,stop);}
    area+=(xs[i]-xs[i-1])*height;
  }
  return area;
}

/** Inspect all body pages, including qualitative synthesis. Counts describe
 * actual scene carriers; cards, badges and arrows are never source figures. */
export function evidenceDesignReport(project, scenes) {
  const pages = new Map(list(scenes?.pages).map(page => [page.id, page]));
  const claims = new Map(list(project.claims).map(c => [c.id, c]));
  const assets = new Map(list(project.assets).map(a => [a.id, a]));
  const knownPapers = new Set(list(project.papers).map(p=>p.id));
  const issues = [], slides = [];
  for (const [slideIndex,slide] of list(project.slides).entries()) {
    if (!isScientificBodySlide(slide)) continue;
    const linked = expandClaimIds(list(project.claims), roots(slide)).map(id => claims.get(id)).filter(Boolean);
    const quantitative = linked.some(c => list(c.metrics).length);
    const page=pages.get(slide.id) || {}, nodes=list(page.nodes).filter(n=>visibleNode(n,page));
    const placements=new Map(list(page.figurePlacements).map(item=>[item.objectId,item]));
    const visibleCarriers = [];
    const sourceFigures=[],authoredFigures=[],excludedImages=[];
    const pageArea=(page.width || 1280)*(page.height || 720);
    for(const node of nodes.filter(n=>n.kind==='image')){
      const asset=assets.get(node.assetId),box=visibleBox(node,page);
      let reason=!asset?'missing-asset':!sourceBinding(slide,asset,knownPapers)?'unbound-or-unrelated-source':
        asset.usage!=='figure'?'decorative':asset.reading?.purpose==='locator'?'locator':
        !isReviewedScientificImage(asset)?'unreviewed':!['source','author-created',undefined].includes(asset.provenance)?'non-research-provenance':
        !/^data:image\/(?:png|jpeg);base64,/.test(node.data || asset.data || asset.dataUri || '')?'missing-pixels':!box?'not-visible':null;
      if(reason){excludedImages.push({assetId:node.assetId,reason});continue;}
      const record={assetId:asset.id,objectId:node.id,paperId:asset.paperId,figure:asset.figure || '',contentType:asset.reading.contentType,
        areaFraction:rounded(box.w*box.h/pageArea),box,thumbnail:box.w*box.h/pageArea<.06&&(box.w<260||box.h<160),
        reading:actualFigureReading(asset,node,placements.get(node.id))};
      if(isReviewedSourceFigure(asset))sourceFigures.push(record);
      else if(asset.provenance==='author-created')authoredFigures.push(record);
      else excludedImages.push({assetId:asset.id,reason:'missing-source-identity'});
    }
    if(sourceFigures.length)visibleCarriers.push('source-figure');
    if(authoredFigures.length)visibleCarriers.push('authored-figure');
    const charts=nodes.filter(n=>n.kind==='chart'&&list(n.chart?.series).some(s=>list(s.values).length));
    const tables=nodes.filter(n=>n.kind==='table'&&list(n.table?.rows).length);
    const plotMarks=nodes.filter(n=>/\/data-plot\//.test(n.id||'')&&['ellipse','rect','line'].includes(n.kind));
    if(charts.length)visibleCarriers.push('chart');
    if(tables.length)visibleCarriers.push('table');
    if(plotMarks.length)visibleCarriers.push('scientific-plot');
    const marks = nodes.filter(n => n.role === 'data' && ['rect','ellipse','line'].includes(n.kind) &&
      list(n.claimIds).some(id=>list(claims.get(id)?.metrics).length));
    const relations = nodes.filter(n => n.kind === 'line' && (n.role === 'relationship' || /\/edge:\d/.test(n.id || '')));
    const labels = nodes.filter(n => n.kind === 'text' && n.text?.trim());
    if (marks.length >= 2 && labels.filter(n => /\d/.test(n.text)).length >= 2) visibleCarriers.push('authored-data-marks');
    if (relations.length && labels.length >= 2 && linked.length) visibleCarriers.push('authored-relationship');
    const dataCarriers=visibleCarriers.filter(kind=>['chart','scientific-plot','authored-data-marks'].includes(kind));
    if(sourceFigures.some(f=>dataFigureTypes.has(f.contentType)))dataCarriers.push('source-figure');
    if(authoredFigures.some(f=>dataFigureTypes.has(f.contentType)))dataCarriers.push('authored-figure');
    // A year or method number does not turn a qualitative table into a result
    // table. Use this table's direct sources, not an unrelated quantitative
    // claim elsewhere on the page or a quantitative premise of a qualitative
    // claim. Source validity is also checked by the independent evidence gate.
    if(tables.some(n=>list(n.table.rows).flat().some(value=>/\d/.test(String(value))) &&
      list(n.table.sourceClaimIds).some(id=>{
        const source=claims.get(id);
        return source?.verified===true && list(source.metrics).length>0 &&
          knownPapers.has(source.paperId) && list(slide.paperIds).includes(source.paperId);
      })))dataCarriers.push('table');
    // Track carrier-level provenance separately from page citations. A table
    // or diagram for one source cannot clear an unrelated source's figure gap
    // simply because both papers are mentioned somewhere on the same page.
    const authoredImageIds=new Set(authoredFigures.map(f=>f.assetId));
    const carrierClaims=[...charts.flatMap(n=>[n.chart.sourceClaimId]),
      ...tables.flatMap(n=>list(n.table.sourceClaimIds)),...plotMarks.flatMap(n=>list(n.sourceClaimIds)),
      ...nodes.filter(n=>n.kind==='image'&&authoredImageIds.has(n.assetId)).flatMap(n=>list(n.claimIds)),
      ...(visibleCarriers.includes('authored-data-marks')?marks.flatMap(n=>list(n.claimIds)):[]),
      ...(visibleCarriers.includes('authored-relationship')?relations.flatMap(n=>list(n.claimIds).length?list(n.claimIds):
        /\/edge:\d/.test(n.id || '')?list(slide.claimIds):[]):[])];
    const scientificCarrierPaperIds=unique([...sourceFigures,...authoredFigures].map(f=>f.paperId).concat(
      expandClaimIds(list(project.claims),carrierClaims).map(id=>claims.get(id))
        .filter(c=>c?.verified===true&&knownPapers.has(c.paperId)&&list(slide.paperIds).includes(c.paperId)).map(c=>c.paperId)));
    const paperIds = new Set([...list(slide.paperIds),...linked.map(c => c.paperId)]);
    const availableSourceFigures = [...assets.values()].filter(a => paperIds.has(a.paperId) && a.usage === 'figure' && a.reading?.purpose !== 'locator' &&
      (a.provenance===undefined||a.provenance==='source')).map(a => ({ id: a.id, paperId: a.paperId, figure: a.figure || '', caption: a.caption,reviewed:isReviewedSourceFigure(a) }));
    const bodyTexts=labels.filter(n=>readingRole(n)==='body'),bodyCharacters=bodyTexts.reduce((sum,n)=>sum+String(n.text).replace(/\s/gu,'').length,0);
    const hasScientificVisual=visibleCarriers.some(kind=>kind!=='table');
    const sourceFigureIds=unique(sourceFigures.map(f=>f.assetId)),authoredFigureIds=unique(authoredFigures.map(f=>f.assetId));
    const textOnly=!visibleCarriers.length&&labels.length>0;
    const textBurden=bodyCharacters>=420||!hasScientificVisual&&bodyCharacters>=220&&bodyTexts.length>=6;
    slides.push({slideId:slide.id,slideNumber:slideIndex+1,layout:slide.layout || null,paperIds:[...paperIds],quantitative,
      visibleCarriers,dataCarriers,scientificCarrierPaperIds,sourceFigureIds,authoredFigureIds,sourceFigures,authoredFigures,excludedImages,availableSourceFigures,
      hasScientificVisual,hasNativeTable:tables.length>0,textOnly,bodyCharacters,bodyTextBlocks:bodyTexts.length,textBurden:textBurden?'needs-review':'not-flagged',
      sourceFigureAreaFraction:rounded(unionArea(sourceFigures.map(f=>f.box))/pageArea),
      primaryPanelId: slide.visualPlan?.primaryPanelId || null });
    if (quantitative && slide.argument?.role==='evidence' && !dataCarriers.length) issues.push({ severity: project.brief?.visualEvidence?.mode==='source-led'?'error':'warning', code: 'quantitative-evidence-text-only', slideId: slide.id,
      path: `slides.${slide.id}`, availableSourceFigureIds: availableSourceFigures.map(a => a.id),
      message: '本页含定量结果，但未识别对应的可见数据图、数值表或有来源的数据标记。文字卡片、关系箭头和方法示意不能代替结果分布、趋势与比较；优先取得论文结果图或据已核对数据准确绘图。' });
    const unreviewed=unique(excludedImages.filter(item=>item.reason==='unreviewed').map(item=>item.assetId));
    if(unreviewed.length)issues.push({severity:'warning',code:'scientific-image-review-missing',slideId:slide.id,assetIds:unreviewed,
      message:'画面中有图片，但尚无实际看图记录；未计入已核对的论文图或科学插图。查看原图与图注，记录reading职责、内容类型及实际核对者。'});
    const thumbnails=unique(sourceFigures.filter(f=>f.thumbnail).map(f=>f.assetId));
    if(thumbnails.length)issues.push({severity:'warning',code:'source-figure-thumbnail-review',slideId:slide.id,assetIds:thumbnails,
      message:'论文图目前只占较小显示区域。按实际阅读任务检查图内标签、图例和比较关系，必要时放大相关面板并重排解释；此为缩略图提醒，不是统一图片占幅配额。'});
    const unreadableCandidates=[...sourceFigures,...authoredFigures].filter(f=>f.thumbnail&&f.reading.requiresLabels&&f.reading.projectedLabelPx===null);
    if(unreadableCandidates.length)issues.push({severity:'error',code:'figure-readability-unverified',slideId:slide.id,
      assetIds:unique(unreadableCandidates.map(f=>f.assetId)),
      figures:unreadableCandidates.map(f=>({assetId:f.assetId,objectId:f.objectId,imageBox:f.box,task:f.reading.task})),
      message:`${unreadableCandidates.map(f=>`${f.assetId}（实际 ${Math.round(f.box.w)}×${Math.round(f.box.h)} px）`).join('、')}需要读数或面板比较，但当前是缩略图且没有关键标签高度测量。记录源图 reading.minLabelPx 后按最终比例复核，或扩大原图并重排说明；大卡框、高分辨率和“已看原图”不能证明投影可读，不得为通过检查改成定位图。`});
    if(textBurden)issues.push({severity:'warning',code:'body-text-burden-review',slideId:slide.id,bodyCharacters,bodyTextBlocks:bodyTexts.length,
      message:'正文文字负担较高；检查可否用论文图、方法结构或准确数据图承担关系表达，并把解释放在相应图旁。字符数仅是复核信号，不要求按固定字数删减必要条件。'});
  }
  const byId=new Map(slides.map(s=>[s.slideId,s])),runs=[];let run=[];
  const flush=()=>{if(run.length)runs.push(run);run=[];};
  for(const slide of list(project.slides)){const record=byId.get(slide.id);if(record?.textOnly)run.push(record.slideId);else flush();}flush();
  for(const slideIds of runs.filter(ids=>ids.length>=3))issues.push({severity:'warning',code:'consecutive-text-only-pages',slideIds,
    message:`连续 ${slideIds.length} 个正文页只有文字载体。回到文献图表盘点，将研究对象、方法、证据和比较组织为可看的图文关系；不靠装饰图或卡片换色消除提示。`});
  const sourceFigureIds=unique(slides.flatMap(s=>s.sourceFigureIds)),bodySlideCount=slides.length;
  const summary={bodySlideCount,sourceFigureSlideCount:slides.filter(s=>s.sourceFigureIds.length).length,sourceFigureCount:sourceFigureIds.length,sourceFigureIds,
    scientificVisualSlideCount:slides.filter(s=>s.hasScientificVisual).length,nativeTableSlideCount:slides.filter(s=>s.hasNativeTable).length,
    textOnlySlideCount:slides.filter(s=>s.textOnly).length,longestTextOnlyRun:Math.max(0,...runs.map(ids=>ids.length)),
    sourceFigureSlideCoverage:bodySlideCount?rounded(slides.filter(s=>s.sourceFigureIds.length).length/bodySlideCount):0,
    scientificVisualSlideCoverage:bodySlideCount?rounded(slides.filter(s=>s.hasScientificVisual).length/bodySlideCount):0,
    unmeasuredReadingFigureCount:slides.flatMap(s=>[...s.sourceFigures,...s.authoredFigures]).filter(f=>f.reading.requiresLabels&&f.reading.projectedLabelPx===null).length,
    unverifiedReadingThumbnailCount:slides.flatMap(s=>[...s.sourceFigures,...s.authoredFigures]).filter(f=>f.thumbnail&&f.reading.requiresLabels&&f.reading.projectedLabelPx===null).length};
  return { basis: 'actual-scene-carriers-with-declared-source-review-not-independent-verification', summary,slides,issues,
    limits:'覆盖是实际场景中的载体统计，原图身份和reading来自可审查记录；不联网验真、不判断图像语义或最终可读性。面积为可见边界的几何估算，未计算遮挡，不设统一图片数量或占幅配额。' };
}
