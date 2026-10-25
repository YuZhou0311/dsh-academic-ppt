import test from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import { contentCoverageReport } from '../src/evidence-design.mjs';
import { renderProject } from '../src/render.mjs';

const chart = (overrides = {}) => ({
  kind: 'column', categories: ['Control', 'Treatment'],
  series: [{ name: 'Unshown single-series name', values: [1.23456, -2.376] }],
  unit: 'kg/ha', sourceClaimId: 'synthetic', ...overrides,
});
const coverage = (chart, texts) => {
  const project = { slides: [{ id: 's', contentChecks: texts.map((text, i) => ({ id: 'check-' + i, text })) }] };
  const scenes = { pages: [{ id: 's', nodes: [{ kind: 'chart', chart }] }] };
  return contentCoverageReport(project, scenes).slides[0].checks.map(check => check.visible);
};
const project = chart => ({
  schemaVersion: 1, id: 'visible-chart-fixture', revision: 0, title: 'Synthetic chart-label fixture',
  brief: { centralQuestion: 'Do visible labels match the required text?', talkMinutes: 1 },
  design: {}, papers: [], claims: [], assets: [], history: [],
  slides: [{ id: 's', layout: 'results', title: 'Visible chart labels', figureIds: [], cards: [], notes: '', chart }],
});
const chartXml = output => {
  const archive = unzipSync(output.pptx);
  return strFromU8(archive[Object.keys(archive).find(path => /^ppt\/charts\/chart\d+\.xml$/.test(path))]);
};

test('coverage uses displayed chart precision, including zero decimals and trailing zeroes', () => {
  for (const kind of ['bar', 'column']) {
    assert.deepEqual(coverage(chart({ kind, valueDecimals: 0 }), ['1', '-2', '1.23456', '-2.376']), [true, true, false, false]);
    assert.deepEqual(coverage(chart({ kind, valueDecimals: 2 }), ['1.23', '-2.38', '1.23456', '-2.376']), [true, true, false, false]);
    const padded = chart({ kind, valueDecimals: 2, series: [{ name: 'Value', values: [1.2, 2.3] }] });
    assert.deepEqual(coverage(padded, ['1.20', '2.30', '1.2', '2.3']), [true, true, false, false]);
    assert.deepEqual(coverage(chart({ kind }), ['1.23456', '-2.376']), [true, true]);
  }
});

test('coverage counts categories, units and shown legends but excludes hidden series names and line values', () => {
  for (const kind of ['bar', 'column', 'line']) {
    assert.deepEqual(coverage(chart({ kind, valueDecimals: 2 }), ['Control', 'Treatment', 'kg/ha', 'Unshown single-series name']), [true, true, true, false]);
    const multiple = chart({ kind, series: [{ name: 'Observed', values: [1.23456, -2.376] }, { name: 'Modelled', values: [1.1, 2.2] }] });
    assert.deepEqual(coverage(multiple, ['Observed', 'Modelled']), [true, true]);
  }
  assert.deepEqual(coverage(chart({ kind: 'line', valueDecimals: 2 }), ['1.23456', '-2.376', '1.23', '-2.38']), [false, false, false, false]);
});

test('coverage and SVG use the native chart label format without rounding source data', async () => {
  for (const { valueDecimals, labels } of [{ valueDecimals: 0, labels: ['1', '-2'] }, { valueDecimals: 2, labels: ['1.23', '-2.38'] }]) {
    const p = project(chart({ valueDecimals }));
    const before = structuredClone(p), output = await renderProject(p), xml = chartXml(output);
    p.slides[0].contentChecks = [...labels, '1.23456', '-2.376'].map((text, i) => ({ id: 'check-' + i, text }));
    assert.deepEqual(contentCoverageReport(p, output.scenes).slides[0].checks.map(check => check.visible), [true, true, false, false]);
    for (const label of labels) assert.ok(output.svgPages[0].svg.includes('>' + label + '</text>'));
    assert.ok(xml.includes('formatCode="' + (valueDecimals ? '0.00' : '0') + '"'));
    assert.match(xml, /<c:showVal val="1"/);
    assert.match(xml, /<c:v>1\.23456<\/c:v>/);
    assert.match(xml, /<c:v>-2\.376<\/c:v>/);
    delete p.slides[0].contentChecks;
    assert.deepEqual(p, before, 'formatting and checking must preserve editable source observations');
  }
});

test('default and explicit chart labels match native decimal rounding and never display negative zero', async () => {
  const cases = [
    { values: [1.23456789012345, 1e-7, -1e-13, -0], labels: ['1.234567890123', '0.0000001', '0', '0'],
      hidden: ['1.23456789012345', '1e-7', '-1e-13', '-0'], format: '0.############' },
    { valueDecimals: 0, values: [-0.49, 0.49, -1.5, 1.5], labels: ['0', '0', '-2', '2'],
      hidden: ['-0', '-0.49', '0.49', '-1.5', '1.5'], format: '0' },
    { valueDecimals: 2, values: [-0.004, 2.675, 1.005, -2.675], labels: ['0.00', '2.68', '1.01', '-2.68'],
      hidden: ['-0.00', '-0.004', '2.675', '1.005', '-2.675'], format: '0.00' },
    { valueDecimals: 8, values: [1.234567895, -4e-9, -5e-9, 1.00000001], labels: ['1.23456790', '0.00000000', '-0.00000001', '1.00000001'],
      hidden: ['-0.00000000', '1.234567895', '-4e-9', '-5e-9'], format: '0.00000000' },
  ];
  for (const item of cases) {
    const p = project(chart({ categories: ['A', 'B', 'C', 'D'], series: [{ name: 'Synthetic observations', values: item.values }],
      ...(item.valueDecimals === undefined ? {} : { valueDecimals: item.valueDecimals }) }));
    const before = structuredClone(p), output = await renderProject(p), xml = chartXml(output);
    const archive = unzipSync(output.pptx);
    const workbook = unzipSync(archive[Object.keys(archive).find(path => /^ppt\/embeddings\/.*\.xlsx$/.test(path))]);
    const cells = strFromU8(workbook['xl/worksheets/sheet1.xml']);
    p.slides[0].contentChecks = [...item.labels, ...item.hidden].map((text, i) => ({ id: 'check-' + i, text }));
    assert.deepEqual(contentCoverageReport(p, output.scenes).slides[0].checks.map(check => check.visible),
      [...item.labels.map(() => true), ...item.hidden.map(() => false)]);
    for (const label of item.labels) assert.ok(output.svgPages[0].svg.includes('>' + label + '</text>'), label);
    for (const label of item.hidden) assert.ok(!output.svgPages[0].svg.includes('>' + label + '</text>'), label);
    assert.ok(xml.includes('formatCode="' + item.format + '"'));
    for (const value of item.values) {
      assert.ok(xml.includes('<c:v>' + value + '</c:v>'), 'native chart cache retains the observation');
      assert.ok(cells.includes('<v>' + value + '</v>'), 'workbook retains the observation');
    }
    delete p.slides[0].contentChecks;
    assert.deepEqual(p, before);
  }
});

test('hidden line data labels and single-series legends stay absent in SVG and native chart options', async () => {
  const p = project(chart({ kind: 'line', valueDecimals: 2 })), output = await renderProject(p), xml = chartXml(output);
  p.slides[0].contentChecks = ['Unshown single-series name', '1.23456', '1.23'].map((text, i) => ({ id: 'check-' + i, text }));
  assert.deepEqual(contentCoverageReport(p, output.scenes).slides[0].checks.map(check => check.visible), [false, false, false]);
  assert.doesNotMatch(output.svgPages[0].svg, /Unshown single-series name|>1\.23456<|>1\.23</);
  assert.doesNotMatch(xml, /<c:legend>/);
  assert.doesNotMatch(xml, /<c:showVal val="1"/);
});
