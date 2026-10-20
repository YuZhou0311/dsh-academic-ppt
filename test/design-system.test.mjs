import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { inspectTemplate } from '../src/template.mjs';
import { DEFAULT_ACADEMIC_SYSTEM, LEGACY_ACADEMIC_SYSTEM, ACADEMIC_SYSTEM_RANGES, resolveAcademicSystem, inferTemplateDesign } from '../src/design-system.mjs';

test('missing system keeps the legacy tokens while explicit presets are complete and isolated', () => {
  assert.deepEqual(resolveAcademicSystem(), LEGACY_ACADEMIC_SYSTEM);
  assert.deepEqual(resolveAcademicSystem(null), LEGACY_ACADEMIC_SYSTEM);
  assert.deepEqual(resolveAcademicSystem({ preset: 'academic-defense' }), DEFAULT_ACADEMIC_SYSTEM);
  const report = resolveAcademicSystem({ preset: 'academic-report' });
  assert.equal(report.header, 'rule'); assert.equal(report.cover, 'project'); assert.equal(report.panel, 'tint');
  const input = { preset: 'plain', bodySize: 27, panel: 'band' }, before = structuredClone(input);
  const result = resolveAcademicSystem(input); result.bodySize = 1;
  assert.deepEqual(input, before); assert.equal(LEGACY_ACADEMIC_SYSTEM.bodySize, 24);
  assert.ok(Object.isFrozen(DEFAULT_ACADEMIC_SYSTEM));
});

test('render-time token resolution remains finite and bounded without coercing malformed values', () => {
  const input = { preset: 'academic-report', titleSize: 1000, coverTitleSize: -1, bodySize: '26', panelTitleSize: Infinity, captionSize: NaN, sectionSize: 28.126, header: 'unknown', unexpected: 'not copied' };
  const result = resolveAcademicSystem(input);
  assert.equal(result.titleSize, 44); assert.equal(result.coverTitleSize, 60);
  assert.equal(result.bodySize, 24); assert.equal(result.panelTitleSize, 28);
  assert.equal(result.captionSize, 18); assert.equal(result.sectionSize, 28.13);
  assert.equal(result.header, 'rule'); assert.equal(result.unexpected, undefined);
  for (const [key, [low, high]] of Object.entries(ACADEMIC_SYSTEM_RANGES)) assert.ok(result[key] >= low && result[key] <= high);
});

const ns = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const emu = n => Math.round(n * 9525);
const color = value => `<a:solidFill><a:srgbClr val="${value}"/></a:solidFill>`;
const geometry = ({ x, y, w, h }) => `<a:xfrm><a:off x="${emu(x)}" y="${emu(y)}"/><a:ext cx="${emu(w)}" cy="${emu(h)}"/></a:xfrm>`;
const rect = (id, box, { fill, stroke } = {}) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="PRIVATE_SHAPE_NAME"/><p:nvPr/></p:nvSpPr><p:spPr>${geometry(box)}<a:prstGeom prst="rect"/>${fill ? color(fill) : '<a:noFill/>'}<a:ln w="19050">${stroke ? color(stroke) : '<a:noFill/>'}</a:ln></p:spPr></p:sp>`;
const text = (id, value, box, { size = 1900, fill = '222222', font = 'Reference Research Sans', bold = false, align = 'l' } = {}) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="PRIVATE_TEXT_NAME"/><p:nvPr/></p:nvSpPr><p:spPr>${geometry(box)}<a:prstGeom prst="rect"/><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="${align}"/><a:r><a:rPr sz="${size}" b="${bold ? 1 : 0}">${color(fill)}<a:latin typeface="${font}"/></a:rPr><a:t>${value}</a:t></a:r></a:p></p:txBody></p:sp>`;
const slide = body => `<p:sld ${ns}><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`;
const relationships = values => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${values.map(([id, type, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"/>`).join('')}</Relationships>`;

function template({ masterHeader = false, bandY = 0, centered = false, frame = true, coverSize = 5600, bodySize = 1900, paperWidth = 1280, paperHeight = 720, themeBand = false } = {}) {
  const band = rect('10', { x: 0, y: bandY, w: paperWidth, h: bandY ? 45 : 92 }, { fill: '5B2244' });
  const actualBand = themeBand ? band.replace('<a:srgbClr val="5B2244"/>', '<a:schemeClr val="accent1"/>') : band;
  const body = page => `${masterHeader ? '' : actualBand}${text('20', 'PRIVATE_PAGE_TITLE_' + page, { x: 55, y: 22, w: 1120, h: 58 }, { size: 2800, fill: 'FFFFFF', bold: true })}${text('21', 'PRIVATE_PANEL_LABEL', { x: 65, y: 158, w: 650, h: 50 }, { size: 2200, fill: '5B2244', bold: true })}${text('22', 'PRIVATE_BODY_CONTENT_DO_NOT_COPY_938472: variables, observations, comparators and qualifications belong to the source.', { x: 65, y: 226, w: 1080, h: 220 }, { size: bodySize })}${text('23', 'PRIVATE_CAPTION_DO_NOT_COPY_672845', { x: 65, y: 542, w: 1050, h: 38 }, { size: 1300 })}`;
  const parts = {
    'ppt/presentation.xml': `<p:presentation ${ns}><p:sldIdLst><p:sldId id="256" r:id="r1"/><p:sldId id="257" r:id="r2"/><p:sldId id="258" r:id="r3"/></p:sldIdLst><p:sldSz cx="${emu(paperWidth)}" cy="${emu(paperHeight)}"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': relationships([['r1', 'slide', 'slides/slide5.xml'], ['r2', 'slide', 'slides/slide2.xml'], ['r3', 'slide', 'slides/slide9.xml']]),
    'ppt/theme/theme1.xml': `<a:theme ${ns}><a:themeElements><a:clrScheme><a:accent1><a:srgbClr val="5B2244"/></a:accent1><a:dk1><a:srgbClr val="222222"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1></a:clrScheme></a:themeElements></a:theme>`,
    'ppt/slides/slide5.xml': slide(`${frame ? rect('1', { x: 92, y: 162, w: 1096, h: 340 }, { stroke: '5B2244' }) : ''}${text('2', 'PRIVATE_COVER_TITLE_742168', { x: 140, y: 220, w: 1000, h: 140 }, { size: coverSize, fill: '5B2244', bold: true, align: centered ? 'ctr' : 'l' })}`),
    'ppt/slides/slide2.xml': slide(body(2)),
    'ppt/slides/slide9.xml': slide(body(3)),
  };
  if (masterHeader || themeBand) {
    for (const part of ['slide2', 'slide9']) parts[`ppt/slides/_rels/${part}.xml.rels`] = relationships([['l', 'slideLayout', '../slideLayouts/slideLayout1.xml']]);
    parts['ppt/slideLayouts/slideLayout1.xml'] = `<p:sldLayout ${ns}><p:cSld><p:spTree/></p:cSld></p:sldLayout>`;
    parts['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = relationships([['m', 'slideMaster', '../slideMasters/slideMaster1.xml']]);
    parts['ppt/slideMasters/slideMaster1.xml'] = `<p:sldMaster ${ns}><p:cSld><p:spTree>${masterHeader ? actualBand : ''}</p:spTree></p:cSld></p:sldMaster>`;
    parts['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = relationships([['t', 'theme', '../theme/theme1.xml']]);
  }
  return zipSync(Object.fromEntries(Object.entries(parts).map(([name, xml]) => [name, strToU8(xml)])));
}

async function withTemplate(bytes, use) {
  const directory = await mkdtemp(join(process.cwd(), 'test-design-system-'));
  try { const file = join(directory, 'unrelated-template-name.pptx'); await writeFile(file, bytes); return await use(file, directory); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('PPTX structure produces directly usable palette and role sizes without source prose', async () => {
  await withTemplate(template(), async file => {
    const profile = await inspectTemplate(file), { suggestedDesign: design, designInference: inference } = profile;
    assert.equal(design.fontFamily, 'Reference Research Sans');
    assert.equal(design.system.header, 'band'); assert.equal(design.system.cover, 'framed');
    assert.equal(design.system.preset, 'academic-defense');
    assert.equal(design.palette.accent, '#5B2244');
    assert.equal(design.system.titleSize, 37.33); assert.equal(design.system.coverTitleSize, 74.67);
    assert.equal(design.system.bodySize, 25.33); assert.equal(design.system.panelTitleSize, 29.33);
    assert.equal(design.system.captionSize, 17.33);
    for (const name of ['ink', 'paper', 'background', 'accent', 'secondary', 'muted', 'line', 'soft', 'gold', 'tint']) assert.match(design.palette[name], /^#[0-9A-F]{6}$/);
    assert.equal(inference.visualReview, 'not-performed'); assert.equal(inference.sourceSha256, profile.sha256);
    assert.ok(inference.decisions.find(d => d.target === 'system.header').sources.some(s => s.slide === 2 && s.part === 'ppt/slides/slide2.xml'));
    assert.ok(profile.study.designEvidence.coverTitle.sources.some(s => s.slide === 1 && s.part === 'ppt/slides/slide5.xml'));
    assert.doesNotMatch(JSON.stringify({ design, inference, study: profile.study }), /PRIVATE_|938472|672845|742168|unrelated-template-name/);
    assert.ok(Buffer.byteLength(JSON.stringify(profile.study)) < 10000);
  });
});

test('supported linked master bands are counted on displayed pages and their theme paint is resolved', async () => {
  await withTemplate(template({ masterHeader: true, themeBand: true }), async file => {
    const profile = await inspectTemplate(file);
    assert.ok(!profile.shapes.some(s => s.sourceShapeId === '10'), 'legacy component extraction still does not claim master import');
    assert.equal(profile.suggestedDesign.system.header, 'band');
    assert.equal(profile.suggestedDesign.palette.accent, '#5B2244');
    const decision = profile.designInference.decisions.find(d => d.target === 'system.header');
    assert.equal(decision.confidence, 'repeated-structure');
    assert.ok(decision.sources.some(s => s.part === 'ppt/slideMasters/slideMaster1.xml'));
    assert.equal(profile.study.designEvidence.headerBand.repeatedOnSlides, 2);
  });
});

test('footer strips do not become header bands and centered covers use the observed geometry', async () => {
  await withTemplate(template({ bandY: 670, centered: true, frame: false }), async file => {
    const { suggestedDesign } = await inspectTemplate(file);
    assert.equal(suggestedDesign.system.header, 'rule');
    assert.equal(suggestedDesign.system.cover, 'minimal');
    assert.equal(suggestedDesign.system.preset, 'academic-report');
  });
});

test('a cover identity band survives design inference even when the main title is centered', async () => {
  const parts = unzipSync(template({ centered: true, frame: false }));
  const name = 'ppt/slides/slide5.xml';
  parts[name] = strToU8(strFromU8(parts[name]).replace('<p:spTree>', '<p:spTree>' + rect('48', { x: 0, y: 0, w: 1280, h: 112 }, { fill: '5B2244' })));
  await withTemplate(zipSync(parts), async file => {
    const profile = await inspectTemplate(file);
    assert.equal(profile.suggestedDesign.system.cover, 'framed');
    assert.equal(profile.study.designEvidence.coverBand.color, '#5B2244');
    assert.ok(profile.designInference.decisions.find(d => d.target === 'system.cover').sources.some(s => s.slide === 1 && s.shapeId === '48'));
  });
  const pale = inferTemplateDesign({ width: 1280, height: 720, slideCount: 3, study: { designEvidence: { coverTitle: { align: 'center', sources: [{ box: { x: .1, y: .3, w: .8, h: .2 } }] }, coverBand: { color: '#FAFAFA', sources: [{ slide: 1, part: 'unrelated', shapeId: '2' }] } } } });
  assert.equal(pale.suggestedDesign.system.cover, 'minimal', 'a nearly white strip is not an identity band');
});

test('token bounds are disclosed adaptations and source aspect ratio is not claimed to survive', async () => {
  await withTemplate(template({ coverSize: 16000, bodySize: 800, paperWidth: 960, paperHeight: 720 }), async file => {
    const { suggestedDesign, designInference } = await inspectTemplate(file);
    assert.equal(suggestedDesign.system.coverTitleSize, 100);
    assert.equal(suggestedDesign.system.bodySize, 22);
    const record = designInference.decisions.find(d => d.target === 'system.coverTitleSize');
    assert.equal(record.adapted, true); assert.equal(record.sourcePt, 160);
    assert.ok(designInference.limitations.some(note => note.includes('源画幅不是 16:9')));
  });
});

test('filename changes and source text changes do not choose a known-template branch', async () => {
  const bytes = template();
  await withTemplate(bytes, async (file, directory) => {
    const renamed = join(directory, 'defense-biomedical-or-any-other-subject.pptx');
    const rewritten = join(directory, 'changed-source-words.pptx');
    await writeFile(renamed, bytes);
    await writeFile(rewritten, zipSync(Object.fromEntries(Object.entries(unzipSync(bytes)).map(([name, xml]) => [name, strToU8(strFromU8(xml).replaceAll('PRIVATE', 'ANOTHER'))]))));
    const [a, b, c] = await Promise.all([inspectTemplate(file), inspectTemplate(renamed), inspectTemplate(rewritten)]);
    assert.deepEqual(a.suggestedDesign, b.suggestedDesign);
    assert.deepEqual(a.suggestedDesign, c.suggestedDesign);
    assert.notEqual(a.sha256, c.sha256);
    const plainA = inferTemplateDesign({ study: {}, shapes: [], width: 1280, height: 720, sha256: 'a'.repeat(64), slideCount: 1 });
    const plainB = inferTemplateDesign({ study: {}, shapes: [], width: 1280, height: 720, sha256: 'b'.repeat(64), slideCount: 1 });
    assert.deepEqual(plainA.suggestedDesign, plainB.suggestedDesign);
    assert.notEqual(plainA.designInference.sourceSha256, plainB.designInference.sourceSha256);
  });
});
