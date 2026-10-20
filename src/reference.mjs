import { fileURLToPath } from 'node:url'
import { REFERENCE_CATEGORIES, REFERENCE_TEMPLATES, getReferenceTemplate } from './reference-catalog.mjs'
import { recommendFigureLayouts } from './figure-planning.mjs'
import { assertToolArgs } from './schema.mjs'

const resource = name => fileURLToPath(new URL('../skills/dsh-academic-ppt/references/templates/' + name, import.meta.url))
const overview = template => ({
  id: template.id, category: template.category, name: template.name,
  layout: template.layout, description: template.description,
  requirements: template.requirements, suggestedSeconds: template.suggestedSeconds,
})

/** Read-only catalogue. All resource paths come from bundled constants, never user paths. */
export async function referenceLayouts({ templateId, category, figure, signal } = {}) {
  signal?.throwIfAborted()
  assertToolArgs('academic_ppt_reference', {...(templateId?{templateId}:{}),...(category?{category}:{}),...(figure?{figure}:{})})
  if (category && !REFERENCE_CATEGORIES.some(item => item.id === category)) throw new Error('UNKNOWN_REFERENCE_CATEGORY: ' + category)
  const files = {
    pptx: resource('academic-templates-48.pptx'),
    gallery: resource('gallery.html'),
    manifest: resource('manifest.json'),
    records: resource('slide-records.json'),
  }
  const instructions = [
    '先判断本页的研究任务、主图方向与证据数量，再选择页型；不为填满模板增添无关内容。',
    '用 gallery 或模板 PPTX 查看实际版式。单页记录的 referenceTemplateId 必须与所选模板 ID 一致，layout 必须匹配。',
    '存在 panels 时，可用 slide.panelTitles 按原次序为每个面板填写准确题签；数量须一致。图的相关性、独立性或核验状态不能由模板默认文字决定。',
    '示例内容仅用于演示。将其替换为已核对的论文、论点、图资产与研究方案，保留图号、分母、实验身份和完整题名。',
    '卡片样式可以局部调整。图文放不下时先删重复解释或拆分论证任务，再检查字号；不要把关键限定删掉。',
  ]
  if (templateId) {
    const template = getReferenceTemplate(templateId)
    if (!template) throw new Error('UNKNOWN_REFERENCE_TEMPLATE: ' + templateId)
    if (category && template.category !== category) throw new Error('REFERENCE_CATEGORY_MISMATCH: ' + templateId + ' belongs to ' + template.category)
    return structuredClone({
      ok: true, count: 1, template, files: { ...files, categoryPptx: resource(template.category + '.pptx') },
      binding: { referenceTemplateId: template.id, layout: template.layout }, instructions,
      ...(figure?{figureAdvice:recommendFigureLayouts(figure,[template])}:{}),
    })
  }
  const templates = REFERENCE_TEMPLATES.filter(item => !category || item.category === category)
  if(figure){
    const figureAdvice=recommendFigureLayouts(figure,templates)
    return structuredClone({ok:true,count:figureAdvice.candidates.length,totalCount:REFERENCE_TEMPLATES.length,
      categories:REFERENCE_CATEGORIES,templates:figureAdvice.candidates.map(candidate=>overview(getReferenceTemplate(candidate.templateId))),figureAdvice,files,instructions})
  }
  return structuredClone({
    ok: true, count: templates.length, totalCount: REFERENCE_TEMPLATES.length,
    categories: REFERENCE_CATEGORIES, templates: templates.map(overview),
    files: category ? { ...files, categoryPptx: resource(category + '.pptx') } : files, instructions,
  })
}
