/** Content-free design observations from PPTX XML. This is not a visual review. */
import path from 'node:path';

const A = (n, k, d) => n?.attrs?.[k] ?? d;
const first = (n, k) => n?.children?.find(c => c.name === k);
const all = (n, k) => (n?.children || []).flatMap(c => [...(c.name === k ? [c] : []), ...all(c, k)]);
const number = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const round = (v, digits = 3) => Number(v.toFixed(digits));
const textOf = n => all(n, 't').map(t => (t.children || []).filter(c => c.name === '#text').map(c => c.text).join('')).join('');
const chars = t => Array.from(t.replace(/\s/g, '')).length;
const add = (m, k, amount = 1) => { if (k !== undefined && k !== '') m.set(k, (m.get(k) || 0) + amount); };
const histogram = (m, key, limit = 12) => [...m].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit).map(([value, count]) => ({ [key]: value, count }));
const quantile = (values, p) => { const s = [...values].sort((a, b) => a - b); return s.length ? round(s[Math.round((s.length - 1) * p)]) : null; };
const range = values => ({ min: quantile(values, 0), median: quantile(values, .5), max: quantile(values, 1) });
const abort = signal => { if (signal?.aborted) throw signal.reason || new Error('操作已取消'); };

function relations(part, root) {
  const result = new Map();
  for (const r of all(root, 'Relationship')) {
    const target = A(r, 'Target', '');
    if (A(r, 'TargetMode') === 'External' || !target || /[\\\0]/.test(target) || /^[a-z][\w+.-]*:/i.test(target)) continue;
    const resolved = path.posix.normalize(target.startsWith('/') ? target.slice(1) : path.posix.join(path.posix.dirname(part), target));
    if (!resolved.startsWith('ppt/')) continue;
    result.set(A(r, 'Id'), { target: resolved, type: A(r, 'Type', '').split('/').at(-1) });
  }
  return result;
}

const relPath = part => `${path.posix.dirname(part)}/_rels/${path.posix.basename(part)}.rels`;

/** Share displayed page numbering with component extraction; part names are not page numbers. */
export function templateSlideOrder(parts, presentation, presentationRelationships) {
  const numericParts = Object.keys(parts).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => number(a.match(/slide(\d+)/)[1]) - number(b.match(/slide(\d+)/)[1]));
  const pr = relations('ppt/presentation.xml', presentationRelationships);
  const ordered = all(presentation, 'sldId').map(n => {
    const ids = Object.entries(n.attrs || {}).filter(([k]) => /:id$/.test(k)).map(([, v]) => v);
    const id = ids.find(v => pr.has(v)) || A(n, 'id');
    return pr.get(id)?.target;
  });
  const orderValid = ordered.length === numericParts.length && new Set(ordered).size === numericParts.length && ordered.every(p => numericParts.includes(p));
  return { slideParts: orderValid ? ordered : numericParts, order: orderValid ? 'presentation-relationships' : 'slide-part-number-fallback' };
}

const placeholder = n => all(n, 'ph')[0];
function matchingShape(root, ph) {
  if (!ph) return null;
  const shapes = all(root, 'sp').filter(s => placeholder(s));
  const idx = A(ph, 'idx');
  if (idx !== undefined) {
    const match = shapes.find(s => A(placeholder(s), 'idx') === idx);
    if (match) return match;
  }
  const type = A(ph, 'type', 'body');
  return shapes.find(s => A(placeholder(s), 'type', 'body') === type) || null;
}

function ownBox(n, transform) {
  const xfrm = first(first(n, 'spPr'), 'xfrm') || first(n, 'xfrm');
  if (!xfrm || number(A(xfrm, 'rot')) || ['1', 'true'].includes(A(xfrm, 'flipH')) || ['1', 'true'].includes(A(xfrm, 'flipV'))) return null;
  const off = first(xfrm, 'off'), ext = first(xfrm, 'ext');
  if (!off || !ext) return null;
  return { x: number(A(off, 'x')) * transform.sx + transform.tx, y: number(A(off, 'y')) * transform.sy + transform.ty,
    w: number(A(ext, 'cx')) * transform.sx, h: number(A(ext, 'cy')) * transform.sy };
}

function objects(root) {
  const result = [];
  function walk(n, t = { sx: 1, sy: 1, tx: 0, ty: 0 }, uncertain = false) {
    for (const c of n?.children || []) {
      if (c.name === 'grpSp') {
        const x = first(first(c, 'grpSpPr'), 'xfrm');
        const off = first(x, 'off'), ext = first(x, 'ext'), co = first(x, 'chOff'), ce = first(x, 'chExt');
        const bad = uncertain || !x || !number(A(ce, 'cx')) || !number(A(ce, 'cy')) || number(A(x, 'rot')) || ['1', 'true'].includes(A(x, 'flipH')) || ['1', 'true'].includes(A(x, 'flipV'));
        const sx = number(A(ext, 'cx'), 1) / (number(A(ce, 'cx')) || 1), sy = number(A(ext, 'cy'), 1) / (number(A(ce, 'cy')) || 1);
        walk(c, { sx: t.sx * sx, sy: t.sy * sy, tx: t.tx + t.sx * (number(A(off, 'x')) - number(A(co, 'x')) * sx), ty: t.ty + t.sy * (number(A(off, 'y')) - number(A(co, 'y')) * sy) }, Boolean(bad));
      } else if (['sp', 'pic', 'graphicFrame', 'cxnSp'].includes(c.name)) result.push({ node: c, box: uncertain ? null : ownBox(c, t), groupedGeometryUncertain: uncertain });
    }
  }
  walk(all(root, 'spTree')[0]);
  return result;
}

function levelStyle(node, level) {
  return first(node, `lvl${level + 1}pPr`) || first(node, 'defPPr');
}
function bodyStyle(shape, level) {
  return first(levelStyle(first(first(shape, 'txBody'), 'lstStyle'), level), 'defRPr');
}
function defaultRun(shape) {
  const p = first(first(shape, 'txBody'), 'p');
  return first(first(p, 'pPr'), 'defRPr');
}
function resolveValue(cascade, read) {
  for (const [node, origin] of cascade) {
    const value = read(node);
    if (value !== undefined && value !== '') return { value, origin };
  }
  return { value: null, origin: 'unresolved' };
}
function resolveThemeFont(face, theme, script, language) {
  if (!face?.startsWith('+')) return face;
  const m = /^\+(mj|mn)-(lt|ea|cs)$/.exec(face);
  if (!m || !theme) return null;
  const font = all(theme, m[1] === 'mj' ? 'majorFont' : 'minorFont')[0];
  const direct = A(first(font, m[2] === 'lt' ? 'latin' : m[2]), 'typeface', '');
  if (direct) return direct;
  const lang = String(language || '').toLowerCase();
  const tag = /^zh-(?:cn|sg|hans)/.test(lang) ? 'Hans' : /^zh-(?:tw|hk|mo|hant)/.test(lang) ? 'Hant' : lang.startsWith('ja') ? 'Jpan' : lang.startsWith('ko') ? 'Hang' : null;
  return script === 'ea' && tag ? A((font?.children || []).find(c => c.name === 'font' && A(c, 'script') === tag), 'typeface') || null : null;
}

/** Only bounded XML parts selected by inspectTemplate are accepted; no media is decoded. */
export function studyTemplateParts(parts, { parseXml, signal } = {}) {
  if (typeof parseXml !== 'function') throw new TypeError('studyTemplateParts requires the validated XML parser');
  const cache = new Map();
  const get = p => {
    if (!parts[p]) return null;
    if (!cache.has(p)) { abort(signal); cache.set(p, parseXml(parts[p], p)); }
    return cache.get(p);
  };
  const rels = p => relations(p, get(relPath(p)));
  const linked = (p, type) => [...rels(p).values()].find(r => r.type === type)?.target;
  const presentation = get('ppt/presentation.xml'), size = all(presentation, 'sldSz')[0];
  const width = number(A(size, 'cx')), height = number(A(size, 'cy'));
  const { slideParts, order } = templateSlideOrder(parts, presentation, get(relPath('ppt/presentation.xml')));
  const themeParts = Object.keys(parts).filter(p => /^ppt\/theme\/theme\d+\.xml$/.test(p));
  const fontExplicit = new Map(), fontEffective = new Map(), allSizes = new Map(), titleSizes = new Map(), bodySizes = new Map(), origins = new Map();
  const colors = new Map(), schemes = new Map(), titleBoxes = [], margins = [], rows = [], meta = [];
  const layoutParts = new Set(), masterParts = new Set();
  let textRuns = 0, unresolvedSizeRuns = 0, unresolvedFontRuns = 0, inheritedGeometry = 0, unresolvedGeometry = 0, modifiedColors = 0, hiddenCount = 0;
  let totalPictures = 0, totalCharts = 0, totalTables = 0, totalConnectors = 0, totalArrowedObjects = 0;
  const defaultText = all(presentation, 'defaultTextStyle')[0];
  for (let index = 0; index < slideParts.length; index++) {
    abort(signal);
    const part = slideParts[index], root = get(part), layoutPart = linked(part, 'slideLayout'), layout = get(layoutPart);
    const masterPart = layoutPart && linked(layoutPart, 'slideMaster'), master = get(masterPart);
    if (layout) layoutParts.add(layoutPart); if (master) masterParts.add(masterPart);
    const themePart = masterPart && linked(masterPart, 'theme');
    const theme = get(themePart || (themeParts.length === 1 ? themeParts[0] : null));
    if (['0', 'false'].includes(A(first(root, 'sld'), 'show'))) hiddenCount++;
    const obs = objects(root), textShapes = [];
    const pictures = obs.filter(o => o.node.name === 'pic').length;
    const charts = all(root, 'chart').length, tables = all(root, 'tbl').length;
    const connectors = obs.filter(o => o.node.name === 'cxnSp').length;
    const arrowedObjects = obs.filter(o => [...all(o.node, 'headEnd'), ...all(o.node, 'tailEnd')].some(end => A(end, 'type', 'none') !== 'none')).length;
    totalPictures += pictures; totalCharts += charts; totalTables += tables; totalConnectors += connectors; totalArrowedObjects += arrowedObjects;
    for (const c of all(root, 'srgbClr')) {
      const value = A(c, 'val', '').toUpperCase();
      if (/^[\dA-F]{6}$/.test(value)) add(colors, `#${value}`);
      if (c.children?.length) modifiedColors++;
    }
    for (const c of all(root, 'schemeClr')) { add(schemes, String(A(c, 'val', '')).slice(0, 32)); if (c.children?.length) modifiedColors++; }
    for (const object of obs) {
      const n = object.node, text = textOf(n);
      if (!chars(text)) continue;
      const ph = placeholder(n), layoutShape = matchingShape(layout, ph), masterShape = matchingShape(master, placeholder(layoutShape) || ph);
      let box = object.box;
      if (!box && !object.groupedGeometryUncertain && ph) {
        box = ownBox(layoutShape, { sx: 1, sy: 1, tx: 0, ty: 0 }) || ownBox(masterShape, { sx: 1, sy: 1, tx: 0, ty: 0 });
        if (box) inheritedGeometry++;
      }
      if (!box) unresolvedGeometry++;
      const type = A(ph, 'type', A(placeholder(layoutShape), 'type', 'body'));
      const masterStyle = first(all(master, 'txStyles')[0], ['title', 'ctrTitle'].includes(type) ? 'titleStyle' : ph ? 'bodyStyle' : 'otherStyle');
      const sizes = [];
      for (const p of all(n, 'p')) {
        const pp = first(p, 'pPr'), level = Math.max(0, Math.min(8, number(A(pp, 'lvl'))));
        const inherited = [[first(pp, 'defRPr'), 'paragraph'], [bodyStyle(n, level), 'shape-list'], [defaultRun(layoutShape), 'layout'], [bodyStyle(layoutShape, level), 'layout'], [defaultRun(masterShape), 'master'], [bodyStyle(masterShape, level), 'master'], [first(levelStyle(masterStyle, level), 'defRPr'), 'master-text-style'], [first(levelStyle(defaultText, level), 'defRPr'), 'presentation-default']];
        for (const run of (p.children || []).filter(c => ['r', 'fld'].includes(c.name))) {
          const runText = textOf(run); if (!chars(runText)) continue;
          textRuns++;
          const rp = first(run, 'rPr'), cascade = [[rp, 'explicit-run'], ...inherited];
          const resolvedSize = resolveValue(cascade, r => A(r, 'sz'));
          const pt = resolvedSize.value !== null && number(resolvedSize.value) > 0 ? number(resolvedSize.value) / 100 : null;
          if (pt) { sizes.push(pt); add(allSizes, pt); add(origins, resolvedSize.origin); } else unresolvedSizeRuns++;
          const script = /[\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff]/u.test(runText) ? 'ea' : 'latin';
          const faceOf = r => A(first(r, script), 'typeface') || A(first(r, 'latin'), 'typeface');
          const face = resolveValue(cascade, faceOf);
          const explicit = faceOf(rp); if (explicit) add(fontExplicit, String(explicit).slice(0, 64));
          const lang = resolveValue(cascade, r => A(r, 'lang')).value;
          const family = resolveThemeFont(face.value, theme, script, lang);
          if (family) add(fontEffective, String(family).slice(0, 64)); else unresolvedFontRuns++;
        }
      }
      textShapes.push({ box, text, count: chars(text), sizes, type, placeholder: Boolean(ph), maxSize: Math.max(0, ...sizes) });
    }
    const slideChars = chars(textOf(root));
    const maximum = Math.max(0, ...textShapes.map(s => s.maxSize));
    const title = textShapes.filter(s => ['title', 'ctrTitle'].includes(s.type) && s.placeholder).sort((a, b) => b.maxSize - a.maxSize)[0]
      || textShapes.filter(s => s.box && s.box.y <= height * .24 && s.count <= 220 && s.maxSize >= Math.max(20, maximum * .75)).sort((a, b) => b.maxSize - a.maxSize || a.box.y - b.box.y)[0]
      || (index === 0 ? textShapes.filter(s => s.maxSize === maximum && maximum >= 28).sort((a, b) => b.count - a.count)[0] : null);
    for (const s of textShapes) for (const sz of s.sizes) add(s === title ? titleSizes : bodySizes, sz);
    if (title?.box && width && height) titleBoxes.push([title.box.x / width, title.box.y / height, title.box.w / width, title.box.h / height]);
    const textBounds = textShapes.map(s => s.box).filter(Boolean);
    if (textBounds.length && width && height) margins.push([Math.min(...textBounds.map(b => b.x)) / width, Math.min(...textBounds.map(b => b.y)) / height, 1 - Math.max(...textBounds.map(b => b.x + b.w)) / width, 1 - Math.max(...textBounds.map(b => b.y + b.h)) / height]);
    rows.push([index + 1, slideChars, textShapes.length, pictures, charts, tables]);
    const normalized = textOf(root).replace(/[\s\d\p{P}]/gu, '').toLowerCase();
    meta.push({ page: index + 1, chars: slideChars, pictures, charts, tables, connectors, arrowedObjects, maximum, normalized, hasAgenda: /(?:contents?|agenda|目录|汇报提纲)/i.test(textOf(root)), closing: /(?:谢谢|感谢各位|批评指正|thank\s*you)/i.test(textOf(root)) && slideChars < 250 });
  }
  const repeated = new Map(); for (const m of meta) if (m.normalized.length >= 16) add(repeated, m.normalized);
  const cap = pages => pages.slice(0, 16);
  const coverCandidates = meta.filter(m => m.page === 1 && m.maximum >= 28 && !m.tables).map(m => m.page);
  const sectionCandidates = meta.filter(m => m.hasAgenda || (repeated.get(m.normalized) >= 2 && m.chars < 250 && !m.tables && !m.charts)).map(m => m.page);
  const evidenceCandidates = meta.filter(m => (m.pictures || m.charts) && !coverCandidates.includes(m.page) && !sectionCandidates.includes(m.page) && !m.closing && m.chars >= 60).map(m => m.page);
  const inheritedPictureParts = [...layoutParts, ...masterParts];
  const partPictureCount = inheritedPictureParts.reduce((sum, p) => sum + all(get(p), 'pic').length, 0);
  const columnRange = (values, i) => range(values.map(v => v[i]));
  const study = {
    format: 'academic-template-study', version: 1, basis: 'PPTX XML structural observations', visualReview: 'not-performed',
    slideSize: { emu: { width, height }, inches: { width: round(width / 914400), height: round(height / 914400) }, ratio: height ? round(width / height) : null },
    slides: { count: slideParts.length, order, hidden: hiddenCount, linkedLayouts: layoutParts.size, linkedMasters: masterParts.size },
    fonts: { explicitRunFamilies: histogram(fontExplicit, 'family'), resolvedRunFamilies: histogram(fontEffective, 'family'), embeddedFontRecords: all(presentation, 'embeddedFont').length, unresolvedRuns: unresolvedFontRuns, note: '字体名称来自实际文本样式；主题字体仅在关联和语言可解析时展开，不验证字体安装或字形覆盖。' },
    typography: { unit: 'pt', frequencyUnit: 'nonempty text runs', histogramLimit: 12, allSizes: histogram(allSizes, 'pt'), titleCandidateSizes: histogram(titleSizes, 'pt'), otherTextSizes: histogram(bodySizes, 'pt'), sizeOrigins: histogram(origins, 'origin'), measuredRuns: textRuns, unresolvedSizeRuns, titleRule: '标题占位符优先，否则取页上部较大短文本；首页可取最大字号。该分类需渲染核对。' },
    colors: { explicitRGB: histogram(colors, 'rgb'), schemeReferences: histogram(schemes, 'role', 8), colorNodesWithModifiers: modifiedColors, note: '显式 RGB 是基础值，未将透明度、渐变、颜色映射及 tint/shade 等变换合成为最终像素色。' },
    geometry: { unit: 'fraction of slide size', titleCandidateCount: titleBoxes.length, titleBox: { x: columnRange(titleBoxes, 0), y: columnRange(titleBoxes, 1), w: columnRange(titleBoxes, 2), h: columnRange(titleBoxes, 3) }, textEnvelopeMargins: { left: columnRange(margins, 0), top: columnRange(margins, 1), right: columnRange(margins, 2), bottom: columnRange(margins, 3) }, placeholderBoxesResolved: inheritedGeometry, unresolvedTextBoxes: unresolvedGeometry, note: '页边距来自可解析文本框包络，包含页脚，不代表推荐安全边距；负数仅表示结构边界越界候选。旋转/翻转组合未展开。' },
    pageRoleCandidates: { cover: cap(coverCandidates), section: cap(sectionCandidates), evidence: cap(evidenceCandidates), table: cap(meta.filter(m => m.tables).map(m => m.page)), diagram: cap(meta.filter(m => m.connectors >= 2 || m.arrowedObjects >= 2).map(m => m.page)), note: '页号顺序详见 slides.order；每类最多列16页。图片可能是装饰，连接线可能仅为分隔线，候选页型均需视觉确认。' },
    assets: { slidePictures: totalPictures, nativeCharts: totalCharts, nativeTables: totalTables, nativeConnectors: totalConnectors, nativeArrowedObjects: totalArrowedObjects, picturesInUniqueLinkedLayoutsAndMasters: partPictureCount, note: '连接对象与箭头对象可能重叠计数；母版/布局图片按唯一部件计数，不按显示次数；图片填充、SmartArt及栅格图中的图表不计为原生图表。' },
    textDensity: { unit: 'non-whitespace Unicode characters in slide XML text', distribution: range(rows.map(r => r[1])), perSlideColumns: ['page', 'characters', 'textObjects', 'pictures', 'nativeCharts', 'nativeTables'], perSlide: rows, note: '描述性计数，不作质量评分；不含图片中的文字、母版/布局继承文字及图表内部标签。' },
    reusable: ['画幅比例、标题位置和实际字号层级，须结合渲染核对', '显式配色、对齐、留白和重复章节定位方式', ...(totalPictures ? ['证据图与解释文字的空间比例、图注位置和读图顺序'] : []), ...(totalTables ? ['表格的表头、行列层级和重点标识方式'] : []), ...(totalConnectors || totalArrowedObjects ? ['原生流程节点与连接关系的组织方式'] : [])],
    doNotCopy: ['原页标题、正文、机构、人名、标志及署名', '项目名称、编号、日期、预算、成果和研究数字', '未经授权或不相关的图像、论文图表及证书', '占位内容、示例结论、原学科叙事和固定章节数量'],
    limitations: ['结构摘要不等于视觉审阅；必须渲染并逐页检查可读性、遮挡、裁切和内容正确性。', '仅展开可关联占位符的基本字号/字体与几何继承；复杂文本级联、主题样式、SmartArt、图像文字及装饰语义仍可能未知。', '未返回任何原页正文、对象名称、机构名称或研究数字；字符数与页号均为统计。'],
  };
  // Keep the tool-facing study bounded even for the supported 200-slide maximum.
  if (Buffer.byteLength(JSON.stringify(study)) > 9800) {
    study.textDensity.perSlide = rows.filter((_, i) => i < 20 || i >= rows.length - 5);
    study.textDensity.omittedRows = rows.length - study.textDensity.perSlide.length;
  }
  if (Buffer.byteLength(JSON.stringify(study)) > 9800) {
    study.fonts.explicitRunFamilies = study.fonts.explicitRunFamilies.slice(0, 6);
    study.fonts.resolvedRunFamilies = study.fonts.resolvedRunFamilies.slice(0, 6);
    study.textDensity.perSlide = rows.slice(0, 10);
    study.textDensity.omittedRows = rows.length - study.textDensity.perSlide.length;
  }
  return study;
}
