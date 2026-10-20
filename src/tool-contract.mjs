import {
  briefSchema, paperSchema, claimSchema, assetSchema, slideSchema, designSchema,
  assessmentSchema, assertToolArgs,
} from './schema.mjs'

const contracts = {
  brief: {
    schema: briefSchema, recordKey: 'brief',
    notes: ['保留用户指定的篇数、全文条件和期刊门槛；助手自己的选文目标与用户约束应分开说明。', 'qualityProfile=academic 用于学术内容门槛；genre 选择实际报告类型，requirePaperIntro 只按报告任务设置。'],
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
    notes: ['argument 明确本页研究问题、论证作用、具体贡献与边界；标题、正文、备注须忠实于引用证据。', '页面坐标与 figureBoxes/card.box 使用1280×720画布的px；seconds 是预算，不能声称已排练。', '先登记依赖的paper/claim/asset；已构建页面用academic_ppt_edit明确scope修改。'],
  },
  design: {
    schema: designSchema, recordKey: 'design',
    notes: ['颜色使用#RRGGBB，fontFamily为实际字体名称。', '用户PPTX先由academic_ppt_template生成profile；以templateProfilePaths导入已保存profile，避免复制大量原生节点。模板旧文字不作为新报告内容。'],
  },
  assessment: {
    schema: assessmentSchema, recordKey: 'observations',
    notes: ['每条对应实际查看的最终PPTX页面，记录内容核查、可读性核查及仍存问题；无问题时issue填写空字符串。', '通过academic_ppt_review提交observations及同一产物pptxSha256、reviewedSlides、basis、reviewer、result。跨版本已看页面不能冒充对最终同一hash的逐页检查。'],
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
