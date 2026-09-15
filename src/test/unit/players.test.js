const { test } = require('node:test');
const assert = require('node:assert/strict');

const { Players } = require('../../server/utils/players');

test('Players añade jugadores y recupera por id y por host', () => {
  const players = new Players();
  const p1 = players.addPlayer('host-1', 'p1', 'Ana', {}, '🐶', 'tok-1');
  const p2 = players.addPlayer('host-1', 'p2', 'Bruno', {}, '', '');

  assert.equal(players.getPlayer('p1'), p1);
  assert.equal(players.getPlayers('host-1').length, 2);
  assert.equal(p2.name, 'Bruno');
});

test('Players resuelve token y elimina su vínculo al borrar', () => {
  const players = new Players();
  players.addPlayer('host-1', 'p1', 'Ana', {}, '', 'tok-1');

  assert.equal(players.getByToken('tok-1').playerId, 'p1');
  assert.equal(players.getByToken('inexistente'), null);
  assert.equal(players.getByToken(''), null);

  players.removePlayer('p1');
  assert.equal(players.getPlayer('p1'), undefined);
  assert.equal(players.getByToken('tok-1'), null);
});

test('Players getPlayer devuelve undefined si no existe', () => {
  const players = new Players();
  assert.equal(players.getPlayer('nadie'), undefined);
});
