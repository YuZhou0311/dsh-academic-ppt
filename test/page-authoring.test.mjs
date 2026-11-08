import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compileAuthoredPage} from '../src/page-authoring.mjs';
import {buildScenes} from '../src/scene.mjs';
import {buildAcademicTools,formatToolResult} from '../src/tools.mjs';
import {toolContract} from '../src/tool-contract.mjs';
import {compositionCraftReport} from '../src/composition-craft.mjs';
import {assertProject} from '../src/schema.mjs';
import {fixtureDesign,brief,paper,claim,asset} from './fixtures.mjs';
import {embedAssets} from '../src/io.mjs';
const project=()=>({title:'Synthetic composer fixture',design:{styleProfile:'research-seminar'},papers:[paper],claims:[claim],assets:[],slides:[]});
const txt=(id,text='Shared comparison',more={})=>({id,kind:'text',role:'body',text,...more});
function req(body={id:'whole',kind:'split',axis:'x',children:[txt('left'),txt('right')]}){return {kind:'compose-page',mode:'create',slide:{id:'page',title:'A content-authored page',paperIds:['P1'],claimIds:['C1'],notes:'Synthetic fixture, not research.',seconds:40},intent:{relationship:'comparison',primaryNodeId:body.id,readingOrder:[body.id],rationale:'Corresponding evidence stays in the same row.'},body};}
test('content tree is deterministic, native, and does not rewrite input or scientific numbers',()=>{const p=project(),q=req(),before=structuredClone([p,q]);const a=compileAuthoredPage(p,q),b=compileAuthoredPage(p,q);assert.deepEqual(a,b);assert.deepEqual([p,q],before);assert.equal(a.slide.layout,'academic');assert.ok(a.slide.composition);assert.ok(a.slide.drawings[0].elements.every(e=>['rect','text','line','image'].includes(e.kind)));assert.equal(a.report.approval,'not-reviewed');assert.equal(a.slide.claimIds[0],'C1');});
test('weights adapt to current title height rather than fixed absolute slots',()=>{const p=project(),q=req();q.body.children[0].weight=3;const a=compileAuthoredPage(p,q);q.slide.title='A much longer necessary technical title that must wrap onto another line in the actual heading';const b=compileAuthoredPage(p,q);const nodes=a.report.nodes;assert.ok(nodes[1].box.w>nodes[2].box.w*2.9);assert.ok(b.report.contentBox.h<a.report.contentBox.h);});
test('fixed extents and nested shared rows are compiled without overlaps',()=>{const q=req({id:'all',kind:'split',axis:'y',children:[{...txt('heading'),extent:44},{id:'rows',kind:'split',axis:'y',children:[{id:'r1',kind:'split',axis:'x',children:[txt('a'),txt('b')]},{id:'r2',kind:'split',axis:'x',children:[txt('c'),txt('d')]}]}]});const a=compileAuthoredPage(project(),q);const ns=Object.fromEntries(a.report.nodes.map(n=>[n.nodeId,n.box]));assert.equal(ns.a.x,ns.c.x);assert.equal(ns.b.x,ns.d.x);assert.ok(ns.c.y>ns.a.y+ns.a.h);});
test('overflow is actionable and never silently shrinks text',()=>{const q=req({id:'small',kind:'split',axis:'y',children:[{...txt('bad','Long text '.repeat(60)),extent:40},txt('rest')]});assert.throws(()=>compileAuthoredPage(project(),q),e=>e.code==='AUTHORING_TEXT_OVERFLOW'&&e.detail.node==='bad'&&e.detail.requiredHeight>40);});
test('body cannot masquerade as an 18px body',()=>{assert.throws(()=>compileAuthoredPage(project(),req(txt('bad','text',{size:18}))),/AUTHORING_FONT_FLOOR/);});
test('invalid plans cannot produce empty backgrounds, hidden nodes or unknown kinds',()=>{const q=req();q.body.kind='magic';assert.throws(()=>compileAuthoredPage(project(),q),/INVALID_COMPOSE_REQUEST/);q.body={id:'g',kind:'group',tone:'accent'};assert.throws(()=>compileAuthoredPage(project(),q),/INVALID_COMPOSE_REQUEST/);});
test('unknown source, claim and figure IDs are rejected before export',()=>{const q=req();q.slide.paperIds=['ghost'];assert.throws(()=>compileAuthoredPage(project(),q),/AUTHORING_UNKNOWN_PAPER/);q.slide.paperIds=['P1'];q.slide.claimIds=['ghost'];assert.throws(()=>compileAuthoredPage(project(),q),/AUTHORING_UNKNOWN_CLAIM/);assert.throws(()=>compileAuthoredPage(project(),req({id:'f',kind:'figure',assetId:'ghost'})),/AUTHORING_UNKNOWN_ASSET/);});
test('duplicate nodes and phantom primary nodes are rejected',()=>{const q=req();q.body.children[1].id='left';assert.throws(()=>compileAuthoredPage(project(),q),/AUTHORING_DUPLICATE_NODE/);const q2=req();q2.intent.primaryNodeId='ghost';assert.throws(()=>compileAuthoredPage(project(),q2),/AUTHORING_UNKNOWN_INTENT_NODE/);});
test('recursive input depth and unsafe keys are bounded',()=>{const q=req();q.body=JSON.parse('{"id":"bad","kind":"text","role":"body","text":"x","__proto__":{}}');assert.throws(()=>compileAuthoredPage(project(),q),/UNSAFE_KEY/);});
test('table fits full strings and exposes source IDs on native objects',()=>{const q=req({id:'t',kind:'table',columns:['Scenario','Baseline','Method'],rows:[['A','6.440','5.826'],['B','7.960','6.356']],columnWeights:[1,2,2],claimIds:['C1']});const a=compileAuthoredPage(project(),q);assert.ok(a.slide.drawings[0].elements.some(e=>e.text==='5.826'));assert.ok(a.slide.drawings[0].elements.filter(e=>e.kind==='text').every(e=>e.claimIds?.includes('C1')));q.body.rows[0].pop();assert.throws(()=>compileAuthoredPage(project(),q),/AUTHORING_TABLE_DIMENSIONS/);});
test('oversized table fails instead of clipping rows or reducing fonts',()=>{const q=req({id:'t',kind:'table',columns:['A','B'],rows:Array.from({length:12},()=>['long '.repeat(30),'long '.repeat(30)])});assert.throws(()=>compileAuthoredPage(project(),q),/AUTHORING_TABLE_OVERFLOW/);});
test('flow source relations render with separate reserved feedback channel',()=>{const q=req({id:'flow',kind:'flow',nodes:[{id:'population',label:'Population',detail:'Current candidates'},{id:'agent',label:'RL agent',detail:'Operator choice',tone:'accent'},{id:'output',label:'Output',detail:'Scenario solutions'}],edges:[{from:'population',to:'agent',kind:'flow',label:'Reward'},{from:'agent',to:'output',kind:'flow'},{from:'agent',to:'population',kind:'feedback',label:'Action'}],claimIds:['C1']});const a=compileAuthoredPage(project(),q);assert.equal(a.report.warnings.some(i=>i.severity==='error'),false);assert.ok(a.slide.drawings[0].elements.filter(e=>e.role==='relationship').length===3);});
test('ambiguous crossing flow, self-loop and absent endpoints are not fabricated',()=>{const base={id:'f',kind:'flow',nodes:[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'}],edges:[{from:'a',to:'c',kind:'flow'}]};assert.throws(()=>compileAuthoredPage(project(),req(base)),/AUTHORING_FLOW_NONADJACENT/);base.edges=[{from:'a',to:'a',kind:'flow'}];assert.throws(()=>compileAuthoredPage(project(),req(base)),/AUTHORING_FLOW_EDGE/);});
test('source image bytes, aspect ratio and viewport survive compilation',async()=>{const p=project();p.assets=await embedAssets([asset],process.cwd());const a=compileAuthoredPage(p,req({id:'f',kind:'figure',assetId:'A1',caption:'Source figure'}));assert.equal(p.assets[0].data,asset.data);const fit=a.report.figureFits[0];assert.equal(fit.imageBox.w,fit.imageBox.h);assert.equal(fit.sourceViewport,null);assert.deepEqual(a.slide.figureIds,['A1']);});
test('explicit content-tree rejects automatic body routes, legacy remains warning',()=>{const p=project();p.slides=[{...req().slide,layout:'figure-focus',cards:[],figureIds:[]}];let report=compositionCraftReport(p,buildScenes(p));assert.equal(report.issues[0].severity,'warning');p.design.authoringMode='content-tree';report=compositionCraftReport(p,buildScenes(p));assert.equal(report.issues[0].severity,'error');p.slides=[compileAuthoredPage({...p,slides:[]},req()).slide];assert.equal(compositionCraftReport(p,buildScenes(p)).issues.filter(i=>i.code==='composition-authoring-route').length,0);});
test('authoring mode never changes the saved user palette or fills approvals',()=>{const p=project();p.design.authoringMode='content-tree';const original=structuredClone(p.design);compileAuthoredPage(p,req());assert.deepEqual(p.design,original);});
test('create versus replace is explicit; changing a page needs a concrete note',()=>{const p=project();p.slides=[compileAuthoredPage(p,req()).slide];assert.throws(()=>compileAuthoredPage(p,req()),/AUTHORING_SLIDE_EXISTS/);const q=req();q.mode='replace';assert.throws(()=>compileAuthoredPage(p,q),/AUTHORING_CHANGE_NOTE_REQUIRED/);q.changeNote='Use shared rows rather than side notes.';assert.ok(compileAuthoredPage(p,q).slide.composition);});
test('normal registered plan tool saves native composition and immutable input revision',async t=>{
 const cwd=await mkdtemp(join(tmpdir(),'dsh-compose-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 const tools=new Map(buildAcademicTools({}, {resolveCwd:async()=>cwd}).map(t=>[t.name,t]));const run=(name,args)=>tools.get('academic_ppt_'+name).execute(args,{});
 const created=await run('init',{projectDir:'deck',title:'Synthetic normal-tool composer',brief,design:{...fixtureDesign,authoringMode:'content-tree'}});
 let saved=await run('record',{projectPath:created.projectPath,expectedRevision:0,papers:[paper],claims:[claim]});
 const requestPath=join(cwd,'page.json');await writeFile(requestPath,JSON.stringify(req()));
 const built=await run('plan',{projectPath:created.projectPath,expectedRevision:saved.revision,requestPath});assert.ok(built.compositionBuild.planPath);assert.ok((await readFile(built.compositionBuild.planPath,'utf8')).includes('compose-page'));
 let p=JSON.parse(await readFile(created.projectPath));assertProject(p);assert.equal(p.slides[0].cards.length,0);assert.ok(p.slides[0].drawings.length);assert.equal(p.artifact,undefined);
 const stale=()=>run('plan',{projectPath:created.projectPath,expectedRevision:saved.revision,requestPath});await assert.rejects(stale(),/REVISION_CONFLICT/);
 const q=req();q.mode='replace';q.changeNote='Increase primary column width.';q.body.children[0].weight=3;await writeFile(requestPath,JSON.stringify(q));
 const changed=await run('plan',{projectPath:created.projectPath,expectedRevision:built.revision,requestPath});assert.equal(changed.revision,built.revision+1);
 const before=await readFile(created.projectPath);q.body.children[0].text='too long '.repeat(400);await writeFile(requestPath,JSON.stringify(q));await assert.rejects(run('plan',{projectPath:created.projectPath,expectedRevision:changed.revision,requestPath}),/AUTHORING_TEXT_OVERFLOW/);assert.ok(before.equals(await readFile(created.projectPath)));
 await assert.rejects(run('plan',{projectPath:created.projectPath,expectedRevision:changed.revision,requestPath:'/etc/passwd'}),/PATH_OUTSIDE_WORKSPACE/);
});
test('schema, semantic tree and geometry feedback actually reach native model output',async()=>{const c=await toolContract({topic:'authoring'}),out=formatToolResult('academic_ppt_contract',c);assert.ok(out.includes('compose-page'));assert.ok(out.includes('urn:dsh:page-authoring-node:1'));assert.ok(out.includes('feedback'));const p=compileAuthoredPage(project(),req());p.report.planPath='/workspace/plan.json';const visible=formatToolResult('academic_ppt_plan',{ok:true,compositionBuild:p.report});assert.ok(visible.includes('/workspace/plan.json'));assert.ok(visible.includes('left'));});
test('registered init defaults to content-tree while explicit legacy compatibility stays available',async t=>{
 const cwd=await mkdtemp(join(tmpdir(),'dsh-compose-default-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const tools=new Map(buildAcademicTools({}, {resolveCwd:async()=>cwd}).map(t=>[t.name,t]));const run=(n,a)=>tools.get('academic_ppt_'+n).execute(a,{});
 const fresh=await run('init',{projectDir:'new',title:'New agent path'});const p=JSON.parse(await readFile(fresh.projectPath));assert.equal(p.design.authoringMode,'content-tree');
 await assert.rejects(run('record',{projectPath:fresh.projectPath,expectedRevision:0,design:{authoringMode:'legacy'}}),/AUTHORING_REQUIREMENT_RELAXATION/);
 const legacy=await run('init',{projectDir:'old',title:'Explicit legacy compatibility',design:{authoringMode:'legacy'}});assert.equal(JSON.parse(await readFile(legacy.projectPath)).design.authoringMode,'legacy');
});
test('fully positioned academic drawings remain an authored route; decorative overlay on figure-focus does not',()=>{
 const p=project();p.design.authoringMode='content-tree';const slide=compileAuthoredPage(p,req()).slide;
 const box=slide.composition.regions[0].box;delete slide.composition;slide.drawings[0].box=box;p.slides=[slide];assert.equal(compositionCraftReport(p,buildScenes(p)).issues.filter(i=>i.code==='composition-authoring-route').length,0);
 slide.layout='figure-focus';assert.equal(compositionCraftReport(p,buildScenes(p)).issues[0].severity,'error');
});

test('authoring sidecar directory cannot escape the workspace through a symlink',async t=>{
 const cwd=await mkdtemp(join(tmpdir(),'dsh-sidecar-')),outside=await mkdtemp(join(tmpdir(),'dsh-outside-'));t.after(()=>Promise.all([rm(cwd,{recursive:true,force:true}),rm(outside,{recursive:true,force:true})]));
 const tools=new Map(buildAcademicTools({}, {resolveCwd:async()=>cwd}).map(t=>[t.name,t]));const run=(n,a)=>tools.get('academic_ppt_'+n).execute(a,{});
 const created=await run('init',{projectDir:'deck',title:'Bounded output'});await symlink(outside,join(cwd,'deck/page-authoring'));
 const q=req();q.slide.paperIds=[];q.slide.claimIds=[];const path=join(cwd,'page.json');await writeFile(path,JSON.stringify(q));const before=await readFile(created.projectPath);
 await assert.rejects(run('plan',{projectPath:created.projectPath,expectedRevision:0,requestPath:path}),/SYMLINK_OUTSIDE_WORKSPACE/);assert.ok(before.equals(await readFile(created.projectPath)));
});
test('shipped semantic examples compile or fail on explicit unregistered source placeholders',async()=>{
 const p=project();for(const name of ['shared-comparison','method-feedback']){const q=JSON.parse(await readFile(new URL('../examples/content-authoring/'+name+'.json',import.meta.url),'utf8'));assert.ok(compileAuthoredPage(p,q).slide.drawings[0].elements.length>0);}
 const q=JSON.parse(await readFile(new URL('../examples/content-authoring/paired-panels.json',import.meta.url),'utf8'));assert.throws(()=>compileAuthoredPage(p,q),/AUTHORING_UNKNOWN_ASSET/);
});
test('authored numerical tables are evidence carriers only when bound to their actual cells and verified numeric claims',async()=>{
 const {evidenceDesignReport}=await import('../src/evidence-design.mjs');const p=project();p.claims[0]={...p.claims[0],verified:true,metrics:[{label:'synthetic',value:'1',unit:'arbitrary',baseline:'fixed',denominator:'sample',aggregation:'none'}]};
 const q=req({id:'t',kind:'table',columns:['Condition','Readout'],rows:[['A','1.25'],['B','2.50']],claimIds:['C1']});q.slide.argument={role:'evidence',question:'Compare the exact cells?',contribution:'Shared row comparison',boundary:'Synthetic fixture only'};p.slides=[compileAuthoredPage(p,q).slide];
 let scenes=buildScenes(p),report=evidenceDesignReport(p,scenes);assert.ok(report.slides[0].hasAuthoredTable);assert.ok(report.slides[0].dataCarriers.includes('table'));assert.equal(report.slides[0].hasNativeTable,false);assert.ok(report.slides[0].scientificCarrierPaperIds.includes('P1'));
 p.slides[0].drawings[0].evidenceTables[0].cellIds[1][1]='missing-cell';scenes=buildScenes(p);assert.ok(scenes.issues.some(i=>i.code==='drawing-table-binding'));assert.equal(evidenceDesignReport(p,scenes).slides[0].hasAuthoredTable,false);
});

test('authored table metadata cannot convert spatially scattered text into a table',()=>{
 const p=project(),q=req({id:'t',kind:'table',columns:['A','B'],rows:[['x','1'],['y','2']],claimIds:['C1']});const slide=compileAuthoredPage(p,q).slide;
 const cellId=slide.drawings[0].evidenceTables[0].cellIds[1][1];slide.drawings[0].elements.find(e=>e.id===cellId).x-=20;
 const scenes=buildScenes({...p,slides:[slide]});assert.ok(scenes.issues.some(i=>i.code==='drawing-table-alignment'));
});

test('light accent and dark-page palettes select legible group text rather than forcing white on every colour',()=>{
 const p=project();p.design.palette={background:'#19212D',ink:'#F4F4F4',paper:'#19212D',accent:'#EEC35A',secondary:'#D68D54',muted:'#B9C2CC',line:'#617285',soft:'#283B4D',tint:'#283B4D'};
 const q=req({id:'light',kind:'group',tone:'accent',title:'A light accent',child:txt('inside','Read me')});const a=compileAuthoredPage(p,q);const body=a.slide.drawings[0].elements.find(e=>e.text==='Read me');assert.equal(body.color,'#17212B');assert.equal(a.slide.drawings[0].elements.find(e=>e.text==='A light accent').color,'#17212B');
});


test('new Agent draft cannot bypass authored-body route, while scientific draft remains possible after composition',async t=>{
 const cwd=await mkdtemp(join(tmpdir(),'dsh-draft-route-'));t.after(()=>rm(cwd,{recursive:true,force:true}));const tools=new Map(buildAcademicTools({}, {resolveCwd:async()=>cwd}).map(t=>[t.name,t]));const run=(n,a)=>tools.get('academic_ppt_'+n).execute(a,{});
 const design=structuredClone(fixtureDesign);delete design.authoringMode;const created=await run('init',{projectDir:'deck',title:'Draft route fixture',brief,design});
 const q=req();let saved=await run('record',{projectPath:created.projectPath,expectedRevision:0,papers:[paper],claims:[claim],slides:[{...q.slide,layout:'figure-focus',figureIds:[],cards:[]}]});
 const blocked=await run('build',{projectPath:created.projectPath,expectedRevision:saved.revision,mode:'draft'});assert.equal(blocked.ok,false);assert.equal(blocked.code,'AUTHORED_BODY_REQUIRED');assert.equal(JSON.parse(await readFile(created.projectPath)).artifact,undefined);
 q.mode='replace';q.changeNote='Replace automatic side slots with an explicit shared composition.';const path=join(cwd,'page.json');await writeFile(path,JSON.stringify(q));saved=await run('plan',{projectPath:created.projectPath,expectedRevision:saved.revision,requestPath:path});
 const built=await run('build',{projectPath:created.projectPath,expectedRevision:saved.revision,mode:'draft'});assert.equal(built.ok,true);assert.equal(built.status,'draft');assert.equal(built.verification.readyForDelivery,false);
});
