import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { contentCoverageReport, evidenceDesignReport } from '../src/evidence-design.mjs';
import { createProject, updateRecords, studyProject, portfolioProjects, evidenceIssues, slideClaimIds, slideAssetIds } from '../src/core.mjs';
import { compareProjectStructures } from '../src/portfolio.mjs';
import { buildAcademicTools, formatToolResult } from '../src/tools.mjs';
import { fixtureDesign, brief, paper, claim, asset, slides } from './fixtures.mjs';

const clone=structuredClone;
async function fixture(t, design=fixtureDesign) {
  const base=resolve('.test-output'); await mkdir(base,{recursive:true});
  const cwd=await mkdtemp(join(base,'evidence-design-')); t.after(()=>rm(cwd,{recursive:true,force:true}));
  const created=await createProject({cwd,projectDir:'project',title:'Synthetic design fixture',brief,design});
  const projectPath=created.projectPath;
  await updateRecords({cwd,projectPath,expectedRevision:0,papers:[paper],claims:[claim],assets:[asset],slides});
  return {cwd,projectPath};
}
const readState=async o=>JSON.parse(await readFile(o.projectPath,'utf8'));
const scene=nodes=>({pages:[{id:'s',nodes}]});
const text=(text,role='body')=>({kind:'text',text,role,semantic:true});

test('required visible conditions retain numeric signs and boundaries, and exclude notes and footers',()=>{
  const p={slides:[{id:'s',notes:'Hidden 4.2 and required denominator',contentChecks:[
    {id:'positive',text:'4.2'},{id:'negative',text:'−4.2'},{id:'larger',text:'14.2'},
    {id:'denominator',text:'n = 110'},{id:'hidden',text:'required denominator'},
  ]}]};
  const report=contentCoverageReport(p,scene([text('RMSE −4.2; comparison 14.2'),text('n = 110'),text('required denominator','footer')]));
  const checks=Object.fromEntries(report.slides[0].checks.map(c=>[c.id,c.visible]));
  assert.deepEqual(checks,{positive:false,negative:true,larger:true,denominator:true,hidden:false});
  assert.equal(report.issues.length,2);
  const decorative=contentCoverageReport({slides:[{id:'s',contentChecks:[{id:'key',text:'Required fact'}]}]},scene([{...text('Required fact'),semantic:false}]));
  assert.equal(decorative.slides[0].checks[0].visible,false);
  for(const role of ['caption','context-caption','source-details','cover-metadata','cover-occasion','reference-title']) {
    const noteOnly=contentCoverageReport({slides:[{id:'s',contentChecks:[{id:'key',text:'Required fact'}]}]},scene([text('Required fact',role)]));
    assert.equal(noteOnly.slides[0].checks[0].visible,false,role+' cannot stand in for essential main content');
  }
});

test('coverage sees native table values but does not synthesize a missing phrase from separate objects',()=>{
  const p={slides:[{id:'s',contentChecks:[{id:'cell',text:'0.562'},{id:'joined',text:'trainingtest'},{id:'blank',text:'   '}]}]};
  const report=contentCoverageReport(p,scene([{kind:'table',table:{columns:['Test R²'],rows:[['0.562']]}},text('training'),text('test')]));
  assert.deepEqual(report.slides[0].checks.map(c=>c.visible),[true,false,false]);
});

test('coverage preserves scientific unit case and never matches an exponent fragment',()=>{
  const p={slides:[{id:'s',contentChecks:[{id:'concentration',text:'1 mM'},{id:'power',text:'1 MW'},{id:'exponent',text:'5'},{id:'complete',text:'1e5'}]}]};
  const report=contentCoverageReport(p,scene([text('1 mm; 1 mW; 1e5')]));
  assert.deepEqual(report.slides[0].checks.map(c=>c.visible),[false,false,false,true]);
});

test('line breaks between distinct numbers never fuse a split ratio with the following year',()=>{
  const p={slides:[{id:'s',contentChecks:[{id:'split',text:'同区同季随机 9:1'},{id:'year',text:'2020–2021'},{id:'fused',text:'12020'}]}]};
  const report=contentCoverageReport(p,scene([text('同区同季随机 9:1\n2020–2021')]));
  assert.deepEqual(report.slides[0].checks.map(c=>c.visible),[true,true,false]);
});

test('quantitative carrier diagnostics do not count empty frames, isolated giant numbers or decorative images',()=>{
  const p={slides:[{id:'s',argument:{role:'evidence'},claimIds:['C1']}],claims:[claim],assets:[{id:'decor',usage:'decorative'},{id:'locator',usage:'figure',reading:{purpose:'locator'}}]};
  const report=evidenceDesignReport(p,scene([text('3/4'),{kind:'rect',role:'group',semantic:false},
    {kind:'image',assetId:'decor',w:600,h:400},{kind:'image',assetId:'locator',w:600,h:400},
    {kind:'chart',chart:{series:[]}},{kind:'table',table:{rows:[]}}]));
  assert.deepEqual(report.slides[0].visibleCarriers,[]);
  assert.equal(report.issues[0].code,'quantitative-evidence-text-only');
  assert.equal(report.issues[0].severity,'warning','an unfamiliar drawing is a review prompt, not a score');
  const real=evidenceDesignReport(p,scene([{kind:'table',table:{rows:[['3/4']]}}]));
  assert.deepEqual(real.slides[0].visibleCarriers,['table']); assert.equal(real.issues.length,0);
});

test('source figures and data marks are recognized from the actual scene and claim dependencies',()=>{
  const p={slides:[{id:'s',argument:{role:'evidence'},claimIds:['I1']}],claims:[claim,{id:'I1',paperId:'P1',kind:'inference',dependsOn:['C1']}],assets:[{...asset,reading:{purpose:'evidence'}}]};
  const report=evidenceDesignReport(p,scene([{kind:'image',assetId:'A1',w:600,h:400},
    {kind:'rect',role:'data'},{kind:'rect',role:'data'},text('3'),text('4')]));
  assert.deepEqual(report.slides[0].visibleCarriers,['source-figure','authored-data-marks']);
  assert.equal(report.slides[0].availableSourceFigures[0].id,'A1');
});

test('new default projection policy remains attached on record updates while explicit legacy designs remain valid',async t=>{
  const o=await fixture(t); const first=await readState(o); assert.equal(first.design.projection,undefined);
  const created=await createProject({cwd:o.cwd,projectDir:'new-default',title:'Projection default fixture'});
  let current=JSON.parse(await readFile(created.projectPath,'utf8'));
  assert.deepEqual(current.design.projection,{bodyMin:28,labelMin:24,noteMin:18});
  assert.equal(current.design.cardDefaults.surface,'outline');
  await updateRecords({cwd:o.cwd,projectPath:created.projectPath,expectedRevision:0,design:{fontFamily:current.design.fontFamily,palette:current.design.palette}});
  current=JSON.parse(await readFile(created.projectPath,'utf8'));
  assert.deepEqual(current.design.projection,{bodyMin:28,labelMin:24,noteMin:18});
});

test('drawing evidence and visible custom bibliographies preserve source gates',async t=>{
  const o=await fixture(t),p=await readState(o);
  p.brief.requirePaperIntro=false;
  const s={...clone(slides[1]),layout:'academic',figureIds:[],cards:[],claimIds:[],drawings:[{id:'d',claimIds:['C1'],elements:[{id:'image',kind:'image',assetId:'A1'},{id:'mark',kind:'rect',role:'data'}]}]};
  p.slides=[s,{...clone(slides[2]),layout:'academic',referenceIds:['P1'],drawings:[]}];
  assert.deepEqual(slideClaimIds(s),['C1']); assert.deepEqual(slideAssetIds(s),['A1']);
  assert.ok(!evidenceIssues(p).some(i=>['reference-entry','drawing-data-source','figure-source-not-visible'].includes(i.code)));
  s.paperIds=[]; s.drawings[0].claimIds=[];
  const codes=evidenceIssues(p).map(i=>i.code);
  assert.ok(codes.includes('figure-source-not-visible')); assert.ok(codes.includes('drawing-data-source'));
});

test('study creates real native artifacts without modifying project history, review state or existing output',async t=>{
  const o=await fixture(t),before=await readFile(o.projectPath),filesBefore=await readdir(join(o.cwd,'project'));
  const candidates=[{id:'candidate-a',label:'Figure emphasis',slide:clone(slides[1])},{id:'candidate-b',label:'Same evidence, candidate comparison',slide:{...clone(slides[1]),title:'Alternative evidence heading'}}];
  await writeFile(join(o.cwd,'candidates.json'),JSON.stringify(candidates));
  const result=await studyProject({...o,expectedRevision:1,candidatesPath:'candidates.json',outputDir:'study',externalReferencePrompts:true});
  assert.equal(result.status,'candidates-created'); assert.equal(result.formalVisualApproval,false); assert.equal(result.projectModified,false);
  assert.deepEqual(await readFile(o.projectPath),before); assert.deepEqual(await readdir(join(o.cwd,'project')),filesBefore);
  const archive=unzipSync(await readFile(result.pptxPath)),xml=strFromU8(archive['ppt/slides/slide1.xml']);
  assert.match(xml,/<p:sp>/); assert.match(xml,/<p:pic>/);
  assert.match(await readFile(result.svgPaths[0],'utf8'),/<svg/);
  assert.match(await readFile(result.externalPromptsPath,'utf8'),/保持研究变量/);
  await assert.rejects(studyProject({...o,expectedRevision:1,candidates,outputDir:'study'}),/EEXIST/);
  assert.deepEqual(await readFile(o.projectPath),before);
});

test('study enforces the file contract, revision, text preservation and bounded workspace inputs',async t=>{
  const o=await fixture(t),candidates=[{id:'a',label:'A',slide:clone(slides[1])},{id:'b',label:'B',slide:clone(slides[1])}];
  await assert.rejects(studyProject({...o,expectedRevision:1,outputDir:'missing'}),/CANDIDATE_INPUT/);
  await assert.rejects(studyProject({...o,expectedRevision:1,candidates,candidatesPath:'c.json',outputDir:'both'}),/CANDIDATE_INPUT/);
  await assert.rejects(studyProject({...o,expectedRevision:0,candidates,outputDir:'stale'}),/REVISION_CONFLICT/);
  await writeFile(join(o.cwd,'bad.json'),Buffer.from([0x5b,0xff,0x5d]));
  await assert.rejects(studyProject({...o,expectedRevision:1,candidatesPath:'bad.json',outputDir:'bad'}),/INVALID_CANDIDATES_FILE/);
  await writeFile(join(o.cwd,'large.json'),' '.repeat(1024*1024+1));
  await assert.rejects(studyProject({...o,expectedRevision:1,candidatesPath:'large.json',outputDir:'large'}),/FILE_LIMIT/);
  await assert.rejects(studyProject({...o,expectedRevision:1,candidatesPath:'../outside.json',outputDir:'escape'}),/PATH_OUTSIDE_WORKSPACE/);
  candidates[0].slide.contentChecks=[{id:'missing-condition',text:'A required unshown condition'}];
  const blocked=await studyProject({...o,expectedRevision:1,candidates,outputDir:'blocked'});
  assert.equal(blocked.status,'blocked'); assert.ok(blocked.issues.some(i=>i.code==='required-visible-content-missing'));
  assert.ok(!(await readdir(o.cwd)).includes('blocked'));
  const tools=buildAcademicTools(),wire=tools.find(t=>t.name==='academic_ppt_study').parameters;
  assert.ok(wire.properties.candidatesPath); assert.equal(wire.properties.candidates,undefined);
  assert.ok(JSON.stringify(wire).length<8000,'candidate slide schema is not repeated on every model request');
});

test('candidate preview rejects dangling evidence without imposing full-report administrative requirements',async t=>{
  const o=await fixture(t),candidates=[{id:'a',label:'A',slide:{...clone(slides[1]),claimIds:['missing']}},{id:'b',label:'B',slide:clone(slides[1])}];
  const blocked=await studyProject({...o,expectedRevision:1,candidates,outputDir:'source-invalid'});
  assert.equal(blocked.status,'blocked'); assert.ok(blocked.issues.some(i=>i.code==='dangling-claim'));
  assert.ok(!(await readdir(o.cwd)).includes('source-invalid'));
});

const portfolioSlide=(id,x=0)=>({id,title:'Synthetic structure',layout:'academic',drawings:[{id:'drawing-'+id,width:1184,height:500,box:{x:48,y:132,w:1184,h:500},elements:[
  {id:'label-'+id,kind:'text',role:'body',text:id,color:'#123456',x:20+x,y:20,w:400,h:60},
  {id:'chart-'+id,kind:'rect',role:'data',x:500-x,y:120,w:600,h:300},
]}]});
test('ten renamed and repainted copies still trigger cross-deck structure review, without an originality score',()=>{
  const entries=Array.from({length:10},(_,i)=>({path:'explicit-'+i,project:{id:'p'+i,title:'t'+i,revision:1,slides:[1,2,3,4].map(n=>portfolioSlide(`s${i}-${n}`))}}));
  const result=compareProjectStructures(entries);
  assert.equal(result.comparisons.length,45); assert.equal(result.issues.length,45);
  assert.ok(result.comparisons.every(c=>c.matchingBodyPages===4));
  assert.equal(result.originalityScore,undefined); assert.equal(result.uniqueProjectCount,10);
  const different=clone(entries[1]); different.project.slides=[1,2,3,4].map(n=>portfolioSlide('different-'+n,220));
  assert.equal(compareProjectStructures([entries[0],different]).issues.length,0);
  const newData=clone(entries[1]);
  for(const s of newData.project.slides){s.drawings[0].elements[1].y=300;s.drawings[0].elements[1].h=120;}
  assert.equal(compareProjectStructures([entries[0],newData]).comparisons[0].matchingBodyPages,4,'different observations do not turn the same chart layout into a new design');
});

test('portfolio compares only distinct explicitly supplied projects and never overwrites a report',async t=>{
  const o=await fixture(t),created=await createProject({cwd:o.cwd,projectDir:'second',title:'Second synthetic project',brief,design:fixtureDesign});
  await updateRecords({cwd:o.cwd,projectPath:created.projectPath,expectedRevision:0,papers:[paper],claims:[claim],assets:[asset],slides});
  const args={cwd:o.cwd,projectPaths:[o.projectPath,created.projectPath],outputPath:'portfolio.json'};
  const result=await portfolioProjects(args); assert.equal(result.inputCount,2);
  await assert.rejects(portfolioProjects(args),/EEXIST/);
  await assert.rejects(portfolioProjects({cwd:o.cwd,projectPaths:[o.projectPath,o.projectPath]}),/DUPLICATE_PROJECT|INVALID_INPUT/);
  const duplicate=join(o.cwd,'copy.json'); await writeFile(duplicate,await readFile(o.projectPath));
  await assert.rejects(portfolioProjects({cwd:o.cwd,projectPaths:[o.projectPath,duplicate]}),/DUPLICATE_PROJECT/);
});

test('paper-reading evidence stays in portfolio comparison while metadata-only pages do not',()=>{
  const make=(id,cover)=>({path:id,project:{id,title:id,revision:1,design:{system:{cover}},slides:[{id:'cover',layout:'cover'},
    {id:'intro',layout:'paper',cards:[],figureIds:[]},...[1,2,3].map(n=>({id:'e'+n,layout:'paper',cards:[],figureIds:['original-figure']}))]}});
  const report=compareProjectStructures([make('a','framed'),make('b','project')]);
  assert.deepEqual(report.projects.map(p=>p.bodySlides),[3,3]);
  assert.equal(report.comparisons[0].matchingBodyPages,3); assert.equal(report.comparisons[0].matchingCover,false);
});

test('nearby custom cover title/image arrangements remain reviewable despite different footer furniture',()=>{
  const make=(id,shift)=>({path:id,project:{id,title:id,revision:1,slides:[{id:'cover',layout:'cover',cover:{variant:'custom',boxes:{title:{x:64,y:135+shift,w:690-shift,h:156}}},drawings:[
    {id:'image',width:430,height:550,box:{x:786-shift,y:90+shift,w:430,h:550},elements:[{id:'asset',kind:'image',x:0,y:0,w:430,h:360,assetId:id}]},
    {id:'footer',width:1184,height:100,box:{x:48,y:550,w:1184,h:100},elements:[{id:'text',kind:'text',role:'body',x:shift,y:0,w:600,h:50,text:id}]}
  ]}]}});
  const a=make('a',0),b=make('b',20),report=compareProjectStructures([a,b]);
  assert.equal(report.comparisons[0].matchingCover,false);
  assert.equal(report.comparisons[0].similarMainCover,true);
  assert.ok(report.issues.some(i=>i.code==='cross-deck-cover-main-reuse'));
  b.project.slides[0].cover.boxes.title={x:64,y:50,w:1152,h:140};b.project.slides[0].drawings[0].box={x:400,y:300,w:430,h:360};
  assert.equal(compareProjectStructures([a,b]).comparisons[0].similarMainCover,false);
});

test('tool summaries reveal unavailable candidate rendering and comparable project/page identities',()=>{
  const study=formatToolResult('academic_ppt_study',{ok:true,status:'candidates-created',rendering:{ok:false,status:'unavailable',reason:'engine missing'},externalPromptsPath:'study/prompts.txt'});
  assert.match(study,/unavailable/); assert.match(study,/engine missing/); assert.match(study,/study\/prompts.txt/);
  const portfolio=formatToolResult('academic_ppt_portfolio',{ok:true,inputCount:2,comparisons:[{leftProjectId:'P-left',rightProjectId:'P-right',matchingBodyPages:3,smallerBodyPageCount:4,pairs:[{leftSlideId:'L1',rightSlideId:'R4',leftTitle:'Left',rightTitle:'Right'}]}]});
  for(const value of ['P-left','P-right','L1','R4','3/4']) assert.ok(portfolio.includes(value));
});
