import test from 'node:test';
import assert from 'node:assert/strict';
import { designIssues } from '../src/design-quality.mjs';
import { assertToolArgs } from '../src/schema.mjs';

const panel = (id, extra = {}) => ({ id, title: id, cardIds: [`card-${id}`], ...extra });
const slide = (id, extra = {}) => ({
  id, layout: 'academic', cards: [], figureIds: [],
  composition: { rows: [{ panels: [panel('evidence', { weight: 2, cardIds: [], figureIds: ['source'] }), panel('explanation')] }] },
  visualPlan: { relationship: 'evidence-explanation', primaryPanelId: 'evidence', readingOrder: ['evidence', 'explanation'], rationale: '证据先于解释，保留原图与限定。' },
  ...extra,
});
const project = (slides, mode = 'content-led') => ({ design: { ...(mode ? { mode } : {}) }, slides });
const codes = value => designIssues(value).map(issue => issue.code);
const errors = value => designIssues(value).filter(issue => issue.severity === 'error');

test('a concise plan validates against actual panels without rewriting authored content', () => {
  const p = project([slide('s1')]), before = structuredClone(p);
  assert.deepEqual(designIssues(p), []);
  assert.deepEqual(p, before);
});

test('a visual plan must name an existing primary panel and every panel exactly once', () => {
  const s = slide('s1'), p = project([s]);
  s.visualPlan.primaryPanelId = 'other-slide-panel';
  assert.deepEqual(errors(p).map(issue => issue.code), ['visual-plan-primary-panel']);
  assert.equal(errors(p)[0].path, 'slides.s1.visualPlan.primaryPanelId');
  s.visualPlan.primaryPanelId = 'evidence';
  for (const order of [['evidence'], ['evidence', 'evidence'], ['evidence', 'other-slide-panel'], ['evidence', 'explanation', 'explanation']]) {
    s.visualPlan.readingOrder = order;
    assert.deepEqual(errors(p).map(issue => issue.code), ['visual-plan-reading-order'], order.join(','));
  }
  s.visualPlan.readingOrder = ['explanation', 'evidence'];
  assert.deepEqual(errors(p), [], 'a declared reading order need not be row-major');
});

test('plans without composition are errors even when faithful template use is requested', () => {
  const s = slide('s1'); delete s.composition; s.layout = 'results';
  for (const mode of ['content-led', 'reference-guided', 'template-faithful', undefined]) {
    assert.deepEqual(errors(project([s], mode)).map(issue => issue.code), ['visual-plan-layout']);
  }
});

test('new authoring modes request a missing plan as a warning while legacy projects remain compatible', () => {
  const s = slide('s1'); delete s.visualPlan;
  for (const mode of ['content-led', 'reference-guided']) {
    const found = designIssues(project([s], mode));
    assert.equal(found.length, 1); assert.equal(found[0].code, 'design-plan-missing');
    assert.equal(found[0].severity, 'warning');
  }
  for (const mode of [null, 'template-faithful']) assert.deepEqual(designIssues(project([s], mode)), []);
  assert.deepEqual(designIssues(project([{ id: 'cover', layout: 'cover' }])), []);
});

test('the third adjacent repeated composition warns regardless of titles, source IDs, colours and surfaces', () => {
  const slides = ['s1', 's2', 's3'].map(id => slide(id));
  slides[1].composition.rows[0].panels[0].surface = 'plain';
  slides[2].composition.rows[0].panels[0].surface = 'band';
  slides[2].composition.rows[0].panels[0].align = 'start';
  slides[2].composition.rows[0].panels[0].title = '另一来源';
  slides[2].composition.rows[0].panels[0].figureIds = ['different-source'];
  slides[2].visualPlan.relationship = 'comparison';
  const found = designIssues(project(slides));
  assert.deepEqual(found.map(issue => [issue.code, issue.slideId, issue.severity]), [['layout-repetition', 's3', 'warning']]);
});

test('proportional weights are the same layout while genuine row and column reallocation differ', () => {
  const slides = ['s1', 's2', 's3'].map(id => slide(id));
  slides[2].composition.rows[0].panels[0].weight = 4;
  slides[2].composition.rows[0].panels[1].weight = 2;
  assert.ok(codes(project(slides)).includes('layout-repetition'), '2:1 and 4:2 allocate the same columns');
  slides[2].composition.rows[0].panels[0].weight = 3;
  assert.ok(!codes(project(slides)).includes('layout-repetition'));

  const twoRows = id => {
    const s = slide(id), panels = s.composition.rows[0].panels;
    s.composition.rows = [{ weight: 1, panels: [panels[0]] }, { weight: 1, panels: [panels[1]] }];
    return s;
  };
  const rows = ['r1', 'r2', 'r3'].map(twoRows);
  assert.ok(codes(project(rows)).includes('layout-repetition'));
  rows[2].composition.rows[1].weight = 2;
  assert.ok(!codes(project(rows)).includes('layout-repetition'));
});

test('carrier changes and intervening navigation break a repetition run', () => {
  const slides = ['s1', 's2', 's3'].map(id => slide(id));
  const last = slides[2].composition.rows[0].panels[0];
  delete last.figureIds; last.table = true;
  assert.ok(!codes(project(slides)).includes('layout-repetition'));
  const withSection = [slide('a'), slide('b'), { id: 'section', layout: 'section' }, slide('c')];
  assert.ok(!codes(project(withSection)).includes('layout-repetition'));
});

test('intentional repeated comparison can carry a reason without suppressing invalid references', () => {
  const slides = ['s1', 's2', 's3'].map(id => slide(id));
  slides[2].visualPlan.repetitionReason = '同一实验的三个批次采用相同坐标和证据位置，方便直接比较。';
  assert.ok(!codes(project(slides)).includes('layout-repetition'));
  slides[2].visualPlan.readingOrder = ['missing'];
  assert.ok(codes(project(slides)).includes('visual-plan-reading-order'));
  slides[2].visualPlan.repetitionReason = '  ';
  assert.ok(codes(project(slides)).includes('layout-repetition'));
});

test('three equal-area text panels prompt review without demanding decorative figures', () => {
  const s = slide('s1', { composition: { rows: [{ panels: ['a', 'b', 'c'].map(id => panel(id)) }] } });
  s.visualPlan = { ...s.visualPlan, primaryPanelId: 'a', readingOrder: ['a', 'b', 'c'] };
  const found = designIssues(project([s]));
  assert.deepEqual(found.map(issue => [issue.code, issue.severity]), [['equal-text-panels', 'warning']]);
  assert.match(found[0].message, /可以保留/);
  assert.match(found[0].message, /虚构数据/);
  s.composition.rows[0].panels[0].weight = 2;
  assert.ok(!codes(project([s])).includes('equal-text-panels'));
  s.composition.rows[0].panels[0].weight = 1;
  s.composition.rows[0].panels[0].table = true;
  assert.ok(!codes(project([s])).includes('equal-text-panels'), 'mixed evidence is not classified as an all-text grid');
});

test('equal text panels in multiple rows count as an equal-area text grid', () => {
  const s = slide('s1', { composition: { rows: [{ panels: [panel('a'), panel('b')] }, { panels: [panel('c'), panel('d')] }] } });
  s.visualPlan = { ...s.visualPlan, primaryPanelId: 'a', readingOrder: ['a', 'b', 'c', 'd'] };
  assert.ok(codes(project([s])).includes('equal-text-panels'));
  s.composition.rows[0].weight = 2;
  assert.ok(!codes(project([s])).includes('equal-text-panels'));
});

test('faithful template mode skips design preference reminders while retaining structural plan errors', () => {
  const slides = ['s1', 's2', 's3'].map(id => slide(id, { composition: { rows: [{ panels: ['a', 'b', 'c'].map(id => panel(id)) }] }, visualPlan: undefined }));
  assert.deepEqual(designIssues(project(slides, 'template-faithful')), []);
  slides[2].visualPlan = { relationship: 'comparison', primaryPanelId: 'not-present', readingOrder: ['a', 'b', 'c'], rationale: '保持共同条件。' };
  assert.deepEqual(codes(project(slides, 'template-faithful')), ['visual-plan-primary-panel']);
});

test('legacy fixed layouts retain repetition advice with no new required plan', () => {
  const slides = ['s1', 's2', 's3'].map(id => ({ id, layout: 'results', referenceTemplateId: 'results-fixture' }));
  assert.deepEqual(codes(project(slides, null)), ['layout-repetition']);
  for (const s of slides) s.layout = 'references';
  assert.deepEqual(designIssues(project(slides, null)), []);
});

test('repetition advice leads to a valid repair for each public slide contract', () => {
  const complete = s => ({ title: '同条件比较', paperIds: [], claimIds: [], notes: '保留相同证据位置以便比较。', seconds: 60, ...s });
  const validate = slides => assertToolArgs('academic_ppt_record', { projectPath: 'project.json', expectedRevision: 0, slides });
  for (const referenceTemplateId of [undefined, 'results-fixture']) {
    const legacy = ['s1', 's2', 's3'].map(id => complete({ id, layout: 'results', figureIds: [], cards: [], ...(referenceTemplateId ? { referenceTemplateId } : {}) }));
    const p = project(legacy, null), reminder = designIssues(p).find(issue => issue.code === 'layout-repetition');
    assert.ok(reminder);
    assert.doesNotMatch(reminder.message, /visualPlan/);
    assert.match(reminder.message, /人工确认/);
    // Following this advice can legitimately retain comparable fixed layouts.
    // It does not require adding a plan that those layouts cannot accept.
    assert.doesNotThrow(() => validate(legacy));
    assert.deepEqual(errors(p), []);
    assert.ok(legacy.every(s => !Object.hasOwn(s, 'visualPlan')));
  }

  const composed = ['c1', 'c2', 'c3'].map(id => complete(slide(id))), p = project(composed);
  const reminder = designIssues(p).find(issue => issue.code === 'layout-repetition');
  assert.match(reminder.message, /visualPlan\.repetitionReason/);
  composed[2].visualPlan.repetitionReason = '三个批次保留同一证据位置和比较条件，帮助听众直接比较。';
  assert.doesNotThrow(() => validate(composed));
  assert.deepEqual(designIssues(p), []);
});

test('small weight nudges and additional empty cards cannot disguise a repeated structure', () => {
  const slides = ['s1', 's2', 's3'].map(id => slide(id));
  slides[1].composition.rows[0].panels[0].weight = 2.05;
  slides[2].composition.rows[0].panels[0].weight = 2.12;
  slides[2].cards.push({ id: 'filler', title: '装饰标签', body: '', claimIds: [] });
  slides[2].composition.rows[0].panels[0].cardIds.push('filler');
  assert.ok(codes(project(slides)).includes('layout-repetition'));
});

test('whole-deck dominance detects a repeated structure separated by other pages', () => {
  const different = id => {
    const s = slide(id); s.composition.rows[0].panels[0].figureIds = []; s.composition.rows[0].panels[0].table = true;
    return s;
  };
  const slides = [slide('a'), different('x'), slide('b'), slide('c'), different('y'), slide('d')];
  const found = designIssues(project(slides)).filter(issue => issue.code === 'deck-layout-dominance');
  assert.equal(found.length, 1);
  assert.equal(found[0].matchingSlides, 4);
  assert.equal(found[0].bodySlides, 6);
  assert.deepEqual(found[0].relatedSlideIds, ['a', 'b', 'c', 'd']);
  for (const s of slides) s.visualPlan.repetitionReason = '同一组对照实验固定图轴、证据位置与条件说明，以支持直接逐页比较。';
  assert.ok(!codes(project(slides)).includes('deck-layout-dominance'));
});

test('a generic short repetition slogan is not an inspectable justification', () => {
  const slides = ['s1', 's2', 's3'].map(id => slide(id));
  slides[2].visualPlan.repetitionReason = '保持统一';
  assert.ok(codes(project(slides)).includes('repetition-reason-thin'));
  assert.ok(codes(project(slides)).includes('layout-repetition'));
});

test('a compact report exposes unframed explanatory stacks without requiring every paragraph to be boxed', () => {
  const s = slide('s1');
  s.composition.rows[0].panels[1].cardIds = ['a', 'b'];
  s.composition.rows[0].panels[1].surface = 'plain';
  s.cards = [{ id: 'a', title: '观测', body: '表层含水量', style: 'compact' }, { id: 'b', title: '边界', body: '单站验证', style: 'compact' }];
  const p = project([s]); p.design.density = 'compact';
  assert.ok(codes(p).includes('unframed-card-stack'));
  p.design.cardDefaults = { surface: 'outline', accent: 'left' };
  assert.ok(!codes(p).includes('unframed-card-stack'), 'compact style inherits the same visible defaults as the renderer');
  delete p.design.cardDefaults;
  s.cards[0].appearance = { surface: 'outline', accent: 'left' };
  assert.ok(!codes(p).includes('unframed-card-stack'));
});
