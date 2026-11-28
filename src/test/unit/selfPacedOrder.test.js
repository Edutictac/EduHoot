// Autoritme: la pregunta d'ordenar arriba a l'alumnat amb els elements en l'ordre mostrat.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const payloads = require('../../server/services/selfPacedPayloads');

const orderQuestion = {
  question: 'Pasos del arranque',
  type: 'order',
  items: ['A', 'B', 'C'],
  orderShown: [2, 0, 1],
  orderGrading: 0,
  answers: ['', '', '', ''],
  time: 20
};

function makeGame() {
  return {
    gameData: { questions: [orderQuestion], options: { mode: 'selfPaced' } },
    gameOver: false
  };
}

test('autoritme: la pregunta d\'ordenar porta els elements en l\'ordre mostrat i la disposició', () => {
  const game = makeGame();
  const player = { gameData: { sp: { index: 1, startedAt: 1000, answered: false, finished: false, answeredCount: 0 } } };
  const payload = payloads.questionPayload(game, player, 1000, (full) => full);
  assert.equal(payload.type, 'order');
  assert.deepEqual(payload.orderItems, ['C', 'A', 'B']);
  assert.equal(payload.layout, 'vertical');
  // Ordenar, como emparejar, lleva el tiempo extra por defecto (+50 %): 20 s pasan a 30 s.
  assert.equal(payload.timeTotal, 30);
});
