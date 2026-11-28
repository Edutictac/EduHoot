// Las imágenes de los quizzes viven fuera del proyecto (QUIZ_IMAGES_DIR) y se sirven en /uploads/quiz-images/.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let httpServer;
let baseUrl;
let mongoClient;
const imagesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eduhoot-quiz-images-'));
const FILE = 'probe-0123456789abcdef.png';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

before(async () => {
  fs.writeFileSync(path.join(imagesDir, FILE), PNG);
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  process.env.EDUHOOT_RESOURCES_TOKEN = 'test-catalogue-token';
  process.env.PUBLIC_IMPORT_SOURCE_URL = 'https://catalogue.example';
  process.env.QUIZ_IMAGES_DIR = imagesDir;
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
  fs.rmSync(imagesDir, { recursive: true, force: true });
});

test('una imagen de QUIZ_IMAGES_DIR se sirve en /uploads/quiz-images/ con su tipo', async () => {
  const res = await fetch(`${baseUrl}/uploads/quiz-images/${FILE}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);
});

test('una imagen que no existe responde 404 y no se busca en la carpeta del proyecto', async () => {
  const res = await fetch(`${baseUrl}/uploads/quiz-images/no-existe.png`);
  assert.equal(res.status, 404);
});
