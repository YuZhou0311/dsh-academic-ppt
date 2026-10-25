/** Reviewable signals over the actual export scene, not an aesthetic or scientific score. */
import { expandClaimIds } from './academic-quality.mjs';
import { readingRole } from './projection-quality.mjs';
import { chartVisibleText } from './chart-labels.mjs';

const list = value => Array.isArray(value) ? value : [];
const roots = slide => [...list(slide.claimIds), ...list(slide.cards).flatMap(c => list(c.claimIds)),
  ...(slide.chart ? [slide.chart.sourceClaimId] : []), ...list(slide.plot?.sourceClaimIds),
  ...list(slide.plots).flatMap(p => list(p.sourceClaimIds)), ...list(slide.table?.sourceClaimIds),
  ...list(slide.drawings).flatMap(d => [...list(d.claimIds), ...list(d.elements).flatMap(e => list(e.claimIds))])];
const textsOf = node => node.kind === 'text' ? [String(node.text || '')]
  : node.kind === 'table' ? [...list(node.table?.columns), ...list(node.table?.rows).flat()].map(String)
  : node.kind === 'chart' ? chartVisibleText(node.chart)
  : [];

/** Normalise typography and whitespace; retain signs, decimals and units. */
const normalized = text => String(text ?? '').normalize('NFKC').replace(/−/g, '-')
  .replace(/\s+/gu, (space,offset,source) => /[\d.]/.test(source[offset-1]||'') && /[\d.+-]/.test(source[offset+space.length]||'') ? ' ' : '');
function visibleMatch(haystack, needle) {
  if (!needle) return false;
  const numbers = [...haystack.matchAll(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/g)]
    .map(match => [match.index, match.index + match[0].length]);
  let offset = haystack.indexOf(needle);
  while (offset >= 0) {
    const end = offset + needle.length;
    // Never match a fragment of a signed decimal or scientific-notation token.
    // Unit case remains meaningful: mm/mM and mW/MW are different quantities.
    if (!numbers.some(([a,b]) => offset > a && offset < b || end > a && end < b)) return true;
    offset = haystack.indexOf(needle, offset + 1);
  }
  return false;
}

export function contentCoverageReport(project, scenes) {
  const pages = new Map(list(scenes?.pages).map(page => [page.id, page]));
  const issues = [], slides = [];
  for (const slide of list(project.slides)) {
    if (!list(slide.contentChecks).length) continue;
    const nodes = list(pages.get(slide.id)?.nodes).filter(n => n.semantic !== false && readingRole(n) !== 'note' &&
      !['reference-title', 'reference-index', 'identity', 'index', 'section-label', 'section-index', 'decoration'].includes(n.role));
    const chunks = nodes.flatMap(textsOf).filter(Boolean).map(normalized);
    const haystack = chunks.join(' ');
    const checks = slide.contentChecks.map(check => ({ id: check.id, text: check.text,
      visible: visibleMatch(haystack, normalized(check.text)) }));
    for (const check of checks.filter(c => !c.visible)) issues.push({ severity: 'error', code: 'required-visible-content-missing',
      path: `slides.${slide.id}.contentChecks.${check.id}`, slideId: slide.id,
      message: `主要视图中未找到必须可见的内容“${check.text}”。讲稿、脚注或来源记录不能代替正文；核对当前导出对象及措辞。` });
    slides.push({ slideId: slide.id, checks });
  }
  return { basis: 'author-specified-visible-text-not-fact-verification', slides, issues };
}

export function evidenceDesignReport(project, scenes) {
  const pages = new Map(list(scenes?.pages).map(page => [page.id, page]));
  const claims = new Map(list(project.claims).map(c => [c.id, c]));
  const assets = new Map(list(project.assets).map(a => [a.id, a]));
  const issues = [], slides = [];
  for (const slide of list(project.slides)) {
    if (slide.argument?.role !== 'evidence') continue;
    const linked = expandClaimIds(project.claims, roots(slide)).map(id => claims.get(id)).filter(Boolean);
    if (!linked.some(c => list(c.metrics).length)) continue;
    const nodes = list(pages.get(slide.id)?.nodes).filter(n => n.semantic !== false);
    const visibleCarriers = [];
    if (nodes.some(n => n.kind === 'image' && assets.get(n.assetId)?.usage === 'figure' &&
      assets.get(n.assetId)?.reading?.purpose !== 'locator' && n.w > 0 && n.h > 0)) visibleCarriers.push('source-figure');
    if (nodes.some(n => n.kind === 'chart' && list(n.chart?.series).some(s => list(s.values).length))) visibleCarriers.push('chart');
    if (nodes.some(n => n.kind === 'table' && list(n.table?.rows).length)) visibleCarriers.push('table');
    if (nodes.some(n => /\/data-plot\//.test(n.id || '') && ['ellipse','rect','line'].includes(n.kind))) visibleCarriers.push('scientific-plot');
    const marks = nodes.filter(n => n.role === 'data' && ['rect','ellipse','line'].includes(n.kind));
    const relations = nodes.filter(n => n.kind === 'line' && (n.role === 'relationship' || /\/edge:\d/.test(n.id || '')));
    const labels = nodes.filter(n => n.kind === 'text' && n.text?.trim() && !['footer','citation','note','index'].includes(n.role));
    if (marks.length >= 2 && labels.filter(n => /\d/.test(n.text)).length >= 2) visibleCarriers.push('authored-data-marks');
    if (relations.length && labels.length >= 2) visibleCarriers.push('authored-relationship');
    const paperIds = new Set(linked.map(c => c.paperId));
    const availableSourceFigures = [...assets.values()].filter(a => paperIds.has(a.paperId) && a.usage === 'figure' && a.reading?.purpose !== 'locator').map(a => ({ id: a.id, paperId: a.paperId, figure: a.figure || '', caption: a.caption }));
    slides.push({ slideId: slide.id, visibleCarriers, availableSourceFigures, primaryPanelId: slide.visualPlan?.primaryPanelId || null });
    if (!visibleCarriers.length) issues.push({ severity: 'warning', code: 'quantitative-evidence-text-only', slideId: slide.id,
      path: `slides.${slide.id}`, availableSourceFigureIds: availableSourceFigures.map(a => a.id),
      message: '本页含定量证据，但自动检查尚未识别可见图、表、数据标记或研究关系。核对是否只剩大小字摘要，或自绘载体未被识别；保留有用的对照与分布，不为消除提醒添加装饰图片。' });
  }
  return { basis: 'visible-carrier-review-prompt-not-aesthetic-score', slides, issues };
}
