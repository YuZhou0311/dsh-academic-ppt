import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { buildAcademicTools, formatToolResult } from '../src/tools.mjs'
import { toolContract, jsonSafeResult } from '../src/tool-contract.mjs'
import { briefSchema, paperSchema, claimSchema, assetSchema, slideSchema, designSchema, assessmentSchema } from '../src/schema.mjs'

test('registered init and record omit bulky repeated record schemas while retaining exact routing', () => {
  const tools = buildAcademicTools()
  const init = tools.find(tool => tool.name === 'academic_ppt_init')
  const record = tools.find(tool => tool.name === 'academic_ppt_record')
  assert.deepEqual(Object.keys(init.parameters.properties), ['projectDir', 'title', 'brief', 'capabilities'])
  assert.deepEqual(Object.keys(record.parameters.properties), ['projectPath', 'expectedRevision', 'recordsPath'])
  assert.deepEqual(record.parameters.required, ['projectPath', 'expectedRevision', 'recordsPath'])
  assert.match(record.parameters.properties.projectPath.description, /project\.json/)
  const bytes = Buffer.byteLength(JSON.stringify(tools.map(({ name, description, parameters }) => ({ name, description, parameters }))))
  assert.ok(bytes < 18000, `registered definitions regressed to ${bytes} bytes`)
})

test('each on-demand contract returns the complete schema without silently truncating it', async () => {
  const schemas = { brief: briefSchema, paper: paperSchema, claim: claimSchema, asset: assetSchema, slide: slideSchema, design: designSchema, assessment: assessmentSchema }
  const tool = buildAcademicTools().find(tool => tool.name === 'academic_ppt_contract')
  for (const [topic, expected] of Object.entries(schemas)) {
    const result = await tool.execute({ topic })
    assert.deepEqual(result.schema, expected)
    assert.ok(Buffer.byteLength(JSON.stringify(result)) < 18000, topic)
    const rendered = formatToolResult(tool.name, result)
    assert.ok(rendered.includes(JSON.stringify(expected)), `${topic} schema was truncated`)
    result.schema.type = 'changed locally'
    assert.equal((await toolContract({ topic })).schema.type, 'object')
  }
  await assert.rejects(tool.execute({ topic: 'all' }), /INVALID_INPUT/)
  await assert.rejects(tool.execute({ topic: 'paper', unrelated: true }), /INVALID_INPUT/)
})

test('JSON output omits optional object undefined without changing executor-owned data', () => {
  const original = Object.freeze({ ok: true, preservation: undefined, nested: Object.freeze({ missing: undefined, present: null }), rows: Object.freeze([{ missing: undefined, value: 3 }]) })
  const safe = jsonSafeResult(original)
  assert.deepEqual(safe, { ok: true, nested: { present: null }, rows: [{ value: 3 }] })
  assert.ok(Object.hasOwn(original, 'preservation'))
  assert.deepEqual(JSON.parse(JSON.stringify(safe)), safe)
  const shared = { ok: true }
  assert.deepEqual(jsonSafeResult({ a: shared, b: shared }), { a: shared, b: shared })
})

test('JSON output rejects values that JSON.stringify would silently lose or coerce', () => {
  for (const value of [undefined, { rows: [undefined] }, { rows: Array(1) }, { n: NaN }, { n: Infinity }, { n: -Infinity }, { n: 1n }, { f() {} }, { d: new Date() }, { m: new Map() }]) {
    assert.throws(() => jsonSafeResult(value), /NON_JSON_TOOL_RESULT/)
  }
  const cycle = {}; cycle.self = cycle
  assert.throws(() => jsonSafeResult(cycle), /contains a cycle/)
  const accessor = Object.defineProperty({}, 'value', { get() { throw new Error('must not run'); }, enumerable: true })
  assert.throws(() => jsonSafeResult(accessor), /contains an accessor/)
})

test('registered executor output is normalized and malformed array values fail explicitly', async () => {
  const options = { projectPath: 'project.json' }
  const clean = buildAcademicTools({ academic_ppt_check: async () => ({ ok: true, preservation: undefined }) }).find(tool => tool.name === 'academic_ppt_check')
  assert.deepEqual(await clean.execute(options), { ok: true })
  const invalid = buildAcademicTools({ academic_ppt_check: async () => ({ ok: true, values: [undefined] }) }).find(tool => tool.name === 'academic_ppt_check')
  await assert.rejects(invalid.execute(options), /NON_JSON_TOOL_RESULT.*\[0\]/)
})

test('file-backed records and a real slide-content edit return a committed JSON-safe revision once', async t => {
  const base = resolve('.test-output'); await mkdir(base, { recursive: true })
  const cwd = await mkdtemp(join(base, 'contract-')); t.after(() => rm(cwd, { recursive: true, force: true }))
  const exec = { agent: { session: { header: { cwd } } } }
  const tools = new Map(buildAcademicTools().map(tool => [tool.name, tool]))
  const created = await tools.get('academic_ppt_init').execute({ projectDir: 'report', title: 'Contract test' }, exec)
  const slide = { id: 'S1', layout: 'cover', title: 'Before', paperIds: [], claimIds: [], figureIds: [], cards: [], notes: 'Synthetic contract fixture.', seconds: 20 }
  await writeFile(join(cwd, 'slides.json'), JSON.stringify({ slides: [slide] }))
  const registered = await tools.get('academic_ppt_record').execute({ projectPath: created.projectPath, expectedRevision: 0, recordsPath: 'slides.json' }, exec)
  assert.equal(registered.revision, 1)
  const edited = await tools.get('academic_ppt_edit').execute({ projectPath: created.projectPath, expectedRevision: 1, scope: 'slide-content', changes: [{ slideId: 'S1', patch: { title: 'After' } }] }, exec)
  assert.equal(edited.revision, 2)
  assert.deepEqual(JSON.parse(JSON.stringify(edited)), edited)
  assert.equal(Object.hasOwn(edited, 'preservation'), false)
  const saved = JSON.parse(await readFile(created.projectPath, 'utf8'))
  assert.equal(saved.revision, 2)
  assert.equal(saved.slides[0].title, 'After')
})

test('assessment exposes the public capability record without automatically upgrading an unknown host', async t => {
  const base=resolve('.test-output');await mkdir(base,{recursive:true})
  const cwd=await mkdtemp(join(base,'capability-contract-'));t.after(()=>rm(cwd,{recursive:true,force:true}))
  const exec={agent:{session:{header:{cwd}}}},tools=new Map(buildAcademicTools().map(tool=>[tool.name,tool]))
  const contract=await tools.get('academic_ppt_contract').execute({topic:'assessment'},exec)
  assert.deepEqual(contract.capabilityRecord.schema.properties.imageInput.enum,['supported','unsupported','unknown'])
  assert.ok(formatToolResult('academic_ppt_contract',contract).includes(JSON.stringify(contract.capabilityRecord.schema)))
  const created=await tools.get('academic_ppt_init').execute({projectDir:'report',title:'Capability contract fixture'},exec)
  assert.equal(JSON.parse(await readFile(created.projectPath,'utf8')).capabilities.imageInput,'unknown')
  const capabilities={imageInput:'supported',source:'Synthetic test fixture: the test explicitly supplies the declared host capability; no real visual review is claimed.'}
  await writeFile(join(cwd,'capability.json'),JSON.stringify({[contract.capabilityRecord.recordKey]:capabilities}))
  const recorded=await tools.get('academic_ppt_record').execute({projectPath:created.projectPath,expectedRevision:0,recordsPath:'capability.json'},exec)
  assert.equal(recorded.revision,1)
  assert.deepEqual(JSON.parse(await readFile(created.projectPath,'utf8')).capabilities,capabilities)
})
