import test from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import { measureScientificPlotMinimum, renderScientificPlot } from '../src/scientific-plot.mjs';
import { measureTextWidth, wrapText } from '../src/scene.mjs';
import { renderProject, sceneToSvg } from '../src/render.mjs';

const metrics = { fontFamily: 'Noto Sans CJK SC', wrapText, measureTextWidth };
const box = { x: 40, y: 150, w: 600, h: 400 };
const wide = { x: 40, y: 160, w: 1100, h: 350 };
const distribution = (groups, more = {}) => ({ kind: 'distribution', unit: 'ms', groups, sourceClaimIds: ['observations'], ...more });
const intervals = (groups, more = {}) => ({ kind: 'interval', unit: 'kg', groups, sourceClaimIds: ['estimated-effects'], ...more });

function builder(system = {}) {
  const page = { id: 'scientific', title: 'Synthetic renderer regression', background: '#FFFFFF', nodes: [], issues: [] };
  const regions = [];
  const add = (kind, key, props) => {
    const node = { ...props, kind, id: `${page.id}/${key}` };
    page.nodes.push(node); return node;
  };
  const b = {
    page, regions, system,
    p: { accent: '#164B7B', ink: '#17202A', muted: '#526071', line: '#CCD5DF' },
    add,
    region: (key, frame, type) => regions.push({ id: `${page.id}/${key}`, ...frame, type }),
    line: (key, x1, y1, x2, y2, stroke, more = {}) => add('line', key, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, stroke, ...more }),
    text: (key, text, frame, fontSize, more = {}) => add('text', key, {
      ...frame, text, fontSize, lines: wrapText(text, frame.w, fontSize, { bold: more.bold }),
      estimatedLineWidths: wrapText(text, frame.w, fontSize, { bold: more.bold }).map(line => measureTextWidth(line, fontSize, { bold: more.bold })),
      ...more,
    }),
  };
  return b;
}

const byRole = (b, role) => b.page.nodes.filter(node => node.role === role);
const centerX = node => node.x + node.w / 2;
const centerY = node => node.y + node.h / 2;
const approx = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const mapped = (result, value) => result.plotBox.x + (value - result.domain.min) / (result.domain.max - result.domain.min) * result.plotBox.w;

function assertContained(b, frame) {
  for (const node of b.page.nodes) {
    const x1 = Math.min(node.x, node.x + node.w), x2 = Math.max(node.x, node.x + node.w);
    const y1 = Math.min(node.y, node.y + node.h), y2 = Math.max(node.y, node.y + node.h);
    assert.ok(x1 >= frame.x - .01 && x2 <= frame.x + frame.w + .01, `${node.id} outside horizontal frame`);
    assert.ok(y1 >= frame.y - .01 && y2 <= frame.y + frame.h + .01, `${node.id} outside vertical frame`);
    if (node.kind === 'text') {
      assert.ok(node.fontSize >= 18);
      assert.ok(node.lines.length * node.fontSize * node.lineHeight <= node.h + .01);
      assert.ok(node.estimatedLineWidths.every(width => width <= node.w + .5));
    }
  }
}

test('unequal signed distributions preserve every observation and exact x mapping without connecting points', () => {
  const data = distribution([
    { label: 'Group A', values: [5, -9, 0, -4, 5] },
    { label: 'Group B', values: [-11, 2] },
    { label: 'Group C', values: [1, 6, -2] },
  ], { reference: -3, caption: 'Synthetic observations with unequal group sizes.' });
  const before = structuredClone(data), b = builder(), result = renderScientificPlot(b, data, box, metrics);
  assert.equal(result.failed, false);
  assert.deepEqual(b.page.issues, []);
  assert.deepEqual(data, before);
  assert.equal(byRole(b, 'plot-observation').length, 10);
  for (const [groupIndex, group] of data.groups.entries()) {
    const points = byRole(b, 'plot-observation').filter(node => node.groupIndex === groupIndex);
    assert.deepEqual(points.map(point => point.value), group.values);
    points.forEach(point => approx(centerX(point), mapped(result, point.value)));
    assert.deepEqual(byRole(b, 'plot-group-label')[groupIndex].value, group.values);
  }
  assert.equal(byRole(b, 'plot-interval').length, 0);
  assert.ok(b.page.nodes.every(node => ['line', 'ellipse', 'text'].includes(node.kind)));
  assert.ok(b.page.nodes.filter(node => node.kind === 'line').every(node => ['plot-axis', 'plot-axis-tick', 'plot-reference', 'plot-grid'].includes(node.role)));
  assert.equal(b.regions.length, 1);
  assert.equal(b.regions[0].id, 'scientific/data-plot-region');
  assert.ok(b.page.nodes.every(node => node.id.startsWith('scientific/data-plot/')));
  assert.match(byRole(b, 'plot-reading-note')[0].text, /纵向错位仅防重叠/);
  approx(byRole(b, 'plot-reference')[0].x, mapped(result, -3));
  assertContained(b, box);
});

test('intervals draw literal estimates and bounds on one signed horizontal axis with zero reference', () => {
  const b = builder(), data = intervals([
    { label: 'North', estimate: -2, lower: -5, upper: 1 },
    { label: 'South', estimate: -8, lower: -10, upper: -7 },
    { label: 'West', estimate: 4, lower: 4, upper: 4 },
  ]), result = renderScientificPlot(b, data, box, metrics);
  assert.equal(result.failed, false);
  assert.deepEqual(b.page.issues, []);
  assert.equal(byRole(b, 'plot-reference').length, 1);
  assert.equal(byRole(b, 'plot-reference')[0].value, 0);
  assert.equal(byRole(b, 'plot-reference')[0].w, 0);
  for (const [index, group] of data.groups.entries()) {
    const interval = byRole(b, 'plot-interval')[index], point = byRole(b, 'plot-estimate')[index];
    approx(interval.x, mapped(result, group.lower));
    approx(interval.x + interval.w, mapped(result, group.upper));
    approx(centerX(point), mapped(result, group.estimate));
    approx(centerY(point), interval.y);
    assert.equal(point.value, group.estimate);
    assert.equal(interval.lower, group.lower);
    assert.equal(interval.upper, group.upper);
    const label = byRole(b, 'plot-value-label')[index];
    assert.equal(label.value, group.estimate);
    assert.match(label.text, /\[.*\]/);
    assert.deepEqual(point.sourceClaimIds, ['estimated-effects']);
  }
  assert.ok(!b.page.nodes.some(node => /95%|因果|显著|均值/.test(node.text || '')));
  assertContained(b, box);
});

test('explicit reference replaces default zero and expands the numeric domain without modifying data', () => {
  const b = builder(), data = intervals([{ label: 'Trial', estimate: 8, lower: 6, upper: 9 }], { reference: 20 });
  const before = structuredClone(data), result = renderScientificPlot(b, data, wide, metrics);
  assert.equal(result.failed, false);
  assert.ok(result.domain.max >= 20);
  assert.equal(byRole(b, 'plot-reference')[0].value, 20);
  approx(byRole(b, 'plot-reference')[0].x, mapped(result, 20));
  assert.deepEqual(data, before);
  assertContained(b, wide);
});

test('all-negative and degenerate constant distributions have finite ordered domains', () => {
  for (const values of [[-30, -20, -10], [-7, -7, -7], [0, 0, 0], [2e-7, 2e-7]]) {
    const b = builder(), result = renderScientificPlot(b, distribution([{ label: 'Sample', values }]), box, metrics);
    assert.equal(result.failed, false, values.join(','));
    assert.ok(Number.isFinite(result.domain.min) && Number.isFinite(result.domain.max));
    assert.ok(result.domain.max > result.domain.min);
    assert.ok(result.domain.min <= Math.min(...values) && result.domain.max >= Math.max(...values));
    byRole(b, 'plot-observation').forEach(point => approx(centerX(point), mapped(result, point.value)));
    assert.equal(byRole(b, 'plot-reference').length, 0);
    assertContained(b, box);
  }
});

test('eight groups of one hundred well-separated observations are all retained in a wide plot', () => {
  const data = distribution(Array.from({ length: 8 }, (_, group) => ({ label: `G${group + 1}`, values: Array.from({ length: 100 }, (_, point) => point * 5 + group * .2 - 250) })));
  const b = builder(), result = renderScientificPlot(b, data, wide, metrics);
  assert.equal(result.failed, false);
  assert.deepEqual(b.page.issues, []);
  assert.equal(byRole(b, 'plot-observation').length, 800);
  assert.equal(new Set(b.page.nodes.map(node => node.id)).size, b.page.nodes.length);
  assert.equal(b.regions.length, 1);
  for (const [groupIndex, group] of data.groups.entries()) {
    const actual = byRole(b, 'plot-observation').filter(point => point.groupIndex === groupIndex);
    assert.deepEqual(actual.map(point => point.value), group.values);
  }
  assertContained(b, wide);
});

test('packing is deterministic, preserves duplicate values and never shifts numeric x', () => {
  const data = distribution([{ label: 'Replicates', values: [-2, -2, -2, -1.99, 4, 4] }]);
  const first = builder(), second = builder();
  const result = renderScientificPlot(first, data, box, metrics);
  renderScientificPlot(second, data, box, metrics);
  assert.equal(result.failed, false);
  assert.deepEqual(first.page.nodes, second.page.nodes);
  const points = byRole(first, 'plot-observation');
  for (let i = 0; i < points.length; i++) {
    approx(centerX(points[i]), mapped(result, points[i].value));
    for (let j = i + 1; j < points.length; j++) assert.ok(Math.hypot(centerX(points[i]) - centerX(points[j]), centerY(points[i]) - centerY(points[j])) >= 8 - 1e-7);
  }
});

test('invalid interval bounds, missing observations and nonfinite data fail without partial plots', () => {
  const invalid = [
    intervals([{ label: 'A', estimate: 3, lower: 4, upper: 7 }]),
    intervals([{ label: 'A', estimate: 8, lower: 4, upper: 7 }]),
    intervals([{ label: 'A', estimate: 8, lower: 4 }]),
    distribution([{ label: 'A', values: [] }]),
    distribution([{ label: 'A', values: [1, Number.NaN] }]),
    distribution([{ label: 'A', values: [1, Infinity] }]),
    distribution([{ label: 'A', values: Array(101).fill(1) }]),
    distribution([{ label: 'A', values: [1] }], { sourceClaimIds: [] }),
    distribution([{ label: 'A', values: [1] }], { reference: Infinity }),
  ];
  for (const data of invalid) {
    const b = builder(), before = structuredClone(data), result = renderScientificPlot(b, data, box, metrics);
    assert.equal(result.failed, true);
    assert.ok(b.page.issues.some(issue => issue.severity === 'error'));
    assert.deepEqual(b.page.nodes, []);
    assert.deepEqual(b.regions, []);
    assert.deepEqual(data, before);
  }
});

test('a dense cluster fails explicitly instead of dropping observations or reducing marker size', () => {
  const data = distribution([{ label: 'Dense', values: Array(100).fill(2) }]), b = builder();
  const result = renderScientificPlot(b, data, box, metrics);
  assert.equal(result.failed, true);
  assert.ok(b.page.issues.some(issue => issue.code === 'plot-observation-density'));
  assert.equal(data.groups[0].values.length, 100);
  assert.deepEqual(b.page.nodes, []);
});

test('wrapped captions, group names and literal interval values stay inside the assigned box', () => {
  const b = builder({ bodySize: 24, captionSize: 20 });
  const data = intervals([
    { label: 'Long experimental group name', estimate: -1.125, lower: -2.375, upper: .0625 },
    { label: '第二组完整名称', estimate: 1.5, lower: .3, upper: 2.125 },
  ], { caption: '这段图注明确描述输入区间，完整保留来源限制与测量条件，不新增统计结论。' });
  const result = renderScientificPlot(b, data, { ...box, h: 470 }, metrics);
  assert.equal(result.failed, false);
  assert.ok(byRole(b, 'plot-group-label')[0].lines.length > 1);
  assert.equal(byRole(b, 'plot-value-label')[0].text, '−1.125 [−2.375, 0.0625]');
  assert.equal(byRole(b, 'caption')[0].text, data.caption);
  assert.equal(byRole(b, 'plot-group-label')[0].fontSize, 24);
  assert.equal(byRole(b, 'plot-value-label')[0].fontSize, 20);
  assertContained(b, { ...box, h: 470 });
});

test('oversized captions and group labels trigger layout errors rather than clipping or smaller fonts', () => {
  for (const data of [
    distribution([{ label: 'A', values: [1, 2] }], { caption: '保留全部限定条件和说明。'.repeat(60) }),
    intervals(Array.from({ length: 8 }, (_, index) => ({ label: `必须完整显示且不能缩小字号的长组名称${index}`, estimate: 1, lower: 0, upper: 2 }))),
  ]) {
    const b = builder(), before = structuredClone(data), result = renderScientificPlot(b, data, box, metrics);
    assert.equal(result.failed, true);
    assert.ok(b.page.issues.some(issue => ['plot-caption-overflow', 'plot-group-density'].includes(issue.code)));
    assert.deepEqual(data, before);
    assert.deepEqual(b.page.nodes, []);
  }
});

test('system font sizes respect the 18px floor and the supplied font family', () => {
  const b = builder({ bodySize: 15, captionSize: 12, fontFamily: 'Fallback Face' });
  const result = renderScientificPlot(b, intervals([{ label: 'A', estimate: 1, lower: -1, upper: 3 }]), box, { ...metrics, fontFamily: 'Selected Face' });
  assert.equal(result.failed, false);
  assert.ok(b.page.nodes.filter(node => node.kind === 'text').every(node => node.fontSize === 18 && node.fontFamily === 'Selected Face'));
});

test('tick labels remain distinct for small and large numeric scales', () => {
  for (const values of [[-2e8, 1e8, 4e8], [-2e-8, 1e-8, 4e-8], [-.002, -.001, -.0005]]) {
    const b = builder(), result = renderScientificPlot(b, distribution([{ label: 'Scale', values }]), box, metrics);
    assert.equal(result.failed, false);
    const labels = byRole(b, 'plot-axis-label');
    assert.equal(new Set(labels.map(label => label.text)).size, labels.length);
    for (let index = 1; index < labels.length; index++) assert.ok(labels[index].x >= labels[index - 1].x + labels[index - 1].w + 7.99);
    assertContained(b, box);
  }
});

test('ticks near a large baseline retain their distinct values rather than applying display rounding', () => {
  const b = builder(), values = [1e12 + 1, 1e12 + 2, 1e12 + 3];
  const result = renderScientificPlot(b, distribution([{ label: 'Offset', values }]), wide, metrics);
  assert.equal(result.failed, false);
  const labels = byRole(b, 'plot-axis-label');
  assert.equal(new Set(labels.map(label => label.text)).size, labels.length);
  labels.forEach(label => assert.equal(Number(label.text.replace('−', '-')), label.value));
  byRole(b, 'plot-observation').forEach(point => approx(centerX(point), mapped(result, point.value)));
  assert.deepEqual(byRole(b, 'plot-observation').map(point => point.value), values);
  assertContained(b, wide);
});

test('one semantic region and primitive shapes export through the shared SVG renderer', () => {
  const b = builder(), result = renderScientificPlot(b, intervals([{ label: 'A', estimate: -.5, lower: -2, upper: 3 }]), box, metrics);
  assert.equal(result.failed, false);
  const svg = sceneToSvg(b.page);
  assert.match(svg, /<ellipse/);
  assert.match(svg, /<line/);
  assert.match(svg, /data-object-id="scientific\/data-plot\/group\/0\/estimate"/);
  assert.doesNotMatch(svg, /<image|<polyline/);
  const before = b.page.nodes.length;
  const duplicate = renderScientificPlot(b, intervals([{ label: 'B', estimate: 0, lower: -1, upper: 1 }]), wide, metrics);
  assert.equal(duplicate.failed, true);
  assert.equal(b.regions.length, 1);
  assert.equal(b.page.nodes.length, before);
  assert.ok(b.page.issues.some(issue => issue.code === 'plot-duplicate-region'));
});

test('integrated results pages export editable native observations, interval bounds and labels to PPTX', async () => {
  const common = { layout: 'results', paperIds: [], claimIds: [], figureIds: [], cards: [], notes: 'Synthetic renderer regression only.', seconds: 60 };
  const project = {
    title: 'Native scientific plot regression', brief: { centralQuestion: 'Explicit observations and intervals' },
    design: { fontFamily: 'Noto Sans CJK SC' }, papers: [], claims: [], assets: [],
    slides: [
      { ...common, id: 'points', title: 'Independent observations', plot: distribution([{ label: 'A', values: [-3, 1, 1, 5] }, { label: 'B', values: [-2, 2, 4] }]) },
      { ...common, id: 'bounds', title: 'Supplied intervals', plot: intervals([{ label: 'A', estimate: -2, lower: -5, upper: 1 }, { label: 'B', estimate: 3, lower: 2, upper: 5 }]) },
    ],
  };
  const out = await renderProject(project), files = unzipSync(out.pptx);
  assert.deepEqual(out.issues.filter(issue => issue.severity === 'error'), []);
  const points = strFromU8(files['ppt/slides/slide1.xml']), bounds = strFromU8(files['ppt/slides/slide2.xml']);
  assert.equal([...points.matchAll(/prst="ellipse"/g)].length, 7);
  assert.equal([...bounds.matchAll(/prst="ellipse"/g)].length, 2);
  assert.match(points, /points\/data-plot\/group\/0\/point\/0/);
  assert.match(bounds, /bounds\/data-plot\/group\/0\/lower/);
  assert.match(bounds, /bounds\/data-plot\/group\/0\/upper/);
  assert.match(bounds, /bounds\/data-plot\/reference/);
  assert.match(bounds, /bounds\/data-plot\/group\/0\/value-label/);
  assert.doesNotMatch(points + bounds, /<p:pic>|<c:chart|<a:(?:normAutofit|spAutoFit)/);
});

test('measured minimum height is sufficient for native rendering and one pixel less is rejected', () => {
  const cases = [
    distribution([{ label: 'Observed sample', values: [-2, -2, -2, -2, -2, 5] }, { label: '另一组完整标签', values: [-5, 1, 3] }], { caption: '完整观测数据的显示方式与输入来源均保持不变。' }),
    intervals([{ label: 'A longer group label', estimate: -2.125, lower: -4.0625, upper: .375 }, { label: '另一组', estimate: 3, lower: 2, upper: 4 }], { caption: '这里显示作者输入的区间，不自动推断其置信水平或统计方法。' }),
    distribution(Array.from({ length: 8 }, (_, index) => ({ label: `G${index}`, values: Array.from({ length: 100 }, (_, point) => point * 5 + index * .2 - 200) }))),
  ];
  const system = { bodySize: 24, captionSize: 20 };
  for (const data of cases) for (const width of [600, 1100]) {
    const measured = measureScientificPlotMinimum(data, width, { ...metrics, system });
    assert.ok(Number.isFinite(measured.minimumHeight));
    assert.deepEqual(measured.issues, []);
    const frame = { x: 31, y: 23, w: width, h: measured.minimumHeight }, b = builder(system);
    const result = renderScientificPlot(b, data, frame, metrics);
    assert.equal(result.failed, false, JSON.stringify(measured));
    assert.deepEqual(b.page.issues, []);
    assertContained(b, frame);
    const tooShort = builder(system);
    assert.equal(renderScientificPlot(tooShort, data, { ...frame, h: frame.h - 1 }, metrics).failed, true);
    assert.ok(tooShort.page.issues.some(issue => issue.severity === 'error' && issue.requiredHeight === measured.minimumHeight));
    assert.deepEqual(tooShort.page.nodes, []);
  }
});

test('minimum measurement includes wrapped group labels, reading note, numeric labels, unit and full caption', () => {
  const base = intervals([{ label: 'A', estimate: 2, lower: -1, upper: 3 }]);
  const measure = data => measureScientificPlotMinimum(data, 600, metrics);
  const initial = measure(base);
  const longGroup = measure({ ...base, groups: [{ ...base.groups[0], label: '必须完整显示的实验组名称与测量条件说明' }] });
  const longNumbers = measure({ ...base, groups: [{ label: 'A', estimate: 1.12345678901234, lower: -9.12345678901234, upper: 3.12345678901234 }] });
  const longUnit = measure({ ...base, unit: '每单位观测时间内记录的完整数值量纲与换算口径说明' });
  const caption = '保留图注中所有范围、条件和来源说明。'.repeat(8);
  const withCaption = measure({ ...base, caption });
  for (const expanded of [longGroup, longNumbers, longUnit, withCaption]) {
    assert.deepEqual(expanded.issues, []);
    assert.ok(expanded.minimumHeight > initial.minimumHeight);
  }
  const wideCaption = measureScientificPlotMinimum({ ...base, caption }, 1100, metrics);
  assert.ok(wideCaption.minimumHeight < withCaption.minimumHeight);
  const narrow = measureScientificPlotMinimum(distribution([{ label: 'A', values: [1, 2] }]), 400, metrics);
  const wideNote = measureScientificPlotMinimum(distribution([{ label: 'A', values: [1, 2] }]), 1100, metrics);
  assert.ok(narrow.minimumHeight > wideNote.minimumHeight, 'the distribution reading note must contribute its actual wrapped height');
  assert.notEqual(initial.minimumHeight, 180);
});

test('minimum measurement preserves input and reflects supplied system fonts without creating a builder', () => {
  const freeze = value => {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  };
  const data = freeze(distribution([{ label: 'Exact source label', values: [-2, 0, 3] }], { caption: 'Unchanged caption.' }));
  const before = structuredClone(data), system = freeze({ bodySize: 26, captionSize: 22, fontFamily: 'Selected Face' });
  const measured = measureScientificPlotMinimum(data, 600, { ...metrics, system });
  const smaller = measureScientificPlotMinimum(data, 600, { ...metrics, system: { bodySize: 18, captionSize: 18 } });
  assert.deepEqual(measured.issues, []);
  assert.ok(measured.minimumHeight > smaller.minimumHeight);
  assert.deepEqual(data, before);
  assert.deepEqual(Object.keys(measured).sort(), ['issues', 'minimumHeight']);
  assert.deepEqual(measureScientificPlotMinimum(data, 600, { ...metrics, system }), measured);
});

test('minimum height accounts for actual point packing and rejects clusters that height cannot solve', () => {
  const ordinary = distribution([{ label: 'A', values: [1, 2, 3, 4, 5] }]);
  const repeated = distribution([{ label: 'A', values: [2, 2, 2, 2, 2] }]);
  const minimum = measureScientificPlotMinimum(ordinary, 600, metrics);
  const stacked = measureScientificPlotMinimum(repeated, 600, metrics);
  assert.ok(stacked.minimumHeight > minimum.minimumHeight);
  const impossible = distribution([{ label: 'A', values: Array(100).fill(2) }]);
  const rejected = measureScientificPlotMinimum(impossible, 1100, metrics);
  assert.equal(rejected.minimumHeight, null);
  assert.ok(rejected.issues.some(issue => issue.code === 'plot-observation-density' && issue.severity === 'error'));
  assert.equal(impossible.groups[0].values.length, 100);
});

test('minimum measurement exposes invalid data, metrics and width as blocking issues without fallback heights', () => {
  const valid = intervals([{ label: 'A', estimate: 1, lower: -1, upper: 2 }]);
  const cases = [
    [intervals([{ label: 'A', estimate: 5, lower: -1, upper: 2 }]), 600, metrics],
    [valid, 180, metrics],
    [valid, Number.NaN, metrics],
    [valid, 600, {}],
  ];
  for (const [data, width, options] of cases) {
    const result = measureScientificPlotMinimum(data, width, options);
    assert.equal(result.minimumHeight, null);
    assert.ok(result.issues.length > 0);
    assert.ok(result.issues.every(issue => issue.severity === 'error'));
    assert.ok(result.issues.every(issue => !('slideId' in issue) && !('objectId' in issue)));
  }
});
