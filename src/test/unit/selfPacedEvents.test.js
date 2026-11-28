const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { LiveGames } = require('../../server/utils/liveGames');
const { Players } = require('../../server/utils/players');
const createSelfPacedEvents = require('../../server/sockets/selfPacedEvents');

// Sockets y io simulados: cada emisión se anota para comprobarla.
function setup(options = {}) {
  const log = [];
  const io = {
    to: (room) => ({ emit: (ev, ...a) => log.push({ room, ev, a }), except: () => ({ emit: () => {} }) })
  };
  const games = new LiveGames();
  const players = new Players();
  const game = games.addGame('1234', 'host', true, {
    gameid: 'q1',
    quizName: 'Quiz',
    options: Object.assign({ mode: 'selfPaced', timePerQuestion: 20, showScoresBetween: true, showCorrectAnswers: true, streak: true }, options),
    questions: [
      { question: 'a', type: 'quiz', answers: ['1', '2', '3', '4'], correct: 2, correctAnswers: [2] },
      { question: 'b', type: 'quiz', answers: ['1', '2', '3', '4'], correct: 1, correctAnswers: [1] }
    ],
    scoredQuestionsCount: 2
  });
  game.gameLive = true;
  const reports = [];
  const helpers = {
    allowAnswer: () => true,
    buildStudentPlayerPayload: (p) => p,
    scheduleGameCleanup: () => {},
    timingsFor: () => ({ inactivityMs: 1000 })
  };
  const ev = createSelfPacedEvents({
    io, games, players, helpers,
    cacheFinishedSessionReport: (g, p) => reports.push(p.length),
    incrementQuizStats: async () => {},
    commons: { reportCommonsScores: async () => {} }
  });
  function connect(id, name) {
    const socket = new EventEmitter();
    socket.id = id;
    socket.emitted = [];
    socket.emit = function (event, ...args) { if (event === 'spNext' || event === 'spAnswer' || event === 'spTimeUp' || event === 'spEnd' || event === 'spProgressRequest' || event === 'spHand') return EventEmitter.prototype.emit.call(this, event, ...args); this.emitted.push({ event, args }); return true; };
    ev.register(socket);
    if (name) players.addPlayer('host', id, name, { score: 0, answer: 0, correctCount: 0, wrongCount: 0, streak: 0, bestStreak: 0, answerHistory: [] }, '', '');
    return socket;
  }
  const send = (socket, event, ...args) => EventEmitter.prototype.emit.call(socket, event, ...args);
  const last = (socket, event) => socket.emitted.filter((e) => e.event === event).pop();
  return { game, players, ev, connect, send, last, log, reports };
}

test('cada alumno pide su pregunta y contesta con su propio reloj', () => {
  const t = setup({ streak: false });
  const a = t.connect('a', 'Ana');
  const b = t.connect('b', 'Bruno');
  t.send(a, 'spNext');
  assert.equal(t.last(a, 'spQuestion').args[0].question, 'a');
  assert.equal(t.last(a, 'spQuestion').args[0].questionNumber, 1);
  assert.equal(t.last(a, 'spQuestion').args[0].answers.length, 4);
  t.send(a, 'spAnswer', 2);
  const res = t.last(a, 'spResult').args[0];
  assert.equal(res.outcome, 'correct');
  assert.ok(res.points > 900);
  t.send(a, 'spNext');
  assert.equal(t.last(a, 'spQuestion').args[0].question, 'b');
  // Bruno no se ha movido de la primera.
  t.send(b, 'spNext');
  assert.equal(t.last(b, 'spQuestion').args[0].question, 'a');
});

test('no se salta una pregunta en curso: spNext reenvía la actual', () => {
  const t = setup();
  const a = t.connect('a', 'Ana');
  t.send(a, 'spNext');
  t.send(a, 'spNext');
  const qs = a.emitted.filter((e) => e.event === 'spQuestion');
  assert.equal(qs.length, 2);
  assert.equal(qs[1].args[0].question, 'a');
});

test('doble respuesta rechazada; el anfitrión recibe progreso sin puntos (si ha activat el check)', () => {
  const t = setup({ selfPacedHostScores: true });
  const a = t.connect('a', 'Ana');
  t.send(a, 'spNext');
  t.send(a, 'spAnswer', 2);
  t.send(a, 'spAnswer', 2);
  assert.equal(last(a, 'answerRejected').args[0].reason, 'already-answered');
  const prog = t.log.filter((l) => l.ev === 'spProgress' && l.room === 'host').pop().a[0];
  assert.deepEqual(prog[0], { playerId: 'a', name: 'Ana', icon: '', question: 1, total: 2, answered: 1, finished: false, hand: false, score: prog[0].score });
  assert.ok(prog[0].score > 0);
  function last(s, e) { return t.last(s, e); }
});

test('«Mostrar respuestas» desactivado: el resultado no lleva la respuesta correcta', () => {
  const t = setup({ showCorrectAnswers: false });
  const a = t.connect('a', 'Ana');
  t.send(a, 'spNext');
  t.send(a, 'spAnswer', 3);
  const res = t.last(a, 'spResult').args[0];
  assert.equal(res.outcome, 'incorrect');
  assert.equal(res.meta.correctAnswers, undefined);
  assert.equal(res.meta.correct, undefined);
});

test('spTimeUp antes de tiempo no hace nada; el servidor manda sobre el reloj', () => {
  const t = setup();
  const a = t.connect('a', 'Ana');
  t.send(a, 'spNext');
  t.send(a, 'spTimeUp');
  assert.equal(t.last(a, 'spResult'), undefined);
});

test('el anfitrión cierra: cada alumno recibe su resumen y se envía GameOver', async () => {
  const t = setup({ streak: false });
  const a = t.connect('a', 'Ana');
  const b = t.connect('b', 'Bruno');
  t.send(a, 'spNext');
  t.send(a, 'spAnswer', 2);
  t.send(b, 'spNext');
  const host = new EventEmitter();
  host.id = 'host';
  t.ev.register(host);
  EventEmitter.prototype.emit.call(host, 'spEnd');
  await new Promise((r) => setImmediate(r));
  assert.equal(t.game.gameOver, true);
  const fin = t.log.filter((l) => l.ev === 'spFinished');
  assert.equal(fin.length, 2);
  const ana = fin.find((l) => l.room === 'a').a[0];
  assert.equal(ana.rank, 1);
  assert.equal(ana.correctCount, 1);
  assert.equal(t.log.find((l) => l.ev === 'GameOver').a[0].num1, 'Ana');
  assert.deepEqual(t.reports, [2]);
  // Tras el cierre ya no se aceptan respuestas ni preguntas.
  t.send(b, 'spAnswer', 1);
  assert.equal(t.last(b, 'answerRejected').args[0].reason, 'game-over');
});

test('reconexión: se retoma la pregunta en curso, la respondida o el final', () => {
  const t = setup();
  const a = t.connect('a', 'Ana');
  const player = t.players.getPlayer('a');
  t.ev.resume(a, t.game, player);
  assert.equal(a.emitted.length, 1);
  assert.equal(a.emitted[0].event, 'spIdle');
  t.send(a, 'spNext');
  t.ev.resume(a, t.game, player);
  assert.equal(t.last(a, 'spQuestion').args[0].question, 'a');
  t.send(a, 'spAnswer', 2);
  t.ev.resume(a, t.game, player);
  assert.equal(t.last(a, 'spAnswered').args[0].questionNumber, 1);
});

test('mano alzada: solo con pregunta en curso, visible al anfitrión y se baja al contestar', () => {
  const t = setup();
  const a = t.connect('a', 'Ana');
  const handsOf = () => t.log.filter((l) => l.ev === 'spProgress').pop().a[0].find((p) => p.name === 'Ana').hand;
  t.send(a, 'spHand', { raised: true });
  assert.equal(t.log.filter((l) => l.ev === 'spProgress').length, 0);
  t.send(a, 'spNext');
  t.send(a, 'spHand', { raised: true });
  assert.equal(handsOf(), true);
  t.send(a, 'spHand', { raised: false });
  assert.equal(handsOf(), false);
  t.send(a, 'spHand', { raised: true });
  t.send(a, 'spAnswer', 2);
  assert.equal(handsOf(), false);
  // Reconexión: el reenvío de la pregunta indica si la mano sigue alzada.
  t.send(a, 'spNext');
  t.send(a, 'spHand', { raised: true });
  t.send(a, 'spNext');
  assert.equal(t.last(a, 'spQuestion').args[0].hand, true);
});

test('puntuaciones desactivadas: ni el anfitrión ni el alumno reciben puntos ni ranking', () => {
  const t = setup({ showScoresBetween: false });
  const a = t.connect('a', 'Ana');
  t.send(a, 'spNext');
  t.send(a, 'spAnswer', 2);
  const prog = t.log.filter((l) => l.ev === 'spProgress').pop().a[0];
  assert.equal('score' in prog[0], false);
  const res = t.last(a, 'spResult').args[0];
  assert.equal('ranking' in res, false);
});

test('puntuaciones activadas: el alumno recibe el Top 10 con su posición marcada', () => {
  const t = setup();
  const a = t.connect('a', 'Ana');
  const b = t.connect('b', 'Bruno');
  t.send(a, 'spNext');
  t.send(b, 'spNext');
  t.send(a, 'spAnswer', 2);
  t.send(b, 'spAnswer', 1);
  const res = t.last(b, 'spResult').args[0];
  assert.deepEqual(res.ranking.map((r) => [r.name, r.me]), [['Ana', false], ['Bruno', true]]);
  assert.equal(res.rank, 2);
  assert.equal(res.players, 2);
});
