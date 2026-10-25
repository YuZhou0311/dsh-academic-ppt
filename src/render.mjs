/** Native PPTX export and a self-contained SVG/HTML presentation from one scene graph. */
import PptxGenJS from 'pptxgenjs';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { buildScenes } from './scene.mjs';
import { chartDisplayValue, chartValueFormat } from './chart-labels.mjs';

const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const hex = value => /^#[a-f\d]{6}$/i.test(String(value)) ? value.slice(1) : '171C22';
const abort = signal => { if (signal?.aborted) throw signal.reason || new Error('操作已取消'); };
const inch = px => px / 96;
const pos = n => ({ x: inch(n.x), y: inch(n.y), w: inch(n.w), h: inch(n.h) });
const drawColors = p => [p.accent, p.secondary, p.gold, '#70859A', '#385866', '#929EAB'];
const chartScale = values => {
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values), span = hi - lo || 1;
  const rawStep = span / 4, base = 10 ** Math.floor(Math.log10(rawStep));
  const step = ([1, 2, 2.5, 5, 10].find(n => n * base >= rawStep) || 10) * base;
  const min = Math.floor(lo / step) * step, max = Math.ceil(hi / step) * step;
  return { min, max: max === min ? min + step * 4 : max, step };
};

// LibreOffice imports an omitted category-label rotation as permission to thin
// labels, even with tickLblSkip=1. Explicit rot="0" keeps the scene's category
// labels upright and disables that suppression (oox/source/drawingml/chart/axisconverter.cxx).
// PptxGenJS 4.0.1 tests catAxisLabelRotate for truthiness, so its public option
// cannot serialize zero. Preserve any rotation already explicitly serialized.
function explicitCategoryLabelRotation(bytes) {
  const parts=unzipSync(bytes);let changed=false;
  for(const path of Object.keys(parts).filter(path=>/^ppt\/charts\/chart\d+\.xml$/.test(path))){
    const xml=strFromU8(parts[path]);
    const updated=xml.replace(/<c:catAx\b[^>]*>[\s\S]*?<\/c:catAx>/g,axis=>axis.replace(/(<c:txPr>\s*<a:bodyPr)\b(?![^>]*\brot=)/,'$1 rot="0"'));
    if(updated!==xml){parts[path]=strToU8(updated);changed=true;}
  }
  return changed?Buffer.from(zipSync(parts,{level:6})):Buffer.from(bytes);
}

// Every dynamic SVG attribute goes through the same XML attribute encoder.
// Paint values are additionally restricted: template fields cannot request external SVG resources.
const paint = (value, fallback = 'none') => /^#[a-f\d]{6}$/i.test(String(value)) ? String(value) : value === 'none' ? 'none' : fallback;
const svgEl = (name, attributes = {}, content = null) => {
  const attrs = Object.entries(attributes).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => `${key}="${esc(value)}"`).join(' ');
  return content === null ? `<${name}${attrs ? ' ' + attrs : ''}/>` : `<${name}${attrs ? ' ' + attrs : ''}>${content}</${name}>`;
};

/** SVG numeric charts retain the exact supplied values; PPTX receives a native chart. */
function chartSvg(node) {
  const c = node.chart, p = node.palette, colors = drawColors(p).map(v => paint(v, '#315B70')), horizontal = c.kind === 'bar';
  const series = c.series, categories = c.categories, all = series.flatMap(s => s.values);
  const { min, max, step } = chartScale(all), span = max - min;
  const x0 = node.x + (horizontal ? 151 : 76), y0 = node.y + 39, width = node.w - (horizontal ? 195 : 120), height = node.h - 123;
  const vx = v => x0 + ((v - min) / span) * width, vy = v => y0 + height - ((v - min) / span) * height;
  let out = svgEl('rect', { x: node.x, y: node.y, width: node.w, height: node.h, fill: paint(p.paper, '#FFFFFF') });
  const text = (x, y, v, anchor = 'start', size = 20, color = p.muted) => svgEl('text', { x, y, 'text-anchor': anchor, 'font-size': Math.max(size,node.projection?.labelMin||0), fill: paint(color, '#4F5D6A'), 'font-family': node.fontFamily }, esc(v));
  const line = (x1, y1, x2, y2, color = p.line, sw = 1) => svgEl('line', { x1, y1, x2, y2, stroke: paint(color, '#CFD7DA'), 'stroke-width': sw });
  for (let i = 0; i <= Math.round(span / step); i++) {
    const value = min + step * i, label = Number(value.toPrecision(4));
    out += horizontal ? line(vx(value), y0, vx(value), y0 + height) + text(vx(value), y0 + height + 28, label, 'middle')
      : line(x0, vy(value), x0 + width, vy(value)) + text(x0 - 11, vy(value) + 5, label, 'end');
  }
  categories.forEach((category, i) => {
    out += horizontal ? text(x0 - 12, y0 + (i + .5) / categories.length * height + 5, category, 'end', 21, p.ink)
      : text(x0 + (i + .5) / categories.length * width, y0 + height + 31, category, 'middle', 21, p.ink);
  });
  for (const [s, seriesData] of series.entries()) {
    if (c.kind === 'line') {
      const points = seriesData.values.map((value, i) => `${x0 + (i + .5) / categories.length * width},${vy(value)}`);
      out += svgEl('polyline', { points: points.join(' '), fill: 'none', stroke: colors[s % colors.length], 'stroke-width': 3 });
      seriesData.values.forEach((value, i) => { out += svgEl('circle', { cx: x0 + (i + .5) / categories.length * width, cy: vy(value), r: 4, fill: colors[s % colors.length] }); });
    } else for (const [i, value] of seriesData.values.entries()) {
      const group = (horizontal ? height : width) / categories.length, thickness = group * .66 / series.length;
      const band = group * i + group * .17 + thickness * s;
      const color=colors[(series.length===1?i:s)%colors.length];
      out += horizontal ? svgEl('rect', { x: Math.min(vx(0), vx(value)), y: y0 + band, width: Math.abs(vx(value) - vx(0)), height: Math.max(1, thickness - 2), fill: color })
        : svgEl('rect', { x: x0 + band, y: Math.min(vy(0), vy(value)), width: Math.max(1, thickness - 3), height: Math.abs(vy(value) - vy(0)), fill: color });
      out += horizontal ? text(vx(value) + (value < 0 ? -8 : 8), y0 + band + thickness / 2 + 5, chartDisplayValue(value, c), value < 0 ? 'end' : 'start', 22, p.ink)
        : text(x0 + band + thickness / 2, vy(value) + (value < 0 ? 24 : -10), chartDisplayValue(value, c), 'middle', 22, p.ink);
    }
  }
  out += horizontal ? line(vx(0), y0, vx(0), y0 + height, p.ink, 1.5) : line(x0, vy(0), x0 + width, vy(0), p.ink, 1.5);
  if(series.length>1)series.forEach((s, i) => { const x = node.x + 43 + i * Math.min(230, (node.w - 86) / series.length); out += svgEl('rect', { x, y: node.y + node.h - 33, width: 15, height: 15, fill: colors[i % colors.length] }) + text(x + 24, node.y + node.h - 17, s.name, 'start', 19, p.ink); });
  out += text(node.x + node.w - 18, node.y + 25, c.unit || '', 'end', 19, p.muted);
  return svgEl('g', { 'data-object-id': node.id, role: 'img', 'aria-label': c.unit || '数据图表' }, out);
}

function tableSvg(n) {
  const p=n.palette,rows=[n.table.columns,...n.table.rows];let y=n.y,out='';
  const rowFill=ri=>ri===0?(n.academicStyle==='band'?p.accent:p.tint):(n.table.highlightRows?.includes(ri-1)?p.tint:p.paper);
  const rowInk=ri=>ri===0?(n.academicStyle==='band'?'#FFFFFF':p.accent):p.ink;
  for(let ri=0;ri<rows.length;ri++){
    let x=n.x;
    out+=svgEl('rect',{x:n.x,y,width:n.w,height:n.rowHeights[ri],fill:paint(rowFill(ri),'#FFFFFF')});
    for(let ci=0;ci<rows[ri].length;ci++){
      const lines=n.cellLines[ri][ci],tx=x+n.padX;
      const content=lines.map((line,li)=>svgEl('tspan',{x:tx,y:y+n.padY+n.fontSize*.96+li*n.fontSize*n.lineHeight},esc(line))).join('');
      out+=svgEl('text',{'data-cell':`${ri}:${ci}`,'font-family':n.fontFamily,'font-size':n.fontSize,'font-weight':ri===0?700:400,fill:paint(rowInk(ri),'#171C22')},content);
      x+=n.colWidths[ci];
    }
    y+=n.rowHeights[ri];
    out+=svgEl('line',{x1:n.x,y1:y,x2:n.x+n.w,y2:y,stroke:paint(ri===0||ri===rows.length-1?p.accent:p.line,'#C5CFDA'),'stroke-width':ri===0||ri===rows.length-1?1.3:.7});
  }
  out+=svgEl('line',{x1:n.x,y1:n.y,x2:n.x+n.w,y2:n.y,stroke:paint(p.accent,'#183B66'),'stroke-width':1.5});
  return svgEl('g',{'data-object-id':n.id,role:'table','aria-label':n.table.caption||'研究数据表'},out);
}

export function sceneToSvg(page) {
  const defs = [], nodes = [];
  const pagePrefix = Buffer.from(String(page.id || 'page')).toString('hex');
  for (const [i, n] of page.nodes.entries()) {
    const attrs = { 'data-object-id': n.id, ...(n.cardId ? { 'data-card-id': n.cardId } : {}) };
    if (n.kind === 'text') {
      const anchor = n.align === 'right' ? 'end' : n.align === 'center' ? 'middle' : 'start';
      const x = n.align === 'right' ? n.x + n.w : n.align === 'center' ? n.x + n.w / 2 : n.x;
      const lines = n.lines || [n.text];
      const text=lines.map((s,j)=>svgEl('tspan',{x,y:n.y+n.fontSize*.96+j*n.fontSize*n.lineHeight},n.richLines?.[j]?n.richLines[j].map(run=>svgEl('tspan',{'font-weight':run.bold?700:undefined,fill:run.color?paint(run.color,n.color):undefined},esc(run.text))).join(''):esc(s))).join('');
      nodes.push(svgEl('text', { ...attrs, 'font-family': n.fontFamily, 'font-size': n.fontSize, 'font-weight': n.bold ? 700 : 400, fill: paint(n.color, '#243648'), 'text-anchor': anchor }, text));
    } else if (n.kind === 'rect' || n.kind === 'ellipse') {
      let filter;
      if (n.shadow) {
        const sid = `shadow-${pagePrefix}-${i}`, angle = (n.shadow.angle ?? 45) * Math.PI / 180;
        defs.push(svgEl('filter', { id: sid, x: '-40%', y: '-40%', width: '180%', height: '180%' }, svgEl('feDropShadow', { dx: (n.shadow.offset ?? 2) * Math.cos(angle), dy: (n.shadow.offset ?? 2) * Math.sin(angle), stdDeviation: n.shadow.blur || 2, 'flood-color': paint(n.shadow.color, '#223344'), 'flood-opacity': n.shadow.opacity ?? .12 })));
        filter = `url(#${sid})`;
      }
      const style = { fill: paint(n.fill), 'fill-opacity': n.fillOpacity ?? 1, stroke: paint(n.stroke), 'stroke-opacity': n.strokeOpacity ?? 1, 'stroke-width': n.strokeWidth || 1, ...(n.dash ? { 'stroke-dasharray': n.dash === 'dot' ? '2 4' : '7 5' } : {}), filter };
      nodes.push(n.kind === 'ellipse' ? svgEl('ellipse', { ...attrs, cx: n.x + n.w / 2, cy: n.y + n.h / 2, rx: n.w / 2, ry: n.h / 2, ...style }) : svgEl('rect', { ...attrs, x: n.x, y: n.y, width: n.w, height: n.h, rx: n.radius || 0, ...style }));
    } else if (n.kind === 'line') {
      let marker;
      if (n.endArrow) {
        const aid = `arrow-${pagePrefix}-${i}`;
        defs.push(svgEl('marker', { id: aid, markerWidth: 9, markerHeight: 8, refX: 8, refY: 4, orient: 'auto' }, svgEl('path', { d: 'M 0 0 L 8 4 L 0 8', fill: 'none', stroke: paint(n.stroke, '#315B70'), 'stroke-width': 1.3 })));
        marker = `url(#${aid})`;
      }
      nodes.push(svgEl('line', { ...attrs, x1: n.x, y1: n.y, x2: n.x + n.w, y2: n.y + n.h, stroke: paint(n.stroke, '#315B70'), 'stroke-width': n.strokeWidth || 1, ...(n.dash ? { 'stroke-dasharray': n.dash === 'dot' ? '2 4' : '7 5' } : {}), 'marker-end': marker }));
    } else if (n.kind === 'image') {
      if (!/^data:image\/(?:png|jpeg);base64,[A-Za-z\d+/=\s]+$/.test(n.data || '')) throw new Error(`图像 ${n.assetId} 缺少已嵌入且经过校验的 PNG/JPEG 数据。`);
      if(n.viewport){
        const v=n.viewport,cid=`viewport-${pagePrefix}-${i}`;
        if(!['x','y','w','h'].every(key=>Number.isFinite(v[key]))||v.x<0||v.y<0||v.w<=0||v.h<=0||v.x+v.w>1.00000001||v.y+v.h>1.00000001)throw new Error(`图像 ${n.assetId} 的原图视窗无效。`);
        defs.push(svgEl('clipPath',{id:cid},svgEl('rect',{x:n.x,y:n.y,width:n.w,height:n.h})));
        nodes.push(svgEl('image',{...attrs,x:n.x-v.x*n.w/v.w,y:n.y-v.y*n.h/v.h,width:n.w/v.w,height:n.h/v.h,href:n.data,preserveAspectRatio:'none','clip-path':`url(#${cid})`},svgEl('title',{},esc(n.alt))));
      }else nodes.push(svgEl('image', { ...attrs, x: n.x, y: n.y, width: n.w, height: n.h, href: n.data, preserveAspectRatio: 'xMidYMid meet' }, svgEl('title', {}, esc(n.alt))));
    } else if (n.kind === 'chart') nodes.push(chartSvg(n));
    else if(n.kind==='table')nodes.push(tableSvg(n));
    else throw new Error(`不支持的场景对象：${n.kind}`);
  }
  return svgEl('svg', { xmlns: 'http://www.w3.org/2000/svg', 'xmlns:xlink': 'http://www.w3.org/1999/xlink', viewBox: '0 0 1280 720', width: 1280, height: 720, role: 'img', 'aria-label': page.title }, svgEl('title', {}, esc(page.title)) + svgEl('defs', {}, defs.join('')) + svgEl('rect', { x: 0, y: 0, width: 1280, height: 720, fill: paint(page.background, '#FFFFFF') }) + nodes.join(''));
}

function renderHtml(project, scenes, svgPages) {
  const slides = svgPages.map((page, i) => `<section class="slide${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="第 ${i + 1} 页">${page.svg}</section>`).join('\n');
  const notes = JSON.stringify(scenes.pages.map(p => ({ title: p.title, notes: p.notes, seconds: p.seconds }))).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(project.title)}</title><style>
  :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#1d2a36;color:#e9eff0;font-family:"Noto Sans CJK SC",system-ui,sans-serif}header{height:54px;display:flex;gap:10px;align-items:center;padding:8px 20px;background:#18242e}header strong{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px;font-weight:500}button{border:1px solid #53626d;background:transparent;color:inherit;padding:7px 11px;border-radius:4px;cursor:pointer}button:focus-visible{outline:2px solid #d4b279}#counter{min-width:70px;text-align:center;font-variant-numeric:tabular-nums}.slide{display:none;margin:auto;width:min(100vw,calc((100vh - 54px)*16/9))}.slide.active{display:block}.slide svg{width:100%;height:auto;display:block}body.overview main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;padding:20px}body.overview .slide{display:block;width:100%;cursor:pointer;box-shadow:0 2px 12px #0004}#notes{position:fixed;right:16px;bottom:16px;max-width:560px;max-height:42vh;overflow:auto;background:#fff;color:#263544;padding:22px;white-space:pre-wrap;box-shadow:0 6px 30px #0006;border-radius:6px;line-height:1.65}#notes[hidden]{display:none}.screen-reader{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}@media print{header,#notes{display:none!important}body{background:white}main{display:block!important;padding:0!important}.slide{display:block!important;width:100%!important;break-after:page;page-break-after:always}svg{width:100%}@page{size:13.3333in 7.5in;margin:0}}
  </style></head><body><header><strong>${esc(project.title)}</strong><button id="prev" aria-label="上一页">←</button><span id="counter"></span><button id="next" aria-label="下一页">→</button><button id="overview">总览 G</button><button id="show-notes">讲稿 S</button><button id="full">全屏</button></header><main>${slides}</main><aside id="notes" hidden></aside><script>
  const pages=${notes};let index=0;const frames=[...document.querySelectorAll('.slide')],notes=document.getElementById('notes');
  function go(i){index=Math.max(0,Math.min(frames.length-1,i));frames.forEach((f,j)=>f.classList.toggle('active',j===index));document.getElementById('counter').textContent=(index+1)+' / '+frames.length;notes.textContent=pages[index].title+'\\n\\n'+(pages[index].notes||'本页没有讲稿备注。');history.replaceState(null,'','#slide-'+(index+1))}
  document.getElementById('prev').onclick=()=>go(index-1);document.getElementById('next').onclick=()=>go(index+1);document.getElementById('overview').onclick=()=>document.body.classList.toggle('overview');document.getElementById('show-notes').onclick=()=>notes.hidden=!notes.hidden;document.getElementById('full').onclick=()=>document.fullscreenElement?document.exitFullscreen?.():document.documentElement.requestFullscreen?.();frames.forEach((f,i)=>f.onclick=()=>{if(document.body.classList.contains('overview')){document.body.classList.remove('overview');go(i)}});document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();go(index+1)}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();go(index-1)}if(e.key.toLowerCase()==='g')document.body.classList.toggle('overview');if(e.key.toLowerCase()==='s')notes.hidden=!notes.hidden;if(e.key==='Escape'){notes.hidden=true;document.body.classList.remove('overview')}});go((Number(location.hash.replace('#slide-',''))||1)-1);
  </script></body></html>`;
}

async function nativePptx(project, scenes, signal) {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'ACADEMIC_WIDE', width: 1280 / 96, height: 720 / 96 });
  pptx.layout = 'ACADEMIC_WIDE'; pptx.author = 'DSH Academic PPT'; pptx.subject = project.brief?.centralQuestion || '学术研究汇报'; pptx.title = project.title;
  pptx.lang = 'zh-CN'; pptx.company = ''; pptx.theme = { headFontFace: scenes.design.fontFamily, bodyFontFace: scenes.design.fontFamily, lang: 'zh-CN' };
  for (const page of scenes.pages) {
    abort(signal); const slide = pptx.addSlide(); slide.background = { color: hex(page.background) };
    for (const n of page.nodes) {
      abort(signal);
      const base = { ...pos(n), objectName: n.id };
      // Exact point spacing matches the scene's em-based baseline step.
      // A percentage of the font's natural line height adds a second leading
      // factor (notably for CJK fonts) and can overflow otherwise valid slots.
      if(n.kind==='text'){
        const value=n.richLines?n.richLines.flatMap((runs,li)=>runs.map((run,ri)=>({text:run.text,options:{bold:run.bold??!!n.bold,color:hex(run.color||n.color),breakLine:ri===runs.length-1&&li<n.richLines.length-1}}))):(n.lines||[n.text]).join('\n');
        slide.addText(value,{...base,fontFace:n.fontFamily,fontSize:n.fontSize*.75,color:hex(n.color),bold:!!n.bold,align:n.align||'left',valign:'top',margin:0,breakLine:false,lineSpacing:n.fontSize*.75*(n.lineHeight||1.28),paraSpaceAfter:0,paraSpaceBefore:0,fit:'none',wrap:false,lang:'zh-CN'});
      }
      else if (n.kind === 'rect' || n.kind === 'ellipse') {
        const fill = n.fill && n.fill !== 'none' ? { color: hex(n.fill), transparency: (1 - (n.fillOpacity ?? 1)) * 100 } : { type: 'none', transparency: 100 };
        const line = n.stroke && n.stroke !== 'none' ? { color: hex(n.stroke), transparency: (1 - (n.strokeOpacity ?? 1)) * 100, width: (n.strokeWidth || 1) * .75, dashType: n.dash === 'dot' ? 'sysDot' : n.dash ? 'dash' : 'solid' } : { color: 'FFFFFF', transparency: 100 };
        const shadow = n.shadow ? { type: 'outer', color: hex(n.shadow.color || '#223344'), opacity: n.shadow.opacity ?? .12, blur: Math.max(.1, (n.shadow.blur || 2) * .75), offset: Math.max(.1, (n.shadow.offset || 2) * .75), angle: n.shadow.angle ?? 45 } : undefined;
        slide.addShape(n.kind === 'ellipse' ? pptx.ShapeType.ellipse : n.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, { ...base, fill, line, ...(n.radius ? { rectRadius: n.drawingId ? inch(Math.min(n.radius,Math.min(n.w,n.h)/2)) : Math.min(.5, n.radius / Math.min(n.w, n.h)) } : {}), ...(shadow ? { shadow } : {}) });
      } else if (n.kind === 'line') slide.addShape(pptx.ShapeType.line, { x: inch(Math.min(n.x, n.x + n.w)), y: inch(Math.min(n.y, n.y + n.h)), w: inch(Math.abs(n.w)), h: inch(Math.abs(n.h)), flipH: n.w < 0, flipV: n.h < 0, objectName: n.id, line: { color: hex(n.stroke), width: (n.strokeWidth || 1) * .75, ...(n.dash ? { dashType: n.dash === 'dot' ? 'sysDot' : 'dash' } : {}), ...(n.endArrow ? { endArrowType: 'triangle' } : {}) } });
      else if (n.kind === 'image') {
        if(n.viewport){
          const v=n.viewport,fullW=n.w/v.w,fullH=n.h/v.h;
          slide.addImage({...base,w:inch(fullW),h:inch(fullH),data:n.data,altText:n.alt||n.assetId,sizing:{type:'crop',x:inch(fullW*v.x),y:inch(fullH*v.y),w:inch(n.w),h:inch(n.h)}});
        }else slide.addImage({ ...base, data: n.data, altText: n.alt || n.assetId });
      }
      else if(n.kind==='table'){
        const p=n.palette,none={type:'none',pt:0,color:hex(p.paper)},all=[n.table.columns,...n.table.rows];
        const rowFill=ri=>ri===0?(n.academicStyle==='band'?p.accent:p.tint):(n.table.highlightRows?.includes(ri-1)?p.tint:p.paper);
        const rowInk=ri=>ri===0?(n.academicStyle==='band'?'#FFFFFF':p.accent):p.ink;
        const rows=all.map((row,ri)=>row.map((cell,ci)=>({text:n.cellLines[ri][ci].join('\n'),options:{bold:ri===0,color:hex(rowInk(ri)),fill:{color:hex(rowFill(ri))},lineSpacing:n.fontSize*.75*n.lineHeight,paraSpaceBefore:0,paraSpaceAfter:0,lang:'zh-CN',border:[ri===0?{type:'solid',pt:1.125,color:hex(p.accent)}:none,none,{type:'solid',pt:(ri===0||ri===all.length-1)?.975:.525,color:hex(ri===0||ri===all.length-1?p.accent:p.line)},none]}})));
        slide.addTable(rows,{...base,colW:n.colWidths.map(inch),rowH:n.rowHeights.map(inch),autoPage:false,fontFace:n.fontFamily,fontSize:n.fontSize*.75,color:hex(p.ink),align:'left',valign:'top',margin:[n.padY*.75,n.padX*.75,n.padY*.75,n.padX*.75],border:none,lineSpacing:n.fontSize*.75*n.lineHeight,paraSpaceAfter:0,paraSpaceBefore:0,verbose:false});
      }
      else if (n.kind === 'chart') {
        const c = n.chart, p = n.palette;
        const values = c.series.flatMap(s => s.values), { min, max, step } = chartScale(values);
        // Request every category tick. Upright labels also require explicit zero
        // rotation below: LibreOffice's overlap suppression ignores tickLblSkip alone.
        slide.addChart(c.kind === 'line' ? pptx.ChartType.line : pptx.ChartType.bar, c.series.map(s => ({ name: s.name, labels: c.categories, values: s.values })), { ...base, catAxisLabelFrequency: '1', catAxisLabelFontFace: n.fontFamily, valAxisLabelFontFace: n.fontFamily, legendFontFace: n.fontFamily, catAxisLabelFontSize: Math.max(21,n.projection?.labelMin||0)*.75, valAxisLabelFontSize: Math.max(20,n.projection?.labelMin||0)*.75, legendFontSize: Math.max(19,n.projection?.labelMin||0)*.75, catAxisLabelColor: hex(p.ink), valAxisLabelColor: hex(p.muted), chartColors: drawColors(p).map(hex), showLegend: c.series.length > 1, legendPos: 'b', showTitle: false, showValue: c.kind !== 'line', dataLabelPosition: 'outEnd', dataLabelColor: hex(p.ink), dataLabelFontFace: n.fontFamily, dataLabelFontSize: Math.max(22,n.projection?.labelMin||0)*.75, dataLabelFormatCode: chartValueFormat(c), showBorder: false, lineDataSymbol: c.kind === 'line' ? 'circle' : 'none', lineDataSymbolSize: 4, lineSize: 2, showValAxisTitle: Boolean(c.unit), valAxisTitle: c.unit || '', valAxisTitleFontSize: Math.max(19,n.projection?.labelMin||0)*.75, valAxisTitleFontFace: n.fontFamily, valAxisTitleColor: hex(p.muted), valAxisMinVal: min, valAxisMaxVal: max, valAxisMajorUnit: step, showCatName: false, catAxisLineColor: hex(p.line), valAxisLineColor: hex(p.line), valGridLine: { color: hex(p.line), width: .6 }, chartArea: { fill: { color: hex(p.paper) }, border: { color: hex(p.paper), pt: 0 } }, plotArea: { fill: { color: hex(p.paper) } }, ...(c.kind === 'line' ? {} : { barDir: c.kind === 'bar' ? 'bar' : 'col', catAxisLabelPos: 'low', barGrouping: 'clustered', barGapWidthPct: 60 }) });
      } else throw new Error(`不支持的场景对象：${n.kind}`);
    }
    slide.addNotes(page.notes || '');
  }
  abort(signal); const bytes = await pptx.write({ outputType: 'nodebuffer', compression: true }); abort(signal);
  return scenes.pages.some(page=>page.nodes.some(n=>n.kind==='chart'))?explicitCategoryLabelRotation(bytes):Buffer.from(bytes);
}

export async function renderProject(project, { signal } = {}) {
  abort(signal);
  const scenes = buildScenes(project), svgPages = scenes.pages.map(page => ({ id: page.id, svg: sceneToSvg(page) }));
  const html = renderHtml(project, scenes, svgPages), pptx = await nativePptx(project, scenes, signal);
  return { pptx, html, svgPages, scenes, issues: scenes.issues };
}
