// Informe de la sessió: la resposta d'ordenar es llegeix com a text (en l'ordre que l'alumne l'ha posat).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const createSessionReportService = require('../../server/services/sessionReport');
const { liveSessionToCsv } = createSessionReportService({ players: { getPlayers: () => [] } });

// Pregunta tal com la deixa la partida: la llista barrejada és B, C, A (orderShown [1, 2, 0]).
const question = {
  question: 'Pasos del arranque',
  type: 'order',
  items: ['A', 'B', 'C'],
  orderShown: [1, 2, 0],
  orderGrading: 0,
  answers: ['', '', '', ''],
  time: 20
};

function reportRow(submission) {
  const player = {
    name: 'Ana',
    gameData: { score: 0, correctCount: 0, wrongCount: 0, answerHistory: [{ questionNumber: 1, submission, isCorrect: false, scoreRatio: 0 }] }
  };
  const game = { pin: '123456', hostId: 'h', gameData: { questions: [question], totalQuestions: 1, quizName: 'Ordenar' } };
  const csv = liveSessionToCsv(game, [player]);
  return csv.split('\n').find((line) => line.includes('Ana') && line.includes('order')).split(';');
}

test('informe: la resposta d\'ordenar és el text en l\'ordre que l\'alumne l\'ha posat', () => {
  // Posicions de la llista mostrada: 0 = B, 1 = C, 2 = A. Ana posa primer A (2), després B (0) i C (1).
  const row = reportRow([2, 0, 1]);
  assert.equal(row[14], '1 A | 2 B | 3 C');
});

test('informe: la solució és l\'ordre correcte, no el mostrat', () => {
  const row = reportRow([0, 1, 2]);
  assert.equal(row[15], '1 A | 2 B | 3 C');
  // Ana posa B, C, A: no és l'ordre correcte.
  assert.equal(row[14], '1 B | 2 C | 3 A');
});
