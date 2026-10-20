import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { join, resolve, isAbsolute } from 'node:path'
import { buildAcademicTools, formatToolResult } from '../src/tools.mjs'
import { REFERENCE_TEMPLATES, REFERENCE_CATEGORIES } from '../src/reference-catalog.mjs'
import { LAYOUTS, CARD_STYLES } from '../src/schema.mjs'
import { createProject, updateRecords, evidenceIssues, slideClaimIds, checkProject, buildProject } from '../src/core.mjs'
import { brief, paper, claim, asset, slides } from './fixtures.mjs'

async function workspace(t) {
  const base = resolve('.test-output'); await mkdir(base, { recursive: true })
  const cwd = await mkdtemp(join(base, 'references-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  return cwd
}

test('reference catalogue has 48 usable semantic geometries with bounded, matched slots', () => {
  assert.equal(REFERENCE_TEMPLATES.length, 48)
  assert.equal(new Set(REFERENCE_TEMPLATES.map(t => t.id)).size, 48)
  assert.equal(REFERENCE_TEMPLATES.filter(t => t.requirements.table).length, 8)
  for (const c of REFERENCE_CATEGORIES) assert.equal(REFERENCE_TEMPLATES.filter(t => t.category === c.id).length, 6)
  const signatures = new Set()
  for (const t of REFERENCE_TEMPLATES) {
    assert.ok(LAYOUTS.includes(t.layout), t.id)
    for (const style of t.cardStyles) assert.ok(CARD_STYLES.includes(style), t.id + ' style ' + style)
    for (const [key, slots] of Object.entries(t.slots)) for (const b of Array.isArray(slots) ? slots : [slots]) {
      assert.ok(b.x >= 0 && b.y >= 0 && b.w > 0 && b.h > 0 && b.x + b.w <= 1280 && b.y + b.h <= 720, t.id + '/' + key)
    }
    for (const [type, slots] of [['cards', t.slots.cards], ['figures', t.slots.figures], ['nodes', t.slots.nodeBoxes ?? []]]) {
      assert.ok(slots.length >= t.requirements[type].min && slots.length <= t.requirements[type].max, t.id + '/' + type)
    }
    assert.equal(t.cardStyles.length, t.slots.cards.length, t.id)
    signatures.add(JSON.stringify(t.slots))
  }
  assert.equal(signatures.size, 48, 'each entry must provide a distinct geometry, not a palette alias')
})

test('reference tool lists or selects only bundled layouts without changing the calling workspace', async t => {
  const cwd = await workspace(t), tool = buildAcademicTools().find(t => t.name === 'academic_ppt_reference')
  const exec = { agent: { session: { header: { cwd } } } }
  const all = await tool.execute({}, exec)
  assert.equal(all.count, 48)
  const subset = await tool.execute({ category: 'figure' }, exec)
  assert.equal(subset.count, 6)
  const selected = await tool.execute({ templateId: 'figure-detail-window', category: 'figure' }, exec)
  assert.equal(selected.binding.referenceTemplateId, 'figure-detail-window')
  assert.equal(selected.binding.layout, 'figure-split')
  assert.ok(Object.values(selected.files).every(isAbsolute))
  const summary = formatToolResult('academic_ppt_reference', selected)
  assert.match(summary, /referenceTemplateId/)
  assert.match(summary, /gallery.html/)
  assert.ok(summary.length < 12000)
  selected.template.slots.cards[0].w = 1
  assert.notEqual((await tool.execute({ templateId: 'figure-detail-window' }, exec)).template.slots.cards[0].w, 1)
  assert.deepEqual(await readdir(cwd), [])
  await assert.rejects(tool.execute({ templateId: 'unknown' }, exec), /UNKNOWN_REFERENCE_TEMPLATE/)
  await assert.rejects(tool.execute({ templateId: 'figure-detail-window', category: 'paper' }, exec), /REFERENCE_CATEGORY_MISMATCH/)
  await assert.rejects(tool.execute({ templateId: '../private' }, exec), /INVALID_INPUT/)
})

test('reference layout requirements reject missing evidence instead of silently leaving template blanks', async t => {
  const cwd = await workspace(t), created = await createProject({ cwd, projectDir: 'project', title: 'Reference fixture', brief })
  const missing = { ...slides[1], referenceTemplateId: 'figure-two-panels', layout: 'figure-split' }
  await updateRecords({ cwd, projectPath: created.projectPath, expectedRevision: 0, papers: [paper], claims: [claim], assets: [asset], slides: [slides[0], missing, slides[2]] })
  const built = await buildProject({ cwd, projectPath: created.projectPath, expectedRevision: 1 })
  assert.equal(built.status, 'blocked')
  assert.ok(built.issues.some(i => i.code === 'reference-content-count'))
  const p = JSON.parse(await readFile(created.projectPath, 'utf8'))
  p.slides[1].layout = 'results'
  assert.ok(evidenceIssues(p).some(i => i.code === 'reference-layout-mismatch'))
})

test('native table sources cannot bypass full-text, full-title or visible citation checks', async t => {
  const cwd = await workspace(t), created = await createProject({ cwd, projectDir: 'project', title: 'Table fixture', brief })
  const p2 = { ...paper, id: 'P2', title: 'Second synthetic table source', reading: { ...paper.reading, status: 'abstract-only' } }
  const c2 = { ...claim, id: 'C2', paperId: 'P2' }
  const tableSlide = { ...slides[1], layout: 'comparison', figureIds: [], table: { columns: ['Input', 'Count'], rows: [['Fixture', '3/4']], sourceClaimIds: ['C2'] } }
  assert.ok(slideClaimIds(tableSlide).includes('C2'))
  await updateRecords({ cwd, projectPath: created.projectPath, expectedRevision: 0, papers: [paper, p2], claims: [claim, c2], assets: [asset], slides: [slides[0], tableSlide, slides[2]] })
  const built = await buildProject({ cwd, projectPath: created.projectPath, expectedRevision: 1 })
  assert.equal(built.status, 'blocked')
  for (const code of ['claim-source-not-visible', 'full-text-required', 'full-title-on-slide', 'reference-entry']) assert.ok(built.issues.some(i => i.code === code), code)
})

test('table source binding is explicit even when the slide already cites a claim', async t => {
  const cwd = await workspace(t), created = await createProject({ cwd, projectDir: 'project', title: 'Explicit table binding fixture', brief })
  const tableSlide = { ...slides[1], layout: 'comparison', figureIds: [], table: { columns: ['Input', 'Count'], rows: [['Fixture', '3/4']] } }
  await updateRecords({ cwd, projectPath: created.projectPath, expectedRevision: 0, papers: [paper], claims: [claim], assets: [asset], slides: [slides[0], tableSlide, slides[2]] })
  const built = await buildProject({ cwd, projectPath: created.projectPath, expectedRevision: 1 })
  assert.equal(built.status, 'blocked')
  assert.ok(built.issues.some(i => i.code === 'table-data-source'))
})

test('panel title overrides must correspond to actual reference panels', async t => {
  const cwd = await workspace(t), created = await createProject({ cwd, projectDir: 'project', title: 'Panel binding fixture', brief })
  const slide = { ...slides[1], referenceTemplateId: 'figure-portrait-reading', panelTitles: ['Actual figure panel', 'Unconsumed second title'] }
  await updateRecords({ cwd, projectPath: created.projectPath, expectedRevision: 0, papers: [paper], claims: [claim], assets: [asset], slides: [slides[0], slide, slides[2]] })
  const p = JSON.parse(await readFile(created.projectPath, 'utf8'))
  assert.ok(evidenceIssues(p).some(i => i.code === 'panel-title-count'))
  delete p.slides[1].referenceTemplateId
  assert.ok(evidenceIssues(p).some(i => i.code === 'panel-titles-without-reference'))
})

test('invalid source crop and ragged tables are rejected atomically', async t => {
  const cwd = await workspace(t), created = await createProject({ cwd, projectDir: 'project', title: 'Bounds fixture', brief })
  const options = { cwd, projectPath: created.projectPath, expectedRevision: 0 }
  const before = await readFile(created.projectPath)
  await assert.rejects(updateRecords({ ...options, assets: [{ ...asset, viewport: { x: 0.8, y: 0, w: 0.5, h: 1 } }] }), /INVALID_VIEWPORT/)
  await assert.rejects(updateRecords({ ...options, slides: [{ ...slides[0], table: { columns: ['A', 'B'], rows: [['only one']] } }] }), /TABLE_DIMENSIONS/)
  assert.deepEqual(await readFile(created.projectPath), before)
})

test('previous renderer artifacts cannot inherit current visual approval after renderer upgrade', async t => {
  const cwd = await workspace(t), created = await createProject({ cwd, projectDir: 'project', title: 'Renderer version fixture', brief })
  await updateRecords({ cwd, projectPath: created.projectPath, expectedRevision: 0, papers: [paper], claims: [claim], assets: [asset], slides })
  const built = await buildProject({ cwd, projectPath: created.projectPath, expectedRevision: 1 })
  assert.equal(built.ok, true)
  const p = JSON.parse(await readFile(created.projectPath, 'utf8'))
  delete p.artifact.rendererVersion
  const { writeFile } = await import('node:fs/promises')
  await writeFile(created.projectPath, JSON.stringify(p))
  const checked = await checkProject({ cwd, projectPath: created.projectPath })
  assert.equal(checked.artifact.current, false)
  assert.equal(checked.artifact.reason, 'renderer-updated-rebuild-required')
  assert.equal(checked.verification.readyForDelivery, false)
})
