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

test('partida completa a su ritmo: cada alumno con su reloj, resultado, cierre y informe', async () => {
  const { host, pin, students } = await lobby(['Ana', 'Bruno']);
  host.emit('startGame', { ...START_OPTS, mode: 'selfPaced', pin });

  // El servidor manda al alumnado a la pantalla de autoritme y no lanza cuenta atrás común.
  const modes = await Promise.all(students.map((s) => s.next('gameStartedPlayer')));
  assert.deepEqual(modes.map((m) => m[0].mode), ['selfPaced', 'selfPaced']);
  await host.next('gameStarted');

  const ana = await enterGame(pin, students[0], 'Ana');
  const bruno = await enterGame(pin, students[1], 'Bruno');
  await ana.next('spIdle');
  await bruno.next('spIdle');
  assert.equal(ana.count('questionCountdown'), 0);

  // Ana avanza sola: contesta bien la 1 y pasa a la 2; Bruno se queda en la 1.
  ana.emit('spNext');
  const [q1] = await ana.next('spQuestion');
  assert.equal(q1.question, 'P1');
  assert.equal(q1.questionNumber, 1);
  assert.equal(q1.totalQuestions, 3);
  assert.deepEqual(q1.answers, ['a', 'b', 'c', 'd']);
  ana.emit('spAnswer', 2);
  const [res1] = await ana.next('spResult');
  assert.equal(res1.outcome, 'correct');
  assert.ok(res1.points > 900, `puntos ${res1.points}`);
  assert.equal(res1.streak, 1);
  assert.deepEqual(res1.meta.correctAnswers, [2]);
  ana.emit('spNext');
  const [q2] = await ana.next('spQuestion');
  assert.equal(q2.question, 'P2');

  bruno.emit('spNext');
  const [b1] = await bruno.next('spQuestion');
  assert.equal(b1.question, 'P1');

  // El anfitrión ve el avance de cada uno, sin puntos.
  const hostConn = await connect();
  hostConn.emit('host-join-game', { id: host.id, pin });
  const [prog] = await hostConn.next('spProgress');
  const byName = Object.fromEntries(prog.map((p) => [p.name, p]));
  assert.equal(byName.Ana.question, 2);
  assert.equal(byName.Ana.answered, 1);
  assert.equal(byName.Bruno.question, 1);
  assert.equal(byName.Bruno.answered, 0);
  assert.equal(byName.Ana.score, undefined);

  // Ana acaba las preguntas (la 2 mal, la 3 bien); Bruno, sin acabar.
  ana.emit('spAnswer', 4);
  assert.equal((await ana.next('spResult'))[0].outcome, 'incorrect');
  ana.emit('spNext');
  await ana.next('spQuestion');
  ana.emit('spAnswer', 1);
  assert.equal((await ana.next('spResult'))[0].outcome, 'correct');
  ana.emit('spNext');
  const [anaDone] = await ana.next('spFinished');
  assert.equal(anaDone.correctCount, 2);
  assert.equal(anaDone.total, 3);

  // El anfitrión cierra: Bruno recibe su resumen (sin puntos) y el podio sale con Ana primera.
  hostConn.emit('spEnd');
  const [over] = await hostConn.next('GameOver');
  assert.equal(over.num1, 'Ana');
  const [brunoDone] = await bruno.next('spFinished');
  assert.equal(brunoDone.score, 0);
  assert.equal(brunoDone.rank, 2);
  await bruno.next('GameOver');

  // Tras el cierre ya no se juega.
  bruno.emit('spAnswer', 2);
  const [rej] = await bruno.next('answerRejected');
  assert.ok(['game-over', 'no-question'].includes(rej.reason));

  // Informe CSV con el resultado de cada alumno.
  const csvRes = await fetch(`${baseUrl}/api/live-games/${pin}/report.csv?hostId=${encodeURIComponent(hostConn.id)}`);
  assert.equal(csvRes.status, 200);
  const csv = await csvRes.text();
  assert.match(csv, /Ana/);
  assert.match(csv, /Bruno/);
});

test('el alumno que entra tarde empieza en la primera pregunta', async () => {
  const { host, pin, students } = await lobby(['Eva']);
  host.emit('startGame', { ...START_OPTS, mode: 'selfPaced', pin });
  await students[0].next('gameStartedPlayer');
  await host.next('gameStarted');

  const late = await connect();
  late.token = 'tok-tarde';
  late.emit('player-join', { pin, name: 'Tarde', icon: '🐶', token: late.token });
  await late.next('playerJoinAck');
  const [started] = await late.next('gameStartedPlayer');
  assert.equal(started.mode, 'selfPaced');
  const lateGame = await enterGame(pin, late, 'Tarde');
  await lateGame.next('spIdle');
  lateGame.emit('spNext');
  assert.equal((await lateGame.next('spQuestion'))[0].question, 'P1');
});

test('reconexión a mitad de pregunta: se retoma la misma pregunta con el tiempo que quedaba', async () => {
  const { host, pin, students } = await lobby(['Ivo']);
  host.emit('startGame', { ...START_OPTS, mode: 'selfPaced', pin, timePerQuestion: 30 });
  await students[0].next('gameStartedPlayer');
  const first = await enterGame(pin, students[0], 'Ivo');
  await first.next('spIdle');
  first.emit('spNext');
  const [q] = await first.next('spQuestion');
  assert.equal(q.time, 30);
  await new Promise((r) => setTimeout(r, 1200));
  first.close();

  const again = await connect();
  again.emit('player-join-game', { pin, name: 'Ivo', token: students[0].token });
  const [q2] = await again.next('spQuestion');
  assert.equal(q2.question, 'P1');
  assert.ok(q2.time <= 29 && q2.time >= 25, `tiempo restante ${q2.time}`);

  // Responde y vuelve a conectar: ya contestada, no puntúa dos veces.
  again.emit('spAnswer', 2);
  await again.next('spResult');
  again.emit('spAnswer', 2);
  assert.equal((await again.next('answerRejected'))[0].reason, 'already-answered');
});

test('el servidor manda sobre el reloj: spTimeUp antes de tiempo no cierra la pregunta', async () => {
  const { host, pin, students } = await lobby(['Noa']);
  host.emit('startGame', { ...START_OPTS, mode: 'selfPaced', pin });
  await students[0].next('gameStartedPlayer');
  const s = await enterGame(pin, students[0], 'Noa');
  await s.next('spIdle');
  s.emit('spNext');
  await s.next('spQuestion');
  s.emit('spTimeUp');
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(s.count('spResult'), 0);
  // Pedir la siguiente sin contestar tampoco salta la pregunta: se reenvía la misma.
  s.emit('spNext');
  const [again] = await s.next('spQuestion');
  assert.equal(again.question, 'P1');
});

test('«Mostrar respuestas» desactivado: el resultado no revela la correcta', async () => {
  const { host, pin, students } = await lobby(['Pau']);
  host.emit('startGame', { ...START_OPTS, showCorrectAnswers: false, mode: 'selfPaced', pin });
  await students[0].next('gameStartedPlayer');
  const s = await enterGame(pin, students[0], 'Pau');
  await s.next('spIdle');
  s.emit('spNext');
  await s.next('spQuestion');
  s.emit('spAnswer', 3);
  const [res] = await s.next('spResult');
  assert.equal(res.outcome, 'incorrect');
  assert.equal(res.meta.correctAnswers, undefined);
});

test('el modo en directo sigue igual: redirección con modo live y cuenta atrás común', async () => {
  const { host, pin, students } = await lobby(['Lia']);
  host.emit('startGame', { ...START_OPTS, pin });
  const [started] = await students[0].next('gameStartedPlayer');
  assert.equal(started.mode, 'live');
  await students[0].next('questionCountdown');
  await host.next('gameStarted');
});
