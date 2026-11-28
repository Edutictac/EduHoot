const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildAnswerStatus } = require('../../server/sockets/answerStatus');

test('marca como enviada solo la respuesta de la pregunta actual', () => {
  const list = buildAnswerStatus([
    { playerId: 'p1', name: 'Ana', icon: '🐱', gameData: { answeredQuestion: 3 } },
    { playerId: 'p2', name: 'Pau', gameData: { answeredQuestion: 2 } },
    { playerId: 'p3', name: 'Joan', gameData: {} }
  ], 3);

  assert.deepEqual(list.map((p) => [p.name, p.answered]), [['Ana', true], ['Pau', false], ['Joan', false]]);
});

test('la mano levantada solo cuenta en la pregunta en que se levantó', () => {
  const list = buildAnswerStatus([
    { playerId: 'p1', name: 'Ana', gameData: { handRaisedQuestion: 2 } },
    { playerId: 'p2', name: 'Pau', gameData: { handRaisedQuestion: 3 } },
    { playerId: 'p3', name: 'Joan', gameData: { handRaisedQuestion: null } }
  ], 3);

  assert.deepEqual(list.map((p) => p.hand), [false, true, false]);
});

test('indica si el alumno está fuera de la pestaña y no expone el resto de datos de juego', () => {
  const [entry] = buildAnswerStatus([
    { playerId: 'p1', name: 'Ana', icon: '🐱', gameData: { tabAway: true, score: 500, answer: 2 } }
  ], 1);

  assert.equal(entry.away, true);
  assert.deepEqual(Object.keys(entry).sort(), ['answered', 'away', 'hand', 'icon', 'name', 'playerId', 'streak']);
});

test('sin jugadores devuelve lista vacía', () => {
  assert.deepEqual(buildAnswerStatus(undefined, 1), []);
});
