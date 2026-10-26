#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Only public project roots are eligible. Historical transfer chunks and working
// files are never a release input, even when present alongside the repository.
const SOURCE_ROOTS = new Set([
  '.github', '.gitignore', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md',
  'package.json', 'package-lock.json', 'cordis.patch.yml',
  'src', 'bin', 'skills', 'docs', 'examples', 'scripts', 'test',
]);
const EXCLUDED_SEGMENTS = new Set(['.git', '.publication', 'node_modules', '.test-output', 'dist']);
const REQUIRED_RUNTIME = [
  'package.json', 'src/index.mjs', 'bin/academic-ppt.mjs', 'cordis.patch.yml',
  'skills/dsh-academic-ppt/SKILL.md', 'README.md', 'LICENSE', 'docs/INSTALL.md',
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args[0] ?? ''} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}
function git(root, ...args) { return run('git', args, { cwd: root }).trim(); }
function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function safeSourcePath(path) {
  return !path.split('/').some(part => EXCLUDED_SEGMENTS.has(part) || part === '..' || part === '.env' || part.startsWith('.env.'));
}

/** Build from one committed tree; npm never sees the caller's working files. */
export function buildRelease({ root = fileURLToPath(new URL('../', import.meta.url)), tag, outputDir } = {}) {
  root = resolve(root);
  if (git(root, 'diff', '--name-only', '--ignore-submodules', 'HEAD', '--')) {
    throw new Error('Commit tracked file changes before building a release.');
  }
  const commit = git(root, 'rev-parse', 'HEAD');
  const tree = git(root, 'rev-parse', 'HEAD^{tree}');
  const pkg = JSON.parse(git(root, 'show', 'HEAD:package.json'));
  const lock = JSON.parse(git(root, 'show', 'HEAD:package-lock.json'));
  if (pkg.name !== 'dsh-academic-ppt' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
    throw new Error('Expected a dsh-academic-ppt package with a valid release version.');
  }
  if (lock.version !== pkg.version || lock.packages?.['']?.version !== pkg.version) {
    throw new Error('package.json and package-lock.json versions differ.');
  }
  const releaseTag = `v${pkg.version}`;
  if (tag && tag !== releaseTag) throw new Error(`Release tag ${tag} does not match ${releaseTag}.`);
  const prefix = `${pkg.name}-${pkg.version}`;
  const roots = git(root, 'ls-tree', '--name-only', 'HEAD').split('\n').filter(path => SOURCE_ROOTS.has(path));
  const entries = run('git', ['ls-tree', '-rz', 'HEAD', '--', ...roots], { cwd: root }).split('\0').filter(Boolean);
  const paths = entries.map(entry => {
    const separator = entry.indexOf('\t'), header = entry.slice(0, separator), path = entry.slice(separator + 1);
    if (!/^100(?:644|755) blob /.test(header) || !safeSourcePath(path)) {
      throw new Error(`Release source must be an ordinary public tracked file: ${path}`);
    }
    return path;
  });
  for (const path of [...REQUIRED_RUNTIME, 'package-lock.json', 'docs/RELEASE_NOTES.md']) {
    if (!paths.includes(path)) throw new Error(`Missing release input: ${path}`);
  }
  const destination = resolve(outputDir ?? join(root, 'dist', releaseTag));
  mkdirSync(join(root, '.test-output'), { recursive: true });
  const staging = mkdtempSync(join(root, '.test-output', 'release-build-'));
  try {
    const source = join(staging, 'source');
    const output = join(staging, 'output');
    mkdirSync(source); mkdirSync(output);
    const archive = run('git', ['archive', '--format=tar', commit, '--', ...roots], { cwd: root, encoding: null });
    run('tar', ['-xf', '-', '-C', source], { input: archive });
    let npmCommand = 'npm', npmArgs = [];
    if (process.env.npm_execpath) { npmCommand = process.execPath; npmArgs = [process.env.npm_execpath]; }
    else if (process.platform === 'win32') throw new Error('On Windows run npm run release:build so the npm CLI path is available.');
    const packed = JSON.parse(run(npmCommand, [...npmArgs, 'pack', '--ignore-scripts', '--json', '--pack-destination', output], { cwd: source }));
    if (packed.length !== 1 || packed[0].filename !== `${prefix}.tgz`) throw new Error('npm pack returned an unexpected artifact.');
    const runtimePaths = packed[0].files.map(file => file.path);
    for (const path of runtimePaths) if (!safeSourcePath(path) || !paths.includes(path)) throw new Error(`Unexpected runtime package input: ${path}`);
    for (const path of REQUIRED_RUNTIME) if (!runtimePaths.includes(path)) throw new Error(`Missing runtime file: ${path}`);
    writeFileSync(join(output, `${prefix}-source.zip`), run('git', [
      'archive', '--format=zip', `--prefix=${prefix}/`, commit, '--', ...roots,
    ], { cwd: root, encoding: null }));
    writeFileSync(join(output, 'RELEASE_NOTES.md'), readFileSync(join(source, 'docs/RELEASE_NOTES.md')));
    const artifactNames = [`${prefix}.tgz`, `${prefix}-source.zip`, 'RELEASE_NOTES.md'];
    const artifacts = artifactNames.map(name => {
      const bytes = readFileSync(join(output, name));
      return { name, bytes: bytes.length, sha256: digest(bytes) };
    });
    const manifest = {
      schemaVersion: 1, package: pkg.name, version: pkg.version, releaseTag,
      source: { commit, tree, committedAt: git(root, 'show', '-s', '--format=%cI', commit), includedRoots: roots, trackedFiles: paths.length },
      runtime: { node: pkg.engines?.node, dsh: pkg.engines?.dsh, bundledDependencies: false, npmRegistryPublished: false },
      artifacts,
    };
    writeFileSync(join(output, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    artifactNames.push('release-manifest.json');
    writeFileSync(join(output, 'SHA256SUMS'), artifactNames.map(name => `${digest(readFileSync(join(output, name)))}  ${name}\n`).join(''));
    artifactNames.push('SHA256SUMS');
    mkdirSync(destination, { recursive: true });
    for (const name of artifactNames) renameSync(join(output, name), join(destination, name));
    return { ok: true, version: pkg.version, tag: releaseTag, commit, tree, outputDir: destination, files: artifactNames };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--help' || flag === '-h') return { help: true };
    const key = flag === '--tag' ? 'tag' : flag === '--output' ? 'outputDir' : null;
    if (!key || options[key] || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Unknown, repeated or incomplete argument: ${flag}`);
    options[key] = args[++i];
  }
  return options;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log('npm run release:build -- [--tag v0.8.0] [--output /absolute/output]\nBuilds five release files from a clean committed source tree. Untracked files are never packaged.');
    else console.log(JSON.stringify(buildRelease(options), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
