const { test } = require('node:test');
const assert = require('node:assert/strict');
const createGameHelpers = require('../../server/sockets/gameHelpers');

// Flujo del avance automático con los helpers reales y un io falso (sin esperar en tiempo real).
function setup(seconds) {
  const emitted = [];
  const io = {
    to: (room) => ({ emit: (name, ...args) => emitted.push({ room, name, args }) })
  };
  const game = {
    pin: '12345',
    hostId: 'host-1',
    paused: false,
    gameData: {
      question: 1,
      questions: [{ type: 'quiz', q1: 'Q', a1: 'A', a2: 'B', a3: 'C', a4: 'D', correct: 1 }],
      options: { autoAdvanceSec: seconds },
      autoAdvance: null
    }
  };
  const games = { getGame: () => game, getGameByPin: () => game };
  const players = { getPlayers: () => [] };
  const helpers = createGameHelpers({ io, games, players, cleanImportedText: (x) => x });
  return { helpers, game, emitted };
}

const lastState = (emitted) => emitted.filter((e) => e.name === 'autoAdvanceState').slice(-1)[0].args[0];

test('avance automático: al terminar la pregunta se arma, se pausa, se reanuda y se cancela', () => {
  const { helpers, game, emitted } = setup(5);
  helpers.emitQuestionOverPayload(game);
  assert.equal(lastState(emitted).active, true);
  assert.equal(lastState(emitted).seconds, 5);

  helpers.setAutoAdvancePaused(game, true);
  assert.equal(lastState(emitted).paused, true);
  assert.equal(game.paused, true, 'la pausa bloquea el avance manual');

  helpers.setAutoAdvancePaused(game, false);
  assert.equal(lastState(emitted).paused, false);
  assert.equal(game.paused, false);

  helpers.stopAutoAdvance(game);
  assert.equal(lastState(emitted).active, false);
  assert.equal(game.gameData.autoAdvance, null);
});

test('avance automático: una misma pregunta no se rearma dos veces', () => {
  const { helpers, game, emitted } = setup(5);
  helpers.emitQuestionOverPayload(game);
  const timer = game.gameData.autoAdvance;
  helpers.emitQuestionOverPayload(game);
  assert.equal(game.gameData.autoAdvance, timer);
  helpers.stopAutoAdvance(game);
});

test('avance automático: en manual (0) no se arma nada', () => {
  const { helpers, game, emitted } = setup(0);
  helpers.emitQuestionOverPayload(game);
  assert.equal(game.gameData.autoAdvance, null);
  assert.equal(emitted.filter((e) => e.name === 'autoAdvanceState').length, 0);
});

test('avance automático: si el anfitrión sigue en resultados (clasificación) se rearma; si avanza, se para', () => {
  const { helpers, game } = setup(5);
  helpers.emitQuestionOverPayload(game);
  const first = game.gameData.autoAdvance;
  helpers.onAutoAdvanceStepDone(game, 'ranking');
  assert.equal(game.gameData.autoAdvance, first, 'rearma el mismo temporizador');
  assert.equal(first.cancelled, false);
  helpers.onAutoAdvanceStepDone(game, 'next');
  assert.equal(first.cancelled, false, 'con "next" lo para nextQuestion, no aquí');
  helpers.stopAutoAdvance(game);
  assert.equal(first.cancelled, true);
});
