import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {DESIGN_TOPICS,designDialoguePlan,designDialogueReport} from '../src/design-dialogue.mjs';
import {createProject,updateRecords,buildProject,contextProject} from '../src/core.mjs';
import {prepareDesign} from '../src/design-intake.mjs';
import {formatToolResult} from '../src/tools.mjs';
import {fixtureDesign,brief,paper,claim,asset,slides} from './fixtures.mjs';

const response=topic=>({topic,status:'confirmed',selected:`Synthetic ${topic} choice`,userResponse:`Synthetic user explicitly chose ${topic}.`});
const collaborative={mode:'collaborative',decisions:DESIGN_TOPICS.map(response)};
const project=(consultation=collaborative,referenceStudy=fixtureDesign.referenceStudy)=>({design:{consultation,referenceStudy},slides:[{id:'s',cards:[]}]});
async function fixture(t){const base=resolve('.test-output');await mkdir(base,{recursive:true});const cwd=await mkdtemp(join(base,'dialogue-'));t.after(()=>rm(cwd,{recursive:true,force:true}));return cwd;}

test('a new dialogue offers only the next related questions and preserves earlier responses',()=>{
  const first=designDialoguePlan();
  assert.deepEqual(first.questions.map(q=>q.topic),['density','storyline']);
  assert.equal(first.readyForFinalDesign,false);
  const next=designDialoguePlan({mode:'collaborative',decisions:[response('density'),response('storyline'),response('palette')]});
  assert.deepEqual(next.questions.map(q=>q.topic),['shape']);
  assert.ok(!next.pendingTopics.includes('palette'));
  assert.deepEqual(designDialoguePlan(collaborative).questions,[]);
  assert.match(first.basis,/not-independent-user-confirmation/);
});

test('proposals, missing responses and duplicate answers do not pass as user confirmation',()=>{
  const decisions=DESIGN_TOPICS.map(response);decisions[2]={topic:'palette',status:'proposed',selected:'Synthetic preferred blue'};
  const report=designDialogueReport(project({mode:'collaborative',decisions}));
  assert.ok(report.issues.some(i=>i.code==='design-dialogue-pending'&&i.pendingTopics.includes('palette')));
  decisions[2]={topic:'palette',status:'confirmed',selected:'Synthetic preferred blue'};
  assert.ok(designDialogueReport(project({mode:'collaborative',decisions})).issues.some(i=>i.code==='design-response-record-incomplete'));
  assert.ok(designDialogueReport(project({mode:'collaborative',decisions:[...collaborative.decisions,response('palette')]})).issues.some(i=>i.code==='design-dialogue-duplicate-topic'));
});

test('explicit delegation skips repeated questions but needs its real basis',()=>{
  const delegated={mode:'delegated',delegation:'Synthetic user: please choose the presentation design for me.'};
  assert.equal(designDialogueReport(project(delegated)).readyForFinalDesign,true);
  assert.ok(designDialogueReport(project({mode:'delegated'})).issues.some(i=>i.code==='design-delegation-missing'));
  const legacy=designDialogueReport({design:{},slides:[{id:'old',cards:[]}]});
  assert.equal(legacy.mode,'legacy');assert.equal(legacy.issues.filter(i=>i.severity==='error').length,0);
});

test('reference learning needs real candidate identities and observations, while native adaptation stays possible',()=>{
  const missing=project();delete missing.design.referenceStudy;
  assert.ok(designDialogueReport(missing).issues.some(i=>i.code==='card-reference-study-required'));
  const study={status:'reviewed',catalogIds:['figure-caption'],previewPaths:['synthetic-figure-caption.svg'],observations:'Synthetic description of the inspected figure and caption slots.',selectedPresets:['figure-caption'],adaptations:['Synthetic custom drawing preserves the grouped image and caption relation.']};
  const adapted=designDialogueReport(project(collaborative,study));
  assert.equal(adapted.issues.filter(i=>i.severity==='error').length,0);
  assert.ok(adapted.issues.some(i=>i.code==='card-reference-adaptation-review'&&i.severity==='warning'));
  const wrong=structuredClone(study);wrong.selectedPresets=['made-up-card'];
  assert.ok(designDialogueReport(project(collaborative,wrong)).issues.some(i=>i.code==='card-reference-unknown-preset'));
  const conflict=project(collaborative,{status:'not-applicable',reason:'Synthetic report uses only open full-width figures without independent card groups.'});
  conflict.slides[0].cards=[{id:'card',preset:'figure-caption',figureIds:['A1']}];
  assert.ok(designDialogueReport(conflict).issues.some(i=>i.code==='card-reference-exception-conflict'));
  const actual=project(collaborative,study);actual.slides[0].cards=conflict.slides[0].cards;
  const used=designDialogueReport(actual);assert.equal(used.summary.imageCardCount,1);assert.deepEqual(used.referenceStudy.imagePresetIds,['figure-caption']);
  assert.ok(!used.issues.some(i=>i.code==='card-reference-adaptation-review'));
  const unreviewed=structuredClone(actual);unreviewed.design.referenceStudy.selectedPresets=[];
  unreviewed.design.referenceStudy.catalogIds=['research-tab'];
  assert.ok(designDialogueReport(unreviewed).issues.some(i=>i.code==='card-reference-used-unreviewed'&&i.presetIds.includes('figure-caption')));
  unreviewed.design.referenceStudy.catalogIds.push('figure-caption');
  assert.equal(designDialogueReport(unreviewed).issues.filter(i=>i.severity==='error').length,0);
});

test('prepare defaults to dialogue and waits for design choices before proposing an imagegen call',async t=>{
  const cwd=await fixture(t),requestPath=join(cwd,'request.json');
  const request={topic:'Synthetic study of observation uncertainty',template:{status:'none'},imageGeneration:{availability:'available',source:'Synthetic host capabilities only.',toolName:'synthetic_image_tool'},cards:[{id:'q',purpose:'Question',title:'Synthetic comparison',body:'No scientific facts in this fixture.',evidenceStatus:'illustrative'}]};
  await writeFile(requestPath,JSON.stringify(request));
  const first=await prepareDesign({cwd,requestPath});
  assert.equal(first.nextAction,'ask-design-questions');assert.equal(first.imageGeneration.prompt,undefined);
  assert.equal(first.imageGeneration.nextAction,'await-design-feedback');
  assert.equal(first.designRecords.consultation.mode,'collaborative');
  const rendered=formatToolResult('academic_ppt_prepare',first);assert.match(rendered,/design_density/);assert.match(rendered,/不代表已经问过/);
  await writeFile(requestPath,JSON.stringify({...request,consultation:collaborative}));
  const next=await prepareDesign({cwd,requestPath});assert.equal(next.nextAction,'invoke-host-imagegen');assert.ok(next.imageGeneration.prompt.includes(request.cards[0].body));
});

test('initial density can follow an actual answer before building; omitted dialogue fields are retained',async t=>{
  const cwd=await fixture(t),created=await createProject({cwd,projectDir:'talk',title:'Synthetic dialogue workflow'});
  const before=JSON.parse(await readFile(created.projectPath,'utf8'));
  assert.equal(before.design.consultation.mode,'collaborative');
  const consultation={mode:'collaborative',decisions:[response('density')]};
  await updateRecords({cwd,projectPath:created.projectPath,expectedRevision:0,design:{...fixtureDesign,density:'balanced',consultation}});
  const changed={...fixtureDesign};delete changed.consultation;delete changed.referenceStudy;
  await updateRecords({cwd,projectPath:created.projectPath,expectedRevision:1,design:changed});
  const after=JSON.parse(await readFile(created.projectPath,'utf8'));
  assert.deepEqual(after.design.consultation,consultation);assert.equal(after.design.density,'balanced');
  assert.deepEqual(after.design.referenceStudy,fixtureDesign.referenceStudy);
  const unconfirmed=await createProject({cwd,projectDir:'unconfirmed',title:'Synthetic unconfirmed choice'});
  await assert.rejects(updateRecords({cwd,projectPath:unconfirmed.projectPath,expectedRevision:0,design:{...fixtureDesign,density:'balanced',consultation:{mode:'collaborative',decisions:[{topic:'density',status:'proposed',selected:'Less dense'}]}}}),/DENSITY_REQUIREMENT_RELAXATION/);
});

test('unanswered design topics block review construction while a labelled draft remains recoverable',async t=>{
  const cwd=await fixture(t),design={...structuredClone(fixtureDesign),consultation:{mode:'collaborative'}};
  const created=await createProject({cwd,projectDir:'talk',title:'Synthetic collaborative report',brief,design});
  await updateRecords({cwd,projectPath:created.projectPath,expectedRevision:0,papers:[paper],claims:[claim],assets:[asset],slides});
  const args={cwd,projectPath:created.projectPath,expectedRevision:1};
  const review=await buildProject({...args,mode:'review'});assert.equal(review.ok,false);
  assert.ok(review.issues.some(i=>i.code==='design-dialogue-pending'));
  const draft=await buildProject({...args,mode:'draft'});assert.equal(draft.ok,true);assert.equal(draft.status,'draft');
  const context=await contextProject({cwd,projectPath:created.projectPath});assert.equal(context.designDialogue.readyForFinalDesign,false);
  assert.deepEqual(context.designDialogue.questions.map(q=>q.topic),['density','storyline']);
  await updateRecords({...args,design:{...design,consultation:collaborative}});
  const final=await buildProject({...args,expectedRevision:2,mode:'review'});assert.equal(final.ok,true,JSON.stringify(final.issues));
});

test('a provisional density survives drafts and separately recorded answers until its first actual choice',async t=>{
  const cwd=await fixture(t),design={...structuredClone(fixtureDesign),density:'compact',consultation:{mode:'collaborative'}};
  const created=await createProject({cwd,projectDir:'draft-first',title:'Synthetic staged density',brief,design});
  const args={cwd,projectPath:created.projectPath};
  await updateRecords({...args,expectedRevision:0,papers:[paper],claims:[claim],assets:[asset],slides});
  assert.equal((await buildProject({...args,expectedRevision:1,mode:'draft'})).ok,true);
  const consultation={mode:'collaborative',decisions:[response('density')]};
  await updateRecords({...args,expectedRevision:1,design:{...design,consultation}});
  const chosen={...design,density:'balanced'};delete chosen.consultation;
  await updateRecords({...args,expectedRevision:2,design:chosen});
  const state=JSON.parse(await readFile(created.projectPath,'utf8'));
  assert.equal(state.design.density,'balanced');assert.equal(state.densityChoicePending,false);
  assert.deepEqual(state.design.consultation,consultation);
  await updateRecords({...args,expectedRevision:3,design:{...chosen,density:'compact'}});
  await assert.rejects(updateRecords({...args,expectedRevision:4,design:chosen}),/DENSITY_REQUIREMENT_RELAXATION/);
});

test('delegated initial design can choose density, while explicit density and review builds settle it',async t=>{
  const cwd=await fixture(t),design=structuredClone(fixtureDesign);delete design.density;
  const delegated=await createProject({cwd,projectDir:'delegated',title:'Synthetic delegated initial density',brief,design});
  await updateRecords({cwd,projectPath:delegated.projectPath,expectedRevision:0,design:{...design,density:'balanced'}});
  const explicit=await createProject({cwd,projectDir:'explicit',title:'Synthetic established density',brief,design:{...design,density:'compact'}});
  await assert.rejects(updateRecords({cwd,projectPath:explicit.projectPath,expectedRevision:0,design:{...design,density:'balanced'}}),/DENSITY_REQUIREMENT_RELAXATION/);
  const finalized=await createProject({cwd,projectDir:'reviewed',title:'Synthetic density finalization',brief:{...brief,targetPaperCount:0,requirePaperIntro:false},design});
  const args={cwd,projectPath:finalized.projectPath};
  await updateRecords({...args,expectedRevision:0,slides:[{id:'cover',layout:'cover',title:'Synthetic protocol cover',paperIds:[],claimIds:[],figureIds:[],cards:[],notes:'Synthetic state fixture only.',seconds:120}]});
  const result=await buildProject({...args,expectedRevision:1,mode:'review'});assert.equal(result.ok,true,JSON.stringify(result.issues));
  assert.equal(JSON.parse(await readFile(finalized.projectPath,'utf8')).densityChoicePending,false);
  await assert.rejects(updateRecords({...args,expectedRevision:1,design:{...design,density:'balanced'}}),/DENSITY_REQUIREMENT_RELAXATION/);
});

test('confirmed preferences shape generated references without copying raw replies or treating proposals as choices',async t=>{
  const cwd=await fixture(t),requestPath=join(cwd,'preferences.json');
  const request={topic:'Synthetic image reference',template:{status:'none'},consultation:structuredClone(collaborative),imageGeneration:{availability:'available',source:'Synthetic host interface.',toolName:'synthetic_image_tool'},cards:[{id:'card',purpose:'Compare source images',title:'Synthetic comparison',body:'No research result.',evidenceStatus:'illustrative'}]};
  const choices={palette:'墨绿与暖灰',shape:'温和圆润',language:'解释型学术',texture:'浅底分组'};
  for(const decision of request.consultation.decisions){decision.userResponse='RAW_REPLY_SHOULD_NOT_BE_SENT';if(choices[decision.topic])decision.selected=choices[decision.topic];}
  await writeFile(requestPath,JSON.stringify(request));const first=await prepareDesign({cwd,requestPath});
  for(const choice of Object.values(choices))assert.ok(first.imageGeneration.prompt.includes(choice));
  assert.ok(!first.imageGeneration.prompt.includes('RAW_REPLY_SHOULD_NOT_BE_SENT'));
  assert.match(formatToolResult('academic_ppt_prepare',first),/已采纳设计选择/);
  request.consultation.decisions.find(d=>d.topic==='palette').selected='深蓝与石墨';
  request.consultation.mode='delegated';request.consultation.delegation='Synthetic user delegates all undecided details.';
  request.consultation.decisions.find(d=>d.topic==='shape').status='proposed';
  await writeFile(requestPath,JSON.stringify(request));const second=await prepareDesign({cwd,requestPath});
  assert.notEqual(first.imageGeneration.prompt,second.imageGeneration.prompt);
  assert.ok(second.imageGeneration.prompt.includes('深蓝与石墨'));assert.ok(!second.imageGeneration.prompt.includes('温和圆润'));
  assert.ok(!second.designAdaptation.resolvedPreferences.some(p=>p.topic==='shape'));
  assert.equal(second.designAdaptation.colorPolicy.mode,'adaptive','free text never guesses a fixed color mode or HEX values');
  request.consultation.decisions[6]=response('palette');await writeFile(requestPath,JSON.stringify(request));
  await assert.rejects(prepareDesign({cwd,requestPath}),/one current decision/);
});
