import test from 'node:test';
import assert from 'node:assert/strict';
import { compareProjectStructures } from '../src/portfolio.mjs';

// Synthetic compositions isolate fuzzy geometry matching from scientific content.
function slide(id, share, carrier = 'chart', repetitionReason) {
  return {
    id, title: `Synthetic ${id}`, layout: 'academic',
    chart: { kind: 'column' }, cards: [{ id: 'note', body: 'Synthetic explanation.' }],
    composition: { rows: [{ panels: [
      { id: 'evidence', weight: share, [carrier]: true },
      { id: 'explanation', weight: 1 - share, cardIds: ['note'] },
    ] }] },
    ...(repetitionReason ? { visualPlan: { repetitionReason } } : {}),
  };
}
const project = (id, slides) => ({ id, title: id, revision: 0, slides });
const compare = (left, right) => compareProjectStructures([
  { project: left, path: left.id }, { project: right, path: right.id },
]);
function overlappingCandidates() {
  return [
    project('left', [slide('a1', .50, 'chart', 'Left supplied comparison reason.'), slide('a2', .56), slide('a3', .50, 'table')]),
    project('right', [slide('b1', .55, 'chart', 'Right supplied comparison reason.'), slide('b2', .45), slide('b3', .50, 'table')]),
  ];
}

test('portfolio reassigns an earlier ambiguous pair to retain every one-to-one match', () => {
  const [a, b] = overlappingCandidates(), report = compare(a, b), result = report.comparisons[0];
  assert.equal(result.matchingBodyPages, 3);
  assert.equal(result.matchingBodyFraction, 1);
  assert.equal(result.status, 'needs-visual-comparison');
  assert.ok(report.issues.some(i => i.code === 'cross-deck-structure-reuse'));
  assert.deepEqual(result.pairs.map(p => [p.leftSlideId, p.rightSlideId]), [['a1', 'b2'], ['a2', 'b1'], ['a3', 'b3']]);
});

test('reordering pages or projects cannot change matching counts or review status', () => {
  const [a, b] = overlappingCandidates();
  const orders = [[0, 1, 2], [1, 0, 2], [2, 1, 0], [1, 2, 0]];
  for (const leftOrder of orders) for (const rightOrder of orders) {
    const left = { ...a, slides: leftOrder.map(i => a.slides[i]) };
    const right = { ...b, slides: rightOrder.map(i => b.slides[i]) };
    for (const [first, second] of [[left, right], [right, left]]) {
      const result = compare(first, second).comparisons[0];
      assert.equal(result.matchingBodyPages, 3);
      assert.equal(result.smallerBodyPageCount, 3);
      assert.equal(result.matchingBodyFraction, 1);
      assert.equal(result.status, 'needs-visual-comparison');
    }
  }
});

test('a page is never reused to inflate matches and incompatible carriers stay unmatched', () => {
  const a = project('a', [slide('a1', .5), slide('a2', .5), slide('a3', .5), slide('a4', .5, 'table')]);
  const b = project('b', [slide('b1', .5), slide('b2', .5, 'table'), slide('b3', .5, 'plot')]);
  for (const [left, right] of [[a, b], [b, a]]) {
    const result = compare(left, right).comparisons[0];
    assert.equal(result.matchingBodyPages, 2);
    assert.equal(new Set(result.pairs.map(p => p.leftSlideId)).size, 2);
    assert.equal(new Set(result.pairs.map(p => p.rightSlideId)).size, 2);
    assert.equal(result.matchingBodyFraction, .6667);
    assert.equal(result.status, 'no-high-similarity-detected');
    assert.ok(!result.pairs.some(p => p.leftSlideId === 'b3' || p.rightSlideId === 'b3'));
  }
});

test('rematched pairs retain actual slide titles and the selected authors comparison reasons', () => {
  const [a, b] = overlappingCandidates(), result = compare(a, b).comparisons[0];
  assert.deepEqual(result.pairs, [
    { leftSlideId: 'a1', rightSlideId: 'b2', leftTitle: 'Synthetic a1', rightTitle: 'Synthetic b2', comparisonReason: 'Left supplied comparison reason.' },
    { leftSlideId: 'a2', rightSlideId: 'b1', leftTitle: 'Synthetic a2', rightTitle: 'Synthetic b1', comparisonReason: 'Right supplied comparison reason.' },
    { leftSlideId: 'a3', rightSlideId: 'b3', leftTitle: 'Synthetic a3', rightTitle: 'Synthetic b3', comparisonReason: null },
  ]);
});

test('matching handles the public twelve-project and 120-page bounds without duplicate pairs', () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({
    path: `project-${i}`, project: project(`project-${i}`, Array.from({ length: 120 }, (_, j) => slide(`s${i}-${j}`, .5))),
  }));
  const report = compareProjectStructures(entries);
  assert.equal(report.comparisons.length, 66);
  for (const result of report.comparisons) {
    assert.equal(result.matchingBodyPages, 120);
    assert.equal(new Set(result.pairs.map(p => p.leftSlideId)).size, 120);
    assert.equal(new Set(result.pairs.map(p => p.rightSlideId)).size, 120);
  }
});
