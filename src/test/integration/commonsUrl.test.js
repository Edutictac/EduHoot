const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Commons local: el xip de les pàgines ha d'apuntar al portal del centre.
const LOCAL_COMMONS = 'http://edutictac.local:8082';

let mongod;
let httpServer;
let baseUrl;
let mongoClient;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  process.env.EDUTICTAC_COMMONS_URL = LOCAL_COMMONS + '/';
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
  delete process.env.EDUTICTAC_COMMONS_URL;
});

for (const path of ['/', '/join.html', '/solo/', '/multiplayer/', '/host/', '/player/', '/create/']) {
  test(`${path}: el xip apunta al Commons configurat`, async () => {
    const res = await fetch(baseUrl + path);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes(`data-base="${LOCAL_COMMONS}"`), 'data-base local');
    assert.ok(html.includes(`src="${LOCAL_COMMONS}/assets/account-widget.js"`), 'widget local');
    assert.ok(!html.includes('commons.edutictac.es'), 'sense el Commons d’internet');
  });
}
