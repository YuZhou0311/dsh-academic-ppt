import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {GUIDED_DESIGN_TOPICS,designDialoguePlan,designDialogueReport,designSourceResolved,finalReviewReport} from '../src/design-dialogue.mjs';
import {prepareDesign} from '../src/design-intake.mjs';

// These are protocol fixtures, not claims of a real human or visual review.
const source={status:'confirmed',mode:'content-led',userResponse:'Synthetic user: use the plugin original design route and show me the real candidates.'};
const answer=topic=>({topic,status:'confirmed',selected:'Synthetic '+topic+' choice',userResponse:'Synthetic user chose this '+topic+' after seeing the corresponding proposal.'});
const guided=(patch={})=>({mode:'collaborative',workflowVersion:2,interaction:'checkpoints',...patch});
const complete=()=>guided({source:{...source},decisions:GUIDED_DESIGN_TOPICS.map(answer)});
const artifact={pptxSha256:'a'.repeat(64),renderReceiptSha256:'b'.repeat(64),rendered:true,reviewed:true};
const project=consultation=>({design:{mode:'content-led',consultation},slides:[]});

async function fixture(t){
  const base=resolve('.test-output');await mkdir(base,{recursive:true});
  const cwd=await mkdtemp(join(base,'human-loop-v091-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const requestPath=join(cwd,'prepare.json');
  return {cwd,requestPath,async prepare(request){await writeFile(requestPath,JSON.stringify(request));return prepareDesign({cwd,requestPath});}};
}

test('new workflows start with a real design-source decision even when topics interaction is requested',()=>{
  for(const interaction of ['checkpoints','topics']){
    const result=designDialoguePlan(guided({interaction}));
    assert.equal(result.stage,'source');assert.equal(result.requiresUserResponse,true);
    assert.equal(result.readyForFinalDesign,false);
    assert.deepEqual(result.questions.map(q=>q.id),['design_source']);
    assert.deepEqual(result.questions[0].options.map(o=>o.id),['content-led','reference-guided','template-faithful']);
    assert.match(result.instructions.join(' '),/未回复不是默认同意/);
  }
});

test('source, story, and real pilot choices are separate while palette layout and style share one concrete discussion',()=>{
  const story=designDialoguePlan(guided({source}));
  assert.equal(story.stage,'story');assert.deepEqual(story.questions[0].topics,['density','storyline','language']);
  const pilot=designDialoguePlan(guided({source,decisions:['density','storyline','language'].map(answer)}));
  assert.equal(pilot.stage,'pilot-direction');assert.equal(pilot.nextAction,'prepare-pilot-candidates');
  assert.equal(pilot.requiresUserResponse,false,'Real candidates must be produced before asking for their approval.');
  assert.equal(pilot.questionTiming,'after-actual-pilot-render');
  for(const topic of ['palette','shape','texture','cover','layout'])assert.ok(pilot.questions[0].topics.includes(topic),topic);
  for(const expected of ['配色与对比','字体角色','开放分组','留白','阅读顺序'])assert.ok(pilot.questions[0].recommendation.includes(expected),expected);
  assert.equal(designDialoguePlan(complete()).readyForFinalDesign,true);
});

test('delegation applies only to the declared topics and an ordinary production request never resolves them',()=>{
  const result=designDialoguePlan(guided({source,mode:'delegated',delegation:'Synthetic user: choose the color palette for me; show me the storyline.',delegationTopics:['palette']}));
  assert.ok(!result.pendingTopics.includes('palette'));
  for(const pending of ['storyline','layout','texture'])assert.ok(result.pendingTopics.includes(pending));
  for(const delegation of ['帮我做PPT','请帮我制作一份学术PPT','Please make a presentation']){
    const consultation=guided({source,mode:'delegated',delegation,delegationTopics:[...GUIDED_DESIGN_TOPICS]});
    assert.equal(designDialoguePlan(consultation).readyForFinalDesign,false,delegation);
    assert.ok(designDialogueReport(project(consultation)).issues.some(i=>i.code==='design-delegation-task-only'),delegation);
    const fabricated=complete();fabricated.source.userResponse=delegation;
    assert.equal(designSourceResolved(fabricated),false,'Relabeling a generic request as confirmed does not create a source choice.');
    fabricated.source={...source,userResponse:'Synthetic user chose original design.'};
    fabricated.decisions.find(item=>item.topic==='palette').userResponse=delegation;
    assert.ok(designDialoguePlan(fabricated).pendingTopics.includes('palette'));
  }
  const unscoped=guided({source,mode:'delegated',delegation:'Synthetic user: choose the design.'});
  assert.ok(designDialogueReport(project(unscoped)).issues.some(i=>i.code==='design-delegation-scope-required'));
});

test('waiting for a selected template does not repeat the source question or pretend the template has been supplied',()=>{
  const consultation=guided({source:{status:'awaiting-upload',mode:'reference-guided',userResponse:'Synthetic user will provide a template.'}});
  const result=designDialoguePlan(consultation);
  assert.equal(result.stage,'source-upload');assert.equal(result.nextAction,'await-template-upload');
  assert.deepEqual(result.questions,[]);assert.equal(result.readyForFinalDesign,false);
  consultation.source.status='confirmed';
  assert.equal(designSourceResolved(consultation),false);
  consultation.source.templatePaths=['synthetic-template.pptx'];
  assert.equal(designSourceResolved(consultation),true);
  assert.ok(designDialogueReport(project(consultation)).issues.some(i=>i.code==='design-source-mode-mismatch'));
});

test('a final human review is requested only after actual render and self review and is tied to both current hashes',()=>{
  const p=project(complete());
  for(const pending of [{},{...artifact,rendered:false},{...artifact,reviewed:false}]){
    const result=finalReviewReport(p,pending);
    assert.equal(result.status,'not-ready');assert.equal(result.requiresUserResponse,false);assert.deepEqual(result.questions,[]);
  }
  const waiting=finalReviewReport(p,artifact);
  assert.equal(waiting.requiresUserResponse,true);assert.equal(waiting.resolved,false);
  assert.ok(waiting.issues.some(i=>i.code==='final-human-review-pending'));
  p.visualReviews=[{reviewer:'agent',result:'passed',basis:'pptx-render',pptxSha256:artifact.pptxSha256}];
  assert.equal(finalReviewReport(p,artifact).resolved,false,'Agent self review cannot manufacture a human answer.');
  p.design.consultation.finalReview={status:'confirmed',userResponse:'Synthetic user: this displayed revision is approved.',pptxSha256:artifact.pptxSha256,renderReceiptSha256:artifact.renderReceiptSha256};
  assert.equal(finalReviewReport(p,artifact).resolved,true);
  for(const patch of [{pptxSha256:'c'.repeat(64)},{renderReceiptSha256:'d'.repeat(64)}]){
    const result=finalReviewReport(p,{...artifact,...patch});
    assert.equal(result.status,'stale');assert.ok(result.issues.some(i=>i.code==='final-human-review-stale'));
  }
  assert.equal(finalReviewReport(project({mode:'collaborative'}),{}).required,false,'Existing unversioned projects retain their previous workflow.');
});

test('final review delegation needs final-stage scope and is not inherited from palette autonomy',()=>{
  const p=project(complete());
  p.design.consultation.delegationTopics=['palette'];
  p.design.consultation.finalReview={status:'delegated',userResponse:'Synthetic user authorizes final review and delivery after repairs.',pptxSha256:artifact.pptxSha256,renderReceiptSha256:artifact.renderReceiptSha256};
  assert.equal(finalReviewReport(p,artifact).resolved,false);
  p.design.consultation.delegationTopics.push('final-review');
  assert.equal(finalReviewReport(p,artifact).resolved,true);
  p.design.consultation.finalReview.userResponse='帮我做PPT';
  assert.equal(finalReviewReport(p,artifact).resolved,false);
});

test('an explicit earlier source or final-review delegation is recorded against current artifacts without asking again',()=>{
  const consultation=guided({mode:'delegated',delegation:'Synthetic user explicitly delegates choosing the design source and final review after fixing every defect.',delegationTopics:['source','final-review']});
  const opening=designDialoguePlan(consultation);
  assert.equal(opening.nextAction,'record-authorized-design-source');assert.equal(opening.requiresUserResponse,false);
  assert.equal(opening.readyForFinalDesign,false);assert.deepEqual(opening.questions,[]);
  const final=finalReviewReport(project(consultation),artifact);
  assert.equal(final.nextAction,'record-authorized-final-review');assert.equal(final.requiresUserResponse,false);
  assert.equal(final.resolved,false);assert.deepEqual(final.questions,[]);
  assert.ok(final.issues.some(i=>i.code==='final-human-review-record-required'));
});

test('preparation does not invent an answer from absent or unanswered template status',async t=>{
  const {prepare,requestPath}=await fixture(t);
  for(const status of [undefined,'none','unanswered']){
    const request={topic:'Synthetic report',...(status?{template:{status}}:{})};
    const result=await prepare(request);
    assert.equal(result.designRecords.consultation.workflowVersion,2);
    assert.equal(result.designRecords.consultation.source,undefined);
    assert.equal(result.designDialogue.stage,'source');assert.equal(result.nextAction,'ask-design-questions');
    assert.equal(result.template.question,undefined,'One source discussion should not be duplicated by the old optional template question.');
    assert.deepEqual(JSON.parse(await readFile(requestPath,'utf8')),request);
  }
});

test('preparation uses the actual chosen source and keeps reviewed template behavior behind that choice',async t=>{
  const {cwd,prepare}=await fixture(t);await writeFile(join(cwd,'reference.pptx'),'Synthetic bytes; prepare only checks the file path and format.');
  const consultation=guided({mode:'delegated',delegation:'Synthetic user explicitly delegates all remaining presentation design topics.',delegationTopics:[...GUIDED_DESIGN_TOPICS],
    source:{status:'confirmed',mode:'template-faithful',userResponse:'Synthetic user requests the supplied template layout.',templatePaths:['reference.pptx']}});
  const result=await prepare({topic:'Synthetic report',consultation});
  assert.equal(result.nextAction,'inspect-template');assert.equal(result.template.files[0].path,join(cwd,'reference.pptx'));
  assert.equal(result.designRecords.consultation.source.mode,'template-faithful');
  consultation.source={...source};
  const native=await prepare({topic:'Synthetic report',consultation,template:{status:'provided',localPaths:['missing.pptx']}});
  assert.equal(native.template.status,'none');assert.equal(native.nextAction,'design-evidence-pages');
});
