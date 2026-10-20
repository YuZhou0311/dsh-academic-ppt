/** Bounded academic design tokens and content-free PPTX style inference. */
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const ACADEMIC_SYSTEM_ENUMS = freeze({
  preset: ['academic-defense', 'academic-report', 'plain'],
  header: ['band', 'rule'], cover: ['framed', 'project', 'minimal'], panel: ['band', 'tint', 'line'],
});
export const ACADEMIC_SYSTEM_RANGES = freeze({
  titleSize: [32, 44], coverTitleSize: [60, 100], bodySize: [22, 28],
  panelTitleSize: [24, 32], captionSize: [16, 22], sectionSize: [24, 34],
});
export const LEGACY_ACADEMIC_SYSTEM = freeze({
  preset: 'plain', header: 'rule', cover: 'project', panel: 'line',
  titleSize: 40, coverTitleSize: 60, bodySize: 24, panelTitleSize: 26, captionSize: 18, sectionSize: 26,
});
export const DEFAULT_ACADEMIC_SYSTEM = freeze({
  preset: 'academic-defense', header: 'band', cover: 'framed', panel: 'band',
  titleSize: 40, coverTitleSize: 76, bodySize: 24, panelTitleSize: 28, captionSize: 18, sectionSize: 30,
});
const REPORT_SYSTEM = freeze({ ...DEFAULT_ACADEMIC_SYSTEM, preset: 'academic-report', header: 'rule', cover: 'project', panel: 'tint', coverTitleSize: 72 });
const defaultsFor = preset => preset === 'plain' ? LEGACY_ACADEMIC_SYSTEM : preset === 'academic-report' ? REPORT_SYSTEM : DEFAULT_ACADEMIC_SYSTEM;
const round = n => Math.round(n * 100) / 100;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

/** Missing system means legacy rendering; explicit systems use preset defaults. Schema validation remains authoritative. */
export function resolveAcademicSystem(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...LEGACY_ACADEMIC_SYSTEM };
  const preset = ACADEMIC_SYSTEM_ENUMS.preset.includes(input.preset) ? input.preset : DEFAULT_ACADEMIC_SYSTEM.preset;
  const result = { ...defaultsFor(preset) };
  for (const [key, allowed] of Object.entries(ACADEMIC_SYSTEM_ENUMS)) if (allowed.includes(input[key])) result[key] = input[key];
  for (const [key, [low, high]] of Object.entries(ACADEMIC_SYSTEM_RANGES)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) result[key] = round(clamp(input[key], low, high));
  }
  return result;
}

const hex = value => /^#[0-9a-f]{6}$/i.test(String(value)) ? String(value).toUpperCase() : null;
const rgb = value => [1, 3, 5].map(at => Number.parseInt(value.slice(at, at + 2), 16));
const fromRgb = values => '#' + values.map(n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
const mix = (a, b, amount) => fromRgb(rgb(a).map((n, i) => n * (1 - amount) + rgb(b)[i] * amount));
const luminance = value => rgb(value).map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => { const values = [luminance(a), luminance(b)].sort((a, b) => a - b); return (values[1] + .05) / (values[0] + .05); };
const colored = value => { const channels = rgb(value); return Math.max(...channels) - Math.min(...channels) >= 25; };
const dark = value => luminance(value) < .6;
const visiblePaint = value => hex(value) && dark(hex(value));
const insetContains = (outer, inner, tolerance = .025) => inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance && inner.x + inner.w <= outer.x + outer.w + tolerance && inner.y + inner.h <= outer.y + outer.h + tolerance;
const sourceFor = shape => ({ slide: shape.sourceSlide, part: shape.sourcePart, shapeId: shape.sourceShapeId });
const sourceList = values => values.filter(Boolean).slice(0, 4).map(sourceFor);

function dominantShapes(shapes, predicate, score = s => s.w * s.h) {
  const groups = new Map();
  for (const shape of shapes.filter(predicate)) {
    const color = hex(shape.fill); if (!color) continue;
    if (!groups.has(color)) groups.set(color, { color, shapes: [], score: 0, pages: new Set() });
    const group = groups.get(color); group.shapes.push(shape); group.score += score(shape); group.pages.add(shape.sourceSlide);
  }
  return [...groups.values()].sort((a, b) => b.pages.size - a.pages.size || b.score - a.score || a.color.localeCompare(b.color));
}

/** Uses resolved geometry/style observations only. No filename, subject, source words or known hashes influence a choice. */
export function inferTemplateDesign({ study = {}, shapes = [], width = 1280, height = 720, sha256, slideCount = 0 } = {}) {
  const sourceWidth = Number.isFinite(width) && width > 0 ? width : 1280;
  const sourceHeight = Number.isFinite(height) && height > 0 ? height : 720;
  const fontScale = 720 / sourceHeight;
  const observations = study.designEvidence || {};
  const normalized = shapes.filter(s => [s.x, s.y, s.w, s.h].every(Number.isFinite) && s.w > 0 && s.h > 0)
    .map(s => ({ ...s, fill: hex(s.fill), stroke: hex(s.stroke), x: s.x / sourceWidth, y: s.y / sourceHeight, w: s.w / sourceWidth, h: s.h / sourceHeight }));
  const opaque = s => (s.fillOpacity ?? 1) >= .85;
  const bodyShapes = normalized.filter(s => slideCount <= 1 || s.sourceSlide > 1);
  const bandGroups = dominantShapes(bodyShapes, s => s.kind === 'rect' && opaque(s) && s.w >= .65 && s.h >= .018 && s.h <= .19 && s.y >= -.005 && s.y + s.h <= .27 && visiblePaint(s.fill));
  const evidenceShapes = evidence => (evidence?.sources || []).map(s => ({ sourceSlide: s.slide, sourcePart: s.part, sourceShapeId: s.shapeId }));
  const bandEvidence = observations.headerBand;
  if (visiblePaint(bandEvidence?.color)) bandGroups.push({ color: hex(bandEvidence.color), shapes: evidenceShapes(bandEvidence), pages: new Set((bandEvidence.sources || []).map(s => s.slide)), pageCount: bandEvidence.repeatedOnSlides || 1, score: 0 });
  const pageCount = group => group?.pageCount ?? group?.pages?.size ?? 0;
  bandGroups.sort((a, b) => pageCount(b) - pageCount(a) || b.score - a.score);
  const repeatedBand = bandGroups.find(g => pageCount(g) >= 2);
  const singularBand = !repeatedBand && slideCount <= 2 ? bandGroups[0] : null;
  const chosenBand = repeatedBand || singularBand;
  const backgrounds = dominantShapes(bodyShapes, s => s.kind === 'rect' && opaque(s) && s.w >= .94 && s.h >= .9 && s.x <= .03 && s.y <= .03);
  const backgroundEvidence = observations.background;
  const background = hex(backgroundEvidence?.color) || backgrounds[0]?.color || '#FFFFFF';
  const decisions = [];
  const decision = (target, value, reason, sources = [], more = {}) => decisions.push({ target, value, reason, sources: sources.slice(0, 4), ...more });

  let accent = chosenBand?.color;
  let accentSources = chosenBand ? sourceList(chosenBand.shapes) : [];
  if (!accent) {
    const textAccent = [observations.title, observations.coverTitle, observations.panelTitle].find(s => hex(s?.color) && colored(hex(s.color)) && contrast(hex(s.color), background) >= 2);
    if (textAccent) { accent = hex(textAccent.color); accentSources = textAccent.sources || []; }
  }
  if (!accent) {
    const strong = dominantShapes(bodyShapes, s => opaque(s) && s.fill && colored(s.fill) && s.w * s.h < .65 && contrast(s.fill, background) >= 2);
    accent = strong[0]?.color; accentSources = strong[0] ? sourceList(strong[0].shapes) : [];
  }
  if (!accent) {
    const observed = (study.colors?.explicitRGB || []).find(c => hex(c.rgb) && colored(hex(c.rgb)) && contrast(hex(c.rgb), background) >= 2);
    if (observed) accent = hex(observed.rgb);
  }
  const accentFallback = !accent;
  accent ||= luminance(background) < .25 ? '#B5CEE8' : '#183B66';
  const originalAccent = accent;
  // Header bands use white lettering in the supported grammar. Keep their chosen paint readable and disclose adaptation.
  if (chosenBand) for (let i = 0; contrast(accent, '#FFFFFF') < 4.5 && i < 16; i++) accent = mix(accent, '#000000', .08);
  decision('palette.accent', accent, accentFallback ? '未找到可确定主色，使用可审定的中性学术默认色。' : chosenBand ? '采用页上方宽色带的共同填充色。' : '采用实际标题或原生形状中可辨认的强调色。', accentSources,
    { confidence: accentFallback ? 'fallback' : pageCount(chosenBand) >= 2 ? 'repeated-structure' : 'structural-candidate', ...(originalAccent !== accent ? { adaptedFrom: originalAccent, adaptation: '增加白色页眉文字对比度；不声称原色复刻。' } : {}) });

  const bodyColor = hex(observations.body?.color);
  const ink = bodyColor && contrast(bodyColor, background) >= 4.5 ? bodyColor : contrast('#202632', background) >= 4.5 ? '#202632' : '#FFFFFF';
  const other = (study.colors?.explicitRGB || []).map(c => hex(c.rgb)).find(c => c && c !== originalAccent && colored(c) && contrast(c, background) >= 3 && Math.max(...rgb(c).map((n, i) => Math.abs(n - rgb(originalAccent)[i]))) >= 45);
  const secondary = other || mix(accent, ink, .38);
  const tint = mix(background, accent, .075);
  const palette = { background, paper: background, ink, accent, secondary, muted: mix(ink, background, .25), line: mix(background, ink, .23), soft: tint, tint, gold: other || mix(accent, ink, .18) };
  if (backgroundEvidence || backgrounds[0]) decision('palette.background', background, '采用可解析的实际页面背景或通页背景形状。', backgroundEvidence?.sources || sourceList(backgrounds[0]?.shapes || []), { confidence: 'structural-candidate' });

  const coverTitle = observations.coverTitle;
  const coverBox = coverTitle?.sources?.[0]?.box;
  const coverShapes = normalized.filter(s => s.sourceSlide === 1);
  const frames = coverShapes.filter(s => s.kind === 'rect' && s.stroke && (s.strokeOpacity ?? 1) >= .7 && (s.strokeWidth ?? 0) > 0 && s.w >= .55 && s.h >= .19 && s.w * s.h < .93 && contrast(s.stroke, s.fill || background) >= 1.8 && (!coverBox || insetContains(s, coverBox)));
  const observedFrame = observations.coverFrame;
  if (hex(observedFrame?.color) && contrast(hex(observedFrame.color), hex(observedFrame.fill) || background) >= 1.8) {
    for (const source of observedFrame.sources || []) if (source.box && (!coverBox || insetContains(source.box, coverBox))) frames.push({ sourceSlide: source.slide, sourcePart: source.part, sourceShapeId: source.shapeId });
  }
  const coverBands = coverShapes.filter(s => s.kind === 'rect' && opaque(s) && s.w >= .8 && s.h >= .05 && s.h <= .25 && s.y >= -.01 && s.y + s.h <= .28 && s.fill && contrast(s.fill, background) >= 2.5);
  if (hex(observations.coverBand?.color) && contrast(hex(observations.coverBand.color), background) >= 2.5) coverBands.push(...evidenceShapes(observations.coverBand));
  const framed = frames.length > 0 || coverBands.length > 0;
  let cover = framed ? 'framed' : coverTitle?.align === 'center' && coverBox && coverBox.y >= .15 ? 'minimal' : 'project';
  const panelBands = dominantShapes(bodyShapes, s => s.kind === 'rect' && opaque(s) && s.w >= .14 && s.w <= .7 && s.h >= .02 && s.h <= .14 && s.y >= .15 && s.y + s.h <= .85 && visiblePaint(s.fill));
  if (visiblePaint(observations.panelBand?.color)) panelBands.push({ shapes: evidenceShapes(observations.panelBand) });
  const palePanels = normalized.filter(s => s.sourceSlide !== 1 && s.kind === 'rect' && s.fill && s.w >= .14 && s.w <= .85 && s.h >= .12 && s.h <= .7 && contrast(s.fill, background) > 1.03 && contrast(s.fill, background) < 2.3);
  const panel = panelBands[0] ? 'band' : palePanels.length ? 'tint' : 'line';
  const header = chosenBand ? 'band' : 'rule';
  const preset = header === 'band' || cover === 'framed' ? 'academic-defense' : 'academic-report';
  const system = resolveAcademicSystem({ preset, header, cover, panel });
  decision('system.header', header, repeatedBand ? '至少两张正文页出现相同主色的上方宽色带。' : singularBand ? '短模板中观察到上方宽色带；重复性尚不足。' : '未检测到重复宽色带，采用细线页眉作为保守迁移。', sourceList(chosenBand?.shapes || []), { confidence: repeatedBand ? 'repeated-structure' : chosenBand ? 'structural-candidate' : 'fallback' });
  decision('system.cover', cover, frames.length ? '首页原生边框包围候选主标题区。' : coverBands.length ? '首页有独立的上方身份色带，采用身份带、研究题名与署名分层的封面。' : cover === 'minimal' ? '首页主标题居中且位于页面中部，采用居中留白构图。' : '采用首页标题主导、身份信息分开的项目汇报构图。', frames.length ? sourceList(frames) : coverBands.length ? sourceList(coverBands) : coverTitle?.sources || [], { confidence: framed || coverTitle ? 'structural-candidate' : 'fallback' });
  decision('system.panel', panel, panel === 'band' ? '正文内容区存在局部标题色带。' : panel === 'tint' ? '正文内容区存在浅色填充分区。' : '未检测到稳定填充分区，采用细线与文字层级。', panel === 'band' ? sourceList(panelBands[0].shapes) : sourceList(palePanels), { confidence: panel === 'line' ? 'fallback' : 'structural-candidate' });

  const roleTokens = { titleSize: 'title', coverTitleSize: 'coverTitle', bodySize: 'body', panelTitleSize: 'panelTitle', captionSize: 'caption', sectionSize: 'section' };
  for (const [token, role] of Object.entries(roleTokens)) {
    const sample = observations[role] || (role === 'section' ? observations.panelTitle : null);
    if (!sample || !Number.isFinite(sample.fontSizePt) || sample.fontSizePt <= 0) continue;
    const requested = sample.fontSizePt * 4 / 3 * fontScale, [low, high] = ACADEMIC_SYSTEM_RANGES[token];
    system[token] = round(clamp(requested, low, high));
    decision('system.' + token, system[token], '由对应文字角色的实际字号换算至目标画布，并限制在支持的可审定范围。', sample.sources || [], { confidence: 'structural-candidate', sourcePt: sample.fontSizePt, targetPxBeforeBounds: round(requested), adapted: Math.abs(requested - system[token]) > .02 });
  }
  const fontFamily = String(observations.body?.fontFamily || observations.title?.fontFamily || study.fonts?.resolvedRunFamilies?.[0]?.family || 'Noto Sans CJK SC').slice(0, 120);
  decision('fontFamily', fontFamily, observations.body?.fontFamily || observations.title?.fontFamily || study.fonts?.resolvedRunFamilies?.length ? '采用可解析的正文或页标题字体；字体安装与字形覆盖仍需渲染核对。' : '未解析到有效字体，使用可审定默认字体。', observations.body?.sources || observations.title?.sources || [], { confidence: observations.body?.fontFamily || study.fonts?.resolvedRunFamilies?.length ? 'structural-candidate' : 'fallback' });
  const limits = [
    '建议来自 PPTX XML 结构，尚未视觉确认；执行者需查看代表页后审定字号、层级和颜色。',
    '这些参数迁移支持的页眉、封面与分区语法，不是原母版或复杂效果的精确复刻。',
    '未解析的继承、变换、图片背景、SmartArt 与字体替代可能改变实际外观。',
  ];
  if (Math.abs(sourceWidth / sourceHeight - 16 / 9) > .01) limits.push('源画幅不是 16:9；几何与字号建议适配至 1280×720，不保留源画幅。');
  return {
    suggestedDesign: { fontFamily, palette, system },
    designInference: { basis: 'pptx-xml-structural', visualReview: 'not-performed', ...(sha256 ? { sourceSha256: sha256 } : {}), targetCanvas: { width: 1280, height: 720, unit: 'px' }, decisions, limitations: limits },
  };
}
