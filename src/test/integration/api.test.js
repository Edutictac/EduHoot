const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let httpServer;
let baseUrl;
let app;
let mongoClient;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  process.env.EDUHOOT_RESOURCES_TOKEN = 'test-catalogue-token';
  process.env.PUBLIC_IMPORT_SOURCE_URL = 'https://catalogue.example';
  ({ app, mongoClient } = require('../../server/server.js'));
  httpServer = app.listen(0);
  await new Promise((resolve) => httpServer.on('listening', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (mongoClient) await mongoClient.close().catch(() => {});
  if (mongod) await mongod.stop();
});

function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

function cookieHeader(res) {
  const cookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  return cookies
    .map((c) => c.split(';')[0])
    .filter((c) => c.startsWith('sessionId='))
    .join('; ');
}

const ADMIN = { email: 'admin@test.local', password: 'secret123', nickname: 'Admin Test' };

test('Commons imports playable local quizzes once and rejects unauthorised/invalid catalogues', async () => {
  const path = '/api/integrations/recursos/import-catalog';
  const items = [{ id: 789, name: 'Catálogo de prueba', tags: ['musica'], questions: [
    { question: 'Nota musical', answers: ['Do', 'Azul'], correct: 1, image: '/uploads/quiz-images/note.png' }
  ] }];
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) };
  assert.equal((await request(path, options)).status, 401);
  options.headers.Authorization = 'Bearer test-catalogue-token';
  const first = await request(path, options);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).imported, 1);
  const again = await request(path, options);
  assert.equal((await again.json()).skipped, 1);
  const quizzes = await (await request('/api/public-quizzes')).json();
  const local = quizzes.filter(q => q.name === 'Catálogo de prueba');
  assert.equal(local.length, 1);
  const detail = await (await request(`/api/quizzes/${local[0].id}`)).json();
  assert.equal(detail.questions.length, 1);
  assert.equal(detail.questions[0].image, 'https://catalogue.example/uploads/quiz-images/note.png');
  options.body = JSON.stringify({ items: [{ id: 99, name: 'Incomplete' }] });
  assert.equal((await request(path, options)).status, 400);
});

test('sirve la portada estática', async () => {
  const res = await request('/');
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /<!doctype html>/i);
});

test('GET /api/validate-pin rechaza un PIN inexistente', async () => {
  const res = await request('/api/validate-pin/000000');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { valid: false });
});

test('GET /api/auth/google/config reporta Google desactivado', async () => {
  const res = await request('/api/auth/google/config');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { enabled: false });
});

test('GET /api/auth/authentik/config exige configuración y limita a docentes', async () => {
  const res = await request('/api/auth/authentik/config');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { enabled: false, teacherOnly: true });
});

test('flujo de auth: bootstrap, login, me y logout', async () => {
  const bootstrap = await request('/api/auth/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN)
  });
  assert.equal(bootstrap.status, 200);
  assert.deepEqual(await bootstrap.json(), { ok: true });

  // Un segundo bootstrap ya no puede crear usuario.
  const duplicate = await request('/api/auth/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ADMIN)
  });
  assert.equal(duplicate.status, 400);

  // Login incorrecto → 401
  const badLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN.email, password: 'wrong' })
  });
  assert.equal(badLogin.status, 401);

  // Login correcto → 200 + cookie de sesión
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN.email, password: ADMIN.password })
  });
  assert.equal(login.status, 200);
  const json = await login.json();
  assert.equal(json.email, ADMIN.email);
  assert.equal(json.role, 'admin');
  const cookie = cookieHeader(login);
  assert.ok(cookie, 'debe fijar la cookie sessionId');

  // /me con sesión
  const me = await request('/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(me.status, 200);
  const meJson = await me.json();
  assert.equal(meJson.email, ADMIN.email);
  assert.equal(meJson.role, 'admin');

  // /me sin sesión → 401
  const anonMe = await request('/api/auth/me');
  assert.equal(anonMe.status, 401);

  // logout
  const logout = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookie }
  });
  assert.equal(logout.status, 200);
  const afterLogout = await request('/api/auth/me', { headers: { Cookie: cookie } });
  assert.equal(afterLogout.status, 401);
});

test('CRUD de quiz: crear, leer y listar en público', async () => {
  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN.email, password: ADMIN.password })
  });
  const cookie = cookieHeader(login);

  const payload = {
    name: 'Quiz de integración',
    tags: ['ciencias', 'naturaleza'],
    visibility: 'public',
    allowClone: true,
    questions: [
      {
        question: '¿Cuál es el planeta rojo?',
        answers: ['Marte', 'Venus', 'Júpiter', 'Saturno'],
        correct: 1,
        type: 'quiz',
        time: 20
      }
    ]
  };

  const created = await request('/api/quizzes/local', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(payload)
  });
  assert.equal(created.status, 200);
  const createdJson = await created.json();
  assert.equal(createdJson.ok, true);
  const id = createdJson.id;
  assert.ok(id, 'debe devolver un id');

  const fetched = await request(`/api/quizzes/${id}`);
  assert.equal(fetched.status, 200);
  const quiz = await fetched.json();
  assert.equal(quiz.name, 'Quiz de integración');
  assert.equal(quiz.visibility, 'public');
  assert.equal(quiz.questions.length, 1);

  const pub = await request('/api/public-quizzes');
  assert.equal(pub.status, 200);
  const list = await pub.json();
  assert.ok(Array.isArray(list));
  assert.ok(
    list.some((q) => q.id === id),
    'el quiz público debe aparecer en /api/public-quizzes'
  );
});
