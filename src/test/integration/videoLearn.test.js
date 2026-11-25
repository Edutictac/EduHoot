// Fase «aprén i després respon» (feature 24) amb sockets REALS: el vídeo es veu a l'anfitrió (projector),
// l'alumnat espera i no rep la pregunta, i les respostes comencen quan el profesorat tanca el vídeo.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io: connectClient } = require('socket.io-client');

let mongod;
let httpServer;
let baseUrl;
let mongoClient;
let games;
const clients = [];

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  process.env.EDUHOOT_RESOURCES_TOKEN = 'test-catalogue-token';
  process.env.PUBLIC_IMPORT_SOURCE_URL = 'https://catalogue.example';
  let server;
  ({ server, mongoClient, games } = require('../../server/server.js'));
  httpServer = server.listen(0, '127.0.0.1');
  await new Promise((resolve) => httpServer.on('listening', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  clients.forEach((c) => c.close());
  (games.games || []).forEach((g) => { if (g.cleanupTimer) clearTimeout(g.cleanupTimer); });
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (mongoClient) await mongoClient.close().catch(() => {});
  if (mongod) await mongod.stop();
});

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

const VIDEO = 'https://example.com/clip.mp4';

test('fase del vídeo: l\'alumnat espera; les respostes comencen quan el profesorat tanca el vídeo', async () => {
  const create = await fetch(`${baseUrl}/api/quizzes/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Vídeo i pregunta',
      tags: ['proves'],
      visibility: 'unlisted',
      questions: [
        { question: 'Què has vist?', answers: ['a', 'b', 'c', 'd'], correct: 2, time: 20, video: VIDEO },
        { question: 'Pregunta sense vídeo', answers: ['a', 'b', 'c', 'd'], correct: 1, time: 20 }
      ]
    })
  });
  assert.equal(create.status, 200);
  const { id } = await create.json();

  const host = await connect();
  host.emit('host-join', { id });
  const [{ pin }] = await host.next('showGamePin');
  const students = [];
  for (const name of ['Ana', 'Bruno']) {
    const s = await connect();
    s.emit('player-join', { pin: String(pin), name, icon: '🦊', token: `tok-${name}-${pin}` });
    await s.next('playerJoinAck');
    students.push(s);
  }
  const [ana, bruno] = students;
  host.emit('startGame', {
    randomQuestions: false, randomAnswers: false, sendToStudents: true, showScoresBetween: true,
    showCorrectAnswers: true, streak: true, videoStartSec: 12, pin: String(pin)
  });

  // La fase comença: el vídeo va a l'anfitrió (amb el segon d'inici) i l'alumnat espera.
  const [learn] = await host.next('videoLearn', 15000);
  assert.equal(learn.video, VIDEO);
  assert.equal(learn.startAt, 12);
  assert.equal(learn.questionNumber, 1);
  await ana.next('videoLearnWait', 15000);
  await bruno.next('videoLearnWait', 15000);

  // Durant la fase, l'alumnat no rep la pregunta ni el vídeo.
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(ana.count('playerQuestion'), 0, 'no ha de rebre la pregunta mentre mira el vídeo');

  // El profesorat tanca el vídeo: comencen les respostes, i l'alumnat rep la pregunta sense vídeo.
  host.emit('finishVideoLearning');
  const [q] = await ana.next('playerQuestion', 5000);
  assert.equal(q.question, 'Què has vist?');
  const [media] = await ana.next('questionMedia', 5000);
  assert.equal(media.video, '', 'l\'alumnat no rep el vídeo');
  await host.next('gameQuestions', 5000);
});
