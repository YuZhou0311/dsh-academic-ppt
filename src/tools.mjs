import {
  createProject, updateRecords, contextProject, buildProject, editProject,
  undoProject, checkProject, recordReview, renderProjectArtifact, studyProject, portfolioProjects,
} from './core.mjs'
import { inspectTemplate } from './template.mjs'
import { referenceLayouts } from './reference.mjs'
import { toolSchemas, assertToolArgs } from './schema.mjs'
import { safePath, readBounded } from './io.mjs'
import { toolContract, jsonSafeResult } from './tool-contract.mjs'
import { prepareDesign } from './design-intake.mjs'
import { fileURLToPath } from 'node:url'
import { CARD_FAMILIES, CARD_PRESETS, getCardPreset, listCardPresets } from './card-catalog.mjs'

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
  study: 'academic_ppt_study',
  portfolio: 'academic_ppt_portfolio',
  prepare: 'academic_ppt_prepare',
  cards: 'academic_ppt_cards',
})

const descriptions = {
  academic_ppt_init: '创建可恢复学术汇报工程，记录研究问题、听众与章节；默认source-led，先查证文献并取得原图，再设计页面。完整要求见contract(brief)。',
  academic_ppt_record: '从工作区 recordsPath 读取≤1MiB UTF-8 JSON批次，登记论文、论点、图资产或页面；参数只放工程文件路径与修订号。字段不清楚先用academic_ppt_contract按主题查询，先登记被引用记录。Read bounded record batches from a workspace JSON file.',
  academic_ppt_context: '按阶段读取工程的精简工作上下文与待解决项；不回传整篇论文或图片数据。Get compact stage context and stable IDs.',
  academic_ppt_build: '把工程生成原生可编辑 PPTX、HTML 与检查材料；保存新版本，不覆盖 Office 手工修改。Build editable artifacts; successful export is not visual approval.',
  academic_ppt_edit: '修改指定页面或小卡片，使用稳定 ID、明确范围与修订号；style-only 只变样式，保留文字、图表与其他对象。Apply a scope-limited edit.',
  academic_ppt_undo: '以新修订恢复上一工程状态；已有交付文件保留。Restore the previous project snapshot without rewriting past deliveries.',
  academic_ppt_check: '检查来源查证、实际论文图使用、正文图文载体、留白、内容与产物摘要。source-led会阻断无原图或未用的已选图；静态检查不代替逐页看最终PPTX。',
  academic_ppt_template: '研究用户提供的PPTX，提取候选设计变量suggestedDesign并另存profile。默认reference-guided，学习主辅证据、邻接解释、分组、密度与层级，当前内容决定实际坐标；明确要求沿用版式才设template-faithful。render:true生成实际代表页供核对。Inspect reference design tokens, not a mandatory slide blueprint.',
  academic_ppt_reference: '可选查询48种中性布局；不作为新稿必经步骤。先确定研究关系、主证据和阅读顺序，优先用composition自主构图。templateId返回容量和骨架，figure返回最多3个几何候选；教学示例仅includeExamples=true返回。Inspect optional reference geometries.',
  academic_ppt_contract: '按preparation/brief/paper/claim/asset/slide/design/assessment单一主题读取完整字段schema、批次限额与短说明；首次写该类记录或遇到字段错误时使用，不必一次读取全部主题。Read one complete authoring contract on demand.',
  academic_ppt_render: '通过可选渲染引擎读取当前交付 PPTX，生成实际页面画面并记录摘要；引擎缺失时如实返回未验证。Render the current PPTX without changing the editable source.',
  academic_ppt_study: '从工作区candidatesPath读取≤1MiB UTF-8候选数组[{id,label,slide}]，每个slide字段见contract(slide)。提供2–6个真实候选，导出SVG、原生PPTX和并列HTML；render:true生成实际PPTX预览，不改原工程或批准。Compare concrete authored alternatives.',
  academic_ppt_portfolio: '只读比较明确提供的2–12份工程的主体结构和封面；换文字颜色或数据值不算结构改变，报告可并列的页对供实图复核，不提供原创性得分。Inspect supplied projects without scanning other files.',
  academic_ppt_review: '记录对当前交付版本的实际视觉检查，绑定产物摘要与检查范围；没有看过画面不得标记通过。Bind an explicit visual review to current artifact hashes.',
  academic_ppt_prepare: '规划辅助卡片与模板，论文查证取图优先。读取requestPath（≤1MiB JSON，契约见preparation），返回一次模板提问与可用宿主生图计划；失败回退原生卡片。不自行提问、调用模型或读取密钥。',
  academic_ppt_cards: '按family/purpose查询36种原生学术卡片；presetId返回内容契约、尺寸、结构与示例。用于局部信息组合，非整页布局。Inspect editable card recipes.',
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
  academic_ppt_study: studyProject,
  academic_ppt_portfolio: portfolioProjects,
  academic_ppt_reference: referenceLayouts,
  academic_ppt_contract: toolContract,
  academic_ppt_prepare: prepareDesign,
  academic_ppt_cards: async ({presetId,family,purpose,limit,signal}) => {
    signal?.throwIfAborted()
    const galleryPath=fileURLToPath(new URL('../skills/dsh-academic-ppt/references/card-library/index.html',import.meta.url))
    if (presetId) {
      const preset=getCardPreset(presetId)
      if (!preset) throw new Error('UNKNOWN_CARD_PRESET: '+presetId)
      return {ok:true,preset:structuredClone(preset),galleryPath,previewPath:fileURLToPath(new URL(`../skills/dsh-academic-ppt/references/card-library/cards/${preset.id}.svg`,import.meta.url)),instructions:['先判断配方是否适合本次内容；适合时将preset.id写入card.preset，并填写真实title/body/items/metric/badge/note及claimIds。示例仅用于理解设计，不是必须照搬的外观或研究事实。','在用户明确约束内自主调整design.palette与design.colorRoles、card.accent、card.box和appearance.padding/radius/elevation；保持全稿色义、正文可读与比较尺度一致。','需要不同内部比例、题签位置、分区或局部底色/文字色时，用drawings与composition.regions重建；appearance.layout/surface/accent不覆盖preset。已有布局或内容改动使用slide-content，card-style保持内容与外框锁定。','先满足内容契约和建议宽度，再由完整内容测量高度。不可把超出框的内容裁掉或缩成不可读小字。']}
    }
    const matches=listCardPresets({family,purpose,limit:36,includeExamples:false})
    const presets=matches.slice(0,limit??36).map(({id,name,family,purpose,dimensions})=>({id,name,family,purpose,dimensions}))
    return {ok:true,totalCount:CARD_PRESETS.length,matchedCount:matches.length,count:presets.length,families:structuredClone(CARD_FAMILIES),presets,galleryPath,
      instructions:['按内容关系研究候选，再用presetId读取配方；配色、尺寸和内容分组应服务本稿，参考无需照搬。需要新的内部组织时可用drawings与composition.regions；同一页可组合卡片、开放文字、图表或表格。','名称筛选只匹配用途文本；没有匹配时查看family或全部索引，不把“无匹配”误报为不支持该研究领域。']}
  },
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
    : name === 'academic_ppt_record' ? ['projectPath', 'expectedRevision', 'recordsPath']
    : name === 'academic_ppt_study' ? ['projectPath','expectedRevision','outputDir','candidatesPath','render','fontDirectories','externalReferencePrompts'] : undefined
  const selected = fields ? {
    ...schema,
    properties: Object.fromEntries(fields.map(key => [key, schema.properties[key]])),
    required: name === 'academic_ppt_record' ? fields : name === 'academic_ppt_study' ? ['projectPath','expectedRevision','outputDir','candidatesPath'] : schema.required.filter(key => fields.includes(key)),
  } : schema
  const wire = dshWireSchema(selected)
  // Keep the small initial choice visible; the conditional reason contract is
  // fetched on demand and still enforced by Ajv at execution.
  if(name==='academic_ppt_init')wire.properties.brief.properties.visualEvidence={type:'object',properties:{mode:{type:'string',enum:['source-led','flexible']},reason:{type:'string'}},required:['mode'],additionalProperties:false,description:'默认source-led；flexible须具体reason，完整约束见contract(brief)。'}
  // The exact 36-value enum is enforced at runtime and discoverable through cards;
  // do not repeat the entire catalogue in every model request.
  if(name==='academic_ppt_cards')wire.properties.presetId={type:'string',description:'本工具索引中返回的精确preset.id；运行时按完整枚举校验。'}
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
    study: profile.study, suggestedDesign:profile.suggestedDesign, designInference:profile.designInference, components,
    componentIndex: { total: profile.components?.length ?? 0, returned: components.length, truncated: (profile.components?.length ?? 0) > components.length },
    scope: profile.scope, visualReview: profile.visualReview,
    instructions: ['结构推断尚未视觉确认。查看实际代表页，学习主辅证据、局部分组、图旁解释、密度与阅读层级；模板的页序、卡片数量、封面家具和图文比例不自动成为约束。', 'suggestedDesign 是可编辑候选，默认 mode=reference-guided。审定并按当前内容调整后作为recordsPath批次的design保存。仅用户明确要求沿用版式时改为template-faithful；它也不保证任意母版无损复刻。', 'content-led/reference-guided先写argument和visualPlan，再用composition组织当前证据。panel.surface控制区域分组，card.appearance控制独立小卡片；按研究关系选择浅底、题签、边界或开放标注，避免机械卡片阵列与无组织文字堆叠。短旁注仅在不造成大空区时align=start。完整字段见contract(topic=slide)。', '封面、结尾、标题线和角标按当前场合重新设计；slide.chrome可关闭无用元素并回收空间。compact模式保留正文证据页的占幅门槛；封面、目录和章节留白只提醒看图判断，不为填空添加图片或装饰。', '仅确有需要的局部原生背景才通过templateProfilePaths导入。模板机构、旧正文、数据与图像不能移入当前研究；图标与情境图片需承担明确的信息职责。'],
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
  for (const key of ['pptxPath', 'htmlPath', 'outputDir', 'reportPath', 'receiptPath', 'externalPromptsPath']) {
    if (typeof data[key] === 'string') lines.push(`${key}：${clip(data[key])}`)
  }
  const contactSheetPaths = data.contactSheetPaths ?? data.render?.contactSheetPaths ?? data.rendering?.contactSheetPaths
  if (Array.isArray(contactSheetPaths)) lines.push(...contactSheetPaths.filter(path => typeof path === 'string').slice(0, 16).map(path => `PPTX 联系表：${clip(path, 3000)}`))
  if (name === 'academic_ppt_study' && data.rendering) {
    lines.push(`候选实际PPTX渲染：${clip(data.rendering.status ?? (data.rendering.ok ? 'rendered' : 'not-verified'), 100)}`)
    if (data.rendering.message || data.rendering.reason || data.rendering.error) lines.push(`渲染说明：${clip(data.rendering.message || data.rendering.reason || data.rendering.error, 1200)}`)
    for (const key of ['pdfPath','receiptPath']) if (typeof data.rendering[key] === 'string') lines.push(`候选 ${key}：${clip(data.rendering[key],3000)}`)
    lines.push('候选仅用于看图选择；未修改原工程，也未登记正式视觉批准。')
  }
  if (name === 'academic_ppt_portfolio') {
    lines.push(`明确提供的工程：${data.inputCount ?? 0}；依据：${clip(data.basis, 160)}`)
    for (const comparison of (data.comparisons ?? []).slice(0, 8)) {
      lines.push(`${clip(comparison.leftProjectId,100)} ↔ ${clip(comparison.rightProjectId,100)}：${comparison.matchingBodyPages}/${comparison.smallerBodyPageCount}页主体近似；封面${comparison.matchingCover?'相同结构':comparison.similarMainCover?'题名和主图区近似':'未识别相同结构'}。`)
      for (const pair of (comparison.pairs ?? []).slice(0, 6)) lines.push(`并列复核：${clip(pair.leftSlideId,80)}「${clip(pair.leftTitle,120)}」 ↔ ${clip(pair.rightSlideId,80)}「${clip(pair.rightTitle,120)}」`)
    }
    if (data.limits) lines.push(clip(data.limits,1200))
    if ((data.comparisons ?? []).length > 8) lines.push('其余工程比较见结构化结果或保存的报告。')
  }
  if (name === 'academic_ppt_template') {
    lines.push(`支持的组件：${data.componentIndex?.total ?? data.components?.length ?? 0}`)
    if (typeof data.profilePath === 'string') lines.push(`模板 profile：${clip(data.profilePath)}`)
    if (data.summary) lines.push(`结构统计：${JSON.stringify(data.summary)}`)
    if (data.suggestedDesign) lines.push(`候选设计变量（审定并适配后记录，页面结构由当前论证决定）：${JSON.stringify(data.suggestedDesign)}`)
    if (data.designInference) lines.push(`设计推断依据与限制：${JSON.stringify(data.designInference)}`)
    if (data.preview) lines.push(`模板真实渲染（仍须看图）：${JSON.stringify(data.preview)}`)
    if (data.study) lines.push(`模板研究（统计与候选，未复制原文）：${JSON.stringify(data.study)}`)
    if (Array.isArray(data.components)) lines.push(...data.components.slice(0, 16).map(c => `组件 ${clip(c.id, 120)}：源第 ${c.sourceSlide ?? '?'} 页；${c.width}×${c.height}px；${c.nodeCount ?? 0} 个基础形状。`))
    if ((data.componentIndex?.total ?? data.components?.length ?? 0) > 16) lines.push('其余组件索引见结构化结果；超出返回索引上限时按需读保存的profile，避免复制全部节点。')
    if (data.scope) lines.push(`导入边界：${clip(data.scope, 1800)}`)
  }
  if (name === 'academic_ppt_prepare') {
    for(const instruction of data.researchPrerequisite?.instructions??[])lines.push(clip(instruction,1800))
    lines.push(`下一步：${clip(data.nextAction,160)}`)
    if(data.planPath)lines.push(`设计准备记录：${clip(data.planPath,3000)}`)
    if(data.designAdaptation){
      const a=data.designAdaptation
      lines.push(`卡片适配：${a.mode}；配色策略 ${a.colorPolicy.mode}`)
      lines.push(a.colorPolicy.instruction)
      for(const route of a.routes??[])lines.push(`设计路径 ${route.mode}：${route.instruction}`)
      for(const instruction of a.instructions??[])lines.push(instruction)
      if(a.decisionRecord)lines.push(a.decisionRecord)
    }
    if(data.nativeFallback?.selection)lines.push(`原生设计：${data.nativeFallback.selection}`)
    if(data.template?.question)lines.push(`待提问（尚未实际询问）：${JSON.stringify(data.template.question)}`)
    for(const instruction of data.template?.instructions??[])lines.push(clip(instruction,1600))
    for(const file of data.template?.files??[])lines.push(`模板文件：${JSON.stringify(file)}`)
    if(data.template?.review){
      const review=data.template.review
      lines.push(`模板审阅记录：${JSON.stringify(review.profiles)}`)
      lines.push(`模板看图观察（宿主记录）：${review.visualObservations}`)
      if(review.renderReferences?.length)lines.push(`模板渲染引用：${JSON.stringify(review.renderReferences)}`)
    }
    if(data.imageGeneration){
      const g=data.imageGeneration
      lines.push(`生图参考：${g.availability} / ${g.status}；策略 ${g.strategy}；下一步 ${g.nextAction}`)
      if(g.source)lines.push(`能力依据：${g.source}`)
      if(g.toolName)lines.push(`宿主工具（调用者声明）：${clip(g.toolName,180)}`)
      for(const instruction of g.instructions??[])lines.push(clip(instruction,1800))
      if(g.batches?.length)for(const batch of g.batches)lines.push(`生图批次 ${batch.id}（尚未执行；内容 ${batch.cardIds.join('、')}）：\n${batch.prompt}`)
      else if(g.prompt)lines.push(`生图提示词（尚未执行）：\n${g.prompt}`)
      if(g.visualObservations)lines.push(`宿主看图记录：${clip(g.visualObservations,2000)}`)
      if(g.resultReferences?.length)lines.push(`已生成参考：${JSON.stringify(g.resultReferences)}`)
      if(g.reason)lines.push(`回退原因：${g.reason}`)
    }
  }
  if (name === 'academic_ppt_cards') {
    if(data.galleryPath)lines.push(`本地图册：${clip(data.galleryPath,3000)}`)
    if(data.previewPath)lines.push(`单卡预览：${clip(data.previewPath,3000)}`)
    if(data.preset)lines.push(`卡片完整配方：${JSON.stringify(data.preset)}`)
    else{
      lines.push(`卡片预设：总计 ${data.totalCount}，匹配 ${data.matchedCount}，本次 ${data.count}。`)
      for(const p of data.presets??[])lines.push(`${p.id}｜${p.name}｜${p.purpose}｜建议宽${p.dimensions.preferredWidth}px，最低${p.dimensions.minimumWidth}px`)
    }
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
      lines.push(`参考候选 ${clip(t.id, 80)}：${clip(t.name, 100)}；layout=${clip(t.layout, 40)}`)
      lines.push(clip(t.description, 800))
      lines.push(`内容要求：${clip(JSON.stringify(t.requirements), 1500)}`)
      lines.push(`原生区域（1280×720 px）：${clip(JSON.stringify(t.slots), 6000)}`)
      lines.push(`小卡片样式：${(t.cardStyles ?? []).map(x => clip(x, 80)).join('、')}`)
      if (data.skeleton) lines.push(`待填写字段骨架（空值必须补全）：${JSON.stringify(data.skeleton)}`)
      lines.push(`只有当前证据适合该固定结构时才写入slide.referenceTemplateId="${clip(t.id, 80)}"；否则用composition自主构图，二者不混用。完整字段见academic_ppt_contract(topic=slide)。`)
    }
  }
  if (name === 'academic_ppt_contract') {
    lines.push(`字段主题：${data.topic}；记录键：${data.recordKey}${data.maxItems ? `；每批最多${data.maxItems}条` : ''}`)
    if (data.submission) lines.push(`提交方式：${JSON.stringify(data.submission)}`)
    if (Array.isArray(data.notes)) lines.push(...data.notes)
    if (data.schema) lines.push(`完整JSON Schema：${JSON.stringify(data.schema)}`)
    if (data.capabilityRecord) lines.push(`图像输入能力记录：${JSON.stringify(data.capabilityRecord)}`)
    if (data.academicPalettes) lines.push(`学术配色候选（默认${data.defaultPalette}）：${JSON.stringify(data.academicPalettes)}`)
  }
  if (name === 'academic_ppt_context') {
    if (typeof data.context === 'string') lines.push(clip(data.context, 16000))
    if (typeof data.stage === 'string') lines.push(`当前阶段：${clip(data.stage, 80)}`)
    if (typeof data.designMode === 'string') lines.push(`设计模式：${clip(data.designMode, 80)}`)
    if (typeof data.nextAction === 'string') lines.push(`下一步：${clip(data.nextAction, 1200)}`)
    if (data.brief) lines.push(`研究问题：${clip(data.brief.centralQuestion, 1200)}；听众：${clip(data.brief.audience, 200)}；时长：${data.brief.talkMinutes} 分钟。`)
    if (data.brief?.narrative) lines.push(`整稿论证路线：${clip(data.brief.narrative.throughline, 1600)}；章节：${JSON.stringify(data.brief.narrative.sections)}`)
    if (data.capabilities) lines.push(`图像输入能力：${clip(data.capabilities.imageInput, 40)}；依据：${clip(data.capabilities.source, 350)}`)
    if (Array.isArray(data.records) && data.records.length) {
      for (const item of data.records.slice(0, 4)) {
        const record = own(item.record)
        lines.push(`记录 ${clip(item.collection, 30)}/${clip(record.id, 80)}：${clip(record.title ?? record.text ?? record.caption, 1800)}`)
        for (const key of ['methodSummary', 'context', 'locator', 'version', 'figure', 'panel', 'cropNote']) if (record[key]) lines.push(`${key}：${clip(record[key], 1400)}`)
        if (record.sourceCheck) lines.push(`来源核对记录（宿主执行）：${clip(JSON.stringify(record.sourceCheck),2400)}`)
        if (record.figureReview) lines.push(`图源盘点：${clip(JSON.stringify(record.figureReview),3800)}`)
        if (record.reading?.status) lines.push(`阅读状态：${clip(record.reading.status, 40)}；来源：${clip(record.reading.source, 500)}；阅读笔记：${clip(record.reading.notes, 1400)}`)
        if (record.reading?.purpose) lines.push(`图片阅读：${clip(JSON.stringify(record.reading),2200)}`)
        if (record.argument) lines.push(`页面论证：${clip(JSON.stringify(record.argument),2400)}`)
        if (record.visualPlan) lines.push(`构图决策：${clip(JSON.stringify(record.visualPlan),2800)}`)
        if (Array.isArray(record.limitations)) lines.push(...record.limitations.slice(0, 4).map(x => `局限：${clip(x, 600)}`))
        if (Array.isArray(record.metrics)) lines.push(...record.metrics.slice(0, 5).map(m => `${clip(m.label, 100)}：${clip(m.value, 100)} ${clip(m.unit, 100)}；比较对象 ${clip(m.baseline, 400)}；分母 ${clip(m.denominator, 400)}；汇总口径 ${clip(m.aggregation, 400)}`))
        if (Array.isArray(record.cards)) for(const c of record.cards.slice(0,8)) {
          lines.push(`卡片 ${clip(c.id,80)}（${clip(c.preset ?? c.style ?? c.kind,80)}）：${clip(c.title,150)}；${clip(c.body,450)}`)
          if(c.badge)lines.push(`卡片编号/标识：${clip(c.badge,80)}`)
          if(Array.isArray(c.items))for(const item of c.items.slice(0,6))lines.push(`卡片分块 ${clip(item.label,200)}：${clip(item.value??'',100)} ${clip(item.unit??'',100)}；${clip(item.detail??'',500)}`)
          if(c.note)lines.push(`卡片限定/附注：${clip(c.note,800)}`)
        }
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
  const visualEvidence = data.evidenceDesign ?? data.designDiagnostics?.evidenceDesign ?? data.quality?.designDiagnostics?.evidenceDesign
  if(visualEvidence?.summary){const v=visualEvidence.summary;lines.push(`正文视觉载体：${v.bodySlideCount}页；论文原图${v.sourceFigureCount}幅/覆盖${v.sourceFigureSlideCount}页；科学图示${v.scientificVisualSlideCount}页；原生表${v.nativeTableSlideCount}页；纯文字${v.textOnlySlideCount}页，最长连续${v.longestTextOnlyRun}页。文字卡和装饰不算论文图。`)}
  const research = data.researchEvidence ?? data.designDiagnostics?.researchEvidence ?? data.quality?.designDiagnostics?.researchEvidence
  if(research?.summary){const r=research.summary;lines.push(`来源获取检查：策略${research.mode}；核心来源${r.coreSourceCount}篇，登记已查证${r.verifiedSourceCount}篇；选中原图${r.selectedSourceFigureCount}幅，实际入稿${r.usedSelectedSourceFigureCount}幅；阻断项${r.blockingIssues}。记录由宿主执行，插件不独立联网验真。`);if(r.selectedButUnusedAssetIds?.length)lines.push(`已选但未入稿：${r.selectedButUnusedAssetIds.join('、')}`)}
  const issues = Array.isArray(data.issues) ? data.issues : Array.isArray(data.quality?.issues) ? data.quality.issues : []
  if (issues.length) {
    lines.push(`检查事项：${issues.length}`)
    lines.push(...issues.slice(0, 12).map(issue => `${clip(issue.severity || issue.code || '提示', 40)} ${clip(issue.slideId || issue.paperId || issue.path || '', 100)}：${clip(issue.message || issue.detail || issue, 450)}`))
    if (issues.length > 12) lines.push('其余检查事项见报告文件或结构化结果。')
  }
  if (name === 'academic_ppt_build') lines.push('导出成功只表示已生成文件；请检查论文证据和最终 PPTX 逐页画面后再登记视觉验收。')
  if (data.verification) lines.push(`验收：PPTX 渲染 ${clip(data.verification.pptxRender ?? 'not-verified', 60)}；视觉 ${clip(data.verification.visual ?? 'not-verified', 60)}${data.verification.readyForDelivery !== undefined ? '；可交付 ' + String(data.verification.readyForDelivery) : ''}`)
  const text = lines.join('\n')
  // Opt-in contracts and file-bounded preparation prompts must be complete.
  // Neither is repeated in every registered tool definition.
  if (name === 'academic_ppt_contract' || name === 'academic_ppt_prepare') return text
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
        if(rawArgs.render){
          const {renderDeck}=await import('./vendor/dsh-ppt-render.mjs')
          const fontDirectories=rawArgs.fontDirectories?await Promise.all(rawArgs.fontDirectories.map(dir=>safePath(cwd,dir,{mustExist:true}))):undefined
          const outputDir=await safePath(cwd,profilePath+'-preview')
          const preview=await renderDeck({pptxPath:path,outputDir,format:'png',fontDirectories,signal:exec?.signal})
          if(preview.ok){const {createContactSheets}=await import('./montage.mjs');preview.contactSheetPaths=await createContactSheets(preview.pngPaths,dirname(preview.receiptPath),{signal:exec?.signal})}
          value.preview=preview
        }
      } else value = await coreExecutors[name](options)
      exec?.signal?.throwIfAborted()
      return jsonSafeResult(value)
    },
  }))
}
import { open, mkdir, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
