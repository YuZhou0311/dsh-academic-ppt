import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {academicIssues} from '../src/academic-quality.mjs';
import {createProject,updateRecords,buildProject,editProject,recordReview,checkProject,contextProject,evidenceIssues,DEFAULT_DESIGN} from '../src/core.mjs';
import {fixtureDesign,brief,paper,claim,asset,slides,syntheticObservations} from './fixtures.mjs';

const fixture=()=>structuredClone({schemaVersion:1,id:'quality-fixture',revision:0,title:'Evidence integrity fixture',brief,design:fixtureDesign,capabilities:{imageInput:'unknown',source:'Synthetic protocol test'},papers:[paper],claims:[claim],assets:[asset],slides});
async function project(t){const root=resolve('.test-output');await mkdir(root,{recursive:true});const cwd=await mkdtemp(join(root,'quality-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const created=await createProject({cwd,projectDir:'p',title:'Evidence integrity fixture',brief,design:fixtureDesign});await updateRecords({cwd,projectPath:created.projectPath,expectedRevision:0,papers:[paper],claims:[claim],assets:[asset],slides});return {cwd,projectPath:created.projectPath};}
const codes=p=>academicIssues(p).map(i=>i.code);

test('full-text and verified flags alone cannot admit a shallow academic deck',()=>{
 const p=fixture();delete p.papers[0].analysis;delete p.claims[0].reasoning;delete p.slides[0].argument;
 assert.deepEqual(new Set(codes(p)),new Set(['analysis-missing','claim-reasoning-missing','slide-argument-missing']));
 p.papers[0].analysis={...paper.analysis,mechanism:'方法',design:'实验',validity:'局限'};
 assert.ok(codes(p).includes('analysis-too-thin'));
});
test('a non-experimental source can document its actual evidence without fabricating an experiment or DOI',()=>{
 const p=fixture();p.papers[0].sourceType='report';p.papers[0].doi='';p.papers[0].studyType='qualitative';
 p.papers[0].analysis={...paper.analysis,design:'对访谈材料进行有记录的主题分析，比较参与者叙述的共同点和分歧。',unitOfAnalysis:'访谈参与者；同一参与者多段材料不视为独立样本',comparators:['描述性分析，无随机干预对照；比较不同受访者的叙述'],validity:'取样与研究者解释均可能影响主题，不能推断干预因果效应或人群发生率。'};
 assert.deepEqual(academicIssues(p),[]);
});
test('inferences require traceable independent premises and an alternative explanation',()=>{
 const p=fixture();p.claims.push({...structuredClone(claim),id:'C2',kind:'inference'});
 assert.ok(codes(p).includes('reasoning-premise-missing'));assert.ok(codes(p).includes('alternative-explanation-missing'));
 p.claims[1].dependsOn=['C1'];p.claims[1].reasoning.alternatives='输入简单也可能解释软件本次成功，尚未排除复杂图像与文字组合的失败。';
 assert.deepEqual(academicIssues(p),[]);
 p.claims[0].dependsOn=['C2'];assert.ok(codes(p).includes('cyclic-reasoning'));
});
test('identical reasoning across independent sources is advisory while shared-study wording remains valid',()=>{
 const p=fixture();
 p.papers.push({...structuredClone(paper),id:'P2'});
 p.claims.push({...structuredClone(claim),id:'C2'},{...structuredClone(claim),id:'C3',paperId:'P2'});
 const repeated=academicIssues(p).find(i=>i.code==='reasoning-duplicated-across-sources');
 assert.equal(repeated.severity,'warning');assert.deepEqual(repeated.relatedClaimIds,['C1','C2','C3']);
 p.claims[2].paperId=paper.id;
 assert.ok(!codes(p).includes('reasoning-duplicated-across-sources'));
 p.claims[2].paperId='P2';p.claims[2].reasoning.boundary='另一来源限定于独立的地点与年份，不沿用此前样本的比较条件。';
 assert.ok(!codes(p).includes('reasoning-duplicated-across-sources'));
});
test('indirect premises cannot hide unread or unanalysed sources from academic and brief gates',async t=>{
 const o=await project(t),p2={...structuredClone(paper),id:'P2',title:'A second synthetic source behind two inference steps',reading:{...paper.reading,status:'abstract-only'}};
 delete p2.analysis;
 const c2={...structuredClone(claim),id:'C2',paperId:'P2'};
 const reason={...claim.reasoning,alternatives:'另一组未观察到的输入条件也可能解释计数差异，当前测试不能排除这一解释。'};
 const bridge={...structuredClone(claim),id:'C3',kind:'inference',dependsOn:['C2'],reasoning:reason};
 const visible={...structuredClone(claim),kind:'inference',dependsOn:['C3'],reasoning:reason};
 await updateRecords({...o,expectedRevision:1,brief:{...brief,impactFactorMin:10},papers:[{...paper,impactFactor:{value:12,year:2025,source:'Synthetic fixture, not a real journal metric',verifiedAt:'2026-10-20'}},p2],claims:[visible,c2,bridge]});
 const result=await buildProject({...o,expectedRevision:2,mode:'review'});
 assert.equal(result.ok,false);assert.equal(result.status,'blocked');
 for(const code of ['full-text-required','impact-factor-source','reference-entry','analysis-missing'])assert.ok(result.issues.some(i=>i.code===code&&i.path==='papers.P2'),code);
 assert.ok(result.issues.some(i=>i.code==='claim-source-not-visible'&&i.message.includes('C2')));
 assert.ok(!JSON.parse(await readFile(o.projectPath,'utf8')).artifact);
});
test('template demonstration prose and assets cannot serve as research evidence',async()=>{
 const p=fixture(),demo=JSON.parse(await readFile(new URL('../skills/dsh-academic-ppt/references/templates/slide-records.json',import.meta.url),'utf8'));
 const prose=demo.slides.flatMap(s=>s.cards??[]).map(c=>c.body).find(text=>text?.length>60);
 assert.ok(prose);p.slides[0].cards[0].body=prose;p.assets[0].provenance='template-demo';
 assert.ok(codes(p).includes('template-text-reused'));assert.ok(codes(p).includes('template-as-evidence'));
});
test('reference panel headings must be authored for the current study',()=>{
 const p=fixture(),s=p.slides[0];s.layout='method';s.referenceTemplateId='method-model-coupling';delete s.panelTitles;
 assert.ok(evidenceIssues(p).some(i=>i.code==='panel-titles-required'));
 s.panelTitles=['当前研究的测量与模型接口'];
 assert.ok(!evidenceIssues(p).some(i=>i.code==='panel-titles-required'||i.code==='panel-title-count'));
});
test('hard requirements cannot be relaxed or erased by replacing the brief',async t=>{
 const o=await project(t),before=await readFile(o.projectPath);
 for(const next of [{...brief,requireFullText:false},{...brief,targetPaperCount:0},{...brief,requirePaperIntro:false}]){
  await assert.rejects(updateRecords({...o,expectedRevision:1,brief:next}),/REQUIREMENT_RELAXATION/);
  assert.deepEqual(await readFile(o.projectPath),before);
 }
 const increase={...brief,impactFactorMin:10};await updateRecords({...o,expectedRevision:1,brief:increase});
 await assert.rejects(updateRecords({...o,expectedRevision:2,brief}),/REQUIREMENT_RELAXATION/);
});
test('default project adds no arbitrary paper count or per-paper introduction rule',async t=>{
 const root=resolve('.test-output');await mkdir(root,{recursive:true});const cwd=await mkdtemp(join(root,'defaults-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 const out=await createProject({cwd,projectDir:'p',title:'An original research report'}),p=JSON.parse(await readFile(out.projectPath,'utf8'));
 assert.equal(p.brief.targetPaperCount,0);assert.equal(p.brief.qualityProfile,'academic');assert.notEqual(p.brief.requirePaperIntro,true);
 await assert.rejects(contextProject({cwd,projectPath:dirname(out.projectPath)}),/PROJECT_PATH_IS_DIRECTORY/);
});
test('record files have the same bounded typed transaction contract as inline records',async t=>{
 const o=await project(t),path=join(o.cwd,'batch.json');
 await writeFile(path,JSON.stringify({claims:[{...claim,text:'原样保留软件测试计数，验证记录文件路径。'}]}));
 const result=await updateRecords({...o,expectedRevision:1,recordsPath:path});assert.equal(result.revision,2);
 await assert.rejects(updateRecords({...o,expectedRevision:2,recordsPath:path,claims:[claim]}),/MIXED_RECORD_INPUT/);
 await writeFile(path,JSON.stringify({expectedRevision:0,claims:[claim]}));
 await assert.rejects(updateRecords({...o,expectedRevision:2,recordsPath:path}),/INVALID_RECORD_FILE/);
 await writeFile(path,JSON.stringify({claims:Array(21).fill(claim)}));
 await assert.rejects(updateRecords({...o,expectedRevision:2,recordsPath:path}),/INVALID_INPUT/);
 assert.equal(JSON.parse(await readFile(o.projectPath,'utf8')).revision,2);
});
test('slide-content removes optional layout fields explicitly and returns lossless JSON after commit',async t=>{
 const o=await project(t),out=await editProject({...o,expectedRevision:1,scope:'slide-content',changes:[{slideId:'s1',patch:{subtitle:'可移除的测试副标题'}}]});
 assert.deepEqual(out,JSON.parse(JSON.stringify(out)));assert.ok(!Object.hasOwn(out,'preservation'));
 await editProject({...o,expectedRevision:2,scope:'slide-content',changes:[{slideId:'s1',patch:{},removeFields:['subtitle']}]});
 assert.ok(!Object.hasOwn(JSON.parse(await readFile(o.projectPath,'utf8')).slides[0],'subtitle'));
 await assert.rejects(editProject({...o,expectedRevision:3,scope:'slide-content',changes:[{slideId:'s1',patch:{subtitle:'conflict'},removeFields:['subtitle']}]}),/CONFLICTING_SLIDE_PATCH/);
});
test('current review requires per-slide observations and cannot pass acknowledged defects',async t=>{
 const o=await project(t),built=await buildProject({...o,expectedRevision:1});assert.equal(built.ok,true);
 const request={...o,expectedRevision:1,pptxSha256:built.pptxSha256,reviewer:'human',basis:'html-preview',reviewedSlides:['s1'],result:'passed',notes:'Protocol fixture, not a real human review.'};
 await assert.rejects(recordReview(request),/PER_SLIDE_REVIEW_REQUIRED/);
 const observation=syntheticObservations(await checkProject(o),['s1'],'模拟记录：有一处未解决的文字遮挡。')[0];
 await assert.rejects(recordReview({...request,observations:[observation]}),/UNRESOLVED_REVIEW_ISSUES/);
 await recordReview({...request,result:'needs-fix',observations:[observation]});
 assert.equal((await checkProject(o)).verification.readyForDelivery,false);
});
