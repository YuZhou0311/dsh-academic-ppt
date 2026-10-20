/**
 * Mechanical checks for authored visual decisions.
 *
 * A valid plan is a record of a choice, not proof of originality or good design.
 * Only broken references are errors. Repetition and text-heavy compositions are
 * review prompts: comparable evidence can legitimately use the same structure.
 * Scientific validity and final-slide legibility remain separate checks.
 */

const list = value => Array.isArray(value) ? value : [];
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const weightOf = value => Number.isFinite(value) && value > 0 ? value : 1;
const nonBodyLayouts = new Set(['cover', 'section', 'roadmap', 'paper', 'references', 'closing']);
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

/** Compare carriers and their allocation, never colours, titles or source IDs. */
function structureOf(slide) {
  if (nonBodyLayouts.has(slide.layout)) return null;
  if (slide.composition) {
    const rows = list(slide.composition.rows), rowRatios = ratios(rows);
    return JSON.stringify(['composition', rows.map((row, rowIndex) => {
      const panels = list(row.panels), columnRatios = ratios(panels);
      return [rowRatios[rowIndex], panels.map((panel, columnIndex) => [
        columnRatios[columnIndex], list(panel.figureIds).length,
        panel.chart ? slide.chart?.kind || 'chart' : null,
        plotKind(slide, panel), Boolean(panel.table),
        panel.diagram ? list(slide.diagram?.rows).map(nodes => list(nodes).length) : null,
        Boolean(panel.diagram), list(panel.cardIds).length,
      ])];
    })]);
  }
  if (slide.referenceTemplateId) return JSON.stringify(['reference', slide.referenceTemplateId]);
  if (slide.figureBoxes) {
    const box = value => value ? ['x', 'y', 'w', 'h'].map(key => Math.round(value[key] / 32)) : null;
    return JSON.stringify(['figure-boxes', slide.layout, list(slide.figureBoxes).map(box), list(slide.cards).map(card => box(card.box))]);
  }
  return JSON.stringify(['layout', slide.layout]);
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
  return areas.every(area => Math.abs(area - areas[0]) < 0.00001);
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
    if (index >= 2 && structures[index] !== null && structures[index] === structures[index - 1] && structures[index] === structures[index - 2] && !hasText(plan?.repetitionReason)) {
      const action = slide.composition
        ? '有意保持可比性时简述 visualPlan.repetitionReason，否则按证据重排。'
        : '人工确认这些固定布局是否有助于直接比较；确有需要时保留，否则按证据重排。';
      add('warning', 'layout-repetition', slide, '', '连续三页使用相同载体结构和空间比例。检查它们是否回答相同的比较任务；' + action + '换色或换边框不改变研究关系。');
    }
    if (hasEqualTextPanels(slide)) {
      add('warning', 'equal-text-panels', slide, 'composition', '本页含至少三个等权纯文字面板。若它们确为平级且可比较的对象，可以保留；否则突出主证据、明确关系或合并重复说明。无需为消除提醒添加装饰图或虚构数据。');
    }
  });
  return issues;
}
