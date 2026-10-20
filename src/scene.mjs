/** Shared editable geometry. Coordinates are CSS px on a 1280 × 720 slide.
 * No scientific value is inferred here: every visible result comes from the project.
 */
import { getReferenceTemplate } from './reference-catalog.mjs';
export const CANVAS = Object.freeze({ width: 1280, height: 720 });
export const LAYOUTS = Object.freeze(['cover', 'roadmap', 'paper', 'figure-focus', 'figure-split', 'comparison', 'method', 'results', 'synthesis', 'proposal', 'closing', 'references']);
export const CARD_STYLES = Object.freeze(['plain', 'ruled', 'compact', 'academic-panel', 'academic-tab', 'academic-side', 'open-frame', 'floating-tab', 'split-label', 'paper-shadow', 'title-band', 'stacked-corner', 'ledger', 'dashed-note']);
export const DEFAULT_DESIGN = Object.freeze({
  fontFamily: 'Noto Sans CJK SC',
  palette: { background: '#FFFFFF', paper: '#FFFFFF', ink: '#171C22', muted: '#4F5D6A', accent: '#183B66', secondary: '#455C76', gold: '#9D3038', line: '#C5CFDA', tint: '#EEF2F6' },
});
const KIND_STYLE = { question: 'plain', method: 'academic-panel', setting: 'academic-side', result: 'ruled', boundary: 'academic-tab', hypothesis: 'ruled' };
const CONTENT = Object.freeze({ x:48, y:132, w:1184, h:513 });
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
  const closing=/^[，。！？；：、）》〉」』】〕）］｝’”….,!?;:\])}%％]+$/u;
  const opening=/^[（(［\[｛{《〈「『【〔‘“]+$/u;
  const units=token=>[...token].reduce((sum,ch)=>sum+(/\s/u.test(ch)?.3:/[\u0000-\u024f]/u.test(ch)?.53:1),0);
  // Punctuation travels with the preceding lexical unit, and an opening
  // bracket travels with the next one. No character is deleted or replaced.
  // Long words are split only when that word cannot fit even on an empty line.
  const gluePunctuation=tokens=>{
    const out=[];let prefix='';
    for(const token of tokens){
      if(opening.test(token)){prefix+=token;continue;}
      const chunk=prefix+token;prefix='';
      if(closing.test(token)&&out.length){
        let from=out.length-1;while(from>0&&/^\s+$/u.test(out[from]))from--;
        out.push(out.splice(from).join('')+chunk);
      }else out.push(chunk);
    }
    if(prefix)out.push(prefix);
    return out;
  };
  for (const paragraph of asText(value).replace(/\r\n?/g, '\n').split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    let line = '', weight = 0;
    const tokens=gluePunctuation(paragraph.match(/[A-Za-z0-9]+(?:[.'’:/+%−–-][A-Za-z0-9]+)*|\s+|[^A-Za-z0-9\s]/gu)||[]);
    const fitted=tokens.flatMap(token=>units(token)<=limit? [token]:gluePunctuation([...token]).flatMap(part=>units(part)<=limit?[part]:[...part]));
    for(const token of fitted){
      const tw=units(token);
      if(line&&weight+tw>limit+1e-9){lines.push(line);line='';weight=0;}
      line+=token;weight+=tw;
    }
    lines.push(line);
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
  rect('top-rule', { x: 0, y: 0, w: 1280, h: 2 }, p.accent, 'none');
  if(design.footer)text('footer-label', asText(design.footer), { x: 48, y: 687, w: 1040, h: 20 }, 13, { color: p.muted, role: 'footer', lineHeight: 1.1 });
  text('page-number', `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, { x: 1128, y: 686, w: 104, h: 22 }, 14, { color: p.muted, align: 'right', role: 'footer' });
  return { page, p, add, rect, line, text };
}

function header(b, slide) {
  if(slide.kicker)b.text('kicker', slide.kicker, { x:48, y:16, w:1184, h:20 }, 16, { color:b.p.muted, role:'kicker', lineHeight:1.1 });
  const titleY=slide.kicker?40:24,lines=wrapText(slide.title,1184,34).length,titleH=Math.min(78,Math.max(42,lines*38.1));
  b.text('title', slide.title, { x:48, y:titleY, w:1184, h:titleH }, 34, { bold:true, lineHeight:1.12, role:'title' });
  b.line('header-rule',48,Math.min(122,titleY+titleH+10),1232,Math.min(122,titleY+titleH+10),b.p.accent,{strokeWidth:1.2});
}

function metricString(metric) {
  if (typeof metric === 'string') return metric;
  if (!metric || typeof metric !== 'object') return '';
  return [metric.value, metric.unit].filter(v => v !== undefined && v !== '').join(' ');
}

/** Draw a native card; text and frame remain independent editable objects. */
function card(b, data, box, index, project, defaultStyle) {
  const c = data || {}, id = asText(c.id || `card-${index + 1}`);
  const key = `card/${id}`, p = b.p, style = c.style || defaultStyle || KIND_STYLE[c.kind] || 'plain';
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
  } else if(style==='academic-panel'){
    R('frame',box,p.paper,p.line,{strokeWidth:1.1});
    R('heading-fill',{x:x+1,y:y+1,w:w-2,h:39},p.tint,'none');
    L('heading-rule',x,y+40,x+w,y+40,p.line,{strokeWidth:1});
    tx=x+13;ty=y+6;tw=w-26;th=29;bx=x+14;by=y+52;bw=w-28;
  } else if(style==='academic-tab'){
    R('frame',{x,y:y+12,w,h:h-12},p.paper,p.line,{strokeWidth:1.1});
    const tabW=Math.min(w-28,Math.max(100,asText(c.title).length*24+28)),tabH=Math.min(h,Math.max(33,wrapText(c.title,tabW-22,24).length*27.6+6));
    R('tab',{x:x+12,y,w:tabW,h:tabH},accent,'none');
    tx=x+23;ty=y+3;tw=tabW-22;th=tabH-6;bx=x+14;by=y+tabH+15;bw=w-28;
  } else if(style==='academic-side'){
    L('base-rule',x,y+h,x+w,y+h,p.line,{strokeWidth:1.1});
    R('side-mark',{x,y:y+2,w:5,h:31},accent,'none');
    tx=x+16;ty=y+2;tw=w-16;th=32;bx=x+16;by=y+46;bw=w-16;
  } else if (['plain','ruled','compact'].includes(style)) {
    tx=x;ty=y+2;tw=w;th=34;bx=x;by=y+(style==='compact'?42:49);bw=w;
    if(style==='ruled'){
      L('heading-rule',x,y+38,x+w,y+38,p.line,{strokeWidth:1});
      L('heading-mark',x,y+38,x+36,y+38,accent,{strokeWidth:1.8});
      by=y+52;
    }
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
  const darkTitle = !component && ['floating-tab', 'title-band','academic-tab'].includes(style);
  const flat=!component&&['plain','ruled','compact'].includes(style);
  const academic=!component&&['academic-panel','academic-tab','academic-side'].includes(style),compact=flat||academic;
  T('title', c.title, { x: tx, y: ty, w: tw, h: th }, flat?25:24, { bold: true, color: darkTitle ? '#FFFFFF' : accent, lineHeight:1.15, role:'card-title' });
  const metric = metricString(c.metric);
  if (metric) {
    const metricSize=compact?32:39,metricH=metricSize*1.16;
    T('metric',metric,{x:bx,y:by,w:bw,h:metricH},metricSize,{bold:true,color:accent,lineHeight:1.1,role:'metric'});by+=metricH+4;
    if(c.metric?.label){const size=compact?23:17,mh=wrapText(c.metric.label,bw,size).length*size*1.18;T('metric-label',c.metric.label,{x:bx,y:by,w:bw,h:mh},size,{color:p.ink,lineHeight:1.18,role:'metric-label'});by+=mh+4;}
    if(c.metric?.context){const size=compact?23:16,mh=wrapText(c.metric.context,bw,size).length*size*1.2;T('metric-context',c.metric.context,{x:bx,y:by,w:bw,h:mh},size,{color:p.muted,role:'metric-context',lineHeight:1.2});by+=mh+8;}
  }
  const body = Array.isArray(c.body) ? c.body.join('\n') : c.body;
  T('body',body,{x:bx,y:by,w:bw,h:Math.max(14,y+h-(flat?4:academic?10:20)-by)},compact?(style==='compact'||academic?23:24):22,{lineHeight:compact?1.24:1.32,role:'body'});
  return { id, box, style };
}

function cardsGrid(b, cards, box, columns, project, gap = 28) {
  if(!cards.length)return;
  const rows = Math.ceil(cards.length / columns);
  const w = (box.w - gap * (columns - 1)) / columns;
  const h = (box.h - gap * (rows - 1)) / rows;
  cards.forEach((c, i) => card(b, c, c.box || { x: box.x + (i % columns) * (w + gap), y: box.y + Math.floor(i / columns) * (h + gap), w, h }, i, project));
}

function figure(b, project, id, box, key) {
  const asset = arr(project.assets).find(a => a.id === id) || project.assets?.[id];
  b.rect(`${key}:paper`, box, '#FFFFFF', 'none');
  if (!asset) {
    b.text(`${key}:missing`, '未提供原图', { x: box.x + 20, y: box.y + box.h / 2 - 20, w: box.w - 40, h: 45 }, 24, { color: b.p.muted, align: 'center' });
    b.page.issues.push({ severity: 'error', code: 'missing-figure', slideId: b.page.id, assetId: id, message: '页面引用了不存在的原图。' });
    return;
  }
  const viewport=asset.viewport;
  if(viewport&&(!['x','y','w','h'].every(k=>Number.isFinite(viewport[k]))||viewport.x<0||viewport.y<0||viewport.w<=0||viewport.h<=0||viewport.x+viewport.w>1.00000001||viewport.y+viewport.h>1.00000001)){
    b.page.issues.push({severity:'error',code:'invalid-viewport',slideId:b.page.id,assetId:id,message:'原图视窗必须是0–1范围内、正尺寸的归一化矩形。'});return;
  }
  const caption = [asset.paperId, asset.figure || asset.figureNumber, asset.panel, asset.caption].filter(Boolean).join(' · ');
  const captionLines=wrapText(caption,box.w,18),captionH=caption?Math.min(108,Math.max(26,captionLines.length*23+4)):0;
  const frame={x:box.x,y:box.y,w:box.w,h:Math.max(1,box.h-captionH-9)};
  if(frame.h<70)b.page.issues.push({severity:'warning',code:'small-figure-region',slideId:b.page.id,assetId:id,message:'图注之后的原图空间过小；扩大图区域或单独拆页。'});
  const iw=Number(asset.width||asset.pixelWidth||1)*(viewport?.w??1),ih=Number(asset.height||asset.pixelHeight||1)*(viewport?.h??1);
  const scale = Math.min(frame.w / iw, frame.h / ih);
  const imageBox = { x: frame.x + (frame.w - iw * scale) / 2, y: frame.y + (frame.h - ih * scale) / 2, w: iw * scale, h: ih * scale };
  b.add('image',`${key}:image`,{...imageBox,assetId:id,data:asset.data||asset.dataUri,alt:asset.alt||caption||'论文原图',source:{paperId:asset.paperId,figure:asset.figure,panel:asset.panel,sourceVersion:asset.sourceVersion},fit:'contain',...(viewport?{viewport:clone(viewport)}:{})});
  if(caption)b.text(`${key}:caption`,caption,{x:box.x,y:box.y+box.h-captionH,w:box.w,h:captionH},18,{color:b.p.muted,role:'caption',lineHeight:1.24});
}

/** Select the two-panel arrangement that gives both source images the most visible area. */
function pairedFigureBoxes(project, ids, area, gap = 18) {
  const horizontal = [0, 1].map(i => ({ x: area.x + i * (area.w + gap) / 2, y: area.y, w: (area.w - gap) / 2, h: area.h }));
  const vertical = [0, 1].map(i => ({ x: area.x, y: area.y + i * (area.h + gap) / 2, w: area.w, h: (area.h - gap) / 2 }));
  const visibleArea = boxes => boxes.reduce((sum, box, i) => {
    const asset = arr(project.assets).find(a => a.id === ids[i]) || project.assets?.[ids[i]];
    const iw=Number(asset?.width||1)*(asset?.viewport?.w??1),ih=Number(asset?.height||1)*(asset?.viewport?.h??1),caption=[asset?.paperId,asset?.figure,asset?.panel,asset?.caption].filter(Boolean).join(' · ');
    const captionH=caption?Math.min(108,Math.max(26,wrapText(caption,box.w,18).length*23+4)):0;
    const scale=Math.min(box.w/iw,Math.max(1,box.h-9-captionH)/ih);
    return sum + iw * ih * scale * scale;
  }, 0);
  return visibleArea(horizontal) >= visibleArea(vertical) ? horizontal : vertical;
}

function paperTitle(b, project, slide, box) {
  const papers = arr(project.papers).filter(p => arr(slide.paperIds).includes(p.id));
  if (!papers.length) return;
  const paper = papers[0];
  const titleH=Math.max(30,wrapText(paper.title,box.w,25).length*30),allocatedTitleH=Math.min(titleH,Math.max(30,box.h-40));
  b.text('paper-title',paper.title,{x:box.x,y:box.y,w:box.w,h:allocatedTitleH},25,{bold:true,role:'paper-title',lineHeight:1.2});
  b.text('paper-bibliography',[arr(paper.authors).join(', '),paper.journal,paper.year,paper.doi?`DOI: ${paper.doi}`:''].filter(Boolean).join(' · '),{x:box.x,y:box.y+allocatedTitleH+6,w:box.w,h:Math.max(20,box.h-allocatedTitleH-6)},17,{color:b.p.muted,role:'citation',lineHeight:1.22});
}

function footerSources(b, project, slide) {
  if (slide.layout === 'references') return;
  const ids = new Set(arr(slide.paperIds));
  for (const claim of arr(project.claims)) if (arr(slide.claimIds).includes(claim.id) && claim.paperId) ids.add(claim.paperId);
  const sources = arr(project.papers).filter(p => ids.has(p.id)).map(p => [p.id, p.year, p.doi || p.url].filter(Boolean).join(' · '));
  if(sources.length)b.text('sources',sources.join('  |  '),{x:48,y:660,w:1184,h:24},15,{color:b.p.muted,role:'citation',lineHeight:1.14});
}

function diagram(b, project, slide, area, nodeBoxes) {
  const nodes = arr(slide.nodes), edges = arr(slide.edges);
  const count = nodes.length;
  if (!count) return;
  const columns = Math.min(count, count === 4 ? 2 : 3), rows = Math.ceil(count / Math.max(columns, 1));
  const gap = 55, rowGap = 46;
  const w = (area.w - (columns - 1) * gap) / Math.max(columns, 1), h = Math.min(132,(area.h - (rows - 1) * rowGap) / Math.max(rows, 1));
  const boxes = new Map(nodes.map((n, i) => [n.id, n.box || nodeBoxes?.[i] || { x: area.x + (i % columns) * (w + gap), y: area.y + 14 + Math.floor(i / columns) * (h + rowGap), w, h }]));
  const route=(index,points,edge)=>{
    for(let k=0;k<points.length-1;k++){
      const a=points[k],z=points[k+1];
      b.line(points.length===2?`edge:${index}`:`edge:${index}:segment:${k}`,a.x,a.y,z.x,z.y,b.p.secondary,{strokeWidth:1.6,...(k===points.length-2?{endArrow:true}:{})});
    }
    if(edge.label){
      const k=Math.floor((points.length-1)/2),a=points[k],z=points[k+1],mid={x:(a.x+z.x)/2,y:(a.y+z.y)/2};
      const lw=Math.min(190,Math.max(80,asText(edge.label).length*16+12));
      b.text(`edge:${index}:label`,edge.label,{x:Math.max(area.x,Math.min(area.x+area.w-lw,mid.x-lw/2)),y:Math.max(area.y,mid.y-24),w:lw,h:24},17,{align:'center',color:b.p.muted,role:'diagram-label',lineHeight:1.1});
    }
  };
  for (const [i, edge] of edges.entries()) {
    const a = boxes.get(edge.from), z = boxes.get(edge.to);
    if (!a || !z) { b.page.issues.push({ severity: 'error', code: 'invalid-edge', slideId: b.page.id, message: '流程连线引用了不存在的节点。' }); continue; }
    const ac={x:a.x+a.w/2,y:a.y+a.h/2},zc={x:z.x+z.w/2,y:z.y+z.h/2};
    if(z.x>=a.x+a.w && Math.abs(zc.x-ac.x)>=Math.abs(zc.y-ac.y)*.75){
      const start={x:a.x+a.w,y:ac.y},end={x:z.x,y:zc.y},midX=(start.x+end.x)/2;
      route(i,Math.abs(start.y-end.y)<2?[start,end]:[start,{x:midX,y:start.y},{x:midX,y:end.y},end],edge);
    }else if(a.x>=z.x+z.w&&Math.abs(ac.y-zc.y)<2&&!edges.some(other=>other.from===edge.to&&other.to===edge.from)&&![...boxes.values()].some(other=>other!==a&&other!==z&&other.x<a.x&&other.x+other.w>z.x+z.w&&other.y<=ac.y&&other.y+other.h>=ac.y)){
      // The return row of a loop flows right-to-left directly, rather than
      // sharing a bus above the boxes that can imply false branching.
      route(i,[{x:a.x,y:ac.y},{x:z.x+z.w,y:zc.y}],edge);
    }else if(z.y>=a.y+a.h){
      const start={x:ac.x,y:a.y+a.h},end={x:zc.x,y:z.y},midY=(start.y+end.y)/2;
      route(i,Math.abs(start.x-end.x)<2?[start,end]:[start,{x:start.x,y:midY},{x:end.x,y:midY},end],edge);
    }else if(Math.abs(ac.y-zc.y)<Math.max(a.h,z.h)*.7){
      const top=Math.max(area.y+2,Math.min(a.y,z.y)-22-(i%2)*5);
      route(i,[{x:ac.x,y:a.y},{x:ac.x,y:top},{x:zc.x,y:top},{x:zc.x,y:z.y}],edge);
    }else{
      const left=Math.max(area.x+1,Math.min(a.x,z.x)-23-(i%2)*5);
      route(i,[{x:a.x,y:ac.y},{x:left,y:ac.y},{x:left,y:zc.y},{x:z.x,y:zc.y}],edge);
    }
  }
  for (const [i, n] of nodes.entries()) {
    const box = boxes.get(n.id);
    const pad=12,iw=box.w-pad*2,labelH=Math.max(28,wrapText(n.label,iw,24).length*28),hasDetail=Boolean(n.detail),small=box.h<88,detailGap=small?2:5,labelY=hasDetail?box.y+(small?6:10):box.y+Math.max(8,(box.h-labelH)/2);
    b.rect(`node:${n.id}:frame`,box,b.p.paper,b.p.line,{strokeWidth:1.2});
    b.line(`node:${n.id}:heading-rule`,box.x,box.y,box.x+box.w,box.y,b.p.accent,{strokeWidth:2});
    b.text(`node:${n.id}:label`,n.label,{x:box.x+pad,y:labelY,w:iw,h:labelH},24,{bold:true,color:b.p.accent,align:'center',lineHeight:1.16,role:'diagram-label'});
    if(hasDetail)b.text(`node:${n.id}:detail`,n.detail,{x:box.x+pad,y:labelY+labelH+detailGap,w:iw,h:Math.max(22,box.y+box.h-(small?5:9)-(labelY+labelH+detailGap))},22,{color:b.p.ink,align:'center',lineHeight:1.18,role:'diagram-body'});
  }
}

/** Content-based academic tables: real cells in PPTX and the same wrapping in SVG. */
function table(b, data, box, fontFamily) {
  const columns=arr(data.columns),rows=arr(data.rows),all=[columns,...rows],fontSize=23,lineHeight=1.22,padX=10,padY=7;
  if(!columns.length||rows.some(row=>!Array.isArray(row)||row.length!==columns.length)){
    b.page.issues.push({severity:'error',code:'invalid-table-shape',slideId:b.page.id,message:'表格必须包含列名，且每行单元格数量必须与列数相同。'});return;
  }
  const colWidths=columns.map(()=>box.w/columns.length),wrapReserve=fontSize*.55;
  // Native PowerPoint tables may grow rows when glyph widths trigger an
  // additional wrap. Keep a small conservative reserve inside the real cell
  // margins so caption placement does not depend on a near-boundary estimate.
  const cellLines=all.map(row=>row.map((value,i)=>wrapText(value,Math.max(1,colWidths[i]-padX*2-wrapReserve),fontSize)));
  const rowHeights=cellLines.map(row=>Math.max(...row.map(lines=>lines.length))*fontSize*lineHeight+padY*2);
  const h=rowHeights.reduce((sum,value)=>sum+value,0),captionH=data.caption?wrapText(data.caption,box.w,18).length*22+7:0;
  if(h+captionH>box.h+2)b.page.issues.push({severity:'error',code:'table-overflow-estimate',slideId:b.page.id,objectId:`${b.page.id}/data-table`,message:`表格按17.25pt正文需要 ${Math.ceil(h+captionH)} px，区域只有 ${box.h} px；减少行列或拆页，不能缩小正文隐藏内容。`});
  b.add('table','data-table',{x:box.x,y:box.y,w:box.w,h,table:clone(data),colWidths,rowHeights,cellLines,fontFamily,fontSize,lineHeight,padX,padY,wrapReserve,palette:clone(b.p)});
  if(data.caption)b.text('table-caption',data.caption,{x:box.x,y:box.y+h+7,w:box.w,h:Math.max(22,captionH-7)},18,{color:b.p.muted,lineHeight:1.22,role:'caption'});
}

function references(b,project,slide,box) {
  const selected=arr(project.papers).filter(p=>!slide.paperIds?.length||slide.paperIds.includes(p.id));
  let y=box.y;
  for(const [i,p] of selected.entries()){
    const titleW=box.w-70,titleH=wrapText(p.title,titleW,24).length*28.8;
    const referenceId=p.id||`[${i+1}]`,indexLabel=wrapText(referenceId,58,22).length>1?`[${i+1}]`:referenceId;
    const meta=[indexLabel!==referenceId?referenceId:'',arr(p.authors).join(', '),p.journal,p.year,p.doi?`DOI: ${p.doi}`:p.url,p.version].filter(Boolean).join(' · '),metaH=wrapText(meta,titleW,18).length*22.3;
    b.text(`ref:${p.id}:id`,indexLabel,{x:box.x,y:y+2,w:58,h:32},22,{color:b.p.accent,bold:true,role:'reference-index'});
    b.text(`ref:${p.id}:title`,p.title,{x:box.x+70,y,w:titleW,h:titleH},24,{bold:true,lineHeight:1.2,role:'reference-title'});
    b.text(`ref:${p.id}:meta`,meta,{x:box.x+70,y:y+titleH+7,w:titleW,h:metaH},18,{color:b.p.muted,lineHeight:1.24,role:'citation'});
    y+=titleH+metaH+31;
    if(i<selected.length-1)b.line(`ref:${p.id}:line`,box.x+70,y-13,box.x+box.w,y-13,b.p.line);
  }
  if(y>box.y+box.h+13)b.page.issues.push({severity:'error',code:'references-overflow-estimate',slideId:b.page.id,message:'完整参考文献信息超出区域；将书目拆成多页。'});
  if(selected.length===1&&y<box.y+box.h-90){
    const p=selected[0],used=new Set(arr(project.slides).flatMap(s=>arr(s.figureIds))),assets=arr(project.assets).filter(a=>a.paperId===p.id&&used.has(a.id));
    const readingLabel={'full-text':'全文阅读范围：','abstract-only':'摘要阅读范围：','metadata-only':'书目/材料说明：'}[p.reading?.status]||'阅读记录：';
    const licenses=assets.length?['原图授权：',...assets.map(a=>[a.figure,a.panel,a.license].filter(Boolean).join(' · '))].join('\n'):'';
    const extra=[p.url,p.reading?.sections?.length?readingLabel+p.reading.sections.join(' · '):'',licenses].filter(Boolean).join('\n');
    b.text(`ref:${p.id}:detail`,extra,{x:box.x+70,y:y+8,w:box.w-70,h:Math.max(24,box.y+box.h-y-8)},20,{color:b.p.muted,lineHeight:1.35,role:'source-details'});
  }
}

function referenceLayout(b,project,slide,ref) {
  const s=ref.slots,figures=arr(slide.figureIds),cards=arr(slide.cards);
  for(const [i,panel] of arr(s.panels).entries()){
    const {x,y,w,h}=panel,key=`panel:${i}`,style=panel.style||'academic-panel';
    if(style==='academic-side'){
      b.rect(`${key}:frame`,{x,y,w,h},b.p.paper,b.p.line,{strokeWidth:1.1});
      b.rect(`${key}:side-mark`,{x:x+1,y:y+8,w:5,h:29},b.p.accent,'none');
      b.text(`${key}:title`,slide.panelTitles?.[i]??panel.title,{x:x+16,y:y+6,w:w-32,h:31},24,{bold:true,color:b.p.accent,lineHeight:1.15,role:'panel-title'});
    }else if(style==='academic-tab'){
      b.rect(`${key}:frame`,{x,y:y+12,w,h:h-12},b.p.paper,b.p.line,{strokeWidth:1.1});
      const title=slide.panelTitles?.[i]??panel.title,tw=Math.min(w-28,Math.max(118,asText(panel.title).length*24+28));
      b.rect(`${key}:tab`,{x:x+12,y,w:tw,h:34},b.p.accent,'none');
      b.text(`${key}:title`,title,{x:x+23,y:y+3,w:tw-22,h:29},24,{bold:true,color:'#FFFFFF',lineHeight:1.15,role:'panel-title'});
    }else{
      b.rect(`${key}:frame`,{x,y,w,h},b.p.paper,b.p.line,{strokeWidth:1.1});
      b.rect(`${key}:heading-fill`,{x:x+1,y:y+1,w:w-2,h:40},b.p.tint,'none');
      b.line(`${key}:heading-rule`,x,y+41,x+w,y+41,b.p.line,{strokeWidth:1});
      b.text(`${key}:title`,slide.panelTitles?.[i]??panel.title,{x:x+13,y:y+6,w:w-26,h:31},24,{bold:true,color:b.p.accent,lineHeight:1.15,role:'panel-title'});
    }
  }
  if(s.paperTitle)paperTitle(b,project,slide,s.paperTitle);
  if(s.subtitle&&slide.subtitle)b.text('subtitle',slide.subtitle,s.subtitle,24,{lineHeight:1.24,color:b.p.muted,role:'subtitle'});
  if(s.takeaway&&slide.takeaway&&!(s.subtitle&&slide.takeaway===slide.subtitle))b.text('takeaway',slide.takeaway,s.takeaway,24,{bold:true,lineHeight:1.2,color:b.p.accent,role:'takeaway'});
  figures.forEach((id,i)=>{if(s.figures?.[i])figure(b,project,id,s.figures[i],`figure:${i}`);});
  if(s.chart&&slide.chart)b.add('chart','data-chart',{...s.chart,chart:clone(slide.chart),palette:clone(b.p),fontFamily:project.design?.fontFamily||DEFAULT_DESIGN.fontFamily});
  if(s.table&&slide.table)table(b,slide.table,s.table,project.design?.fontFamily||DEFAULT_DESIGN.fontFamily);
  if(s.diagram)diagram(b,project,slide,s.diagram,s.nodeBoxes);
  if(s.references)references(b,project,slide,s.references);
  cards.forEach((c,i)=>{if(s.cards?.[i])card(b,c,c.box||s.cards[i],i,project,ref.cardStyles?.[i]||'plain');});
}

export function buildScenes(project) {
  const design = resolveDesign(project.design), slides = arr(project.slides);
  const pages = slides.map((slide, index) => {
    const b = pageBuilder(slide, index, slides.length, design), cards = arr(slide.cards), figures = arr(slide.figureIds);
    header(b, slide);
    const ref=slide.referenceTemplateId?getReferenceTemplate(slide.referenceTemplateId):undefined;
    if(slide.referenceTemplateId&&!ref)b.page.issues.push({severity:'error',code:'unknown-reference-template',slideId:b.page.id,message:`未找到参考页型 ${slide.referenceTemplateId}；不能静默替换成其他版式。`});
    else if(ref)referenceLayout(b,project,slide,ref);
    else if(slide.layout==='cover'){
      // A research opening starts with its question and bibliographic identity.
      const subtitle=slide.subtitle||project.brief?.centralQuestion;
      b.text('subtitle',subtitle,{x:48,y:148,w:1184,h:108},30,{lineHeight:1.24,role:'subtitle'});
      paperTitle(b,project,slide,{x:48,y:300,w:1184,h:134});
      if(project.brief?.talkMinutes)b.text('cover-duration',`${project.brief.talkMinutes} 分钟学术汇报`,{x:48,y:604,w:1184,h:30},21,{color:b.p.muted,role:'cover-duration'});
    }else if(slide.layout==='paper'){
      paperTitle(b,project,slide,{x:48,y:128,w:1184,h:120});
      if(figures.length){
        figure(b,project,figures[0],{x:48,y:268,w:cards.length?716:1184,h:377},'figure:0');
        cardsGrid(b,cards,{x:796,y:268,w:436,h:377},1,project,24);
      }else cardsGrid(b,cards,{x:48,y:270,w:1184,h:375},Math.min(Math.max(cards.length,1),2),project);
    }else if(slide.layout==='figure-focus'){
      const main=arr(project.assets).find(a=>a.id===figures[0]),ratio=main?(main.width*(main.viewport?.w??1))/(main.height*(main.viewport?.h??1)):1;
      const portrait=cards.length&&ratio<.9,fw=cards.length?(portrait?426:792):1184;
      if(figures[0])figure(b,project,figures[0],{x:48,y:132,w:fw,h:513},'figure:0');
      if(cards.length)cardsGrid(b,cards,{x:48+fw+28,y:132,w:1184-fw-28,h:513},1,project,24);
    }else if(['figure-split','results'].includes(slide.layout)){
      const area={x:48,y:136,w:cards.length?790:1184,h:509};
      if(figures.length>=2){const boxes=pairedFigureBoxes(project,figures,area,24);figures.slice(0,2).forEach((id,i)=>figure(b,project,id,boxes[i],`figure:${i}`));}
      else if(figures[0])figure(b,project,figures[0],area,'figure:0');
      else if(slide.chart)b.add('chart','data-chart',{...area,chart:clone(slide.chart),palette:clone(b.p),fontFamily:design.fontFamily});
      else if(slide.table)table(b,slide.table,area,design.fontFamily);
      if(cards.length)cardsGrid(b,cards,{x:868,y:136,w:364,h:509},1,project,24);
    }else if(slide.layout==='comparison'){
      if(figures.length>=2){
        figures.slice(0,2).forEach((id,i)=>figure(b,project,id,{x:48+i*606,y:132,w:578,h:cards.length?337:513},`figure:${i}`));
        if(cards.length)cardsGrid(b,cards,{x:48,y:497,w:1184,h:148},Math.min(cards.length,2),project);
      }else if(slide.table){
        table(b,slide.table,{x:48,y:138,w:cards.length?808:1184,h:507},design.fontFamily);
        if(cards.length)cardsGrid(b,cards,{x:890,y:138,w:342,h:507},1,project);
      }else cardsGrid(b,cards,CONTENT,Math.min(Math.max(cards.length,1),2),project);
    }else if(slide.layout==='method'){
      diagram(b,project,slide,{x:60,y:132,w:1160,h:cards.length?286:499});
      if(cards.length)cardsGrid(b,cards,{x:48,y:450,w:1184,h:195},Math.min(cards.length,3),project);
    }else if(slide.layout==='roadmap'){
      const gap=24,count=Math.max(cards.length,1),h=(513-gap*(count-1))/count;
      cards.forEach((c,i)=>{const y=132+i*(h+gap);b.text(`roadmap:${i}:number`,String(i+1).padStart(2,'0'),{x:48,y:y+2,w:63,h:42},29,{color:b.p.accent,bold:true,role:'index'});card(b,c,c.box||{x:128,y,w:1104,h},i,project);});
    }else if(slide.layout==='references')references(b,project,slide,CONTENT);
    else{
      let y=132;
      for(const field of ['subtitle','takeaway']){
        if(!slide[field]||(field==='takeaway'&&slide.takeaway===slide.subtitle))continue;
        const h=Math.max(34,wrapText(slide[field],1184,26).length*31.2);
        b.text(field,slide[field],{x:48,y,w:1184,h},26,{bold:field==='takeaway',color:field==='takeaway'?b.p.accent:b.p.ink,lineHeight:1.2,role:field});
        y+=h+25;
      }
      cardsGrid(b,cards,{x:48,y,w:1184,h:Math.max(40,645-y)},Math.min(Math.max(cards.length,1),2),project);
    }
    footerSources(b,project,slide);
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
    if (slide.chart && !b.page.nodes.some(n => n.kind === 'chart')) b.page.issues.push({ severity: 'error', code: 'unrendered-chart', slideId: b.page.id, message: '输入图表未显示；选择有 chart 区域的参考页型，或单独使用 results 页。' });
    if (slide.table && !b.page.nodes.some(n => n.kind === 'table')) b.page.issues.push({ severity: 'error', code: 'unrendered-table', slideId: b.page.id, message: '输入表格未显示；选择有 table 区域的参考页型，或单独使用 comparison / results 页。' });
    for (const n of arr(slide.nodes)) if (!b.page.nodes.some(shape => shape.id === `${b.page.id}/node:${n.id}:frame`)) b.page.issues.push({ severity: 'error', code: 'unrendered-diagram-node', slideId: b.page.id, nodeId: n.id, message: '输入流程节点未显示；使用有 diagram 区域的参考页型或 method 页。' });
    arr(slide.edges).forEach((edge, i) => { if (!b.page.nodes.some(shape => shape.id === `${b.page.id}/edge:${i}` || shape.id.startsWith(`${b.page.id}/edge:${i}:`))) b.page.issues.push({ severity: 'error', code: 'unrendered-diagram-edge', slideId: b.page.id, edge, message: '输入流程连线未显示；选择支持 diagram 的页型并检查节点。' }); });
    for (const field of ['subtitle', 'takeaway']) if (asText(slide[field]).trim() && !b.page.nodes.some(n => n.kind === 'text' && n.text === slide[field])) b.page.issues.push({ severity: 'error', code: `unrendered-${field}`, slideId: b.page.id, message: `${field} 在当前页型没有可见区域。将必要内容写入卡片，或使用支持该字段的页型；必须展示所有输入限定后才能完成审核。` });
    for (const node of b.page.nodes) {
      if (![node.x, node.y, node.w, node.h].every(Number.isFinite)) b.page.issues.push({ severity: 'error', code: 'invalid-geometry', slideId: b.page.id, objectId: node.id, message: '对象坐标必须是有限数值。' });
      if (node.kind !== 'line' && (node.w <= 0 || node.h <= 0 || node.x < -1 || node.y < -1 || node.x + node.w > 1281 || node.y + node.h > 721)) b.page.issues.push({ severity: 'error', code: 'out-of-bounds', slideId: b.page.id, objectId: node.id, message: '对象尺寸无效或超出页面。' });
    }
    return b.page;
  });
  return { ...CANVAS, design, pages, issues: pages.flatMap(p => p.issues) };
}
