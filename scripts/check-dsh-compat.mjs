#!/usr/bin/env node
/** Exercise the plugin through an installed official DSH runtime, without a model or credentials. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir, mkdtemp, rm, access } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { unzipSync } from 'fflate'
import * as academic from '../src/index.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const options = {}
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]
  if (!['--runtime-dir', '--output'].includes(key) || !process.argv[i + 1]) {
    throw new Error('Usage: node scripts/check-dsh-compat.mjs --runtime-dir /path/to/isolated/runtime [--output report.json]')
  }
  options[key] = resolve(process.argv[i + 1])
}
assert.ok(options['--runtime-dir'], '--runtime-dir is required; the script never installs or modifies DSH profiles')
const requireRuntime = createRequire(join(options['--runtime-dir'], 'package.json'))
const load = name => import(pathToFileURL(requireRuntime.resolve(name)).href)
const versionOf = name => requireRuntime(`${name}/package.json`).version
const versions = Object.fromEntries(['@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-skill', '@deepseek-ai/dsh-system-prompt', '@deepseek-ai/dsh-app-boot', '@deepseek-ai/cordis'].map(name => [name, versionOf(name)]))
const runtimeVersion = versions['@deepseek-ai/dsh-tools']
for (const [name, version] of Object.entries(versions)) {
  if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(version, runtimeVersion, `mixed DSH package versions: ${name}`)
}
const [{ Context }, { default: SystemPrompt }, { default: Tools }, { default: Skills }, { evaluatePluginCompatibility }] = await Promise.all([
  load('@deepseek-ai/cordis'), load('@deepseek-ai/dsh-system-prompt'), load('@deepseek-ai/dsh-tools'), load('@deepseek-ai/dsh-skill'), load('@deepseek-ai/dsh-app-boot'),
])
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
assert.equal(typeof manifest.engines?.dsh, 'string', 'package.json must declare engines.dsh')
assert.equal(evaluatePluginCompatibility(manifest, {}, runtimeVersion), undefined, 'runtime rejects the package compatibility range')
for (const excluded of ['0.2.1-rc.1', '0.3.0-alpha.1', '0.3.0']) {
  assert.ok(evaluatePluginCompatibility(manifest, {}, excluded), `unverified runtime ${excluded} must not pass the declared range`)
}

const temporaryRoot = join(root, '.test-output')
await mkdir(temporaryRoot, { recursive: true })
const workspace = await mkdtemp(join(temporaryRoot, 'dsh-host-'))
const ctx = new Context()
const checks = []
const originalCwd = process.cwd()
let calls = 0
const agent = { ctx, session: { id: 'academic-plugin-compatibility-fixture', header: { cwd: workspace } } }
const execute = (name, args, signal = new AbortController().signal) => ctx.tools.execute({
  callId: `academic-compat-${++calls}`, name, arguments: args, agent, signal,
})
async function successful(name, args) {
  const result = await execute(name, args)
  assert.equal(result.isError, false, JSON.stringify(result))
  assert.ok(result.value && typeof result.value === 'object', `${name} must return canonical JSON`)
  assert.deepEqual(JSON.parse(JSON.stringify(result.value)), result.value)
  assert.ok(result.content.some(block => block.type === 'text' && block.text.length > 0))
  return result.value
}

try {
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(Tools)
  await ctx.plugin(Skills)
  let plugin = ctx.plugin(academic)
  await plugin
  assert.equal(ctx.tools.schemas().length, 16)
  const summaries = await ctx.skills.list({ cwd: workspace })
  assert.equal(summaries.filter(skill => skill.name === academic.name).length, 1)
  const skill = await ctx.skills.get(academic.name, { cwd: workspace })
  assert.ok(skill?.content.length > 300)
  assert.equal(skill.resourceBase.kind, 'directory')
  await access(join(skill.resourceBase.path, 'SKILL.md'))
  checks.push('register sixteen tools and discover/load the packaged skill')

  const cards = await successful('academic_ppt_cards', {})
  assert.equal(cards.totalCount, 36)
  const contract = await successful('academic_ppt_contract', { topic: 'preparation' })
  assert.ok(JSON.stringify(contract).includes('paletteMode'))
  checks.push('query all 36 cards and the full preparation contract through the host pipeline')

  const created = await successful('academic_ppt_init', { projectDir: 'talk', title: 'DSH compatibility fixture' })
  assert.equal(created.projectPath, join(workspace, 'talk', 'project.json'))
  const batch = { slides: [{
    id: 'compatibility', layout: 'cover', title: 'DSH 宿主兼容检查',
    paperIds: [], claimIds: [], figureIds: [], cards: [], notes: '仅验证软件调用与原生对象导出，不含研究数据或视觉验收。', seconds: 20,
  }] }
  await writeFile(join(workspace, 'records.json'), JSON.stringify(batch))
  const recorded = await successful('academic_ppt_record', { projectPath: created.projectPath, expectedRevision: 0, recordsPath: 'records.json' })
  assert.equal(recorded.revision, 1)
  const context = await successful('academic_ppt_context', { projectPath: created.projectPath, stage: 'research' })
  assert.equal(context.revision, 1)
  const built = await successful('academic_ppt_build', { projectPath: created.projectPath, expectedRevision: 1, mode: 'draft' })
  assert.equal(built.status, 'draft')
  assert.equal(built.verification.visual, 'not-verified')
  const zip = unzipSync(await readFile(built.files.pptx))
  const slide = new TextDecoder().decode(zip['ppt/slides/slide1.xml'])
  assert.match(slide, /DSH 宿主兼容检查/)
  assert.match(slide, /<p:sp>/)
  const checked = await successful('academic_ppt_check', { projectPath: created.projectPath })
  assert.equal(checked.artifact.current, true)
  assert.equal(checked.verification.visual, 'not-verified')
  checks.push('create, record, reopen, export native PPTX and inspect current artifacts in the calling workspace')

  const invalid = await execute('academic_ppt_check', { projectPath: created.projectPath, cwd: '/not-the-calling-workspace' })
  assert.equal(invalid.isError, true)
  assert.match(JSON.stringify(invalid.content), /INVALID_INPUT/)
  const escape = await execute('academic_ppt_template', { filePath: '../outside.pptx' })
  assert.equal(escape.isError, true)
  assert.match(JSON.stringify(escape.content), /PATH_OUTSIDE_WORKSPACE/)
  const cancelled = await execute('academic_ppt_init', { projectDir: 'cancelled', title: 'must not be created' }, AbortSignal.abort())
  assert.equal(cancelled.isError, true)
  await assert.rejects(access(join(workspace, 'cancelled', 'project.json')), { code: 'ENOENT' })
  assert.equal(process.cwd(), originalCwd)
  checks.push('reject malformed arguments and workspace escapes; preserve cancellation and process cwd')

  await plugin.dispose()
  assert.equal(ctx.tools.schemas().length, 0)
  assert.equal((await ctx.skills.list({ cwd: workspace })).length, 0)
  plugin = ctx.plugin(academic)
  await plugin
  assert.equal(ctx.tools.schemas().length, 16)
  assert.equal((await ctx.skills.list({ cwd: workspace })).length, 1)
  await plugin.dispose()
  assert.equal(ctx.tools.schemas().length, 0)
  checks.push('dispose and remount without stale or duplicate registrations')
} finally {
  await ctx.fiber.dispose()
  await rm(workspace, { recursive: true, force: true })
}

const report = {
  ok: true, pluginVersion: manifest.version, runtimeVersion, versions,
  declaredDshRange: manifest.engines.dsh, node: process.version, platform: process.platform,
  toolCalls: calls, checks, checkedAt: new Date().toISOString(),
  scope: 'Published DSH Cordis services and tool execution pipeline in an isolated runtime; no model, credentials or Desktop/Web GUI session.',
}
if (options['--output']) {
  await mkdir(dirname(options['--output']), { recursive: true })
  await writeFile(options['--output'], JSON.stringify(report, null, 2) + '\n')
}
console.log(JSON.stringify(report, null, 2))
