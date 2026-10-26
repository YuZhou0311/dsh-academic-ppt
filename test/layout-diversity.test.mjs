import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScenes } from '../src/scene.mjs';
import { layoutDiversityReport } from '../src/layout-diversity.mjs';
import { PNG } from './fixtures.mjs';

const slide=(id,extra={})=>({id,layout:'academic',title:'图证与解释关系回归',paperIds:[],claimIds:[],figureIds:[],cards:[],notes:'合成布局测试，不是科研结果。',seconds:30,...extra});
const project=slides=>({title:'布局诊断',design:{fontFamily:'Noto Sans CJK SC'},papers:[],claims:[],assets:[{id:'source',data:PNG,width:400,height:200,caption:'测试图',usage:'figure'}],slides});
const explanation='保留来源与比较条件，核对主要趋势及适用范围。';
const authored=(id,count=3,nudge=0)=>slide(id,{drawings:[{id:`drawing-${id}`,width:1184,height:500,box:{x:48,y:132,w:1184,h:500},elements:[
  {id:`image-${id}`,kind:'image',x:10+nudge,y:45,w:620,h:360,assetId:'source'},
  ...Array.from({length:count},(_,i)=>[
    {id:`frame-${i}`,kind:'rect',x:700+nudge,y:12+i*(470/count),w:450-nudge,h:440/count,fill:i%2?'#EEF2F6':'#FFFFFF',stroke:'#ABBAC8',role:'group'},
    {id:`copy-${i}`,kind:'text',x:718+nudge,y:25+i*(470/count),w:414-nudge,h:90,fontSize:24,text:explanation,role:'body'},
  ]).flat(),
  {id:'decoration',kind:'rect',x:680,y:10,w:3,h:470,fill:'#183B66',role:'decoration'},
]}]});
const scene=(id,family='left',extra=[])=>{
  const image=family==='top'?{x:220,y:150,w:840,h:260}:family==='paired'?{x:72,y:160,w:500,h:260}:{x:60,y:160,w:630,h:390};
  const text=family==='top'?{x:220,y:490,w:840,h:90}:family==='paired'?{x:72,y:470,w:1120,h:100}:{x:790,y:190,w:410,h:300};
  return {id,width:1280,height:720,contentBox:{x:48,y:132,w:1184,h:513},nodes:[{id:`${id}/image`,kind:'image',role:'evidence-image',...image},...(family==='paired'?[{id:`${id}/image2`,kind:'image',role:'evidence-image',x:690,y:160,w:500,h:260}]:[]),{id:`${id}/explanation`,kind:'text',text:explanation.repeat(3),role:'body',...text},...extra]};
};
const report=(slides,pages,design={})=>layoutDiversityReport({...project(slides),design},{pages});

test('actual scene geometry detects the same left-visual scaffold across IDs, paint, box nudges and stack counts',()=>{
  const p=project([authored('a',3,0),authored('b',4,8),authored('c',2,-6)]),before=structuredClone(p),scenes=buildScenes(p);
  const out=layoutDiversityReport(p,scenes);
  assert.deepEqual(out.slides.map(s=>s.family),Array(3).fill('visual-left-explanation-right'));
  assert.deepEqual(out.slides.map(s=>s.explanationContainers),[3,4,2]);
  assert.deepEqual(out.issues.map(i=>[i.code,i.severity]),[['visual-layout-family-run','warning']]);
  assert.deepEqual(out.issues[0].relatedSlideIds,['a','b','c']);assert.deepEqual(p,before);
});

test('whole-deck visual dominance survives intervening nonvisual and different-layout pages',()=>{
  const ids=['a','b','c','d','e','pair'],slides=ids.map(id=>slide(id)),pages=ids.map(id=>scene(id,id==='pair'?'paired':'left'));
  slides.splice(2,0,slide('table-summary'));pages.splice(2,0,{id:'table-summary',nodes:[]});
  const out=report(slides,pages),issue=out.issues.find(i=>i.code==='visual-layout-family-dominance');
  assert.equal(issue.matchingSlides,5);assert.equal(issue.visualSlides,6);assert.deepEqual(issue.relatedSlideIds,['a','b','c','d','e']);
  assert.equal(out.summary.bodySlideCount,7);assert.equal(out.summary.visualSlideCount,6);
  assert.equal(out.slides.find(s=>s.slideId==='pair').family,'visual-top-explanation-bottom','paired image evidence with a lower explanation is a different reading path');
  assert.equal(out.issues.length,1,'one review signal for a global group avoids duplicate run warnings');
});

test('navigation and genuine rearrangements interrupt adjacent runs without imposing a variety quota',()=>{
  const slides=[slide('a'),slide('b'),slide('section',{layout:'section'}),slide('c')],pages=slides.map(s=>scene(s.id));
  assert.deepEqual(report(slides,pages).issues,[]);
  const mixed=['a','b','c'].map(id=>slide(id));
  const out=report(mixed,[scene('a'),scene('b','top'),scene('c')]);
  assert.deepEqual(out.issues,[]);assert.equal(out.slides[1].family,'visual-top-explanation-bottom');
});

test('specific comparison reasons and template fidelity allow intentional repetition',()=>{
  const slides=['a','b','c','d'].map(id=>slide(id,{visualPlan:{repetitionReason:'同一实验的四个站点保留共同坐标范围和证据位置，以便逐页比较。'}})),pages=slides.map(s=>scene(s.id));
  assert.deepEqual(report(slides,pages).issues,[]);
  for(const s of slides)s.visualPlan.repetitionReason='保持统一';
  assert.ok(report(slides,pages).issues.some(i=>i.code==='visual-layout-family-dominance'));
  assert.deepEqual(report(slides,pages,{mode:'template-faithful'}).issues,[]);
});

test('decorative images and chrome do not create evidence or interpretation carriers',()=>{
  const s=slide('a'),page=scene('a','left',[{id:'footer',kind:'text',role:'citation',text:'左侧长来源'.repeat(70),x:50,y:500,w:400,h:35}]);
  assert.equal(report([s],[page]).slides[0].family,'visual-left-explanation-right');
  page.nodes[0].role='context-visual';
  assert.equal(report([s],[page]).summary.visualSlideCount,0);
  page.nodes[0].role='evidence-image';page.nodes[0].semantic=false;
  assert.equal(report([s],[page]).summary.visualSlideCount,0);
  page.nodes[0].semantic=true;page.nodes[0].assetId='source';const p=project([s]);p.assets[0].usage='decorative';
  assert.equal(layoutDiversityReport(p,{pages:[page]}).summary.visualSlideCount,0,'asset provenance overrides a generic image role');
});

test('zero-height native plot axes and their labels form one evidence group',()=>{
  const s=slide('plot'),page=scene('plot');page.nodes.shift();page.nodes.push(
    {id:'plot/data-plot/x-axis',kind:'line',x:80,y:550,w:600,h:0,role:'data'},
    {id:'plot/data-plot/y-axis',kind:'line',x:80,y:550,w:0,h:-360,role:'data'},
    {id:'plot/data-plot/x-title',kind:'text',x:260,y:570,w:210,h:30,role:'label',text:'研究条件'},
  );const before=structuredClone(page),out=report([s],[page]);
  assert.equal(out.slides[0].visualCarrierCount,1);assert.deepEqual(out.slides[0].visualCarrierKinds,['plot']);
  assert.equal(out.slides[0].family,'visual-left-explanation-right');assert.deepEqual(page,before);
});

test('a shared native drawing ID does not absorb distant explanation into its chart',()=>{
  const s=slide('drawing'),page=scene('drawing');page.nodes.shift();page.nodes[0].drawingId='research';page.nodes.push(
    {id:'drawing/x',drawingId:'research',kind:'line',x:80,y:550,w:560,h:0,role:'data'},
    {id:'drawing/y',drawingId:'research',kind:'line',x:80,y:550,w:0,h:-360,role:'data'},
    {id:'drawing/axis-label',drawingId:'research',kind:'text',x:260,y:570,w:210,h:30,role:'label',text:'观测条件'},
  );const out=report([s],[page]);
  assert.equal(out.slides[0].visualCarrierCount,1);assert.equal(out.slides[0].explanationTextBlocks,1);
  assert.equal(out.slides[0].family,'visual-left-explanation-right');
});
