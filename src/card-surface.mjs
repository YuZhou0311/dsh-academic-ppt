/** Measured, editable card surfaces. Icons are semantic navigation, never evidence. */
export const SEMANTIC_ICONS = Object.freeze(['question','method','evidence','comparison','boundary','hypothesis','satellite','leaf','water','model']);
const plainStyles = new Set(['plain','compact','ruled']);
const text = value => value === undefined || value === null ? '' : String(value);
const metricText = metric => metric && [metric.value, metric.unit].filter(value => value !== undefined && value !== '').join(' ');

export function resolveCardAppearance(card = {}, design = {}) {
  const defaults = !card.style || plainStyles.has(card.style) ? design.cardDefaults : undefined;
  if (!card.appearance && !defaults && !card.icon) return null;
  return { layout:'stacked', surface:'outline', radius:4, padding:16, accent:'none', elevation:false, ...defaults, ...card.appearance };
}

/** One calculation is used for layout minima and rendered text positions. */
export function measureCardSurface(card, width, { design = {}, system = {}, wrapText, measureTextWidth }) {
  const appearance = resolveCardAppearance(card, design);
  if (!appearance) return null;
  const padding = appearance.padding, titleSize = system.panelTitleSize ?? 26, bodySize = system.bodySize ?? 24;
  const layout = appearance.layout, availableW = Math.max(1, width - padding * 2), iconSize = card.icon ? 34 : 0;
  const side = layout === 'side-label';
  const railW = side ? Math.min(220, Math.max(112, width * .28), Math.max(1, width * .46)) : 0;
  const titleX = side ? padding : padding + (iconSize ? iconSize + 12 : 0);
  const titleY = padding + (side && iconSize ? iconSize + 10 : 0);
  const titleW = Math.max(1, side ? railW - padding * 2 : availableW - (iconSize ? iconSize + 12 : 0));
  const titleH = wrapText(text(card.title), titleW, titleSize, { bold:true }).length * titleSize * 1.15;
  const headH = side ? titleY - padding + titleH : Math.max(titleH, iconSize);
  const headerH = layout === 'banded' ? padding * 2 + headH : 0;
  const contentX = side ? railW + padding : padding;
  const innerW = Math.max(1, width - contentX - padding);
  const contentY = side ? padding : layout === 'banded' ? headerH + padding / 2 : padding + headH + 12;
  const rows = []; let y = contentY;
  const append = (key, value, size, lineHeight, bold = false, color = 'ink', gap = 0, emphasis) => {
    if (!text(value)) return;
    const reserve = emphasis?.length ? size * .22 : 0;
    const h = wrapText(text(value), Math.max(1, innerW - reserve), size, { bold: bold || Boolean(emphasis?.length) }).length * size * lineHeight;
    rows.push({ key, value:text(value), x:contentX, y, w:innerW, h, size, lineHeight, bold, color, ...(emphasis?.length ? { emphasis } : {}) }); y += h + gap;
  };
  const metric = metricText(card.metric);
  if (metric) {
    append('metric', metric, 38, 1.16, true, 'accent', 4);
    append('metric-label', card.metric.label, bodySize, 1.18, false, 'ink', 4);
    append('metric-context', card.metric.context, bodySize, 1.2, false, 'muted', 8);
  }
  append('body', Array.isArray(card.body) ? card.body.join('\n') : card.body, bodySize, 1.24, false, 'ink', 0, card.emphasis);
  const minimumH = Math.max(padding + headH, y) + padding;
  return { appearance, padding, innerW, iconSize, titleW, titleH, headH, titleSize, rows, metric,
    titleBox:{x:titleX,y:titleY,w:titleW,h:titleH},
    iconBox:iconSize?{x:padding,y:padding,w:iconSize,h:iconSize}:null,
    contentBox:{x:contentX,y:contentY,w:innerW,h:Math.max(0,minimumH-contentY-padding)},
    headerBox:side?{x:0,y:0,w:railW,h:minimumH}:layout==='banded'?{x:0,y:0,w:width,h:headerH}:null,
    metricWidth:metric ? measureTextWidth(metric,38,{bold:true}) : 0,
    minimumH };
}

/** Small line symbols built entirely from editable PowerPoint primitives. */
export function drawSemanticIcon(b, name, box, color, key, cardId) {
  if (!SEMANTIC_ICONS.includes(name)) return;
  const scale = Math.min(box.w, box.h) / 32, x = box.x + (box.w - scale*32)/2, y = box.y + (box.h - scale*32)/2;
  const common = { role:'icon', semantic:false, iconName:name };
  let n=0;
  const line=(a,c,d,e)=>b.line(`${key}/${n++}`,x+a*scale,y+c*scale,x+d*scale,y+e*scale,color,{strokeWidth:1.8*scale,...common},cardId);
  const rect=(a,c,w,h,r=0)=>b.rect(`${key}/${n++}`,{x:x+a*scale,y:y+c*scale,w:w*scale,h:h*scale},'none',color,{strokeWidth:1.8*scale,radius:r*scale,...common},cardId);
  const ellipse=(a,c,w,h,fill='none')=>b.add('ellipse',`${key}/${n++}`,{x:x+a*scale,y:y+c*scale,w:w*scale,h:h*scale,fill,stroke:color,strokeWidth:1.8*scale,...common},cardId);
  if(name==='question'){ellipse(3,3,26,26);b.text(`${key}/mark`,'?',{x:x+9*scale,y:y+5*scale,w:14*scale,h:22*scale},20*scale,{bold:true,color,lineHeight:1.1,align:'center',...common},cardId);}
  if(name==='method'){rect(2,2,10,8,1);rect(20,22,10,8,1);rect(20,2,10,8,1);line(12,6,20,6);line(25,10,25,22);line(22,19,25,22);line(28,19,25,22);}
  if(name==='evidence'){rect(5,2,22,28,2);line(10,8,22,8);line(10,13,22,13);line(9,22,13,26);line(13,26,23,18);}
  if(name==='comparison'){rect(3,5,9,20,1);rect(20,5,9,20,1);line(12,15,20,15);line(17,12,20,15);line(17,18,20,15);}
  if(name==='boundary'){line(16,3,30,28);line(30,28,2,28);line(2,28,16,3);line(16,11,16,19);ellipse(15,23,2,2,color);}
  if(name==='hypothesis'){ellipse(7,2,18,19);line(11,20,12,25);line(21,20,20,25);line(12,25,20,25);line(13,29,19,29);line(16,8,16,17);line(13,14,19,14);}
  if(name==='satellite'){rect(11,11,10,10,1);rect(0,6,8,9);rect(24,17,8,9);line(8,12,11,14);line(21,18,24,21);line(20,12,27,5);line(25,3,29,7);line(7,25,12,20);}
  if(name==='leaf'){ellipse(4,3,22,24);line(7,29,22,9);line(14,19,7,15);line(17,15,23,17);}
  if(name==='water'){line(16,2,5,18);line(16,2,27,18);ellipse(4,12,24,18);line(10,21,12,25);line(12,25,17,26);}
  if(name==='model'){line(8,8,24,8);line(8,8,16,24);line(24,8,16,24);ellipse(3,3,10,10);ellipse(19,3,10,10);ellipse(11,19,10,10);}
}

export function renderCardSurface(b, card, box, index, project, helpers) {
  const m = measureCardSurface(card, box.w, { ...helpers, design:b.design || project.design, system:b.system });
  if (!m) return false;
  const id = String(card.id || `card-${index+1}`), key=`card/${id}`, p=b.p, a=m.appearance;
  const accent=/^#[0-9a-f]{6}$/i.test(card.accent||'')?card.accent:(card.kind==='boundary'?p.secondary:p.accent);
  const solid=a.surface==='solid', ink=solid?'#FFFFFF':p.ink, muted=solid?'#FFFFFF':p.muted, color=solid?'#FFFFFF':accent;
  const surfaceFill=solid?accent:a.surface==='tint'?p.tint:a.surface==='plain'?'none':p.paper;
  const stroke=a.surface==='plain'?'none':a.surface==='solid'?accent:p.line;
  if(a.surface!=='plain') b.rect(`${key}/surface`,box,surfaceFill,stroke,{radius:a.radius,strokeWidth:1.2,role:'card-surface',semantic:false,...(a.elevation?{shadow:{color:'#20334A',opacity:.1,blur:3,offset:2,angle:90}}:{})},id);
  const banded=a.layout==='banded',side=a.layout==='side-label';
  const titleColor=banded||side&&solid?'#FFFFFF':color;
  if(m.headerBox){
    const header={x:box.x+m.headerBox.x,y:box.y+m.headerBox.y,w:m.headerBox.w,h:side?box.h:m.headerBox.h};
    const fill=solid?p.ink:banded?accent:p.tint;
    b.rect(`${key}/heading-surface`,header,fill,'none',{role:'group',semantic:false},id);
    if(side)b.line(`${key}/heading-divider`,header.x+header.w,header.y,header.x+header.w,header.y+header.h,solid?'#FFFFFF':p.line,{strokeWidth:1.2,role:'decoration',semantic:false},id);
  }
  if(a.accent!=='none') {
    const inset=Math.max(4,a.radius*.55), bar=a.accent==='top'?{x:box.x+inset,y:box.y+4,w:box.w-inset*2,h:3}:{x:box.x+4,y:box.y+inset,w:3,h:box.h-inset*2};
    b.rect(`${key}/accent`,bar,color,'none',{radius:1.5,role:'decoration',semantic:false},id);
  }
  b.region(key,box,'card');
  if(m.iconBox)drawSemanticIcon(b,card.icon,{...m.iconBox,x:box.x+m.iconBox.x,y:box.y+m.iconBox.y},titleColor,`${key}/icon`,id);
  b.text(`${key}/title`,card.title,{...m.titleBox,x:box.x+m.titleBox.x,y:box.y+m.titleBox.y},m.titleSize,{bold:true,color:titleColor,lineHeight:1.15,role:'card-title'},id);
  for(const row of m.rows)b.text(`${key}/${row.key}`,row.value,{x:box.x+row.x,y:box.y+row.y,w:row.w,h:row.h},row.size,{bold:row.bold,color:row.color==='accent'?color:row.color==='muted'?muted:ink,lineHeight:row.lineHeight,role:row.key,emphasis:row.emphasis,emphasisColor:color},id);
  if(m.minimumH>box.h+2)b.page.issues.push({severity:'error',code:'card-surface-overflow',slideId:b.page.id,cardId:id,requiredHeight:Math.ceil(m.minimumH),availableHeight:box.h,message:'卡片内边距、图标、完整文字与指标超出卡片高度；扩大卡片或调整内容分组，不能裁掉正文。'});
  if(m.metricWidth>m.innerW+2)b.page.issues.push({severity:'error',code:'card-metric-width',slideId:b.page.id,cardId:id,message:'指标数值和单位在卡片内无法保持一行；扩大卡片或重排。'});
  return true;
}
