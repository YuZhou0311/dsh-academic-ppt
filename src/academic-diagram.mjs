/** Explicit rows encode authored topology; the renderer never invents edges. */
const arr = value => Array.isArray(value) ? value : [];
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
const SIDE = 30, COL_GAP = 40, ROW_GAP = 26;
// Reserve the complete text background, then the bus and its terminal arrow.
const LABEL_TOP = 4, LABEL_GAP = 6, BUS_CLEARANCE = 5, ARROW_STEM = 10;
const overlaps = (a, z) => Math.min(a.x + a.w, z.x + z.w) - Math.max(a.x, z.x) > .1 && Math.min(a.y + a.h, z.y + z.h) - Math.max(a.y, z.y) > .1;
const labelBack = box => ({ x: box.x - 2, y: box.y - 1, w: box.w + 4, h: box.h + 2 });
const validRows = (nodes, rows) => {
  const ids = rows.flat(), known = new Set(nodes.map(node => node.id));
  return rows.length && rows.every(row => Array.isArray(row) && row.length) && new Set(ids).size === ids.length && ids.length === nodes.length && ids.every(id => known.has(id));
};

/** Preserve the legacy node order/column count when no positions were authored. */
export function automaticDiagramRows(nodes) {
 const columns=Math.min(nodes.length,nodes.length===4?2:3);
 return Array.from({length:Math.ceil(nodes.length/Math.max(1,columns))},(_,i)=>nodes.slice(i*columns,(i+1)*columns).map(n=>n.id));
}

/** X extent of a segment inside a horizontal strip, including diagonals. */
function stripExtent(a, z, top, bottom) {
  if (Math.max(a.y, z.y) < top || Math.min(a.y, z.y) > bottom) return null;
  if (Math.abs(z.y - a.y) < 1e-7) return [Math.min(a.x, z.x), Math.max(a.x, z.x)];
  const t = [clamp((top - a.y) / (z.y - a.y), 0, 1), clamp((bottom - a.y) / (z.y - a.y), 0, 1)];
  const xs = t.map(value => a.x + (z.x - a.x) * value);
  return [Math.min(...xs), Math.max(...xs)];
}

function prepare(slide, width, { wrapText, measureTextWidth, system = {}, bodySize, captionSize, projection }) {
  const nodes = arr(slide.nodes), rows = arr(slide.diagram?.rows), edges = arr(slide.edges), rowLabels = arr(slide.diagram?.rowLabels);
  if (!validRows(nodes, rows)) return null;
  const labelMin=projection?.labelMin??0;
  const titleSize = Math.max(bodySize ?? system.bodySize ?? 24,labelMin), detailSize = Math.max(20, titleSize - 2,labelMin), edgeSize = Math.max(18, captionSize ?? system.captionSize ?? 18,labelMin), rowLabelSize=Math.max(22,labelMin);
  const labelW = rowLabels.length ? 126 : 0, left = SIDE + labelW, nodeAreaW = width - SIDE * 2 - labelW;
  const byId = new Map(nodes.map(node => [node.id, node])), positions = new Map();
  const rowInfo = rows.map((row, ri) => {
    const w = (nodeAreaW - COL_GAP * (row.length - 1)) / row.length;
    const heights = row.map((id, ci) => {
      positions.set(id, { x: left + ci * (w + COL_GAP), w, row: ri, col: ci });
      const node = byId.get(id), labelH = wrapText(node.label, Math.max(1, w - 24), titleSize, { bold: true }).length * titleSize * 1.16;
      const detailH = node.detail ? wrapText(node.detail, Math.max(1, w - 24), detailSize).length * detailSize * 1.2 + 6 : 0;
      return 18 + labelH + detailH;
    });
    const rowLabelH = rowLabels[ri] ? wrapText(rowLabels[ri], labelW - 30, rowLabelSize, { bold: true }).length * rowLabelSize * 1.2 + 18 : 0;
    return { w, h: Math.max(52, rowLabelH, ...heights) };
  });
  const band = base => ({ base, labels: [], lanes: 0, laneH: 0, routes: [] });
  const gaps = rows.slice(1).map(() => band(ROW_GAP)), overhead = rows.map(() => band(0));
  const edgeInfo = edges.map((edge, index) => {
    const a = positions.get(edge.from), z = positions.get(edge.to);
    if (!a || !z || edge.from === edge.to) return { edge, index, invalid: true };
    const ac = a.x + a.w / 2, zc = z.x + z.w / 2;
    const sameRow = a.row === z.row, adjacent = Math.abs(a.row - z.row) === 1;
    const above = sameRow && (edge.label || Math.abs(a.col - z.col) !== 1);
    const group = above ? overhead[a.row] : sameRow ? null : gaps[Math.min(a.row, z.row)];
    const info = { edge, index, a, z, ac, zc, sameRow, adjacent, above, group };
    if (above) { info.routeLane = group.routes.length; group.routes.push(index); }
    if (edge.label && group) {
      const w = Math.min(Math.max(measureTextWidth(edge.label, edgeSize) + 14, 42), Math.max(1, Math.min(260, width - 8)));
      const h = wrapText(edge.label, w, edgeSize).length * edgeSize * 1.2;
      const preferred = Math.abs(ac - zc) < 1 ? ac + 8 : (ac + zc - w) / 2;
      info.label = { w, h, preferred }; group.labels.push(info); group.laneH = Math.max(group.laneH, h); group.lanes = 1;
    }
    return info;
  });
  // A shared bus is meaningful only when the authored relations share a node.
  // Independent, overlapping row mappings must retain separate direct segments.
  for (const info of edgeInfo) if (info.adjacent) {
    const upper = info.a.row < info.z.row ? info.a : info.z, lower = upper === info.a ? info.z : info.a;
    const ux = upper.x + upper.w / 2, lx = lower.x + lower.w / 2;
    info.direct = Math.abs(ux - lx) < 1 || edgeInfo.some(other => {
      if (other === info || !other.adjacent || other.group !== info.group) return false;
      const ou = other.a.row < other.z.row ? other.a : other.z, ol = ou === other.a ? other.z : other.a;
      if (ou === upper || ol === lower) return false;
      const ox = ou.x + ou.w / 2, zx = ol.x + ol.w / 2;
      return (ox - ux) * (zx - lx) < 0 || Math.min(Math.max(ux, lx), Math.max(ox, zx)) - Math.max(Math.min(ux, lx), Math.min(ox, zx)) > 1;
    });
  }
  return { nodes, rows, edges, rowLabels, rowInfo, positions, edgeInfo, gaps, overhead, width, labelW, titleSize, detailSize, edgeSize, rowLabelSize };
}

function bandHeight(band) {
  const routeExtra = Math.max(0, band.routes.length - 1) * 6;
  if (!band.labels.length) return Math.max(band.base, band.routes.length ? 16 + routeExtra : 0);
  return Math.max(band.base, LABEL_TOP + band.laneH * band.lanes + LABEL_GAP * (band.lanes - 1) + BUS_CLEARANCE + ARROW_STEM + routeExtra);
}

function geometry(plan, extra = 0) {
  const boxes = new Map(), bands = new Map();
  let y = 4;
  plan.rows.forEach((row, ri) => {
    const above = plan.overhead[ri], aboveH = bandHeight(above);
    bands.set(above, { y, h: aboveH }); y += aboveH;
    for (const id of row) boxes.set(id, { ...plan.positions.get(id), y, h: plan.rowInfo[ri].h + extra });
    y += plan.rowInfo[ri].h + extra;
    if (ri < plan.gaps.length) {
      const gap = plan.gaps[ri], h = bandHeight(gap); bands.set(gap, { y, h }); y += h;
    }
  });
  const routes = plan.edgeInfo.map(info => {
    if (info.invalid) return { ...info, points: [] };
    const { edge, index } = info, a = boxes.get(edge.from), z = boxes.get(edge.to), ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, zc = { x: z.x + z.w / 2, y: z.y + z.h / 2 };
    let points;
    if (info.above) {
      const band = bands.get(info.group), bus = band.y + band.h - ARROW_STEM - info.routeLane * 6;
      points = [{ x: ac.x, y: a.y }, { x: ac.x, y: bus }, { x: zc.x, y: bus }, { x: zc.x, y: z.y }];
    } else if (info.sameRow) {
      points = z.col > a.col ? [{ x: a.x + a.w, y: ac.y }, { x: z.x, y: zc.y }] : [{ x: a.x, y: ac.y }, { x: z.x + z.w, y: zc.y }];
    } else if (info.adjacent) {
      const down = z.row > a.row, start = { x: ac.x, y: down ? a.y + a.h : a.y }, end = { x: zc.x, y: down ? z.y : z.y + z.h };
      const band = bands.get(info.group), bus = info.group.labels.length ? band.y + band.h - ARROW_STEM : band.y + band.h / 2;
      points = info.direct ? [start, end] : [start, { x: start.x, y: bus }, { x: end.x, y: bus }, end];
    } else {
      const right = z.row > a.row, channel = right ? plan.width - 10 - (index % 3) * 6 : plan.labelW + 10 + (index % 3) * 6;
      const start = { x: right ? a.x + a.w : a.x, y: ac.y }, end = { x: right ? z.x + z.w : z.x, y: zc.y };
      points = [start, { x: channel, y: start.y }, { x: channel, y: end.y }, end];
    }
    return { ...info, points };
  });
  return { boxes, bands, routes, requiredHeight: y + 4 };
}

function freeRanges(blocks, width) {
  const free = [], ranges = blocks.map(([lo, hi]) => [clamp(lo, 0, width), clamp(hi, 0, width)]).sort((a, z) => a[0] - z[0]);
  let left = 0;
  for (const [lo, hi] of [...ranges, [width, width]]) {
    if (lo > left) free.push([left, lo]);
    left = Math.max(left, hi);
  }
  return free;
}

/** Place complete backgrounds in free strips, without painting over a line.
 * Extra lanes are measured before composition allocates its panel heights. */
function placeLabels(plan, drawing) {
  const labels = new Map(), failed = new Set(), reflow = new Map();
  const segments = drawing.routes.flatMap(route => route.points.slice(0, -1).map((a, i) => ({ a, z: route.points[i + 1] })));
  for (const band of [...plan.gaps, ...plan.overhead]) {
    const region = drawing.bands.get(band), occupied = [];
    for (const info of band.labels.slice().sort((a, z) => z.label.w - a.label.w || a.index - z.index)) {
      const { w, h, preferred } = info.label, candidates = [];
      let availableW = 0;
      for (let lane = 0; lane < band.lanes; lane++) {
        const y = region.y + LABEL_TOP + lane * (band.laneH + LABEL_GAP), backY = y - 1;
        const blocks = segments.flatMap(({ a, z }) => {
          const extent = stripExtent(a, z, backY - 3, backY + h + 2 + 3);
          return extent ? [[extent[0] - 4, extent[1] + 4]] : [];
        });
        // A narrow column may have room beside a stem only after wrapping.
        // Other labels require another lane, not unnecessary extra wrapping.
        for (const [lo, hi] of freeRanges(blocks, plan.width)) availableW = Math.max(availableW, hi - lo - 4);
        for (const box of occupied) if (box.y - 3 < backY + h + 2 && box.y + box.h + 3 > backY) blocks.push([box.x - 4, box.x + box.w + 4]);
        for (const [lo, hi] of freeRanges(blocks, plan.width)) {
          if (hi - lo >= w + 4 - 1e-7) {
            const x = clamp(preferred - 2, lo, hi - w - 4) + 2;
            candidates.push({ x, y, w, h, cost: Math.abs(x - preferred) + lane });
          }
        }
      }
      const best = candidates.sort((a, z) => a.cost - z.cost)[0];
      if (best) { const { cost, ...box } = best; labels.set(info.index, box); occupied.push(labelBack(box)); }
      else {
        failed.add(band);
        if (availableW < w - .1 && availableW >= Math.max(42, plan.edgeSize * 2)) reflow.set(info, availableW);
        // Preserve the authored label for inspection even when layout is blocked.
        labels.set(info.index, { x: clamp(preferred, 2, plan.width - w - 2), y: region.y + LABEL_TOP, w, h, failed: true });
      }
    }
  }
  return { labels, failed, reflow };
}

function measurePlan(slide, width, helpers) {
  const plan = prepare(slide, width, helpers);
  if (!plan) return null;
  let drawing, placement;
  const attempts = Math.max(8, plan.edges.length + 2);
  for (let attempt = 0; attempt < attempts; attempt++) {
    drawing = geometry(plan); placement = placeLabels(plan, drawing);
    if (!placement.failed.size || attempt === attempts - 1) break;
    const reflowed = new Set();
    for (const [info, w] of placement.reflow) {
      const h = helpers.wrapText(info.edge.label, w, plan.edgeSize).length * plan.edgeSize * 1.2;
      info.label = { w, h, preferred: Math.abs(info.ac - info.zc) < 1 ? info.ac + 8 : (info.ac + info.zc - w) / 2 };
      info.group.laneH = Math.max(...info.group.labels.map(item => item.label.h)); reflowed.add(info.group);
    }
    for (const band of placement.failed) if (!reflowed.has(band)) band.lanes++;
  }
  return { plan, drawing, placement };
}

/** Shared by composition and drawing: exact pixel geometry for authored rows.
 * Typography still uses the common conservative wrapText measurement. */
export function measureAcademicDiagramMinimum(slide, width, helpers) {
  const result = measurePlan(slide, width, helpers);
  return { minimumHeight: result?.drawing.requiredHeight ?? 96 };
}

export function renderAcademicDiagram(b, project, slide, area, { wrapText, measureTextWidth, semanticStyle }) {
  const fail = (code, message, more = {}) => b.page.issues.push({ severity: 'error', code, slideId: b.page.id, message, ...more });
  const nodes = arr(slide.nodes), rows = arr(slide.diagram?.rows);
  if (!validRows(nodes, rows)) { fail('diagram-row-membership', 'diagram.rows 需将所有节点恰好列出一次；行只定义阶段或层级，连线仍由 edges 明确提供。'); return; }
  if (nodes.some(node => node.box)) { fail('diagram-layout-conflict', 'diagram.rows 与 node.box 不能混用；按节点行规划关系时由工具统一分配几何。'); return; }
  const result = measurePlan(slide, area.w, { wrapText, measureTextWidth, system: b.system, projection: b.design?.projection }), { plan } = result, need = result.drawing.requiredHeight;
  if (plan.rowLabels.length && plan.rowLabels.length !== rows.length) fail('diagram-row-label-count', 'diagram.rowLabels 必须与 rows 一一对应。');
  if (plan.rowInfo.some(row => row.w <= 24)) fail('diagram-node-width', '图区不足以容纳当前节点列与完整文字；扩大图区或减少每行节点。');
  if (need > area.h + 2) fail('diagram-content-overflow', `节点内容与完整连线标签需 ${Math.ceil(need)}px，当前图区 ${Math.floor(area.h)}px；扩大机制图或拆解两级机制，不能缩小字体。`, { requiredHeight: need, availableHeight: area.h });
  const drawing = geometry(plan, Math.max(0, Math.min(22, (area.h - need) / rows.length))), placement = placeLabels(plan, drawing);
  const boxAt = box => ({ ...box, x: box.x + area.x, y: box.y + area.y }), pointAt = point => ({ x: point.x + area.x, y: point.y + area.y });
  const boxes = new Map([...drawing.boxes].map(([id, box]) => [id, boxAt(box)]));
  rows.forEach((row, ri) => {
    if (!plan.rowLabels[ri]) return;
    const { y, h } = boxes.get(row[0]);
    b.rect(`diagram-row:${ri}:fill`, { x: area.x, y, w: plan.labelW - 10, h }, b.p.tint, 'none');
    b.text(`diagram-row:${ri}:label`, plan.rowLabels[ri], { x: area.x + 10, y: y + 9, w: plan.labelW - 30, h: h - 16 }, plan.rowLabelSize, { color: b.p.accent, bold: true, align: 'center', lineHeight: 1.2, role: 'diagram-group' });
  });
  const paintedLabels = [];
  for (const route of drawing.routes) {
    const { edge, index: i } = route;
    if (route.invalid) { fail('invalid-edge', '连线端点必须是两个存在的节点。', { edge }); continue; }
    const points = route.points.map(pointAt), color = edge.kind === 'feedback' ? b.p.secondary : b.p.accent;
    for (let k = 0; k < points.length - 1; k++) {
      const a = points[k], z = points[k + 1];
      b.line(points.length === 2 ? `edge:${i}` : `edge:${i}:segment:${k}`, a.x, a.y, z.x, z.y, color, { strokeWidth: 2.2, ...(edge.kind === 'feedback' ? { dash: 'dash' } : {}), ...(k === points.length - 2 && edge.kind !== 'association' ? { endArrow: true } : {}) });
      for (const [id, box] of boxes) if (id !== edge.from && id !== edge.to) {
        const extent = stripExtent(a, z, box.y + 2, box.y + box.h - 2);
        if (extent && extent[1] > box.x + 2 && extent[0] < box.x + box.w - 2) fail('diagram-edge-crosses-node', '连线穿过不相关节点；重排节点行或拆解关系，不能用背景遮掉连接。', { edge, relatedNodeId: id });
      }
    }
    if (edge.label) {
      const label = boxAt(placement.labels.get(i)), background = labelBack(label);
      if (label.failed) fail('diagram-label-placement', '当前图区没有足够的连线旁空白容纳完整标签；扩大图区或拆解关系，不能遮住节点或连接线。', { edge, edgeIndex: i });
      for (const [id, box] of boxes) if (overlaps(background, box)) fail('diagram-label-overlaps-node', '完整连线标签与节点相交；此图不能通过几何审查。', { edge, edgeIndex: i, relatedNodeId: id });
      for (const other of paintedLabels) if (overlaps(background, other.box)) fail('diagram-label-overlap', '两条连线标签相交；扩大图区或拆解关系。', { edgeIndex: i, relatedEdgeIndex: other.index });
      if (background.x < area.x - .1 || background.x + background.w > area.x + area.w + .1 || background.y < area.y - .1 || background.y + background.h > area.y + area.h + .1) fail('diagram-label-out-of-bounds', '完整连线标签超出图区；需增加图区尺寸。', { edgeIndex: i });
      paintedLabels.push({ index: i, box: background });
      b.rect(`edge:${i}:label-back`, background, b.p.paper, 'none');
      b.text(`edge:${i}:label`, edge.label, label, plan.edgeSize, { align: 'center', color, lineHeight: 1.2, role: 'diagram-edge-label' });
    }
  }
  // Keep nodes last: correctness comes from whitespace geometry, not z-order.
  nodes.forEach(node => {
    const box = boxes.get(node.id), semantic = semanticStyle(node.kind || 'method', b.p), labelH = wrapText(node.label, box.w - 24, plan.titleSize, { bold: true }).length * plan.titleSize * 1.16;
    b.region(`node:${node.id}`, box, 'diagram-node');
    b.rect(`node:${node.id}:frame`, box, b.p.tint, b.p.line, { strokeWidth: 1.1, ...(node.kind === 'hypothesis' ? { dash: 'dash' } : {}) });
    b.rect(`node:${node.id}:label-band`, { x: box.x, y: box.y, w: box.w, h: labelH + 14 }, semantic.accent, 'none');
    b.text(`node:${node.id}:label`, node.label, { x: box.x + 12, y: box.y + 7, w: box.w - 24, h: labelH }, plan.titleSize, { bold: true, color: '#FFFFFF', align: 'center', lineHeight: 1.16, role: 'diagram-label' });
    if (node.detail) b.text(`node:${node.id}:detail`, node.detail, { x: box.x + 12, y: box.y + labelH + 20, w: box.w - 24, h: Math.max(1, box.h - labelH - 25) }, plan.detailSize, { color: b.p.ink, align: 'center', lineHeight: 1.2, role: 'diagram-body' });
  });
  return { boxes, requiredHeight: need };
}
