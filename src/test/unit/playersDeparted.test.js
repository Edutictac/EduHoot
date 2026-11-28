// Alumnat que surt d'una partida: el registre guarda el seu resultat per al informe final.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Players } = require('../../server/utils/players');

test('un alumne que surt queda guardat amb el seu resultat, i no es duplica', () => {
  const players = new Players();
  const gd = { score: 320, correctCount: 2, wrongCount: 1, answerHistory: [{ questionNumber: 1, isCorrect: true }] };
  players.addPlayer('host1', 'a', 'Ana', gd, '', 'tok-a');
  players.removePlayer('a');
  assert.equal(players.getPlayers('host1').length, 0);
  const departed = players.departedOf('host1');
  assert.equal(departed.length, 1);
  assert.equal(departed[0].name, 'Ana');
  assert.deepEqual(departed[0].gameData, gd);
  // Si entra i surt de nou, només hi ha una entrada amb el resultat més recent.
  players.addPlayer('host1', 'a', 'Ana', { ...gd, score: 500 }, '', 'tok-a2');
  players.removePlayer('a');
  assert.equal(players.departedOf('host1').length, 1);
  assert.equal(players.departedOf('host1')[0].gameData.score, 500);
});

test('clearDeparted buida només l\'amfitrió indicat', () => {
  const players = new Players();
  players.addPlayer('h1', 'a', 'Ana', {}, '', '');
  players.addPlayer('h2', 'b', 'Bruno', {}, '', '');
  players.removePlayer('a');
  players.removePlayer('b');
  players.clearDeparted('h1');
  assert.equal(players.departedOf('h1').length, 0);
  assert.equal(players.departedOf('h2').length, 1);
});
