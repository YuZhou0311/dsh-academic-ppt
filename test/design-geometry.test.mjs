import test from 'node:test';
import assert from 'node:assert/strict';
import { designGeometryReport } from '../src/design-quality.mjs';

const area = { x: 48, y: 132, w: 1184, h: 513 };
const text = (id, x, y, width, lines = ['研究说明'], extra = {}) => ({ id: `s/${id}`, kind: 'text', x, y, w: width, h: 500, fontSize: 24, lineHeight: 1.24, lines, estimatedLineWidths: lines.map(() => width), ...extra });
const scene = (nodes, layout = 'academic') => ({ pages: [{ id: 's', layout, width: 1280, height: 720, contentBox: area, nodes }] });
const project = (layout = 'academic', density = 'compact') => ({ design: density ? { density } : {}, slides: [{ id: 's', layout }], assets: [{ id: 'evidence', usage: 'figure' }, { id: 'decoration', usage: 'decorative' }] });
const diagnose = (nodes, layout = 'academic', density = 'compact') => designGeometryReport(project(layout, density), scene(nodes, layout));
const image = (id, box, extra = {}) => ({ id: `s/${id}`, kind: 'image', assetId: 'evidence', ...box, ...extra });

test('a large unused lower content region is located and blocks only an explicit compact policy', () => {
  const nodes = [{ id: 's/table', kind: 'table', x: 48, y: 132, w: 1184, h: 320 }];
  for (const density of ['balanced', null, 'compact']) {
    const result = diagnose(nodes, 'academic', density);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].severity, density === 'compact' ? 'error' : 'warning');
    assert.ok(result.slides[0].largestUnallocatedFraction > .30);
    assert.ok(result.issues[0].box.y > 450);
    assert.match(result.issues[0].message, /下部/);
    assert.match(result.issues[0].message, /不要缩字/);
    assert.equal(result.slides[0].basis, 'scene-geometry-estimate-not-aesthetic-score');
  }
});

test('the compact body gate is one continuous unused quarter, with a just-below control', () => {
  const resultFor = width => {
    const s = scene([{ id: 's/table', kind: 'table', x: 0, y: 0, w: width, h: 400 }]);
    s.pages[0].contentBox = { x: 0, y: 0, w: 800, h: 400 };
    return designGeometryReport(project(), s);
  };
  // Include the documented 4px optical halo: the left 600px are allocated.
  const quarter = resultFor(596), below = resultFor(604);
  assert.equal(quarter.slides[0].largestUnallocatedFraction, .25);
  assert.equal(quarter.slides[0].blockingThreshold, .25);
  assert.equal(quarter.issues[0].severity, 'error');
  assert.equal(below.slides[0].largestUnallocatedFraction, .24);
  assert.equal(below.issues[0].severity, 'warning');
});

test('a sparse compact cover receives a visual reminder without forcing an image', () => {
  const resultFor = width => diagnose([image('cover-visual', { x: 48, y: 48, w: width, h: 624 }, { role: 'context-visual', semantic: false })], 'cover');
  const half = resultFor(588), below = resultFor(596);
  assert.equal(half.slides[0].largestUnallocatedFraction, .5);
  assert.equal(half.slides[0].blockingThreshold, null);
  assert.equal(half.issues[0].severity, 'warning');
  assert.match(half.issues[0].message, /无需增加图片/);
  assert.ok(below.slides[0].largestUnallocatedFraction < .5);
  assert.equal(below.issues[0].severity, 'warning');
});

test('chapter and roadmap whitespace does not inherit the evidence-page density gate', () => {
  for (const layout of ['section', 'roadmap']) {
    const result = diagnose([text('title', 48, 160, 500, ['研究问题与验证路线'], { role: 'title' })], layout);
    assert.ok(result.slides[0].largestUnallocatedFraction > .6);
    assert.equal(result.slides[0].blockingThreshold, null);
    assert.equal(result.issues[0].severity, 'warning');
    assert.match(result.issues[0].message, /位置与问题/);
  }
});

test('a long diagonal relationship stroke does not fill its bounding rectangle', () => {
  const result = diagnose([{ id: 's/edge:0', kind: 'line', ...area, strokeWidth: 2 }]);
  assert.ok(result.slides[0].contentCoverage < .08);
  assert.ok(result.slides[0].largestUnallocatedFraction > .20);
  assert.ok(result.issues.length > 0);
});

test('header, footer, identity and decorative text never become body content', () => {
  const plain = diagnose([]);
  const result = diagnose([
    text('brand-label', 48, 132, 1184, ['页角品牌'], { role: 'identity' }),
    text('footer-label', 48, 250, 1184, ['页脚文字'], { role: 'footer' }),
    text('section-label', 48, 400, 1184, ['章节标记'], { role: 'section-label' }),
    text('icon', 48, 540, 1184, ['图标'], { role: 'icon', semantic: false }),
  ]);
  assert.equal(result.slides[0].contentCoverage, 0);
  assert.deepEqual(result.slides[0].largestUnallocatedBox, plain.slides[0].largestUnallocatedBox);
});

test('inflating textbox height and width does not manufacture content coverage', () => {
  const small = text('body', 48, 132, 220, ['一句说明'], { h: 30 });
  const large = { ...small, w: 1184, h: 513 };
  const a = diagnose([small]), b = diagnose([large]);
  assert.equal(a.slides[0].contentCoverage, b.slides[0].contentCoverage);
  assert.deepEqual(a.slides[0].largestUnallocatedBox, b.slides[0].largestUnallocatedBox);
});

test('full-page frames, colours and icon shapes cannot conceal an empty content region', () => {
  const content = [text('body', 48, 132, 220)];
  const furniture = [
    { id: 's/background', kind: 'rect', ...area, fill: '#183B66' },
    { id: 's/card/a/frame', kind: 'rect', ...area, role: 'card-surface' },
    { id: 's/icon', kind: 'rect', ...area, role: 'icon', semantic: false },
    image('ornament', area, { assetId: 'decoration' }),
  ];
  const plain = diagnose(content), framed = diagnose([...content, ...furniture]);
  assert.equal(plain.slides[0].contentCoverage, framed.slides[0].contentCoverage);
  assert.deepEqual(plain.slides[0].largestUnallocatedBox, framed.slides[0].largestUnallocatedBox);
  assert.equal(framed.issues[0].code, 'large-unused-region');
});

test('evidence-image internal whitespace remains part of the figure instead of triggering crop pressure', () => {
  const result = diagnose([image('figure', area)]);
  assert.equal(result.issues.length, 0);
  assert.equal(result.slides[0].contentCoverage, 1);
  assert.equal(result.slides[0].largestUnallocatedBox, null);
});

test('normal gutters between large evidence objects are not treated as content voids', () => {
  const result = diagnose([image('left', { ...area, w: 572 }), image('right', { ...area, x: 660, w: 572 })]);
  assert.equal(result.issues.length, 0);
  assert.ok(result.slides[0].contentCoverage > .95);
});

test('sparse marks inside a native scientific plot retain the complete plot coordinate space', () => {
  const result = diagnose([
    text('data-plot/reading-note', 48, 132, 1184),
    text('data-plot/unit', 48, 620, 1184),
    { id: 's/data-plot/point/0', kind: 'rect', x: 300, y: 350, w: 5, h: 5 },
  ]);
  assert.equal(result.issues.length, 0);
  assert.ok(result.slides[0].contentCoverage > .95);
});

test('closing pages do not receive a blanket whitespace exemption', () => {
  const result = diagnose([text('closing', 48, 132, 400, ['主要结论'])], 'closing');
  assert.equal(result.issues[0].severity, 'error');
  assert.equal(result.issues[0].code, 'large-unused-region');
});

test('reference pages keep bibliography text and receive a consolidation reminder, not a density error', () => {
  const result = diagnose([text('ref:one', 48, 132, 1184, ['完整书目信息'], { role: 'citation' })], 'references');
  assert.ok(result.slides[0].contentCoverage > 0);
  assert.equal(result.issues[0].severity, 'warning');
  assert.match(result.issues[0].message, /合并参考页/);
});

test('a cover context visual is measured separately without becoming scientific content', () => {
  const title = text('cover-title', 48, 80, 520, ['农业研究', '遥感与模型'], { fontSize: 64 });
  const visual = image('cover-visual', { x: 650, y: 48, w: 582, h: 624 }, { role: 'context-visual', semantic: false, assetId: 'decoration' });
  const baseline = diagnose([title], 'cover'), result = diagnose([title, visual], 'cover');
  assert.equal(result.slides[0].contentCoverage, baseline.slides[0].contentCoverage);
  assert.ok(result.slides[0].contextVisualCoverage > .40);
  assert.ok(result.slides[0].largestUnallocatedFraction < baseline.slides[0].largestUnallocatedFraction);
  assert.equal(baseline.issues[0].severity, 'warning');
  assert.equal(baseline.slides[0].blockingThreshold, null);
});

test('a body context illustration does not erase a missing explanation or evidence region', () => {
  const nodes = [text('body', 48, 132, 220), image('illustration', area, { role: 'context-visual', semantic: false, assetId: 'decoration' })];
  const result = diagnose(nodes);
  assert.equal(result.slides[0].contextVisualCoverage, 0);
  assert.equal(result.issues[0].severity, 'error');
});

test('a repeated-layout justification cannot waive the compact whitespace gate', () => {
  const p = project(); p.slides[0].visualPlan = { repetitionReason: '同一条件保留共同坐标以便直接比较，此理由不等于空洞已有用途。' };
  const result = designGeometryReport(p, scene([text('body', 48, 132, 220)]));
  assert.equal(result.issues[0].severity, 'error');
});

test('the declared current contentBox is used after header furniture is removed', () => {
  const s = scene([image('figure', { x: 48, y: 80, w: 1184, h: 580 })]);
  s.pages[0].contentBox = { x: 48, y: 80, w: 1184, h: 580 };
  const report = designGeometryReport(project(), s);
  assert.deepEqual(report.slides[0].contentBox, s.pages[0].contentBox);
  assert.equal(report.issues.length, 0);
});
