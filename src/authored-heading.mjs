/** A heading is authored geometry while still retaining the complete slide title. */
export function renderAuthoredHeading(b,project,slide,{wrapText}){
 const h=slide.heading,box=h.box,size=h.fontSize||b.system.titleSize||44;
 const text=h.lines?.join('\n')||slide.title;
 const fail=(code,message)=>b.page.issues.push({severity:'error',code,slideId:b.page.id,message});
 if(text.replace(/\s/gu,'')!==slide.title.replace(/\s/gu,''))fail('heading-title-mismatch','heading.lines只能指定完整标题的换行，不能换词或删除标题。');
 if(slide.layout==='cover'||slide.layout==='section')fail('heading-layout','cover/section有自己的完整题名布局；不要叠加heading。');
 b.text('title',text,box,size,{role:'title',bold:true,color:h.color||b.p.ink,align:h.align||'left',lineHeight:1.15,...(h.emphasis?{emphasis:h.emphasis}:{})});
 b.region('heading',box,'heading');
 let bottom=box.y+box.h;
 if(slide.kicker){const size=b.design.projection?.labelMin||22,h=wrapText(slide.kicker,1184,size).length*size*1.2;b.text('kicker',slide.kicker,{x:48,y:bottom+6,w:1184,h},size,{role:'label',color:b.p.muted,lineHeight:1.2});bottom+=h+6;}
 const limit=b.chrome.showSources===false?(b.chrome.showPageNumber===false&&b.chrome.showFooter===false?690:670):645;
 const body={x:48,y:bottom+16,w:1184,h:limit-bottom-16};
 if(body.h<=0)fail('heading-content-space','标题占满了正文区域，须重排题名和正文，不能遮盖研究内容。');
 return body;
}
