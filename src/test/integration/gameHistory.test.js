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


// Sessió real (com un docent amb compte): el socket rep la mateixa forma que req.user.
const { createSession } = require('../../server/services/sessions');

function connectWithCookie(cookie) {
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

async function waitFor(fn, timeoutMs = 4000) {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error('Temps esgotat esperant el registre');
    await new Promise((r) => setTimeout(r, 50));
  }
}

test('registre de partides: el docent amb compte té la partida guardada; l\'anònim no', async () => {
  // Dins del test: els repositoris han de veure la base de dades en memòria que arranca before().
  const { getGameHistoryCollection } = require('../../server/data/repositories');
  const docent = { _id: 'docent-test-1', email: 'docent@example.invalid', role: 'editor', nickname: 'Docent' };
  const sessionId = createSession(docent, 'local');
  const col = await getGameHistoryCollection();

  // Anfitrió amb sessió: crea la partida autoritme i acaba amb 2 alumnes.
  const host = await connectWithCookie(`sessionId=${sessionId}`);
  host.emit('host-join', { id: quizId });
  const [{ pin }] = await host.next('showGamePin');
  const students = [];
  for (const name of ['Ana', 'Bruno']) {
    const s = await connect();
    s.token = `tok-${name}-${pin}`;
    s.emit('player-join', { pin: String(pin), name, icon: '🦊', token: s.token });
    await s.next('playerJoinAck');
    students.push(s);
  }
  host.emit('startGame', { ...START_OPTS, mode: 'selfPaced', pin: String(pin) });
  await Promise.all(students.map((s) => s.next('gameStartedPlayer')));
  await host.next('gameStarted');
  host.emit('spEnd');
  await students[0].next('GameOver');

  const saved = await waitFor(() => col.findOne({ ownerId: 'docent-test-1', pin: String(pin) }));
  assert.equal(saved.mode, 'selfPaced');
  assert.equal(saved.playersCount, 2);
  assert.match(saved.csv, /Ana/);

  // Anfitrió sense sessió: la mateixa partida no es guarda en cap compte.
  const anonHost = await connect();
  anonHost.emit('host-join', { id: quizId });
  const [{ pin: anonPin }] = await anonHost.next('showGamePin');
  anonHost.emit('startGame', { ...START_OPTS, mode: 'selfPaced', pin: String(anonPin) });
  await anonHost.next('gameStarted');
  anonHost.emit('spEnd');
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(await col.countDocuments({ pin: String(anonPin) }), 0);
});
