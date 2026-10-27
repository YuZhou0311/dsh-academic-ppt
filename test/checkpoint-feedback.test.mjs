// Public-tool workflow regressions. All decisions/reviews are explicitly
// synthetic software-state fixtures, never an attestation of real visual QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {buildAcademicTools} from '../src/tools.mjs';

const LABEL='Synthetic software-state fixture; no real user approval or visual judgment is asserted.';
const TOPICS=['density','storyline','palette','shape','language','texture','cover'];
const response=topic=>({topic,status:'confirmed',selected:'Fixture selection for '+topic,
  userResponse:LABEL+' Response for '+topic,referencePaths:['synthetic-'+topic+'.png']});
const storyConsultation={mode:'collaborative',interaction:'checkpoints',decisions:['density','storyline','language'].map(response)};
const allConsultation={...storyConsultation,decisions:TOPICS.map(response)};

async function workspace(t){
  const root=resolve('.test-output');await mkdir(root,{recursive:true});
  const cwd=await mkdtemp(join(root,'checkpoint-feedback-'));
  t.after(()=>rm(cwd,{recursive:true,force:true}));
  const tools=new Map(buildAcademicTools().map(tool=>[tool.name,tool]));
  const exec={agent:{session:{header:{cwd}}}};
  const invoke=async(name,args)=>tools.get('academic_ppt_'+name).execute(args,exec);
  const visible=(name,result)=>tools.get('academic_ppt_'+name).output.render({},result).map(item=>item.text||'').join('\n');
  const json=async(name,value)=>{const path=join(cwd,name);await writeFile(path,JSON.stringify(value));return path;};
  return {cwd,invoke,visible,json};
}

async function fixture(t){
  const env=await workspace(t),{invoke,json}=env;
  const contract=await invoke('contract',{topic:'design'});
  const design={fontFamily:'DejaVu Sans',palette:contract.academicPalettes[0].palette,consultation:structuredClone(storyConsultation),
    referenceStudy:{status:'not-applicable',reason:LABEL+' The fixture contains only administrative title and section pages, no information cards.'}};
  const initialized=await invoke('init',{projectDir:'project',title:'Checkpoint lifecycle protocol',
    brief:{centralQuestion:'How do explicit recorded responses affect unchanged artifact verification?',audience:'Software auditors',talkMinutes:2.5,targetPaperCount:0,requireFullText:false,genre:'proposal'},
    capabilities:{imageInput:'unknown',source:LABEL}});
  let revision=0;const projectPath=initialized.projectPath;
  const slides=['cover','section','section'].map((layout,index)=>({id:'p'+(index+1),layout,
    title:['Protocol fixture','Decision state fixture','Review state fixture'][index],
    paperIds:[],claimIds:[],figureIds:[],cards:[],notes:LABEL,seconds:50}));
  const record=async payload=>{const result=await invoke('record',{projectPath,expectedRevision:revision,recordsPath:await json('records-'+revision+'.json',payload)});revision=result.revision;return result;};
  const plan=async request=>{const result=await invoke('plan',{projectPath,expectedRevision:revision,requestPath:await json('request-'+revision+'.json',request)});revision=result.revision;return result;};
  await record({design,slides});
  const storyboard={version:1,objective:'Probe unchanged artifact state across explicit answers',audienceTakeaway:LABEL,
    throughline:'A prepared page receives a recorded answer before pilot approval.',decision:{status:'proposed'},
    pilot:{coverSlideId:'p1',hardestSlideId:'p2',sequenceSlideIds:['p1','p2','p3'],reason:LABEL+' Lifecycle-only synthetic selection.'},
    pages:slides.map((slide,index)=>({slideId:slide.id,title:slide.title,role:index===1?'design':'orientation',question:'Which software state is exercised?',
      claimIds:[],assetIds:[],warrant:LABEL,boundary:LABEL,transition:index<2?'Continue to the next protocol step.':'',seconds:50,layoutFamily:'custom',layoutReason:LABEL}))};
  await plan({kind:'storyboard',storyboard});
  const build=()=>invoke('build',{projectPath,expectedRevision:revision,mode:'draft'});
  const check=()=>invoke('check',{projectPath});
  const state=async()=>JSON.parse(await readFile(projectPath,'utf8'));
  const pilot=()=>plan({kind:'pilot-review',decision:'confirmed',userResponse:LABEL+' Pilot direction response.',notes:LABEL});
  const review=(built,result='passed',reviewer='human')=>invoke('review',{projectPath,expectedRevision:revision,pptxSha256:built.pptxSha256,reviewer,basis:'pptx-render',
    reviewedSlides:slides.map(slide=>slide.id),result,notes:LABEL,
    observations:slides.map(slide=>({slideId:slide.id,contentCheck:LABEL,legibilityCheck:LABEL,issue:result==='passed'?'':'Synthetic unresolved issue; not an actual visual defect.'}))});
  const render=async()=>{
    const previous=process.env.TMPDIR;const tmp=join(env.cwd,'renderer-tmp');await mkdir(tmp,{recursive:true});process.env.TMPDIR=tmp;
    try{
      const result=await invoke('render',{projectPath,expectedRevision:revision});
      if(process.env.DSH_REQUIRE_REAL_RENDER==='1')assert.notEqual(result.status,'unavailable',result.message);
      if(result.status==='unavailable'){t.skip('Optional real renderer unavailable: '+result.message);return null;}
      assert.equal(result.status,'rendered');assert.deepEqual(result.missingFonts,[]);return result;
    }finally{if(previous===undefined)delete process.env.TMPDIR;else process.env.TMPDIR=previous;}
  };
  return {...env,projectPath,design,storyboard,record,plan,build,check,state,pilot,review,render,get revision(){return revision;}};
}

test('checkpoint B exposes candidate prompts before visual preferences, without inventing answers',async t=>{
  const {invoke,visible,json}=await workspace(t);
  const request={topic:'Synthetic candidate ordering',template:{status:'none'},consultation:storyConsultation,
    imageGeneration:{availability:'available',source:LABEL,toolName:'synthetic_not_invoked_imagegen'},
    cards:[{id:'candidate',purpose:'Check response ordering',title:'Protocol card',body:LABEL,evidenceStatus:'illustrative'}]};
  const prepare=async value=>invoke('prepare',{requestPath:await json('prepare.json',value)});
  const current=await prepare(request);
  assert.equal(current.designDialogue.stage,'pilot-direction');
  assert.equal(current.designDialogue.questionTiming,'after-actual-pilot-render');
  assert.equal(current.nextAction,'invoke-host-imagegen');
  assert.ok(current.imageGeneration.batches[0].prompt.includes(request.cards[0].body));
  assert.deepEqual(current.designRecords.consultation,storyConsultation,'Planning a candidate must not create any visual approval.');
  assert.deepEqual(current.designDialogue.pendingTopics,['palette','shape','texture','cover']);
  assert.match(visible('prepare',current),/展示真实样张后再提问/);
  assert.doesNotMatch(visible('prepare',current),/本轮待提问/);
  const legacy=await prepare({...request,consultation:{...storyConsultation,interaction:'topics'}});
  assert.equal(legacy.imageGeneration.nextAction,'await-design-feedback');assert.equal(legacy.imageGeneration.prompt,undefined);
  const unavailable=await prepare({...request,imageGeneration:{availability:'unavailable',source:LABEL}});
  assert.equal(unavailable.imageGeneration.nextAction,'select-native-cards');
  assert.deepEqual(unavailable.designRecords.consultation,storyConsultation);
});

test('recording explicit responses preserves the same real pilot artifact and existing review results only',async t=>{
  const env=await fixture(t),built=await env.build();if(!await env.render())return;
  await assert.rejects(env.review(built,'passed','vision-model'),/VISION_UNVERIFIED/);
  await env.review(built);
  await assert.rejects(env.pilot(),/PILOT_HAS_ERRORS[\s\S]*academic_ppt_record/);
  const before=await env.state();
  assert.equal(before.design.consultation.decisions.length,3,'pilot-review cannot auto-confirm the missing design topics.');
  const recorded=await env.record({design:{...env.design,consultation:structuredClone(allConsultation)}});
  assert.equal(recorded.preservedVerification.pptxSha256,built.pptxSha256);
  const after=await env.state();
  assert.deepEqual(after.artifact.files,before.artifact.files);
  assert.deepEqual(after.artifact.render,before.artifact.render);
  assert.equal(after.artifact.revision,before.artifact.revision,'Do not claim the old bytes were newly built.');
  assert.deepEqual(after.visualReviews,before.visualReviews,'Do not claim the unchanged pages were viewed again.');
  const checked=await env.check();
  assert.equal(checked.artifact.current,true);assert.equal(checked.verification.pptxRender,'rendered');
  assert.equal(checked.verification.visual,'reported-passed');
  assert.equal((await env.pilot()).storyboard.pilot.status,'reviewed');

  const storyDecision={...env.storyboard,decision:{status:'confirmed',userResponse:LABEL+' Explicit storyline response.',rationale:LABEL+' Explicit storyline rationale.'}};
  const storyUpdate=await env.plan({kind:'storyboard',storyboard:storyDecision});
  assert.equal(storyUpdate.preservedVerification.pptxSha256,built.pptxSha256);
  assert.equal((await env.check()).storyboard.pilot.status,'reviewed');
  const restored=await env.invoke('context',{projectPath:env.projectPath});
  assert.deepEqual(restored.designDialogue.recordedDecisions,allConsultation.decisions);
  assert.deepEqual(restored.storyboard.decision,storyDecision.decision);
  const visible=env.visible('context',restored);assert.match(visible,/Fixture selection for palette/);assert.match(visible,/Response for cover/);assert.match(visible,/synthetic-cover.png/);
  assert.match(visible,/Explicit storyline response/);assert.match(visible,/Explicit storyline rationale/);

  await env.review(built,'needs-fix');
  const withRationale={...allConsultation,decisions:allConsultation.decisions.map(item=>({...item,rationale:LABEL+' Recorded context only.'}))};
  await env.record({design:{...env.design,consultation:withRationale}});
  assert.equal((await env.check()).verification.visual,'not-verified');
  assert.ok((await env.check()).delivery.blockers.some(blocker=>blocker.code==='unresolved-visual-issues'));
  await assert.rejects(env.pilot(),/PILOT_REVIEW_REQUIRED/);
  await assert.rejects(env.review(built,'passed','vision-model'),/VISION_UNVERIFIED/);
});

test('decision metadata never preserves a changed design, evidence context, capability, interaction, reference study or storyboard page',async t=>{
  for(const kind of ['palette','brief','capability','interaction','reference-study','storyboard-page'])await t.test(kind,async t=>{
    const env=await fixture(t);await env.build();
    const design={...env.design,consultation:structuredClone(allConsultation)};
    let updated;
    if(kind==='palette')updated=await env.record({design:{...design,palette:{...design.palette,accent:'#245879'}}});
    else if(kind==='brief')updated=await env.record({design,brief:{...(await env.state()).brief,centralQuestion:'An actually different scientific question invalidates the previous artifact.'}});
    else if(kind==='capability')updated=await env.record({design,capabilities:{imageInput:'supported',source:LABEL+' Synthetic capability transition only.'}});
    else if(kind==='interaction')updated=await env.record({design:{...design,consultation:{...design.consultation,interaction:'topics'}}});
    else if(kind==='reference-study')updated=await env.record({design:{...design,referenceStudy:{...design.referenceStudy,reason:design.referenceStudy.reason+' Newly recorded study.'}}});
    else updated=await env.plan({kind:'storyboard',storyboard:{...env.storyboard,decision:{status:'confirmed',userResponse:LABEL},pages:env.storyboard.pages.map((page,index)=>index===1?{...page,boundary:LABEL+' Changed scientific boundary.'}:page)}});
    assert.equal(updated.preservedVerification,undefined);
    assert.equal((await env.check()).artifact.current,false);
    assert.equal((await env.state()).artifact,undefined);
  });
});

test('unchanged response recording cannot legitimize externally modified artifact bytes',async t=>{
  const env=await fixture(t),built=await env.build();
  await appendFile(built.files.pptx,'Synthetic corruption fixture');
  const result=await env.record({design:{...env.design,consultation:structuredClone(allConsultation)}});
  assert.equal(result.preservedVerification,undefined);
  assert.equal((await env.check()).artifact.current,false);
  await assert.rejects(env.review(built),/STALE_REVIEW/);
});

test('delivery regenerates current decision, storyboard and quality records while reusing unchanged reviewed bytes',async t=>{
  const env=await fixture(t);
  await env.record({design:{...env.design,consultation:structuredClone(allConsultation)}});
  const built=await env.invoke('build',{projectPath:env.projectPath,expectedRevision:env.revision,mode:'review'});
  assert.equal(built.ok,true);if(!await env.render())return;
  await env.review(built);const originalReviews=(await env.state()).visualReviews;
  const responseText=LABEL+' CURRENT_FINAL_STORY_RESPONSE';
  const recorded=await env.plan({kind:'storyboard',storyboard:{...env.storyboard,decision:{status:'confirmed',userResponse:responseText}}});
  assert.equal(recorded.preservedVerification.pptxSha256,built.pptxSha256);
  await env.pilot();
  const delivered=await env.invoke('deliver',{projectPath:env.projectPath,expectedRevision:env.revision,outputDir:'delivery'});
  assert.equal(delivered.ok,true);assert.equal(delivered.pptxSha256,built.pptxSha256);
  assert.deepEqual(await readFile(delivered.files.pptx),await readFile(built.files.pptx));
  const rebuilt=JSON.parse(await readFile(delivered.files.project,'utf8'));
  assert.equal(rebuilt.storyboard.decision.userResponse,responseText);
  assert.deepEqual(rebuilt.design.consultation,allConsultation);
  assert.ok((await readFile(delivered.files.storyboard,'utf8')).includes(responseText));
  const quality=JSON.parse(await readFile(delivered.files.quality,'utf8'));
  assert.equal(quality.storyboard.ready,true);
  assert.ok(!quality.issues.some(issue=>issue.code==='storyboard-direction-unresolved'));
  assert.deepEqual(JSON.parse(await readFile(delivered.files.reviews,'utf8')).visualReviews,originalReviews);
});

test('bounded durable summaries retain recorded choices, next actions and late blocking repairs',async t=>{
  const {visible}=await workspace(t);
  const records=Array.from({length:4},(_,i)=>({collection:'claims',record:{id:'claim-'+i,text:'T'.repeat(1800),context:'C'.repeat(4000),locator:'L'.repeat(2000),
    metrics:Array.from({length:5},()=>({label:'X'.repeat(100),value:'V'.repeat(100),unit:'U'.repeat(100),baseline:'B'.repeat(1200),denominator:'D'.repeat(1200),aggregation:'A'.repeat(1200)}))}}));
  const result={ok:false,nextActions:['NEXT_ACTION_MUST_SURVIVE'],summary:{errors:1,warnings:13},records,
    storyboard:{status:'planned',pilot:{status:'reviewed'},decision:{status:'confirmed',userResponse:'STORY_RESPONSE_MUST_SURVIVE '+ 'S'.repeat(2300),rationale:'STORY_RATIONALE_MUST_SURVIVE '+ 'R'.repeat(1700)}},
    designDialogue:{mode:'collaborative',stage:'pilot-direction',pendingTopics:['cover'],recordedDecisions:[response('palette')],questions:[],instructions:[]},
    repairQueue:[{target:'slides.p2',severity:'error',codes:['actual-blocker'],messages:['LATE_BLOCKER_MUST_SURVIVE']}],
    issues:[...Array.from({length:13},()=>({severity:'warning',code:'routine-warning',message:'Routine check.'})),{severity:'error',code:'actual-blocker',message:'LATE_BLOCKER_MUST_SURVIVE'}]};
  const text=visible('context',result);
  assert.ok(text.length<=28000);
  for(const value of ['NEXT_ACTION_MUST_SURVIVE','STORY_RESPONSE_MUST_SURVIVE','STORY_RATIONALE_MUST_SURVIVE','storyboard.decision','Fixture selection for palette','Response for palette','LATE_BLOCKER_MUST_SURVIVE'])assert.ok(text.includes(value),value);
  const short=visible('check',{ok:false,issues:result.issues});
  assert.ok(short.includes('actual-blocker'),'Warning prefixes must not hide a later blocking issue.');
});
