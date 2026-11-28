const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

// /dev (maquetas, p. ej. la prueba de concepto de la correspondencia) se sirve en
// desarrollo, sin necesidad de sesión. Fuera de desarrollo: devPagesOff.test.js.
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

function request(path) {
  return fetch(`${baseUrl}${path}`, { redirect: 'manual' });
}

test('/dev se sirve en desarrollo, sin sesión', async () => {
  for (const path of ['/dev/correspondencia/', '/dev/correspondencia/index.html', '/dev/correspondencia/poc.js', '/dev/correspondencia/poc.css']) {
    assert.equal((await request(path)).status, 200, path);
  }
  assert.match(await (await request('/dev/correspondencia/')).text(), /poc\.js/);
});
