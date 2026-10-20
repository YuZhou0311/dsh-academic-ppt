/** Editable scientific plots in CSS px. Every observation, estimate and bound
 * is supplied by the caller. This module never estimates intervals, joins
 * independent observations, changes observations or infers scientific claims.
 */
const PREFIX = 'data-plot';
const MIN_FONT = 18;
const POINT_RADIUS = 3.5;
const POINT_GAP = 1;
const MAX_POINT_OFFSET = 24;
const POINT_ROW_PADDING = 2;
const LINE_HEIGHT = 1.2;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const color = (value, fallback) => /^#[a-f\d]{6}$/i.test(String(value)) ? value : fallback;
const numericText = value => String(Object.is(value, -0) ? 0 : value).replace(/^-/, '−');
// The domain already removes arithmetic noise. A second fixed-precision
// rounding here could turn distinct ticks near a large baseline into one label.
const axisText = value => numericText(value);
const cleanAxisNumber = value => Number(value.toPrecision(14));

function failure(b, code, message, details = {}) {
  b.page.issues.push({
    severity: 'error', code, slideId: b.page.id,
    objectId: `${b.page.id}/${PREFIX}`, message, ...details,
  });
  return { failed: true, height: 0 };
}

function validate(data, box) {
  if (!box || !['x', 'y', 'w', 'h'].every(key => finite(box[key])) || box.w <= 0 || box.h <= 0)
    return ['plot-invalid-box', '科学图需要有限坐标和正的绘图区宽高。'];
  if (!data || !['distribution', 'interval'].includes(data.kind))
    return ['plot-invalid-kind', '科学图 kind 必须为 distribution 或 interval。'];
  if (!nonempty(data.unit)) return ['plot-unit-missing', '科学图必须显式提供数值单位，不能省略量纲。'];
  if (!Array.isArray(data.sourceClaimIds) || !data.sourceClaimIds.length || data.sourceClaimIds.some(id => !nonempty(id)))
    return ['plot-source-missing', '科学图 sourceClaimIds 必须关联实际数据或区间的来源。'];
  if (data.caption !== undefined && typeof data.caption !== 'string')
    return ['plot-invalid-caption', '科学图 caption 必须为字符串。'];
  if (data.reference !== undefined && !finite(data.reference))
    return ['plot-invalid-reference', '参考值必须是有限数值。'];
  if (!Array.isArray(data.groups) || data.groups.length < 1 || data.groups.length > 8)
    return ['plot-invalid-groups', '科学图需要 1–8 个显式数据组。'];
  for (const [index, group] of data.groups.entries()) {
    if (!group || !nonempty(group.label)) return ['plot-group-label-missing', `第 ${index + 1} 组缺少完整组名。`];
    if (data.kind === 'distribution') {
      if (!Array.isArray(group.values) || group.values.length < 1 || group.values.length > 100 || group.values.some(value => !finite(value)))
        return ['plot-invalid-observations', `第 ${index + 1} 组必须显式提供 1–100 个有限观测值；不能省略、抽样或用估计值代替。`];
      if (['estimate', 'lower', 'upper'].some(key => group[key] !== undefined))
        return ['plot-mixed-data-kind', 'distribution 只显示显式观测值；估计和区间应使用独立的 interval 图。'];
    } else {
      if (!['estimate', 'lower', 'upper'].every(key => finite(group[key])))
        return ['plot-invalid-interval', `第 ${index + 1} 组必须显式提供有限的 estimate、lower、upper，绘图不会计算区间。`];
      if (group.lower > group.estimate || group.estimate > group.upper)
        return ['plot-invalid-interval', `第 ${index + 1} 组不满足 lower ≤ estimate ≤ upper；请核对原始区间，不能自动排序或修正。`];
      if (group.values !== undefined)
        return ['plot-mixed-data-kind', 'interval 只显示输入的估计与区间；原始观测值应使用独立的 distribution 图。'];
    }
  }
  return null;
}

/** A padded, nice domain. Rounding applies only to the axis, never to data. */
function niceDomain(values, targetIntervals) {
  let lo = Math.min(...values), hi = Math.max(...values);
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * .1;
    lo -= pad; hi += pad;
  } else {
    const pad = (hi - lo) * .04;
    lo -= pad; hi += pad;
  }
  const span = hi - lo;
  if (![lo, hi, span].every(Number.isFinite) || span <= 0) return null;
  const rough = span / targetIntervals, power = 10 ** Math.floor(Math.log10(rough));
  if (!finite(power) || power <= 0) return null;
  const fraction = rough / power;
  const factor = [1, 2, 2.5, 5, 10].find(item => item >= fraction - 1e-12) || 10;
  const step = cleanAxisNumber(factor * power);
  const min = cleanAxisNumber(Math.floor(lo / step) * step);
  const max = cleanAxisNumber(Math.ceil(hi / step) * step);
  if (![min, max, step, max - min].every(Number.isFinite) || max <= min || step <= 0) return null;
  const count = Math.round((max - min) / step), ticks = [];
  if (count > 20) return null;
  for (let index = 0; index <= count; index++) ticks.push(cleanAxisNumber(min + step * index));
  return { min, max, step, ticks };
}

function fitAxis(values, plotBox, fontSize, measureTextWidth, fontFamily) {
  const maxIntervals = Math.min(6, Math.max(2, Math.floor(plotBox.w / (fontSize * 3.6))));
  for (let desired = maxIntervals; desired >= 1; desired--) {
    const domain = niceDomain(values, desired);
    if (!domain) return null;
    if (domain.min > Math.min(...values) || domain.max < Math.max(...values)) return null;
    const map = value => plotBox.x + (value - domain.min) / (domain.max - domain.min) * plotBox.w;
    const labels = domain.ticks.map(value => {
      const text = axisText(value), w = measureTextWidth(text, fontSize, { fontFamily }) + 4;
      const x = Math.max(plotBox.x, Math.min(map(value) - w / 2, plotBox.x + plotBox.w - w));
      return { value, text, x, w };
    });
    if (new Set(labels.map(label => label.text)).size === labels.length &&
        labels.every(label => finite(label.w) && label.w > 0 && label.w <= plotBox.w) &&
        labels.every((label, index) => index === 0 || label.x >= labels[index - 1].x + labels[index - 1].w + 8))
      return { domain, map, labels };
  }
  return null;
}

/** Deterministic vertical packing only: x remains the exact numeric mapping.
 * A limited vertical offset is explicitly described as non-quantitative.
 * Reject unresolvable density instead of overplotting or dropping samples.
 */
function packObservations(values, map, centerY, rowHeight) {
  const diameter = POINT_RADIUS * 2, spacing = diameter + POINT_GAP;
  const amplitude = Math.min(MAX_POINT_OFFSET, rowHeight / 2 - POINT_RADIUS - POINT_ROW_PADDING);
  if (amplitude < 0) return null;
  const offsets = [0];
  for (let value = spacing; value <= amplitude + 1e-9; value += spacing) offsets.push(value, -value);
  const ordered = values.map((value, index) => ({ value, index, x: map(value) })).sort((a, z) => a.x - z.x || a.index - z.index);
  const positioned = [];
  for (const point of ordered) {
    const nearby = positioned.filter(other => point.x - other.x < spacing);
    const offset = offsets.find(candidate => nearby.every(other => Math.hypot(point.x - other.x, candidate - other.offset) >= spacing - 1e-9));
    if (offset === undefined) return null;
    positioned.push({ ...point, offset, y: centerY + offset });
  }
  return positioned.sort((a, z) => a.index - z.index);
}

const layoutIssue = (code, message, details = {}) => ({ severity: 'error', code, message, ...details });

/** One pure width-dependent plan for minimum measurement and final rendering.
 * All positions here are local to x=0. It measures actual text and uses the
 * same numeric domain/packing as the final native shapes, without a builder.
 */
function prepareScientificPlot(data, width, { fontFamily, wrapText, measureTextWidth, system = {} } = {}) {
  const invalid = validate(data, { x: 0, y: 0, w: width, h: 1 });
  if (invalid) return { issue: layoutIssue(...invalid) };
  if (typeof wrapText !== 'function' || typeof measureTextWidth !== 'function')
    return { issue: layoutIssue('plot-text-metrics-missing', '科学图需要与页面一致的文字换行和宽度测量函数。') };

  const face = fontFamily || system.fontFamily || 'Noto Sans CJK SC';
  const groupFont = Math.max(MIN_FONT, finite(system.bodySize) ? system.bodySize : 22);
  const smallFont = Math.max(MIN_FONT, finite(system.captionSize) ? system.captionSize : 18);
  const padding = 12, columnGap = 14, innerWidth = width - 2 * padding;
  if (innerWidth < 240)
    return { issue: layoutIssue('plot-area-too-small', '科学图区域过窄；扩大区域或拆页，不能缩小轴、标签或观测点。') };

  const measure = (text, availableWidth, size, bold = false) => {
    const metrics = { bold, fontFamily: face }, lines = wrapText(text, availableWidth, size, metrics);
    const widths = Array.isArray(lines) ? lines.map(line => measureTextWidth(line, size, metrics)) : [];
    if (!lines?.length || widths.some(w => !finite(w) || w < 0 || w > availableWidth + .5)) return null;
    return { text, lines, w: availableWidth, h: lines.length * size * LINE_HEIGHT, size, bold };
  };
  const labelTexts = data.groups.map(group => data.kind === 'distribution' ? `${group.label} (n = ${group.values.length})` : group.label);
  const labelWidth = Math.min(innerWidth * .25, Math.max(68, ...labelTexts.map(text => measureTextWidth(text, groupFont, { fontFamily: face, bold: true }) + 6)));
  const valueTexts = data.kind === 'interval' ? data.groups.map(group => `${numericText(group.estimate)} [${numericText(group.lower)}, ${numericText(group.upper)}]`) : [];
  const valueWidth = valueTexts.length ? Math.min(innerWidth * .36, Math.max(92, ...valueTexts.map(text => measureTextWidth(text, smallFont, { fontFamily: face }) + 6))) : 0;
  const plotX = padding + labelWidth + columnGap;
  const plotRight = width - padding - (valueWidth ? valueWidth + columnGap : 0);
  const plotWidth = plotRight - plotX;
  if (!finite(plotWidth) || plotWidth < Math.max(150, smallFont * 7))
    return { issue: layoutIssue('plot-label-density', '组标签与显式数值标签挤占了数值轴；扩大图框、缩短已核实的标签或拆页，不能省略数值或缩字号。') };

  const reference = data.reference !== undefined ? data.reference : data.kind === 'interval' ? 0 : undefined;
  const noteText = data.kind === 'distribution'
    ? `每点为一条观测；纵向错位仅防重叠${reference !== undefined ? `；参考值 = ${numericText(reference)}` : ''}`
    : `点为估计值；线为区间；参考值 = ${numericText(reference)}`;
  const note = measure(noteText, innerWidth, smallFont);
  const caption = data.caption ? measure(data.caption, innerWidth, smallFont) : null;
  const unit = measure(data.unit, plotWidth, smallFont);
  const labels = labelTexts.map(text => measure(text, labelWidth, groupFont, true));
  const valueLabels = valueTexts.map(text => measure(text, valueWidth, smallFont));
  if (!note || !unit || labels.some(item => !item) || valueLabels.some(item => !item) || (data.caption && !caption))
    return { issue: layoutIssue('plot-text-measurement', '科学图标签或图注无法在当前区域完整显示；调整区域或内容分配，不能裁切原文。') };

  const rawValues = data.groups.flatMap(group => data.kind === 'distribution' ? group.values : [group.lower, group.estimate, group.upper]);
  const domainValues = reference === undefined ? rawValues : [...rawValues, reference];
  const axis = fitAxis(domainValues, { x: plotX, w: plotWidth }, smallFont, measureTextWidth, face);
  if (!axis)
    return { issue: layoutIssue('plot-axis-density', '无法为当前数值域生成可读且有限的刻度；扩大横轴区域或核对数值量级，不能修改观测值。') };
  const tickLayouts = axis.labels.map(tick => measure(tick.text, tick.w, smallFont));
  if (tickLayouts.some(item => !item))
    return { issue: layoutIssue('plot-text-measurement', '科学图刻度无法完整显示；扩大横轴区域，不能删除或裁切刻度。') };
  const tickHeight = Math.max(...tickLayouts.map(tick => tick.h));

  const packingHeight = 2 * (MAX_POINT_OFFSET + POINT_RADIUS + POINT_ROW_PADDING);
  const packedGroups = data.groups.map(group => data.kind === 'distribution' ? packObservations(group.values, axis.map, 0, packingHeight) : []);
  if (packedGroups.some(points => points === null))
    return { issue: layoutIssue('plot-observation-density', '同一数值附近的观测过密，无法在限定的纵向错位内逐点显示；扩大图框或拆分组别，不能删点、合并为均值或连接独立点。') };
  const requiredPointHeight = data.kind === 'distribution'
    ? 2 * (Math.max(0, ...packedGroups.flatMap(points => points.map(point => Math.abs(point.offset)))) + POINT_RADIUS + POINT_ROW_PADDING)
    : 14; // Twelve-pixel interval caps plus separation from neighboring rows.
  const requiredRowHeight = Math.max(requiredPointHeight, ...labels.map(label => label.h + 2), ...valueLabels.map(label => label.h + 2));
  const fixedHeight = padding * 2 + note.h + 10 + 9 + 8 + tickHeight + 6 + unit.h + (caption ? 10 + caption.h : 0);
  const minimumHeight = Math.ceil(fixedHeight + requiredRowHeight * data.groups.length);
  return {
    face, padding, columnGap, innerWidth, plotX, plotRight, plotWidth,
    reference, note, caption, unit, labels, valueLabels, axis, tickLayouts,
    tickHeight, requiredRowHeight, fixedHeight, minimumHeight, packedGroups,
  };
}

/** Pure composition contract at the requested width.
 *
 * Success: {minimumHeight: finite integer, issues: []}.
 * Impossible/invalid: {minimumHeight: null, issues: [{severity:'error',...}]}.
 * A null height is deliberately not a fallback layout. In particular, greater
 * height cannot solve clusters that exceed the explicitly limited point offset.
 * No builder or scene objects are created and input data is never changed.
 */
export function measureScientificPlotMinimum(data, width, options = {}) {
  const prepared = prepareScientificPlot(data, width, options);
  if (prepared.issue) return { minimumHeight: null, issues: [prepared.issue] };
  return { minimumHeight: prepared.minimumHeight, issues: [] };
}

/**
 * Render a scientific plot through pageBuilder's native primitives.
 *
 * Callbacks follow scene.mjs: wrapText(text,width,fontSize,metrics) and
 * measureTextWidth(text,fontSize,metrics). b.system.bodySize controls group
 * labels; b.system.captionSize controls axes, value labels and captions.
 * Both respect an 18 px floor. Layout is checked before adding any objects.
 * Errors enter b.page.issues and return {failed:true}; no partial plot is drawn.
 */
export function renderScientificPlot(b, data, box, { fontFamily, wrapText, measureTextWidth } = {}) {
  const invalid = validate(data, box);
  if (invalid) return failure(b, ...invalid);
  if (b.regions?.some(region => region.id === `${b.page.id}/${PREFIX}-region`))
    return failure(b, 'plot-duplicate-region', '同一命名范围只允许一个 data-plot-region；不能重复覆盖同一数据图区域。');

  const p = b.p || {}, system = b.system || {};
  const prepared = prepareScientificPlot(data, box.w, {
    fontFamily: fontFamily || system.fontFamily || b.fontFamily, wrapText, measureTextWidth, system,
  });
  if (prepared.issue) {
    const { code, message, severity, ...details } = prepared.issue;
    return failure(b, code, message, details);
  }
  const { face, padding, columnGap, reference, note, caption, unit, labels, valueLabels, tickHeight, requiredRowHeight } = prepared;
  const accent = color(p.accent, '#183B66'), ink = color(p.ink, '#171C22');
  const muted = color(p.muted, '#4F5D6A'), grid = color(p.line, '#C5CFDA');
  const plotX = box.x + prepared.plotX, plotRight = box.x + prepared.plotRight;
  const captionY = box.y + box.h - padding - (caption?.h || 0);
  const unitBottom = caption ? captionY - 10 : box.y + box.h - padding;
  const unitY = unitBottom - unit.h;
  const tickY = unitY - 6 - tickHeight;
  const axisY = tickY - 8;
  const groupTop = box.y + padding + note.h + 10;
  const groupBottom = axisY - 9;
  const rowHeight = (groupBottom - groupTop) / data.groups.length;
  if (rowHeight < requiredRowHeight - 1e-9)
    return failure(b, caption ? 'plot-caption-overflow' : 'plot-group-density',
      `科学图需每组至少 ${Math.ceil(requiredRowHeight)} px，当前仅 ${Math.max(0, Math.floor(rowHeight))} px；完整保留标签与图注并扩大图框或拆页。`,
      { requiredHeight: prepared.minimumHeight, availableHeight: box.h });

  const plotBox = { x: plotX, y: groupTop, w: prepared.plotWidth, h: groupBottom - groupTop };
  const axis = {
    domain: prepared.axis.domain,
    map: value => box.x + prepared.axis.map(value),
    labels: prepared.axis.labels.map(tick => ({ ...tick, x: box.x + tick.x })),
  };
  const groupLayouts = prepared.packedGroups.map((points, index) => {
    const centerY = groupTop + rowHeight * (index + .5);
    return { centerY, points: points.map(point => ({ ...point, x: box.x + point.x, y: centerY + point.offset })) };
  });

  // From here on every shape has passed geometry and density preflight.
  const sourceClaimIds = [...data.sourceClaimIds];
  const common = { plotKind: data.kind, sourceClaimIds };
  b.region(`${PREFIX}-region`, { ...box }, 'plot');
  const text = (key, layout, x, y, more = {}) => b.text(`${PREFIX}/${key}`, layout.text,
    { x, y, w: layout.w, h: layout.h }, layout.size,
    { fontFamily: face, lineHeight: LINE_HEIGHT, color: ink, bold: layout.bold, ...common, ...more });
  text('reading-note', note, box.x + padding, box.y + padding, { color: muted, role: 'plot-reading-note', reference });
  if (caption) text('caption', caption, box.x + padding, captionY, { color: muted, role: 'caption' });
  text('unit', unit, plotX, unitY, { align: 'center', color: muted, role: 'plot-unit' });

  for (const [index, tick] of axis.labels.entries()) {
    const x = axis.map(tick.value), isReference = reference !== undefined && Math.abs(tick.value - reference) <= axis.domain.step * 1e-10;
    if (!isReference) b.line(`${PREFIX}/grid/${index}`, x, groupTop, x, axisY, grid,
      { strokeWidth: .8, role: 'plot-grid', value: tick.value });
    b.line(`${PREFIX}/tick/${index}`, x, axisY, x, axisY + 4, muted,
      { strokeWidth: 1, role: 'plot-axis-tick', value: tick.value });
    const tickLayout = prepared.tickLayouts[index];
    text(`tick-label/${index}`, tickLayout, tick.x, tickY, { align: 'center', color: muted, role: 'plot-axis-label', value: tick.value });
  }
  b.line(`${PREFIX}/axis`, plotX, axisY, plotRight, axisY, muted, { strokeWidth: 1.2, role: 'plot-axis', domain: { ...axis.domain } });
  if (reference !== undefined) b.line(`${PREFIX}/reference`, axis.map(reference), groupTop, axis.map(reference), axisY, muted,
    { strokeWidth: 1.8, dash: 'dash', role: 'plot-reference', value: reference, ...common });

  for (const [index, group] of data.groups.entries()) {
    const { centerY, points } = groupLayouts[index];
    const groupMetadata = {
      ...common, groupIndex: index, groupLabel: group.label,
      value: data.kind === 'distribution' ? [...group.values] : group.estimate,
      ...(data.kind === 'interval' ? { lower: group.lower, upper: group.upper } : {}),
    };
    text(`group/${index}/label`, labels[index], box.x + padding, centerY - labels[index].h / 2,
      { role: 'plot-group-label', ...groupMetadata });
    if (data.kind === 'distribution') {
      for (const point of points) b.add('ellipse', `${PREFIX}/group/${index}/point/${point.index}`, {
        x: point.x - POINT_RADIUS, y: point.y - POINT_RADIUS, w: POINT_RADIUS * 2, h: POINT_RADIUS * 2,
        fill: accent, stroke: 'none', role: 'plot-observation', ...groupMetadata,
        value: point.value, pointIndex: point.index, nonQuantitativeOffset: point.offset,
      });
    } else {
      const lowerX = axis.map(group.lower), upperX = axis.map(group.upper), estimateX = axis.map(group.estimate);
      b.line(`${PREFIX}/group/${index}/interval`, lowerX, centerY, upperX, centerY, accent,
        { strokeWidth: 2.4, role: 'plot-interval', ...groupMetadata });
      for (const [bound, x] of [['lower', lowerX], ['upper', upperX]]) b.line(`${PREFIX}/group/${index}/${bound}`, x, centerY - 6, x, centerY + 6, accent,
        { strokeWidth: 1.8, role: 'plot-bound', ...groupMetadata, bound, value: group[bound] });
      b.add('ellipse', `${PREFIX}/group/${index}/estimate`, {
        x: estimateX - 5, y: centerY - 5, w: 10, h: 10, fill: accent, stroke: 'none',
        role: 'plot-estimate', ...groupMetadata,
      });
      text(`group/${index}/value-label`, valueLabels[index], plotRight + columnGap, centerY - valueLabels[index].h / 2,
        { role: 'plot-value-label', ...groupMetadata });
    }
  }
  return { failed: false, bottom: box.y + box.h, height: box.h, plotBox, domain: axis.domain, reference };
}
