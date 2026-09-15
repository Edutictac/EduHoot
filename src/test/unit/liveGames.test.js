const { test } = require('node:test');
const assert = require('node:assert/strict');

const { LiveGames } = require('../../server/utils/liveGames');

test('LiveGames añade, busca y elimina juegos', () => {
  const games = new LiveGames();
  const game = games.addGame(1234, 'host-1', true, { question: 1 });

  assert.equal(games.getGame('host-1'), game);
  assert.equal(games.getGameByPin(1234), game);
  assert.equal(games.getGameByPin('1234'), game);

  const removed = games.removeGame('host-1');
  assert.equal(removed, game);
  assert.equal(games.getGame('host-1'), undefined);
  assert.equal(games.getGameByPin(1234), undefined);
});

test('LiveGames getGameByPin devuelve el último juego con ese pin', () => {
  const games = new LiveGames();
  const first = games.addGame(42, 'host-a', true, {});
  const second = games.addGame(42, 'host-b', true, {});
  assert.notEqual(first, second);
  assert.equal(games.getGameByPin(42), second);
});

test('LiveGames devuelve undefined si no hay coincidencias', () => {
  const games = new LiveGames();
  assert.equal(games.getGame('nadie'), undefined);
  assert.equal(games.getGameByPin(999), undefined);
});
