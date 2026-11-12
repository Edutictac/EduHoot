const { test } = require('node:test');
const assert = require('node:assert/strict');

const createPlayerEvents = require('../../server/sockets/playerEvents');
const { Players } = require('../../server/utils/players');
const { normalizeSoloName, normalizePlayerName } = require('../../server/services/quizNormalize');

// Issue #28: no hi pot haver dos noms iguals en la mateixa partida.
function setup() {
  const players = new Players();
  const game = { hostId: 'host-1', pin: '12345', gameLive: false };
  const connected = new Set();
  const io = { to: () => ({ emit: () => {} }), sockets: { sockets: { has: (id) => connected.has(id) } } };
  const register = createPlayerEvents({
    io,
    games: { getGameByPin: (pin) => (pin === game.pin ? game : null), getGame: () => game },
    players,
    helpers: { logGames: () => {} },
    commons: { isStudentIdentityEnabled: () => false },
    normalizeSoloName,
    normalizePlayerName
  });
  function join(id, params) {
    connected.add(id);
    const handlers = {};
    const emitted = [];
    const socket = { id, on: (name, fn) => { handlers[name] = fn; }, emit: (name, data) => emitted.push({ name, data }), join: () => {} };
    register(socket);
    handlers['player-join'](Object.assign({ pin: game.pin }, params));
    return emitted;
  }
  return { players, connected, join };
}

const names = (emitted) => emitted.map((e) => e.name);

test('un segon alumne amb el mateix nom és rebutjat amb el codi nameTaken', () => {
  const { players, join } = setup();
  assert.ok(names(join('s1', { name: 'Ana', token: 't1' })).includes('playerJoinAck'));
  const second = join('s2', { name: 'Ana', token: 't2' });
  const rejected = second.find((e) => e.name === 'playerJoinRejected');
  assert.equal(rejected.data.code, 'nameTaken');
  assert.ok(!names(second).includes('playerJoinAck'));
  assert.equal(players.getPlayers('host-1').length, 1);
});

test('no distingix majúscules ni espais de més', () => {
  const { players, join } = setup();
  join('s1', { name: 'Ana Maria', token: 't1' });
  assert.equal(join('s2', { name: '  ana  maria ', token: 't2' }).find((e) => e.name === 'playerJoinRejected').data.code, 'nameTaken');
  assert.ok(names(join('s3', { name: 'Ana Mari', token: 't3' })).includes('playerJoinAck'));
  assert.equal(players.getPlayers('host-1').length, 2);
});

test('qui torna amb el seu token o amb la connexió perduda (issue #27) no és rebutjat', () => {
  const { players, connected, join } = setup();
  join('s1', { name: 'Ana', token: 't1' });
  connected.delete('s1');
  assert.ok(names(join('s2', { name: 'Ana', token: 't1' })).includes('playerRejoin'));
  connected.delete('s2');
  // Sense token resolt, però la fila amb eixe nom ja no està connectada.
  assert.ok(names(join('s3', { name: 'Ana', token: 'nou' })).includes('playerRejoin'));
  assert.equal(players.getPlayers('host-1').length, 1);
});

test('Players.findByName ignora el propi jugador i altres partides', () => {
  const players = new Players();
  players.addPlayer('host-1', 'p1', 'Ana', {}, '', '');
  players.addPlayer('host-2', 'p2', 'Pau', {}, '', '');
  assert.equal(players.findByName('host-1', 'ANA').playerId, 'p1');
  assert.equal(players.findByName('host-1', 'Ana', 'p1'), null);
  assert.equal(players.findByName('host-1', 'Pau'), null);
  assert.equal(players.findByName('host-1', '   '), null);
});
