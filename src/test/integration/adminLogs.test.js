const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let httpServer;
let baseUrl;
let app;
let mongoClient;
let logger;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  ({ app, mongoClient } = require('../../server/server.js'));
  ({ logger } = require('../../server/logger'));
  httpServer = app.listen(0);
  await new Promise((resolve) => httpServer.on('listening', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (mongoClient) await mongoClient.close().catch(() => {});
  if (mongod) await mongod.stop();
});

function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

function cookieHeader(res) {
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return cookies
    .map((c) => c.split(';')[0])
    .filter((c) => c.startsWith('sessionId='))
    .join('; ');
}

const ADMIN = { email: 'admin-logs@test.local', password: 'secret123', nickname: 'Admin Logs Test' };

async function loginAsAdmin() {
  await request('/api/auth/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN)
  });
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN.email, password: ADMIN.password })
  });
  assert.equal(login.status, 200);
  return cookieHeader(login);
}

test('GET /api/admin/logs y /api/admin/settings/logging exigen rol admin', async () => {
  assert.equal((await request('/api/admin/logs')).status, 401);
  assert.equal((await request('/api/admin/settings/logging')).status, 401);
});

test('GET/POST /api/admin/settings/logging: valores por defecto, validación y actualización', async () => {
  const cookie = await loginAsAdmin();
  const headers = { Cookie: cookie };

  const initial = await request('/api/admin/settings/logging', { headers });
  assert.equal(initial.status, 200);
  const initialJson = await initial.json();
  assert.equal(initialJson.data.level, 'info');
  assert.equal(initialJson.data.cappedSizeBytes, 10 * 1024 * 1024);

  const invalidLevel = await request('/api/admin/settings/logging', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    body: JSON.stringify({ level: 'verbose' })
  });
  assert.equal(invalidLevel.status, 400);

  const tooSmall = await request('/api/admin/settings/logging', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    body: JSON.stringify({ cappedSizeBytes: 100 })
  });
  assert.equal(tooSmall.status, 400);

  const update = await request('/api/admin/settings/logging', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    body: JSON.stringify({ level: 'debug', cappedSizeBytes: 5 * 1024 * 1024 })
  });
  assert.equal(update.status, 200);

  const after1 = await request('/api/admin/settings/logging', { headers });
  const after1Json = await after1.json();
  assert.equal(after1Json.data.level, 'debug');
  assert.equal(after1Json.data.cappedSizeBytes, 5 * 1024 * 1024);

  const stats = await mongoClient.db('kahootDB').command({ collStats: 'appLogs' });
  assert.equal(stats.capped, true);
  assert.equal(stats.maxSize, 5 * 1024 * 1024);
});

test('GET /api/admin/logs filtra por nivel, pin y texto libre', async () => {
  const cookie = await loginAsAdmin();
  const headers = { Cookie: cookie };

  logger.info('Partida iniciada en pin A', { tag: 'game-start', pin: 'AAAAAA', hostId: 'hostA' });
  logger.error('Fallo crítico en pin B', { tag: 'playerAnswer', pin: 'BBBBBB', hostId: 'hostB' });
  await new Promise((resolve) => setTimeout(resolve, 200)); // el transport escribe de forma asíncrona

  const byLevel = await request('/api/admin/logs?level=error', { headers });
  const byLevelJson = await byLevel.json();
  assert.ok(byLevelJson.data.every((row) => row.level === 'error'));
  assert.ok(byLevelJson.data.some((row) => row.pin === 'BBBBBB'));

  const byPin = await request('/api/admin/logs?pin=AAAAAA', { headers });
  const byPinJson = await byPin.json();
  assert.ok(byPinJson.data.length >= 1);
  assert.ok(byPinJson.data.every((row) => row.pin === 'AAAAAA'));

  const byText = await request('/api/admin/logs?q=cr%C3%ADtico', { headers });
  const byTextJson = await byText.json();
  assert.ok(byTextJson.data.some((row) => row.pin === 'BBBBBB'));
  assert.ok(byTextJson.data.every((row) => row.pin !== 'AAAAAA'));
});
