const { test } = require('node:test');
const assert = require('node:assert/strict');
const createGameHelpers = require('../../server/sockets/gameHelpers');
const qu = require('../../server/questionUtils');
const { getSubmissionScoreRatio } = require('../../server/services/scoring');

const helpers = createGameHelpers({ io: null, games: {}, players: {}, cleanImportedText: (s) => String(s || '').trim() });
const built = (items) => helpers.buildQuestions([{ question: 'Ordena', type: 'order', items, time: 20 }], {})[0];

// Resposta de l'alumnat que deixa els elements en l'ordre correcte: per cada posició correcta k,
// la posició de la llista barrejada on es troba l'element k.
const correctSubmission = (q) => q.items.map((_, k) => q.orderShown.indexOf(k));

test('la llista de l\'alumnat és una permutació barrejada, no l\'ordre correcte', () => {
  const q = built(['A', 'B', 'C', 'D']);
  assert.equal(q.type, 'order');
  assert.deepEqual(q.items, ['A', 'B', 'C', 'D'], 'la solució en ordre correcte');
  assert.deepEqual([...q.orderShown].sort(), [0, 1, 2, 3]);
  assert.notDeepEqual(q.orderShown, [0, 1, 2, 3], 'no surt en ordre');
});

test('l\'ordre correcte de l\'alumnat puntua el màxim, i un altre ordre no', () => {
  const q = built(['A', 'B', 'C', 'D']);
  const meta = qu.getQuestionMeta(q);
  assert.equal(getSubmissionScoreRatio(meta, correctSubmission(q)), 1);
  assert.equal(qu.isSubmissionCorrect(meta, correctSubmission(q)), true);
  const reversed = [...correctSubmission(q)].reverse();
  assert.equal(qu.isSubmissionCorrect(meta, reversed), false);
});

test('la resposta de l\'alumnat no es pot inventar: una seqüència no vàlida puntua zero', () => {
  const q = built(['A', 'B', 'C']);
  const meta = qu.getQuestionMeta(q);
  assert.equal(getSubmissionScoreRatio(meta, [0, 0, 1]), 0);
  assert.equal(getSubmissionScoreRatio(meta, [0, 1]), 0);
  assert.equal(getSubmissionScoreRatio(meta, [0, 1, 9]), 0);
});

test('la llista que veu l\'alumnat és la barrejada; la solució no surt en ella', () => {
  const q = built(['A', 'B', 'C', 'D']);
  const shownItems = qu.orderDisplayOf(qu.getQuestionMeta(q));
  assert.deepEqual([...shownItems].sort(), ['A', 'B', 'C', 'D']);
  assert.notDeepEqual(shownItems, ['A', 'B', 'C', 'D']);
});
