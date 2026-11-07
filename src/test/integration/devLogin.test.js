const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

// /dev/login: accés amb els usuaris de prova del seed, només en desenvolupament.
const SEED_USER = { email: 'docent1@exemple.local', password: 'exemple1234', nickname: 'Docent de prova 1' };

let mongod;
let httpServer;
let baseUrl;
let mongoClient;
let previousNodeEnv;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  let app;
  ({ app, mongoClient } = require('../../server/server.js'));
  httpServer = app.listen(0);
  await new Promise((resolve) => httpServer.on('listening', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (mongoClient) await mongoClient.close().catch(() => {});
  if (mongod) await mongod.stop();
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

test('/dev/login llista els usuaris del seed i permet entrar amb la seua contrasenya', async () => {
  const bootstrap = await fetch(`${baseUrl}/api/auth/bootstrap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(SEED_USER)
  });
  assert.equal(bootstrap.status, 200);
  const { getUsersCollection } = require('../../server/data/repositories');
  const users = await getUsersCollection();
  await users.updateOne({ email: SEED_USER.email }, { $set: { devSeedKey: 'eduhoot-seed-user-2' } });

  const page = await fetch(`${baseUrl}/dev/login`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.ok(html.includes(`data-email="${SEED_USER.email}"`), 'botó de l’usuari de prova');

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SEED_USER.email, password: SEED_USER.password })
  });
  assert.equal(login.status, 200);
});
