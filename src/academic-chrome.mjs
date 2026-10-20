/** A small, editable academic page family. No template text or media is copied. */
const arr = value => Array.isArray(value) ? value : [];
const txt = value => typeof value === 'string' ? value : '';
const fail = (b, code, message) => b.page.issues.push({severity:'error',code,slideId:b.page.id,message});

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
  const s=b.system,p=b.p,section=slide.section,brand=project.design?.branding;
  const label=section?[section.number,section.title].filter(Boolean).join('  '):'';
  let top=20;
  if(s.header==='band'){
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
      return {x:48,y,w:1184,h:645-y};
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
  b.line('header-rule',48,y,1232,y,p.line,{strokeWidth:1});
  if(s.header==='rule')b.line('header-accent',48,y,172,y,p.accent,{strokeWidth:3});
  const contentBox={x:48,y:y+16,w:1184,h:645-y-16};
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
  const data=slide.cover||{},s=b.system,p=b.p,style=['framed','project','minimal'].includes(data.variant)?data.variant:s.cover;
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
  if(project.design?.branding?.logoAssetId)logo(b,project,{x:1150,y:602,w:68,h:68},'cover-logo');
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
