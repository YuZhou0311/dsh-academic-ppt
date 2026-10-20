import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { inspectTemplate } from '../src/template.mjs';
import { normalizeTemplateProfiles } from '../src/template-profile.mjs';
import { renderProject } from '../src/render.mjs';

const emu = px => Math.round(px * 9525);
const shape = (id, { x = 0, y = 0, w = 300, h = 180, color = '315B70', text = '', type = 'rect' } = {}) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Source ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm><a:prstGeom prst="${type}"/><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="315B70"/></a:solidFill><a:prstDash val="dash"/></a:ln></p:spPr>${text ? `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr sz="1800"/><a:t>${text}</a:t></a:r></a:p></p:txBody>` : ''}</p:sp>`;
function fixture(slide) { return zipSync({ 'ppt/presentation.xml': strToU8('<p:presentation xmlns:p="p"><p:sldSz cx="12192000" cy="6858000"/></p:presentation>'), 'ppt/theme/theme1.xml': strToU8('<a:theme xmlns:a="a"><a:themeElements><a:clrScheme><a:accent1><a:srgbClr val="315B70"/></a:accent1></a:clrScheme><a:fontScheme><a:majorFont><a:latin typeface="Noto Sans CJK SC"/></a:majorFont></a:fontScheme></a:themeElements></a:theme>'), 'ppt/slides/slide1.xml': strToU8(`<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree>${slide}</p:spTree></p:cSld></p:sld>`) }); }

test('template native group transforms are flattened and selected backgrounds reach native PPTX', async () => {
  const directory = await mkdtemp(join(process.cwd(), 'test-template-'));
  try {
    const group = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="2" name="Original card"/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="${emu(80)}" y="${emu(90)}"/><a:ext cx="${emu(600)}" cy="${emu(360)}"/><a:chOff x="0" y="0"/><a:chExt cx="${emu(300)}" cy="${emu(180)}"/></a:xfrm></p:grpSpPr>${shape(3)}${shape(4, { x: 20, y: 20, w: 100, h: 30, color: 'B38D56' })}${shape(5, { x: 22, y: 24, w: 180, h: 30, text: 'OLD TEMPLATE WORDS' })}</p:grpSp>`;
    const path = join(directory, 'template.pptx'); await writeFile(path, fixture(group));
    const profile = await inspectTemplate(path);
    assert.equal(profile.width, 1280); assert.equal(profile.height, 720);
    assert.equal(profile.shapes.find(s => s.sourceShapeId === '3').x, 80);
    assert.equal(profile.shapes.find(s => s.sourceShapeId === '3').w, 600);
    const component = profile.components.find(c => c.id.endsWith('-s1-group-2'));
    assert.ok(component); assert.equal(component.nodes.length, 2);
    assert.equal(component.sourcePart, 'ppt/slides/slide1.xml');
    assert.ok(component.nodes.every(n => !n.text));
    assert.match(profile.sha256, /^[a-f\d]{64}$/);
    const project = { title: '模板子集测试', design: { templateProfile: profile }, papers: [], assets: [], claims: [], slides: [{ id: 's', layout: 'synthesis', title: '复用源模板卡片', cards: [{ id: 'c', title: '新标题', body: '新正文', kind: 'method', templateComponentId: component.id }], notes: '' }] };
    const result = await renderProject(project), zip = unzipSync(result.pptx), xml = strFromU8(zip['ppt/slides/slide1.xml']);
    assert.match(xml, /s\/card\/c\/template\/0/);
    assert.match(xml, /B38D56/);
    assert.doesNotMatch(xml, /OLD TEMPLATE WORDS/);
    assert.match(xml, /新标题/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('component provenance uses presentation page order while retaining nonsequential XML part names', async () => {
  const directory = await mkdtemp(join(process.cwd(), 'test-template-'));
  try {
    const ns = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const slide = body => `<p:sld ${ns}><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`;
    const title = shape(2, { x: 80, y: 30, w: 1000, h: 70, text: 'First presentation page' }).replace('sz="1800"', 'sz="4400"');
    const parts = {
      'ppt/presentation.xml': `<p:presentation ${ns}><p:sldIdLst><p:sldId id="256" r:id="r2"/><p:sldId id="257" r:id="r1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`,
      'ppt/_rels/presentation.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide7.xml"/><Relationship Id="r2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide205.xml"/></Relationships>',
      'ppt/slides/slide7.xml': slide(shape(1, { x: 80, y: 200, w: 400, h: 100, color: '003399' }) + shape(3, { type: 'star5' })),
      'ppt/slides/slide205.xml': slide(shape(1, { x: 80, y: 200, w: 600, h: 100, color: '990000' }) + title),
    };
    const file = join(directory, 'reordered.pptx');
    await writeFile(file, zipSync(Object.fromEntries(Object.entries(parts).map(([name, xml]) => [name, strToU8(xml)]))));
    const profile = await inspectTemplate(file), normalized = normalizeTemplateProfiles([profile]);
    assert.equal(profile.study.slides.order, 'presentation-relationships');
    assert.deepEqual(profile.study.pageRoleCandidates.cover, [1]);
    assert.deepEqual(normalized.components.map(c => ({ page: c.sourceSlide, part: c.sourcePart, width: c.width })), [
      { page: 1, part: 'ppt/slides/slide205.xml', width: 600 },
      { page: 2, part: 'ppt/slides/slide7.xml', width: 400 },
    ]);
    for (const component of normalized.components) {
      assert.ok(component.nodes.every(n => n.sourceSlide === component.sourceSlide && n.sourcePart === component.sourcePart));
      assert.ok(component.id.includes(`-s${component.sourceSlide}-`));
    }
    assert.ok(profile.shapes.some(s => s.sourceSlide === 1 && s.sourcePart === 'ppt/slides/slide205.xml' && s.text === 'First presentation page'));
    assert.ok(normalized.unsupported.some(s => s.sourceShapeId === '3' && s.sourceSlide === 2 && s.sourcePart === 'ppt/slides/slide7.xml'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('unsupported custom shapes are reported and DTD input is rejected', async () => {
  const directory = await mkdtemp(join(process.cwd(), 'test-template-'));
  try {
    const path = join(directory, 'template.pptx');
    await writeFile(path, fixture(shape(3, { type: 'star5' }) + shape(4)));
    const profile = await inspectTemplate(path);
    assert.ok(profile.unsupported.some(n => n.sourceShapeId === '3'));
    assert.ok(!profile.shapes.some(n => n.sourceShapeId === '3'));
    assert.equal(profile.visualReview, 'not-performed');
    const malicious = fixture('<!DOCTYPE p:sp [<!ENTITY x SYSTEM "file:///not-allowed">]><p:sp/>');
    await writeFile(path, malicious);
    await assert.rejects(inspectTemplate(path), /DTD|XML/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('two templates have disjoint component IDs and unsupported inherited or transformed colors are explicit', async () => {
  const directory = await mkdtemp(join(process.cwd(), 'test-template-'));
  try {
    const a = join(directory, 'a.pptx'), b = join(directory, 'b.pptx');
    const alpha = shape(2).replace('<a:srgbClr val="315B70"/>', '<a:srgbClr val="315B70"><a:alpha val="50000"/></a:srgbClr>');
    const transformed = shape(3).replace('<a:srgbClr val="315B70"/>', '<a:srgbClr val="315B70"><a:lumMod val="50000"/></a:srgbClr>');
    const inherited = shape(4).replace('<a:solidFill><a:srgbClr val="315B70"/></a:solidFill>', '').replace('</p:sp>', '<p:style><a:fillRef idx="1"/></p:style></p:sp>');
    await writeFile(a, fixture(alpha + transformed + inherited));
    await writeFile(b, fixture(shape(2, { color: 'B38D56' })));
    const [pa, pb] = await Promise.all([inspectTemplate(a), inspectTemplate(b)]);
    assert.deepEqual(pa.source, { path: a, sha256: pa.sha256, width: 1280, height: 720 });
    assert.equal(pa.shapes.find(s => s.sourceShapeId === '2').fillOpacity, .5);
    assert.ok(pa.unsupported.some(s => s.sourceShapeId === '3' && /颜色变换/.test(s.reason)));
    assert.ok(pa.unsupported.some(s => s.sourceShapeId === '4' && /继承/.test(s.reason)));
    const ids = [...pa.components, ...pb.components].map(c => c.id);
    assert.equal(new Set(ids).size, ids.length);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
