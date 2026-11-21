const test = require('node:test');
const assert = require('node:assert/strict');
const sp = require('../../server/services/selfPaced');

const T0 = 1_000_000;
function makeGame(options) {
  return {
    gameData: {
      options: Object.assign({ mode: 'selfPaced', timePerQuestion: 20 }, options),
      questions: [
        { question: 'a', type: 'quiz', answers: ['1', '2', '3', '4'], correct: 2 },
        { question: 'b', type: 'quiz', answers: ['1', '2', '3', '4'], correct: 1 },
        { question: 'c', type: 'poll', answers: ['1', '2'] }
      ]
    }
  };
}
const makePlayer = () => ({ gameData: { score: 0, streak: 0, bestStreak: 0, correctCount: 0, wrongCount: 0 } });

test('isSelfPaced: solo con options.mode = selfPaced', () => {
  assert.equal(sp.isSelfPaced(makeGame()), true);
  assert.equal(sp.isSelfPaced(makeGame({ mode: 'live' })), false);
  assert.equal(sp.isSelfPaced(null), false);
});

test('cada alumno tiene su pregunta y su reloj, aunque entre tarde', () => {
  const game = makeGame();
  const a = makePlayer();
  const b = makePlayer();
  assert.equal(sp.beginNext(game, a, T0).question, 'a');
  assert.equal(sp.submitAnswer(game, a, 2, T0 + 2000).ok, true);
  sp.beginNext(game, a, T0 + 3000);
  // b entra mucho después: empieza en la primera pregunta con su propio inicio.
  assert.equal(sp.beginNext(game, b, T0 + 60_000).question, 'a');
  assert.equal(sp.progressOf(game, a).question, 2);
  assert.equal(sp.progressOf(game, b).question, 1);
  assert.equal(sp.remainingMs(game, b, T0 + 65_000), 15_000);
});

test('puntuación por alumno: depende del tiempo propio', () => {
  const game = makeGame({ streak: false });
  const fast = makePlayer();
  const slow = makePlayer();
  sp.beginNext(game, fast, T0);
  sp.beginNext(game, slow, T0);
  assert.equal(sp.submitAnswer(game, fast, 2, T0 + 2000).points, 900);
  assert.equal(sp.submitAnswer(game, slow, 2, T0 + 10_000).points, 500);
  assert.equal(fast.gameData.score, 900);
  assert.equal(slow.gameData.correctCount, 1);
});

test('rechaza doble respuesta y respuestas sin pregunta', () => {
  const game = makeGame();
  const p = makePlayer();
  assert.deepEqual(sp.submitAnswer(game, p, 2, T0), { ok: false, reason: 'no-question' });
  sp.beginNext(game, p, T0);
  assert.equal(sp.submitAnswer(game, p, 2, T0 + 1000).ok, true);
  assert.deepEqual(sp.submitAnswer(game, p, 2, T0 + 1100), { ok: false, reason: 'already-answered' });
});

test('margen de red: acepta hasta 1,5 s tarde (0 puntos de tiempo) y rechaza lo demás', () => {
  const game = makeGame({ streak: false });
  const late = makePlayer();
  sp.beginNext(game, late, T0);
  const ok = sp.submitAnswer(game, late, 2, T0 + 20_000 + 1400);
  assert.equal(ok.ok, true);
  assert.equal(ok.isCorrect, true);
  assert.equal(ok.points, 0);
  const tooLate = makePlayer();
  sp.beginNext(game, tooLate, T0);
  assert.deepEqual(sp.submitAnswer(game, tooLate, 2, T0 + 20_000 + 1600), { ok: false, reason: 'timeout' });
});

test('racha: acierto suma, fallo reinicia; con la racha desactivada no cuenta', () => {
  const game = makeGame();
  const p = makePlayer();
  game.gameData.questions = Array.from({ length: 5 }, (_, i) => ({ question: 'q' + i, type: 'quiz', answers: ['1', '2'], correct: 1 }));
  let t = T0;
  const bonuses = [];
  for (let i = 0; i < 4; i++) {
    sp.beginNext(game, p, t);
    bonuses.push(sp.submitAnswer(game, p, 1, t + 20_000).bonus);
    t += 30_000;
  }
  assert.deepEqual(bonuses, [0, 0, 50, 100]);
  sp.beginNext(game, p, t);
  assert.equal(sp.submitAnswer(game, p, 2, t + 1).outcome, 'incorrect');
  assert.equal(p.gameData.streak, 0);
  assert.equal(p.gameData.bestStreak, 4);

  const off = makeGame({ streak: false });
  const q = makePlayer();
  sp.beginNext(off, q, T0);
  assert.equal(sp.submitAnswer(off, q, 2, T0 + 20_000).bonus, 0);
  assert.equal(q.gameData.streak, 0);
});

test('tiempo agotado sin responder: cuenta como fallo y reinicia la racha; una encuesta no', () => {
  const game = makeGame();
  const p = makePlayer();
  p.gameData.streak = 2;
  sp.beginNext(game, p, T0);
  assert.equal(sp.expireQuestion(game, p, T0 + 5000), false);
  assert.equal(sp.expireQuestion(game, p, T0 + 20_000), true);
  assert.equal(p.gameData.streak, 0);
  assert.equal(p.gameData.wrongCount, 1);
  assert.equal(sp.expireQuestion(game, p, T0 + 30_000), false);
  sp.beginNext(game, p, T0 + 31_000);
  sp.beginNext(game, p, T0 + 31_000 + 20_000);
  p.gameData.streak = 3;
  assert.equal(sp.expireQuestion(game, p, T0 + 80_000), true);
  assert.equal(p.gameData.streak, 3);
});

test('al acabar las preguntas el alumno termina; el anfitrión puede cerrar a quien va a medias', () => {
  const game = makeGame();
  const p = makePlayer();
  game.gameData.questions = game.gameData.questions.slice(0, 1);
  sp.beginNext(game, p, T0);
  sp.submitAnswer(game, p, 2, T0 + 1000);
  assert.equal(sp.beginNext(game, p, T0 + 2000), null);
  assert.equal(sp.progressOf(game, p).finished, true);

  const mid = makePlayer();
  const g2 = makeGame({ streak: false });
  sp.beginNext(g2, mid, T0);
  sp.submitAnswer(g2, mid, 2, T0 + 2000);
  sp.finishPlayer(mid);
  assert.equal(mid.gameData.score, 900);
  assert.equal(sp.remainingMs(g2, mid, T0 + 3000), 0);
  assert.deepEqual(sp.submitAnswer(g2, mid, 2, T0 + 3000), { ok: false, reason: 'no-question' });
});

test('correspondencia: mismo tiempo extra y puntuación proporcional', () => {
  const game = makeGame({ streak: false, matchingExtraTime: 100 });
  game.gameData.questions = [{ question: 'm', type: 'matching', pairs: [{ left: 'a', right: 'x' }, { left: 'b', right: 'y' }], matchSolution: [0, 1], matchRight: ['x', 'y'], matchLeft: ['a', 'b'] }];
  const p = makePlayer();
  sp.beginNext(game, p, T0);
  assert.equal(sp.remainingMs(game, p, T0), 40_000);
});
