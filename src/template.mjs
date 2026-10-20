/** Inspect the native, editable subset of a PPTX template. Never execute embedded content. */
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { studyTemplateParts, templateSlideOrder } from './template-study.mjs';

const EMU_PER_PX = 9525;
const SUPPORTED = new Set(['rect', 'roundRect', 'ellipse', 'line']);
const MAX_ARCHIVE = 64 * 1024 * 1024;
const MAX_XML = 3 * 1024 * 1024;
const abort = signal => { if (signal?.aborted) throw signal.reason || new Error('操作已取消'); };
const local = key => String(key).split(':').at(-1);
const attr = (node, key, fallback) => node?.attrs?.[key] ?? fallback;
const first = (node, name) => node?.children?.find(n => n.name === name);
const descendants = (node, name) => (node?.children || []).flatMap(n => [...(n.name === name ? [n] : []), ...descendants(n, name)]);
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const decode = s => String(s ?? '').replace(/&#x([a-f\d]+);|&#(\d+);|&(amp|lt|gt|quot|apos);/gi, (_, hex, dec, named) => {
  if (hex || dec) { const n = Number.parseInt(hex || dec, hex ? 16 : 10); return n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[named.toLowerCase()];
});

function xmlTree(bytes, name) {
  const text = strFromU8(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error(`模板 XML 不允许 DTD 或实体声明：${name}`);
  if (XMLValidator.validate(text) !== true) throw new Error(`模板 XML 无法解析：${name}`);
  const parsed = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: '', processEntities: false, trimValues: false, parseTagValue: false, ignoreDeclaration: true }).parse(text);
  const convert = list => list.flatMap(entry => {
    const key = Object.keys(entry).find(k => k !== ':@');
    if (!key || key.startsWith('?') || key === '#comment') return [];
    if (key === '#text') return [{ name: '#text', text: decode(entry[key]), attrs: {}, children: [] }];
    return [{ name: local(key), attrs: Object.fromEntries(Object.entries(entry[':@'] || {}).flatMap(([k, v]) => k.includes(':') ? [[k, decode(v)], [local(k), decode(v)]] : [[k, decode(v)]])), children: convert(Array.isArray(entry[key]) ? entry[key] : []) }];
  });
  return { name: 'root', attrs: {}, children: convert(parsed) };
}

function themeData(root) {
  const palette = {}, fonts = new Set();
  const scheme = descendants(root, 'clrScheme')[0];
  for (const entry of scheme?.children || []) {
    const color = first(entry, 'srgbClr') || first(entry, 'sysClr');
    const value = attr(color, color?.name === 'sysClr' ? 'lastClr' : 'val', '');
    if (/^[a-f\d]{6}$/i.test(value)) palette[entry.name] = `#${value}`;
  }
  for (const family of ['latin', 'ea', 'cs', 'font']) for (const el of descendants(root, family)) {
    const face = attr(el, 'typeface', '').trim(); if (face && !face.startsWith('+')) fonts.add(face);
  }
  return { palette, fonts: [...fonts] };
}

function color(parent, palette, fallback = 'none') {
  if (!parent) return fallback;
  if (first(parent, 'noFill')) return 'none';
  const fill = first(parent, 'solidFill') || parent;
  const rgb = first(fill, 'srgbClr'), scheme = first(fill, 'schemeClr');
  if (rgb && /^[a-f\d]{6}$/i.test(attr(rgb, 'val'))) return `#${attr(rgb, 'val')}`;
  if (scheme) return palette[attr(scheme, 'val')] || fallback;
  return fallback;
}

function xfrm(node, transform) {
  const x = first(node, 'xfrm');
  if (!x) return null;
  const off = first(x, 'off'), ext = first(x, 'ext');
  return { x: (num(attr(off, 'x')) * transform.sx + transform.tx) / EMU_PER_PX,
    y: (num(attr(off, 'y')) * transform.sy + transform.ty) / EMU_PER_PX,
    w: num(attr(ext, 'cx')) * transform.sx / EMU_PER_PX,
    h: num(attr(ext, 'cy')) * transform.sy / EMU_PER_PX,
    rotate: num(attr(x, 'rot')) / 60000,
    flipH: ['1', 'true'].includes(attr(x, 'flipH')), flipV: ['1', 'true'].includes(attr(x, 'flipV')) };
}

function shapeFromXml(xml, transform, palette, sourceSlide, sourcePart, unsupported, ambiguousTheme = false) {
  const props = first(xml, 'spPr'), info = descendants(xml, 'cNvPr')[0];
  const sourceShapeId = attr(info, 'id', ''), sourceName = attr(info, 'name', '');
  const source = { sourceSlide, sourcePart, sourceShapeId, sourceName };
  const text = descendants(xml, 't').map(t => t.children.filter(c => c.name === '#text').map(c => c.text).join('')).join('\n');
  const bounds = xfrm(props, transform);
  const geom = first(props, 'prstGeom');
  const type = xml.name === 'cxnSp' ? 'line' : attr(geom, 'prst', text ? 'rect' : undefined);
  if (!bounds || !SUPPORTED.has(type) || first(props, 'custGeom')) {
    unsupported.push({ ...source, reason: !bounds ? '缺少显式位置；母版继承未展开' : `不支持的形状类型：${type || xml.name}` });
    return null;
  }
  if (bounds.rotate || bounds.flipH || bounds.flipV) {
    unsupported.push({ ...source, reason: '旋转或翻转形状未导入，避免错误重建' }); return null;
  }
  if (descendants(props, 'gradFill').length || descendants(props, 'blipFill').length) {
    unsupported.push({ ...source, reason: '渐变或图片填充未导入' }); return null;
  }
  const line = first(props, 'ln'), dash = attr(first(line, 'prstDash'), 'val', 'solid');
  const shadow = descendants(props, 'outerShdw')[0];
  const modifiers = ['tint', 'shade', 'comp', 'inv', 'gray', 'alphaMod', 'alphaOff', 'hue', 'hueMod', 'hueOff', 'sat', 'satMod', 'satOff', 'lum', 'lumMod', 'lumOff', 'red', 'redMod', 'redOff', 'green', 'greenMod', 'greenOff', 'blue', 'blueMod', 'blueOff', 'gamma', 'invGamma'];
  if (modifiers.some(name => descendants(props, name).length)) {
    unsupported.push({ ...source, reason: '颜色变换或复合透明度未展开；该对象不作为直接复用组件' }); return null;
  }
  const schemes = descendants(props, 'schemeClr');
  if (schemes.some(c => ambiguousTheme || !palette[attr(c, 'val')])) {
    unsupported.push({ ...source, reason: '主题色依赖或颜色映射无法唯一解析；该对象不导入' }); return null;
  }
  if (first(xml, 'style') && ((!first(props, 'solidFill') && !first(props, 'noFill')) || !line || (!first(line, 'solidFill') && !first(line, 'noFill')))) {
    unsupported.push({ ...source, reason: '填充或描边依赖未展开的主题样式继承；该对象不导入' }); return null;
  }
  if (['innerShdw', 'glow', 'softEdge', 'reflection', 'blur', 'effectDag'].some(name => descendants(props, name).length) || (shadow && ['sx', 'sy', 'kx', 'ky'].some(k => attr(shadow, k) !== undefined && num(attr(shadow, k)) !== (k === 'sx' || k === 'sy' ? 100000 : 0)))) {
    unsupported.push({ ...source, reason: '复杂阴影或效果未导入' }); return null;
  }
  const opacity = parent => {
    const fill = first(parent, 'solidFill') || parent, rgb = first(fill, 'srgbClr') || first(fill, 'schemeClr');
    return Math.max(0, Math.min(1, num(attr(first(rgb, 'alpha'), 'val'), 100000) / 100000));
  };
  const adjustment = descendants(geom, 'gd').find(g => attr(g, 'name') === 'adj');
  const formula = attr(adjustment, 'fmla', 'val 16667');
  if (type === 'roundRect' && !/^val\s+\d+$/.test(formula)) {
    unsupported.push({ ...source, reason: '圆角调整公式不是显式常数；该对象不导入' }); return null;
  }
  const shape = { id: `${sourceSlide}:${sourceShapeId}`, ...source, kind: type === 'line' ? 'line' : type === 'ellipse' ? 'ellipse' : 'rect', ...bounds,
    fill: type === 'line' ? 'none' : color(props, palette), stroke: color(line, palette), strokeWidth: num(attr(line, 'w'), 12700) / EMU_PER_PX,
    fillOpacity: opacity(props), strokeOpacity: opacity(line),
    ...(type === 'roundRect' ? { radius: Math.min(bounds.w, bounds.h) * Math.min(.5, num(formula.split(/\s+/)[1], 16667) / 100000) } : {}),
    ...(dash !== 'solid' ? { dash: ['dash', 'sysDash', 'lgDash'].includes(dash) ? 'dash' : 'dot' } : {}),
    ...(shadow ? { shadow: { color: color(shadow, palette, '#223344'), opacity: opacity(shadow), angle: num(attr(shadow, 'dir')) / 60000, offset: num(attr(shadow, 'dist')) / EMU_PER_PX, blur: num(attr(shadow, 'blurRad')) / EMU_PER_PX } } : {}),
    text,
  };
  delete shape.rotate; delete shape.flipH; delete shape.flipV;
  if (text) {
    const run = descendants(xml, 'rPr')[0], end = descendants(xml, 'endParaRPr')[0];
    shape.textStyle = { fontSize: num(attr(run || end, 'sz'), 1800) / 100 / .75,
      fontFamily: attr(descendants(xml, 'latin')[0], 'typeface', ''), bold: ['1', 'true'].includes(attr(run, 'b')), color: color(run, palette, '#243648') };
  }
  return shape;
}

const contained = (outer, inner) => inner.x >= outer.x - 1 && inner.y >= outer.y - 1 && inner.x + inner.w <= outer.x + outer.w + 1 && inner.y + inner.h <= outer.y + outer.h + 1;
function makeComponent(id, candidates, metadata) {
  const backgrounds = candidates.filter(n => !n.text && (n.fill !== 'none' || n.stroke !== 'none'));
  if (!backgrounds.length) return null;
  const x = Math.min(...backgrounds.map(n => n.x)), y = Math.min(...backgrounds.map(n => n.y));
  const width = Math.max(...backgrounds.map(n => n.x + n.w)) - x, height = Math.max(...backgrounds.map(n => n.y + n.h)) - y;
  if (width < 60 || height < 34) return null;
  const nodes = backgrounds.map(({ id: _id, text: _text, textStyle: _style, ...n }) => ({ ...n, x: n.x - x, y: n.y - y }));
  const texts = candidates.filter(n => n.text && contained({ x, y, w: width, h: height }, n)).sort((a, b) => a.y - b.y);
  const zone = n => ({ x: (n.x - x) / width, y: (n.y - y) / height, w: n.w / width, h: n.h / height });
  return { id, ...metadata, width, height, sourceBox: { x, y, w: width, h: height }, nodes,
    ...(texts.length >= 2 ? { textZones: { title: zone(texts[0]), body: zone(texts.slice(1).sort((a, b) => b.w * b.h - a.w * a.h)[0]) } } : {}),
    sourceShapeIds: candidates.map(n => n.sourceShapeId), oldTextExcluded: true,
  };
}

export async function inspectTemplate(filePath, { signal } = {}) {
  abort(signal);
  const info = await stat(filePath);
  if (!info.isFile() || info.size > MAX_ARCHIVE) throw new Error('模板需为不超过 64 MiB 的本地 PPTX 文件。');
  const bytes = await readFile(filePath); abort(signal);
  const sha256 = createHash('sha256').update(bytes).digest('hex'), prefix = sha256.slice(0, 12);
  let count = 0, sum = 0;
  const zip = unzipSync(bytes, { filter(entry) {
    count++; if (count > 12000) throw new Error('模板 ZIP 条目过多。');
    if (!/^ppt\/(?:presentation\.xml|_rels\/presentation\.xml\.rels|theme\/theme\d+\.xml|slides\/(?:slide\d+\.xml|_rels\/slide\d+\.xml\.rels)|slideLayouts\/(?:slideLayout\d+\.xml|_rels\/slideLayout\d+\.xml\.rels)|slideMasters\/(?:slideMaster\d+\.xml|_rels\/slideMaster\d+\.xml\.rels))$/.test(entry.name)) return false;
    if (entry.originalSize > MAX_XML) throw new Error('模板单个 XML 超过 3 MiB。');
    sum += entry.originalSize; if (sum > 48 * 1024 * 1024) throw new Error('模板 XML 总量超过 48 MiB。');
    return true;
  } });
  if (!zip['ppt/presentation.xml']) throw new Error('文件不是包含 presentation.xml 的 PPTX。');
  const pres = xmlTree(zip['ppt/presentation.xml'], 'presentation.xml'), size = descendants(pres, 'sldSz')[0];
  const width = num(attr(size, 'cx'), 12192000) / EMU_PER_PX, height = num(attr(size, 'cy'), 6858000) / EMU_PER_PX;
  const theme = zip['ppt/theme/theme1.xml'] ? themeData(xmlTree(zip['ppt/theme/theme1.xml'], 'theme1.xml')) : { palette: {}, fonts: [] };
  const shapes = [], groups = [], unsupported = [];
  const ambiguousTheme = Object.keys(zip).filter(name => /^ppt\/theme\/theme\d+\.xml$/.test(name)).length > 1;
  if (ambiguousTheme) unsupported.push({ reason: '存在多个主题；只列出 theme1 色板，依赖主题色的形状不导入，以免错误绑定主题。显式 RGB 形状仍可提取。' });
  const presentationRels = zip['ppt/_rels/presentation.xml.rels'] ? xmlTree(zip['ppt/_rels/presentation.xml.rels'], 'ppt/_rels/presentation.xml.rels') : null;
  const { slideParts: slidePaths } = templateSlideOrder(zip, pres, presentationRels);
  if (slidePaths.length > 200) throw new Error('模板最多检查 200 页；请提供精简后的模板。');
  for (const [index, sourcePart] of slidePaths.entries()) {
    abort(signal);
    const sourceSlide = index + 1, root = xmlTree(zip[sourcePart], sourcePart), tree = descendants(root, 'spTree')[0];
    const walk = (node, transform = { sx: 1, sy: 1, tx: 0, ty: 0 }) => {
      const collected = [];
      for (const child of node?.children || []) {
        if (['sp', 'cxnSp'].includes(child.name)) {
          const shape = shapeFromXml(child, transform, theme.palette, sourceSlide, sourcePart, unsupported, ambiguousTheme);
          if (shape) { shapes.push(shape); collected.push(shape); }
        } else if (child.name === 'grpSp') {
          const props = first(child, 'grpSpPr'), x = first(props, 'xfrm'), info = descendants(first(child, 'nvGrpSpPr'), 'cNvPr')[0];
          if (!x || num(attr(x, 'rot')) || ['1', 'true'].includes(attr(x, 'flipH')) || ['1', 'true'].includes(attr(x, 'flipV'))) {
            unsupported.push({ sourceSlide, sourcePart, sourceShapeId: attr(info, 'id'), reason: '未导入旋转、翻转或缺少变换的组合' }); continue;
          }
          const off = first(x, 'off'), ext = first(x, 'ext'), co = first(x, 'chOff'), ce = first(x, 'chExt');
          const sx = num(attr(ext, 'cx'), 1) / (num(attr(ce, 'cx')) || 1), sy = num(attr(ext, 'cy'), 1) / (num(attr(ce, 'cy')) || 1);
          const next = { sx: transform.sx * sx, sy: transform.sy * sy,
            tx: transform.tx + transform.sx * (num(attr(off, 'x')) - num(attr(co, 'x')) * sx),
            ty: transform.ty + transform.sy * (num(attr(off, 'y')) - num(attr(co, 'y')) * sy) };
          const childShapes = walk(child, next); collected.push(...childShapes);
          groups.push({ sourceSlide, sourcePart, sourceShapeId: attr(info, 'id'), sourceName: attr(info, 'name'), shapes: childShapes });
        } else if (['pic', 'graphicFrame', 'contentPart', 'oleObj'].includes(child.name)) unsupported.push({ sourceSlide, sourcePart, reason: `${child.name} 不是支持的原生背景组件` });
      }
      return collected;
    };
    walk(tree);
  }
  const components = [];
  for (const group of groups) {
    const component = makeComponent(`${prefix}-s${group.sourceSlide}-group-${group.sourceShapeId}`, group.shapes, { sourceSha256: sha256, sourceSlide: group.sourceSlide, sourcePart: group.sourcePart, sourceGroupId: group.sourceShapeId, sourceName: group.sourceName, derivation: 'native-group-backgrounds' });
    if (component && component.width * component.height < width * height * .8) components.push(component);
  }
  for (const frame of shapes.filter(s => !s.text && s.kind === 'rect' && s.w * s.h < width * height * .65)) {
    const candidates = shapes.filter(s => s.sourceSlide === frame.sourceSlide && contained(frame, s));
    const component = makeComponent(`${prefix}-s${frame.sourceSlide}-shape-${frame.sourceShapeId}`, candidates, { sourceSha256: sha256, sourceSlide: frame.sourceSlide, sourcePart: frame.sourcePart, sourceFrameId: frame.sourceShapeId, sourceName: frame.sourceName, derivation: 'contained-native-backgrounds' });
    if (component) components.push(component);
  }
  const study = studyTemplateParts(zip, { parseXml: xmlTree, signal });
  return { format: 'academic-template-profile', version: 1, sourcePath: filePath, sha256, source: { path: filePath, sha256, width, height }, width, height, slideCount: slidePaths.length,
    palette: theme.palette, fonts: theme.fonts, shapes, components, unsupported, study,
    scope: '提取显式位置的原生矩形、圆角、椭圆和线条背景、显式 RGB/唯一可解主题色、单一 alpha 与简单外阴影；保留来源 ID 与几何；旧文字不复制。母版/主题样式继承、旋转/翻转、SmartArt、图表、图片、颜色变换、复杂填充效果与动画不作无损导入，详见 unsupported。',
    visualReview: 'not-performed',
  };
}
