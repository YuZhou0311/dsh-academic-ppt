/** Shared editable geometry. Coordinates are CSS px on a 1280 × 720 slide.
 * No scientific value is inferred here: every visible result comes from the project.
 */
import { getReferenceTemplate } from './reference-catalog.mjs';
import { effectiveBibliographyIds } from './reference.mjs';
import { assessFigurePlacement } from './figure-planning.mjs';
import { resolveAcademicSystem } from './design-system.mjs';
import { academicHeader, academicCover, academicSection, academicClosing, resolveChrome } from './academic-chrome.mjs';
import { renderAcademicComposition } from './academic-composition.mjs';
import { renderScientificPlot } from './scientific-plot.mjs';
import { renderAcademicDiagram, automaticDiagramRows } from './academic-diagram.mjs';
import { renderCardSurface } from './card-surface.mjs';
import { renderNativeDrawing, drawingAssetIds, drawingClaimIds } from './native-drawing.mjs';
import { renderAuthoredHeading } from './authored-heading.mjs';
import { renderBibliography } from './free-composition.mjs';
import { projectionIssues } from './projection-quality.mjs';
export const CANVAS = Object.freeze({ width: 1280, height: 720 });
export const LAYOUTS = Object.freeze(['cover', 'section', 'academic', 'roadmap', 'paper', 'figure-focus', 'figure-split', 'comparison', 'method', 'results', 'synthesis', 'proposal', 'closing', 'references']);
export const CARD_STYLES = Object.freeze(['plain', 'ruled', 'compact', 'academic-panel', 'academic-tab', 'academic-side', 'open-frame', 'floating-tab', 'split-label', 'paper-shadow', 'title-band', 'stacked-corner', 'ledger', 'dashed-note']);
export const DEFAULT_DESIGN = Object.freeze({
  fontFamily: 'Noto Sans CJK SC',
  palette: { background: '#FFFFFF', paper: '#FFFFFF', ink: '#171C22', muted: '#4F5D6A', accent: '#183B66', secondary: '#455C76', gold: '#9D3038', line: '#C5CFDA', tint: '#EEF2F6' },
});
// A scientific role changes emphasis, not the amount of decorative furniture.
// Frames and tabs remain available when explicitly requested in a card.
const KIND_STYLE = { question: 'plain', method: 'plain', setting: 'plain', result: 'plain', boundary: 'ruled', hypothesis: 'ruled' };
const CONTENT = Object.freeze({ x:48, y:132, w:1184, h:513 });
const clone = value => JSON.parse(JSON.stringify(value));
const safeColor = (value, fallback) => /^#[a-f\d]{6}$/i.test(String(value)) ? value : fallback;
const asText = value => value === undefined || value === null ? '' : typeof value === 'string' ? value : String(value);
const arr = value => Array.isArray(value) ? value : [];

/** A small semantic vocabulary, shared by text, cards and diagram nodes.
 * These hues identify roles, never imply that a scientific result is positive.
 */
export function semanticStyle(kind, palette = DEFAULT_DESIGN.palette, {academic=false}={}) {
  const styles = academic ? {
    question: { accent: palette.accent, tint: palette.tint },
    method: { accent: palette.accent, tint: palette.tint },
    setting: { accent: palette.muted, tint: palette.tint },
    result: { accent: palette.accent, tint: palette.tint },
    boundary: { accent: palette.secondary, tint: palette.tint },
    hypothesis: { accent: palette.accent, tint: palette.tint },
  } : {
    question:{accent:palette.accent,tint:'#EDF2F7'},method:{accent:'#235E96',tint:'#EAF2FA'},
    setting:{accent:'#536A7A',tint:'#F0F3F6'},result:{accent:'#146C63',tint:'#E9F4F0'},
    boundary:{accent:'#A24736',tint:'#FAEEE8'},hypothesis:{accent:'#6C528E',tint:'#F2EDF7'},
  };
  return styles[kind] || { accent: palette.accent, tint: palette.tint };
}

/** Apply emphasis only to exact authored fragments; never rewrite the evidence. */
function emphasizedLines(content, lines, phrases, color) {
  const ranges = [];
  for (const phrase of phrases) {
    let from = 0, at;
    while ((at = content.indexOf(phrase, from)) !== -1) {
      ranges.push([at, at + phrase.length]); from = at + phrase.length;
    }
  }
  let cursor = 0;
  return lines.map(line => {
    const found = content.indexOf(line, cursor), start = found < 0 ? cursor : found;
    const end = start + line.length;
    cursor = end + (content[end] === '\n' ? 1 : 0);
    const bounds = [...new Set([start, end, ...ranges.flatMap(([a,z]) => a < end && z > start ? [Math.max(a,start),Math.min(z,end)] : [])])].sort((a,z)=>a-z);
    if (!line) return [{ text: '' }];
    return bounds.slice(0,-1).map((at,i) => ({ text: content.slice(at,bounds[i+1]), ...(ranges.some(([a,z])=>at>=a&&at<z) ? { bold:true,color } : {}) }));
  });
}

export function resolveDesign(input = {}) {
  const palette = Object.fromEntries(Object.entries(DEFAULT_DESIGN.palette).map(([key, value]) => [key, safeColor(input.palette?.[key] || (key === 'tint' ? input.palette?.soft : undefined), value)]));
  return { ...DEFAULT_DESIGN, ...input, palette, system:resolveAcademicSystem(input.system), hasAcademicSystem:Boolean(input.system), fontFamily: asText(input.fontFamily).trim() || DEFAULT_DESIGN.fontFamily };
}

const graphemeSegmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });
const graphemes = value => [...graphemeSegmenter.segment(asText(value))].map(part => part.segment);

/** Conservative sans-serif advances, in em. This is explicitly an estimate,
 * not a claim that an installed font or an Office renderer was measured.
 * Unlike a single Latin coefficient, wide capitals, narrow letters, numbers,
 * combining marks and full-width punctuation have distinct advances.
 */
export function measureTextWidth(value, size, { bold = false } = {}) {
  let advance = 0;
  for (const glyph of graphemes(value)) {
    if (/^[\p{Mark}\u200b-\u200f\u2060\ufe00-\ufe0f]+$/u.test(glyph)) continue;
    if (glyph === '\t') { advance += 1.2; continue; }
    if (glyph === '\u3000') { advance += 1; continue; }
    if (/^\s+$/u.test(glyph)) { advance += .3; continue; }
    const base = glyph.normalize('NFD').replace(/\p{Mark}/gu, '');
    let em;
    if (base === '@') em = 1.05;
    else if (/^[MW]$/.test(base)) em = .94;
    else if (/^[mw]$/.test(base)) em = base === 'm' ? .96 : .86;
    else if (/^[ilIjtfr]$/.test(base)) em = /[fr]/.test(base) ? .43 : .36;
    else if (/^[A-Z]$/.test(base)) em = .77;
    else if (/^[a-z]$/.test(base)) em = .65;
    else if (/^[0-9]$/.test(base)) em = .61;
    else if (/^[.,:;'`!|]$/.test(base)) em = .34;
    else if (/^[()\[\]{}]$/.test(base)) em = .42;
    else if (/^[\-+*/=<>_%&#?\\~^]$/.test(base)) em = .67;
    else if (/^[\u0370-\u03ff\u1f00-\u1fff±×÷−–—≤≥≈≠∞]$/u.test(base)) em = .78;
    else em = 1; // CJK, full-width punctuation, unknown scripts and emoji.
    advance += em * (bold && em < 1 ? 1.035 : 1);
  }
  return advance * Math.max(1, size);
}

/** Predictable, lossless wrapping is shared by SVG and PPTX. */
export function wrapText(value, width, size, options = {}) {
  const limit = Math.max(1, width);
  const lines = [];
  const closing=/^[，。！？；：、）》〉」』】〕）］｝’”….,!?;:\])}%％]+$/u;
  const opening=/^[（(［\[｛{《〈「『【〔‘“]+$/u;
  const units = token => measureTextWidth(token, size, options);
  // Punctuation travels with the preceding lexical unit, and an opening
  // bracket travels with the next one. No character is deleted or replaced.
  // Long words are split only when that word cannot fit even on an empty line.
  const gluePunctuation=tokens=>{
    const out=[];let prefix='';
    for(const token of tokens){
      if (out.length && (/^[\p{Mark}\ufe00-\ufe0f\u200d]+$/u.test(token) || out.at(-1).endsWith('\u200d'))) { out[out.length - 1] += token; continue; }
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
    const fitted=tokens.flatMap(token=>units(token)<=limit? [token]:gluePunctuation(graphemes(token)).flatMap(part=>units(part)<=limit?[part]:graphemes(part)));
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
  const regions = [];
  const region = (key, box, type) => regions.push({ id: `${page.id}/${key}`, ...box, type });
  const add = (kind, key, props, cardId) => {
    const node = { ...props, kind, id: `${page.id}/${key}`, ...(cardId ? { cardId } : {}) };
    if (kind === 'chart') region(key, props, 'chart');
    page.nodes.push(node); return node;
  };
  const rect = (key, box, fill = p.paper, stroke = p.line, more = {}, cardId) => add('rect', key, { ...box, fill, stroke, strokeWidth: 1, ...more }, cardId);
  const line = (key, x1, y1, x2, y2, color = p.line, more = {}, cardId) => add('line', key, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, stroke: color, strokeWidth: 1.4, ...more }, cardId);
  const text = (key, value, box, size = 24, more = {}, cardId) => {
    const content = asText(value), fontSize = size;
    if (!content) return null;
    // Bold CJK/Latin fragments need a small width reserve before native export.
    const emphasis = arr(more.emphasis).filter(v => typeof v === 'string' && v.length);
    const metrics = { bold: !!more.bold || emphasis.length>0 };
    const lines = wrapText(content, Math.max(1,box.w-(emphasis.length?fontSize*.22:0)), fontSize, metrics);
    const lineHeight = more.lineHeight || 1.28;
    const needed = lines.length * fontSize * lineHeight;
    const lineWidths = lines.map(line => measureTextWidth(line,fontSize,metrics));
    if (needed > box.h + 2) page.issues.push({ severity: 'error', code: 'text-overflow-estimate', slideId: page.id, objectId: `${page.id}/${key}`, requiredHeight: Math.ceil(needed), availableHeight: box.h, message: `文字估计需要 ${Math.ceil(needed)} px，分配 ${box.h} px。保留文字与字号，扩大区域、调整布局或拆页后再构建。` });
    if (Math.max(...lineWidths) > box.w + 2) page.issues.push({ severity: 'error', code: 'text-width-overflow-estimate', slideId: page.id, objectId: `${page.id}/${key}`, message: `不可拆分字符宽度超过 ${box.w} px 的文字区域；扩大区域，不能裁掉原文。` });
    for(const phrase of emphasis)if(!content.includes(phrase))page.issues.push({severity:'error',code:'unmatched-emphasis',slideId:page.id,objectId:`${page.id}/${key}`,message:'强调片段必须完整出现在正文中，不能另造结论。'});
    return add('text', key, { ...box, text: content, lines, fontSize, fontFamily: design.fontFamily, color: p.ink, lineHeight, estimatedTextHeight:needed, estimatedLineWidths:lineWidths, ...more, ...(emphasis.length?{richLines:emphasizedLines(content,lines,emphasis,more.emphasisColor||p.accent)}:{}) }, cardId);
  };
  const chrome=resolveChrome(design,slide);
  if (!['cover','section'].includes(slide.layout)) {
    if(chrome.showTopRule!==false)rect('top-rule', { x: 0, y: 0, w: 1280, h: 2 }, p.accent, 'none');
    if(chrome.showFooter!==false&&design.footer)text('footer-label', asText(design.footer), { x: 48, y: 687, w: 1040, h: Math.max(20,(design.projection?.noteMin||13)*1.1) }, design.projection?.noteMin||13, { color: p.muted, role: 'footer', lineHeight: 1.1 });
    if(chrome.showPageNumber!==false)text('page-number', `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, { x: 1128, y: 686, w: 104, h: Math.max(22,(design.projection?.noteMin||14)*1.28) }, design.projection?.noteMin||14, { color: p.muted, align: 'right', role: 'footer' });
  }
  const customFigures=!slide.referenceTemplateId&&['figure-focus','figure-split'].includes(slide.layout)?slide.figureBoxes:undefined;
  return { page, p, add, rect, line, text, region, regions, customFigures, design, chrome, system:design.system };
}

function header(b, slide) {
  const titleSize=40,titleY=22,titleH=Math.max(46,wrapText(slide.title,1184,titleSize,{bold:true}).length*44.8);
  b.text('title',slide.title,{x:48,y:titleY,w:1184,h:titleH},titleSize,{bold:true,lineHeight:1.12,role:'title'});
  let bottom=titleY+titleH;
  // Legacy kickers remain visible and retain their content, but become readable
  // subtitles below the title. New decks should omit redundant category labels.
  if(slide.kicker){
    const h=wrapText(slide.kicker,1184,22).length*26.4;
    b.text('kicker',slide.kicker,{x:48,y:bottom+3,w:1184,h},22,{color:b.p.muted,role:'section-label',lineHeight:1.2});
    bottom+=h+3;
  }
  const ruleY=bottom+11;
  b.line('header-rule',48,ruleY,1232,ruleY,b.p.line,{strokeWidth:1.1});
  b.line('header-accent',48,ruleY,122,ruleY,b.p.accent,{strokeWidth:3});
  if(ruleY>122)b.page.issues.push({severity:'error',code:'header-content-overlap',slideId:b.page.id,message:'标题与副题超出页眉空间。删去冗余副题或改写标题，保留正文原字号。'});
}

/** A cover is an authored academic identity, not the first paper's detail page.
 * Both variants are native geometry, with no borrowed template image or text.
 */
function cover(b, slide) {
  const data = slide.cover || {}, minimal = data.variant === 'minimal';
  const x = minimal ? 96 : 84, w = 1280 - x * 2, align = minimal ? 'center' : 'left';
  const occasion = [...new Set([data.occasion,slide.kicker].map(asText).filter(Boolean))].join(' · ');
  if (!minimal) b.rect('cover-edge', {x:0,y:0,w:16,h:720}, b.p.accent, 'none');
  b.line('cover-rule',minimal?592:x,minimal?160:148,minimal?688:x+88,minimal?160:148,b.p.accent,{strokeWidth:4});
  if (occasion) b.text('cover-occasion',occasion,{x,y:72,w,h:64},24,{align,color:b.p.muted,lineHeight:1.24,role:'cover-occasion'});

  // Reserve the real metadata height before placing the subtitle. The title
  // size stays fixed even when an unusually long identity needs revision.
  const date = asText(data.date), metaWidth = !minimal && date ? 848 : w;
  const meta = [['cover-presenter',data.presenter,26],['cover-affiliation',data.affiliation,22],...(minimal?[['cover-date',date,22]]:[])]
    .filter(([,value])=>asText(value)).map(([key,value,size])=>({key,value:asText(value),size,h:wrapText(value,metaWidth,size).length*size*1.24}));
  const metaHeight=meta.reduce((sum,item)=>sum+item.h,0)+Math.max(0,meta.length-1)*9;
  let metaY=642-metaHeight;
  const metaTop=meta.length?metaY:654;
  if(metaHeight>156)b.page.issues.push({severity:'error',code:'cover-metadata-overflow',slideId:b.page.id,message:'封面署名与单位超过可用身份区域；精简重复身份、换行或使用另页，不缩小字号。'});
  for(const item of meta){b.text(item.key,item.value,{x,y:metaY,w:metaWidth,h:item.h},item.size,{align,color:item.key==='cover-presenter'?b.p.ink:b.p.muted,lineHeight:1.24,role:'cover-metadata'});metaY+=item.h+9;}
  if(date&&!minimal){const dateW=224,dateH=wrapText(date,dateW,22).length*22*1.24;b.text('cover-date',date,{x:972,y:642-dateH,w:dateW,h:dateH},22,{align:'right',color:b.p.muted,lineHeight:1.24,role:'cover-metadata'});}

  let title=asText(slide.title);
  if(arr(data.titleLines).length){
    const requested=data.titleLines.map(asText).join('\n');
    if(requested.replace(/\s/gu,'')!==title.replace(/\s/gu,''))b.page.issues.push({severity:'error',code:'cover-title-mismatch',slideId:b.page.id,message:'cover.titleLines 只能为完整标题指定换行，不能替换或删去标题文字。'});
    else title=requested;
  }
  const size=60,titleY=minimal?198:180,lineHeight=1.15,titleH=Math.min(276,wrapText(title,w,size,{bold:true}).length*size*lineHeight);
  b.text('title',title,{x,y:titleY,w,h:titleH},size,{align,bold:true,color:b.p.accent,lineHeight,role:'cover-title'});
  if(slide.subtitle){
    const y=titleY+titleH+24,needed=wrapText(slide.subtitle,w,28).length*28*1.24,h=Math.max(1,Math.min(needed,metaTop-y-30));
    b.text('subtitle',slide.subtitle,{x,y,w,h},28,{align,color:b.p.muted,lineHeight:1.24,role:'cover-subtitle'});
  }
  if(titleY+titleH>metaTop-30)b.page.issues.push({severity:'error',code:'cover-title-metadata-overlap',slideId:b.page.id,message:'封面完整标题与身份信息区域相碰；调整标题换行或使用更短且完整的题名，保留字号与署名。'});
}

function metricString(metric) {
  if (typeof metric === 'string') return metric;
  if (!metric || typeof metric !== 'object') return '';
  return [metric.value, metric.unit].filter(v => v !== undefined && v !== '').join(' ');
}

/** Draw a native card; text and frame remain independent editable objects. */
function card(b, data, box, index, project, defaultStyle) {
  if (renderCardSurface(b,data,box,index,project,{wrapText,measureTextWidth})) return {id:data.id,box,style:'surface'};
  const c = data || {}, id = asText(c.id || `card-${index + 1}`);
  const titleSize=b.system?.panelTitleSize??26,bodySize=b.system?.bodySize??24;
  const key = `card/${id}`, p = b.p, style = c.style || defaultStyle || KIND_STYLE[c.kind] || 'plain', semantic=semanticStyle(c.kind,p,{academic:b.design?.hasAcademicSystem});
  b.region(key,box,'card');
  const accent=safeColor(c.accent,semantic.accent),tint=semantic.tint;
  const shadow={color:'#20334A',opacity:.1,blur:3,offset:2,angle:90};
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
    R('heading-fill',{x:x+1,y:y+1,w:w-2,h:39},tint,'none');
    L('heading-rule',x,y+40,x+w,y+40,p.line,{strokeWidth:1});
    tx=x+13;ty=y+5;tw=w-26;th=31;bx=x+14;by=y+51;bw=w-28;
  } else if(style==='academic-tab'){
    R('frame',{x,y:y+12,w,h:h-12},p.paper,p.line,{strokeWidth:1.1});
    const tabW=Math.min(w-28,Math.max(100,measureTextWidth(c.title,titleSize,{bold:true})+28)),tabH=Math.min(h,Math.max(36,wrapText(c.title,tabW-22,26,{bold:true}).length*29.9+6));
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
    const labelW = Math.min(w - 36, Math.max(112,measureTextWidth(wrapText(c.title,w-72,titleSize,{bold:true})[0],titleSize,{bold:true})+22));
    R('title-cutout', { x: x + 14, y: y + 1, w: labelW, h: 34 }, p.background, 'none');
    ty = y + 2; by = y + 58;
    L('base-rule', x + 20, y + h - 16, x + 55, y + h - 16, accent, { strokeWidth: 3 });
  } else if (style === 'floating-tab') {
    R('frame', { x, y: y + 19, w, h: h - 19 }, p.paper, p.line,{shadow});
    R('tab', { x: x + 16, y, w: Math.min(w - 42, Math.max(138, measureTextWidth(c.title,titleSize,{bold:true}) + 30)), h: 42 }, accent, 'none');
    tx = x + 28; ty = y + 6; tw = w - 54; by = y + 68;
  } else if (style === 'split-label') {
    const labelW = Math.min(132, w * .29);
    R('frame', box, p.paper, p.line);
    R('label', { x, y, w: labelW, h }, tint, 'none');
    L('split', x + labelW, y + 18, x + labelW, y + h - 18, accent);
    tx = x + 15; ty = y + 20; tw = labelW - 30; th = h - 42;
    bx = x + labelW + 18; by = y + 19; bw = w - labelW - 35;
  } else if (style === 'paper-shadow') {
    R('frame',box,p.paper,p.line,{shadow});
    L('top-accent', x + 20, y + 12, x + 62, y + 12, accent, { strokeWidth: 3 });
    ty = y + 21; by = y + 70;
  } else if (style === 'title-band') {
    R('frame', box, p.paper, p.line);
    R('band', { x, y, w, h: 50 }, accent, 'none');
    ty = y + 10; by = y + 67;
  } else if (style === 'stacked-corner') {
    R('rear', { x: x + 8, y: y + 8, w: w - 8, h: h - 8 }, p.background, accent);
    R('middle', { x: x + 4, y: y + 4, w: w - 8, h: h - 8 }, tint, accent);
    R('frame', { x, y, w: w - 8, h: h - 8 }, p.paper, accent);
    L('title-rule', x + 20, y + 56, x + w - 28, y + 56, p.line);
    tw -= 8; bw -= 8; by = y + 73;
  } else if (style === 'dashed-note') {
    R('frame', box, tint, accent, { dash: 'dash', strokeWidth: 1.3 });
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
  const titleNeed=wrapText(c.title,tw,titleSize,{bold:true}).length*titleSize*1.15;
  // Default text regions reflow within their authored frame; they never borrow
  // space from the next card. Explicit imported text zones stay authoritative.
  if(!component&&style!=='split-label'){
    const extra=Math.max(0,titleNeed-th);
    th=Math.max(th,titleNeed);
    if(extra>0){
      by+=extra;
      for(const node of b.page.nodes.filter(n=>n.cardId===id)){
        if(/\/(?:heading-fill|tab|band|title-cutout)$/.test(node.id))node.h+=extra;
        if(/\/(?:heading-rule|heading-mark|title-rule|ledger-rule)$/.test(node.id))node.y+=extra;
      }
    }
  }
  T('title', c.title, { x: tx, y: ty, w: tw, h: Math.max(th,30) },titleSize,{bold:true,color:darkTitle?'#FFFFFF':accent,lineHeight:1.15,role:'card-title'});
  const metric = metricString(c.metric);
  if (metric) {
    const metricSize=compact?38:40,metricH=metricSize*1.16;
    T('metric',metric,{x:bx,y:by,w:bw,h:metricH},metricSize,{bold:true,color:accent,lineHeight:1.1,role:'metric'});by+=metricH+4;
    if(c.metric?.label){const size=bodySize,mh=wrapText(c.metric.label,bw,size).length*size*1.18;T('metric-label',c.metric.label,{x:bx,y:by,w:bw,h:mh},size,{color:p.ink,lineHeight:1.18,role:'metric-label'});by+=mh+4;}
    if(c.metric?.context){const size=bodySize,mh=wrapText(c.metric.context,bw,size).length*size*1.2;T('metric-context',c.metric.context,{x:bx,y:by,w:bw,h:mh},size,{color:p.muted,role:'metric-context',lineHeight:1.2});by+=mh+8;}
  }
  if(metric && by-8 > y+h-(flat?4:academic?10:20)+2)b.page.issues.push({severity:'error',code:'card-metric-overflow',slideId:b.page.id,objectId:`${b.page.id}/${key}`,message:'指标、变量和口径的总高度超出卡片区域；扩大卡片或重排相关说明，不能让指标文字延伸到页脚。'});
  const body = Array.isArray(c.body) ? c.body.join('\n') : c.body;
  T('body',body,{x:bx,y:by,w:bw,h:Math.max(14,y+h-(flat?4:academic?10:20)-by)},bodySize,{lineHeight:1.24,role:'body',emphasis:c.emphasis,emphasisColor:accent});
  return { id, box, style };
}

function cardsGrid(b, cards, box, columns, project, gap = 28) {
  if(!cards.length)return;
  const rows = Math.ceil(cards.length / columns);
  const w = (box.w - gap * (columns - 1)) / columns;
  const h = (box.h - gap * (rows - 1)) / rows;
  cards.forEach((c, i) => card(b, c, c.box || { x: box.x + (i % columns) * (w + gap), y: box.y + Math.floor(i / columns) * (h + gap), w, h }, i, project));
}

/** Reproduce an explicitly transcribed source legend, never a semantic-role palette. */
function displayLegendLayout(items,width,size=22){
  const lineW=24,lineGap=9,itemGap=24,rows=[{items:[],width:0,height:34}];
  for(const [index,item] of arr(items).entries()){
    const label=asText(item.label),estimated=measureTextWidth(label,size)+4;
    const labelW=Math.max(1,Math.min(estimated,width-lineW-lineGap));
    const w=lineW+lineGap+labelW,h=Math.max(34,wrapText(label,labelW,size).length*size*1.2+4);
    let row=rows.at(-1);
    if(row.items.length&&row.width+itemGap+w>width){row={items:[],width:0,height:34};rows.push(row);}
    const x=row.items.length?row.width+itemGap:0;
    row.items.push({index,label,color:item.color,x,w,h,labelW});row.width=x+w;row.height=Math.max(row.height,h);
  }
  let y=0;const placed=[];
  for(const row of rows){for(const item of row.items)placed.push({...item,x:item.x+(width-row.width)/2,y});y+=row.height;}
  return {items:placed,height:placed.length?y:0,rows:placed.length?rows.length:0,lineW,lineGap,size};
}

function figure(b, project, id, box, key) {
  box=b.customFigures?.[Number(key.split(':')[1])]||box;
  b.region(key,box,'figure');
  const asset = arr(project.assets).find(a => a.id === id) || project.assets?.[id];
  if (!asset) {
    b.text(`${key}:missing`, '未提供原图', { x: box.x + 20, y: box.y + box.h / 2 - 20, w: box.w - 40, h: 45 }, 24, { color: b.p.muted, align: 'center' });
    b.page.issues.push({ severity: 'error', code: 'missing-figure', slideId: b.page.id, assetId: id, message: '页面引用了不存在的原图。' });
    return;
  }
  const viewport=asset.viewport;
  if(viewport&&(!['x','y','w','h'].every(k=>Number.isFinite(viewport[k]))||viewport.x<0||viewport.y<0||viewport.w<=0||viewport.h<=0||viewport.x+viewport.w>1.00000001||viewport.y+viewport.h>1.00000001)){
    b.page.issues.push({severity:'error',code:'invalid-viewport',slideId:b.page.id,assetId:id,message:'原图视窗必须是0–1范围内、正尺寸的归一化矩形。'});return;
  }
  const captionSize=Math.max(b.system?.captionSize??18,b.design.projection?.noteMin??0);
  const caption=asset.displayCaption||[referenceLabel(project,asset.paperId),asset.figure||asset.figureNumber,asset.panel,asset.caption].filter(Boolean).join(' · ');
  const captionLines=wrapText(caption,box.w,captionSize),captionH=caption?Math.max(captionSize*1.45,captionLines.length*captionSize*1.24+4):0;
  const legend=displayLegendLayout(asset.displayLegend,box.w,Math.max(22,b.design.projection?.labelMin??0)),legendH=legend.height?legend.height+8:0;
  if(legend.rows>2||legend.height>2*Math.max(34,legend.size*1.2+4))b.page.issues.push({severity:'error',code:'figure-legend-overflow',slideId:b.page.id,assetId:id,message:'辅助图例超过两行。保留原始身份，缩短转录标签或扩大区域，不能降低图例字号。'});
  const matte=asset.treatment!=='plain',pad=matte?5:0;
  const frame={x:box.x+pad,y:box.y+pad,w:Math.max(1,box.w-pad*2),h:Math.max(1,box.h-captionH-legendH-9-pad*2)};
  if(frame.h<70)b.page.issues.push({severity:'warning',code:'small-figure-region',slideId:b.page.id,assetId:id,message:'图注之后的原图空间过小；扩大图区域或单独拆页。'});
  const iw=Number(asset.width||asset.pixelWidth||1)*(viewport?.w??1),ih=Number(asset.height||asset.pixelHeight||1)*(viewport?.h??1);
  const scale = Math.min(frame.w / iw, frame.h / ih);
  const imageBox = { x: frame.x + (frame.w - iw * scale) / 2, y: frame.y + (frame.h - ih * scale) / 2, w: iw * scale, h: ih * scale };
  const assessment=assessFigurePlacement(asset,frame,{slideId:b.page.id,objectId:`${b.page.id}/${key}:image`});
  b.page.issues.push(...assessment.issues);
  // The matte follows the actual source aspect ratio, not its empty layout slot.
  // A native outer shadow adds a shallow paper layer without rasterizing the page.
  if(matte)b.rect(`${key}:paper`,{x:imageBox.x-3,y:imageBox.y-3,w:imageBox.w+6,h:imageBox.h+6},'#FFFFFF','#CCD4DD',{strokeWidth:.8,shadow:{color:'#263B50',opacity:.12,blur:3,offset:2,angle:90}});
  b.add('image',`${key}:image`,{...imageBox,assetId:id,data:asset.data||asset.dataUri,alt:asset.alt||caption||'论文原图',source:{paperId:asset.paperId,figure:asset.figure,panel:asset.panel,sourceVersion:asset.sourceVersion},fit:'contain',...(viewport?{viewport:clone(viewport)}:{})});
  const legendY=box.y+box.h-captionH-legend.height-4;
  for(const item of legend.items){
    if(!item.label.trim()||!/^#[a-f\d]{6}$/i.test(String(item.color)))b.page.issues.push({severity:'error',code:'invalid-figure-legend',slideId:b.page.id,assetId:id,message:'辅助图例必须有非空标签和明确的六位颜色，并与原图核对。'});
    const x=box.x+item.x,y=legendY+item.y,stem=`${key}:legend:${item.index}`;
    b.line(`${stem}:line`,x,y+15,x+legend.lineW,y+15,safeColor(item.color,b.p.ink),{strokeWidth:3});
    b.text(`${stem}:label`,item.label,{x:x+legend.lineW+legend.lineGap,y:y+1,w:item.labelW,h:item.h-2},legend.size,{color:b.p.ink,lineHeight:1.2,role:'figure-legend'});
  }
  if(caption)b.text(`${key}:caption`,caption,{x:box.x,y:box.y+box.h-captionH,w:box.w,h:captionH},captionSize,{color:b.p.muted,role:'caption',lineHeight:1.24});
  b.page.notes+='\n\n原图来源：'+[asset.paperId,asset.figure,asset.panel,asset.caption,asset.sourceUrl,asset.sourceVersion,asset.license,asset.cropNote].filter(Boolean).join('\n');
  if(legend.items.length)b.page.notes+='\n辅助图例（据原图转录，标签与颜色须核对）：\n'+legend.items.map(item=>`${item.label}: ${item.color}`).join('\n');
}

/** Select the two-panel arrangement that gives both source images the most visible area. */
function pairedFigureBoxes(project, ids, area, gap = 18) {
  const horizontal = [0, 1].map(i => ({ x: area.x + i * (area.w + gap) / 2, y: area.y, w: (area.w - gap) / 2, h: area.h }));
  const vertical = [0, 1].map(i => ({ x: area.x, y: area.y + i * (area.h + gap) / 2, w: area.w, h: (area.h - gap) / 2 }));
  const visibleArea = boxes => boxes.reduce((sum, box, i) => {
    const asset = arr(project.assets).find(a => a.id === ids[i]) || project.assets?.[ids[i]];
    const iw=Number(asset?.width||1)*(asset?.viewport?.w??1),ih=Number(asset?.height||1)*(asset?.viewport?.h??1),caption=asset?.displayCaption||[referenceLabel(project,asset?.paperId),asset?.figure,asset?.panel,asset?.caption].filter(Boolean).join(' · ');
    const captionSize=Math.max(project.design?.system?.captionSize??18,project.design?.projection?.noteMin??0);
    const captionH=caption?(project.design?.projection?Math.max(captionSize*1.45,wrapText(caption,box.w,captionSize).length*captionSize*1.24+4):Math.min(108,Math.max(26,wrapText(caption,box.w,18).length*23+4))):0;
    const legendHeight=displayLegendLayout(asset?.displayLegend,box.w,Math.max(22,project.design?.projection?.labelMin??0)).height;
    const scale=Math.min(box.w/iw,Math.max(1,box.h-9-captionH-(legendHeight?legendHeight+8:0))/ih);
    return sum + iw * ih * scale * scale;
  }, 0);
  return visibleArea(horizontal) >= visibleArea(vertical) ? horizontal : vertical;
}

function paperTitle(b, project, slide, box) {
  const papers = arr(project.papers).filter(p => arr(slide.paperIds).includes(p.id));
  if (!papers.length) return;
  const paper = papers[0];
  if(b.design.projection){
    const titleSize=b.design.projection.labelMin,metaSize=b.design.projection.noteMin;
    const meta=[arr(paper.authors).join(', '),paper.journal,paper.year,paper.doi?`DOI: ${paper.doi}`:''].filter(Boolean).join(' · ');
    const titleH=wrapText(paper.title,box.w,titleSize,{bold:true}).length*titleSize*1.2,metaH=wrapText(meta,box.w,metaSize).length*metaSize*1.24;
    const height=titleH+metaH+8;
    b.region('paper-heading',{...box,h:height},'paper-heading');
    b.text('paper-title',paper.title,{x:box.x,y:box.y,w:box.w,h:titleH},titleSize,{bold:true,role:'reference-title',lineHeight:1.2});
    b.text('paper-bibliography',meta,{x:box.x,y:box.y+titleH+8,w:box.w,h:metaH},metaSize,{color:b.p.muted,role:'citation',lineHeight:1.24});
    return {height,bottom:box.y+height};
  }
  b.region('paper-heading',box,'paper-heading');
  const bibliography=[arr(paper.authors).join(', '),paper.journal,paper.year,paper.doi?`DOI: ${paper.doi}`:''].filter(Boolean).join(' · ');
  const bibliographyH=wrapText(bibliography,box.w,17).length*17*1.22;
  const titleH=Math.max(30,wrapText(paper.title,box.w,25,{bold:true}).length*30),allocatedTitleH=Math.min(titleH,Math.max(30,box.h-bibliographyH-6));
  b.text('paper-title',paper.title,{x:box.x,y:box.y,w:box.w,h:allocatedTitleH},25,{bold:true,role:'paper-title',lineHeight:1.2});
  b.text('paper-bibliography',bibliography,{x:box.x,y:box.y+allocatedTitleH+6,w:box.w,h:Math.max(20,box.h-allocatedTitleH-6)},17,{color:b.p.muted,role:'citation',lineHeight:1.22});
}

function referenceLabel(project,id) {
  const index=arr(project.papers).findIndex(p=>p.id===id);
  return index>=0?`[${index+1}]`:asText(id);
}

function footerSources(b, project, slide) {
  if (['references','cover','section'].includes(slide.layout)||resolveChrome(project.design,slide).showSources===false) return;
  const ids = new Set(arr(slide.paperIds)),claims=new Set([...arr(slide.claimIds),...arr(slide.cards).flatMap(c=>arr(c.claimIds)),...drawingClaimIds(slide)]);
  for (const claim of arr(project.claims)) if (claims.has(claim.id) && claim.paperId) ids.add(claim.paperId);
  for(const asset of arr(project.assets))if(drawingAssetIds(slide).includes(asset.id)&&asset.paperId)ids.add(asset.paperId);
  const sources = arr(project.papers).filter(p => ids.has(p.id)).map(p => [referenceLabel(project,p.id),arr(p.authors).length?`${p.authors[0]}${p.authors.length>1?' 等':''}`:'',p.year].filter(Boolean).join(' '));
  if(sources.length)b.text('sources',sources.join('  |  '),{x:48,y:660,w:1184,h:24},b.design.projection?.noteMin||15,{color:b.p.muted,role:'citation',lineHeight:1.14});
}

function diagram(b, project, slide, area, nodeBoxes) {
  if(slide.diagram?.rows)return renderAcademicDiagram(b,project,slide,area,{wrapText,measureTextWidth,semanticStyle:(kind,p)=>semanticStyle(kind,p,{academic:true})});
  const nodes = arr(slide.nodes), edges = arr(slide.edges);
  const count = nodes.length;
  if (!count) return;
  if(b.design.projection&&!nodeBoxes&&!nodes.some(n=>n.box))return renderAcademicDiagram(b,project,{...slide,diagram:{rows:automaticDiagramRows(nodes)}},area,{wrapText,measureTextWidth,semanticStyle:(kind,p)=>semanticStyle(kind,p,{academic:true})});
  const columns = Math.min(count, count === 4 ? 2 : 3), rows = Math.ceil(count / Math.max(columns, 1));
  const labelSize=Math.max(24,b.design.projection?.labelMin??0),detailSize=Math.max(22,b.design.projection?.labelMin??0),edgeSize=Math.max(17,b.design.projection?.labelMin??0);
  const gap = 55, rowGap = 46;
  const w = (area.w - (columns - 1) * gap) / Math.max(columns, 1), h = Math.min(132,(area.h - (rows - 1) * rowGap) / Math.max(rows, 1));
  const boxes = new Map(nodes.map((n, i) => [n.id, n.box || nodeBoxes?.[i] || { x: area.x + (i % columns) * (w + gap), y: area.y + 14 + Math.floor(i / columns) * (h + rowGap), w, h }]));
  const route=(index,points,edge)=>{
    for(let k=0;k<points.length-1;k++){
      const a=points[k],z=points[k+1];
      b.line(points.length===2?`edge:${index}`:`edge:${index}:segment:${k}`,a.x,a.y,z.x,z.y,edge.kind==='feedback'?b.p.secondary:b.p.accent,{strokeWidth:1.6,...(edge.kind==='feedback'?{dash:'dash'}:{}),...(k===points.length-2&&edge.kind!=='association'?{endArrow:true}:{})});
    }
    if(edge.label){
      const k=Math.floor((points.length-1)/2),a=points[k],z=points[k+1],mid={x:(a.x+z.x)/2,y:(a.y+z.y)/2};
      const lw=Math.min(190,Math.max(80,measureTextWidth(edge.label,edgeSize)+12)),lh=b.design.projection?Math.max(24,wrapText(edge.label,lw,edgeSize).length*edgeSize*1.1):24;
      b.text(`edge:${index}:label`,edge.label,{x:Math.max(area.x,Math.min(area.x+area.w-lw,mid.x-lw/2)),y:Math.max(area.y,mid.y-lh),w:lw,h:lh},edgeSize,{align:'center',color:b.p.muted,role:'diagram-label',lineHeight:1.1});
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
    b.region(`node:${n.id}`,box,'diagram-node');
    const semantic=semanticStyle(n.kind||'method',b.p,{academic:b.design?.hasAcademicSystem});
    const pad=12,iw=box.w-pad*2,labelH=Math.max(28,wrapText(n.label,iw,labelSize,{bold:true}).length*(b.design.projection?labelSize*1.16:28)),hasDetail=Boolean(n.detail),small=box.h<88,detailGap=small?1:5,labelY=hasDetail?box.y+(small?4:10):box.y+Math.max(8,(box.h-labelH)/2);
    b.rect(`node:${n.id}:frame`,box,n.kind?semantic.tint:b.p.paper,b.p.line,{strokeWidth:1.2,...(n.kind==='hypothesis'?{dash:'dash'}:{})});
    b.line(`node:${n.id}:heading-rule`,box.x,box.y,box.x+box.w,box.y,semantic.accent,{strokeWidth:2});
    b.text(`node:${n.id}:label`,n.label,{x:box.x+pad,y:labelY,w:iw,h:labelH},labelSize,{bold:true,color:semantic.accent,align:'center',lineHeight:1.16,role:'diagram-label'});
    if(hasDetail)b.text(`node:${n.id}:detail`,n.detail,{x:box.x+pad,y:labelY+labelH+detailGap,w:iw,h:Math.max(22,box.y+box.h-(small?3:9)-(labelY+labelH+detailGap))},detailSize,{color:b.p.ink,align:'center',lineHeight:1.18,role:'diagram-body'});
  }
}

function scientificPlot(b,data,box,options) {
  if(!data?.id)return renderScientificPlot(b,data,box,options);
  const prefix=`plots/${data.id}/`,scoped={...b};
  const fullPrefix=`${b.page.id}/${prefix}`;
  scoped.regions=b.regions.filter(r=>r.id.startsWith(fullPrefix)).map(r=>({...r,id:`${b.page.id}/${r.id.slice(fullPrefix.length)}`}));
  for(const name of ['rect','line','text','region'])scoped[name]=(key,...args)=>b[name](prefix+key,...args);
  scoped.add=(kind,key,...args)=>b.add(kind,prefix+key,...args);
  const start=b.page.issues.length,result=renderScientificPlot(scoped,data,box,options);
  for(const issue of b.page.issues.slice(start))if(issue.objectId?.startsWith(`${b.page.id}/data-plot`))issue.objectId=issue.objectId.replace(`${b.page.id}/`,fullPrefix);
  return result;
}

/** Content-based academic tables: real cells in PPTX and the same wrapping in SVG. */
function table(b, data, box, fontFamily) {
  const columns=arr(data.columns),rows=arr(data.rows),all=[columns,...rows],fontSize=Math.max(b.design?.hasAcademicSystem?(b.system?.bodySize??24):23,b.design.projection?.labelMin??0),captionSize=Math.max(b.system?.captionSize??18,b.design.projection?.noteMin??0),lineHeight=1.22,padX=10,padY=7;
  if(!columns.length||rows.some(row=>!Array.isArray(row)||row.length!==columns.length)){
    b.page.issues.push({severity:'error',code:'invalid-table-shape',slideId:b.page.id,message:'表格必须包含列名，且每行单元格数量必须与列数相同。'});return;
  }
  const weights=data.columnWeights||columns.map(()=>1);
  if(weights.length!==columns.length||weights.some(w=>!Number.isFinite(w)||w<=0)){b.page.issues.push({severity:'error',code:'invalid-table-widths',slideId:b.page.id,message:'columnWeights 必须与表格列数一致，并使用正数比例。'});return;}
  const sum=weights.reduce((a,z)=>a+z,0),colWidths=weights.map(w=>box.w*w/sum),wrapReserve=fontSize*.55;
  // Native PowerPoint tables may grow rows when glyph widths trigger an
  // additional wrap. Keep a small conservative reserve inside the real cell
  // margins so caption placement does not depend on a near-boundary estimate.
  const cellLines=all.map((row,ri)=>row.map((value,i)=>wrapText(value,Math.max(1,colWidths[i]-padX*2-wrapReserve),fontSize,{bold:ri===0})));
  const rowHeights=cellLines.map(row=>Math.max(...row.map(lines=>lines.length))*fontSize*lineHeight+padY*2);
  const h=rowHeights.reduce((sum,value)=>sum+value,0),captionH=data.caption?wrapText(data.caption,box.w,captionSize).length*captionSize*1.24+7:0;
  b.region('data-table-region',{x:box.x,y:box.y,w:box.w,h:h+captionH},'table');
  if(h+captionH>box.h+2)b.page.issues.push({severity:'error',code:'table-overflow-estimate',slideId:b.page.id,objectId:`${b.page.id}/data-table`,message:`表格按${fontSize*.75}pt正文需要 ${Math.ceil(h+captionH)} px，区域只有 ${box.h} px；减少行列或拆页，不能缩小正文隐藏内容。`});
  b.add('table','data-table',{x:box.x,y:box.y,w:box.w,h,table:clone(data),colWidths,rowHeights,cellLines,fontFamily,fontSize,lineHeight,padX,padY,wrapReserve,palette:clone(b.p),academicStyle:b.design?.hasAcademicSystem?b.system.panel:'line'});
  if(data.caption)b.text('table-caption',data.caption,{x:box.x,y:box.y+h+7,w:box.w,h:Math.max(22,captionH-7)},captionSize,{color:b.p.muted,lineHeight:1.24,role:'caption'});
  return {bottom:box.y+h+captionH,height:h+captionH};
}

function references(b,project,slide,box) {
  const selectedIds=effectiveBibliographyIds(project,slide);
  const selected=arr(project.papers).filter(p=>selectedIds.includes(p.id));
  let y=box.y;
  for(const [i,p] of selected.entries()){
    const titleW=box.w-70,titleH=wrapText(p.title,titleW,24,{bold:true}).length*28.8;
    const indexLabel=referenceLabel(project,p.id);
    const meta=[arr(p.authors).join(', '),p.journal,p.year,p.doi?`DOI: ${p.doi}`:p.url,p.version].filter(Boolean).join(' · '),metaH=wrapText(meta,titleW,18).length*22.3;
    b.text(`ref:${p.id}:id`,indexLabel,{x:box.x,y:y+2,w:58,h:32},22,{color:b.p.accent,bold:true,role:'reference-index'});
    b.text(`ref:${p.id}:title`,p.title,{x:box.x+70,y,w:titleW,h:titleH},24,{bold:true,lineHeight:1.2,role:'reference-title',referenceId:p.id});
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
  const flow=ref.tableFlow,flowIndexes=new Set(arr(flow?.cardIndexes));
  for(const [i,panel] of arr(s.panels).entries()){
    const {x,y,w,h}=panel,key=`panel:${i}`,style=panel.style||'academic-panel',semantic=semanticStyle(panel.kind,b.p,{academic:b.design?.hasAcademicSystem}),accent=semantic.accent,tint=semantic.tint;
    if(style==='academic-side'){
      b.rect(`${key}:frame`,{x,y,w,h},b.p.paper,b.p.line,{strokeWidth:1.1});
      b.rect(`${key}:side-mark`,{x:x+1,y:y+8,w:5,h:29},accent,'none');
      b.text(`${key}:title`,slide.panelTitles?.[i]??panel.title,{x:x+16,y:y+5,w:w-32,h:32},26,{bold:true,color:accent,lineHeight:1.15,role:'panel-title'});
    }else if(style==='academic-tab'){
      b.rect(`${key}:frame`,{x,y:y+12,w,h:h-12},b.p.paper,b.p.line,{strokeWidth:1.1});
      const title=slide.panelTitles?.[i]??panel.title,tw=Math.min(w-28,Math.max(118,measureTextWidth(title,26,{bold:true})+38));
      b.rect(`${key}:tab`,{x:x+12,y,w:tw,h:36},accent,'none');
      b.text(`${key}:title`,title,{x:x+23,y:y+3,w:tw-22,h:30},26,{bold:true,color:'#FFFFFF',lineHeight:1.15,role:'panel-title'});
    }else{
      b.rect(`${key}:frame`,{x,y,w,h},b.p.paper,b.p.line,{strokeWidth:1.1});
      b.rect(`${key}:heading-fill`,{x:x+1,y:y+1,w:w-2,h:40},tint,'none');
      b.line(`${key}:heading-rule`,x,y+41,x+w,y+41,b.p.line,{strokeWidth:1});
      b.text(`${key}:title`,slide.panelTitles?.[i]??panel.title,{x:x+13,y:y+5,w:w-26,h:32},26,{bold:true,color:accent,lineHeight:1.15,role:'panel-title'});
    }
  }
  if(s.paperTitle)paperTitle(b,project,slide,s.paperTitle);
  if(s.subtitle&&slide.subtitle)b.text('subtitle',slide.subtitle,s.subtitle,24,{lineHeight:1.24,color:b.p.muted,role:'subtitle'});
  const hasTakeaway=s.takeaway&&slide.takeaway&&!(s.subtitle&&slide.takeaway===slide.subtitle);
  if(hasTakeaway&&!flow?.takeawayAfterCards)b.text('takeaway',slide.takeaway,s.takeaway,24,{bold:true,lineHeight:1.2,color:b.p.accent,role:'takeaway'});
  figures.forEach((id,i)=>{if(s.figures?.[i])figure(b,project,id,s.figures[i],`figure:${i}`);});
  if(s.chart&&slide.chart)b.add('chart','data-chart',{...s.chart,chart:clone(slide.chart),palette:clone(b.p),fontFamily:project.design?.fontFamily||DEFAULT_DESIGN.fontFamily});
  const tableExtent=s.table&&slide.table?table(b,slide.table,s.table,project.design?.fontFamily||DEFAULT_DESIGN.fontFamily):undefined;
  if(s.diagram)diagram(b,project,slide,s.diagram,s.nodeBoxes);
  if(s.references)references(b,project,slide,s.references);
  let flowBottom=tableExtent?.bottom;
  if(flow&&!tableExtent)b.page.issues.push({severity:'error',code:'table-flow-missing-table',slideId:b.page.id,message:'此参考页需要有效表格才能安排其后解释，不能以空表区域代替证据。'});
  cards.forEach((c,i)=>{
    if(!s.cards?.[i])return;
    let box=c.box||s.cards[i];
    if(flowIndexes.has(i)&&tableExtent){
      if(!c.box){
        // A full-width explanation must clear a side note as well as the
        // table; a shorter table is not permission to slide through that note.
        const sideBottom=Math.max(0,...cards.flatMap((other,j)=>{
          if(j===i||flowIndexes.has(j)||!s.cards?.[j])return [];
          const sibling=other.box||s.cards[j];
          return Math.min(box.x+box.w,sibling.x+sibling.w)-Math.max(box.x,sibling.x)>2?[sibling.y+sibling.h]:[];
        }));
        box={...box,y:Math.max(tableExtent.bottom,sideBottom)+(flow.gap??24)};
      }
      flowBottom=Math.max(flowBottom,box.y+box.h);
      if(box.y<tableExtent.bottom+8||box.y+box.h>645)b.page.issues.push({severity:'error',code:'table-flow-overflow',slideId:b.page.id,cardId:c.id,message:'表格后的解释区域与证据相碰或超出正文区。减少表格内容、调整说明或拆页，保留原字号。'});
    }
    card(b,c,box,i,project,box.h<110?'compact':undefined);
  });
  if(hasTakeaway&&flow?.takeawayAfterCards){
    const box={...s.takeaway,y:flowBottom===undefined?s.takeaway.y:flowBottom+12};
    b.text('takeaway',slide.takeaway,box,24,{bold:true,lineHeight:1.2,color:b.p.accent,role:'takeaway'});
    if(box.y+box.h>645)b.page.issues.push({severity:'error',code:'table-flow-overflow',slideId:b.page.id,message:'表格及解释后的结论超出正文区，需调整内容层次或拆页。'});
  }
}

const intersection = (a,b) => ({w:Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),h:Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)});
const intersects = (a,b) => {const hit=intersection(a,b);return hit.w>2&&hit.h>2;};
const validBox = box => ['x','y','w','h'].every(key=>Number.isFinite(box[key]))&&box.w>0&&box.h>0;

/** Check only semantic containers and painted content, never background shapes,
 * borders, paper shadows or title-tab cutouts. Native table cells are kept in
 * their table node and are not treated as overlapping external text objects.
 */
function inspectLayout(b) {
  const page=b.page,regions=b.regions.filter(validBox),texts=page.nodes.filter(n=>n.kind==='text');
  const fail=(code,first,second,message)=>page.issues.push({severity:'error',code,slideId:page.id,objectId:first.id,...(second?{relatedObjectId:second.id}:{}),message});
  for(let i=0;i<regions.length;i++)for(let j=i+1;j<regions.length;j++){
    const first=regions[i],second=regions[j];
    if(intersects(first,second))fail('content-region-overlap',first,second,`正文区域 ${first.id} 与 ${second.id} 相撞。调整这两个区域的位置或尺寸，背景、边框和题签不参与此检查。`);
  }
  const ink=text=>text.lines.flatMap((line,i)=>{
    if(!line.trim())return [];
    const w=text.estimatedLineWidths?.[i]??measureTextWidth(line,text.fontSize,{bold:text.bold});
    const x=text.align==='center'?text.x+(text.w-w)/2:text.align==='right'?text.x+text.w-w:text.x;
    return [{x,y:text.y+i*text.fontSize*text.lineHeight+text.fontSize*.03,w,h:text.fontSize*1.02}];
  });
  const painted=texts.map(node=>({node,boxes:ink(node)}));
  for(const item of painted){
    const owner=item.node.cardId?regions.find(r=>r.type==='card'&&r.id===`${page.id}/card/${item.node.cardId}`):undefined;
    if(owner&&item.boxes.some(box=>box.x<owner.x-2||box.y<owner.y-2||box.x+box.w>owner.x+owner.w+2||box.y+box.h>owner.y+owner.h+2)){
      fail('text-outside-content-region',item.node,owner,`文字 ${item.node.id} 超出所属卡片 ${owner.id}；扩大本卡片、调整内部排布或拆页，不能延伸到相邻内容。`);
    }
    if(item.boxes.some(box=>box.x< -1||box.y< -1||box.x+box.w>1281||box.y+box.h>721))fail('text-outside-slide',item.node,undefined,'文字的实际估计行范围超出页面；完整文字已保留，需调整区域或拆页。');
  }
  for(let i=0;i<painted.length;i++)for(let j=i+1;j<painted.length;j++){
    const first=painted[i],second=painted[j];
    if(first.boxes.some(a=>second.boxes.some(z=>intersects(a,z))))fail('text-overlap-estimate',first.node,second.node,`文字 ${first.node.id} 与 ${second.node.id} 的行范围相撞；调整位置或内容分配后重新渲染。`);
  }
  for(const item of painted)for(const object of page.nodes.filter(n=>['image','chart','table'].includes(n.kind)&&validBox(n))){
    if(item.boxes.some(box=>intersects(box,object)))fail('text-evidence-overlap',item.node,object,`文字 ${item.node.id} 覆盖证据对象 ${object.id}；为解释、图表及图注保留独立可读区域。`);
  }
}

export function buildScenes(project) {
  const design = resolveDesign(project.design), slides = arr(project.slides);
  const pages = slides.map((slide, index) => {
    const b = pageBuilder(slide, index, slides.length, design), cards = arr(slide.cards), figures = arr(slide.figureIds);
    if(slide.figureBoxes?.length&&(slide.referenceTemplateId||!['figure-focus','figure-split'].includes(slide.layout)||slide.figureBoxes.length!==figures.length||cards.some(c=>!c.box)))b.page.issues.push({severity:'error',code:'invalid-custom-figure-layout',slideId:b.page.id,message:'自定义图框只用于无参考模板的 figure-focus / figure-split，图框与原图一一对应，所有解释卡片必须指定区域。'});
    let contentBox=CONTENT;
    if(!['cover','section'].includes(slide.layout)){
      if(slide.heading)contentBox=renderAuthoredHeading(b,project,slide,{wrapText,measureTextWidth});
      else if(design.hasAcademicSystem||slide.composition||slide.layout==='academic'||slide.section||slide.chrome||design.chrome)contentBox=academicHeader(b,project,slide,{wrapText,measureTextWidth});
      else header(b,slide);
    }
    b.page.contentBox={...contentBox};
    // Explicit chrome opts legacy automatic layouts into the same recovered
    // body area as composition. Authored boxes and untouched old projects keep
    // their coordinates; media aspect ratios and text sizes are not stretched.
    const bodyBox=slide.heading||slide.chrome||design.chrome?contentBox:CONTENT;
    const layoutBox=box=>({...box,y:bodyBox.y+Math.max(0,box.y-CONTENT.y)*bodyBox.h/CONTENT.h,h:box.h*bodyBox.h/CONTENT.h});
    // Authored figure boxes use the same recovered body area as their header.
    // Untouched legacy projects retain their previously accepted safe bounds.
    if(slide.figureBoxes?.length){
      const area=slide.chrome||design.chrome?contentBox:{x:36,y:132,w:1208,h:526};
      for(const box of slide.figureBoxes)if(box.x<area.x||box.y<area.y||box.x+box.w>area.x+area.w||box.y+box.h>area.y+area.h)b.page.issues.push({severity:'error',code:'custom-figure-outside-content',slideId:b.page.id,path:'slides.'+slide.id,message:`自定义证据图框需位于本页实际正文区域 x=${area.x}–${area.x+area.w}、y=${area.y}–${area.y+area.h} 内；调整图框，不能覆盖标题或来源。`});
    }
    if(slide.composition&&['cover','section'].includes(slide.layout))b.page.issues.push({severity:'error',code:'composition-layout',slideId:slide.id,message:'cover/section不消费composition；请使用对应完整题名布局或academic自由区域。'});
    if(slide.closing&&slide.layout!=='closing')b.page.issues.push({severity:'error',code:'closing-layout',slideId:b.page.id,message:'closing设计只用于layout:closing页面。'});
    if(slide.closing&&slide.composition)b.page.issues.push({severity:'error',code:'closing-composition-conflict',slideId:b.page.id,message:'closing设计与composition是两种独立构图方式，不能同时指定。'});
    const ref=slide.referenceTemplateId?getReferenceTemplate(slide.referenceTemplateId):undefined;
    if(slide.referenceTemplateId&&!ref)b.page.issues.push({severity:'error',code:'unknown-reference-template',slideId:b.page.id,message:`未找到参考页型 ${slide.referenceTemplateId}；不能静默替换成其他版式。`});
    else if(slide.layout==='cover'){
      if(design.hasAcademicSystem||['split','editorial','custom'].includes(slide.cover?.variant)||slide.cover?.boxes||slide.cover?.align||slide.cover?.assetId||slide.cover?.icon||slide.cover?.visualCaption)academicCover(b,project,slide,{wrapText,measureTextWidth});else cover(b,slide);
    }
    else if(slide.layout==='section')academicSection(b,project,slide,{wrapText,measureTextWidth});
    else if(slide.layout==='closing'&&slide.closing)academicClosing(b,project,slide,{wrapText,measureTextWidth,card,contentBox});
    else if(slide.composition)renderAcademicComposition(b,project,slide,{card,figure,table,diagram,plot:scientificPlot,wrapText,measureTextWidth,clone,design,contentBox});
    else if(slide.layout==='academic'&&!slide.drawings?.length)b.page.issues.push({severity:'error',code:'academic-composition-missing',slideId:b.page.id,message:'academic 页需 composition.rows、composition.regions 或明确定位的drawings；不能退化为默认介绍卡。'});
    else if(ref)referenceLayout(b,project,slide,ref);
    else if(slide.layout==='paper'){
      const paperBox=bodyBox===CONTENT?{x:48,y:128,w:1184,h:120}:layoutBox({x:48,y:132,w:1184,h:120});
      const paperExtent=paperTitle(b,project,slide,paperBox);
      if(design.projection){
        const y=(paperExtent?.bottom??paperBox.y)+18,h=bodyBox.y+bodyBox.h-y;
        if(h<=0)b.page.issues.push({severity:'error',code:'paper-content-space',slideId:slide.id,message:'完整论文题名与书目信息占满正文，须重排或拆页。'});
        if(figures.length){figure(b,project,figures[0],{x:48,y,w:cards.length?716:1184,h:Math.max(1,h)},'figure:0');if(cards.length)cardsGrid(b,cards,{x:796,y,w:436,h:Math.max(1,h)},1,project);}
        else cardsGrid(b,cards,{x:48,y,w:1184,h:Math.max(1,h)},Math.min(Math.max(cards.length,1),2),project);
      }else if(figures.length){
        figure(b,project,figures[0],layoutBox({x:48,y:268,w:cards.length?716:1184,h:377}),'figure:0');
        cardsGrid(b,cards,layoutBox({x:796,y:268,w:436,h:377}),1,project,24);
      }else cardsGrid(b,cards,layoutBox({x:48,y:270,w:1184,h:375}),Math.min(Math.max(cards.length,1),2),project);
    }else if(slide.layout==='figure-focus'){
      const main=arr(project.assets).find(a=>a.id===figures[0]),ratio=main?(main.width*(main.viewport?.w??1))/(main.height*(main.viewport?.h??1)):1;
      const portrait=cards.length&&ratio<.9,fw=cards.length?(portrait?426:792):1184;
      if(figures[0])figure(b,project,figures[0],layoutBox({x:48,y:132,w:fw,h:513}),'figure:0');
      if(cards.length)cardsGrid(b,cards,layoutBox({x:48+fw+28,y:132,w:1184-fw-28,h:513}),1,project,24);
    }else if(['figure-split','results'].includes(slide.layout)){
      const area=layoutBox({x:48,y:136,w:cards.length?790:1184,h:509});
      if(figures.length>=2){const boxes=pairedFigureBoxes(project,figures,area,24);figures.slice(0,2).forEach((id,i)=>figure(b,project,id,boxes[i],`figure:${i}`));}
      else if(figures[0])figure(b,project,figures[0],area,'figure:0');
      else if(slide.plot)renderScientificPlot(b,slide.plot,area,{fontFamily:design.fontFamily,wrapText,measureTextWidth});
      else if(slide.chart)b.add('chart','data-chart',{...area,chart:clone(slide.chart),palette:clone(b.p),fontFamily:design.fontFamily});
      else if(slide.table)table(b,slide.table,area,design.fontFamily);
      if(cards.length)cardsGrid(b,cards,layoutBox({x:868,y:136,w:364,h:509}),1,project,24);
    }else if(slide.layout==='comparison'){
      if(figures.length>=2){
        figures.slice(0,2).forEach((id,i)=>figure(b,project,id,layoutBox({x:48+i*606,y:132,w:578,h:cards.length?337:513}),`figure:${i}`));
        if(cards.length)cardsGrid(b,cards,layoutBox({x:48,y:497,w:1184,h:148}),Math.min(cards.length,2),project);
      }else if(slide.table){
        table(b,slide.table,layoutBox({x:48,y:138,w:cards.length?808:1184,h:507}),design.fontFamily);
        if(cards.length)cardsGrid(b,cards,layoutBox({x:890,y:138,w:342,h:507}),1,project);
      }else cardsGrid(b,cards,bodyBox,Math.min(Math.max(cards.length,1),2),project);
    }else if(slide.layout==='method'){
      diagram(b,project,slide,layoutBox({x:60,y:132,w:1160,h:cards.length?286:499}));
      if(cards.length)cardsGrid(b,cards,layoutBox({x:48,y:450,w:1184,h:195}),Math.min(cards.length,3),project);
    }else if(slide.layout==='roadmap'){
      const gap=24,count=Math.max(cards.length,1),h=(bodyBox.h-gap*(count-1))/count;
      cards.forEach((c,i)=>{const y=bodyBox.y+i*(h+gap);b.text(`roadmap:${i}:number`,String(i+1).padStart(2,'0'),{x:48,y:y+2,w:63,h:42},29,{color:b.p.accent,bold:true,role:'index'});card(b,c,c.box||{x:128,y,w:1104,h},i,project);});
    }else if(slide.layout==='references'){if(design.projection||slide.referenceIds)renderBibliography(b,project,effectiveBibliographyIds(project,slide),bodyBox,{wrapText});else references(b,project,slide,bodyBox);}
    else if(slide.layout==='academic'&&slide.drawings?.length){}
    else{
      let y=bodyBox.y;
      for(const field of ['subtitle','takeaway']){
        if(!slide[field]||(field==='takeaway'&&slide.takeaway===slide.subtitle))continue;
        const size=Math.max(26,design.projection?.bodyMin??0),h=Math.max(34,wrapText(slide[field],1184,size,{bold:field==='takeaway'}).length*size*1.2);
        b.text(field,slide[field],{x:48,y,w:1184,h},size,{bold:field==='takeaway',color:field==='takeaway'?b.p.accent:b.p.ink,lineHeight:1.2,role:field});
        y+=h+25;
      }
      cardsGrid(b,cards,{x:48,y,w:1184,h:Math.max(40,bodyBox.y+bodyBox.h-y)},Math.min(Math.max(cards.length,1),2),project);
    }
    if(slide.heading&&['cover','section'].includes(slide.layout))b.page.issues.push({severity:'error',code:'heading-layout',slideId:slide.id,message:'cover/section使用完整题名布局，不支持叠加heading。'});
    if(!slide.composition)for(const drawing of arr(slide.drawings)){
      if(!drawing.box){b.page.issues.push({severity:'error',code:'drawing-box-required',slideId:slide.id,drawingId:drawing.id,message:'没有composition时，每个drawing必须提供页面坐标box。'});continue;}
      const area=['cover','section'].includes(slide.layout)?{x:0,y:0,w:1280,h:720}:contentBox;
      const box=drawing.box;
      if(box.x<area.x-.01||box.y<area.y-.01||box.x+box.w>area.x+area.w+.01||box.y+box.h>area.y+area.h+.01)b.page.issues.push({severity:'error',code:'drawing-outside-content',slideId:slide.id,drawingId:drawing.id,message:'绘图区域越过本页实际正文范围；调整标题、来源和绘图的分配。'});
      renderNativeDrawing(b,project,drawing,box,{wrapText});
    }
    footerSources(b,project,slide);
    const noteIds=new Set(arr(slide.paperIds)),noteClaims=new Set([...arr(slide.claimIds),...cards.flatMap(c=>arr(c.claimIds)),...drawingClaimIds(slide)]);
    for(const claim of arr(project.claims))if(noteClaims.has(claim.id)&&claim.paperId)noteIds.add(claim.paperId);
    for(const asset of arr(project.assets))if([...figures,...drawingAssetIds(slide)].includes(asset.id)&&asset.paperId)noteIds.add(asset.paperId);
    const notePapers = arr(project.papers).filter(p => noteIds.has(p.id));
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
    if (slide.plot && !b.page.nodes.some(n => n.id.startsWith(`${b.page.id}/data-plot`))) b.page.issues.push({ severity: 'error', code: 'unrendered-plot', slideId: b.page.id, message: '输入科学图未显示；在 composition 面板声明 plot:true，或使用没有其他主载体的 results 页。' });
    for(const plot of slide.plots??[])if(!b.page.nodes.some(n=>n.id.startsWith(`${b.page.id}/plots/${plot.id}/data-plot`)))b.page.issues.push({severity:'error',code:'unrendered-plot',slideId:b.page.id,plotId:plot.id,message:'plots 中的每幅科学图必须在 composition 中恰好由一个 panel.plotId 引用。'});
    if (slide.table && !b.page.nodes.some(n => n.kind === 'table')) b.page.issues.push({ severity: 'error', code: 'unrendered-table', slideId: b.page.id, message: '输入表格未显示；选择有 table 区域的参考页型，或单独使用 comparison / results 页。' });
    for (const n of arr(slide.nodes)) if (!b.page.nodes.some(shape => shape.id === `${b.page.id}/node:${n.id}:frame`)) b.page.issues.push({ severity: 'error', code: 'unrendered-diagram-node', slideId: b.page.id, nodeId: n.id, message: '输入流程节点未显示；使用有 diagram 区域的参考页型或 method 页。' });
    arr(slide.edges).forEach((edge, i) => { if (!b.page.nodes.some(shape => shape.id === `${b.page.id}/edge:${i}` || shape.id.startsWith(`${b.page.id}/edge:${i}:`))) b.page.issues.push({ severity: 'error', code: 'unrendered-diagram-edge', slideId: b.page.id, edge, message: '输入流程连线未显示；选择支持 diagram 的页型并检查节点。' }); });
    for (const field of ['subtitle', 'takeaway']) if (asText(slide[field]).trim() && !b.page.nodes.some(n => n.kind === 'text' && n.text === slide[field])) b.page.issues.push({ severity: 'error', code: `unrendered-${field}`, slideId: b.page.id, message: `${field} 在当前页型没有可见区域。将必要内容写入卡片，或使用支持该字段的页型；必须展示所有输入限定后才能完成审核。` });
    for(const drawing of arr(slide.drawings))if(!b.page.drawings?.some(d=>d.id===drawing.id))b.page.issues.push({severity:'error',code:'unrendered-drawing',slideId:slide.id,drawingId:drawing.id,message:'输入自由绘图未显示，须在composition中分配drawingIds或提供独立box。'});
    for(const referenceId of arr(slide.referenceIds))if(!b.page.nodes.some(n=>n.referenceId===referenceId&&n.role==='reference-title'))b.page.issues.push({severity:'error',code:'unrendered-reference',slideId:slide.id,paperId:referenceId,message:'输入完整书目未在画面显示，须在composition区域分配referenceIds。'});
    for (const node of b.page.nodes) {
      if (![node.x, node.y, node.w, node.h].every(Number.isFinite)) b.page.issues.push({ severity: 'error', code: 'invalid-geometry', slideId: b.page.id, objectId: node.id, message: '对象坐标必须是有限数值。' });
      if (node.kind !== 'line' && (node.w <= 0 || node.h <= 0 || node.x < -1 || node.y < -1 || node.x + node.w > 1281 || node.y + node.h > 721)) b.page.issues.push({ severity: 'error', code: 'out-of-bounds', slideId: b.page.id, objectId: node.id, message: '对象尺寸无效或超出页面。' });
    }
    for(const node of b.page.nodes)if(node.kind==='chart'&&design.projection)node.projection={...design.projection};
    b.page.issues.push(...projectionIssues(b.page,design.projection));
    inspectLayout(b);
    return b.page;
  });
  return { ...CANVAS, design, pages, issues: pages.flatMap(p => p.issues) };
}
