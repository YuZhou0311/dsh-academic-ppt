import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createProject, studyProject, updateRecords } from '../src/core.mjs';
import { fixtureDesign, brief, paper, claim } from './fixtures.mjs';

async function fixture(t) {
  const root = resolve('.test-output');
  await mkdir(root, { recursive: true });
  const cwd = await mkdtemp(join(root, 'study-validation-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const created = await createProject({ cwd, projectDir: 'project', title: 'Synthetic candidate validation', brief, design: fixtureDesign });
  const options = { cwd, projectPath: created.projectPath };
  await updateRecords({ ...options, expectedRevision: 0, papers: [paper], claims: [claim] });
  return options;
}

function candidates(kind = 'column', values = [3, 2]) {
  const slide = {
    id: 'chart-slide', layout: 'academic', title: 'Synthetic candidate chart',
    heading: { box: { x: 48, y: 24, w: 1184, h: 60 }, fontSize: 44 },
    paperIds: ['P1'], claimIds: ['C1'], figureIds: [], cards: [], notes: 'Software regression values only.', seconds: 60,
    chart: { kind, categories: ['A', 'B'], series: [{ name: 'N', values: [3, 2] }], unit: 'items', sourceClaimId: 'C1' },
    composition: { regions: [{ id: 'evidence', title: '', heading: 'hidden', padding: 0, surface: 'plain', box: { x: 48, y: 120, w: 1184, h: 300 }, chart: true }] },
  };
  const result = ['a', 'b'].map(id => ({ id, label: 'Synthetic chart candidate ' + id, slide: structuredClone(slide) }));
  result[0].slide.chart.series[0].values = values;
  return result;
}

test('study rejects both short and long chart series before writing any candidate artifacts', async t => {
  const options = await fixture(t);
  const before = await readFile(options.projectPath);
  for (const kind of ['bar', 'column', 'line']) {
    for (const values of [[3], [3, 2, 4]]) {
      const outputDir = `blocked-${kind}-${values.length}`;
      const result = await studyProject({ ...options, expectedRevision: 1, candidates: candidates(kind, values), outputDir });
      assert.equal(result.ok, false);
      assert.equal(result.status, 'blocked');
      assert.deepEqual(result.issues.filter(i => i.severity === 'error').map(i => [i.code, i.path]), [['chart-dimensions', 'slides.a']]);
      assert.ok(!(await readdir(options.cwd)).includes(outputDir), 'invalid data must be rejected before creating an output directory');
      assert.deepEqual(await readFile(options.projectPath), before, 'candidate validation must not mutate the project');
    }
  }
});

test('file-backed candidates obey chart dimensions and valid charts of the same size still export', async t => {
  const options = await fixture(t);
  const candidatesPath = join(options.cwd, 'candidates.json');
  await writeFile(candidatesPath, JSON.stringify(candidates('column', [3, 2, 4])));
  const blocked = await studyProject({ ...options, expectedRevision: 1, candidatesPath, outputDir: 'blocked-file' });
  assert.equal(blocked.status, 'blocked');
  assert.ok(blocked.issues.some(i => i.code === 'chart-dimensions'));
  assert.ok(!(await readdir(options.cwd)).includes('blocked-file'));

  const valid = candidates('column', [3, 2]);
  await writeFile(candidatesPath, JSON.stringify(valid));
  const before = await readFile(options.projectPath);
  const result = await studyProject({ ...options, expectedRevision: 1, candidatesPath, outputDir: 'valid-file' });
  assert.equal(result.status, 'candidates-created', JSON.stringify(result.issues));
  assert.equal(result.formalVisualApproval, false);
  assert.equal(result.projectModified, false);
  assert.equal(result.svgPaths.length, 2);
  assert.ok((await readFile(result.pptxPath)).length > 100);
  assert.deepEqual(JSON.parse(await readFile(join(result.outputDir, 'candidates.json'), 'utf8')), valid);
  assert.deepEqual(await readFile(options.projectPath), before);
});
