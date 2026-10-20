import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { inspectTemplate } from '../src/template.mjs';

const ns = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"';
const slide = body => `<p:sld ${ns}><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`;
const box = '<a:xfrm><a:off x="600000" y="400000"/><a:ext cx="9000000" cy="800000"/></a:xfrm>';
const shape = (text, { size = 2000, font = 'Example Sans', ph = '', geometry = box, props = '' } = {}) => `<p:sp><p:nvSpPr><p:cNvPr id="1" name="PRIVATE_SHAPE_LABEL"/><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:spPr>${geometry}<a:prstGeom prst="rect"/></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${props}<a:p><a:r><a:rPr${size === null ? '' : ` sz="${size}"`}>${font ? `<a:latin typeface="${font}"/>` : ''}</a:rPr><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
const relationships = entries => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries.map(([id, type, target, external]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${type}" Target="${target}"${external ? ' TargetMode="External"' : ''}/>`).join('')}</Relationships>`;
const base = () => ({
  'ppt/presentation.xml': `<p:presentation ${ns}><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`,
});

async function inspect(parts, use) {
  const dir = await mkdtemp(path.join(process.cwd(), 'test-academic-study-'));
  try {
    const file = path.join(dir, 'unrelated-file-name.pptx');
    await writeFile(file, zipSync(Object.fromEntries(Object.entries(parts).map(([p, xml]) => [p, strToU8(xml)]))));
    return await use(file);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test('template study follows presentation order, resolves basic placeholder inheritance and excludes old content', async () => {
  const parts = base();
  parts['ppt/presentation.xml'] = `<p:presentation ${ns}><p:sldIdLst><p:sldId r:id="r2" id="256"/><p:sldId id="257" r:id="r1"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`;
  parts['ppt/_rels/presentation.xml.rels'] = relationships([['r1', 'slide', 'slides/slide1.xml'], ['r2', 'slide', 'slides/slide2.xml']]);
  parts['ppt/slides/slide2.xml'] = slide(shape('PRIVATE_COVER_TITLE', { size: 4400 }));
  parts['ppt/slides/slide1.xml'] = slide(shape('PRIVATE_INSTITUTION_938475', { size: null, font: '', ph: '<p:ph type="title" idx="0"/>', geometry: '' }) + shape('PRIVATE_RESEARCH_RESULT_782614', { size: 2000 }) + '<p:pic><p:spPr><a:solidFill><a:srgbClr val="124B80"/></a:solidFill></p:spPr></p:pic><p:graphicFrame><a:graphic><a:graphicData><c:chart r:id="chart1"/><a:tbl/></a:graphicData></a:graphic></p:graphicFrame>');
  parts['ppt/slides/_rels/slide1.xml.rels'] = relationships([['layout1', 'slideLayout', '../slideLayouts/slideLayout1.xml']]);
  parts['ppt/slideLayouts/slideLayout1.xml'] = `<p:sldLayout ${ns}><p:cSld><p:spTree>${shape('', { size: null, font: '', ph: '<p:ph type="title" idx="0"/>', props: '<a:lstStyle><a:lvl1pPr><a:defRPr sz="3200"><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></a:lstStyle>' }).replace('<a:lstStyle/>', '')}</p:spTree></p:cSld></p:sldLayout>`;
  parts['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = relationships([['master1', 'slideMaster', '../slideMasters/slideMaster1.xml']]);
  parts['ppt/slideMasters/slideMaster1.xml'] = `<p:sldMaster ${ns}><p:cSld><p:spTree/></p:cSld><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="2800"/></a:lvl1pPr></p:titleStyle></p:txStyles></p:sldMaster>`;
  parts['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = relationships([['theme1', 'theme', '../theme/theme1.xml']]);
  parts['ppt/theme/theme1.xml'] = `<a:theme ${ns}><a:themeElements><a:fontScheme><a:majorFont><a:latin typeface="Reference Serif"/></a:majorFont></a:fontScheme></a:themeElements></a:theme>`;
  await inspect(parts, async file => {
    const { study } = await inspectTemplate(file);
    assert.equal(study.slides.order, 'presentation-relationships');
    assert.deepEqual(study.pageRoleCandidates.cover, [1]);
    assert.deepEqual(study.pageRoleCandidates.table, [2]);
    assert.equal(study.assets.slidePictures, 1);
    assert.equal(study.assets.nativeCharts, 1);
    assert.equal(study.geometry.placeholderBoxesResolved, 1);
    assert.ok(study.typography.titleCandidateSizes.some(s => s.pt === 32));
    assert.ok(study.typography.sizeOrigins.some(s => s.origin === 'layout'));
    assert.ok(study.fonts.resolvedRunFamilies.some(f => f.family === 'Reference Serif'));
    assert.deepEqual(study.colors.explicitRGB, [{ rgb: '#124B80', count: 1 }]);
    assert.equal(study.visualReview, 'not-performed');
    const serialized = JSON.stringify(study);
    assert.doesNotMatch(serialized, /PRIVATE_|938475|782614|unrelated-file-name/);
  });
});

test('unresolved styles remain unknown and external relationship targets are never read', async () => {
  const parts = base();
  parts['ppt/slides/slide1.xml'] = slide(shape('PRIVATE_BODY', { size: null, font: '', geometry: '' }));
  parts['ppt/slides/_rels/slide1.xml.rels'] = relationships([['l', 'slideLayout', 'https://example.invalid/private-layout.xml', true]]);
  await inspect(parts, async file => {
    const { study } = await inspectTemplate(file);
    assert.equal(study.typography.unresolvedSizeRuns, 1);
    assert.equal(study.fonts.unresolvedRuns, 1);
    assert.equal(study.geometry.unresolvedTextBoxes, 1);
    assert.equal(study.slides.linkedLayouts, 0);
    assert.deepEqual(study.typography.allSizes, []);
    assert.equal(study.slides.order, 'slide-part-number-fallback');
    assert.doesNotMatch(JSON.stringify(study), /example\.invalid|PRIVATE_BODY/);
  });
});

test('200-slide study remains bounded and density is descriptive', async () => {
  const parts = base();
  for (let n = 1; n <= 200; n++) parts[`ppt/slides/slide${n}.xml`] = slide(shape(`SECRET_CONTENT_${n}`, { size: 1800 }));
  await inspect(parts, async file => {
    const { study } = await inspectTemplate(file);
    assert.equal(study.slides.count, 200);
    assert.ok(Buffer.byteLength(JSON.stringify(study)) < 10000);
    assert.equal(study.textDensity.perSlide.length + (study.textDensity.omittedRows || 0), 200);
    assert.doesNotMatch(JSON.stringify(study), /SECRET_CONTENT|"score"|"qualityScore"/);
  });
});

test('newly inspected layout XML shares the DTD rejection gate', async () => {
  const parts = base();
  parts['ppt/slides/slide1.xml'] = slide(shape('A'));
  parts['ppt/slides/_rels/slide1.xml.rels'] = relationships([['l', 'slideLayout', '../slideLayouts/slideLayout1.xml']]);
  parts['ppt/slideLayouts/slideLayout1.xml'] = '<!DOCTYPE p:sldLayout [<!ENTITY x SYSTEM "file:///private">]><p:sldLayout xmlns:p="p"/>';
  await inspect(parts, file => assert.rejects(inspectTemplate(file), /DTD|XML/));
});
