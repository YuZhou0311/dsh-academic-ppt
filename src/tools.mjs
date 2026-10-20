import {
  createProject, updateRecords, contextProject, buildProject, editProject,
  undoProject, checkProject, recordReview, renderProjectArtifact,
} from './core.mjs'
import { inspectTemplate } from './template.mjs'
import { referenceLayouts } from './reference.mjs'
import { toolSchemas, assertToolArgs } from './schema.mjs'
import { safePath, readBounded } from './io.mjs'
import { toolContract, jsonSafeResult } from './tool-contract.mjs'

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
  contract: 'academic_ppt_contract',
  render: 'academic_ppt_render',
  review: 'academic_ppt_review',
})

const descriptions = {
  academic_ppt_init: '创建学术汇报工程，记录研究问题、听众、时间与证据要求；不自动声称读过论文。Create a revisioned academic presentation project.',
  academic_ppt_record: '从工作区 recordsPath 读取≤1MiB UTF-8 JSON批次，登记论文、论点、图资产或页面；参数只放工程文件路径与修订号。字段不清楚先用academic_ppt_contract按主题查询，先登记被引用记录。Read bounded record batches from a workspace JSON file.',
  academic_ppt_context: '按阶段读取工程的精简工作上下文与待解决项；不回传整篇论文或图片数据。Get compact stage context and stable IDs.',
  academic_ppt_build: '把工程生成原生可编辑 PPTX、HTML 与检查材料；保存新版本，不覆盖 Office 手工修改。Build editable artifacts; successful export is not visual approval.',
  academic_ppt_edit: '修改指定页面或小卡片，使用稳定 ID、明确范围与修订号；style-only 只变样式，保留文字、图表与其他对象。Apply a scope-limited edit.',
  academic_ppt_undo: '以新修订恢复上一工程状态；已有交付文件保留。Restore the previous project snapshot without rewriting past deliveries.',
  academic_ppt_check: '只读检查论文证据、版式与产物摘要，列出可定位的问题。静态检查不能代替逐页看最终 PPTX。Inspect evidence, geometry and output integrity.',
  academic_ppt_template: '盘点本地 PPTX 的字体、颜色与支持的原生组件，将 profile JSON 保存到工作区供 record 导入；不覆盖不同内容的文件，不承诺复杂模板无损导入。Inspect and persist a reusable template profile.',
  academic_ppt_reference: '按学术任务查询48种布局的紧凑索引；templateId返回中性槽位、单位、数量限制与空字段骨架。figure可取得最多3个适配候选，不自动识别科学图。教学示例资源仅includeExamples=true返回，示例正文不得复制进汇报。Inspect neutral reference geometries.',
  academic_ppt_contract: '按brief/paper/claim/asset/slide/design/assessment单一主题读取完整字段schema、批次限额与短说明；首次写该类记录或遇到字段错误时使用，不必一次读取全部主题。Read one complete authoring contract on demand.',
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
  academic_ppt_contract: toolContract,
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

/** Keep large content schemas off every model request; runtime/CLI remain compatible. */
export function registeredToolParameters(name) {
  const schema = toolSchemas[name]
  const fields = name === 'academic_ppt_init' ? ['projectDir', 'title', 'brief', 'capabilities']
    : name === 'academic_ppt_record' ? ['projectPath', 'expectedRevision', 'recordsPath'] : undefined
  const selected = fields ? {
    ...schema,
    properties: Object.fromEntries(fields.map(key => [key, schema.properties[key]])),
    required: name === 'academic_ppt_record' ? fields : schema.required.filter(key => fields.includes(key)),
  } : schema
  const wire = dshWireSchema(selected)
  if (wire.properties.projectPath) wire.properties.projectPath.description = 'init返回的project.json文件路径，不是工程目录。 ' + (wire.properties.projectPath.description ?? '')
  if (wire.properties.recordsPath) wire.properties.recordsPath.description = '工作区内≤1MiB UTF-8 JSON批次文件；字段见academic_ppt_contract，文件内不放projectPath/expectedRevision等路由参数。 ' + (wire.properties.recordsPath.description ?? '')
  return wire
}

function templateSummary(profile, profilePath) {
  const components = (profile.components ?? []).slice(0, 40).map(component => ({
    id: component.id, sourceSlide: component.sourceSlide, width: component.width,
    height: component.height, nodeCount: component.nodes?.length ?? 0,
    oldTextExcluded: component.oldTextExcluded,
  }))
  return {
    ok: true, profilePath, sourceSha256: profile.sha256,
    summary: { slides: profile.slideCount, width: profile.width, height: profile.height, coordinateUnit: 'px', nativeShapes: profile.shapes?.length ?? 0, components: profile.components?.length ?? 0, unsupported: profile.unsupported?.length ?? 0 },
    study: profile.study, components,
    componentIndex: { total: profile.components?.length ?? 0, returned: components.length, truncated: (profile.components?.length ?? 0) > components.length },
    scope: profile.scope, visualReview: profile.visualReview,
    instructions: ['结构研究不等于视觉审阅；实际渲染模板后再判断标题层级、图文比例与可读性。', '通过recordsPath批次中的templateProfilePaths导入保存的profile，再按组件ID选择；工具输出不包含旧正文或完整原生节点。'],
  }
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
    lines.push(`支持的组件：${data.componentIndex?.total ?? data.components?.length ?? 0}`)
    if (typeof data.profilePath === 'string') lines.push(`模板 profile：${clip(data.profilePath)}`)
    if (data.summary) lines.push(`结构统计：${JSON.stringify(data.summary)}`)
    if (data.study) lines.push(`模板研究（统计与候选，未复制原文）：${JSON.stringify(data.study)}`)
    if (Array.isArray(data.components)) lines.push(...data.components.slice(0, 16).map(c => `组件 ${clip(c.id, 120)}：源第 ${c.sourceSlide ?? '?'} 页；${c.width}×${c.height}px；${c.nodeCount ?? 0} 个基础形状。`))
    if ((data.componentIndex?.total ?? data.components?.length ?? 0) > 16) lines.push('其余组件索引见结构化结果；超出返回索引上限时按需读保存的profile，避免复制全部节点。')
    if (data.scope) lines.push(`导入边界：${clip(data.scope, 1800)}`)
  }
  if (name === 'academic_ppt_reference') {
    lines.push(`学术页型：本次 ${data.count ?? 0} 个${data.totalCount ? '；总计 ' + data.totalCount + ' 个' : ''}。`)
    if (Array.isArray(data.templates)) lines.push(...data.templates.slice(0, 48).map(t => `${clip(t.id, 80)}｜${clip(t.task, 220)}`))
    if (data.figureAdvice) {
      const a=data.figureAdvice
      lines.push(`图片适配：${clip(a.status,100)}；${clip(a.basis,700)}`)
      for(const c of a.candidates??[]){
        lines.push(`候选 ${clip(c.templateId,80)}：${clip(c.name,100)}；图区 ${clip(JSON.stringify(c.imageBox),220)}；关键标签估计 ${c.projectedLabelPx??'未测量'} px；${clip(c.status,80)}`)
        for(const i of c.issues??[])lines.push(`${clip(i.severity,20)} ${clip(i.code,80)}：${clip(i.message,450)}`)
      }
      for(const action of a.nextActions??[])lines.push(clip(action,600))
    }
    if (data.template) {
      const t = data.template
      lines.push(`选用 ${clip(t.id, 80)}：${clip(t.name, 100)}；layout=${clip(t.layout, 40)}`)
      lines.push(clip(t.description, 800))
      lines.push(`内容要求：${clip(JSON.stringify(t.requirements), 1500)}`)
      lines.push(`原生区域（1280×720 px）：${clip(JSON.stringify(t.slots), 6000)}`)
      lines.push(`小卡片样式：${(t.cardStyles ?? []).map(x => clip(x, 80)).join('、')}`)
      if (data.skeleton) lines.push(`待填写字段骨架（空值必须补全）：${JSON.stringify(data.skeleton)}`)
      lines.push(`写入 slide.referenceTemplateId="${clip(t.id, 80)}"；完整字段规则见academic_ppt_contract(topic=slide)。`)
    }
  }
  if (name === 'academic_ppt_contract') {
    lines.push(`字段主题：${data.topic}；记录键：${data.recordKey}${data.maxItems ? `；每批最多${data.maxItems}条` : ''}`)
    if (data.submission) lines.push(`提交方式：${JSON.stringify(data.submission)}`)
    if (Array.isArray(data.notes)) lines.push(...data.notes)
    if (data.schema) lines.push(`完整JSON Schema：${JSON.stringify(data.schema)}`)
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
        if (record.reading?.status) lines.push(`阅读状态：${clip(record.reading.status, 40)}；来源：${clip(record.reading.source, 500)}；阅读笔记：${clip(record.reading.notes, 1400)}`)
        if (record.reading?.purpose) lines.push(`图片阅读：${clip(JSON.stringify(record.reading),2200)}`)
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
    parameters: registeredToolParameters(name),
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
        const profile = jsonSafeResult(await inspectTemplate(path, { signal: exec?.signal }))
        const profilePath = await saveTemplateProfile(profile, options)
        value = templateSummary(profile, profilePath)
      } else value = await coreExecutors[name](options)
      exec?.signal?.throwIfAborted()
      return jsonSafeResult(value)
    },
  }))
}
import { open, mkdir, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
