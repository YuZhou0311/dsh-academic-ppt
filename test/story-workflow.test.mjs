import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { createProject, updateRecords, contextProject, buildProject, editProject, checkProject } from '../src/core.mjs';
import { buildScenes } from '../src/scene.mjs';
import { toolContract } from '../src/tool-contract.mjs';
import { formatToolResult } from '../src/tools.mjs';
import { paper, claim } from './fixtures.mjs';

// Software fixtures only. Draft export is used to inspect serialized behavior,
// not to approve this deliberately small report as a scientific presentation.
const narrative = {
  throughline:'先核对固定输入的保留，再界定这项软件检查能够支持的判断。',
  sections:[
    {id:'preservation',title:'输入保留',question:'导出是否完整保留提供的测试值？'},
    {id:'limits',title:'验证边界',question:'该软件用例能够支持什么判断？'},
  ],
};
const slide = (id, layout, title, extra={}) => ({id,layout,title,paperIds:[],claimIds:[],figureIds:[],cards:[],notes:'确定性软件测试，不是真实科研结果。',seconds:20,...extra});

test('public authoring carries one outline into navigation, custom headings and both note exports',async t=>{
  const base=resolve('.test-output');await mkdir(base,{recursive:true});
  const cwd=await mkdtemp(join(base,'story-workflow-'));t.after(()=>rm(cwd,{recursive:true,force:true}));
  const created=await createProject({cwd,projectDir:'project',title:'叙事传输测试',brief:{centralQuestion:'软件输出是否保留明确声明的信息？',audience:'软件验证',talkMinutes:3,targetPaperCount:0,requireFullText:false,requirePaperIntro:false,narrative}});
  const options={cwd,projectPath:created.projectPath};
  const transition='输入保留已完成核对，下一节讨论这个用例尚未覆盖的真实研究条件。';
  const slides=[
    slide('cover','cover','叙事传输测试'),
    slide('roadmap','roadmap','汇报路线'),
    slide('chapter','section','固定输入与导出对应',{sectionId:'preservation'}),
    slide('evidence','academic','原生测试值保留',{sectionId:'preservation',transition,paperIds:['P1'],claimIds:['C1'],heading:{box:{x:48,y:20,w:1184,h:56},fontSize:44},
      argument:{role:'evidence',question:'固定测试输入能否完整保留？',contribution:'核对导出中的原生文字与已登记的软件测试计数。',boundary:'仅为测试数据，不构成任何实验结论。'},
      cards:[{id:'value',kind:'result',title:'合成用例',body:'测试输入为3/4项，保持原有分母与单位。',claimIds:['C1']}],
      composition:{rows:[{panels:[{id:'p',title:'测试观察',surface:'plain',cardIds:['value']}]}]}}),
    slide('closing','closing','该用例只验证记录与导出的对应',{sectionId:'limits',takeaway:'本次输出保留固定输入；实际研究的真实性仍需独立核对。'}),
    slide('references','references','合成测试来源',{paperIds:['P1']}),
  ];
  const recorded=await updateRecords({...options,expectedRevision:0,papers:[paper],claims:[claim],slides});
  const stored=JSON.parse(await readFile(options.projectPath,'utf8'));
  assert.equal(stored.slides[1].agenda,undefined,'derived navigation does not rewrite author records');
  const scenes=buildScenes(stored), roadmap=scenes.pages.find(page=>page.id==='roadmap');
  for(const value of [narrative.throughline,...narrative.sections.flatMap(section=>[section.title,section.question])])assert.ok(roadmap.nodes.some(node=>node.text===value),value);
  const evidence=scenes.pages.find(page=>page.id==='evidence');
  assert.equal(evidence.nodes.find(node=>node.id==='evidence/section-label').text,'01  输入保留');
  assert.ok(evidence.contentBox.y>evidence.nodes.find(node=>node.id==='evidence/section-label').y);
  assert.ok(evidence.notes.includes(transition));
  assert.equal(scenes.pages.find(page=>page.id==='chapter').nodes.find(node=>node.id==='chapter/section-name').text,'输入保留');
  const context=await contextProject({...options,stage:'storyboard'});
  assert.match(formatToolResult('academic_ppt_context',context),/整稿论证路线/);
  assert.ok(context.nextActions.some(value=>value.includes('transition')));
  const built=await buildProject({...options,expectedRevision:recorded.revision,mode:'draft'});assert.equal(built.ok,true);
  assert.ok((await readFile(built.files.speech,'utf8')).includes('衔接下一页：'+transition));
  const files=unzipSync(await readFile(built.files.pptx));
  assert.ok(strFromU8(files['ppt/notesSlides/notesSlide4.xml']).includes(transition));
  const revisedTransition='接下来将用例结论限制在实际检查过的记录范围内。';
  const revised=await editProject({...options,expectedRevision:recorded.revision,scope:'slide-content',changes:[{slideId:'evidence',patch:{sectionId:'limits',transition:revisedTransition}}]});
  const afterEdit=JSON.parse(await readFile(options.projectPath,'utf8'));
  assert.equal(afterEdit.slides[3].sectionId,'limits');
  assert.equal(afterEdit.slides[3].transition,revisedTransition);
  assert.equal(buildScenes(afterEdit).pages[3].nodes.find(node=>node.id==='evidence/section-label').text,'02  验证边界');
  const rebuilt=await buildProject({...options,expectedRevision:revised.revision,mode:'draft'});
  assert.ok((await readFile(rebuilt.files.speech,'utf8')).includes(revisedTransition));
  assert.ok(!strFromU8(unzipSync(await readFile(rebuilt.files.pptx))['ppt/notesSlides/notesSlide4.xml']).includes(transition));
  const removed=await editProject({...options,expectedRevision:revised.revision,scope:'slide-content',changes:[{slideId:'evidence',patch:{},removeFields:['transition','sectionId']}]});
  assert.equal(removed.ok,true);
  assert.equal(JSON.parse(await readFile(options.projectPath,'utf8')).slides[3].transition,undefined);
  const checked=await checkProject(options);
  assert.ok(!checked.issues.some(issue=>issue.code==='narrative-section-unknown'));
  await editProject({...options,expectedRevision:removed.revision,scope:'slide-content',changes:[{slideId:'evidence',patch:{sectionId:'undeclared'}}]});
  assert.equal((await contextProject(options)).stage,'storyboard','a broken outline returns the author to narrative planning');
});

test('the on-demand design contract exposes complete, isolated academic palettes to the host model',async()=>{
  const contract=await toolContract({topic:'design'});
  assert.equal(contract.defaultPalette,'blue-slate');assert.equal(contract.academicPalettes.length,5);
  const rendered=formatToolResult('academic_ppt_contract',contract);
  for(const value of contract.academicPalettes)assert.ok(rendered.includes(JSON.stringify(value)));
  contract.academicPalettes[0].palette.accent='#000000';
  assert.notEqual((await toolContract({topic:'design'})).academicPalettes[0].palette.accent,'#000000');
});
