import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { buildScenes } from '../src/scene.mjs';
import { renderProject } from '../src/render.mjs';
import { assertProject } from '../src/schema.mjs';
import { DEFAULT_DESIGN } from '../src/core.mjs';
import { brief, paper, claim, asset } from './fixtures.mjs';

// Synthetic software fixtures. Native object checks are not visual approval.
const copy = value => structuredClone(value);
// These v0.6 geometry fixtures assert their authored font sizes; projection has dedicated tests.
const legacyDesign = () => { const design = copy(DEFAULT_DESIGN); delete design.projection; return design; };
const slide = changes => ({ id: 's', layout: 'cover', title: '机制与证据', paperIds: ['P1'], claimIds: ['C1'], notes: '合成软件回归。', seconds: 60, figureIds: [], cards: [], ...changes });
const project = (slides, changes = {}) => ({ schemaVersion: 1, id: 'chrome-fixture', revision: 0, title: '学术页面系统回归', brief: copy(brief), capabilities: { imageInput: 'unknown', source: 'synthetic fixture' }, design: legacyDesign(), papers: [copy(paper)], claims: [copy(claim)], assets: [], slides, ...changes });
const page = p => { assertProject(p); return buildScenes(p).pages[0]; };
const errors = value => value.issues.filter(issue => issue.severity === 'error');
const node = (p, suffix) => p.nodes.find(item => item.id === `${p.id}/${suffix}`);
const bottom = box => box.y + box.h;
const overlap = (a, z) => Math.min(a.x + a.w, z.x + z.w) - Math.max(a.x, z.x) > 2 && Math.min(bottom(a), bottom(z)) - Math.max(a.y, z.y) > 2;
const nativeShape = (xml, id) => (xml.match(/<p:sp>.*?<\/p:sp>/gs) || []).find(shape => shape.includes(`name="${id}"`));

test('all academic cover variants retain complete metadata, authored title breaks and native title sizes', async () => {
  const metadata = { presenter: '测试报告人', affiliation: '独立测试机构', occasion: '研究汇报', date: '2026年10月20日' };
  const slides = ['framed', 'project', 'minimal'].map(variant => slide({ id: variant, subtitle: '数据口径与适用范围', cover: { ...metadata, variant, titleLines: ['机制与', '证据'] } }));
  const p = project(slides); p.design.system.coverTitleSize = 80; p.design.palette.accent = '#663355';
  const before = copy(p); assertProject(p);
  const out = await renderProject(p), files = unzipSync(out.pptx);
  assert.deepEqual(p, before);
  assert.deepEqual(errors(out), []);
  for (const [index, rendered] of out.scenes.pages.entries()) {
    const title = node(rendered, 'title');
    assert.equal(title.text, '机制与\n证据');
    assert.equal(title.fontSize, 80);
    for (const value of Object.values(metadata)) assert.ok(rendered.nodes.some(item => item.text === value), `missing metadata: ${value}`);
    assert.ok(rendered.nodes.some(item => item.fill === '#663355' || item.stroke === '#663355'));
    const xml = strFromU8(files[`ppt/slides/slide${index + 1}.xml`]);
    assert.match(nativeShape(xml, `${rendered.id}/title`), /<a:rPr[^>]*sz="6000"/);
    assert.equal((xml.match(/<p:pic>/g) || []).length, 0, 'cover furniture and title remain editable objects');
  }
});

test('cover titleLines cannot substitute a shorter or different research title', () => {
  const p = project([slide({ cover: { titleLines: ['删掉的题目'] } })]);
  const rendered = page(p);
  assert.ok(rendered.issues.some(issue => issue.code === 'cover-title-mismatch'));
  assert.equal(node(rendered, 'title').text, p.slides[0].title);
  assert.ok(!rendered.nodes.some(item => item.text === '删掉的题目'));
});

test('project cover keeps the authorized logo separate from date and affiliation', () => {
  const logo = { ...copy(asset), id: 'logo', width: 1, height: 1, usage: 'decorative' };
  const p = project([slide({ cover: { variant: 'project', presenter: '报告人', affiliation: '研究机构与实验室', date: '2026年10月20日' } })], { assets: [logo] });
  p.design.branding = { logoAssetId: 'logo' };
  const rendered = page(p), picture = node(rendered, 'cover-logo');
  assert.deepEqual(errors(rendered), []);
  assert.equal(picture.assetId, 'logo');
  assert.equal(picture.data, logo.data);
  for (const suffix of ['cover-date', 'cover-affiliation', 'cover-presenter']) assert.equal(overlap(picture, node(rendered, suffix)), false, suffix);
});

test('academic branding rejects unregistered or evidence assets as logos', () => {
  for (const assets of [[], [{ ...copy(asset), id: 'logo', width: 1, height: 1 }]]) {
    const p = project([slide()], { assets }); p.design.branding = { logoAssetId: 'logo' };
    const rendered = page(p);
    assert.ok(rendered.issues.some(issue => issue.code === 'branding-logo-source'));
    assert.ok(!rendered.nodes.some(item => item.kind === 'image'));
  }
});

test('explicit band and rule headers apply title tokens and keep branding visible on existing layouts', () => {
  for (const header of ['band', 'rule']) {
    const p = project([slide({ layout: 'method', nodes: [{ id: 'a', label: '输入' }, { id: 'b', label: '核验' }], edges: [{ from: 'a', to: 'b' }] })]);
    p.design.system.header = header; p.design.system.titleSize = 44;
    p.design.branding = { label: '研究机构' };
    const rendered = page(p), title = node(rendered, 'title'), brand = node(rendered, 'brand-label');
    assert.deepEqual(errors(rendered), []);
    assert.equal(title.fontSize, 44); assert.equal(brand.text, '研究机构');
    assert.equal(overlap(title, brand), false);
    if (header === 'band') {
      const band = node(rendered, 'academic-header-band');
      assert.ok(title.y >= band.y && bottom(title) <= bottom(band));
      assert.equal(title.color, '#FFFFFF');
    } else assert.equal(node(rendered, 'academic-header-band'), undefined);
  }
});

test('section headers reserve actual wrapped title height before composition evidence', () => {
  const p = project([slide({ layout: 'academic', title: '比较机制、独立证据与适用边界之间的对应关系：保留完整实验条件和来源口径', section: { number: '02', title: '证据分析' }, kicker: '同一输入，独立检验', cards: [{ id: 'c', kind: 'method', title: '检验口径', body: '保留完整测试条件。', claimIds: ['C1'], style: 'compact' }], composition: { rows: [{ panels: [{ id: 'p', title: '证据与解释', cardIds: ['c'] }] }] } })]);
  p.design.system.titleSize = 44; p.design.system.sectionSize = 34;
  const rendered = page(p), title = node(rendered, 'title'), section = node(rendered, 'section-label'), kicker = node(rendered, 'kicker');
  assert.deepEqual(errors(rendered), []);
  assert.equal(title.fontSize, 44); assert.equal(section.fontSize, 34);
  assert.ok(title.lines.length > 1);
  assert.ok(kicker.y >= bottom(title));
  assert.ok(node(rendered, 'composition/panel/p/title').y > bottom(kicker));
});

test('chapter agenda preserves every item and applies explicit section, title and panel tokens', () => {
  const items = [{ title: '研究问题' }, { title: '实验设计' }, { title: '证据边界' }];
  const p = project([slide({ layout: 'section', title: '本章讨论顺序', section: { number: '03', title: '验证流程' }, agenda: { items, active: 2 } })]);
  Object.assign(p.design.system, { titleSize: 44, sectionSize: 34, panelTitleSize: 32 });
  const large = page(p), smallProject = copy(p);
  Object.assign(smallProject.design.system, { titleSize: 32, sectionSize: 24, panelTitleSize: 24 });
  const small = page(smallProject);
  assert.deepEqual(errors(large), []); assert.deepEqual(errors(small), []);
  assert.equal(node(large, 'title').fontSize, 44);
  assert.ok(node(large, 'section-name').fontSize > node(small, 'section-name').fontSize);
  items.forEach((item, index) => {
    assert.equal(node(large, `agenda:${index}:title`).text, item.title);
    assert.equal(node(large, `agenda:${index}:title`).fontSize, 32);
    assert.equal(node(large, `agenda:${index}:title`).bold, index === 1);
  });
  const invalid = copy(p); invalid.slides[0].agenda.active = 4;
  assert.ok(page(invalid).issues.some(issue => issue.code === 'agenda-active-out-of-range'));
});

test('missing system preserves the legacy header while explicit cover and body token ranges remain usable', () => {
  const legacy = project([slide({ layout: 'method', nodes: [{ id: 'a', label: '输入' }], edges: [] })]);
  delete legacy.design.system;
  const rendered = page(legacy);
  assert.deepEqual(errors(rendered), []);
  assert.equal(node(rendered, 'title').fontSize, 40);
  assert.equal(node(rendered, 'academic-header-band'), undefined);
  for (const coverTitleSize of [60, 100]) {
    const p = project([slide()]); p.design.system.coverTitleSize = coverTitleSize;
    const cover = page(p); assert.deepEqual(errors(cover), []);
    assert.equal(node(cover, 'title').fontSize, coverTitleSize);
  }
});
