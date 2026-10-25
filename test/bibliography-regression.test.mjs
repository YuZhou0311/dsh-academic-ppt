import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createProject, updateRecords, buildProject, evidenceIssues } from '../src/core.mjs';
import { buildScenes } from '../src/scene.mjs';
import { assertProject } from '../src/schema.mjs';
import { fixtureDesign, brief, paper, claim, slides } from './fixtures.mjs';

function project() {
  const p = structuredClone({
    schemaVersion: 1, id: 'bibliography-fixture', revision: 0,
    title: 'Synthetic bibliography regression',
    brief: { ...brief, requirePaperIntro: false, targetPaperCount: 2 },
    design: fixtureDesign, capabilities: { imageInput: 'unknown', source: 'Synthetic test' },
    papers: [paper, { ...paper, id: 'P2', title: 'Second synthetic bibliography source' }],
    claims: [claim, { ...claim, id: 'C2', paperId: 'P2' }], assets: [],
    slides: [
      { ...slides[0], layout: 'synthesis', paperIds: ['P1', 'P2'], claimIds: ['C1', 'C2'], seconds: 100 },
      { ...slides[2], paperIds: ['P1', 'P2'] },
    ],
  });
  assertProject(p);
  return p;
}

const missingReferences = p => evidenceIssues(p).filter(i => i.code === 'reference-entry').map(i => i.path).sort();
const referenceTitles = p => buildScenes(p).pages.flatMap(page => page.nodes.filter(n => n.role === 'reference-title').map(n => n.text));
async function persisted(t, p) {
  const root = resolve('.test-output');
  await mkdir(root, { recursive: true });
  const cwd = await mkdtemp(join(root, 'bibliography-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const created = await createProject({ cwd, projectDir: 'project', title: p.title, brief: p.brief, design: p.design });
  const options = { cwd, projectPath: created.projectPath };
  await updateRecords({ ...options, expectedRevision: 0, papers: p.papers, claims: p.claims, slides: p.slides });
  return options;
}

test('a narrower explicit bibliography does not credit paperIds omitted by the renderer', () => {
  const p = project();
  p.slides[1].referenceIds = ['P1'];
  assert.equal(referenceTitles(p).length, 1);
  assert.match(referenceTitles(p)[0], /Academic presentation software fixture/);
  assert.deepEqual(missingReferences(p), ['papers.P2']);
});

test('an absent selection falls back to paperIds and separate bibliography pages cover their own entries', () => {
  const p = project();
  assert.equal(referenceTitles(p).length, 2);
  assert.deepEqual(missingReferences(p), []);
  p.slides[1].referenceIds = ['P1'];
  p.slides.push({ ...structuredClone(p.slides[1]), id: 'second-references', paperIds: ['P2'], referenceIds: ['P2'] });
  assert.equal(referenceTitles(p).length, 2);
  assert.deepEqual(missingReferences(p), []);
});

test('legacy bibliography templates identify their rendered references and remain buildable', async t => {
  const p = project();
  p.papers = p.papers.slice(0, 1);
  p.claims = p.claims.slice(0, 1);
  p.brief.targetPaperCount = 1;
  p.slides[0].paperIds = ['P1'];
  p.slides[0].claimIds = ['C1'];
  Object.assign(p.slides[1], {
    referenceTemplateId: 'plan-reference-notes', paperIds: ['P1'], referenceIds: ['P1'],
    cards: ['version', 'source'].map(id => ({ id, kind: 'setting', title: id, body: 'Synthetic source fixture.', claimIds: ['C1'], style: 'plain' })),
  });
  const scenes = buildScenes(p);
  const title = scenes.pages[1].nodes.find(node => node.id === 's3/ref:P1:title');
  assert.equal(title.referenceId, 'P1');
  assert.equal(title.role, 'reference-title');
  assert.ok(!scenes.issues.some(issue => issue.code === 'unrendered-reference'));
  const options = await persisted(t, p);
  const result = await buildProject({ ...options, expectedRevision: 1 });
  assert.equal(result.status, 'ready-for-review', JSON.stringify(result.issues));
});

test('an explicit empty selection never falls back and the public schema rejects it', () => {
  const p = project();
  p.slides[1].referenceIds = [];
  assert.equal(referenceTitles(p).length, 0);
  assert.deepEqual(missingReferences(p), ['papers.P1', 'papers.P2']);
  assert.throws(() => assertProject(p), /INVALID_INPUT.*referenceIds/);
});

test('legacy all-paper fallback is counted without introducing a projection-mode fallback', () => {
  const p = project();
  p.slides[1].paperIds = [];
  assert.equal(referenceTitles(p).length, 2, 'legacy rendering retains the existing all-paper selection');
  assert.deepEqual(missingReferences(p), []);
  p.design.projection = { bodyMin: 28, labelMin: 24, noteMin: 18 };
  assert.equal(referenceTitles(p).length, 0, 'projection mode requires an explicit source selection');
  assert.deepEqual(missingReferences(p), ['papers.P1', 'papers.P2']);
});

test('reference density counts the rendered selection, including the legacy fallback', () => {
  const p = project();
  for (let n = 3; n <= 5; n++) p.papers.push({ ...structuredClone(paper), id: `P${n}`, title: `Synthetic source ${n}` });
  p.slides[1].paperIds = p.papers.map(paper => paper.id);
  p.slides[1].referenceIds = ['P1'];
  assert.equal(referenceTitles(p).length, 1);
  assert.ok(!evidenceIssues(p).some(i => i.code === 'dense-references'));
  delete p.slides[1].referenceIds;
  p.slides[1].paperIds = [];
  assert.equal(referenceTitles(p).length, 5);
  assert.ok(evidenceIssues(p).some(i => i.code === 'dense-references'));
});

test('legacy bibliography fallback cannot bypass full-text, analysis or evidence-source gates', () => {
  const p = project();
  p.slides[0].paperIds = ['P1'];
  p.slides[0].claimIds = ['C1'];
  p.slides[1].paperIds = [];
  p.claims = [p.claims[0]];
  p.papers[1].reading.status = 'abstract-only';
  delete p.papers[1].analysis;
  assert.equal(referenceTitles(p).length, 2);
  const codes = evidenceIssues(p).filter(i => i.path === 'papers.P2').map(i => i.code);
  for (const code of ['full-text-required', 'analysis-missing', 'source-without-evidence']) assert.ok(codes.includes(code), code);
});

test('review export blocks an omitted bibliography and succeeds after restoring the visible entry', async t => {
  const p = project();
  p.slides[1].referenceIds = ['P1'];
  const options = await persisted(t, p);
  const blocked = await buildProject({ ...options, expectedRevision: 1 });
  assert.equal(blocked.status, 'blocked');
  assert.deepEqual(blocked.issues.filter(i => i.severity === 'error').map(i => [i.code, i.path]), [['reference-entry', 'papers.P2']]);
  assert.equal(JSON.parse(await readFile(options.projectPath, 'utf8')).artifact, undefined);
  p.slides[1].referenceIds.push('P2');
  await updateRecords({ ...options, expectedRevision: 1, slides: [p.slides[1]] });
  const built = await buildProject({ ...options, expectedRevision: 2 });
  assert.equal(built.status, 'ready-for-review', JSON.stringify(built.issues));
});

test('a declared bibliography on a body slide still requires actual visible reference objects', async t => {
  const p = project();
  p.slides = [{ ...p.slides[0], referenceIds: ['P1', 'P2'], seconds: 120 }];
  const options = await persisted(t, p);
  const blocked = await buildProject({ ...options, expectedRevision: 1 });
  assert.equal(blocked.status, 'blocked');
  assert.deepEqual(blocked.issues.filter(i => i.code === 'unrendered-reference').map(i => i.paperId).sort(), ['P1', 'P2']);
  assert.equal(JSON.parse(await readFile(options.projectPath, 'utf8')).artifact, undefined);
});
