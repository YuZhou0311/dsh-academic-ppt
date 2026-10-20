import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { buildScenes, CARD_STYLES, LAYOUTS, wrapText } from '../src/scene.mjs';
import { renderProject, sceneToSvg } from '../src/render.mjs';
import { XMLValidator, XMLParser } from 'fast-xml-parser';
import { PNG } from './fixtures.mjs';
import { REFERENCE_TEMPLATES } from '../src/reference-catalog.mjs';

const data = PNG;
const base = () => ({ schemaVersion: 1, id: 'fixture', revision: 0, title: '学术渲染器测试', brief: { centralQuestion: '如何准确展示证据？', talkMinutes: 13 }, design: {}, papers: [{ id: 'P1', title: 'A complete and deliberately long paper title retained in the native text and speaker notes of this demonstration', authors: ['A. Author'], journal: 'Synthetic test fixture', year: 2026, doi: '10.0000/example', version: 'test fixture' }], claims: [], assets: [{ id: 'fig1', data, width: 400, height: 200, paperId: 'P1', figure: 'Fig. 2', caption: '原图说明 < & >', sourceVersion: 'fixture' }], slides: [], history: [] });
const card = (id, style) => ({ id, title: '研究边界', kind: 'boundary', style, body: '两组指标分别统计。\n不可合并为共同成功率。', claimIds: [] });

test('native PPTX retains independent objects, exact text, figure, chart workbook and full-title notes', async () => {
  const p = base();
  p.slides = [{ id: 's1', layout: 'paper', title: '完整题名与证据来源', paperIds: ['P1'], claimIds: [], notes: '保留这一条讲稿。', seconds: 65, figureIds: ['fig1'], cards: [card('c1', 'dashed-note')] },
    { id: 's2', layout: 'results', title: '测试数据图', paperIds: ['P1'], notes: '图表只使用输入值。', figureIds: [], cards: [card('c2', 'ledger')], chart: { kind: 'column', categories: ['A', 'B'], series: [{ name: '输入值', values: [3, 5] }], unit: '测试单位', sourceClaimId: 'test' } }];
  const before = structuredClone(p), output = await renderProject(p), zip = unzipSync(output.pptx);
  assert.deepEqual(p, before, 'rendering must not mutate the project');
  const xml = strFromU8(zip['ppt/slides/slide1.xml']);
  assert.match(xml, /name="s1\/card\/c1\/frame"/);
  assert.match(xml, /name="s1\/card\/c1\/body"/);
  assert.match(xml, /<p:pic>/);
  assert.ok((xml.match(/<p:sp>/g) || []).length > 8, 'the page is not one bitmap');
  assert.match(xml, /研究边界/);
  const notes = strFromU8(zip['ppt/notesSlides/notesSlide1.xml']);
  assert.match(notes, /保留这一条讲稿/);
  assert.match(notes, /A complete and deliberately long paper title/);
  assert.ok(Object.keys(zip).some(p => /^ppt\/charts\/chart\d+\.xml$/.test(p)));
  assert.ok(Object.keys(zip).some(p => /^ppt\/embeddings\/.*\.xlsx$/.test(p)));
  assert.equal(output.svgPages.length, 2);
  assert.match(output.html, /原图说明 &lt; &amp; &gt;/);
  const picture = output.scenes.pages[0].nodes.find(n => n.kind === 'image');
  assert.equal(picture.w / picture.h, 2, 'contain must retain source aspect ratio');
});

test('all academic layouts and eight native card structures compile with stable IDs', async () => {
  const p = base();
  p.slides = LAYOUTS.map((layout, i) => ({ id: `s${i}`, layout, title: '一个明确的学术问题', paperIds: ['P1'], claimIds: [], notes: '示例讲稿。', seconds: 45, figureIds: ['paper', 'figure-focus'].includes(layout) ? ['fig1'] : ['figure-split', 'results', 'comparison'].includes(layout) ? ['fig1', 'fig1'] : [], cards: ['cover', 'references'].includes(layout) ? [] : [card(`c${i}`, CARD_STYLES[i % CARD_STYLES.length])], nodes: layout === 'method' ? [{ id: 'a', label: '状态', detail: '输入观测' }, { id: 'b', label: '决策', detail: '输入规则' }] : [], edges: layout === 'method' ? [{ from: 'a', to: 'b', label: '调用' }] : [] }));
  const result = await renderProject(p);
  assert.equal(result.scenes.pages.length, 12);
  assert.equal(result.issues.filter(i => i.code === 'out-of-bounds' || i.code === 'invalid-geometry' || i.code.startsWith('unrendered-')).length, 0);
  for (const page of result.scenes.pages) assert.equal(new Set(page.nodes.map(n => n.id)).size, page.nodes.length);
});

test('style-only edits preserve every non-card scene node and all card words and metrics', () => {
  const p = base();
  p.slides = [{ id: 's', layout: 'figure-split', title: '同一证据，局部换框', paperIds: ['P1'], notes: '不可修改的备注。', figureIds: ['fig1'], cards: [{ ...card('c', 'ledger'), metric: { value: '29/39', unit: '年', label: '指标 A', context: '不是两项联合通过率' } }] }];
  const before = buildScenes(p).pages[0];
  for (const style of CARD_STYLES) {
    const next = structuredClone(p); next.slides[0].cards[0].style = style;
    const after = buildScenes(next).pages[0];
    assert.deepEqual(before.nodes.filter(n => !n.id.startsWith('s/card/c/')), after.nodes.filter(n => !n.id.startsWith('s/card/c/')));
    assert.equal(before.notes, after.notes);
    assert.deepEqual(before.nodes.filter(n => n.kind === 'text' && n.cardId).map(n => n.text), after.nodes.filter(n => n.kind === 'text' && n.cardId).map(n => n.text));
  }
});

test('rendering aborts and rejects non-embedded figure data instead of fetching it', async () => {
  await assert.rejects(renderProject(base(), { signal: AbortSignal.abort(new Error('cancel-test')) }), /cancel-test/);
  const p = base(); p.assets[0].data = 'https://example.com/private.png';
  p.slides = [{ id: 's', layout: 'figure-focus', title: '原图', figureIds: ['fig1'], cards: [], notes: '' }];
  await assert.rejects(renderProject(p), /已嵌入/);
});

test('shared text wrapping preserves scientific characters and flags excessive density', () => {
  const raw = '29/39 年，54.9 kg N/ha\n95% CI（示例）';
  assert.equal(wrapText(raw, 500, 22).join('\n'), raw);
  const p = base(); p.slides = [{ id: 's', layout: 'synthesis', title: '边界', cards: [{ ...card('c', 'paper-shadow'), body: '完整文本不得截断。'.repeat(100), box: { x: 50, y: 190, w: 300, h: 180 } }] }];
  const out = buildScenes(p);
  assert.ok(out.issues.some(i => i.code === 'text-overflow-estimate'));
  assert.equal(out.pages[0].nodes.find(n => n.id === 's/card/c/body').text, p.slides[0].cards[0].body);
});

test('portrait source figures keep their aspect while gaining a usable explanatory column', () => {
  const p=base();p.assets[0].width=685;p.assets[0].height=1181;
  p.slides=[{id:'portrait',layout:'figure-focus',title:'Portrait evidence',figureIds:['fig1'],cards:[card('reading','paper-shadow')],notes:''}];
  const page=buildScenes(p).pages[0],pic=page.nodes.find(n=>n.kind==='image'),body=page.nodes.find(n=>n.id==='portrait/card/reading/body');
  assert.ok(Math.abs(pic.w/pic.h-685/1181)<1e-10);
  assert.ok(body.w>=650,'portrait evidence should not force explanatory text into a 308px column');
  assert.ok(pic.x+pic.w<body.x,'figure and explanation must not overlap');
});

test('native count charts preserve exact values and use the same rounded axes as SVG', async () => {
  const p=base();p.slides=[{id:'count',layout:'results',title:'Count fixture',figureIds:[],cards:[],notes:'Synthetic rendering fixture',chart:{kind:'column',categories:['Correct','Incorrect'],series:[{name:'Tasks',values:[17,3]}],unit:'tasks',sourceClaimId:'fixture'}}];
  const out=await renderProject(p),zip=unzipSync(out.pptx),chart=strFromU8(zip[Object.keys(zip).find(path=>/^ppt\/charts\/chart\d+\.xml$/.test(path))]);
  assert.match(chart,/<c:max val="20"/);assert.match(chart,/<c:majorUnit val="5"/);
  assert.match(chart,/<c:showVal val="1"/);assert.match(chart,/<c:v>17<\/c:v>/);assert.match(chart,/<c:v>3<\/c:v>/);
  assert.match(out.svgPages[0].svg,/>17<\/text>/);assert.match(out.svgPages[0].svg,/>20<\/text>/);
});

test('figure-split displays two source figures and their own captions in SVG and native PPTX', async () => {
  const p = base();
  p.assets.push({ ...p.assets[0], id: 'fig2', caption: 'SECOND FIGURE MUST BE VISIBLE', figure: 'Fig. 3', width: 200, height: 400 });
  p.slides = [{ id: 'pair', layout: 'figure-split', title: '两组证据都要呈现', paperIds: ['P1'], claimIds: [], notes: '逐幅说明原图。', seconds: 90, figureIds: ['fig1', 'fig2'], cards: [card('c', 'open-frame')] }];
  const result = await renderProject(p), page = result.scenes.pages[0];
  assert.deepEqual(page.nodes.filter(n => n.kind === 'image').map(n => n.assetId), ['fig1', 'fig2']);
  assert.ok(page.nodes.some(n => n.id === 'pair/figure:0:caption' && n.text.includes('原图说明')));
  assert.ok(page.nodes.some(n => n.id === 'pair/figure:1:caption' && n.text.includes('SECOND FIGURE MUST BE VISIBLE')));
  assert.ok(!result.issues.some(i => i.code === 'unrendered-figure'));
  assert.match(result.svgPages[0].svg, /SECOND FIGURE MUST BE VISIBLE/);
  const xml = strFromU8(unzipSync(result.pptx)['ppt/slides/slide1.xml']);
  assert.equal((xml.match(/<p:pic>/g) || []).length, 2);
  assert.match(xml, /pair\/figure:0:image/); assert.match(xml, /pair\/figure:1:image/);
  assert.match(xml, /SECOND FIGURE MUST BE VISIBLE/);
});

test('unsupported content combinations report every unrendered figure, card, chart and diagram', () => {
  const p = base(), chart = { kind: 'column', categories: ['A'], series: [{ name: 'Data', values: [1] }], unit: 'test', sourceClaimId: 'C1' };
  p.slides = [{ id: 'cover', layout: 'cover', title: 'Coverage', cards: [card('c', 'ledger')], figureIds: ['fig1'], chart, nodes: [{ id: 'n', label: 'Node' }], edges: [{ from: 'n', to: 'n' }], takeaway: 'An invisible takeaway' },
    { id: 'focus', layout: 'figure-focus', title: 'One figure capacity', figureIds: ['fig1', 'fig1'], cards: [], subtitle: 'An invisible subtitle' },
    { id: 'reference', layout: 'references', title: 'Reference content', cards: [card('r', 'ledger')], figureIds: [] },
    { id: 'chart', layout: 'results', title: 'Figure and chart conflict', figureIds: ['fig1'], cards: [], chart }];
  const issues = buildScenes(p).issues;
  for (const code of ['unrendered-figure', 'unrendered-card', 'unrendered-chart', 'unrendered-diagram-node', 'unrendered-diagram-edge']) assert.ok(issues.some(i => i.slideId === 'cover' && i.code === code && i.severity === 'error'), code);
  assert.ok(issues.some(i => i.slideId === 'focus' && i.code === 'unrendered-figure'));
  assert.ok(issues.some(i => i.slideId === 'reference' && i.code === 'unrendered-card'));
  assert.ok(issues.some(i => i.slideId === 'chart' && i.code === 'unrendered-chart'));
  assert.ok(issues.some(i => i.code === 'unrendered-subtitle' && i.severity === 'error'));
  assert.ok(issues.some(i => i.code === 'unrendered-takeaway' && i.severity === 'error'));
});

test('all dynamic SVG attributes are XML-escaped and template colors cannot inject scripts or URLs', async () => {
  const hostile = 'red"></text><script>globalThis.__ACADEMIC_REVIEW_PROBE__=1</script><text fill="red';
  const p = base();
  p.design.templateProfile = { components: [{ id: 'hostile-fixture', width: 300, height: 300, nodes: [{ kind: 'text', x: 0, y: 0, w: 290, h: 30, text: 'Template probe', lines: ['Template probe'], fontSize: 16, lineHeight: 1.2, fontFamily: 'Arial" onload="sentinel', color: hostile }] }] };
  p.slides = [{ id: 's', layout: 'synthesis', title: 'Escaping check', cards: [{ ...card('c', 'ledger'), templateComponentId: 'hostile-fixture' }], figureIds: [], notes: '' }];
  const output = await renderProject(p);
  assert.equal((output.html.match(/<script(?:\s|>)/gi) || []).length, 1, 'only the trusted offline player script may exist');
  assert.doesNotMatch(output.html, /globalThis\.__ACADEMIC_REVIEW_PROBE__=1/);
  assert.equal(XMLValidator.validate(output.svgPages[0].svg), true);
  const direct = { id: 'hostile-page', title: '<script>bad</script>', background: hostile, nodes: [
    { kind: 'text', id: 'text" onload="x', x: 1, y: 2, w: 200, h: 40, text: '<script>bad</script>', lines: ['<script>bad</script>'], fontSize: '16" onload="x', lineHeight: 1.2, fontFamily: 'Arial" onload="x', color: hostile },
    { kind: 'rect', id: 'rect', x: 1, y: 2, w: 20, h: 30, radius: '2" onload="x', fill: 'url(https://example.com/private.svg)', stroke: hostile, fillOpacity: '.5" onload="x', strokeOpacity: '.5" onload="x', strokeWidth: '1" onload="x', shadow: { color: hostile, opacity: '.1" onload="x', offset: 1, blur: '2" onload="x', angle: 0 } },
    { kind: 'line', id: 'line', x: 1, y: 2, w: 20, h: 30, stroke: hostile, strokeWidth: '1" onload="x', endArrow: true },
  ] };
  const svg = sceneToSvg(direct);
  assert.equal(XMLValidator.validate(svg), true);
  assert.doesNotMatch(svg, /<script(?:\s|>)/i);
  assert.doesNotMatch(svg, /url\(https?:/i);
  const tree = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(svg);
  const scan = value => { if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) { assert.notEqual(key, '@_onload'); assert.notEqual(key, 'script'); scan(child); } };
  scan(tree);
});

test('reference layouts consume every authored slot including three figures, native tables and manual node geometry', async () => {
  const p=base();p.assets[0].caption='Synthetic figure';
  p.slides=REFERENCE_TEMPLATES.map((ref,i)=>({
    id:`ref-${i}`,layout:ref.layout,referenceTemplateId:ref.id,title:'合成教学样例：版式几何验证',paperIds:['P1'],notes:'Synthetic layout fixture. No research result is implied.',
    figureIds:ref.slots.figures.map(()=> 'fig1'),cards:ref.slots.cards.map((_,j)=>({id:`c${j}`,kind:'method',title:'研究条件',body:'仅作合成演示。'})),
    nodes:(ref.slots.nodeBoxes||[]).map((_,j)=>({id:`n${j}`,label:`步骤 ${j+1}`,detail:'输入与输出'})),
    edges:(ref.edgePairs||[]).map(([from,to])=>({from:`n${from}`,to:`n${to}`})),
    ...(ref.slots.chart?{chart:{kind:'column',categories:['A','B'],series:[{name:'Synthetic',values:[2,3]}],unit:'test'}}:{}),
    ...(ref.slots.table?{table:{columns:['组别','值','说明'],rows:[['A','3 ± 1','演示'],['B','5 ± 2','演示']],caption:'合成数据；仅用于验证表格布局。'}}:{}),
    ...(ref.slots.takeaway?{takeaway:'结论必须对应证据。'}:{}),...(ref.slots.subtitle?{subtitle:'明确研究对象与比较口径。'}:{})
  }));
  const result=await renderProject(p);
  assert.equal(result.scenes.pages.length,48);
  assert.deepEqual(result.issues.filter(issue=>issue.severity==='error'),[]);
  for(let i=0;i<REFERENCE_TEMPLATES.length;i++){
    const ref=REFERENCE_TEMPLATES[i],page=result.scenes.pages[i];
    assert.equal(page.nodes.filter(n=>n.kind==='image').length,ref.slots.figures.length,ref.id);
    assert.equal(new Set(page.nodes.map(n=>n.id)).size,page.nodes.length,ref.id);
    for(const [j,box] of (ref.slots.nodeBoxes||[]).entries()){
      const n=page.nodes.find(n=>n.id===`${page.id}/node:n${j}:frame`);
      assert.deepEqual({x:n.x,y:n.y,w:n.w,h:n.h},box,'absolute reference node geometry');
    }
  }
  assert.ok(result.scenes.pages.some(page=>page.nodes.filter(n=>n.kind==='image').length===3));
  const zip=unzipSync(result.pptx),slideCount=Object.keys(zip).filter(path=>/^ppt\/slides\/slide\d+\.xml$/.test(path)).length;
  assert.equal(slideCount,48,'native tables must not silently paginate into additional slides');
});

test('source viewports are native non-destructive crops and preserve every original image byte', async()=>{
  const p=base();p.assets[0].viewport={x:.25,y:.1,w:.5,h:.6};
  p.slides=[{id:'crop',layout:'figure-focus',title:'保留完整原图的面板视窗',paperIds:['P1'],figureIds:['fig1'],cards:[],notes:'Panel view.'}];
  const out=await renderProject(p),node=out.scenes.pages[0].nodes.find(n=>n.kind==='image'),zip=unzipSync(out.pptx);
  assert.ok(Math.abs(node.w/node.h-(400*.5)/(200*.6))<1e-10);
  const xml=strFromU8(zip['ppt/slides/slide1.xml']);
  for(const [key,value] of Object.entries({l:25000,t:10000,r:25000,b:30000}))assert.match(xml,new RegExp(`${key}="${value}"`));
  const media=Object.entries(zip).filter(([path])=>path.startsWith('ppt/media/'));
  assert.ok(media.some(([,bytes])=>Buffer.from(bytes).equals(Buffer.from(data.split(',')[1],'base64'))));
  assert.match(out.svgPages[0].svg,/<clipPath/);assert.match(out.svgPages[0].svg,/clip-path="url\(#viewport-/);
  assert.equal(XMLValidator.validate(out.svgPages[0].svg),true);
  const bad=structuredClone(p);bad.assets[0].viewport={x:.8,y:0,w:.5,h:1};
  assert.ok(buildScenes(bad).issues.some(i=>i.code==='invalid-viewport'&&i.severity==='error'));
});

test('editable native tables retain scientific cell text, unit strings and fixed slide count', async()=>{
  const p=base(),table={columns:['处理','均值 ± SD','样本量'],rows:[['合成 A','12.4 ± 1.1 kg/ha','n = 8'],['合成 B','10.2 ± 0.9 kg/ha','n = 8']],caption:'合成表格；不是实测结果。'};
  p.slides=[{id:'table',layout:'comparison',title:'统计口径与原生单元格',paperIds:['P1'],figureIds:[],cards:[],table,notes:'Table fixture.'}];
  const out=await renderProject(p),zip=unzipSync(out.pptx),xml=strFromU8(zip['ppt/slides/slide1.xml']);
  assert.match(xml,/<a:tbl>/);assert.match(xml,/name="table\/data-table"/);assert.match(xml,/12.4 ± 1.1 kg\/ha/);assert.match(xml,/n = 8/);
  assert.match(xml,/<a:spcPts val="2105"/,'23px table text uses an exact 21.045pt baseline step');
  assert.doesNotMatch(xml,/<a:spcPct/,'font natural line metrics must not multiply authored leading');
  assert.equal((xml.match(/<a:tr /g)||[]).length,3);assert.equal((xml.match(/<a:tc>/g)||[]).length,9);
  assert.deepEqual(out.scenes.pages[0].nodes.find(n=>n.kind==='table').table,table);
  assert.match(out.svgPages[0].svg,/role="table"/);assert.equal(XMLValidator.validate(out.svgPages[0].svg),true);
  const crowded=structuredClone(p);crowded.slides[0].table.rows=Array.from({length:14},()=>['内容'.repeat(30),'单位与区间'.repeat(20),'n = 8']);
  const issues=buildScenes(crowded).issues;assert.ok(issues.some(i=>i.code==='table-overflow-estimate'&&i.severity==='error'));
  const conflict=structuredClone(p);conflict.slides[0].layout='figure-focus';
  assert.ok(buildScenes(conflict).issues.some(i=>i.code==='unrendered-table'));
});

test('academic defaults have a compact white header and semantic panels while explicit old styles remain supported',()=>{
  const p=base();p.slides=[{id:'style',layout:'synthesis',title:'研究对象、方法与边界',cards:[{id:'method',kind:'method',title:'方法',body:'原生工具编排。'},{id:'boundary',kind:'boundary',title:'边界',body:'仅限输入证据。'}],figureIds:[],notes:''}];
  const page=buildScenes(p).pages[0];
  assert.equal(page.background,'#FFFFFF');
  const title=page.nodes.find(n=>n.id==='style/title');assert.ok(title.y+title.h<=122);
  assert.ok(page.nodes.some(n=>n.id==='style/card/method/heading-fill'));
  assert.ok(page.nodes.some(n=>n.id==='style/card/boundary/tab'));
  assert.ok(page.nodes.filter(n=>n.role==='body').every(n=>n.fontSize>=23));
  assert.ok(!page.nodes.some(n=>n.id.includes('cover-sidebar')));
  const unknown=structuredClone(p);unknown.slides[0].referenceTemplateId='unknown-ref';
  assert.ok(buildScenes(unknown).issues.some(i=>i.code==='unknown-reference-template'));
});

test('native text leading equals scene geometry and reverse loop rows remain direct connections',async()=>{
  const p=base(),ref=REFERENCE_TEMPLATES.find(t=>t.id==='method-agent-loop');
  p.slides=[{id:'leading',layout:'method',referenceTemplateId:ref.id,title:'行距与反馈环验证',paperIds:[],figureIds:[],cards:[{id:'scope',kind:'setting',title:'输入与条件',body:'第一行保持字号。\n第二行保持行距。'},{id:'review',kind:'boundary',title:'人工复核触发',body:'只针对不确定结果。'}],nodes:ref.slots.nodeBoxes.map((_,i)=>({id:`n${i}`,label:`节点 ${i}`,detail:'合成步骤'})),edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]].map(([a,b])=>({from:`n${a}`,to:`n${b}`})),notes:'Exact leading fixture.'}];
  const out=await renderProject(p),xml=strFromU8(unzipSync(out.pptx)['ppt/slides/slide1.xml']),page=out.scenes.pages[0];
  assert.match(xml,/<a:spcPts val="2139"/);assert.doesNotMatch(xml,/<a:spcPct/);
  assert.ok(!out.issues.some(i=>i.objectId==='leading/card/review/title'));
  for(const i of [3,4]){
    const edge=page.nodes.find(n=>n.id===`leading/edge:${i}`);assert.ok(edge&&edge.w<0&&edge.h===0,'the lower return row should be sequential, not a branching bus');
  }
});

test('CJK line breaking preserves every scientific character and keeps closing punctuation with content',()=>{
  const cases=[
    ['源数据核验降低关键错误。',264,24],
    ['样本为（24 株），包含重复测量。',168,23],
    ['P < 0.05；95% CI（示例）。',154,23],
    ['29/39 年，54.9 kg N/ha；结论边界？',184,23],
    ['结果见 Fig. 4（b），仅限当前样本。',207,23],
    ['保持  两个空格、单位 ± 与比例 17/20。',207,23],
    ['a-very-long-scientific-identifier（示例）。',115,23]
  ];
  const units=s=>[...s].reduce((sum,ch)=>sum+(/\s/u.test(ch)?.3:/[\u0000-\u024f]/u.test(ch)?.53:1),0);
  for(const [text,width,size] of cases){
    const lines=wrapText(text,width,size);
    assert.equal(lines.join(''),text,'wrapping must not discard spaces, units, signs or punctuation');
    for(const line of lines){
      assert.ok(!/^[\s]*[，。！？；：、）》〉」』】〕）］｝’”….,!?;:\])}%％]/u.test(line),`illegal line start: ${line}`);
      assert.ok(!/[（(［\[｛{《〈「『【〔‘“]$/u.test(line),`illegal line end: ${line}`);
      assert.ok(units(line)*size<=width+1e-8,`line exceeds assigned width: ${line}`);
    }
  }
  assert.ok(wrapText('样本17/20；边界清楚。',207,23).some(line=>line.includes('17/20')),'a fitting denominator remains an intact lexical unit');
});

test('authored panel titles replace generic labels without changing panel or evidence geometry',()=>{
  const p=base(),ref=REFERENCE_TEMPLATES.find(t=>t.id==='figure-wide-annotated');
  p.slides=[{id:'panel',layout:ref.layout,referenceTemplateId:ref.id,title:'原图面板身份',paperIds:['P1'],figureIds:['fig1'],cards:ref.slots.cards.map((_,i)=>({id:'c'+i,title:'证据口径',body:'保持原文。'})),notes:''}];
  const before=buildScenes(p).pages[0];p.slides[0].panelTitles=['Fig. 4 结果摘要'];const after=buildScenes(p).pages[0];
  assert.equal(after.nodes.find(n=>n.id==='panel/panel:0:title').text,'Fig. 4 结果摘要');
  assert.deepEqual(before.nodes.filter(n=>n.id!=='panel/panel:0:title'),after.nodes.filter(n=>n.id!=='panel/panel:0:title'));
  const a=before.nodes.find(n=>n.id==='panel/panel:0:title'),b=after.nodes.find(n=>n.id==='panel/panel:0:title');
  for(const key of ['x','y','w','h','fontSize'])assert.equal(a[key],b[key]);
});

test('reference reading labels reflect full text, abstract or metadata access in both SVG and native PPTX',async()=>{
  const p=base(),statuses=['full-text','abstract-only','metadata-only'],labels=['全文阅读范围：','摘要阅读范围：','书目/材料说明：'];
  p.papers=statuses.map((status,i)=>({...p.papers[0],id:i===2?'P_SYNTHETIC_LONG_IDENTIFIER':`P${i+1}`,reading:{status,sections:['已登记材料范围']}}));
  p.slides=p.papers.map((paper,i)=>({id:`reading-${i}`,layout:'references',title:'来源与实际阅读范围',paperIds:[paper.id],figureIds:[],cards:[],notes:'Reference status fixture.'}));
  const out=await renderProject(p),zip=unzipSync(out.pptx);
  for(let i=0;i<3;i++){
    const xml=strFromU8(zip[`ppt/slides/slide${i+1}.xml`]),svg=out.svgPages[i].svg;
    for(const text of [xml,svg]){
      assert.ok(text.includes(labels[i]));
      for(const [j,label] of labels.entries())if(i!==j)assert.ok(!text.includes(label));
    }
  }
  const page=out.scenes.pages[2];
  assert.equal(page.nodes.find(n=>n.role==='reference-index').text,'[1]');
  assert.ok(page.nodes.some(n=>n.role==='citation'&&n.text.includes('P_SYNTHETIC_LONG_IDENTIFIER')));
  assert.ok(!out.issues.some(i=>i.objectId?.endsWith('/ref:P_SYNTHETIC_LONG_IDENTIFIER:id')));
});

test('native table row geometry reserves glyph-width uncertainty before positioning its caption',async()=>{
  const p=base();p.slides=[{id:'table-wrap',layout:'comparison',referenceTemplateId:'experiment-baseline-controls',title:'同信息与同预算的对照',paperIds:[],figureIds:[],cards:[{id:'a',title:'预算',body:'保持共同预算。'},{id:'b',title:'边界',body:'只作合成演示。'}],notes:'Regression for native table expansion.',table:{columns:['对照','观测/预报','动作','调参条件'],rows:[['规则基线','同源传感+3日预报','0/2/4 mm','同等验证预算'],['RL策略','同源传感+3日预报','0/2/4 mm','同等验证预算'],['去预报消融','同源传感；无预报','0/2/4 mm','同等验证预算'],['Oracle参考','同源传感+完整未来','0/2/4 mm','单列成本与身份']],caption:'教学表格；未执行的比较设计。'}}];
  const out=await renderProject(p),page=out.scenes.pages[0],table=page.nodes.find(n=>n.kind==='table'),caption=page.nodes.find(n=>n.id==='table-wrap/table-caption');
  assert.equal(table.cellLines[1][1].length,2,'the near-boundary phrase must wrap before the native application adds a line');
  assert.equal(table.cellLines[2][1].length,2);
  assert.ok(table.rowHeights[1]>table.rowHeights[0]+20);
  assert.ok(caption.y>=table.y+table.h+7);
  const xml=strFromU8(unzipSync(out.pptx)['ppt/slides/slide1.xml']);
  assert.equal((xml.match(/<a:tr /g)||[]).length,5);
  assert.ok(!out.issues.some(i=>i.severity==='error'));
});

test('long mixed-script figure licenses remain separate complete entries inside the reference column',async()=>{
  const p=base(),panels=['完整图','任务1','任务2 PLA曲线','任务4统计汇总','相关性结果'];
  p.papers[0].reading={status:'full-text',sections:['Introduction','Design','Case studies 1–3','Evaluation','Discussion','Methods']};
  p.assets=panels.map((panel,i)=>({...p.assets[0],id:`a${i}`,figure:i===4?'Fig. 4':'Fig. 3',panel,license:'CC BY 4.0'}));
  p.slides=[...p.assets.map((asset,i)=>({id:`figure${i}`,layout:'figure-focus',title:'原图身份',paperIds:['P1'],figureIds:[asset.id],cards:[],notes:''})),{id:'refs',layout:'references',referenceTemplateId:'plan-reference-notes',title:'来源与原图授权',paperIds:['P1'],figureIds:[],cards:[{id:'a',title:'结论',body:'按原文限定。'},{id:'b',title:'材料',body:'原图许可完整保留。'}],notes:''}];
  const out=await renderProject(p),detail=out.scenes.pages.at(-1).nodes.find(n=>n.role==='source-details');
  const paragraphs=detail.text.split('\n'),licenseStart=paragraphs.indexOf('原图授权：');
  assert.ok(licenseStart>=0);
  for(const [i,asset] of p.assets.entries())assert.equal(paragraphs[licenseStart+i+1],[asset.figure,asset.panel,asset.license].join(' · '));
  for(const line of detail.lines.filter(line=>line.includes('CC BY')))assert.equal((line.match(/CC BY/g)||[]).length,1,'one asset per line prevents a dense mixed-script paragraph crossing columns');
  const xml=strFromU8(unzipSync(out.pptx)['ppt/slides/slide6.xml']);
  assert.equal((xml.match(/CC BY 4.0/g)||[]).length,5);
  for(const panel of panels)assert.ok(xml.includes(panel));
});
