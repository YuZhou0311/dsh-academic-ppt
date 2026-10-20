import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_COMMANDS } from '../src/tools.mjs';
import { toolSchemas } from '../src/schema.mjs';

const cli = fileURLToPath(new URL('../bin/academic-ppt.mjs', import.meta.url));
async function workspace(t) {
  const root = resolve('.test-output'); await mkdir(root, { recursive: true });
  const cwd = await mkdtemp(join(root, 'cli-help-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  return cwd;
}
function run(t, args, cwd) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  if (result.error?.code === 'EPERM') { t.skip('Current sandbox blocks nested Node processes; run this CLI suite with permitted process execution.'); return null; }
  assert.ifError(result.error);
  return result;
}

test('global CLI help exposes command discovery and the seven actual contract topics', async t => {
  const cwd = await workspace(t), result = run(t, ['--help'], cwd); if (!result) return;
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^  dsh-academic-ppt <命令> --help$/m);
  assert.match(result.stdout, /^  dsh-academic-ppt <命令> --schema$/m);
  const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(manifest.bin['dsh-academic-ppt'],'bin/academic-ppt.mjs');
  assert.doesNotMatch(result.stdout,/^  academic-ppt /m);
  const topics = toolSchemas.academic_ppt_contract.properties.topic.enum;
  assert.equal(topics.length, 7);
  assert.ok(result.stdout.includes(`topic 仅支持：${topics.join(' / ')}`));
  assert.match(result.stdout, /init、build、render.*--help.*--schema/);
  assert.deepEqual(await readdir(cwd), []);
});

test('init, render and record help discover exact top-level fields without an argument file', async t => {
  const cwd = await workspace(t);
  for (const command of ['init', 'render', 'record']) {
    const result = run(t, [command, '--help'], cwd); if (!result) return;
    assert.equal(result.status, 0, result.stderr);
    const schema = toolSchemas[TOOL_COMMANDS[command]];
    for (const key of Object.keys(schema.properties)) assert.ok(result.stdout.includes(`  ${key} [`), `${command}: ${key}`);
    for (const key of schema.required) assert.ok(result.stdout.includes(`${key} [必填]`));
    assert.ok(result.stdout.includes(`dsh-academic-ppt ${command} --schema`));
    assert.ok(result.stdout.length < 10000, 'help is a field summary, not the complete nested schemas');
    if (command === 'render') assert.match(result.stdout, /project\.json文件路径，不是工程目录/);
    if (command === 'record') assert.match(result.stdout, /recordsPath 与内联内容不能同时提交/);
  }
  assert.deepEqual(await readdir(cwd), []);
});

test('review discovery makes observations mandatory for current academic projects while keeping legacy schema compatibility',async t=>{
  const cwd=await workspace(t),help=run(t,['review','--help'],cwd);if(!help)return;
  assert.equal(help.status,0,help.stderr);
  assert.match(help.stdout,/^dsh-academic-ppt review — academic_ppt_review/m);
  assert.match(help.stdout,/observations \[当前 academic 工程必填\]/);
  assert.doesNotMatch(help.stdout,/observations \[可选\]/);
  assert.match(help.stdout,/每个 reviewedSlides ID 恰好一条/);
  const result=run(t,['review','--schema'],cwd);if(!result)return;
  assert.equal(result.status,0,result.stderr);
  const schema=JSON.parse(result.stdout);
  assert.deepEqual(schema,toolSchemas.academic_ppt_review);
  assert.match(schema.properties.observations.description,/当前 academic 工程必填/);
  assert.match(schema.properties.observations.description,/旧工程兼容省略/);
  assert.ok(!schema.required.includes('observations'),'conditional requirement stays in project-aware runtime validation');
  assert.deepEqual(await readdir(cwd),[]);
});

test('per-command schema is exactly its shared runtime schema, including existing CLI compatibility', async t => {
  const cwd = await workspace(t);
  for (const command of ['init', 'render', 'record']) {
    const result = run(t, [command, '--schema'], cwd); if (!result) return;
    assert.equal(result.status, 0, result.stderr);
    const schema = JSON.parse(result.stdout);
    assert.deepEqual(schema, toolSchemas[TOOL_COMMANDS[command]]);
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties.academic_ppt_build, undefined, 'never return the complete tool registry');
    if (command === 'init') assert.ok(schema.properties.design, 'keep the accepted inline CLI design option discoverable');
    if (command === 'render') assert.deepEqual(schema.required, ['projectPath', 'expectedRevision']);
    if (command === 'record') assert.ok(schema.properties.recordsPath && schema.properties.slides, 'recommended batching and legacy inline inputs share the same executor');
  }
  assert.deepEqual(await readdir(cwd), []);
});

test('unknown commands fail before an args file is requested or read', async t => {
  const cwd = await workspace(t);
  for (const args of [['unknown', '--help'], ['unknown', '--schema'], ['unknown', '--args', 'missing.json'], ['constructor', '--help']]) {
    const result = run(t, args, cwd); if (!result) return;
    assert.equal(result.status, 1);
    assert.match(result.stderr, /未知命令/);
    assert.doesNotMatch(result.stderr, /ENOENT|请提供 --args/);
    assert.equal(result.stdout, '');
  }
});

test('discovery rejects mixed execution flags and conflicting or repeated discovery modes', async t => {
  const cwd = await workspace(t);
  const combinations = [
    ['init', '--help', '--args', 'missing.json'],
    ['init', '--args', 'missing.json', '--help'],
    ['record', '--schema', '--args', 'missing.json'],
    ['render', '--help', '--json'],
    ['render', '--schema', '--json'],
    ['init', '--help', '--schema'],
    ['init', '--help', '-h'],
    ['record', '--schema', '--schema'],
  ];
  for (const args of combinations) {
    const result = run(t, args, cwd); if (!result) return;
    assert.equal(result.status, 1, args.join(' '));
    assert.match(result.stderr, /不能与 --args 或 --json 混用|未知或重复参数/);
    assert.doesNotMatch(result.stderr, /ENOENT/);
    assert.equal(result.stdout, '');
  }
  assert.deepEqual(await readdir(cwd), []);
});

test('ordinary args execution still supports init, inline record and recordsPath batches', async t => {
  const cwd = await workspace(t);
  await writeFile(join(cwd, 'init.json'), JSON.stringify({ projectDir: 'project', title: 'CLI兼容测试' }));
  const initial = run(t, ['init', '--args', 'init.json', '--json'], cwd); if (!initial) return;
  assert.equal(initial.status, 0, initial.stderr);
  const created = JSON.parse(initial.stdout), stored = JSON.parse(await readFile(created.projectPath, 'utf8'));
  assert.equal(stored.title, 'CLI兼容测试'); assert.equal(created.revision, 0);
  await writeFile(join(cwd, 'inline.json'), JSON.stringify({ projectPath: created.projectPath, expectedRevision: 0, brief: { ...stored.brief, audience: 'CLI原有内联入口' } }));
  const inline = run(t, ['record', '--args', 'inline.json', '--json'], cwd); if (!inline) return;
  assert.equal(inline.status, 0, inline.stderr); assert.equal(JSON.parse(inline.stdout).revision, 1);
  await writeFile(join(cwd, 'batch.json'), JSON.stringify({ brief: { ...stored.brief, audience: '推荐批次入口' } }));
  await writeFile(join(cwd, 'route.json'), JSON.stringify({ projectPath: created.projectPath, expectedRevision: 1, recordsPath: 'batch.json' }));
  const batched = run(t, ['record', '--args', 'route.json', '--json'], cwd); if (!batched) return;
  assert.equal(batched.status, 0, batched.stderr); assert.equal(JSON.parse(batched.stdout).revision, 2);
  assert.equal(JSON.parse(await readFile(created.projectPath, 'utf8')).brief.audience, '推荐批次入口');
});

test('missing execution args points to the command discovery entry points', async t => {
  const cwd = await workspace(t), result = run(t, ['render'], cwd); if (!result) return;
  assert.equal(result.status, 1);
  assert.match(result.stderr, /render --help.*render --schema/);
});
