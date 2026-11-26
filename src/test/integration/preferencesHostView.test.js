// Preferencia de la vista de opciones del lobby por cuenta (GET/PATCH /api/auth/preferences).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { ObjectId } = require('mongodb');

let mongod;
let httpServer;
let baseUrl;
let mongoClient;
let sessions;
let getUsersCollection;
const USER_ID = new ObjectId();
const SESSION = 'prefs-view-fixture';

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  process.env.EDUHOOT_RESOURCES_TOKEN = 'test-catalogue-token';
  process.env.PUBLIC_IMPORT_SOURCE_URL = 'https://catalogue.example';
  const server = require('../../server/server.js');
  ({ mongoClient, sessions } = server);
  getUsersCollection = require('../../server/data/repositories').getUsersCollection;
  httpServer = server.server.listen(0, '127.0.0.1');
  await new Promise((resolve) => httpServer.on('listening', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
  await (await getUsersCollection()).insertOne({ _id: USER_ID, email: 'prefs@example.org', role: 'editor' });
  sessions.set(SESSION, { userId: USER_ID.toHexString(), email: 'prefs@example.org', role: 'editor', provider: 'authentik' });
});

after(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (mongoClient) await mongoClient.close().catch(() => {});
  if (mongod) await mongod.stop();
});

const withSession = { Cookie: `sessionId=${SESSION}`, 'Content-Type': 'application/json' };

test('sin sesión, la preferencia no está disponible (401)', async () => {
  assert.equal((await fetch(`${baseUrl}/api/auth/preferences`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/auth/preferences`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"hostOptionsView":"b"}' })).status, 401);
});

test('con sesión, guarda y lee la vista del lobby, sin tocar la del tamaño de biblioteca', async () => {
  const saved = await fetch(`${baseUrl}/api/auth/preferences`, { method: 'PATCH', headers: withSession, body: JSON.stringify({ libraryPageSize: 24 }) });
  assert.equal(saved.status, 200);
  const view = await fetch(`${baseUrl}/api/auth/preferences`, { method: 'PATCH', headers: withSession, body: JSON.stringify({ hostOptionsView: 'b' }) });
  assert.equal(view.status, 200);
  assert.deepEqual(await view.json(), { ok: true, hostOptionsView: 'b' });
  const read = await (await fetch(`${baseUrl}/api/auth/preferences`, { headers: withSession })).json();
  assert.deepEqual(read, { libraryPageSize: 24, hostOptionsView: 'b', libraryCoverLevel: null });
});

test('valores desconocidos se rechazan y no cambian lo guardado', async () => {
  const bad = await fetch(`${baseUrl}/api/auth/preferences`, { method: 'PATCH', headers: withSession, body: JSON.stringify({ hostOptionsView: 'c' }) });
  assert.equal(bad.status, 400);
  const bad2 = await fetch(`${baseUrl}/api/auth/preferences`, { method: 'PATCH', headers: withSession, body: JSON.stringify({ libraryPageSize: 7 }) });
  assert.equal(bad2.status, 400);
  const read = await (await fetch(`${baseUrl}/api/auth/preferences`, { headers: withSession })).json();
  assert.deepEqual(read, { libraryPageSize: 24, hostOptionsView: 'b', libraryCoverLevel: null });
});

test('nivell de la imatge de fons: 0, 10, 20 o 30 per compte; altres valors es rebutgen', async () => {
  const ok = await fetch(`${baseUrl}/api/auth/preferences`, { method: 'PATCH', headers: withSession, body: JSON.stringify({ libraryCoverLevel: 30 }) });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { ok: true, libraryCoverLevel: 30 });
  const read = await (await fetch(`${baseUrl}/api/auth/preferences`, { headers: withSession })).json();
  assert.equal(read.libraryCoverLevel, 30);
  for (const bad of [15, 'no', true, 40]) {
    const res = await fetch(`${baseUrl}/api/auth/preferences`, { method: 'PATCH', headers: withSession, body: JSON.stringify({ libraryCoverLevel: bad }) });
    assert.equal(res.status, 400, `valor ${bad}`);
  }
  const still = await (await fetch(`${baseUrl}/api/auth/preferences`, { headers: withSession })).json();
  assert.equal(still.libraryCoverLevel, 30);
});
