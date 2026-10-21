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

const list = value => Array.isArray(value) ? value : [];
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const weightOf = value => Number.isFinite(value) && value > 0 ? value : 1;
const nonBodyLayouts = new Set(['cover', 'section', 'roadmap', 'paper', 'references']);
const authoredModes = new Set(['content-led', 'reference-guided']);

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
    return !card || hasText(card.body) || Boolean(card.metric);
  });
}

function carrierOf(slide, panel) {
  const parts = [];
  if (list(panel.figureIds).length) parts.push(`figure:${Math.min(2, panel.figureIds.length)}`);
  if (panel.chart) parts.push(`chart:${slide.chart?.kind || 'chart'}`);
  if (panel.plot || panel.plotId) parts.push(`plot:${plotKind(slide, panel)}`);
  if (panel.table) parts.push('table');
  if (panel.diagram) parts.push(`diagram:${JSON.stringify(list(slide.diagram?.rows).map(nodes => list(nodes).length))}`);
  // Adding a title-only/empty card, or increasing a stack from two to three
  // small explanations, is not a new primary information structure.
  return parts.length ? parts.join('+') : meaningfulCards(slide, panel).length ? 'text' : null;
}

/** Compare carriers and their allocation, never colours, titles or source IDs. */
function structureOf(slide) {
  if (nonBodyLayouts.has(slide.layout)) return null;
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
  if (slide.referenceTemplateId) return { kind: 'reference', value: slide.referenceTemplateId };
  if (slide.figureBoxes) {
    const box = value => value ? ['x', 'y', 'w', 'h'].map(key => Math.round(value[key] / 32)) : null;
    return { kind: 'figure-boxes', value: JSON.stringify([slide.layout, list(slide.figureBoxes).map(box), list(slide.cards).map(card => box(card.box))]) };
  }
  return { kind: 'layout', value: slide.layout };
}

function similarStructure(a, b) {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind !== 'composition') return a.value === b.value;
  if (a.rows.length !== b.rows.length) return false;
  // Six percentage points absorb token ratio nudges without collapsing a
  // genuine 2:1 to 3:1 reallocation into an identical layout.
  return a.rows.every((row, index) => {
    const other = b.rows[index];
    return Math.abs(row.share - other.share) <= .06 && row.panels.length === other.panels.length && row.panels.every((panel, column) => panel.carrier === other.panels[column].carrier && Math.abs(panel.share - other.panels[column].share) <= .06);
  });
}

function reviewableReason(plan) {
  return hasText(plan?.repetitionReason) && [...plan.repetitionReason.replace(/\s/gu, '')].length >= 16;
}

function isTextPanel(panel) {
  return list(panel.cardIds).length > 0 && !list(panel.figureIds).length &&
    !panel.chart && !panel.plot && !panel.plotId && !panel.table && !panel.diagram;
}

/** Detect only an all-text, nominally equal-area arrangement, not all cards. */
function hasEqualTextPanels(slide) {
  const rows = list(slide.composition?.rows), panels = rows.flatMap(row => list(row.panels));
  if (panels.length < 3 || !panels.every(isTextPanel)) return false;
  const rowRatios = ratios(rows), areas = rows.flatMap((row, rowIndex) => ratios(list(row.panels)).map(ratio => ratio * rowRatios[rowIndex]));
  return areas.every(area => Math.abs(area - areas[0]) <= .04);
}

/**
 * Inspect schema-validated project records without changing them.
 * New design modes ask for concise visual plans; old projects stay compatible.
 */
export function designIssues(project) {
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
        const ids = list(slide.composition.rows).flatMap(row => list(row.panels).map(panel => panel.id));
        const known = new Set(ids), order = list(plan.readingOrder);
        if (!known.has(plan.primaryPanelId)) add('error', 'visual-plan-primary-panel', slide, 'visualPlan.primaryPanelId', '主证据面板必须指向本页 composition 中实际存在的面板 ID。');
        if (order.length !== ids.length || new Set(order).size !== order.length || order.some(id => !known.has(id))) {
          add('error', 'visual-plan-reading-order', slide, 'visualPlan.readingOrder', 'readingOrder 必须将本页所有 composition 面板 ID 恰好列出一次，不能遗漏、重复或引用其他页。');
        }
      }
    } else if (authoredModes.has(mode) && slide.composition) {
      add('warning', 'design-plan-missing', slide, 'visualPlan', '记录简短 visualPlan：本页关系、主证据面板、阅读顺序和选择理由；计划用于复核内容与构图是否对应，不是审美评分。');
    }

    if (faithful || nonBodyLayouts.has(slide.layout)) return;
    if (index >= 2 && similarStructure(structures[index], structures[index - 1]) && similarStructure(structures[index], structures[index - 2]) && !reviewableReason(plan)) {
      const action = slide.composition
        ? '有意保持可比性时简述 visualPlan.repetitionReason，否则按证据重排。'
        : '人工确认这些固定布局是否有助于直接比较；确有需要时保留，否则按证据重排。';
      add('warning', 'layout-repetition', slide, '', '连续三页使用相同或近似的主载体结构和空间比例。检查它们是否回答相同的比较任务；' + action + '换色、换边框、微调比例或添加空卡不构成新的信息组织。');
    }
    if (hasEqualTextPanels(slide)) {
      add('warning', 'equal-text-panels', slide, 'composition', '本页含至少三个等权纯文字面板。若它们确为平级且可比较的对象，可以保留；否则突出主证据、明确关系或合并重复说明。无需为消除提醒添加装饰图或虚构数据。');
    }
    if (hasText(plan?.repetitionReason) && !reviewableReason(plan)) add('warning', 'repetition-reason-thin', slide, 'visualPlan.repetitionReason', '重复构图的理由过短，尚不足以审阅。说明具体比较对象、需要保持一致的尺度或阅读位置；“保持统一”等泛称不能代替适配判断。');

    for (const panel of list(slide.composition?.rows).flatMap(row => list(row.panels))) {
      const ids = meaningfulCards(slide, panel);
      if (ids.length < 2 || list(panel.figureIds).length || panel.table || panel.chart || panel.plot || panel.plotId || panel.diagram) continue;
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
