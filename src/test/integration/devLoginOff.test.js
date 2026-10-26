const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Fora de desenvolupament, /dev/login no ha d'existir.
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

test('/dev/login no existix fora de desenvolupament', async () => {
  const res = await fetch(`${baseUrl}/dev/login`);
  assert.equal(res.status, 404);
});
