// La biblioteca (GET /api/quizzes) envia el total de preguntas de cada quiz, sin enviar las preguntas.
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

const question = (n) => ({ question: `P${n}`, answers: ['a', 'b', 'c', 'd'], correct: 0, time: 20 });

test('la biblioteca indica cuántas preguntas tiene cada quiz, sin enviar las preguntas', async () => {
  const make = async (name, count) => {
    const res = await fetch(`${baseUrl}/api/quizzes/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, tags: ['proves'], visibility: 'public', questions: Array.from({ length: count }, (_, i) => question(i + 1)) })
    });
    assert.equal(res.status, 200);
    return (await res.json()).id;
  };
  const threeId = await make('Tres preguntes', 3);
  const oneId = await make('Una pregunta', 1);
  const list = await (await fetch(`${baseUrl}/api/quizzes`)).json();
  const three = list.find((q) => q.id === threeId);
  const one = list.find((q) => q.id === oneId);
  assert.equal(three.questionCount, 3);
  assert.equal(one.questionCount, 1);
  assert.equal(three.questions, undefined, 'la lista no envia las preguntas');
});
