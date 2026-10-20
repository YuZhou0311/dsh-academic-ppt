import { fileURLToPath } from 'node:url'
import { REFERENCE_CATEGORIES, REFERENCE_TEMPLATES, getReferenceTemplate } from './reference-catalog.mjs'
import { recommendFigureLayouts } from './figure-planning.mjs'
import { assertToolArgs } from './schema.mjs'

const resource = name => fileURLToPath(new URL('../skills/dsh-academic-ppt/references/templates/' + name, import.meta.url))
const overview = template => ({ id: template.id, category: template.category, task: template.description })
const neutralBox = box => Object.fromEntries(['x', 'y', 'w', 'h', 'style', 'kind'].filter(key => box[key] !== undefined).map(key => [key, box[key]]))
const roleFor = { paper: 'question', method: 'mechanism', experiment: 'design', results: 'evidence', figure: 'evidence', synthesis: 'synthesis', limitations: 'limitation', plan: 'proposal' }

function neutralTemplate(template) {
  return {
    id: template.id, category: template.category, name: template.name, layout: template.layout,
    description: template.description, requirements: template.requirements,
    units: { coordinates: 'px', canvas: { width: 1280, height: 720 }, viewport: 'fraction of source image (0–1)' },
    slots: Object.fromEntries(Object.entries(template.slots).map(([key, value]) => [key, Array.isArray(value) ? value.map(neutralBox) : neutralBox(value)])),
    cardStyles: template.cardStyles, cardKinds: template.cardKinds,
    ...(template.figureGuidance ? { figureGuidance: template.figureGuidance } : {}),
    ...(template.tableFlow ? { tableFlow: template.tableFlow } : {}),
    suggestedSeconds: template.suggestedSeconds,
  }
}

function fieldSkeleton(template) {
  const skeleton = {
    id: '', layout: template.layout, referenceTemplateId: template.id, title: '',
    argument: { role: roleFor[template.category], question: '', contribution: '', boundary: '' },
    paperIds: [], claimIds: [], figureIds: [], notes: '', seconds: template.suggestedSeconds,
    cards: template.slots.cards.map((_, index) => ({ id: `card-${index + 1}`, kind: template.cardKinds[index] ?? 'method', title: '', body: '', claimIds: [], style: template.cardStyles[index] ?? 'plain' })),
  }
  if (template.slots.panels?.length) skeleton.panelTitles = template.slots.panels.map(() => '')
  if (template.slots.nodeBoxes?.length) {
    skeleton.nodes = template.slots.nodeBoxes.map((_, index) => ({ id: `node-${index + 1}`, label: '', detail: '' }))
    skeleton.edges = (template.edgePairs ?? []).map(([from, to]) => ({ from: `node-${from + 1}`, to: `node-${to + 1}` }))
  }
  if (template.requirements.table) skeleton.table = { columns: [], rows: [], caption: '', sourceClaimIds: [] }
  if (template.requirements.chart) skeleton.chart = { kind: 'bar', categories: [], series: [], unit: '', sourceClaimId: '' }
  return skeleton
}

function exampleFiles(category) {
  return {
    pptx: resource('academic-templates-48.pptx'), gallery: resource('gallery.html'),
    manifest: resource('manifest.json'), records: resource('slide-records.json'),
    ...(category ? { categoryPptx: resource(category + '.pptx') } : {}),
  }
}

/** No template files are read. Content examples require an explicit opt-in. */
export async function referenceLayouts({ templateId, category, figure, includeExamples = false, signal } = {}) {
  signal?.throwIfAborted()
  assertToolArgs('academic_ppt_reference', { ...(templateId ? { templateId } : {}), ...(category ? { category } : {}), ...(figure ? { figure } : {}), includeExamples })
  if (category && !REFERENCE_CATEGORIES.some(item => item.id === category)) throw new Error('UNKNOWN_REFERENCE_CATEGORY: ' + category)
  const instructions = [
    '先按本页学术任务、图的阅读任务与必要标签尺寸选择构图；不要为填满槽位增加无关内容。',
    'templateId查询仅返回中性几何、数量限制和待填写字段；skeleton不是可直接提交的完整页面，空白处必须用已核实材料填写。',
    'slide.referenceTemplateId与layout必须匹配；面板题签、卡片和节点须使用本次科学内容，不能把示例措辞当结论。',
    '需要完整字段schema时调用academic_ppt_contract(topic=slide)。只有明确需要教学示例时才设置includeExamples=true；示例正文与原图不得进入正式汇报。',
  ]
  if (templateId) {
    const template = getReferenceTemplate(templateId)
    if (!template) throw new Error('UNKNOWN_REFERENCE_TEMPLATE: ' + templateId)
    if (category && template.category !== category) throw new Error('REFERENCE_CATEGORY_MISMATCH: ' + templateId + ' belongs to ' + template.category)
    return structuredClone({
      ok: true, count: 1, template: neutralTemplate(template), skeleton: fieldSkeleton(template),
      binding: { referenceTemplateId: template.id, layout: template.layout }, instructions,
      ...(includeExamples ? { files: exampleFiles(template.category), examplesIncluded: true } : {}),
      ...(figure ? { figureAdvice: recommendFigureLayouts(figure, [template]) } : {}),
    })
  }
  const templates = REFERENCE_TEMPLATES.filter(item => !category || item.category === category)
  const figureAdvice = figure ? recommendFigureLayouts(figure, templates) : undefined
  return structuredClone({
    ok: true, count: figureAdvice ? figureAdvice.candidates.length : templates.length,
    totalCount: REFERENCE_TEMPLATES.length, categories: REFERENCE_CATEGORIES,
    templates: (figureAdvice ? figureAdvice.candidates.map(candidate => getReferenceTemplate(candidate.templateId)) : templates).map(overview),
    ...(figureAdvice ? { figureAdvice } : {}),
    ...(includeExamples ? { files: exampleFiles(category), examplesIncluded: true } : {}), instructions,
  })
}
