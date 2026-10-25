import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildScenes } from '../src/scene.mjs';
import { createProject, studyProject, updateRecords } from '../src/core.mjs';
import { fixtureDesign, brief, paper, claim } from './fixtures.mjs';

// Synthetic values exercise layout gates, not scientific findings or visual approval.
function project({ width = 1184, height = 300, chart = {}, region = {} } = {}) {
  return {
    title: 'Free chart layout regression',
    design: { ...structuredClone(fixtureDesign), chrome: { header: 'plain', showSources: false, showFooter: false, showBrand: false, showSection: false, showPageNumber: false, showTopRule: false } },
    papers: [paper], claims: [claim], assets: [],
    slides: [{
      id: 'chart-slide', title: 'Synthetic chart geometry', layout: 'academic',
      heading: { box: { x: 48, y: 24, w: 1184, h: 60 }, fontSize: 44 },
      paperIds: ['P1'], claimIds: ['C1'], figureIds: [], cards: [], notes: 'Synthetic software fixture.', seconds: 60,
      chart: { kind: 'column', categories: ['A', 'B'], series: [{ name: 'N', values: [3, 2] }], unit: 'items', sourceClaimId: 'C1', ...chart },
      composition: { regions: [{ id: 'evidence', title: '', heading: 'hidden', padding: 0, surface: 'plain', box: { x: 48, y: 120, w: width, h: height }, chart: true, ...region }] },
    }],
  };
}
const errors = p => buildScenes(p).issues.filter(i => i.severity === 'error');

test('free charts reject short slots before emitting inverted or unreadable geometry', () => {
  for (const kind of ['bar', 'column', 'line']) {
    for (const height of [100, 218]) {
      const scenes = buildScenes(project({ height, chart: { kind } }));
      const issue = scenes.issues.find(i => i.code === 'composition-chart-height');
      assert.ok(issue, `${kind} at ${height}px must fail its chart minimum`);
      assert.equal(issue.severity, 'error');
      assert.equal(issue.panelId, 'evidence');
      assert.equal(issue.availableHeight, height);
      assert.equal(issue.requiredHeight, 219);
      assert.ok(!scenes.pages[0].nodes.some(n => n.kind === 'chart'), 'invalid slots must not reach SVG/PPTX chart rendering');
    }
  }
});

test('free charts validate the actual slot after padding, headings and sibling artifacts', () => {
  const cases = [
    project({ height: 260, region: { heading: 'visible', title: 'Chart heading', padding: 20 } }),
    project({ height: 400, region: { table: true } }),
  ];
  cases[1].slides[0].table = { columns: ['N'], rows: [['3']] };
  for (const p of cases) {
    const issue = errors(p).find(i => i.code === 'composition-chart-height');
    assert.ok(issue, 'the outer region may fit while its chart slot does not');
    assert.ok(issue.availableHeight < issue.requiredHeight);
  }
});

test('free charts share width and complete-label gates with row compositions', () => {
  const cases = [
    [project({ width: 200 }), 'composition-chart-width'],
    [project({ width: 280, chart: { kind: 'bar' } }), 'composition-chart-width'],
    [project({ width: 450, chart: { categories: ['An entire category label that cannot fit the column', 'B'] } }), 'composition-chart-category-width'],
    [project({ width: 450, chart: { series: [{ name: 'A complete but very long legend label', values: [3, 2] }, { name: 'Other', values: [2, 1] }] } }), 'composition-chart-legend-width'],
    [project({ width: 450, chart: { unit: 'An exceptionally long complete scientific unit description that must not be truncated' } }), 'composition-chart-unit-width'],
  ];
  for (const [p, code] of cases) {
    const scenes = buildScenes(p);
    assert.ok(scenes.issues.some(i => i.severity === 'error' && i.code === code), code);
    assert.ok(!scenes.pages[0].nodes.some(n => n.kind === 'chart'), code + ' blocks chart emission');
  }
});

test('bar minima account for all groups and the effective projection label size', () => {
  const categories = Array.from({ length: 8 }, (_, i) => String.fromCharCode(65 + i));
  const p = project({ height: 346, chart: { kind: 'bar', categories, series: [{ name: 'N', values: categories.map((_, i) => i + 1) }] } });
  assert.equal(errors(p).find(i => i.code === 'composition-chart-height').requiredHeight, 347);
  p.slides[0].composition.regions[0].box.h = 347;
  assert.deepEqual(errors(p), []);
  p.design.projection = { bodyMin: 24, labelMin: 32, noteMin: 18 };
  assert.equal(errors(p).find(i => i.code === 'composition-chart-height').requiredHeight, 379);
});

test('valid free charts preserve exact region dimensions, data and projection settings', () => {
  for (const kind of ['bar', 'column', 'line']) {
    const p = project({ height: 219, chart: { kind, valueDecimals: 2 } });
    const before = structuredClone(p), scenes = buildScenes(p), node = scenes.pages[0].nodes.find(n => n.kind === 'chart');
    assert.deepEqual(scenes.issues.filter(i => i.severity === 'error'), []);
    assert.deepEqual(p, before);
    assert.deepEqual({ x: node.x, y: node.y, w: node.w, h: node.h }, p.slides[0].composition.regions[0].box);
    assert.deepEqual(node.chart, p.slides[0].chart);
    assert.notEqual(node.chart, p.slides[0].chart);
    assert.deepEqual(node.projection, p.design.projection);
  }
});

test('free scientific plots retain their own width and density gates', () => {
  for (const [width, height, code] of [[250, 300, 'plot-area-too-small'], [1184, 100, 'plot-group-density']]) {
    const p = project({ width, height });
    delete p.slides[0].chart;
    Object.assign(p.slides[0], { plot: { kind: 'interval', unit: 'kg', groups: [{ label: 'A', estimate: 2, lower: 1, upper: 3 }], sourceClaimIds: ['C1'] } });
    p.slides[0].composition.regions[0].chart = false;
    p.slides[0].composition.regions[0].plot = true;
    assert.ok(errors(p).some(i => i.code === code), code);
  }
});

test('undersized free chart candidates block export without writing output', async t => {
  const base = resolve('.test-output');
  await mkdir(base, { recursive: true });
  const cwd = await mkdtemp(join(base, 'free-chart-regression-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const p = project({ height: 100 });
  const created = await createProject({ cwd, projectDir: 'project', title: p.title, brief, design: p.design });
  await updateRecords({ cwd, projectPath: created.projectPath, expectedRevision: 0, papers: [paper], claims: [claim], slides: p.slides });
  const candidates = ['a', 'b'].map(id => ({ id, label: 'Synthetic short-chart candidate ' + id, slide: structuredClone(p.slides[0]) }));
  const result = await studyProject({ cwd, projectPath: created.projectPath, expectedRevision: 1, candidates, outputDir: 'blocked-export' });
  assert.equal(result.status, 'blocked');
  assert.ok(result.issues.some(i => i.code === 'composition-chart-height'));
  assert.ok(!(await readdir(cwd)).includes('blocked-export'));
});
