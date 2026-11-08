import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {HostCollaboration} from '../src/host-collaboration.mjs';
import {executionIdentity} from '../src/run-identity.mjs';
const human=(v,session,value,kind='user')=>v.observeSession(session,{type:'user/message',seq:1,data:{id:'u1',source:{kind},content:[{type:'text',text:value}]}});
const consultation=()=>({workflowVersion:2,mode:'collaborative',source:{status:'confirmed',mode:'content-led',userResponse:'原创'},decisions:[{topic:'storyline',status:'confirmed',selected:'比较方法与结果',userResponse:'按这条主线'}]});
async function f(t){const cwd=await mkdtemp(join(tmpdir(),'human-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const v=new HostCollaboration(),session={},exec={agent:{session}},p={id:'test',revision:1,design:{authoringMode:'content-tree',artDirection:'structured',consultation:consultation()},slides:[{id:'s1',layout:'academic'}],artifact:{pptxSha256:'a'.repeat(64),render:{pngPaths:['same.png']}}};return{v,session,exec,p,cwd,path:join(cwd,'project.json')};}
async function operation(f,name,request,{preview=true}={}){const requestPath=join(f.cwd,'input.json');await writeFile(requestPath,JSON.stringify(request));return f.v.before({name,args:{projectPath:f.path,...(name==='academic_ppt_record'?{recordsPath:requestPath}:{requestPath})},cwd:f.cwd,exec:f.exec,project:f.p,previewIsCurrent:preview});}
const pilot=(decision='confirmed',quote='认可当前样张，继续')=>({kind:'pilot-review',decision,userResponse:quote});

test('a fabricated userResponse is not a live answer',()=>{const v=new HostCollaboration(),s=v.state({});assert.throws(()=>v.findAnswer(s,'我认可'),/HUMAN_RESPONSE_NOT_OBSERVED/);});
test('only a real user-origin message supplies a receipt',()=>{const v=new HostCollaboration(),s={};human(v,s,'同意','skill');assert.throws(()=>v.findAnswer(v.state(s),'同意'),/NOT_OBSERVED/);human(v,s,'同意');assert.equal(v.findAnswer(v.state(s),'同意').source,'user/message');});
test('other sessions cannot lend consent',()=>{const v=new HostCollaboration(),a={},b={};human(v,a,'认可');assert.throws(()=>v.findAnswer(v.state(b),'认可'),/NOT_OBSERVED/);});
test('exact normalized quotation works, paraphrased approval does not',()=>{const v=new HostCollaboration(),s={};human(v,s,'我选 A，保留蓝色');assert.ok(v.findAnswer(v.state(s),'保留蓝色'));assert.throws(()=>v.findAnswer(v.state(s),'用户认可全部页面'),/NOT_OBSERVED/);});
test('successful official selected/custom answers are usable, pending and errors are not',()=>{const v=new HostCollaboration(),s={},exec={name:'ask_user_question',agent:{session:s},callId:'q'};v.observeQuestion(exec,{isError:false,value:{pending:true}});assert.equal(v.state(s).answers.length,0);v.observeQuestion(exec,{isError:true,value:{answers:[{selected:['原创']}]}});assert.equal(v.state(s).answers.length,0);v.observeQuestion(exec,{isError:false,value:{answers:[{id:'source',selected:['原创'],custom:'保留来源'}]}});assert.ok(v.findAnswer(v.state(s),'原创'));});
test('delegated layout is not delegated pilot approval',()=>{const v=new HostCollaboration(),s={};human(v,s,'配色和构图你自主决定');assert.ok(v.findAnswer(v.state(s),'配色和构图你自主决定',{delegationTopic:'layout'}));assert.throws(()=>v.findAnswer(v.state(s),'配色和构图你自主决定',{delegationTopic:'pilot-review'}),/APPROVAL_SCOPE_REQUIRED/);});
test('explicitly waived pilot checkpoint is separately scoped',()=>{const v=new HostCollaboration(),s={};human(v,s,'样张不用问我确认，你自行审查');assert.ok(v.findAnswer(v.state(s),'样张不用问我确认，你自行审查',{delegationTopic:'pilot-review'}));assert.throws(()=>v.findAnswer(v.state(s),'样张不用问我确认，你自行审查',{delegationTopic:'final-review'}),/APPROVAL_SCOPE_REQUIRED/);});
test('ordinary continue is not delegated workflow authority',()=>{const v=new HostCollaboration(),s={};human(v,s,'继续');assert.throws(()=>v.findAnswer(v.state(s),'继续',{delegationTopic:'layout'}),/EXPLICIT_DELEGATION/);});
test('pre-preview answer cannot approve that preview',async t=>{const x=await f(t);human(x.v,x.session,'认可当前样张，继续');x.v.markPresented(x.exec,x.path,x.p);await assert.rejects(operation(x,'academic_ppt_plan',pilot()),/NOT_OBSERVED/);});
test('current preview plus later affirmative answer reaches pilot core',async t=>{const x=await f(t);x.v.markPresented(x.exec,x.path,x.p);human(x.v,x.session,'认可当前样张，继续');await operation(x,'academic_ppt_plan',pilot());});
test('showing a file is not accepting it in the same turn',async t=>{const x=await f(t);x.v.markPresented(x.exec,x.path,x.p);await assert.rejects(operation(x,'academic_ppt_plan',pilot()),/NOT_OBSERVED/);});
test('negative feedback cannot be recast as acceptance',async t=>{const x=await f(t);x.v.markPresented(x.exec,x.path,x.p);human(x.v,x.session,'配色可以，但整体不满意，重做');await assert.rejects(operation(x,'academic_ppt_plan',pilot('confirmed','配色可以')),/USER_REQUESTED_REVISION/);});
test('re-presenting same artifact preserves a later user answer',async t=>{const x=await f(t);x.v.markPresented(x.exec,x.path,x.p);human(x.v,x.session,'认可当前样张，继续');x.v.markPresented(x.exec,x.path,x.p);await operation(x,'academic_ppt_plan',pilot());});
test('new artifact invalidates timing of the previous answer',async t=>{const x=await f(t);x.v.markPresented(x.exec,x.path,x.p);human(x.v,x.session,'认可当前样张，继续');x.p.artifact.pptxSha256='b'.repeat(64);x.v.markPresented(x.exec,x.path,x.p);await assert.rejects(operation(x,'academic_ppt_plan',pilot()),/NOT_OBSERVED/);});
test('source and storyline are checked before compose-page',async t=>{const x=await f(t);x.p.design.consultation={workflowVersion:2,mode:'collaborative'};await assert.rejects(operation(x,'academic_ppt_plan',{kind:'compose-page',slide:{id:'s1'}}),/BRIEF_CHECKPOINT_REQUIRED/);});
test('short candidate cannot expand after presentation without feedback',async t=>{const x=await f(t);x.v.markPresented(x.exec,x.path,x.p);await assert.rejects(operation(x,'academic_ppt_plan',{kind:'compose-page',slide:{id:'s2'}}),/PILOT_FEEDBACK_PENDING/);await operation(x,'academic_ppt_plan',{kind:'compose-page',mode:'replace',slide:{id:'s1'}});});
test('batch record cannot bypass short-candidate expansion guard',async t=>{const x=await f(t);x.v.markPresented(x.exec,x.path,x.p);await assert.rejects(operation(x,'academic_ppt_record',{slides:[{id:'s2'}]}),/PILOT_FEEDBACK_PENDING/);});
test('without a planned pilot only first three candidate pages may be added',async t=>{const x=await f(t);await operation(x,'academic_ppt_record',{slides:[{id:'s2'},{id:'s3'}]});await assert.rejects(operation(x,'academic_ppt_record',{slides:[{id:'s2'},{id:'s3'},{id:'s4'}]}),/PILOT_SCOPE_REQUIRED/);});
test('core success on actual pilot review grants expansion in this session',async t=>{const x=await f(t);x.v.markPresented(x.exec,x.path,x.p);human(x.v,x.session,'认可当前样张，继续');await operation(x,'academic_ppt_plan',pilot());x.v.after({name:'academic_ppt_plan',args:{projectPath:x.path},exec:x.exec,value:{pilotReview:{decision:'confirmed'}},project:x.p});await operation(x,'academic_ppt_plan',{kind:'compose-page',slide:{id:'s2'}});});
test('final confirmation also requires an answer after presentation',async t=>{const x=await f(t);human(x.v,x.session,'可以交付');x.v.markPresented(x.exec,x.path,x.p);const req={design:{consultation:{finalReview:{status:'confirmed',userResponse:'可以交付'}}}};await assert.rejects(operation(x,'academic_ppt_record',req),/NOT_OBSERVED/);human(x.v,x.session,'可以交付');await operation(x,'academic_ppt_record',req);});
test('native init cannot carry a made-up delegation',async t=>{const x=await f(t);await assert.rejects(x.v.before({name:'academic_ppt_init',args:{design:{consultation:{mode:'delegated',delegation:'全程不用确认由你自行审查',delegationTopics:['source','storyline','pilot-review']}}},exec:x.exec}),/NOT_OBSERVED/);});
test('render diagnostic reports effective style and actual body route, without messages',async t=>{const x=await f(t);x.p.design.system={header:'rule'};const d=executionIdentity(x.p);assert.equal(d.plugin.version,'0.10.0-rc.7');assert.equal(d.effectiveDesign.system.header,'rule');assert.equal(d.pages[0].route,'automatic-layout');assert.ok(d.warnings.length>=2);assert.ok(!JSON.stringify(d).includes('userResponse'));});

test('a neutral message cannot become pilot acceptance',()=>{const v=new HostCollaboration(),s={};human(v,s,'这里第二页是什么内容');assert.throws(()=>v.findAnswer(v.state(s),'第二页',{approval:true}),/EXPLICIT_APPROVAL_REQUIRED/);});

test('accepted short pilot stays scoped when new pages are appended',async t=>{
 const x=await f(t);x.v.markPresented(x.exec,x.path,x.p);human(x.v,x.session,'认可当前样张，继续');
 await operation(x,'academic_ppt_plan',pilot());
 x.v.after({name:'academic_ppt_plan',args:{projectPath:x.path},exec:x.exec,value:{pilotReview:{decision:'confirmed',slideIds:['s1']}},project:x.p});
 await operation(x,'academic_ppt_plan',{kind:'compose-page',slide:{id:'s2'}});
 x.p.slides.push({id:'s2',layout:'academic'});
 await operation(x,'academic_ppt_plan',{kind:'compose-page',slide:{id:'s3'}});
 const status=x.v.after({name:'academic_ppt_context',args:{projectPath:x.path},exec:x.exec,value:{},project:x.p});
 assert.equal(status.collaboration.mustStopForFeedback,false);
});
test('editing a previously accepted pilot still requires renewed feedback',async t=>{
 const x=await f(t);x.v.markPresented(x.exec,x.path,x.p);human(x.v,x.session,'认可当前样张，继续');
 x.v.after({name:'academic_ppt_plan',args:{projectPath:x.path},exec:x.exec,value:{pilotReview:{decision:'confirmed',slideIds:['s1']}},project:x.p});
 x.p.slides[0].title='Changed pilot content';
 await assert.rejects(operation(x,'academic_ppt_plan',{kind:'compose-page',slide:{id:'s2'}}),/PILOT_FEEDBACK_PENDING/);
});
test('later feedback supersedes an older quoted approval',()=>{
 const v=new HostCollaboration(),s={};human(v,s,'认可当前样张，继续');human(v,s,'不满意，先停下');
 assert.throws(()=>v.findAnswer(v.state(s),'认可当前样张，继续',{after:0,approval:true}),/SUPERSEDED_USER_RESPONSE/);
});
test('withdrawal after acceptance blocks additions but permits repairs',async t=>{
 const x=await f(t);x.v.markPresented(x.exec,x.path,x.p);human(x.v,x.session,'认可当前样张，继续');
 x.v.after({name:'academic_ppt_plan',args:{projectPath:x.path},exec:x.exec,value:{pilotReview:{decision:'confirmed',slideIds:['s1']}},project:x.p});
 human(x.v,x.session,'先停下，不满意');
 await assert.rejects(operation(x,'academic_ppt_plan',{kind:'compose-page',slide:{id:'s2'}}),/PILOT_FEEDBACK_PENDING/);
 await operation(x,'academic_ppt_plan',{kind:'compose-page',mode:'replace',slide:{id:'s1'}});
});
test('same PPTX with a changed presented render needs a new answer',async t=>{
 const x=await f(t);x.v.markPresented(x.exec,x.path,x.p,undefined,'render-a');human(x.v,x.session,'认可当前样张，继续');
 x.v.markPresented(x.exec,x.path,x.p,undefined,'render-b');
 await assert.rejects(operation(x,'academic_ppt_plan',pilot()),/NOT_OBSERVED/);
});
test('same presented render does not erase an existing answer',async t=>{
 const x=await f(t);x.v.markPresented(x.exec,x.path,x.p,undefined,'render-a');human(x.v,x.session,'认可当前样张，继续');
 x.v.markPresented(x.exec,x.path,x.p,undefined,'render-a');await operation(x,'academic_ppt_plan',pilot());
});
