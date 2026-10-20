/** Shared editable geometry. Coordinates are CSS px on a 1280 × 720 slide.
 * No scientific value is inferred here: every visible result comes from the project.
 */
export const CANVAS = Object.freeze({ width: 1280, height: 720 });
export const LAYOUTS = Object.freeze(['cover', 'roadmap', 'paper', 'figure-focus', 'figure-split', 'comparison', 'method', 'results', 'synthesis', 'proposal', 'closing', 'references']);
export const CARD_STYLES = Object.freeze(['open-frame', 'floating-tab', 'split-label', 'paper-shadow', 'title-band', 'stacked-corner', 'ledger', 'dashed-note']);
export const DEFAULT_DESIGN = Object.freeze({
  fontFamily: 'Noto Sans CJK SC',
  palette: { background: '#F5F3EF', paper: '#FFFFFF', ink: '#243648', muted: '#607080', accent: '#315B70', secondary: '#527F7E', gold: '#B38D56', line: '#CFD7DA', tint: '#E6EDEA' },
});
const KIND_STYLE = { question: 'open-frame', method: 'floating-tab', setting: 'split-label', result: 'ledger', boundary: 'dashed-note', hypothesis: 'stacked-corner' };
const clone = value => JSON.parse(JSON.stringify(value));
const safeColor = (value, fallback) => /^#[a-f\d]{6}$/i.test(String(value)) ? value : fallback;
const asText = value => value === undefined || value === null ? '' : typeof value === 'string' ? value : String(value);
const arr = value => Array.isArray(value) ? value : [];

export function resolveDesign(input = {}) {
  const palette = Object.fromEntries(Object.entries(DEFAULT_DESIGN.palette).map(([key, value]) => [key, safeColor(input.palette?.[key] || (key === 'tint' ? input.palette?.soft : undefined), value)]));
  return { ...DEFAULT_DESIGN, ...input, palette, fontFamily: asText(input.fontFamily).trim() || DEFAULT_DESIGN.fontFamily };
}

/** Predictable wrapping is shared by SVG and PPTX. It is an estimate, not a font renderer. */
export function wrapText(value, width, size) {
  const limit = Math.max(1, width / Math.max(size, 1));
  const lines = [];
  for (const paragraph of asText(value).replace(/\r\n?/g, '\n').split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    let line = '', weight = 0;
    const tokens = paragraph.match(/[A-Za-z0-9]+(?:[.'’:/+%−–-][A-Za-z0-9]+)*|\s+|[^A-Za-z0-9\s]/gu) || [];
    const units = token => [...token].reduce((sum, ch) => sum + (/\s/u.test(ch) ? .3 : /[\u0000-\u024f]/u.test(ch) ? .53 : 1), 0);
    for (const token of tokens) {
      const tw = units(token);
      if (line && weight + tw > limit) { lines.push(line.trimEnd()); line = ''; weight = 0; }
      if (tw > limit) {
        for (const ch of token) {
          const cw = units(ch);
          if (line && weight + cw > limit) { lines.push(line.trimEnd()); line = ''; weight = 0; }
          line += ch; weight += cw;
        }
      } else if (line || token.trim()) { line += token; weight += tw; }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function pageBuilder(slide, index, total, design) {
  const p = design.palette;
  const page = { id: slide.id || `slide-${index + 1}`, title: asText(slide.title), layout: slide.layout, notes: asText(slide.notes), seconds: slide.seconds || 0, width: CANVAS.width, height: CANVAS.height, background: p.background, nodes: [], issues: [] };
  const add = (kind, key, props, cardId) => {
    const node = { ...props, kind, id: `${page.id}/${key}`, ...(cardId ? { cardId } : {}) };
    page.nodes.push(node); return node;
  };
  const rect = (key, box, fill = p.paper, stroke = p.line, more = {}, cardId) => add('rect', key, { ...box, fill, stroke, strokeWidth: 1, ...more }, cardId);
  const line = (key, x1, y1, x2, y2, color = p.line, more = {}, cardId) => add('line', key, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, stroke: color, strokeWidth: 1.4, ...more }, cardId);
  const text = (key, value, box, size = 24, more = {}, cardId) => {
    const content = asText(value), fontSize = size;
    if (!content) return null;
    const lines = wrapText(content, box.w, fontSize);
    const lineHeight = more.lineHeight || 1.28;
    const needed = lines.length * fontSize * lineHeight;
    if (needed > box.h + 2) page.issues.push({ severity: 'warning', code: 'text-overflow-estimate', slideId: page.id, objectId: `${page.id}/${key}`, message: `文字估计需要 ${Math.ceil(needed)} px，分配 ${box.h} px；请查看最终渲染。` });
    return add('text', key, { ...box, text: content, lines, fontSize, fontFamily: design.fontFamily, color: p.ink, lineHeight, ...more }, cardId);
  };
  rect('top-rule', { x: 0, y: 0, w: 1280, h: 7 }, p.accent, 'none');
  text('footer-label', asText(design.footer || '学术研究汇报'), { x: 52, y: 683, w: 1040, h: 20 }, 13, { color: p.muted, role: 'footer', lineHeight: 1.1 });
  text('page-number', `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, { x: 1124, y: 680, w: 104, h: 24 }, 15, { color: p.muted, align: 'right', role: 'footer' });
  return { page, p, add, rect, line, text };
}

function header(b, slide) {
  b.text('kicker', slide.kicker || (slide.paperIds?.length ? slide.paperIds.join(' · ') : 'RESEARCH SEMINAR'), { x: 52, y: 30, w: 1140, h: 25 }, 15, { color: b.p.secondary, bold: true, role: 'kicker', lineHeight: 1.1 });
  b.text('title', slide.title, { x: 52, y: 65, w: 1176, h: 101 }, 37, { bold: true, lineHeight: 1.2, role: 'title' });
  b.line('header-rule', 52, 164, 1228, 164, b.p.line);
}

function metricString(metric) {
  if (typeof metric === 'string') return metric;
  if (!metric || typeof metric !== 'object') return '';
  return [metric.value, metric.unit].filter(v => v !== undefined && v !== '').join(' ');
}

/** Draw a native card; text and frame remain independent editable objects. */
function card(b, data, box, index, project) {
  const c = data || {}, id = asText(c.id || `card-${index + 1}`);
  const key = `card/${id}`, p = b.p, style = c.style || KIND_STYLE[c.kind] || CARD_STYLES[index % CARD_STYLES.length];
  const accent = safeColor(c.accent, c.kind === 'boundary' ? p.gold : c.kind === 'hypothesis' ? p.secondary : p.accent);
  const R = (name, r, fill, stroke, more) => b.rect(`${key}/${name}`, r, fill, stroke, more, id);
  const L = (name, x1, y1, x2, y2, color, more) => b.line(`${key}/${name}`, x1, y1, x2, y2, color, more, id);
  const T = (name, value, r, size, more) => b.text(`${key}/${name}`, value, r, size, more, id);
  let { x, y, w, h } = box;
  let tx = x + 20, ty = y + 17, tw = w - 40, th = 38, by = y + 65, bw = tw, bx = tx;
  const componentId = c.templateComponentId;
  const component = componentId && project.design?.templateProfile?.components?.find(q => q.id === componentId);
  if (component) {
    for (const [n, source] of component.nodes.entries()) {
      const node = clone(source);
      const scaleX = w / component.width, scaleY = h / component.height;
      Object.assign(node, { x: x + node.x * scaleX, y: y + node.y * scaleY, w: node.w * scaleX, h: node.h * scaleY });
      b.add(node.kind, `${key}/template/${n}`, { ...node, sourceShapeId: source.sourceShapeId, sourceSlide: component.sourceSlide }, id);
    }
    // User-supplied text zones are optional; defaults avoid copying old template words.
    const zones = component.textZones;
    if (zones?.title) { tx = x + zones.title.x * w; ty = y + zones.title.y * h; tw = zones.title.w * w; th = zones.title.h * h; }
    if (zones?.body) { bx = x + zones.body.x * w; by = y + zones.body.y * h; bw = zones.body.w * w; }
  } else if (style === 'open-frame') {
    R('frame', { x, y: y + 17, w, h: h - 17 }, p.paper, accent, { strokeWidth: 1.5 });
    const labelW = Math.min(w - 36, Math.max(112, wrapText(c.title, w - 72, 25)[0]?.length * 23 + 22));
    R('title-cutout', { x: x + 14, y: y + 1, w: labelW, h: 34 }, p.background, 'none');
    ty = y + 2; by = y + 58;
    L('base-rule', x + 20, y + h - 16, x + 55, y + h - 16, accent, { strokeWidth: 3 });
  } else if (style === 'floating-tab') {
    R('shadow', { x: x + 4, y: y + 23, w: w - 4, h: h - 23 }, '#DEE5E4', 'none');
    R('frame', { x, y: y + 19, w: w - 4, h: h - 23 }, p.paper, p.line);
    R('tab', { x: x + 16, y, w: Math.min(w - 42, Math.max(138, asText(c.title).length * 24 + 30)), h: 42 }, accent, 'none');
    tx = x + 28; ty = y + 6; tw = w - 54; by = y + 68;
  } else if (style === 'split-label') {
    const labelW = Math.min(132, w * .29);
    R('frame', box, p.paper, p.line);
    R('label', { x, y, w: labelW, h }, p.tint, 'none');
    L('split', x + labelW, y + 18, x + labelW, y + h - 18, accent);
    tx = x + 15; ty = y + 20; tw = labelW - 30; th = h - 42;
    bx = x + labelW + 18; by = y + 19; bw = w - labelW - 35;
  } else if (style === 'paper-shadow') {
    R('shadow', { x: x + 4, y: y + 4, w: w - 4, h: h - 4 }, '#D9E0E0', 'none');
    R('frame', { x, y, w: w - 4, h: h - 4 }, p.paper, p.line);
    L('top-accent', x + 20, y + 12, x + 62, y + 12, accent, { strokeWidth: 3 });
    ty = y + 21; by = y + 70;
  } else if (style === 'title-band') {
    R('frame', box, p.paper, p.line);
    R('band', { x, y, w, h: 50 }, accent, 'none');
    ty = y + 10; by = y + 67;
  } else if (style === 'stacked-corner') {
    R('rear', { x: x + 8, y: y + 8, w: w - 8, h: h - 8 }, p.background, accent);
    R('middle', { x: x + 4, y: y + 4, w: w - 8, h: h - 8 }, p.tint, accent);
    R('frame', { x, y, w: w - 8, h: h - 8 }, p.paper, accent);
    L('title-rule', x + 20, y + 56, x + w - 28, y + 56, p.line);
    tw -= 8; bw -= 8; by = y + 73;
  } else if (style === 'dashed-note') {
    R('frame', box, p.paper, accent, { dash: 'dash', strokeWidth: 1.5 });
    R('corner-white', { x: x + w - 28, y, w: 28, h: 28 }, p.background, 'none');
    L('fold-diagonal', x + w - 28, y, x + w, y + 28, accent);
    L('fold-left', x + w - 28, y, x + w - 28, y + 28, accent);
    L('fold-bottom', x + w - 28, y + 28, x + w, y + 28, accent);
    tw -= 20;
  } else {
    R('frame', box, p.paper, p.line);
    R('ledger-accent', { x, y, w: 6, h }, accent, 'none');
    L('ledger-rule', x + 20, y + 57, x + w - 20, y + 57, p.line);
    by = y + 72;
  }
  const darkTitle = !component && ['floating-tab', 'title-band'].includes(style);
  T('title', c.title, { x: tx, y: ty, w: tw, h: th }, 24, { bold: true, color: darkTitle ? '#FFFFFF' : accent, lineHeight: 1.2, role: 'card-title' });
  const metric = metricString(c.metric);
  if (metric) {
    T('metric', metric, { x: bx, y: by, w: bw, h: 59 }, 39, { bold: true, color: accent, lineHeight: 1.1, role: 'metric' });
    by += 64;
    if (c.metric?.label) { T('metric-label', c.metric.label, { x: bx, y: by, w: bw, h: 27 }, 17, { color: p.muted, role: 'metric-label' }); by += 31; }
    if (c.metric?.context) { const mh = wrapText(c.metric.context, bw, 16).length * 20; T('metric-context', c.metric.context, { x: bx, y: by, w: bw, h: mh }, 16, { color: p.muted, role: 'metric-context', lineHeight: 1.2 }); by += mh + 7; }
  }
  const body = Array.isArray(c.body) ? c.body.join('\n') : c.body;
  T('body', body, { x: bx, y: by, w: bw, h: Math.max(14, y + h - 20 - by) }, 22, { lineHeight: 1.32, role: 'body' });
  return { id, box, style };
}

function cardsGrid(b, cards, box, columns, project, gap = 22) {
  const rows = Math.ceil(cards.length / columns);
  const w = (box.w - gap * (columns - 1)) / columns;
  const h = (box.h - gap * (rows - 1)) / rows;
  cards.forEach((c, i) => card(b, c, c.box || { x: box.x + (i % columns) * (w + gap), y: box.y + Math.floor(i / columns) * (h + gap), w, h }, i, project));
}

function figure(b, project, id, box, key) {
  const asset = arr(project.assets).find(a => a.id === id) || project.assets?.[id];
  b.rect(`${key}:paper`, box, '#FFFFFF', b.p.line);
  if (!asset) {
    b.text(`${key}:missing`, '未提供原图', { x: box.x + 20, y: box.y + box.h / 2 - 20, w: box.w - 40, h: 45 }, 24, { color: b.p.muted, align: 'center' });
    b.page.issues.push({ severity: 'error', code: 'missing-figure', slideId: b.page.id, assetId: id, message: '页面引用了不存在的原图。' });
    return;
  }
  const caption = [asset.paperId, asset.figure || asset.figureNumber, asset.panel, asset.caption].filter(Boolean).join(' · ');
  const captionLines = wrapText(caption, box.w - 30, 14);
  const captionH = caption ? Math.min(72, Math.max(32, captionLines.length * 18 + 8)) : 0;
  const frame = { x: box.x + 13, y: box.y + 13, w: box.w - 26, h: box.h - 26 - captionH };
  const iw = Number(asset.width || asset.pixelWidth || 1), ih = Number(asset.height || asset.pixelHeight || 1);
  const scale = Math.min(frame.w / iw, frame.h / ih);
  const imageBox = { x: frame.x + (frame.w - iw * scale) / 2, y: frame.y + (frame.h - ih * scale) / 2, w: iw * scale, h: ih * scale };
  b.add('image', `${key}:image`, { ...imageBox, assetId: id, data: asset.data || asset.dataUri, alt: asset.alt || caption || '论文原图', source: { paperId: asset.paperId, figure: asset.figure, panel: asset.panel, sourceVersion: asset.sourceVersion }, fit: 'contain' });
  if (caption) b.text(`${key}:caption`, caption, { x: box.x + 15, y: box.y + box.h - captionH - 8, w: box.w - 30, h: captionH }, 14, { color: b.p.muted, role: 'caption', lineHeight: 1.23 });
}

/** Select the two-panel arrangement that gives both source images the most visible area. */
function pairedFigureBoxes(project, ids, area, gap = 18) {
  const horizontal = [0, 1].map(i => ({ x: area.x + i * (area.w + gap) / 2, y: area.y, w: (area.w - gap) / 2, h: area.h }));
  const vertical = [0, 1].map(i => ({ x: area.x, y: area.y + i * (area.h + gap) / 2, w: area.w, h: (area.h - gap) / 2 }));
  const visibleArea = boxes => boxes.reduce((sum, box, i) => {
    const asset = arr(project.assets).find(a => a.id === ids[i]) || project.assets?.[ids[i]];
    const iw = Number(asset?.width || 1), ih = Number(asset?.height || 1), caption = [asset?.paperId, asset?.figure, asset?.panel, asset?.caption].filter(Boolean).join(' · ');
    const captionH = caption ? Math.min(72, Math.max(32, wrapText(caption, box.w - 30, 14).length * 18 + 8)) : 0;
    const scale = Math.min(Math.max(1, box.w - 26) / iw, Math.max(1, box.h - 26 - captionH) / ih);
    return sum + iw * ih * scale * scale;
  }, 0);
  return visibleArea(horizontal) >= visibleArea(vertical) ? horizontal : vertical;
}

function paperTitle(b, project, slide, box) {
  const papers = arr(project.papers).filter(p => arr(slide.paperIds).includes(p.id));
  if (!papers.length) return;
  const paper = papers[0];
  b.text('paper-title', paper.title, box, 23, { bold: true, role: 'paper-title', lineHeight: 1.2 });
  b.text('paper-bibliography', [arr(paper.authors).join(', '), paper.journal, paper.year, paper.doi ? `DOI: ${paper.doi}` : ''].filter(Boolean).join(' · '), { x: box.x, y: box.y + box.h + 5, w: box.w, h: 47 }, 14, { color: b.p.muted, role: 'citation', lineHeight: 1.18 });
}

function footerSources(b, project, slide) {
  if (slide.layout === 'references') return;
  const ids = new Set(arr(slide.paperIds));
  for (const claim of arr(project.claims)) if (arr(slide.claimIds).includes(claim.id) && claim.paperId) ids.add(claim.paperId);
  const sources = arr(project.papers).filter(p => ids.has(p.id)).map(p => [p.id, p.year, p.doi || p.url].filter(Boolean).join(' · '));
  if (sources.length) b.text('sources', sources.join('  |  '), { x: 52, y: 645, w: 1176, h: 30 }, 12, { color: b.p.muted, role: 'citation', lineHeight: 1.14 });
}

function method(b, project, slide, cards) {
  const nodes = arr(slide.nodes), edges = arr(slide.edges);
  const count = nodes.length;
  const columns = Math.min(count, 4), rows = Math.ceil(count / Math.max(columns, 1));
  const area = { x: 68, y: 204, w: 1144, h: cards.length ? 254 : 392 };
  const gap = 55, rowGap = 52;
  const w = (area.w - (columns - 1) * gap) / Math.max(columns, 1), h = (area.h - (rows - 1) * rowGap) / Math.max(rows, 1);
  const boxes = new Map(nodes.map((n, i) => [n.id, n.box || { x: area.x + (i % columns) * (w + gap), y: area.y + Math.floor(i / columns) * (h + rowGap), w, h }]));
  for (const [i, edge] of edges.entries()) {
    const a = boxes.get(edge.from), z = boxes.get(edge.to);
    if (!a || !z) { b.page.issues.push({ severity: 'error', code: 'invalid-edge', slideId: b.page.id, message: '流程连线引用了不存在的节点。' }); continue; }
    const sameRow = Math.abs(a.y - z.y) < 5;
    if (sameRow && z.x < a.x) {
      const top = Math.min(a.y, z.y) - 24;
      b.line(`edge:${i}:exit`, a.x + a.w / 2, a.y, a.x + a.w / 2, top, b.p.secondary, { strokeWidth: 2 });
      b.line(`edge:${i}:return`, a.x + a.w / 2, top, z.x + z.w / 2, top, b.p.secondary, { strokeWidth: 2 });
      b.line(`edge:${i}:entry`, z.x + z.w / 2, top, z.x + z.w / 2, z.y, b.p.secondary, { strokeWidth: 2, endArrow: true });
      if (edge.label) b.text(`edge:${i}:label`, edge.label, { x: (a.x + a.w / 2 + z.x + z.w / 2) / 2 - 95, y: top + 3, w: 190, h: 21 }, 14, { align: 'center', color: b.p.muted, role: 'diagram-label', lineHeight: 1.1 });
      continue;
    }
    const start = sameRow ? { x: a.x + a.w, y: a.y + a.h / 2 } : { x: a.x + a.w / 2, y: a.y + a.h };
    const end = sameRow ? { x: z.x, y: z.y + z.h / 2 } : { x: z.x + z.w / 2, y: z.y };
    b.line(`edge:${i}`, start.x, start.y, end.x, end.y, b.p.secondary, { strokeWidth: 2, endArrow: true });
    if (edge.label) b.text(`edge:${i}:label`, edge.label, { x: (start.x + end.x) / 2 - 68, y: (start.y + end.y) / 2 - 39, w: 136, h: 34 }, 14, { align: 'center', color: b.p.muted, role: 'diagram-label' });
  }
  for (const [i, n] of nodes.entries()) {
    const box = boxes.get(n.id);
    b.rect(`node:${n.id}:frame`, box, i === 0 ? b.p.tint : b.p.paper, i === 0 ? b.p.secondary : b.p.line, { strokeWidth: 1.5 });
    b.text(`node:${n.id}:label`, n.label, { x: box.x + 18, y: box.y + 15, w: box.w - 36, h: Math.max(33, box.h * .42) }, rows > 1 ? 22 : 27, { bold: true, align: 'center', lineHeight: 1.18, role: 'diagram-label' });
    b.text(`node:${n.id}:detail`, n.detail, { x: box.x + 18, y: box.y + box.h * .54, w: box.w - 36, h: Math.max(20, box.h * .4 - 10) }, rows > 1 ? 16 : 19, { color: b.p.muted, align: 'center', lineHeight: 1.22, role: 'diagram-body' });
  }
  if (cards.length) cardsGrid(b, cards, { x: 52, y: 489, w: 1176, h: 136 }, Math.min(cards.length, 3), project);
}

export function buildScenes(project) {
  const design = resolveDesign(project.design), slides = arr(project.slides);
  const pages = slides.map((slide, index) => {
    const b = pageBuilder(slide, index, slides.length, design), cards = arr(slide.cards), figures = arr(slide.figureIds);
    if (slide.layout === 'cover') {
      b.rect('cover-sidebar', { x: 923, y: 7, w: 357, h: 656 }, b.p.accent, 'none');
      b.rect('cover-sidebar-inset', { x: 949, y: 44, w: 282, h: 570 }, 'none', '#7893A0', { strokeWidth: 1.2 });
      b.text('kicker', slide.kicker || 'ACADEMIC RESEARCH', { x: 58, y: 75, w: 797, h: 30 }, 18, { color: b.p.secondary, bold: true, role: 'kicker' });
      b.text('title', slide.title, { x: 58, y: 167, w: 803, h: 242 }, 56, { bold: true, lineHeight: 1.2, role: 'title' });
      b.line('cover-rule', 62, 449, 199, 449, b.p.gold, { strokeWidth: 5 });
      b.text('subtitle', slide.subtitle || project.brief?.centralQuestion, { x: 62, y: 483, w: 768, h: 104 }, 25, { color: b.p.muted, role: 'subtitle' });
      b.text('cover-side-title', '问题\n证据\n研究切口', { x: 980, y: 145, w: 220, h: 260 }, 39, { color: '#FFFFFF', lineHeight: 1.72, role: 'cover-index' });
      b.text('cover-duration', project.brief?.talkMinutes ? `${project.brief.talkMinutes} MIN` : '', { x: 980, y: 534, w: 200, h: 42 }, 25, { color: '#D9E4E7', role: 'cover-duration' });
    } else {
      header(b, slide);
      if (slide.layout === 'paper') {
        paperTitle(b, project, slide, { x: 52, y: 190, w: 1176, h: 89 });
        if (figures.length) {
          figure(b, project, figures[0], { x: 52, y: 346, w: 699, h: 279 }, 'figure:0');
          cardsGrid(b, cards, { x: 778, y: 346, w: 450, h: 279 }, 1, project, 17);
        } else cardsGrid(b, cards, { x: 52, y: 345, w: 1176, h: 279 }, Math.min(Math.max(cards.length, 1), 3), project);
      } else if (slide.layout === 'figure-focus') {
        const mainAsset = arr(project.assets).find(a => a.id === figures[0]);
        const portrait = cards.length && mainAsset && mainAsset.width / mainAsset.height < .9;
        const figureBox = { x: 52, y: 188, w: cards.length ? portrait ? 405 : 842 : 1176, h: 439 };
        if (figures[0]) figure(b, project, figures[0], figureBox, 'figure:0');
        if (cards.length) cardsGrid(b, cards, portrait ? { x: 491, y: 188, w: 737, h: 439 } : { x: 920, y: 188, w: 308, h: 439 }, 1, project, 20);
      } else if (['figure-split', 'results'].includes(slide.layout)) {
        if (figures.length >= 2) {
          const boxes = pairedFigureBoxes(project, figures, { x: 52, y: 190, w: 755, h: 435 });
          figures.slice(0, 2).forEach((id, i) => figure(b, project, id, boxes[i], `figure:${i}`));
        } else if (figures[0]) figure(b, project, figures[0], { x: 52, y: 190, w: 755, h: 435 }, 'figure:0');
        else if (slide.chart) b.add('chart', 'data-chart', { x: 52, y: 190, w: 755, h: 435, chart: clone(slide.chart), palette: clone(b.p), fontFamily: design.fontFamily });
        if (cards.length) cardsGrid(b, cards, { x: 834, y: 190, w: 394, h: 435 }, 1, project, 20);
      } else if (slide.layout === 'comparison') {
        if (figures.length >= 2) {
          figure(b, project, figures[0], { x: 52, y: 190, w: 576, h: cards.length ? 266 : 435 }, 'figure:0');
          figure(b, project, figures[1], { x: 652, y: 190, w: 576, h: cards.length ? 266 : 435 }, 'figure:1');
          if (cards.length) cardsGrid(b, cards, { x: 52, y: 480, w: 1176, h: 145 }, Math.min(cards.length, 2), project);
        } else cardsGrid(b, cards, { x: 52, y: 195, w: 1176, h: 428 }, Math.min(Math.max(cards.length, 1), 2), project, 26);
      } else if (slide.layout === 'method') method(b, project, slide, cards);
      else if (slide.layout === 'roadmap') {
        const gap = 24, count = Math.max(cards.length, 1), h = (428 - gap * (count - 1)) / count;
        cards.forEach((c, i) => {
          const y = 195 + i * (h + gap);
          b.text(`roadmap:${i}:number`, String(i + 1).padStart(2, '0'), { x: 55, y: y + 10, w: 94, h: h - 14 }, 44, { color: b.p.secondary, bold: true, role: 'index' });
          card(b, c, c.box || { x: 175, y, w: 1053, h }, i, project);
        });
      } else if (slide.layout === 'references') {
        const selected = arr(project.papers).filter(p => !slide.paperIds?.length || slide.paperIds.includes(p.id));
        const rowH = 438 / Math.max(selected.length, 1);
        selected.forEach((p, i) => {
          const y = 187 + i * rowH;
          b.text(`ref:${p.id}:id`, p.id || `[${i + 1}]`, { x: 52, y: y + 3, w: 73, h: 42 }, 21, { color: b.p.secondary, bold: true, role: 'reference-index' });
          const single = selected.length === 1;
          b.text(`ref:${p.id}:title`, p.title, { x: 138, y, w: 1090, h: single ? 80 : Math.max(32, rowH - 33) }, single ? 28 : 19, { bold: true, lineHeight: 1.2, role: 'reference-title' });
          b.text(`ref:${p.id}:meta`, [arr(p.authors).join(', '), p.journal, p.year, p.doi ? `DOI: ${p.doi}` : p.url, p.version].filter(Boolean).join(' · '), { x: 138, y: y + (single ? 99 : Math.max(34, rowH - 37)), w: 1090, h: single ? 77 : 34 }, single ? 18 : 12, { color: b.p.muted, lineHeight: 1.28, role: 'citation' });
          if (single) {
            b.line(`ref:${p.id}:detail-rule`, 138, 388, 1228, 388, b.p.line);
            b.text(`ref:${p.id}:url`, p.url, { x: 138, y: 408, w: 1090, h: 40 }, 19, { color: b.p.accent, role: 'source-url' });
            if (p.reading?.sections?.length) b.text(`ref:${p.id}:reading`, '全文阅读：' + p.reading.sections.join(' · '), { x: 138, y: 465, w: 1090, h: 61 }, 20, { color: b.p.muted, lineHeight: 1.3, role: 'reading-scope' });
            const usedFigureIds = new Set(arr(project.slides).flatMap(s => arr(s.figureIds)));
            const assets = arr(project.assets).filter(a => a.paperId === p.id && usedFigureIds.has(a.id));
            if (assets.length) b.text(`ref:${p.id}:assets`, '原图授权：' + assets.map(a => [a.figure, a.license].filter(Boolean).join(' · ')).join('；'), { x: 138, y: 554, w: 1090, h: 67 }, 18, { color: b.p.muted, lineHeight: 1.3, role: 'asset-license' });
          }
          if (i < selected.length - 1) b.line(`ref:${p.id}:line`, 138, y + rowH - 5, 1228, y + rowH - 5, b.p.line);
        });
      } else if (slide.layout === 'closing') {
        b.text('closing-takeaway', slide.takeaway || slide.subtitle, { x: 75, y: 222, w: 1110, h: 170 }, 42, { bold: true, lineHeight: 1.35, role: 'takeaway' });
        b.line('closing-rule', 79, 405, 235, 405, b.p.gold, { strokeWidth: 4 });
        if (cards.length) cardsGrid(b, cards, { x: 52, y: 455, w: 1176, h: 169 }, Math.min(cards.length, 3), project);
      } else {
        const takeaway = slide.takeaway || slide.subtitle;
        if (takeaway) {
          b.rect('takeaway-band', { x: 52, y: 188, w: 1176, h: 86 }, b.p.tint, 'none');
          b.text('takeaway', takeaway, { x: 76, y: 203, w: 1128, h: 59 }, 25, { bold: true, color: b.p.accent, lineHeight: 1.18, role: 'takeaway' });
        }
        const y = takeaway ? 301 : 194;
        cardsGrid(b, cards, { x: 52, y, w: 1176, h: 625 - y }, Math.min(Math.max(cards.length, 1), slide.layout === 'proposal' ? 2 : 3), project, 24);
      }
      footerSources(b, project, slide);
    }
    const notePapers = arr(project.papers).filter(p => arr(slide.paperIds).includes(p.id));
    if (notePapers.length) b.page.notes += '\n\n参考文献（完整题名）\n' + notePapers.map(p => [p.id, p.title, p.journal, p.year, p.doi, p.version].filter(Boolean).join(' · ')).join('\n');
    // Explicit coverage guards: an unsupported combination must not quietly lose authored evidence.
    const imageCounts = new Map();
    for (const n of b.page.nodes.filter(n => n.kind === 'image')) imageCounts.set(n.assetId, (imageCounts.get(n.assetId) || 0) + 1);
    for (const assetId of figures) {
      if (imageCounts.get(assetId)) imageCounts.set(assetId, imageCounts.get(assetId) - 1);
      else b.page.issues.push({ severity: 'error', code: 'unrendered-figure', slideId: b.page.id, assetId, message: `页型 ${slide.layout} 未显示输入原图 ${assetId}；调整页型或拆页。` });
    }
    for (const c of cards) if (!b.page.nodes.some(n => n.cardId === c.id)) b.page.issues.push({ severity: 'error', code: 'unrendered-card', slideId: b.page.id, cardId: c.id, message: `页型 ${slide.layout} 未显示输入卡片 ${c.id}；调整页型。` });
    if (slide.chart && !b.page.nodes.some(n => n.kind === 'chart')) b.page.issues.push({ severity: 'error', code: 'unrendered-chart', slideId: b.page.id, message: '输入图表未显示；使用没有原图的 results 或 figure-split 页，或将图表单独成页。' });
    for (const n of arr(slide.nodes)) if (!b.page.nodes.some(shape => shape.id === `${b.page.id}/node:${n.id}:frame`)) b.page.issues.push({ severity: 'error', code: 'unrendered-diagram-node', slideId: b.page.id, nodeId: n.id, message: '输入流程节点未显示；使用 method 页。' });
    arr(slide.edges).forEach((edge, i) => { if (!b.page.nodes.some(shape => shape.id === `${b.page.id}/edge:${i}` || shape.id.startsWith(`${b.page.id}/edge:${i}:`))) b.page.issues.push({ severity: 'error', code: 'unrendered-diagram-edge', slideId: b.page.id, edge, message: '输入流程连线未显示；使用 method 页并检查节点。' }); });
    for (const field of ['subtitle', 'takeaway']) if (asText(slide[field]).trim() && !b.page.nodes.some(n => n.kind === 'text' && n.text === slide[field])) b.page.issues.push({ severity: 'warning', code: `unrendered-${field}`, slideId: b.page.id, message: `${field} 在当前页型没有可见区域。将必要内容写入卡片，或使用支持该字段的页型；其内容没有自动加入正文。` });
    for (const node of b.page.nodes) {
      if (![node.x, node.y, node.w, node.h].every(Number.isFinite)) b.page.issues.push({ severity: 'error', code: 'invalid-geometry', slideId: b.page.id, objectId: node.id, message: '对象坐标必须是有限数值。' });
      if (node.kind !== 'line' && (node.w <= 0 || node.h <= 0 || node.x < -1 || node.y < -1 || node.x + node.w > 1281 || node.y + node.h > 721)) b.page.issues.push({ severity: 'error', code: 'out-of-bounds', slideId: b.page.id, objectId: node.id, message: '对象尺寸无效或超出页面。' });
    }
    return b.page;
  });
  return { ...CANVAS, design, pages, issues: pages.flatMap(p => p.issues) };
}
