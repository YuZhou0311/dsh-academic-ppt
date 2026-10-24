/** Completeness and provenance gates. These cannot establish scientific truth. */
import {readFileSync} from 'node:fs';

const normalize = text => String(text ?? '').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
const substantive = text => normalize(text).length >= 14;
const administrative = new Set(['cover','section','roadmap','references','closing']);
/** Include every premise in the source gates; visited IDs also bound cycles. */
export function expandClaimIds(claims, roots) {
  const byId=new Map(claims.map(claim=>[claim.id,claim])),seen=new Set(),pending=[...roots];
  while(pending.length){const id=pending.pop();if(seen.has(id))continue;seen.add(id);for(const premise of byId.get(id)?.dependsOn??[])pending.push(premise);}
  return [...seen];
}
let templateProse;
function demonstrationProse() {
  if (templateProse) return templateProse;
  // Compare against the shipped examples, not a topic-specific blacklist.
  const data=JSON.parse(readFileSync(new URL('../skills/dsh-academic-ppt/references/templates/slide-records.json',import.meta.url),'utf8'));
  templateProse=[...new Set((data.slides??[]).flatMap(s=>[
    s.subtitle,s.takeaway,...(s.cards??[]).flatMap(c=>[c.title,c.body]),
  ]).map(normalize).filter(s=>s.length>=28))];
  return templateProse;
}

export function academicIssues(project) {
  if (project.brief.qualityProfile!=='academic') return [{severity:'warning',code:'legacy-quality-profile',path:'brief',message:'旧工程仍可编辑；尚未采用学术论证记录，不能凭格式检查声称已完成学术质量验收。'}];
  const issues=[],add=(code,path,message)=>issues.push({severity:'error',code,path,message});
  const claims=new Map(project.claims.map(c=>[c.id,c]));
  const assets=new Map(project.assets.map(a=>[a.id,a]));
  const ids=s=>[...new Set([...(s.claimIds??[]),...(s.cards??[]).flatMap(c=>c.claimIds??[]),...(s.chart?[s.chart.sourceClaimId]:[]),...(s.plot?.sourceClaimIds??[]),...(s.plots??[]).flatMap(plot=>plot.sourceClaimIds??[]),...(s.table?.sourceClaimIds??[]),...(s.drawings??[]).flatMap(d=>[...(d.claimIds??[]),...(d.elements??[]).flatMap(e=>e.claimIds??[])])])];
  const cited=new Set(project.slides.flatMap(s=>expandClaimIds(project.claims,ids(s))));
  const used=new Set([...project.slides.flatMap(s=>[...s.paperIds,...s.figureIds.map(id=>assets.get(id)?.paperId)]),...[...cited].map(id=>claims.get(id)?.paperId)].filter(Boolean));
  for(const p of project.papers.filter(p=>used.has(p.id))) {
    const path='papers.'+p.id,a=p.analysis;
    if(!a) add('analysis-missing',path,'补充 analysis：研究问题、原有缺口、具体机制、验证设计、独立样本单位、对照、有效性边界与原文位置。');
    else for(const field of ['question','gap','mechanism','design','validity']) if(!substantive(a[field])) add('analysis-too-thin',path+'.analysis.'+field,'此项尚不足以审查研究判断；写出具体对象、关系或验证条件，不能只填章节名或“已阅读”。');
    if(!project.claims.some(c=>c.paperId===p.id&&cited.has(c.id))) add('source-without-evidence',path,'正文使用的来源需要至少一条实际核对并用于论证的 claim；题名和完整阅读标记不能替代证据。');
  }
  for(const c of project.claims) {
    const path='claims.'+c.id;
    if(!c.reasoning) add('claim-reasoning-missing',path,'补充 reasoning.warrant 与 boundary，说明证据为何支持这个结论、能支持到什么范围。');
    else {
      for(const field of ['warrant','boundary']) if(!substantive(c.reasoning[field])) add('claim-reasoning-too-thin',path+'.reasoning.'+field,'写出可核对的推导或适用边界，不用泛泛评价代替分析。');
      if(c.kind==='inference'&&!substantive(c.reasoning.alternatives)) add('alternative-explanation-missing',path,'推断需讨论另一种可能解释，或说明现有设计为何不能排除它。');
    }
    if(/^(全文|原文|论文|full\s*text|the\s*paper)$/i.test(c.locator.trim())) add('locator-too-broad',path+'.locator','定位到具体章节、图表、数据行或页码，不能只写“全文”。');
    if(c.kind!=='reported'&&!(c.dependsOn?.length)) add('reasoning-premise-missing',path,'inference/proposal 用 dependsOn 指向支持它的已核对证据，不能只有一个论文 ID。');
    for(const id of c.dependsOn??[]) if(id===c.id||!claims.has(id)) add('invalid-reasoning-premise',path,'dependsOn 需要存在且不为自身的证据 ID：'+id);
  }
  const active=new Set(),done=new Set();
  const visit=id=>{if(active.has(id)){add('cyclic-reasoning','claims.'+id,'证据推导出现循环，需回到独立的原始观察。');return;}if(done.has(id)||!claims.has(id))return;active.add(id);for(const next of claims.get(id).dependsOn??[])visit(next);active.delete(id);done.add(id);};
  for(const c of project.claims)visit(c.id);
  for(const s of project.slides) {
    const path='slides.'+s.id;
    if(!administrative.has(s.layout)) {
      if(!s.argument) add('slide-argument-missing',path,'补充 argument：本页问题、论证贡献与必须显示的边界。先建立科学任务，再挑布局。');
      if(!ids(s).length) add('slide-without-evidence',path,'正文页需要实际证据链，不能只由介绍卡片构成。');
      if(s.argument&&['synthesis','proposal'].includes(s.argument.role)&&!ids(s).some(id=>claims.get(id)?.kind!=='reported')) add('synthesis-without-reasoning',path,'综合或方案页需可追溯的 inference/proposal，不只罗列作者结论。');
    }
    const prose=[s.title,s.subtitle,s.takeaway,s.composition?.lead,s.composition?.conclusion?.text,...(s.composition?.rows??[]).flatMap(r=>r.panels.map(p=>p.title)),...(s.composition?.regions??[]).map(p=>p.title),...(s.heading?.lines??[]),...(s.drawings??[]).flatMap(d=>d.elements.filter(e=>e.kind==='text').map(e=>e.text)),...(s.cards??[]).flatMap(c=>[c.title,c.body])].filter(Boolean);
    if(prose.some(text=>demonstrationProse().some(sample=>normalize(text).includes(sample)))) add('template-text-reused',path,'页上含内置版式示例的长段原文。模板只提供形式，重新根据当前证据写论证。');
    if(prose.some(text=>/\[(?:待填|待补|TODO|INSERT)[^\]]*\]|<[^>]*(?:待填|YOUR TITLE)[^>]*>/i.test(text))) add('unfilled-placeholder',path,'正式页仍含明确占位符，补齐真实内容或移除不必要项。');
  }
  for(const a of project.assets) if(a.usage==='figure'&&(a.provenance==='template-demo'||[a.path,a.sourcePath].some(path=>/(?:^|[/\\])references[/\\]templates[/\\]assets[/\\]/.test(path??'')))) add('template-as-evidence','assets.'+a.id,'内置模板的教学图不能用作当前研究证据；取得当前来源图或有出处的数据。');
  return issues;
}

export function constraintRelaxations(before,after) {
  const fields=[];
  if(before.requireFullText&&!after.requireFullText)fields.push('requireFullText');
  if((after.targetPaperCount??0)<(before.targetPaperCount??0))fields.push('targetPaperCount');
  if((after.impactFactorMin??0)<(before.impactFactorMin??0))fields.push('impactFactorMin');
  if(before.requirePaperIntro&&!after.requirePaperIntro)fields.push('requirePaperIntro');
  if(before.qualityProfile==='academic'&&after.qualityProfile&&after.qualityProfile!=='academic')fields.push('qualityProfile');
  return fields;
}
