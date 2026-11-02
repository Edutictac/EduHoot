const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let httpServer;
let baseUrl;
let mongoClient;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
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
});

afterEach(() => {
  delete process.env.UPLOAD_CSV_RATE_LIMIT_MAX;
  delete process.env.UPLOAD_CSV_RATE_LIMIT_DISABLED;
});

async function uploadStatuses(count) {
  const statuses = [];
  for (let i = 0; i < count; i++) {
    const res = await fetch(`${baseUrl}/api/upload-csv`, { method: 'POST' });
    statuses.push(res.status);
  }
  return statuses;
}

// Los tres tests comparten el contador por IP del limitador, así que el orden importa.
test('UPLOAD_CSV_RATE_LIMIT_MAX fija el máximo de subidas por IP', async () => {
  process.env.UPLOAD_CSV_RATE_LIMIT_MAX = '2';
  const statuses = await uploadStatuses(3);
  assert.notEqual(statuses[0], 429);
  assert.notEqual(statuses[1], 429);
  assert.equal(statuses[2], 429);
});

test('UPLOAD_CSV_RATE_LIMIT_DISABLED=true suspende el límite', async () => {
  process.env.UPLOAD_CSV_RATE_LIMIT_MAX = '2';
  process.env.UPLOAD_CSV_RATE_LIMIT_DISABLED = 'true';
  const statuses = await uploadStatuses(12);
  assert.ok(statuses.every((s) => s !== 429), JSON.stringify(statuses));
});

test('un máximo no válido vuelve al valor por defecto (10)', async () => {
  process.env.UPLOAD_CSV_RATE_LIMIT_MAX = 'abc';
  // Ya van 3 subidas contadas en la ventana (las del primer test).
  const statuses = await uploadStatuses(8);
  assert.ok(statuses.slice(0, 7).every((s) => s !== 429), JSON.stringify(statuses));
  assert.equal(statuses[7], 429);
});
