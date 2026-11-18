const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let httpServer;
let baseUrl;
let mongoClient;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  process.env.UPLOAD_CSV_RATE_LIMIT_DISABLED = 'true';
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
  delete process.env.UPLOAD_CSV_RATE_LIMIT_DISABLED;
});

function upload(filename, content) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/plain' }), filename);
  form.append('name', 'Prueba GIFT');
  return fetch(`${baseUrl}/api/upload-csv`, { method: 'POST', body: form });
}

test('POST /api/upload-csv acepta un GIFT y muestra las preguntas omitidas', async () => {
  const gift = `::P1:: Capital de Francia? {=Paris ~Roma}

::P2:: Redacta {}
`;
  const res = await upload('repaso.gift', gift);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.count, 1);
  assert.deepEqual(body.skipped.map((s) => s.name), ['P2']);
  assert.equal(body.skipped[0].reason, 'tipo no compatible (essay)');
});

test('un .txt con contenido GIFT se importa como GIFT', async () => {
  const res = await upload('preguntas.txt', '::P1:: Capital de Francia? {=Paris ~Roma}\n\n::P2:: Redacta {}\n');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.count, 1);
  assert.deepEqual(body.skipped.map((s) => s.name), ['P2']);
});

test('un .txt con contenido CSV se importa como CSV', async () => {
  const csv = 'tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia\nquiz;¿Capital?;Paris;Roma;;;20;1;;;;;';
  const res = await upload('preguntas.txt', csv);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.count, 1);
  assert.deepEqual(body.skipped, []);
});
