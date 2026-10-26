import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { buildScenes } from '../src/scene.mjs';
import { renderProject } from '../src/render.mjs';
import { DEFAULT_DESIGN } from '../src/core.mjs';

// Synthetic typography fixtures: these are rendering checks, not research data.
const slide=changes=>({id:'s',layout:'cover',title:'作物模型与智能决策的研究进展',paperIds:[],claimIds:[],figureIds:[],cards:[],notes:'软件视觉回归，不是研究结论。',seconds:30,...changes});
const project=slides=>({title:'学术视觉回归',design:structuredClone(DEFAULT_DESIGN),papers:[],claims:[],assets:[],slides});
const node=(p,suffix)=>p.nodes.find(n=>n.id.endsWith('/'+suffix));
const errors=p=>p.issues.filter(i=>i.severity==='error');
const nativeShape=(xml,id)=>(xml.match(/<p:sp>.*?<\/p:sp>/gs)||[]).find(shape=>shape.includes(`name="${id}"`));

test('default cover is text-led and keeps the full research title and metadata in editable objects', async()=>{
  const metadata={occasion:'学术文献综述',presenter:'测试报告人',affiliation:'测试研究团队',date:'2026年10月25日'};
  const p=project([slide({cover:metadata,subtitle:'研究问题、方法证据与适用边界'})]);
  const out=await renderProject(p), page=out.scenes.pages[0];
  assert.deepEqual(errors(out),[]);
  assert.equal(node(page,'title').text,p.slides[0].title);
  assert.ok(node(page,'title').fontSize>node(page,'cover-presenter').fontSize*2);
  for(const text of Object.values(metadata)) assert.ok(page.nodes.some(n=>n.text===text),text);
  assert.equal(page.nodes.filter(n=>n.kind==='image').length,0);
  assert.equal(page.nodes.filter(n=>n.kind==='rect'&&n.w*n.h>1280*720*.1).length,0,'no empty decorative hero field');
  const xml=strFromU8(unzipSync(out.pptx)['ppt/slides/slide1.xml']);
  assert.ok(nativeShape(xml,page.id+'/title'));
  assert.equal((xml.match(/<p:pic>/g)||[]).length,0);
});

test('text-only editorial cover reclaims media width and has no empty colored side panel',()=>{
  const p=project([slide({cover:{variant:'editorial',presenter:'测试报告人',affiliation:'跨学科研究团队与联合实验室'},subtitle:'用独立验证比较不同方法的适用条件与证据边界'})]);
  const page=buildScenes(p).pages[0];
  assert.deepEqual(errors(page),[]);
  assert.equal(node(page,'cover-editorial-field'),undefined);
  assert.equal(node(page,'cover-visual-field'),undefined);
  assert.equal(node(page,'subtitle').w,node(page,'title').w);
  assert.equal(node(page,'cover-affiliation').w,node(page,'title').w);
  const split=structuredClone(p);split.slides[0].cover.variant='split';
  assert.ok(buildScenes(split).pages[0].issues.some(i=>i.code==='cover-visual-missing'),'missing imagery is reported instead of inserting stock artwork');
});

test('restrained card surfaces survive SVG and native PPTX export, with explicit overrides retained',async()=>{
  const cards=[{id:'c',kind:'method',title:'独立验证',body:'比较方法前先统一数据划分与评价口径。',claimIds:[]}];
  const p=project([slide({layout:'academic',title:'先明确比较口径，再解释证据',cards,composition:{rows:[{panels:[{id:'p',title:'验证条件',surface:'plain',cardIds:['c']}]}]}})]);
  const out=await renderProject(p),page=out.scenes.pages[0],surface=node(page,'card/c/surface');
  assert.deepEqual(errors(out),[]); assert.ok(surface); assert.ok(surface.strokeWidth>=1);
  assert.equal(surface.stroke,p.design.palette.line); assert.equal(surface.fill,p.design.palette.paper);
  assert.ok(surface.radius<=4); assert.equal(surface.shadow,undefined); assert.equal(node(page,'card/c/accent'),undefined);
  assert.equal(node(page,'card/c/body').text,cards[0].body);
  assert.match(out.svgPages[0].svg,/<rect[^>]*data-object-id="s\/card\/c\/surface"[^>]*stroke-width="1\.2"/);
  const xml=strFromU8(unzipSync(out.pptx)['ppt/slides/slide1.xml']),native=nativeShape(xml,'s/card/c/surface');
  assert.match(native,/<a:ln w="11430"/,'0.9 pt card boundary is exported as a real native line');
  assert.match(native,new RegExp(`<a:srgbClr val="${surface.stroke.slice(1)}"`));
  p.slides[0].cards[0].appearance={surface:'plain',accent:'none'};
  assert.equal(node(buildScenes(p).pages[0],'card/c/surface'),undefined,'authored borderless cards remain possible');
  p.slides[0].cards[0].appearance={surface:'solid',radius:14,elevation:true,accent:'top'};
  const explicit=buildScenes(p).pages[0],selected=node(explicit,'card/c/surface');
  assert.equal(selected.radius,14); assert.ok(selected.shadow); assert.ok(node(explicit,'card/c/accent'));
});
