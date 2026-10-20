import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { resolve, join, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { apply, inject } from '../src/index.mjs'
import { buildAcademicTools, TOOL_COMMANDS, formatToolResult } from '../src/tools.mjs'

function fakeHost({ failAt } = {}) {
  const tools = new Map(), skills = new Map(), events = new Map(), warnings = []
  const ctx = {
    tools: { register(definition) {
      if (tools.size === failAt) throw new Error('Host registration rejected')
      tools.set(definition.name, definition)
      return () => tools.delete(definition.name)
    } },
    skills: { register(definition) { skills.set(definition.name, definition); return () => skills.delete(definition.name) } },
    on(event, callback) { events.set(event, callback) },
    logger: { warn(message) { warnings.push(message) } },
  }
  return { ctx, tools, skills, events, warnings }
}

async function folder(t) {
  const root = resolve('.test-output'); await mkdir(root, { recursive: true })
  const path = await mkdtemp(join(root, 'registration-'))
  t.after(() => rm(path, { recursive: true, force: true }))
  return path
}

test('DSH registers the academic skill and all ten raw-schema tools and disposes them', () => {
  assert.deepEqual(inject, ['tools', 'skills'])
  const host = fakeHost(); apply(host.ctx)
  assert.equal(host.tools.size, 10)
  assert.deepEqual([...host.tools.keys()].sort(), Object.values(TOOL_COMMANDS).sort())
  const skill = host.skills.get('dsh-academic-ppt')
  assert.equal(skill.source, 'runtime')
  assert.equal(skill.resourceBase.kind, 'directory')
  assert.ok(isAbsolute(skill.resourceBase.path))
  assert.ok(skill.description.length > 30)
  assert.ok(skill.content.length > 300)
  for (const definition of host.tools.values()) {
    assert.equal(definition.parameters.type, 'object')
    assert.equal(definition.parameters.additionalProperties, false)
    assert.deepEqual(JSON.parse(JSON.stringify(definition.parameters)), definition.parameters)
    assert.equal(definition.output.schema.type, 'object')
    assert.equal(typeof definition.execute, 'function')
  }
  assert.deepEqual(host.warnings, [])
  host.events.get('dispose')(); host.events.get('dispose')()
  assert.equal(host.tools.size, 0); assert.equal(host.skills.size, 0)
})

test('failed registration releases earlier contributions and invalid global config is explicit', () => {
  const host = fakeHost({ failAt: 2 })
  assert.throws(() => apply(host.ctx), /Host registration rejected/)
  assert.equal(host.tools.size, 0); assert.equal(host.skills.size, 0)
  assert.throws(() => apply(fakeHost().ctx, { outputDir: 'hidden-global-dir' }), /不接受全局配置/)
})

test('raw-schema calls reject malformed args before invoking an executor', async () => {
  let called = 0
  const tool = buildAcademicTools({ academic_ppt_check: async () => { called++; return { ok: true } } }).find(t => t.name === 'academic_ppt_check')
  for (const args of [null, [], {}, { projectPath: '' }, { projectPath: 'report.json', cwd: '/elsewhere' }]) {
    await assert.rejects(tool.execute(args), /INVALID_INPUT/)
  }
  assert.equal(called, 0)
})

test('registered wire schemas use the current DSH subset while runtime bounds remain enforced', async () => {
  const allowed = new Set(['type', 'oneOf', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const', 'description', 'title', 'default', 'examples'])
  const inspect = schema => {
    for (const key of Object.keys(schema)) assert.ok(allowed.has(key), `unsupported wire keyword ${key}`)
    if ('enum' in schema || 'const' in schema) assert.ok(['string', 'number', 'integer', 'boolean', 'null'].includes(schema.type), 'DSH enum/const requires an explicit scalar type')
    if (schema.properties) Object.values(schema.properties).forEach(inspect)
    if (schema.items) inspect(schema.items)
    if (schema.oneOf) schema.oneOf.forEach(inspect)
  }
  const tools = buildAcademicTools({ academic_ppt_check: async () => ({ ok: true }) })
  for (const tool of tools) { inspect(tool.parameters); inspect(tool.output.schema) }
  const check = tools.find(tool => tool.name === 'academic_ppt_check')
  assert.match(check.parameters.properties.projectPath.description, /maxLength=3000/)
  await assert.rejects(check.execute({ projectPath: 'x'.repeat(3001) }), /INVALID_INPUT/)
})

test('call identity uses session cwd and signal, does not mutate frozen args or process cwd', async t => {
  const cwd = await folder(t), before = process.cwd(), controller = new AbortController()
  let received
  const tool = buildAcademicTools({ academic_ppt_check: async options => { received = options; return { ok: true, projectPath: 'report.json' } } }).find(t => t.name === 'academic_ppt_check')
  const args = Object.freeze({ projectPath: 'report.json' })
  const result = await tool.execute(args, { signal: controller.signal, agent: { session: { header: { cwd } } } })
  assert.equal(received.cwd, cwd); assert.equal(received.signal, controller.signal)
  assert.deepEqual(args, { projectPath: 'report.json' })
  assert.equal(process.cwd(), before); assert.equal(result.ok, true)
  controller.abort(new Error('cancelled before dispatch'))
  received = undefined
  await assert.rejects(tool.execute(args, { signal: controller.signal }), /cancelled before dispatch/)
  assert.equal(received, undefined)
})

test('template access rejects escaping the calling workspace before reading a file', async t => {
  const cwd = await folder(t)
  const tool = buildAcademicTools().find(t => t.name === 'academic_ppt_template')
  await assert.rejects(tool.execute({ filePath: '../other-template.pptx' }, { agent: { session: { header: { cwd } } } }), /PATH_OUTSIDE_WORKSPACE/)
})

test('tool summaries are bounded and never dump embedded asset data', () => {
  const value = { ok: true, revision: 3, projectPath: 'report.json', assets: [{ data: 'PRIVATE_BASE64_CONTENT' }], issues: Array.from({ length: 100 }, (_, index) => ({ severity: 'warning', slideId: 'S' + index, message: 'x'.repeat(1000) })) }
  const result = formatToolResult('academic_ppt_check', value)
  assert.doesNotMatch(result, /PRIVATE_BASE64_CONTENT/)
  assert.match(result, /其余检查事项/)
  assert.ok(result.length < 10000)
})

test('real registered init creates a project in session workspace and context/check can reopen it', async t => {
  const cwd = await folder(t), host = fakeHost(); apply(host.ctx)
  const exec = { signal: new AbortController().signal, agent: { session: { header: { cwd } } } }
  const created = await host.tools.get('academic_ppt_init').execute({ projectDir: 'research-talk', title: '学术汇报注册测试' }, exec)
  assert.equal(created.ok, true)
  assert.equal(created.revision, 0)
  assert.ok(created.projectPath.startsWith(cwd))
  const project = JSON.parse(await readFile(created.projectPath, 'utf8'))
  assert.equal(project.title, '学术汇报注册测试')
  assert.equal(project.revision, 0)
  const context = await host.tools.get('academic_ppt_context').execute({ projectPath: created.projectPath, stage: 'research' }, exec)
  assert.equal(context.stage, 'research')
  assert.ok(Array.isArray(context.nextActions))
  const checked = await host.tools.get('academic_ppt_check').execute({ projectPath: created.projectPath }, exec)
  assert.ok(Array.isArray(checked.issues))
  assert.equal(checked.revision, 0)
  host.events.get('dispose')()
})

test('native template tool persists reusable profile, reuses equal content and protects unequal files', async t => {
  const cwd = await folder(t), host = fakeHost(); apply(host.ctx)
  const exec = { signal: new AbortController().signal, agent: { session: { header: { cwd } } } }
  const created = await host.tools.get('academic_ppt_init').execute({ projectDir: 'template-test', title: 'Local template fixture' }, exec)
  const project = JSON.parse(await readFile(created.projectPath, 'utf8'))
  project.slides = [{ id: 's1', layout: 'comparison', title: 'Local template fixture', paperIds: [], claimIds: [], figureIds: [], notes: 'Synthetic fixture, no scientific results.', seconds: 60,
    cards: [{ id: 'frame', kind: 'method', title: 'Native frame', body: 'Editable native component.', claimIds: [], style: 'floating-tab' }] }]
  const { renderProject } = await import('../src/render.mjs')
  const rendered = await renderProject(project)
  await writeFile(join(cwd, 'template.pptx'), rendered.pptx)
  const template = host.tools.get('academic_ppt_template')
  const first = await template.execute({ filePath: 'template.pptx' }, exec)
  assert.equal(first.ok, true); assert.ok(first.profilePath.startsWith(cwd))
  assert.ok(first.components.length > 0)
  const saved = await readFile(first.profilePath)
  const repeated = await template.execute({ filePath: 'template.pptx' }, exec)
  assert.equal(repeated.profilePath, first.profilePath)
  assert.deepEqual(await readFile(first.profilePath), saved)
  assert.ok(template.output.render({}, first)[0].text.includes(first.profilePath))
  assert.ok(template.output.render({}, first)[0].text.includes(first.components[0].id))
  const registered = await host.tools.get('academic_ppt_record').execute({ projectPath: created.projectPath, expectedRevision: 0, templateProfilePaths: [first.profilePath] }, exec)
  assert.equal(registered.revision, 1)
  const updated = JSON.parse(await readFile(created.projectPath, 'utf8'))
  assert.ok(updated.design.templateProfile.components.length > 0)
  await writeFile(first.profilePath, 'Keep this different file.\n')
  await assert.rejects(template.execute({ filePath: 'template.pptx' }, exec), /PROFILE_EXISTS/)
  assert.equal(await readFile(first.profilePath, 'utf8'), 'Keep this different file.\n')
  const copy = await template.execute({ filePath: 'template.pptx', outputPath: 'profiles/second.json' }, exec)
  assert.notEqual(copy.profilePath, first.profilePath)
  host.events.get('dispose')()
})

test('CLI consumes a JSON argument file in its working directory and reports invalid UTF-8', async t => {
  const cwd = await folder(t), cli = fileURLToPath(new URL('../bin/academic-ppt.mjs', import.meta.url))
  await writeFile(join(cwd, 'params.json'), JSON.stringify({ projectDir: 'cli-report', title: '命令行学术汇报' }))
  const run = spawnSync(process.execPath, [cli, 'init', '--args', 'params.json', '--json'], { cwd, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 })
  if (run.error?.code === 'EPERM') { t.skip('Current execution sandbox does not allow nested Node processes; run CLI smoke separately.'); return }
  assert.ifError(run.error)
  assert.equal(run.status, 0, run.stderr)
  const result = JSON.parse(run.stdout)
  assert.equal(result.revision, 0)
  assert.ok(result.projectPath.startsWith(cwd))
  assert.equal(JSON.parse(await readFile(result.projectPath, 'utf8')).title, '命令行学术汇报')
  await writeFile(join(cwd, 'bad.json'), Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d]))
  const invalid = spawnSync(process.execPath, [cli, 'init', '--args', 'bad.json'], { cwd, encoding: 'utf8' })
  assert.equal(invalid.status, 1)
  assert.match(invalid.stderr, /有效的 UTF-8 JSON/)
})
