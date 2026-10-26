import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { buildScenes, measureTextWidth, wrapText } from '../src/scene.mjs';
import { renderProject } from '../src/render.mjs';
import { scientificWrappingIssues } from '../src/scientific-text.mjs';
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

test('scientific numbers, units and scripted identifiers wrap as lossless semantic units',()=>{
  for(const token of ['12.3%','87.7%','−1.2e−3 kg/ha','+2.5E+6','±0.3 °C','3.2 × 10⁻³ mol m−2 s−1','287.44 kg/ha','39 样方','17/20','0.6-0.8','R²','ρ_NDVI','R²=0.07','P < 0.05']){
    const text=`前置 ${token} 后续`,width=Math.max(80,measureTextWidth(token,28)+2),lines=wrapText(text,width,28);
    assert.equal(lines.join(''),text,token);
    assert.ok(lines.some(line=>line.includes(token)),`must not split ${token}`);
    assert.ok(lines.every(line=>measureTextWidth(line,28)<=width+.01),token);
  }
});

test('an over-wide scientific unit is diagnosed rather than divided or scaled',()=>{
  const text='观测 −1.2e−3 kg/ha，保留条件。',width=82,size=28,lines=wrapText(text,width,size);
  assert.equal(lines.join(''),text);
  assert.ok(lines.includes('−1.2e−3 kg/ha，'));
  const issue=scientificWrappingIssues(text,lines,width,size,measureTextWidth).find(i=>i.code==='scientific-token-too-wide');
  assert.equal(issue.severity,'error');assert.equal(issue.availableWidth,width);assert.ok(issue.requiredWidth>width);
  assert.match(issue.token,/−1\.2e−3 kg\/ha/);
  const ordinary='https://example.org/a-very-long-nonscientific-identifier';
  const ordinaryLines=wrapText(ordinary,160,size);
  assert.equal(ordinaryLines.join(''),ordinary);
  assert.ok(ordinaryLines.every(line=>measureTextWidth(line,size)<=160+.01),'long prose and URLs retain their lossless fallback');
});

test('P11 narrow percentage cells require a wider column and keep the same SVG and native PPTX text',async()=>{
  const p=base();p.design.system={header:'plain',bodySize:28};
  p.slides=[slide({layout:'academic',title:'P11 数值列断行回归（排版测试）',
    table:{columns:['口径项','条数','说明'],rows:[['命中总条目','73','严格过滤后'],['中国机构主导','9（12.3%）','第一作者国别 CN'],['国际机构主导','64（87.7%）','同一口径']],columnWeights:[1.4,1,2]},
    composition:{regions:[{id:'counts',title:'',heading:'hidden',surface:'plain',padding:0,box:{x:60,y:176,w:592,h:430},table:true}]}})];
  const before=structuredClone(p),out=await renderProject(p),table=out.scenes.pages[0].nodes.find(n=>n.kind==='table');
  assert.equal(table.fontSize,28);assert.ok(Math.abs(table.colWidths[1]-134.5454545)<.00001);
  assert.deepEqual(table.cellLines[2][1],['9','（12.3%）']);
  assert.deepEqual(table.cellLines[3][1],['64','（87.7%）']);
  const issues=out.issues.filter(i=>i.code==='scientific-token-too-wide');
  assert.deepEqual(issues.map(i=>[i.row,i.column,i.token]),[[2,1,'（12.3%）'],[3,1,'（87.7%）']]);
  assert.ok(issues.every(i=>i.severity==='error'&&Math.abs(i.availableWidth-99.1454545)<.00001));
  const xml=strFromU8(unzipSync(out.pptx)['ppt/slides/slide1.xml']);
  for(const token of ['（12.3%）','（87.7%）']){
    assert.ok(xml.includes(`<a:t>${token}</a:t>`),'native text stores the complete percentage');
    assert.ok(out.svgPages[0].svg.includes(token),'SVG uses the same intact unit');
  }
  assert.match(xml,/sz="2100"/);assert.doesNotMatch(xml,/<a:(?:normAutofit|spAutoFit)/);assert.deepEqual(p,before);
  p.slides[0].table.columnWeights=[1.7,1.6,1.1];
  const repaired=buildScenes(p),repairedTable=repaired.pages[0].nodes.find(n=>n.kind==='table');
  assert.ok(!repaired.issues.some(i=>i.code==='scientific-token-too-wide'));
  assert.equal(repairedTable.fontSize,28);assert.deepEqual(repairedTable.table.rows,before.slides[0].table.rows);
  assert.deepEqual(repairedTable.cellLines[2][1],['9（12.3%）']);assert.deepEqual(repairedTable.cellLines[3][1],['64（87.7%）']);
});

test('short Chinese final lines and bad punctuation are review warnings without text edits',()=>{
  const text='保留必要验证条件外推',lines=wrapText(text,8*24,24);
  assert.equal(lines.join(''),text);
  assert.ok(scientificWrappingIssues(text,lines,8*24,24,measureTextWidth).some(i=>i.code==='text-short-last-line'&&i.severity==='warning'));
  const explicit='保留来源。\n，检查人工换行';
  assert.ok(scientificWrappingIssues(explicit,wrapText(explicit,400,24),400,24,measureTextWidth).some(i=>i.code==='text-punctuation-break'&&i.severity==='warning'));
});
