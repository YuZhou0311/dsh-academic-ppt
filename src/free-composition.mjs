/** Explicit evidence regions. Coordinates express current evidence relationships;
 * no catalogue template or fixed card count is selected here. */
import { renderNativeDrawing } from './native-drawing.mjs';
import { measureCardSurface } from './card-surface.mjs';
const list=v=>Array.isArray(v)?v:[];
const boxOK=b=>b&&['x','y','w','h'].every(k=>Number.isFinite(b[k]))&&b.w>0&&b.h>0;
const inside=(a,b)=>boxOK(a)&&a.x>=b.x-.01&&a.y>=b.y-.01&&a.x+a.w<=b.x+b.w+.01&&a.y+a.h<=b.y+b.h+.01;
const overlaps=(a,b)=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>2&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>2;
export function needsFreeComposition(composition){return Boolean(composition?.regions||list(composition?.rows).some(r=>list(r.panels).some(p=>p.heading!==undefined||p.padding!==undefined||p.drawingIds||p.referenceIds)));}
export function renderBibliography(b,project,ids,area,{wrapText}={}){
 let y=area.y;const labelSize=b.design.projection?.labelMin||24,noteSize=b.design.projection?.noteMin||18;
 for(const id of ids){
  const p=list(project.papers).find(p=>p.id===id);if(!p){b.page.issues.push({severity:'error',code:'missing-reference',slideId:b.page.id,paperId:id,message:'完整书目引用的论文不存在。'});continue;}
  const key=`reference/${id}`,num=list(project.papers).findIndex(p=>p.id===id)+1,title=`[${num}] ${p.title}`;
  const titleH=wrapText(title,area.w,labelSize,{bold:true}).length*labelSize*1.2;
  const meta=[list(p.authors).join(', '),p.journal,p.year,p.doi?`DOI: ${p.doi}`:p.url,p.version].filter(Boolean).join(' · '),metaH=wrapText(meta,area.w,noteSize).length*noteSize*1.24;
  b.text(`${key}/title`,title,{x:area.x,y,w:area.w,h:titleH},labelSize,{bold:true,role:'reference-title',referenceId:id,lineHeight:1.2});
  b.text(`${key}/metadata`,meta,{x:area.x,y:y+titleH+6,w:area.w,h:metaH},noteSize,{role:'citation',referenceId:id,color:b.p.muted,lineHeight:1.24});
  y+=titleH+metaH+22;
 }
 if(y-22>area.y+area.h+2)b.page.issues.push({severity:'error',code:'references-overflow-estimate',slideId:b.page.id,message:'完整书目超出所分配区域；扩大区域或分到另一页，不能删标题或缩小字号。'});
 return y;
}
function proportional(total,items){const weights=items.map(v=>v.weight??1),sum=weights.reduce((a,z)=>a+z,0);return weights.map(w=>total*w/sum);}
export function renderFreeComposition(b,project,slide,h){
 const c=slide.composition,area=h.contentBox,fail=(code,message,details={})=>b.page.issues.push({severity:'error',code:`composition-${code}`,slideId:b.page.id,...details,message});
 if(Boolean(c.rows)===Boolean(c.regions)){fail('mode','composition.rows与regions必须且只能提供一种。');return;}
 const bodySize=b.system.bodySize||28,titleSize=b.system.panelTitleSize||28;
 let top=area.y,bottom=area.y+area.h;
 const leads=[...new Set([c.lead,slide.subtitle].filter(Boolean))];
 for(const [index,text] of leads.entries()){
  const ht=h.wrapText(text,area.w,bodySize).length*bodySize*1.24;
  b.text(text===slide.subtitle?'subtitle':`composition/lead/${index}`,text,{x:area.x,y:top,w:area.w,h:ht},bodySize,{role:'body',lineHeight:1.24});top+=ht+14;
 }
 const endings=[...new Set([c.conclusion?.text,slide.takeaway].filter(Boolean))];
 const closingText=[c.conclusion?.label,...endings].filter(Boolean).join('\n');
 if(closingText){
  const ht=h.wrapText(closingText,area.w,bodySize,{bold:true}).length*bodySize*1.24;bottom-=ht;
  // Keep the exact takeaway text as its own object for visible-content preservation.
  let y=bottom;
  if(c.conclusion?.label){const ht=h.wrapText(c.conclusion.label,area.w,bodySize,{bold:true}).length*bodySize*1.24;b.text('composition/conclusion/label',c.conclusion.label,{x:area.x,y,w:area.w,h:ht},bodySize,{role:'label',bold:true,lineHeight:1.24,color:b.p.accent});y+=ht;}
  endings.forEach((text,i)=>{const ht=h.wrapText(text,area.w,bodySize,{bold:true}).length*bodySize*1.24;b.text(text===slide.takeaway?'takeaway':`composition/conclusion/${i}`,text,{x:area.x,y,w:area.w,h:ht},bodySize,{role:'body',bold:true,lineHeight:1.24,color:b.p.accent});y+=ht;});bottom-=14;
 }
 const content={x:area.x,y:top,w:area.w,h:bottom-top};
 if(content.h<=0){fail('content-space','导语与结论占满正文区域。');return;}
 let panels;
 if(c.regions)panels=c.regions;
 else{
  const rows=list(c.rows),heights=proportional(content.h-18*(rows.length-1),rows);let y=content.y;panels=[];
  rows.forEach((r,ri)=>{const members=list(r.panels),widths=proportional(content.w-20*(members.length-1),members);let x=content.x;members.forEach((p,pi)=>{panels.push({...p,box:{x,y,w:widths[pi],h:heights[ri]}});x+=widths[pi]+20;});y+=heights[ri]+18;});
 }
 const seenPanels=new Set(),used={card:new Set(),figure:new Set(),drawing:new Set(),reference:new Set(),plot:new Set(),primary:new Set()};
 const cards=new Map(list(slide.cards).map((v,i)=>[v.id,{...v,index:i}])),drawings=new Map(list(slide.drawings).map(v=>[v.id,v])),plots=new Map(list(slide.plots).map(v=>[v.id,v]));
 const take=(type,id,map,panelId)=>{if(used[type].has(id)){fail('duplicate-reference','每项输入须有唯一显示位置；发现重复分配。',{panelId,contentType:type,id});return null;}if(map&&!map.has(id)){fail('missing-content','区域引用了不存在的本页内容。',{panelId,contentType:type,id});return null;}used[type].add(id);return map?map.get(id):id;};
 for(const [index,panel] of panels.entries()){
  const box=panel.box;if(!inside(box,content)){fail('region-outside-content','自由区域须位于当前标题、来源与导语之后的正文区域内。',{panelId:panel.id,box,contentBox:content});continue;}
  if(seenPanels.has(panel.id))fail('duplicate-panel-id','区域id在同一页中须唯一。',{panelId:panel.id});seenPanels.add(panel.id);
  for(const previous of panels.slice(0,index))if(boxOK(previous.box)&&overlaps(box,previous.box))fail('region-overlap','独立证据区域不能互相覆盖；需要嵌套关系时在同一自由绘图内表达。',{panelId:panel.id,relatedPanelId:previous.id});
  if(panel.align==='start')fail('explicit-region-align','自由区域使用明确box或行权重；请用区域高度表达顶对齐，不能同时使用align:start。',{panelId:panel.id});
  const key=`composition/region/${panel.id}`,pad=panel.padding??12,hidden=panel.heading==='hidden';
  if(!hidden&&!String(panel.title||'').trim())fail('panel-title','可见题签必须有完整标题；没有题签请显式使用heading:hidden。',{panelId:panel.id});
  const titleH=hidden?0:h.wrapText(panel.title,Math.max(1,box.w-pad*2),titleSize,{bold:true}).length*titleSize*1.15+12;
  const surface=panel.surface==='inherit'||!panel.surface?(b.system.panel==='line'?'rule':b.system.panel):panel.surface;
  if(surface==='tint')b.rect(`${key}/background`,box,b.p.tint,'none',{role:'group',semantic:false});
  if(surface==='band'){
   b.rect(`${key}/frame`,box,b.p.paper,b.p.line,{role:'group',semantic:false});
   if(titleH)b.rect(`${key}/band`,{x:box.x,y:box.y,w:box.w,h:titleH+pad},b.p.accent,'none',{role:'group',semantic:false});
  }
  if(surface==='rule')b.line(`${key}/rule`,box.x,box.y,box.x+box.w,box.y,b.p.accent,{strokeWidth:2,role:'decoration',semantic:false});
  if(!hidden)b.text(`${key}/title`,panel.title,{x:box.x+pad,y:box.y+pad,w:box.w-2*pad,h:titleH},titleSize,{role:'panel-title',bold:true,color:surface==='band'?'#FFFFFF':b.p.ink,lineHeight:1.15});
  const body={x:box.x+pad,y:box.y+pad+titleH,w:box.w-2*pad,h:box.h-pad*2-titleH};
  if(!boxOK(body)){fail('region-space','题签和内边距之后没有正文空间。',{panelId:panel.id});continue;}
  const items=[];
  for(const id of list(panel.figureIds)){if(!list(slide.figureIds).includes(id))fail('figure-reference','panel.figureIds须来自slide.figureIds。',{panelId:panel.id,assetId:id});const value=take('figure',id,null,panel.id);if(value)items.push({kind:'figure',id:value});}
  for(const id of list(panel.drawingIds)){const value=take('drawing',id,drawings,panel.id);if(value){if(value.box)fail('drawing-box-conflict','已归属区域的drawing不能同时固定box；保留局部width/height并让区域定位。',{drawingId:id});items.push({kind:'drawing',value});}}
  if(panel.referenceIds?.length){const selected=[];for(const id of panel.referenceIds){if(!list(slide.referenceIds).includes(id))fail('reference-id','区域书目须在slide.referenceIds中声明。',{paperId:id});const value=take('reference',id,null,panel.id);if(value)selected.push(value);}if(selected.length)items.push({kind:'references',ids:selected});}
  for(const kind of ['chart','table','diagram','plot'])if(panel[kind]){
   const exists=kind==='diagram'?list(slide.nodes).length:slide[kind];if(!exists)fail('missing-primary-artifact','区域指定了本页不存在的科学对象。',{panelId:panel.id,kind});
   if(take('primary',kind,null,panel.id)&&exists)items.push({kind,value:slide[kind]});
  }
  if(panel.plotId){const value=take('plot',panel.plotId,plots,panel.id);if(value)items.push({kind:'plot',value});}
  const chosenCards=[];for(const id of list(panel.cardIds)){const value=take('card',id,cards,panel.id);if(value)chosenCards.push(value);}
  if(!items.length&&!chosenCards.length){fail('empty-panel','自由区域须引用实际证据或解释；空框不构成研究内容。',{panelId:panel.id});continue;}
  const gap=12;
  const cardHeights=chosenCards.map(c=>{
   if(c.box)return c.box.h;
   const measurement=measureCardSurface(c,body.w,{design:b.design,system:b.system,wrapText:h.wrapText,measureTextWidth:h.measureTextWidth});
   if(measurement)return measurement.minimumH;
   const title=h.wrapText(c.title,body.w-40,titleSize,{bold:true}).length*titleSize*1.15;
   const text=h.wrapText(c.body,body.w-40,bodySize).length*bodySize*1.24;
   return title+text+60+(c.metric?130:0);
  });
  const cardsH=cardHeights.reduce((a,z)=>a+z,0)+gap*Math.max(0,chosenCards.length-1);
  const available=body.h-cardsH-(items.length&&chosenCards.length?gap:0),itemH=(available-gap*Math.max(0,items.length-1))/Math.max(1,items.length);
  if(itemH<0||cardsH>body.h+1)fail('region-overflow','自由区域无法保留全部证据与解释，须增大区域或拆分页面。',{panelId:panel.id});
  let y=body.y;
  for(const item of items){const slot={x:body.x,y,w:body.w,h:Math.max(1,itemH)};
   if(item.kind==='drawing')renderNativeDrawing(b,project,item.value,slot,{wrapText:h.wrapText});
   else if(item.kind==='figure')h.figure(b,project,item.id,slot,`${key}/figure/${item.id}`);
   else if(item.kind==='references')renderBibliography(b,project,item.ids,slot,h);
   else if(item.kind==='chart')b.add('chart','data-chart',{...slot,chart:structuredClone(item.value),palette:structuredClone(b.p),fontFamily:b.design.fontFamily,projection:b.design.projection});
   else if(item.kind==='table')h.table(b,item.value,slot,b.design.fontFamily);
   else if(item.kind==='diagram')h.diagram(b,project,slide,slot);
   else if(item.kind==='plot')h.plot(b,item.value,slot,{fontFamily:b.design.fontFamily,wrapText:h.wrapText,measureTextWidth:h.measureTextWidth});
   y+=slot.h+gap;
  }
  chosenCards.forEach((c,i)=>{const slot=c.box||{x:body.x,y,w:body.w,h:cardHeights[i]};if(!inside(slot,body))fail('card-outside-region','明确的card.box须位于所属区域内部。',{panelId:panel.id,cardId:c.id});h.card(b,c,slot,c.index,project);y+=cardHeights[i]+gap;});
 }
 for(const [type,map] of [['drawing',drawings],['card',cards],['plot',plots]])for(const id of map.keys())if(!used[type].has(id))fail('unassigned-content','本页内容没有分配到任何区域。',{contentType:type,id});
 for(const id of list(slide.referenceIds))if(!used.reference.has(id))fail('unassigned-reference','完整书目没有分配到任何区域。',{paperId:id});
}
