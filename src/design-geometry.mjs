/**
 * Explainable layout diagnostics over the same scene used by PPTX export.
 * These are conservative geometry estimates, never an aesthetic score.
 * Text contributes estimated ink lines, not its allocated textbox. Card fills,
 * borders, icons and decorative backgrounds cannot hide a content void. The
 * interior of an evidence image/chart/plot remains one scientific object: its
 * whitespace must not be cropped or its data altered to improve this report.
 */

const list = value => Array.isArray(value) ? value : [];
const finite = value => Number.isFinite(value);
const validBox = value => value && ['x', 'y', 'w', 'h'].every(key => finite(value[key])) && value.w > 0 && value.h > 0;
const rounded = value => Math.round(value * 10000) / 10000;
const roundedBox = box => box ? Object.fromEntries(['x', 'y', 'w', 'h'].map(key => [key, Math.round(box[key] * 10) / 10])) : null;
const ignoredRoles = new Set(['footer', 'identity', 'section-label', 'section-index', 'index', 'logo', 'icon', 'group', 'decoration']);

function intersect(box, area) {
  const x = Math.max(box.x, area.x), y = Math.max(box.y, area.y);
  const right = Math.min(box.x + box.w, area.x + area.w), bottom = Math.min(box.y + box.h, area.y + area.h);
  return right > x && bottom > y ? { x, y, w: right - x, h: bottom - y } : null;
}

function enclosing(boxes) {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map(box => box.x)), y = Math.min(...boxes.map(box => box.y));
  return { x, y, w: Math.max(...boxes.map(box => box.x + box.w)) - x, h: Math.max(...boxes.map(box => box.y + box.h)) - y };
}

function textInk(node) {
  if (!(node.fontSize > 0)) return [];
  const lines = list(node.lines).length ? node.lines : String(node.text || '').split('\n');
  return lines.flatMap((line, index) => {
    if (!String(line).trim()) return [];
    // Exported scenes provide exact renderer estimates. The fallback is only
    // for older external scenes; it still never fills the entire textbox.
    const fallback = [...String(line)].reduce((sum, character) => sum + (/^[\x00-\x7f]$/.test(character) ? .58 : 1), 0) * node.fontSize;
    const width = Math.max(0, node.estimatedLineWidths?.[index] ?? fallback);
    const x = node.align === 'center' ? node.x + (node.w - width) / 2 : node.align === 'right' ? node.x + node.w - width : node.x;
    return width > 0 ? [{ x, y: node.y + index * node.fontSize * (node.lineHeight || 1.28), w: width, h: node.fontSize * 1.04 }] : [];
  });
}

function lineInk(node) {
  if (!['x', 'y', 'w', 'h'].every(key => finite(node[key]))) return [];
  const pad = Math.max(1, Number(node.strokeWidth) || 1) / 2;
  // A diagonal relation is a stroke, not its potentially enormous bounding
  // rectangle. Short segments preserve its path at the diagnostic grid scale.
  const count = node.w && node.h ? Math.max(1, Math.ceil(Math.max(Math.abs(node.w), Math.abs(node.h)) / 8)) : 1;
  return Array.from({ length: count }, (_, index) => {
    const x = node.x + node.w * index / count, y = node.y + node.h * index / count;
    const w = node.w / count, h = node.h / count;
    return { x: Math.min(x, x + w) - pad, y: Math.min(y, y + h) - pad, w: Math.abs(w) + pad * 2, h: Math.abs(h) + pad * 2 };
  });
}

function contentArea(page, slide) {
  if (slide.layout === 'cover') return { x: 48, y: 48, w: (page.width || 1280) - 96, h: (page.height || 720) - 96 };
  if (validBox(page.contentBox)) return page.contentBox;
  // Backward compatibility for scenes made before explicit contentBox export.
  const rule = list(page.nodes).find(node => /\/header-rule$/.test(node.id));
  const y = rule ? rule.y + 16 : 132;
  return { x: 48, y, w: (page.width || 1280) - 96, h: Math.max(1, 645 - y) };
}

function semanticBoxes(project, page, slide, area) {
  const nodes = list(page.nodes), boxes = [], context = [], plotGroups = new Map();
  const assets = new Map(list(project.assets).map(asset => [asset.id, asset]));
  for (const node of nodes) {
    if (node.kind === 'image' && node.role === 'context-visual' && validBox(node)) {
      // A cover photograph/illustration is legitimate cover content, recorded
      // separately and never counted as scientific evidence or body density.
      if (slide.layout === 'cover') context.push(node);
      continue;
    }
    if (node.semantic === false || ignoredRoles.has(node.role) || /\/(?:header-logo|cover-logo)$/.test(node.id || '')) continue;
    if (node.role === 'citation' && slide.layout !== 'references') continue;
    const plotMatch = String(node.id || '').match(/^(.*\/data-plot)\//);
    if (plotMatch) {
      const members = plotGroups.get(plotMatch[1]) || [];
      members.push(...(node.kind === 'text' ? textInk(node) : node.kind === 'line' ? lineInk(node) : validBox(node) ? [node] : []));
      plotGroups.set(plotMatch[1], members);
      continue;
    }
    if (node.kind === 'text') boxes.push(...textInk(node));
    else if (['chart', 'table'].includes(node.kind) && validBox(node)) boxes.push(node);
    else if (node.kind === 'image' && validBox(node) && assets.get(node.assetId)?.usage !== 'decorative') boxes.push(node);
    else if (node.kind === 'line' && (['relationship','data'].includes(node.role) || /\/edge:\d+(?::segment:\d+)?$/.test(node.id || ''))) boxes.push(...lineInk(node));
    else if (['rect','ellipse'].includes(node.kind) && node.role==='data' && validBox(node)) boxes.push(node);
  }
  for (const members of plotGroups.values()) {
    const box = enclosing(members);
    if (validBox(box)) boxes.push(box);
  }
  return { content: boxes.map(box => intersect(box, area)).filter(Boolean), context: context.map(box => intersect(box, area)).filter(Boolean) };
}

/** Linear-time largest empty rectangle on an explicitly reported 8px grid. */
function gridReport(boxes, area) {
  const columns = Math.max(1, Math.ceil(area.w / 8)), rows = Math.max(1, Math.ceil(area.h / 8));
  const dx = area.w / columns, dy = area.h / rows, cells = new Uint8Array(columns * rows);
  for (const box of boxes) {
    // A 4px halo respects normal optical spacing and raster estimate error.
    const left = Math.max(0, Math.floor((box.x - area.x - 4) / dx)), right = Math.min(columns, Math.ceil((box.x + box.w - area.x + 4) / dx));
    const top = Math.max(0, Math.floor((box.y - area.y - 4) / dy)), bottom = Math.min(rows, Math.ceil((box.y + box.h - area.y + 4) / dy));
    for (let row = top; row < bottom; row++) cells.fill(1, row * columns + left, row * columns + right);
  }
  let occupied = 0, best = null;
  const heights = new Uint16Array(columns);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const filled = cells[row * columns + col]; occupied += filled;
      heights[col] = filled ? 0 : heights[col] + 1;
    }
    const stack = [];
    for (let col = 0; col <= columns; col++) {
      const height = col === columns ? 0 : heights[col];
      let start = col;
      while (stack.length && stack.at(-1).height > height) {
        const item = stack.pop(); start = item.start;
        const box = { x: area.x + item.start * dx, y: area.y + (row + 1 - item.height) * dy, w: (col - item.start) * dx, h: item.height * dy };
        // Tiny gutters and interline strips are not actionable content voids.
        if (box.w >= Math.min(80, area.w) && box.h >= Math.min(42, area.h) && (!best || box.w * box.h > best.w * best.h)) best = box;
      }
      if (height > 0 && (!stack.length || stack.at(-1).height < height)) stack.push({ start, height });
    }
  }
  return { occupiedFraction: occupied / cells.length, empty: best, emptyFraction: best ? best.w * best.h / (area.w * area.h) : 0, grid: { columns, rows, cellWidth: rounded(dx), cellHeight: rounded(dy), opticalHalo: 4 } };
}

const percent = value => `${Math.round(value * 100)}%`;
function location(box, area) {
  if (!box) return '正文';
  const x = (box.x + box.w / 2 - area.x) / area.w, y = (box.y + box.h / 2 - area.y) / area.h;
  const vertical = y < .36 ? '上部' : y > .64 ? '下部' : '中部';
  return box.w / area.w >= .7 ? vertical : `${x < .4 ? '左' : x > .6 ? '右' : ''}${vertical}`;
}

export function designGeometryReport(project, scenes) {
  const byId = new Map(list(project.slides).map(slide => [slide.id, slide])), issues = [], slides = [];
  const compact = project.design?.density === 'compact';
  for (const page of list(scenes?.pages)) {
    const slide = byId.get(page.id); if (!slide) continue;
    const area = contentArea(page, slide); if (!validBox(area)) continue;
    const boxes = semanticBoxes(project, page, slide, area), content = gridReport(boxes.content, area);
    const allocation = boxes.context.length ? gridReport([...boxes.content, ...boxes.context], area) : content;
    const cover = slide.layout === 'cover', navigation = slide.layout === 'section', references = slide.layout === 'references';
    const warningLimit = cover ? .28 : navigation ? .34 : references ? .28 : .20;
    // Deliberately simple engineering gates: a continuous unused quarter of
    // the body, or half of a cover. These are review policy, not universal
    // aesthetic laws; rendering and future evidence should refine the policy.
    const severeLimit = cover ? .50 : navigation ? .60 : references ? 1 : .25;
    const severe = allocation.emptyFraction >= severeLimit;
    const report = {
      slideId: page.id, layout: slide.layout, density: project.design?.density || 'balanced',
      basis: 'scene-geometry-estimate-not-aesthetic-score', contentBox: roundedBox(area),
      contentCoverage: rounded(content.occupiedFraction), contextVisualCoverage: rounded(Math.max(0, allocation.occupiedFraction - content.occupiedFraction)),
      largestEmptyContentBox: roundedBox(content.empty), largestEmptyContentFraction: rounded(content.emptyFraction),
      largestUnallocatedBox: roundedBox(allocation.empty), largestUnallocatedFraction: rounded(allocation.emptyFraction),
      grid: allocation.grid, warningThreshold: warningLimit, blockingThreshold: severeLimit,
      status: allocation.emptyFraction >= warningLimit ? severe && compact && !references ? 'needs-layout-fix' : 'needs-review' : 'no-large-void-detected',
    };
    slides.push(report);
    if (allocation.emptyFraction >= warningLimit) {
      const box = report.largestUnallocatedBox;
      const suggestion = references
        ? '检查能否合并参考页或重新分配书目；保留完整题名与可读字号。'
        : cover
          ? '重新安排题名、真实身份及与题材有关的封面视觉；不要用底色或无关图标冒充内容。'
          : '扩大主证据、把解读移到证据旁、重排卡片或合并本页；不要缩字、补写无依据观点、拉大卡框或增加装饰来刷占幅。';
      issues.push({ severity: severe && compact && !references ? 'error' : 'warning', code: severe && compact && !references ? 'large-unused-region' : 'unused-region-review', slideId: page.id, path: `slides.${page.id}`, box, emptyFraction: report.largestUnallocatedFraction, contentCoverage: report.contentCoverage, basis: report.basis,
        message: `${location(box, area)}有约 ${percent(allocation.emptyFraction)} 的连续未使用内容区（${Math.round(box.w)}×${Math.round(box.h)} px）。${suggestion}此值是几何诊断，不能代替真实渲染检查。` });
    }
  }
  return { basis: 'scene-geometry-estimate-not-aesthetic-score', notes: '忽略背景、卡框、图标与正文装饰。文本按估计行范围计算；原图、数据图表和统计图内部留白不作空洞。封面上下文图单独计可视占幅，不作为科学证据。', slides, issues };
}
