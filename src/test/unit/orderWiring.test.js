const { test } = require('node:test');
const assert = require('node:assert/strict');
const qu = require('../../server/questionUtils');
const { getSubmissionScoreRatio } = require('../../server/services/scoring');
const { normalizeQuestions } = require('../../server/services/quizNormalize');

const orderMeta = (extra = {}) => qu.normalizeQuestionMeta({ type: 'order', items: ['A', 'B', 'C'], ...extra });

test('els àlies del tipo es reconeixen com a «order»', () => {
  for (const alias of ['order', 'ordering', 'ordenar', 'ordenar elementos', 'Poner en orden', 'Ordenació']) {
    assert.equal(qu.normalizeQuestionType(alias), 'order', alias);
  }
});

test('la pregunta normalitzada té elements, mode de puntuació (per defecte posició absoluta) i disposició', () => {
  const meta = orderMeta();
  assert.equal(meta.type, 'order');
  assert.deepEqual(meta.items, ['A', 'B', 'C']);
  assert.equal(meta.orderGrading, 0);
  assert.equal(meta.layout, 'vertical');
  assert.deepEqual(orderMeta({ orderGrading: 99 }).orderGrading, 0, 'mode no vàlid → per defecte');
  assert.equal(orderMeta({ orderGrading: 6 }).orderGrading, 6);
  assert.equal(orderMeta({ layout: 'horizontal' }).layout, 'horizontal');
});

test('correcció: l\'ordre correcte és correcte; un altre ordre o una resposta incompleta no', () => {
  const meta = orderMeta();
  assert.equal(qu.isSubmissionCorrect(meta, [0, 1, 2]), true);
  assert.equal(qu.isSubmissionCorrect(meta, [1, 0, 2]), false);
  assert.equal(qu.isSubmissionCorrect(meta, [0, 1]), false, 'incompleta');
  assert.equal(qu.isSubmissionCorrect(meta, [0, 0, 2]), false, 'repetida');
});

test('puntuació proporcional segons el mode (ex.: posició absoluta amb una parella girada)', () => {
  const meta = orderMeta({ items: ['A', 'B', 'C', 'D'] });
  assert.equal(getSubmissionScoreRatio(meta, [1, 0, 2, 3]), 0.5);
  assert.equal(getSubmissionScoreRatio(meta, [0, 1, 2, 3]), 1);
  const contiguous = orderMeta({ items: ['A', 'B', 'C', 'D'], orderGrading: 6 });
  assert.equal(getSubmissionScoreRatio(contiguous, [1, 0, 2, 3]), 0.5);
});

test('la resposta s\'envia com a seqüència d\'índexs; el desat de la pregunta conserva els elements', () => {
  assert.deepEqual(qu.normalizeSubmission(orderMeta(), [2, 0, 1]), [2, 0, 1]);
  assert.deepEqual(qu.buildAnswerFields({ items: ['A', 'B'] }, orderMeta({ items: ['A', 'B'] })).items, ['A', 'B']);
  const [saved] = normalizeQuestions([{ question: 'Ordena', type: 'order', items: ['Primer', 'Segon', 'Tercer'] }]);
  assert.deepEqual(saved.items, ['Primer', 'Segon', 'Tercer']);
  assert.equal(saved.type, 'order');
});

test('una pregunta d\'ordenar amb menys de 2 elements no puntua', () => {
  const meta = orderMeta({ items: ['A'] });
  assert.equal(qu.isSubmissionCorrect(meta, [0]), false);
  assert.equal(getSubmissionScoreRatio(meta, [0]), 0);
});
