import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {designCases,DESIGN_CASE_IDS,installedPlugin,authoringGuidance} from '../src/authoring-guidance.mjs';
import {buildAcademicTools,formatToolResult} from '../src/tools.mjs';
import {toolContract} from '../src/tool-contract.mjs';
import {designStudyIssues,designDialogueReport} from '../src/design-dialogue.mjs';
import {assertToolArgs} from '../src/schema.mjs';
import {getAcademicStyle} from '../src/academic-styles.mjs';
import {fixtureDesign} from './fixtures.mjs';
import {readRenderReceipt} from '../src/vendor/dsh-ppt-render.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const caseRoot=join(root,'skills/dsh-academic-ppt/references/design-cases');
const digest=b=>createHash('sha256').update(b).digest('hex');
const syntheticStudy=()=>({status:'reviewed',paletteRationale:'Synthetic protocol fixture: preserve protocol colors, not aesthetic approval.',designStudies:[{source:'design-case',referenceId:'evidence-ledger',previewPath:designCases()[2].previewPath,readingOrder:'Synthetic state fixture: objects, values and marks share a row.',evidenceHierarchy:'Synthetic fixture retains exact values with the paired comparison.',adaptation:'Synthetic test: longer real labels would require a wider first column; not a real viewing attestation.'}]});
test('contract exposes installed version and actual current case paths before full schemas',async()=>{
 const c=await toolContract({topic:'design'});assert.equal(c.installedPlugin.version,'0.10.0-rc.7');assert.equal(c.designCases.length,8);
 const text=formatToolResult('academic_ppt_contract',c);
 for(const id of DESIGN_CASE_IDS)assert.ok(text.indexOf('构图案例 '+id)<text.indexOf('完整JSON Schema'));
 for(const c of designCases()){assert.ok((await stat(c.previewPath)).isFile());assert.ok((await stat(c.explanationPath)).isFile());}
});
test('each current example retains native objects, construction identity, and actual render binding',async()=>{
 const catalog=JSON.parse(await readFile(join(caseRoot,'catalog.json')));
 assert.equal(catalog.identity,'constructed-teaching-data-not-research-results');assert.equal(catalog.publicSafe,true);
 for(const c of catalog.cases){
  for(const [f,h]of [['preview','previewSha256'],['pptx','pptxSha256'],['input','inputSha256'],['receipt','receiptSha256']])assert.equal(digest(await readFile(join(caseRoot,c[f]))),c[h]);
  const p=JSON.parse(await readFile(join(caseRoot,c.input)));assert.equal(p.slides.length,1);assert.deepEqual(p.assets,[]);assert.deepEqual(p.claims,[]);assert.deepEqual(p.papers,[]);
  const zip=unzipSync(await readFile(join(caseRoot,c.pptx)));const keys=Object.keys(zip).filter(k=>/^ppt\/slides\/slide\d+\.xml$/.test(k));assert.equal(keys.length,1);
  const xml=Buffer.from(zip[keys[0]]).toString();assert.equal((xml.match(/<p:pic>/g)||[]).length,0);assert.ok((xml.match(/<p:sp>/g)||[]).length>20);
  const receipt=readRenderReceipt(join(caseRoot,c.pptx),join(caseRoot,c.receipt));assert.equal(receipt.status,'rendered');assert.deepEqual(receipt.missingFonts,[]);
  assert.equal(c.sceneErrors,0);assert.equal(catalog.build.visualReview,'not-reviewed','Build must not self-certify visual quality.');
 }
});
test('current case source is a valid schema alternative, not an invented API field',()=>{
 assertToolArgs('academic_ppt_record',{projectPath:'p.json',expectedRevision:0,design:{referenceStudy:syntheticStudy()}});
 assert.deepEqual(designStudyIssues(syntheticStudy()),[]);
 const p={design:{mode:'content-led',consultation:{...structuredClone(fixtureDesign.consultation),workflowVersion:2,interaction:'checkpoints'},referenceStudy:syntheticStudy()},storyboard:{pages:Array.from({length:6},(_,i)=>({slideId:'s'+i}))},slides:[{id:'s0',cards:[]}]};
 assert.equal(designDialogueReport(p).issues.filter(i=>i.severity==='error').length,0);
 p.slides[0].cards=[{id:'c',preset:'research-tab'}];assert.ok(designDialogueReport(p).issues.some(i=>i.code==='card-reference-used-unreviewed'));
});
test('unknown case identities, missing adaptation and missing viewing paths are rejected',()=>{
 for(const patch of [{referenceId:'invented-case'},{adaptation:''},{previewPath:''}]){
  const s=syntheticStudy();Object.assign(s.designStudies[0],patch);assert.ok(designStudyIssues(s).length>0);
 }
});
test('new guidance does not mutate the saved consultation or silently upgrade viewing capability',async t=>{
 const cwd=await mkdtemp(join(resolve('.test-output'),'guidance-init-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
 const tool=buildAcademicTools().find(t=>t.name==='academic_ppt_init');const p=await tool.execute({projectDir:'project',title:'Synthetic startup state test'}, {agent:{session:{header:{cwd}}}});
 assert.equal(p.installedPlugin.version,installedPlugin.version);assert.ok(p.authoringGuidance.instruction.includes('read_image'));
 const saved=JSON.parse(await readFile(p.projectPath));assert.equal(saved.capabilities.imageInput,'unknown');assert.notEqual(saved.design.consultation.source?.status,'confirmed');
 assert.equal(saved.design.authoringGuidance,undefined);assert.equal(saved.authoringGuidance,undefined);
 assert.ok(p.designDialogue.requiresUserResponse);
});
test('runtime recovery and render/review guidance survive truncation without erasing questions',()=>{
 const data={ok:true,designDialogue:{nextAction:'ask-pilot-direction',stage:'pilot-direction',requiresUserResponse:true,questions:[{question:'Synthetic real checkpoint question'}]},records:[{collection:'slides',record:{id:'s',title:'long'.repeat(12000)}}]};
 const text=formatToolResult('academic_ppt_context',data);
 assert.ok(text.includes('Synthetic real checkpoint question'));assert.ok(text.includes('设计执行'));assert.ok(text.includes('design-cases'));
 assert.ok(text.indexOf('当前应向用户提出的问题')<text.indexOf('设计执行'));
 for(const name of ['render','review','build','check','deliver','plan','prepare'])assert.ok(formatToolResult('academic_ppt_'+name,{ok:true}).includes('设计执行'));
 assert.match(authoringGuidance('academic_ppt_review').instruction,/spaceCheck.*视觉锚点/);
});
test('legacy profile references no longer advertise sparse old galleries',()=>{
 assert.equal(getAcademicStyle('research-seminar').reference,'references/design-cases/README.md');
});
test('guidance does not change tool count or high-cost registered schemas',()=>{
 const tools=buildAcademicTools();assert.equal(tools.length,19);
 assert.ok(JSON.stringify(tools.map(t=>t.parameters)).length<50000);
 assert.equal(tools.find(t=>t.name==='academic_ppt_contract').parameters.properties.topic.enum.includes('design'),true);
});
test('current routes and historical warnings are shipped together',async()=>{
 for(const f of ['SKILL.md','references/academic-styles.md','references/design.md','references/workflow-v010.md'])assert.match(await readFile(join(root,'skills/dsh-academic-ppt',f),'utf8'),/design-cases|designCases/);
 assert.match(await readFile(join(caseRoot,'../academic-styles/README.md'),'utf8'),/不是当前审美正样本/);
 assert.match(await readFile(join(root,'skills/dsh-academic-ppt/references/card-design.md'),'utf8'),/工具可用不意味着必须调用/);
});

test('actual single-page PNG paths reach native model output before verbose risk records',()=>{
 const paths=['/workspace/render/page-1.png','/workspace/render/page-2.png'];
 for(const [name,value]of [['render',{pngPaths:paths}],['context',{render:{pngPaths:paths}}],['study',{rendering:{pngPaths:paths}}],['template',{preview:{pngPaths:paths}}]]){
  const visible=formatToolResult('academic_ppt_'+name,{ok:true,...value,reviewTargets:Array.from({length:30},(_,i)=>({id:'t'+i,message:'Risk detail '.repeat(100)}))});
  for(const path of paths)assert.ok(visible.includes(path));
  assert.ok(visible.indexOf(paths[0])<visible.indexOf('必须复核'));
 }
 const long=formatToolResult('academic_ppt_render',{ok:true,pngPaths:Array.from({length:20},(_,i)=>'/r/page-'+i+'.png')});
 assert.match(long,/共20页.*render-receipt.json/);
});
