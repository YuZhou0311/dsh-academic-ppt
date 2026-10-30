#!/usr/bin/env node
/**
 * Exercise published DSH services from Agent creation to the provider boundary.
 * Only the provider's responses are scripted. The agent loop, skill catalog and
 * loader, request assembly, native tool dispatch, renderers and filesystem are
 * the installed official packages. No API keys, model HTTP calls or user DSH
 * profiles are used. This script never installs dependencies.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { access, cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PNG } from 'pngjs'
import * as academic from '../src/index.mjs'
import { formatToolResult } from '../src/tools.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const packageNames = [
  '@deepseek-ai/cordis', '@deepseek-ai/dsh-agent', '@deepseek-ai/dsh-agent-loop',
  '@deepseek-ai/dsh-session', '@deepseek-ai/dsh-session-projection', '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-system-prompt', '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-skill',
  '@deepseek-ai/dsh-tool-skill', '@deepseek-ai/dsh-working-directory', '@deepseek-ai/dsh-fs-local',
  '@deepseek-ai/dsh-tool-fs', '@deepseek-ai/dsh-skill-filesystem',
  '@deepseek-ai/dsh-sandbox', '@deepseek-ai/dsh-sandbox-policy', '@deepseek-ai/dsh-fs-sandbox',
  '@deepseek-ai/dsh-attachment', '@deepseek-ai/dsh-attachment-local',
]
const json = value => JSON.parse(JSON.stringify(value))
const hash = value => createHash('sha256').update(value).digest('hex')
const textOf = message => (message?.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('\n')
const catalogsOf = request => request.messages.filter(message => message.source?.kind === 'skill-catalog')
const invocationsOf = request => request.messages.filter(message => message.source?.kind === 'skill-invocation')
const toolMessage = (request, callId) => request.messages.find(message => message.role === 'tool' && message.source?.callId === callId)
const sortedNames = schemas => schemas.map(tool => tool.name).sort()
const academicSchemas = request => (request.tools ?? []).filter(tool => tool.name.startsWith('academic_ppt_'))

export async function checkDshAgentInjection({ runtimeDir, output, artifactsDir } = {}) {
  assert.ok(runtimeDir, 'runtimeDir is required; install official dependencies in a disposable runtime first')
  runtimeDir = resolve(runtimeDir)
  const requireRuntime = createRequire(join(runtimeDir, 'package.json'))
  const versions = Object.fromEntries(packageNames.map(name => [name, requireRuntime(`${name}/package.json`).version]))
  const runtimeVersion = versions['@deepseek-ai/dsh-agent-loop']
  for (const [name, version] of Object.entries(versions)) {
    if (name.startsWith('@deepseek-ai/dsh-')) assert.equal(version, runtimeVersion, `mixed official DSH versions: ${name}`)
  }
  assert.ok(['0.2.1-rc.2', '0.2.1-rc.3'].includes(runtimeVersion), `unverified DSH release: ${runtimeVersion}`)
  const modules = await Promise.all(packageNames.map(name => import(pathToFileURL(requireRuntime.resolve(name)).href)))
  const byName = Object.fromEntries(packageNames.map((name, index) => [name, modules[index]]))
  const { Context } = byName['@deepseek-ai/cordis']
  const { LlmAdapter, createUserMessage, isAgentLoopRequest } = byName['@deepseek-ai/dsh-llm']
  const { renderSkillContent } = byName['@deepseek-ai/dsh-skill']
  const { setSandboxMode } = byName['@deepseek-ai/dsh-sandbox-policy']
  const { canonicalPath, writableRoots } = byName['@deepseek-ai/dsh-sandbox']
  const manifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
  const skillFile = join(projectRoot, 'skills', academic.name, 'SKILL.md')
  const skillSource = (await readFile(skillFile, 'utf8')).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const expectedBody = skillSource.replace(/^---\n[\s\S]*?\n---\s*\n/, '').trim()
  assert.notEqual(expectedBody, skillSource.trim(), 'fixture must independently remove SKILL frontmatter')
  const expectedDefinition = academic.readBundledSkill()
  assert.equal(expectedDefinition.content, expectedBody)
  const workflowPath = join(expectedDefinition.resourceBase.path, 'references', 'workflow-v010.md')
  const workflowSource = (await readFile(workflowPath, 'utf8')).replace(/\r\n?/g, '\n')
  const expectedTools = academic.buildAcademicTools().map(({ name, description, parameters }) => ({ name, description, parameters }))
  assert.equal(expectedTools.length, 19)
  const sourceHashes = Object.fromEntries(await Promise.all([
    'src/index.mjs', 'src/tools.mjs', 'src/host-access.mjs', 'src/core.mjs', 'src/design-intake.mjs',
    'src/design-dialogue.mjs', 'src/storyboard.mjs', 'src/tool-contract.mjs', 'src/academic-styles.mjs',
    'src/schema.mjs', 'src/scene.mjs', 'src/render.mjs', 'skills/dsh-academic-ppt/SKILL.md',
    'skills/dsh-academic-ppt/references/workflow-v010.md', 'skills/dsh-academic-ppt/references/academic-styles.md',
    'skills/dsh-academic-ppt/references/deepseek.md',
  ].map(async path => [path, hash(await readFile(join(projectRoot, path)))])))
  await mkdir(join(projectRoot, '.test-output'), { recursive: true })
  const workspace = await mkdtemp(join(projectRoot, '.test-output', 'agent-injection-'))
  // A separate controlled scratch directory, deliberately outside this
  // session's original workspace. Changing cwd must not grant it write access.
  // Keep B outside .test-output: the full suite may intentionally use that
  // directory as TMPDIR, which DSH correctly includes in its writable roots.
  const outsideFixtureRoot = join(dirname(projectRoot), 'analysis', 'dsh-injection-audit', 'policy-fixtures')
  await mkdir(outsideFixtureRoot, { recursive: true })
  const outsideWorkspace = await mkdtemp(join(outsideFixtureRoot, 'outside-workspace-'))
  const attachmentHome = join(workspace, 'isolated-attachment-home')
  // Original, metadata-free raster fixture; this is byte-transport test data,
  // not a template preview or a claim that any model understood an image.
  const imageFixture = new PNG({ width: 8, height: 6 })
  for (let y = 0; y < imageFixture.height; y++) {
    for (let x = 0; x < imageFixture.width; x++) {
      const offset = (y * imageFixture.width + x) * 4
      imageFixture.data.set([x < 3 ? 255 : 0, y < 3 ? 255 : 0, (x + y) % 2 ? 255 : 0, 255], offset)
    }
  }
  imageFixture.data.set([0, 0, 0, 0], imageFixture.data.length - 4)
  const sourceImageBytes = PNG.sync.write(imageFixture)
  const sourceImagePath = join(workspace, 'native-image-fixture.png')
  await writeFile(sourceImagePath, sourceImageBytes)
  const ctx = new Context()
  const requests = [], results = [], sessions = [], checks = [], agentErrors = []
  const handles = []
  const originalCwd = process.cwd()
  let active, providerFailure, plugin, filesystemSkills, providerCallCount = 0
  let imageEvidence, storedImageBytes, providerImageBytes

  const capturedResult = callId => {
    const row = results.find(item => item.callId === callId)
    assert.ok(row, `actual tools/result not observed for ${callId}`)
    return row.result
  }
  const successfulResult = callId => {
    const result = capturedResult(callId)
    assert.equal(result.isError, false, JSON.stringify(result))
    return result
  }
  const expectRendered = (request, callId, name) => {
    const result = successfulResult(callId)
    const message = toolMessage(request, callId)
    assert.ok(message, `${callId} was not retained in the subsequent provider request`)
    assert.equal(textOf(message), formatToolResult(name, result.value), `${name} bypassed its native output renderer`)
    assert.deepEqual(message.content, result.content)
    return result.value
  }
  const expectDenied = (request, callId, pattern) => {
    const result = capturedResult(callId)
    assert.equal(result.isError, true, `${callId} must be rejected by the actual tool pipeline`)
    const message = toolMessage(request, callId)
    assert.ok(message, `${callId} denial must reach the next provider request`)
    assert.deepEqual(message.content, result.content)
    assert.match(textOf(message), pattern)
  }
  const expectFilePolicy = (request, mode) => {
    const snapshot = request.messages.findLast(message => textOf(message).includes('Current DSH file policy:'))
    assert.ok(snapshot, 'the official sandbox policy must reach the real provider request')
    assert.ok(textOf(snapshot).includes(`Current DSH file policy: ${mode}.`))
  }
  const call = (id, name, args) => ({ type: 'tool-call', id, name, arguments: JSON.stringify(args) })
  const done = () => [{ type: 'text', text: 'Scripted provider: injection assertions completed.' }]
  const expectSchemas = request => {
    const actual = academicSchemas(request)
    assert.deepEqual(sortedNames(actual), sortedNames(expectedTools))
    for (const expected of expectedTools) {
      assert.deepEqual(actual.find(tool => tool.name === expected.name), expected, `provider-visible schema differs for ${expected.name}`)
    }
    assert.equal(new Set((request.tools ?? []).map(tool => tool.name)).size, request.tools.length)
  }
  const createAgent = async (suffix, setup, model = 'no-network-fixture') => {
    const handle = await ctx.agents.create({
      sessionId: `academic-injection-${runtimeVersion}-${suffix}`,
      meta: { cwd: workspace },
      agentOptions: { provider: 'scripted-injection-audit', model },
      ...(setup ? { setup } : {}),
    })
    handles.push(handle)
    return handle.agent
  }
  const runTurn = async (agent, label, prompt, steps) => {
    assert.equal(active, undefined, 'scripted turns must remain sequential')
    active = { label, steps: [...steps], consumed: 0 }
    providerFailure = undefined
    const errorOffset = agentErrors.length
    let timer
    try {
      agent.followup(createUserMessage({ content: [{ type: 'text', text: prompt }], source: { kind: 'user' } }))
      await Promise.race([
        agent.whenIdle(),
        new Promise((_, reject) => { timer = setTimeout(() => { agent.cancel({ kind: 'user' }); reject(new Error(`agent turn timed out: ${label}`)) }, 20000) }),
      ])
      if (providerFailure) throw providerFailure
      assert.deepEqual(agentErrors.slice(errorOffset), [], `agent loop failed during ${label}`)
      assert.equal(active.consumed, steps.length, `${label}: wrong number of provider requests`)
    } finally {
      clearTimeout(timer)
      active = undefined
    }
  }

  class ScriptedAdapter extends LlmAdapter {
    async resolveModel(provider, model, signal) {
      signal?.throwIfAborted()
      return {
        provider, id: model, name: model,
        ...(model === 'no-network-image-fixture' ? { inputModalities: ['text', 'image'] }
          : model === 'no-network-text-only-fixture' ? { inputModalities: ['text'] } : {}),
      }
    }
    async *stream(options) {
      try {
        assert.ok(active, 'unexpected provider request outside a scripted turn')
        const step = active.steps[active.consumed++]
        assert.equal(typeof step, 'function', 'unexpected additional provider request')
        providerCallCount++
        // Inspection only: the official loop and LLM runtime own request construction.
        const { signal, ...captured } = options
        requests.push({ scenario: active.label, step: active.consumed, request: json(captured) })
        signal?.throwIfAborted()
        const blocks = await step(options)
        for (const [index, block] of blocks.entries()) {
          yield { type: 'block-start', index, blockType: block.type }
          if (block.type === 'tool-call') yield { type: 'tool-call-delta', index, id: block.id, name: block.name, argumentsDelta: block.arguments }
          else yield { type: 'text-delta', index, text: block.text }
          yield { type: 'block-end', index, block }
        }
        yield { type: 'usage', usage: { inputTokens: 0, outputTokens: 0 } }
        yield { type: 'finish', reason: { kind: blocks.some(block => block.type === 'tool-call') ? 'tool-calls' : 'stop' } }
      } catch (error) {
        providerFailure = error
        throw error
      }
    }
  }

  try {
    // No session-persistence provider, config loader or real model adapter is mounted.
    for (const name of ['dsh-system-prompt', 'dsh-session', 'dsh-session-projection', 'dsh-llm', 'dsh-agent']) {
      await ctx.plugin(byName[`@deepseek-ai/${name}`].default)
    }
    await ctx.plugin(byName['@deepseek-ai/dsh-sandbox-policy'].default, { mode: 'workspace-write', workspaceRoot: workspace })
    await ctx.plugin(byName['@deepseek-ai/dsh-fs-sandbox'].default, { cwd: workspace })
    await ctx.plugin(byName['@deepseek-ai/dsh-attachment-local'].default, { dshHome: attachmentHome, imageCompressionConcurrency: 1 })
    assert.equal(ctx.attachments.root, join(attachmentHome, 'attachments', 'v1'), 'all durable image objects must stay in the explicit disposable home')
    await ctx.plugin(byName['@deepseek-ai/dsh-tools'].default, { mode: 'native' })
    await ctx.plugin(byName['@deepseek-ai/dsh-skill'].default)
    await ctx.plugin(byName['@deepseek-ai/dsh-working-directory'].default, { defaultDirectory: workspace })
    await ctx.plugin(byName['@deepseek-ai/dsh-agent-loop'].default, { agents: [], maxParallelToolCalls: 1 })
    await ctx.plugin(byName['@deepseek-ai/dsh-tool-skill'])
    await ctx.plugin(byName['@deepseek-ai/dsh-tool-fs'], { read: true, readImage: true, write: true, edit: false, readLimit: 2000 })
    assert.equal((await ctx.skills.list({ cwd: workspace })).length, 0, 'the isolated baseline must not discover any user or project skills')
    assert.equal(ctx.get('sessionPersistence'), undefined, 'the audit must not persist sessions outside its explicit fixture artifacts')
    ctx.llm.registerAdapter(['scripted-injection-audit'], new ScriptedAdapter())
    ctx.on('agent/error', ({ error }) => { agentErrors.push(String(error?.stack ?? error)) })
    ctx.on('tools/result', (exec, result) => { results.push({ callId: exec.callId, name: exec.name, arguments: json(exec.arguments), result: json(result) }) })
    ctx.on('llm/stream', async function* (options, next) {
      assert.equal(isAgentLoopRequest(options), true, 'request was not produced by the official AgentLoop')
      assert.equal(Object.isFrozen(options), true, 'the official loop must freeze the provider request')
      yield* next()
    })
    plugin = ctx.plugin(academic)
    await plugin
    const skill = await ctx.skills.get(academic.name, { cwd: workspace })
    assert.equal(skill.content, expectedBody)
    assert.equal(skill.provider, 'runtime', 'filesystem discovery must not mask a missing runtime registration')
    assert.equal(skill.source, 'runtime')
    assert.deepEqual(skill.resourceBase, expectedDefinition.resourceBase)
    assert.deepEqual(skill.invocation, { modelInvocable: true, userInvocable: true })
    assert.equal((await ctx.skills.list({ cwd: workspace })).filter(item => item.name === academic.name).length, 1)
    const expectedWrapped = renderSkillContent(skill)
    const agent = await createAgent('native')
    const originalPolicy = ctx.sandboxPolicy.resolve({ session: agent.session })
    assert.equal(originalPolicy.mode, 'workspace-write')
    assert.equal(originalPolicy.workspaceRoot, workspace)
    const outsideCanonical = canonicalPath(outsideWorkspace)
    for (const root of writableRoots(originalPolicy)) {
      const path = relative(root, outsideCanonical)
      assert.ok(path === '..' || path.startsWith('..' + sep) || isAbsolute(path),
        'The outside-workspace test fixture must lie outside every official writable root; run this integration checkout outside platform temporary areas.')
    }

    await runTurn(agent, 'native-skill-resource-tools', '请为我的学术汇报使用 dsh-academic-ppt，先加载指导，再检查工作流及工具契约。', [
      request => {
        expectSchemas(request)
        expectFilePolicy(request, 'workspace-write')
        assert.ok(request.tools.some(tool => tool.name === 'skill'))
        assert.ok(request.tools.some(tool => tool.name === 'read'))
        const catalogs = catalogsOf(request)
        assert.equal(catalogs.length, 1)
        assert.deepEqual(catalogs[0].source.entries, [{ name: academic.name, description: skill.description }])
        assert.match(textOf(catalogs[0]), /call the `skill` tool/)
        assert.ok(!request.messages.some(message => textOf(message).includes(expectedBody)), 'catalog discovery should not silently preload the full skill')
        return [call('load-skill', 'skill', { name: academic.name })]
      },
      request => {
        expectSchemas(request)
        const loaded = successfulResult('load-skill')
        assert.equal(loaded.value.content, expectedBody)
        assert.deepEqual(loaded.value.resourceBase, expectedDefinition.resourceBase)
        assert.equal(textOf(toolMessage(request, 'load-skill')), expectedWrapped)
        assert.equal(catalogsOf(request).length, 1, 'unchanged catalog must not be republished every step')
        // Follow the exact resource base that actually reached the provider boundary.
        const base = /^Base directory for this skill: (.+)$/m.exec(textOf(toolMessage(request, 'load-skill')))?.[1]
        assert.equal(base, expectedDefinition.resourceBase.path)
        return [
          call('read-workflow', 'read', { file_path: join(base, 'references', 'workflow-v010.md'), limit: 2000 }),
          call('storyboard-contract', 'academic_ppt_contract', { topic: 'storyboard' }),
        ]
      },
      request => {
        const read = successfulResult('read-workflow')
        assert.equal(read.value.path, workflowPath)
        assert.equal(read.value.lines.map(line => line.text).join('\n').trimEnd(), workflowSource.trimEnd())
        assert.deepEqual(toolMessage(request, 'read-workflow').content, read.content)
        const contract = expectRendered(request, 'storyboard-contract', 'academic_ppt_contract')
        assert.match(JSON.stringify(contract), /pilot-review/)
        assert.match(textOf(toolMessage(request, 'storyboard-contract')), /pilot-review/)
        return [
          call('cards-index', 'academic_ppt_cards', { limit: 2 }),
          call('layouts-index', 'academic_ppt_layouts', { limit: 2 }),
          call('init-project', 'academic_ppt_init', { projectDir: 'native-agent-project', title: 'Official DSH agent injection fixture' }),
        ]
      },
      request => {
        assert.equal(expectRendered(request, 'cards-index', 'academic_ppt_cards').totalCount, 48)
        assert.equal(expectRendered(request, 'layouts-index', 'academic_ppt_layouts').totalCount, 32)
        const created = expectRendered(request, 'init-project', 'academic_ppt_init')
        assert.equal(created.designDialogue.workflowVersion, 2)
        assert.equal(created.designDialogue.stage, 'source')
        assert.equal(created.designDialogue.requiresUserResponse, true)
        assert.equal(created.designDialogue.questions[0].topic, 'source')
        assert.equal(created.designDialogue.questions[0].options.length, 3)
        assert.match(textOf(toolMessage(request, 'init-project')), /需要真实用户回应/)
        assert.equal(created.projectPath, join(workspace, 'native-agent-project', 'project.json'))
        return [call('project-context', 'academic_ppt_context', { projectPath: created.projectPath, stage: 'research' })]
      },
      request => {
        const context = expectRendered(request, 'project-context', 'academic_ppt_context')
        assert.equal(context.stage, 'research')
        assert.equal(context.revision, 0)
        assert.equal(context.designDialogue.requiresUserResponse, true)
        assert.equal(context.designDialogue.stage, 'source')
        assert.ok(Array.isArray(context.nextActions))
        return done()
      },
    ])
    await access(join(workspace, 'native-agent-project', 'project.json'))
    checks.push('Official AgentLoop -> skill catalog -> native skill tool -> complete wrapped body/resourceBase -> real read tool -> workflow text -> native academic tools -> rendered results in next provider requests')
    checks.push('Exactly 19 unchanged academic schemas are visible at the native provider boundary; 48-card and 32-layout results plus storyboard contract are reachable')

    const imageAgent = await createAgent('image-input', undefined, 'no-network-image-fixture')
    await runTurn(imageAgent, 'native-read-image-transport', '读取原创PNG测试图，验证图像块及字节传输；不作视觉理解或质量结论。', [
      request => {
        assert.ok(request.tools.some(tool => tool.name === 'read_image'), 'the official image tool must register while the real attachment store is mounted')
        return [call('read-image-fixture', 'read_image', { file_path: sourceImagePath })]
      },
      async request => {
        const result = successfulResult('read-image-fixture')
        assert.equal(result.value.path, sourceImagePath)
        const message = toolMessage(request, 'read-image-fixture')
        assert.ok(message, 'read_image must be retained in the next native provider request')
        assert.deepEqual(message.content, result.content)
        const blocks = message.content.filter(block => block.type === 'image')
        assert.equal(blocks.length, 1, 'a path or text envelope is not an image block')
        const ref = blocks[0].attachment
        assert.deepEqual(ref, result.value.image)
        assert.equal(ref.width, imageFixture.width)
        assert.equal(ref.height, imageFixture.height)
        // Resolve bytes inside the scripted provider callback from the exact
        // native image reference that the official request pipeline supplied.
        const stored = await ctx.attachments.readImage(ref, request.signal)
        storedImageBytes = Buffer.from(stored.data)
        assert.deepEqual(stored.ref, ref)
        assert.equal(ref.bytes, storedImageBytes.length)
        assert.equal(ref.attachmentId, `sha256:${hash(storedImageBytes)}`)
        const target = ctx.llm.imageRequestTarget(request.provider, request.model, ref)
        const projected = await ctx.attachments.readImageRequest(ref, target, request.signal)
        providerImageBytes = Buffer.from(projected.data)
        assert.deepEqual(projected.attachment, ref)
        assert.equal(projected.bytes, providerImageBytes.length)
        assert.equal(projected.width, imageFixture.width)
        assert.equal(projected.height, imageFixture.height)
        assert.equal(projected.depth, 'uchar')
        assert.equal(projected.space, 'srgb')
        assert.deepEqual(providerImageBytes, storedImageBytes, 'the fixture provider requests the original normalized dimensions and byte budget')
        // Other inputs may be normalized/re-encoded. This tiny metadata-free
        // 8-bit sRGBA source meets the released store's pass-through policy.
        assert.equal(projected.mediaType, 'image/png')
        assert.deepEqual(PNG.sync.read(providerImageBytes).data, imageFixture.data)
        imageEvidence = {
          fixture: { width: imageFixture.width, height: imageFixture.height, sourceBytes: sourceImageBytes.length, sourceSha256: hash(sourceImageBytes), rgbaSha256: hash(imageFixture.data) },
          nativeToolCallId: 'read-image-fixture', nativeImageBlockCount: blocks.length,
          attachment: json(ref), storedSha256: hash(storedImageBytes),
          requestTarget: json(target), requestVariantId: projected.variantId,
          requestMediaType: projected.mediaType, providerResolvedBytes: providerImageBytes.length,
          providerResolvedSha256: hash(providerImageBytes), sourceBytesPreserved: sourceImageBytes.equals(storedImageBytes),
          boundary: 'The real native request delivered an image attachment reference to the scripted provider adapter, which resolved verified bytes through the official attachment store. No provider HTTP request or visual interpretation was performed.',
        }
        return done()
      },
    ])
    checks.push('Official read_image returns a native image block in the next provider request; its exact attachment identity resolves to verified original-fixture pixels and request bytes through the isolated real attachment store')

    for (const [suffix, model] of [['text-only', 'no-network-text-only-fixture'], ['unknown', 'no-network-fixture']]) {
      const incapable = await createAgent(`image-${suffix}`, undefined, model)
      const callId = `read-image-${suffix}`
      await runTurn(incapable, `native-read-image-${suffix}-denied`, '检查未声明image输入能力的模型路线拒绝图片读取。', [
        () => [call(callId, 'read_image', { file_path: sourceImagePath })],
        request => {
          expectDenied(request, callId, /does not declare image input/)
          assert.equal(request.messages.some(message => message.content.some(block => block.type === 'image')), false, 'a denied image call must not produce a model-visible image')
          return done()
        },
      ])
    }
    checks.push('The official read_image route gate rejects both explicitly text-only and unknown input modalities; each refusal reaches the next provider request without an image block')

    const changedDirectory = join(workspace, 'changed-current-directory')
    await mkdir(changedDirectory)
    await ctx.workingDirectory.set(agent, changedDirectory)
    assert.equal(agent.session.header.cwd, workspace, 'the original Session header remains immutable')
    assert.equal(ctx.workingDirectory.get(agent.session), changedDirectory)
    await runTurn(agent, 'changed-working-directory', '在当前工作目录创建一个学术工程。', [
      request => {
        assert.ok(request.messages.some(message => textOf(message).includes(changedDirectory)), 'the official host must disclose the current directory to the provider')
        return [call('init-after-cwd-change', 'academic_ppt_init', { projectDir: 'after-directory-change', title: 'Current working directory fixture' })]
      },
      request => {
        const created = expectRendered(request, 'init-after-cwd-change', 'academic_ppt_init')
        assert.equal(created.projectPath, join(changedDirectory, 'after-directory-change', 'project.json'), 'academic tools must follow the official current working directory, not the immutable original Session header')
        return done()
      },
    ])
    await access(join(changedDirectory, 'after-directory-change', 'project.json'))
    await assert.rejects(access(join(workspace, 'after-directory-change', 'project.json')), { code: 'ENOENT' })
    await ctx.workingDirectory.set(agent, workspace)
    checks.push('After an official workingDirectory.set change, a model-requested relative init writes in the effective current directory while the immutable Session header stays unchanged')

    await ctx.workingDirectory.set(agent, outsideWorkspace)
    assert.equal(ctx.workingDirectory.get(agent.session), outsideWorkspace)
    assert.equal(ctx.sandboxPolicy.resolve({ session: agent.session }).workspaceRoot, workspace,
      'changing the current directory must not change the original session write boundary')
    await runTurn(agent, 'workspace-write-denies-outside-cwd', '在另一个目录尝试创建工程及普通文件，检查相同会话的写入边界。', [
      request => {
        expectFilePolicy(request, 'workspace-write')
        return [
          call('init-outside-workspace', 'academic_ppt_init', { projectDir: 'denied-outside-project', title: 'Must not be created outside workspace' }),
          call('write-outside-workspace', 'write', { file_path: 'denied-outside.txt', content: 'Must not be written outside the original workspace.\n' }),
        ]
      },
      request => {
        expectDenied(request, 'init-outside-workspace', /ACADEMIC_WRITE_DENIED/)
        expectDenied(request, 'write-outside-workspace', /\[sandbox: file access denied under workspace-write mode\]/)
        return done()
      },
    ])
    await assert.rejects(access(join(outsideWorkspace, 'denied-outside-project')), { code: 'ENOENT' })
    await assert.rejects(access(join(outsideWorkspace, 'denied-outside.txt')), { code: 'ENOENT' })
    checks.push('Changing cwd to controlled sibling directory B does not expand the original workspace A: academic init and official sandboxed write both deny and leave no artifact')

    await ctx.workingDirectory.set(agent, workspace)
    const existingProjectPath = join(workspace, 'native-agent-project', 'project.json')
    const projectBeforeReadOnly = await readFile(existingProjectPath, 'utf8')
    setSandboxMode(agent.session, 'read-only')
    assert.equal(ctx.sandboxPolicy.resolve({ session: agent.session }).mode, 'read-only')
    await runTurn(agent, 'read-only-denies-writes-keeps-reads', '验证只读会话：尝试写入，并查询现有工程及卡片索引。', [
      request => {
        expectFilePolicy(request, 'read-only')
        return [
          call('init-read-only', 'academic_ppt_init', { projectDir: 'denied-read-only-project', title: 'Must not be created in read-only mode' }),
          call('write-read-only', 'write', { file_path: 'denied-read-only.txt', content: 'Must not be written in read-only mode.\n' }),
          call('cards-read-only', 'academic_ppt_cards', { limit: 1 }),
          call('context-read-only', 'academic_ppt_context', { projectPath: existingProjectPath, stage: 'research' }),
        ]
      },
      request => {
        expectDenied(request, 'init-read-only', /ACADEMIC_WRITE_DENIED.*read-only/)
        expectDenied(request, 'write-read-only', /\[sandbox: file access denied under read-only mode\]/)
        assert.equal(expectRendered(request, 'cards-read-only', 'academic_ppt_cards').totalCount, 48)
        assert.equal(expectRendered(request, 'context-read-only', 'academic_ppt_context').revision, 0)
        return done()
      },
    ])
    await assert.rejects(access(join(workspace, 'denied-read-only-project')), { code: 'ENOENT' })
    await assert.rejects(access(join(workspace, 'denied-read-only.txt')), { code: 'ENOENT' })
    assert.equal(await readFile(existingProjectPath, 'utf8'), projectBeforeReadOnly)
    checks.push('A real per-session read-only switch rejects academic init and official write while cards/context remain readable and the existing project stays byte-identical')

    setSandboxMode(agent.session, 'workspace-write')
    await runTurn(agent, 'workspace-write-restored', '恢复工作区写入模式后再次创建隔离测试工程及文件。', [
      request => {
        expectFilePolicy(request, 'workspace-write')
        return [
          call('init-write-restored', 'academic_ppt_init', { projectDir: 'restored-write-project', title: 'Restored workspace write fixture' }),
          call('write-restored', 'write', { file_path: 'restored-write.txt', content: 'Official filesystem write restored.\n' }),
        ]
      },
      request => {
        assert.equal(expectRendered(request, 'init-write-restored', 'academic_ppt_init').projectPath, join(workspace, 'restored-write-project', 'project.json'))
        assert.equal(successfulResult('write-restored').value.path, join(workspace, 'restored-write.txt'))
        return done()
      },
    ])
    await access(join(workspace, 'restored-write-project', 'project.json'))
    assert.equal(await readFile(join(workspace, 'restored-write.txt'), 'utf8'), 'Official filesystem write restored.\n')
    checks.push('Switching the same session back to workspace-write immediately restores academic and official filesystem writes inside the original workspace')

    // The broader mode applies only to this disposable Session and only our
    // two controlled fixture directories; it does not alter host policy.
    setSandboxMode(agent.session, 'danger-full-access')
    await ctx.workingDirectory.set(agent, outsideWorkspace)
    await runTurn(agent, 'full-access-controlled-sibling', '验证全访问测试模式允许在自建目录B创建工程及文件。', [
      request => {
        expectFilePolicy(request, 'danger-full-access')
        return [
          call('init-full-access', 'academic_ppt_init', { projectDir: 'full-access-project', title: 'Controlled full access fixture' }),
          call('write-full-access', 'write', { file_path: 'full-access.txt', content: 'Controlled sandbox-policy fixture only.\n' }),
        ]
      },
      request => {
        assert.equal(expectRendered(request, 'init-full-access', 'academic_ppt_init').projectPath, join(outsideWorkspace, 'full-access-project', 'project.json'))
        assert.equal(successfulResult('write-full-access').value.path, join(outsideWorkspace, 'full-access.txt'))
        return done()
      },
    ])
    await access(join(outsideWorkspace, 'full-access-project', 'project.json'))
    assert.equal(await readFile(join(outsideWorkspace, 'full-access.txt'), 'utf8'), 'Controlled sandbox-policy fixture only.\n')
    setSandboxMode(agent.session, 'workspace-write')
    await ctx.workingDirectory.set(agent, workspace)
    checks.push('An explicit danger-full-access override on the disposable Session permits both academic and official writes to controlled directory B; the test then restores workspace-write')

    await runTurn(agent, 'native-validation-errors', '检查错误输入会被拒绝且进入下一步模型上下文。', [
      () => [
        call('invalid-args', 'academic_ppt_check', { projectPath: 'native-agent-project/project.json', cwd: '/outside' }),
        call('escape-path', 'academic_ppt_template', { filePath: '../outside.pptx' }),
      ],
      request => {
        for (const [id, pattern] of [['invalid-args', /INVALID_INPUT|additional propert/i], ['escape-path', /PATH_OUTSIDE_WORKSPACE/]]) {
          assert.equal(capturedResult(id).isError, true)
          assert.match(textOf(toolMessage(request, id)), pattern)
        }
        return done()
      },
    ])
    checks.push('Malformed native tool arguments and project-path escapes are rejected by the real pipeline and retained as model-visible errors')

    const gestureAgent = await createAgent('gesture')
    await runTurn(gestureAgent, 'explicit-skill-gesture', '/dsh-academic-ppt 请按该技能工作。 /dsh-academic-ppt', [request => {
      expectSchemas(request)
      const injections = invocationsOf(request)
      assert.equal(injections.length, 1, 'one claimed user message must deduplicate repeated skill gestures')
      assert.equal(injections[0].source.form, 'instructions')
      assert.equal(textOf(injections[0]), expectedWrapped)
      return done()
    }])
    checks.push('An explicit /dsh-academic-ppt user gesture injects the full instructions before the first request and deduplicates repeated names')

    const restrictedAgent = await createAgent('restricted', agentCtx => { agentCtx.tools.restrict({ deny: ['skill', 'academic_ppt_init'] }) })
    await runTurn(restrictedAgent, 'restricted-skill-loader', '检查此Agent的实际可见工具。', [request => {
      assert.equal(request.tools.some(tool => tool.name === 'skill'), false)
      assert.equal(request.tools.some(tool => tool.name === 'academic_ppt_init'), false)
      assert.equal(academicSchemas(request).length, 18)
      assert.equal(catalogsOf(request).length, 0)
      assert.equal(invocationsOf(request).length, 0)
      return done()
    }])
    await runTurn(restrictedAgent, 'restricted-explicit-gesture', '/dsh-academic-ppt 请加载用户明确调用的技能。', [request => {
      assert.equal(request.tools.some(tool => tool.name === 'skill'), false)
      assert.equal(textOf(invocationsOf(request).at(-1)), expectedWrapped)
      return done()
    }])
    checks.push('Real agent-scope tool restrictions suppress native loader and catalog together; explicit user invocation remains governed by userInvocable')

    const duplicateOwner = ctx.plugin({ name: 'academic-skill-duplicate-fixture', inject: ['skills'], apply(childCtx) {
      childCtx.skills.register({ ...expectedDefinition, content: 'Duplicate fixture must not replace the real instructions.' })
    } })
    await duplicateOwner
    assert.equal((await ctx.skills.get(academic.name, { cwd: workspace })).content, expectedBody)
    await duplicateOwner.dispose()
    assert.equal((await ctx.skills.get(academic.name, { cwd: workspace })).content, expectedBody)
    await runTurn(agent, 'unchanged-catalog-dedup', '再次检查技能目录。', [request => {
      assert.equal(catalogsOf(request).length, 1)
      return done()
    }])
    checks.push('Duplicate runtime skill registration is first-wins; disposing the duplicate preserves the winner and unchanged catalog is not republished')

    await plugin.dispose()
    assert.equal(ctx.tools.schemas().filter(tool => tool.name.startsWith('academic_ppt_')).length, 0)
    assert.equal(await ctx.skills.get(academic.name, { cwd: workspace }), undefined)
    await runTurn(agent, 'unload-updates-next-request', '插件卸载后刷新能力。', [request => {
      assert.equal(academicSchemas(request).length, 0)
      const replacement = catalogsOf(request).at(-1)
      assert.equal(replacement.source.update, true)
      assert.deepEqual(replacement.source.entries, [])
      assert.match(textOf(replacement), /No skills are currently available/)
      return done()
    }])
    plugin = ctx.plugin(academic)
    await plugin
    await runTurn(agent, 'remount-updates-next-request', '插件重新挂载后刷新能力。', [request => {
      expectSchemas(request)
      const replacement = catalogsOf(request).at(-1)
      assert.equal(replacement.source.update, true)
      assert.equal(replacement.source.entries.filter(entry => entry.name === academic.name).length, 1)
      assert.equal(catalogsOf(request).length, 3)
      return done()
    }])
    checks.push('Unload/remount changes the next real request schemas and durable replacement catalog without stale registrations; prior instruction history is intentionally retained')

    await plugin.dispose()
    filesystemSkills = ctx.plugin(byName['@deepseek-ai/dsh-skill-filesystem'], {
      providerName: 'isolated-package-directory', includeDefaultRoots: false,
      dshHome: join(workspace, 'unused-dsh-home'), agentsHome: join(workspace, 'unused-agents-home'),
      customSkillDirs: [join(projectRoot, 'skills')], watch: false,
    })
    await filesystemSkills
    const discovered = await ctx.skills.get(academic.name, { cwd: workspace })
    assert.equal(discovered.provider, 'isolated-package-directory')
    assert.equal(discovered.path, skillFile)
    assert.equal(discovered.content, expectedBody)
    assert.equal(resolve(discovered.resourceBase.path), resolve(expectedDefinition.resourceBase.path))
    const directoryAgent = await createAgent('directory')
    await runTurn(directoryAgent, 'filesystem-discovery', '请加载 dsh-academic-ppt 技能。', [
      request => {
        assert.equal(academicSchemas(request).length, 0, 'filesystem skill discovery must not manufacture academic tools')
        assert.equal(catalogsOf(request)[0].source.entries.filter(entry => entry.name === academic.name).length, 1)
        return [call('directory-skill', 'skill', { name: academic.name })]
      },
      request => {
        assert.equal(textOf(toolMessage(request, 'directory-skill')), renderSkillContent(discovered))
        return done()
      },
    ])
    plugin = ctx.plugin(academic)
    await plugin
    assert.equal((await ctx.skills.list({ cwd: workspace })).filter(item => item.name === academic.name).length, 1)
    await filesystemSkills.dispose()
    assert.equal((await ctx.skills.get(academic.name, { cwd: workspace })).content, expectedBody)
    checks.push('Official filesystem skill discovery reads only the explicitly supplied package directory; filesystem/runtime overlap produces one catalog winner and does not create tools')

    // A genuinely incomplete package, not a fake skills service: mandatory skill
    // load failure must reject activation and leave the real registries clean.
    await plugin.dispose()
    const brokenRoot = join(workspace, 'missing-skill-package')
    await cp(join(projectRoot, 'src'), join(brokenRoot, 'src'), { recursive: true })
    await symlink(join(projectRoot, 'node_modules'), join(brokenRoot, 'node_modules'), 'dir')
    const incompletePlugin = await import(pathToFileURL(join(brokenRoot, 'src', 'index.mjs')).href)
    const brokenFiber = ctx.plugin(incompletePlugin)
    await assert.rejects(Promise.resolve(brokenFiber), /SKILL|ENOENT|技能/i)
    await brokenFiber.dispose()
    assert.equal(ctx.tools.schemas().filter(tool => tool.name.startsWith('academic_ppt_')).length, 0)
    assert.equal(await ctx.skills.get(academic.name, { cwd: workspace }), undefined)
    checks.push('A package missing its actual SKILL.md fails official Cordis activation and leaves neither academic tools nor a partial skill registration')
    assert.equal(process.cwd(), originalCwd)
    for (const handle of handles) sessions.push({ id: handle.agent.id, events: json(handle.agent.session.snapshotEvents()) })
  } finally {
    for (const handle of handles.toReversed()) await handle.dispose()
    await ctx.fiber.dispose()
    await rm(workspace, { recursive: true, force: true })
    await rm(outsideWorkspace, { recursive: true, force: true })
  }

  const report = {
    ok: true, pluginVersion: manifest.version, runtimeVersion, versions, node: process.version,
    mode: 'native', providerRequests: providerCallCount, toolPipelineCalls: results.length,
    successfulToolResults: results.filter(row => !row.result.isError).length,
    rejectedToolResults: results.filter(row => row.result.isError).length,
    academicToolCount: expectedTools.length, skillBodyCharacters: expectedBody.length,
    skillBodySha256: hash(expectedBody), workflowSha256: hash(workflowSource),
    sourceHashes,
    imageTransport: imageEvidence,
    filePolicyModes: ['workspace-write', 'read-only', 'danger-full-access'],
    checks, checkedAt: new Date().toISOString(),
    boundaries: {
      real: ['published official Cordis lifecycle', 'AgentRegistry and AgentLoop', 'SessionStore and session projections', 'system prompt and native tool schema assembly', 'skill registry/catalog/loader/explicit user invocation', 'native tool execution and output rendering', 'official read/read_image/write tools and SandboxedFileSystem backend', 'official LocalAttachmentStore normalization, immutable storage and request-image byte resolution', 'official SandboxPolicyService with logged per-session mode switches', 'official filesystem skill discovery'],
      scripted: ['provider capability metadata and response chunks only; tool selections and final assistant text are deterministic fixtures'],
      notClaimed: ['real model instruction following, visual understanding or presentation quality', 'provider HTTP image serialization or API compatibility', 'Desktop/Web UI, authentication or user profiles', 'OS process isolation, concurrent filesystem races or remote filesystem providers', 'PTC/run_code transport'],
      isolation: 'All sessions are in memory. Working directories A/B, the attachment store/cache home and unused provider home paths are explicit disposable fixtures. Policy mode switches affect only the test Session. Default skill roots and watchers are disabled. No real model adapter or session-persistence provider is mounted.',
    },
  }
  if (artifactsDir) {
    artifactsDir = resolve(artifactsDir)
    await mkdir(artifactsDir, { recursive: true })
    await writeFile(join(artifactsDir, 'provider-requests.json'), JSON.stringify(requests, null, 2) + '\n')
    await writeFile(join(artifactsDir, 'tool-results.json'), JSON.stringify(results, null, 2) + '\n')
    await writeFile(join(artifactsDir, 'session-events.json'), JSON.stringify(sessions, null, 2) + '\n')
    await writeFile(join(artifactsDir, 'image-transport.json'), JSON.stringify(imageEvidence, null, 2) + '\n')
    await writeFile(join(artifactsDir, 'image-fixture.png'), sourceImageBytes)
    await writeFile(join(artifactsDir, 'provider-resolved-image.png'), providerImageBytes)
    report.artifacts = artifactsDir
  }
  if (output) {
    await mkdir(dirname(resolve(output)), { recursive: true })
    await writeFile(resolve(output), JSON.stringify(report, null, 2) + '\n')
  }
  return report
}

export function runtimeDirectoriesFromEnvironment(environment = process.env) {
  if (environment.DSH_AGENT_RUNTIME_DIRS !== undefined) {
    const directories = environment.DSH_AGENT_RUNTIME_DIRS.split(delimiter).filter(Boolean).map(path => resolve(path))
    assert.ok(directories.length, 'DSH_AGENT_RUNTIME_DIRS must name at least one isolated runtime; an empty test matrix is not a successful integration check')
    return directories
  }
  return ['rc2', 'rc3'].map(version => join(projectRoot, '.test-output', `dsh-runtime-${version}`))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {}
  const flags = { '--runtime-dir': 'runtimeDir', '--output': 'output', '--artifacts-dir': 'artifactsDir' }
  for (let index = 2; index < process.argv.length; index += 2) {
    const flag = process.argv[index]
    if (!flags[flag] || !process.argv[index + 1]) throw new Error('Usage: node scripts/check-dsh-agent-injection.mjs --runtime-dir DIR [--output REPORT.json] [--artifacts-dir DIR]')
    options[flags[flag]] = process.argv[index + 1]
  }
  console.log(JSON.stringify(await checkDshAgentInjection(options), null, 2))
}
