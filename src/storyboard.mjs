/** A reviewable argument before page furniture. Records are attestations, not
 * proof that an agent read a paper or that a person approved a direction. */
import {hash, stable} from './io.mjs';

const text=(maxLength=1800)=>({type:'string',minLength:1,maxLength,pattern:'\\S'});
const id={type:'string',pattern:'^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'};
const arr=(items,maxItems=120,minItems=0)=>({type:'array',items,maxItems,minItems});
const obj=(properties,required=Object.keys(properties))=>({type:'object',properties,required,additionalProperties:false});
const en=values=>({type:'string',enum:values});
const list=x=>Array.isArray(x)?x:[];
const normal=x=>String(x??'').normalize('NFKC').replace(/\s/gu,'').toLowerCase();
const roles=['orientation','question','mechanism','design','evidence','synthesis','limitation','proposal','references'];
const decision=obj({status:en(['proposed','confirmed','delegated']),userResponse:text(2400),rationale:text(1800)},['status']);

export const storyboardPageSchema=obj({
  slideId:id,title:text(700),role:en(roles),question:text(1000),
  claimIds:arr(id,30),assetIds:arr(id,12),warrant:text(1800),boundary:text(1400),
  transition:{type:'string',maxLength:1000},seconds:{type:'number',minimum:0,maximum:1800},
  layoutFamily:text(100),layoutReason:text(1000),repetitionReason:text(1000),
  mustShow:arr(text(600),20),
},['slideId','title','role','question','claimIds','assetIds','warrant','boundary','transition','seconds','layoutFamily','layoutReason']);

export const storyboardSchema=obj({
  version:{const:1,type:'integer'},objective:text(1800),audienceTakeaway:text(1800),
  throughline:text(2400),pages:arr(storyboardPageSchema,120,1),decision,
  pilot:obj({coverSlideId:id,hardestSlideId:id,sequenceSlideIds:arr(id,3,3),reason:text(1800)},['hardestSlideId','sequenceSlideIds','reason']),
},['version','objective','audienceTakeaway','throughline','pages','decision']);

export const storyboardRequestSchema={oneOf:[
  obj({kind:{const:'storyboard',type:'string'},storyboard:storyboardSchema}),
  obj({kind:{const:'pilot-review',type:'string'},decision:en(['confirmed','delegated']),userResponse:text(2400),notes:text(3000)}),
]};

export function storyboardSignature(plan){
  if(!plan)return null;
  const {decision:ignored,...content}=plan;
  return hash(stable(content));
}

export function pilotSlideIds(plan){return [...new Set([plan?.pilot?.coverSlideId,plan?.pilot?.hardestSlideId,...list(plan?.pilot?.sequenceSlideIds)].filter(Boolean))];}

function usedClaims(slide){return [...new Set([...list(slide.claimIds),...list(slide.cards).flatMap(c=>list(c.claimIds)),slide.chart?.sourceClaimId,...list(slide.table?.sourceClaimIds),...list(slide.plot?.sourceClaimIds),...list(slide.plots).flatMap(p=>list(p.sourceClaimIds)),...list(slide.drawings).flatMap(d=>[...list(d.claimIds),...list(d.elements).flatMap(e=>list(e.claimIds))])].filter(Boolean))];}
function usedAssets(slide){return [...new Set([...list(slide.figureIds),...list(slide.cards).flatMap(c=>list(c.figureIds)),...list(slide.drawings).flatMap(d=>list(d.elements).filter(e=>e.kind==='image').map(e=>e.assetId))])];}

/** New pages do not invalidate an unchanged pilot. Changing its science,
 * typography, palette or narrative does; merely recording an answer does not. */
export function pilotFingerprint(project){
  const ids=pilotSlideIds(project.storyboard),pages=list(project.slides).filter(s=>ids.includes(s.id));
  const claimIds=new Set(pages.flatMap(usedClaims));
  let changed=true;while(changed){changed=false;for(const c of list(project.claims))if(claimIds.has(c.id))for(const d of list(c.dependsOn))if(!claimIds.has(d)){claimIds.add(d);changed=true;}}
  const assetIds=new Set(pages.flatMap(s=>[...usedAssets(s),s.cover?.assetId,s.closing?.assetId].filter(Boolean)));
  const sources=new Set([...pages.flatMap(s=>list(s.paperIds)),...list(project.claims).filter(c=>claimIds.has(c.id)).map(c=>c.paperId)]);
  const {consultation,referenceStudy,...design}=project.design??{};
  return hash(stable({storyboard:storyboardSignature(project.storyboard),design,brief:project.brief,pages,
    claims:list(project.claims).filter(c=>claimIds.has(c.id)),
    assets:list(project.assets).filter(a=>assetIds.has(a.id)).map(({data,path,sourcePath,...a})=>a),
    papers:list(project.papers).filter(p=>sources.has(p.id)),
  }));
}

const marginalRoles=new Set(['footer','citation','note','caption','source-details','reference-title','reference-index','identity','section-label','section-index','index','decoration','icon','logo']);
const visibleText=page=>list(page?.nodes).filter(n=>n.kind==='text'&&n.semantic!==false&&!marginalRoles.has(n.role)).map(n=>n.text??'').join('\n');

export function storyboardReport(project,scenes,{final=false,recipeIds}={}){
  const plan=project.storyboard,slides=list(project.slides),required=slides.length>=6,issues=[];
  const add=(severity,code,message,slideId)=>issues.push({severity,code,path:slideId?'slides.'+slideId:'storyboard',...(slideId?{slideId}:{}),message});
  if(!plan)return {present:false,required,ready:!required,status:required?'missing':'short-deck',pilot:{status:required?'missing':'not-required'},issues:[],
    nextActions:required?['先用 academic_ppt_plan 登记可审阅故事板与实际样张安排；六页及以上整稿在交付前必须完成，旧稿升级可先恢复现有论证再审阅。']:[]};
  const pages=list(plan.pages),ids=pages.map(p=>p.slideId),known=new Set(ids),actual=new Map(slides.map(s=>[s.id,s]));
  const claims=new Map(list(project.claims).map(c=>[c.id,c])),assets=new Map(list(project.assets).map(a=>[a.id,a]));
  const scenePages=new Map(list(scenes?.pages).map(p=>[p.id,p]));
  if(new Set(ids).size!==ids.length)add('error','storyboard-duplicate-page','故事板中的 slideId 必须唯一。');
  if(!['confirmed','delegated'].includes(plan.decision?.status)||!plan.decision?.userResponse?.trim())add(final?'error':'warning','storyboard-direction-unresolved','保留真实故事线选择或明确委托；待回复不是默认同意。');
  for(const s of slides)if(!known.has(s.id))add('error','storyboard-unplanned-slide','当前页不在故事板中。先同步本页问题、证据与承接，再构建。',s.id);
  const plannedActualOrder=ids.filter(id=>actual.has(id));
  if(stable(plannedActualOrder)!==stable(slides.map(s=>s.id)))add('error','storyboard-order-drift','实际页序与已审阅故事板不同。核对论证顺序并更新故事板，不能把换页序当作纯视觉修改。');
  const missing=ids.filter(id=>!actual.has(id));
  if(final&&missing.length)add('error','storyboard-pages-missing','尚未实现计划页面：'+missing.join('、')+'。');
  const totalSeconds=pages.reduce((n,p)=>n+p.seconds,0),target=(project.brief?.talkMinutes??0)*60;
  if(target&&Math.abs(totalSeconds-target)>Math.max(30,target*.15))add('warning','storyboard-time-budget',`故事板预算 ${totalSeconds} 秒，目标 ${target} 秒；调整证据取舍与讲述节奏，时长仍须排练。`);
  for(const [i,p] of pages.entries()){
    if(recipeIds&&p.layoutFamily!=='custom'&&!recipeIds.has(p.layoutFamily))add('error','storyboard-unknown-layout','未知页面语法 '+p.layoutFamily+'；查询 layouts，原创结构用 custom 并说明依据。',p.slideId);
    if(i<pages.length-1&&p.role!=='references'&&!p.transition.trim())add('warning','storyboard-transition-missing','写出本页结果如何引出下一页问题，避免章节标题串联。',p.slideId);
    const slide=actual.get(p.slideId),severity=slide?'error':'warning';
    for(const id of p.claimIds)if(!claims.has(id))add(severity,'storyboard-missing-claim','计划依赖的论点尚未登记：'+id,p.slideId);
    for(const id of p.assetIds)if(!assets.has(id))add(severity,'storyboard-missing-asset','计划依赖的图源尚未取得并登记：'+id,p.slideId);
    if(!slide)continue;
    const actualClaims=new Set(usedClaims(slide)),actualAssets=new Set(usedAssets(slide));
    for(const id of p.claimIds)if(!actualClaims.has(id))add('error','storyboard-claim-dropped','计划论点未落实到当前页：'+id,p.slideId);
    for(const id of p.assetIds)if(!actualAssets.has(id))add('error','storyboard-asset-dropped','计划原图未落实到当前页：'+id+'；不能用文字卡代替已计划的主要证据。',p.slideId);
    const page=scenePages.get(p.slideId);
    if(page){
      const visibleAssets=new Set(list(page.nodes).filter(n=>n.kind==='image'&&n.opacity!==0&&n.w>0&&n.h>0).map(n=>n.assetId));
      for(const id of p.assetIds)if(!visibleAssets.has(id))add('error','storyboard-asset-not-visible','图源虽然登记但没有进入实际导出画面：'+id,p.slideId);
      const body=normal(visibleText(page));
      for(const text of list(p.mustShow))if(!body.includes(normal(text)))add('error','storyboard-required-content-dropped','故事板要求主要视图保留的条件/判断缺失：'+text,p.slideId);
    }
    if(slide.seconds!==p.seconds)add('warning','storyboard-timing-drift','当前页时间预算与故事板不同；同步讲述计划。',p.slideId);
  }
  const bodyPages=pages.filter(p=>!['orientation','references'].includes(p.role));
  for(let i=2;i<bodyPages.length;i++){
    const run=bodyPages.slice(i-2,i+1);
    if(run.every(p=>p.layoutFamily===run[0].layoutFamily)&&run[0].layoutFamily!=='custom'&&run.some(p=>!p.repetitionReason?.trim()))add('warning','storyboard-layout-run','连续页面采用同一语法。说明共同尺度/重复测量理由，或按新问题重排真实证据；不为凑多样性添加装饰。',run[2].slideId);
  }
  let pilot={status:required?'missing':'not-required',slideIds:pilotSlideIds(plan)};
  if(plan.pilot){
    const sequence=plan.pilot.sequenceSlideIds,indexes=sequence.map(id=>ids.indexOf(id));
    if(pilot.slideIds.some(id=>!known.has(id))||new Set(sequence).size!==3||indexes.some((n,i)=>n<0||(i&&n!==indexes[i-1]+1)))add('error','storyboard-pilot-selection','样张必须来自本故事板，连续三页须按计划相邻且互不重复。');
    if(!['evidence','mechanism','design','synthesis'].includes(pages.find(p=>p.slideId===plan.pilot.hardestSlideId)?.role))add('error','storyboard-pilot-hardest','困难样张应选择证据、机制、实验设计或综合比较页，不能只审封面。');
    const cover=slides.find(s=>s.layout==='cover');
    if(cover&&plan.pilot.coverSlideId!==cover.id)add('error','storyboard-pilot-cover','存在封面时，实际封面也应进入样张对照。');
    const receipt=project.pilotReview;
    const current=receipt?.fingerprint===pilotFingerprint(project)&&receipt?.storyboardSha256===storyboardSignature(plan);
    pilot={...pilot,status:current?'reviewed':receipt?'stale':'pending',...(receipt?{pptxSha256:receipt.pptxSha256,decision:receipt.decision}:{}),missingSlideIds:pilot.slideIds.filter(id=>!actual.has(id))};
  }
  if(final&&required&&pilot.status!=='reviewed')add('error','storyboard-pilot-required','封面、困难页和连续三页的真实样张尚未完成或已因内容/设计改变失效。完成当前样张复核后登记 pilot-review。');
  return {present:true,required,status:issues.some(i=>i.severity==='error')?'needs-fix':missing.length?'in-progress':'planned',
    ready:issues.every(i=>i.severity!=='error')&&(!required||pilot.status==='reviewed')&&['confirmed','delegated'].includes(plan.decision?.status)&&Boolean(plan.decision?.userResponse?.trim()),
    objective:plan.objective,audienceTakeaway:plan.audienceTakeaway,throughline:plan.throughline,
    summary:{plannedPages:pages.length,implementedPages:plannedActualOrder.length,missingPages:missing.length,totalSeconds,layoutFamilies:[...new Set(bodyPages.map(p=>p.layoutFamily))]},pilot,issues,
    limits:'页面语法ID和文字对应是过程检查，不能判断故事感染力、科学真伪或美感。主图尺寸、实际几何与最终PPTX仍须逐页核查。'};
}

const cell=x=>String(x??'').replaceAll('|','\\|').replace(/\r?\n/g,' ');
export function storyboardMarkdown(plan,project={}){
  const claims=new Map((project.claims??[]).map(c=>[c.id,c]));
  const assets=new Map((project.assets??[]).map(a=>[a.id,a]));
  const papers=new Map((project.papers??[]).map(p=>[p.id,p]));
  const source=id=>{const p=papers.get(id);return p?`${p.title}${p.doi?' · DOI '+p.doi:''}`:id||'来源待登记';};
  const overview=`# ${plan.objective}\n\n听众应带走：${plan.audienceTakeaway}\n\n论证主线：${plan.throughline}\n\n当前方向记录：${plan.decision?.status??'proposed'}${plan.decision?.userResponse?'；依据：'+plan.decision.userResponse:''}。这是调用者记录，不代表工具独立验证了用户确认。\n\n以下概览和逐页论证供用户审阅；页面语法可按真实内容调整。\n\n| 页 | 本页回答的问题 | 标题/判断 | 证据 ID | 秒 | 承接 |\n|---|---|---|---|---|---|\n`+plan.pages.map((p,i)=>`| ${i+1} · ${cell(p.slideId)} | ${cell(p.question)} | ${cell(p.title)} | ${cell([...p.claimIds,...p.assetIds].join(', '))} | ${p.seconds} | ${cell(p.transition)} |`).join('\n')+'\n';
  const pilot=plan.pilot?`\n## 先试做的真实页面\n\n封面：${plan.pilot.coverSlideId??'本稿不设独立封面'}；困难页：${plan.pilot.hardestSlideId}；连续三页：${plan.pilot.sequenceSlideIds.join(' → ')}。\n\n选择原因：${plan.pilot.reason}\n`:'';
  const pages=plan.pages.map((p,i)=>{
    const evidence=[...p.claimIds.map(id=>{const c=claims.get(id);return c?`- ${id}（${c.kind}）：${c.text}\n  来源：${source(c.paperId)}；定位：${c.locator}`:`- ${id}：计划证据，尚未登记正文与来源。`;}),...p.assetIds.map(id=>{const a=assets.get(id);return a?`- ${id}：${a.caption??a.figure??'研究图'}；来源：${source(a.paperId)}${a.figure?'；图号：'+a.figure:''}`:`- ${id}：计划图片，尚未登记图注与来源。`;})].join('\n');
    return `\n## ${i+1}. ${p.title}\n\n页面 ID：${p.slideId}；论证作用：${p.role}；预算：${p.seconds} 秒。\n\n**问题：** ${p.question}\n\n**证据如何支持判断：** ${p.warrant}\n\n**成立边界：** ${p.boundary}\n\n**必须出现在正文的内容：** ${(p.mustShow??[]).join('；')||'未另设逐字保留项；科学条件仍须由实际页面核对。'}\n\n**证据与图源：**\n\n${evidence||'本页未安排独立研究证据；应与本页的导航或说明任务一致。'}\n\n**页面语法：** ${p.layoutFamily}。${p.layoutReason}${p.repetitionReason?'\n\n有意重复的原因：'+p.repetitionReason:''}\n\n**承接下一页：** ${p.transition}\n`;
  }).join('');
  return overview+pilot+pages;
}
