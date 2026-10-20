import test from 'node:test';
import assert from 'node:assert/strict';
import { renderAcademicComposition } from '../src/academic-composition.mjs';
import { measureAcademicDiagramMinimum, renderAcademicDiagram } from '../src/academic-diagram.mjs';
import { buildScenes, measureTextWidth, wrapText } from '../src/scene.mjs';
import { PNG } from './fixtures.mjs';

// Authored software fixtures, never research evidence or a visual-acceptance claim.
const palette = { background: '#FFFFFF', paper: '#FFFFFF', ink: '#171C22', muted: '#4F5D6A', accent: '#124D86', secondary: '#476D93', gold: '#9D3038', line: '#B7C9DC', tint: '#EDF3F9' };
const design = () => ({ fontFamily: 'Noto Sans CJK SC', palette: { ...palette }, system: { panel: 'band', bodySize: 24, panelTitleSize: 26, captionSize: 18 } });
const authoredCard = (id, changes = {}) => ({ id, kind: 'method', title: `说明${id}`, body: '保留完整测试条件。', claimIds: ['C1'], ...changes });
const authoredFigure = (id, changes = {}) => ({ id, data: PNG, width: 600, height: 240, paperId: 'P1', figure: `Fig. ${id}`, caption: '用于检验源图身份的合成图。', displayCaption: `Fig. ${id} · 合成测试图`, sourceUrl: 'https://example.org/fixture', sourceVersion: 'test v1', license: 'synthetic fixture', cropNote: '无裁切', usage: 'figure', treatment: 'plain', reading: { purpose: 'evidence', contentType: 'photo', task: 'overview', panelCount: 1, verifiedBy: 'human' }, ...changes });
const authoredSlide = changes => ({ id: 's', layout: 'synthesis', title: '分组、证据与验证边界', paperIds: ['P1'], claimIds: ['C1'], figureIds: [], cards: [], notes: '合成软件排版用例，不代表实际研究结果。', seconds: 60, ...changes });
const project = slide => ({ title: 'Academic composition test', design: design(), papers: [{ id: 'P1', title: 'Synthetic composition fixture', authors: ['Fixture Author'], journal: 'Software Fixture', year: 2026 }], claims: [{ id: 'C1', paperId: 'P1', text: '固定输入值原样保留。', locator: 'Fixture row 1' }], assets: [], slides: [slide] });
const errors = page => page.issues.filter(issue => issue.severity === 'error');
const right = box => box.x + box.w;
const bottom = box => box.y + box.h;
const overlaps = (a, z) => Math.min(right(a), right(z)) - Math.max(a.x, z.x) > 2 && Math.min(bottom(a), bottom(z)) - Math.max(a.y, z.y) > 2;
const hasPayload = (page, value) => page.nodes.some(node => node.text === value);
const find = (page, suffix) => page.nodes.find(node => node.id.endsWith(suffix));

/** Recording builder with genuine editable text/image/table callbacks. The
 * integration cases below additionally exercise the production callbacks. */
function recording(p, slide, overrides = {}) {
  const d = p.design, page = { id: slide.id, nodes: [], issues: [], notes: '' }, regions = [], calls = [];
  const b = { page, p: d.palette, design: d, system: d.system, regions,
    region(key, box, type) { regions.push({ id: `${page.id}/${key}`, ...box, type }); },
    add(kind, key, props, cardId) {
      const node = { ...props, kind, id: `${page.id}/${key}`, ...(cardId ? { cardId } : {}) };
      page.nodes.push(node);
      if (kind === 'chart') b.region(key, props, 'chart');
      return node;
    },
    text(key, value, box, size = 24, more = {}, cardId) {
      if (!value) return null;
      const text = String(value), lines = wrapText(text, box.w, size, { bold: more.bold }), lineHeight = more.lineHeight || 1.24;
      if (lines.length * size * lineHeight > box.h + 2) page.issues.push({ severity: 'error', code: 'recorded-text-overflow', objectId: `${page.id}/${key}` });
      return b.add('text', key, { ...box, text, lines, fontSize: size, lineHeight, ...more }, cardId);
    },
    rect(key, box, fill, stroke, more = {}, cardId) { return b.add('rect', key, { ...box, fill, stroke, ...more }, cardId); },
    line(key, x1, y1, x2, y2, stroke, more = {}, cardId) { return b.add('line', key, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, stroke, ...more }, cardId); },
  };
  const callbacks = {
    card(builder, data, box, index, parent, style) {
      calls.push({ kind: 'card', id: data.id, box: structuredClone(box), data: structuredClone(data), index, style });
      builder.region(`card/${data.id}`, box, 'card');
      const titleH = Math.max(34, wrapText(data.title, box.w, 26, { bold: true }).length * 26 * 1.15);
      builder.text(`card/${data.id}/title`, data.title, { x: box.x, y: box.y + 2, w: box.w, h: titleH }, 26, { bold: true, lineHeight: 1.15 }, data.id);
      let y = box.y + (style === 'plain' ? 49 : 42) + Math.max(0, titleH - 34);
      if (data.metric) {
        builder.text(`card/${data.id}/metric`, `${data.metric.value} ${data.metric.unit}`, { x: box.x, y, w: box.w, h: 44.08 }, 38, { lineHeight: 1.1 }, data.id); y += 48.08;
        for (const [field, lineHeight, gap] of [['label', 1.18, 4], ['context', 1.2, 8]]) if (data.metric[field]) {
          const h = wrapText(data.metric[field], box.w, 24).length * 24 * lineHeight;
          builder.text(`card/${data.id}/${field}`, data.metric[field], { x: box.x, y, w: box.w, h }, 24, { lineHeight }, data.id); y += h + gap;
        }
      }
      builder.text(`card/${data.id}/body`, data.body, { x: box.x, y, w: box.w, h: Math.max(1, bottom(box) - y - 4) }, 24, { lineHeight: 1.24, emphasis: data.emphasis }, data.id);
    },
    figure(builder, parent, id, box, key) {
      const asset = parent.assets.find(item => item.id === id);
      calls.push({ kind: 'figure', id, box: structuredClone(box) });
      builder.region(key, box, 'figure');
      if (!asset) return;
      const caption = asset.displayCaption || asset.caption, captionH = Math.max(26.1, wrapText(caption, box.w, 18).length * 18 * 1.24 + 4);
      const frame = { ...box, h: box.h - captionH - 9 }, scale = Math.min(frame.w / asset.width, frame.h / asset.height);
      builder.add('image', `${key}:image`, { x: frame.x + (frame.w - asset.width * scale) / 2, y: frame.y + (frame.h - asset.height * scale) / 2, w: asset.width * scale, h: asset.height * scale, assetId: id, data: asset.data });
      builder.text(`${key}:caption`, caption, { x: box.x, y: bottom(box) - captionH, w: box.w, h: captionH }, 18, { role: 'caption', lineHeight: 1.24 });
    },
    table(builder, data, box, fontFamily) {
      calls.push({ kind: 'table', data: structuredClone(data), box: structuredClone(box) });
      const weights = data.columnWeights || data.columns.map(() => 1), sum = weights.reduce((a, z) => a + z, 0), widths = weights.map(weight => box.w * weight / sum);
      const heights = [data.columns, ...data.rows].map((row, index) => Math.max(...row.map((cell, column) => wrapText(cell, widths[column] - 33.2, 24, { bold: index === 0 }).length)) * 24 * 1.22 + 14);
      const h = heights.reduce((a, z) => a + z, 0), captionH = data.caption ? wrapText(data.caption, box.w, 18).length * 18 * 1.24 + 7 : 0;
      builder.region('data-table-region', { ...box, h: h + captionH }, 'table');
      builder.add('table', 'data-table', { ...box, h, table: structuredClone(data), fontFamily, fontSize: 24 });
      if (data.caption) builder.text('table-caption', data.caption, { x: box.x, y: box.y + h + 7, w: box.w, h: captionH - 7 }, 18, { lineHeight: 1.24, role: 'caption' });
      return { bottom: box.y + h + captionH, height: h + captionH };
    },
    diagram(builder, parent, data, area) {
      calls.push({ kind: 'diagram', data: structuredClone({ nodes: data.nodes, edges: data.edges }), box: structuredClone(area) });
      data.nodes.forEach((node, index) => {
        const w = (area.w - (data.nodes.length - 1) * 40) / data.nodes.length, box = { x: area.x + index * (w + 40), y: area.y + 14, w, h: area.h - 28 };
        builder.region(`node:${node.id}`, box, 'diagram-node');
        builder.rect(`node:${node.id}:frame`, box, palette.tint, palette.line);
        builder.text(`node:${node.id}:label`, node.label, { x: box.x + 12, y: box.y + 10, w: box.w - 24, h: box.h - 20 }, 24, { lineHeight: 1.16 });
      });
      data.edges.forEach((edge, index) => builder.add('line', `edge:${index}`, { x: area.x, y: area.y, w: 1, h: 1, sourceEdge: structuredClone(edge) }));
    },
    plot(builder, data, area, options) {
      calls.push({ kind: 'plot', data: structuredClone(data), box: structuredClone(area), fontFamily: options.fontFamily });
      builder.region('scientific-plot', area, 'plot');
      builder.add('plot', 'scientific-plot', { ...area, plot: structuredClone(data), fontFamily: options.fontFamily });
    },
    wrapText, measureTextWidth, clone: structuredClone, design: d,
    ...overrides,
  };
  renderAcademicComposition(b, p, slide, callbacks);
  return { page, regions, calls, b };
}

test('weighted panels preserve all authored text, evidence identities and full-width strips', () => {
  const slide = authoredSlide({ subtitle: '额外保留的原有副标题。', figureIds: ['A1'], cards: [authoredCard('a', { body: '左侧解释不改变原图。' }), authoredCard('b', { body: '右侧保留独立边界。', kind: 'boundary' })], composition: { lead: '对照证据与适用条件。', rows: [{ panels: [{ id: 'evidence', title: '原图证据', weight: 1.6, figureIds: ['A1'], cardIds: ['a'] }, { id: 'boundary', title: '适用边界', weight: 1, cardIds: ['b'] }] }], conclusion: { label: '判断', text: '这是软件排版测试。' } }, takeaway: '还须在导出页面核对。' });
  const p = project(slide); p.assets = [authoredFigure('A1')];
  const before = structuredClone(p), result = recording(p, slide), page = result.page;
  assert.deepEqual(errors(page), []);
  for (const value of [slide.subtitle, slide.composition.lead, slide.composition.conclusion.label, slide.composition.conclusion.text, slide.takeaway, ...slide.cards.flatMap(card => [card.title, card.body]), p.assets[0].displayCaption]) assert.ok(hasPayload(page, value), value);
  const headings = page.nodes.filter(node => node.role === 'panel-title');
  assert.equal(headings.length, 2);
  assert.equal(headings[0].y, headings[1].y);
  assert.ok(headings.every(node => node.fontSize >= 26));
  const frames = page.nodes.filter(node => node.role === 'panel-frame');
  assert.ok(Math.abs(frames[0].w / frames[1].w - 1.6) < 1e-9);
  assert.equal(frames[0].y, frames[1].y);
  assert.equal(bottom(frames[0]), bottom(frames[1]));
  assert.equal(find(page, '/composition/lead/frame').w, 1184);
  assert.equal(find(page, '/composition/conclusion/frame').w, 1184);
  assert.ok(bottom(find(page, '/composition/conclusion/frame')) <= 645 + 1);
  assert.ok(!result.regions.some(region => region.type === 'panel'), 'panel frames are furniture, not overlapping content containers');
  for (let i = 0; i < result.regions.length; i += 1) for (const other of result.regions.slice(i + 1)) assert.ok(!overlaps(result.regions[i], other), `${result.regions[i].id} overlaps ${other.id}`);
  assert.deepEqual(result.calls.filter(call => call.kind === 'card').map(call => call.id), ['a', 'b']);
  assert.deepEqual(p, before, 'flow layout must not rewrite or mutate authored data');
});

test('comparison evidence and two-row mechanisms use the production content callbacks', () => {
  const slide = authoredSlide({ cards: [authoredCard('a', { title: '样本与条件', body: '固定软件输入。' }), authoredCard('b', { title: '解释与约束', body: '保留预设边界。' })], nodes: [{ id: 'n1', label: '输入核对' }, { id: 'n2', label: '原生导出' }, { id: 'n3', label: '对象比较' }], edges: [{ from: 'n1', to: 'n2', label: '转换' }, { from: 'n2', to: 'n3', label: '核验' }], composition: { lead: '检验固定输入的身份保持。', rows: [{ weight: 1, panels: [{ id: 'setting', title: '测试条件与输入', kind: 'setting', cardIds: ['a'] }, { id: 'boundary', title: '解释范围与边界', kind: 'boundary', cardIds: ['b'] }] }, { weight: 1.2, panels: [{ id: 'mechanism', title: '输入、导出与核验流程', kind: 'method', diagram: true }] }], conclusion: { label: '边界', text: '这些断言只覆盖软件行为。' } } });
  const p = project(slide), before = structuredClone(p), page = buildScenes(p).pages[0];
  assert.deepEqual(errors(page), []);
  assert.equal(page.nodes.filter(node => node.role === 'panel-title').length, 3);
  assert.ok(page.nodes.some(node => node.id === 's/node:n1:frame'));
  for (const node of slide.nodes) assert.ok(hasPayload(page, node.label));
  for (const edge of slide.edges) assert.ok(hasPayload(page, edge.label));
  for (const card of slide.cards) assert.ok(hasPayload(page, card.body));
  const upper = find(page, '/composition/panel/setting/frame'), lower = find(page, '/composition/panel/mechanism/frame');
  assert.ok(lower.y >= bottom(upper) + 17.9);
  assert.equal(lower.w, 1184);
  assert.deepEqual(p, before);
});

test('native tables keep weighted columns, every cell, caption and following interpretation', () => {
  const data = { columns: ['条件', '固定计数', '验证范围'], rows: [['输入一', '3/4', '软件路径'], ['输入二', '2/4', '同一版本']], columnWeights: [1, 1, 1.4], highlightRows: [1], caption: '合成计数：仅检验导出保真。', sourceClaimIds: ['C1'] };
  const slide = authoredSlide({ table: data, cards: [authoredCard('interpretation', { title: '结果解释', body: '这些计数不代表实际研究成效。' }), authoredCard('limit', { title: '核验边界', body: '固定输入的比较只覆盖这个用例。' })], composition: { rows: [{ panels: [{ id: 'matrix', title: '条件与计数矩阵', weight: 1.65, table: true, cardIds: ['interpretation'] }, { id: 'scope', title: '适用范围', weight: 1, cardIds: ['limit'] }] }], conclusion: { label: '说明', text: '全部数值、分母与边界原样保留。' } } });
  const p = project(slide), page = buildScenes(p).pages[0];
  assert.deepEqual(errors(page), []);
  const table = page.nodes.find(node => node.kind === 'table');
  assert.ok(table, 'native table must be present');
  assert.deepEqual(table.table, data);
  assert.ok(Math.abs(table.colWidths[2] / table.colWidths[0] - 1.4) < 1e-9);
  assert.ok(table.fontSize >= 24);
  const caption = page.nodes.find(node => node.id === 's/table-caption'), explanation = page.nodes.find(node => node.id === 's/card/interpretation/title');
  assert.ok(explanation.y >= caption.y + caption.h + 10);
  assert.ok(hasPayload(page, data.caption));
  assert.ok(hasPayload(page, slide.cards[0].body));
});

test('figures remain separate source objects and their captions clear explanatory text', () => {
  const slide = authoredSlide({ figureIds: ['A1', 'A2'], cards: [authoredCard('a', { title: '相同输入', body: '两项原图具有独立身份。' })], composition: { rows: [{ panels: [{ id: 'comparison', title: '原图比较与独立来源', figureIds: ['A1', 'A2'], cardIds: ['a'] }] }], conclusion: { label: '核对', text: '图像比例与来源身份均应保留。' } } });
  const p = project(slide); p.assets = [authoredFigure('A1', { width: 720, height: 260 }), authoredFigure('A2', { width: 520, height: 280 })];
  const page = buildScenes(p).pages[0];
  assert.deepEqual(errors(page), []);
  assert.deepEqual(page.nodes.filter(node => node.kind === 'image').map(node => node.assetId).sort(), ['A1', 'A2']);
  const captions = page.nodes.filter(node => node.role === 'caption'), explanation = find(page, '/card/a/title');
  assert.equal(captions.length, 2);
  assert.ok(captions.every(node => node.fontSize >= 18 && bottom(node) + 10 <= explanation.y));
  assert.ok(captions.every(node => node.text === p.assets.find(asset => node.text.includes(asset.id)).displayCaption));
  const images = page.nodes.filter(node => node.kind === 'image');
  images.forEach(node => { const asset = p.assets.find(item => item.id === node.assetId); assert.ok(Math.abs(node.w / node.h - asset.width / asset.height) < 1e-9); });
});

test('chart and scientific plot are independent native primary objects with intact numeric payloads', () => {
  const chart = { kind: 'bar', categories: ['输入一', '输入二'], series: [{ name: '计数', values: [3, 2] }], unit: '项', sourceClaimId: 'C1' };
  const plot = { kind: 'interval', groups: [{ label: '固定区间', estimate: 2, lower: 1, upper: 3 }], unit: '项', sourceClaimIds: ['C1'], caption: '仅用于回调测试的区间。' };
  const slide = authoredSlide({ chart, plot, composition: { rows: [{ panels: [{ id: 'bars', title: '固定计数', chart: true }, { id: 'interval', title: '固定区间', plot: true }] }], conclusion: { label: '测试', text: '数值、区间与证据标识均应原样传入。' } } });
  const p = project(slide), result = recording(p, slide);
  assert.deepEqual(errors(result.page), []);
  const nativeChart = result.page.nodes.find(node => node.kind === 'chart'), nativePlot = result.page.nodes.find(node => node.kind === 'plot');
  assert.deepEqual(nativeChart.chart, chart);
  assert.deepEqual(nativePlot.plot, plot);
  assert.notEqual(nativeChart.chart, chart, 'native chart receives a copy rather than a mutable alias');
  assert.equal(nativeChart.fontFamily, p.design.fontFamily);
  assert.equal(nativePlot.fontFamily, p.design.fontFamily);
  assert.ok(!overlaps(nativeChart, nativePlot));
  assert.ok(nativePlot.w >= 380 && nativePlot.h >= 180);
  assert.ok(hasPayload(result.page, '[1] · Fixture row 1'));
});

test('named distribution and interval plots coexist with all native observations, bounds and sources', () => {
  const distribution = { id: 'observations', kind: 'distribution', groups: [{ label: '条件一', values: [1, 1.2, 1.4] }, { label: '条件二', values: [1.8, 2, 2.2] }], unit: '合成单位', sourceClaimIds: ['C1'], caption: '合成原始观测；没有均值替换。' };
  const interval = { id: 'intervals', kind: 'interval', groups: [{ label: '条件一', estimate: 1.2, lower: .8, upper: 1.6 }, { label: '条件二', estimate: 2, lower: 1.5, upper: 2.5 }], unit: '合成单位', sourceClaimIds: ['C2'], caption: '预先给定的测试区间；没有推算。' };
  const slide = authoredSlide({ plots: [distribution, interval], composition: { rows: [{ panels: [{ id: 'observed', title: '逐点观测', plotId: 'observations' }, { id: 'estimated', title: '估计与给定区间', plotId: 'intervals' }] }], conclusion: { label: '边界', text: '分布与区间保持各自的科学含义。' } } });
  const p = project(slide); p.claims.push({ id: 'C2', paperId: 'P1', text: '预先给定的区间。', locator: 'Fixture interval rows' });
  const before = structuredClone(p), page = buildScenes(p).pages[0];
  assert.deepEqual(errors(page), []);
  const observations = page.nodes.filter(node => node.role === 'plot-observation'), estimates = page.nodes.filter(node => node.role === 'plot-estimate'), bounds = page.nodes.filter(node => node.role === 'plot-bound');
  assert.deepEqual(observations.map(node => node.value), [1, 1.2, 1.4, 1.8, 2, 2.2]);
  assert.deepEqual(estimates.map(node => node.value), [1.2, 2]);
  assert.deepEqual(bounds.map(node => node.value), [.8, 1.6, 1.5, 2.5]);
  assert.ok(observations.every(node => node.id.startsWith('s/plots/observations/data-plot/') && node.sourceClaimIds.join() === 'C1'));
  assert.ok(estimates.every(node => node.id.startsWith('s/plots/intervals/data-plot/') && node.sourceClaimIds.join() === 'C2'));
  assert.ok(hasPayload(page, distribution.caption));
  assert.ok(hasPayload(page, interval.caption));
  assert.equal(new Set(page.nodes.map(node => node.id)).size, page.nodes.length, 'the two native plots have independent namespaces');
  assert.deepEqual(p, before);
  slide.composition.rows[0].panels[1].plotId = 'observations';
  const invalid = buildScenes(p).pages[0];
  assert.ok(errors(invalid).some(issue => issue.code === 'composition-duplicate-plot-reference'));
  assert.ok(errors(invalid).some(issue => issue.code === 'composition-unassigned-plot' && issue.plotId === 'intervals'));
});

test('valid public typography tokens render unchanged instead of rejecting the academic page', () => {
  const slide = authoredSlide({ figureIds: ['A1'], cards: [authoredCard('a')], composition: { rows: [{ panels: [{ id: 'one', title: '证据与说明', figureIds: ['A1'], cardIds: ['a'] }] }] } });
  const p = project(slide); p.assets = [authoredFigure('A1')]; p.design.system = { panel: 'tint', bodySize: 22, panelTitleSize: 24, captionSize: 16 };
  const page = buildScenes(p).pages[0];
  assert.deepEqual(errors(page), []);
  assert.equal(find(page, '/card/a/body').fontSize, 22);
  assert.equal(find(page, '/composition/panel/one/title').fontSize, 24);
  assert.equal(page.nodes.find(node => node.role === 'caption').fontSize, 16);
  assert.ok(hasPayload(page, slide.cards[0].body));
});

test('shared plot measurement reserves a multiline caption before distributing row heights', () => {
  const caption = '原始数据逐项保留以及来源定位信息。'.repeat(8);
  const plot = { kind: 'distribution', groups: [{ label: '输入', values: [1, 2, 3] }], unit: '合成单位', sourceClaimIds: ['C1'], caption };
  const slide = authoredSlide({ plot, cards: [authoredCard('scope', { title: '解释范围', body: '全部原始点只用于软件导出测试。' })], composition: { rows: [{ panels: [{ id: 'data', title: '原始观测与完整图注', plot: true }] }, { panels: [{ id: 'scope', title: '核验边界', cardIds: ['scope'] }] }] } });
  const page = buildScenes(project(slide)).pages[0];
  assert.deepEqual(errors(page), []);
  const plotCaption = find(page, '/data-plot/caption'), dataPanel = find(page, '/composition/panel/data/frame'), scopePanel = find(page, '/composition/panel/scope/frame');
  assert.ok(plotCaption.lines.length >= 3);
  assert.equal(plotCaption.text, caption);
  assert.ok(dataPanel.h > scopePanel.h, 'the real figure content constrains otherwise equal row weights');
  assert.ok(bottom(plotCaption) + 10 <= bottom(dataPanel));
  assert.ok(scopePanel.y >= bottom(dataPanel) + 17.9);
  assert.deepEqual(page.nodes.filter(node => node.role === 'plot-observation').map(node => node.value), [1, 2, 3]);
});

test('legacy and named plot identities coexist independently of panel order', () => {
  const data = { kind: 'interval', groups: [{ label: '输入', estimate: 2, lower: 1, upper: 3 }], unit: '项', sourceClaimIds: ['C1'], caption: '给定测试区间。' };
  const panels = [{ id: 'legacy', title: '原有统计图', plot: true }, { id: 'named', title: '独立统计图', plotId: 'one' }];
  for (const order of [panels, [...panels].reverse()]) {
    const slide = authoredSlide({ plot: structuredClone(data), plots: [{ ...structuredClone(data), id: 'one' }], composition: { rows: [{ panels: order }] } });
    const page = buildScenes(project(slide)).pages[0];
    assert.deepEqual(errors(page), []);
    const estimates = page.nodes.filter(node => node.role === 'plot-estimate');
    assert.equal(estimates.length, 2);
    assert.ok(estimates.some(node => node.id.startsWith('s/data-plot/')));
    assert.ok(estimates.some(node => node.id.startsWith('s/plots/one/data-plot/')));
    assert.equal(new Set(page.nodes.map(node => node.id)).size, page.nodes.length);
  }
});

test('multiple rows honor measured long headings before placing actual card bodies', () => {
  const slide = authoredSlide({ cards: ['a', 'b', 'c', 'd'].map(id => authoredCard(id, { title: '测试说明', body: '保留输入。' })), composition: { rows: [{ panels: [{ id: 'one', title: '跨环境评价中的独立样本定义、原始分母说明和来源定位核验要求', cardIds: ['a'] }, { id: 'two', title: '比较组', cardIds: ['b'] }] }, { panels: [{ id: 'three', title: '输出核验', cardIds: ['c'] }, { id: 'four', title: '适用边界', cardIds: ['d'] }] }] } });
  const page = buildScenes(project(slide)).pages[0];
  assert.deepEqual(errors(page), []);
  const heading = find(page, '/composition/panel/one/title'), card = find(page, '/card/a/title');
  assert.ok(heading.lines.length >= 2);
  assert.ok(card.y >= heading.y + heading.estimatedTextHeight + 10);
  const rowOne = find(page, '/composition/panel/one/frame'), rowTwo = find(page, '/composition/panel/three/frame');
  assert.ok(rowTwo.y >= bottom(rowOne) + 17.9);
  assert.equal(find(page, '/composition/panel/two/frame').h, rowOne.h);
  assert.equal(find(page, '/card/a/title').y, find(page, '/card/b/title').y, 'wrapped headings share the row header baseline');
  assert.ok(page.nodes.filter(node => node.role === 'body').every(node => node.fontSize >= 24));
});

test('all three panel treatments retain native content without registering background overlaps', () => {
  for (const panel of ['band', 'tint', 'line']) {
    const slide = authoredSlide({ cards: [authoredCard('a'), authoredCard('b')], composition: { rows: [{ panels: [{ id: 'one', title: '输入条件', cardIds: ['a'] }, { id: 'two', title: '验证范围', cardIds: ['b'] }] }] } });
    const p = project(slide); p.design.system.panel = panel;
    const result = recording(p, slide);
    assert.deepEqual(errors(result.page), []);
    assert.equal(result.page.nodes.filter(node => node.role === 'panel-title').length, 2);
    assert.ok(result.regions.every(region => !['panel', 'panel-frame'].includes(region.type)));
    for (const card of slide.cards) assert.ok(hasPayload(result.page, card.body));
    if (panel === 'band') assert.equal(result.page.nodes.filter(node => node.role === 'panel-band').length, 2);
    if (panel === 'tint') assert.equal(result.page.nodes.filter(node => node.id.endsWith('/heading-fill')).length, 2);
    if (panel === 'line') assert.equal(result.page.nodes.filter(node => node.id.endsWith('/top-rule')).length, 2);
  }
});

test('explicit plain and compact card styles stay meaningful and unsupported frames are blocked', () => {
  const slide = authoredSlide({ cards: [authoredCard('plain', { style: 'plain' }), authoredCard('compact', { style: 'compact' })], composition: { rows: [{ panels: [{ id: 'one', title: '普通文字', cardIds: ['plain'] }, { id: 'two', title: '紧凑文字', cardIds: ['compact'] }] }] } });
  const p = project(slide), page = buildScenes(p).pages[0];
  assert.deepEqual(errors(page), []);
  assert.equal(find(page, '/card/plain/body').y - find(page, '/card/compact/body').y, 7);
  slide.cards[0].style = 'ledger';
  const before = structuredClone(p), invalid = buildScenes(p).pages[0];
  assert.ok(errors(invalid).some(issue => issue.code === 'composition-card-style' && issue.cardId === 'plain' && issue.requestedStyle === 'ledger'));
  assert.ok(hasPayload(invalid, slide.cards[0].body), 'the blocking diagnostic retains the authored text');
  assert.deepEqual(p, before);
});

test('missing, duplicate, conflicting and unassigned references are explicit blocking errors', () => {
  const slide = authoredSlide({ figureIds: ['A1', 'A2'], cards: [authoredCard('a'), authoredCard('unused')], chart: { kind: 'column', categories: ['一'], series: [{ name: '值', values: [1] }], unit: '项', sourceClaimId: 'C1' }, composition: { rows: [{ panels: [{ id: 'one', title: '重复内容', cardIds: ['a', 'missing'], figureIds: ['A1', 'not-on-slide'], chart: true }, { id: 'two', title: '重复引用', cardIds: ['a'], figureIds: ['A1'] }] }] } });
  const p = project(slide); p.assets = [authoredFigure('A1'), authoredFigure('A2')];
  const result = recording(p, slide), codes = new Set(errors(result.page).map(issue => issue.code));
  for (const code of ['composition-missing-card', 'composition-missing-figure-reference', 'composition-duplicate-card-reference', 'composition-duplicate-figure-reference', 'composition-multiple-primary-artifacts', 'composition-unassigned-card', 'composition-unassigned-figure', 'composition-unassigned-primary-artifact']) assert.ok(codes.has(code), code);
  assert.equal(result.calls.filter(call => call.kind === 'card' && call.id === 'a').length, 1);
  assert.equal(result.calls.filter(call => call.kind === 'figure' && call.id === 'A1').length, 1);
});

test('overfull text and unusually long source captions retain their exact content and font sizes', () => {
  const body = '必须保留独立样本、原始分母与适用范围。'.repeat(26), caption = '原图完整来源及定位信息'.repeat(35);
  const slide = authoredSlide({ figureIds: ['A1'], cards: [authoredCard('a', { body })], composition: { rows: [{ panels: [{ id: 'full', title: '内容过多的完整诊断页', figureIds: ['A1'], cardIds: ['a'] }] }], conclusion: { label: '边界', text: '保留这项原有结论。' } } });
  const p = project(slide); p.assets = [authoredFigure('A1', { displayCaption: caption })];
  const page = buildScenes(p).pages[0];
  assert.ok(errors(page).some(issue => issue.code === 'composition-page-overflow'));
  const bodyNode = find(page, '/card/a/body'), captionNode = page.nodes.find(node => node.role === 'caption');
  assert.equal(bodyNode.text, body);
  assert.equal(bodyNode.lines.join(''), body);
  assert.equal(bodyNode.fontSize, 24);
  assert.equal(captionNode.text, caption);
  assert.equal(captionNode.lines.join(''), caption);
  assert.equal(captionNode.fontSize, 18);
  assert.ok(captionNode.h > 108, 'long captions have their actual reserved height, not a hidden 108px cap');
  assert.ok(hasPayload(page, slide.composition.conclusion.text));
});

test('explicit card boxes stay exact and the evidence flow reserves their occupied interval', () => {
  const box = { x: 62, y: 520, w: 1156, h: 100 };
  const slide = authoredSlide({ figureIds: ['A1'], cards: [authoredCard('a', { title: '固定位置说明', body: '保留显式卡片坐标。', box })], composition: { rows: [{ panels: [{ id: 'one', title: '证据与说明', figureIds: ['A1'], cardIds: ['a'] }] }] } });
  const p = project(slide); p.assets = [authoredFigure('A1')];
  const result = recording(p, slide), call = result.calls.find(item => item.kind === 'card');
  assert.deepEqual(errors(result.page), []);
  assert.deepEqual(call.box, box);
  assert.ok(bottom(result.calls.find(item => item.kind === 'figure').box) <= box.y - 12 + .1);
  assert.deepEqual(slide.cards[0].box, box);
  p.slides[0].cards[0].box.x = 20;
  assert.ok(errors(recording(p, slide).page).some(issue => issue.code === 'composition-card-outside-panel'));
});

test('all metric qualifications survive compact panel text and impossible metric widths fail', () => {
  const metric = { value: '3/4', unit: '项', label: '固定输入计数', context: '分母是4个软件对象。' };
  const slide = authoredSlide({ cards: [authoredCard('metric', { title: '计数核验', body: '数据仅用于软件测试。', metric })], composition: { rows: [{ panels: [{ id: 'one', title: '原生指标与口径', cardIds: ['metric'] }] }] } });
  const p = project(slide), page = buildScenes(p).pages[0];
  assert.deepEqual(errors(page), []);
  for (const value of ['3/4 项', metric.label, metric.context, slide.cards[0].body]) assert.ok(hasPayload(page, value));
  assert.equal(find(page, '/card/metric/metric').fontSize, 38);
  slide.cards[0].metric.value = '1234567890'.repeat(7);
  const crowded = recording(p, slide).page;
  assert.ok(errors(crowded).some(issue => issue.code === 'composition-card-metric-width'));
  assert.ok(hasPayload(crowded, `${slide.cards[0].metric.value} 项`));
});

test('invalid ratios, unsupported fields and too many semantic panels cannot pass silently', () => {
  const slide = authoredSlide({ cards: [authoredCard('a')], composition: { rows: [{ weight: 0, panels: [{ id: 'one', title: '输入', weight: -1, cardIds: ['a'], unsupportedScientificText: '不得静默丢失这段输入。' }] }] } });
  const result = recording(project(slide), slide), codes = new Set(errors(result.page).map(issue => issue.code));
  assert.ok(codes.has('composition-row-weight'));
  assert.ok(codes.has('composition-panel-weight'));
  assert.ok(codes.has('composition-unsupported-field'));
  slide.composition.rows = Array.from({ length: 4 }, (_, index) => ({ panels: [{ id: `row-${index}`, title: '测试面板', cardIds: [] }] }));
  assert.ok(errors(recording(project(slide), slide).page).some(issue => issue.code === 'composition-structure'));
});

test('composition allocates the shared full diagram-label minimum before reporting page overflow', () => {
  const slide = authoredSlide({ nodes: [{ id: 'input', label: '固定输入', detail: '完整观测条件' }, { id: 'output', label: '关系核验', detail: '保留推断边界' }], edges: [{ from: 'input', to: 'output', label: '保留完整的连接限定条件\n第二行条件也须可读' }], diagram: { rows: [['input'], ['output']] }, composition: { rows: [{ panels: [{ id: 'mechanism', title: '关系与验证条件', diagram: true }] }] } });
  const p = project(slide); p.design.system.captionSize = 22;
  for (const height of [480, 160]) {
    const before = structuredClone(p), captures = [];
    const result = recording(p, slide, { contentBox: { x: 48, y: 136, w: 600, h: height }, diagram(builder, parent, data, area) {
      const measured = measureAcademicDiagramMinimum(data, area.w, { wrapText, measureTextWidth, system: builder.system });
      assert.ok(area.h >= measured.minimumHeight - 1e-6, 'the compositor cannot reserve the former fixed-gap estimate');
      const drawn = renderAcademicDiagram(builder, parent, data, area, { wrapText, measureTextWidth, semanticStyle: () => ({ accent: builder.p.accent }) });
      assert.equal(drawn.requiredHeight, measured.minimumHeight); captures.push({ area, measured });
    } });
    assert.deepEqual(p, before); assert.equal(captures.length, 1);
    assert.equal(errors(result.page).some(issue => issue.code === 'diagram-content-overflow'), false, 'row distribution must preserve the complete measured diagram');
    if (height === 480) assert.deepEqual(errors(result.page), []);
    else assert.ok(errors(result.page).some(issue => issue.code === 'composition-page-overflow'), 'insufficient slide height must be a visible blocking diagnostic');
    const edgeLabel = find(result.page, '/edge:0:label');
    assert.equal(edgeLabel.text, slide.edges[0].label); assert.equal(edgeLabel.fontSize, 22);
  }
});

test('optional panel controls preserve the exact legacy scene when inherited and stretched', () => {
  for (const panelStyle of ['band', 'tint', 'line']) {
    const slide = authoredSlide({ cards: [authoredCard('a')], composition: { rows: [{ panels: [{ id: 'one', title: '原有分组规则', cardIds: ['a'] }] }] } });
    const p = project(slide); p.design.system.panel = panelStyle;
    const original = buildScenes(p).pages[0];
    Object.assign(slide.composition.rows[0].panels[0], { surface: 'inherit', align: 'stretch' });
    assert.deepEqual(buildScenes(p).pages[0], original, `${panelStyle} must retain every legacy native object and coordinate`);
  }
});

test('authored panel surfaces preserve all scientific text and only change native furniture', () => {
  const bodies = new Set();
  for (const surface of ['plain', 'rule', 'tint', 'band']) {
    const slide = authoredSlide({ cards: [authoredCard('a', { title: '明确适用条件', body: '保留样本单位、比较基线与结论边界。' })], composition: { rows: [{ panels: [{ id: 'one', title: '条件与解释', surface, cardIds: ['a'] }] }] } });
    const p = project(slide), before = structuredClone(p), page = buildScenes(p).pages[0];
    assert.deepEqual(errors(page), []);
    for (const value of [slide.composition.rows[0].panels[0].title, slide.cards[0].title, slide.cards[0].body]) assert.ok(hasPayload(page, value), `${surface}: ${value}`);
    const groupNodes = page.nodes.filter(node => node.id.startsWith('s/composition/panel/one/'));
    const heading = groupNodes.find(node => node.role === 'panel-title');
    assert.equal(heading.fontSize, 26, 'surface changes cannot shrink the heading');
    assert.equal(heading.color, surface === 'band' ? '#FFFFFF' : surface === 'plain' ? p.design.palette.ink : p.design.palette.accent);
    if (surface === 'plain') assert.deepEqual(groupNodes.map(node => node.kind), ['text'], 'plain keeps the semantic heading without adding a border or backdrop');
    if (surface === 'rule') assert.equal(groupNodes.filter(node => node.kind === 'line').length, 3);
    if (surface === 'tint' || surface === 'band') assert.ok(groupNodes.some(node => node.role === 'panel-frame'));
    const body = find(page, '/card/a/body'); bodies.add(JSON.stringify({ text: body.text, lines: body.lines, size: body.fontSize, x: body.x, y: body.y, w: body.w, h: body.h }));
    assert.deepEqual(p, before, 'rendering must not rewrite source content');
  }
  assert.equal(bodies.size, 1, 'furniture choices do not alter authored text, body geometry or scientific meaning');
});

test('a short content-sized sidebar shares the baseline while the main evidence retains its full area', () => {
  const chart = { kind: 'bar', categories: ['条件一', '条件二'], series: [{ name: '计数', values: [3, 2] }], unit: '项', sourceClaimId: 'C1' };
  const slide = authoredSlide({ chart, cards: [authoredCard('scope', { title: '适用范围', body: '仅覆盖这两个预定条件。' })], composition: { rows: [{ panels: [
    { id: 'evidence', title: '同条件比较', weight: 1.8, surface: 'plain', chart: true },
    { id: 'scope', title: '解释边界', weight: 1, surface: 'tint', align: 'start', cardIds: ['scope'] },
  ] }] } });
  const p = project(slide), before = structuredClone(p), page = buildScenes(p).pages[0];
  assert.deepEqual(errors(page), []);
  const evidence = page.nodes.find(node => node.kind === 'chart'), sidebar = find(page, '/composition/panel/scope/frame');
  assert.ok(evidence.h > sidebar.h * 1.8, 'the main comparison keeps the surplus row height');
  assert.ok(bottom(sidebar) < bottom(evidence), 'the sidebar ends after its complete content instead of stretching to match evidence');
  assert.equal(find(page, '/composition/panel/evidence/title').y, find(page, '/composition/panel/scope/title').y);
  assert.ok(bottom(find(page, '/card/scope/body')) <= bottom(sidebar));
  assert.deepEqual(evidence.chart, chart, 'all values, units and source identity reach the native chart unchanged');
  assert.equal(find(page, '/card/scope/body').text, slide.cards[0].body);
  assert.equal(find(page, '/card/scope/body').fontSize, 24);
  assert.deepEqual(p, before);
});

test('content-sized panels keep multi-line headings, qualifiers and stacked card text inside their frame', () => {
  const metric = { value: '3/4', unit: '项', label: '固定输入计数', context: '分母为四项独立软件输入。' };
  const slide = authoredSlide({ cards: [authoredCard('a', { title: '计数与口径', metric }), authoredCard('b', { title: '解释边界', body: '没有外推到其他输入。' })], composition: { rows: [{ panels: [{ id: 'scope', title: '完整限定和不同论证层级\n共同保持可读', surface: 'tint', align: 'start', cardIds: ['a', 'b'] }] }] } });
  const p = project(slide), page = buildScenes(p).pages[0];
  assert.deepEqual(errors(page), []);
  const frame = find(page, '/composition/panel/scope/frame');
  for (const value of [metric.label, metric.context, slide.cards[0].body, slide.cards[1].body]) assert.ok(hasPayload(page, value));
  assert.ok(bottom(find(page, '/card/b/body')) <= bottom(frame));
  const firstBody = find(page, '/card/a/body'), secondTitle = find(page, '/card/b/title');
  assert.ok(secondTitle.y > bottom(firstBody));
  assert.equal(firstBody.fontSize, 24);
  assert.equal(find(page, '/card/a/metric').fontSize, 38);
});

test('unsupported surfaces and alignment conflicts produce blocking diagnostics without moving absolute cards', () => {
  const box = { x: 62, y: 520, w: 1156, h: 100 };
  const slide = authoredSlide({ cards: [authoredCard('a', { box })], composition: { rows: [{ panels: [{ id: 'scope', title: '显式几何', surface: 'glass', align: 'start', cardIds: ['a'] }] }] } });
  const p = project(slide), result = recording(p, slide);
  assert.ok(errors(result.page).some(issue => issue.code === 'composition-panel-surface'));
  assert.ok(errors(result.page).some(issue => issue.code === 'composition-panel-align-box-conflict'));
  assert.deepEqual(result.calls.find(call => call.kind === 'card').box, box, 'a failed start alignment preserves the requested absolute geometry');
  slide.composition.rows[0].panels[0].align = 'center';
  assert.ok(errors(recording(p, slide).page).some(issue => issue.code === 'composition-panel-align'));
});

test('content-sized diagram panels reject absolute nodes and preserve their authored geometry', () => {
  const box = { x: 62, y: 500, w: 600, h: 100 };
  const slide = authoredSlide({ layout: 'academic', nodes: [{ id: 'n', label: 'Kept at authored position', box }], composition: { rows: [{ panels: [{ id: 'diagram', title: 'Diagram panel', surface: 'tint', align: 'stretch', diagram: true }] }] } });
  const p = project(slide), stretched = buildScenes(p).pages[0];
  assert.deepEqual(errors(stretched), []);
  slide.composition.rows[0].panels[0].align = 'start';
  const before = structuredClone(p), page = buildScenes(p).pages[0];
  const issue = errors(page).find(item => item.code === 'composition-panel-align-box-conflict');
  assert.ok(issue, 'absolute nodes cannot escape a compact frame without a blocking diagnostic');
  assert.equal(issue.panelId, 'diagram');
  assert.match(issue.message, /node\.box/);
  const node = find(page, '/node:n:frame'), frame = find(page, '/composition/panel/diagram/frame');
  assert.deepEqual({ x: node.x, y: node.y, w: node.w, h: node.h }, box);
  assert.deepEqual(node, find(stretched, '/node:n:frame'), 'the diagnostic must not relocate or resize authored scientific nodes');
  assert.deepEqual(frame, find(stretched, '/composition/panel/diagram/frame'), 'failed compact alignment keeps the original stretched frame for inspection');
  assert.ok(bottom(node) <= bottom(frame));
  assert.deepEqual(p, before);
  delete slide.nodes[0].box;
  assert.deepEqual(errors(buildScenes(p).pages[0]), [], 'automatic diagram geometry can still use content-sized alignment');
});

test('content-sized alignment cannot hide overfull scientific qualifiers', () => {
  const body = '独立样本、预定对照与不确定区间必须保持完整。'.repeat(34);
  const slide = authoredSlide({ cards: [authoredCard('a', { body })], composition: { rows: [{ panels: [{ id: 'scope', title: '必须拆页的长解释', surface: 'plain', align: 'start', cardIds: ['a'] }] }] } });
  const page = buildScenes(project(slide)).pages[0];
  assert.ok(errors(page).some(issue => issue.code === 'composition-page-overflow'));
  const node = find(page, '/card/a/body');
  assert.equal(node.text, body);
  assert.equal(node.lines.join(''), body);
  assert.equal(node.fontSize, 24);
});
