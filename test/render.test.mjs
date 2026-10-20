import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { buildScenes, CARD_STYLES, LAYOUTS, wrapText } from '../src/scene.mjs';
import { renderProject, sceneToSvg } from '../src/render.mjs';
import { XMLValidator, XMLParser } from 'fast-xml-parser';
import { PNG } from './fixtures.mjs';

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
  assert.ok(issues.some(i => i.code === 'unrendered-subtitle' && i.severity === 'warning'));
  assert.ok(issues.some(i => i.code === 'unrendered-takeaway' && i.severity === 'warning'));
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
