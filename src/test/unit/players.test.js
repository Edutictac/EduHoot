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

test('updatePlayerId mantiene resoluble el token tras varias reconexiones (issue #23)', () => {
  const players = new Players();
  const player = players.addPlayer('host-1', 'socket-a', 'Ana', {}, '', 'tok-1');

  // Primera reconexión: socket-a -> socket-b.
  players.updatePlayerId(player, 'socket-b');
  assert.equal(players.getByToken('tok-1').playerId, 'socket-b');
  assert.equal(players.getPlayer('socket-a'), undefined);

  // Segunda reconexión: socket-b -> socket-c. Sin el fix, getByToken()
  // seguía devolviendo el playerId antiguo ('socket-a') y getPlayer()
  // ya no lo encontraba, dejando la reconexión en noGameFound.
  players.updatePlayerId(player, 'socket-c');
  assert.equal(players.getByToken('tok-1').playerId, 'socket-c');
  assert.equal(players.getPlayer('socket-c'), player);
});
