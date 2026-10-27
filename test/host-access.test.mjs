import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, parse, resolve } from 'node:path'
import { assertHostOperationAccess, operationWrites } from '../src/host-access.mjs'
import { TOOL_COMMANDS, buildAcademicTools } from '../src/tools.mjs'

async function fixture(t) {
  const parent = resolve('.test-output')
  await mkdir(parent, { recursive: true })
  const root = await mkdtemp(join(parent, 'host-access-'))
  const child = join(root, 'current')
  await mkdir(child)
  t.after(() => rm(root, { recursive: true, force: true }))
  return { root, child, outside: parse(await realpath(root)).root }
}

test('the Host write classification covers all nineteen tools and conditional report outputs', () => {
  const readOnly = new Set(['context', 'check', 'reference', 'contract', 'cards', 'layouts', 'prepare', 'portfolio', 'plan'])
  assert.equal(Object.keys(TOOL_COMMANDS).length, 19)
  for (const name of Object.values(TOOL_COMMANDS)) {
    assert.equal(operationWrites(name), !readOnly.has(name.replace('academic_ppt_', '')), name)
  }
  for (const name of ['academic_ppt_prepare', 'academic_ppt_portfolio']) {
    assert.equal(operationWrites(name, { outputPath: 'report.json' }), true)
    assert.equal(operationWrites(name, {}), false)
  }
  assert.equal(operationWrites('academic_ppt_plan', { requestPath: 'storyboard.json' }), true)
  assert.equal(operationWrites('academic_ppt_template', { render: false }), true)
  assert.equal(operationWrites('future_tool'), true)
})

test('read-only permits inspection but denies every classified mutation before execution', async t => {
  const { root } = await fixture(t)
  const policy = { mode: 'read-only', workspaceRoot: root }
  for (const name of Object.values(TOOL_COMMANDS)) {
    const check = assertHostOperationAccess({ name, args: {}, cwd: root, policy })
    if (operationWrites(name)) await assert.rejects(check, /ACADEMIC_WRITE_DENIED.*read-only/)
    else await check
  }
  await assert.rejects(assertHostOperationAccess({ name: 'academic_ppt_prepare', args: { outputPath: 'report.json' }, cwd: root, policy }), /ACADEMIC_WRITE_DENIED/)
  let executed = false
  const tool = buildAcademicTools({ academic_ppt_init: async () => { executed = true; return { ok: true } } }, {
    resolveCwd: () => root,
    beforeExecute: ({ name, args, cwd }) => assertHostOperationAccess({ name, args, cwd, policy }),
  }).find(tool => tool.name === 'academic_ppt_init')
  await assert.rejects(tool.execute({ projectDir: 'denied', title: 'Must never execute' }), /ACADEMIC_WRITE_DENIED/)
  assert.equal(executed, false)
})

test('workspace-write uses its independent canonical roots, not a changed current directory', async t => {
  const { root, child, outside } = await fixture(t)
  const policy = { mode: 'workspace-write', workspaceRoot: root }
  const check = cwd => assertHostOperationAccess({ name: 'academic_ppt_init', cwd, policy })
  await check(root)
  await check(child)
  // Only read the filesystem-root identity; no file is created outside the
  // fixture. Unlike a second mkdtemp directory, this is not an allowed /tmp.
  await assert.rejects(check(outside), /ACADEMIC_WRITE_DENIED/)
  const escaped = join(root, 'escaped-current-directory')
  await symlink(outside, escaped, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(check(escaped), /ACADEMIC_WRITE_DENIED/)
  const alias = join(root, 'current-alias')
  await symlink(child, alias, process.platform === 'win32' ? 'junction' : 'dir')
  await check(alias)
  for (const temporaryRoot of new Set(['/tmp', tmpdir()])) {
    try { await realpath(temporaryRoot) } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') continue
      throw error
    }
    await check(temporaryRoot)
  }
})

test('missing or invalid write policies fail closed and explicit full access stays distinct', async t => {
  const { root, outside } = await fixture(t)
  for (const policy of [undefined, {}, { mode: 'unknown', workspaceRoot: root }, { mode: 'workspace-write' }, { mode: 'workspace-write', workspaceRoot: 'relative-root' }]) {
    await assert.rejects(assertHostOperationAccess({ name: 'academic_ppt_init', cwd: root, policy }), /ACADEMIC_WRITE_POLICY_REQUIRED/)
  }
  await assertHostOperationAccess({ name: 'academic_ppt_init', cwd: outside, policy: { mode: 'danger-full-access', workspaceRoot: root } })
  const signal = AbortSignal.abort(new Error('cancelled before file access'))
  await assert.rejects(assertHostOperationAccess({ name: 'academic_ppt_cards', cwd: root, policy: { mode: 'read-only' }, signal }), /cancelled before file access/)
})
