/** Local, falsifiable layout observations; neither a taste score nor a quota.
 * Blank canvas can be intentional. Only allocated, unused payload boxes and
 * text identities are reported, with explicit object locations to inspect. */
const clean=s=>String(s??'').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'');
const rectOf=e=>e&&Number.isFinite(e.x)&&Number.isFinite(e.y)&&e.w>0&&e.h>0?e:null;
const union=es=>es.length?{x:Math.min(...es.map(e=>e.x)),y:Math.min(...es.map(e=>e.y)),right:Math.max(...es.map(e=>e.x+e.w)),bottom:Math.max(...es.map(e=>e.y+e.h))}:null;
export function observeComposition(slide,{nodes=[],elements=[],contentBox}={}){
 const issues=[];
 const title=clean(slide.title),section=clean(slide.section?.title);
 if(section&&(title===section||title.endsWith(section)&&title.length-section.length<=3))issues.push({severity:'warning',code:'chapter-used-as-page-title',slideId:slide.id,message:'当前单页主标题重复章节名。保留章节导航，把本页问题/发现放到主标题；不要再叠一行更长副题。'});
 if(slide.kicker&&/(四代|四篇|前沿证据|研究进展|研究背景|方法范式|研究内容)/u.test(slide.title)&&clean(slide.kicker).length>title.length)issues.push({severity:'warning',code:'claim-buried-in-kicker',slideId:slide.id,message:'长副题可能才是本页要讲的内容。核对章名与单页命题的职责，不自动改写科学结论。'});
 for(const n of nodes){
  if(!['text','comparison','table','flow'].includes(n.kind))continue;
  const selected=elements.filter(e=>n.elementIds.includes(e.id));
  const visible=selected.filter(e=>e.kind!=='line'&&rectOf(e));
  const u=union(visible);
  if(u){const trailing=n.box.y+n.box.h-u.bottom;
   if(trailing>90&&trailing/n.box.h>.35)issues.push({severity:'warning',code:'allocated-payload-cavity',slideId:slide.id,nodeId:n.nodeId,box:n.box,unusedBottom:Math.round(trailing),message:`节点 ${n.nodeId} 的已分配区域下方空出约 ${Math.round(trailing)}px。不是要求填满：优先extent:content或取消多余weight，把面积还给主证据；有意留白需看实图判断。`});}
 }
 const bodyTexts=elements.filter(e=>e.kind==='text'&&e.role!=='note');
 const matches=bodyTexts.filter(e=>clean(e.text)===title&&title.length>5);
 if(matches.length)issues.push({severity:'warning',code:'title-repeated-in-body',slideId:slide.id,elementIds:matches.map(e=>e.id),message:'正文再次完整出现主标题。封面使用compose-opening；正文应换成证据或论证，不把重复题名当信息量。'});
 // Empty typography hierarchy is a risk, not a ban on a black-and-white slide.
 if(bodyTexts.length>=4&&new Set(bodyTexts.map(e=>`${e.fontSize}/${!!e.bold}`)).size===1)issues.push({severity:'warning',code:'single-text-hierarchy',slideId:slide.id,message:'正文标题、解释与读数只有同一种字号字重。核对是否缺少主辅层级；颜色与色块没有数量要求。'});
 return issues;
}
