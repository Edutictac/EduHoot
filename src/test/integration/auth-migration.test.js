const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
let server, baseUrl, sessions, mongoClient;
before(async () => {
  process.env.AUTHENTIK_ISSUER = 'https://identity.example/application/o/eduhoot';
  process.env.AUTHENTIK_CLIENT_ID = 'migration-fixture';
  process.env.AUTHENTIK_CLIENT_SECRET = 'fixture-only';
  process.env.AUTHENTIK_ONLY = 'false';
  const module = require('../../server/server');
  sessions = module.sessions;
  mongoClient = module.mongoClient;
  server = module.app.listen(0);
  await new Promise(resolve => server.on('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { await new Promise(resolve => server.close(resolve)); await mongoClient.close(); });
test('deadline disables all legacy authentication routes and existing legacy HTTP sessions', async () => {
  process.env.AUTHENTIK_MIGRATION_END = new Date(Date.now() + 86400000).toISOString();
  assert.equal((await (await fetch(`${baseUrl}/api/auth/migration`)).json()).authentikOnly, false);
  sessions.set('old-fixture', { userId: 'old', email: 'old@example.org', role: 'editor', provider: 'google' });
  sessions.set('new-fixture', { userId: 'new', email: 'new@example.org', role: 'admin', provider: 'authentik' });
  process.env.AUTHENTIK_MIGRATION_END = new Date(Date.now() - 1000).toISOString();
  assert.equal((await (await fetch(`${baseUrl}/api/auth/migration`)).json()).authentikOnly, true);
  for (const route of ['bootstrap', 'login', 'request-reset', 'reset']) {
    assert.equal((await fetch(`${baseUrl}/api/auth/${route}`, { method: 'POST' })).status, 404);
  }
  for (const route of ['google/start', 'google/callback']) {
    assert.equal((await fetch(`${baseUrl}/api/auth/${route}`)).status, 404);
  }
  assert.equal((await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: 'sessionId=old-fixture' } })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: 'sessionId=new-fixture' } })).status, 200);
  for (const route of ['users', 'reset-admin']) {
    assert.equal((await fetch(`${baseUrl}/api/auth/${route}`, { method: 'POST', headers: { Cookie: 'sessionId=new-fixture' } })).status, 404);
  }
  assert.equal((await fetch(`${baseUrl}/api/validate-pin/000000`)).status, 200);
});
