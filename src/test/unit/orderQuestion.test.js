const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ORDER_GRADING: G, normalizeOrderItems, isPermutation, orderScoreRatio, orderIsCorrect } = require('../../server/services/orderQuestion');

const ALL_MODES = Object.values(G);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test('elements: 2 a 8, sense buits ni repetits', () => {
  assert.deepEqual(normalizeOrderItems([' A ', 'B', '']).items, ['A', 'B']);
  assert.ok(normalizeOrderItems(['A']).error);
  assert.ok(normalizeOrderItems(['A', 'A']).error);
  assert.ok(normalizeOrderItems(Array.from({ length: 9 }, (_, i) => 'x' + i)).error);
  assert.equal(normalizeOrderItems(Array.from({ length: 8 }, (_, i) => 'x' + i)).items.length, 8);
});

test('una resposta ha de ser una permutació completa', () => {
  assert.equal(isPermutation([0, 1, 2], 3), true);
  assert.equal(isPermutation([0, 1], 3), false, 'incompleta');
  assert.equal(isPermutation([0, 0, 2], 3), false, 'repetida');
  assert.equal(isPermutation([0, 1, 3], 3), false, 'fora de rang');
  assert.equal(orderScoreRatio([0, 1], 3, G.ABSOLUTE_POSITION), 0, 'incompleta puntua 0');
});

test('l\'ordre correcte puntua 1 en tots els modes', () => {
  for (const n of [2, 3, 5, 8]) {
    const identity = Array.from({ length: n }, (_, i) => i);
    for (const mode of ALL_MODES) assert.equal(orderScoreRatio(identity, n, mode), 1, `mode ${mode}, n ${n}`);
    assert.equal(orderIsCorrect(identity, n, G.ALL_OR_NOTHING), true);
  }
});

test('posició absoluta: elements a la seua posició', () => {
  close(orderScoreRatio([1, 0, 2, 3], 4, G.ABSOLUTE_POSITION), 0.5);
  close(orderScoreRatio([3, 2, 1, 0], 4, G.ABSOLUTE_POSITION), 0);
});

test('tot o res: només l\'ordre complet', () => {
  assert.equal(orderScoreRatio([1, 0, 2, 3], 4, G.ALL_OR_NOTHING), 0);
  assert.equal(orderScoreRatio([0, 1, 2, 3], 4, G.ALL_OR_NOTHING), 1);
});

test('relatiu a la posició correcta: (n-1) menys la distància, sense baixar de zero', () => {
  // Invertit amb n=4: distàncies 3,1,1,3 → punts 0,2,2,0 de 12.
  close(orderScoreRatio([3, 2, 1, 0], 4, G.RELATIVE_TO_CORRECT), 4 / 12);
});

test('subseqüències: la més llarga ordenada i la contigua', () => {
  // [1,0,2,3]: la més llarga ordenada és 0,2,3 (3 de 4); la contigua és 2,3 (2 de 4).
  close(orderScoreRatio([1, 0, 2, 3], 4, G.LONGEST_ORDERED_SUBSET), 3 / 4);
  close(orderScoreRatio([1, 0, 2, 3], 4, G.LONGEST_CONTIGUOUS_SUBSET), 2 / 4);
  // Invertit: cap parell ordenat ni contigu.
  assert.equal(orderScoreRatio([3, 2, 1, 0], 4, G.LONGEST_ORDERED_SUBSET), 0);
  assert.equal(orderScoreRatio([3, 2, 1, 0], 4, G.LONGEST_CONTIGUOUS_SUBSET), 0);
});

test('veïns: següent (excloent i incloent l\'últim) i anterior i posterior', () => {
  // [1,0,2,3]: només 2→3 és veí correcte.
  close(orderScoreRatio([1, 0, 2, 3], 4, G.RELATIVE_NEXT_EXCLUDE_LAST), 1 / 3);
  close(orderScoreRatio([1, 0, 2, 3], 4, G.RELATIVE_NEXT_INCLUDE_LAST), 2 / 4);
  assert.ok(orderScoreRatio([1, 0, 2, 3], 4, G.RELATIVE_ONE_PREVIOUS_AND_NEXT) > 0);
});

test('tots els anteriors i posteriors: un punt per parell correctament ordenat', () => {
  // Invertit: cap parell correcte.
  assert.equal(orderScoreRatio([3, 2, 1, 0], 4, G.RELATIVE_ALL_PREVIOUS_AND_NEXT), 0);
  // [1,0,2,3]: 6 de 12 parells ordenats correctament (cada parell compta dues vegades).
  close(orderScoreRatio([1, 0, 2, 3], 4, G.RELATIVE_ALL_PREVIOUS_AND_NEXT), 10 / 12);
});

test('la puntuació sempre està entre 0 i 1', () => {
  const perms = [[0, 1, 2], [2, 0, 1], [1, 2, 0], [2, 1, 0], [0, 2, 1], [1, 0, 2]];
  for (const p of perms) for (const mode of ALL_MODES) {
    const r = orderScoreRatio(p, 3, mode);
    assert.ok(r >= 0 && r <= 1, `mode ${mode}, ${p}: ${r}`);
  }
});
