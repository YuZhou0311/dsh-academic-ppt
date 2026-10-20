import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { XMLValidator } from 'fast-xml-parser';
import { buildScenes, measureTextWidth, wrapText } from '../src/scene.mjs';
import { measureAcademicDiagramMinimum, renderAcademicDiagram } from '../src/academic-diagram.mjs';
import { renderProject } from '../src/render.mjs';
import { assertProject } from '../src/schema.mjs';
import { DEFAULT_DESIGN } from '../src/core.mjs';
import { brief, paper, claim } from './fixtures.mjs';

// Authored topology only; a software fixture does not establish causality.
const copy = value => structuredClone(value);
const diagramSlide = changes => ({ id: 's', layout: 'method', title: '机制关系核验', paperIds: ['P1'], claimIds: ['C1'], notes: '合成拓扑回归。', seconds: 60, figureIds: [], cards: [], ...changes });
const project = slide => ({ schemaVersion: 1, id: 'diagram-fixture', revision: 0, title: '原生机制图回归', brief: copy(brief), capabilities: { imageInput: 'unknown', source: 'synthetic fixture' }, design: copy(DEFAULT_DESIGN), papers: [copy(paper)], claims: [copy(claim)], assets: [], slides: [slide] });
const render = p => { assertProject(p); return buildScenes(p).pages[0]; };
const errors = page => page.issues.filter(issue => issue.severity === 'error');
const frame = (page, id) => page.nodes.find(node => node.id === `s/node:${id}:frame`);
const segments = (page, index) => page.nodes.filter(node => node.kind === 'line' && (node.id === `s/edge:${index}` || node.id.startsWith(`s/edge:${index}:segment:`)));
const start = line => ({ x: line.x, y: line.y });
const end = line => ({ x: line.x + line.w, y: line.y + line.h });
const cross = (a, b) => a.x * b.y - a.y * b.x;
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
function sharesSegment(a, z) {
  const av = { x: a.w, y: a.h }, zv = { x: z.w, y: z.h };
  if (Math.abs(cross(av, zv)) > 1e-5 || Math.abs(cross(av, subtract(start(z), start(a)))) > 1e-5) return false;
  const axis = Math.abs(a.w) >= Math.abs(a.h) ? 'x' : 'y';
  const [a0, a1] = [start(a)[axis], end(a)[axis]].sort((x, y) => x - y);
  const [z0, z1] = [start(z)[axis], end(z)[axis]].sort((x, y) => x - y);
  return Math.min(a1, z1) - Math.max(a0, z0) > 2;
}

test('independent crossed row mappings do not become an invented shared bus and remain native arrows', async () => {
  const p = project(diagramSlide({ nodes: ['a', 'b', 'c', 'd'].map(id => ({ id, label: id.toUpperCase() })), diagram: { rows: [['a', 'b'], ['c', 'd']] }, edges: [{ from: 'a', to: 'd' }, { from: 'b', to: 'c' }] }));
  const before = copy(p); assertProject(p);
  const out = await renderProject(p), page = out.scenes.pages[0];
  assert.deepEqual(p, before); assert.deepEqual(errors(page), []);
  const a = segments(page, 0), z = segments(page, 1);
  assert.ok(a.length && z.length);
  assert.equal(a.some(first => z.some(second => sharesSegment(first, second))), false, 'independent mappings cannot share a painted line segment');
  for (const [index, edge] of p.slides[0].edges.entries()) {
    const route = segments(page, index), source = frame(page, edge.from), target = frame(page, edge.to);
    assert.deepEqual(start(route[0]), { x: source.x + source.w / 2, y: source.y + source.h });
    assert.deepEqual(end(route.at(-1)), { x: target.x + target.w / 2, y: target.y });
    assert.equal(route.filter(line => line.endArrow).length, 1);
  }
  const xml = strFromU8(unzipSync(out.pptx)['ppt/slides/slide1.xml']);
  for (const index of [0, 1]) {
    const names = segments(page, index).map(line => line.id);
    for (const id of names) assert.ok(xml.includes(`name="${id}"`));
  }
  assert.equal((xml.match(/type="triangle"/g) || []).length, 2);
  assert.equal(XMLValidator.validate(out.svgPages[0].svg), true);
});

test('an authored split and join retain exactly the four supplied edges and all branch labels', () => {
  const edges = [{ from: 'input', to: 'left' }, { from: 'input', to: 'right' }, { from: 'left', to: 'output' }, { from: 'right', to: 'output' }];
  const p = project(diagramSlide({ nodes: [{ id: 'input', label: '原始输入' }, { id: 'left', label: '独立条件甲' }, { id: 'right', label: '独立条件乙' }, { id: 'output', label: '共同核验' }], diagram: { rows: [['input'], ['left', 'right'], ['output']], rowLabels: ['输入', '分支', '核验'] }, edges }));
  const before = copy(p), page = render(p);
  assert.deepEqual(errors(page), []); assert.deepEqual(p, before);
  assert.deepEqual([...new Set(page.nodes.flatMap(node => /^s\/edge:(\d+)/.exec(node.id)?.slice(1) || []))].sort(), ['0', '1', '2', '3']);
  assert.equal(page.nodes.filter(node => node.kind === 'line' && node.endArrow).length, edges.length);
  for (const source of p.slides[0].nodes) assert.ok(page.nodes.some(node => node.text === source.label));
  for (const source of p.slides[0].diagram.rowLabels) assert.ok(page.nodes.some(node => node.text === source));
  assert.ok(frame(page, 'input').y < frame(page, 'left').y);
  assert.equal(frame(page, 'left').y, frame(page, 'right').y);
  assert.ok(frame(page, 'right').y < frame(page, 'output').y);
});

test('same-order independent mappings with overlapping horizontal spans remain distinct', () => {
  const p = project(diagramSlide({ nodes: ['a','b','c','d','e','f','g','h'].map(id => ({ id, label: id.toUpperCase() })), diagram: { rows: [['a','b','c','d'],['e','f','g','h']] }, edges: [{ from: 'a', to: 'g' }, { from: 'b', to: 'h' }] }));
  const page = render(p);
  assert.deepEqual(errors(page), []);
  const a = segments(page, 0), b = segments(page, 1);
  assert.equal(a.some(first => b.some(second => sharesSegment(first, second))), false);
  assert.equal(a.filter(line => line.endArrow).length, 1);
  assert.equal(b.filter(line => line.endArrow).length, 1);
});

test('association and feedback keep their declared meaning with and without row layout', () => {
  for (const rows of [false, true]) for (const kind of ['association', 'feedback', 'flow']) {
    const p = project(diagramSlide({ nodes: [{ id: 'a', label: '观察甲' }, { id: 'b', label: '观察乙' }], edges: [{ from: 'a', to: 'b', kind }], ...(rows ? { diagram: { rows: [['a', 'b']] } } : {}) }));
    const page = render(p), route = segments(page, 0);
    assert.deepEqual(errors(page), []); assert.ok(route.length);
    assert.equal(route.some(line => line.endArrow), kind !== 'association');
    assert.equal(route.every(line => Boolean(line.dash)), kind === 'feedback');
    assert.ok(route.every(line => line.stroke === (kind === 'feedback' ? p.design.palette.secondary : p.design.palette.accent)));
  }
});

test('explicit node and edge typography and full detail strings survive row layout', () => {
  const p = project(diagramSlide({ nodes: [{ id: 'a', label: '输入观测', detail: '保留独立实验单位。' }, { id: 'b', label: '机制核验', detail: '保留验证条件与边界。' }], diagram: { rows: [['a'], ['b']] }, edges: [{ from: 'a', to: 'b', label: '已定义关系' }] }));
  Object.assign(p.design.system, { bodySize: 28, captionSize: 22 });
  const page = render(p);
  assert.deepEqual(errors(page), []);
  for (const source of p.slides[0].nodes) {
    assert.equal(page.nodes.find(node => node.id === `s/node:${source.id}:label`).fontSize, 28);
    assert.equal(page.nodes.find(node => node.id === `s/node:${source.id}:detail`).text, source.detail);
  }
  const label = page.nodes.find(node => node.id === 's/edge:0:label');
  assert.equal(label.text, '已定义关系'); assert.equal(label.fontSize, 22);
});

test('row membership, label count and authored box conflicts are blocking rather than silently rearranged', () => {
  const base = diagramSlide({ nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }], diagram: { rows: [['a'], ['b']] } });
  for (const rows of [[['a'], ['a']], [['a']], [['a'], ['missing']]]) {
    const p = project({ ...copy(base), diagram: { rows } });
    assert.ok(render(p).issues.some(issue => issue.code === 'diagram-row-membership'));
  }
  const labels = project(copy(base)); labels.slides[0].diagram.rowLabels = ['只有一行标签'];
  assert.ok(render(labels).issues.some(issue => issue.code === 'diagram-row-label-count'));
  const manual = project(copy(base)); manual.slides[0].nodes[0].box = { x: 100, y: 200, w: 200, h: 100 };
  assert.ok(render(manual).issues.some(issue => issue.code === 'diagram-layout-conflict'));
});

test('routes through unrelated nodes and self loops cannot pass as valid mechanism relationships', () => {
  const p = project(diagramSlide({ nodes: ['a', 'b', 'c', 'd'].map(id => ({ id, label: id })), diagram: { rows: [['a', 'b'], ['c'], ['d']] }, edges: [{ from: 'a', to: 'd' }] }));
  assert.ok(render(p).issues.some(issue => issue.code === 'diagram-edge-crosses-node' && issue.relatedNodeId === 'b'));
  const self = copy(p); self.slides[0].edges = [{ from: 'a', to: 'a' }];
  assert.ok(render(self).issues.some(issue => issue.code === 'invalid-edge'));
});

test('dense mechanisms report overflow while preserving every authored node detail and font size', () => {
  const nodes = Array.from({ length: 8 }, (_, index) => ({ id: `n${index}`, label: `阶段${index}`, detail: '完整机制依赖独立输入、实验条件与适用边界。'.repeat(8) }));
  const p = project(diagramSlide({ nodes, edges: [], diagram: { rows: [['n0', 'n1'], ['n2', 'n3'], ['n4', 'n5'], ['n6', 'n7']] } }));
  p.design.system.bodySize = 28;
  const before = copy(p), page = render(p);
  assert.ok(page.issues.some(issue => issue.code === 'diagram-content-overflow'));
  assert.deepEqual(p, before);
  for (const source of nodes) {
    assert.equal(page.nodes.find(node => node.id === `s/node:${source.id}:label`).fontSize, 28);
    assert.equal(page.nodes.find(node => node.id === `s/node:${source.id}:detail`).text, source.detail);
  }
});

const intersects = (a, z) => Math.min(a.x + a.w, z.x + z.w) > Math.max(a.x, z.x) + 1e-6 && Math.min(a.y + a.h, z.y + z.h) > Math.max(a.y, z.y) + 1e-6;
function segmentIntersectsBox(line, box) {
  let enter = 0, leave = 1;
  for (const [axis, size] of [['x', 'w'], ['y', 'h']]) {
    const delta = line[size], origin = line[axis], low = box[axis], high = low + box[size];
    if (Math.abs(delta) < 1e-9) { if (origin < low || origin > high) return false; continue; }
    const t = [(low - origin) / delta, (high - origin) / delta].sort((a, z) => a - z);
    enter = Math.max(enter, t[0]); leave = Math.min(leave, t[1]);
    if (enter > leave) return false;
  }
  return true;
}

function measuredDiagram(slide, { width = 736, height, system = { bodySize: 24, captionSize: 18.67 }, x = 17, y = 31 } = {}) {
  const before = copy(slide), p = project(slide), page = { id: 's', nodes: [], issues: [] };
  const measurement = measureAcademicDiagramMinimum(slide, width, { wrapText, measureTextWidth, system });
  const area = { x, y, w: width, h: height ?? measurement.minimumHeight };
  const add = (kind, id, data) => page.nodes.push({ ...data, kind, id: `s/${id}` });
  const b = { page, p: p.design.palette, system, region() {},
    rect(id, box, fill, stroke, extra = {}) { add('rect', id, { ...box, fill, stroke, ...extra }); },
    line(id, x, y, x2, y2, stroke, extra = {}) { add('line', id, { x, y, w: x2 - x, h: y2 - y, stroke, ...extra }); },
    text(id, text, box, fontSize, extra = {}) { add('text', id, { ...box, text, fontSize, lines: wrapText(text, box.w, fontSize, { bold: extra.bold }), ...extra }); },
  };
  const result = renderAcademicDiagram(b, p, slide, area, { wrapText, measureTextWidth, semanticStyle: () => ({ accent: p.design.palette.accent }) });
  assert.deepEqual(slide, before);
  assert.equal(result.requiredHeight, measurement.minimumHeight, 'allocation and actual row rendering must use the same minimum');
  return { page, area, result, measurement };
}

function assertCompleteLabels({ page, area }, edges, expectedSize) {
  const frames = page.nodes.filter(node => /\/node:.*:frame$/.test(node.id));
  const backs = page.nodes.filter(node => /\/edge:\d+:label-back$/.test(node.id));
  const lines = page.nodes.filter(node => node.kind === 'line');
  assert.equal(backs.length, edges.filter(edge => edge.label).length);
  for (const [index, edge] of edges.entries()) if (edge.label) {
    const label = page.nodes.find(node => node.id === `s/edge:${index}:label`);
    assert.equal(label.text, edge.label); assert.equal(label.fontSize, expectedSize);
    assert.equal(label.h, label.lines.length * expectedSize * 1.2);
  }
  for (const back of backs) {
    assert.ok(back.x >= area.x - 1e-6 && back.x + back.w <= area.x + area.w + 1e-6);
    assert.ok(back.y >= area.y - 1e-6 && back.y + back.h <= area.y + area.h + 1e-6);
    for (const node of frames) assert.equal(intersects(back, node), false, `${back.id} overlaps ${node.id}`);
    for (const other of backs) if (back !== other) assert.equal(intersects(back, other), false, `${back.id} overlaps ${other.id}`);
    for (const line of lines) assert.equal(segmentIntersectsBox(line, back), false, `${back.id} would hide ${line.id}`);
    assert.ok(page.nodes.indexOf(back) < page.nodes.indexOf(frames[0]), 'the fix must remain correct with node backgrounds painted after labels');
  }
}

test('fractional-size adjacent-row labels clear complete detail panels while unlabelled gaps stay compact', () => {
  const slide = diagramSlide({ nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map(id => ({ id, label: `节点${id}`, ...(id !== 'f' ? { detail: '完整条件说明' } : {}) })), diagram: { rows: [['a', 'b', 'c'], ['d', 'e'], ['f']] }, edges: [{ from: 'a', to: 'd', label: '条件甲' }, { from: 'b', to: 'd', label: '条件乙乙' }, { from: 'c', to: 'e', label: '条件丙' }, { from: 'd', to: 'e' }, { from: 'e', to: 'f' }] });
  const result = measuredDiagram(slide, { width: 734.62, height: 288.48 });
  assert.deepEqual(errors(result.page), []); assertCompleteLabels(result, slide.edges, 18.67);
  const top = frame(result.page, 'a'), middle = frame(result.page, 'd'), last = frame(result.page, 'f');
  assert.ok(middle.y - top.y - top.h >= 18.67 * 1.2 + 18, 'measured label and arrow clearance cannot fall back to the old 36 px gap');
  assert.ok(Math.abs(last.y - middle.y - middle.h - 26) < 1e-6, 'a label on another boundary must not inflate this unlabelled gap');
  assert.equal(segments(result.page, 3).length, 1); assert.equal(segments(result.page, 3)[0].w, 40);
});

test('multiline labels beside a vertical stem wrap at the declared font and are included in minimum height', () => {
  const slide = diagramSlide({ nodes: [{ id: 'a', label: '输入' }, { id: 'b', label: '输出' }], diagram: { rows: [['a'], ['b']] }, edges: [{ from: 'a', to: 'b', label: '这段较长的连接条件必须完整保留\n包括第二行限制' }] });
  const system = { bodySize: 28, captionSize: 22 }, result = measuredDiagram(slide, { width: 300, system });
  assert.deepEqual(errors(result.page), []); assertCompleteLabels(result, slide.edges, 22);
  assert.ok(result.page.nodes.find(node => node.id === 's/edge:0:label').lines.length > 2);
  const short = measuredDiagram(slide, { width: 300, system, height: result.measurement.minimumHeight - 20 });
  assert.ok(errors(short.page).some(issue => issue.code === 'diagram-content-overflow' && issue.requiredHeight === result.measurement.minimumHeight));
  assert.equal(short.page.nodes.find(node => node.id === 's/edge:0:label').text, slide.edges[0].label);
});

test('same-row labels receive complete overhead space while ordinary neighboring edges remain direct', () => {
  const slide = diagramSlide({ nodes: ['a', 'b', 'c'].map(id => ({ id, label: id.toUpperCase(), detail: '保留完整节点正文' })), diagram: { rows: [['a', 'b', 'c']] }, edges: [{ from: 'a', to: 'b', label: '同行的完整标签不能覆盖节点' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a', label: '反馈标签完整保留', kind: 'feedback' }] });
  const result = measuredDiagram(slide, { width: 600, system: { bodySize: 24, captionSize: 22 } });
  assert.deepEqual(errors(result.page), []); assertCompleteLabels(result, slide.edges, 22);
  assert.equal(segments(result.page, 1).length, 1); assert.equal(segments(result.page, 1)[0].w, 40);
  for (const index of [0, 2]) {
    const label = result.page.nodes.find(node => node.id === `s/edge:${index}:label-back`), source = frame(result.page, slide.edges[index].from);
    assert.ok(label.y + label.h < source.y);
    assert.equal(segments(result.page, index).filter(line => line.endArrow).length, 1);
  }
  assert.ok(segments(result.page, 2).every(line => line.dash === 'dash'));
});

test('labelled split and merge paths reserve multiple lanes without covering nodes, labels or connecting strokes', () => {
  const branches = ['b', 'c', 'd'];
  const slide = diagramSlide({ nodes: ['a', ...branches, 'e'].map(id => ({ id, label: id.toUpperCase() })), diagram: { rows: [['a'], branches, ['e']] }, edges: [...branches.map((id, i) => ({ from: 'a', to: id, label: `拆分关系${i}需要验证条件` })), ...branches.map((id, i) => ({ from: id, to: 'e', label: `汇合关系${i}需要验证条件` }))] });
  const result = measuredDiagram(slide, { width: 600, system: { bodySize: 24, captionSize: 22 } });
  assert.deepEqual(errors(result.page), []); assertCompleteLabels(result, slide.edges, 22);
  assert.ok(new Set(result.page.nodes.filter(node => node.role === 'diagram-edge-label').map(node => node.y)).size > 2, 'dense labels need more than one lane on a boundary');
  assert.equal(result.page.nodes.filter(node => node.kind === 'line' && node.endArrow).length, slide.edges.length);
  for (const [index, edge] of slide.edges.entries()) {
    const route = segments(result.page, index), source = frame(result.page, edge.from), target = frame(result.page, edge.to);
    assert.deepEqual(start(route[0]), { x: source.x + source.w / 2, y: source.y + source.h });
    assert.deepEqual(end(route.at(-1)), { x: target.x + target.w / 2, y: target.y });
  }
});

test('labelled independent crossings keep distinct authored paths and labels clear of diagonal strokes', () => {
  const slide = diagramSlide({ nodes: ['a', 'b', 'c', 'd'].map(id => ({ id, label: id.toUpperCase() })), diagram: { rows: [['a', 'b'], ['c', 'd']] }, edges: [{ from: 'a', to: 'd', label: '独立交叉关系甲必须完整保留' }, { from: 'b', to: 'c', label: '独立交叉关系乙必须完整保留' }] });
  const result = measuredDiagram(slide, { width: 600, system: { bodySize: 24, captionSize: 22 } });
  assert.deepEqual(errors(result.page), []); assertCompleteLabels(result, slide.edges, 22);
  assert.equal(segments(result.page, 0).length, 1); assert.equal(segments(result.page, 1).length, 1);
  assert.equal(sharesSegment(segments(result.page, 0)[0], segments(result.page, 1)[0]), false);
});

test('a diagram without a usable label corridor fails explicitly and retains the authored wording and font', () => {
  const slide = diagramSlide({ nodes: [{ id: 'a', label: 'i' }, { id: 'b', label: 'j' }], diagram: { rows: [['a'], ['b']] }, edges: [{ from: 'a', to: 'b', label: '完整限定条件不能隐藏' }] });
  const result = measuredDiagram(slide, { width: 100, system: { bodySize: 24, captionSize: 22 } });
  assert.ok(errors(result.page).some(issue => issue.code === 'diagram-label-placement' && issue.edgeIndex === 0));
  const label = result.page.nodes.find(node => node.id === 's/edge:0:label');
  assert.equal(label.text, slide.edges[0].label); assert.equal(label.fontSize, 22);
  assert.equal(result.page.nodes.filter(node => node.id === 's/edge:0:label').length, 1);
});
