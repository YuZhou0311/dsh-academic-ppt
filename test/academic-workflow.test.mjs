import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createProject, updateRecords, buildProject, checkProject, evidenceIssues, DEFAULT_DESIGN } from '../src/core.mjs';
import { academicIssues } from '../src/academic-quality.mjs';
import { brief, paper, claim, asset, slides } from './fixtures.mjs';

async function project(t) {
  const root = resolve('.test-output'); await mkdir(root, { recursive: true });
  const cwd = await mkdtemp(join(root, 'academic-workflow-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const created = await createProject({ cwd, projectDir: 'p', title: 'Synthetic ordering fixture', brief });
  await updateRecords({ cwd, projectPath: created.projectPath, expectedRevision: 0, papers: [paper], claims: [claim], assets: [asset], slides });
  return { cwd, projectPath: created.projectPath };
}

test('pilot pages can be reordered with new pages in one typed record transaction', async t => {
  const o = await project(t), newSlide = { ...structuredClone(slides[0]), id: 'new' };
  const initial = JSON.parse(await readFile(o.projectPath, 'utf8'));
  const recordsPath = join(o.cwd, 'order.json');
  await writeFile(recordsPath, JSON.stringify({ slides: [newSlide], slideOrder: ['s1', 'new', 's2', 's3'] }));
  const result = await updateRecords({ ...o, expectedRevision: 1, recordsPath });
  assert.equal(result.revision, 2);
  const actual = JSON.parse(await readFile(o.projectPath, 'utf8'));
  assert.deepEqual(actual.slides.map(s => s.id), ['s1', 'new', 's2', 's3']);
  assert.deepEqual(actual.slides.find(s => s.id === 's2'), slides[1]);
  assert.deepEqual(actual.brief, initial.brief);
});

test('an incomplete, duplicated or foreign slide order is rejected without saving any part of a batch', async t => {
  const o = await project(t), before = await readFile(o.projectPath);
  for (const slideOrder of [['s1', 's2'], ['s1', 's1', 's3'], ['s1', 's2', 'unknown']]) {
    await assert.rejects(updateRecords({ ...o, expectedRevision: 1, slideOrder, claims: [{ ...claim, text: 'This change must never be committed by an invalid ordering batch.' }] }), /INVALID_SLIDE_ORDER/);
    assert.deepEqual(await readFile(o.projectPath), before);
  }
});

test('reordering after export invalidates delivery until the current order is rebuilt and reviewed', async t => {
  const o = await project(t), built = await buildProject({ ...o, expectedRevision: 1, mode: 'review' });
  assert.equal(built.ok, true);
  await updateRecords({ ...o, expectedRevision: 1, slideOrder: ['s2', 's1', 's3'] });
  const check = await checkProject(o);
  assert.equal(check.verification.readyForDelivery, false);
  const saved = JSON.parse(await readFile(o.projectPath, 'utf8'));
  assert.deepEqual(saved.slides.map(s => s.id), ['s2', 's1', 's3']);
  assert.equal(saved.revision, 2);
  assert.ok(!saved.artifact || saved.artifact.revision !== 2);
});

test('named scientific plots cannot conceal unread or missing source analysis behind their own source bindings', () => {
  const p = structuredClone({ schemaVersion: 1, id: 'plots-source-fixture', revision: 0, title: 'Scientific plot source fixture', brief, design: DEFAULT_DESIGN, capabilities: { imageInput: 'unknown', source: 'Synthetic fixture' }, papers: [paper], claims: [claim], assets: [asset], slides });
  const hidden = { ...structuredClone(paper), id: 'P2', title: 'Synthetic hidden scientific plot source', reading: { ...paper.reading, status: 'abstract-only' } };
  delete hidden.analysis;
  p.papers.push(hidden); p.claims.push({ ...structuredClone(claim), id: 'C2', paperId: 'P2' });
  p.slides[0].plots = [{ id: 'observations', kind: 'distribution', unit: 'items', groups: [{ label: 'Independent observations', values: [1, 2, 3] }], sourceClaimIds: ['C2'] }];
  const issues = [...evidenceIssues(p), ...academicIssues(p)];
  for (const code of ['full-text-required', 'reference-entry', 'analysis-missing']) assert.ok(issues.some(i => i.code === code && i.path === 'papers.P2'), code);
  assert.ok(issues.some(i => i.code === 'claim-source-not-visible' && i.message.includes('C2')));
});
