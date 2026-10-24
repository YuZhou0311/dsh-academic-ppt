import { needsFreeComposition, renderFreeComposition } from './free-composition.mjs';
/**
 * Flow layout for authored academic panels on a 1280 × 720 canvas.
 *
 * The composition supplies structure, never evidence. Cards, images, numeric
 * charts, tables and mechanisms retain their existing slide/project identity.
 * Every reference is accounted for before geometry is allocated. Measurements
 * are conservative layout estimates; they are not a visual approval.
 *
 * Background frames deliberately do not register semantic content regions:
 * their enclosed native objects register their own regions with pageBuilder.
 */

import { measureCardSurface } from './card-surface.mjs';
import { measureScientificPlotMinimum } from './scientific-plot.mjs';
import { measureAcademicDiagramMinimum, automaticDiagramRows } from './academic-diagram.mjs';

const list = value => Array.isArray(value) ? value : [];
const textOf = value => value === undefined || value === null ? '' : String(value);
const hasText = value => textOf(value).trim().length > 0;
const positive = value => Number.isFinite(value) && value > 0;
const validBox = box => box && ['x', 'y', 'w', 'h'].every(key => Number.isFinite(box[key])) && box.w > 0 && box.h > 0;
const inside = (inner, outer, tolerance = 1) => validBox(inner) && inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance && inner.x + inner.w <= outer.x + outer.w + tolerance && inner.y + inner.h <= outer.y + outer.h + tolerance;
const intersects = (a, z) => Math.min(a.x + a.w, z.x + z.w) - Math.max(a.x, z.x) > 2 && Math.min(a.y + a.h, z.y + z.h) - Math.max(a.y, z.y) > 2;
const roles = new Set(['question', 'method', 'setting', 'result', 'boundary', 'hypothesis']);
const surfaces = new Set(['inherit', 'plain', 'rule', 'tint', 'band']);
const alignments = new Set(['stretch', 'start']);
const primaryKinds = ['chart', 'plot', 'table', 'diagram'];
const DEFAULT_CONTENT = Object.freeze({ x: 48, y: 136, w: 1184, h: 509 });
const GAPS = Object.freeze({ row: 18, column: 20, strip: 14, inner: 12, figure: 14, card: 14, padX: 14, padBottom: 12 });

/** Respect requested ratios while making measured minima hard constraints. */
function distribute(total, minima, weights) {
  const minimum = minima.reduce((sum, value) => sum + value, 0);
  if (minimum >= total) return minima.slice();
  const sizes = minima.map(() => 0), pending = new Set(minima.map((_, index) => index));
  let remainder = total;
  while (pending.size) {
    const weight = [...pending].reduce((sum, index) => sum + weights[index], 0);
    const constrained = [...pending].filter(index => remainder * weights[index] / weight < minima[index]);
    if (!constrained.length) {
      for (const index of pending) sizes[index] = remainder * weights[index] / weight;
      break;
    }
    for (const index of constrained) { sizes[index] = minima[index]; remainder -= minima[index]; pending.delete(index); }
  }
  return sizes;
}

function referenceLabel(project, id) {
  const index = list(project.papers).findIndex(paper => paper.id === id);
  return index < 0 ? textOf(id) : `[${index + 1}]`;
}

function sourceAsset(project, id) {
  return list(project.assets).find(asset => asset.id === id) || (!Array.isArray(project.assets) ? project.assets?.[id] : undefined);
}

function figureCaption(project, asset) {
  return textOf(asset?.displayCaption || [referenceLabel(project, asset?.paperId), asset?.figure || asset?.figureNumber, asset?.panel, asset?.caption].filter(Boolean).join(' · '));
}

/** Match the source-legend helper's wrapping; a legend is never guessed. */
function legendHeight(items, width, wrapText, measureTextWidth, size=22) {
  let height = 0, used = 0, rowHeight = 34, rowItems = 0;
  for (const item of list(items)) {
    const label = textOf(item.label), labelW = Math.max(1, Math.min(measureTextWidth(label, size) + 4, width - 33));
    const itemW = 33 + labelW, itemH = Math.max(34, wrapText(label, labelW, size).length * size * 1.2 + 4);
    if (rowItems && used + 24 + itemW > width) { height += rowHeight; used = 0; rowHeight = 34; rowItems = 0; }
    used += (rowItems ? 24 : 0) + itemW; rowHeight = Math.max(rowHeight, itemH); rowItems += 1;
  }
  return height + (rowItems ? rowHeight : 0);
}

function figureMetrics(project, id, width, ctx) {
  const asset = sourceAsset(project, id), caption = figureCaption(project, asset);
  const captionH = caption ? Math.max(ctx.captionSize * 1.45, ctx.lines(caption, width, ctx.captionSize) * ctx.captionSize * 1.24 + 4) : 0;
  const legend = legendHeight(asset?.displayLegend, width, ctx.wrapText, ctx.measureTextWidth, Math.max(22,ctx.design.projection?.labelMin??0));
  const pad = asset?.treatment === 'plain' ? 0 : 5;
  const visibleW = Number(asset?.width || asset?.pixelWidth || 1) * (asset?.viewport?.w ?? 1);
  const visibleH = Number(asset?.height || asset?.pixelHeight || 1) * (asset?.viewport?.h ?? 1);
  const dimensionsKnown = positive(visibleW) && positive(visibleH) && Boolean(asset?.width || asset?.pixelWidth);
  // These are layout floors, not a claim that a source image is readable.
  // If a reader measured the source labels, respect the renderer's 12px gate.
  const reading = asset?.reading, labelScale = reading?.purpose !== 'locator' && positive(reading?.minLabelPx) ? 12 / reading.minLabelPx : 0;
  const imageMinH = Math.max(reading?.purpose === 'locator' ? 72 : 96, dimensionsKnown ? visibleH * labelScale : 0);
  const minimumW = dimensionsKnown ? visibleW * labelScale + pad * 2 : 0;
  const furnitureH = captionH + (legend ? legend + 8 : 0) + 9 + pad * 2;
  return { id, asset, caption, captionH, legendH: legend, furnitureH, minimumH: furnitureH + imageMinH, minimumW, visibleW, visibleH, pad };
}

function figureCandidates(project, ids, width, ctx) {
  return ids.map((_, index) => index + 1).map(columns => {
    const slotW = (width - GAPS.figure * (columns - 1)) / columns;
    if (slotW <= 0) return null;
    const items = ids.map(id => figureMetrics(project, id, slotW, ctx));
    const rows = [];
    for (let from = 0; from < items.length; from += columns) {
      const members = items.slice(from, from + columns);
      rows.push({ members, minimumH: Math.max(...members.map(item => item.minimumH)) });
    }
    return { columns, slotW, rows, minimumH: rows.reduce((sum, row) => sum + row.minimumH, 0) + GAPS.figure * (rows.length - 1), widthFailures: items.filter(item => item.minimumW > slotW + 1) };
  }).filter(Boolean);
}

function figureSlots(candidate, area) {
  const heights = distribute(area.h - GAPS.figure * (candidate.rows.length - 1), candidate.rows.map(row => row.minimumH), candidate.rows.map(() => 1));
  let y = area.y;
  const placed = [];
  candidate.rows.forEach((row, rowIndex) => {
    const rowW = row.members.length * candidate.slotW + GAPS.figure * (row.members.length - 1);
    const x = area.x + (area.w - rowW) / 2;
    row.members.forEach((item, columnIndex) => placed.push({ item, box: { x: x + columnIndex * (candidate.slotW + GAPS.figure), y, w: candidate.slotW, h: heights[rowIndex] } }));
    y += heights[rowIndex] + GAPS.figure;
  });
  return placed;
}

function figureAreaScore(candidate, area) {
  return figureSlots(candidate, area).reduce((sum, { item, box }) => {
    const scale = Math.min(Math.max(1, box.w - item.pad * 2) / item.visibleW, Math.max(1, box.h - item.furnitureH) / item.visibleH);
    return sum + item.visibleW * item.visibleH * scale * scale;
  }, 0);
}

/** Exact compact/plain native-card flow, including authored metric qualifiers. */
function cardPlan(data, width, ctx) {
  const surface = measureCardSurface(data,width,{design:ctx.design,system:ctx.system,wrapText:ctx.wrapText,measureTextWidth:ctx.measureTextWidth});
  if(surface) {
    if(surface.metricWidth>surface.innerW+1)ctx.error('card-metric-width','卡片指标的数值与单位在内边距区域不能保持一行；扩大面板或重排指标。',{cardId:data.id,requiredWidth:Math.ceil(surface.metricWidth),availableWidth:surface.innerW});
    return {data,style:data.style||'compact',minimumH:surface.minimumH,surface:true};
  }
  const style = data.style === 'plain' ? 'plain' : 'compact';
  const titleH = ctx.lines(data.title, width, ctx.titleSize, true) * ctx.titleSize * 1.15;
  const bodyStart = (style === 'compact' ? 42 : 49) + Math.max(0, titleH - 34);
  const metric = data.metric && [data.metric.value, data.metric.unit].filter(value => value !== undefined && value !== '').join(' ');
  let metricH = 0;
  if (metric) {
    metricH += 38 * 1.16 + 4;
    if (data.metric.label) metricH += ctx.lines(data.metric.label, width, ctx.bodySize) * ctx.bodySize * 1.18 + 4;
    if (data.metric.context) metricH += ctx.lines(data.metric.context, width, ctx.bodySize) * ctx.bodySize * 1.2 + 8;
    if (ctx.lines(metric, width, 38, true) > 1) ctx.error('card-metric-width', `指标 ${data.id} 的数值与单位在当前列宽内不能保持一行；扩大面板或重排该指标，不能缩小指标字号。`, { cardId: data.id, requiredWidth: Math.ceil(ctx.measureTextWidth(metric, 38, { bold: true })), availableWidth: width });
  }
  const body = Array.isArray(data.body) ? data.body.join('\n') : textOf(data.body);
  const emphasized = list(data.emphasis).length > 0;
  const bodyH = body ? ctx.lines(body, Math.max(1, width - (emphasized ? ctx.bodySize * .22 : 0)), ctx.bodySize, emphasized) * ctx.bodySize * 1.24 : 0;
  return { data, style, minimumH: Math.max(titleH + 6, bodyStart + metricH + bodyH + 4) };
}

function tableHeight(data, width, ctx) {
  const columns = list(data?.columns), rows = list(data?.rows);
  if (!columns.length || rows.some(row => !Array.isArray(row) || row.length !== columns.length)) {
    ctx.error('table-shape', '表格必须有列名，且每一行必须保留相同的单元格数量。');
    return 44;
  }
  const suppliedWeights = data.columnWeights;
  const validWeights = !suppliedWeights || (Array.isArray(suppliedWeights) && suppliedWeights.length === columns.length && suppliedWeights.every(positive));
  if (!validWeights) ctx.error('table-column-weights', 'table.columnWeights 必须为与列数一一对应的正比例。');
  const weights = validWeights && suppliedWeights ? suppliedWeights : columns.map(() => 1), sum = weights.reduce((a, z) => a + z, 0);
  const widths = weights.map(weight => width * weight / sum), size = ctx.tableSize;
  const cellH = [columns, ...rows].map((row, index) => Math.max(...row.map((value, column) => ctx.lines(value, Math.max(1, widths[column] - 20 - size * .55), size, index === 0))) * size * 1.22 + 14);
  const captionH = data.caption ? ctx.lines(data.caption, width, ctx.captionSize) * ctx.captionSize * 1.24 + 7 : 0;
  return cellH.reduce((a, z) => a + z, 0) + captionH;
}

function diagramHeight(slide, width, ctx) {
  const nodes = list(slide.nodes), requestedRows = list(slide.diagram?.rows);
  if (requestedRows.length || ctx.design.projection && nodes.length && !nodes.some(n=>n.box)) {
    const planned=requestedRows.length?slide:{...slide,diagram:{rows:automaticDiagramRows(nodes)}};
    return measureAcademicDiagramMinimum(planned, width, { wrapText: ctx.wrapText, measureTextWidth: ctx.measureTextWidth, system: ctx.system, projection:ctx.design.projection }).minimumHeight;
  }
  const columns = Math.min(nodes.length, nodes.length === 4 ? 2 : 3);
  const rows = Array.from({ length: Math.ceil(nodes.length / Math.max(1, columns)) }, (_, index) => nodes.slice(index * columns, (index + 1) * columns));
  if (!nodes.length) return 96;
  const rowHeights = rows.map(row => {
    if (!row.length) return 0;
    const nodeW = (width - 55 * (row.length - 1)) / row.length, innerW = Math.max(1, nodeW - 24);
    return Math.max(...row.map(node => {
      const labelH = ctx.lines(node.label, innerW, ctx.bodySize, true) * ctx.bodySize * 1.16;
      const detailH = node.detail ? ctx.lines(node.detail, innerW, ctx.bodySize) * ctx.bodySize * 1.18 + 5 : 0;
      return Math.max(76, labelH + detailH + 20);
    }));
  });
  return rowHeights.reduce((a, z) => a + z, 0) + Math.max(0, rows.length - 1) * 46 + 28;
}

function chartSource(project, chart, ctx) {
  const claim = list(project.claims).find(item => item.id === chart.sourceClaimId);
  if (!claim) {
    ctx.error('chart-source', '数据图表的 sourceClaimId 必须指向项目中现有的证据记录。', { claimId: chart.sourceClaimId });
    return textOf(chart.sourceClaimId);
  }
  return [referenceLabel(project, claim.paperId), claim.locator].filter(Boolean).join(' · ');
}

function chartPlan(project, chart, width, ctx) {
  const categories = list(chart.categories), series = list(chart.series), horizontal = chart.kind === 'bar';
  const plotW = width - (horizontal ? 195 : 120);
  if (plotW < 96) ctx.error('chart-width', '数据图表需要为坐标、标签和绘图区保留独立空间；扩大图表所在面板。', { availableWidth: width, requiredWidth: horizontal ? 291 : 216 });
  const categoryW = horizontal ? 139 : plotW / Math.max(1, categories.length) - 6;
  if (categories.some(value => ctx.measureTextWidth(value, Math.max(21,ctx.design.projection?.labelMin??0)) > categoryW + 1)) ctx.error('chart-category-width', '图表的完整分类标签超过可用宽度；扩大面板、减少同页分类，或提供完整且简洁的分类标签。', { availableWidth: categoryW });
  const legendStep = Math.min(230, (width - 86) / Math.max(1, series.length));
  if (series.length > 1 && series.some(item => ctx.measureTextWidth(item.name, Math.max(19,ctx.design.projection?.labelMin??0)) + 24 > legendStep)) ctx.error('chart-legend-width', '图表系列图例的完整名称超过当前列宽；为图例和比较数据扩大图表面板。');
  if (ctx.measureTextWidth(chart.unit, Math.max(19,ctx.design.projection?.labelMin??0)) > width - 36) ctx.error('chart-unit-width', '图表单位超过可用宽度；扩大图表面板，保留完整单位。');
  const plotH = Math.max(96, horizontal ? categories.length * Math.max(28,ctx.design.projection?.labelMin??0, series.length * 18) : 96);
  const caption = chartSource(project, chart, ctx), captionH = caption ? Math.max(ctx.captionSize * 1.45, ctx.lines(caption, width, ctx.captionSize) * ctx.captionSize * 1.24 + 4) : 0;
  return { minimumH: plotH + 123 + (captionH ? captionH + 8 : 0), caption, captionH };
}

function scientificPlotPlan(data, width, ctx, panelId, plotId) {
  const details = { panelId, ...(plotId ? { plotId } : {}) };
  if (width < 380) ctx.error('plot-width', '科学统计图的面板正文宽度至少为380px；扩大面板或将统计图单独成行。', { ...details, availableWidth: width, requiredWidth: 380 });
  const measurement = measureScientificPlotMinimum(data, width, { fontFamily: ctx.fontFamily, wrapText: ctx.wrapText, measureTextWidth: ctx.measureTextWidth, system: ctx.system, projection:ctx.design.projection });
  for (const issue of list(measurement.issues)) ctx.recordIssue(issue, details);
  if (!positive(measurement.minimumHeight) && !list(measurement.issues).some(issue => issue.severity === 'error')) ctx.error('plot-measurement', '科学统计图无法在指定列宽保留完整标签、刻度、来源和所有观测；请扩大面板或拆页。', details);
  // An impossible width/density has already raised a blocking error. Keeping
  // its diagnostic slot is not a promise that the plot can be drawn there.
  return { kind: 'plot', data, ...(plotId ? { plotId } : {}), minimumH: Math.max(180, positive(measurement.minimumHeight) ? measurement.minimumHeight : 180) };
}

function freeFlowArea(body, explicit, gap) {
  const blocked = explicit.filter(card => validBox(card.data.box) && Math.min(card.data.box.x + card.data.box.w, body.x + body.w) - Math.max(card.data.box.x, body.x) > 0)
    .map(card => [Math.max(body.y, card.data.box.y - gap), Math.min(body.y + body.h, card.data.box.y + card.data.box.h + gap)])
    .filter(([start, end]) => end > start).sort((a, z) => a[0] - z[0]);
  const merged = [];
  for (const interval of blocked) {
    if (merged.length && interval[0] <= merged.at(-1)[1]) merged.at(-1)[1] = Math.max(merged.at(-1)[1], interval[1]);
    else merged.push(interval.slice());
  }
  let y = body.y;
  const free = [];
  for (const [start, end] of merged) { if (start > y) free.push({ ...body, y, h: start - y }); y = Math.max(y, end); }
  if (y < body.y + body.h) free.push({ ...body, y, h: body.y + body.h - y });
  return free.sort((a, z) => z.h - a.h || a.y - z.y)[0] || { ...body, h: 0 };
}

function renderPanelFrame(b, panel, box, ctx) {
  const key = panel.key, surface = panel.surface, heading = { x: box.x + GAPS.padX, y: box.y + 8, w: box.w - GAPS.padX * 2, h: panel.headingH - 16 };
  if (surface === 'band') {
    b.rect(`${key}/frame`, box, b.p.paper, b.p.line, { strokeWidth: 1.05, role: 'panel-frame', panelId: panel.id, semanticKind: panel.kind });
    b.rect(`${key}/band`, { x: box.x, y: box.y, w: box.w, h: panel.headingH }, b.p.accent, 'none', { role: 'panel-band' });
  } else if (surface === 'tint') {
    b.rect(`${key}/frame`, box, b.p.paper, b.p.line, { strokeWidth: 1.05, role: 'panel-frame', panelId: panel.id, semanticKind: panel.kind });
    b.rect(`${key}/heading-fill`, { x: box.x + 1, y: box.y + 1, w: box.w - 2, h: panel.headingH - 1 }, b.p.tint, 'none');
    b.line(`${key}/top-rule`, box.x, box.y, box.x + box.w, box.y, b.p.accent, { strokeWidth: 2.6 });
    b.line(`${key}/heading-rule`, box.x, box.y + panel.headingH, box.x + box.w, box.y + panel.headingH, b.p.line, { strokeWidth: 1 });
  } else if (surface === 'rule') {
    b.line(`${key}/top-rule`, box.x, box.y, box.x + box.w, box.y, b.p.accent, { strokeWidth: 2.6 });
    b.line(`${key}/heading-rule`, box.x, box.y + panel.headingH, box.x + box.w, box.y + panel.headingH, b.p.line, { strokeWidth: 1 });
    b.line(`${key}/bottom-rule`, box.x, box.y + box.h, box.x + box.w, box.y + box.h, b.p.line, { strokeWidth: 1 });
  }
  // A plain panel is still a named semantic group. It loses only decorative
  // furniture, never its heading, evidence, source text or measured padding.
  b.text(`${key}/title`, panel.title, heading, ctx.titleSize, { bold: true, color: surface === 'band' ? '#FFFFFF' : surface === 'plain' ? b.p.ink : b.p.accent, lineHeight: 1.15, role: 'panel-title', panelId: panel.id, semanticKind: panel.kind });
  b.region(`${key}/heading`, heading, 'panel-heading');
}

function renderArtifact(b, project, slide, panel, area, ctx) {
  const artifact = panel.artifact;
  if (!artifact) return area.y;
  if (artifact.kind === 'figure') {
    const candidates = artifact.candidates.filter(candidate => !candidate.widthFailures.length && candidate.minimumH <= area.h + 1);
    const fallback = artifact.candidates.slice().sort((a, z) => a.widthFailures.length - z.widthFailures.length || a.minimumH - z.minimumH)[0];
    const chosen = candidates.sort((a, z) => figureAreaScore(z, area) - figureAreaScore(a, area) || a.rows.length - z.rows.length)[0] || fallback;
    for (const { item, box } of figureSlots(chosen, area)) ctx.figure(b, project, item.id, box, `${panel.key}/figure/${item.id}`);
  } else if (artifact.kind === 'chart') {
    const box = { ...area, h: area.h - (artifact.captionH ? artifact.captionH + 8 : 0) };
    b.add('chart', 'data-chart', { ...box, chart: ctx.clone(slide.chart), palette: ctx.clone(b.p), fontFamily: ctx.fontFamily, panelId: panel.id });
    if (artifact.caption) b.text('chart-caption', artifact.caption, { x: area.x, y: box.y + box.h + 8, w: area.w, h: artifact.captionH }, ctx.captionSize, { color: b.p.muted, lineHeight: 1.24, role: 'caption' });
  } else if (artifact.kind === 'plot') {
    if (typeof ctx.plot !== 'function') ctx.error('plot-renderer', '科学统计图已被分配，但当前构建未提供 plot 渲染器。', { panelId: panel.id });
    else ctx.plot(b, artifact.data, area, { fontFamily: ctx.fontFamily, wrapText: ctx.wrapText, measureTextWidth: ctx.measureTextWidth });
  } else if (artifact.kind === 'table') {
    const result = ctx.table(b, slide.table, area, ctx.fontFamily);
    if (positive(result?.height)) {
      if (result.height > area.h + 2) ctx.error('table-measurement-overflow', '表格实际排版高于已保留空间；调整行列和说明的分配后重新构建。', { panelId: panel.id, requiredHeight: result.height, availableHeight: area.h });
      return result.bottom ?? area.y + result.height;
    }
  } else if (artifact.kind === 'diagram') ctx.diagram(b, project, slide, area);
  return area.y + area.h;
}

function renderPanel(b, project, slide, panel, box, ctx) {
  renderPanelFrame(b, panel, box, ctx);
  const body = { x: box.x + GAPS.padX, y: box.y + panel.headingH + GAPS.inner, w: box.w - GAPS.padX * 2, h: Math.max(1, box.h - panel.headingH - GAPS.inner - GAPS.padBottom) };
  const explicit = panel.cards.filter(card => card.data.box), automatic = panel.cards.filter(card => !card.data.box);
  for (let index = 0; index < explicit.length; index += 1) {
    const item = explicit[index], authoredBox = item.data.box;
    if (!validBox(authoredBox)) ctx.error('card-box', '显式卡片区域必须包含有限坐标和正尺寸。', { panelId: panel.id, cardId: item.data.id });
    else {
      if (!inside(authoredBox, body)) ctx.error('card-outside-panel', '显式卡片区域超出所属面板正文；调整 box 或改用自动流式排版。', { panelId: panel.id, cardId: item.data.id });
      const needed = cardPlan(item.data, authoredBox.w, ctx).minimumH;
      if (needed > authoredBox.h + 2) ctx.error('card-box-overflow', '显式卡片高度不足以保留其完整文字、指标和限定条件。', { panelId: panel.id, cardId: item.data.id, requiredHeight: Math.ceil(needed), availableHeight: authoredBox.h });
      for (const other of explicit.slice(index + 1)) if (validBox(other.data.box) && intersects(authoredBox, other.data.box)) ctx.error('card-box-overlap', '同一面板中的显式卡片区域相撞。', { panelId: panel.id, cardId: item.data.id, relatedCardId: other.data.id });
    }
  }
  const flow = freeFlowArea(body, explicit, GAPS.inner), cardH = automatic.reduce((sum, card) => sum + card.minimumH, 0) + Math.max(0, automatic.length - 1) * GAPS.card;
  const artifactH = panel.artifact?.minimumH || 0, between = artifactH && automatic.length ? GAPS.inner : 0, required = artifactH + between + cardH;
  if (required > flow.h + 2) ctx.error('panel-overflow', '面板在保留标题、完整证据、图注和说明后高度不足；调整行权重、面板分组或拆页。', { panelId: panel.id, requiredHeight: Math.ceil(required), availableHeight: Math.floor(flow.h) });
  const usableH = Math.max(required, flow.h);
  const mediaH = panel.artifact ? (panel.artifact.kind === 'table' ? artifactH : Math.max(artifactH, usableH - between - cardH)) : 0;
  let y = panel.artifact ? renderArtifact(b, project, slide, panel, { x: body.x, y: flow.y, w: body.w, h: mediaH }, ctx) + between : flow.y;
  const remaining = Math.max(cardH, flow.y + usableH - y), heights = distribute(remaining - Math.max(0, automatic.length - 1) * GAPS.card, automatic.map(card => card.minimumH), automatic.map(() => 1));
  const drawCard = (item, cardBox) => {
    const data = { ...ctx.clone(item.data), style: item.style };
    if (data.templateComponentId) {
      ctx.error('card-template-component', 'composition 面板使用原生流式文字，不能同时应用带独立文字区的 templateComponentId；移除此字段或改用模板组件布局。', { panelId: panel.id, cardId: data.id });
      delete data.templateComponentId;
    }
    ctx.card(b, data, cardBox, item.index, project, item.style);
  };
  automatic.forEach((item, index) => { drawCard(item, { x: body.x, y, w: body.w, h: heights[index] }); y += heights[index] + GAPS.card; });
  for (const item of explicit) drawCard(item, validBox(item.data.box) ? ctx.clone(item.data.box) : { x: body.x, y: body.y, w: body.w, h: item.minimumH });
}

function strips(slide, composition, width, ctx) {
  const lead = [];
  for (const [key, value] of [['composition/lead', composition.lead], ['subtitle', slide.subtitle]]) if (hasText(value) && !lead.some(item => item.text === value)) lead.push({ key, text: textOf(value) });
  const leadH = lead.length ? lead.reduce((sum, item) => sum + ctx.lines(item.text, width - 36, ctx.bodySize) * ctx.bodySize * 1.24, 0) + Math.max(0, lead.length - 1) * 7 + 20 : 0;
  const conclusion = composition.conclusion, texts = [];
  if (conclusion && (!hasText(conclusion.label) || !hasText(conclusion.text))) ctx.error('conclusion-content', 'composition.conclusion 必须同时保留非空 label 和 text。');
  for (const [key, value] of [['composition/conclusion/text', conclusion?.text], ['takeaway', slide.takeaway]]) if (hasText(value) && !texts.some(item => item.text === value)) texts.push({ key, text: textOf(value) });
  const label = textOf(conclusion?.label), labelW = label ? Math.min(width * .26, Math.max(88, ctx.measureTextWidth(label, ctx.titleSize, { bold: true }) + 30)) : 0;
  const conclusionTextW = Math.max(1, width - labelW - 32), textH = texts.reduce((sum, item) => sum + ctx.lines(item.text, conclusionTextW, ctx.bodySize, true) * ctx.bodySize * 1.24, 0) + Math.max(0, texts.length - 1) * 7;
  const labelH = label ? ctx.lines(label, Math.max(1, labelW - 24), ctx.titleSize, true) * ctx.titleSize * 1.15 : 0;
  const conclusionH = texts.length || label ? Math.max(textH, labelH) + 22 : 0;
  return { lead, leadH, conclusion: { texts, label, labelW, labelH, textW: conclusionTextW, height: conclusionH } };
}

function renderLead(b, items, area, ctx) {
  b.rect('composition/lead/frame', area, b.p.tint, b.p.line, { strokeWidth: .9, role: 'lead-strip' });
  b.rect('composition/lead/mark', { x: area.x, y: area.y, w: 5, h: area.h }, b.p.accent, 'none');
  let y = area.y + 10;
  for (const item of items) {
    const h = ctx.lines(item.text, area.w - 36, ctx.bodySize) * ctx.bodySize * 1.24;
    b.text(item.key, item.text, { x: area.x + 18, y, w: area.w - 36, h }, ctx.bodySize, { color: b.p.ink, lineHeight: 1.24, role: item.key === 'subtitle' ? 'subtitle' : 'composition-lead' });
    y += h + 7;
  }
  b.region('composition/lead', area, 'lead');
}

function renderConclusion(b, data, area, ctx) {
  b.rect('composition/conclusion/frame', area, b.p.tint, b.p.line, { strokeWidth: 1, role: 'conclusion-strip' });
  if (data.label) {
    b.rect('composition/conclusion/label-fill', { x: area.x, y: area.y, w: data.labelW, h: area.h }, b.p.accent, 'none');
    b.text('composition/conclusion/label', data.label, { x: area.x + 12, y: area.y + (area.h - data.labelH) / 2, w: data.labelW - 24, h: data.labelH }, ctx.titleSize, { color: '#FFFFFF', bold: true, align: 'center', lineHeight: 1.15, role: 'conclusion-label' });
  } else b.rect('composition/conclusion/mark', { x: area.x, y: area.y, w: 5, h: area.h }, b.p.accent, 'none');
  let y = area.y + 11;
  for (const item of data.texts) {
    const h = ctx.lines(item.text, data.textW, ctx.bodySize, true) * ctx.bodySize * 1.24;
    b.text(item.key, item.text, { x: area.x + data.labelW + 16, y, w: data.textW, h }, ctx.bodySize, { color: b.p.accent, bold: true, lineHeight: 1.24, role: 'takeaway' });
    y += h + 7;
  }
  b.region('composition/conclusion', area, 'conclusion');
}

/**
 * Render explicit semantic rows/panels using the same native helpers as legacy
 * slides. All coordinates are derived from ratios and measured text; card.box
 * is the one supported authored geometry override. The input is never mutated.
 */
export function renderAcademicComposition(b, project, slide, helpers) {
  if(needsFreeComposition(slide.composition))return renderFreeComposition(b,project,slide,helpers);
  const { card, figure, table, diagram, plot, wrapText, measureTextWidth, clone = value => structuredClone(value), design = b.design || project.design || {}, contentBox = DEFAULT_CONTENT } = helpers || {};
  if (![card, figure, table, diagram, wrapText, measureTextWidth].every(value => typeof value === 'function')) throw new TypeError('ACADEMIC_COMPOSITION_HELPERS: card, figure, table, diagram, wrapText and measureTextWidth are required');
  b.page.issues ||= [];
  const error = (code, message, details = {}) => b.page.issues.push({ severity: 'error', code: `composition-${code}`, slideId: b.page.id, ...details, message });
  const composition = slide.composition;
  if (!composition || typeof composition !== 'object' || !validBox(contentBox)) { error('structure', 'composition 必须是有效对象，且正文区域必须有有限坐标和正尺寸。'); return; }
  const system = b.system || design.system || {}, bodySize = system.bodySize ?? 24, titleSize = system.panelTitleSize ?? 26, captionSize = Math.max(system.captionSize ?? 18,design.projection?.noteMin??0);
  if (![bodySize, titleSize, captionSize].every(positive) || bodySize < 22 || titleSize < 24 || captionSize < 16) { error('typography', '学术面板须使用公共设计契约中的字号：正文至少22px、标题至少24px、来源图注至少16px；布局不会自行缩小字号容纳内容。'); return; }
  const panelStyle = system.panel || 'band';
  if (!['band', 'tint', 'line'].includes(panelStyle)) { error('panel-style', 'design.system.panel 必须是 band、tint 或 line。'); return; }
  const academicTables = b.design?.hasAcademicSystem ?? Boolean(project.design?.system || design.system);
  const ctx = { design, card, figure, table, diagram, plot, wrapText, measureTextWidth, clone, error, system, bodySize, titleSize, captionSize, panelStyle, tableSize: Math.max(academicTables ? bodySize : 23,design.projection?.labelMin??0), fontFamily: design.fontFamily || 'Noto Sans CJK SC', recordIssue: (issue, details = {}) => b.page.issues.push({ ...issue, slideId: b.page.id, ...details }), lines: (value, width, size, bold = false) => wrapText(textOf(value), Math.max(1, width), size, { bold }).length };
  const unknown = (value, allowed, name) => { for (const key of Object.keys(value || {})) if (!allowed.includes(key)) error('unsupported-field', `${name}.${key} 没有可见排版规则；移除此字段或使用明确支持的内容字段。`, { field: `${name}.${key}` }); };
  unknown(composition, ['lead', 'rows', 'conclusion'], 'composition');
  if (composition.conclusion) unknown(composition.conclusion, ['label', 'text'], 'composition.conclusion');
  const rows = list(composition.rows);
  if (!rows.length || rows.length > 3 || rows.some(row => !Array.isArray(row?.panels) || !row.panels.length || row.panels.length > 4) || rows.reduce((sum, row) => sum + row.panels.length, 0) > 8) { error('structure', 'composition 需要1–3行、每行1–4个面板，全页最多8个面板；超出时应拆页。'); return; }
  if (list(slide.figureBoxes).length) error('figure-boxes', 'composition 依据行列与比例安排原图，不能同时使用 slide.figureBoxes；需要手工图框时使用现有自定义图页。');
  if (list(slide.panelTitles).length) error('legacy-panel-titles', 'composition 的完整标题来自每个 panel.title；请将 panelTitles 中的内容明确合并到相应面板标题。');
  const cardMap = new Map(list(slide.cards).map((data, index) => [data.id, { data, index }])), figureIds = new Set(list(slide.figureIds)), plotMap = new Map(list(slide.plots).map(data => [data.id, data]));
  if (cardMap.size !== list(slide.cards).length) error('duplicate-card-id', '本页存在重复 card.id，无法唯一分配正文。');
  if (figureIds.size !== list(slide.figureIds).length) error('duplicate-slide-figure', 'slide.figureIds 包含重复原图身份；每项证据须有唯一面板归属。');
  if (plotMap.size !== list(slide.plots).length) error('duplicate-plot-id', 'slide.plots 中的每个统计图必须具有唯一 id。');
  const usedCards = new Set(), usedFigures = new Set(), usedPlots = new Set(), usedPrimary = new Set(), panelIds = new Set();
  const prepared = rows.map((row, rowIndex) => {
    unknown(row, ['weight', 'panels'], `composition.rows[${rowIndex}]`);
    if (row.weight !== undefined && !positive(row.weight)) error('row-weight', '行权重必须是有限正数。', { rowIndex });
    const weights = row.panels.map(panel => positive(panel?.weight) ? panel.weight : 1), totalWeight = weights.reduce((a, z) => a + z, 0), availableW = contentBox.w - GAPS.column * (row.panels.length - 1);
    let x = contentBox.x;
    const panels = row.panels.map((rawPanel, columnIndex) => {
      const panel = rawPanel && typeof rawPanel === 'object' && !Array.isArray(rawPanel) ? rawPanel : {};
      if (panel !== rawPanel) error('panel-structure', '每个面板必须是包含 id、title 和内容引用的对象。', { rowIndex, columnIndex });
      unknown(panel, ['id', 'title', 'kind', 'weight', 'surface', 'align', 'figureIds', 'cardIds', 'plotId', ...primaryKinds], `composition.rows[${rowIndex}].panels[${columnIndex}]`);
      const id = textOf(panel.id || `row-${rowIndex + 1}-panel-${columnIndex + 1}`), duplicate = panelIds.has(id);
      if (!hasText(panel.id)) error('panel-id', '每个学术面板必须具有稳定且非空的 id。', { rowIndex, columnIndex });
      if (duplicate) error('duplicate-panel-id', '面板 id 在同一页中必须唯一。', { panelId: id });
      panelIds.add(id);
      if (!hasText(panel.title)) error('panel-title', '每个面板必须保留非空的语义标题。', { panelId: id });
      if (panel.kind !== undefined && !roles.has(panel.kind)) error('panel-kind', '面板 kind 必须是已有的学术语义角色。', { panelId: id });
      if (panel.weight !== undefined && !positive(panel.weight)) error('panel-weight', '面板权重必须是有限正数。', { panelId: id });
      if (panel.surface !== undefined && !surfaces.has(panel.surface)) error('panel-surface', '面板 surface 必须是 inherit、plain、rule、tint 或 band；未指定时继承全稿分组样式。', { panelId: id });
      if (panel.align !== undefined && !alignments.has(panel.align)) error('panel-align', '面板 align 必须是 stretch 或 start；start 依据完整内容的测量高度顶对齐。', { panelId: id });
      const surface = surfaces.has(panel.surface) && panel.surface !== 'inherit' ? panel.surface : panelStyle === 'line' ? 'rule' : panelStyle;
      const align = panel.align === 'start' ? 'start' : 'stretch';
      for (const field of ['cardIds', 'figureIds']) if (panel[field] !== undefined && !Array.isArray(panel[field])) error('reference-list', '面板的 cardIds 与 figureIds 必须是已有内容身份的数组。', { panelId: id, field });
      for (const field of primaryKinds) if (panel[field] !== undefined && typeof panel[field] !== 'boolean') error('primary-flag', '面板 chart、plot、table、diagram 字段必须是布尔值。', { panelId: id, field });
      if (panel.plotId !== undefined && (typeof panel.plotId !== 'string' || !hasText(panel.plotId))) error('plot-reference', 'panel.plotId 必须是 slide.plots 中某个统计图的非空 id。', { panelId: id, plotId: panel.plotId });
      const w = availableW * weights[columnIndex] / totalWeight, innerW = w - GAPS.padX * 2;
      if (innerW < Math.max(bodySize, titleSize) * 2) error('panel-width', '面板过窄，无法以既定字号呈现研究内容；调整列权重或减少同一行面板。', { panelId: id, availableWidth: innerW });
      const key = `composition/panel/${id}${duplicate ? `/duplicate-${rowIndex}-${columnIndex}` : ''}`, title = textOf(panel.title), headingH = Math.max(46, ctx.lines(title, innerW, titleSize, true) * titleSize * 1.15 + 16);
      const selectedCards = [];
      for (const cardId of list(panel.cardIds)) {
        if (!cardMap.has(cardId)) { error('missing-card', '面板引用的 cardId 必须来自本页现有 cards。', { panelId: id, cardId }); continue; }
        if (usedCards.has(cardId)) { error('duplicate-card-reference', '同一卡片不能分配给多个面板或在面板中重复出现。', { panelId: id, cardId }); continue; }
        usedCards.add(cardId);
        const record = cardMap.get(cardId), item = cardPlan(record.data, record.data.box?.w || Math.max(1, innerW), ctx);
        if (!item.surface && record.data.style !== undefined && !['plain', 'compact'].includes(record.data.style)) error('card-style', 'composition 面板的解释文字仅支持 plain 或 compact；其他 card.style 具有独立装饰与文字区，不能静默替换。分组样式由 panel.surface 或 design.system.panel 控制。', { panelId: id, cardId, requestedStyle: record.data.style });
        selectedCards.push({ ...item, index: record.index });
      }
      const selectedFigures = [];
      for (const assetId of list(panel.figureIds)) {
        if (!figureIds.has(assetId)) { error('missing-figure-reference', '面板 figureIds 必须来自本页 slide.figureIds。', { panelId: id, assetId }); continue; }
        if (usedFigures.has(assetId)) { error('duplicate-figure-reference', '同一原图不能在多个面板重复分配；比较独立面板时应提供各自核对后的资产身份。', { panelId: id, assetId }); continue; }
        usedFigures.add(assetId); selectedFigures.push(assetId);
        if (!sourceAsset(project, assetId)) error('missing-figure-asset', '本页引用的原图资产不存在。', { panelId: id, assetId });
      }
      const requested = [...(list(panel.figureIds).length ? ['figure'] : []), ...primaryKinds.filter(kind => panel[kind] === true), ...(panel.plotId !== undefined ? ['plot-id'] : [])];
      if (requested.length > 1) error('multiple-primary-artifacts', '每个面板只容纳一项主要证据：figureIds、chart、plot、plotId、table 或 diagram；plot 与 plotId 也不能同时指定。', { panelId: id, artifacts: requested });
      let artifact;
      const kind = requested[0];
      if (kind === 'figure' && selectedFigures.length) {
        const candidates = figureCandidates(project, selectedFigures, Math.max(1, innerW), ctx), viable = candidates.filter(candidate => !candidate.widthFailures.length);
        if (!viable.length) error('figure-label-width', '原图关键标签按已声明的像素高度无法在本面板列宽内达到预检底线；扩大证据面板或提供核对后的独立原图面板。', { panelId: id, assetIds: selectedFigures });
        artifact = { kind, candidates, minimumH: Math.min(...(viable.length ? viable : candidates).map(candidate => candidate.minimumH)) };
      } else if (kind === 'plot-id') {
        const data = plotMap.get(panel.plotId);
        if (!data) error('missing-plot', 'panel.plotId 必须引用本页 slide.plots 中现有的统计图。', { panelId: id, plotId: panel.plotId });
        else if (usedPlots.has(panel.plotId)) error('duplicate-plot-reference', '同一统计图 id 不能分配给多个面板。', { panelId: id, plotId: panel.plotId });
        else {
          usedPlots.add(panel.plotId);
          artifact = scientificPlotPlan(data, Math.max(1, innerW), ctx, id, panel.plotId);
        }
      } else if (kind && kind !== 'figure') {
        const exists = kind === 'diagram' ? list(slide.nodes).length > 0 : Boolean(slide[kind]);
        if (!exists) error('missing-primary-artifact', `面板指定了 ${kind}，但本页没有对应的完整内容。`, { panelId: id, artifact: kind });
        else if (usedPrimary.has(kind)) error('duplicate-primary-artifact', `本页的 ${kind} 只能归属一个面板。`, { panelId: id, artifact: kind });
        else {
          usedPrimary.add(kind);
          if (kind === 'chart') artifact = { kind, ...chartPlan(project, slide.chart, Math.max(1, innerW), ctx) };
          else if (kind === 'table') artifact = { kind, minimumH: tableHeight(slide.table, Math.max(1, innerW), ctx) };
          else if (kind === 'diagram') artifact = { kind, minimumH: diagramHeight(slide, Math.max(1, innerW), ctx) };
          else artifact = scientificPlotPlan(slide.plot, Math.max(1, innerW), ctx, id);
        }
      }
      if (!selectedCards.length && !artifact) error('empty-panel', '面板必须引用现有文字、原图或可编辑科学对象，不能用空框代替论证。', { panelId: id });
      // Absolute card/node geometry is a separate authoring contract: do not
      // quietly move or clip it when a panel asks for content-sized height.
      const hasExplicitCards = selectedCards.some(item => item.data.box !== undefined);
      const hasExplicitNodes = artifact?.kind === 'diagram' && list(slide.nodes).some(node => node.box !== undefined);
      const hasExplicitGeometry = hasExplicitCards || hasExplicitNodes;
      if (align === 'start' && hasExplicitGeometry) error('panel-align-box-conflict', 'align:start 使用内容自动测量，不能同时固定 card.box 或 node.box；移除显式 box 或使用 align:stretch，保留原有坐标。', { panelId: id });
      const explicitCards = selectedCards.filter(item => validBox(item.data.box)), flowCards = selectedCards.filter(item => !validBox(item.data.box));
      const explicitSpan = explicitCards.length ? Math.max(...explicitCards.map(item => item.data.box.y + item.data.box.h)) - Math.min(...explicitCards.map(item => item.data.box.y)) : 0;
      const cardsH = flowCards.reduce((sum, item) => sum + item.minimumH, 0) + Math.max(0, flowCards.length - 1) * GAPS.card + explicitSpan + (explicitSpan && flowCards.length ? GAPS.inner : 0);
      const minimumH = headingH + GAPS.inner + GAPS.padBottom + (artifact?.minimumH || 0) + (artifact && selectedCards.length ? GAPS.inner : 0) + cardsH;
      const result = { id, key, title, kind: panel.kind, surface, align: hasExplicitGeometry ? 'stretch' : align, x, w, headingH, cards: selectedCards, artifact, minimumH };
      x += w + GAPS.column;
      return result;
    });
    // A wrapped heading changes the whole row's header baseline. Comparative
    // figures and matrices then begin on the same line in adjacent panels.
    const headingH = Math.max(...panels.map(panel => panel.headingH));
    for (const panel of panels) { panel.minimumH += headingH - panel.headingH; panel.headingH = headingH; }
    return { panels, weight: positive(row.weight) ? row.weight : 1, minimumH: Math.max(...panels.map(panel => panel.minimumH)) };
  });
  for (const cardId of cardMap.keys()) if (!usedCards.has(cardId)) error('unassigned-card', '本页卡片尚未归属任何 composition 面板。', { cardId });
  for (const assetId of figureIds) if (!usedFigures.has(assetId)) error('unassigned-figure', '本页原图尚未归属任何 composition 面板。', { assetId });
  for (const plotId of plotMap.keys()) if (!usedPlots.has(plotId)) error('unassigned-plot', '本页统计图尚未归属任何 composition 面板；每个 plots.id 必须恰好引用一次。', { plotId });
  for (const kind of primaryKinds) if ((kind === 'diagram' ? list(slide.nodes).length || list(slide.edges).length || slide.diagram : slide[kind]) && !usedPrimary.has(kind)) error('unassigned-primary-artifact', `本页 ${kind} 尚未归属任何 composition 面板。`, { artifact: kind });
  const bands = strips(slide, composition, contentBox.w, ctx), stripGaps = (bands.leadH ? GAPS.strip : 0) + (bands.conclusion.height ? GAPS.strip : 0), availableRowsH = contentBox.h - bands.leadH - bands.conclusion.height - stripGaps - GAPS.row * (prepared.length - 1);
  const rowMinimum = prepared.reduce((sum, row) => sum + row.minimumH, 0);
  if (rowMinimum > availableRowsH + 2) error('page-overflow', '保留全部面板标题、正文、证据与来源后，整页超过正文区；调整内容分组、行列权重或拆页，不缩小字号也不截断文字。', { requiredHeight: Math.ceil(contentBox.h - availableRowsH + rowMinimum), availableHeight: contentBox.h });
  const rowHeights = distribute(availableRowsH, prepared.map(row => row.minimumH), prepared.map(row => row.weight));
  let y = contentBox.y;
  if (bands.leadH) { renderLead(b, bands.lead, { x: contentBox.x, y, w: contentBox.w, h: bands.leadH }, ctx); y += bands.leadH + GAPS.strip; }
  prepared.forEach((row, rowIndex) => {
    for (const panel of row.panels) renderPanel(b, project, slide, panel, { x: panel.x, y, w: panel.w, h: panel.align === 'start' ? panel.minimumH : rowHeights[rowIndex] }, ctx);
    y += rowHeights[rowIndex] + (rowIndex < prepared.length - 1 ? GAPS.row : 0);
  });
  if (bands.conclusion.height) { y += GAPS.strip; renderConclusion(b, bands.conclusion, { x: contentBox.x, y, w: contentBox.w, h: bands.conclusion.height }, ctx); }
}
