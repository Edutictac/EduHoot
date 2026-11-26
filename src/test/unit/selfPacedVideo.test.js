// Autoritme con fase de vídeo (feature 24): el reloj de la pregunta no corre mientras el alumno mira el vídeo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sp = require('../../server/services/selfPaced');

function gameWith(questions, options) {
  return { gameData: { questions, options: { mode: 'selfPaced', ...(options || {}) } } };
}
const VIDEO_Q = { question: 'Amb vídeo', answers: ['a', 'b', 'c', 'd'], correct: 0, time: 10, video: 'https://example.com/v.mp4' };
const PLAIN_Q = { question: 'Sense vídeo', answers: ['a', 'b', 'c', 'd'], correct: 1, time: 10 };

test('amb fase de vídeo: no hi ha temps ni resposta fins que el alumne acaba el vídeo', () => {
  const game = gameWith([VIDEO_Q, PLAIN_Q]);
  const player = { gameData: {} };
  assert.equal(sp.beginNext(game, player, 1000, { videoLearn: true }).question, 'Amb vídeo');
  assert.equal(sp.ensureState(player).learning, true);
  assert.equal(sp.remainingMs(game, player, 5000), 0);
  // Passat el límit, la pregunta no caduca mentre dura la fase.
  assert.equal(sp.expireQuestion(game, player, 1000 + 60000), false);
  assert.deepEqual(sp.submitAnswer(game, player, { type: 'quiz', value: 0 }, 5000), { ok: false, reason: 'learning' });
  // En acabar el vídeo, el reloj comença des d'eixe moment.
  assert.equal(sp.finishLearning(game, player, 20000), true);
  assert.equal(sp.ensureState(player).learning, false);
  assert.equal(sp.remainingMs(game, player, 20000), 10000);
  assert.equal(sp.expireQuestion(game, player, 25000), false);
  assert.equal(sp.expireQuestion(game, player, 30000), true);
});

test('finishLearning no fa res si no hi ha fase en curs', () => {
  const game = gameWith([PLAIN_Q]);
  const player = { gameData: {} };
  sp.beginNext(game, player, 1000, { videoLearn: true });
  assert.equal(sp.ensureState(player).learning, false);
  assert.equal(sp.finishLearning(game, player, 2000), false);
  assert.equal(sp.ensureState(player).startedAt, 1000);
});

test('sense fase (o sense vídeo) el reloj corre des del principi; els deures no canvien', () => {
  const game = gameWith([VIDEO_Q]);
  const a = { gameData: {} };
  sp.beginNext(game, a, 1000, { videoLearn: true });
  assert.equal(sp.ensureState(a).learning, true);
  const b = { gameData: {} };
  sp.beginNext(game, b, 1000);
  assert.equal(sp.ensureState(b).learning, false);
  assert.equal(sp.remainingMs(game, b, 1000), 10000);
  const c = { gameData: {} };
  sp.beginNext(gameWith([PLAIN_Q]), c, 1000, { videoLearn: true });
  assert.equal(sp.ensureState(c).learning, false);
});
