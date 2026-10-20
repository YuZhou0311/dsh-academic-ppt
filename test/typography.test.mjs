import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { buildScenes, measureTextWidth, wrapText } from '../src/scene.mjs';
import { renderProject } from '../src/render.mjs';
import { PNG } from './fixtures.mjs';

const base = () => ({
  title:'学术排版回归', design:{fontFamily:'Noto Sans CJK SC'},
  brief:{centralQuestion:'这段中心问题不应自动代替封面副标题。',talkMinutes:13},
  papers:[{id:'P1',title:'A source paper must not automatically become the presentation identity',authors:['Source Author'],journal:'Synthetic fixture',year:2026,doi:'10.0000/fixture',version:'synthetic'}],
  claims:[],assets:[],slides:[]
});
const slide = (changes={}) => ({id:'s',layout:'synthesis',title:'研究方法与条件',paperIds:[],claimIds:[],figureIds:[],cards:[],notes:'合成排版测试，不是学术结论。',seconds:60,...changes});
const card = (changes={}) => ({id:'c',kind:'method',title:'分析方法',body:'保留研究对象、具体方法与适用条件。',claimIds:[],...changes});
const errors = result => result.issues.filter(issue=>issue.severity==='error');

test('formal and minimal covers have a large native title and only authored academic identity',async()=>{
  for(const variant of ['formal','minimal']){
    const p=base();p.slides=[slide({layout:'cover',title:'作物模型与序贯决策\n研究进展及验证边界',subtitle:'从机制假设到独立环境评价',paperIds:['P1'],cover:{variant,presenter:'张同学',affiliation:'农业系统研究组',occasion:'研究进展报告',date:'2026 年 10 月',titleLines:['作物模型与序贯决策','研究进展及验证边界']}})];
    const before=structuredClone(p),out=await renderProject(p),page=out.scenes.pages[0];
    assert.deepEqual(errors(out),[]);
    const title=page.nodes.find(node=>node.id==='s/title');
    assert.ok(title.fontSize*.75>=42,'cover titles remain at least 42 pt');
    assert.equal(title.lines.length,2);
    for(const text of ['张同学','农业系统研究组','研究进展报告','2026 年 10 月'])assert.ok(page.nodes.some(node=>node.text===text));
    for(const id of ['s/paper-title','s/cover-duration','s/sources','s/page-number','s/header-rule'])assert.ok(!page.nodes.some(node=>node.id===id),id);
    assert.ok(!page.nodes.some(node=>node.kind==='image'),'the cover is editable native geometry');
    const xml=strFromU8(unzipSync(out.pptx)['ppt/slides/slide1.xml']);
    assert.match(xml,/sz="4500"/);
    assert.doesNotMatch(xml,/<a:(?:normAutofit|spAutoFit)/);
    assert.match(xml,/张同学/);
    assert.deepEqual(p,before,'author data is not rewritten to fit the cover');
  }
});

test('legacy covers keep title and subtitle without introducing paper identity or talk length',()=>{
  const p=base();p.slides=[slide({layout:'cover',title:'已有学术汇报',subtitle:'原有副标题',paperIds:['P1']})];
  const page=buildScenes(p).pages[0];
  assert.deepEqual(page.nodes.filter(node=>node.kind==='text').map(node=>node.text),['已有学术汇报','原有副标题']);
  assert.deepEqual(errors(page),[]);
});

test('an excessive cover title is blocked with complete text and unchanged size',()=>{
  const p=base(),longTitle='高维作物状态估计与序贯决策的机制假设及跨环境验证'.repeat(7);
  p.slides=[slide({layout:'cover',title:longTitle,cover:{presenter:'研究者',affiliation:'研究单位'}})];
  const page=buildScenes(p).pages[0],title=page.nodes.find(node=>node.id==='s/title');
  assert.ok(page.issues.some(issue=>issue.code==='text-overflow-estimate'&&issue.severity==='error'));
  assert.equal(title.text,longTitle);
  assert.equal(title.fontSize,60);
  p.slides[0].cover.titleLines=['换成另一个短标题'];
  const mismatch=buildScenes(p).pages[0];
  assert.ok(mismatch.issues.some(issue=>issue.code==='cover-title-mismatch'&&issue.severity==='error'));
  assert.equal(mismatch.nodes.find(node=>node.id==='s/title').text,longTitle);
});

test('glyph advances distinguish wide capitals and preserve scientific symbols and graphemes',()=>{
  assert.ok(measureTextWidth('WWWW',24)>measureTextWidth('iiii',24)*2);
  assert.equal(measureTextWidth('e\u0301',24),measureTextWidth('é',24));
  assert.equal(measureTextWidth('e\u0301',24),measureTextWidth('e',24));
  for(const text of ['WWW irrigation feedback, 95% CI（示例）','保持  两个空格、单位 ± 与比例 17/20。','a-very-long-scientific-identifier（示例）。','e\u0301vidence 3.2 kg/ha，P < 0.05']){
    const lines=wrapText(text,207,24);
    assert.equal(lines.join(''),text,'scientific content is never truncated');
    assert.ok(lines.every(line=>measureTextWidth(line,24)<=207+.01));
    assert.ok(lines.every(line=>!/^[\p{Mark}，。！？；：、）》〉」』】〕）］｝’”….,!?;:\])}%％]/u.test(line)));
  }
});

test('a complete long English paper title wraps without losing its original title or font size',()=>{
  const p=base();p.papers[0].title='Mechanistic modelling and sequential decision making for crop management under heterogeneous weather conditions: independent validation and uncertainty across sites and seasons';
  p.slides=[slide({layout:'paper',title:'模型机制与验证范围',paperIds:['P1'],cards:[card()]})];
  const page=buildScenes(p).pages[0],title=page.nodes.find(node=>node.id==='s/paper-title');
  assert.deepEqual(errors(page),[]);
  assert.equal(title.text,p.papers[0].title);
  assert.equal(title.fontSize,25);
  assert.ok(title.lines.length>=2);
  assert.ok(title.lines.every(line=>measureTextWidth(line,25,{bold:true})<=title.w+.01));
});

test('default body roles use flat text while explicit frames and title tabs remain supported',()=>{
  const p=base();p.slides=[slide({cards:['question','method','setting','result','boundary','hypothesis'].map((kind,i)=>card({id:'c'+i,kind,body:'具体条件与证据。'}))})];
  const page=buildScenes(p).pages[0];
  assert.deepEqual(errors(page),[]);
  assert.ok(!page.nodes.some(node=>/\/card\/.*\/(?:frame|tab|heading-fill|band)$/.test(node.id)));
  assert.ok(page.nodes.filter(node=>node.role==='body').every(node=>node.fontSize===24));
  p.slides[0].cards=[card({style:'academic-tab'})];
  const explicit=buildScenes(p).pages[0];
  assert.ok(explicit.nodes.some(node=>node.id==='s/card/c/tab'));
  assert.deepEqual(errors(explicit),[],'a title tab intentionally intersects its background, not its text');
});

test('a long card heading reflows its body inside the same authored frame',()=>{
  const p=base(),authored=card({title:'跨环境模型适用范围与独立验证条件',body:'逐项保留观测、预测、计算预算和留出评价。',box:{x:48,y:132,w:350,h:340}});
  p.slides=[slide({cards:[authored]})];
  const page=buildScenes(p).pages[0],title=page.nodes.find(node=>node.id==='s/card/c/title'),body=page.nodes.find(node=>node.id==='s/card/c/body');
  assert.deepEqual(errors(page),[]);
  assert.ok(body.y>=title.y+title.estimatedTextHeight);
  assert.equal(body.text,authored.body);
  assert.deepEqual(p.slides[0].cards[0].box,{x:48,y:132,w:350,h:340});
});

test('long Chinese body text fails the review gate without truncation or a smaller font',async()=>{
  const p=base(),body='保留独立样本单位、基线与验证条件。'.repeat(45);
  p.slides=[slide({cards:[card({body,box:{x:48,y:132,w:400,h:120}})]})];
  const out=await renderProject(p),node=out.scenes.pages[0].nodes.find(item=>item.id==='s/card/c/body');
  assert.ok(out.issues.some(issue=>issue.code==='text-overflow-estimate'&&issue.severity==='error'));
  assert.equal(node.text,body);
  assert.equal(node.lines.join(''),body);
  assert.equal(node.fontSize,24);
  const xml=strFromU8(unzipSync(out.pptx)['ppt/slides/slide1.xml']);
  assert.match(xml,/sz="1800"/);
  assert.doesNotMatch(xml,/<a:(?:normAutofit|spAutoFit)/);
});

test('overlapping explicit cards fail even when both short text blocks fit individually',()=>{
  const p=base(),box={x:48,y:132,w:500,h:230};
  p.slides=[slide({cards:[card({id:'one',body:'已测条件。',box}),card({id:'two',body:'另一项证据。',box:{...box}})]})];
  const page=buildScenes(p).pages[0];
  assert.ok(!page.issues.some(issue=>issue.code==='text-overflow-estimate'));
  assert.ok(page.issues.some(issue=>issue.code==='content-region-overlap'&&issue.objectId==='s/card/one'&&issue.relatedObjectId==='s/card/two'&&issue.severity==='error'));
});

test('custom figure and text boxes stay independent and collisions identify the evidence object',()=>{
  const p=base();p.assets=[{id:'figure',data:PNG,width:400,height:200,paperId:'P1',figure:'Fig. 1',caption:'合成测试图',displayCaption:'Fig. 1 · 合成图'}];
  p.slides=[slide({layout:'figure-focus',paperIds:['P1'],figureIds:['figure'],figureBoxes:[{x:48,y:132,w:704,h:500}],cards:[card({box:{x:800,y:132,w:432,h:500}})]})];
  assert.deepEqual(errors(buildScenes(p)),[]);
  p.slides[0].cards[0].box.x=500;
  const collision=buildScenes(p);
  assert.ok(collision.issues.some(issue=>issue.code==='content-region-overlap'&&issue.objectId==='s/figure:0'));
});

test('native table cells do not cause false collisions, while a dense table remains a blocking error',async()=>{
  const p=base();p.slides=[slide({layout:'comparison',table:{columns:['处理','均值 ± SD','独立样本'],rows:[['处理一','12.4 ± 1.1 kg/ha','n = 8'],['处理二','10.2 ± 0.9 kg/ha','n = 8']],caption:'合成测试数据'}})];
  const out=await renderProject(p);
  assert.deepEqual(errors(out),[]);
  const zip=unzipSync(out.pptx),xml=strFromU8(zip['ppt/slides/slide1.xml']);
  assert.match(xml,/<a:tbl>/);
  assert.equal(Object.keys(zip).filter(path=>/^ppt\/slides\/slide\d+\.xml$/.test(path)).length,1);
  p.slides[0].table.rows=Array.from({length:14},()=>['完整说明'.repeat(14),'12.4 ± 1.1 kg/ha','n = 8']);
  const crowded=buildScenes(p),table=crowded.pages[0].nodes.find(node=>node.kind==='table');
  assert.ok(crowded.issues.some(issue=>issue.code==='table-overflow-estimate'&&issue.severity==='error'));
  assert.deepEqual(table.table,p.slides[0].table);
  assert.equal(table.fontSize,23);
});
