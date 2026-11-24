// Modo autoritme con sockets REALES: servidor arrancado en un puerto, MongoDB en memoria y
// clientes Socket.IO por red local (anfitrión y alumnos). Juega partidas completas y comprueba
// el cableado entre piezas (redirección, eventos, puntuación, cierre, informe), que los tests
// con sockets simulados no pueden ver.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io: connectClient } = require('socket.io-client');

let mongod;
let httpServer;
let baseUrl;
let mongoClient;
let games;
let quizId;
const clients = [];

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  process.env.EDUHOOT_RESOURCES_TOKEN = 'test-catalogue-token';
  process.env.PUBLIC_IMPORT_SOURCE_URL = 'https://catalogue.example';
  let server;
  ({ server, mongoClient, games } = require('../../server/server.js'));
  // El `server` exportado es el que lleva Socket.IO (app.listen crearía otro sin él).
  httpServer = server.listen(0, '127.0.0.1');
  await new Promise((resolve) => httpServer.on('listening', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;

  // Quiz público de 3 preguntas (la correcta es siempre la 2.ª opción salvo la última, que es la 1.ª).
  const items = [{ id: 4242, name: 'Quiz de sockets', tags: [], questions: [
    { question: 'P1', answers: ['a', 'b', 'c', 'd'], correct: 2 },
    { question: 'P2', answers: ['a', 'b', 'c', 'd'], correct: 2 },
    { question: 'P3', answers: ['a', 'b', 'c', 'd'], correct: 1 }
  ] }];
  const res = await fetch(`${baseUrl}/api/integrations/recursos/import-catalog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-catalogue-token' },
    body: JSON.stringify({ items })
  });
  assert.equal(res.status, 200);
  const list = await (await fetch(`${baseUrl}/api/public-quizzes`)).json();
  quizId = list.find((q) => q.name === 'Quiz de sockets').id;
});

after(async () => {
  clients.forEach((c) => c.close());
  (games.games || []).forEach((g) => { if (g.cleanupTimer) clearTimeout(g.cleanupTimer); });
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (mongoClient) await mongoClient.close().catch(() => {});
  if (mongod) await mongod.stop();
});

// Cliente que guarda todos los eventos recibidos; `next(evento)` espera el siguiente sin consumir antes.
function connect() {
  return new Promise((resolve, reject) => {
    const socket = connectClient(baseUrl, { transports: ['websocket'], reconnection: false, forceNew: true });
    socket.log = [];
    socket.cursor = {};
    socket.onAny((event, ...args) => { socket.log.push({ event, args }); });
    socket.next = (event, timeoutMs = 4000) => new Promise((res, rej) => {
      const started = Date.now();
      (function poll() {
        const from = socket.cursor[event] || 0;
        const idx = socket.log.findIndex((e, i) => i >= from && e.event === event);
        if (idx >= 0) { socket.cursor[event] = idx + 1; return res(socket.log[idx].args); }
        if (Date.now() - started > timeoutMs) return rej(new Error(`Sin «${event}» a tiempo. Recibidos: ${socket.log.map((e) => e.event).join(', ')}`));
        setTimeout(poll, 15);
      })();
    });
    socket.count = (event) => socket.log.filter((e) => e.event === event).length;
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
    clients.push(socket);
  });
}

// Anfitrión con partida creada y alumnos unidos (con su token), sin iniciar.
async function lobby(names) {
  const host = await connect();
  host.emit('host-join', { id: quizId });
  const [{ pin }] = await host.next('showGamePin');
  const students = [];
  for (const name of names) {
    const s = await connect();
    s.token = `tok-${name}-${pin}`;
    s.emit('player-join', { pin: String(pin), name, icon: '🦊', token: s.token });
    await s.next('playerJoinAck');
    students.push(s);
  }
  return { host, pin: String(pin), students };
}

const START_OPTS = { randomQuestions: false, randomAnswers: false, sendToStudents: true, showScoresBetween: true, showCorrectAnswers: true, streak: true };

// Como al cambiar de página: cada alumno abre un socket nuevo y retoma su sitio con el token.
async function enterGame(pin, student, name) {
  const s = await connect();
  s.emit('player-join-game', { id: student.id, pin, name, token: student.token });
  return s;
}


// Cliente amb cookies (com un navegador): el token del dispositiu viatja a l'handshake del socket.
function connectWith(cookie) {
  return new Promise((resolve, reject) => {
    const socket = connectClient(baseUrl, { transports: ['websocket'], reconnection: false, forceNew: true, extraHeaders: cookie ? { cookie } : {} });
    socket.log = [];
    socket.cursor = {};
    socket.onAny((event, ...args) => { socket.log.push({ event, args }); });
    socket.next = (event, timeoutMs = 4000) => new Promise((res, rej) => {
      const started = Date.now();
      (function poll() {
        const from = socket.cursor[event] || 0;
        const idx = socket.log.findIndex((e, i) => i >= from && e.event === event);
        if (idx >= 0) { socket.cursor[event] = idx + 1; return res(socket.log[idx].args); }
        if (Date.now() - started > timeoutMs) return rej(new Error(`Sin «${event}» a tiempo. Recibidos: ${socket.log.map((e) => e.event).join(', ')}`));
        setTimeout(poll, 15);
      })();
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
    clients.push(socket);
  });
}

const localQuiz = (name) => ({ name, tags: ['proves'], questions: [{ question: 'P1', answers: ['a', 'b', 'c', 'd'], correct: 2 }] });

async function createLocal(body, headers = {}) {
  const res = await fetch(`${baseUrl}/api/quizzes/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  return { status: res.status, body: await res.json(), setCookie: res.headers.get('set-cookie') || '' };
}

test('lectura de quizzes: públic i per enllaç per a tothom; privat només per al seu dispositiu', async () => {
  // Públic (catàleg): lectura anònima.
  const pub = await fetch(`${baseUrl}/api/quizzes/${quizId}`);
  assert.equal(pub.status, 200);

  // Per enllaç (no listat): lectura anònima.
  const unlisted = await createLocal({ ...localQuiz('Enllaç'), visibility: 'unlisted' });
  assert.equal(unlisted.status, 200);
  const linkRead = await fetch(`${baseUrl}/api/quizzes/${unlisted.body.id}`);
  assert.equal(linkRead.status, 200);

  // Privat (local, «Només jo»): el dispositiu que el va crear el veu; els altres no.
  const priv = await createLocal({ ...localQuiz('Privat'), visibility: 'private' }, { 'x-owner-token': 'tok-A' });
  assert.equal(priv.status, 200);
  const id = priv.body.id;
  assert.equal((await fetch(`${baseUrl}/api/quizzes/${id}`)).status, 403, 'anònim: 403');
  assert.equal((await fetch(`${baseUrl}/api/quizzes/${id}`, { headers: { 'x-owner-token': 'tok-B' } })).status, 403, 'altre dispositiu: 403');
  assert.equal((await fetch(`${baseUrl}/api/quizzes/${id}`, { headers: { 'x-owner-token': 'tok-A' } })).status, 200, 'mateix dispositiu: 200');
  assert.equal((await fetch(`${baseUrl}/api/quizzes/${id}`, { headers: { cookie: 'eduh_owner=tok-A' } })).status, 200, 'cookie del dispositiu: 200');
  // També la descàrrega (CSV) i l'XML de Moodle.
  assert.equal((await fetch(`${baseUrl}/api/quizzes/${id}/csv`)).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/quizzes/${id}/moodle-xml`)).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/quizzes/${id}/csv`, { headers: { cookie: 'eduh_owner=tok-A' } })).status, 200);
});

test('crear un quiz local privat fixa la cookie del dispositiu (HttpOnly)', async () => {
  const priv = await createLocal({ ...localQuiz('Amb cookie'), visibility: 'private', ownerToken: 'tok-C' });
  assert.equal(priv.status, 200);
  assert.match(priv.setCookie, /eduh_owner=tok-C/);
  assert.match(priv.setCookie, /HttpOnly/);
  assert.match(priv.setCookie, /SameSite=Lax/);
});

test('l\'anfitrió no pot iniciar una partida amb el quiz privat d\'un altre dispositiu', async () => {
  const priv = await createLocal({ ...localQuiz('Només del meu'), visibility: 'private', ownerToken: 'tok-D' });
  const id = priv.body.id;
  const other = await connectWith(null);
  other.emit('host-join', { id });
  await other.next('noGameFound');

  const owner = await connectWith('eduh_owner=tok-D');
  owner.emit('host-join', { id });
  await owner.next('showGamePin');
});

test('autoritme acabat: en reconnectar l\'anfitrió la partida segueix tancada (no es reobri)', async () => {
  const { host, pin, students } = await lobby(['Ana', 'Bruno']);
  host.emit('startGame', { ...START_OPTS, mode: 'selfPaced', pin });
  await Promise.all(students.map((s) => s.next('gameStartedPlayer')));
  await host.next('gameStarted');
  const ana = await enterGame(pin, students[0], 'Ana');
  await ana.next('spIdle');

  host.emit('spEnd');
  await ana.next('spFinished');

  const back = await connect();
  back.emit('host-join-game', { id: host.id, pin });
  await back.next('GameOver');
  ana.emit('spAnswer', 2);
  const [rejected] = await ana.next('answerRejected');
  assert.equal(rejected.reason, 'game-over');
});
