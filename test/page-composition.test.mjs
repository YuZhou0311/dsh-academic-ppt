import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { assertToolArgs } from '../src/schema.mjs';
import { buildScenes, wrapText, measureTextWidth } from '../src/scene.mjs';
import { renderProject } from '../src/render.mjs';
import { DEFAULT_DESIGN } from '../src/core.mjs';
import { measureCardSurface, resolveCardAppearance } from '../src/card-surface.mjs';
import { designIssues, structureOf, similarStructure } from '../src/design-quality.mjs';

// Synthetic information and geometry only; no research observations are asserted.
const clone = structuredClone;
const body = (id, text, x = 0, y = 0, w = 800, h = 38) => ({ id, kind:'text', x, y, w, h, text, fontSize:28, role:'body' });
const drawing = (id = 'evidence', changes = {}) => ({ id, width:1000, height:400, elements:[body('label', 'Synthetic comparison; units retained')], ...changes });
const card = (changes = {}) => ({ id:'condition', kind:'setting', title:'实验条件', body:'保留条件、单位与解释。', claimIds:[], ...changes });
const slide = (changes = {}) => ({ id:'s', layout:'academic', title:'完整条件支持直接比较', paperIds:[], claimIds:[], figureIds:[], cards:[], notes:'Synthetic regression fixture.', seconds:60, ...changes });
const project = slides => ({ title:'Page composition regression', design:{ ...clone(DEFAULT_DESIGN), chrome:{ header:'plain', showBrand:false, showSection:false, showSources:false, showFooter:false, showPageNumber:false, showTopRule:false } }, papers:[], claims:[], assets:[], slides });
const get = (page, suffix) => page.nodes.find(node => node.id.endsWith(suffix));
const errors = value => value.issues.filter(issue => issue.severity === 'error');
const codes = p => designIssues(p).map(issue => issue.code);
const record = slides => assertToolArgs('academic_ppt_record', { projectPath:'project.json', expectedRevision:0, slides });
const plan = ids => ({ relationship:'evidence-explanation', primaryPanelId:ids[0], readingOrder:ids, rationale:'保留观察、解释与条件的邻接关系。' });

test('authored titles opt into chapter chrome without changing their box or legacy behavior', () => {
  const heading = { box:{ x:48, y:72, w:1184, h:56 }, fontSize:44, inheritChrome:true };
  const s = slide({ heading, sectionId:'comparison', drawings:[drawing('evidence', { box:{ x:48, y:200, w:1000, h:400 } })] });
  const p = project([s]);
  p.brief = { narrative:{ throughline:'用同一条件比较合成输入。', sections:[{ id:'comparison', title:'比较条件', question:'怎样使比较成立？' }] } };
  p.design.chrome = { ...p.design.chrome, header:'band', showSection:true, showBrand:true };
  p.design.branding = { label:'研究报告' };
  assert.doesNotThrow(() => record(p.slides));
  const before = clone(p), page = buildScenes(p).pages[0], title = get(page, '/title');
  assert.deepEqual(errors(page), []);
  assert.deepEqual(p, before, 'inherited furniture never mutates the authored input');
  for (const key of ['x','y','w','h']) assert.equal(title[key], heading.box[key]);
  assert.equal(title.fontSize, 44);
  assert.equal(get(page, '/academic-header-band').h, 54);
  assert.equal(get(page, '/section-label').text, '01  比较条件');
  assert.equal(page.nodes.filter(node => node.role === 'section-label').length, 1);
  assert.ok(get(page, '/section-label').y < title.y);
  assert.equal(get(page, '/brand-label').text, '研究报告');
  assert.ok(page.contentBox.y >= title.y + title.h + 16);

  const legacy = clone(p); delete legacy.slides[0].heading.inheritChrome;
  const old = buildScenes(legacy).pages[0];
  assert.equal(get(old, '/academic-header-band'), undefined);
  assert.equal(get(old, '/brand-label'), undefined);
  assert.ok(get(old, '/section-label').y > title.y + title.h, 'the existing authored-heading route remains unchanged');
  assert.deepEqual(errors(old), []);

  const collision = clone(p); collision.slides[0].heading.box.y = 24;
  const collided = buildScenes(collision).pages[0];
  assert.ok(codesFrom(collided).includes('heading-chrome-overlap'));
  assert.equal(get(collided, '/title').y, 24);
  assert.equal(get(collided, '/title').fontSize, 44, 'a conflict is reported, never repaired by shrinking');
});

const codesFrom = value => errors(value).map(issue => issue.code);

test('an inherited band can hold the authored title when no chapter identity is requested', () => {
  const p = project([slide({ heading:{ box:{ x:120, y:24, w:1040, h:56 }, fontSize:44, inheritChrome:true }, drawings:[drawing('evidence', { box:{ x:48, y:140, w:1000, h:400 } })] })]);
  p.design.chrome.header = 'band';
  const page = buildScenes(p).pages[0], band = get(page, '/academic-header-band'), title = get(page, '/title');
  assert.deepEqual(errors(page), []);
  assert.equal(title.x, 120); assert.equal(title.y, 24); assert.equal(title.color, '#FFFFFF');
  assert.ok(band.y <= title.y && band.y + band.h >= title.y + title.h);
  assert.ok(page.contentBox.y >= band.y + band.h + 16);
});

test('card layout variants use measured title and body boxes and retain native editable output', async () => {
  const p = project(['stacked','banded','side-label'].map((layout, i) => slide({ id:`card-${i}`, cards:[card({ title:'完整变量与\n重复测量条件', icon:'evidence', metric:{ value:'12.5', unit:'t/ha', label:'合成指标', context:'同一验证口径。' }, appearance:{ layout, surface:'outline', accent:'none', padding:16 } })], composition:{ regions:[{ id:'content', title:'', heading:'hidden', surface:'plain', padding:0, cardIds:['condition'], box:{ x:48, y:140, w:1184, h:480 } }] } })));
  assert.doesNotThrow(() => record(p.slides));
  const before = clone(p), out = await renderProject(p), zip = unzipSync(out.pptx);
  assert.deepEqual(errors(out), []);
  assert.deepEqual(p, before);
  for (const [index, page] of out.scenes.pages.entries()) {
    const c = p.slides[index].cards[0], frame = get(page, '/card/condition/surface');
    const measured = measureCardSurface(c, frame.w, { design:p.design, system:p.design.system, wrapText, measureTextWidth });
    const title = get(page, '/card/condition/title'), bodyNode = get(page, '/card/condition/body');
    assert.ok(measured.minimumH <= frame.h + 1);
    for (const key of ['x','y']) assert.equal(title[key], frame[key] + measured.titleBox[key]);
    for (const key of ['w','h']) assert.equal(title[key], measured.titleBox[key]);
    for (const row of measured.rows) {
      const node = get(page, `/card/condition/${row.key}`);
      assert.equal(node.text, row.value);
      assert.equal(node.x, frame.x + row.x); assert.equal(node.y, frame.y + row.y);
      assert.equal(node.w, row.w); assert.equal(node.h, row.h);
      assert.ok(node.y + node.estimatedTextHeight <= frame.y + frame.h - 15);
    }
    if (c.appearance.layout === 'side-label') assert.ok(title.x + title.w < bodyNode.x, 'conditions have a separate label rail');
    else assert.ok(title.y + title.h < bodyNode.y, 'stacked and banded bodies follow the complete heading');
    if (c.appearance.layout === 'banded') {
      assert.equal(title.color, '#FFFFFF');
      assert.ok(get(page, '/card/condition/heading-surface').y + measured.headerBox.h <= bodyNode.y);
    }
    const xml = strFromU8(zip[`ppt/slides/slide${index + 1}.xml`]);
    assert.equal((xml.match(/<p:pic>/g) || []).length, 0, 'new layouts remain native text and shapes');
    assert.ok(xml.includes('card/condition/body'));
  }
});

test('card layout is opt-in and narrow side labels report overflow without shrinking', () => {
  const p = project([]), c = card();
  assert.equal(resolveCardAppearance(c, p.design).layout, 'stacked');
  for (const style of ['academic-side','academic-panel','title-band','split-label']) {
    assert.equal(resolveCardAppearance({ ...c, style }, p.design), null, `explicit legacy style ${style} retains its renderer`);
  }
  assert.equal(resolveCardAppearance({ ...c, style:'academic-panel', appearance:{ layout:'side-label' } }, p.design).layout, 'side-label', 'an explicit appearance opts into the new surface renderer');
  const narrow = slide({ cards:[card({ appearance:{ layout:'side-label' }, metric:{ value:'123456789', unit:'mg L−1', label:'合成单位' } })], composition:{ regions:[{ id:'condition', title:'', heading:'hidden', padding:0, surface:'plain', cardIds:['condition'], box:{ x:48, y:140, w:300, h:480 } }] } });
  const page = buildScenes(project([narrow])).pages[0];
  assert.ok(codesFrom(page).includes('card-metric-width'));
  assert.equal(get(page, '/card/condition/metric').fontSize, 38);
  assert.equal(get(page, '/card/condition/metric').text, '123456789 mg L−1');
});

test('twelve-region plans accept optional content roles and reject empty or foreign carriers', () => {
  const ids = Array.from({ length:12 }, (_, i) => `r${i + 1}`);
  const regions = ids.map((id, i) => ({ id, title:'', heading:'hidden', padding:0, surface:'plain', box:{ x:48 + (i % 4) * 296, y:140 + Math.floor(i / 4) * 168, w:280, h:150 }, drawingIds:[id] }));
  const s = slide({ composition:{ regions }, drawings:ids.map(id => drawing(id, { width:280, height:150, elements:[body('text', '合成说明', 0, 0, 280)] })), visualPlan:{ ...plan(ids), contentLayers:[{ role:'evidence', panelIds:ids.slice(0, 4), summary:'第一组比较数据。' },{ role:'conditions', panelIds:ids.slice(4), summary:'其余区域保留条件与解释。' }] } });
  assert.doesNotThrow(() => record([s]));
  assert.deepEqual(designIssues(project([s])).filter(issue => issue.severity === 'error'), []);
  for (const badIds of [[], ['r1','r1'], ['other-slide']]) {
    const bad = clone(s); bad.visualPlan.contentLayers[0].panelIds = badIds;
    assert.ok(codes(project([bad])).includes('visual-layer-panel-ids'));
  }
  const decoration = clone(s);
  decoration.drawings[0].elements = [{ id:'frame', kind:'rect', x:0, y:0, w:280, h:150, role:'group' }];
  assert.ok(codes(project([decoration])).includes('visual-layer-empty-panel'));
  const titleOnly = clone(s); titleOnly.drawings = titleOnly.drawings.slice(1); titleOnly.composition.regions[0].drawingIds = [];
  titleOnly.cards = [card({ body:'' })]; titleOnly.composition.regions[0].cardIds = ['condition'];
  assert.ok(codes(project([titleOnly])).includes('visual-layer-empty-panel'), 'a title and frame cannot satisfy an information layer');
  const old = clone(decoration); delete old.visualPlan.contentLayers;
  assert.ok(!codes(project([old])).some(code => code.startsWith('visual-layer-')), 'old plans do not acquire a mandatory density checklist');
  const invalidRole = clone(s); invalidRole.visualPlan.contentLayers[0].role = 'decoration';
  assert.throws(() => record([invalidRole]), /INVALID_INPUT/);
});

test('content layers distinguish drawing headings from pure textual explanation and qualifications', () => {
  const d = drawing('textual', { elements:[{ ...body('heading','实验条件'), role:'title' }, { ...body('label','合成题签',0,60), role:'label' }, { id:'frame', kind:'rect', x:0, y:0, w:1000, h:400, role:'group' }, { id:'rule', kind:'line', points:[{x:0,y:110},{x:1000,y:110}], role:'decoration' }] });
  const s = slide({ drawings:[d], composition:{ regions:[{ id:'explanation', title:'', box:{x:48,y:140,w:1000,h:400}, drawingIds:['textual'] }] }, visualPlan:{ ...plan(['explanation']), contentLayers:[{role:'explanation',panelIds:['explanation'],summary:'可见条件说明。'}] } });
  assert.doesNotThrow(() => record([s]));
  assert.ok(codes(project([s])).includes('visual-layer-empty-panel'), 'titles, labels and decorative furniture alone do not satisfy a content layer');
  for (const role of ['body','note']) {
    d.elements.push({ ...body('content','条件与单位得到保留。',0,140), role });
    assert.ok(!codes(project([s])).includes('visual-layer-empty-panel'), `${role} can carry a pure textual explanation without an imposed graphic or word quota`);
    d.elements.pop();
  }
});

function evidenceSlide(id, shift = 0, standalone = false) {
  const d = drawing('research', { box:{ x:48 + shift, y:140, w:760, h:440 }, width:760, height:440, elements:[body('caption', `合成条件 ${id}`, 20 + shift, 14, 700), { id:'value', kind:'rect', x:80, y:90, w:100 + shift * 4, h:200, role:'data', fill:shift ? '#7D524B' : '#416C70' }, { id:'axis', kind:'line', points:[{ x:40, y:330 },{ x:700, y:330 }], role:'decoration' }] });
  if (standalone) return slide({ id, drawings:[d] });
  return slide({ id, cards:[card()], drawings:[d], composition:{ regions:[{ id:'evidence', title:'', box:{ x:48 + shift, y:140, w:760, h:440 }, drawingIds:['research'] },{ id:'condition', title:'', box:{ x:840 + shift, y:140, w:360, h:440 }, cardIds:['condition'] }] }, visualPlan:plan(['evidence','condition']) });
}

test('free region and drawing repetition ignores small nudges, recoloring and observed mark lengths', () => {
  for (const standalone of [false,true]) {
    const slides = [evidenceSlide('a',0,standalone), evidenceSlide('b',8,standalone), evidenceSlide('c',16,standalone)], p = project(slides);
    assert.ok(codes(p).includes('layout-repetition'));
    const different = clone(slides[2]);
    different.drawings[0].elements.push({ id:'new-relation', kind:'line', points:[{ x:200, y:180 },{ x:520, y:180 }], role:'relationship', endArrow:true });
    assert.ok(!similarStructure(structureOf(slides[0]), structureOf(different)), 'a new relation changes the information structure');
    if (!standalone) {
      const reallocated = clone(slides[2]); reallocated.composition.regions[0].box.w = 440;
      assert.ok(!similarStructure(structureOf(slides[0]), structureOf(reallocated)));
      slides[2].visualPlan.repetitionReason = '同一实验的三个批次保留相同坐标、单位和证据位置，便于直接比较。';
      assert.ok(!codes(p).includes('layout-repetition'));
      slides[2].visualPlan.contentLayers = [{ role:'conditions', panelIds:['missing'], summary:'故意无效的引用。' }];
      assert.ok(codes(p).includes('visual-layer-panel-ids'), 'scientific comparability never suppresses invalid references');
    }
  }
  const slides = [evidenceSlide('a'), evidenceSlide('b',8), evidenceSlide('c',16), evidenceSlide('d',6), slide({ id:'other', layout:'method' })];
  const dominance = designIssues(project(slides)).find(issue => issue.code === 'deck-layout-dominance');
  assert.equal(dominance.matchingSlides, 4); assert.equal(dominance.severity, 'warning');
});

test('equal text groups include free regions and nested drawing leaves but exclude real relationships', () => {
  const groups = [0,1,2].flatMap(i => [{ id:`frame-${i}`, kind:'rect', x:20 + i * 320, y:20, w:300, h:160, role:'group' }, body(`text-${i}`, `合成条件 ${i}`, 36 + i * 320, 40, 268, 80)]);
  const d = drawing('text-groups', { elements:[{ id:'outer', kind:'rect', x:0, y:0, w:1000, h:200, role:'group' }, ...groups] });
  const s = slide({ drawings:[d] });
  const reminder = designIssues(project([s])).find(issue => issue.code === 'equal-text-panels');
  assert.equal(reminder.severity, 'warning'); assert.match(reminder.message, /可以保留/);
  d.elements.push({ id:'relationship', kind:'line', points:[{ x:320, y:100 },{ x:340, y:100 }], role:'relationship', endArrow:true });
  assert.ok(!codes(project([s])).includes('equal-text-panels'), 'an explicit mechanism is not treated as an undifferentiated text grid');
  const ids = ['a','b','c'], free = slide({ cards:ids.map(id => card({ id })), composition:{ regions:ids.map((id,i) => ({ id, title:'', box:{ x:48 + i * 400, y:160, w:380, h:350 }, cardIds:[id] })) }, visualPlan:plan(ids) });
  assert.ok(codes(project([free])).includes('equal-text-panels'));
  free.composition.regions[0].box.h = 600;
  assert.ok(!codes(project([free])).includes('equal-text-panels'), 'substantial hierarchy is preserved');
});
