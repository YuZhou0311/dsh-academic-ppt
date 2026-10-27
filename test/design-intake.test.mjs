import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm, copyFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { prepareDesign, preparationRequestSchema } from '../src/design-intake.mjs';
import { buildAcademicTools, formatToolResult } from '../src/tools.mjs';
import { inspectTemplate } from '../src/template.mjs';

async function fixture(t) {
  const root=resolve('.test-output');await mkdir(root,{recursive:true});
  const cwd=await mkdtemp(join(root,'prepare-design-'));
  t.after(()=>rm(cwd,{recursive:true,force:true}));
  const requestPath=join(cwd,'request.json');
  const prepare=async (request,extra={})=>{await writeFile(requestPath,JSON.stringify(request));return prepareDesign({cwd,requestPath,...extra});};
  return {cwd,requestPath,prepare};
}

const report={topic:'观测误差的分解',audience:'方法研究组',consultation:{mode:'delegated',delegation:'Synthetic tests explicitly delegate preferences to isolate existing template and imagegen planning.'}};
const card={id:'question',purpose:'研究问题',title:'尺度变化后的误差来源',body:'区分观测噪声与模型结构误差。',evidenceStatus:'proposal',items:[{label:'当前证据',detail:'尚待跨尺度检验。'}]};
const host={availability:'available',source:'Synthetic test fixture declares a host tool; no actual service call.',toolName:'fixture_image_generator'};

test('prepare proposes the template question once without claiming the host has asked it',async t=>{
  const {prepare}=await fixture(t), first=await prepare(report);
  assert.equal(first.nextAction,'ask-template-once');
  assert.equal(first.template.question.noResponseStatus,'unanswered');
  assert.deepEqual(first.template.question.options.map(o=>o.value),['provided','none','awaiting-upload']);
  assert.match(first.template.instructions.join(' '),/尚未.*提问界面/);
  for(const status of ['none','unanswered','awaiting-upload']){
    const next=await prepare({...report,template:{status}});
    assert.equal(next.template.question,undefined,status);
    assert.equal(next.imageGeneration.strategy,'content-led-pages');
    assert.equal(next.nextAction,'design-evidence-pages');
  }
});

test('a supplied template routes to real inspection, while an explicit decline does not read it',async t=>{
  const {cwd,prepare}=await fixture(t);
  const file=join(cwd,'reference.pptx');await writeFile(file,'Fixture contents are not parsed by prepare.');
  const result=await prepare({...report,template:{status:'unasked',localPaths:['reference.pptx']}});
  assert.equal(result.nextAction,'inspect-template');
  assert.equal(result.template.question,undefined);
  assert.deepEqual(result.template.files[0].nextTool,{name:'academic_ppt_template',arguments:{filePath:file,render:true}});
  assert.match(result.template.instructions[0],/尚未解析/);
  await assert.rejects(prepare({...report,template:{status:'provided',localPaths:['missing.pptx']}}),/FILE_NOT_FOUND/);
  const declined=await prepare({...report,template:{status:'none',localPaths:['missing.pptx']}});
  assert.equal(declined.template.nextAction,'continue-native');
});

test('legacy PPT requires conversion and does not masquerade as a supported PPTX',async t=>{
  const {cwd,prepare}=await fixture(t);await writeFile(join(cwd,'old.ppt'),'Synthetic legacy file.');
  const result=await prepare({...report,template:{status:'provided',localPaths:['old.ppt']}});
  assert.equal(result.template.nextAction,'convert-template-or-continue-native');
  assert.equal(result.template.files[0].status,'conversion-required');
  assert.equal(result.template.files[0].nextTool,undefined);
  assert.equal(result.nextAction,'design-evidence-pages');
});

test('reviewed template profiles are reused only while bound to current source bytes',async t=>{
  const {cwd,prepare}=await fixture(t),file=join(cwd,'reference.pptx'),profilePath=join(cwd,'profile.json');
  await copyFile(resolve('examples/native-card-reference.pptx'),file);
  const profile=await inspectTemplate(file);await writeFile(profilePath,JSON.stringify(profile));
  const request={...report,template:{status:'provided',localPaths:['reference.pptx'],review:{profilePaths:['profile.json'],visualObservations:'Synthetic fixture declares a viewing observation for workflow testing; no actual visual approval.'}}};
  const result=await prepare(request);
  assert.equal(result.template.nextAction,'continue-reference-guided');
  assert.equal(result.template.files[0].status,'host-reviewed');
  assert.equal(Object.hasOwn(result.template.files[0],'nextTool'),false);
  assert.equal(result.nextAction,'design-evidence-pages');
  assert.equal(result.template.review.profiles[0].templateSha256,profile.sha256);
  assert.match(result.template.instructions[0],/不重复/);
  await writeFile(file,'Changed source bytes');
  await assert.rejects(prepare(request),/TEMPLATE_REVIEW_SOURCE_MISMATCH/);
});

test('available host image generation receives exact report content and a native fallback',async t=>{
  const {prepare}=await fixture(t);
  const result=await prepare({...report,template:{status:'none'},imageGeneration:host,cards:[card],palette:['#1A3850','#12665F']});
  assert.equal(result.nextAction,'invoke-host-imagegen');
  const generation=result.imageGeneration;
  assert.equal(generation.toolName,'fixture_image_generator');
  assert.equal(generation.status,'not-requested');
  assert.ok(generation.prompt.includes(report.topic));assert.ok(generation.prompt.includes(report.audience));
  assert.ok(generation.prompt.includes(card.title));assert.ok(generation.prompt.includes(card.body));
  assert.ok(generation.prompt.includes(card.items[0].detail));assert.ok(generation.prompt.includes('proposal'));
  assert.match(generation.prompt,/可编辑原生/);
  assert.equal(generation.fallback.strategy,'native-catalog');
  const rendered=formatToolResult('academic_ppt_prepare',result);
  assert.match(rendered,/尚未执行/);assert.ok(rendered.includes(card.body));
});

test('reference colors and preferred presets remain adaptable without changing authored content',async t=>{
  const {prepare}=await fixture(t);
  const request={...report,template:{status:'none'},imageGeneration:host,palette:['#294A63','#42766B'],cards:[{...card,preferredPresets:['research-tab'],items:[{label:'观测差值',value:0,unit:'kg m⁻²',detail:'仅用于方案示例，不构成性能结论。'}]}]};
  const original=structuredClone(request),result=await prepare(request);
  assert.deepEqual(request,original,'reference preparation must not rewrite authored content or candidate colors');
  assert.equal(result.designAdaptation.mode,'content-adaptive');
  assert.equal(result.designAdaptation.colorPolicy.mode,'adaptive');
  assert.deepEqual(result.designAdaptation.colorPolicy.candidateColors,request.palette);
  assert.match(result.imageGeneration.prompt,/允许.*调整色相、明度、饱和度和占比/);
  assert.match(result.imageGeneration.prompt,/preferredPresets只表示候选灵感/);
  assert.match(result.imageGeneration.prompt,/合并、拆分或重排区块/);
  for(const text of ['kg m⁻²','仅用于方案示例，不构成性能结论。','"value": 0','research-tab'])assert.ok(result.imageGeneration.prompt.includes(text),text);
});

test('an explicitly fixed palette is honored and requires the actual colors',async t=>{
  const {prepare}=await fixture(t),palette=['#2D4654','#79506B'];
  const result=await prepare({...report,template:{status:'none'},imageGeneration:host,cards:[card],palette,paletteMode:'fixed'});
  assert.equal(result.designAdaptation.colorPolicy.mode,'fixed');
  assert.deepEqual(result.designAdaptation.colorPolicy.candidateColors,palette);
  assert.match(result.imageGeneration.prompt,/保留.*用户明确固定的颜色/);
  assert.doesNotMatch(result.imageGeneration.prompt,/允许.*调整色相、明度、饱和度和占比/);
  await assert.rejects(prepare({...report,paletteMode:'fixed'}),/paletteMode=fixed requires/);
  await assert.rejects(prepare({...report,palette,paletteMode:'copy-template'}),/INVALID_PREPARATION/);
});

test('all reference branches expose actionable adaptation and native reconstruction to the host',async t=>{
  const {cwd,requestPath,prepare}=await fixture(t),tool=buildAcademicTools().find(value=>value.name==='academic_ppt_prepare');
  const variants=[undefined,{availability:'unknown',source:'Synthetic unknown capability.'},{availability:'unavailable',source:'Synthetic unavailable capability.'},
    {...host,status:'failed',failureReason:'Synthetic service failure.'},{...host,status:'declined'},
    {...host,status:'generated',resultReferences:['synthetic-card-reference'],visualObservations:'Synthetic observation for contract testing; not actual visual approval.'}];
  for(const imageGeneration of variants){
    await prepare({...report,template:{status:'none'},cards:[card],...(imageGeneration?{imageGeneration}:{})});
    const result=await tool.execute({requestPath},{agent:{session:{header:{cwd}}}});
    const rendered=tool.output.render({},result).map(part=>part.text??'').join('\n');
    assert.deepEqual(result.designAdaptation.routes.map(route=>route.mode),['adapt-preset','compose-native']);
    for(const expected of ['adaptive','drawings','composition.regions','card.accent','design.direction','白字','原生设计：',result.nativeFallback.selection])assert.ok(rendered.includes(expected),expected);
  }
});

test('explicit card requests retain fallback while preparation without cards continues whole-page design',async t=>{
  const {prepare}=await fixture(t);
  for(const availability of ['unknown','unavailable']){
    const result=await prepare({...report,template:{status:'unanswered'},imageGeneration:{availability,source:'Fixture capability record.'},cards:[card]});
    assert.equal(result.nextAction,'select-native-cards');assert.equal(result.imageGeneration.prompt,undefined);
  }
  const contentFirst=await prepare({...report,template:{status:'none'},imageGeneration:host});
  assert.equal(contentFirst.nextAction,'design-evidence-pages');assert.equal(contentFirst.imageGeneration.prompt,undefined);
  await assert.rejects(prepare({...report,imageGeneration:{availability:'available',source:'No named host tool.'},cards:[card]}),/toolName/);
});

test('large card sets produce bounded independent prompt batches with complete content',async t=>{
  const {prepare}=await fixture(t);
  const cards=Array.from({length:8},(_,i)=>({...card,id:`C${i+1}`,body:`Unique content ${i+1}`}));
  const result=await prepare({...report,template:{status:'none'},imageGeneration:host,cards});
  assert.equal(result.imageGeneration.batches.length,2);
  assert.equal(result.imageGeneration.prompt,undefined);
  for(const batch of result.imageGeneration.batches){
    assert.ok(batch.cardIds.length<=4);
    for(const id of batch.cardIds)assert.ok(batch.prompt.includes(`Unique content ${id.slice(1)}`));
  }
  assert.ok(!result.imageGeneration.batches[0].prompt.includes('Unique content 8'));
  const rendered=formatToolResult('academic_ppt_prepare',result);
  for(const batch of result.imageGeneration.batches)assert.ok(rendered.includes(batch.prompt));
});

test('failure and decline fall back without reattempting generation',async t=>{
  const {prepare}=await fixture(t);
  for(const status of ['failed','declined']){
    const result=await prepare({...report,template:{status:'none'},imageGeneration:{...host,status,failureReason:'Fixture result: request not completed.'},cards:[card]});
    assert.equal(result.nextAction,'select-native-cards');assert.equal(result.imageGeneration.status,status);
    assert.equal(result.imageGeneration.prompt,undefined);assert.match(result.imageGeneration.reason,/not completed/);
  }
});

test('a generated reference needs explicit reference and viewing observations before native reconstruction',async t=>{
  const {prepare}=await fixture(t);
  await assert.rejects(prepare({...report,imageGeneration:{...host,status:'generated'}}),/resultReferences/);
  const result=await prepare({...report,template:{status:'none'},imageGeneration:{...host,status:'generated',resultReferences:['fixture-tool-result-1'],visualObservations:'Fixture observation: title rail separates the condition text.'}});
  assert.equal(result.nextAction,'rebuild-editable-cards');
  assert.equal(result.imageGeneration.strategy,'native-from-reviewed-reference');
  assert.match(result.imageGeneration.instructions.join(' '),/插件没有独立看过/);
  assert.equal(result.imageGeneration.prompt,undefined);
});

test('decision output is reproducible, immutable, and cannot overwrite its request',async t=>{
  const {cwd,requestPath,prepare}=await fixture(t),request={...report,template:{status:'none'}};
  const first=await prepare(request,{outputPath:'plan.json'});
  assert.equal(first.planPath,join(cwd,'plan.json'));
  const saved=await readFile(first.planPath,'utf8');
  const repeat=await prepare(request,{outputPath:'plan.json'});assert.equal(repeat.planPath,first.planPath);
  assert.equal(await readFile(first.planPath,'utf8'),saved);
  await assert.rejects(prepare({...request,audience:'Different audience'},{outputPath:'plan.json'}),/PREPARATION_EXISTS/);
  await assert.rejects(prepare(request,{outputPath:requestPath}),/PREPARATION_PATH_CONFLICT/);
});

test('workspace boundaries, UTF-8, request contracts, and duplicate card IDs remain enforced',async t=>{
  const {cwd,requestPath,prepare}=await fixture(t);
  await assert.rejects(prepare({...report,template:{status:'provided',localPaths:['../outside.pptx']}}),/PATH_OUTSIDE_WORKSPACE/);
  await assert.rejects(prepare({...report,template:{status:'provided'}}),/localPaths/);
  await assert.rejects(prepare({...report,cards:[card,card]}),/unique/);
  await assert.rejects(prepare({...report,secretApiKey:'not-allowed'}),/additional properties/);
  await writeFile(requestPath,Buffer.from([0xff,0xff]));
  await assert.rejects(prepareDesign({cwd,requestPath}),/INVALID_PREPARATION_JSON/);
});

test('registered preparation tool and its opt-in contract stay executable and bounded',async t=>{
  const {cwd,requestPath}=await fixture(t);await writeFile(requestPath,JSON.stringify({...report,template:{status:'none'}}));
  const tools=new Map(buildAcademicTools().map(tool=>[tool.name,tool])), exec={agent:{session:{header:{cwd}}}};
  const contract=await tools.get('academic_ppt_contract').execute({topic:'preparation'},exec);
  assert.deepEqual(contract.schema,preparationRequestSchema);
  assert.equal(contract.submission.tool,'academic_ppt_prepare');
  assert.equal(contract.submission.transport,'requestPath');
  const result=await tools.get('academic_ppt_prepare').execute({requestPath,outputPath:'plan.json'},exec);
  assert.equal(result.nextAction,'design-evidence-pages');
  const metadata=buildAcademicTools().map(({name,description,parameters})=>({name,description,parameters}));
  assert.ok(Buffer.byteLength(JSON.stringify(metadata))<18000,'new tools must not repeat the content contract in every model request');
});

test('native card discovery exposes actual recipes and a useful compact context summary',async()=>{
  const tools=new Map(buildAcademicTools().map(tool=>[tool.name,tool]));
  const all=await tools.get('academic_ppt_cards').execute({});
  assert.ok(all.totalCount>=30);assert.equal(all.presets.length,all.totalCount);
  const selected=await tools.get('academic_ppt_cards').execute({presetId:all.presets[0].id});
  assert.equal(selected.preset.example.preset,selected.preset.id);
  assert.ok(selected.preset.contentContract);assert.ok(selected.preset.recipe);
  for(const result of [all,selected]){
    const rendered=formatToolResult('academic_ppt_cards',result);
    for(const expected of ['drawings','composition.regions'])assert.ok(rendered.includes(expected),expected);
  }
  assert.match(selected.instructions.join(' '),/先判断配方是否适合/);
  const filtered=await tools.get('academic_ppt_cards').execute({family:'method',limit:2});
  assert.equal(filtered.presets.length,2);assert.ok(filtered.presets.every(p=>p.family==='method'));
  const summary=formatToolResult('academic_ppt_context',{records:[{collection:'slides',record:{id:'S1',title:'Synthetic context',cards:[{id:'C1',title:'Reading',body:'Explanation',preset:'metric-pair',badge:'A',items:[{label:'Example',value:0,unit:'m',detail:'Synthetic detail'}],note:'Synthetic limitation'}]}}]});
  for(const content of ['metric-pair','Example','0 m','Synthetic detail','Synthetic limitation'])assert.ok(summary.includes(content),content);
});

test('host-facing preparation output preserves reviewed template and generated reference locations',()=>{
  const tool=buildAcademicTools().find(t=>t.name==='academic_ppt_prepare');
  const result={ok:true,nextAction:'rebuild-editable-cards',template:{review:{profiles:[{path:'/workspace/template-profile.json'}],visualObservations:'Observed narrow title rail and adjacent conditions.',renderReferences:['/workspace/template-page.png']}},
    imageGeneration:{availability:'available',source:'Host tool capability listing.',status:'generated',strategy:'native-from-reviewed-reference',nextAction:'rebuild-editable-cards',resultReferences:['generated-card-result-17'],visualObservations:'Observed two aligned metric slots.'}};
  const text=tool.output.render({},result).map(part=>part.text??'').join('\n');
  for(const expected of ['/workspace/template-profile.json','/workspace/template-page.png','Observed narrow title rail and adjacent conditions.','generated-card-result-17','Observed two aligned metric slots.','Host tool capability listing.'])assert.ok(text.includes(expected),expected);
});
