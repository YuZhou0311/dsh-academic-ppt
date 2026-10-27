/** Figure-bearing cards keep scientific images separate from editable furniture.
 * Slots reserve the full figure renderer, including its provenance caption.
 * No card clips an image, generates an inset or infers any research value. */
import { cardFramePaint, frameHasPaint, readableCardColor, reportInvisibleCardShadow } from './card-frame.mjs';
const list=value=>Array.isArray(value)?value:[];
const text=value=>value===undefined||value===null?'':String(value);
const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));

export function measureImageCard(card,width,{design={},system={},wrapText,measureTextWidth,preset,appearance}) {
  const pad=appearance.padding,innerW=Math.max(1,width-2*pad),gap=18,layout=preset.recipe.imageLayout;
  const bodySize=Math.max(system.bodySize??24,design.projection?.bodyMin??0);
  const titleSize=Math.max(system.panelTitleSize??26,bodySize,design.projection?.labelMin??0);
  const labelSize=Math.max(system.captionSize??18,design.projection?.labelMin??0);
  const valueSize=Math.max(32,bodySize),elements=[],decorations=[],images=[],rows=[],unitWidthIssues=[];
  const height=(value,w,size=bodySize,bold=false,lh=1.22,emphasis=[])=>text(value)?
    wrapText(text(value),Math.max(1,w-(emphasis.length?size*.22:0)),size,{bold:bold||Boolean(emphasis.length)}).length*size*lh:0;
  const add=(key,value,x,y,w,size=bodySize,{bold=false,color='ink',role=key,lineHeight=1.22,emphasis=[]}={})=>{
    const h=height(value,w,size,bold,lineHeight,emphasis);
    if(h)elements.push({key,value:text(value),x,y,w,h,size,bold,color,role,lineHeight,...(emphasis.length?{emphasis}:{})});return h;
  };
  const rule=(key,x,y,w,color='line')=>decorations.push({kind:'line',key,x,y,w,h:0,stroke:color});
  const body=(x,y,w)=>add('body',card.body,x,y,w,bodySize,{emphasis:list(card.emphasis),role:'body',lineHeight:1.24});
  const item=(value,index,x,y,w,{numeric=false}={})=>{
    const start=y;
    y+=add(`item-${index}/label`,value.label,x,y,w,bodySize,{bold:true,color:'accent',role:'card-item-label'})+5;
    const combined=[value.value,value.unit].filter(v=>v!==undefined&&v!=='').join(' '),size=numeric?valueSize:bodySize;
    if(text(value.unit)&&measureTextWidth(value.unit,bodySize,{bold:true})>w+1)unitWidthIssues.push({item:index,unit:text(value.unit),availableWidth:w});
    if(combined){
      if(text(value.unit)&&measureTextWidth(combined,size,{bold:true})>w){
        y+=add(`item-${index}/value`,value.value,x,y,w,size,{bold:true,role:'card-item-value'})+4;
        y+=add(`item-${index}/unit`,value.unit,x,y,w,bodySize,{bold:true,role:'label'})+4;
      }else y+=add(`item-${index}/value`,combined,x,y,w,size,{bold:true,role:'card-item-value'})+4;
    }
    y+=add(`item-${index}/detail`,value.detail,x,y,w,bodySize,{role:'card-item-detail'});
    rows.push({i:index,x,y:start,w,h:y-start});return y-start;
  };
  const itemStack=(values,x,y,w,startIndex=0)=>{
    for(const [i,value] of values.entries()){y+=item(value,startIndex+i,x,y,w)+14;}return y;
  };
  const itemColumns=(values,x,y,w,startIndex=0,numeric=false)=>{
    if(!values.length)return y;
    const count=Math.min(3,values.length),cw=(w-gap*(count-1))/count;
    for(let offset=0;offset<values.length;offset+=count){
      const chunk=values.slice(offset,offset+count),hs=chunk.map((v,i)=>item(v,startIndex+offset+i,x+i*(cw+gap),y,cw,{numeric}));
      y+=Math.max(...hs)+14;
    }return y;
  };
  let y=pad;
  if(card.badge)y+=add('badge',card.badge,pad,y,innerW,labelSize,{bold:true,color:'muted',role:'index'})+5;
  const iconBox=card.icon?{x:pad,y,w:30,h:30}:null,titleX=pad+(iconBox?40:0),titleW=Math.max(1,innerW-(iconBox?40:0)),titleY=y;
  const titleH=add('title',card.title,titleX,titleY,titleW,titleSize,{bold:true,color:'accent',role:'card-title',lineHeight:1.15});
  y+=Math.max(titleH,iconBox?30:0)+14;
  const contentStart=y,items=list(card.items),ids=list(card.figureIds),expected=preset.contentContract.figureCount[0];
  const ratio={caption:.52,observation:.38,reverse:.38,pair:.30,stack:.55,sequence:.27,matrix:.48,zoom:.34,'overview-details':.48,'margin-notes':.36,metrics:.34,conditions:.36}[layout]??.40;
  const mediaHeight=card.mediaHeight??clamp(Math.round(innerW*ratio),180,400);
  const image=(index,x,iy,w,h)=>{if(index<ids.length)images.push({index,assetId:ids[index],x,y:iy,w:Math.max(1,w),h:Math.max(1,h)});};
  const bodyThen=(x,iy,w)=>{const h=body(x,iy,w);return iy+h+(h?14:0);};
  const strip=(first,count,x,iy,w,h)=>{const cw=(w-gap*(count-1))/count;for(let i=0;i<count;i++)image(first+i,x+i*(cw+gap),iy,cw,h);};
  // Preserve every authored source even in an invalid recipe/count pairing.
  // The renderer blocks formal export instead of silently dropping an image.
  if(ids.length!==expected){
    y=bodyThen(pad,y,innerW);
    const cols=Math.min(2,Math.max(1,ids.length)),rowCount=Math.ceil(ids.length/cols)||1,cw=(innerW-gap*(cols-1))/cols,ch=(mediaHeight-gap*(rowCount-1))/rowCount;
    ids.forEach((id,i)=>image(i,pad+(i%cols)*(cw+gap),y+Math.floor(i/cols)*(ch+gap),cw,ch));
    y+=mediaHeight+14;y=itemStack(items,pad,y,innerW);
  }else if(layout==='caption'){
    image(0,pad,y,innerW,mediaHeight);y+=mediaHeight+14;y=bodyThen(pad,y,innerW);y=itemStack(items,pad,y,innerW);
  }else if(layout==='observation'||layout==='reverse'){
    const imageW=(innerW-gap)*.64,noteW=innerW-gap-imageW,reverse=layout==='reverse';
    const imageX=reverse?pad+noteW+gap:pad,noteX=reverse?pad:pad+imageW+gap;
    image(0,imageX,y,imageW,mediaHeight);
    const textEnd=itemStack(items,noteX,bodyThen(noteX,y,noteW),noteW);
    y=Math.max(y+mediaHeight,textEnd)+14;
  }else if(layout==='stack'){
    y=bodyThen(pad,y,innerW);
    const imageW=(innerW-gap)*.68,noteW=innerW-gap-imageW,rowH=(mediaHeight-gap)/2;
    for(let i=0;i<2;i++){
      image(i,pad,y,imageW,rowH);
      const noteH=items[i]?item(items[i],i,pad+imageW+gap,y,noteW):0;
      y+=Math.max(rowH,noteH)+(i===0?gap:14);
    }
    y=itemStack(items.slice(2),pad,y,innerW,2);
  }else if(layout==='margin-notes'){
    y=bodyThen(pad,y,innerW);
    const sideW=(innerW-2*gap)*.21,imageW=innerW-2*gap-2*sideW;
    image(0,pad+sideW+gap,y,imageW,mediaHeight);
    let bottom=y+mediaHeight;
    if(items[0])bottom=Math.max(bottom,y+item(items[0],0,pad,y,sideW));
    if(items[1])bottom=Math.max(bottom,y+item(items[1],1,pad+sideW+2*gap+imageW,y,sideW));
    y=bottom+14;y=itemStack(items.slice(2),pad,y,innerW,2);
  }else{
    y=bodyThen(pad,y,innerW);
    if(layout==='conditions'){
      const conditionTop=y;y=itemColumns(items,pad+12,y+10,innerW-24);y+=3;
      decorations.push({kind:'rect',key:'conditions',x:pad,y:conditionTop,w:innerW,h:y-conditionTop,fill:'tint',stroke:'none'});y+=10;
    }
    if(layout==='pair')strip(0,2,pad,y,innerW,mediaHeight);
    else if(layout==='sequence')strip(0,3,pad,y,innerW,mediaHeight);
    else if(layout==='matrix'){
      const ch=(mediaHeight-gap)/2;strip(0,2,pad,y,innerW,ch);strip(2,2,pad,y+ch+gap,innerW,ch);
    }else if(layout==='zoom'){
      const mainW=(innerW-gap)*2/3;image(0,pad,y,mainW,mediaHeight);image(1,pad+mainW+gap,y,innerW-mainW-gap,mediaHeight);
    }else if(layout==='overview-details'){
      const overviewH=(mediaHeight-gap)*.48;image(0,pad,y,innerW,overviewH);strip(1,2,pad,y+overviewH+gap,innerW,mediaHeight-overviewH-gap);
    }else image(0,pad,y,innerW,mediaHeight);
    y+=mediaHeight+14;
    if(layout==='metrics'){rule('readouts-rule',pad,y-4,innerW);y=itemColumns(items,pad,y+7,innerW,0,true);}
    else if(layout==='sequence')y=itemColumns(items,pad,y,innerW);
    else if(layout!=='conditions')y=itemStack(items,pad,y,innerW);
  }
  const metric=card.metric&&[card.metric.value,card.metric.unit].filter(v=>v!==undefined&&v!=='').join(' ');
  if(metric){
    y+=add('metric',metric,pad,y,innerW,valueSize,{bold:true,color:'accent',role:'card-item-value'})+5;
    y+=add('metric-label',card.metric.label,pad,y,innerW,bodySize,{role:'body'})+5;
    y+=add('metric-context',card.metric.context,pad,y,innerW,bodySize,{role:'body'})+12;
  }
  let noteBox=null;
  if(text(card.note)){
    rule('note-rule',pad,y,innerW);y+=10;
    const h=add('note',card.note,pad,y,innerW,bodySize,{color:'muted',role:'card-note'});noteBox={x:pad,y,w:innerW,h};y+=h;
  }
  return {imageCard:true,preset,appearance,padding:pad,innerW,titleSize,titleH,titleW,titleBox:{x:titleX,y:titleY,w:titleW,h:titleH},
    iconBox,contentStart,elements,decorations,images,rows,mediaHeight,noteBox,minimumH:y+pad,
    metric,metricWidth:metric?measureTextWidth(metric,valueSize,{bold:true}):0,unitWidthIssues};
}

export function renderImageCard(b,card,box,index,project,helpers,m,{drawSemanticIcon}) {
  const id=String(card.id||`card-${index+1}`),key=`card/${id}`,p=b.p,preset=m.preset,a=m.appearance;
  const accent=/^#[0-9a-f]{6}$/i.test(card.accent||'')?card.accent:p.accent;
  const colors={...p,accent,none:'none'},color=value=>colors[value]||value;
  const decor={role:'card-decoration',semantic:false,cardPreset:preset.id};
  b.region(key,box,'card');
  const framePaint=cardFramePaint(a,{fill:p.paper,stroke:p.line,strokeWidth:1.2});
  if(frameHasPaint(framePaint))b.rect(`${key}/surface`,box,framePaint.fill,framePaint.stroke,{...decor,...framePaint,radius:a.radius,role:'card-surface'},id);
  else if(framePaint.shadow)reportInvisibleCardShadow(b,id);
  for(const d of m.decorations){
    if(d.kind==='rect')b.rect(`${key}/${d.key}`,{x:box.x+d.x,y:box.y+d.y,w:d.w,h:d.h},color(d.fill),color(d.stroke),decor,id);
    else b.line(`${key}/${d.key}`,box.x+d.x,box.y+d.y,box.x+d.x+d.w,box.y+d.y,color(d.stroke),{...decor,strokeWidth:1.15},id);
  }
  const readable=(r,c)=>a.fill===undefined?c:readableCardColor(b,r,c);
  if(m.iconBox){const r={...m.iconBox,x:box.x+m.iconBox.x,y:box.y+m.iconBox.y};drawSemanticIcon(b,card.icon,r,readable(r,accent),`${key}/icon`,id);}
  for(const t of m.elements){
    const {key:suffix,value,x,y,w,h,size,...more}=t;
    const r={x:box.x+x,y:box.y+y,w,h};
    b.text(`${key}/${suffix}`,value,r,size,{...more,color:readable(r,color(more.color)),cardPreset:preset.id,emphasisColor:readable(r,accent)},id);
  }
  // Reuse the same provenance-aware scientific figure renderer as stand-alone
  // source figures. Binding cardId keeps local edits and previews complete.
  const innerRegions=[];
  const nested={...b,
    // Source slots are internal to this card, not peers of the containing
    // card. Validate their containment and separation here; actual image/text
    // nodes still take part in the page's evidence-overlap checks.
    region:(k,r)=>{
      if(r.x<box.x-1||r.y<box.y-1||r.x+r.w>box.x+box.w+1||r.y+r.h>box.y+box.h+1)b.page.issues.push({severity:'error',code:'image-card-region-bounds',slideId:b.page.id,cardId:id,objectId:`${b.page.id}/${k}`,message:'内部图像与图注槽超出所属卡片；扩大卡片或重排，不能裁掉图像。'});
      for(const other of innerRegions)if(Math.min(r.x+r.w,other.x+other.w)-Math.max(r.x,other.x)>.5&&Math.min(r.y+r.h,other.y+other.h)-Math.max(r.y,other.y)>.5)b.page.issues.push({severity:'error',code:'image-card-region-overlap',slideId:b.page.id,cardId:id,objectId:`${b.page.id}/${k}`,relatedObjectId:`${b.page.id}/${other.key}`,message:'图片卡内部的两个图像或图注槽重叠；分别保留完整区域。'});
      innerRegions.push({...r,key:k});
    },
    add:(kind,k,props)=>b.add(kind,k,{...props,cardPreset:preset.id},id),
    rect:(k,r,fill,stroke,more={})=>b.rect(k,r,fill,stroke,{...more,cardPreset:preset.id},id),
    line:(k,x1,y1,x2,y2,c,more={})=>b.line(k,x1,y1,x2,y2,c,{...more,cardPreset:preset.id},id),
    text:(k,v,r,size,more={})=>b.text(k,v,r,size,{...more,color:readable(r,more.color??p.ink),...(more.emphasisColor?{emphasisColor:readable(r,more.emphasisColor)}:{}),cardPreset:preset.id},id),
  };
  for(const image of m.images){
    const region={x:box.x+image.x,y:box.y+image.y,w:image.w,h:image.h};
    if(helpers.figure)helpers.figure(nested,project,image.assetId,region,`${key}/figure-${image.index}`);
    else b.page.issues.push({severity:'error',code:'image-card-renderer-missing',slideId:b.page.id,cardId:id,message:'图片卡片缺少科学图像渲染入口，不能以空白框代替图像。'});
  }
  const add=(code,message,extra={})=>b.page.issues.push({severity:'error',code,slideId:b.page.id,cardId:id,message,...extra});
  const [lo,hi]=preset.contentContract.figureCount,count=list(card.figureIds).length;
  if(count<lo||count>hi)add('image-card-figure-count',`${preset.name}需要${lo}幅已登记源图，当前${count}幅；选择匹配的配方，不能丢弃输入图像。`,{expected:lo,actual:count});
  if(m.minimumH>box.h+2)add('card-surface-overflow','图片卡片的完整图像槽、图注、解释与条件超出高度；调整区域、图像槽高度或内容分组，不能裁掉原图、缩字或隐藏限定。',{requiredHeight:Math.ceil(m.minimumH),availableHeight:box.h});
  if(m.metricWidth>m.innerW+2)add('card-metric-width','读数与单位超出图片卡片宽度；扩大区域或使用带独立单位的items。');
  for(const issue of m.unitWidthIssues)add('card-unit-width','完整单位超出读数槽；扩大槽位，不能拆散科学单位。',issue);
  if(box.w<preset.dimensions.minimumWidth)b.page.issues.push({severity:'warning',code:'card-preset-width-review',slideId:b.page.id,cardId:id,message:`${preset.name}建议至少${preset.dimensions.minimumWidth}px宽；实际检查原图标签、图例与说明，不为多放卡片缩小证据。`});
  const [itemLo,itemHi]=preset.contentContract.itemCount,itemCount=list(card.items).length;
  if(itemCount<itemLo||itemCount>itemHi)b.page.issues.push({severity:'warning',code:'card-preset-content-review',slideId:b.page.id,cardId:id,message:`${preset.name}适合${itemLo}–${itemHi}个解释条目，当前${itemCount}个。已保留完整内容，确认对应关系。`});
  if(card.appearance&&['layout','surface','accent'].some(k=>card.appearance[k]!==undefined))b.page.issues.push({severity:'warning',code:'card-preset-appearance-review',slideId:b.page.id,cardId:id,message:'图片卡片由 preset 决定图文结构；appearance.layout/surface/accent 不覆盖预设。外表面支持 fill/stroke/strokeWidth/dash/shadow、radius 和 padding，题签强调色使用 card.accent。外框不裁切科学图。'});
  return true;
}
