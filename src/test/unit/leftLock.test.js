const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const createGamesRouter = require('../../server/routes/games');

// Quien ha abandonado recupera su nombre al validar el PIN con su token (sin elegirlo).
function startApp(game, playersList) {
  const games = { getGameByPin: (pin) => (pin === game.pin ? game : null) };
  const players = { getPlayers: () => playersList };
  const app = express();
  app.use(createGamesRouter({ games, players, finishedSessionReports: {}, liveSessionToCsv: () => '', FINISHED_SESSION_REPORT_DIR: '', buildRe: () => ({}) }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function get(server, path) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return res.json();
}

test('abandono: con su token recupera el nombre anterior', async () => {
  const game = { pin: '12345', hostId: 'h1', randomNames: false, leftPlayers: [{ id: 'x', name: 'Lucía', token: 'tok-1' }] };
  const server = await startApp(game, []);
  try {
    const data = await get(server, '/api/validate-pin/12345?tokens=tok-1');
    assert.equal(data.valid, true);
    assert.equal(data.lockedName, 'Lucía');
  } finally { server.close(); }
});

test('abandono: sin token, o con el nombre ya ocupado, no hay nombre que recuperar', async () => {
  const game = { pin: '12345', hostId: 'h1', randomNames: false, leftPlayers: [{ id: 'x', name: 'Lucía', token: 'tok-1' }] };
  const server = await startApp(game, []);
  try {
    assert.equal((await get(server, '/api/validate-pin/12345')).lockedName, null);
    assert.equal((await get(server, '/api/validate-pin/12345?tokens=otro')).lockedName, null);
  } finally { server.close(); }

  const taken = { pin: '12345', hostId: 'h1', randomNames: false, leftPlayers: [{ id: 'x', name: 'Lucía', token: 'tok-1' }] };
  const server2 = await startApp(taken, [{ name: 'Lucía' }]);
  try {
    assert.equal((await get(server2, '/api/validate-pin/12345?tokens=tok-1')).lockedName, null);
  } finally { server2.close(); }
});
