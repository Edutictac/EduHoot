const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createDevOidcServer } = require('../../scripts/dev-oidc');

// Flux d'Authentik complet contra l'OIDC simulat de docker compose (scripts/dev-oidc.js).
let mongod;
let oidcServer;
let httpServer;
let baseUrl;
let mongoClient;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  oidcServer = createDevOidcServer({ issuer: 'http://pending', clientId: 'eduhoot-dev', clientSecret: 'dev-secret' });
  oidcServer.listen(0, '127.0.0.1');
  await new Promise((resolve) => oidcServer.on('listening', resolve));
  const oidcUrl = `http://127.0.0.1:${oidcServer.address().port}`;
  process.env.AUTHENTIK_ISSUER = oidcUrl;
  process.env.AUTHENTIK_CLIENT_ID = 'eduhoot-dev';
  process.env.AUTHENTIK_CLIENT_SECRET = 'dev-secret';
  process.env.AUTHENTIK_AUTHORIZATION_URL = `${oidcUrl}/authorize`;
  process.env.AUTHENTIK_TOKEN_URL = `${oidcUrl}/token`;
  process.env.AUTHENTIK_USERINFO_URL = `${oidcUrl}/userinfo`;
  let app;
  ({ app, mongoClient } = require('../../server/server.js'));
  httpServer = app.listen(0);
  await new Promise((resolve) => httpServer.on('listening', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (oidcServer) await new Promise((resolve) => oidcServer.close(resolve));
  if (mongoClient) await mongoClient.close().catch(() => {});
  if (mongod) await mongod.stop();
  for (const key of ['ISSUER', 'CLIENT_ID', 'CLIENT_SECRET', 'AUTHORIZATION_URL', 'TOKEN_URL', 'USERINFO_URL']) {
    delete process.env[`AUTHENTIK_${key}`];
  }
});

function cookieValue(res, name) {
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const found = cookies.map((c) => c.split(';')[0]).find((c) => c.startsWith(`${name}=`));
  return found || '';
}

// Recorre start → authorize → approve → callback com ho faria el navegador.
async function loginAs(email) {
  const start = await fetch(`${baseUrl}/api/auth/authentik/start?next=%2Fcreate%2F`, { redirect: 'manual' });
  assert.equal(start.status, 302);
  const stateCookie = cookieValue(start, 'authentikOAuthState');
  const authorizeUrl = new URL(start.headers.get('location'));
  const authorizePage = await fetch(authorizeUrl);
  assert.equal(authorizePage.status, 200);
  assert.ok((await authorizePage.text()).includes(email), 'l’usuari apareix a la pàgina del simulador');
  const approveUrl = new URL('/authorize/approve', authorizeUrl);
  approveUrl.search = authorizeUrl.search;
  approveUrl.searchParams.set('user', email);
  const approve = await fetch(approveUrl, { redirect: 'manual' });
  assert.equal(approve.status, 302);
  const callback = await fetch(approve.headers.get('location'), { redirect: 'manual', headers: { Cookie: stateCookie } });
  assert.equal(callback.status, 302);
  return { location: callback.headers.get('location'), session: cookieValue(callback, 'sessionId') };
}

test('un docent del seed entra per l’OIDC simulat i conserva el seu rol', async () => {
  const { getUsersCollection } = require('../../server/data/repositories');
  const users = await getUsersCollection();
  await users.insertOne({ email: 'admin@exemple.local', role: 'admin', nickname: 'Admin de prova' });

  const { location, session } = await loginAs('admin@exemple.local');
  assert.equal(location, '/create/?authentik=ok');
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: session } });
  assert.equal(me.status, 200);
  const user = await me.json();
  assert.equal(user.email, 'admin@exemple.local');
  assert.equal(user.role, 'admin');
});

test('un compte sense rol docent és rebutjat', async () => {
  const { location, session } = await loginAs('alumne@exemple.local');
  assert.equal(location, '/create/?authentik=error');
  assert.equal(session, '');
});

test('el simulador rebutja un code_verifier incorrecte (PKCE)', async () => {
  const oidcUrl = process.env.AUTHENTIK_ISSUER;
  const approve = await fetch(`${oidcUrl}/authorize/approve?client_id=eduhoot-dev&redirect_uri=http%3A%2F%2Fx%2Fcb&code_challenge=abc&user=docent1%40exemple.local`, { redirect: 'manual' });
  const code = new URL(approve.headers.get('location')).searchParams.get('code');
  const token = await fetch(`${oidcUrl}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: 'eduhoot-dev', client_secret: 'dev-secret', redirect_uri: 'http://x/cb', grant_type: 'authorization_code', code_verifier: 'incorrecte' }).toString()
  });
  assert.equal(token.status, 400);
});
