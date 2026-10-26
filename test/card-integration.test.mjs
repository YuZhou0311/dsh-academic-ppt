import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createProject, updateRecords, editProject, buildProject } from '../src/core.mjs';
import { assertProject } from '../src/schema.mjs';
import { academicIssues } from '../src/academic-quality.mjs';
import { designIssues } from '../src/design-quality.mjs';
import { cardTextParts, cardHasContent } from '../src/card-content.mjs';
import { fixtureDesign, brief, paper, claim } from './fixtures.mjs';

const card=()=>({id:'readouts',kind:'result',preset:'metric-dual',title:'不同口径的测试读数',body:'保持分母和单位。',claimIds:['C1'],
  items:[{label:'计数',value:3,unit:'项 / 4 项',detail:'原样保留输入。'},{label:'未完成',value:1,unit:'项 / 4 项',detail:'这是合成软件测试。'}],
  note:'不能将不同口径合并为一个比例。'});
const slide=()=>({id:'s',layout:'academic',title:'合成测试',paperIds:['P1'],claimIds:['C1'],notes:'用于插件字段保留测试。',seconds:60,figureIds:[],cards:[card()],
  composition:{regions:[{id:'readouts',title:'',heading:'hidden',surface:'plain',padding:0,cardIds:['readouts'],box:{x:80,y:150,w:1000,h:490}}]}});
async function fixture(t){
  const root=resolve('.test-output');await mkdir(root,{recursive:true});
  const cwd=await mkdtemp(join(root,'card-integration-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const p=await createProject({cwd,projectDir:'project',title:'Card integration fixture',brief,design:fixtureDesign});
  await updateRecords({cwd,projectPath:p.projectPath,expectedRevision:0,papers:[paper],claims:[claim],slides:[slide()]});
  return {cwd,projectPath:p.projectPath};
}
const read=o=>readFile(o.projectPath,'utf8').then(JSON.parse);

test('structured copy cannot be silently attached to a legacy card or competing template',async t=>{
  const o=await fixture(t),p=await read(o);
  delete p.slides[0].cards[0].preset;
  assert.throws(()=>assertProject(p),/CARD_PRESET_REQUIRED/);
  p.slides[0].cards[0].preset='metric-dual';p.slides[0].cards[0].templateComponentId='template-card';
  assert.throws(()=>assertProject(p),/CARD_DESIGN_CONFLICT/);
});

test('structured items, zero values and notes participate in content and placeholder checks',async t=>{
  const o=await fixture(t),p=await read(o),c=p.slides[0].cards[0];
  c.body='';c.items[0].value=0;
  assert.ok(cardTextParts(c).includes('0'));assert.ok(cardHasContent(c));
  assert.equal(cardHasContent({title:'题名',badge:'01'}),false);
  c.items[1].detail='[待填实际验证条件]';
  assert.ok(academicIssues(p).some(x=>x.code==='unfilled-placeholder'));
  c.items[1].detail='保留实际验证条件。';c.note='[TODO 来源]';
  assert.ok(academicIssues(p).some(x=>x.code==='unfilled-placeholder'));
  c.note='原始版本限定。';
  p.slides[0].visualPlan={relationship:'comparison',primaryPanelId:'readouts',readingOrder:['readouts'],rationale:'比较两种口径并保留限定。',contentLayers:[{role:'evidence',panelIds:['readouts'],summary:'成组指标。'}]};
  assert.equal(designIssues(p).some(x=>x.severity==='error'&&x.code.includes('content-layer')),false);
});

test('scoped preset edits retain structured values, units, notes and all non-card objects',async t=>{
  const o=await fixture(t);await buildProject({...o,expectedRevision:1,mode:'draft'});
  const before=await read(o);
  const changed=await editProject({...o,expectedRevision:1,scope:'card-style',changes:[{slideId:'s',cardId:'readouts',patch:{preset:'metric-ledger'}}]});
  assert.ok(changed.preservation.protectedSceneObjects>0);
  const after=await read(o),a=after.slides[0].cards[0],b=before.slides[0].cards[0];
  assert.equal(a.preset,'metric-ledger');assert.deepEqual(cardTextParts(a),cardTextParts(b));
  assert.deepEqual(a.items,b.items);assert.equal(a.note,b.note);
  await assert.rejects(editProject({...o,expectedRevision:2,scope:'card-style',changes:[{slideId:'s',cardId:'readouts',patch:{items:[{label:'改了分母'}]}}]}),/CARD_STYLE_SCOPE/);
});
