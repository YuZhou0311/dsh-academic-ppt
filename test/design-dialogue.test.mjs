import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {DESIGN_TOPICS,GUIDED_DESIGN_TOPICS,designDialoguePlan,designDialogueReport,componentStudyIssues} from '../src/design-dialogue.mjs';
import {createProject,updateRecords,buildProject,contextProject,planProject} from '../src/core.mjs';
import {assertToolArgs} from '../src/schema.mjs';
import {prepareDesign} from '../src/design-intake.mjs';
import {formatToolResult} from '../src/tools.mjs';
import {fixtureDesign,brief,paper,claim,asset,slides} from './fixtures.mjs';

const response=topic=>({topic,status:'confirmed',selected:`Synthetic ${topic} choice`,userResponse:`Synthetic user explicitly chose ${topic}.`});
const collaborative={mode:'collaborative',decisions:DESIGN_TOPICS.map(response)};
const source={status:'confirmed',mode:'content-led',userResponse:'Synthetic user explicitly chose the plugin original-design route.'};
const guidedCollaborative={mode:'collaborative',workflowVersion:2,source,decisions:GUIDED_DESIGN_TOPICS.map(response)};
const project=(consultation=collaborative,referenceStudy=fixtureDesign.referenceStudy)=>({design:{consultation,referenceStudy},slides:[{id:'s',cards:[]}]});
async function fixture(t){const base=resolve('.test-output');await mkdir(base,{recursive:true});const cwd=await mkdtemp(join(base,'dialogue-'));t.after(()=>rm(cwd,{recursive:true,force:true}));return cwd;}

// Original protocol descriptions, not observations of a real paid template or
// attestations of human/vision review. They exercise record coverage only.
const component=(patch={})=>({source:'user-template',referenceId:'Synthetic template / slide 3 / condition group',
  previewPath:'synthetic-template-slide-3.png',
  frame:'Software-test description: pale fill, thin solid outline, no dashed border and no shadow.',
  titleTreatment:'Software-test description: attached title strip aligned with the first body line.',
  spacing:'Software-test description: inner margin 24 px and 16 px between explanation rows.',
  adaptation:'Software-test plan: redraw the group beside the synthetic evidence panel; preserve all conditions.',...patch});
const detailedStudy=(components=[component()])=>({status:'reviewed',componentStudies:components,
  paletteRationale:'Software-test description: dark text on a neutral pale field; the muted accent distinguishes conditions without competing with the source figure.'});
const longProject=(study,{planned=6,actual=1,interaction='checkpoints'}={})=>{
  const value=project({...collaborative,interaction},study);
  value.slides=Array.from({length:actual},(_,i)=>({id:'synthetic-'+i,cards:[]}));
  if(planned)value.storyboard={pages:Array.from({length:planned},(_,i)=>({slideId:'synthetic-'+i}))};
  return value;
};

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

test('legacy whole-page records retain recipe validation and compatibility without forcing a card preset',()=>{
 const study={status:'reviewed',pageRecipeIds:['paired-comparison'],previewPaths:['synthetic-page-preview.png'],observations:'Synthetic review of shared scale, condition labels and paired evidence.',adaptations:['Adjust widths to the two actual evidence figures; retain common units.']};
 assert.equal(designDialogueReport(project(collaborative,study)).issues.filter(i=>i.severity==='error').length,0);
 study.pageRecipeIds=['made-up-page'];
 assert.ok(designDialogueReport(project(collaborative,study)).issues.some(i=>i.code==='page-reference-unknown-recipe'));
});

test('new whole-report planning cannot substitute page recipe names for component study, even before pilot slides exist',()=>{
  const pageOnly={status:'reviewed',pageRecipeIds:['paired-comparison'],previewPaths:['synthetic-page-preview.png'],
    observations:'Synthetic protocol description of paired evidence.',adaptations:['Keep the actual comparison scale.'],
    paletteRationale:'Synthetic dark text and pale surface retain the declared comparison color roles.'};
  for(const scope of [{planned:6,actual:0},{planned:6,actual:3},{planned:0,actual:6}]){
    const report=designDialogueReport(longProject(pageOnly,scope));
    assert.equal(report.referenceStudy.componentLearningRequired,true);
    assert.equal(report.summary.nativeCardCount,0);
    assert.ok(report.issues.some(issue=>issue.code==='component-reference-study-required'&&issue.severity==='error'));
  }
  const local=designDialogueReport(longProject(pageOnly,{planned:5,actual:1}));
  assert.equal(local.referenceStudy.componentLearningRequired,false);
  assert.equal(local.issues.filter(issue=>issue.severity==='error').length,0);
  assert.ok(local.issues.some(issue=>issue.code==='component-reference-legacy'&&issue.severity==='warning'));
});

test('specific template, card-library and editorial studies support native composition without adopting presets',()=>{
  const variants=[
    [component()],
    [component({referenceId:'Synthetic template slide 3 / outer frame'}),component({referenceId:'Synthetic template slide 3 / narrow title strip'})],
    [component({source:'card-library',referenceId:'research-tab',previewPath:'synthetic-research-tab.svg'})],
    [component({source:'editorial',referenceId:'C01',previewPath:'synthetic-C01.svg'}),component({source:'editorial',referenceId:'C20',previewPath:'synthetic-C20.svg'})],
  ];
  for(const studies of variants){
    const report=designDialogueReport(longProject(detailedStudy(studies)));
    assert.equal(report.issues.filter(issue=>issue.severity==='error').length,0,JSON.stringify(report.issues));
    assert.equal(report.referenceStudy.componentStudyCount,studies.length);
    assert.deepEqual(report.referenceStudy.usedPresets,[]);
    assert.equal(report.referenceStudy.paletteRationaleRecorded,true);
    assert.match(report.limits,/不独立验证/);
  }
  const usingPreset=longProject(detailedStudy([component({source:'card-library',referenceId:'research-tab'})]));
  usingPreset.design.referenceStudy.selectedPresets=['research-tab'];
  usingPreset.slides[0].cards=[{id:'synthetic-card',preset:'research-tab'}];
  assert.equal(designDialogueReport(usingPreset).issues.filter(issue=>issue.severity==='error').length,0,
    'A detailed study of the actual preset also supplies its inspected identity without a duplicate catalogIds entry.');
});

test('component identities, page locations, required detail fields and palette rationale remain inspectable',()=>{
  const cases=[
    [component({source:'card-library',referenceId:'made-up-card'}),'component-reference-unknown-card'],
    [component({source:'editorial',referenceId:'C21'}),'component-reference-unknown-editorial'],
    [component({source:'editorial',referenceId:'c01'}),'component-reference-unknown-editorial'],
    [component({referenceId:'Synthetic template condition group',previewPath:'synthetic-template.png'}),'component-reference-template-page-missing'],
    [component({referenceId:'Synthetic template condition group',previewPath:'synthetic-template.png',adaptation:'Software-test target: redraw this component on slide 4 of the new report.'}),'component-reference-template-page-missing'],
    [component({referenceId:'Synthetic template condition group',previewPath:'synthetic-template.png',frame:'Software-test prose mentions page 7, but neither source locator identifies it.'}),'component-reference-template-page-missing'],
    [component({frame:''}),'component-reference-study-incomplete'],
  ];
  for(const [record,code] of cases){
    const report=designDialogueReport(longProject(detailedStudy([record])));
    assert.ok(report.issues.some(issue=>issue.code===code&&issue.severity==='error'),code);
  }
  for(const referenceId of ['原始合成模板第7页条件框','Synthetic template / page 12 / heading','Synthetic template / p03 / margin']){
    assert.deepEqual(componentStudyIssues(detailedStudy([component({referenceId,previewPath:'synthetic-preview.png'})])),[]);
  }
  assert.deepEqual(componentStudyIssues(detailedStudy([component({referenceId:'Synthetic template condition group',previewPath:'synthetic-template/slide-003.png'})])),[]);
  const noPalette=detailedStudy();delete noPalette.paletteRationale;
  assert.ok(designDialogueReport(longProject(noPalette)).issues.some(issue=>issue.code==='reference-palette-rationale-missing'&&issue.severity==='error'));
  const args=study=>({projectPath:'synthetic-project.json',expectedRevision:0,design:{...fixtureDesign,referenceStudy:study}});
  assert.doesNotThrow(()=>assertToolArgs('academic_ppt_record',args(detailedStudy())));
  for(const field of ['source','referenceId','previewPath','frame','titleTreatment','spacing','adaptation']){
    const missing=detailedStudy();delete missing.componentStudies[0][field];
    assert.throws(()=>assertToolArgs('academic_ppt_record',args(missing)),/INVALID_INPUT/,field);
  }
  assert.throws(()=>assertToolArgs('academic_ppt_record',args(detailedStudy(Array.from({length:13},()=>component())))),/INVALID_INPUT/);
});

test('legacy detail omissions remain warnings and not-applicable cannot waive a complete new redesign',()=>{
  const legacy=designDialogueReport(longProject(fixtureDesign.referenceStudy,{planned:6,actual:6,interaction:'topics'}));
  assert.equal(legacy.issues.filter(issue=>issue.severity==='error').length,0);
  assert.ok(legacy.issues.some(issue=>issue.code==='component-reference-legacy'&&issue.severity==='warning'));
  assert.ok(legacy.issues.some(issue=>issue.code==='reference-palette-rationale-missing'&&issue.severity==='warning'));
  const old=longProject(undefined,{planned:0,actual:6});delete old.design.consultation;delete old.design.referenceStudy;
  assert.equal(designDialogueReport(old).issues.filter(issue=>issue.severity==='error').length,0);
  const exception={status:'not-applicable',reason:'Synthetic local revision only: adjust the source figure on page 1; no other layout or component is redesigned.'};
  assert.equal(designDialogueReport(longProject(exception,{planned:1,actual:1})).issues.filter(issue=>issue.severity==='error').length,0);
  const redesign=designDialogueReport(longProject(exception,{planned:6,actual:1}));
  assert.ok(redesign.issues.some(issue=>issue.code==='reference-study-exception-full-redesign'&&issue.severity==='error'));
});

test('new delegated create and record defaults enforce component learning for a short pilot of a longer report',async t=>{
  const cwd=await fixture(t),design={...structuredClone(fixtureDesign),
    consultation:{mode:'delegated',source,delegationTopics:[...GUIDED_DESIGN_TOPICS],delegation:'Synthetic software fixture explicitly delegates design choices; no real user decision is claimed.'},
    referenceStudy:{status:'reviewed',pageRecipeIds:['paired-comparison'],previewPaths:['synthetic-page-preview.png'],
      observations:'Synthetic whole-page protocol description.',adaptations:['Keep the comparison source identity.']}};
  const created=await createProject({cwd,projectDir:'planned-pilot',title:'Synthetic component-study workflow',brief,design});
  assert.equal(JSON.parse(await readFile(created.projectPath,'utf8')).design.consultation.interaction,'checkpoints');
  assert.equal(Object.hasOwn(design.consultation,'interaction'),false,'Initialization must not mutate the supplied design.');
  const args={cwd,projectPath:created.projectPath};
  await updateRecords({...args,expectedRevision:0,papers:[paper],claims:[claim],assets:[asset],slides});
  const storyboard={version:1,objective:'Synthetic longer-report planning gate',audienceTakeaway:'Only software behavior is tested.',
    throughline:'A short pilot retains the full planned report scope.',decision:{status:'delegated',userResponse:'Synthetic protocol delegation only.'},
    pages:[...slides,...['later-a','later-b','later-c'].map(id=>({...slides[0],id}))].map(slide=>({slideId:slide.id,title:slide.title,
      role:slide.layout==='references'?'references':'evidence',question:'What does this synthetic page establish?',claimIds:slide.claimIds,assetIds:slide.figureIds,
      warrant:'The deterministic fixture defines the expected content.',boundary:'This is not a real scientific or visual assessment.',
      transition:'Continue the synthetic workflow.',seconds:slide.seconds,layoutFamily:'custom',layoutReason:'Keep the original synthetic test geometry.'}))};
  const requestPath=join(cwd,'storyboard.json');await writeFile(requestPath,JSON.stringify({kind:'storyboard',storyboard}));
  await planProject({...args,expectedRevision:1,requestPath});
  const before=await buildProject({...args,expectedRevision:2,mode:'review'});
  assert.equal(before.ok,false);assert.ok(before.issues.some(issue=>issue.code==='component-reference-study-required'));
  const context=await contextProject({...args,stage:'design'});
  assert.equal(context.designDialogue.referenceStudy.componentLearningRequired,true);
  assert.match(context.nextActions.join(' '),/48.*20/);
  assert.match(context.nextActions.join(' '),/不用|是否采用/);
  await updateRecords({...args,expectedRevision:2,design});
  const preserved=await buildProject({...args,expectedRevision:3,mode:'review'});
  assert.equal(preserved.ok,false);assert.ok(preserved.issues.some(issue=>issue.code==='component-reference-study-required'));
  assert.equal(JSON.parse(await readFile(created.projectPath,'utf8')).design.consultation.interaction,'checkpoints',
    'A normal delegated consultation update must retain the authoring mode and its full-report learning gate.');
  await updateRecords({...args,expectedRevision:3,design:{...design,referenceStudy:detailedStudy()}});
  const after=await buildProject({...args,expectedRevision:4,mode:'review'});
  assert.equal(after.ok,true,JSON.stringify(after.issues));
  assert.equal((await contextProject({...args,stage:'design'})).designDialogue.referenceStudy.componentStudyCount,1);
});

test('explicit topics survive create and record while loading and updating a serialized legacy record never adds interaction',async t=>{
  const cwd=await fixture(t);
  for(const legacy of [false,true]){
    const design={...structuredClone(fixtureDesign),consultation:{mode:'collaborative',interaction:'topics'}};
    const created=await createProject({cwd,projectDir:legacy?'legacy':'topics',title:'Synthetic interaction compatibility fixture',brief,design});
    const initial=JSON.parse(await readFile(created.projectPath,'utf8'));
    assert.equal(initial.design.consultation.interaction,'topics');
    if(legacy){
      // Model a serialized older project. This is a software fixture, not an
      // instruction to rewrite production projects or waive a new-deck gate.
      delete initial.design.consultation.interaction;
      delete initial.design.consultation.workflowVersion;
      await writeFile(created.projectPath,JSON.stringify(initial));
    }
    const bytes=await readFile(created.projectPath);
    const context=await contextProject({cwd,projectPath:created.projectPath,stage:'design'});
    assert.deepEqual(context.designDialogue.questions.map(question=>question.topic),legacy?['density','storyline']:['source']);
    assert.deepEqual(await readFile(created.projectPath),bytes,'Read-only context must not upgrade a legacy file.');
    const consultation={mode:'delegated',delegation:'Software-test-only delegation preserves the serialized interaction mode.'};
    const recordsPath=join(cwd,legacy?'legacy-update.json':'topics-update.json');
    await writeFile(recordsPath,JSON.stringify({design:{...design,consultation}}));
    await updateRecords({cwd,projectPath:created.projectPath,expectedRevision:0,recordsPath});
    const saved=JSON.parse(await readFile(created.projectPath,'utf8'));
    assert.deepEqual(saved.design.consultation,legacy?consultation:{...consultation,interaction:'topics',workflowVersion:2});
  }
});

test('checkpoint dialogue combines whole-direction choices and retains explicit older topic interaction',()=>{
 const first=designDialoguePlan({mode:'collaborative',interaction:'checkpoints'});
 assert.equal(first.questions.length,1);assert.equal(first.stage,'story');
 assert.deepEqual(first.questions[0].topics,['density','storyline','language']);
 const second=designDialoguePlan({mode:'collaborative',interaction:'checkpoints',decisions:['density','storyline','language'].map(response)});
 assert.equal(second.questions.length,1);assert.equal(second.stage,'pilot-direction');
 assert.deepEqual(second.questions[0].topics,['palette','shape','texture','cover']);
 assert.equal(designDialoguePlan({mode:'collaborative',interaction:'topics'}).questions.length,2);
});

test('prepare defaults to dialogue and waits for design choices before proposing an imagegen call',async t=>{
  const cwd=await fixture(t),requestPath=join(cwd,'request.json');
  const request={topic:'Synthetic study of observation uncertainty',template:{status:'none'},imageGeneration:{availability:'available',source:'Synthetic host capabilities only.',toolName:'synthetic_image_tool'},cards:[{id:'q',purpose:'Question',title:'Synthetic comparison',body:'No scientific facts in this fixture.',evidenceStatus:'illustrative'}]};
  await writeFile(requestPath,JSON.stringify(request));
  const first=await prepareDesign({cwd,requestPath});
  assert.equal(first.nextAction,'ask-design-questions');assert.equal(first.imageGeneration.prompt,undefined);
  assert.equal(first.imageGeneration.nextAction,'await-design-feedback');
  assert.equal(first.designRecords.consultation.mode,'collaborative');
  assert.equal(first.designRecords.consultation.interaction,'checkpoints');
  const rendered=formatToolResult('academic_ppt_prepare',first);assert.match(rendered,/design_source/);assert.match(rendered,/未回复不是默认同意/);
  await writeFile(requestPath,JSON.stringify({...request,consultation:guidedCollaborative}));
  const next=await prepareDesign({cwd,requestPath});assert.equal(next.nextAction,'invoke-host-imagegen');assert.ok(next.imageGeneration.prompt.includes(request.cards[0].body));
});

test('initial density can follow an actual answer before building; omitted dialogue fields are retained',async t=>{
  const cwd=await fixture(t),created=await createProject({cwd,projectDir:'talk',title:'Synthetic dialogue workflow'});
  const before=JSON.parse(await readFile(created.projectPath,'utf8'));
  assert.equal(before.design.consultation.mode,'collaborative');
  assert.equal(before.design.consultation.interaction,'checkpoints');
  const consultation={mode:'collaborative',decisions:[response('density')]};
  await updateRecords({cwd,projectPath:created.projectPath,expectedRevision:0,design:{...fixtureDesign,density:'balanced',consultation}});
  const changed={...fixtureDesign};delete changed.consultation;delete changed.referenceStudy;
  await updateRecords({cwd,projectPath:created.projectPath,expectedRevision:1,design:changed});
  const after=JSON.parse(await readFile(created.projectPath,'utf8'));
  assert.deepEqual(after.design.consultation,{...consultation,interaction:'checkpoints',workflowVersion:2});assert.equal(after.design.density,'balanced');
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
  assert.equal(context.designDialogue.questions.length,1);
  assert.deepEqual(context.designDialogue.questions[0].topics,['source']);
  await updateRecords({...args,design:{...design,consultation:guidedCollaborative}});
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
  assert.deepEqual(state.design.consultation,{...consultation,interaction:'checkpoints',workflowVersion:2});
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
  const request={topic:'Synthetic image reference',template:{status:'none'},consultation:structuredClone(guidedCollaborative),imageGeneration:{availability:'available',source:'Synthetic host interface.',toolName:'synthetic_image_tool'},cards:[{id:'card',purpose:'Compare source images',title:'Synthetic comparison',body:'No research result.',evidenceStatus:'illustrative'}]};
  const choices={palette:'墨绿与暖灰',shape:'温和圆润',language:'解释型学术',texture:'浅底分组'};
  for(const decision of request.consultation.decisions){decision.userResponse='RAW_REPLY_SHOULD_NOT_BE_SENT';if(choices[decision.topic])decision.selected=choices[decision.topic];}
  await writeFile(requestPath,JSON.stringify(request));const first=await prepareDesign({cwd,requestPath});
  for(const choice of Object.values(choices))assert.ok(first.imageGeneration.prompt.includes(choice));
  assert.ok(!first.imageGeneration.prompt.includes('RAW_REPLY_SHOULD_NOT_BE_SENT'));
  assert.match(formatToolResult('academic_ppt_prepare',first),/已采纳设计选择/);
  request.consultation.decisions.find(d=>d.topic==='palette').selected='深蓝与石墨';
  request.consultation.mode='delegated';request.consultation.delegation='Synthetic user delegates all undecided details.';request.consultation.delegationTopics=['shape'];
  request.consultation.decisions.find(d=>d.topic==='shape').status='proposed';
  await writeFile(requestPath,JSON.stringify(request));const second=await prepareDesign({cwd,requestPath});
  assert.notEqual(first.imageGeneration.prompt,second.imageGeneration.prompt);
  assert.ok(second.imageGeneration.prompt.includes('深蓝与石墨'));assert.ok(!second.imageGeneration.prompt.includes('温和圆润'));
  assert.ok(!second.designAdaptation.resolvedPreferences.some(p=>p.topic==='shape'));
  assert.equal(second.designAdaptation.colorPolicy.mode,'adaptive','free text never guesses a fixed color mode or HEX values');
  request.consultation.decisions[6]=response('palette');await writeFile(requestPath,JSON.stringify(request));
  await assert.rejects(prepareDesign({cwd,requestPath}),/one current decision/);
});
