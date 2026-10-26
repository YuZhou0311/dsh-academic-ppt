/** Authored research narrative and native navigation. No page or finding is invented. */
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value.trim() : '';
const administrative = new Set(['cover', 'section', 'roadmap', 'references', 'closing']);
const bodySlides = project => list(project.slides).filter(slide => !administrative.has(slide.layout));
const planOf = project => project.brief?.narrative;
const sectionsOf = project => list(planOf(project)?.sections);
const sectionNumbersOf = project => new Map(sectionsOf(project).map((section, index) => [section.id, index + 1]));
const hasAuthoredRoadmap = slide => Boolean(slide.composition || slide.chart || slide.plot || slide.table || slide.referenceTemplateId ||
  ['cards', 'drawings', 'nodes', 'figureIds', 'plots', 'referenceIds'].some(key => list(slide[key]).length));

function sectionFor(sections, slide) {
  // A bad explicit ID must remain visible to validation, not be guessed from a title.
  if (slide.sectionId) return sections.find(section => section.id === slide.sectionId);
  const matches = sections.filter(section => section.title === slide.section?.title);
  return matches.length === 1 ? matches[0] : undefined;
}

function chapterOrdinal(value) {
  const number = text(value).normalize('NFKC').toUpperCase();
  if (/^\d+$/.test(number)) return Number(number);
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'].indexOf(number) + 1 || undefined;
}

/** Derive labels and a default agenda from the declared outline without mutating records. */
export function resolveNarrativeSlide(project, slide) {
  const sections = sectionsOf(project);
  if (!sections.length) return slide;
  const current = sectionFor(sections, slide), index = sections.indexOf(current);
  const resolved = { ...slide };
  if (current && !['cover', 'roadmap', 'references'].includes(slide.layout)) {
    resolved.section = { number: String(index + 1).padStart(2, '0'), title: current.title, ...slide.section };
  }
  if (['roadmap', 'section'].includes(slide.layout)) {
    // Adding a deck outline must not replace an existing authored roadmap.
    if (!slide.agenda && (slide.layout !== 'roadmap' || !hasAuthoredRoadmap(slide))) {
      resolved.agenda = {
        items: sections.map(section => ({ sectionId: section.id, title: section.title, question: section.question })),
        ...(current ? { active: index + 1 } : {}),
      };
    } else if (slide.agenda && slide.agenda.active === undefined && current) {
      const active = slide.agenda.items.findIndex(item => item.sectionId === current.id || !item.sectionId && item.title === current.title);
      if (active >= 0) resolved.agenda = { ...slide.agenda, active: active + 1 };
    }
  }
  return resolved;
}

/** Structural diagnostics identify omissions and contradictions, not scientific validity. */
export function narrativeIssues(project) {
  const slides = list(project.slides), bodies = bodySlides(project), plan = planOf(project), sections = sectionsOf(project), issues = [];
  const add = (severity, code, path, message, more = {}) => issues.push({ severity, code, path, message, ...more });
  const atSlide = (severity, code, slide, field, message, more = {}) => add(severity, code, `slides.${slide.id}${field ? '.' + field : ''}`, message, { slideId: slide.id, ...more });
  const longTalk = slides.filter(slide => slide.layout !== 'references').length >= 8 || (project.brief?.talkMinutes >= 10 && bodies.length >= 3);
  if (!plan) {
    if (longTalk) add('warning', 'narrative-plan-missing', 'brief.narrative', '长报告尚未登记整稿论证路线。用 throughline 写中心论证，sections 写分节标题及每节要回答的问题，再安排目录、章节定位和过渡；不要把逐页摘要当作整稿逻辑。');
    for (const slide of slides) {
      if (slide.sectionId) atSlide('error', 'narrative-reference-without-plan', slide, 'sectionId', 'sectionId 需要对应的 brief.narrative.sections；先声明路线或移除未使用的关联，不能让页面悄悄失去章节定位。');
      for (const [index, item] of list(slide.agenda?.items).entries()) if (item.sectionId) atSlide('error', 'narrative-reference-without-plan', slide, `agenda.items.${index}.sectionId`, '目录 sectionId 需要对应的 brief.narrative.sections；旧式独立目录可只提供 title 和 question。');
    }
    return issues;
  }
  const seen = new Set();
  for (const section of sections) {
    if (seen.has(section.id)) add('error', 'narrative-section-duplicate', 'brief.narrative.sections', `章节 ID ${section.id} 重复；为每一节保留唯一、稳定的 ID。`);
    seen.add(section.id);
  }
  const byId = new Map(sections.map(section => [section.id, section]));
  const position = new Map(sections.map((section, index) => [section.id, index]));
  const used = new Set();
  const unassigned = [];
  let lastPosition = -1;
  for (const slide of slides) {
    const current = sectionFor(sections, slide);
    if (slide.sectionId && !byId.has(slide.sectionId)) atSlide('error', 'narrative-section-unknown', slide, 'sectionId', `sectionId ${slide.sectionId} 不在 brief.narrative.sections 中；修正关联，不自动猜测章节。`);
    if (current && slide.section?.title && slide.section.title !== current.title) atSlide('error', 'narrative-section-title-conflict', slide, 'section.title', `页面章节名“${slide.section.title}”与所关联的“${current.title}”不一致。统一导航名称，页面自身 title 可以保留具体研究判断。`);
    const ordinal = chapterOrdinal(slide.section?.number);
    if (current && ordinal !== undefined && ordinal !== position.get(current.id) + 1) atSlide('error', 'narrative-section-number-conflict', slide, 'section.number', `页面章节序号 ${slide.section.number} 与路线中第 ${position.get(current.id) + 1} 节不一致；保留同一编号，或省略 number 由路线派生。`);
    if (slide.agenda) {
      const linked = new Set();
      for (const [index, item] of list(slide.agenda.items).entries()) {
        if (!item.sectionId) continue;
        const canonical = byId.get(item.sectionId);
        if (!canonical) atSlide('error', 'narrative-agenda-unknown', slide, `agenda.items.${index}.sectionId`, `目录关联了未声明的章节 ${item.sectionId}。`);
        else if (item.title !== canonical.title) atSlide('error', 'narrative-agenda-title-conflict', slide, `agenda.items.${index}.title`, `目录条目“${item.title}”与章节 ${item.sectionId} 的名称“${canonical.title}”不一致。`);
        if (linked.has(item.sectionId)) atSlide('error', 'narrative-agenda-duplicate', slide, 'agenda.items', `目录重复关联了章节 ${item.sectionId}。`);
        linked.add(item.sectionId);
      }
      const items = list(slide.agenda.items), agendaSections = items.map(item => sectionFor(sections, { sectionId: item.sectionId, section: { title: item.title } }));
      const active = slide.agenda.active;
      if (active !== undefined && (active < 1 || active > items.length)) atSlide('error', 'agenda-active-out-of-range', slide, 'agenda.active', 'agenda.active 必须对应实际章节条目。');
      const selected = agendaSections[active - 1];
      if (current && selected && selected.id !== current.id) atSlide('error', 'narrative-agenda-active-conflict', slide, 'agenda.active', `本页关联“${current.title}”，目录却高亮“${selected.title}”。active 按本页 agenda.items 的位置计数；省略时可按关联章节派生。`);
      const covered = new Set(agendaSections.filter(Boolean).map(section => section.id));
      if (slide.layout === 'roadmap' && sections.some(section => !covered.has(section.id))) atSlide('warning', 'narrative-agenda-coverage', slide, 'agenda.items', '显式目录没有覆盖全部声明章节。核对它是否是局部路线，或是否遗漏听众需要知道的问题；省略 agenda 时会从整稿路线完整派生。', { missingSectionIds: sections.filter(section => !covered.has(section.id)).map(section => section.id) });
    }
    if (!administrative.has(slide.layout)) {
      if (current) used.add(current.id);
      else unassigned.push(slide.id);
    }
    if (current && !['cover', 'roadmap', 'references', 'closing'].includes(slide.layout)) {
      const nextPosition = position.get(current.id);
      if (nextPosition < lastPosition) atSlide('warning', 'narrative-section-order', slide, 'sectionId', '实际页序回到较早章节。核对是否有意回顾问题或方法，并用 transition 说明为什么回看；如果是误排再调整 slideOrder，检查不会自动重排。');
      lastPosition = nextPosition;
    }
  }
  if (unassigned.length) add('warning', 'narrative-section-missing', 'slides', `${unassigned.length} 张正文页没有关联可辨认的章节。通过 sectionId 保持目录、分节和正文页角一致；无需为每节额外插入过渡页。`, { relatedSlideIds: unassigned });
  if (slides.length && !slides.some(slide => slide.layout === 'roadmap')) add('warning', 'narrative-roadmap-missing', 'slides', '已声明整稿论证路线，但没有目录/路线页。较长报告应尽早让听众知道将依次回答哪些问题；短报告可经实际审阅保留轻量章节定位。');
  for (const section of sections) if (bodies.length && !used.has(section.id)) add('warning', 'narrative-section-without-content', 'brief.narrative.sections', `章节“${section.title}”尚无关联正文。核对是否遗漏材料，或是否应合并章节；目录不能承诺未展示的内容。`, { sectionId: section.id });
  let previous;
  for (const slide of bodies) {
    const current = sectionFor(sections, slide);
    if (previous && current && current.id !== previous.section.id) {
      const between = slides.slice(slides.indexOf(previous.slide) + 1, slides.indexOf(slide));
      if (!text(previous.slide.transition) && !between.some(item => text(item.transition))) atSlide('warning', 'narrative-transition-missing', slide, '', `从“${previous.section.title}”进入“${current.title}”缺少显式过渡。用前页 transition 说明已有证据留下什么问题、为何需要下一步；不必新增空过渡页。`, { relatedSlideIds: [previous.slide.id, slide.id] });
    }
    if (current) previous = { slide, section: current };
  }
  const closing = slides.filter(slide => slide.layout === 'closing');
  if (slides.length && !closing.length) add('warning', 'narrative-closing-missing', 'slides', '整稿缺少收束页。让结尾对开场研究问题作答，并保留当前证据的边界与下一步；不要只重复目录或致谢。');
  else if (closing.length && !closing.some(slide => text(slide.closing?.statement) || text(slide.takeaway) || text(slide.argument?.contribution) || text(slide.composition?.conclusion?.text))) atSlide('warning', 'narrative-closing-response-missing', closing.at(-1), '', '结尾尚无显式主判断。用 closing.statement、takeaway 或 composition.conclusion.text 写对中心问题的回答；自动检查只确认字段存在，仍需人工核对回答是否由证据支持。');
  return issues;
}

const fail = (b, code, message) => b.page.issues.push({ severity: 'error', code, slideId: b.page.id, message });
const bodySize = b => Math.max(26, b.design?.projection?.bodyMin ?? 0);
const labelSize = b => Math.max(24, b.design?.projection?.labelMin ?? 0);
const height = (wrapText, value, width, size, bold = false, lineHeight = 1.2) => wrapText(value, Math.max(1, width), size, { bold }).length * size * lineHeight;

/** Open numbered rows; extra items become two reading columns, never a card wall. */
function agendaRows(b, agenda, area, { wrapText, sectionNumbers }) {
  const items = list(agenda?.items), active = agenda?.active;
  if (!items.length) { fail(b, 'narrative-agenda-empty', '目录或章节导航需要实际条目；填写 agenda.items 或 brief.narrative.sections。'); return; }
  if (active !== undefined && (active < 1 || active > items.length)) fail(b, 'agenda-active-out-of-range', 'agenda.active 必须对应实际章节条目。');
  const columns = items.length > 5 ? 2 : 1, rows = Math.ceil(items.length / columns), columnGap = 48, columnW = (area.w - columnGap * (columns - 1)) / columns;
  const numberW = 54, textW = columnW - numberW - 18, titleSize = b.system.panelTitleSize, questionSize = bodySize(b), numberSize = Math.max(28, labelSize(b));
  const measured = items.map((item, index) => {
    const selected = active === index + 1;
    const titleH = height(wrapText, item.title, textW, titleSize, selected, 1.16);
    const questionH = text(item.question) ? height(wrapText, item.question, textW, questionSize, false, 1.2) : 0;
    return { item, selected, titleH, questionH, needed: Math.max(numberSize * 1.2, titleH + (questionH ? 8 + questionH : 0)) + 16 };
  });
  const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(...measured.filter((_, index) => index % rows === row).map(item => item.needed)));
  const gap = 18, neededH = rowHeights.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, rows - 1);
  if (neededH > area.h + 2) fail(b, 'narrative-agenda-overflow', `导航内容估计需要 ${Math.ceil(neededH)} px，当前区域为 ${Math.floor(area.h)} px。保留标题、问题与字号；精简重复表述、拆分导航或采用自定义 composition。`);
  const rowGap = rows > 1 ? Math.min(36, gap + Math.max(0, area.h - neededH) / (rows - 1)) : gap;
  const ys = [];
  for (let row = 0, y = area.y; row < rows; row++) { ys.push(y); y += rowHeights[row] + rowGap; }
  measured.forEach(({ item, selected, titleH, questionH }, index) => {
    const column = Math.floor(index / rows), row = index % rows, x = area.x + column * (columnW + columnGap), y = ys[row];
    // Active uses this local list's position; linked labels retain the deck's numbering.
    const number = sectionNumbers.get(item.sectionId) ?? index + 1;
    b.text(`agenda:${index}:number`, String(number).padStart(2, '0'), { x, y, w: numberW, h: numberSize * 1.2 }, numberSize, { color: selected ? b.p.accent : b.p.muted, bold: selected, lineHeight: 1.2, role: 'section-index' });
    b.text(`agenda:${index}:title`, item.title, { x: x + numberW + 18, y, w: textW, h: titleH }, titleSize, { color: selected ? b.p.accent : b.p.ink, bold: selected, lineHeight: 1.16, role: 'agenda-title' });
    if (questionH) b.text(`agenda:${index}:question`, item.question, { x: x + numberW + 18, y: y + titleH + 8, w: textW, h: questionH }, questionSize, { color: b.p.muted, lineHeight: 1.2, role: 'body' });
    b.line(`agenda:${index}:rule`, x, y + rowHeights[row], x + columnW, y + rowHeights[row], b.p.line, { strokeWidth: 1, role: 'decoration', semantic: false });
    if (selected) b.line(`agenda:${index}:active`, x, y + rowHeights[row], x + 40, y + rowHeights[row], b.p.accent, { strokeWidth: 2, role: 'decoration', semantic: false });
  });
}

/** A roadmap states the actual line of argument and the question behind each section. */
export function renderNarrativeRoadmap(b, project, slide, { wrapText, contentBox }) {
  const resolved = resolveNarrativeSlide(project, slide), area = { ...contentBox }, size = bodySize(b);
  const introductions = [...new Set([text(slide.subtitle), text(planOf(project)?.throughline)].filter(Boolean))];
  for (const [index, value] of introductions.entries()) {
    const h = height(wrapText, value, area.w, size);
    b.text(index === introductions.length - 1 && value === text(planOf(project)?.throughline) ? 'narrative-throughline' : 'roadmap-subtitle', value, { x: area.x, y: area.y, w: area.w, h }, size, { color: b.p.ink, lineHeight: 1.2, role: 'body' });
    area.y += h + 24; area.h -= h + 24;
  }
  if (area.h <= 0) fail(b, 'narrative-agenda-overflow', '目录引言占满可用区域；压缩重复说明，保留研究路线及必要章节问题。');
  agendaRows(b, resolved.agenda, { ...area, h: Math.max(1, area.h) }, { wrapText, sectionNumbers: sectionNumbersOf(project) });
}

/** A light chapter boundary preserves content hierarchy without large brand-like color slabs. */
export function renderNarrativeSection(b, project, slide, { wrapText }) {
  const resolved = resolveNarrativeSlide(project, slide), section = resolved.section, agenda = resolved.agenda;
  const sectionName = section?.title || slide.title, sectionNumber = section?.number;
  const x = 64, w = 1152, nameSize = b.system.sectionSize * 1.4, nameX = sectionNumber ? 170 : x, nameW = 1280 - 64 - nameX;
  let y = 52;
  if (sectionNumber) b.text('section-number', sectionNumber, { x, y, w: 86, h: 60 }, Math.max(42, labelSize(b)), { color: b.p.accent, bold: true, lineHeight: 1.15, role: 'section-index' });
  const nameH = height(wrapText, sectionName, nameW, nameSize, true, 1.16);
  b.text('section-name', sectionName, { x: nameX, y, w: nameW, h: nameH }, nameSize, { color: b.p.accent, bold: true, lineHeight: 1.16, role: 'section-label' });
  y += Math.max(nameH, sectionNumber ? 60 : 0) + 18;
  if (slide.title !== sectionName) {
    const h = height(wrapText, slide.title, w, b.system.titleSize, true, 1.15);
    b.text('title', slide.title, { x, y, w, h }, b.system.titleSize, { color: b.p.ink, bold: true, lineHeight: 1.15, role: 'title' }); y += h + 18;
  }
  if (slide.kicker) {
    const size = labelSize(b), h = height(wrapText, slide.kicker, w, size);
    b.text('kicker', slide.kicker, { x, y, w, h }, size, { color: b.p.muted, lineHeight: 1.2, role: 'identity' }); y += h + 16;
  }
  if (slide.subtitle) {
    const size = bodySize(b), h = height(wrapText, slide.subtitle, w, size);
    b.text('subtitle', slide.subtitle, { x, y, w, h }, size, { color: b.p.ink, lineHeight: 1.2, role: 'body' }); y += h + 20;
  }
  b.line('section-rule', x, y, x + w, y, b.p.line, { strokeWidth: 1, role: 'decoration', semantic: false }); y += 28;
  if (list(agenda?.items).length) agendaRows(b, agenda, { x, y, w, h: Math.max(1, 672 - y) }, { wrapText, sectionNumbers: sectionNumbersOf(project) });
  else if (y > 672) fail(b, 'narrative-section-overflow', '章节标题与说明超过可用区域；调整信息分配，不缩小必要文字或删除研究题名。');
}
