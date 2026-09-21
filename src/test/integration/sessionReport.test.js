const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;
let httpServer;
let baseUrl;
let app;
let mongoClient;
let games;
let players;
let liveSessionToCsv;
let cacheFinishedSessionReport;
let finishedSessionReports;

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URL = mongod.getUri();
  ({
    app,
    mongoClient,
    games,
    players,
    liveSessionToCsv,
    cacheFinishedSessionReport,
    finishedSessionReports
  } = require('../../server/server.js'));
  httpServer = app.listen(0);
  await new Promise((resolve) => httpServer.on('listening', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  if (mongoClient) await mongoClient.close().catch(() => {});
  if (mongod) await mongod.stop();
});

function makeGame(pin, hostId) {
  return games.addGame(pin, hostId, true, {
    gameid: 'quiz-1',
    quizName: 'Quiz de prueba',
    totalQuestions: 0,
    questions: [],
    options: {}
  });
}

function addPlayer(hostId, playerId, name, score) {
  return players.addPlayer(hostId, playerId, name, {
    score,
    correctCount: 0,
    wrongCount: 0,
    answerHistory: []
  }, '');
}

// Regresión: tras "Report EduHoot scores to Commons" el fin de partida pasó a esperar
// llamadas de red (incrementQuizStats / reportCommonsScores) antes de generar el informe.
// Durante esa espera los alumnos ya han visto "GameOver" y pueden desconectarse, así que
// una segunda consulta a players.getPlayers() puede devolver muchos menos jugadores que los
// que realmente jugaron. El ranking final y el CSV deben basarse siempre en la foto de
// jugadores tomada en el instante del GameOver, no en una relectura posterior.

test('liveSessionToCsv usa la foto de jugadores recibida en vez de releer el registro en vivo', () => {
  const hostId = 'host-csv-1';
  const pin = 900001;
  const game = makeGame(pin, hostId);

  const snapshot = [
    addPlayer(hostId, 'p1', 'Ana', 90),
    addPlayer(hostId, 'p2', 'Berta', 100),
    addPlayer(hostId, 'p3', 'Carla', 50)
  ];

  // Simulamos que, tras el GameOver, todos los alumnos menos uno se desconectan
  // antes de generarse el informe.
  players.removePlayer('p1');
  players.removePlayer('p2');

  const csvFromLiveRegistry = liveSessionToCsv(game); // sin foto: solo ve a quien sigue conectada
  const csvFromSnapshot = liveSessionToCsv(game, snapshot); // con foto: ve a las tres

  assert.ok(!csvFromLiveRegistry.includes('Ana'), 'sanity check: el registro en vivo ya perdió a Ana');
  assert.ok(csvFromSnapshot.includes('Ana'));
  assert.ok(csvFromSnapshot.includes('Berta'));
  assert.ok(csvFromSnapshot.includes('Carla'));

  const summaryLines = csvFromSnapshot.split('\n');
  const winnerLine = summaryLines.find((line) => line.split(';')[4] === '1');
  assert.ok(winnerLine && winnerLine.includes('Berta'), `Berta (100 pts) debía ser la posición 1, se obtuvo: ${winnerLine}`);
});

test('cacheFinishedSessionReport congela el informe con la foto de fin de partida', () => {
  const hostId = 'host-csv-2';
  const pin = 900002;
  const game = makeGame(pin, hostId);

  const snapshot = [
    addPlayer(hostId, 'q1', 'Diego', 30),
    addPlayer(hostId, 'q2', 'Elena', 80)
  ];

  cacheFinishedSessionReport(game, snapshot);

  // Los jugadores se desconectan justo después, mientras se esperan las llamadas
  // asíncronas a Commons/estadísticas.
  players.removePlayer('q1');
  players.removePlayer('q2');

  const cached = finishedSessionReports.get(String(pin));
  assert.ok(cached && cached.csv);
  assert.ok(cached.csv.includes('Diego'));
  assert.ok(cached.csv.includes('Elena'));
});

test('GET /report.csv devuelve el informe cacheado aunque la partida siga en memoria sin jugadores conectados', async () => {
  const hostId = 'host-csv-3';
  const pin = 900003;
  const game = makeGame(pin, hostId);

  const snapshot = [
    addPlayer(hostId, 'r1', 'Fran', 20),
    addPlayer(hostId, 'r2', 'Gema', 60)
  ];

  cacheFinishedSessionReport(game, snapshot);
  game.gameOver = true;

  // La partida sigue "en memoria" (scheduleGameCleanup no la ha retirado todavía)
  // pero ya no queda nadie conectado en el registro en vivo.
  players.removePlayer('r1');
  players.removePlayer('r2');

  const res = await fetch(`${baseUrl}/api/live-games/${pin}/report.csv?hostId=${hostId}`);
  assert.equal(res.status, 200);
  const csv = await res.text();
  assert.ok(csv.includes('Fran'), 'la ganadora real no debe desaparecer del informe descargado');
  assert.ok(csv.includes('Gema'));
});
