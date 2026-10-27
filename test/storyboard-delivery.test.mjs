// Original synthetic software fixtures. These are not research results, user
// attachments, actual user decisions, or evidence of human/vision quality review.
// Real PPTX render calls test the renderer lifecycle; review records below are
// deliberately labelled protocol simulations and never certify a user deck.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm, cp, stat} from 'node:fs/promises';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {PNG} from 'pngjs';
import {unzipSync, strFromU8} from 'fflate';
import {DEFAULT_DESIGN} from '../src/core.mjs';
import {buildAcademicTools, TOOL_COMMANDS} from '../src/tools.mjs';
import {buildScenes} from '../src/scene.mjs';
import {storyboardReport, pilotFingerprint} from '../src/storyboard.mjs';
import {hash} from '../src/io.mjs';

const TEST_ONLY = 'Synthetic software test only; no user, human, or vision assessment is certified.';
const REQUIRED = 'Synthetic fixed input only';
const paperId = 'test-source';
const source = 'https://example.invalid/storyboard-software-test';
const tools = new Map(buildAcademicTools().map(tool => [tool.name, tool]));
const api = (cwd, name, args, signal) => tools.get(TOOL_COMMANDS[name]).execute(args,
  {signal, agent:{session:{header:{cwd}}}});
const readState = async path => JSON.parse(await readFile(path, 'utf8'));
const errors = result => result.issues.filter(issue => issue.severity === 'error');
const codes = issues => issues.map(issue => issue.code);

async function workspace(t) {
  const root=resolve('.test-output'); await mkdir(root,{recursive:true});
  const cwd=await mkdtemp(join(root,'storyboard-delivery-'));
  t.after(()=>rm(cwd,{recursive:true,force:true}));
  return cwd;
}

function originalImage({vertical=false}={}) {
  const image=new PNG({width:640,height:320});
  for(let y=0;y<image.height;y++) for(let x=0;x<image.width;x++) {
    const i=(y*image.width+x)*4;
    const stripe=vertical?x>=250&&x<390&&y>=40&&y<280:x>=80&&x<560&&y>=90&&y<230;
    image.data[i]=stripe?49:244; image.data[i+1]=stripe?91:247;
    image.data[i+2]=stripe?122:250; image.data[i+3]=255;
  }
  return PNG.sync.write(image);
}

function fixtures() {
  const design={...structuredClone(DEFAULT_DESIGN),density:'balanced',fontFamily:'DejaVu Sans',
    system:{...DEFAULT_DESIGN.system,header:'plain'},
    consultation:{mode:'delegated',delegation:TEST_ONLY+' The fixture explicitly simulates delegated design.'},
    referenceStudy:{status:'reviewed',componentStudies:[{source:'user-template',
      referenceId:'Original software-test reference / page 1 / annotation group',previewPath:'sources/original-frame-study.svg',
      frame:TEST_ONLY+' Fixture describes a pale fill, thin solid outline, no dashed border and no shadow.',
      titleTreatment:TEST_ONLY+' Fixture describes an open left-aligned title above the outline.',
      spacing:TEST_ONLY+' Fixture describes 16 px inner margins and 24 px between title and frame.',
      adaptation:TEST_ONLY+' The authored protocol/result/limits pages keep open native text and use no preset, so the fixture frame itself is intentionally not copied.'}],
      paletteRationale:TEST_ONLY+' Dark blue text and a neutral pale surface retain the synthetic raster color hierarchy without adding categorical meanings.'}};
  const brief={centralQuestion:'Can a fixed synthetic signal retain its identity through an authored report?',
    audience:'Software regression test authors',talkMinutes:5,targetPaperCount:1,requireFullText:true,
    requirePaperIntro:false,genre:'research-progress',qualityProfile:'academic',visualEvidence:{mode:'source-led'}};
  const paper={id:paperId,title:'Synthetic signal protocol (original software test, not a real article)',
    authors:['Software Test Fixture'],year:2026,journal:'Synthetic fixture specification',doi:'10.0000/software-fixture',
    url:source,version:'original test fixture v1',sourceType:'article',studyType:'system-evaluation',
    reading:{status:'full-text',sections:['Fixed input','Expected export','Scope limits'],source,
      notes:TEST_ONLY+' The entire synthetic specification is authored in this test file.'},
    methodSummary:'Compare the same fixed synthetic input with exported native content and embedded bytes.',
    limitations:['This original fixture establishes no scientific result and no general visual quality judgment.'],
    analysis:{question:'Does an authored workflow preserve the fixed synthetic input and its scope?',
      gap:'File existence alone cannot establish preservation of sources or review freshness.',
      mechanism:'Stable source identifiers connect synthetic evidence, native content, and the authored plan.',
      design:'Render the fixed fixture, inspect object identity programmatically, and exercise public workflow gates.',
      unitOfAnalysis:'One synthetic software workflow',comparators:['The fixed fixture input and exported artifacts'],
      validity:'The assertions apply only to the software paths exercised here and cannot certify real research.',
      locators:['fixtures() specification','originalImage() generated raster']},
    sourceCheck:{status:'verified',checkedAt:'2026-10-27T00:00:00.000Z',metadataSource:source,
      fullTextSource:'test/storyboard-delivery.test.mjs#fixtures',note:TEST_ONLY+' This is a synthetic source-record state.'},
    figureReview:{status:'selected',checkedSources:['test/storyboard-delivery.test.mjs#originalImage'],
      note:TEST_ONLY+' The selected raster is generated in this file without outside material.',
      candidates:[{figure:'Fixture 1',locator:'originalImage()',caption:'Original fixed stripe raster for byte-identity checks',
        decision:'selected',assetId:'test-raster'}]}};
  const reasoning={warrant:'The expected input is specified independently before export, so equality can reveal changes.',
    boundary:'The result applies only to these synthetic inputs and does not establish scientific or visual quality.'};
  const claim={id:'test-observation',paperId,kind:'reported',text:'The synthetic input contains one fixed stripe.',
    locator:'originalImage() stripe predicate',context:TEST_ONLY,verified:true,reasoning};
  const inference={...claim,id:'test-inference',kind:'inference',text:'Identity can be checked only within the tested conditions.',
    dependsOn:[claim.id],reasoning:{...reasoning,alternatives:'Passing one deterministic input does not rule out failures on other documents.'}};
  const proposal={...claim,id:'test-proposal',kind:'proposal',text:'A later test should add a distinct input pattern.',
    dependsOn:[inference.id],reasoning:{...reasoning,warrant:'A second independent pattern could exercise a currently untested case.'}};
  const asset={id:'test-raster',path:'sources/original-fixture.png',paperId,figure:'Fixture 1',
    caption:'Original synthetic raster',sourceUrl:source,sourceVersion:'original fixture v1',
    license:'Original software-test fixture, unrestricted',usage:'figure',provenance:'source',cropNote:'No crop',
    reading:{purpose:'evidence',contentType:'diagram',task:'overview',verifiedBy:'vision-model',
      note:TEST_ONLY+' The field represents a synthetic protocol state, not an actual visual judgment.'}};
  const text=(id,text,x,y,w,h,role='body')=>({id,kind:'text',text,x,y,w,h,fontSize:28,role});
  const drawing=(elements)=>({id:'content',width:1152,height:430,box:{x:64,y:170,w:1152,h:430},
    elements:elements.map(e=>e.points?{...e,points:e.points.map(p=>({x:p.x-64,y:p.y-170}))}:{...e,x:e.x-64,y:e.y-170})});
  const body=(id,title,role,claimIds,seconds,elements,extra={})=>({id,title,layout:'academic',paperIds:[paperId],claimIds,
    figureIds:[],cards:[],seconds,notes:TEST_ONLY+' Explain the fixed input and its stated boundary.',
    argument:{role,question:'What can this fixed synthetic input establish?',contribution:title,
      boundary:'This fixture establishes no real scientific result.'},
    drawings:[drawing([...elements,text('condition',REQUIRED,64,525,1120,70)])],...extra});
  const slides=[
    {id:'opening',layout:'cover',title:'Synthetic signal audit',subtitle:TEST_ONLY,paperIds:[],claimIds:[],figureIds:[],cards:[],
      notes:TEST_ONLY,seconds:20,cover:{presenter:'Original software fixture',occasion:'Workflow regression',variant:'minimal'}},
    body('protocol','Compare a fixed input','design',[claim.id],45,[
      text('input','Fixed source',80,215,300,80,'label'),text('export','Native export',470,215,300,80,'label'),
      text('compare','Identity check',860,215,300,80,'label'),
      {id:'flow-a',kind:'line',points:[{x:330,y:310},{x:450,y:310}],endArrow:true,role:'relationship'},
      {id:'flow-b',kind:'line',points:[{x:730,y:310},{x:850,y:310}],endArrow:true,role:'relationship'},
      text('scope','Use the identical source and fixed condition.',80,370,1080,90),
    ]),
    body('result','The original raster remains distinct','evidence',[claim.id],60,[
      {id:'source-image',kind:'image',assetId:asset.id,x:64,y:180,w:720,h:320},
      text('finding','One fixed stripe\nOriginal source identity',840,205,360,190),
    ]),
    body('limits','One test has a narrow boundary','limitation',[inference.id],45,[
      text('supported','Supported\nIdentity for the fixed input',64,210,520,220),
      text('unsupported','Unresolved\nOther documents and visual quality',650,210,550,220),
    ]),
    body('synthesis','Preservation requires a traceable source','synthesis',[inference.id],45,[
      text('logic','Source identity\nPreserved native content\nCurrent render and review',64,190,1120,270),
    ]),
    body('next-test','A second pattern remains a proposal','proposal',[proposal.id],55,[
      text('proposal','Proposed next test\nAdd a distinct pattern and compare both outcomes.',64,200,1120,250),
    ]),
    {id:'references',layout:'references',title:'Synthetic source specification',paperIds:[paperId],claimIds:[],figureIds:[],cards:[],
      seconds:30,notes:TEST_ONLY},
  ];
  const roles=['orientation','design','evidence','limitation','synthesis','proposal','references'];
  const plan={version:1,objective:'Exercise an authored signal report with explicit source and review identity',
    audienceTakeaway:'Only the tested synthetic preservation behavior is established.',
    throughline:'Fixed input, preservation check, boundary, and a clearly unimplemented next test.',
    pages:slides.map((slide,i)=>({slideId:slide.id,title:slide.title,role:roles[i],
      question:i===0?'What is being tested?':'What does this stage add to the synthetic argument?',
      claimIds:slide.claimIds,assetIds:slide.id==='result'?[asset.id]:[],
      warrant:'The authored fixture defines an independent expected input and an explicit scope.',
      boundary:'Software regression fixture, not a real research result or visual certification.',
      transition:i===slides.length-1?'':'The next stage resolves the remaining synthetic workflow question.',
      seconds:slide.seconds,layoutFamily:'custom',layoutReason:'Original native relationship diagram fits the stage.',
      ...(!['opening','references'].includes(slide.id)?{mustShow:[REQUIRED]}:{})})),
    decision:{status:'delegated',userResponse:TEST_ONLY+' Explicit simulated delegation for this software fixture.'},
    pilot:{coverSlideId:'opening',hardestSlideId:'result',sequenceSlideIds:['protocol','result','limits'],
      reason:'Include the cover, the source raster, and adjacent method/result/boundary tasks.'}};
  return {design,brief,paper,claims:[claim,inference,proposal],asset,slides,plan};
}

async function author(t,{all=false,plan=true,includeReferences=true,mutate}={}) {
  const cwd=await workspace(t),f=fixtures(); mutate?.(f);
  await mkdir(join(cwd,'sources')); await writeFile(join(cwd,f.asset.path),originalImage());
  await writeFile(join(cwd,'sources/original-frame-study.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><title>Original software-test component fixture; no human or vision review</title><text x="16" y="28" fill="#315B7A">Software-test annotation group</text><rect x="16" y="52" width="368" height="132" fill="#F4F7FA" stroke="#315B7A" stroke-width="1"/><text x="32" y="84" fill="#315B7A">Original fixture content</text></svg>');
  const created=await api(cwd,'init',{projectDir:'project',title:'Original synthetic workflow fixture',brief:f.brief,
    capabilities:f.capabilities??{imageInput:'supported',source:TEST_ONLY+' Capability is a software-test input.'}});
  const projectPath=created.projectPath;
  const invoke=(name,args={},signal)=>api(cwd,name,{projectPath,...args},signal);
  let revision=0;
  const record=async payload=>{const path=join(cwd,'records-'+revision+'.json');await writeFile(path,JSON.stringify(payload));
    const result=await invoke('record',{expectedRevision:revision,recordsPath:path});revision=result.revision;return result;};
  const writePlan=async (value=f.plan)=>{const path=join(cwd,'plan-'+revision+'.json');
    await writeFile(path,JSON.stringify({kind:'storyboard',storyboard:value}));
    const result=await invoke('plan',{expectedRevision:revision,requestPath:path});revision=result.revision;return result;};
  await record({design:f.design,papers:[f.paper],claims:f.claims,assets:[f.asset,...(f.extraAssets??[])],
    slides:all?f.slides:[...f.slides.slice(0,4),...(includeReferences?[f.slides.at(-1)]:[])]});
  if(plan)await writePlan();
  const pilot=async(decision='delegated')=>{await writeFile(join(cwd,'pilot-review.json'),JSON.stringify({kind:'pilot-review',decision,
    userResponse:TEST_ONLY+' Explicit simulated pilot choice.',notes:TEST_ONLY+' State-machine exercise only.'}));
    return invoke('plan',{expectedRevision:revision,requestPath:'pilot-review.json'});};
  const review=async(built,ids,result='passed',options={})=>invoke('review',{expectedRevision:revision,
    pptxSha256:built.pptxSha256,reviewer:'vision-model',basis:'pptx-render',reviewedSlides:ids,result,notes:TEST_ONLY,
    observations:ids.map(slideId=>({slideId,contentCheck:TEST_ONLY+' '+slideId+' content state.',
      legibilityCheck:TEST_ONLY+' '+slideId+' simulated review state.',issue:result==='needs-fix'?'Synthetic unresolved test issue.':''})),...options});
  const edit=async(changes)=>{const result=await invoke('edit',{expectedRevision:revision,scope:'slide-content',changes});
    revision=result.revision;return result;};
  return {cwd,f,projectPath,invoke,record,writePlan,pilot,review,edit,get revision(){return revision;}};
}

async function render(t,env) {
  const result=await env.invoke('render',{expectedRevision:env.revision});
  if(process.env.DSH_REQUIRE_REAL_RENDER==='1')assert.notEqual(result.status,'unavailable','Required render verification cannot skip an unavailable engine: '+result.message);
  if(result.status==='unavailable'){t.skip('Optional real renderer unavailable: '+result.message);return null;}
  assert.equal(result.status,'rendered',JSON.stringify(result));
  assert.deepEqual(result.missingFonts,[],'The English-only original fixture uses an available DejaVu font.');
  return result;
}

test('registered authoring exposes the plan contract and preserves an authored argument before export',async t=>{
  const env=await author(t),{cwd,invoke,projectPath,f}=env;
  const contract=await api(cwd,'contract',{topic:'storyboard'});
  assert.match(JSON.stringify(contract),/mustShow/);assert.match(JSON.stringify(contract),/pilot-review/);
  const before=await readFile(projectPath),status=await invoke('plan',{expectedRevision:env.revision});
  assert.equal(status.storyboard.summary.plannedPages,7);assert.equal(status.storyboard.summary.implementedPages,5);
  assert.equal(status.storyboard.pilot.status,'pending');assert.deepEqual(await readFile(projectPath),before);
  const markdown=await readFile(join(dirname(projectPath),'storyboard-r2.md'),'utf8');
  assert.match(markdown,/narrow boundary/);assert.match(markdown,/test-raster/);
  assert.deepEqual((await readState(projectPath)).storyboard,f.plan);
  await assert.rejects(invoke('plan',{expectedRevision:0}),/REVISION_CONFLICT/);
  await assert.rejects(invoke('plan',{expectedRevision:env.revision,requestPath:'../outside.json'}),/PATH_OUTSIDE_WORKSPACE/);
  for(const [name,bytes,pattern] of [
    ['bad.json',Buffer.from([0x7b,0xff,0x7d]),/INVALID_STORYBOARD_FILE/],
    ['large.json',Buffer.alloc(1024*1024+1,0x20),/FILE_LIMIT|FILE_TOO_LARGE|TOO_LARGE/],
    ['unsafe.json','{"kind":"storyboard","constructor":{}}',/unsafe JSON key/],
  ]) {await writeFile(join(cwd,name),bytes);await assert.rejects(invoke('plan',{expectedRevision:env.revision,requestPath:name}),pattern);}
  assert.deepEqual(await readFile(projectPath),before,'Invalid plan requests must not mutate the project.');
  const duplicate=structuredClone(f.plan);duplicate.pages[1].slideId=duplicate.pages[0].slideId;
  await assert.rejects(env.writePlan(duplicate),/DUPLICATE_STORYBOARD_PAGE/);
  assert.deepEqual(await readFile(projectPath),before);
});

test('a readable-storyboard filename collision preserves both the existing file and the entire project state',async t=>{
  const env=await author(t,{plan:false});
  const built=await env.invoke('build',{expectedRevision:env.revision,mode:'review'});assert.equal(built.ok,true);
  await env.review(built,[...env.f.slides.slice(0,4),env.f.slides.at(-1)].map(s=>s.id),'passed',{basis:'html-preview'});
  const before=await readFile(env.projectPath);
  const sentinel=join(dirname(env.projectPath),'storyboard-r'+(env.revision+1)+'.md');
  await writeFile(sentinel,'Original synthetic collision sentinel; preserve exactly.');
  await assert.rejects(env.writePlan(),/EEXIST|EXISTS|COLLISION/);
  assert.equal(await readFile(sentinel,'utf8'),'Original synthetic collision sentinel; preserve exactly.');
  assert.deepEqual(await readFile(env.projectPath),before,'A rejected plan write cannot consume a revision or discard a previous build/review.');
});

test('storyboard content guards detect lost claims, images, important text and invalid pilot/order choices',async t=>{
  const env=await author(t,{all:true}),project=await readState(env.projectPath);
  const report=(value)=>storyboardReport(value,buildScenes(value),{final:true});
  const initial=report(project);assert.ok(!codes(initial.issues).some(code=>/dropped|selection|drift/.test(code)));
  const loss=structuredClone(project),result=loss.slides.find(s=>s.id==='result');
  result.claimIds=[];result.drawings[0].elements=result.drawings[0].elements.filter(e=>e.kind!=='image'&&e.id!=='condition');
  result.notes+=' '+REQUIRED;
  const dropped=codes(report(loss).issues);
  for(const code of ['storyboard-claim-dropped','storyboard-asset-dropped','storyboard-asset-not-visible','storyboard-required-content-dropped'])assert.ok(dropped.includes(code),code);
  const footnote=structuredClone(project);footnote.slides.find(s=>s.id==='result').drawings[0].elements.find(e=>e.id==='condition').role='note';
  assert.ok(codes(report(footnote).issues).includes('storyboard-required-content-dropped'),'A required main-view condition cannot move into a note.');
  const missing=structuredClone(project);missing.claims=missing.claims.filter(c=>c.id!=='test-observation');missing.assets=[];
  assert.ok(codes(report(missing).issues).includes('storyboard-missing-claim'));assert.ok(codes(report(missing).issues).includes('storyboard-missing-asset'));
  const unplanned=structuredClone(project);unplanned.slides.push({...unplanned.slides[0],id:'surprise'});
  assert.ok(codes(report(unplanned).issues).includes('storyboard-unplanned-slide'));
  const order=structuredClone(project);[order.slides[1],order.slides[2]]=[order.slides[2],order.slides[1]];
  assert.ok(codes(report(order).issues).includes('storyboard-order-drift'));
  for(const patch of [{sequenceSlideIds:['protocol','limits','result']},{sequenceSlideIds:['protocol','result','result']},
    {hardestSlideId:'opening'},{coverSlideId:'protocol'}]){
    const changed=structuredClone(project);Object.assign(changed.storyboard.pilot,patch);
    assert.ok(report(changed).issues.some(i=>i.severity==='error'&&i.code.startsWith('storyboard-pilot-')));
  }
});

test('unknown page recipes and unrecorded direction stay actionable through the public plan/check tools',async t=>{
  const env=await author(t,{mutate:f=>{f.plan.pages[2].layoutFamily='not-a-real-page-recipe';f.plan.decision={status:'proposed'};}});
  const checked=await env.invoke('check');
  assert.ok(codes(checked.storyboard.issues).includes('storyboard-unknown-layout'));
  assert.ok(checked.storyboard.issues.some(i=>i.code==='storyboard-direction-unresolved'&&i.severity==='error'));
  assert.equal(checked.delivery.readyForDelivery,false);
  const blocked=await env.invoke('deliver',{expectedRevision:env.revision,outputDir:'not-delivered'});
  assert.equal(blocked.status,'blocked');await assert.rejects(stat(join(env.cwd,'not-delivered')),/ENOENT/);
  await assert.rejects(env.invoke('deliver',{expectedRevision:env.revision,outputDir:'forced',force:true}),/INVALID_INPUT/);
});

test('missing future evidence remains an explicit planning gap and cannot be silently promoted into completed work',async t=>{
  const env=await author(t,{mutate:f=>{f.plan.pages[5].claimIds=['future-claim'];f.plan.pages[5].assetIds=['future-asset'];}});
  let checked=await env.invoke('check');
  for(const code of ['storyboard-missing-claim','storyboard-missing-asset']){
    assert.ok(checked.storyboard.issues.some(i=>i.code===code&&i.slideId==='next-test'&&i.severity==='warning'));
  }
  assert.ok(codes(checked.storyboard.issues).includes('storyboard-pages-missing'));
  const before=await readFile(env.projectPath);
  await assert.rejects(env.record({assets:[{...env.f.asset,id:'future-asset',path:'sources/not-acquired.png'}]}),/FILE_NOT_FOUND/);
  assert.deepEqual(await readFile(env.projectPath),before);
  await env.record({slides:[{...env.f.slides[5],claimIds:['future-claim'],figureIds:['future-asset']}],
    slideOrder:['opening','protocol','result','limits','next-test','references']});
  checked=await env.invoke('check');
  for(const code of ['storyboard-missing-claim','storyboard-missing-asset']){
    assert.ok(checked.storyboard.issues.some(i=>i.code===code&&i.slideId==='next-test'&&i.severity==='error'));
  }
  assert.ok(codes(checked.issues).includes('dangling-claim'));assert.ok(codes(checked.issues).includes('dangling-figure'));
  assert.equal((await env.invoke('build',{expectedRevision:env.revision,mode:'review'})).status,'blocked');
});

test('public pilot approval fails before a valid pilot is planned and implemented',async t=>{
  const env=await author(t,{plan:false});await assert.rejects(env.pilot(),/PILOT_PLAN_REQUIRED/);
  const missing=structuredClone(env.f.plan);missing.pilot.hardestSlideId='synthesis';
  await env.writePlan(missing);await assert.rejects(env.pilot(),/PILOT_SLIDES_MISSING/);
  const invalid=structuredClone(env.f.plan);invalid.pilot.sequenceSlideIds=['protocol','limits','result'];
  await env.writePlan(invalid);await assert.rejects(env.pilot(),/PILOT_PLAN_INVALID/);
});

test('a long deck requires a storyboard and an unknown vision capability cannot attest visual approval',async t=>{
  const env=await author(t,{all:true,plan:false,mutate:f=>{f.capabilities={imageInput:'unknown',source:TEST_ONLY+' Unverified capability fixture.'};}});
  const checked=await env.invoke('check');assert.equal(checked.storyboard.required,true);assert.equal(checked.storyboard.present,false);
  assert.ok(checked.delivery.blockers.some(b=>b.code==='storyboard-required'));
  const built=await env.invoke('build',{expectedRevision:env.revision,mode:'review'});assert.equal(built.ok,true,JSON.stringify(built.issues));
  await assert.rejects(env.review(built,env.f.slides.map(s=>s.id),'passed',{basis:'html-preview'}),/VISION_UNVERIFIED/);
  const before=await readFile(env.projectPath);
  await assert.rejects(env.invoke('deliver',{expectedRevision:env.revision,outputDir:'cancelled'},AbortSignal.abort(new Error('synthetic cancellation'))),/synthetic cancellation/);
  assert.deepEqual(await readFile(env.projectPath),before);await assert.rejects(stat(join(env.cwd,'cancelled')),/ENOENT/);
});

test('pilot fingerprint follows science, source, design and story changes while permitting planned expansion',async t=>{
  const env=await author(t),project=await readState(env.projectPath),before=pilotFingerprint(project);
  const extended=structuredClone(project);extended.slides.splice(4,0,...env.f.slides.slice(4,6));
  assert.equal(pilotFingerprint(extended),before,'Adding already planned pages must preserve the pilot direction.');
  const decision=structuredClone(project);decision.storyboard.decision.userResponse+=' Restated simulated answer.';
  assert.equal(pilotFingerprint(decision),before,'Recording an equivalent direction answer changes no actual pilot content.');
  for(const mutate of [
    p=>{p.slides[2].title='Changed interpretation of the synthetic result';},
    p=>{p.claims.find(c=>c.id==='test-observation').text+=' Changed scientific condition.';},
    p=>{p.papers[0].version='changed source version';},
    p=>{p.assets[0].sha256='0'.repeat(64);},
    p=>{p.design.fontFamily='Another font';},
    p=>{p.design.palette.accent='#123456';},
    p=>{p.brief.centralQuestion='A different question';},
    p=>{p.storyboard.pages[5].boundary='A changed argument boundary, even on a not-yet-built page.';},
  ]){const changed=structuredClone(project);mutate(changed);assert.notEqual(pilotFingerprint(changed),before);}
});

test('a genuine rendered pilot can be approved, expanded, fully reviewed and delivered without overwriting files',async t=>{
  const env=await author(t),pilotIds=env.f.slides.slice(0,4).map(s=>s.id);
  const initial=await env.invoke('check');assert.deepEqual(errors(initial),[],JSON.stringify(errors(initial),null,2));
  await assert.rejects(env.pilot(),/PILOT_ACTUAL_RENDER_REQUIRED/);
  const built=await env.invoke('build',{expectedRevision:env.revision,mode:'review'});
  assert.equal(built.ok,true,JSON.stringify(built.issues));assert.equal(built.verification.readyForDelivery,false);
  const originalPptx=await readFile(built.files.pptx);
  await env.review(built,pilotIds,'passed',{basis:'html-preview'});
  await assert.rejects(env.pilot(),/PILOT_ACTUAL_RENDER_REQUIRED/);
  const firstRender=await render(t,env);if(!firstRender)return;
  // This mutation is a synthetic renderer-warning state, not a claim that this
  // actual render lacked fonts. Restore the genuine receipt before continuing.
  const receiptBytes=await readFile(firstRender.receiptPath),receipt=JSON.parse(receiptBytes.toString('utf8'));
  await writeFile(firstRender.receiptPath,JSON.stringify({...receipt,missingFonts:['SyntheticMissingFont']}));
  await assert.rejects(env.pilot(),/PILOT_FONTS_MISSING/);
  assert.ok((await env.invoke('check')).delivery.blockers.some(b=>b.code==='missing-fonts'));
  await writeFile(firstRender.receiptPath,receiptBytes);
  await assert.rejects(env.pilot(),/PILOT_REVIEW_REQUIRED/);
  await assert.rejects(env.review(built,pilotIds,'passed',{observations:[]}),/INVALID_INPUT|PER_SLIDE_REVIEW_REQUIRED/);
  await assert.rejects(env.review(built,pilotIds,'passed',{reviewedSlides:['missing-slide']}),/INVALID_REVIEW_SLIDES/);
  await assert.rejects(env.review(built,pilotIds,'passed',{observations:pilotIds.map(slideId=>({slideId,contentCheck:TEST_ONLY,
    legibilityCheck:TEST_ONLY,issue:'Synthetic unresolved issue'}))}),/UNRESOLVED_REVIEW_ISSUES/);
  await env.review(built,pilotIds,'needs-fix');await assert.rejects(env.pilot(),/PILOT_REVIEW_REQUIRED/);
  await env.review(built,pilotIds);
  const confirmed=await env.pilot('confirmed');assert.equal(confirmed.storyboard.pilot.status,'reviewed');
  assert.equal(confirmed.pilotReview.attestation.includes('not-independent-confirmation'),true);
  const unfinished=await env.invoke('deliver',{expectedRevision:env.revision,outputDir:'premature'});
  assert.equal(unfinished.status,'blocked');assert.ok(codes(unfinished.storyboard.issues).includes('storyboard-pages-missing'));
  await env.record({slides:env.f.slides.slice(4,6),slideOrder:env.f.slides.map(s=>s.id)});
  const expanded=await env.invoke('plan',{expectedRevision:env.revision});assert.equal(expanded.storyboard.pilot.status,'reviewed');
  await assert.rejects(env.review(built,pilotIds),/STALE_REVIEW/);
  const finalBuild=await env.invoke('build',{expectedRevision:env.revision,mode:'review'});
  assert.equal(finalBuild.ok,true,JSON.stringify(finalBuild.issues));
  const finalRender=await render(t,env);if(!finalRender)return;
  await env.review(finalBuild,pilotIds);
  let checked=await env.invoke('check');
  assert.ok(checked.delivery.blockers.some(b=>b.code==='visual-review-incomplete'&&b.slideIds.includes('next-test')));
  await env.review(finalBuild,env.f.slides.slice(4).map(s=>s.id));
  checked=await env.invoke('check');assert.equal(checked.delivery.readyForDelivery,true,JSON.stringify(checked.delivery));
  await mkdir(join(env.cwd,'keep'));await writeFile(join(env.cwd,'keep','sentinel.txt'),'do not replace');
  await assert.rejects(env.invoke('deliver',{expectedRevision:env.revision,outputDir:'keep'}),/EEXIST|EXISTS|NEW_DIRECTORY/);
  assert.equal(await readFile(join(env.cwd,'keep','sentinel.txt'),'utf8'),'do not replace');
  await assert.rejects(env.invoke('deliver',{expectedRevision:env.revision,outputDir:'../escape'}),/PATH_OUTSIDE_WORKSPACE/);
  const delivered=await env.invoke('deliver',{expectedRevision:env.revision,outputDir:'delivery'});
  assert.equal(delivered.status,'ready');assert.equal(delivered.verification.visual,'reported-passed');
  const manifest=await readState(delivered.files.manifest);
  for(const item of manifest.files){const bytes=await readFile(join(delivered.outputDir,item.file));
    assert.equal(hash(bytes),item.sha256,item.file);assert.equal(bytes.length,item.byteLength,item.file);}
  assert.deepEqual(await readFile(delivered.files.pptx),await readFile(finalBuild.files.pptx));
  assert.equal(hash(await readFile(delivered.files.pptx)),delivered.pptxSha256);
  assert.ok(manifest.files.some(f=>f.kind==='pdf'));assert.equal(manifest.files.filter(f=>f.kind.startsWith('preview-')).length,7);
  const notes=await readFile(delivered.files.speech,'utf8');for(const s of env.f.slides)assert.ok(notes.includes(s.id));
  const sourceRecords=await readState(delivered.files.evidence);assert.equal(sourceRecords.papers[0].sourceCheck.fullTextSource,env.f.paper.sourceCheck.fullTextSource);
  const zip=unzipSync(await readFile(delivered.files.pptx));
  const slideXml=Object.entries(zip).filter(([name])=>/^ppt\/slides\/slide\d+\.xml$/.test(name)).map(([,bytes])=>strFromU8(bytes)).join('\n');
  assert.ok(slideXml.includes(REQUIRED));assert.ok(Object.keys(zip).some(name=>name.startsWith('ppt/media/')));
  assert.deepEqual(await readFile(built.files.pptx),originalPptx,'Later builds and delivery must preserve prior editable exports.');
  await assert.rejects(env.invoke('deliver',{expectedRevision:env.revision,outputDir:'delivery'}),/EEXIST|EXISTS|NEW_DIRECTORY/);
  // Stale output and stale actual render bytes both block a fresh package,
  // while preserving the already delivered immutable bundle.
  const htmlBytes=await readFile(finalBuild.files.html);await writeFile(finalBuild.files.html,'Synthetic external output edit');
  checked=await env.invoke('check');assert.equal(checked.artifact.current,false);
  await assert.rejects(env.review(finalBuild,pilotIds),/STALE_REVIEW/);
  const staleOutput=await env.invoke('deliver',{expectedRevision:env.revision,outputDir:'changed-output'});
  assert.equal(staleOutput.status,'blocked');await assert.rejects(stat(join(env.cwd,'changed-output')),/ENOENT/);
  await writeFile(finalBuild.files.html,htmlBytes);
  const previewPath=finalRender.pngPaths[0],previewBytes=await readFile(previewPath);
  await writeFile(previewPath,Buffer.from('Synthetic corrupted render output'));
  checked=await env.invoke('check');assert.notEqual(checked.render.status,'rendered');assert.equal(checked.delivery.readyForDelivery,false);
  await assert.rejects(env.review(finalBuild,pilotIds),/PPTX_RENDER_REQUIRED/);
  await writeFile(previewPath,previewBytes);
  assert.equal((await env.invoke('check')).delivery.readyForDelivery,true);
  // Move only the delivered files to a separate workspace and delete the source
  // image: a rebuild must use embedded bytes and must demand fresh final review.
  const portable=join(env.cwd,'portable');await cp(delivered.outputDir,portable,{recursive:true});
  await rm(join(env.cwd,'sources'),{recursive:true});
  const recovery=join(portable,'rebuild-project.json'),restored=await readState(recovery);
  assert.equal(restored.artifact,undefined);assert.equal(restored.visualReviews,undefined);assert.deepEqual(restored.history,[]);
  assert.ok(restored.assets[0].data.startsWith('data:image/png;base64,'));
  const portableCheck=await api(portable,'check',{projectPath:recovery});assert.equal(portableCheck.summary.errors,0);
  assert.equal(portableCheck.delivery.readyForDelivery,false);assert.equal(portableCheck.artifact.current,false);
  const rebuilt=await api(portable,'build',{projectPath:recovery,expectedRevision:restored.revision,mode:'review'});
  assert.equal(rebuilt.ok,true);assert.equal(rebuilt.verification.readyForDelivery,false);
  const portableZip=unzipSync(await readFile(rebuilt.files.pptx));
  for(const name of Object.keys(zip).filter(name=>name.startsWith('ppt/media/')))assert.deepEqual(portableZip[name],zip[name]);
  await env.edit([{slideId:'result',patch:{title:'A revised synthetic interpretation'}}]);
  checked=await env.invoke('check');assert.equal(checked.storyboard.pilot.status,'stale');
  assert.equal(checked.delivery.readyForDelivery,false);assert.deepEqual(await readFile(delivered.files.pptx),await readFile(finalBuild.files.pptx));
  t.diagnostic('Actual renderer used for cover/method/result/boundary pilot plus bibliography and 7-page final deck. Review entries were labelled software-state simulations, not human/vision QA.');
});

test('staged pilot defers only explicitly planned final bibliography and future source figures',async t=>{
  const futureAssetId='future-source-raster';
  const env=await author(t,{includeReferences:false,mutate:f=>{
    const {path,...metadata}=f.asset;
    f.extraAssets=[{...metadata,id:futureAssetId,figure:'Fixture 2',caption:'Original vertical-stripe software fixture',
      data:'data:image/png;base64,'+originalImage({vertical:true}).toString('base64')}];
    f.paper.figureReview.candidates.push({figure:'Fixture 2',locator:'originalImage({vertical:true})',
      caption:'Original second source raster for a later synthesis page',decision:'selected',assetId:futureAssetId});
    f.plan.pages.find(page=>page.slideId==='synthesis').assetIds=[futureAssetId];
  }});
  const pilotIds=env.f.slides.slice(0,4).map(slide=>slide.id);
  const pendingCodes=['reference-entry','selected-source-figure-not-used'];
  let checked=await env.invoke('check');
  assert.deepEqual(codes(errors(checked)).sort(),pendingCodes);
  assert.equal(checked.slides.some(slide=>slide.id==='references'),false,'The final bibliography has not been implemented early.');
  assert.ok(checked.storyboard.issues.some(issue=>issue.code==='storyboard-pages-missing'));
  const pendingFigure=checked.issues.find(issue=>issue.code==='selected-source-figure-not-used');
  assert.equal(pendingFigure.assetId,futureAssetId);
  const draft=await env.invoke('build',{expectedRevision:env.revision,mode:'draft'});
  assert.equal(draft.status,'draft');assert.deepEqual(codes(errors(draft)).sort(),pendingCodes);
  if(!await render(t,env))return;
  await env.review(draft,pilotIds);
  const approved=await env.pilot();
  assert.equal(approved.storyboard.pilot.status,'reviewed');
  assert.deepEqual(codes(approved.deferredFinalIssues).sort(),pendingCodes);
  assert.equal(approved.deferredFinalIssues.find(issue=>issue.code==='selected-source-figure-not-used').assetId,futureAssetId);
  assert.deepEqual([...approved.pilotReview.slideIds].sort(),[...pilotIds].sort(),'Approval covers the actual pilot subset only.');
  const persisted=await readState(env.projectPath);
  assert.equal(persisted.slides.length,4);assert.equal(persisted.assets.length,2);
  assert.equal(buildScenes(persisted).pages.flatMap(page=>page.nodes).some(node=>node.kind==='image'&&node.assetId===futureAssetId),false);
  checked=await env.invoke('check');
  assert.deepEqual(codes(errors(checked)).sort(),pendingCodes,'Pilot deferral must not alter full-report source checks.');
  assert.equal(checked.delivery.readyForDelivery,false);
  const premature=await env.invoke('deliver',{expectedRevision:env.revision,outputDir:'pending-final'});
  assert.equal(premature.status,'blocked');assert.deepEqual(codes(errors(premature)).sort(),pendingCodes);
  assert.ok(premature.delivery.blockers.some(blocker=>blocker.code==='static-errors'));
  await assert.rejects(stat(join(env.cwd,'pending-final')),/ENOENT/);

  // Remove only the future assignment, retaining the real selected figure,
  // source verification and planned references page. A fresh real render is
  // needed to ensure this assertion reaches the source gate, not a stale hash.
  const unassigned=structuredClone(env.f.plan);
  unassigned.pages.find(page=>page.slideId==='synthesis').assetIds=[];
  await env.writePlan(unassigned);
  assert.equal((await env.invoke('check')).storyboard.pilot.status,'stale');
  const unassignedDraft=await env.invoke('build',{expectedRevision:env.revision,mode:'draft'});
  assert.deepEqual(codes(errors(unassignedDraft)).sort(),pendingCodes);
  if(!await render(t,env))return;
  await env.review(unassignedDraft,pilotIds);
  const beforeRejection=await readFile(env.projectPath);
  await assert.rejects(env.pilot(),/PILOT_HAS_ERRORS/);
  assert.deepEqual(await readFile(env.projectPath),beforeRejection,'A selected figure with no future page assignment cannot acquire a new pilot approval.');
  assert.equal((await env.invoke('check')).delivery.readyForDelivery,false);
  t.diagnostic('Two actual pilot renders exercised valid stage deferral and rejection after removing only the future figure assignment. Final source errors remained visible throughout.');
});

test('pilot approval rejects a source error even when a draft really rendered and review state says passed',async t=>{
  const cases=[
    ['unverified-claim',f=>{f.claims[0].verified=false;}],
    ['full-text-required',f=>{f.paper.reading.status='abstract-only';}],
    ['source-check-incomplete',f=>{f.paper.sourceCheck.status='partial';}],
  ];
  for(const [code,mutate] of cases)await t.test(code,async t=>{
    const env=await author(t,{mutate});
    const blocked=await env.invoke('build',{expectedRevision:env.revision,mode:'review'});
    assert.equal(blocked.status,'blocked');assert.deepEqual(codes(errors(blocked)),[code]);
    const draft=await env.invoke('build',{expectedRevision:env.revision,mode:'draft'});assert.equal(draft.status,'draft');
    if(!await render(t,env))return;
    await env.review(draft,env.f.slides.slice(0,4).map(s=>s.id));
    await assert.rejects(env.pilot(),/PILOT_HAS_ERRORS|PILOT_SOURCE|PILOT_EVIDENCE/);
    const delivery=await env.invoke('deliver',{expectedRevision:env.revision,outputDir:'must-not-exist'});
    assert.equal(delivery.status,'blocked');assert.ok(delivery.delivery.blockers.some(b=>b.code==='draft-not-deliverable'));
    assert.ok(delivery.delivery.blockers.some(b=>b.code==='static-errors'));await assert.rejects(stat(join(env.cwd,'must-not-exist')),/ENOENT/);
  });
});

test('CLI discovers the new workflow and reports a blocked delivery with a non-success status',async t=>{
  const env=await author(t),cli=fileURLToPath(new URL('../bin/academic-ppt.mjs',import.meta.url));
  const run=(args)=>spawnSync(process.execPath,[cli,...args],{cwd:env.cwd,encoding:'utf8',maxBuffer:4*1024*1024});
  const discovery=run(['plan','--schema']);
  if(discovery.error?.code==='EPERM'){t.skip('Sandbox blocks nested Node processes; registered tools are exercised separately.');return;}
  assert.ifError(discovery.error);assert.equal(discovery.status,0,discovery.stderr);
  assert.ok(JSON.parse(discovery.stdout).properties.requestPath);
  await writeFile(join(env.cwd,'cli-plan.json'),JSON.stringify({projectPath:env.projectPath,expectedRevision:env.revision}));
  const plan=run(['plan','--args','cli-plan.json','--json']);assert.equal(plan.status,0,plan.stderr);
  assert.equal(JSON.parse(plan.stdout).storyboard.summary.plannedPages,7);
  await writeFile(join(env.cwd,'cli-deliver.json'),JSON.stringify({projectPath:env.projectPath,expectedRevision:env.revision,outputDir:'cli-output'}));
  const delivery=run(['deliver','--args','cli-deliver.json','--json']);assert.equal(delivery.status,2,delivery.stderr);
  assert.equal(JSON.parse(delivery.stdout).status,'blocked');await assert.rejects(stat(join(env.cwd,'cli-output')),/ENOENT/);
});
