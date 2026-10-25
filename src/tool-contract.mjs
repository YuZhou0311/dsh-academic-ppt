import {
  briefSchema, paperSchema, claimSchema, assetSchema, slideSchema, designSchema,
  assessmentSchema, capabilitiesSchema, assertToolArgs,
} from './schema.mjs'
import { ACADEMIC_PALETTES, DEFAULT_ACADEMIC_PALETTE_ID } from './academic-palette.mjs'

const contracts = {
  brief: {
    schema: briefSchema, recordKey: 'brief',
    notes: ['保留用户指定的篇数、全文条件和期刊门槛；助手自己的选文目标与用户约束应分开说明。', 'qualityProfile=academic 用于学术内容门槛；genre 选择实际报告类型，requirePaperIntro 只按报告任务设置。', '整稿先登记narrative.throughline说明贯穿问题与论证路线，narrative.sections用2–8个{id,title,question}记录各节要回答的问题。章节不是论文目录的机械搬运，顺序由研究关系决定。随后以slide.sectionId关联章节，目录/分节可由同一份路线派生；不自动增加页面或编造结论。短报告可以简化导航。'],
  },
  paper: {
    schema: paperSchema, recordKey: 'papers', maxItems: 5,
    notes: ['论文题名、版本、实际阅读章节、分析单位及比较条件须来自实际查阅；取得或抽取全文不等于逐页精读。', 'analysis 记录问题、缺口、机制、设计、比较、效度与可定位原文；未核实内容如实说明。'],
  },
  claim: {
    schema: claimSchema, recordKey: 'claims', maxItems: 20,
    notes: ['reported、inference、proposal 分别表示作者结果、有限解释与待检验建议。', 'reasoning 写证据如何支持结论及成立边界；定量结果的 metrics 保留单位、基线、分母与统计口径。'],
  },
  asset: {
    schema: assetSchema, recordKey: 'assets', maxItems: 8,
    notes: ['优先提供工作区内 path；原图来源、版本、许可和裁切边界必须可追溯。', 'width/height/minLabelPx 使用原图像素；viewport 为相对原图的0–1范围。displayLegend 只复述已核对的颜色对应，不能替代必要轴与单位。'],
  },
  slide: {
    schema: slideSchema, recordKey: 'slides', maxItems: 8,
    notes: ['argument 明确本页研究问题、论证作用、具体贡献与边界；标题、正文、备注须忠实于引用证据。', 'sectionId引用brief.narrative.sections中的ID，派生可见章节标签。layout:roadmap可显示整稿目录，layout:section标识转入某节并显示本节问题；二者可由narrative派生agenda。显式agenda.items可含sectionId/title/question，不与composition混用。transition是具体承上启下句，会进入PPTX备注和导出讲稿；需要当场可见的转折同时写入subtitle、标题或正文。', '组合正文页先用visualPlan简短记录信息关系、primaryPanelId、readingOrder和rationale，再决定composition；固定页型不要填写visualPlan。计划中的面板必须实际存在且readingOrder覆盖每个面板一次。它记录可审阅的设计选择，不是长思维链，也不会自动重排页面。关键页可记最多两个alternatives及取舍。readingOrder最多12项，与自由regions容量一致。可选contentLayers记录[{role,panelIds,summary}]，role为evidence/explanation/conditions/method/synthesis；panelIds绑定当前页实际区域，不要求固定层数、每层独占一框或并排分栏。', '页面坐标与 figureBoxes/card.box 使用1280×720画布的px；seconds 是预算，不能声称已排练。', '新稿用composition.rows或自由composition.regions，也可用drawings直接绘制；不必先选referenceTemplateId。panel引用本页cards/figureIds/chart/table/nodes/plots/drawingIds/referenceIds；每项恰好显示一次。heading:hidden隐藏重复题签，padding可0–24px。surface可选inherit/plain/rule/tint/band。card.appearance.layout可选stacked/banded/side-label，改变题签与正文的实际几何，缺省stacked；appearance另控制outline/tint/solid/plain表面、radius、padding、accent与elevation，icon使用内建语义图标；组外层已有明显容器时避免重复套框。', 'align:start仅用于未启用自由布局功能的流式rows，按内容收紧且不与该面板card.box或所消费节点node.box混用。自由regions，以及含heading、padding、drawingIds或referenceIds的rows，用区域box或行权重控制高度，不设置align:start；收紧后重新安排剩余空间。chrome可逐页覆盖标题线、角标、品牌、页脚和页码；来源记录始终保留。cover支持split/editorial等起点，也可variant:custom，用boxes.title/subtitle/occasion/metadata/visual和align自行分配角色区域；按实际内容提供对应box，插件检查边界、相撞与高度。closing对象支持statement/evidence收束，只用于layout:closing且不与composition混用。', 'drawings的elements可原生编辑：文字、形状、关系线与登记图片。数据标记须关联有数值口径的claimIds。heading支持标题位置、语义断行与强调。heading.inheritChrome:true显式保留当前章节/身份与band/rule；作者的box须避开保留区，冲突报错不挪动或缩字，缺省false保持旧自定标题。contentChecks指定主要视图必须保留的字句，notes或脚注不能替代。plotId支持同页多个科学图。机制图可用diagram或drawings，连线与标签必须准确对应，不为外观制造因果箭头。', '先用academic_ppt_study比较真实候选：candidatesPath读取[{id,label,slide}]的UTF8 JSON数组，2–6项，outputDir须为新目录。render:true生成实际PPTX画面，不写原工程或正式批准。有既有报告时portfolio只读比较明确给出的2–12工程，不扫描其他文件或给原创评分。', '先登记依赖的paper/claim/asset；已构建页面用academic_ppt_edit明确scope修改；批次slideOrder可按全部当前页ID重排，不改project.json。'],
  },
  design: {
    schema: designSchema, recordKey: 'design',
    defaultPalette: DEFAULT_ACADEMIC_PALETTE_ID,
    academicPalettes: Object.values(ACADEMIC_PALETTES),
    notes: ['颜色使用#RRGGBB，fontFamily为实际字体名称。academicPalettes提供5套可编辑学术候选，把选中项的palette完整写入design.palette，并用direction说明选择依据；它们不是学校/期刊官方色，也不按学科自动选色。可以按真实图表语义调整，保持正文和底色的可读对比。', '封面默认文字主导，以完整题名、语义断行、对齐和真实身份建立设计；minimal/editorial可无图片。需要自主构图时用custom+boxes；仅当图片有明确研究识别任务时选split/assetId，不为填空加图。', 'mode=content-led 为新工程默认；有参考时通常用reference-guided，学习主辅证据、局部分组、图旁说明、密度与层级；用户明确要求沿用版式时才用template-faithful。mode不自动生成布局，也不代表任意模板无损复刻。', '新工程默认density=compact，正文证据页严重结构性大空区会阻断review。封面、目录、章节页的有意留白只提醒视觉复核，不能为了占幅乱放图；正文门槛不变。balanced用于明确允许疏朗设计的初始化，旧项目缺省仅提醒。不能把compact降为balanced来消除失败。', '新稿cardDefaults为outline细描边、4px小圆角、16px内边距，无阴影或粗强调条。layout默认stacked；banded题签适合成组信息，side-label适合短类别与较长条件，不自动随机轮换，仍按研究关系选择。独立卡片有清楚边界；开放旁注或已有外层容器可显式用plain，避免重复套框。chrome和slide.chrome控制共同及逐页导航，风格一致不要求机械卡片阵列。', 'direction记录本稿视觉依据与选择，colorRoles将颜色绑定研究意义，projection指定最终显示的正文/标签/注释最小字号。新默认28/24/18px允许中间字级，不要求所有字变大。自定义design初始化时须显式提供所需projection/system，缺失继续旧兼容。record替换design时省略mode/density/cardDefaults/chrome/direction/projection/colorRoles会保留原设置。旧文件未登记模式时context.designMode显示legacy，但legacy不是可提交的mode值。', 'academic_ppt_template 的suggestedDesign是候选设计变量，须查看真实代表页并按当前内容适配后记录。system提供共同字号与可覆盖的构图默认；composition独立决定正文拓扑和局部分组。templateProfilePaths仅按需导入局部背景组件，模板旧文字和机构不作为当前内容。'],
  },
  assessment: {
    schema: assessmentSchema, recordKey: 'observations',
    notes: ['每条对应实际查看的最终PPTX页面，记录内容核查、可读性核查及仍存问题；无问题时issue填写空字符串。', '通过academic_ppt_review提交observations及同一产物pptxSha256、reviewedSlides、basis、reviewer、result。跨版本已看页面不能冒充对最终同一hash的逐页检查。'],
    capabilityRecord: {
      schema: capabilitiesSchema, recordKey: 'capabilities',
      submission: '可在init时提供，或以recordsPath批次的根级capabilities登记；这是有修订的内容更新。',
      notes: ['只记录本次宿主已核实的图像输入路径和依据；真实收到并看过图像可在source中记载具体入口和观察，模型名、OCR或成功生成PNG都不能单独证明图像输入。', 'unknown/unsupported时不能冒充human或只为通过检查填supported。尽早核实并登记；构建后更新能力也须重新构建、渲染和审查当前版本。'],
    },
  },
}

/** Full validation schemas are opt-in, one authoring topic at a time. */
export async function toolContract({ topic, signal } = {}) {
  signal?.throwIfAborted()
  assertToolArgs('academic_ppt_contract', { topic })
  const contract = structuredClone(contracts[topic])
  return {
    ok: true, topic, ...contract,
    submission: topic === 'assessment'
      ? { tool: 'academic_ppt_review', field: 'observations' }
      : { tool: 'academic_ppt_record', transport: 'recordsPath', maxBytes: 1024 * 1024, root: `{ "${contract.recordKey}": ${contract.maxItems ? '[records]' : '{record}'} }`, note: '将本批内容写为工作区UTF-8 JSON文件，工具参数只传projectPath、expectedRevision与recordsPath；文件内不放身份或路径路由参数。' },
  }
}

/** Omit optional object properties; never coerce malformed JSON values. */
export function jsonSafeResult(value) {
  const ancestors = new Set()
  const fail = (path, reason) => { throw new Error(`NON_JSON_TOOL_RESULT: ${path} ${reason}`) }
  const visit = (item, path, depth) => {
    if (depth > 64) fail(path, 'exceeds 64 nesting levels')
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) fail(path, 'must be a finite number')
      return item
    }
    if (typeof item !== 'object') fail(path, `contains unsupported ${typeof item}`)
    if (ancestors.has(item)) fail(path, 'contains a cycle')
    if (!Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) fail(path, 'must be a plain JSON object')
    if (Object.getOwnPropertySymbols(item).some(symbol => Object.getOwnPropertyDescriptor(item, symbol)?.enumerable)) fail(path, 'contains a symbol key')
    ancestors.add(item)
    try {
      if (Array.isArray(item)) {
        const result = []
        for (let index = 0; index < item.length; index++) {
          if (!Object.hasOwn(item, index)) fail(`${path}[${index}]`, 'contains an array hole')
          result.push(visit(item[index], `${path}[${index}]`, depth + 1))
        }
        if (Object.keys(item).some(key => !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= item.length)) fail(path, 'contains non-index array properties')
        return result
      }
      const result = {}
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
        if (!descriptor.enumerable) continue
        if (!Object.hasOwn(descriptor, 'value')) fail(`${path}.${key}`, 'contains an accessor')
        if (descriptor.value !== undefined) Object.defineProperty(result, key, { value: visit(descriptor.value, `${path}.${key}`, depth + 1), enumerable: true, writable: true, configurable: true })
      }
      return result
    } finally {
      ancestors.delete(item)
    }
  }
  return visit(value, '$', 0)
}
