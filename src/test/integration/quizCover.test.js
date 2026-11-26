// Portada de la biblioteca: la lista envia només la URL de la portada, i /api/quizzes/:id/cover serveix la imatge.
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
  process.env.EDUHOOT_RESOURCES_TOKEN = 'test-catalogue-token';
  process.env.PUBLIC_IMPORT_SOURCE_URL = 'https://catalogue.example';
  const server = require('../../server/server.js');
  mongoClient = server.mongoClient;
  httpServer = server.server.listen(0, '127.0.0.1');
  await new Promise((resolve) => httpServer.on('listening', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (mongoClient) await mongoClient.close().catch(() => {});
  if (mongod) await mongod.stop();
});

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#e11d48"/></svg>';
const q = (n, extra) => Object.assign({ question: `P${n}`, answers: ['a', 'b', 'c', 'd'], correct: 0, time: 20 }, extra);

async function make(name, questions, visibility = 'public') {
  const res = await fetch(`${baseUrl}/api/quizzes/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, tags: ['proves'], visibility, questions })
  });
  assert.equal(res.status, 200);
  return (await res.json()).id;
}

test('la lista envia la URL de la portada i no les dades de la imatge', async () => {
  const imgId = await make('Amb imatge', [q(1), q(2, { image: `data:image/png;base64,${PNG_B64}` })]);
  const vidId = await make('Amb vídeo', [q(1, { video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })]);
  const noneId = await make('Sense res', [q(1)]);
  const raw = await (await fetch(`${baseUrl}/api/quizzes`)).text();
  assert.ok(!raw.includes(PNG_B64), 'la lista no ha d\'incloure les dades de la imatge');
  const list = JSON.parse(raw);
  const img = list.find((x) => x.id === imgId);
  const vid = list.find((x) => x.id === vidId);
  const none = list.find((x) => x.id === noneId);
  assert.equal(img.coverImage, `/api/quizzes/${imgId}/cover`);
  assert.equal(img.coverVideo, '');
  assert.equal(vid.coverImage, '');
  assert.equal(vid.coverVideo, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(none.coverImage, '');
  assert.equal(none.coverVideo, '');
  assert.equal(img.questions, undefined);
});

test('/cover serveix la imatge de la portada amb el tipus correcte i caché privada', async () => {
  const id = await make('Portada PNG', [q(1, { image: `data:image/png;base64,${PNG_B64}` })]);
  const res = await fetch(`${baseUrl}/api/quizzes/${id}/cover`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.match(res.headers.get('cache-control'), /private/);
  assert.equal(Buffer.from(await res.arrayBuffer()).toString('base64'), PNG_B64);
});

test('un SVG en línia es serveix amb CSP de sandbox i sense sniffing', async () => {
  const id = await make('Portada SVG', [q(1, { image: 'data:image/svg+xml;utf8,' + encodeURIComponent(SVG) })]);
  const res = await fetch(`${baseUrl}/api/quizzes/${id}/cover`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/svg+xml');
  assert.match(res.headers.get('content-security-policy'), /sandbox/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(await res.text(), SVG);
});

test('sense imatge o amb un tipus no permès: 404; quiz privat per a un anònim: 403; inexistent: 404', async () => {
  const vidId = await make('Només vídeo', [q(1, { video: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })]);
  assert.equal((await fetch(`${baseUrl}/api/quizzes/${vidId}/cover`)).status, 404);
  const htmlId = await make('HTML', [q(1, { image: 'data:text/html;base64,PGgxPmhvbGE8L2gxPg==' })]);
  assert.equal((await fetch(`${baseUrl}/api/quizzes/${htmlId}/cover`)).status, 404);
  const privId = await make('Privat', [q(1, { image: `data:image/png;base64,${PNG_B64}` })], 'private');
  assert.equal((await fetch(`${baseUrl}/api/quizzes/${privId}/cover`)).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/quizzes/no-existeix/cover`)).status, 404);
});
