import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,realpath,rm,symlink} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {unzipSync} from 'fflate';
import {createProject,updateRecords,buildProject,checkProject,recordReview,renderProjectArtifact,undoProject,DEFAULT_DESIGN} from '../src/core.mjs';
import {embedAssets,hash} from '../src/io.mjs';
import {renderProject} from '../src/render.mjs';
import {buildAcademicTools} from '../src/tools.mjs';
import {fixtureDesign,brief,paper,claim,asset,slides,syntheticObservations} from './fixtures.mjs';

async function workspace(t){
 const root=resolve('.test-output');await mkdir(root,{recursive:true});
 const cwd=await mkdtemp(join(root,'gate-state-'));t.after(()=>rm(cwd,{recursive:true,force:true}));return cwd;
}
const readState=async projectPath=>JSON.parse(await readFile(projectPath,'utf8'));
async function recordBatch(cwd,projectPath,expectedRevision,batch){
 const recordsPath=join(cwd,'records.json');await writeFile(recordsPath,JSON.stringify(batch));
 const tool=buildAcademicTools().find(item=>item.name==='academic_ppt_record');
 return tool.execute({projectPath,expectedRevision,recordsPath},{agent:{session:{header:{cwd}}}});
}

test('public record keeps teaching source paths through embedding, loading and data-only re-registration',async t=>{
 const bytes=await readFile(new URL('../skills/dsh-academic-ppt/references/templates/assets/distribution.png',import.meta.url));
 for(const provenance of [undefined,'source'])await t.test(provenance??'omitted provenance',async t=>{
  const cwd=await workspace(t),path=join(cwd,'references/templates/assets/distribution.png');
  await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);
  const created=await createProject({cwd,projectDir:'project',title:'Synthetic provenance protocol fixture',brief,design:fixtureDesign});
  const {data,...metadata}=asset;
  const incoming={...metadata,path:'references/templates/assets/../assets/distribution.png',...(provenance?{provenance}:{})};
  const recorded=await recordBatch(cwd,created.projectPath,0,{papers:[paper],claims:[claim],assets:[incoming],slides});
  assert.equal(recorded.revision,1);
  const saved=await readState(created.projectPath),embedded=saved.assets[0];
  assert.equal(embedded.path,undefined);assert.equal(embedded.sourcePath,await realpath(path));
  assert.equal(embedded.provenance,provenance,'source metadata must not silently relabel explicit provenance');
  assert.equal(embedded.sha256,hash(bytes));assert.equal(embedded.data,`data:image/png;base64,${bytes.toString('base64')}`);
  const options={cwd,projectPath:created.projectPath};
  const checked=await checkProject(options);
  assert.ok(checked.issues.some(i=>i.code==='template-as-evidence'&&i.path==='assets.A1'));
  assert.equal(checked.verification.readyForDelivery,false);
  const blocked=await buildProject({...options,expectedRevision:1,mode:'review'});
  assert.equal(blocked.status,'blocked');assert.ok(blocked.issues.some(i=>i.code==='template-as-evidence'));
  await rm(path);
  const reRegistered=await recordBatch(cwd,created.projectPath,1,{assets:[embedded]});
  assert.equal(reRegistered.revision,2,'embedded assets must not depend on the continued existence of their source files');
  assert.deepEqual((await readState(created.projectPath)).assets,[embedded]);
  assert.ok((await checkProject(options)).issues.some(i=>i.code==='template-as-evidence'));
  const {sourcePath,...erased}=embedded;
  await assert.rejects(recordBatch(cwd,created.projectPath,2,{assets:[erased]}),/IMMUTABLE_ASSET/);
  await undoProject({...options,expectedRevision:2});
  assert.deepEqual((await readState(created.projectPath)).assets,[embedded]);
  assert.ok((await checkProject(options)).issues.some(i=>i.code==='template-as-evidence'),'undo retains the recorded teaching source path');
 });
});

test('resolved import path cannot be masked by caller sourcePath or a benign symlink name',async t=>{
 const cwd=await workspace(t),path=join(cwd,'references/templates/assets/teaching.png');
 await mkdir(dirname(path),{recursive:true});await writeFile(path,Buffer.from(asset.data.split(',')[1],'base64'));
 const alias=join(cwd,'apparently-research.png');await symlink(path,alias);
 const created=await createProject({cwd,projectDir:'project',title:'Synthetic source-path override fixture',brief,design:fixtureDesign});
 const {data,...metadata}=asset;
 await recordBatch(cwd,created.projectPath,0,{papers:[paper],claims:[claim],slides,assets:[{...metadata,path:alias,sourcePath:'research/ordinary.png',provenance:'source'}]});
 const saved=await readState(created.projectPath);
 assert.equal(saved.assets[0].sourcePath,await realpath(path));assert.equal(saved.assets[0].provenance,'source');
 assert.ok((await checkProject({cwd,projectPath:created.projectPath})).issues.some(i=>i.code==='template-as-evidence'));
});

test('data supplied with a teaching path retains that path instead of erasing the teaching restriction',async t=>{
 const cwd=await workspace(t),created=await createProject({cwd,projectDir:'project',title:'Synthetic data-plus-path fixture',brief,design:fixtureDesign});
 const path='references/templates/assets/already-embedded.png';
 await recordBatch(cwd,created.projectPath,0,{papers:[paper],claims:[claim],slides,assets:[{...asset,path,sourcePath:'research/ordinary.png',provenance:'source'}]});
 const saved=await readState(created.projectPath);
 assert.equal(saved.assets[0].sourcePath,join(cwd,path));
 assert.ok((await checkProject({cwd,projectPath:created.projectPath})).issues.some(i=>i.code==='template-as-evidence'));
});

test('ordinary path imports preserve image bytes, explicit provenance and rendered slide content',async t=>{
 const cwd=await workspace(t),path=join(cwd,'research/figure.png'),bytes=Buffer.from(asset.data.split(',')[1],'base64');
 await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes);
 const {data,...metadata}=asset;
 const [embedded]=await embedAssets([{...metadata,path,provenance:'source'}],cwd);
 const [dataOnly]=await embedAssets([{...asset,provenance:'source'}],cwd);
 assert.equal(embedded.sourcePath,await realpath(path));assert.equal(embedded.provenance,'source');
 const {sourcePath,...withoutPath}=embedded;assert.deepEqual(withoutPath,dataOnly);
 const created=await createProject({cwd,projectDir:'project',title:'Synthetic normal-source fixture',brief,design:fixtureDesign});
 await recordBatch(cwd,created.projectPath,0,{papers:[paper],claims:[claim],slides,assets:[embedded]});
 const saved=await readState(created.projectPath),checked=await checkProject({cwd,projectPath:created.projectPath});
 assert.equal(checked.summary.errors,0);assert.ok(!checked.issues.some(i=>i.code==='template-as-evidence'));
 const withPath=await renderProject(saved),without=await renderProject({...saved,assets:[dataOnly]});
 assert.deepEqual(withPath.scenes,without.scenes);assert.deepEqual(withPath.svgPages,without.svgPages);assert.equal(withPath.html,without.html);
 const beforeZip=unzipSync(without.pptx),afterZip=unzipSync(withPath.pptx);
 const entries=Object.keys(beforeZip).filter(name=>name.startsWith('ppt/'));
 assert.deepEqual(Object.keys(afterZip).filter(name=>name.startsWith('ppt/')),entries);
 for(const entry of entries)assert.deepEqual(afterZip[entry],beforeZip[entry],entry);
});

test('successful actual PPTX rerender invalidates earlier PPTX reviews while retaining unchanged HTML reviews',async t=>{
 const cwd=await workspace(t),created=await createProject({cwd,projectDir:'project',title:'Synthetic render lifecycle fixture',brief:{...brief,targetPaperCount:0,requirePaperIntro:false},design:{...fixtureDesign,fontFamily:'DejaVu Sans'}});
 const options={cwd,projectPath:created.projectPath};
 await updateRecords({...options,expectedRevision:0,slides:[{id:'render-fixture',layout:'cover',title:'Render lifecycle fixture',paperIds:[],claimIds:[],figureIds:[],cards:[],notes:'Synthetic protocol fixture. This does not certify a user presentation.',seconds:120}]});
 const built=await buildProject({...options,expectedRevision:1});assert.equal(built.ok,true);
 const first=await renderProjectArtifact({...options,expectedRevision:1});
 if(first.status==='unavailable'){t.skip(`Optional actual renderer unavailable: ${first.message}`);return;}
 assert.equal(first.status,'rendered');
 const review={...options,expectedRevision:1,pptxSha256:built.pptxSha256,reviewer:'human',reviewedSlides:['render-fixture'],result:'passed',notes:'Synthetic state-transition test record; no user deck or visual judgment is certified.',observations:syntheticObservations(await checkProject(options),['render-fixture'])};
 await recordReview({...review,basis:'html-preview'});await recordReview({...review,basis:'pptx-render'});
 const before=await readState(created.projectPath),verified=await checkProject(options);
 assert.equal(verified.verification.visual,'reported-passed');assert.equal(verified.verification.htmlVisual,'reported-passed');
 const bytesBeforeFailure=await readFile(created.projectPath);
 await assert.rejects(renderProjectArtifact({...options,expectedRevision:1,fontDirectories:['missing-font-directory']}),/FILE_NOT_FOUND/);
 assert.deepEqual(await readFile(created.projectPath),bytesBeforeFailure);
 await assert.rejects(renderProjectArtifact({...options,expectedRevision:1,signal:AbortSignal.abort(new Error('synthetic-cancel'))}),/synthetic-cancel/);
 assert.deepEqual(await readFile(created.projectPath),bytesBeforeFailure);
 const second=await renderProjectArtifact({...options,expectedRevision:1});assert.equal(second.status,'rendered');
 assert.notEqual(second.receiptPath,first.receiptPath);assert.equal(second.sourceSha256,first.sourceSha256);
 const after=await readState(created.projectPath),checked=await checkProject(options);
 assert.deepEqual(after.artifact.files,before.artifact.files);assert.equal(hash(await readFile(built.files.pptx)),built.pptxSha256);
 for(const key of ['papers','claims','assets','slides','design','brief','revision'])assert.deepEqual(after[key],before[key],key);
 assert.deepEqual(after.visualReviews,before.visualReviews.filter(item=>item.basis==='html-preview'));
 assert.equal(checked.verification.pptxRender,'rendered');assert.equal(checked.verification.visual,'not-verified');
 assert.equal(checked.verification.htmlVisual,'reported-passed');assert.equal(checked.verification.readyForDelivery,false);
  t.diagnostic(`Two actual ${second.backend} render operations completed for one unchanged PPTX; the second requires fresh PPTX-image reviews.`);
});
