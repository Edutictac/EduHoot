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

const ADMIN = { email: 'admin-notice@test.local', password: 'secret123', nickname: 'Admin Notice' };
const EDITOR = { email: 'editor-notice@test.local', password: 'secret123', nickname: 'Editor Notice', role: 'editor' };
const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function login(user) {
  const res = await request('/api/auth/login', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email: user.email, password: user.password }) });
  assert.equal(res.status, 200);
  return cookieHeader(res);
}

test('avís «Prova les novetats»: visible per defecte; només l\'admin el canvia, per a tots', async () => {
  const env = async () => (await (await request('/api/env')).json());
  assert.equal((await env()).stageNoticeVisible, true);

  // Anònim: 401.
  assert.equal((await request('/api/admin/settings/stage-notice', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ visible: false }) })).status, 401);

  await request('/api/auth/bootstrap', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(ADMIN) });
  const adminCookie = await login(ADMIN);
  await request('/api/auth/users', { method: 'POST', headers: { ...JSON_HEADERS, Cookie: adminCookie }, body: JSON.stringify(EDITOR) });
  const editorCookie = await login(EDITOR);

  // Editor: 403, i res no canvia.
  const forbidden = await request('/api/admin/settings/stage-notice', { method: 'POST', headers: { ...JSON_HEADERS, Cookie: editorCookie }, body: JSON.stringify({ visible: false }) });
  assert.equal(forbidden.status, 403);
  assert.equal((await env()).stageNoticeVisible, true);

  // Admin: valida el booleà, amaga i torna a mostrar.
  const post = (body) => request('/api/admin/settings/stage-notice', { method: 'POST', headers: { ...JSON_HEADERS, Cookie: adminCookie }, body: JSON.stringify(body) });
  assert.equal((await post({ visible: 'no' })).status, 400);
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ visible: false })).status, 200);
  assert.equal((await env()).stageNoticeVisible, false);
  assert.equal((await post({ visible: true })).status, 200);
  assert.equal((await env()).stageNoticeVisible, true);
});
