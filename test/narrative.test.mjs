import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { resolveNarrativeSlide, narrativeIssues } from '../src/narrative.mjs';
import { buildScenes } from '../src/scene.mjs';
import { renderProject } from '../src/render.mjs';
import { assertProject } from '../src/schema.mjs';

// Synthetic navigation fixtures. They do not assert real research findings.
const copy = value => structuredClone(value);
const narrative = {
  throughline: '先对齐比较条件，再核对证据与推论的边界。',
  sections: [
    { id: 'question', title: '研究问题', question: '现有材料能回答什么？' },
    { id: 'methods', title: '比较条件', question: '哪些条件必须保持一致？' },
    { id: 'evidence', title: '证据与边界', question: '观察支持到什么范围？' },
  ],
};
const slide = changes => ({ id: 's', layout: 'roadmap', title: '汇报路线', paperIds: [], claimIds: [], figureIds: [], cards: [], notes: '软件导航测试。', seconds: 20, ...changes });
const project = (slides, outline = narrative) => ({
  schemaVersion: 1, id: 'narrative-fixture', revision: 0, title: '导航软件测试',
  brief: { centralQuestion: '路线与证据能否一一对应？', audience: '软件测试', talkMinutes: 10, targetPaperCount: 0, requireFullText: false, qualityProfile: 'academic', ...(outline ? { narrative: copy(outline) } : {}) },
  design: {
    fontFamily: 'Noto Sans CJK SC', mode: 'content-led', density: 'balanced',
    chrome: { showTopRule: false }, projection: { bodyMin: 28, labelMin: 24, noteMin: 18 },
    palette: { ink: '#202A35', paper: '#FFFFFF', background: '#FFFFFF', accent: '#24486B', secondary: '#5E6570', muted: '#536070', line: '#CCD5DE', soft: '#F2F5F7', tint: '#F2F5F7' },
    system: { preset: 'academic-report', header: 'rule', cover: 'minimal', panel: 'line', titleSize: 44, coverTitleSize: 72, bodySize: 28, panelTitleSize: 30, captionSize: 18, sectionSize: 30 },
  },
  capabilities: { imageInput: 'unknown', source: 'deterministic navigation fixture' },
  papers: [], claims: [], assets: [], slides,
});
const errorCodes = value => value.issues.filter(item => item.severity === 'error').map(item => item.code);

test('declared outline supplies chapter labels and agendas without changing authored content or input', () => {
  const p = project([]), s = slide({ layout: 'section', sectionId: 'methods', title: '先对齐条件才能比较证据' });
  const before = copy({ p, s }), resolved = resolveNarrativeSlide(p, s);
  assert.deepEqual({ p, s }, before);
  assert.deepEqual(resolved.section, { number: '02', title: '比较条件' });
  assert.equal(resolved.title, s.title);
  assert.deepEqual(resolved.agenda, { active: 2, items: narrative.sections.map(item => ({ sectionId: item.id, title: item.title, question: item.question })) });
  assert.equal(resolveNarrativeSlide(p, slide({ layout: 'cover', sectionId: 'methods' })).section, undefined);
  assert.equal(resolveNarrativeSlide(p, slide({ layout: 'references', sectionId: 'methods' })).section, undefined);
  assert.equal(resolveNarrativeSlide(p, slide({ layout: 'roadmap' })).agenda.active, undefined);
});

test('an explicit local agenda is preserved and its active item uses local rather than global order', () => {
  const p = project([]), s = slide({ layout: 'section', sectionId: 'methods', section: { number: 'II', title: '比较条件' }, agenda: { items: [{ title: '比较条件', sectionId: 'methods' }, { title: '核对来源' }] } });
  const resolved = resolveNarrativeSlide(p, s);
  assert.deepEqual(resolved.section, s.section);
  assert.deepEqual(resolved.agenda.items, s.agenda.items);
  assert.equal(resolved.agenda.active, 1);
  assert.equal(s.agenda.active, undefined);
  const explicit = { ...s, agenda: { ...s.agenda, active: 2 } };
  assert.equal(resolveNarrativeSlide(p, explicit).agenda.active, 2);
});

test('a new narrative plan cannot replace authored roadmap content with an automatic agenda', () => {
  const p = project([]), card = { id: 'c', kind: 'question', title: '已写好的路线内容', body: '保留由作者组织的研究问题与阅读顺序。', claimIds: [] };
  const authored = {
    composition: { rows: [{ panels: [{ id: 'p', title: '自主目录', cardIds: ['c'] }] }] },
    cards: [card], drawings: [{ id: 'drawing' }], nodes: [{ id: 'node', label: '问题' }], figureIds: ['figure'],
    chart: { kind: 'bar' }, plot: { kind: 'interval' }, plots: [{ id: 'plot', kind: 'interval' }], table: { columns: ['主题'], rows: [] },
    referenceTemplateId: 'T01', referenceIds: ['P1'],
  };
  for (const [key, value] of Object.entries(authored)) {
    const s = slide({ sectionId: 'methods', [key]: value }), before = copy(s);
    assert.equal(resolveNarrativeSlide(p, s).agenda, undefined, `${key} must retain its authored route`);
    assert.deepEqual(s, before);
  }
  for (const extra of [{}, { composition: authored.composition }]) {
    const s = slide({ cards: [card], ...extra }), scenes = buildScenes(project([s]));
    assert.deepEqual(errorCodes(scenes), []);
    assert.ok(scenes.pages[0].nodes.some(node => node.text === card.body));
    assert.ok(!scenes.pages[0].nodes.some(node => node.id.includes('/agenda:')));
  }
});

test('linked local agenda labels keep deck section numbers while highlighting by local position', () => {
  const s = slide({ layout: 'section', sectionId: 'methods', title: '比较前先统一口径', agenda: { items: [{ sectionId: 'methods', title: '比较条件' }, { sectionId: 'evidence', title: '证据与边界' }] } });
  const p = project([s]), scenes = buildScenes(p), page = scenes.pages[0];
  assert.deepEqual(errorCodes(scenes), []);
  assert.equal(page.nodes.find(node => node.id === 's/section-number').text, '02');
  assert.equal(page.nodes.find(node => node.id === 's/agenda:0:number').text, '02');
  assert.equal(page.nodes.find(node => node.id === 's/agenda:1:number').text, '03');
  assert.equal(page.nodes.find(node => node.id === 's/agenda:0:title').bold, true);
  assert.equal(page.nodes.find(node => node.id === 's/agenda:1:title').bold, false);
  const local = project([slide({ agenda: { active: 2, items: [{ title: '核对输入' }, { title: '核对输出' }] } })], null);
  const localPage = buildScenes(local).pages[0];
  assert.equal(localPage.nodes.find(node => node.id === 's/agenda:0:number').text, '01');
  assert.equal(localPage.nodes.find(node => node.id === 's/agenda:1:number').text, '02');
  assert.equal(localPage.nodes.find(node => node.id === 's/agenda:1:title').bold, true);
});

test('navigation numbers follow label policy when body text has a larger reading minimum', () => {
  const p = project([slide()]); p.design.projection.bodyMin = 32;
  const scenes = buildScenes(p), page = scenes.pages[0];
  assert.deepEqual(errorCodes(scenes), []);
  assert.ok(page.nodes.filter(node => node.id.endsWith(':question')).every(node => node.fontSize === 32));
  assert.ok(page.nodes.filter(node => node.id.endsWith(':number')).every(node => node.fontSize === 28));
});

test('old projects get at most a long-talk advisory and no new narrative hard block', () => {
  const p = project(Array.from({ length: 8 }, (_, i) => slide({ id: `s${i}`, layout: 'results' })), null);
  assert.deepEqual(narrativeIssues(p).map(item => [item.severity, item.code]), [['warning', 'narrative-plan-missing']]);
  p.slides = [slide({ layout: 'results' })];
  assert.deepEqual(narrativeIssues(p), []);
});

test('structural contradictions in an explicit outline are actionable errors', () => {
  const p = project([
    slide({ id: 'unknown', layout: 'results', sectionId: 'absent' }),
    slide({ id: 'conflict', layout: 'results', sectionId: 'methods', section: { title: '另一个章节' } }),
    slide({ id: 'backwards', layout: 'results', sectionId: 'question' }),
    slide({ id: 'agenda', agenda: { items: [{ sectionId: 'evidence', title: '改名条目' }, { sectionId: 'evidence', title: '证据与边界' }, { sectionId: 'absent', title: '未声明' }] } }),
  ]);
  p.brief.narrative.sections.push(copy(narrative.sections[0]));
  const codes = narrativeIssues(p).filter(item => item.severity === 'error').map(item => item.code);
  for (const code of ['narrative-section-unknown', 'narrative-section-title-conflict', 'narrative-section-duplicate', 'narrative-agenda-title-conflict', 'narrative-agenda-duplicate', 'narrative-agenda-unknown']) assert.ok(codes.includes(code), code);
  // Check ordering independently from the deliberately invalid duplicate-ID outline.
  p.brief.narrative.sections.pop();
  assert.ok(narrativeIssues(p).some(item => item.code === 'narrative-section-order' && item.severity === 'warning'));
});

test('new chapter references require a declared plan but legacy section labels stay compatible', () => {
  const p = project([
    slide({ id: 'body', layout: 'results', sectionId: 'methods' }),
    slide({ id: 'map', agenda: { items: [{ sectionId: 'methods', title: '比较条件' }] } }),
  ], null);
  assert.equal(narrativeIssues(p).filter(item => item.code === 'narrative-reference-without-plan' && item.severity === 'error').length, 2);
  p.slides = [slide({ layout: 'results', section: { title: '比较条件', number: '02' } })];
  assert.ok(!narrativeIssues(p).some(item => item.severity === 'error'));
});

test('active chapter and numbering cannot contradict the declared section while local agendas remain valid', () => {
  const p = project([
    slide({ id: 'chapter', layout: 'section', sectionId: 'methods', section: { title: '比较条件', number: '03' }, agenda: { active: 2, items: [{ sectionId: 'methods', title: '比较条件' }, { sectionId: 'evidence', title: '证据与边界' }] } }),
    slide({ id: 'map', agenda: { items: [{ sectionId: 'question', title: '研究问题' }] } }),
  ]);
  const issues = narrativeIssues(p);
  for (const code of ['narrative-section-number-conflict', 'narrative-agenda-active-conflict']) assert.ok(issues.some(item => item.code === code && item.severity === 'error'));
  assert.ok(issues.some(item => item.code === 'narrative-agenda-coverage' && item.severity === 'warning'));
  p.slides[0].section.number = 'II'; p.slides[0].agenda.active = 1;
  assert.ok(!narrativeIssues(p).some(item => item.severity === 'error'));
});

test('a complete outline does not require filler section pages or fixed scientific claim order', () => {
  const p = project([
    slide({ id: 'cover', layout: 'cover', title: '测试研究题名' }),
    slide({ id: 'map' }),
    ...narrative.sections.map((section, index) => slide({ id: `body${index}`, layout: 'results', sectionId: section.id, transition: index < 2 ? '已有观察仍受条件限制，下一节核对比较口径。' : undefined })),
    slide({ id: 'closing', layout: 'closing', closing: { variant: 'statement', statement: '研究解释须与比较条件和证据边界对应。' } }),
  ]);
  assert.deepEqual(narrativeIssues(p), []);
  delete p.slides[2].transition;
  const transition = narrativeIssues(p).find(item => item.code === 'narrative-transition-missing');
  assert.equal(transition.severity, 'warning');
  assert.deepEqual(transition.relatedSlideIds, ['body0', 'body1']);
});

test('missing content assignment and conclusion response are advisories without semantic overclaim', () => {
  const p = project([slide({ id: 'body', layout: 'results' }), slide({ id: 'end', layout: 'closing', title: '谢谢' })]);
  const issues = narrativeIssues(p);
  for (const code of ['narrative-section-missing', 'narrative-roadmap-missing', 'narrative-section-without-content', 'narrative-closing-response-missing']) assert.ok(issues.some(item => item.code === code && item.severity === 'warning'));
  assert.ok(!issues.some(item => item.severity === 'error'));
});

test('roadmap, active chapter and body breadcrumb are exported as editable text with all questions retained', async () => {
  const p = project([
    slide({ id: 'route' }),
    slide({ id: 'chapter', layout: 'section', sectionId: 'methods', title: '先对齐条件才能比较' }),
    slide({ id: 'body', layout: 'method', sectionId: 'methods', title: '核对共同输入', nodes: [{ id: 'input', label: '同一输入' }], edges: [] }),
  ]);
  assertProject(p);
  const before = copy(p), rendered = await renderProject(p), files = unzipSync(rendered.pptx);
  assert.deepEqual(p, before);
  assert.deepEqual(errorCodes(rendered), []);
  for (const [index, page] of rendered.scenes.pages.slice(0, 2).entries()) {
    const xml = strFromU8(files[`ppt/slides/slide${index + 1}.xml`]);
    for (const section of narrative.sections) {
      assert.ok(page.nodes.some(node => node.text === section.title));
      assert.ok(page.nodes.some(node => node.text === section.question));
      assert.ok(xml.includes(section.title));
      assert.ok(xml.includes(section.question));
    }
    assert.equal((xml.match(/<p:pic>/g) || []).length, 0);
    assert.ok(!page.nodes.some(node => node.kind === 'rect' && node.w * node.h > 1280 * 720 * .15), 'navigation does not need large color slabs');
  }
  const chapter = rendered.scenes.pages[1];
  assert.equal(chapter.nodes.find(node => node.id === 'chapter/agenda:1:title').bold, true);
  assert.equal(chapter.nodes.find(node => node.id === 'chapter/agenda:0:title').bold, false);
  assert.ok(rendered.scenes.pages[2].nodes.some(node => node.role === 'section-label' && node.text.includes('02') && node.text.includes('比较条件')));
});

test('eight concise chapter questions use two readable columns rather than shrinking text', () => {
  const outline = { throughline: '逐项核对问题与证据。', sections: Array.from({ length: 8 }, (_, i) => ({ id: `part${i}`, title: `问题 ${i + 1}`, question: '哪些证据？' })) };
  const p = project([slide()], outline), scenes = buildScenes(p), page = scenes.pages[0];
  assert.deepEqual(errorCodes(scenes), []);
  const questions = page.nodes.filter(node => node.id.endsWith(':question'));
  assert.equal(questions.length, 8);
  assert.ok(questions.every(node => node.fontSize === 28));
  assert.equal(new Set(questions.map(node => node.x)).size, 2);
  assert.ok(page.nodes.find(node => node.id === 's/agenda:0:title').x < page.nodes.find(node => node.id === 's/agenda:4:title').x);
});

test('overlong navigation reports capacity failure while preserving every question and font size', () => {
  const question = '需要核对全部比较条件、来源口径和尚未排除的解释。'.repeat(9);
  const outline = { throughline: '保留全部问题。', sections: Array.from({ length: 8 }, (_, i) => ({ id: `part${i}`, title: `章节 ${i + 1}`, question })) };
  const p = project([slide()], outline), scenes = buildScenes(p), page = scenes.pages[0];
  assertProject(p);
  assert.ok(errorCodes(scenes).includes('narrative-agenda-overflow'));
  const questions = page.nodes.filter(node => node.id.endsWith(':question'));
  assert.equal(questions.length, 8);
  assert.ok(questions.every(node => node.text === question && node.fontSize === 28));
});

test('authored question agendas work without a new narrative plan and reject a missing active item', () => {
  const p = project([slide({ agenda: { active: 3, items: [{ title: '先核对条件', question: '条件一致吗？' }, { title: '再核对证据', question: '原图支持吗？' }] } })], null);
  const scenes = buildScenes(p);
  assert.ok(errorCodes(scenes).includes('agenda-active-out-of-range'));
  assert.equal(scenes.pages[0].nodes.filter(node => node.id.endsWith(':question')).length, 2);
});
