import { drawSemanticIcon } from './card-surface.mjs';
/** A small, editable academic page family. No template text or media is copied. */
const arr = value => Array.isArray(value) ? value : [];
const txt = value => typeof value === 'string' ? value : '';
const fail = (b, code, message) => b.page.issues.push({severity:'error',code,slideId:b.page.id,message});

export function resolveChrome(design = {}, slide = {}) { return { ...design.chrome, ...slide.chrome }; }
function contentBottom(chrome) { return chrome.showSources===false ? (chrome.showPageNumber===false && chrome.showFooter===false ? 690 : 670) : 645; }

function logo(b, project, box, key) {
  const id=project.design?.branding?.logoAssetId;
  if(!id)return;
  const asset=arr(project.assets).find(a=>a.id===id);
  if(!asset||asset.usage!=='decorative'){
    fail(b,'branding-logo-source','branding.logoAssetId 需要已登记、由当前报告授权使用的 decorative 资产；不能借用模板机构标志。');return;
  }
  const scale=Math.min(box.w/asset.width,box.h/asset.height),w=asset.width*scale,h=asset.height*scale;
  b.add('image',key,{x:box.x+(box.w-w)/2,y:box.y+(box.h-h)/2,w,h,assetId:id,data:asset.data,alt:asset.caption,fit:'contain'});
}

export function academicHeader(b, project, slide, {wrapText,measureTextWidth}) {
  const s=b.system,p=b.p,chrome=resolveChrome(project.design,slide),section=chrome.showSection===false?null:slide.section;
  const brand=chrome.showBrand===false?null:{...project.design?.branding,...(chrome.brandLabel!==undefined?{label:chrome.brandLabel}:{})};
  const headerStyle=chrome.header||s.header,bottomLimit=contentBottom(chrome);
  const label=section?[section.number,section.title].filter(Boolean).join('  '):'';
  let top=20;
  if(headerStyle==='band'){
    const brandW=brand?.label?Math.min(360,measureTextWidth(brand.label,22,{bold:true})+4):0;
    const logoW=brand?.logoAssetId?48:0;
    const right=brandW||logoW?1232-brandW-logoW-26:1232;
    const titleInBand=!label,titleH=titleInBand?wrapText(slide.title,right-48,s.titleSize,{bold:true}).length*s.titleSize*1.13:0;
    const bh=titleInBand?Math.max(60,titleH+18):54;
    b.rect('academic-header-band',{x:0,y:0,w:1280,h:bh},p.accent,'none');
    if(label)b.text('section-label',label,{x:48,y:10,w:right-48,h:40},s.sectionSize,{bold:true,color:'#FFFFFF',lineHeight:1.1,role:'section-label'});
    if(titleInBand)b.text('title',slide.title,{x:48,y:9,w:right-48,h:titleH},s.titleSize,{bold:true,color:'#FFFFFF',lineHeight:1.13,role:'title'});
    if(brand?.label)b.text('brand-label',brand.label,{x:1232-brandW,y:14,w:brandW,h:29},22,{color:'#FFFFFF',bold:true,lineHeight:1.1,role:'identity'});
    if(brand?.logoAssetId)logo(b,project,{x:1232-brandW-logoW-8,y:7,w:40,h:40},'header-logo');
    if(titleInBand){
      let y=bh+18;
      if(slide.kicker){const h=wrapText(slide.kicker,1184,s.captionSize+2).length*(s.captionSize+2)*1.2;b.text('kicker',slide.kicker,{x:48,y,w:1184,h},s.captionSize+2,{color:p.muted,lineHeight:1.2,role:'subtitle'});y+=h+14;}
      return {x:48,y,w:1184,h:bottomLimit-y};
    }
    top=70;
  } else if(label||brand?.label||brand?.logoAssetId){
    const brandW=brand?.label?Math.min(360,measureTextWidth(brand.label,22,{bold:true})+4):0,logoW=brand?.logoAssetId?48:0;
    if(label)b.text('section-label',label,{x:48,y:14,w:1184-brandW-logoW-(brandW||logoW?26:0),h:36},s.sectionSize,{bold:true,color:p.accent,lineHeight:1.1,role:'section-label'});
    if(brand?.label)b.text('brand-label',brand.label,{x:1232-brandW,y:18,w:brandW,h:28},22,{color:p.accent,bold:true,lineHeight:1.1,role:'identity'});
    if(brand?.logoAssetId)logo(b,project,{x:1232-brandW-logoW-8,y:8,w:40,h:40},'header-logo');
    top=58;
  }
  const titleH=wrapText(slide.title,1184,s.titleSize,{bold:true}).length*s.titleSize*1.13;
  b.text('title',slide.title,{x:48,y:top,w:1184,h:titleH},s.titleSize,{bold:true,color:p.ink,lineHeight:1.13,role:'title'});
  let bottom=top+titleH;
  if(slide.kicker){
    const h=wrapText(slide.kicker,1184,s.captionSize+2).length*(s.captionSize+2)*1.2;
    b.text('kicker',slide.kicker,{x:48,y:bottom+6,w:1184,h},s.captionSize+2,{color:p.muted,lineHeight:1.2,role:'subtitle'});
    bottom+=h+6;
  }
  const y=bottom+10;
  if(headerStyle!=='plain')b.line('header-rule',48,y,1232,y,p.line,{strokeWidth:1});
  if(headerStyle==='rule')b.line('header-accent',48,y,172,y,p.accent,{strokeWidth:3});
  const gap=headerStyle==='plain'?10:16;
  const contentBox={x:48,y:y+gap,w:1184,h:bottomLimit-y-gap};
  if(contentBox.h<360)fail(b,'academic-header-too-tall','章节与标题挤占过多正文空间；去掉重复副题，或在不丢失研究含义的前提下精简标题。');
  return contentBox;
}

function exactTitle(b, slide) {
  if(!slide.cover?.titleLines?.length)return txt(slide.title);
  const value=slide.cover.titleLines.join('\n');
  if(value.replace(/\s/gu,'')!==slide.title.replace(/\s/gu,'')){
    fail(b,'cover-title-mismatch','cover.titleLines 只能指定完整题目的语义换行，不能替换或删除题名。');return slide.title;
  }
  return value;
}

export function academicCover(b, project, slide, {wrapText}) {
  const data=slide.cover||{},s=b.system,p=b.p,style=['framed','project','minimal','split','editorial','custom'].includes(data.variant)?data.variant:s.cover;
  if(style==='custom'){customCover(b,project,slide,{wrapText});return;}
  if(data.boxes||data.align)fail(b,'cover-custom-fields','cover.boxes与cover.align用于variant:custom；已有变体不静默忽略自主区域设置。');
  if(['split','editorial'].includes(style)){modernCover(b,project,slide,{wrapText},style);return;}
  if(data.assetId||data.icon||data.visualCaption)fail(b,'cover-visual-layout','封面语境图片与图标需要split或editorial变体；不能在不支持的变体中静默丢弃媒体。');
  const title=exactTitle(b,slide),size=s.coverTitleSize,align=style==='project'?'left':'center',x=style==='project'?84:64,w=1280-x*2;
  const occasion=[...new Set([data.occasion,slide.kicker].filter(Boolean))].join(' · ');
  if(style==='framed'){
    b.rect('cover-identity-band',{x:0,y:0,w:1280,h:100},p.accent,'none');
    if(occasion)b.text('cover-occasion',occasion,{x:64,y:25,w:1152,h:64},28,{color:'#FFFFFF',bold:true,align:'center',lineHeight:1.15,role:'cover-occasion'});
    b.rect('cover-base',{x:0,y:542,w:1280,h:178},p.tint,'none');
    b.rect('cover-divider',{x:0,y:538,w:1280,h:5},p.accent,'none');
    b.rect('cover-divider-emphasis',{x:0,y:538,w:186,h:5},p.secondary,'none');
  }else if(style==='project'){
    if(occasion)b.text('cover-occasion',occasion,{x:84,y:52,w:1112,h:65},26,{color:p.muted,lineHeight:1.2,role:'cover-occasion'});
    b.rect('cover-base',{x:0,y:590,w:1280,h:130},p.accent,'none');
    b.line('cover-identity-rule',84,132,1196,132,p.line,{strokeWidth:1.2});
  }else{
    b.line('cover-identity-rule',558,130,722,130,p.accent,{strokeWidth:4});
    if(occasion)b.text('cover-occasion',occasion,{x:64,y:52,w:1152,h:60},26,{color:p.muted,align:'center',lineHeight:1.2,role:'cover-occasion'});
  }
  const titleH=wrapText(title,w,size,{bold:true}).length*size*1.16;
  const subSize=30,subH=slide.subtitle?wrapText(slide.subtitle,w,subSize).length*subSize*1.22:0;
  const groupH=titleH+(subH?subH+24:0),groupTop=style==='project'?165:154,groupLimit=style==='project'?500:504;
  const y=groupTop+Math.max(0,(groupLimit-groupTop-groupH)/2);
  b.text('title',title,{x,y,w,h:titleH},size,{bold:true,color:style==='framed'?p.ink:p.accent,align,lineHeight:1.16,role:'cover-title'});
  if(subH)b.text('subtitle',slide.subtitle,{x,y:y+titleH+24,w,h:subH},subSize,{color:p.accent,align,lineHeight:1.22,role:'cover-subtitle'});
  if(y+groupH>groupLimit+2)fail(b,'cover-title-metadata-overlap','完整题名和副题超出封面研究主题区；使用语义换行、减少重复副题，或调整 design.system.coverTitleSize（不可小于60px）。');
  const metaSize=24;
  if(style==='project'){
    if(data.presenter)b.text('cover-presenter',data.presenter,{x:84,y:526,w:900,h:52},26,{color:p.ink,lineHeight:1.2,role:'cover-metadata'});
    if(data.affiliation)b.text('cover-affiliation',data.affiliation,{x:84,y:610,w:960,h:64},metaSize,{color:'#FFFFFF',lineHeight:1.24,role:'cover-metadata'});
    if(data.date)b.text('cover-date',data.date,{x:84,y:684,w:1020,h:30},22,{color:'#FFFFFF',lineHeight:1.2,role:'cover-metadata'});
  }else{
    const info=[data.presenter,data.affiliation].filter(Boolean),metaW=950,metaX=(1280-metaW)/2;
    const heights=info.map(value=>wrapText(value,metaW,metaSize).length*metaSize*1.2);
    let my=style==='minimal'?560:566;
    for(let i=0;i<info.length;i++){
      b.text(i===0&&data.presenter?'cover-presenter':'cover-affiliation',info[i],{x:metaX,y:my,w:metaW,h:heights[i]},metaSize,{color:p.accent,align:'center',lineHeight:1.2,role:'cover-metadata'});my+=heights[i]+8;
    }
    if(data.date)b.text('cover-date',data.date,{x:64,y:666,w:1152,h:30},22,{color:p.muted,align:'center',lineHeight:1.2,role:'cover-metadata'});
    if(my>656)fail(b,'cover-metadata-overflow','封面责任主体超过身份区；精简重复身份表述，保留真实机构和署名。');
  }
  if(project.design?.branding?.logoAssetId&&resolveChrome(project.design,slide).showBrand!==false)logo(b,project,{x:1150,y:602,w:68,h:68},'cover-logo');
}

function contextVisual(b, project, data, area, key, wrapText) {
  if(data.assetId&&data.icon)fail(b,'context-visual-conflict','同一语境图槽只选择assetId或icon，不能静默忽略其中一项。');
  const captionSize=b.system.captionSize,captionH=data.visualCaption?wrapText(data.visualCaption,area.w,captionSize).length*captionSize*1.24:0;
  if(captionH+(captionH?12:0)+48>area.h)fail(b,'context-visual-height','语境图片区域不足以容纳可见媒体与完整说明；扩大visual区域或精简重复图注。');
  const visual={...area,h:Math.max(1,area.h-(captionH?captionH+12:0))};
  if(data.assetId){
    const asset=arr(project.assets).find(item=>item.id===data.assetId);
    if(!asset||asset.usage!=='decorative')fail(b,'context-visual-source','封面/结尾assetId必须引用已登记的decorative语境图片；科学证据原图请使用figureIds与composition。');
    else {
      const viewport=asset.viewport,iw=asset.width*(viewport?.w??1),ih=asset.height*(viewport?.h??1);
      const scale=Math.min(visual.w/iw,visual.h/ih),w=iw*scale,h=ih*scale;
      b.add('image',key,{x:visual.x+(visual.w-w)/2,y:visual.y+(visual.h-h)/2,w,h,data:asset.data,assetId:asset.id,alt:asset.caption,fit:'contain',...(viewport?{viewport:{...viewport}}:{}),role:'context-visual',semantic:false});
      b.page.notes += `\n\n语境图片：${asset.caption}\n来源：${asset.sourceUrl}\n版本：${asset.sourceVersion}\n许可：${asset.license}`;
    }
  } else if(data.icon) {
    const size=Math.min(visual.w,visual.h,200);
    drawSemanticIcon(b,data.icon,{x:visual.x+(visual.w-size)/2,y:visual.y+(visual.h-size)/2,w:size,h:size},b.p.accent,`${key}/icon`);
  }
  if(data.visualCaption)b.text(`${key}/caption`,data.visualCaption,{x:area.x,y:area.y+area.h-captionH,w:area.w,h:captionH},captionSize,{color:b.p.muted,lineHeight:1.24,role:'context-caption'});
}

/** Authored semantic regions, with no preset frame, corner label or decoration. */
function customCover(b,project,slide,{wrapText}) {
  const data=slide.cover||{},boxes=data.boxes||{},s=b.system,p=b.p,align=data.align||'left';
  const title=exactTitle(b,slide),occasion=[...new Set([data.occasion,slide.kicker].filter(Boolean))].join(' · ');
  const metadata=[['cover-presenter',data.presenter],['cover-affiliation',data.affiliation],['cover-date',data.date]].filter(([,value])=>value);
  const values={title,subtitle:slide.subtitle,occasion,metadata:metadata.length,visual:data.assetId||data.icon||data.visualCaption};
  const usable={};
  for(const [role,value]of Object.entries(values)){
    const box=boxes[role];
    if(!value){if(box)fail(b,'cover-empty-role',`cover.boxes.${role}没有对应内容；移除空区域，不能用空盒假装填满页面。`);continue;}
    if(!box){fail(b,'cover-role-box-missing',`custom封面的${role}内容需要cover.boxes.${role}，不能静默删除已填写的标题、身份或媒体。`);continue;}
    if(!['x','y','w','h'].every(key=>Number.isFinite(box[key]))||box.x<0||box.y<0||box.w<=0||box.h<=0||box.x+box.w>1280||box.y+box.h>720){fail(b,'cover-role-box-bounds',`cover.boxes.${role}必须完整位于1280×720页面内。`);continue;}
    usable[role]=box;b.region(`cover/${role}`,box,'cover-role');
  }
  if(usable.title)b.text('title',title,usable.title,s.coverTitleSize,{bold:true,color:p.accent,align,lineHeight:1.12,role:'cover-title'});
  if(usable.subtitle)b.text('subtitle',slide.subtitle,usable.subtitle,28,{color:p.ink,align,lineHeight:1.22,role:'cover-subtitle'});
  if(usable.occasion)b.text('cover-occasion',occasion,usable.occasion,24,{color:p.muted,align,lineHeight:1.16,role:'cover-occasion'});
  if(usable.metadata){
    const box=usable.metadata;let y=box.y;
    for(const [key,value]of metadata){const h=wrapText(value,box.w,22).length*22*1.2;b.text(key,value,{x:box.x,y,w:box.w,h},22,{color:key==='cover-date'?p.muted:p.ink,align,lineHeight:1.2,role:'cover-metadata'});y+=h+10;}
    if(y-10>box.y+box.h+2)fail(b,'cover-metadata-overflow','custom封面的metadata区域不足以显示完整报告人、机构与日期；扩大区域，不删去真实身份。');
  }
  if(usable.visual){
    if(!data.assetId&&!data.icon)fail(b,'context-caption-without-visual','visualCaption需要对应的assetId或icon。');
    else contextVisual(b,project,data,usable.visual,'cover-context',wrapText);
  }
}

function modernCover(b, project, slide, {wrapText}, style) {
  const data=slide.cover||{},s=b.system,p=b.p,title=exactTitle(b,slide),split=style==='split';
  const titleBox=split?{x:64,y:150,w:650,h:366}:{x:64,y:116,w:1112,h:260};
  const occasion=[...new Set([data.occasion,slide.kicker].filter(Boolean))].join(' · ');
  if(split)b.rect('cover-visual-field',{x:758,y:70,w:458,h:580},p.tint,'none',{radius:18,role:'decoration',semantic:false});
  else b.rect('cover-editorial-field',{x:842,y:0,w:438,h:720},p.tint,'none',{role:'decoration',semantic:false});
  if(occasion)b.text('cover-occasion',occasion,{x:64,y:50,w:split?650:1112,h:56},24,{color:p.muted,lineHeight:1.16,role:'cover-occasion'});
  const titleH=wrapText(title,titleBox.w,s.coverTitleSize,{bold:true}).length*s.coverTitleSize*1.12;
  b.text('title',title,{...titleBox,h:titleH},s.coverTitleSize,{bold:true,color:p.accent,lineHeight:1.12,role:'cover-title'});
  let bottom=titleBox.y+titleH;
  if(slide.subtitle){const h=wrapText(slide.subtitle,split?650:740,28).length*28*1.22;b.text('subtitle',slide.subtitle,{x:64,y:bottom+22,w:split?650:740,h},28,{color:p.ink,lineHeight:1.22,role:'cover-subtitle'});bottom+=22+h;}
  if(bottom>(split?530:450))fail(b,'cover-title-metadata-overlap','当前封面的完整题名与副题超出主题区；按语义换行，调整封面变体或去掉重复副题。');
  const visual=split?{x:782,y:102,w:410,h:516}:{x:872,y:376,w:344,h:274};
  if(data.assetId||data.icon)contextVisual(b,project,data,visual,'cover-context',wrapText);
  else if(data.visualCaption)fail(b,'context-caption-without-visual','visualCaption需要对应的assetId或icon。');
  else if(split)fail(b,'cover-visual-missing','split封面需要登记的语境图片或有语义用途的icon；无媒体时改用editorial/framed等文字主导构图。');
  const metadata=[['cover-presenter',data.presenter],['cover-affiliation',data.affiliation],['cover-date',data.date]].filter(([,value])=>value);
  let y=split?558:530;
  for(const [key,value]of metadata){const h=wrapText(value,split?650:740,22).length*22*1.2;b.text(key,value,{x:64,y,w:split?650:740,h},22,{color:key==='cover-date'?p.muted:p.ink,lineHeight:1.2,role:'cover-metadata'});y+=h+10;}
  if(y>700)fail(b,'cover-metadata-overflow','封面责任主体超过页面；保留真实身份并精简重复表述。');
  b.rect('cover-accent',{x:64,y:(split?538:502),w:Math.min(180,titleBox.w*.3),h:4},p.accent,'none',{role:'decoration',semantic:false});
}

export function academicClosing(b,project,slide,{wrapText,measureTextWidth,card,contentBox}) {
  const data=slide.closing,p=b.p,area=contentBox,statementStyle=data.variant==='statement',cards=arr(slide.cards);
  const hasVisual=Boolean(data.assetId||data.icon);
  if(arr(slide.figureIds).length)fail(b,'closing-evidence-layout','closing语境图不能代替论文证据；含figureIds时使用composition设计结尾。');
  const statementW=statementStyle&&cards.length||statementStyle&&hasVisual?area.w*.56:area.w;
  const statementSize=statementStyle?48:38,statementH=wrapText(data.statement,statementW,statementSize,{bold:true}).length*statementSize*1.16;
  b.text('closing-statement',data.statement,{x:area.x,y:area.y+12,w:statementW,h:statementH},statementSize,{bold:true,color:p.accent,lineHeight:1.16,role:'closing-statement'});
  let questionY=area.y+area.h;
  if(data.question){const w=statementStyle?statementW:area.w,h=wrapText(data.question,w-28,26).length*26*1.24;questionY=area.y+area.h-h-28;b.rect('closing-question-surface',{x:area.x,y:questionY,w,h:h+28},p.tint,'none',{radius:12,role:'decoration',semantic:false});b.text('closing-question',data.question,{x:area.x+14,y:questionY+14,w:w-28,h},26,{color:p.ink,lineHeight:1.24,role:'closing-question'});}
  const cardsArea=statementStyle?{x:area.x+area.w*.61,y:area.y+12,w:area.w*.39,h:area.h-12}:{x:area.x,y:area.y+statementH+40,w:area.w,h:questionY-(area.y+statementH+40)-16};
  if(statementStyle&&area.y+12+statementH>questionY-20)fail(b,'closing-statement-overflow','结尾主结论与问题相撞；压缩重复措辞或使用evidence变体/自由composition。');
  if(hasVisual&&cards.length)fail(b,'closing-visual-card-conflict','内建结尾变体的辅助区域只选cards或assetId/icon；同时需要时使用composition自由安排。');
  if(!hasVisual&&data.visualCaption)fail(b,'context-caption-without-visual','visualCaption需要对应的assetId或icon。');
  if(hasVisual)contextVisual(b,project,data,cardsArea,'closing-context',wrapText);
  else if(cards.length){
    const gap=18,horizontal=!statementStyle,columns=horizontal?cards.length:1,rows=horizontal?1:cards.length;
    const w=(cardsArea.w-gap*(columns-1))/columns,h=(cardsArea.h-gap*(rows-1))/rows;
    for(const [i,c]of cards.entries())card(b,c,c.box||{x:cardsArea.x+(horizontal?i*(w+gap):0),y:cardsArea.y+(horizontal?0:i*(h+gap)),w,h},i,project,'compact');
  }
}

export function academicSection(b, project, slide, {wrapText}) {
  const p=b.p,s=b.system,items=slide.agenda?.items||[],active=slide.agenda?.active,sectionSize=s.sectionSize*1.4;
  b.rect('section-identity',{x:0,y:0,w:346,h:720},p.accent,'none');
  b.rect('section-base',{x:346,y:0,w:934,h:720},p.tint,'none');
  if(slide.section?.number)b.text('section-number',slide.section.number,{x:52,y:146,w:238,h:115},94,{color:'#FFFFFF',bold:true,lineHeight:1.05,role:'section-index'});
  const label=slide.section?.title||slide.title;
  const labelH=wrapText(label,238,sectionSize,{bold:true}).length*sectionSize*1.16;
  b.text('section-name',label,{x:52,y:290,w:238,h:labelH},sectionSize,{color:'#FFFFFF',bold:true,lineHeight:1.16,role:'section-label'});
  b.line('section-mark',52,278,166,278,'#FFFFFF',{strokeWidth:3});
  if(items.length){
    const title=slide.title===label?'汇报脉络':slide.title;
    b.text('title',title,{x:410,y:76,w:808,h:80},s.titleSize,{bold:true,color:p.accent,lineHeight:1.15,role:'title'});
    let y=186;
    const gap=18,h=Math.min(84,(470-gap*(items.length-1))/items.length);
    items.forEach((item,i)=>{
      const selected=active===i+1,fill=selected?p.accent:p.paper,color=selected?'#FFFFFF':p.ink;
      b.rect(`agenda:${i}:band`,{x:410,y,w:808,h},fill,'none');
      b.text(`agenda:${i}:number`,String(i+1).padStart(2,'0'),{x:430,y:y+14,w:58,h:40},28,{color:selected?'#FFFFFF':p.accent,bold:true,lineHeight:1.1,role:'section-index'});
      b.text(`agenda:${i}:title`,item.title,{x:510,y:y+12,w:688,h:h-20},s.panelTitleSize,{color,bold:selected,lineHeight:1.15,role:'agenda-title'});
      if(item.summary)fail(b,'agenda-summary-not-supported','章节导航只显示条目标题；将必要解释放在机制或论证页，不把隐藏 summary 留在记录中。');
      y+=h+gap;
    });
    if(active&&active>items.length)fail(b,'agenda-active-out-of-range','agenda.active 必须对应实际章节条目。');
  }else{
    b.text('title',slide.title,{x:416,y:214,w:790,h:198},s.titleSize*1.4,{bold:true,color:p.accent,lineHeight:1.17,role:'title'});
    if(slide.subtitle)b.text('subtitle',slide.subtitle,{x:416,y:434,w:790,h:140},28,{color:p.muted,lineHeight:1.25,role:'subtitle'});
  }
  if(slide.kicker)b.text('kicker',slide.kicker,{x:52,y:620,w:238,h:65},22,{color:'#FFFFFF',lineHeight:1.2,role:'identity'});
}
