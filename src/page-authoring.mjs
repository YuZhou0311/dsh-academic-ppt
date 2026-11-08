/** Compile content relationships into existing editable drawings/composition.
 * This module never reads files, calls models, invents claims, crops images,
 * approves results or changes user constraints. All geometry is deterministic. */
import Ajv from 'ajv';
import {layoutFlow} from './adaptive-flow.mjs';
import {pageNodeSchema,composePageRequestSchema,composeOpeningRequestSchema} from './page-authoring-schema.mjs';
import {buildScenes,wrapText,measureTextWidth} from './scene.mjs';
import {figureGeometry,assessFigurePlacement} from './figure-planning.mjs';
import {observeComposition} from './composition-observations.mjs';
import {getArtDirection} from './art-direction.mjs';
export const PAGE_AUTHORING_VERSION='content-composition-3';
const validate=new Ajv({allErrors:true,strict:true}).addSchema(pageNodeSchema).compile(composePageRequestSchema);
const clone=x=>structuredClone(x);
const unique=x=>[...new Set(x)];
const luminance=hex=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const readableOn=(fill,preferred)=>contrast(fill,preferred)>=4.5?preferred:contrast(fill,'#FFFFFF')>=contrast(fill,'#17212B')?'#FFFFFF':'#17212B';
const round=x=>Math.round(x*1000)/1000;
function fail(code,message,detail={}){const e=new Error(code+': '+message+' '+JSON.stringify(detail));e.code=code;e.detail=detail;throw e;}
export function assertComposePageRequest(request){
 function guard(x,d=0){if(d>24)fail('AUTHORING_DEPTH','构图嵌套过深');if(Array.isArray(x))x.forEach(v=>guard(v,d+1));else if(x&&typeof x==='object')for(const [k,v] of Object.entries(x)){if(['__proto__','constructor','prototype'].includes(k))fail('UNSAFE_KEY',k);guard(v,d+1);}}
 guard(request);
 if(!validate(request))fail('INVALID_COMPOSE_REQUEST',validate.errors.slice(0,8).map(e=>e.instancePath+' '+e.message).join('; '));
 if(request.mode==='replace'&&!request.changeNote)fail('AUTHORING_CHANGE_NOTE_REQUIRED','替换整页须说明本次构图/内容改动；不是局部样式修改');
 return request;
}
export function compileAuthoredPage(project,request){
 assertComposePageRequest(request);
 const base={...clone(request.slide),layout:'academic',figureIds:[],cards:[]};
 const existing=(project.slides??[]).find(s=>s.id===base.id);
 if(request.mode==='create'&&existing)fail('AUTHORING_SLIDE_EXISTS','已有页面请用replace与changeNote',{slideId:base.id});
 if(request.mode==='replace'&&!existing)fail('AUTHORING_SLIDE_MISSING','replace仅用于存在的页面',{slideId:base.id});
 const papers=new Set((project.papers??[]).map(p=>p.id)),claims=new Map((project.claims??[]).map(c=>[c.id,c])),assets=new Map((project.assets??[]).map(a=>[a.id,a]));
 for(const id of base.paperIds)if(!papers.has(id))fail('AUTHORING_UNKNOWN_PAPER','先登记真实来源',{id});
 for(const id of base.claimIds)if(!claims.has(id))fail('AUTHORING_UNKNOWN_CLAIM','先登记当前来源中的证据',{id});
 const seen=new Set(),nodeIndex=new Map();let nodeCount=0;
 function inspect(n,depth=0){if(++nodeCount>80||depth>6)fail('AUTHORING_TREE_LIMIT','最多80个节点、6级构图；复杂页应拆分');if(seen.has(n.id))fail('AUTHORING_DUPLICATE_NODE','节点ID须唯一',{id:n.id});seen.add(n.id);nodeIndex.set(n.id,n);
  for(const c of n.claimIds??[])if(!claims.has(c))fail('AUTHORING_UNKNOWN_CLAIM','先登记证据',{id:c,node:n.id});
  if(n.kind==='split')n.children.forEach(v=>inspect(v,depth+1));if(n.kind==='group')inspect(n.child,depth+1);
 }
 inspect(request.body);
 for(const id of [request.intent.primaryNodeId,...request.intent.readingOrder])if(!seen.has(id))fail('AUTHORING_UNKNOWN_INTENT_NODE','主角与阅读顺序须指向本页节点',{id});
 const seed={...project,slides:[base]},scene=buildScenes(seed),area=scene.pages[0].contentBox,p=scene.design.palette;
 if(!area||area.h<120)fail('AUTHORING_TITLE_TOO_TALL','标题后的正文空间不足；改写题名或拆页');
 const settings=scene.design,art=settings.artDirection?getArtDirection(settings.artDirection):null,projection=settings.projection??{},elements=[],evidenceTables=[],regions=[],boxes=[],warnings=[],figureFits=[],flowFits=[],usedClaims=[...base.claimIds],usedAssets=[];
 const defaults={body:Math.max(28,settings.system?.bodySize??28,projection.bodyMin??0),label:Math.max(24,projection.labelMin??0),note:Math.max(18,projection.noteMin??0),title:32};
 let serial=0,inheritedInk=p.ink,inheritedMuted=p.muted,inheritedFill=p.background;
 const emit=(id,value)=>{elements.push({id:`${id.slice(0,57)}-${++serial}`,...value});if(elements.length>230)fail('AUTHORING_OBJECT_LIMIT','该页原生对象超过230，请拆分或减少无用修饰');};
 const rect=(id,b,fill,stroke='none',sw=1)=>emit(id,{kind:'rect',...b,fill,stroke,strokeWidth:sw,role:'group'});
 const line=(id,pts,color=p.line,sw=1.2,role='decoration',arrow=false,claimIds=[])=>emit(id,{kind:'line',points:pts,stroke:color,strokeWidth:sw,role,endArrow:arrow,...(claimIds.length?{claimIds}:{})});
 const text=(id,value,b,{role='body',size=defaults[role],bold=false,color=p.ink,align='left',vertical='top',claimIds=[],emphasis=[]}={})=>{
  const minimum=role==='note'?18:role==='label'?24:role==='title'?32:28;
  if(size<Math.max(minimum,role==='body'?projection.bodyMin??0:role==='label'?projection.labelMin??0:projection.noteMin??0))fail('AUTHORING_FONT_FLOOR','此入口不靠缩字塞满；扩大文本区、精简非关键文字或拆页',{node:id,size,minimum});
  const lines=wrapText(value,b.w-(emphasis.length?size*.22:0),size,{bold:bold||emphasis.length>0}),height=lines.length*size*1.2+5;
  if(height>b.h+.01)fail('AUTHORING_TEXT_OVERFLOW','保留当前字号重排区域；尚未保存页面',{node:id,requiredHeight:round(height),availableHeight:round(b.h),width:round(b.w),lines});
  let y=b.y+(vertical==='center'?(b.h-height)/2:vertical==='bottom'?b.h-height:0);
  emit(id,{kind:'text',x:b.x,y,w:b.w,h:height,text:value,fontSize:size,role,bold,color,align,lineHeight:1.2,...(emphasis.length?{emphasis}:{}),...(claimIds.length?{claimIds}:{})});
  if(lines.length>1&&measureTextWidth(lines.at(-1),size,{bold})<size*1.8)warnings.push({code:'short-tail-line',nodeId:id,message:'末行过短，修改区域宽度或句子断行',lastLine:lines.at(-1)});
  return height;
 };
 const local=(b)=>Object.fromEntries(Object.entries(b).map(([k,v])=>[k,round(v)]));
 // Content-sized rows remove repeated height guessing. Flex regions receive
 // the remainder; no text/font/data is removed to make an overfull tree pass.
 function intrinsicHeight(n,w){
  if(n.kind==='text'){const size=n.size??defaults[n.role];return wrapText(n.text,w-(n.emphasis?.length?size*.22:0),size,{bold:n.bold||!!n.emphasis?.length}).length*size*1.2+5;}
  if(n.kind==='table'){
   const weights=n.columnWeights??n.columns.map(()=>1),sum=weights.reduce((a,b)=>a+b,0),widths=weights.map(v=>w*v/sum);
   return [n.columns,...n.rows].reduce((h,row)=>h+Math.max(...row.map((v,i)=>wrapText(v,widths[i]-20,defaults.label,{bold:true}).length))*defaults.label*1.2+25,0);
  }
  if(n.kind==='comparison'){
   const labelW=Math.min(230,w*.27),cw=(w-labelW)/n.items.length;
   const head=Math.max(48,...n.items.map(v=>wrapText(v.label,cw-24,defaults.label,{bold:true}).length*defaults.label*1.2+29));
   return head+n.metrics.reduce((sum,m)=>sum+Math.max(wrapText(m.label+(m.unit?'\n'+m.unit:''),labelW-22,defaults.label,{bold:true}).length*defaults.label*1.2,...m.values.map(v=>wrapText(v,cw-24,36,{bold:true}).length*36*1.2))+29+(m.scale?44:0)+(m.note?wrapText(m.note,w-24,18).length*21.6+10:0),0);
  }
  if(n.kind==='statement'){
   const labelW=n.label?Math.min(180,measureTextWidth(n.label,defaults.label,{bold:true})+24)+16:0;
   return Math.max(n.label?defaults.label*1.2+5:0,wrapText(n.text,w-36-labelW,defaults.body).length*defaults.body*1.2+5)+24;
  }
  if(n.kind==='figure'){
   const a=assets.get(n.assetId);if(!a?.width||!a?.height)fail('AUTHORING_UNKNOWN_ASSET','先登记原图',{assetId:n.assetId});
   const v=a.viewport??{w:1,h:1},caption=n.showCaption===false?null:n.caption??a.displayCaption??[a.figure,a.panel].filter(Boolean).join(' · ');
   return w*a.height*v.h/(a.width*v.w)+(caption?wrapText(caption,w,defaults.note).length*defaults.note*1.2+5+(n.captionGap??8):0);
  }
  if(n.kind==='group'){
   const pad=n.padding??art?.group.padding??18,style=n.headingStyle??art?.group.headingStyle??'text',title=n.title?wrapText(n.title,w-2*pad-(style==='rail'?Math.max(0,12-pad):0),defaults.label,{bold:true}).length*defaults.label*1.2+5:0;
   const titleExtra=n.title?(['band','tab'].includes(style)?title+18+12+pad:title+12+2*pad+(style==='rule'?5:0)):pad*2;
   return titleExtra+intrinsicHeight(n.child,w-2*pad);
  }
  if(n.kind==='flow')return layoutFlow(n,{x:0,y:0,w,h:100000},{wrap:wrapText,size:defaults.label}).requiredHeight;
  if(n.kind==='split'){
   const gap=n.gap??18;
   if(n.axis==='y')return n.children.reduce((h,c)=>h+(typeof c.extent==='number'?c.extent:intrinsicHeight(c,w)),0)+gap*(n.children.length-1);
   const space=w-gap*(n.children.length-1),fixed=n.children.reduce((s,c)=>s+(typeof c.extent==='number'?c.extent:0),0),total=n.children.filter(c=>c.extent===undefined).reduce((s,c)=>s+(c.weight??1),0);
   if(n.children.some(c=>c.extent==='content'))fail('AUTHORING_CONTENT_WIDTH','extent:content只用于纵向行；横向用权重或宽度',{node:n.id});
   return Math.max(...n.children.map(c=>intrinsicHeight(c,typeof c.extent==='number'?c.extent:(space-fixed)*(c.weight??1)/total)));
  }
  fail('AUTHORING_CONTENT_UNSUPPORTED','该关系图需要明确高度或弹性区域；extent:content只用于可测量内容',{node:n.id,kind:n.kind});
 }
 function contentSized(n){
  if(['text','statement','table','comparison','flow'].includes(n.kind))return true;
  if(n.kind==='group')return contentSized(n.child);
  if(n.kind==='split')return n.children.every(contentSized);
  return false;
 }
 function allocate(n,b){
  const start=elements.length,entry={nodeId:n.id,kind:n.kind,box:local(b),elementIds:[]};boxes.push(entry);
  allocateNode(n,b);entry.elementIds=elements.slice(start).map(e=>e.id);
 }
 function allocateNode(n,b){
  const cs=n.claimIds??[];usedClaims.push(...cs);
  if(n.kind==='split'){
   const dim=n.axis==='x'?'w':'h',gap=n.gap??18,space=b[dim]-gap*(n.children.length-1);
   if(n.axis==='x'&&n.children.some(v=>v.extent==='content'))fail('AUTHORING_CONTENT_WIDTH','extent:content只用于纵向行；横向用权重或宽度',{node:n.id});
   const extents=n.children.map(v=>v.extent==='content'||(n.axis==='y'&&v.extent===undefined&&v.weight===undefined&&contentSized(v))?intrinsicHeight(v,b.w):v.extent),fixed=extents.filter(v=>v!==undefined).reduce((s,v)=>s+v,0),total=n.children.reduce((s,v,i)=>s+(extents[i]===undefined?(v.weight??1):0),0);
   if(space<fixed-.01)fail('AUTHORING_SPLIT_SPACE','内容所需高度超过区域；扩大、减少重复表达或拆页，不缩字',{node:n.id,space,fixed,measured:n.children.map((v,i)=>({nodeId:v.id,extent:extents[i]??'flex'}))});
   let cursor=b[n.axis]+(!total?(n.align==='center'?(space-fixed)/2:n.align==='end'?space-fixed:0):0);for(const [i,child] of n.children.entries()){
    const extent=extents[i]??(space-fixed)*(child.weight??1)/total;
    if(!Number.isFinite(extent)||extent<20)fail('AUTHORING_SLOT_TOO_SMALL','区域过小，请调整权重或减少节点',{node:child.id,extent});
    allocate(child,{...b,[n.axis]:cursor,[dim]:extent});cursor+=extent+gap;
   }return;
  }
  if(n.kind==='group'){
   const tone=n.tone??art?.group.tone??'plain',pad=n.padding??art?.group.padding??18;
   const style=n.headingStyle??art?.group.headingStyle??'text';
   const dark=['accent','ink'].includes(tone),fill=tone==='accent'?p.accent:tone==='ink'?p.ink:tone==='soft'?(p.tint??p.soft):p.paper;
   if(tone!=='plain')rect(n.id,b,fill,art&&!dark?p.line:'none',.8);
   let content={x:b.x+pad,y:b.y+pad,w:b.w-2*pad,h:b.h-2*pad};
   if(n.title){
    const size=defaults.label,titleH=wrapText(n.title,content.w-(style==='rail'?Math.max(0,12-pad):0),size,{bold:true}).length*size*1.2+5;
    const headH=titleH+18,titleFill=dark?fill:p.accent,headInk=readableOn(titleFill,p.ink);
    if(style==='band'){
     rect(n.id+'-heading-bg',{x:b.x,y:b.y,w:b.w,h:headH},titleFill);
     text(n.id+'-title',n.title,{x:content.x,y:b.y+9,w:content.w,h:titleH},{role:'label',bold:true,color:headInk});
     content.y=b.y+headH+12;content.h=b.y+b.h-pad-content.y;
    }else if(style==='tab'){
     const tabW=Math.min(b.w,measureTextWidth(n.title,size,{bold:true})+2*pad);
     rect(n.id+'-heading-tab',{x:b.x,y:b.y,w:tabW,h:headH},titleFill);
     text(n.id+'-title',n.title,{x:content.x,y:b.y+9,w:tabW-2*pad,h:titleH},{role:'label',bold:true,color:headInk});
     content.y=b.y+headH+12;content.h=b.y+b.h-pad-content.y;
    }else{
     const titleColor=readableOn(tone==='plain'?inheritedFill:fill,dark?'#FFFFFF':p.accent);
     if(style==='rail')rect(n.id+'-heading-rail',{x:b.x,y:b.y+pad,w:4,h:titleH},p.accent);
     const titleIndent=style==='rail'?Math.max(0,12-pad):0;
     text(n.id+'-title',n.title,{...content,x:content.x+titleIndent,w:content.w-titleIndent},{role:'label',bold:true,color:titleColor});
     content.y+=titleH+12;content.h-=titleH+12;
     if(style==='rule'){line(n.id+'-heading-rule',[{x:content.x,y:content.y-5},{x:content.x+content.w,y:content.y-5}],p.line,1);content.y+=5;content.h-=5;}
    }
   }
   if(content.w<30||content.h<30)fail('AUTHORING_GROUP_TOO_SMALL','题签和边距挤占正文；修改分区',{node:n.id});
   const prev=[inheritedInk,inheritedMuted,inheritedFill];if(tone!=='plain'){inheritedFill=fill;inheritedInk=readableOn(fill,p.ink);inheritedMuted=readableOn(fill,p.muted);}
   allocate(n.child,content);[inheritedInk,inheritedMuted,inheritedFill]=prev;return;
  }
  if(n.kind==='text'){text(n.id,n.text,b,{role:n.role,size:n.size??defaults[n.role],bold:n.bold??false,color:n.color??(n.role==='note'?inheritedMuted:inheritedInk),align:n.align,vertical:n.vertical,emphasis:n.emphasis??[],claimIds:cs});return;}
  if(n.kind==='figure'){
   const asset=assets.get(n.assetId);if(!asset)fail('AUTHORING_UNKNOWN_ASSET','先登记真实图片，不得传未登记路径',{node:n.id,assetId:n.assetId});
   if(!asset.data||!asset.width||!asset.height)fail('AUTHORING_ASSET_NOT_EMBEDDED','必须通过record导入图片后再构图',{assetId:asset.id});
   const caption=n.showCaption===false?null:(n.caption??asset.displayCaption??[asset.figure,asset.panel].filter(Boolean).join(' · '));
   let figureBox={...b},captionH=0;const captionGap=n.captionGap??art?.figure.captionGap??8;
   if(caption){captionH=wrapText(caption,b.w,defaults.note).length*defaults.note*1.2+5;figureBox.h-=captionH+captionGap;}
   if(figureBox.h<60)fail('AUTHORING_FIGURE_TOO_SMALL','图注挤占了原图区域',{node:n.id});
   const assessment=assessFigurePlacement(asset,figureBox,{slideId:base.id}),g=assessment.geometry;
   if(!g)fail('AUTHORING_INVALID_IMAGE','无法得到原图尺寸',{assetId:asset.id});
   if(assessment.issues.some(i=>i.severity==='error'))fail('AUTHORING_FIGURE_UNREADABLE','先扩大、使用语义完整面板或分面，不能靠旁注替代不可读图证',{node:n.id,issues:assessment.issues});
   if(asset.viewport)warnings.push({code:'source-crop-needs-visual-check',nodeId:n.id,assetId:asset.id,viewport:asset.viewport,message:'工具只验证裁切几何，必须实看所需标签、端点、图例与语义是否完整。'});
   warnings.push(...assessment.issues.map(i=>({...i,nodeId:n.id})));
   // Place the exact visible aspect-ratio box, so later scene generation cannot
   // confuse slot extent with evidence area. Registered source bytes are retained.
   const align=n.align??art?.figure.align??'top',blockH=g.imageBox.h+(caption?captionH+captionGap:0);
   const y=b.y+(align==='center'?(b.h-blockH)/2:align==='bottom'?b.h-blockH:0);
   const imageBox={...g.imageBox,y};
   emit(n.id,{kind:'image',...imageBox,assetId:asset.id,...(cs.length?{claimIds:cs}:{})});
   const captionBox=caption?{x:b.x,y:y+imageBox.h+captionGap,w:b.w,h:captionH}:null;
   if(caption)text(n.id+'-caption',caption,captionBox,{role:'note',color:inheritedMuted,claimIds:cs});
   figureFits.push({nodeId:n.id,assetId:asset.id,slotBox:local(b),imageBox:local(imageBox),captionBox:captionBox?local(captionBox):null,captionGap:caption?captionGap:0,unusedHeight:round(b.h-blockH),slotUtilization:round(g.occupiedFraction),sourceViewport:asset.viewport??null,projectedLabelPx:assessment.projectedLabelPx});usedAssets.push(asset.id);return;
  }
  if(n.kind==='table'){
   const count=n.columns.length;if(n.rows.some(r=>r.length!==count)||(n.columnWeights&&n.columnWeights.length!==count)||(n.columnAlign&&n.columnAlign.length!==count)||(n.rowTones&&n.rowTones.length!==n.rows.length))fail('AUTHORING_TABLE_DIMENSIONS','表格每行和权重必须与列数一致',{node:n.id});
   const weights=n.columnWeights??n.columns.map(()=>1),sum=weights.reduce((s,v)=>s+v,0),widths=weights.map(w=>b.w*w/sum),rows=[n.columns,...n.rows],pad=10,size=defaults.label;
   const heights=rows.map(row=>Math.max(...row.map((s,i)=>wrapText(s,widths[i]-pad*2,size,{bold:true}).length))*size*1.2+pad*2+5),required=heights.reduce((s,v)=>s+v,0);
   if(required>b.h)fail('AUTHORING_TABLE_OVERFLOW','表格不能缩字号，扩大、减少非关键列或拆页',{node:n.id,requiredHeight:required,availableHeight:b.h});
   const cellIds=[];let y=b.y;rows.forEach((row,ri)=>{const rowIds=[];cellIds.push(rowIds);const h=heights[ri],tone=n.headerTone??'accent',dark=ri===0&&tone!=='soft';rect(n.id+'-row'+ri,{x:b.x,y,w:b.w,h},ri===0?(tone==='ink'?p.ink:tone==='soft'?p.tint:p.accent):ri%2?(p.paper):p.tint);
    const rowTone=ri>0?n.rowTones?.[ri-1]:null;if(rowTone&&rowTone!=='none')rect(n.id+'-highlight'+ri,{x:b.x,y,w:b.w,h},p.tint);if(rowTone==='accent'||rowTone==='secondary')rect(n.id+'-row-accent'+ri,{x:b.x,y,w:4,h},rowTone==='accent'?p.accent:p.secondary);
    let x=b.x;row.forEach((v,ci)=>{if(v){text(n.id+'-cell'+ri+'-'+ci,v,{x:x+pad,y:y+pad,w:widths[ci]-2*pad,h:h-2*pad},{role:'label',size,bold:ri===0||(ci===0&&n.rowHeaders===true),align:n.columnAlign?.[ci]??'left',color:readableOn(ri===0?(tone==='ink'?p.ink:tone==='soft'?p.tint:p.accent):ri%2?p.paper:p.tint,p.ink),claimIds:cs});rowIds.push(elements.at(-1).id);}else rowIds.push(null);x+=widths[ci];});y+=h;
    line(n.id+'-row-line'+ri,[{x:b.x,y},{x:b.x+b.w,y}],p.line,1);
   });evidenceTables.push({id:n.id,cellIds,sourceClaimIds:cs});return;
  }
  if(n.kind==='statement'){
   const tone=n.tone??'soft',fill=tone==='accent'?p.accent:tone==='ink'?p.ink:p.tint;
   rect(n.id,b,fill);rect(n.id+'-rail',{x:b.x,y:b.y,w:5,h:b.h},p.accent);
   let content={x:b.x+18,y:b.y+12,w:b.w-36,h:b.h-24};
   if(n.label){const labelW=Math.min(180,measureTextWidth(n.label,defaults.label,{bold:true})+24);text(n.id+'-label',n.label,{...content,w:labelW},{role:'label',bold:true,color:readableOn(fill,p.accent),claimIds:cs});content.x+=labelW+16;content.w-=labelW+16;}
   text(n.id+'-message',n.text,content,{role:'body',color:readableOn(fill,p.ink),claimIds:cs});return;
  }
  if(n.kind==='comparison'){
   const count=n.items.length;
   for(const m of n.metrics)if(m.scale){
    if(!(m.scale.min<m.scale.max)||m.values.some(v=>!/^[-−+]?\d+(?:\.\d+)?$/.test(v.trim())||!Number.isFinite(Number(v.replace('−','-')))||Number(v.replace('−','-'))<m.scale.min||Number(v.replace('−','-'))>m.scale.max))fail('AUTHORING_COMPARISON_SCALE','刻度必须显式、有限并覆盖所有纯数字读数；不从带单位字符串猜数据',{node:n.id,metric:m.label});
   }
   if(new Set(n.items.map(v=>v.id)).size!==count||n.metrics.some(m=>m.values.length!==count))fail('AUTHORING_COMPARISON_DIMENSIONS','指标必须逐项对应所有方法，不删空缺、不自动计算缺值',{node:n.id});
   const labelW=Math.min(230,b.w*.27),colW=(b.w-labelW)/count;
   if(colW<120)fail('AUTHORING_COMPARISON_WIDTH','比较列过窄，减少同页比较项或扩大版面',{node:n.id,colW});
   const headerH=Math.max(48,...n.items.map(v=>wrapText(v.label,colW-24,defaults.label,{bold:true}).length*defaults.label*1.2+29));
   const rowHeights=n.metrics.map(m=>Math.max(wrapText(m.label+(m.unit?'\n'+m.unit:''),labelW-22,defaults.label,{bold:true}).length*defaults.label*1.2,
    ...m.values.map(v=>wrapText(v,colW-24,36,{bold:true}).length*36*1.2))+29+(m.scale?44:0)+(m.note?wrapText(m.note,b.w-24,18).length*21.6+10:0));
   const totalH=headerH+rowHeights.reduce((a,b)=>a+b,0);
   if(totalH>b.h)fail('AUTHORING_COMPARISON_OVERFLOW','共享指标区放不下；扩大区域、拆页或减少非关键指标，不缩小数字',{node:n.id,requiredHeight:totalH,availableHeight:b.h});
   rect(n.id+'-labels',{x:b.x,y:b.y,w:labelW,h:totalH},p.tint);
   text(n.id+'-label',n.label??'指标',{x:b.x+12,y:b.y+12,w:labelW-24,h:headerH-24},{role:'label',bold:true,color:readableOn(p.tint,p.accent)});
   const cells=[[elements.at(-1).id]];
   n.items.forEach((v,i)=>{const fill=v.tone==='secondary'?p.secondary:v.tone==='plain'?p.tint:p.accent;rect(n.id+'-head'+i,{x:b.x+labelW+i*colW,y:b.y,w:colW,h:headerH},fill);text(n.id+'-headtext'+i,v.label,{x:b.x+labelW+i*colW+12,y:b.y+12,w:colW-24,h:headerH-24},{role:'label',bold:true,align:'center',color:readableOn(fill,p.ink)});cells[0].push(elements.at(-1).id);});
   let y=b.y+headerH;
   n.metrics.forEach((m,j)=>{const h=rowHeights[j],mainH=h-24-(m.scale?44:0)-(m.note?wrapText(m.note,b.w-24,18).length*21.6+10:0);
    rect(n.id+'-row'+j,{x:b.x+labelW,y,w:b.w-labelW,h},j%2?p.tint:p.paper);
    text(n.id+'-metric'+j,m.label+(m.unit?'\n'+m.unit:''),{x:b.x+12,y:y+12,w:labelW-24,h:mainH},{role:'label',bold:true,color:p.ink,claimIds:cs});const cellRow=[elements.at(-1).id];cells.push(cellRow);
    m.values.forEach((v,i)=>{text(n.id+'-value'+j+'-'+i,v,{x:b.x+labelW+i*colW+12,y:y+12,w:colW-24,h:mainH},{role:'label',size:36,bold:true,align:'center',color:readableOn(j%2?p.tint:p.paper,n.items[i].tone==='secondary'?p.secondary:n.items[i].tone==='plain'?p.ink:p.accent),claimIds:cs});cellRow.push(elements.at(-1).id);});
    if(m.scale){
     const by=y+mainH+18;
     n.items.forEach((it,i)=>{const x=b.x+labelW+i*colW+16,w=colW-32,number=Number(m.values[i].replace('−','-')),frac=(number-m.scale.min)/(m.scale.max-m.scale.min);
      rect(n.id+'-track'+j+'-'+i,{x,y:by,w,h:7},p.line);
      const zero=Math.max(0,Math.min(1,(0-m.scale.min)/(m.scale.max-m.scale.min)));
      if(Math.abs(frac-zero)>1e-12)emit(n.id+'-bar'+j+'-'+i,{kind:'rect',x:x+w*Math.min(frac,zero),y:by,w:w*Math.abs(frac-zero),h:7,fill:it.tone==='secondary'?p.secondary:it.tone==='plain'?p.ink:p.accent,stroke:'none',role:'data',...(cs.length?{claimIds:cs}:{})});
      text(n.id+'-scale'+j+'-'+i,`${m.scale.min}–${m.scale.max}`,{x,y:by+11,w,h:27},{role:'note',color:p.muted,align:'right'});
     });
    }
    if(m.note)text(n.id+'-note'+j,m.note,{x:b.x+12,y:y+mainH+24+(m.scale?44:0),w:b.w-24,h:h-mainH-24-(m.scale?44:0)},{role:'note',color:p.muted,claimIds:cs});
    y+=h;line(n.id+'-rule'+j,[{x:b.x,y},{x:b.x+b.w,y}],p.line,1);
   });evidenceTables.push({id:n.id,cellIds:cells,sourceClaimIds:cs});return;
  }
  if(n.kind==='flow'){
   const geometry=layoutFlow(n,b,{wrap:wrapText,size:defaults.label});
   flowFits.push({nodeId:n.id,...clone(geometry)});
   for(const e of geometry.edges){
    line(n.id+'-edge',e.points,e.kind==='feedback'?p.secondary:p.accent,2,'relationship',e.kind!=='association',cs);
    if(e.label)text(n.id+'-edgelabel',e.label,e.labelBox,{role:'note',align:'center',color:e.kind==='feedback'?p.secondary:p.muted});
   }
   for(const v of n.nodes){
    const q=geometry.nodes.find(b=>b.id===v.id),fill=v.tone==='accent'?p.accent:v.tone==='ink'?p.ink:p.tint;
    rect(n.id+'-node-'+v.id,{x:q.x,y:q.y,w:q.w,h:q.h},fill,p.line,1);
    // A short colour rail gives the node identity without a full second frame.
    if(!['accent','ink'].includes(v.tone))rect(n.id+'-rail-'+v.id,{x:q.x,y:q.y,w:4,h:q.h},p.accent);
    const inset={x:q.x+16,y:q.y+16,w:q.w-32,h:q.h-32};
    const th=text(n.id+'-label-'+v.id,v.label,inset,{role:'label',bold:true,color:readableOn(fill,p.accent)});
    if(v.detail)text(n.id+'-body-'+v.id,v.detail,{x:inset.x,y:inset.y+th+12,w:inset.w,h:inset.h-th-12},{role:'label',color:readableOn(fill,p.ink)});
   }
   return;
  }

 }
 allocate(request.body,{x:0,y:0,w:area.w,h:area.h});
 const figures=unique(usedAssets);if(figures.length>4)fail('AUTHORING_FIGURE_LIMIT','现有单页协议最多4个源资产；使用同源完整组合图或分两页');
 usedClaims.push(...elements.flatMap(e=>e.claimIds??[]));const claimIds=unique(usedClaims);
 const allPapers=unique([...base.paperIds,...claimIds.map(c=>claims.get(c)?.paperId),...figures.map(a=>assets.get(a)?.paperId)].filter(Boolean));
 const slide={...base,paperIds:allPapers,claimIds,figureIds:figures,
  authoringMap:{compiler:PAGE_AUTHORING_VERSION,primaryNodeId:request.intent.primaryNodeId,readingOrder:[...request.intent.readingOrder],nodes:clone(boxes)},
  drawings:[{id:'authored-body',width:area.w,height:area.h,elements,...(evidenceTables.length?{evidenceTables}:{})}],
  composition:{regions:[{id:'authored-body',title:'',heading:'hidden',surface:'plain',padding:0,box:clone(area),drawingIds:['authored-body']}]},
  visualPlan:{relationship:request.intent.relationship,primaryPanelId:'authored-body',readingOrder:['authored-body'],rationale:request.intent.rationale},
 };
 // Check emitted primitives with the SAME scene pipeline used by build.
 const compiled=buildScenes({...project,slides:[slide]}),errors=compiled.issues.filter(i=>i.severity==='error');
 if(errors.length)fail('AUTHORING_GEOMETRY_FAILED','尚未保存；按具体节点修构图，不改审稿措辞',{issues:errors.slice(0,12)});
 return {slide,report:{artDirection:settings.artDirection??'legacy',compiler:PAGE_AUTHORING_VERSION,contentBox:clone(area),nodes:boxes,figureFits,flowFits,objectCount:elements.length,intent:clone(request.intent),warnings:[...warnings,...observeComposition(slide,{nodes:boxes,elements,contentBox:area}),...compiled.issues.filter(i=>i.severity!=='error')],approval:'not-reviewed',basis:'deterministic-layout-not-model-creativity-or-visual-approval'}};
}

const validateOpening=new Ajv({allErrors:true,strict:true}).compile(composeOpeningRequestSchema);
export function compileOpeningPage(project,request){
 if(!validateOpening(request))fail('INVALID_OPENING_REQUEST',validateOpening.errors.slice(0,6).map(e=>e.instancePath+' '+e.message).join('; '));
 const exists=project.slides?.some(s=>s.id===request.slide.id);
 if(request.mode==='create'&&exists)fail('AUTHORING_SLIDE_EXISTS','已有封面使用replace');
 if(request.mode==='replace'&&!exists)fail('AUTHORING_SLIDE_MISSING','没有该封面');
 if(request.mode==='replace'&&!request.changeNote)fail('AUTHORING_CHANGE_NOTE_REQUIRED','说明封面修改');
 for(const id of request.slide.paperIds)if(!project.papers?.some(p=>p.id===id))fail('AUTHORING_UNKNOWN_PAPER','先登记来源',{id});
 for(const id of request.slide.claimIds)if(!project.claims?.some(c=>c.id===id))fail('AUTHORING_UNKNOWN_CLAIM','先登记结论',{id});
 const slide={...clone(request.slide),layout:'cover',cover:clone(request.cover),figureIds:[],cards:[]};
 const scenes=buildScenes({...project,slides:[slide]}),errors=scenes.issues.filter(e=>e.severity==='error');
 if(errors.length)fail('AUTHORING_GEOMETRY_FAILED','完整题名与身份区不适配；修改语义断行或封面处理',{issues:errors});
 return {slide,report:{compiler:PAGE_AUTHORING_VERSION,role:'opening',nodes:[],figureFits:[],flowFits:[],objectCount:scenes.pages[0].nodes.length,warnings:scenes.issues,approval:'not-reviewed',basis:'existing-cover-renderer-not-aesthetic-approval'}};
}
