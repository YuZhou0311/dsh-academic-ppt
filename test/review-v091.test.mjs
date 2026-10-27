// Synthetic state-machine cases; the renderer is real, user/model attestations
// are labelled fixtures and do not claim real human approval.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createProject,updateRecords,buildProject,renderProjectArtifact,recordReview,checkProject,deliverProject} from '../src/core.mjs';
import {fixtureDesign,brief,syntheticObservations} from './fixtures.mjs';
import {GUIDED_DESIGN_TOPICS} from '../src/design-dialogue.mjs';

test('historical template paths do not block unrelated feedback after source files move',async t=>{
 const root=resolve('.test-output');await mkdir(root,{recursive:true});
 const cwd=await mkdtemp(join(root,'source-history-v091-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 await writeFile(join(cwd,'reference.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><title>Original protocol fixture, not a template study</title></svg>');
 const design={...structuredClone(fixtureDesign),mode:'reference-guided',consultation:{...structuredClone(fixtureDesign.consultation),
  source:{mode:'reference-guided',status:'confirmed',userResponse:'Synthetic protocol fixture selects its explicitly supplied original reference file.',templatePaths:['reference.svg']}}};
 const created=await createProject({cwd,projectDir:'project',title:'Synthetic reference recovery',design});
 const route={cwd,projectPath:created.projectPath};
 await rm(join(cwd,'reference.svg'));
 const partial={fontFamily:design.fontFamily,palette:design.palette,consultation:{mode:'delegated',decisions:[{topic:'palette',status:'confirmed',selected:'navy',userResponse:'Synthetic protocol fixture confirms the recorded navy choice.'}]}};
 await updateRecords({...route,expectedRevision:0,design:partial});
 const saved=JSON.parse(await readFile(created.projectPath,'utf8'));
 assert.deepEqual(saved.design.consultation.source.templatePaths,['reference.svg']);
 assert.equal(saved.design.mode,'reference-guided');
 await assert.rejects(updateRecords({...route,expectedRevision:1,design:{...partial,consultation:{...partial.consultation,source:{...design.consultation.source,templatePaths:['missing-new-reference.svg']}}}}),/FILE_NOT_FOUND/);
 assert.equal(JSON.parse(await readFile(created.projectPath,'utf8')).revision,1);
});

test('partial checkpoint updates use the same merged density decision and reject contradictory duplicate topics',async t=>{
 const root=resolve('.test-output');await mkdir(root,{recursive:true});
 const cwd=await mkdtemp(join(root,'density-v091-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 const initialized=await createProject({cwd,projectDir:'project',title:'Synthetic density checkpoint'});
 const route={cwd,projectPath:initialized.projectPath};
 const state=JSON.parse(await readFile(initialized.projectPath,'utf8'));
 const base={fontFamily:state.design.fontFamily,palette:state.design.palette};
 const density={topic:'density',status:'confirmed',selected:'balanced',userResponse:'Synthetic fixture explicitly chooses balanced density for this protocol test.'};
 await updateRecords({...route,expectedRevision:0,design:{...base,consultation:{mode:'collaborative',decisions:[density]}}});
 const palette={topic:'palette',status:'confirmed',selected:'navy',userResponse:'Synthetic fixture explicitly chooses navy for this protocol test.'};
 await updateRecords({...route,expectedRevision:1,design:{...base,density:'balanced',consultation:{mode:'collaborative',decisions:[palette]}}});
 const next=JSON.parse(await readFile(initialized.projectPath,'utf8'));
 assert.equal(next.design.density,'balanced');
 assert.equal(next.design.consultation.decisions.length,2);
 const before=await readFile(initialized.projectPath);
 await assert.rejects(updateRecords({...route,expectedRevision:2,design:{...base,consultation:{mode:'collaborative',decisions:[palette,{...palette,selected:'green'}]}}}),/DUPLICATE_DESIGN_TOPIC/);
 assert.deepEqual(await readFile(initialized.projectPath),before);
});

test('v2 review demands space/color observations, risk responses and an exact final user decision without a rebuild loop',async t=>{
 const root=resolve('.test-output');await mkdir(root,{recursive:true});
 const cwd=await mkdtemp(join(root,'review-v091-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 const label='Synthetic protocol fixture, not real user approval or aesthetic validation.';
 const design={...structuredClone(fixtureDesign),fontFamily:'DejaVu Sans',branding:{label:'Synthetic laboratory'},
  consultation:{mode:'collaborative',interaction:'checkpoints',source:{status:'confirmed',mode:'content-led',userResponse:label+' Use original design.'},
   decisions:GUIDED_DESIGN_TOPICS.map(topic=>({topic,status:'confirmed',selected:'Synthetic choice '+topic,userResponse:label+' Confirm '+topic}))}};
 const created=await createProject({cwd,projectDir:'project',title:'Review state regression',brief:{...brief,targetPaperCount:0,requirePaperIntro:false},design});
 const route={cwd,projectPath:created.projectPath};let revision=0;
 await updateRecords({...route,expectedRevision:revision++,slides:[{id:'cover',layout:'cover',title:'Review protocol fixture',paperIds:[],claimIds:[],figureIds:[],cards:[],seconds:120,notes:label}]});
 const built=await buildProject({...route,expectedRevision:revision,mode:'review'});assert.equal(built.ok,true,JSON.stringify(built.issues));
 const first=await renderProjectArtifact({...route,expectedRevision:revision});
 if(first.status==='unavailable'){assert.notEqual(process.env.DSH_REQUIRE_REAL_RENDER,'1',first.message);t.skip(first.message);return;}
 assert.equal(first.status,'rendered');assert.deepEqual(first.missingFonts,[]);
 let checked=await checkProject(route);
 const observations=syntheticObservations(checked,['cover']);
 const review={...route,expectedRevision:revision,pptxSha256:built.pptxSha256,reviewer:'human',basis:'pptx-render',reviewedSlides:['cover'],result:'passed',notes:label,observations};
 const {spaceCheck,...missingSpace}=observations[0];
 await assert.rejects(recordReview({...review,observations:[missingSpace]}),/SPACE_COLOR_REVIEW_REQUIRED/);
 assert.ok(observations[0].diagnosticChecks.length>0,'The minimal cover deliberately leaves a reviewable empty region.');
 await assert.rejects(recordReview({...review,observations:[{...observations[0],diagnosticChecks:[]}]}),/DIAGNOSTIC_REVIEW_REQUIRED/);
 await assert.rejects(recordReview({...review,observations:[{...observations[0],diagnosticChecks:[{targetId:'stale-target',decision:'intentional',reason:label}]}]}),/STALE_DIAGNOSTIC_REVIEW/);
 await recordReview(review);
 checked=await checkProject(route);assert.equal(checked.finalReview.requiresUserResponse,true);
 assert.equal(checked.finalReview.nextAction,'ask-final-review');
 assert.equal((await deliverProject({...route,expectedRevision:revision,outputDir:'premature'})).status,'blocked');
 const before=JSON.parse(await readFile(created.projectPath,'utf8'));
 // This is a valid minimal design update: optional system/branding and existing
 // decisions must survive, while the same actual artifact remains reviewable.
 const saved=await updateRecords({...route,expectedRevision:revision++,design:{fontFamily:design.fontFamily,palette:design.palette,
  consultation:{mode:'collaborative',finalReview:{status:'confirmed',userResponse:label+' Accept the displayed final artifact.',
   pptxSha256:built.pptxSha256,renderReceiptSha256:checked.render.renderReceiptSha256}}}});
 assert.equal(saved.preservedVerification.pptxSha256,built.pptxSha256);
 const after=JSON.parse(await readFile(created.projectPath,'utf8'));
 for(const key of ['system','branding'])assert.deepEqual(after.design[key],before.design[key]);
 assert.deepEqual(after.design.consultation.decisions,before.design.consultation.decisions);
 assert.deepEqual(after.visualReviews,before.visualReviews);
 checked=await checkProject(route);assert.equal(checked.finalReview.ready,true);assert.equal(checked.delivery.readyForDelivery,true);
 const second=await renderProjectArtifact({...route,expectedRevision:revision});
 assert.equal(second.status,'rendered');
 assert.notEqual(second.renderReceiptSha256,first.renderReceiptSha256,'A new actual render has a new receipt.');
 checked=await checkProject(route);assert.equal(checked.finalReview.status,'not-ready','Self-review must precede the next user checkpoint.');
 await recordReview({...review,expectedRevision:revision,observations:syntheticObservations(checked,['cover'])});
 checked=await checkProject(route);assert.equal(checked.finalReview.status,'stale');
 assert.equal(checked.delivery.readyForDelivery,false,'The same PPTX hash cannot reuse approval of a different render.');
});
