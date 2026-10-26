import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { buildRelease } from '../scripts/build-release.mjs';

function run(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function fixture(t) {
  const output = resolve('.test-output'); mkdirSync(output, { recursive: true });
  const root = mkdtempSync(join(output, 'release-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (name, content) => { const path = join(root, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); };
  const pkg = {
    name: 'dsh-academic-ppt', version: '0.8.0', private: true,
    engines: { node: '^22.19.0 || >=24.0.0' },
    files: ['src', 'bin', 'skills', 'docs', 'cordis.patch.yml', 'README.md', 'LICENSE'],
  };
  write('package.json', JSON.stringify(pkg));
  write('package-lock.json', JSON.stringify({ name: pkg.name, version: pkg.version, packages: { '': { name: pkg.name, version: pkg.version } } }));
  for (const name of ['src/index.mjs', 'bin/academic-ppt.mjs', 'skills/dsh-academic-ppt/SKILL.md', 'cordis.patch.yml', 'README.md', 'LICENSE', 'docs/INSTALL.md', 'docs/RELEASE_NOTES.md', 'test/example.test.mjs']) write(name, `Public fixture ${name}\n`);
  write('.publication/parts/private.b64', 'Historical transport payload is not source\n');
  write('.gitignore', 'node_modules/\ndist/\n.test-output/\n');
  run(root, 'init', '--quiet'); run(root, 'add', '--all');
  run(root, '-c', 'user.name=Release test', '-c', 'user.email=release-test@example.invalid', 'commit', '--quiet', '-m', 'Fixture');
  return { root, write };
}

test('release packages bind one committed tree and exclude untracked files and historical transfer payloads', t => {
  const { root, write } = fixture(t);
  write('docs/private-working-note.md', 'DO_NOT_RELEASE');
  write('src/private-working-file.mjs', 'DO_NOT_RELEASE');
  write('node_modules/local-secret.txt', 'DO_NOT_RELEASE');
  const result = buildRelease({ root, tag: 'v0.8.0' });
  assert.equal(result.commit, run(root, 'rev-parse', 'HEAD'));
  const zip = unzipSync(readFileSync(join(result.outputDir, 'dsh-academic-ppt-0.8.0-source.zip')));
  const names = Object.keys(zip);
  assert.ok(names.includes('dsh-academic-ppt-0.8.0/package-lock.json'));
  assert.ok(names.includes('dsh-academic-ppt-0.8.0/test/example.test.mjs'));
  assert.ok(!names.some(name => /private-working|node_modules|\.publication|\.test-output/.test(name)));
  const tar = spawnSync('tar', ['-tzf', join(result.outputDir, 'dsh-academic-ppt-0.8.0.tgz')], { encoding: 'utf8' });
  assert.ifError(tar.error); assert.equal(tar.status, 0, tar.stderr);
  assert.match(tar.stdout, /package\/src\/index\.mjs/);
  assert.doesNotMatch(tar.stdout, /private-working|node_modules|\.publication|\.test-output/);
  const manifest = JSON.parse(readFileSync(join(result.outputDir, 'release-manifest.json')));
  assert.equal(manifest.source.commit, result.commit);
  assert.equal(manifest.source.tree, run(root, 'rev-parse', 'HEAD^{tree}'));
  for (const artifact of manifest.artifacts) {
    const bytes = readFileSync(join(result.outputDir, artifact.name));
    assert.equal(artifact.bytes, bytes.length);
    assert.equal(artifact.sha256, createHash('sha256').update(bytes).digest('hex'));
  }
  const sums = readFileSync(join(result.outputDir, 'SHA256SUMS'), 'utf8').trim().split('\n');
  assert.equal(sums.length, 4);
  for (const line of sums) {
    const [hash, name] = line.split('  ');
    assert.equal(hash, createHash('sha256').update(readFileSync(join(result.outputDir, name))).digest('hex'));
  }
  const repeat = buildRelease({ root, tag: 'v0.8.0', outputDir: join(root, 'dist', 'repeat') });
  for (const name of result.files) assert.deepEqual(readFileSync(join(result.outputDir, name)), readFileSync(join(repeat.outputDir, name)), name);
});

test('release refuses a mismatched tag or tracked edits before writing artifacts', t => {
  const { root, write } = fixture(t);
  assert.throws(() => buildRelease({ root, tag: 'v0.7.0' }), /does not match v0.8.0/);
  write('README.md', 'Uncommitted content\n');
  assert.throws(() => buildRelease({ root, tag: 'v0.8.0' }), /Commit tracked file changes/);
});
