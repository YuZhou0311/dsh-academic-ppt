import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { hash } from '../src/io.mjs';
import { readResearchDemoInputs } from '../scripts/research-demo-inputs.mjs';

const script = fileURLToPath(new URL('../scripts/build-research-demo.mjs', import.meta.url));

async function workspace(t) {
  const base = resolve('.test-output');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(join(base, 'research-replay-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function bundleFixture(t) {
  const root = await workspace(t), source = Buffer.from('A complete offline source.\n');
  await mkdir(join(root, 'a'));
  await mkdir(join(root, 'sources'));
  const content = { papers: [{ id: 'P1', reading: { source: 'sources/paper.txt' } }], assets: [] };
  const manifest = { rebuildFiles: ['sources/paper.txt'], sha256: { 'sources/paper.txt': hash(source) } };
  await writeFile(join(root, 'a', 'deck.json'), JSON.stringify(content));
  await writeFile(join(root, 'a', 'manifest.json'), JSON.stringify(manifest));
  await writeFile(join(root, 'sources', 'paper.txt'), source);
  return { root, content, manifest };
}

test('research replay reports missing authored records and support files explicitly', async t => {
  const { root } = await bundleFixture(t);
  await assert.rejects(readResearchDemoInputs(root, 'b'), /RESEARCH_DEMO_BUNDLE_MISSING: b[/\\]deck\.json/);
  await rm(join(root, 'sources', 'paper.txt'));
  await assert.rejects(readResearchDemoInputs(root, 'a'), /RESEARCH_DEMO_BUNDLE_MISSING: sources\/paper\.txt/);
});

test('research replay checks source hashes and copies the verified bytes', async t => {
  const { root } = await bundleFixture(t);
  const inputs = await readResearchDemoInputs(root, 'a');
  await writeFile(join(root, 'sources', 'paper.txt'), 'Changed after input verification.');
  assert.equal(inputs.supportFiles[0].bytes.toString(), 'A complete offline source.\n');
  await assert.rejects(readResearchDemoInputs(root, 'a'), /SOURCE_HASH_MISMATCH: sources\/paper\.txt/);
});

test('research replay rejects duplicate, escaping and undeclared support paths', async t => {
  const { root, manifest, content } = await bundleFixture(t);
  for (const rebuildFiles of [['sources/paper.txt', 'sources/paper.txt'], ['sources/../../outside.txt']]) {
    await writeFile(join(root, 'a', 'manifest.json'), JSON.stringify({ ...manifest, rebuildFiles }));
    await assert.rejects(readResearchDemoInputs(root, 'a'), /unique declared rebuildFiles|PATH_OUTSIDE_WORKSPACE/);
  }
  await writeFile(join(root, 'a', 'manifest.json'), JSON.stringify(manifest));
  content.papers[0].reading.source = 'missing-paper.txt';
  await writeFile(join(root, 'a', 'deck.json'), JSON.stringify(content));
  await assert.rejects(readResearchDemoInputs(root, 'a'), /Undeclared paper source: P1/);
  content.papers[0].reading.source = 'sources/paper.txt';
  content.assets.push({ id: 'A1', path: 'assets/missing.png' });
  await writeFile(join(root, 'a', 'deck.json'), JSON.stringify(content));
  await assert.rejects(readResearchDemoInputs(root, 'a'), /Use a declared source asset path: A1/);
});

for (const [author, slideCount] of [['a', 16], ['b', 15]]) {
  test(`published research demo ${author} replays offline without inherited approval`, async t => {
    const cwd = await workspace(t);
    const run = spawnSync(process.execPath, [script, '--author', author, '--output', 'result'], {
      cwd, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 120000,
    });
    assert.ifError(run.error);
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const result = JSON.parse(run.stdout);
    assert.equal(result.ok, true);
    assert.equal(result.summary.errors, 0);
    assert.equal(result.rendering.status, 'not-requested');
    assert.equal(result.verification.visual, 'not-verified');
    assert.equal(result.verification.readyForDelivery, false);
    const project = JSON.parse(await readFile(result.projectPath, 'utf8'));
    assert.equal(project.slides.length, slideCount);
    assert.deepEqual(project.visualReviews, []);
    assert.equal(project.artifact.render, undefined);
    const pptx = await readFile(result.files.pptx);
    assert.equal(hash(pptx), result.pptxSha256);
    const parts = unzipSync(pptx, { filter: entry => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name) });
    assert.equal(Object.keys(parts).length, slideCount);
    assert.deepEqual(JSON.parse(await readFile(join(cwd, 'result', 'rebuild-result.json'), 'utf8')), result);
    const again = spawnSync(process.execPath, [script, '--author', author, '--output', 'result'], {
      cwd, encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 120000,
    });
    assert.ifError(again.error);
    assert.notEqual(again.status, 0);
    assert.match(again.stderr, /EEXIST/);
    assert.equal(hash(await readFile(result.files.pptx)), result.pptxSha256, 'existing output is preserved');
  });
}
