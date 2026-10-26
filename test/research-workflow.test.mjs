import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createProject, updateRecords, buildProject, contextProject, checkProject } from '../src/core.mjs';
import { toolContract } from '../src/tool-contract.mjs';
import { brief, paper, claim, slides, fixtureDesign } from './fixtures.mjs';

// These fixtures exercise the workflow, not a claim of reading a real paper.
async function create(t) {
  await mkdir(resolve('.test-output'), { recursive: true });
  const cwd = await mkdtemp(resolve('.test-output/research-flow-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const { visualEvidence, ...requirements } = brief;
  const created = await createProject({ cwd, projectDir: 'project', title: 'Synthetic retrieval workflow', brief: requirements, design: fixtureDesign });
  return { cwd, projectPath: created.projectPath };
}

test('new academic projects retain source-led policy across ordinary brief edits', async t => {
  const options = await create(t);
  const before = JSON.parse(await readFile(options.projectPath, 'utf8'));
  assert.deepEqual(before.brief.visualEvidence, { mode: 'source-led' });
  const { visualEvidence, ...ordinaryBrief } = before.brief;
  await updateRecords({ ...options, expectedRevision: 0, brief: { ...ordinaryBrief, audience: 'A changed audience' } });
  const context = await contextProject(options);
  assert.equal(context.brief.visualEvidence.mode, 'source-led');
  assert.ok(context.nextActions.some(action => /核对|全文|原图/.test(action)));
  await assert.rejects(updateRecords({ ...options, expectedRevision: 1,
    brief: { ...context.brief, visualEvidence: { mode: 'flexible', reason: 'Attempt to suppress unresolved image evidence' } },
  }), /REQUIREMENT_RELAXATION.*visualEvidence/);
  const after = JSON.parse(await readFile(options.projectPath, 'utf8'));
  assert.equal(after.revision, 1);
  assert.equal(after.brief.visualEvidence.mode, 'source-led');
});

test('a source-led all-text literature report is blocked in review and remains an explicit draft', async t => {
  const options = await create(t);
  const source = { ...paper,
    sourceCheck: { status: 'verified', checkedAt: '2026-10-26', metadataSource: 'https://example.org/fixture', fullTextSource: 'synthetic-fixture.txt', note: 'Synthetic identity receipt, not actual literature verification.' },
    figureReview: { status: 'unavailable', checkedSources: ['https://example.org/fixture'], note: 'Synthetic missing-figure condition. No real download was attempted.', candidates: [] },
  };
  await updateRecords({ ...options, expectedRevision: 0, papers: [source], claims: [claim], slides: [slides[0], slides[2]] });
  const context = await contextProject({ ...options, recordIds: ['P1'] });
  assert.equal(context.researchEvidence.mode, 'source-led');
  assert.equal(context.evidenceDesign.summary.sourceFigureCount, 0);
  assert.equal(context.records[0].record.sourceCheck.status, 'verified');
  assert.ok(context.researchEvidence.issues.some(issue => issue.severity === 'error'));
  const blocked = await buildProject({ ...options, expectedRevision: 1, mode: 'review' });
  assert.equal(blocked.status, 'blocked');
  assert.equal(JSON.parse(await readFile(options.projectPath, 'utf8')).artifact, undefined);
  const draft = await buildProject({ ...options, expectedRevision: 1, mode: 'draft' });
  assert.ok(draft.files.pptx);
  const checked = await checkProject(options);
  assert.equal(checked.verification.readyForDelivery, false);
  assert.ok(checked.designDiagnostics.researchEvidence.issues.some(issue => issue.severity === 'error'));
});

test('opt-in contracts expose source retrieval and figure-selection records without changing tool count', async () => {
  const requirement = await toolContract({ topic: 'brief' });
  assert.ok(requirement.schema.properties.visualEvidence);
  const source = await toolContract({ topic: 'paper' });
  assert.ok(source.schema.properties.sourceCheck);
  assert.ok(source.schema.properties.figureReview);
  assert.ok(source.notes.some(note => /不自行联网验真/.test(note)));
  const asset = await toolContract({ topic: 'asset' });
  assert.ok(asset.notes.some(note => /独立图片保留/.test(note)));
});
