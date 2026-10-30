import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
import {createProject,updateRecords,contextProject} from '../src/core.mjs';
import {ACADEMIC_STYLE_IDS,getAcademicStyle} from '../src/academic-styles.mjs';
import {resolveDesign,buildScenes} from '../src/scene.mjs';
import {renderProject,tableRowStyle,sceneToSvg} from '../src/render.mjs';
import {assertToolArgs} from '../src/schema.mjs';
import {toolContract} from '../src/tool-contract.mjs';
import {designIssues} from '../src/design-quality.mjs';
import {compareProjectStructures} from '../src/portfolio.mjs';

const slide=()=>({id:'s',layout:'academic',title:'Held-out validation by site',section:{number:'2',title:'Validation'},
  notes:'Synthetic software fixture only. The values are not a scientific result.',seconds:60,paperIds:[],claimIds:[],figureIds:[],
  table:{columns:['Site','Observed count'],rows:[['A','12'],['B','14'],['C','11']],caption:'Synthetic counts; unit: plots',sourceClaimIds:[]},
  cards:[{id:'note',kind:'boundary',title:'Scope',body:'Compare sites under the same protocol. Do not infer causation.',claimIds:[]}],
  composition:{rows:[{panels:[{id:'data',title:'Common protocol',weight:1.6,table:true},{id:'notes',title:'Interpretation',weight:1,cardIds:['note']}]}]}});
const project=design=>({title:'Profile regression',brief:{},design,papers:[],claims:[],assets:[],slides:[slide()]});

test('six profiles alter real reading surfaces and preserve every supplied table value',()=>{
  const signatures=new Set();
  for(const id of ACADEMIC_STYLE_IDS){
    const p=project({styleProfile:id}),before=structuredClone(p),scenes=buildScenes(p),page=scenes.pages[0];
    assert.deepEqual(p,before,'Profile resolution must not mutate evidence or saved overrides.');
    assert.equal(page.issues.filter(i=>i.severity==='error').length,0,JSON.stringify(page.issues));
    const table=page.nodes.find(n=>n.kind==='table'),title=page.nodes.find(n=>n.id==='s/title');
    const body=page.nodes.find(n=>n.id==='s/card/note/body'),caption=page.nodes.find(n=>n.role==='caption');
    assert.deepEqual(table.table.rows,p.slides[0].table.rows);
    assert.equal(title.fontFamily,scenes.design.titleFontFamily);
    assert.equal(body.fontFamily,scenes.design.fontFamily);
    assert.equal(caption.fontFamily,scenes.design.annotationFontFamily);
    signatures.add(JSON.stringify([title.y,title.fontSize,title.fontFamily,body.fontSize,body.fontFamily,table.tableStyle,
      page.nodes.filter(n=>/composition.*(?:rule|frame|band|fill)/.test(n.id)).map(n=>[n.kind,n.id,n.strokeWidth])]));
  }
  assert.equal(signatures.size,6,'Directions must differ beyond palette names or marketing labels.');
});

test('profile overlays are explicit and a legacy design does not opt into new defaults',()=>{
  const overrides={styleProfile:'methods-whiteboard',fontFamily:'User Body',titleFontFamily:'User Title',annotationFontFamily:'User Notes',
    system:{header:'band'},tableStyle:'banded',palette:{accent:'#234567'}};
  const input=structuredClone(overrides),resolved=resolveDesign(input);
  assert.deepEqual(input,overrides);
  assert.equal(resolved.fontFamily,'User Body');assert.equal(resolved.titleFontFamily,'User Title');assert.equal(resolved.annotationFontFamily,'User Notes');
  assert.equal(resolved.system.header,'band');assert.equal(resolved.system.bodySize,30);assert.equal(resolved.tableStyle,'banded');
  assert.equal(resolved.palette.accent,'#234567');
  const legacy=resolveDesign({fontFamily:'Legacy Sans',system:{preset:'academic-defense'}});
  assert.equal(legacy.system.panel,'band');assert.equal(legacy.titleFontFamily,'Legacy Sans');
  assert.equal(legacy.tableStyle,undefined);assert.equal(legacy.projection,undefined);assert.equal(legacy.cardDefaults,undefined);
  assertToolArgs('academic_ppt_init',{projectDir:'x',title:'x',design:overrides});
  assert.throws(()=>assertToolArgs('academic_ppt_init',{projectDir:'x',title:'x',design:{styleProfile:'invented'}}),/INVALID_INPUT/);
});

test('scientific plot labels and source captions retain independent body and annotation families',()=>{
  const p=project({styleProfile:'paper-club'}),s=p.slides[0];
  delete s.table;s.cards=[];
  s.plot={kind:'interval',unit:'Synthetic units',groups:[{label:'A',estimate:2,lower:1,upper:3},{label:'B',estimate:4,lower:3,upper:5}],
    sourceClaimIds:['synthetic-estimates'],caption:'Synthetic software fixture; not a scientific finding.'};
  s.composition={rows:[{panels:[{id:'plot',title:'Common scale',plot:true}]}]};
  const scenes=buildScenes(p),page=scenes.pages[0];
  assert.deepEqual(page.issues.filter(i=>i.severity==='error'),[]);
  assert.equal(page.nodes.find(n=>n.role==='plot-group-label').fontFamily,'Noto Serif CJK SC');
  assert.equal(page.nodes.find(n=>n.role==='caption').fontFamily,'Noto Sans CJK SC');
  assert.deepEqual(page.nodes.filter(n=>n.role==='plot-estimate').map(n=>n.value),[2,4]);
});

test('native table style is independent of panel style in SVG and PowerPoint',async()=>{
  const p=project({styleProfile:'research-seminar',system:{panel:'band'},tableStyle:'three-line'});
  const output=await renderProject(p),page=output.scenes.pages[0],table=page.nodes.find(n=>n.kind==='table');
  assert.ok(page.nodes.some(n=>n.id.endsWith('/band')),'The chosen enclosing panel keeps its dark heading.');
  assert.equal(tableRowStyle(table,0,4).fill,table.palette.paper,'Three-line table header stays unfilled inside a banded panel.');
  assert.equal(tableRowStyle(table,1,4).bottomWidth,0);
  assert.equal(tableRowStyle(table,3,4).bottomWidth,1.3);
  const svg=sceneToSvg(page),group=/<g[^>]*role="table"[\s\S]*?<\/g>/.exec(svg)?.[0];
  assert.equal((group?.match(/<line /g)||[]).length,3,'The three-line table exports exactly its three rules.');
  const zip=unzipSync(output.pptx),xml=strFromU8(zip['ppt/slides/slide1.xml']);
  assert.match(xml,/<a:tbl>/);assert.match(xml,/Observed count/);assert.match(xml,/>14</);
  const tableXml=/<a:tbl>[\s\S]*?<\/a:tbl>/.exec(xml)?.[0];
  const bodyRows=[...tableXml.matchAll(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g)].slice(1,-1);
  for(const row of bodyRows)assert.ok([...row[0].matchAll(/<a:lnB[^>]*>([\s\S]*?)<\/a:lnB>/g)].every(m=>m[1].includes('<a:noFill/>')),
    'Interior body rows must not regain horizontal rules in PowerPoint.');
});

test('new projects keep sparse profile defaults and switching profiles preserves explicit choices',async t=>{
  const cwd=await mkdtemp(join(process.cwd(),'.test-profile-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const created=await createProject({cwd,projectDir:'deck',title:'Synthetic profile workflow'}),args={cwd,projectPath:created.projectPath};
  let p=JSON.parse(await readFile(created.projectPath,'utf8'));
  assert.equal(p.design.styleProfile,'research-seminar');assert.equal(p.design.density,'balanced');
  assert.equal(p.design.system,undefined,'Inferred defaults must not become explicit saved overrides.');
  await updateRecords({...args,expectedRevision:0,design:{styleProfile:'methods-whiteboard',system:{header:'rule'}}});
  await updateRecords({...args,expectedRevision:1,design:{styleProfile:'paper-club'}});
  p=JSON.parse(await readFile(created.projectPath,'utf8'));
  assert.equal(p.design.system.header,'rule');assert.equal(p.design.consultation.workflowVersion,2);
  const context=await contextProject(args);
  assert.deepEqual(context.resolvedDesign,resolveDesign(p.design),'Context must report the effective fonts and geometry used by export.');
  assert.equal(context.resolvedDesign.fontFamily,'Noto Serif CJK SC');
  assert.equal(context.resolvedDesign.system.header,'rule');assert.equal(context.resolvedDesign.system.bodySize,28);
  const contract=await toolContract({topic:'design'});
  assert.deepEqual(contract.academicStyles.map(s=>s.id),ACADEMIC_STYLE_IDS);
  const copy=getAcademicStyle();copy.defaults.system.panel='band';
  assert.equal(getAcademicStyle().defaults.system.panel,'plain','Catalog values must stay isolated.');
});

test('metadata-only initialization and consultation patches preserve sparse defaults',async t=>{
  const cwd=await mkdtemp(join(process.cwd(),'.test-profile-metadata-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const designs=[{density:'balanced'},{consultation:{mode:'collaborative'}},{fontFamily:'User Body'}];
  for(const [i,design] of designs.entries()){
    const created=await createProject({cwd,projectDir:'deck-'+i,title:'Synthetic partial design',design});
    const args={cwd,projectPath:created.projectPath};
    await updateRecords({...args,expectedRevision:0,design:{consultation:{mode:'collaborative',decisions:[
      {topic:'palette',status:'confirmed',selected:'synthetic selection',userResponse:'Synthetic protocol fixture only, not a real user approval.'},
    ]}}});
    const saved=JSON.parse(await readFile(created.projectPath,'utf8'));
    assert.equal(saved.design.styleProfile,'research-seminar');assert.equal(saved.design.system,undefined);
    const context=await contextProject(args);
    assert.equal(context.resolvedDesign.system.panel,'plain');assert.equal(context.resolvedDesign.tableStyle,'three-line');
    assert.equal(context.resolvedDesign.fontFamily,design.fontFamily??'Noto Sans CJK SC');
    assert.equal(saved.design.consultation.decisions[0].selected,'synthetic selection');
  }
});

test('standalone quality and structure checks use the same profile defaults as scenes',()=>{
  const p=project({styleProfile:'field-report',density:'compact'});
  p.slides[0].cards.push({...p.slides[0].cards[0],id:'second'});
  p.slides[0].composition={rows:[{panels:[{id:'notes',cardIds:['note','second']}]}]};
  const before=structuredClone(p);
  assert.ok(!designIssues(p).some(i=>i.code==='unframed-card-stack'),'The effective tinted group is recognized.');
  assert.deepEqual(p,before,'Read-only quality checks preserve sparse user records.');
  p.design.styleProfile='research-seminar';
  assert.ok(designIssues(p).some(i=>i.code==='unframed-card-stack'),'Explicit compact policy still reviews multiple open groups.');
  const cover={id:'cover',layout:'cover',title:'Synthetic profile comparison',paperIds:[],claimIds:[],figureIds:[],cards:[]};
  const entries=['research-seminar','thesis-defense'].map((id,i)=>({project:{...project({styleProfile:id}),id:String(i),slides:[cover]}}));
  const result=compareProjectStructures(entries);
  assert.equal(result.comparisons[0].matchingCover,false,'Sparse profiles must not be mistaken for the same default cover.');
  assert.deepEqual(result,compareProjectStructures(entries.map(entry=>({...entry,project:{...entry.project,design:resolveDesign(entry.project.design)}}))));
});
