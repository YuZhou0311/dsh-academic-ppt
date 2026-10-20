import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {dirname,join,relative} from 'node:path';
import {randomUUID} from 'node:crypto';
import {assertToolArgs,assertProject,contentOf} from './schema.mjs';
import {normalizeTemplateProfiles} from './template-profile.mjs';
import {getReferenceTemplate} from './reference-catalog.mjs';
import {hash,clone,stable,abort,safePath,readBounded,readJson,atomicJson,locked,ensureNewDir,embedAssets} from './io.mjs';

export const DEFAULT_DESIGN = {fontFamily:'Noto Sans CJK SC',palette:{ink:'#202632',paper:'#FFFFFF',background:'#FFFFFF',accent:'#173F75',secondary:'#9B303A',muted:'#536070',line:'#CCD2DA',soft:'#F1F4F8',gold:'#9B303A',tint:'#F1F4F8'}};
const RENDERER_VERSION=3;
const fields=['papers','claims','assets','slides'];
const now=()=>new Date().toISOString();
function argsFor(name,options){const {cwd,signal,...args}=options;assertToolArgs(name,args);abort(signal);return args;}
function snapshot(p){const c=clone(contentOf(p));c.assets=c.assets.map(({data,...a})=>a);return c;}
function contentHash(p){return hash(stable({...contentOf(p),revision:0}));}
function initial(title,brief,design,capabilities){return {schemaVersion:1,id:'deck-'+randomUUID(),revision:0,title,brief:brief??{centralQuestion:'',audience:'学术同行',talkMinutes:13,targetPaperCount:5,requireFullText:true},design:design??clone(DEFAULT_DESIGN),capabilities:capabilities??{imageInput:'unknown',source:'host capability not yet verified'},papers:[],claims:[],assets:[],slides:[],history:[],createdAt:now(),updatedAt:now()};}
async function load(options){const path=await safePath(options.cwd,options.projectPath,{mustExist:true});const {value,fingerprint}=await readJson(path);assertProject(value);if(!Array.isArray(value.history)||value.history.length>10)throw new Error('INVALID_HISTORY');if(value.assets.some(a=>!a.data||!a.sha256))throw new Error('INVALID_PROJECT_ASSETS: register assets through academic_ppt_record');const checkedAssets=await embedAssets(value.assets,options.cwd,options.signal);if(checkedAssets.some((a,i)=>a.width!==value.assets[i].width||a.height!==value.assets[i].height))throw new Error('INVALID_PROJECT_ASSETS: stored dimensions differ from actual pixels');return {p:value,path,fingerprint};}
function checkRevision(p,revision){if(p.revision!==revision)throw new Error(`REVISION_CONFLICT: expected ${revision}; current ${p.revision}. Read academic_ppt_context before retrying.`);}
async function saveMutation(state,next,signal,{undo=false}={}){
 assertProject(next);abort(signal);
 next.history=undo?next.history:[...state.p.history,snapshot(state.p)].slice(-10);
 next.revision=state.p.revision+1;next.updatedAt=now();delete next.artifact;delete next.visualReviews;
 await locked(state.path,async()=>{if(hash(await readBounded(state.path))!==state.fingerprint)throw new Error('REVISION_CONFLICT: project changed during operation');await atomicJson(state.path,next,signal);},signal);
 return {ok:true,projectPath:state.path,revision:next.revision,summary:'已保存内容修订。已有成品保留，新内容需重新生成。',counts:counts(next)};
}
function counts(p){return Object.fromEntries(fields.map(k=>[k,p[k].length]));}
export async function createProject(options={}){
 const a=argsFor('academic_ppt_init',options),dir=await safePath(options.cwd,a.projectDir);
 await ensureNewDir(dir);const path=join(dir,'project.json');const p=initial(a.title,a.brief,a.design,a.capabilities);
 assertProject(p);try{await atomicJson(path,p,options.signal);}catch(e){await rm(dir,{recursive:true,force:true});throw e;}
 return {ok:true,projectPath:path,revision:0,counts:counts(p),nextActions:['明确 brief.centralQuestion 与文献筛选条件。','逐篇阅读并以 academic_ppt_record 写入证据；每次最多 5 篇论文或 8 页。']};
}
export async function updateRecords(options={}){
 const a=argsFor('academic_ppt_record',options),state=await load(options);checkRevision(state.p,a.expectedRevision);const next=clone(state.p);
 if(![...fields,'brief','design','capabilities','templateProfilePaths'].some(k=>a[k]!==undefined))throw new Error('EMPTY_UPDATE');
 for(const key of fields){if(!a[key])continue;const seen=new Set();let incoming=a[key];
  if(key==='assets')incoming=await embedAssets(incoming,options.cwd,options.signal);
  for(const item of incoming){if(seen.has(item.id))throw new Error('DUPLICATE_ID: '+item.id);seen.add(item.id);const index=next[key].findIndex(x=>x.id===item.id);
   if(key==='slides'&&index>=0&&state.p.builtOnce)throw new Error('USE_SCOPED_EDIT: 已生成页面请使用 academic_ppt_edit，避免绕过局部修改范围。');
   if(key==='assets'&&index>=0&&stable(next[key][index])!==stable(item))throw new Error('IMMUTABLE_ASSET: 新图片或来源修改需使用新 asset ID，保留旧版本可撤销。');
   if(index<0)next[key].push(item);else next[key][index]=item;
  }
 }
 for(const key of ['brief','design','capabilities'])if(a[key])next[key]=a[key];
 if(a.templateProfilePaths){const profiles=[];for(const path of a.templateProfilePaths){const file=await safePath(options.cwd,path,{mustExist:true});const bytes=await readBounded(file,4*1024*1024);profiles.push(JSON.parse(bytes));}next.design.templateProfile=normalizeTemplateProfiles(profiles);}
 next.assets=await embedAssets(next.assets,options.cwd,options.signal);
 return saveMutation(state,next,options.signal);
}
export function evidenceIssues(p){
 const issues=[];const add=(severity,code,path,message)=>issues.push({severity,code,path,message});
 const papers=new Map(p.papers.map(x=>[x.id,x])),claims=new Map(p.claims.map(x=>[x.id,x])),assets=new Map(p.assets.map(x=>[x.id,x]));
 if(!p.brief.centralQuestion.trim())add('error','central-question','brief.centralQuestion','先明确汇报中心问题。');
 if(!p.slides.length)add('error','no-slides','slides','尚无幻灯片。');
 const used=new Set(p.slides.flatMap(s=>[...s.paperIds,...slideClaimIds(s).map(id=>claims.get(id)?.paperId),...s.figureIds.map(id=>assets.get(id)?.paperId)].filter(Boolean)));
 if(used.size<p.brief.targetPaperCount)add('error','paper-count','papers',`正文关联 ${used.size} 篇论文，要求至少 ${p.brief.targetPaperCount} 篇。`);
 const introduced=new Set(p.slides.filter(s=>s.layout==='paper').flatMap(s=>s.paperIds));
 const referenced=new Set(p.slides.filter(s=>s.layout==='references').flatMap(s=>s.paperIds));
 for(const id of used){const paper=papers.get(id);if(!paper)continue;
  if(p.brief.requireFullText&&paper.reading.status!=='full-text')add('error','full-text-required','papers.'+id,'全文阅读条件未满足，不能用摘要替代。');
  if(paper.reading.status==='full-text'&&(!paper.reading.notes.trim()||paper.reading.sections.length<3||!paper.methodSummary.trim()||!paper.limitations.length))add('error','reading-coverage','papers.'+id,'全文记录需覆盖至少三个实际章节、方法及局限。');
  if(!introduced.has(id))add('error','full-title-on-slide','papers.'+id,'缺少 paper 导读页，完整论文题名必须在画面中呈现。');
  if(!referenced.has(id))add('error','reference-entry','papers.'+id,'参考文献页未包含该论文。');
  if(!/^10\.\d{4,9}\/.+/.test(paper.doi))add('warning','doi-format','papers.'+id+'.doi','请核对 DOI；插件不会联网证明其真实。');
  if(p.brief.impactFactorMin!==undefined){if(!paper.impactFactor)add('error','impact-factor-source','papers.'+id,'缺少有年份、来源及核验日期的期刊影响因子记录。');else if(paper.impactFactor.value<p.brief.impactFactorMin)add('error','impact-factor-threshold','papers.'+id,`记录的期刊影响因子低于 ${p.brief.impactFactorMin}，不能静默降低条件。`);}
 }
 for(const claim of p.claims){if(!papers.has(claim.paperId))add('error','dangling-paper','claims.'+claim.id,'引用的论文 ID 不存在。');
  if(!claim.verified)add('error','unverified-claim','claims.'+claim.id,'该证据记录尚未人工或模型核对原文。');
  if(claim.kind==='reported'&&/\d[\d.,]*\s*(?:%|kg|t\/|\/\s*\d|Hfl)/i.test(claim.text)&&!claim.metrics?.length)add('error','numeric-context','claims.'+claim.id,'定量结果必须记录单位、比较基准、分母和统计口径。');
 }
 for(const asset of p.assets){if(asset.usage==='figure'&&(!asset.paperId||!papers.has(asset.paperId)||!asset.figure?.trim()))add('error','figure-provenance','assets.'+asset.id,'论文原图需有效 paperId、图号和来源版本。');if(!asset.data||!asset.sha256)add('error','unembedded-asset','assets.'+asset.id,'图片未嵌入或缺少摘要。');}
 const paperReferencedClaims=new Set();
 for(const [index,s] of p.slides.entries()){
  const path='slides.'+s.id;
  for(const id of s.paperIds)if(!papers.has(id))add('error','dangling-paper',path,'论文不存在：'+id);
  for(const id of slideClaimIds(s)){const c=claims.get(id);if(!c)add('error','dangling-claim',path,'证据不存在：'+id);else{paperReferencedClaims.add(c.paperId);if(!s.paperIds.includes(c.paperId))add('error','claim-source-not-visible',path,`证据 ${id} 的论文需列入本页 paperIds。`);}}
  for(const id of s.figureIds){const f=assets.get(id);if(!f)add('error','dangling-figure',path,'图片不存在：'+id);else if(f.paperId&&!s.paperIds.includes(f.paperId))add('error','figure-source-not-visible',path,'图的论文需列入本页 paperIds。');}
  if(['figure-focus','figure-split'].includes(s.layout)&&!s.figureIds.length)add('error','missing-main-figure',path,'此页型需要原图。');
  if(s.layout==='figure-split'&&!s.referenceTemplateId&&s.figureIds.length>2)add('error','too-many-figures',path,'默认此页型最多两幅图；更多面板请使用匹配的 referenceTemplateId 或拆页。');
  if(s.layout==='paper'&&s.paperIds.length!==1)add('error','paper-page-count',path,'导读页一次展示一篇论文完整标题。');
  if(s.layout==='references'&&s.paperIds.length>4)add('error','dense-references',path,'每页最多四条完整书目，请显式拆页。');
  if(!s.notes.trim()&&s.layout!=='references')add('warning','missing-notes',path,'补充与本页一致的演讲备注。');
  if(s.cards.length>4&&!s.referenceTemplateId)add('warning','dense-cards',path,'同页解释区较多，请确认每个区域都承担独立研究任务，并给主证据保留足够空间；数量本身不是密度评分。');
  for(const card of s.cards){if(card.kind==='hypothesis'&&!card.claimIds.some(id=>claims.get(id)?.kind==='proposal'))add('warning','proposal-label',path+'/card/'+card.id,'假说卡请关联 proposal 证据，避免与已验证结果混淆。');
   if(card.templateComponentId&&!p.design.templateProfile?.components?.some(c=>c.id===card.templateComponentId))add('error','missing-template-component',path,'模板组件不存在：'+card.templateComponentId);
   if(card.box&&(card.box.x+card.box.w>1280||card.box.y+card.box.h>720))add('error','card-outside-slide',path,'卡片边界超出页面。');
  }
  const nodeIds=new Set((s.nodes??[]).map(n=>n.id));for(const e of s.edges??[])if(!nodeIds.has(e.from)||!nodeIds.has(e.to))add('error','dangling-edge',path,'流程连线指向不存在的节点。');
  if(s.chart){if(s.chart.series.some(x=>x.values.length!==s.chart.categories.length))add('error','chart-dimensions',path,'图表系列与类别长度不一致。');const source=claims.get(s.chart.sourceClaimId);if(!source||!source.metrics?.length)add('error','chart-data-source',path,'可编辑图表必须关联记录了原始数据口径的证据。');}
  if(s.table){if(s.table.rows.some(row=>row.length!==s.table.columns.length))add('error','table-dimensions',path,'原生表格每一行必须与列标题等长。');if(!s.table.sourceClaimIds?.length)add('error','table-data-source',path,'table.sourceClaimIds 必须明确关联表格的原文或研究方案证据；页面其他 claim 不能代替表格来源。');if(s.table.rows.length>8||s.table.columns.length>6)add('warning','dense-table',path,'表格行列较多，建议拆为正文与备份页并检查实际字号。');}
  if(s.figureBoxes){
   if(s.referenceTemplateId)add('error','custom-reference-conflict',path,'figureBoxes 用于无 referenceTemplateId 的自定义图文页；固定模板面板不能和自由图框混用。');
   if(!['figure-focus','figure-split'].includes(s.layout))add('error','custom-figure-layout',path,'figureBoxes 仅用于 figure-focus 或 figure-split 的图文构图。');
   if(s.figureBoxes.length!==s.figureIds.length)add('error','custom-figure-count',path,'figureBoxes 必须与 figureIds 一一对应。');
   if(s.cards.some(c=>!c.box))add('error','custom-card-box-required',path,'自定义图框时，为每个解释卡片显式分配 box，避免沿用默认位置造成重叠。');
   for(const b of s.figureBoxes)if(b.x<36||b.y<132||b.x+b.w>1244||b.y+b.h>658)add('error','custom-figure-outside-content',path,'自定义证据图框需位于正文区域 x=36–1244、y=132–658 内。');
   const boxes=[...s.figureBoxes,...s.cards.filter(c=>c.box).map(c=>c.box)];
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1)add('error','custom-evidence-overlap',path,'自定义证据图与解释区相互重叠，调整实际区域后再生成。');}
  }
  if(s.panelTitles&&!s.referenceTemplateId)add('error','panel-titles-without-reference',path,'面板标题需要对应的 referenceTemplateId，不能配置后不显示。');
  if(s.referenceTemplateId){const template=getReferenceTemplate(s.referenceTemplateId);if(!template)add('error','unknown-reference-template',path,'未知学术模板 ID：'+s.referenceTemplateId);else{
   if(s.panelTitles&&s.panelTitles.length!==(template.slots.panels?.length??0))add('error','panel-title-count',path,'panelTitles 必须与所选模板的 panels 一一对应；请按实际图文内容命名。');
   if(template.layout!==s.layout)add('error','reference-layout-mismatch',path,`模板 ${template.id} 要求 layout=${template.layout}，当前为 ${s.layout}。`);
   for(const [key,count] of [['cards',s.cards.length],['figures',s.figureIds.length],['nodes',(s.nodes??[]).length]]){const range=template.requirements?.[key];if(range&&(count<range.min||count>range.max))add('error','reference-content-count',path,`${template.name} 的 ${key} 需要 ${range.min}–${range.max} 个，当前 ${count} 个；选择匹配证据的页型。`);}
   for(const key of ['chart','table']){const required=template.requirements?.[key];if(required===true&&!s[key])add('error','reference-content-missing',path,`${template.name} 需要 ${key}，不能以空白占位代替证据。`);if(s[key]&&!template.slots?.[key])add('error','reference-content-unused',path,`${template.name} 没有 ${key} 区域，请选择支持此内容的页型。`);}
  }}
  const structureOf=slide=>slide.referenceTemplateId??(slide.figureBoxes?JSON.stringify({layout:slide.layout,figures:slide.figureBoxes.map(box=>['x','y','w','h'].map(k=>Math.round(box[k]/32))),cards:slide.cards.map(card=>card.box?['x','y','w','h'].map(k=>Math.round(card.box[k]/32)):null)}):slide.layout);
  const structure=structureOf(s);
  if(index>=2&&structureOf(p.slides[index-1])===structure&&structureOf(p.slides[index-2])===structure&&!['paper','references'].includes(s.layout))add('warning','layout-repetition',path,'连续三页同构。检查证据是否适合换用不同图文结构。');
 }
 for(const id of used)if(!paperReferencedClaims.has(id))add('warning','paper-without-claims','papers.'+id,'论文尚未关联任何页内证据。');
 const seconds=p.slides.reduce((n,s)=>n+s.seconds,0),target=p.brief.talkMinutes*60;
 if(seconds<target*.8||seconds>target*1.12)add('warning','talk-budget','brief.talkMinutes',`逐页预算 ${Math.round(seconds)} 秒，目标 ${Math.round(target)} 秒；需要实际排练校准。`);
 return issues;
}
function statusSummary(issues){return {errors:issues.filter(x=>x.severity==='error').length,warnings:issues.filter(x=>x.severity==='warning').length};}
export function slideClaimIds(s){return [...new Set([...(s.claimIds??[]),...(s.cards??[]).flatMap(c=>c.claimIds??[]),...(s.chart?[s.chart.sourceClaimId]:[]),...(s.table?.sourceClaimIds??[])])];}
async function scenesAndIssues(p){const {buildScenes}=await import('./scene.mjs');const scenes=buildScenes(p);return {scenes,issues:[...evidenceIssues(p),...(scenes.issues??[])]};}
async function artifactCheck(p,cwd){
 if(!p.artifact)return {current:false,reason:'not-built'};
 if(p.artifact.rendererVersion!==RENDERER_VERSION)return {current:false,reason:'renderer-updated-rebuild-required'};
 if(p.artifact.contentHash!==contentHash(p))return {current:false,reason:'stale-content'};
 try{for(const item of Object.values(p.artifact.files)){const path=await safePath(cwd,item.path,{mustExist:true});if(hash(await readBounded(path))!==item.sha256)return {current:false,reason:'externally-modified'};}return {current:true,pptxSha256:p.artifact.files.pptx.sha256};}catch{return {current:false,reason:'missing-or-changed-output'};}
}
async function renderReceiptCheck(p,cwd){
 if(!p.artifact?.render)return {status:'not-rendered'};
 try{const pptx=await safePath(cwd,p.artifact.files.pptx.path,{mustExist:true});const receipt=await safePath(cwd,p.artifact.render.receiptPath,{mustExist:true});const {readRenderReceipt}=await import('./vendor/dsh-ppt-render.mjs');return readRenderReceipt(pptx,receipt);}catch(e){return {status:'not-verified',message:e.message};}
}
export async function checkProject(options={}){
 argsFor('academic_ppt_check',options);const {p,path}=await load(options);const {issues}=await scenesAndIssues(p);const artifact=await artifactCheck(p,options.cwd),render=await renderReceiptCheck(p,options.cwd);
 const reviews=(p.visualReviews??[]).filter(r=>artifact.current&&r.pptxSha256===artifact.pptxSha256);
 const full=(basis)=>p.slides.every(s=>reviews.findLast(r=>r.basis===basis&&r.reviewedSlides.includes(s.id))?.result==='passed');
 const summary=statusSummary(issues),visual=artifact.current&&full('pptx-render')&&render.status==='rendered'?'reported-passed':'not-verified';
 const ready=summary.errors===0&&artifact.current&&p.artifact.mode==='review'&&visual==='reported-passed'&&!(render.missingFonts?.length);
 return {ok:summary.errors===0,projectPath:path,revision:p.revision,counts:counts(p),summary,issues,artifact,verification:{evidence:'records-checked-not-independently-verified',layout:'estimated',pptxRender:render.status,visual,htmlVisual:artifact.current&&full('html-preview')?'reported-passed':'not-verified',readyForDelivery:ready},render,slides:p.slides.map(s=>({id:s.id,title:s.title,layout:s.layout,seconds:s.seconds})),note:'格式和引用链检查不能证明论文结论真实或审美优秀；视觉审查为具名记录，须查看实际最终 PPTX 渲染。'};
}
export async function contextProject(options={}){
 const a=argsFor('academic_ppt_context',options),{p,path}=await load(options),issues=evidenceIssues(p),summary=statusSummary(issues);
 let stage=a.stage??'auto';if(stage==='auto')stage=!p.papers.length?'research':!p.claims.length?'evidence':!p.slides.length?'storyboard':summary.errors?'evidence':!p.artifact?'render':'review';
 const nextActions={research:['按 brief 条件筛选论文，先核对全文和书目信息。','每篇读取方法、结果、图注、补充材料；写入结构化阅读记录。'],evidence:['按 issues 定位缺失或冲突的证据，核对原文后修复。','保留统计分母、单位、比较对象、模拟或实体实验的适用范围。'],design:['先查看用户原模板的实际页面：标题比例、图文区域、边框与小题签。需要原生组件时调用 academic_ppt_template，并通过 templateProfilePaths 导入。','先实际查看论文图并记录 asset.reading；调用 academic_ppt_reference，按研究任务或 figure 尺寸/视窗/阅读条件比较最多三个候选。必要时用 figureBoxes 创造合适比例。'],storyboard:['先确定每页一个研究问题、主证据和时间预算，再选匹配的 referenceTemplateId；其 layout、卡片、图与流程数量必须符合模板。','每篇保留 paper 完整题名页和 references 书目。先做密集原图、方法和结果难页，以字号、语义 kind、精确 emphasis 和不同关系形式建立层级；重要限定不降为小字。信息不足补必要解释，拥挤先去重复或拆任务。'],render:['调用 academic_ppt_build，mode=review；证据未齐时仅用 draft。'],review:['调用 academic_ppt_render，再检查其返回的最终 PPTX 图片。','同时检查空疏和拥挤：主图有效面积、图例、解释长度、必要限定、卡片重复；按稳定 ID 局部修复后登记当前 hash 的视觉审查。'],delivery:['用 academic_ppt_check 核对成品哈希、渲染与审查范围。','交付 PPTX、HTML、讲稿、证据/资产清单及可恢复工程。']}[stage];
 const selected=new Set(a.recordIds??[]);const records=fields.flatMap(k=>p[k].filter(x=>selected.has(x.id)).map(x=>{const v=clone(x);delete v.data;return {collection:k,record:v};}));
 return {ok:true,projectPath:path,revision:p.revision,stage,brief:p.brief,capabilities:p.capabilities,counts:counts(p),summary,nextActions,issues:issues.slice(0,20),records,recordIndex:Object.fromEntries(fields.map(k=>[k,p[k].map(x=>({id:x.id,title:(x.title??x.text??x.caption??'').slice(0,180)}))])),artifact:p.artifact?{pptxSha256:p.artifact.files.pptx.sha256,mode:p.artifact.mode}:null};
}
function speechMarkdown(p){let elapsed=0;return `# ${p.title}\n\n目标时长：${p.brief.talkMinutes} 分钟。以下为本次导出对应的备注，实际语速须排练。\n\n`+p.slides.map((s,i)=>{const start=elapsed;elapsed+=s.seconds;const t=n=>`${Math.floor(n/60)}:${String(Math.round(n%60)).padStart(2,'0')}`;return `## ${i+1}. ${s.title}\n\n页 ID：${s.id}。时间预算：${t(start)}–${t(elapsed)}。\n\n${s.notes||'此页尚无讲稿。'}\n\n`}).join('');}
export async function buildProject(options={}){
 const a=argsFor('academic_ppt_build',options),state=await load(options);checkRevision(state.p,a.expectedRevision);const p=state.p,mode=a.mode??'review';
 const before=evidenceIssues(p);if(!p.slides.length)throw new Error('NO_SLIDES');if(mode==='review'&&before.some(i=>i.severity==='error'))return {ok:false,status:'blocked',projectPath:state.path,revision:p.revision,summary:statusSummary(before),issues:before,nextActions:['修复证据错误后重试；资料仍待补齐的中间稿可显式使用 mode=draft。']};
 const {renderProject}=await import('./render.mjs');abort(options.signal);const generated=await renderProject(p,{signal:options.signal});abort(options.signal);
 const issues=[...before,...(generated.issues??[])];if(mode==='review'&&issues.some(i=>i.severity==='error'))return {ok:false,status:'blocked',projectPath:state.path,revision:p.revision,summary:statusSummary(issues),issues};
 const exportRoot=await safePath(options.cwd,join(dirname(state.path),'exports'));await mkdir(exportRoot,{recursive:true});
 const token=`r${p.revision}-${randomUUID().slice(0,8)}`,directory=join(exportRoot,token);await mkdir(directory);
 let committed=false;
 try{
  const fileValues={pptx:['report.pptx',generated.pptx],html:['report.html',generated.html],speech:['speaker-notes.md',speechMarkdown(p)],evidence:['evidence.json',JSON.stringify({brief:p.brief,papers:p.papers,claims:p.claims},null,2)],assets:['asset-manifest.json',JSON.stringify(p.assets.map(({data,...rest})=>rest),null,2)],quality:['quality.json',JSON.stringify({createdAt:now(),revision:p.revision,mode,issues,verification:{static:'checked',visual:'not-verified'},sourceHash:contentHash(p)},null,2)]};
  const files={};for(const [kind,[name,body]] of Object.entries(fileValues)){abort(options.signal);const path=join(directory,name);await writeFile(path,body,{flag:'wx'});files[kind]={path,sha256:hash(typeof body==='string'?Buffer.from(body):body)};}
  await mkdir(join(directory,'previews'));for(const [i,page] of generated.svgPages.entries())await writeFile(join(directory,'previews',String(i+1).padStart(3,'0')+'.svg'),page.svg,{flag:'wx'});
 const artifact={mode,createdAt:now(),rendererVersion:RENDERER_VERSION,contentHash:contentHash(p),revision:p.revision,files};const next={...p,builtOnce:true,artifact,visualReviews:[]};
  await locked(state.path,async()=>{if(hash(await readBounded(state.path))!==state.fingerprint)throw new Error('REVISION_CONFLICT: content changed during rendering');await atomicJson(state.path,next,options.signal);},options.signal);committed=true;
  return {ok:true,status:mode==='draft'?'draft':'ready-for-review',projectPath:state.path,revision:p.revision,files:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,v.path])),pptxSha256:files.pptx.sha256,summary:statusSummary(issues),issues,verification:{static:'checked',visual:'not-verified'},note:'成品写入新版本目录。PowerPoint/WPS 的后续手工修改不会同步回工程，新生成不会覆盖该文件。'};
 }finally{if(!committed)await rm(directory,{recursive:true,force:true});}
}
function cardPrefix(slideId,cardId){return `${slideId}/card/${cardId}/`;}
function preservedScene(before,after,prefixes){
 const flatten=s=>s.pages.flatMap(p=>p.nodes.filter(n=>!prefixes.some(pre=>n.id.startsWith(pre))).map(n=>({page:p.id,node:n})));
 if(stable(flatten(before))!==stable(flatten(after)))throw new Error('PRESERVATION_FAILED: non-target scene objects changed');
 if(stable(before.pages.map(p=>({id:p.id,notes:p.notes})))!==stable(after.pages.map(p=>({id:p.id,notes:p.notes}))))throw new Error('PRESERVATION_FAILED: speaker notes changed');
 return flatten(before).length;
}
export async function editProject(options={}){
 const a=argsFor('academic_ppt_edit',options),state=await load(options);checkRevision(state.p,a.expectedRevision);const next=clone(state.p),seen=new Set(),prefixes=[];
 for(const change of a.changes){const slide=next.slides.find(s=>s.id===change.slideId);if(!slide)throw new Error('UNKNOWN_SLIDE: '+change.slideId);const key=change.slideId+'/'+(change.cardId??'');if(seen.has(key))throw new Error('DUPLICATE_TARGET');seen.add(key);
  if(a.scope==='card-style'){if(!change.cardId)throw new Error('CARD_ID_REQUIRED');const card=slide.cards.find(c=>c.id===change.cardId);if(!card)throw new Error('UNKNOWN_CARD');const allowed=new Set(['style','accent','templateComponentId']);if(!Object.keys(change.patch).length||Object.keys(change.patch).some(k=>!allowed.has(k)))throw new Error('CARD_STYLE_SCOPE: only style, accent, templateComponentId may change; words, values, box and slide remain locked');Object.assign(card,change.patch);prefixes.push(cardPrefix(slide.id,card.id));}
  else{if(change.cardId)throw new Error('SLIDE_CONTENT_SCOPE: patch the slide; for style-only edits use card-style');const allowed=new Set(['title','kicker','subtitle','takeaway','notes','seconds','paperIds','claimIds','figureIds','cards','nodes','edges','chart','table','layout','referenceTemplateId','panelTitles']);if(!Object.keys(change.patch).length||Object.keys(change.patch).some(k=>!allowed.has(k)))throw new Error('INVALID_SLIDE_PATCH');Object.assign(slide,change.patch);}
 }
 assertProject(next);let preservation;
 if(a.scope==='card-style'){const {buildScenes}=await import('./scene.mjs');const before=buildScenes(state.p),after=buildScenes(next);const protectedCount=preservedScene(before,after,prefixes);preservation={scope:'card-style',targetCards:a.changes.map(c=>({slideId:c.slideId,cardId:c.cardId})),protectedSceneObjects:protectedCount,notes:'preserved',content:'preserved',targetCardFrames:'preserved',targetCardInternalTextGeometry:'may-change-with-style',basis:'semantic scene comparison; not pixel or Office GUI proof'};}
 const result=await saveMutation(state,next,options.signal);return {...result,preservation};
}
export async function undoProject(options={}){
 const a=argsFor('academic_ppt_undo',options),state=await load(options);checkRevision(state.p,a.expectedRevision);if(!state.p.history.length)throw new Error('NO_UNDO');const history=clone(state.p.history),prior=history.pop(),current=new Map(state.p.assets.map(x=>[x.id,x]));
 prior.assets=prior.assets.map(a=>{const present=current.get(a.id);if(!present||a.sha256!==present.sha256)throw new Error('UNDO_ASSET_MISSING');return {...a,data:present.data};});
 const next={...state.p,...prior,history};return saveMutation(state,next,options.signal,{undo:true});
}
export async function recordReview(options={}){
 const a=argsFor('academic_ppt_review',options),state=await load(options);checkRevision(state.p,a.expectedRevision);const valid=await artifactCheck(state.p,options.cwd);
 if(!valid.current||valid.pptxSha256!==a.pptxSha256)throw new Error('STALE_REVIEW: review must match current, unchanged PPTX hash');
 if(a.reviewer==='vision-model'&&state.p.capabilities.imageInput!=='supported')throw new Error('VISION_UNVERIFIED: selected host model has no verified image input');
 if(new Set(a.reviewedSlides).size!==a.reviewedSlides.length||a.reviewedSlides.some(id=>!state.p.slides.some(s=>s.id===id)))throw new Error('INVALID_REVIEW_SLIDES');
 if(a.basis==='pptx-render'){const render=await renderReceiptCheck(state.p,options.cwd);if(render.status!=='rendered')throw new Error('PPTX_RENDER_REQUIRED: HTML/SVG preview is not final PPTX rendering');}
 const review={pptxSha256:a.pptxSha256,reviewer:a.reviewer,basis:a.basis,reviewedSlides:a.reviewedSlides,result:a.result,notes:a.notes,createdAt:now(),attestation:'user-or-agent-recorded-not-an-automatic-visual-judgment'};
 const next={...state.p,visualReviews:[...(state.p.visualReviews??[]).filter(r=>r.pptxSha256===a.pptxSha256),review].slice(-120)};
 await locked(state.path,async()=>{if(hash(await readBounded(state.path))!==state.fingerprint)throw new Error('REVISION_CONFLICT');await atomicJson(state.path,next,options.signal);},options.signal);
 return {ok:true,projectPath:state.path,revision:state.p.revision,summary:'已保存对应版本的视觉审查记录。',review};
}
export async function renderProjectArtifact(options={}){
 const a=argsFor('academic_ppt_render',options),state=await load(options);checkRevision(state.p,a.expectedRevision);const current=await artifactCheck(state.p,options.cwd);if(!current.current)throw new Error('CURRENT_ARTIFACT_REQUIRED');
 const {renderDeck}=await import('./vendor/dsh-ppt-render.mjs');const pptx=await safePath(options.cwd,state.p.artifact.files.pptx.path,{mustExist:true});
 const output=await safePath(options.cwd,join(dirname(pptx),'render-'+randomUUID().slice(0,8)));
 const fontDirectories=a.fontDirectories?await Promise.all(a.fontDirectories.map(path=>safePath(options.cwd,path,{mustExist:true}))):undefined;
 const rendered=await renderDeck({pptxPath:pptx,outputDir:output,format:'both',signal:options.signal,fontDirectories});
 if(!rendered.ok)return {...rendered,projectPath:state.path,revision:state.p.revision};
 const next=clone(state.p);next.artifact.render=rendered;
 await locked(state.path,async()=>{if(hash(await readBounded(state.path))!==state.fingerprint)throw new Error('REVISION_CONFLICT');await atomicJson(state.path,next,options.signal);},options.signal);
 return {...rendered,projectPath:state.path,revision:state.p.revision,note:'这是真实 PPTX 的静态渲染，尚未判断画面质量；字体及布局仍需查看图片。'};
}
