import {observeComposition} from './composition-observations.mjs';
/** Actionable diagnostics, not an aesthetic score. Explicit content-tree mode
 * disallows an accidental return to automatic body slots. Legacy projects keep
 * their rendering; their risks are warnings, not silently rewritten content. */
const body=s=>!['cover','section','closing','roadmap','references'].includes(s.layout);
export function compositionCraftReport(project,scenes){
 const issues=[],pages=[];
 for(const s of (project.slides??[]).filter(body)){
  const p=scenes.pages.find(p=>p.id===s.id),positionedDrawing=s.layout==='academic'&&s.drawings?.length>0&&s.drawings.every(d=>d.box),explicit=!!s.composition||positionedDrawing;
  const row={slideId:s.id,route:s.composition?'authored-composition':positionedDrawing?'authored-drawings':'automatic-layout',layout:s.layout,figureCount:(p?.nodes??[]).filter(n=>n.kind==='image').length};pages.push(row);
  issues.push(...observeComposition(s,{nodes:s.authoringMap?.nodes??[],elements:(s.drawings??[]).flatMap(d=>d.elements??[]),contentBox:p?.contentBox}));
  if(s.authoringMap){
   const map=s.authoringMap,es=(s.drawings??[]).flatMap(d=>d.elements??[]),ids=new Set(es.map(e=>e.id));
   const main=map.nodes.find(n=>n.nodeId===map.primaryNodeId);
   const stale=map.nodes.some(n=>n.elementIds.some(id=>!ids.has(id)))||!main;
   if(stale)issues.push({severity:'error',code:'authoring-map-stale',slideId:s.id,message:'构图意图引用的实际对象已改变。通过保存的compose-page输入重新编译，不沿用过期的视觉主角/阅读顺序。'});
   row.primaryNodeId=map.primaryNodeId;row.readingOrder=map.readingOrder;
   if(main){
    const actual=es.filter(e=>main.elementIds.includes(e.id)&&e.kind!=='rect'&&e.kind!=='line');
    row.primaryObjectCount=actual.length;
    if(project.design?.artDirection&&main.kind==='split'&&main.elementIds.length===es.length)issues.push({severity:'warning',code:'primary-node-is-entire-page',slideId:s.id,message:'视觉主角指向了整页分区，无法区分重点。对照实际画面，选定主证据节点或有意义的证据组，不以增加装饰解除提醒。'});
   }
   row.actualGroups=map.nodes.filter(n=>n.kind==='group').map(n=>({nodeId:n.nodeId,box:n.box,objectCount:n.elementIds.length}));
  }
  if(!explicit)issues.push({severity:['content-tree','custom'].includes(project.design?.authoringMode)?'error':'warning',code:'composition-authoring-route',slideId:s.id,path:'slides.'+s.id,message:'本页仍使用自动整页槽位。新作困难正文请用 plan(kind:compose-page) 的内容树，或显式 composition 自主编排；不要只给 figure-focus 换颜色。既有模板的完整布局可使用显式composition；旧工程仍兼容，但不能为绕过检查改设计要求。'});
 }
 const legacy=pages.filter(p=>p.route==='automatic-layout');
 if(legacy.length>=3&&legacy.filter(p=>p.layout===legacy[0].layout).length===legacy.length)issues.push({severity:'warning',code:'composition-repeated-auto-skeleton',message:'多张正文沿用同一个自动骨架；核对任务是否确实相同。连续同协议比较可同构，机制、结果、田间多面板不应未经选择共用侧栏。',slideIds:legacy.map(p=>p.slideId)});
 issues.sort((a,b)=>(a.severity==='error'?0:1)-(b.severity==='error'?0:1));
 return {mode:project.design?.authoringMode??'compatible',pages,issues,basis:'routing-and-structure-diagnostics-not-aesthetic-certification'};
}
