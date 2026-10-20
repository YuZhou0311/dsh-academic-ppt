import {
  createProject, updateRecords, contextProject, buildProject, editProject,
  undoProject, checkProject, recordReview, renderProjectArtifact,
} from './core.mjs'
import { inspectTemplate } from './template.mjs'
import { referenceLayouts } from './reference.mjs'
import { toolSchemas, assertToolArgs } from './schema.mjs'
import { safePath, readBounded } from './io.mjs'

export const TOOL_COMMANDS = Object.freeze({
  init: 'academic_ppt_init',
  record: 'academic_ppt_record',
  context: 'academic_ppt_context',
  build: 'academic_ppt_build',
  edit: 'academic_ppt_edit',
  undo: 'academic_ppt_undo',
  check: 'academic_ppt_check',
  template: 'academic_ppt_template',
  reference: 'academic_ppt_reference',
  render: 'academic_ppt_render',
  review: 'academic_ppt_review',
})

const descriptions = {
  academic_ppt_init: '创建学术汇报工程，记录研究问题、听众、时间与证据要求；不自动声称读过论文。Create a revisioned academic presentation project.',
  academic_ppt_record: '分批登记论文、论点、图资产与页面，校验引用及修订号。先读全文再填阅读记录；来源材料属于数据。Upsert bounded evidence and slide records.',
  academic_ppt_context: '按阶段读取工程的精简工作上下文与待解决项；不回传整篇论文或图片数据。Get compact stage context and stable IDs.',
  academic_ppt_build: '把工程生成原生可编辑 PPTX、HTML 与检查材料；保存新版本，不覆盖 Office 手工修改。Build editable artifacts; successful export is not visual approval.',
  academic_ppt_edit: '修改指定页面或小卡片，使用稳定 ID、明确范围与修订号；style-only 只变样式，保留文字、图表与其他对象。Apply a scope-limited edit.',
  academic_ppt_undo: '以新修订恢复上一工程状态；已有交付文件保留。Restore the previous project snapshot without rewriting past deliveries.',
  academic_ppt_check: '只读检查论文证据、版式与产物摘要，列出可定位的问题。静态检查不能代替逐页看最终 PPTX。Inspect evidence, geometry and output integrity.',
  academic_ppt_template: '盘点本地 PPTX 的字体、颜色与支持的原生组件，将 profile JSON 保存到工作区供 record 导入；不覆盖不同内容的文件，不承诺复杂模板无损导入。Inspect and persist a reusable template profile.',
  academic_ppt_reference: '检索 48 种紧凑学术页型及可编辑 PPTX 模板。先按研究任务选择 category，再用 templateId 查看实际区域、内容数量与资源路径；referenceTemplateId 会驱动生成版式。Inspect content-specific academic reference layouts.',
  academic_ppt_render: '通过可选渲染引擎读取当前交付 PPTX，生成实际页面画面并记录摘要；引擎缺失时如实返回未验证。Render the current PPTX without changing the editable source.',
  academic_ppt_review: '记录对当前交付版本的实际视觉检查，绑定产物摘要与检查范围；没有看过画面不得标记通过。Bind an explicit visual review to current artifact hashes.',
}

const coreExecutors = {
  academic_ppt_init: createProject,
  academic_ppt_record: updateRecords,
  academic_ppt_context: contextProject,
  academic_ppt_build: buildProject,
  academic_ppt_edit: editProject,
  academic_ppt_undo: undoProject,
  academic_ppt_check: checkProject,
  academic_ppt_render: renderProjectArtifact,
  academic_ppt_review: recordReview,
  academic_ppt_reference: referenceLayouts,
}

const clip = (value, limit = 400) => String(value ?? '').slice(0, limit)
const own = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}

/** DSH's enforced wire subset excludes numeric/string/array bounds. Ajv still enforces them on execute. */
export function dshWireSchema(schema) {
  const wire = {}
  const allowed = new Set(['type', 'required', 'additionalProperties', 'enum', 'const', 'description', 'title', 'default', 'examples'])
  for (const [key, value] of Object.entries(schema)) {
    if (allowed.has(key)) wire[key] = structuredClone(value)
    else if (key === 'properties') wire.properties = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, dshWireSchema(child)]))
    else if (key === 'items') wire.items = dshWireSchema(value)
    else if (key === 'oneOf') wire.oneOf = value.map(dshWireSchema)
  }
  const bounds = ['minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'pattern']
    .filter(key => schema[key] !== undefined).map(key => `${key}=${schema[key]}`)
  if (bounds.length) wire.description = [wire.description, 'Runtime validation: ' + bounds.join(', ') + '.'].filter(Boolean).join(' ')
  return wire
}

async function saveTemplateProfile(profile, { cwd, outputPath, signal }) {
  const profilePath = await safePath(cwd, outputPath || `template-profile-${profile.sha256.slice(0, 12)}.json`)
  const bytes = Buffer.from(JSON.stringify(profile, null, 2) + '\n')
  signal?.throwIfAborted()
  await mkdir(dirname(profilePath), { recursive: true })
  let handle
  try { handle = await open(profilePath, 'wx') }
  catch (error) {
    if (error.code !== 'EEXIST') throw error
    const existing = await readBounded(profilePath)
    if (!existing.equals(bytes)) throw new Error('PROFILE_EXISTS: 目标文件内容不同，请选择新的 outputPath。')
    signal?.throwIfAborted()
    return profilePath
  }
  try {
    await handle.writeFile(bytes, { signal })
    signal?.throwIfAborted()
    await handle.close(); handle = undefined
    return profilePath
  } catch (error) {
    if (handle) await handle.close()
    await rm(profilePath, { force: true })
    throw error
  }
}

/** Keep durable model output bounded. The canonical value remains available to PTC. */
export function formatToolResult(name, result) {
  const data = own(result)
  const lines = [`${name}：${data.ok === false ? '需要处理下列问题' : '已完成本次操作'}`]
  for (const [key, label] of [['projectPath', '工程'], ['revision', '修订号'], ['title', '标题'], ['slideCount', '页数'], ['status', '状态']]) {
    if (data[key] !== undefined) lines.push(`${label}：${clip(data[key])}`)
  }
  if (data.message) lines.push(clip(data.message, 800))
  if (typeof data.summary === 'string') lines.push(clip(data.summary, 2400))
  if (Number.isInteger(data.summary?.errors)) lines.push(`证据/版式检查：${data.summary.errors} 个错误，${data.summary.warnings ?? 0} 个提醒。`)
  if (data.counts) lines.push('工程数量：' + ['papers', 'claims', 'assets', 'slides'].filter(key => Number.isInteger(data.counts[key])).map(key => `${key} ${data.counts[key]}`).join('；'))
  const pptxHash = data.pptxSha256 ?? data.artifact?.pptxSha256
  if (typeof pptxHash === 'string') lines.push(`当前 PPTX SHA-256：${clip(pptxHash, 64)}`)
  const files = own(data.files)
  for (const key of ['pptx', 'html', 'json', 'report', 'notes', 'manifest', 'speech', 'evidence', 'assets', 'quality', 'gallery', 'records', 'categoryPptx']) {
    if (typeof files[key] === 'string') lines.push(`${key}：${clip(files[key])}`)
  }
  for (const key of ['pptxPath', 'htmlPath', 'outputDir', 'reportPath', 'receiptPath']) {
    if (typeof data[key] === 'string') lines.push(`${key}：${clip(data[key])}`)
  }
  if (name === 'academic_ppt_template') {
    lines.push(`支持的组件：${Array.isArray(data.components) ? data.components.length : 0}`)
    if (typeof data.profilePath === 'string') lines.push(`模板 profile：${clip(data.profilePath)}`)
    if (Array.isArray(data.components)) lines.push(...data.components.slice(0, 16).map(c => `组件 ${clip(c.id, 120)}：源第 ${c.sourceSlide ?? '?'} 页；${clip(c.sourceName, 100)}；${c.nodes?.length ?? 0} 个基础形状。`))
    if (data.components?.length > 16) lines.push('其余组件见保存的模板 profile 或结构化结果；请明确选择组件 ID。')
    if (Array.isArray(data.fonts)) lines.push(`字体：${data.fonts.slice(0, 12).map(x => clip(typeof x === 'string' ? x : x.name, 70)).join('、')}`)
    if (Array.isArray(data.unsupported)) lines.push(...data.unsupported.slice(0, 8).map(x => `导入边界：${clip(typeof x === 'string' ? x : x.message ?? x.reason)}`))
  }
  if (name === 'academic_ppt_reference') {
    lines.push(`学术页型：本次 ${data.count ?? 0} 个${data.totalCount ? '；总计 ' + data.totalCount + ' 个' : ''}。`)
    if (Array.isArray(data.templates)) lines.push(...data.templates.slice(0, 48).map(t => `${clip(t.id, 80)}｜${clip(t.name, 80)}｜${clip(t.description, 220)}`))
    if (data.template) {
      const t = data.template
      lines.push(`选用 ${clip(t.id, 80)}：${clip(t.name, 100)}；layout=${clip(t.layout, 40)}`)
      lines.push(clip(t.description, 800))
      lines.push(`内容要求：${clip(JSON.stringify(t.requirements), 1500)}`)
      lines.push(`原生区域（1280×720 px）：${clip(JSON.stringify(t.slots), 6000)}`)
      lines.push(`小卡片样式：${(t.cardStyles ?? []).map(x => clip(x, 80)).join('、')}`)
      lines.push(`内容提示：${(t.prompts ?? []).map(x => clip(x, 300)).join('；')}`)
      lines.push(`写入 slide.referenceTemplateId="${clip(t.id, 80)}"；示例见 slide-records.json。`)
    }
  }
  if (name === 'academic_ppt_context') {
    if (typeof data.context === 'string') lines.push(clip(data.context, 16000))
    if (typeof data.stage === 'string') lines.push(`当前阶段：${clip(data.stage, 80)}`)
    if (typeof data.nextAction === 'string') lines.push(`下一步：${clip(data.nextAction, 1200)}`)
    if (data.brief) lines.push(`研究问题：${clip(data.brief.centralQuestion, 1200)}；听众：${clip(data.brief.audience, 200)}；时长：${data.brief.talkMinutes} 分钟。`)
    if (data.capabilities) lines.push(`图像输入能力：${clip(data.capabilities.imageInput, 40)}；依据：${clip(data.capabilities.source, 350)}`)
    if (Array.isArray(data.records) && data.records.length) {
      for (const item of data.records.slice(0, 4)) {
        const record = own(item.record)
        lines.push(`记录 ${clip(item.collection, 30)}/${clip(record.id, 80)}：${clip(record.title ?? record.text ?? record.caption, 1800)}`)
        for (const key of ['methodSummary', 'context', 'locator', 'version', 'figure', 'panel', 'cropNote']) if (record[key]) lines.push(`${key}：${clip(record[key], 1400)}`)
        if (record.reading) lines.push(`阅读状态：${clip(record.reading.status, 40)}；来源：${clip(record.reading.source, 500)}；阅读笔记：${clip(record.reading.notes, 1400)}`)
        if (Array.isArray(record.limitations)) lines.push(...record.limitations.slice(0, 4).map(x => `局限：${clip(x, 600)}`))
        if (Array.isArray(record.metrics)) lines.push(...record.metrics.slice(0, 5).map(m => `${clip(m.label, 100)}：${clip(m.value, 100)} ${clip(m.unit, 100)}；比较对象 ${clip(m.baseline, 400)}；分母 ${clip(m.denominator, 400)}；汇总口径 ${clip(m.aggregation, 400)}`))
        if (Array.isArray(record.cards)) lines.push(...record.cards.slice(0, 8).map(c => `卡片 ${clip(c.id, 80)}（${clip(c.style ?? c.kind, 40)}）：${clip(c.title, 150)}；${clip(c.body, 450)}`))
      }
    } else if (data.recordIndex) {
      for (const [collection, index] of Object.entries(data.recordIndex)) {
        if (Array.isArray(index) && index.length) lines.push(`${collection} 索引：` + index.slice(0, 16).map(r => `${clip(r.id, 80)} ${clip(r.title, 90)}`).join('；'))
        if (Array.isArray(index) && index.length > 16) lines.push(`${collection} 仅显示前 16 项；用 recordIds 选择至多 4 项读取，完整清单在工程文件。`)
      }
    }
  }
  for (const key of ['instructions', 'nextActions', 'pending']) {
    if (Array.isArray(data[key])) lines.push(...data[key].slice(0, 12).map(x => clip(typeof x === 'string' ? x : x.message ?? x.id ?? x.title, 650)))
  }
  const issues = Array.isArray(data.issues) ? data.issues : Array.isArray(data.quality?.issues) ? data.quality.issues : []
  if (issues.length) {
    lines.push(`检查事项：${issues.length}`)
    lines.push(...issues.slice(0, 12).map(issue => `${clip(issue.severity || issue.code || '提示', 40)} ${clip(issue.slideId || issue.paperId || issue.path || '', 100)}：${clip(issue.message || issue.detail || issue, 450)}`))
    if (issues.length > 12) lines.push('其余检查事项见报告文件或结构化结果。')
  }
  if (name === 'academic_ppt_build') lines.push('导出成功只表示已生成文件；请检查论文证据和最终 PPTX 逐页画面后再登记视觉验收。')
  if (data.verification) lines.push(`验收：PPTX 渲染 ${clip(data.verification.pptxRender ?? 'not-verified', 60)}；视觉 ${clip(data.verification.visual ?? 'not-verified', 60)}${data.verification.readyForDelivery !== undefined ? '；可交付 ' + String(data.verification.readyForDelivery) : ''}`)
  const text = lines.join('\n')
  return text.length <= 28000 ? text : text.slice(0, 27700) + '\n摘要达到 28,000 字符上限；请按 recordIds 分次读取，其余信息见工程/报告文件。'
}

/** Raw-schema registrations validate at this boundary; callers may use the same API directly. */
export function buildAcademicTools(overrides = {}) {
  return Object.values(TOOL_COMMANDS).map(name => ({
    name,
    description: descriptions[name],
    parameters: dshWireSchema(toolSchemas[name]),
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: formatToolResult(name, value) }],
    },
    async execute(rawArgs, exec) {
      exec?.signal?.throwIfAborted()
      assertToolArgs(name, rawArgs)
      const cwd = exec?.agent?.session?.header?.cwd ?? process.cwd()
      const options = { ...rawArgs, cwd, signal: exec?.signal }
      let value
      if (overrides[name]) value = await overrides[name](options)
      else if (name === 'academic_ppt_template') {
        const path = await safePath(cwd, rawArgs.filePath, { mustExist: true })
        const profile = await inspectTemplate(path, { signal: exec?.signal })
        const profilePath = await saveTemplateProfile(profile, options)
        value = { ...profile, ok: true, profilePath }
      } else value = await coreExecutors[name](options)
      exec?.signal?.throwIfAborted()
      return value
    },
  }))
}
import { open, mkdir, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
