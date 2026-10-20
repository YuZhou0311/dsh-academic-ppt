import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { createProject, updateRecords, contextProject, buildProject, checkProject, editProject, DEFAULT_DESIGN } from '../src/core.mjs';
import { inferTemplateDesign } from '../src/design-system.mjs';
import { formatToolResult } from '../src/tools.mjs';
import { brief, paper, claim, slides } from './fixtures.mjs';

const plan = () => ({ relationship: 'evidence-explanation', primaryPanelId: 'data', readingOrder: ['data', 'scope'], rationale: 'Private design decision: keep the exact fixture count readable beside its explicit test boundary.', alternatives: [{ structure: 'Stack the test table above a short explanatory area.', tradeoff: 'The compact table leaves adequate width for a separate scope note.' }] });
function bodySlide() {
  return {
    ...structuredClone(slides[1]), layout: 'academic', figureIds: [],
    cards: [{ id: 'scope-card', kind: 'boundary', title: '适用范围', body: '合成输入只检验导出对象，不代表现实研究结果。', claimIds: ['C1'], style: 'compact' }],
    table: { columns: ['测试输入', '计数'], rows: [['固定合成项', '3/4']], sourceClaimIds: ['C1'], caption: '固定输入，非真实科研数据。' },
    composition: { rows: [{ panels: [{ id: 'data', title: '输入计数与口径', weight: 1.7, table: true, surface: 'plain' }, { id: 'scope', title: '验证边界', cardIds: ['scope-card'], surface: 'tint', align: 'start' }] }] },
    visualPlan: plan(),
  };
}
async function setup(t, { design } = {}) {
  const root = resolve('.test-output'); await mkdir(root, { recursive: true });
  const cwd = await mkdtemp(join(root, 'content-led-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const created = await createProject({ cwd, projectDir: 'p', title: 'Content-led integration fixture', brief, ...(design ? { design } : {}) });
  const recordsPath = join(cwd, 'records.json');
  await writeFile(recordsPath, JSON.stringify({ papers: [paper], claims: [claim], slides: [slides[0], bodySlide(), slides[2]] }));
  await updateRecords({ cwd, projectPath: created.projectPath, expectedRevision: 0, recordsPath });
  return { cwd, projectPath: created.projectPath };
}

test('file-backed design decisions survive public recording and recovery without leaking into presentation copy', async t => {
  const options = await setup(t), stored = JSON.parse(await readFile(options.projectPath, 'utf8'));
  assert.equal(stored.design.mode, 'content-led');
  assert.deepEqual(stored.slides[1].visualPlan, plan());
  const context = await contextProject({ ...options, stage: 'storyboard', recordIds: ['s2'] });
  assert.equal(context.designMode, 'content-led');
  assert.deepEqual(context.records[0].record.composition, bodySlide().composition);
  assert.ok(formatToolResult('academic_ppt_context', context).includes(plan().rationale));
  const built = await buildProject({ ...options, expectedRevision: 1, mode: 'review' });
  assert.equal(built.ok, true, JSON.stringify(built.issues));
  const archive = unzipSync(await readFile(built.files.pptx));
  const xml = Object.entries(archive).filter(([path]) => /ppt\/(?:slides|notesSlides)\/.+\.xml$/.test(path)).map(([, bytes]) => strFromU8(bytes)).join('\n');
  assert.ok(xml.includes('3/4'));
  assert.ok(xml.includes('合成输入只检验导出对象'));
  assert.ok(!xml.includes(plan().rationale), 'design metadata must not enter slide text or speaker notes');
  assert.ok(!(await readFile(built.files.speech, 'utf8')).includes(plan().rationale));
});

test('scoped composition and plan edits invalidate artifacts while dangling panel decisions block review builds', async t => {
  const options = await setup(t), first = await buildProject({ ...options, expectedRevision: 1, mode: 'review' });
  assert.equal(first.ok, true);
  await editProject({ ...options, expectedRevision: 1, scope: 'slide-content', changes: [{ slideId: 's2', patch: { visualPlan: { ...plan(), primaryPanelId: 'missing-panel' } } }] });
  const invalid = await checkProject(options);
  assert.equal(invalid.artifact.current, false);
  assert.equal(invalid.verification.readyForDelivery, false);
  assert.ok(invalid.issues.some(issue => issue.code === 'visual-plan-primary-panel'));
  const blocked = await buildProject({ ...options, expectedRevision: 2, mode: 'review' });
  assert.equal(blocked.status, 'blocked');
  const composition = bodySlide().composition; composition.rows[0].panels[1].surface = 'rule';
  await editProject({ ...options, expectedRevision: 2, scope: 'slide-content', changes: [{ slideId: 's2', patch: { visualPlan: plan(), composition } }] });
  const repaired = await buildProject({ ...options, expectedRevision: 3, mode: 'review' });
  assert.equal(repaired.ok, true, JSON.stringify(repaired.issues));
  assert.notEqual(repaired.files.pptx, first.files.pptx, 'earlier exported files remain intact');
  assert.ok((await readFile(first.files.pptx)).length > 0);
  await editProject({ ...options, expectedRevision: 3, scope: 'slide-content', changes: [{ slideId: 's2', patch: {}, removeFields: ['visualPlan'] }] });
  const advisory = await checkProject(options);
  assert.ok(advisory.issues.some(issue => issue.code === 'design-plan-missing' && issue.severity === 'warning'));
  assert.equal(advisory.summary.errors, 0, 'a missing plan is an advisory, not a new scientific gate');
});

test('reference inference is an editable suggestion and older design records retain compatibility', async t => {
  const suggested = inferTemplateDesign().suggestedDesign;
  assert.equal(suggested.mode, 'reference-guided');
  const options = await setup(t, { design: suggested });
  assert.equal((await contextProject({ ...options, stage: 'design' })).designMode, 'reference-guided');
  const oldDesign = structuredClone(DEFAULT_DESIGN); delete oldDesign.mode;
  const oldSlide = bodySlide(); delete oldSlide.visualPlan;
  await updateRecords({ ...options, expectedRevision: 1, design: oldDesign, slides: [oldSlide] });
  assert.equal((await contextProject({ ...options, stage: 'design' })).designMode, 'reference-guided', 'replacing tokens must preserve an already selected mode');
  const current = await checkProject(options);
  assert.ok(current.issues.some(issue => issue.code === 'design-plan-missing'));
  // Reproduce a serialized pre-v0.6 project, not a new init that must default
  // to content-led even when callers supply their own font/palette tokens.
  const legacy = JSON.parse(await readFile(options.projectPath, 'utf8'));
  delete legacy.design.mode;
  await writeFile(options.projectPath, JSON.stringify(legacy));
  const old = await checkProject(options);
  assert.equal(old.summary.errors, 0);
  assert.ok(!old.issues.some(issue => issue.code === 'design-plan-missing'));
  assert.equal((await contextProject({ ...options, stage: 'design' })).designMode, 'legacy');
  await updateRecords({ ...options, expectedRevision: 2, design: { ...oldDesign, mode: 'template-faithful' } });
  assert.equal((await contextProject({ ...options, stage: 'design' })).designMode, 'template-faithful');
});

test('new custom design tokens receive the same content-led default as an ordinary init', async t => {
  const custom = structuredClone(DEFAULT_DESIGN); delete custom.mode;
  custom.palette.accent = '#28435A';
  const options = await setup(t, { design: custom });
  const stored = JSON.parse(await readFile(options.projectPath, 'utf8'));
  assert.equal(stored.design.mode, 'content-led');
  assert.equal(stored.design.palette.accent, '#28435A');
  assert.equal(custom.mode, undefined, 'init must not mutate caller-owned tokens');
});
