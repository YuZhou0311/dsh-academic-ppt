/**
 * Mechanical checks for authored visual decisions.
 *
 * A valid plan is a record of a choice, not proof of originality or good design.
 * Repetition and text-heavy compositions are review prompts: comparable
 * evidence can legitimately use the same structure. The separate geometry
 * report can block large unused regions under an explicit compact policy.
 * Scientific validity and final-slide legibility remain separate checks.
 */

export { designGeometryReport } from './design-geometry.mjs';
import { resolveCardAppearance } from './card-surface.mjs';
import { cardHasContent } from './card-content.mjs';
import { applyAcademicStyle } from './academic-styles.mjs';

const list = value => Array.isArray(value) ? value : [];
const panelsOf = slide => [...list(slide.composition?.regions), ...list(slide.composition?.rows).flatMap(r => list(r.panels))];
export function drawingStructure(drawing) {
  const q=(n,d)=>Math.round((Number(n)||0)/(d||1)*16);
  const elements=list(drawing.elements), marks=new Map();
  for(const e of elements.filter(e=>e.role==='data'&&['rect','ellipse','line'].includes(e.kind)))marks.set(e.kind,(marks.get(e.kind)||0)+1);
  // Numeric mark lengths and positions encode observations, not a new layout.
  // Compare their carrier kinds plus the surrounding labels/axes/regions.
  return [...elements.filter(e=>!['decoration','group'].includes(e.role)&&!(e.role==='data'&&['rect','ellipse','line'].includes(e.kind))).map(e=>e.kind==='line'
    ? ['line',e.role||'relationship',Boolean(e.endArrow),list(e.points).map(p=>[q(p.x,drawing.width),q(p.y,drawing.height)])]
    : [e.kind,e.role||'',q(e.x,drawing.width),q(e.y,drawing.height),q(e.w,drawing.width),q(e.h,drawing.height)]),
    ...[...marks].map(([kind,count])=>['data-carrier',kind,count===1?'single':'multiple'])].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const weightOf = value => Number.isFinite(value) && value > 0 ? value : 1;
const nonBodyLayouts = new Set(['cover', 'section', 'roadmap', 'references']);
const authoredModes = new Set(['content-led', 'reference-guided']);
export function isBodySlide(slide) {
  if(nonBodyLayouts.has(slide.layout))return false;
  // A paper-reading slide often contains the central figure and interpretation;
  // only a genuinely metadata-only introduction is administrative.
  return slide.layout!=='paper'||Boolean(list(slide.figureIds).length||slide.chart||slide.table||slide.plot||list(slide.plots).length||list(slide.drawings).length||list(slide.nodes).length||list(slide.cards).some(cardHasContent));
}

// Weights express ratios. Multiplying every weight by the same factor does not
// change a composition, and must not make a repeated layout appear different.
function ratios(items) {
  const weights = items.map(item => weightOf(item.weight));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map(value => Math.round(value / total * 1000000) / 1000000);
}

function plotKind(slide, panel) {
  if (panel.plotId) return list(slide.plots).find(plot => plot.id === panel.plotId)?.kind || 'plot';
  return panel.plot ? slide.plot?.kind || 'plot' : null;
}

function meaningfulCards(slide, panel) {
  return list(panel.cardIds).filter(id => {
    const card = list(slide.cards).find(item => item.id === id);
    // Broken references are handled by schema/evidence validation. Unresolved
    // IDs still participate here so that this diagnostic cannot hide them.
    return !card || cardHasContent(card);
  });
}

const meaningfulDrawing = drawing => list(drawing?.elements).some(e =>
  !['group','decoration'].includes(e.role) && (e.kind === 'text' && hasText(e.text) || e.kind === 'image' || e.role === 'data' || e.kind === 'line' && e.role === 'relationship'));
// Titles and labels still describe a drawing's scaffold, but a declared
// information layer also needs content. Body/note text remains a valid carrier
// without demanding a chart, frame, relation or minimum amount of text.
const drawingHasContent = drawing => meaningfulDrawing({elements:list(drawing?.elements).filter(e => e.kind !== 'text' || ['body','note'].includes(e.role))});
const boxVector = (box, width = 1280, height = 720) => box ? [box.x / width, box.y / height, box.w / width, box.h / height] : null;
const closeVector = (a, b, limits = [.04, .04, .06, .06]) => Boolean(a && b && a.length === b.length && a.every((value, i) => Math.abs(value - b[i]) <= limits[i % limits.length]));
function matchingItems(a, b, compare) {
  if (a.length !== b.length) return false;
  const used = new Set();
  return a.every(item => {
    const index = b.findIndex((other, i) => !used.has(i) && compare(item, other));
    if (index < 0) return false;
    used.add(index); return true;
  });
}

// Compare a drawing's information scaffold with tolerance. Exact data mark
// positions, text strings, paint and decoration do not create a new layout.
function drawingTopology(drawing) {
  const items = [], marks = new Map(), width = drawing.width || 1, height = drawing.height || 1;
  for (const e of list(drawing.elements)) {
    if (['group', 'decoration'].includes(e.role)) continue;
    if (e.role === 'data' && ['rect', 'ellipse', 'line'].includes(e.kind)) {
      marks.set(e.kind, (marks.get(e.kind) || 0) + 1); continue;
    }
    const key = [e.kind, e.role || '', e.kind === 'line' ? Boolean(e.endArrow) : ''].join(':');
    items.push(e.kind === 'line'
      ? { key, points: list(e.points).map(p => [p.x / width, p.y / height]) }
      : { key, box: boxVector(e, width, height) });
  }
  return { items, marks: [...marks].map(([kind, count]) => [kind, count === 1 ? 'single' : 'multiple']).sort() };
}
function similarDrawing(a, b) {
  return JSON.stringify(a.marks) === JSON.stringify(b.marks) && matchingItems(a.items, b.items, (x, y) => {
    if (x.key !== y.key) return false;
    if (x.points || y.points) return Boolean(x.points && y.points && x.points.length === y.points.length && x.points.every((p, i) => closeVector(p, y.points[i], [.04, .04])));
    return closeVector(x.box, y.box, [.04, .04, .08, .08]);
  });
}

function carrierOf(slide, panel) {
  const parts = [], drawings = [];
  if (list(panel.figureIds).length) parts.push(`figure:${Math.min(2, panel.figureIds.length)}`);
  if (panel.chart) parts.push(`chart:${slide.chart?.kind || 'chart'}`);
  if (panel.plot || panel.plotId) parts.push(`plot:${plotKind(slide, panel)}`);
  if (panel.table) parts.push('table');
  if (list(panel.referenceIds).length) parts.push('bibliography');
  for (const id of list(panel.drawingIds)) {const d=list(slide.drawings).find(d=>d.id===id); if(d && meaningfulDrawing(d))drawings.push(drawingTopology(d));}
  if (panel.diagram) parts.push(`diagram:${JSON.stringify(list(slide.diagram?.rows).map(nodes => list(nodes).length))}`);
  // Adding a title-only/empty card, or increasing a stack from two to three
  // small explanations, is not a new primary information structure.
  if (!parts.length && !drawings.length && meaningfulCards(slide, panel).length) parts.push('text');
  return parts.length || drawings.length ? { kinds: parts.sort(), drawings } : null;
}

const similarCarrier = (a, b) => a === null || b === null ? a === b : JSON.stringify(a.kinds) === JSON.stringify(b.kinds) && matchingItems(a.drawings, b.drawings, similarDrawing);

/** Compare carriers and their allocation, never colours, titles or source IDs. */
export function structureOf(slide) {
  if (!isBodySlide(slide)) return null;
  if (slide.composition?.regions) return {kind:'regions', regions:slide.composition.regions.map(p=>({box:boxVector(p.box),carrier:carrierOf(slide,p)})).filter(p=>p.carrier)};
  if (slide.composition) {
    const rows = list(slide.composition.rows).map(row => {
      const raw = list(row.panels), shares = ratios(raw);
      return { ...row, panels: raw.filter((panel, index) => shares[index] >= .10 && carrierOf(slide, panel)) };
    }).filter(row => row.panels.length);
    const rowRatios = ratios(rows);
    return { kind: 'composition', rows: rows.map((row, rowIndex) => {
      const columnRatios = ratios(row.panels);
      return { share: rowRatios[rowIndex], panels: row.panels.map((panel, index) => ({ share: columnRatios[index], carrier: carrierOf(slide, panel) })) };
    }) };
  }
  if (list(slide.drawings).length) return {kind:'drawings',drawings:slide.drawings.filter(meaningfulDrawing).map(d=>({box:boxVector(d.box),elements:drawingTopology(d)}))};
  if (slide.referenceTemplateId) return { kind: 'reference', value: slide.referenceTemplateId };
  if (slide.figureBoxes) {
    const box = value => value ? ['x', 'y', 'w', 'h'].map(key => Math.round(value[key] / 32)) : null;
    return { kind: 'figure-boxes', value: JSON.stringify([slide.layout, list(slide.figureBoxes).map(box), list(slide.cards).map(card => box(card.box))]) };
  }
  return { kind: 'layout', value: slide.layout };
}

export function similarStructure(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'regions') return matchingItems(a.regions,b.regions,(x,y)=>closeVector(x.box,y.box)&&similarCarrier(x.carrier,y.carrier));
  if (a.kind === 'drawings') return matchingItems(a.drawings,b.drawings,(x,y)=>(x.box===null&&y.box===null||closeVector(x.box,y.box))&&similarDrawing(x.elements,y.elements));
  if (a.kind !== 'composition') return a.value === b.value;
  if (a.rows.length !== b.rows.length) return false;
  // Six percentage points absorb token ratio nudges without collapsing a
  // genuine 2:1 to 3:1 reallocation into an identical layout.
  return a.rows.every((row, index) => {
    const other = b.rows[index];
    return Math.abs(row.share - other.share) <= .06 && row.panels.length === other.panels.length && row.panels.every((panel, column) => similarCarrier(panel.carrier,other.panels[column].carrier) && Math.abs(panel.share - other.panels[column].share) <= .06);
  });
}

function reviewableReason(plan) {
  return hasText(plan?.repetitionReason) && [...plan.repetitionReason.replace(/\s/gu, '')].length >= 16;
}

function textOnlyDrawing(drawing) {
  const elements=list(drawing?.elements);
  return elements.some(e=>e.kind==='text'&&hasText(e.text)) && !elements.some(e=>e.kind==='image'||e.role==='data'||e.kind==='line'&&e.role==='relationship');
}
function isTextPanel(slide,panel) {
  const drawings=list(panel.drawingIds).map(id=>list(slide.drawings).find(d=>d.id===id));
  return (meaningfulCards(slide,panel).length > 0 || drawings.length > 0) && drawings.every(textOnlyDrawing) && !list(panel.figureIds).length &&
    !panel.chart && !panel.plot && !panel.plotId && !panel.table && !panel.diagram && !list(panel.referenceIds).length;
}

function equalAreas(areas) {
  const total=areas.reduce((a,b)=>a+b,0);if(!(total>0))return false;
  const shares=areas.map(a=>a/total);return shares.every(a=>Math.abs(a-shares[0])<=.04);
}
const containsBox=(a,b)=>a&&b&&b.x>=a.x&&b.y>=a.y&&b.x+b.w<=a.x+a.w&&b.y+b.h<=a.y+a.h;
const boxesOverlap=(a,b)=>Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y);
function equalDrawingTextGroups(drawing) {
  if(!textOnlyDrawing(drawing))return false;
  const groups=list(drawing.elements).filter(e=>e.kind==='rect'&&e.role==='group');
  // Leaf containers avoid counting a legitimate enclosing chapter/evidence
  // group as an additional peer. Relationships or data exclude this prompt.
  const leaves=groups.filter(g=>!groups.some(other=>other!==g&&containsBox(g,other)));
  return leaves.length>=3 && leaves.every((g,i)=>!leaves.slice(0,i).some(other=>boxesOverlap(g,other))&&list(drawing.elements).some(e=>e.kind==='text'&&hasText(e.text)&&containsBox(g,e))) && equalAreas(leaves.map(g=>g.w*g.h));
}

/** Detect only an all-text, nominally equal-area arrangement, not all cards. */
function hasEqualTextPanels(slide) {
  const rows = list(slide.composition?.rows), panels = rows.flatMap(row => list(row.panels));
  if (panels.length>=3 && panels.every(p=>isTextPanel(slide,p))) {
    const rowRatios = ratios(rows), areas = rows.flatMap((row, rowIndex) => ratios(list(row.panels)).map(ratio => ratio * rowRatios[rowIndex]));
    if(equalAreas(areas))return true;
  }
  const regions=list(slide.composition?.regions);
  if(regions.length>=3&&regions.every(p=>isTextPanel(slide,p))&&equalAreas(regions.map(p=>p.box.w*p.box.h)))return true;
  const drawings=list(slide.drawings);
  if(!slide.composition&&drawings.length>=3&&drawings.every(d=>d.box&&textOnlyDrawing(d))&&equalAreas(drawings.map(d=>d.box.w*d.box.h)))return true;
  return drawings.some(equalDrawingTextGroups);
}

function panelHasContent(slide,panel) {
  if(meaningfulCards(slide,panel).some(id=>list(slide.cards).some(c=>c.id===id&&cardHasContent(c))))return true;
  if(list(panel.figureIds).some(id=>list(slide.figureIds).includes(id)))return true;
  if(list(panel.drawingIds).some(id=>drawingHasContent(list(slide.drawings).find(d=>d.id===id))))return true;
  if(list(panel.referenceIds).some(id=>list(slide.referenceIds).includes(id)))return true;
  return Boolean(panel.chart&&slide.chart || panel.table&&list(slide.table?.rows).length || panel.plot&&slide.plot || panel.plotId&&list(slide.plots).some(p=>p.id===panel.plotId) || panel.diagram&&list(slide.nodes).some(n=>hasText(n.label)));
}

/**
 * Inspect schema-validated project records without changing them.
 * New design modes ask for concise visual plans; old projects stay compatible.
 */
export function designIssues(project) {
  project={...project,design:applyAcademicStyle(project.design)};
  const issues = [], slides = list(project.slides), mode = project.design?.mode;
  const faithful = mode === 'template-faithful';
  const add = (severity, code, slide, field, message) => issues.push({
    severity, code, path: `slides.${slide.id}${field ? '.' + field : ''}`,
    slideId: slide.id, message,
  });
  const structures = slides.map(structureOf);

  slides.forEach((slide, index) => {
    const plan = slide.visualPlan;
    if (plan) {
      if (!slide.composition) {
        add('error', 'visual-plan-layout', slide, 'visualPlan', 'visualPlan 用于 composition 正文页；先提供实际面板结构，或移除不适用的计划。');
      } else {
        const ids = panelsOf(slide).map(panel => panel.id);
        const known = new Set(ids), order = list(plan.readingOrder);
        if (!known.has(plan.primaryPanelId)) add('error', 'visual-plan-primary-panel', slide, 'visualPlan.primaryPanelId', '主证据面板必须指向本页 composition 中实际存在的面板 ID。');
        if (order.length !== ids.length || new Set(order).size !== order.length || order.some(id => !known.has(id))) {
          add('error', 'visual-plan-reading-order', slide, 'visualPlan.readingOrder', 'readingOrder 必须将本页所有 composition 面板 ID 恰好列出一次，不能遗漏、重复或引用其他页。');
        }
        for(const [layerIndex,layer] of list(plan.contentLayers).entries()){
          const targets=list(layer.panelIds),field=`visualPlan.contentLayers.${layerIndex}.panelIds`;
          if(!targets.length||new Set(targets).size!==targets.length||targets.some(id=>!known.has(id))){
            add('error','visual-layer-panel-ids',slide,field,'信息层须引用当前页真实区域，不能为空、重复或引用其他页。');continue;
          }
          for(const id of targets){const panel=panelsOf(slide).find(p=>p.id===id);if(!panelHasContent(slide,panel))add('error','visual-layer-empty-panel',slide,field,`信息层引用的区域 ${id} 没有实际载体；题签、空卡和装饰框不能代替证据或解释。`);}
        }
      }
    } else if (authoredModes.has(mode) && slide.composition) {
      add('warning', 'design-plan-missing', slide, 'visualPlan', '记录简短 visualPlan：本页关系、主证据面板、阅读顺序和选择理由；计划用于复核内容与构图是否对应，不是审美评分。');
    }

    if (faithful || !isBodySlide(slide)) return;
    if (index >= 2 && similarStructure(structures[index], structures[index - 1]) && similarStructure(structures[index], structures[index - 2]) && !reviewableReason(plan)) {
      const action = slide.composition
        ? '有意保持可比性时简述 visualPlan.repetitionReason，否则按证据重排。'
        : '人工确认这些固定布局是否有助于直接比较；确有需要时保留，否则按证据重排。';
      add('warning', 'layout-repetition', slide, '', '连续三页使用相同或近似的主载体结构和空间比例。检查它们是否回答相同的比较任务；' + action + '换色、换边框、微调比例或添加空卡不构成新的信息组织。');
    }
    if (hasEqualTextPanels(slide)) {
      add('warning', 'equal-text-panels', slide, slide.composition?'composition':'drawings', '本页含至少三个等权纯文字组，包括自由区域或自绘容器。若它们确为平级且可比较的对象，可以保留；否则突出主证据、明确关系或合并重复说明。无需为消除提醒添加装饰图或虚构数据。');
    }
    if (hasText(plan?.repetitionReason) && !reviewableReason(plan)) add('warning', 'repetition-reason-thin', slide, 'visualPlan.repetitionReason', '重复构图的理由过短，尚不足以审阅。说明具体比较对象、需要保持一致的尺度或阅读位置；“保持统一”等泛称不能代替适配判断。');

    for (const panel of panelsOf(slide)) {
      const ids = meaningfulCards(slide, panel);
      if (ids.length < 2 || list(panel.figureIds).length || list(panel.drawingIds).length || list(panel.referenceIds).length || panel.table || panel.chart || panel.plot || panel.plotId || panel.diagram) continue;
      const surface = panel.surface && panel.surface !== 'inherit' ? panel.surface : project.design?.system?.panel;
      if (['tint', 'band'].includes(surface)) continue;
      const framed = ids.some(id => {
        const card = list(slide.cards).find(item => item.id === id);
        const appearance = card ? resolveCardAppearance(card, project.design) : null;
        return card && (appearance && appearance.surface !== 'plain' || card.templateComponentId || card.style && !['plain', 'compact', 'ruled', 'academic-side'].includes(card.style));
      });
      if (!framed && project.design?.density === 'compact') add('warning', 'unframed-card-stack', slide, 'composition', `面板 ${panel.id} 内有多个开放文字组。检查它们是否需要独立的浅底、细边框、强调边或语义图标来区分条件与解释；不要只扩大空卡框，也不要求每段文字都套框。`);
    }
  });

  if (!faithful) {
    const bodies = slides.map((slide, index) => ({ slide, structure: structures[index] })).filter(item => item.structure);
    const groups = [];
    for (const item of bodies) {
      const group = groups.find(candidate => similarStructure(candidate[0].structure, item.structure));
      if (group) group.push(item); else groups.push([item]);
    }
    for (const group of groups) {
      if (bodies.length < 5 || group.length < 4 || group.length / bodies.length < .60) continue;
      const unexplained = group.filter(item => !reviewableReason(item.slide.visualPlan));
      if (!unexplained.length) continue;
      const target = unexplained.at(-1).slide;
      issues.push({ severity: 'warning', code: 'deck-layout-dominance', path: `slides.${target.id}`, slideId: target.id, relatedSlideIds: group.map(item => item.slide.id), matchingSlides: group.length, bodySlides: bodies.length,
        message: `全稿 ${bodies.length} 张正文中有 ${group.length} 张采用相同或近似的主结构，包含非相邻页面。逐页核对论证关系是否支持这种重复；保留真实比较所需的共同尺度，其余页面重排主证据、解读与层级。颜色、边框、微调比例和空卡不算结构变化。` });
    }
  }
  return issues;
}
