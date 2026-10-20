import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createProject,updateRecords,buildProject,contextProject,checkProject,editProject,undoProject,recordReview,evidenceIssues} from '../src/core.mjs';
import {safePath,hash} from '../src/io.mjs';
import {DEFAULT_DESIGN} from '../src/core.mjs';
import {normalizeTemplateProfiles} from '../src/template-profile.mjs';
import {brief,paper,claim,asset,slides} from './fixtures.mjs';
async function init(t){const base=resolve('.test-output');await mkdir(base,{recursive:true});const cwd=await mkdtemp(join(base,'core-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const p=await createProject({cwd,projectDir:'project',title:'Synthetic academic fixture',brief});return {cwd,projectPath:p.projectPath};}
async function fill(t){const o=await init(t);await updateRecords({...o,expectedRevision:0,papers:[paper],claims:[claim],assets:[asset],slides});return o;}
async function state(o){return JSON.parse(await readFile(o.projectPath,'utf8'));}

test('evidence gates reject incomplete reading, IF threshold and dangling source without creating a review build',async t=>{
 const o=await fill(t);let p=await state(o);
 p.brief.impactFactorMin=10;p.papers[0].reading.status='abstract-only';p.slides[0].claimIds=['missing'];
 const codes=evidenceIssues(p).map(x=>x.code);assert.ok(codes.includes('full-text-required'));assert.ok(codes.includes('impact-factor-source'));assert.ok(codes.includes('dangling-claim'));
 await updateRecords({...o,expectedRevision:1,brief:p.brief,papers:p.papers});const out=await buildProject({...o,expectedRevision:2});assert.equal(out.status,'blocked');assert.equal((await state(o)).artifact,undefined);
});
test('upsert commits atomically, limits payloads and rejects stale revisions',async t=>{
 const o=await fill(t),before=await readFile(o.projectPath);
 await assert.rejects(updateRecords({...o,expectedRevision:0,claims:[claim]}),/REVISION_CONFLICT/);
 await assert.rejects(updateRecords({...o,expectedRevision:1,claims:Array(21).fill(claim)}),/INVALID_INPUT/);
 assert.deepEqual(await readFile(o.projectPath),before);
 const aborted=AbortSignal.abort(new Error('cancel before write'));await assert.rejects(updateRecords({...o,expectedRevision:1,claims:[claim],signal:aborted}),/cancel before write/);
 assert.deepEqual(await readFile(o.projectPath),before);
});
test('review build has native artifacts, stable sources and no automatic visual pass',async t=>{
 const o=await fill(t),out=await buildProject({...o,expectedRevision:1});assert.equal(out.ok,true);assert.equal(out.status,'ready-for-review');
 for(const key of ['pptx','html','speech','evidence','assets','quality'])assert.ok((await readFile(out.files[key])).length>10);
 const checked=await checkProject(o);assert.equal(checked.artifact.current,true);assert.equal(checked.verification.visual,'not-verified');assert.equal(checked.verification.readyForDelivery,false);
 assert.equal(hash(await readFile(out.files.pptx)),out.pptxSha256);
});
test('card-only edit locks scientific values and preserves every non-target scene object and notes',async t=>{
 const o=await fill(t);await buildProject({...o,expectedRevision:1});const original=await state(o);
 await assert.rejects(editProject({...o,expectedRevision:1,scope:'card-style',changes:[{slideId:'s2',cardId:'aside',patch:{body:'擅自删掉分母'}}]}),/CARD_STYLE_SCOPE/);
 const changed=await editProject({...o,expectedRevision:1,scope:'card-style',changes:[{slideId:'s2',cardId:'aside',patch:{style:'dashed-note'}}]});assert.ok(changed.preservation.protectedSceneObjects>10);
 const after=await state(o);assert.equal(after.slides[1].cards[0].body,original.slides[1].cards[0].body);assert.deepEqual(after.slides[1].cards[0].metric,original.slides[1].cards[0].metric);assert.equal(after.slides[1].notes,original.slides[1].notes);assert.equal(after.artifact,undefined);
 await assert.rejects(updateRecords({...o,expectedRevision:2,slides:[slides[1]]}),/USE_SCOPED_EDIT/);
 const restored=await undoProject({...o,expectedRevision:2});assert.equal(restored.revision,3);const undone=await state(o);assert.deepEqual(undone.slides,original.slides);assert.equal(undone.assets[0].data,original.assets[0].data);
});
test('externally edited PPTX is detected and a rebuild preserves the external file',async t=>{
 const o=await fill(t),first=await buildProject({...o,expectedRevision:1});await writeFile(first.files.pptx,'external Office edit fixture');
 const checked=await checkProject(o);assert.equal(checked.artifact.current,false);
 await assert.rejects(recordReview({...o,expectedRevision:1,pptxSha256:first.pptxSha256,reviewer:'human',basis:'html-preview',reviewedSlides:['s1'],result:'passed',notes:'test'}),/STALE_REVIEW/);
 const second=await buildProject({...o,expectedRevision:1});assert.notEqual(second.files.pptx,first.files.pptx);assert.equal(await readFile(first.files.pptx,'utf8'),'external Office edit fixture');
});
test('review records require actual capabilities and hash; HTML review cannot certify PPTX',async t=>{
 const o=await fill(t),built=await buildProject({...o,expectedRevision:1});const review={...o,expectedRevision:1,pptxSha256:built.pptxSha256,reviewer:'vision-model',basis:'html-preview',reviewedSlides:['s1','s2','s3'],result:'passed',notes:'软件测试审查记录。'};
 await assert.rejects(recordReview(review),/VISION_UNVERIFIED/);
 await assert.rejects(recordReview({...review,reviewer:'human',basis:'pptx-render'}),/PPTX_RENDER_REQUIRED/);
 await recordReview({...review,reviewer:'human'});let checked=await checkProject(o);assert.equal(checked.verification.htmlVisual,'reported-passed');assert.equal(checked.verification.readyForDelivery,false);
 await recordReview({...review,reviewer:'human',result:'needs-fix',reviewedSlides:['s2']});checked=await checkProject(o);assert.equal(checked.verification.htmlVisual,'not-verified');
});
test('paths, symlinks and image hashes cannot escape the chosen workspace',async t=>{
 const o=await fill(t);await assert.rejects(safePath(o.cwd,'../outside'),/PATH_OUTSIDE_WORKSPACE/);
 await symlink(dirnameTest(o.cwd),join(o.cwd,'outside-link'));await assert.rejects(safePath(o.cwd,'outside-link/read'),/SYMLINK_OUTSIDE_WORKSPACE/);
 await assert.rejects(updateRecords({...o,expectedRevision:1,assets:[{...asset,id:'A2',sha256:'0'.repeat(64)}]}),/ASSET_HASH_MISMATCH/);
 assert.equal((await state(o)).revision,1);
});
function dirnameTest(path){return resolve(path,'..');}
test('context restores the actual revision and removes embedded image bytes',async t=>{
 const o=await fill(t);const context=await contextProject({...o,recordIds:['P1','A1']});assert.equal(context.revision,1);assert.equal(context.records.find(x=>x.collection==='assets').record.data,undefined);assert.ok(context.nextActions.length>0);
});

test('a chart cannot hide a source paper from visible citations and full-text coverage',async t=>{
 const o=await fill(t),p2={...paper,id:'P2',title:'Second synthetic source',reading:{...paper.reading,status:'abstract-only'}},c2={...claim,id:'C2',paperId:'P2'};
 const results={...slides[1],layout:'results',figureIds:[],chart:{kind:'column',categories:['Input'],series:[{name:'Test',values:[3]}],unit:'items',sourceClaimId:'C2'}};
 await updateRecords({...o,expectedRevision:1,papers:[p2],claims:[c2],slides:[results]});
 const built=await buildProject({...o,expectedRevision:2});assert.equal(built.status,'blocked');
 for(const code of ['claim-source-not-visible','full-text-required','full-title-on-slide','reference-entry'])assert.ok(built.issues.some(i=>i.code===code),code);
 assert.equal((await state(o)).artifact,undefined);
});

function profileFixture(){const sha='a'.repeat(64);return {format:'academic-template-profile',version:1,sha256:sha,source:{path:'template.pptx',sha256:sha,width:1280,height:720},unsupported:[],components:[{id:'source-frame',sourceSha256:sha,sourceSlide:1,derivation:'contained-native-backgrounds',width:300,height:200,sourceBox:{x:20,y:20,w:300,h:200},nodes:[{kind:'rect',x:0,y:0,w:300,h:200,fill:'#FFFFFF',stroke:'#123456',strokeWidth:1}],sourceShapeIds:['2'],oldTextExcluded:true}]};}

test('template path and inline design both reject executable nodes, colors, geometry and unregistered sources atomically',async t=>{
 const o=await fill(t),before=await readFile(o.projectPath);
 for(const mutate of [p=>{p.components[0].nodes[0].kind='text';p.components[0].nodes[0].text='untrusted';},p=>{p.components[0].nodes[0].fill='#fff"/><script>bad()</script>';},p=>{p.components[0].nodes[0].w=Number.MAX_VALUE;},p=>{p.components[0].sourceSha256='b'.repeat(64);},p=>{p.components[0].textZones={title:{x:.8,y:0,w:.5,h:.1},body:{x:0,y:.2,w:.9,h:.8}};}]){
  const p=profileFixture();mutate(p);const path=join(o.cwd,'bad-profile.json');await writeFile(path,JSON.stringify(p));
  await assert.rejects(updateRecords({...o,expectedRevision:1,templateProfilePaths:[path]}),/INVALID_TEMPLATE_PROFILE/);
  const inline={sources:[p.source],components:p.components,unsupported:[]};
  await assert.rejects(updateRecords({...o,expectedRevision:1,design:{...DEFAULT_DESIGN,templateProfile:inline}}),/INVALID_INPUT|INVALID_TEMPLATE_PROFILE/);
  assert.deepEqual(await readFile(o.projectPath),before);
 }
 const p=profileFixture(),normalized=normalizeTemplateProfiles([p]);
 await updateRecords({...o,expectedRevision:1,design:{...DEFAULT_DESIGN,templateProfile:normalized}});assert.equal((await state(o)).design.templateProfile.components.length,1);
});

test('manually changed embedded bytes do not bypass project asset hashes on build or check',async t=>{
 const o=await fill(t),p=await state(o);p.assets[0].sha256='f'.repeat(64);await writeFile(o.projectPath,JSON.stringify(p));
 await assert.rejects(buildProject({...o,expectedRevision:1}),/ASSET_HASH_MISMATCH/);
 await assert.rejects(checkProject(o),/ASSET_HASH_MISMATCH/);
});
