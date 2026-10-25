import {mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {dirname,join,relative} from 'node:path';
import {randomUUID} from 'node:crypto';
import {assertToolArgs,assertProject,contentOf} from './schema.mjs';
import {normalizeTemplateProfiles} from './template-profile.mjs';
import {DEFAULT_ACADEMIC_SYSTEM} from './design-system.mjs';
import {getReferenceTemplate} from './reference-catalog.mjs';
import {effectiveBibliographyIds} from './reference.mjs';
import {academicIssues,constraintRelaxations,expandClaimIds} from './academic-quality.mjs';
import {designIssues,designGeometryReport} from './design-quality.mjs';
import { evidenceDesignReport, contentCoverageReport } from './evidence-design.mjs';
import { writeDesignStudy } from './design-study.mjs';
import { compareProjectStructures } from './portfolio.mjs';
import {hash,clone,stable,abort,safePath,readBounded,readJson,atomicJson,locked,ensureNewDir,embedAssets} from './io.mjs';

export const DEFAULT_DESIGN = {mode:'content-led',density:'compact',cardDefaults:{surface:'plain',radius:0,padding:12,accent:'none',elevation:false},chrome:{showTopRule:false},fontFamily:'Noto Sans CJK SC',palette:{ink:'#161D27',paper:'#FFFFFF',background:'#FFFFFF',accent:'#0B4D89',secondary:'#B13E36',muted:'#536070',line:'#C8D4DF',soft:'#EFF4F8',gold:'#B13E36',tint:'#EFF4F8'},system:{...DEFAULT_ACADEMIC_SYSTEM,header:'plain',titleSize:44,bodySize:28,panelTitleSize:30,captionSize:18},projection:{bodyMin:28,labelMin:24,noteMin:18}};
const RENDERER_VERSION=12;
const fields=['papers','claims','assets','slides'];
const now=()=>new Date().toISOString();
function argsFor(name,options){const {cwd,signal,...args}=options;assertToolArgs(name,args);abort(signal);return args;}
function snapshot(p){const c=clone(contentOf(p));c.assets=c.assets.map(({data,...a})=>a);return c;}
function contentHash(p){return hash(stable({...contentOf(p),revision:0}));}
function initial(title,brief,design,capabilities){return {schemaVersion:1,id:'deck-'+randomUUID(),revision:0,title,brief:{centralQuestion:'',audience:'学术同行',talkMinutes:13,targetPaperCount:0,requireFullText:true,genre:'literature-review',...brief,qualityProfile:'academic'},design:{mode:'content-led',density:'compact',cardDefaults:clone(DEFAULT_DESIGN.cardDefaults),chrome:clone(DEFAULT_DESIGN.chrome),...clone(design??DEFAULT_DESIGN)},capabilities:capabilities??{imageInput:'unknown',source:'host capability not yet verified'},papers:[],claims:[],assets:[],slides:[],history:[],createdAt:now(),updatedAt:now()};}
async function load(options){const path=await safePath(options.cwd,options.projectPath,{mustExist:true});if((await stat(path)).isDirectory())throw new Error('PROJECT_PATH_IS_DIRECTORY: projectPath 必须是 init 返回的 project.json 文件，不是工程目录。');const {value,fingerprint}=await readJson(path);assertProject(value);if(!Array.isArray(value.history)||value.history.length>10)throw new Error('INVALID_HISTORY');if(value.assets.some(a=>!a.data||!a.sha256))throw new Error('INVALID_PROJECT_ASSETS: register assets through academic_ppt_record');const checkedAssets=await embedAssets(value.assets,options.cwd,options.signal);if(checkedAssets.some((a,i)=>a.width!==value.assets[i].width||a.height!==value.assets[i].height))throw new Error('INVALID_PROJECT_ASSETS: stored dimensions differ from actual pixels');return {p:value,path,fingerprint};}
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
 return {ok:true,projectPath:path,revision:0,counts:counts(p),nextActions:['先盘点原文图、表、方法结构及必须入画面的条件，明确研究问题。','有参考时学习主辅证据、局部分组和阅读层级。先做真实候选，再按本稿内容构图；模板不限定逐页坐标。','逐篇阅读并以academic_ppt_record登记；每次最多5篇论文或8页。']};
}
export async function updateRecords(options={}){
 let a=argsFor('academic_ppt_record',options);
 if(a.recordsPath){
  if(Object.keys(a).some(key=>!['projectPath','expectedRevision','recordsPath'].includes(key)))throw new Error('MIXED_RECORD_INPUT: recordsPath 与内联记录不能同时提交');
  const file=await safePath(options.cwd,a.recordsPath,{mustExist:true});
  const bytes=await readBounded(file,1024*1024);let payload;
  try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('INVALID_RECORD_FILE: 需要有效UTF-8 JSON对象');}
  if(!payload||Array.isArray(payload)||typeof payload!=='object'||['projectPath','expectedRevision','recordsPath'].some(key=>Object.hasOwn(payload,key)))throw new Error('INVALID_RECORD_FILE: 文件只包含记录批次，路径与修订号放在工具参数');
  a={projectPath:a.projectPath,expectedRevision:a.expectedRevision,...payload};assertToolArgs('academic_ppt_record',a);
 }
 const state=await load(options);checkRevision(state.p,a.expectedRevision);const next=clone(state.p);
 if(![...fields,'brief','design','capabilities','templateProfilePaths','slideOrder'].some(k=>a[k]!==undefined))throw new Error('EMPTY_UPDATE');
 for(const key of fields){if(!a[key])continue;const seen=new Set();let incoming=a[key];
  if(key==='assets')incoming=await embedAssets(incoming,options.cwd,options.signal);
  for(const item of incoming){if(seen.has(item.id))throw new Error('DUPLICATE_ID: '+item.id);seen.add(item.id);const index=next[key].findIndex(x=>x.id===item.id);
   if(key==='slides'&&index>=0&&state.p.builtOnce)throw new Error('USE_SCOPED_EDIT: 已生成页面请使用 academic_ppt_edit，避免绕过局部修改范围。');
   if(key==='assets'&&index>=0&&stable(next[key][index])!==stable(item))throw new Error('IMMUTABLE_ASSET: 新图片或来源修改需使用新 asset ID，保留旧版本可撤销。');
   if(index<0)next[key].push(item);else next[key][index]=item;
  }
 }
 if(a.brief){const relaxed=constraintRelaxations(state.p.brief,a.brief);if(relaxed.length)throw new Error('REQUIREMENT_RELAXATION: 不能用降低 '+relaxed.join(', ')+' 消除材料缺口。保留本工程；仅在用户明确改变要求后另建带新要求的工程。');}
 for(const key of ['brief','capabilities'])if(a[key])next[key]=a[key];
 if(a.design){
  if(state.p.design.density==='compact'&&a.design.density==='balanced')throw new Error('DENSITY_REQUIREMENT_RELAXATION: 不能通过降低内容占幅要求消除大空区。调整实际内容与构图；仅在用户改变设计要求后另建工程。');
  const retained=Object.fromEntries(['mode','density','cardDefaults','chrome','direction','projection','colorRoles'].filter(key=>Object.hasOwn(state.p.design,key)).map(key=>[key,clone(state.p.design[key])]));
  next.design={...retained,...a.design};
 }
 if(state.p.brief.qualityProfile==='academic')next.brief.qualityProfile='academic';
 if(a.templateProfilePaths){const profiles=[];for(const path of a.templateProfilePaths){const file=await safePath(options.cwd,path,{mustExist:true});const bytes=await readBounded(file,4*1024*1024);profiles.push(JSON.parse(bytes));}next.design.templateProfile=normalizeTemplateProfiles(profiles);}
 if(a.slideOrder){const byId=new Map(next.slides.map(slide=>[slide.id,slide]));if(a.slideOrder.length!==byId.size||new Set(a.slideOrder).size!==byId.size||a.slideOrder.some(id=>!byId.has(id)))throw new Error('INVALID_SLIDE_ORDER: slideOrder 必须恰好包含当前所有页面ID一次。');next.slides=a.slideOrder.map(id=>byId.get(id));}
 next.assets=await embedAssets(next.assets,options.cwd,options.signal);
 return saveMutation(state,next,options.signal);
}
export function evidenceIssues(p){
 const issues=[];const add=(severity,code,path,message)=>issues.push({severity,code,path,message});
 const papers=new Map(p.papers.map(x=>[x.id,x])),claims=new Map(p.claims.map(x=>[x.id,x])),assets=new Map(p.assets.map(x=>[x.id,x]));
 if(!p.brief.centralQuestion.trim())add('error','central-question','brief.centralQuestion','先明确汇报中心问题。');
 if(!p.slides.length)add('error','no-slides','slides','尚无幻灯片。');
 const used=new Set(p.slides.flatMap(s=>[...s.paperIds,...effectiveBibliographyIds(p,s),...expandClaimIds(p.claims,slideClaimIds(s)).map(id=>claims.get(id)?.paperId),...slideAssetIds(s).map(id=>assets.get(id)?.paperId)].filter(Boolean)));
 const usedArticles=[...used].filter(id=>['article','preprint'].includes(papers.get(id)?.sourceType??'article'));
 if(usedArticles.length<p.brief.targetPaperCount)add('error','paper-count','papers',`正文关联 ${usedArticles.length} 篇论文，要求至少 ${p.brief.targetPaperCount} 篇。`);
 const introduced=new Set(p.slides.filter(s=>s.layout==='paper').flatMap(s=>s.paperIds));
 const referenced=new Set(p.slides.flatMap(s=>effectiveBibliographyIds(p,s)));
 for(const id of used){const paper=papers.get(id);if(!paper)continue;
  if(p.brief.requireFullText&&paper.reading.status!=='full-text')add('error','full-text-required','papers.'+id,'全文阅读条件未满足，不能用摘要替代。');
  if(paper.reading.status==='full-text'&&(!paper.reading.notes.trim()||paper.reading.sections.length<3||!paper.methodSummary.trim()||!paper.limitations.length))add('error','reading-coverage','papers.'+id,'全文记录需覆盖至少三个实际章节、方法及局限。');
  if((p.brief.requirePaperIntro===true||!p.brief.qualityProfile)&&!introduced.has(id))add('error','full-title-on-slide','papers.'+id,'缺少 paper 导读页，完整论文题名必须在画面中呈现。');
  if(!referenced.has(id))add('error','reference-entry','papers.'+id,'完整参考文献未显示：在references页或referenceIds区域呈现。');
  if(['article','preprint'].includes(paper.sourceType??'article')&&!/^10\.\d{4,9}\/.+/.test(paper.doi))add('warning','doi-format','papers.'+id+'.doi','请核对 DOI；插件不会联网证明其真实。');
  if(p.brief.impactFactorMin!==undefined&&['article','preprint'].includes(paper.sourceType??'article')){if(!paper.impactFactor)add('error','impact-factor-source','papers.'+id,'缺少有年份、来源及核验日期的期刊影响因子记录。');else if(paper.impactFactor.value<p.brief.impactFactorMin)add('error','impact-factor-threshold','papers.'+id,`记录的期刊影响因子低于 ${p.brief.impactFactorMin}，不能静默降低条件。`);}
 }
 for(const claim of p.claims){if(!papers.has(claim.paperId))add('error','dangling-paper','claims.'+claim.id,'引用的论文 ID 不存在。');
  if(!claim.verified)add('error','unverified-claim','claims.'+claim.id,'该证据记录尚未人工或模型核对原文。');
  if(claim.kind==='reported'&&/\d[\d.,]*\s*(?:%|kg|t\/|\/\s*\d|Hfl)/i.test(claim.text)&&!claim.metrics?.length)add('error','numeric-context','claims.'+claim.id,'定量结果必须记录单位、比较基准、分母和统计口径。');
 }
 for(const asset of p.assets){if(asset.usage==='figure'&&(!asset.paperId||!papers.has(asset.paperId)||!asset.figure?.trim()))add('error','figure-provenance','assets.'+asset.id,'论文原图需有效 paperId、图号和来源版本。');if(!asset.data||!asset.sha256)add('error','unembedded-asset','assets.'+asset.id,'图片未嵌入或缺少摘要。');}
 const paperReferencedClaims=new Set();
 for(const [index,s] of p.slides.entries()){
  const path='slides.'+s.id;
  for(const id of [...s.paperIds,...(s.referenceIds??[])])if(!papers.has(id))add('error','dangling-paper',path,'论文不存在：'+id);
  for(const id of s.referenceIds??[])if(!s.paperIds.includes(id))add('error','reference-source-not-visible',path,'完整书目来源需列入本页paperIds：'+id);
  for(const id of expandClaimIds(p.claims,slideClaimIds(s))){const c=claims.get(id);if(!c)add('error','dangling-claim',path,'证据或其前提不存在：'+id);else{paperReferencedClaims.add(c.paperId);if(!s.paperIds.includes(c.paperId))add('error','claim-source-not-visible',path,`证据 ${id}（包含推断前提）的来源需列入本页 paperIds。`);}}
  for(const id of slideAssetIds(s)){const f=assets.get(id);if(!f)add('error','dangling-figure',path,'图片不存在：'+id);else if(f.paperId&&!s.paperIds.includes(f.paperId))add('error','figure-source-not-visible',path,'图的论文需列入本页 paperIds。');}
  for(const [role,visual] of [['cover',s.cover],['closing',s.closing]])if(visual?.assetId){const asset=assets.get(visual.assetId);if(!asset)add('error','dangling-context-visual',path+'.'+role+'.assetId','情境配图不存在：'+visual.assetId);else if(asset.usage!=='decorative')add('error','context-visual-usage',path+'.'+role+'.assetId','封面和结尾情境配图须登记为 decorative；研究证据图放入有来源的正文证据区。');}
  if(['figure-focus','figure-split'].includes(s.layout)&&!s.figureIds.length)add('error','missing-main-figure',path,'此页型需要原图。');
  if(s.layout==='figure-split'&&!s.referenceTemplateId&&s.figureIds.length>2)add('error','too-many-figures',path,'默认此页型最多两幅图；更多面板请使用匹配的 referenceTemplateId 或拆页。');
  if(s.layout==='paper'&&s.paperIds.length!==1)add('error','paper-page-count',path,'导读页一次展示一篇论文完整标题。');
  if(s.layout==='references'&&effectiveBibliographyIds(p,s).length>4)add('error','dense-references',path,'每页最多四条完整书目，请显式拆页。');
  if(!s.notes.trim()&&s.layout!=='references')add('warning','missing-notes',path,'补充与本页一致的演讲备注。');
  if(s.cards.length>4&&!s.referenceTemplateId&&!s.composition)add('warning','dense-cards',path,'同页解释区较多，请确认每个区域都承担独立研究任务，并给主证据保留足够空间；数量本身不是密度评分。');
  for(const card of s.cards){if(card.kind==='hypothesis'&&!card.claimIds.some(id=>claims.get(id)?.kind==='proposal'))add('warning','proposal-label',path+'/card/'+card.id,'假说卡请关联 proposal 证据，避免与已验证结果混淆。');
   if(card.templateComponentId&&!p.design.templateProfile?.components?.some(c=>c.id===card.templateComponentId))add('error','missing-template-component',path,'模板组件不存在：'+card.templateComponentId);
   if(card.box&&(card.box.x+card.box.w>1280||card.box.y+card.box.h>720))add('error','card-outside-slide',path,'卡片边界超出页面。');
  }
  for(const d of s.drawings??[]){if(!(d.elements??[]).some(e=>e.role==='data'))continue;const ids=[...(d.claimIds??[]),...(d.elements??[]).flatMap(e=>e.claimIds??[])];if(!ids.some(id=>claims.get(id)?.metrics?.length))add('error','drawing-data-source',path+'.drawings.'+d.id,'自绘数据标记须在drawing/element claimIds关联有数值口径的证据；图形长度不能代替来源。');}
  const nodeIds=new Set((s.nodes??[]).map(n=>n.id));for(const e of s.edges??[])if(!nodeIds.has(e.from)||!nodeIds.has(e.to))add('error','dangling-edge',path,'流程连线指向不存在的节点。');
  if(s.chart){if(s.chart.series.some(x=>x.values.length!==s.chart.categories.length))add('error','chart-dimensions',path,'图表系列与类别长度不一致。');const source=claims.get(s.chart.sourceClaimId);if(!source||!source.metrics?.length)add('error','chart-data-source',path,'可编辑图表必须关联记录了原始数据口径的证据。');}
  for(const plot of [...(s.plot?[s.plot]:[]),...(s.plots??[])]){
   if(!plot.sourceClaimIds.length)add('error','plot-data-source',path,'科学图必须用 sourceClaimIds 关联数据、估计方法和单位口径；不会自动计算区间。');
   for(const id of plot.sourceClaimIds){const c=claims.get(id);if(!c||!c.metrics?.length)add('error','plot-data-source',path,'科学图来源需存在并记录数值口径：'+id);}
   for(const g of plot.groups){
    if(plot.kind==='distribution'&&(!g.values?.length||['estimate','lower','upper'].some(k=>g[k]!==undefined)))add('error','plot-distribution-data',path,'distribution 每组提供原始 values；不能混入区间字段或用连线暗示独立点配对。');
    if(plot.kind==='interval'&&(g.values||!['estimate','lower','upper'].every(k=>Number.isFinite(g[k]))||g.lower>g.estimate||g.estimate>g.upper))add('error','plot-interval-data',path,'interval 每组提供 lower ≤ estimate ≤ upper；区间必须来自实际计算或来源记录。');
   }
  }
  if(s.table){if(s.table.rows.some(row=>row.length!==s.table.columns.length))add('error','table-dimensions',path,'原生表格每一行必须与列标题等长。');if(!s.table.sourceClaimIds?.length)add('error','table-data-source',path,'table.sourceClaimIds 必须明确关联表格的原文或研究方案证据；页面其他 claim 不能代替表格来源。');if(s.table.rows.length>8||s.table.columns.length>6)add('warning','dense-table',path,'表格行列较多，建议拆为正文与备份页并检查实际字号。');}
  if(s.plots&&new Set(s.plots.map(plot=>plot.id)).size!==s.plots.length)add('error','duplicate-plot-id',path,'同页科学图ID必须唯一。');
  if(s.table?.columnWeights&&s.table.columnWeights.length!==s.table.columns.length)add('error','table-column-weights',path,'columnWeights 必须与列数一致。');
  if(s.table?.highlightRows?.some(i=>i>=s.table.rows.length))add('error','table-highlight-row',path,'highlightRows 使用数据行从0开始的索引，不能指向不存在的行。');
  if(s.composition&&(s.referenceTemplateId||s.figureBoxes||['cover','section','references'].includes(s.layout)))add('error','composition-layout-conflict',path,'composition 用于正文组合页，不能与固定 referenceTemplateId、figureBoxes 或封面/章节/书目页混用。');
  if(s.layout==='academic'&&!s.composition&&!(s.drawings?.length))add('error','academic-composition-missing',path,'academic页需提供composition.rows/regions或实际drawings，按证据定义结构。');
  if(s.layout==='cover'&&s.section)add('error','cover-section-unused',path,'封面用cover.occasion描述场合；section用于正文或章节页，不能在封面静默丢掉。');
  if(s.diagram){const flat=s.diagram.rows.flat();if(new Set(flat).size!==flat.length||flat.length!==nodeIds.size||flat.some(id=>!nodeIds.has(id)))add('error','diagram-row-membership',path,'diagram.rows 需将所有 nodes 的ID恰好列出一次。');}
  if(s.agenda&&s.layout!=='section')add('error','agenda-layout',path,'agenda 用于 section 章节导航页。短报告可只使用每页 section 抬头。');
  if(s.figureBoxes){
   if(s.referenceTemplateId)add('error','custom-reference-conflict',path,'figureBoxes 用于无 referenceTemplateId 的自定义图文页；固定模板面板不能和自由图框混用。');
   if(!['figure-focus','figure-split'].includes(s.layout))add('error','custom-figure-layout',path,'figureBoxes 仅用于 figure-focus 或 figure-split 的图文构图。');
   if(s.figureBoxes.length!==s.figureIds.length)add('error','custom-figure-count',path,'figureBoxes 必须与 figureIds 一一对应。');
   if(s.cards.some(c=>!c.box))add('error','custom-card-box-required',path,'自定义图框时，为每个解释卡片显式分配 box，避免沿用默认位置造成重叠。');
   const boxes=[...s.figureBoxes,...s.cards.filter(c=>c.box).map(c=>c.box)];
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1)add('error','custom-evidence-overlap',path,'自定义证据图与解释区相互重叠，调整实际区域后再生成。');}
  }
  if(s.panelTitles&&!s.referenceTemplateId)add('error','panel-titles-without-reference',path,'面板标题需要对应的 referenceTemplateId，不能配置后不显示。');
  if(s.referenceTemplateId){const template=getReferenceTemplate(s.referenceTemplateId);if(!template)add('error','unknown-reference-template',path,'未知学术模板 ID：'+s.referenceTemplateId);else{
   if(p.brief.qualityProfile==='academic'&&template.slots.panels?.some(panel=>panel.title)&&!s.panelTitles)add('error','panel-titles-required',path,'参考页型包含题签，需用 panelTitles 按当前研究内容逐一命名，不能沿用模板默认判断。');
   if(s.panelTitles&&s.panelTitles.length!==(template.slots.panels?.length??0))add('error','panel-title-count',path,'panelTitles 必须与所选模板的 panels 一一对应；请按实际图文内容命名。');
   if(template.layout!==s.layout)add('error','reference-layout-mismatch',path,`模板 ${template.id} 要求 layout=${template.layout}，当前为 ${s.layout}。`);
   for(const [key,count] of [['cards',s.cards.length],['figures',s.figureIds.length],['nodes',(s.nodes??[]).length]]){const range=template.requirements?.[key];if(range&&(count<range.min||count>range.max))add('error','reference-content-count',path,`${template.name} 的 ${key} 需要 ${range.min}–${range.max} 个，当前 ${count} 个；选择匹配证据的页型。`);}
   for(const key of ['chart','table']){const required=template.requirements?.[key];if(required===true&&!s[key])add('error','reference-content-missing',path,`${template.name} 需要 ${key}，不能以空白占位代替证据。`);if(s[key]&&!template.slots?.[key])add('error','reference-content-unused',path,`${template.name} 没有 ${key} 区域，请选择支持此内容的页型。`);}
  }}
 }
 for(const id of used)if(!paperReferencedClaims.has(id))add('warning','paper-without-claims','papers.'+id,'论文尚未关联任何页内证据。');
 const seconds=p.slides.reduce((n,s)=>n+s.seconds,0),target=p.brief.talkMinutes*60;
 if(seconds<target*.8||seconds>target*1.12)add('warning','talk-budget','brief.talkMinutes',`逐页预算 ${Math.round(seconds)} 秒，目标 ${Math.round(target)} 秒；需要实际排练校准。`);
 return [...issues,...academicIssues(p),...designIssues(p)];
}
function statusSummary(issues){return {errors:issues.filter(x=>x.severity==='error').length,warnings:issues.filter(x=>x.severity==='warning').length};}
export function slideClaimIds(s){return [...new Set([...(s.claimIds??[]),...(s.cards??[]).flatMap(c=>c.claimIds??[]),...(s.chart?[s.chart.sourceClaimId]:[]),...(s.plot?.sourceClaimIds??[]),...(s.plots??[]).flatMap(plot=>plot.sourceClaimIds??[]),...(s.table?.sourceClaimIds??[]),...(s.drawings??[]).flatMap(d=>[...(d.claimIds??[]),...(d.elements??[]).flatMap(e=>e.claimIds??[])])])];}
export function slideAssetIds(s){return [...new Set([...(s.figureIds??[]),...(s.drawings??[]).flatMap(d=>(d.elements??[]).filter(e=>e.kind==='image').map(e=>e.assetId))])];}
async function scenesAndIssues(p){const {buildScenes}=await import('./scene.mjs');const scenes=buildScenes(p),designDiagnostics=designGeometryReport(p,scenes);designDiagnostics.evidenceDesign=evidenceDesignReport(p,scenes);designDiagnostics.contentCoverage=contentCoverageReport(p,scenes);return {scenes,designDiagnostics,issues:[...evidenceIssues(p),...(scenes.issues??[]),...designDiagnostics.issues,...designDiagnostics.evidenceDesign.issues,...designDiagnostics.contentCoverage.issues]};}
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
 argsFor('academic_ppt_check',options);const {p,path}=await load(options);const {issues,designDiagnostics}=await scenesAndIssues(p);const artifact=await artifactCheck(p,options.cwd),render=await renderReceiptCheck(p,options.cwd);
 const reviews=(p.visualReviews??[]).filter(r=>artifact.current&&r.pptxSha256===artifact.pptxSha256);
 const full=(basis)=>p.slides.every(s=>reviews.findLast(r=>r.basis===basis&&r.reviewedSlides.includes(s.id))?.result==='passed');
 const summary=statusSummary(issues),visual=artifact.current&&full('pptx-render')&&render.status==='rendered'?'reported-passed':'not-verified';
 const ready=p.brief.qualityProfile==='academic'&&summary.errors===0&&artifact.current&&p.artifact.mode==='review'&&visual==='reported-passed'&&!(render.missingFonts?.length);
 return {ok:summary.errors===0,projectPath:path,revision:p.revision,counts:counts(p),summary,issues,designDiagnostics,artifact,verification:{evidence:'records-checked-not-independently-verified',layout:'estimated',pptxRender:render.status,visual,htmlVisual:artifact.current&&full('html-preview')?'reported-passed':'not-verified',readyForDelivery:ready},render,slides:p.slides.map(s=>({id:s.id,title:s.title,layout:s.layout,seconds:s.seconds})),note:'格式、引用链和内容分布诊断不能证明论文结论真实或审美优秀；视觉审查为具名记录，须查看实际最终 PPTX 渲染。'};
}
export async function contextProject(options={}){
 const a=argsFor('academic_ppt_context',options),{p,path}=await load(options),evaluated=await scenesAndIssues(p),issues=evaluated.issues,summary=statusSummary(issues);
 let stage=a.stage??'auto';if(stage==='auto')stage=!p.papers.length?'research':!p.claims.length?'evidence':!p.slides.length?'storyboard':summary.errors?(evaluated.designDiagnostics.issues.some(issue=>issue.severity==='error')?'design':'evidence'):!p.artifact?'render':'review';
 const mode=p.design.mode??'legacy';
 const nextActions={
  research:['阅读完整来源，盘点原图、表、公式和方法结构，保存单位、分母、验证方式与精确定位。','有参考时先看实际页面中的主辅证据、邻接解释和局部分组；没有参考文件则明确记录依据，不声称已看。'],
  evidence:['核对reported/inference/proposal及推理前提。把关键结果、比较条件和边界分配到真实可见载体。','检查是否只摘了漂亮的单个数字而丢失分布、对照、时间变化和负结果；按问题修复，不为构图补造结果。'],
  design:[`当前设计模式${mode}。reference-guided学习参考的证据组织、密度、分组与层级，实际坐标由本稿内容决定。`,
   '阅读references/visual-decision.md。记录design.direction与颜色含义，保留主判断、普通解释、图标签和注释的层次；参考感不能只剩配色或大小字。',
   '用academic_ppt_study实际绘制2个封面和2个困难证据页候选（SVG与原生PPTX），可render:true查看真实画面。与参考和论文原图并列选择，不以方案名称代替设计。',
   '局部浅底、边界、题签和卡片按研究关系设计；无需每段套框，也不要求完全去框。空区诊断只定位可审阅问题，不能靠装饰或巨字刷占幅。'],
  storyboard:['先写argument、内容覆盖与简短visualPlan，再用composition.rows/regions或drawings组织证据；不必选择referenceTemplateId。',
   '图、表和方法结构承担主视图，解释贴近相应证据。用contentChecks登记必须可见的关键条件，不能只留在notes。',
   'heading与cover自定题名位置和语义断行；颜色、字号、线型对应真实研究关系。反馈、因果和无向关联分别表达，核对连线端点及标签。',
   '保留普通正文和图标签的中间字级；拥挤时先重排主辅/去重复或拆任务，不能删重要边界或缩成脚注。references/referenceIds显示完整书目。'],
  render:['academic_ppt_build(mode:review)生成原生PPTX；存在材料缺口的中间稿明确使用draft，不把它当交付。'],
  review:['academic_ppt_render后查看每张实际PPTX图片和整稿概览，核对缺字、原图裁切、坐标标签、颜色语义、流程方向及内容覆盖。',
   '将参考实际页、论文原图与当前候选共同检查。有此前工程时academic_ppt_portfolio比较指定工程，再并列实际概览；结构提示不代表原创性评分。',
   '将未解决问题登记needs-fix，修改后查看当前版本变化页并核对未变化页；只有实际看过的最终画面才能登记通过。'],
  delivery:['academic_ppt_check核对当前成品hash、真实渲染及审查范围。','交付PPTX、PDF/实际预览、讲稿、来源与可重建记录；如实说明仍存问题和未测宿主。'],
 }[stage];
 const selected=new Set(a.recordIds??[]);const records=fields.flatMap(k=>p[k].filter(x=>selected.has(x.id)).map(x=>{const v=clone(x);delete v.data;return {collection:k,record:v};}));
 return {ok:true,projectPath:path,revision:p.revision,stage,brief:p.brief,designMode:mode,capabilities:p.capabilities,counts:counts(p),summary,nextActions,evidenceDesign:evaluated.designDiagnostics.evidenceDesign,contentCoverage:evaluated.designDiagnostics.contentCoverage,issues:issues.slice(0,20),records,recordIndex:Object.fromEntries(fields.map(k=>[k,p[k].map(x=>({id:x.id,title:(x.title??x.text??x.caption??'').slice(0,180)}))])),artifact:p.artifact?{pptxSha256:p.artifact.files.pptx.sha256,mode:p.artifact.mode}:null};
}
function speechMarkdown(p){let elapsed=0;return `# ${p.title}\n\n目标时长：${p.brief.talkMinutes} 分钟。以下为本次导出对应的备注，实际语速须排练。\n\n`+p.slides.map((s,i)=>{const start=elapsed;elapsed+=s.seconds;const t=n=>`${Math.floor(n/60)}:${String(Math.round(n%60)).padStart(2,'0')}`;return `## ${i+1}. ${s.title}\n\n页 ID：${s.id}。时间预算：${t(start)}–${t(elapsed)}。\n\n${s.notes||'此页尚无讲稿。'}\n\n`}).join('');}
export async function buildProject(options={}){
 const a=argsFor('academic_ppt_build',options),state=await load(options);checkRevision(state.p,a.expectedRevision);const p=state.p,mode=a.mode??'review';
 const preflight=await scenesAndIssues(p),before=preflight.issues;if(!p.slides.length)throw new Error('NO_SLIDES');if(mode==='review'&&before.some(i=>i.severity==='error'))return {ok:false,status:'blocked',projectPath:state.path,revision:p.revision,summary:statusSummary(before),issues:before,designDiagnostics:preflight.designDiagnostics,nextActions:['修复证据、几何或大空区等阻断项后重试；资料仍待补齐的中间稿可显式使用 mode=draft，不能降低原要求作为交付。']};
 const {renderProject}=await import('./render.mjs');abort(options.signal);const generated=await renderProject(p,{signal:options.signal});abort(options.signal);
 const issues=before;if(mode==='review'&&issues.some(i=>i.severity==='error'))return {ok:false,status:'blocked',projectPath:state.path,revision:p.revision,summary:statusSummary(issues),issues};
 const exportRoot=await safePath(options.cwd,join(dirname(state.path),'exports'));await mkdir(exportRoot,{recursive:true});
 const token=`r${p.revision}-${randomUUID().slice(0,8)}`,directory=join(exportRoot,token);await mkdir(directory);
 let committed=false;
 try{
  const fileValues={pptx:['report.pptx',generated.pptx],html:['report.html',generated.html],speech:['speaker-notes.md',speechMarkdown(p)],evidence:['evidence.json',JSON.stringify({brief:p.brief,papers:p.papers,claims:p.claims},null,2)],assets:['asset-manifest.json',JSON.stringify(p.assets.map(({data,...rest})=>rest),null,2)],quality:['quality.json',JSON.stringify({createdAt:now(),revision:p.revision,mode,issues,designDiagnostics:preflight.designDiagnostics,verification:{static:'checked',visual:'not-verified'},sourceHash:contentHash(p)},null,2)]};
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
  if(a.scope==='card-style'){if(change.removeFields?.length)throw new Error('CARD_STYLE_SCOPE: removeFields 仅限 slide-content');if(!change.cardId)throw new Error('CARD_ID_REQUIRED');const card=slide.cards.find(c=>c.id===change.cardId);if(!card)throw new Error('UNKNOWN_CARD');if(slide.composition&&(change.patch.templateComponentId||change.patch.style&&!['plain','compact'].includes(change.patch.style)))throw new Error('COMPOSITION_CARD_STYLE: 组合页用appearance设计独立卡片表面，旧style仅支持plain/compact。');const allowed=new Set(['style','accent','templateComponentId','appearance','icon']);if(!Object.keys(change.patch).length||Object.keys(change.patch).some(k=>!allowed.has(k)))throw new Error('CARD_STYLE_SCOPE: only style, accent, templateComponentId, appearance or icon may change; words, values, box and other objects remain locked');Object.assign(card,change.patch);prefixes.push(cardPrefix(slide.id,card.id));}
  else{if(change.cardId)throw new Error('SLIDE_CONTENT_SCOPE: patch the slide; for style-only edits use card-style');const allowed=new Set(['title','kicker','subtitle','takeaway','notes','seconds','paperIds','claimIds','figureIds','cards','nodes','edges','chart','table','layout','referenceTemplateId','panelTitles','figureBoxes','cover','closing','chrome','argument','visualPlan','composition','section','agenda','diagram','plot','plots','drawings','heading','referenceIds','contentChecks']);if((!Object.keys(change.patch).length&&!change.removeFields?.length)||Object.keys(change.patch).some(k=>!allowed.has(k)))throw new Error('INVALID_SLIDE_PATCH');for(const field of change.removeFields??[]){if(Object.hasOwn(change.patch,field))throw new Error('CONFLICTING_SLIDE_PATCH: 不能同时删除和设置 '+field);delete slide[field];}Object.assign(slide,change.patch);}
 }
 assertProject(next);let preservation;
 if(a.scope==='card-style'){const {buildScenes}=await import('./scene.mjs');const before=buildScenes(state.p),after=buildScenes(next);const protectedCount=preservedScene(before,after,prefixes);preservation={scope:'card-style',targetCards:a.changes.map(c=>({slideId:c.slideId,cardId:c.cardId})),protectedSceneObjects:protectedCount,notes:'preserved',content:'preserved',targetCardFrames:'preserved',targetCardInternalTextGeometry:'may-change-with-style',basis:'semantic scene comparison; not pixel or Office GUI proof'};}
 const result=await saveMutation(state,next,options.signal);return {...result,...(preservation?{preservation}:{})};
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
 if(state.p.brief.qualityProfile==='academic'){
  const observed=new Set((a.observations??[]).map(item=>item.slideId));
  if((a.observations??[]).length!==a.reviewedSlides.length||observed.size!==a.reviewedSlides.length||a.reviewedSlides.some(id=>!observed.has(id))||(a.observations??[]).some(item=>!a.reviewedSlides.includes(item.slideId)))throw new Error('PER_SLIDE_REVIEW_REQUIRED: 当前版本每个 reviewedSlides ID 需要对应 observations，逐页写 contentCheck/legibilityCheck/issue。');
  if(a.result==='passed'&&a.observations.some(item=>item.issue.trim()))throw new Error('UNRESOLVED_REVIEW_ISSUES: 有具体问题时登记 needs-fix，不能同时声称通过。');
 }
 const review={...(a.observations?{observations:a.observations}:{}),pptxSha256:a.pptxSha256,reviewer:a.reviewer,basis:a.basis,reviewedSlides:a.reviewedSlides,result:a.result,notes:a.notes,createdAt:now(),attestation:'user-or-agent-recorded-not-an-automatic-visual-judgment'};
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
 const {createContactSheets}=await import('./montage.mjs');rendered.contactSheetPaths=await createContactSheets(rendered.pngPaths,dirname(rendered.receiptPath),{signal:options.signal});
 const next=clone(state.p);next.artifact.render=rendered;
 // The same PPTX may render differently after a font or engine change.
 next.visualReviews=(next.visualReviews??[]).filter(review=>review.basis!=='pptx-render');
 await locked(state.path,async()=>{if(hash(await readBounded(state.path))!==state.fingerprint)throw new Error('REVISION_CONFLICT');await atomicJson(state.path,next,options.signal);},options.signal);
 return {...rendered,projectPath:state.path,revision:state.p.revision,note:'这是真实 PPTX 的静态渲染，尚未判断画面质量；字体及布局仍需查看图片。'};
}


/** Real candidate artifacts, isolated from the project history and formal review. */
export async function studyProject(options={}){
 let a=argsFor('academic_ppt_study',options);
 if(Boolean(a.candidates)===Boolean(a.candidatesPath))throw new Error('CANDIDATE_INPUT: provide exactly one of candidates or candidatesPath');
 if(a.candidatesPath){const path=await safePath(options.cwd,a.candidatesPath,{mustExist:true});const bytes=await readBounded(path,1024*1024);let candidates;try{candidates=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new Error('INVALID_CANDIDATES_FILE: use a UTF-8 JSON candidate array');}const {candidatesPath,...rest}=a;a={...rest,candidates};assertToolArgs('academic_ppt_study',a);}
 const state=await load(options);checkRevision(state.p,a.expectedRevision);
 const candidateProject={...state.p,slides:a.candidates.map(c=>({...c.slide,id:c.id}))};
 const sourceCodes=new Set(['dangling-paper','dangling-claim','dangling-figure','claim-source-not-visible','figure-source-not-visible','reference-source-not-visible','drawing-data-source','chart-data-source','chart-dimensions','table-data-source','plot-data-source','dangling-context-visual','context-visual-usage']);
 const sourceIssues=evidenceIssues(candidateProject).filter(i=>sourceCodes.has(i.code));
 if(sourceIssues.some(i=>i.severity==='error'))return {ok:false,status:'blocked',issues:sourceIssues,note:'候选也须绑定存在的来源并保留一致的数据结构；这不是全文阅读或完整报告的正式验收。'};
 return writeDesignStudy(state.p,a,{cwd:options.cwd,signal:options.signal});
}

/** Read only the explicitly supplied projects. No workspace scan or stored approvals. */
export async function portfolioProjects(options={}){
 const a=argsFor('academic_ppt_portfolio',options),states=[];
 for(const projectPath of a.projectPaths)states.push(await load({cwd:options.cwd,signal:options.signal,projectPath}));
 if(new Set(states.map(s=>s.path)).size!==states.length||new Set(states.map(s=>s.p.id)).size!==states.length)throw new Error('DUPLICATE_PROJECT: portfolio需要不同工程，不能以同一工程副本充当独立制作。');
 const result=compareProjectStructures(states.map(s=>({project:s.p,path:s.path})));
 if(a.outputPath){const outputPath=await safePath(options.cwd,a.outputPath);await mkdir(dirname(outputPath),{recursive:true});await writeFile(outputPath,JSON.stringify(result,null,2)+'\n',{flag:'wx',signal:options.signal});result.reportPath=outputPath;}
 return result;
}
