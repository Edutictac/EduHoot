const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

// En stage (NODE_ENV=staging), /dev solo se sirve con sesión de rol admin.
let mongod;
let httpServer;
let baseUrl;
let mongoClient;
let previousNodeEnv;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'staging';
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

function request(path, cookie) {
  return fetch(`${baseUrl}${path}`, { redirect: 'manual', headers: cookie ? { cookie } : {} });
}

function sessionFor(role) {
  const { createSession } = require('../../server/services/sessions');
  return `sessionId=${createSession({ id: `u-${role}`, email: `${role}@test.local`, role })}`;
}

test('/dev en stage: sin sesión 401, con rol editor 403, con rol admin 200', async () => {
  for (const path of ['/dev/correspondencia/', '/dev/anfitrion/poc.js']) {
    assert.equal((await request(path)).status, 401, `${path} sin sesión`);
    assert.equal((await request(path, sessionFor('editor'))).status, 403, `${path} editor`);
    assert.equal((await request(path, sessionFor('admin'))).status, 200, `${path} admin`);
  }
});

test('/dev en stage: el admin no ve la página de entrada de desarrollo', async () => {
  assert.equal((await request('/dev/login', sessionFor('admin'))).status, 404);
});
