/** Measured, editable card surfaces. Icons are semantic navigation, never evidence. */
import { getCardPreset } from './card-catalog.mjs';
import { measureImageCard, renderImageCard } from './image-card-surface.mjs';
import { CARD_FRAME_FIELDS, cardFramePaint, cardFrameStroke, frameHasPaint, readableCardColor, reportInvisibleCardShadow } from './card-frame.mjs';
export const SEMANTIC_ICONS = Object.freeze(['question','method','evidence','comparison','boundary','hypothesis','satellite','leaf','water','model']);
const plainStyles = new Set(['plain','compact','ruled']);
const text = value => value === undefined || value === null ? '' : String(value);
const metricText = metric => metric && [metric.value, metric.unit].filter(value => value !== undefined && value !== '').join(' ');

export function resolveCardAppearance(card = {}, design = {}) {
  if (card.preset) return { layout:'preset', surface:'outline', radius:design.cardDefaults?.radius??6, padding:20, accent:'none', elevation:design.cardDefaults?.elevation??false,
    ...Object.fromEntries(CARD_FRAME_FIELDS.filter(key=>design.cardDefaults?.[key]!==undefined).map(key=>[key,design.cardDefaults[key]])),
    ...Object.fromEntries(['radius','padding','elevation',...CARD_FRAME_FIELDS].filter(key=>card.appearance?.[key]!==undefined).map(key=>[key,card.appearance[key]])) };
  const defaults = !card.style || plainStyles.has(card.style) ? design.cardDefaults : undefined;
  if (!card.appearance && !defaults && !card.icon) return null;
  return { layout:'stacked', surface:'outline', radius:4, padding:16, accent:'none', elevation:false, ...defaults, ...card.appearance };
}

/** One calculation is used for layout minima and rendered text positions. */
export function measureCardSurface(card, width, { design = {}, system = {}, wrapText, measureTextWidth }) {
  if(card.preset) return measurePresetCard(card,width,{design,system,wrapText,measureTextWidth});
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
  if(card.figureIds?.length&&getCardPreset(card.preset)?.family!=='figure')b.page.issues.push({severity:'error',code:'image-card-preset-required',slideId:b.page.id,cardId:card.id,message:'card.figureIds需要图片嵌入式配方；当前卡片不能显示这些原图，请选择figure家族preset。'});
  if(card.preset) return renderPresetCard(b,card,box,index,project,helpers);
  if(['items','badge','note'].some(field=>card[field]!==undefined))b.page.issues.push({severity:'error',code:'card-preset-required',slideId:b.page.id,cardId:card.id,message:'items、badge 和 note 需要明确的 card.preset；请选择卡片配方，避免新增内容被旧布局遗漏。'});
  const m = measureCardSurface(card, box.w, { ...helpers, design:b.design || project.design, system:b.system });
  if (!m) return false;
  const id = String(card.id || `card-${index+1}`), key=`card/${id}`, p=b.p, a=m.appearance;
  const accent=/^#[0-9a-f]{6}$/i.test(card.accent||'')?card.accent:(card.kind==='boundary'?p.secondary:p.accent);
  const solid=a.surface==='solid'&&a.fill!=='none', ink=solid?'#FFFFFF':p.ink, muted=solid?'#FFFFFF':p.muted, color=solid?'#FFFFFF':accent;
  const surfaceFill=solid?accent:a.surface==='tint'?p.tint:a.surface==='plain'?'none':p.paper;
  const stroke=a.surface==='plain'?'none':a.surface==='solid'?accent:p.line;
  const framePaint=cardFramePaint(a,{fill:surfaceFill,stroke,strokeWidth:1.2},{elevationOpacity:.1});
  if(frameHasPaint(framePaint))b.rect(`${key}/surface`,box,framePaint.fill,framePaint.stroke,{...framePaint,radius:a.radius,role:'card-surface',semantic:false},id);
  else if(framePaint.shadow)reportInvisibleCardShadow(b,id);
  const banded=a.layout==='banded',side=a.layout==='side-label';
  const titlePreferred=banded||side&&solid?'#FFFFFF':color;
  if(m.headerBox){
    const header={x:box.x+m.headerBox.x,y:box.y+m.headerBox.y,w:m.headerBox.w,h:side?box.h:m.headerBox.h};
    const fill=solid?p.ink:banded?accent:p.tint;
    b.rect(`${key}/heading-surface`,header,fill,'none',{role:'group',semantic:false},id);
    if(side)b.line(`${key}/heading-divider`,header.x+header.w,header.y,header.x+header.w,header.y+header.h,solid?'#FFFFFF':p.line,{strokeWidth:1.2,role:'decoration',semantic:false},id);
  }
  const readable=(r,c)=>a.fill===undefined?c:readableCardColor(b,r,c);
  const titleBox={...m.titleBox,x:box.x+m.titleBox.x,y:box.y+m.titleBox.y},titleColor=readable(titleBox,titlePreferred);
  if(a.accent!=='none') {
    const inset=Math.max(4,a.radius*.55), bar=a.accent==='top'?{x:box.x+inset,y:box.y+4,w:box.w-inset*2,h:3}:{x:box.x+4,y:box.y+inset,w:3,h:box.h-inset*2};
    b.rect(`${key}/accent`,bar,color,'none',{radius:1.5,role:'decoration',semantic:false},id);
  }
  b.region(key,box,'card');
  if(m.iconBox)drawSemanticIcon(b,card.icon,{...m.iconBox,x:box.x+m.iconBox.x,y:box.y+m.iconBox.y},titleColor,`${key}/icon`,id);
  b.text(`${key}/title`,card.title,titleBox,m.titleSize,{bold:true,color:titleColor,lineHeight:1.15,role:'card-title'},id);
  for(const row of m.rows){
    const r={x:box.x+row.x,y:box.y+row.y,w:row.w,h:row.h};
    b.text(`${key}/${row.key}`,row.value,r,row.size,{bold:row.bold,color:readable(r,row.color==='accent'?color:row.color==='muted'?muted:ink),lineHeight:row.lineHeight,role:row.key,emphasis:row.emphasis,emphasisColor:readable(r,color)},id);
  }
  if(m.minimumH>box.h+2)b.page.issues.push({severity:'error',code:'card-surface-overflow',slideId:b.page.id,cardId:id,requiredHeight:Math.ceil(m.minimumH),availableHeight:box.h,message:'卡片内边距、图标、完整文字与指标超出卡片高度；扩大卡片或调整内容分组，不能裁掉正文。'});
  if(m.metricWidth>m.innerW+2)b.page.issues.push({severity:'error',code:'card-metric-width',slideId:b.page.id,cardId:id,message:'指标数值和单位在卡片内无法保持一行；扩大卡片或重排。'});
  return true;
}

/** Each recipe reserves real text height. No preset truncates an item, shrinks
 * type to fit or infers a statistic from the supplied values. */
function measurePresetCard(card, width, {design,system,wrapText,measureTextWidth}) {
  const preset=getCardPreset(card.preset),appearance=resolveCardAppearance(card,design);
  if(!preset)return {appearance,invalidPreset:true,minimumH:0,metricWidth:0,innerW:Math.max(1,width)};
  if(preset.family==='figure')return measureImageCard(card,width,{design,system,wrapText,measureTextWidth,preset,appearance});
  const {frame,header,content}=preset.recipe,pad=appearance.padding;
  const labelMin=design.projection?.labelMin??0,bodyMin=design.projection?.bodyMin??0;
  const titleSize=Math.max(system.panelTitleSize??26,labelMin),bodySize=Math.max(system.bodySize??24,bodyMin);
  // A card.note can contain a conclusion-changing limitation. Keep it at body
  // size; only genuine units and ordinal navigation use the label policy.
  const noteSize=bodySize,unitSize=Math.max(system.captionSize??18,labelMin),orderSize=Math.max(18,labelMin),orderD=Math.max(30,orderSize*1.22+10),metricSize=Math.max(38,bodyMin);
  const elements=[],decorations=[],rows=[],unitWidthIssues=[];
  const height=(value,w,size,bold=false,lh=1.22,emphasis=[])=>text(value)?wrapText(text(value),Math.max(1,w-(emphasis.length?size*.22:0)),size,{bold:bold||emphasis.length>0}).length*size*lh:0;
  const addText=(key,value,x,y,w,size=bodySize,{bold=false,color='ink',lineHeight=1.22,align='left',role=key,emphasis=[]}={})=>{
    if(!text(value))return 0;
    const h=height(value,w,size,bold,lineHeight,emphasis);
    elements.push({key,value:text(value),x,y,w,h,size,bold,color,lineHeight,align,role,...(emphasis.length?{emphasis}:{})});return h;
  };
  const rect=(key,x,y,w,h,fill='tint',stroke='none',more={})=>decorations.push({kind:'rect',key,x,y,w,h,fill,stroke,...more});
  const line=(key,x,y,w,h=0,stroke='line',more={})=>decorations.push({kind:'line',key,x,y,w,h,stroke,...more});
  const ellipse=(key,x,y,w,h,fill='paper',stroke='accent',more={})=>decorations.push({kind:'ellipse',key,x,y,w,h,fill,stroke,...more});
  let x=pad,innerW=Math.max(1,width-2*pad),y=pad,titleX=pad,titleY=pad,titleW=innerW,baseY=0;
  let headerBox=null,badgeBox=null,iconBox=null;
  const badge=text(card.badge),badgeSize=Math.max(20,labelMin);
  if(header==='rail'){
    const railW=Math.min(188,Math.max(112,width*.30));
    titleW=Math.max(1,railW-pad*2); x=railW+pad;innerW=Math.max(1,width-x-pad);
    headerBox={x:0,y:0,w:railW};
    if(badge)titleY+=addText('badge',badge,pad,pad,titleW,badgeSize,{bold:true,color:'muted',role:'index'})+7;
  }else if(header==='number'&&badge){
    const bw=Math.min(120,Math.max(48,measureTextWidth(badge,badgeSize,{bold:true})+18)),bh=Math.max(48,height(badge,bw-12,badgeSize,true)+12);
    badgeBox={x:pad,y:pad,w:bw,h:bh};
    addText('badge',badge,pad+6,pad+(bh-height(badge,bw-12,badgeSize,true))/2,bw-12,badgeSize,{bold:true,color:'accent',align:'center',role:'index'});
    titleX=pad+bw+14;titleY=pad+Math.max(0,(bh-titleSize*1.15)/2);titleW=Math.max(1,width-titleX-pad);
  }else if(badge){
    const h=addText('badge',badge,pad,pad,innerW,badgeSize,{bold:true,color:['band','notch'].includes(header)?'white':'muted',role:'index'});titleY=pad+h+7;
  }
  if(header==='fold')titleW=Math.max(1,titleW-30);
  if(card.icon){
    if(header==='rail'){iconBox={x:pad,y:titleY,w:30,h:30};titleY+=40;}
    else{iconBox={x:titleX,y:titleY,w:30,h:30};titleX+=40;titleW=Math.max(1,titleW-40);}
  }
  if(header==='tab'){
    titleY=badge?titleY:10;
    const natural=measureTextWidth(card.title,titleSize,{bold:true})+(card.icon?40:0)+pad*2;
    const tabW=Math.min(width-pad*2,Math.max(130,natural));
    titleX=pad+12+(card.icon?40:0);titleW=Math.max(1,tabW-24-(card.icon?40:0));
    if(iconBox)iconBox={x:pad+12,y:titleY,w:30,h:30};
    const th=Math.max(height(card.title,titleW,titleSize,true,1.15),card.icon?30:0);
    headerBox={x:pad,y:titleY-8,w:tabW,h:th+16};baseY=headerBox.y+headerBox.h/2;
  }
  const titleH=addText('title',card.title,titleX,titleY,titleW,titleSize,{bold:true,color:['band','notch'].includes(header)?'white':'accent',lineHeight:1.15,role:'card-title'});
  const headBottom=Math.max(titleY+titleH,iconBox?iconBox.y+iconBox.h:0,badgeBox?badgeBox.y+badgeBox.h:0);
  if(header==='rail')y=pad;
  else if(header==='band'||header==='notch'){
    headerBox={x:0,y:0,w:width,h:headBottom+pad};y=headerBox.h+(header==='notch'?24:16);
  }else if(header==='tab')y=Math.max(headBottom,headerBox.y+headerBox.h)+16;
  else if(header==='rule'){y=headBottom+21;line('title-rule',pad,headBottom+10,innerW,0,'line');line('title-rule-accent',pad,headBottom+10,Math.min(76,innerW),0,'accent',{strokeWidth:3});}
  else y=headBottom+16;
  const contentStart=y,body=Array.isArray(card.body)?card.body.join('\n'):card.body;
  if(text(body)){
    const strong=content==='claim-proof',formula=content==='formula';
    const bx=x+(strong||formula?12:0),bw=innerW-(strong||formula?24:0),by=y+(strong||formula?10:0),size=formula?Math.max(28,bodySize):bodySize;
    const bh=height(body,bw,size,strong,1.24,card.emphasis||[]);
    if(strong||formula)rect('body-surface',x,y,innerW,bh+20,'tint','none',{radius:2});
    addText('body',body,bx,by,bw,size,{bold:strong,lineHeight:1.24,emphasis:card.emphasis||[]});y+=bh+(strong||formula?20:0)+14;
  }
  const metric=metricText(card.metric);
  if(metric){
    y+=addText('metric',metric,x,y,innerW,metricSize,{bold:true,color:'accent',lineHeight:1.16})+4;
    if(card.metric.label)y+=addText('metric-label',card.metric.label,x,y,innerW,bodySize)+4;
    if(card.metric.context)y+=addText('metric-context',card.metric.context,x,y,innerW,bodySize,{color:'muted'})+8;
  }
  const items=Array.isArray(card.items)?card.items:[];
  const displayValue=item=>[item.value,item.unit].filter(value=>value!==undefined&&value!=='').join(' ');
  const separateMetricUnits=['target','metric-columns'].includes(content);
  const valueParts=(item,w,size)=>{
    if(text(item.unit)&&(separateMetricUnits||measureTextWidth(displayValue(item),size,{bold:true})>w))return [
      {key:'value',value:item.value,size,bold:true},
      {key:'unit',value:item.unit,size:separateMetricUnits?unitSize:size,bold:!separateMetricUnits},
    ].filter(part=>text(part.value));
    return text(displayValue(item))?[{key:'value',value:displayValue(item),size,bold:true}]:[];
  };
  const checkUnit=(item,i,w,size)=>{
    if(text(item.unit)&&measureTextWidth(item.unit,size,{bold:true})>w+1)unitWidthIssues.push({item:i,unit:text(item.unit),requiredWidth:measureTextWidth(item.unit,size,{bold:true}),availableWidth:w});
  };
  const itemHeight=(item,w,{valueSize=bodySize,label=true}={})=>
    (label?height(item.label,w,bodySize,true):0)+(label&&text(item.label)?5:0)+
    valueParts(item,w,valueSize).reduce((sum,part)=>sum+height(part.value,w,part.size,part.bold)+5,0)+height(item.detail,w,bodySize);
  const writeItem=(item,i,ix,iy,iw,{label=true,valueSize=bodySize,labelColor='accent',valueColor='ink'}={})=>{
    let iy2=iy;
    if(label&&text(item.label))iy2+=addText(`item-${i}/label`,item.label,ix,iy2,iw,bodySize,{bold:true,color:labelColor,role:'card-item-label'})+5;
    checkUnit(item,i,iw,separateMetricUnits?unitSize:valueSize);
    for(const part of valueParts(item,iw,valueSize))iy2+=addText(`item-${i}/${part.key}`,part.value,ix,iy2,iw,part.size,{bold:part.bold,color:part.key==='unit'&&separateMetricUnits?'muted':valueColor,role:part.key==='unit'?'label':'card-item-value'})+5;
    if(text(item.detail))iy2+=addText(`item-${i}/detail`,item.detail,ix,iy2,iw,bodySize,{role:'card-item-detail'});
    return iy2-iy;
  };
  const ledger=(list,start,{values=false,register=false}={})=>{
    let cursor=start;const gap=14,lw=Math.min(164,Math.max(96,innerW*(values?.28:.30))),rw=Math.max(1,innerW-lw-gap);
    for(const [i,item]of list.entries()){
      let rowH=0;
      if(values){
        // Keep the scientific unit as one atom. Separate value and unit rather
        // than wrapping a denominator or exponent into a different text line.
        const unitNeed=Math.max(0,...list.map(value=>text(value.unit)?measureTextWidth(value.unit,bodySize,{bold:true})+2:0));
        const valW=Math.min(Math.max(1,rw-gap-Math.min(100,rw*.35)),Math.max(100,Math.min(154,rw*.48),unitNeed)),detailW=Math.max(1,rw-valW-gap);
        const valueH=height(item.value,valW,bodySize,true),unitH=height(item.unit,valW,bodySize,true);
        rowH=Math.max(height(item.label,lw,bodySize,true),valueH+(text(item.unit)?unitH+5:0),height(item.detail,detailW,bodySize));
        addText(`item-${i}/label`,item.label,x,cursor,lw,bodySize,{bold:true,color:'accent',role:'card-item-label'});
        addText(`item-${i}/value`,item.value,x+lw+gap,cursor,valW,bodySize,{bold:true,role:'card-item-value'});
        if(text(item.unit))addText(`item-${i}/unit`,item.unit,x+lw+gap,cursor+valueH+5,valW,bodySize,{bold:true,role:'label'});
        checkUnit(item,i,valW,bodySize);
        addText(`item-${i}/detail`,item.detail,x+lw+gap+valW+gap,cursor,detailW,bodySize,{role:'card-item-detail'});
      }else{
        const parts=valueParts(item,rw,bodySize),rightH=parts.reduce((sum,part)=>sum+height(part.value,rw,part.size,part.bold)+5,0)+height(item.detail,rw,bodySize);
        rowH=Math.max(height(item.label,lw,bodySize,true),rightH);
        addText(`item-${i}/label`,item.label,x,cursor,lw,bodySize,{bold:true,color:'accent',role:'card-item-label'});
        let ry=cursor;for(const part of parts)ry+=addText(`item-${i}/${part.key}`,part.value,x+lw+gap,ry,rw,part.size,{bold:part.bold,role:part.key==='unit'?'label':'card-item-value'})+5;
        checkUnit(item,i,rw,bodySize);
        addText(`item-${i}/detail`,item.detail,x+lw+gap,ry,rw,bodySize,{role:'card-item-detail'});
      }
      if(register)line(`item-${i}/register`,x-7,cursor,0,rowH,'accent',{strokeWidth:2});
      rows.push({i,x,y:cursor,w:innerW,h:rowH});cursor+=rowH+12;
      if(i<list.length-1)line(`item-${i}/rule`,x,cursor-5,innerW,0,'line');
    }
    return cursor;
  };
  const numericRows=(list,start,{baseline=false}={})=>{
    let cursor=start;const gap=18,valW=Math.min(174,Math.max(128,innerW*.37)),textW=Math.max(1,innerW-valW-gap);
    for(const [i,item]of list.entries()){
      if(baseline&&i>0){
        line(`item-${i}/baseline-rule`,x,cursor,innerW,0,'accent');cursor+=12;
        const h=writeItem(item,i,x+12,cursor,innerW-24,{valueSize:bodySize});rect(`item-${i}/baseline`,x,cursor-6,innerW,h+12,'tint','none');cursor+=h+18;
      }else{
        const vh=height(item.value,valW,metricSize,true,1.16),uh=height(item.unit,valW,unitSize),rightH=height(item.label,textW,bodySize,true)+5+height(item.detail,textW,bodySize);
        const rowH=Math.max(vh+(text(item.unit)?uh+4:0),rightH);
        addText(`item-${i}/value`,item.value,x,cursor,valW,metricSize,{bold:true,color:'accent',lineHeight:1.16,role:'card-item-value'});
        if(text(item.unit))addText(`item-${i}/unit`,item.unit,x,cursor+vh+4,valW,unitSize,{color:'accent',role:'label'});
        checkUnit(item,i,valW,unitSize);
        line(`item-${i}/metric-divider`,x+valW+gap/2,cursor,0,rowH,'line');
        const lh=addText(`item-${i}/label`,item.label,x+valW+gap,cursor,textW,bodySize,{bold:true,role:'card-item-label'});
        addText(`item-${i}/detail`,item.detail,x+valW+gap,cursor+lh+5,textW,bodySize,{role:'card-item-detail'});
        rows.push({i,x,y:cursor,w:innerW,h:rowH});cursor+=rowH+16;
        if(i<list.length-1&&!baseline)line(`item-${i}/metric-rule`,x,cursor-7,innerW,0,'line');
      }
    }
    return cursor;
  };
  const columnModes=new Set(['io','comparison','scope','status','decision','target','metric-columns','route','response']);
  if(items.length){
    if(['ledger','formula','register','value-ledger','claim-proof'].includes(content))y=ledger(items,y,{values:content==='value-ledger',register:content==='register'});
    else if(['metric-aside','metric-rows','baseline'].includes(content))y=numericRows(items,y,{baseline:content==='baseline'});
    else if(columnModes.has(content)){
      const route=content==='route',columns=route?Math.min(3,items.length):Math.min(2,items.length),gap=route?24:26,cw=Math.max(1,(innerW-gap*(columns-1))/columns);
      if(content==='decision')y+=18;
      for(let offset=0;offset<items.length;offset+=columns){
        const rowItems=items.slice(offset,offset+columns),numerical=['target','metric-columns'].includes(content),valueSize=numerical?Math.max(34,bodyMin):bodySize;
        const top=route?orderD+16:['io','status','scope','response'].includes(content)?12:0;
        const heights=rowItems.map(item=>itemHeight(item,cw-(top&&!route?16:0),{valueSize}));
        const rowH=Math.max(...heights)+top;
        if(content==='decision'){
          // Open text has no enclosing node box. Attach each branch above the
          // visible first line of its label, not an invisible column centre.
          const anchors=rowItems.map((item,j)=>{
            const firstLine=wrapText(text(item.label),cw,bodySize,{bold:true})[0]||'';
            return x+j*(cw+gap)+Math.min(cw,measureTextWidth(firstLine,bodySize,{bold:true}))/2;
          });
          const left=anchors[0],right=anchors.at(-1);
          line(`branch-${offset}`,left,y-10,right-left,0,'accent');line(`branch-${offset}/stem`,(left+right)/2,y-18,0,8,'accent');
          anchors.forEach((anchor,j)=>line(`branch-${offset}/${j}`,anchor,y-10,0,8,'accent'));
        }
        for(const [j,item]of rowItems.entries()){
          const i=offset+j,ix=x+j*(cw+gap),iy=y;
          if(route){
            ellipse(`item-${i}/route-dot`,ix,iy,orderD,orderD,'paper','accent',{strokeWidth:1.5});
            addText(`item-${i}/order`,String(i+1),ix+4,iy+5,orderD-8,orderSize,{bold:true,color:'accent',align:'center',role:'index'});
            if(j<rowItems.length-1)line(`item-${i}/route-link`,ix+orderD+8,iy+orderD/2,cw+gap-orderD-16,0,'line',{endArrow:true});
          }
          if(['io','status','scope'].includes(content)){
            rect(`item-${i}/column-surface`,ix,iy,cw,rowH+10,j===0?'tint':'paper',content==='scope'?'line':'none',{radius:2});
            line(`item-${i}/column-rule`,ix,iy,cw,0,'accent',{strokeWidth:j===0?3:1.2,...(content==='scope'&&j>0?{dash:'dash'}:{})});
          }
          if(content==='response'){
            rect(`item-${i}/response-surface`,ix,iy,cw,rowH+10,'paper','line',{radius:2});
            const labelH=height(item.label,cw-16,bodySize,true);
            rect(`item-${i}/response-label`,ix,iy,cw,labelH+14,'tint','none');
            if(j<rowItems.length-1)line(`item-${i}/response-pair`,ix+cw+3,iy+(rowH+10)/2,gap-6,0,'accent',{dash:'dash'});
          }
          if(content==='target')line(`item-${i}/target-rule`,ix,iy+rowH+6,cw,0,'accent',{strokeWidth:1.5});
          writeItem(item,i,ix+(top&&!route?8:0),iy+top,cw-(top&&!route?16:0),{valueSize,valueColor:numerical?'accent':'ink'});
          if(j<rowItems.length-1&&['comparison','metric-columns','target'].includes(content))line(`item-${i}/column-divider`,ix+cw+gap/2,iy,0,rowH,'line');
          if(j<rowItems.length-1&&content==='io')line(`item-${i}/io-link`,ix+cw+3,iy+rowH/2,gap-6,0,'accent',{endArrow:true});
          rows.push({i,x:ix,y:iy,w:cw,h:rowH});
        }
        y+=rowH+22;
      }
    }else if(content==='layered'){
      for(const [i,item]of items.entries()){
        const iy=y,labelH=height(item.label,innerW-28,bodySize,true),itemH=writeItem(item,i,x+14,iy+12,innerW-28);
        // The labels themselves identify observation and interpretation. Equal
        // layer furniture keeps order from implying unequal evidential weight.
        rect(`item-${i}/layer-surface`,x,iy,innerW,itemH+24,'paper','line',{radius:2});
        rect(`item-${i}/layer-label`,x,iy,innerW,labelH+14,'tint','none');
        rows.push({i,x,y:iy,w:innerW,h:itemH+24});y+=itemH+40;
      }
    }else{
      const mode=content==='stack'?'annotations':content,markers=['steps','trace','checks','numbered','milestones','register'].includes(mode),markerW=markers?Math.max(36,orderD+4):mode==='annotations'?12:8,tx=x+markerW+8,tw=Math.max(1,innerW-markerW-8);
      const centers=[];
      for(const [i,item]of items.entries()){
        const iy=y,h=Math.max(writeItem(item,i,tx,iy,tw),markers?orderD:0),center=iy+orderD/2;centers.push(center);
        if(mode==='steps'||mode==='milestones'){
          ellipse(`item-${i}/node`,x+2,iy,orderD,orderD,'paper','accent',{strokeWidth:1.5});
          if(mode==='steps')addText(`item-${i}/order`,String(i+1),x+6,iy+5,orderD-8,orderSize,{bold:true,color:'accent',align:'center',role:'index'});
          else ellipse(`item-${i}/milestone`,x+2+(orderD-12)/2,iy+(orderD-12)/2,12,12,'accent','none');
        }else if(mode==='checks')rect(`item-${i}/check`,x+4,iy+3,22,22,'none','accent',{strokeWidth:1.3,radius:2});
        else if(mode==='numbered')addText(`item-${i}/order`,String(i+1).padStart(2,'0'),x,iy,markerW,Math.max(bodySize,labelMin),{bold:true,color:'accent',role:'index'});
        else if(mode==='trace'){
          rect(`item-${i}/trace`,x+7,iy+7,16,16,'paper','accent',{strokeWidth:1.5});
          line(`item-${i}/trace-leader`,x+23,iy+15,14,0,'accent');
        }else if(mode==='annotations'){
          line(`item-${i}/annotation`,x,iy,0,h,'line');line(`item-${i}/annotation-top`,x,iy,7,0,'accent');
        }else if(mode==='action'){line(`item-${i}/action`,x,iy+13,12,0,'accent',{endArrow:true});}
        rows.push({i,x,y:iy,w:innerW,h});y+=h+16;
      }
      if(centers.length>1&&['steps','trace','milestones'].includes(mode)){
        for(let i=1;i<centers.length;i++)line(`item-link-${i}`,x+(mode==='trace'?15:2+orderD/2),centers[i-1]+orderD/2+3,0,Math.max(0,centers[i]-centers[i-1]-orderD-6),'line',{...(mode==='trace'?{dash:'dot'}:{})});
      }
    }
  }
  let noteBox=null;
  if(text(card.note)){
    if(items.length||text(body)||metric)y+=3;
    line('note-rule',x,y,innerW,0,'line');y+=10;
    const h=addText('note',card.note,x,y,innerW,noteSize,{color:'muted',role:'card-note'});noteBox={x,y,w:innerW,h};y+=h;
  }
  const minimumH=Math.max(y+pad,headBottom+pad,headerBox?.h?headerBox.y+headerBox.h+pad:0);
  return {appearance,preset,padding:pad,innerW,titleSize,titleH,titleW,titleBox:{x:titleX,y:titleY,w:titleW,h:titleH},headerBox,badgeBox,iconBox,baseY,contentStart,noteBox,elements,decorations,rows,
    metric,metricWidth:metric?measureTextWidth(metric,metricSize,{bold:true}):0,unitWidthIssues,minimumH};
}

function renderPresetCard(b,card,box,index,project,helpers){
  const m=measurePresetCard(card,box.w,{...helpers,design:b.design||project.design,system:b.system||{}}),id=String(card.id||`card-${index+1}`),key=`card/${id}`;
  if(m.invalidPreset){b.page.issues.push({severity:'error',code:'card-preset-unknown',slideId:b.page.id,cardId:id,message:`未知卡片预设 ${card.preset}；请从 academic_ppt_cards 返回的 ID 选择。`});return true;}
  if(card.templateComponentId)b.page.issues.push({severity:'error',code:'card-preset-template-conflict',slideId:b.page.id,cardId:id,message:'card.preset 与 templateComponentId 分别定义完整卡片结构，请只选择其中一种。'});
  if(m.imageCard)return renderImageCard(b,card,box,index,project,helpers,m,{drawSemanticIcon});
  const {preset,appearance:a}=m,p=b.p,{frame,header}=preset.recipe;
  const accent=/^#[0-9a-f]{6}$/i.test(card.accent||'')?card.accent:(card.kind==='boundary'?p.secondary:p.accent);
  const colors={...p,accent,white:'#FFFFFF',none:'none'};
  const color=token=>colors[token]||token;
  const decor={role:'card-decoration',semantic:false,cardPreset:preset.id};
  const rect=(suffix,x,y,w,h,fill='paper',stroke='line',more={})=>b.rect(`${key}/${suffix}`,{x:box.x+x,y:box.y+y,w,h},color(fill),color(stroke),{...decor,strokeWidth:1.25,...more},id);
  const line=(suffix,x,y,w,h=0,stroke='line',more={})=>b.line(`${key}/${suffix}`,box.x+x,box.y+y,box.x+x+w,box.y+y+h,color(stroke),{...decor,strokeWidth:1.25,...more},id);
  const base=m.baseY,h=box.h-base;
  const surfaceExtra={radius:a.radius,role:'card-surface'};
  const frameRect=(suffix,x,y,w,h,fill='paper',stroke='line',more={},options={})=>{
    const paint=cardFramePaint(a,{fill:color(fill),stroke:color(stroke),strokeWidth:more.strokeWidth??1.25},options);
    if(frameHasPaint(paint))rect(suffix,x,y,w,h,paint.fill,paint.stroke,{...more,...paint});
    else if(paint.shadow)reportInvisibleCardShadow(b,id);
    return paint;
  };
  const frameLine=(suffix,x,y,w,h=0,stroke='line',more={})=>{
    const paint=cardFrameStroke(a,color(stroke),more.strokeWidth??1.25);
    if(paint.stroke!=='none')line(suffix,x,y,w,h,paint.stroke,{...more,...paint});
  };
  if(['outline','rail','double-bottom'].includes(frame))frameRect('surface',0,base,box.w,h,'paper','line',surfaceExtra);
  else if(frame==='double'){
    frameRect('surface',0,base,box.w-5,h-5,'paper','accent',{...surfaceExtra,radius:2});
    frameRect('double-frame',5,base+5,box.w-5,h-5,'none','accent',{radius:2,strokeWidth:.8},{fill:false,shadow:false});
  }else if(frame==='stacked'){
    frameRect('stack-back',7,base+7,box.w-7,h-7,'tint','line',{radius:4},{shadow:false});
    frameRect('surface',0,base,box.w-7,h-7,'paper','line',{...surfaceExtra,radius:4});
  }else if(frame==='ribbon'){
    frameRect('surface',8,base,box.w-8,h,'paper','line',surfaceExtra);rect('ribbon',0,base,8,h,'accent','none');
  }else if(frame==='ruled'){
    if(a.fill&&a.fill!=='none')frameRect('surface',0,base,box.w,h,'none','none',surfaceExtra,{stroke:false});
    else if(a.shadow)reportInvisibleCardShadow(b,id);
    frameLine('surface-top',0,base,box.w,0,'accent',{strokeWidth:1.6});frameLine('surface-bottom',0,box.h,box.w,0,'accent',{strokeWidth:1.6});
  }else if(frame==='bracket'){
    if(a.fill&&a.fill!=='none')frameRect('surface',0,base,box.w,h,'none','none',surfaceExtra,{stroke:false});
    else if(a.shadow)reportInvisibleCardShadow(b,id);
    const l=Math.min(38,box.w*.10);frameLine('bracket-left',0,base,0,h,'accent');frameLine('bracket-left-top',0,base,l,0,'accent');frameLine('bracket-left-bottom',0,box.h,l,0,'accent');
    frameLine('bracket-right',box.w,base,0,h,'accent');frameLine('bracket-right-top',box.w-l,base,l,0,'accent');frameLine('bracket-right-bottom',box.w-l,box.h,l,0,'accent');
  }else if(frame==='fold'||frame==='cut'){
    const cut=Math.min(26,box.w,h);
    // The diagonal and its inner triangle belong to one closed, editable
    // silhouette. One fill and one shadow must cover the complete contour.
    frameRect('surface',0,base,box.w,h,'paper','accent',{role:'card-surface',cornerCut:cut});
    if(frame==='fold'){frameLine('fold-left',box.w-cut,base,0,cut,'line');frameLine('fold-bottom',box.w-cut,base+cut,cut,0,'line');}
  }else if(frame==='plain'){
    frameRect('surface',0,base,box.w,h,'none','none',surfaceExtra);
  }
  if(frame==='double-bottom')frameLine('lower-rule',8,box.h-5,box.w-16,0,'accent',{strokeWidth:2.5});
  if(frame==='rail'&&header!=='rail')rect('stage-rail',0,base,5,h,'accent','none');
  if(header==='rail'){
    rect('heading-surface',0,0,m.headerBox.w,box.h,'tint','none');line('heading-divider',m.headerBox.w,0,0,box.h,'line');
  }else if(header==='tab'){
    const r=m.headerBox;rect('heading-tab',r.x,r.y,r.w,r.h,'paper','accent',{radius:2,strokeWidth:1.4});
    line('heading-tab-edge',r.x+6,r.y+r.h+4,Math.max(1,r.w-12),0,'line');
  }else if(header==='band'||header==='notch'){
    const r=m.headerBox;rect('heading-surface',r.x,r.y,r.w,r.h,'accent','none',{radius:0});
    if(header==='notch'){
      const nx=m.padding+12,ny=r.h;line('heading-notch-left',nx,ny,9,9,'accent',{strokeWidth:2});line('heading-notch-right',nx+9,ny+9,9,-9,'accent',{strokeWidth:2});
    }
  }
  if(m.badgeBox){const r=m.badgeBox;b.add('ellipse',`${key}/badge-anchor`,{x:box.x+r.x,y:box.y+r.y,w:r.w,h:r.h,fill:color('tint'),stroke:accent,strokeWidth:1.3,...decor},id);}
  for(const d of m.decorations){
    const {kind,key:suffix,x,y,w,h,fill,stroke,...rest}=d;
    if(kind==='rect')rect(suffix,x,y,w,h,fill,stroke,rest);
    else if(kind==='ellipse')b.add('ellipse',`${key}/${suffix}`,{...decor,...rest,x:box.x+x,y:box.y+y,w,h,fill:color(fill),stroke:color(stroke),strokeWidth:rest.strokeWidth||1.25},id);
    else line(suffix,x,y,w,h,stroke,rest);
  }
  b.region(key,box,'card');
  const readable=(r,c)=>a.fill===undefined?c:readableCardColor(b,r,c);
  if(m.iconBox){const r={...m.iconBox,x:box.x+m.iconBox.x,y:box.y+m.iconBox.y};drawSemanticIcon(b,card.icon,r,readable(r,['band','notch'].includes(header)?'#FFFFFF':accent),`${key}/icon`,id);}
  for(const t of m.elements){
    const {key:suffix,value,x,y,w,h,size,...more}=t;
    const r={x:box.x+x,y:box.y+y,w,h};
    b.text(`${key}/${suffix}`,value,r,size,{...more,color:readable(r,color(more.color)),emphasisColor:readable(r,accent),cardPreset:preset.id},id);
  }
  if(m.minimumH>box.h+2)b.page.issues.push({severity:'error',code:'card-surface-overflow',slideId:b.page.id,cardId:id,requiredHeight:Math.ceil(m.minimumH),availableHeight:box.h,message:'卡片预设中的完整标题、正文、条目、数值与限定超出高度；扩大区域、重组内容或更换预设，不能缩字或裁掉内容。'});
  if(m.metricWidth>m.innerW+2)b.page.issues.push({severity:'error',code:'card-metric-width',slideId:b.page.id,cardId:id,message:'指标数值与单位超过可用宽度；扩大卡片或改为带独立单位槽位的 items。'});
  for(const issue of m.unitWidthIssues)b.page.issues.push({severity:'error',code:'card-unit-width',slideId:b.page.id,cardId:id,...issue,message:'完整单位无法在当前数值槽位内保持一行；扩大卡片、更换内容结构或调整列宽，不能拆散单位、分母或上标。'});
  if(box.w<preset.dimensions.minimumWidth)b.page.issues.push({severity:'warning',code:'card-preset-width-review',slideId:b.page.id,cardId:id,message:`${preset.name}建议至少 ${preset.dimensions.minimumWidth} px 宽；检查完整文字与阅读关系，不能为凑卡片数量缩字。`});
  const count=Array.isArray(card.items)?card.items.length:0,[lo,hi]=preset.contentContract.itemCount;
  if(count<lo||count>hi)b.page.issues.push({severity:'warning',code:'card-preset-content-review',slideId:b.page.id,cardId:id,message:`${preset.name}适合 ${lo}–${hi} 个条目，当前 ${count} 个；已保留全部内容，需确认此预设是否适合实际关系。`});
  if(card.appearance&&['layout','surface','accent'].some(k=>card.appearance[k]!==undefined))b.page.issues.push({severity:'warning',code:'card-preset-appearance-review',slideId:b.page.id,cardId:id,message:'card.preset 决定卡片几何和题签；appearance.layout/surface/accent 不覆盖预设。外表面使用 appearance.fill/stroke/strokeWidth/dash/shadow，题签强调色使用 card.accent，间距使用 appearance.padding。'});
  return true;
}
