const { test } = require('node:test');
const assert = require('node:assert/strict');

const createGameHelpers = require('../../server/sockets/gameHelpers');

// Con la casilla de puntuaciones y ranking desmarcada, el servidor debe
// avisar a los alumnos (questionOver.meta.showScores = false) para que no
// muestren posición ni Top 10 tras cada pregunta.
function makeHelpers(options, emitted) {
  const game = {
    pin: '12345',
    hostId: 'host-1',
    gameData: {
      question: 1,
      questions: [{ question: '¿Capital de Francia?', answers: ['París', 'Roma'], correct: 1, type: 'quiz' }],
      options
    }
  };
  const helpers = createGameHelpers({
    io: {
      to: (pin) => ({
        emit: (name, playerData, meta) => emitted.push({ pin, name, playerData, meta })
      })
    },
    games: { games: [game] },
    players: { getPlayers: () => [{ playerId: 'p1', name: 'Ana', gameData: { score: 100 } }] },
    cleanImportedText: (value) => value || ''
  });
  return { helpers, game };
}

test('questionOver: showScores es false cuando la casilla está desmarcada', () => {
  const emitted = [];
  const { helpers, game } = makeHelpers({ showScoresBetween: false }, emitted);
  helpers.emitQuestionOverPayload(game);

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].name, 'questionOver');
  assert.equal(emitted[0].meta.showScores, false);
});

test('questionOver: showScores es true cuando la casilla está marcada', () => {
  const emitted = [];
  const { helpers, game } = makeHelpers({ showScoresBetween: true }, emitted);
  helpers.emitQuestionOverPayload(game);

  assert.equal(emitted[0].meta.showScores, true);
});

test('questionOver: sin opciones guardadas se comporta como casilla marcada', () => {
  const emitted = [];
  const { helpers, game } = makeHelpers(undefined, emitted);
  helpers.emitQuestionOverPayload(game);

  assert.equal(emitted[0].meta.showScores, true);
});
