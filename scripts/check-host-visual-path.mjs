#!/usr/bin/env node
/** Isolated official DSH pipeline test. Real read_image/attachments and real PPTX
 * rendering; the present/ask UI endpoints are controlled fixtures. No model API,
 * user profile, credentials or GUI is used; do not advertise this as model QA. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile,writeFile,mkdir,mkdtemp,rm,cp} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import * as academic from '../src/index.mjs';
import {fixtureDesign,syntheticObservations} from '../test/fixtures.mjs';
const options={};for(let i=2;i<process.argv.length;i+=2){if(!['--runtime-dir','--output','--font-dir'].includes(process.argv[i])||!process.argv[i+1])throw Error('Use --runtime-dir DIR [--output FILE] [--font-dir DIR]');options[process.argv[i]]=resolve(process.argv[i+1]);}
assert.ok(options['--runtime-dir']);const requireRuntime=createRequire(join(options['--runtime-dir'],'package.json'));
const load=name=>import(pathToFileURL(requireRuntime.resolve('@deepseek-ai/'+name)).href);
const {Context}=await load('cordis');
const {LlmAdapter,createUserMessage}=await load('dsh-llm');
const ctx=new Context(),root=fileURLToPath(new URL('../',import.meta.url));await mkdir(join(root,'.test-output'),{recursive:true});
const workspace=await mkdtemp(join(root,'.test-output/visual-live-'));
if(options['--font-dir']){await cp(options['--font-dir'],join(workspace,'fonts'),{recursive:true});options['--font-dir']=join(workspace,'fonts');}
let handle;const results=[],presented=[],checks=[];
const signal=new AbortController().signal;let n=0,agent;
const execute=(name,args)=>ctx.tools.execute({name,arguments:args,callId:'visual-'+(++n),agent,signal});
const success=async(name,args)=>{const r=await execute(name,args);assert.equal(r.isError,false,JSON.stringify(r));return r.value;};
class NoNetworkAdapter extends LlmAdapter{async resolveModel(provider,id){return {provider,id,name:id,inputModalities:['text','image']};}async *stream(){throw Error('MODEL_REQUEST_FORBIDDEN');}}
try{
 for(const name of ['dsh-system-prompt','dsh-session','dsh-session-projection','dsh-llm','dsh-agent'])await ctx.plugin((await load(name)).default);
 await ctx.plugin((await load('dsh-sandbox-policy')).default,{mode:'workspace-write',workspaceRoot:workspace});
 await ctx.plugin((await load('dsh-fs-sandbox')).default,{cwd:workspace});
 await ctx.plugin((await load('dsh-attachment-local')).default,{dshHome:join(workspace,'attachment-home'),imageCompressionConcurrency:1});
 await ctx.plugin((await load('dsh-working-directory')).default,{defaultDirectory:workspace});
 await ctx.plugin((await load('dsh-tools')).default,{mode:'native'});
 await ctx.plugin((await load('dsh-skill')).default);
 await ctx.plugin((await load('dsh-agent-loop')).default,{agents:[],maxParallelToolCalls:1});
 await ctx.plugin((await load('dsh-tool-fs')),{read:true,readImage:true,write:false});
 ctx.llm.registerAdapter(['offline-visual-test'],new NoNetworkAdapter());
 ctx.on('tools/result',(exec,result)=>results.push({name:exec.name,isError:result.isError,callId:exec.callId}));
 // The real UI plugin is not bundled by this fixture dependency set. These
 // endpoints test nested tool dispatch/denials, not a user's desktop screen.
 ctx.tools.register({name:'present',description:'Controlled UI endpoint fixture, not Desktop validation',output:{schema:{type:'object',additionalProperties:true},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},parameters:{type:'object',properties:{files:{type:'array',items:{type:'object',properties:{path:{type:'string'},description:{type:'string'}},required:['path'],additionalProperties:false}}},required:['files'],additionalProperties:false},execute:async(args,exec)=>{assert.ok(args.files.length<=4);for(const file of args.files)await readFile(file.path);presented.push({files:args.files,session:exec.agent.session.id});return {turn:1,files:args.files};}});
 ctx.tools.register({name:'ask_user_question',description:'Controlled modal endpoint',output:{schema:{type:'object',additionalProperties:true},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}]},parameters:{type:'object',properties:{questions:{type:'array',items:{type:'object'}}},required:['questions']},execute:async()=>({answered:false})});
 await ctx.plugin(academic);
 handle=await ctx.agents.create({sessionId:'visual-path-fixture',meta:{cwd:workspace},agentOptions:{provider:'offline-visual-test',model:'image-fixture'}});agent=handle.agent;
 const sourceQuote='Software fixture chooses original content-led design and the input-versus-interpretation storyline. All design parameters use the fixture values; this is not real user aesthetic approval.';
 const userMessage=quote=>agent.session.append('user/message',createUserMessage({source:{kind:'user'},content:[{type:'text',text:quote}]}),{surfaceOp:'append'});
 const liveDesign={...fixtureDesign,consultation:{mode:'collaborative',interaction:'checkpoints',source:{status:'confirmed',mode:'content-led',userResponse:sourceQuote},decisions:['density','storyline','palette','shape','language','texture','cover','layout'].map(topic=>({topic,status:'confirmed',selected:'Synthetic fixture settings',userResponse:sourceQuote}))}};
 const fake=await execute('academic_ppt_init',{projectDir:'should-not-exist',title:'Forged answer must fail',design:{consultation:liveDesign.consultation}});
 assert.equal(fake.isError,true);assert.match(JSON.stringify(fake.content),/HUMAN_RESPONSE_NOT_OBSERVED/);
 userMessage(sourceQuote);checks.push('Official live session/event admits a user-origin fixture message; a forged initial confirmation is rejected before creating a project.');

 const p=await success('academic_ppt_init',{projectDir:'deck',title:'Runtime image receipts',design:{...liveDesign,authoringMode:'content-tree',fontFamily:'DejaVu Sans',titleFontFamily:'DejaVu Sans',annotationFontFamily:'DejaVu Sans'},capabilities:{imageInput:'supported',source:'Isolated official read_image with declared image-fixture; transport test only.'},brief:{centralQuestion:"Can native image receipts be enforced?",audience:"Software validation only",talkMinutes:1,requireFullText:false,targetPaperCount:0,visualEvidence:{mode:'flexible',reason:'Only deterministic pipeline checks, no research or real model judgment.'}}});
 const contractResponse=await execute('academic_ppt_contract',{topic:'authoring'});assert.equal(contractResponse.isError,false);const contract=contractResponse.value;
 const modelVisible=(contractResponse.content??[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
 assert.ok(contract.referencedSchemas?.length);assert.match(modelVisible,/compose-opening/);assert.match(modelVisible,/构图执行/);
 for(const lesson of contract.compositionLessons){assert.ok(modelVisible.includes(lesson.previewPath));assert.ok(modelVisible.includes(lesson.requestPath));}
 for(const instruction of contract.instructions)assert.ok(modelVisible.includes(instruction));
 checks.push('Actual model-visible tool text includes design instructions, complete opening schema and both rendered lesson paths, not just hidden JSON fields.');
 const composition={kind:'compose-page',mode:'create',slide:{id:'fixture',title:'Authored evidence correspondence',paperIds:[],claimIds:[],notes:'Deterministic native pipeline fixture; no model or user approval.',seconds:20},intent:{relationship:'comparison',primaryNodeId:'input',readingOrder:['input','output'],rationale:'Compare two evidence groups through a shared horizontal alignment.'},body:{id:'page',kind:'split',axis:'x',gap:24,children:[{id:'input',kind:'group',tone:'soft',title:'Input evidence',child:{id:'a',kind:'text',role:'body',text:'Exact source and conditions'}},{id:'output',kind:'group',tone:'accent',title:'Interpretation',child:{id:'b',kind:'text',role:'body',text:'Observed result and limits'}}]}};
 const requestPath=join(workspace,'page.json');await writeFile(requestPath,JSON.stringify(composition));
 const record=await success('academic_ppt_plan',{projectPath:p.projectPath,expectedRevision:0,requestPath});
 assert.ok(record.compositionBuild?.planPath);checks.push('The official Host accepts a semantic compose-page request and creates an editable native body before build, not a hand-authored renderer bypass.');
 await success('academic_ppt_build',{projectPath:p.projectPath,expectedRevision:record.revision,mode:'draft'});
 const rendered=await success('academic_ppt_render',{projectPath:p.projectPath,expectedRevision:record.revision,...(options['--font-dir']?{fontDirectories:[options['--font-dir']]}:{})});
 assert.equal(rendered.ok,true);assert.equal(rendered.userPreview.status,'presented');assert.equal(rendered.collaboration.mustStopForFeedback,true);assert.ok(rendered.executionIdentityPath);await readFile(rendered.executionIdentityPath);assert.equal(presented.length,1);assert.ok(presented[0].files.some(f=>f.path===rendered.pdfPath));checks.push('Real PPTX render dispatches a nested present through the official tool pipeline under the same agent; preview files exist. UI endpoint is fixture-only.');
 
 const pilotRequest=join(workspace,'pilot-request.json');await writeFile(pilotRequest,JSON.stringify({kind:'pilot-review',decision:'confirmed',userResponse:'当前样张可以，继续'}));
 const fakePilot=await execute('academic_ppt_plan',{projectPath:p.projectPath,expectedRevision:record.revision,requestPath:pilotRequest});assert.equal(fakePilot.isError,true);assert.match(JSON.stringify(fakePilot.content),/HUMAN_RESPONSE_NOT_OBSERVED/);
 const another=join(workspace,'another-page.json');await writeFile(another,JSON.stringify({...composition,slide:{...composition.slide,id:'unapproved-new-page'}}));
 const blockedExpansion=await execute('academic_ppt_plan',{projectPath:p.projectPath,expectedRevision:record.revision,requestPath:another});assert.equal(blockedExpansion.isError,true);assert.match(JSON.stringify(blockedExpansion.content),/PILOT_FEEDBACK_PENDING/);
 userMessage('当前样张不满意，先重做');await writeFile(pilotRequest,JSON.stringify({kind:'pilot-review',decision:'confirmed',userResponse:'当前样张不满意'}));
 const rejected=await execute('academic_ppt_plan',{projectPath:p.projectPath,expectedRevision:record.revision,requestPath:pilotRequest});assert.equal(rejected.isError,true);assert.match(JSON.stringify(rejected.content),/USER_REQUESTED_REVISION/);
 checks.push('After actual render/present, same-turn pilot approval, unapproved expansion and reclassifying negative feedback as acceptance are denied by the live wrapper.');
const checked=await success('academic_ppt_check',{projectPath:p.projectPath});
 const request={projectPath:p.projectPath,expectedRevision:record.revision,reviewer:'vision-model',basis:'pptx-render',reviewedSlides:['fixture'],result:'needs-fix',pptxSha256:rendered.pptxSha256,notes:'Synthetic software test: content requires review, not a real visual approval.',observations:syntheticObservations(checked,['fixture'],'Synthetic unresolved issue, never aesthetic approval.')};
 const denied=await execute('academic_ppt_review',request);assert.equal(denied.isError,true);assert.match(JSON.stringify(denied.content),/PAGE_IMAGES_NOT_OBSERVED/);checks.push('A fabricated page-read assertion is denied by the live Host wrapper, even though rendering and publication succeeded.');
 await success('read_image',{file_path:rendered.pngPaths[0]});
 const review=await success('academic_ppt_review',request);assert.equal(review.ok,true);checks.push('Actual official read_image produces image attachment bytes; matching single-page review then reaches the core and records needs-fix, not approval.');
 const question=await execute('ask_user_question',{questions:[{id:'pilot',question:'视觉样张能否接受？'}]});assert.equal(question.isError,true);assert.match(JSON.stringify(question.content),/VISUAL_FEEDBACK_REQUIRES_TURN_BOUNDARY/);checks.push('A blocking visual modal is rejected even after publication; caller must end the turn with preview links and await natural feedback.');
 const report={ok:true,pluginVersion:JSON.parse(await readFile(join(root,'package.json'))).version,runtimeVersion:requireRuntime('@deepseek-ai/dsh-tools/package.json').version,checks,toolCalls:results,presentCalls:presented.length,scope:'Official native Host pipeline + actual PPTX rendering + official image attachments. UI present/ask endpoints are controlled fixtures. No provider HTTP, no model generation, no real Desktop/Web display.',createdAt:new Date().toISOString()};
 if(options['--output']){await mkdir(dirname(options['--output']),{recursive:true});await writeFile(options['--output'],JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report,null,2));
}finally{await handle?.dispose?.();await ctx.fiber.dispose();await rm(workspace,{recursive:true,force:true});}
