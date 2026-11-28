const { test } = require('node:test');
const assert = require('node:assert/strict');
const { studentMetaOf, showCorrectAnswersOf } = require('../../server/services/showAnswers');

const meta = { type: 'quiz', correctAnswers: [1], acceptedAnswers: ['Paris'], numericAnswer: 3, tolerance: 0, showScores: true };

test('mostrar respuestas activado (por defecto): al alumnado llega la respuesta correcta', () => {
  assert.equal(studentMetaOf({ gameData: { options: {} } }, meta).correctAnswers[0], 1);
  assert.equal(studentMetaOf({ gameData: { options: { showCorrectAnswers: true } } }, meta).correctAnswers[0], 1);
  assert.equal(showCorrectAnswersOf({ gameData: {} }), true);
});

test('mostrar respuestas desactivado: al alumnado no llega la respuesta correcta', () => {
  const game = { gameData: { options: { showCorrectAnswers: false } } };
  const out = studentMetaOf(game, meta);
  assert.equal(out.correctAnswers, undefined);
  assert.equal(out.acceptedAnswers, undefined);
  assert.equal(out.numericAnswer, undefined);
  assert.equal(out.tolerance, undefined);
  assert.equal(out.type, 'quiz');
  assert.equal(out.showScores, true);
  assert.equal(meta.correctAnswers[0], 1, 'no modifica el original (el anfitrión lo usa)');
});
