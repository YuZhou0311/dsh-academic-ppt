/** A heading is authored geometry while still retaining the complete slide title. */
import { academicAuthoredChrome } from './academic-chrome.mjs';
export function renderAuthoredHeading(b,project,slide,{wrapText,measureTextWidth}){
 const h=slide.heading,box=h.box,size=h.fontSize||b.system.titleSize||44;
 const text=h.lines?.join('\n')||slide.title;
 const fail=(code,message)=>b.page.issues.push({severity:'error',code,slideId:b.page.id,message});
 if(text.replace(/\s/gu,'')!==slide.title.replace(/\s/gu,''))fail('heading-title-mismatch','heading.lines只能指定完整标题的换行，不能换词或删除标题。');
 if(slide.layout==='cover'||slide.layout==='section')fail('heading-layout','cover/section有自己的完整题名布局；不要叠加heading。');
 const inherited=h.inheritChrome?academicAuthoredChrome(b,project,slide,{measureTextWidth}):null;
 for(const reserved of inherited?.reservedBoxes||[]){
  if(Math.min(box.x+box.w,reserved.x+reserved.w)>Math.max(box.x,reserved.x)&&Math.min(box.y+box.h,reserved.y+reserved.h)>Math.max(box.y,reserved.y))fail('heading-chrome-overlap','自定义题名与章节带或身份保留区相碰；重新安排heading.box，不自动移动题名或缩小字号。');
 }
 b.text('title',text,box,size,{role:'title',bold:true,color:h.color||inherited?.titleColor||b.p.ink,align:h.align||'left',lineHeight:1.15,...(h.emphasis?{emphasis:h.emphasis}:{})});
 b.region('heading',box,'heading');
 let bottom=Math.max(box.y+box.h,inherited?.bottom||0);
 // A custom heading still needs the explicitly linked chapter to be visible.
 // Place it after the authored box rather than moving or overwriting that box.
 if(!h.inheritChrome&&slide.sectionId&&slide.section&&b.chrome.showSection!==false){
  const label=[slide.section.number,slide.section.title].filter(Boolean).join('  ');
  const size=b.design.projection?.labelMin||24,h=wrapText(label,1184,size).length*size*1.2;
  b.text('section-label',label,{x:48,y:bottom+8,w:1184,h},size,{role:'section-label',color:b.p.accent,lineHeight:1.2});bottom+=h+8;
 }
 if(slide.kicker){const size=b.design.projection?.labelMin||22,h=wrapText(slide.kicker,1184,size).length*size*1.2;b.text('kicker',slide.kicker,{x:48,y:bottom+6,w:1184,h},size,{role:'label',color:b.p.muted,lineHeight:1.2});bottom+=h+6;}
 if(inherited?.style==='rule'){
  const y=bottom+10;b.line('header-rule',48,y,1232,y,b.p.line,{strokeWidth:1});b.line('header-accent',48,y,172,y,b.p.accent,{strokeWidth:1.6});bottom=y;
 }
 const limit=b.chrome.showSources===false?(b.chrome.showPageNumber===false&&b.chrome.showFooter===false?690:670):645;
 const body={x:48,y:bottom+16,w:1184,h:limit-bottom-16};
 if(body.h<=0)fail('heading-content-space','标题占满了正文区域，须重排题名和正文，不能遮盖研究内容。');
 return body;
}
