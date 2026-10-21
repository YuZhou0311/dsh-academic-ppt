import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createProject,updateRecords,checkProject,buildProject,editProject,contextProject,evidenceIssues,DEFAULT_DESIGN} from '../src/core.mjs';
import {buildScenes} from '../src/scene.mjs';
import {brief,paper,claim,asset,slides,fixtureDesign} from './fixtures.mjs';

async function setup(t,design){
  const root=resolve('.test-output');await mkdir(root,{recursive:true});
  const cwd=await mkdtemp(join(root,'design-workflow-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const created=await createProject({cwd,projectDir:'project',title:'Synthetic design workflow fixture',brief,...(design?{design}:{})});
  const options={cwd,projectPath:created.projectPath};
  await updateRecords({...options,expectedRevision:0,papers:[paper],claims:[claim],assets:[asset],slides});
  return options;
}
const state=async options=>JSON.parse(await readFile(options.projectPath,'utf8'));

test('new projects expose visible cards and compact diagnostics through public check and build',async t=>{
  const options=await setup(t),p=await state(options);
  assert.equal(p.design.density,'compact');
  assert.equal(p.design.cardDefaults.surface,'outline');
  const checked=await checkProject(options);
  const empty=checked.issues.find(issue=>issue.code==='large-unused-region');
  assert.ok(empty,'the deliberately sparse protocol fixture must not pass compact delivery');
  assert.equal(empty.severity,'error');
  assert.ok(empty.box.w>0&&empty.box.h>0);
  assert.equal(checked.designDiagnostics.slides.length,slides.length);
  assert.equal(checked.designDiagnostics.basis,'scene-geometry-estimate-not-aesthetic-score');
  const blocked=await buildProject({...options,expectedRevision:1});
  assert.equal(blocked.status,'blocked');
  assert.equal((await state(options)).artifact,undefined);
  const context=await contextProject(options);
  assert.equal(context.stage,'design');
  assert.ok(context.issues.some(issue=>issue.code==='large-unused-region'));
});

test('token updates retain selected card and density rules; changing colors cannot relax delivery',async t=>{
  const options=await setup(t),p=await state(options),tokens={fontFamily:p.design.fontFamily,palette:{...p.design.palette,accent:'#28435A'}};
  await updateRecords({...options,expectedRevision:1,design:tokens});
  const after=await state(options);
  assert.equal(after.design.density,'compact');
  assert.deepEqual(after.design.cardDefaults,p.design.cardDefaults);
  assert.deepEqual(after.design.chrome,p.design.chrome);
  const before=await readFile(options.projectPath);
  await assert.rejects(updateRecords({...options,expectedRevision:2,design:{...tokens,density:'balanced'}}),/DENSITY_REQUIREMENT_RELAXATION/);
  assert.deepEqual(await readFile(options.projectPath),before);
  const blocked=await buildProject({...options,expectedRevision:2});
  assert.equal(blocked.status,'blocked');
});

test('balanced workflow fixtures remain buildable but retain honest geometry warnings in saved quality',async t=>{
  const options=await setup(t,fixtureDesign),built=await buildProject({...options,expectedRevision:1});
  assert.equal(built.ok,true,JSON.stringify(built.issues));
  const quality=JSON.parse(await readFile(built.files.quality,'utf8'));
  assert.ok(quality.issues.some(issue=>issue.code==='unused-region-review'&&issue.severity==='warning'));
  assert.equal(quality.designDiagnostics.slides.length,slides.length);
  assert.equal((await checkProject(options)).verification.readyForDelivery,false,'static geometry never substitutes for rendered visual review');
});

test('default chrome does not override an explicit header design',async t=>{
  const custom={...structuredClone(DEFAULT_DESIGN),system:{...DEFAULT_DESIGN.system,header:'band'}};
  const options=await setup(t,custom),scene=buildScenes(await state(options));
  assert.ok(scene.pages[0].nodes.some(node=>node.id.endsWith('/academic-header-band')));
});

test('scoped appearance edits preserve scientific records, other scene objects, and notes',async t=>{
  const options=await setup(t,fixtureDesign),before=await state(options);
  const changed=await editProject({...options,expectedRevision:1,scope:'card-style',changes:[{slideId:'s2',cardId:'aside',patch:{appearance:{surface:'tint',radius:8,padding:16,accent:'top',elevation:false}}}]});
  assert.ok(changed.preservation.protectedSceneObjects>0);
  const after=await state(options);
  assert.deepEqual(after.claims,before.claims);
  assert.equal(after.slides[1].cards[0].body,before.slides[1].cards[0].body);
  assert.equal(after.slides[1].notes,before.slides[1].notes);
});

test('context visuals cannot refer to missing media or relabel evidence as cover decoration',async t=>{
  const options=await setup(t,fixtureDesign),p=await state(options);
  p.slides[0]={...p.slides[0],layout:'cover',cover:{variant:'split',assetId:'missing'}};
  assert.ok(evidenceIssues(p).some(issue=>issue.code==='dangling-context-visual'));
  p.slides[0].cover.assetId='A1';
  assert.ok(evidenceIssues(p).some(issue=>issue.code==='context-visual-usage'));
});

test('custom figure bounds follow recovered chrome in the public workflow without relaxing old safe areas',async t=>{
  const options=await setup(t,fixtureDesign);
  const box={x:48,y:90,w:1184,h:554};
  await editProject({...options,expectedRevision:1,scope:'slide-content',changes:[{slideId:'s2',patch:{cards:[],figureBoxes:[box],chrome:{header:'plain',showSection:false,showBrand:false,showFooter:false,showPageNumber:false}}}]});
  const checked=await checkProject(options);
  assert.ok(!checked.issues.some(i=>i.code==='custom-figure-outside-content'));
  const built=await buildProject({...options,expectedRevision:2});assert.equal(built.ok,true,JSON.stringify(built.issues));
  const p=await state(options),scene=buildScenes(p),page=scene.pages.find(x=>x.id==='s2');
  assert.ok(page.contentBox.y<90);assert.deepEqual(p.slides[1].figureBoxes,[box],'authored coordinates are not stretched');
  const legacy=structuredClone(p);delete legacy.design.chrome;delete legacy.slides[1].chrome;
  assert.ok(buildScenes(legacy).issues.some(i=>i.code==='custom-figure-outside-content'),'old projects still enforce their original safe area');
  for(const invalid of [{...box,y:50},{...box,h:650},{...box,x:20}]){
    const copy=structuredClone(p);copy.slides[1].figureBoxes=[invalid];
    assert.ok(buildScenes(copy).issues.some(i=>i.code==='custom-figure-outside-content'),'header, footer and side boundaries remain protected');
  }
});
