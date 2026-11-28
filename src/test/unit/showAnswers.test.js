const { test } = require('node:test');
const assert = require('node:assert/strict');
const { studentMetaOf, studentPlayersOf, showCorrectAnswersOf } = require('../../server/services/showAnswers');

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

test('mostrar respuestas desactivado: la lista de jugadores del alumnado no lleva el historial de respuestas', () => {
  const list = [{ name: 'A', gameData: { score: 5, answerHistory: [{ questionNumber: 1, submission: [1], isCorrect: true }] } }];
  const off = studentPlayersOf({ gameData: { options: { showCorrectAnswers: false } } }, list);
  assert.equal(off[0].gameData.answerHistory, undefined);
  assert.equal(off[0].gameData.score, 5);
  assert.ok(list[0].gameData.answerHistory, 'no modifica el original (el anfitrión lo usa)');
  assert.equal(studentPlayersOf({ gameData: { options: {} } }, list), list);
});
