// Deures asíncrons (feature 1), part de servidor: HTTP real contra el servidor, MongoDB en memoria.
// El tiempo se controla desplazando la fecha límite en la base de datos (no se espera de verdad).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let httpServer;
let baseUrl;
let mongoClient;
let quizId;
let repos;
const TEACHER = 'sid-teacher';
const OTHER = 'sid-other';

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  process.env.EDUHOOT_RESOURCES_TOKEN = 'test-catalogue-token';
  process.env.PUBLIC_IMPORT_SOURCE_URL = 'https://catalogue.example';
  let server;
  let sessionsModule;
  ({ server, mongoClient } = require('../../server/server.js'));
  sessionsModule = require('../../server/services/sessions');
  repos = require('../../server/data/repositories');
  sessionsModule.sessions.set(TEACHER, { userId: 't1', email: 't1@example.org', role: 'editor', provider: 'authentik' });
  sessionsModule.sessions.set(OTHER, { userId: 't2', email: 't2@example.org', role: 'editor', provider: 'authentik' });
  httpServer = server.listen(0, '127.0.0.1');
  await new Promise((resolve) => httpServer.on('listening', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
  const items = [{ id: 5151, name: 'Quiz de deures', tags: [], questions: [
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
  quizId = list.find((q) => q.name === 'Quiz de deures').id;
});

after(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (mongoClient) await mongoClient.close().catch(() => {});
  if (mongod) await mongod.stop();
});

async function call(method, path, body, session) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(session ? { Cookie: `sessionId=${session}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, body: type.includes('json') ? await res.json() : await res.text() };
}

const inDays = (d) => Date.now() + d * 24 * 3600 * 1000;
// Sin barajar las respuestas (por defecto sí) para saber cuál es la correcta.
async function createHomework(extra = {}) {
  const { options, ...rest } = extra;
  const out = await call('POST', '/api/homeworks', { quizId, title: 'Deures de prova', deadline: inDays(2), maxAttempts: 1, ...rest, options: { randomAnswers: false, ...options } }, TEACHER);
  assert.equal(out.status, 200, JSON.stringify(out.body));
  return out.body.homework;
}
async function join(code, name, extra = {}) {
  const out = await call('POST', `/api/homework/${code}/join`, { name, icon: '🦊', ...extra });
  return out;
}
async function act(code, who, op, value) {
  const out = await call('POST', `/api/homework/${code}/act`, { name: who.name, recovery: who.recovery, op, value });
  assert.equal(out.status, 200, JSON.stringify(out.body));
  return out.body.events;
}
const ev = (events, name) => (events.find((e) => e.name === name) || {}).data;

test('el docente crea el deber: validaciones y permisos', async () => {
  assert.equal((await call('POST', '/api/homeworks', { quizId, deadline: inDays(1) })).status, 401);
  assert.equal((await call('POST', '/api/homeworks', { quizId, deadline: Date.now() + 1000 }, TEACHER)).body.error, 'deadline-too-soon');
  // Máximo 30 días: 31 se rechaza y 29 se acepta.
  assert.equal((await call('POST', '/api/homeworks', { quizId, deadline: inDays(31) }, TEACHER)).body.error, 'deadline-too-far');
  assert.equal((await call('POST', '/api/homeworks', { quizId, deadline: inDays(29) }, TEACHER)).status, 200);
  assert.equal((await call('POST', '/api/homeworks', { quizId, deadline: inDays(1), maxAttempts: 99 }, TEACHER)).body.error, 'bad-attempts');
  assert.equal((await call('POST', '/api/homeworks', { quizId: 'no-existe', deadline: inDays(1) }, TEACHER)).status, 404);
  const hw = await createHomework({ maxAttempts: 3 });
  assert.match(hw.code, /^[A-HJKMNP-Z2-9]{8}$/);
  assert.equal(hw.maxAttempts, 3);
  assert.equal(hw.totalQuestions, 3);
  assert.equal(hw.open, true);
  const info = await call('GET', `/api/homework/${hw.code}`);
  assert.equal(info.body.title, 'Deures de prova');
  assert.equal(info.body.questions, undefined);
  assert.equal((await call('GET', '/api/homework/ZZZZZZZZ')).status, 404);
});

test('alta con código de recuperación, nombre ocupado y reentrada', async () => {
  const hw = await createHomework();
  assert.equal((await join(hw.code, 'a')).body.error, 'bad-name');
  const ana = await join(hw.code, 'Ana');
  assert.equal(ana.status, 200);
  assert.match(ana.body.student.recovery, /^[A-HJKMNP-Z2-9]{6}$/);
  assert.equal(ana.body.student.name, 'Ana');
  // El nombre no distingue mayúsculas y no se puede reutilizar sin el código.
  assert.equal((await join(hw.code, 'ANA')).body.error, 'name-taken');
  // Con nombre y código (en minúsculas, con guion) se reentra.
  const again = await join(hw.code, 'ana', { recovery: ana.body.student.recovery.toLowerCase().replace(/^(...)/, '$1-') });
  assert.equal(again.status, 200);
  assert.equal(again.body.student.name, 'Ana');
  const wrong = await join(hw.code, 'Ana', { recovery: 'AAAAAA' });
  assert.equal(wrong.status, 401);
});

test('partida completa: preguntas sin la respuesta, puntos del servidor y resumen final', async () => {
  const hw = await createHomework();
  const me = (await join(hw.code, 'Bea')).body.student;
  assert.deepEqual(await act(hw.code, me, 'resume'), [{ name: 'spIdle', data: null }]);
  let events = await act(hw.code, me, 'next');
  const q1 = ev(events, 'spQuestion');
  assert.equal(q1.question, 'P1');
  assert.equal(q1.questionNumber, 1);
  assert.equal(q1.totalQuestions, 3);
  assert.equal(q1.correctAnswers, undefined);
  assert.equal(q1.correct, undefined);
  // Pedir «siguiente» sin contestar reenvía la misma pregunta (no se salta).
  assert.equal(ev(await act(hw.code, me, 'next'), 'spQuestion').question, 'P1');
  events = await act(hw.code, me, 'answer', 2);
  const r1 = ev(events, 'spResult');
  assert.equal(r1.outcome, 'correct');
  assert.ok(r1.points > 900);
  assert.equal(r1.ranking, undefined);
  assert.equal(ev(await act(hw.code, me, 'answer', 2), 'answerRejected').reason, 'already-answered');
  await act(hw.code, me, 'next');
  assert.equal(ev(await act(hw.code, me, 'answer', 4), 'spResult').outcome, 'incorrect');
  await act(hw.code, me, 'next');
  assert.equal(ev(await act(hw.code, me, 'answer', 1), 'spResult').outcome, 'correct');
  const done = ev(await act(hw.code, me, 'next'), 'spFinished');
  assert.equal(done.correctCount, 2);
  assert.equal(done.attemptNo, 1);
  assert.equal(done.canRetry, false);
  assert.equal(done.bestScore, done.score);
  // Con 1 intento no se puede empezar otro.
  const retry = await call('POST', `/api/homework/${hw.code}/act`, { name: me.name, recovery: me.recovery, op: 'newAttempt' });
  assert.equal(retry.body.error, 'no-attempts-left');
  // Volver a abrir: sigue en el resumen.
  assert.ok(ev(await act(hw.code, me, 'resume'), 'spFinished'));
});

test('el estado vive en la base de datos: se retoma desde otro dispositivo con el tiempo restante', async () => {
  const hw = await createHomework({ options: { timePerQuestion: 30 } });
  const me = (await join(hw.code, 'Carla')).body.student;
  await act(hw.code, me, 'next');
  await new Promise((r) => setTimeout(r, 1200));
  // «Otro dispositivo»: solo nombre y código.
  const other = (await join(hw.code, 'carla', { recovery: me.recovery })).body.student;
  const q = ev(await act(hw.code, other, 'resume'), 'spQuestion');
  assert.equal(q.question, 'P1');
  assert.ok(q.time <= 29 && q.time >= 25, `tiempo restante ${q.time}`);
});

test('con la pregunta caducada tras días, se retoma en «contestada» y se avanza', async () => {
  const hw = await createHomework({ options: { timePerQuestion: 5 } });
  const me = (await join(hw.code, 'Dani')).body.student;
  await act(hw.code, me, 'next');
  const attempts = await repos.getHomeworkAttemptsCollection();
  const doc = await attempts.findOne({ code: hw.code, studentKey: 'dani' });
  await attempts.updateOne({ _id: doc._id }, { $set: { 'gameData.sp.startedAt': Date.now() - 3600 * 1000 } });
  const events = await act(hw.code, me, 'resume');
  assert.equal(events[0].name, 'spAnswered');
  assert.equal(ev(await act(hw.code, me, 'next'), 'spQuestion').question, 'P2');
});

test('varios intentos: se cuenta el mejor y no se puede abrir otro con uno en curso', async () => {
  const hw = await createHomework({ maxAttempts: 2 });
  const me = (await join(hw.code, 'Eli')).body.student;
  assert.equal((await call('POST', `/api/homework/${hw.code}/act`, { ...me, op: 'newAttempt' })).body.error, 'attempt-running');
  async function play(answers) {
    await act(hw.code, me, 'next');
    for (let i = 0; i < answers.length; i += 1) {
      await act(hw.code, me, 'answer', answers[i]);
      const e = await act(hw.code, me, 'next');
      if (i === answers.length - 1) return ev(e, 'spFinished');
    }
    return null;
  }
  const first = await play([4, 4, 4]); // todo mal
  assert.equal(first.score, 0);
  assert.equal(first.canRetry, true);
  const created = await act(hw.code, me, 'newAttempt');
  assert.equal(created[0].name, 'spIdle');
  const second = await play([2, 2, 1]);
  assert.equal(second.attemptNo, 2);
  assert.ok(second.score > 2000);
  assert.equal(second.bestScore, second.score);
  assert.equal(second.canRetry, false);
});

test('varios intentos con media: el resumen, los resultados y el CSV cuentan la media de los intentos', async () => {
  const hw = await createHomework({ maxAttempts: 2, options: { attemptScoring: 'average' } });
  assert.equal(hw.scoring, 'average');
  const me = (await join(hw.code, 'Mia')).body.student;
  async function play(answers) {
    await act(hw.code, me, 'next');
    for (let i = 0; i < answers.length; i += 1) {
      await act(hw.code, me, 'answer', answers[i]);
      const e = await act(hw.code, me, 'next');
      if (i === answers.length - 1) return ev(e, 'spFinished');
    }
    return null;
  }
  const first = await play([4, 4, 4]); // todo mal: 0 puntos
  assert.equal(first.score, 0);
  await act(hw.code, me, 'newAttempt');
  const second = await play([2, 2, 1]);
  assert.equal(second.scoring, 'average');
  assert.equal(second.averageScore, Math.round((0 + second.score) / 2));
  const results = (await call('GET', `/api/homeworks/${hw.code}/results`, undefined, TEACHER)).body;
  assert.equal(results.homework.scoring, 'average');
  assert.equal(results.rows[0].bestScore, Math.round(second.score / 2));
  // La estadística por pregunta cuenta los dos intentos (la primera pregunta: 1 acierto de 2).
  assert.equal(results.questionStats[0].answered, 2);
  assert.equal(results.questionStats[0].correct, 1);
});

test('por defecto cuenta el mejor intento, y el tiempo por pregunta admite hasta 180 s', async () => {
  const hw = await createHomework({ maxAttempts: 2, options: { timePerQuestion: 200 } });
  assert.equal(hw.scoring, 'best');
  const out = await call('GET', `/api/homeworks/${hw.code}/results`, undefined, TEACHER);
  assert.equal(out.body.homework.scoring, 'best');
  const me = (await join(hw.code, 'Tiempo')).body.student;
  await act(hw.code, me, 'next');
  const e = await act(hw.code, me, 'resume');
  const q = ev(e, 'spQuestion');
  assert.equal(q.timeTotal, 180);
  const exact = await createHomework({ options: { timePerQuestion: 180 } });
  const you = (await join(exact.code, 'Exacto')).body.student;
  const e2 = await act(exact.code, you, 'next');
  assert.equal(ev(e2, 'spQuestion').timeTotal, 180);
});

test('dos dispositivos a la vez: una sola respuesta puntúa', async () => {
  const hw = await createHomework();
  const me = (await join(hw.code, 'Fran')).body.student;
  await act(hw.code, me, 'next');
  const results = await Promise.all([act(hw.code, me, 'answer', 2), act(hw.code, me, 'answer', 2)]);
  const names = results.map((e) => e[0].name).sort();
  assert.deepEqual(names, ['answerRejected', 'spResult']);
  const attempts = await repos.getHomeworkAttemptsCollection();
  const doc = await attempts.findOne({ code: hw.code, studentKey: 'fran' });
  assert.equal(doc.gameData.answerHistory.length, 1);
});

test('fecha límite: el intento a medias se cierra con sus puntos y no se puede avanzar', async () => {
  const hw = await createHomework();
  const me = (await join(hw.code, 'Gael')).body.student;
  await act(hw.code, me, 'next');
  const gained = ev(await act(hw.code, me, 'answer', 2), 'spResult').score;
  const homeworks = await repos.getHomeworksCollection();
  await homeworks.updateOne({ code: hw.code }, { $set: { deadline: Date.now() - 5000 } });
  const events = await act(hw.code, me, 'next');
  const done = ev(events, 'spFinished');
  assert.equal(done.closed, true);
  assert.equal(done.score, gained);
  assert.equal(done.canRetry, false);
  // Nadie nuevo puede entrar con el deber cerrado.
  assert.equal((await join(hw.code, 'Hugo')).body.error, 'closed');
  // Quien ya estaba dentro sí puede reentrar para ver su resultado.
  assert.equal((await join(hw.code, 'Gael', { recovery: me.recovery })).status, 200);
});

test('el docente cierra, reabre y amplía la fecha; otro docente no puede tocarlo', async () => {
  const hw = await createHomework();
  assert.equal((await call('PATCH', `/api/homeworks/${hw.code}`, { status: 'closed' }, OTHER)).status, 403);
  assert.equal((await call('PATCH', `/api/homeworks/${hw.code}`, { status: 'closed' }, TEACHER)).body.homework.open, false);
  assert.equal((await join(hw.code, 'Iris')).body.error, 'closed');
  assert.equal((await call('PATCH', `/api/homeworks/${hw.code}`, { status: 'open' }, TEACHER)).body.homework.open, true);
  assert.equal((await join(hw.code, 'Iris')).status, 200);
  assert.equal((await call('PATCH', `/api/homeworks/${hw.code}`, { deadline: Date.now() - 10 }, TEACHER)).body.error, 'bad-deadline');
  const later = inDays(5);
  assert.equal((await call('PATCH', `/api/homeworks/${hw.code}`, { deadline: later }, TEACHER)).body.homework.deadline, later);
});

test('resultados y CSV del docente (solo el suyo)', async () => {
  const hw = await createHomework();
  const a = (await join(hw.code, 'Julia')).body.student;
  const b = (await join(hw.code, 'Kiko')).body.student;
  await join(hw.code, 'Lola');
  await act(hw.code, a, 'next');
  await act(hw.code, a, 'answer', 2);
  await act(hw.code, a, 'next');
  await act(hw.code, a, 'answer', 2);
  await act(hw.code, a, 'next');
  await act(hw.code, a, 'answer', 1);
  await act(hw.code, a, 'next');
  await act(hw.code, b, 'next');
  await act(hw.code, b, 'answer', 3);
  assert.equal((await call('GET', `/api/homeworks/${hw.code}/results`, undefined, OTHER)).status, 403);
  const res = await call('GET', `/api/homeworks/${hw.code}/results`, undefined, TEACHER);
  assert.equal(res.status, 200);
  const byName = Object.fromEntries(res.body.rows.map((r) => [r.name, r]));
  assert.equal(byName.Julia.state, 'finished');
  assert.equal(byName.Julia.correctCount, 3);
  assert.equal(byName.Kiko.state, 'in-progress');
  assert.equal(byName.Kiko.wrongCount, 1);
  assert.equal(byName.Lola.state, 'not-started');
  assert.equal(res.body.rows[0].name, 'Julia');
  assert.deepEqual(res.body.questionStats.map((q) => [q.answered, q.correct]), [[2, 1], [1, 1], [1, 1]]);
  const csv = await call('GET', `/api/homeworks/${hw.code}/report.csv`, undefined, TEACHER);
  assert.equal(csv.status, 200);
  assert.match(csv.body, /Julia/);
  assert.match(csv.body, /Kiko/);
  const list = await call('GET', '/api/homeworks', undefined, TEACHER);
  const mine = list.body.find((h) => h.code === hw.code);
  assert.equal(mine.students, 3);
  assert.equal(mine.finishedAttempts, 1);
  assert.equal((await call('DELETE', `/api/homeworks/${hw.code}`, undefined, TEACHER)).status, 200);
  assert.equal((await call('GET', `/api/homework/${hw.code}`)).status, 404);
});

test('fuerza bruta del código de recuperación: tras 10 fallos se bloquea', async () => {
  const hw = await createHomework();
  await join(hw.code, 'Mario');
  for (let i = 0; i < 10; i += 1) {
    assert.equal((await join(hw.code, 'Mario', { recovery: 'AAAAA' + (i % 9 + 2) })).status, 401);
  }
  assert.equal((await join(hw.code, 'Mario', { recovery: 'BBBBBB' })).status, 429);
  // Otro nombre del mismo deber no se ve afectado.
  assert.equal((await join(hw.code, 'Nuria')).status, 200);
});

test('un código de recuperación de otro alumno no sirve para actuar', async () => {
  const hw = await createHomework();
  const a = (await join(hw.code, 'Oscar')).body.student;
  const b = (await join(hw.code, 'Paula')).body.student;
  const out = await call('POST', `/api/homework/${hw.code}/act`, { name: 'Oscar', recovery: b.recovery, op: 'next' });
  assert.equal(out.status, 401);
  assert.ok(a.recovery !== b.recovery);
});
