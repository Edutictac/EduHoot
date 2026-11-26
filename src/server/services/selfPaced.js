// Modo autoritme (feature 3): cada alumno avanza solo, con su propio reloj.
// Módulo puro (sin sockets): el estado vive en `player.gameData.sp` y todas las
// funciones reciben la hora (`now`) para poder probarlas sin temporizadores.
// El servidor manda siempre: el cliente solo dice «he elegido esto».
const { questionTimeOf, pointsForElapsed, getSubmissionScoreRatio, streakBonus, nextStreak, isStreakEnabled } = require('./scoring');
const { getQuestionMeta } = require('../questionUtils');

const SELF_PACED_MODE = 'selfPaced';
// Margen a favor del alumno por el retraso de la red: una respuesta que llega hasta
// 1,5 s después del límite aún se acepta (con 0 puntos de tiempo).
const SELF_PACED_GRACE_MS = 1500;

function isSelfPaced(game) {
  return !!(game && game.gameData && game.gameData.options && game.gameData.options.mode === SELF_PACED_MODE);
}

function questionsOf(game) {
  return (game && game.gameData && Array.isArray(game.gameData.questions)) ? game.gameData.questions : [];
}

// Estado del alumno: pregunta actual (0 = aún no ha empezado), inicio de esa pregunta,
// si ya contestó y si ha terminado. Quien entra tarde empieza en la primera pregunta.
function ensureState(player) {
  if (!player.gameData.sp) {
    player.gameData.sp = { index: 0, startedAt: 0, answered: false, finished: false, answeredCount: 0, hand: false };
  }
  return player.gameData.sp;
}

function currentQuestion(game, player) {
  const sp = ensureState(player);
  return sp.index > 0 ? (questionsOf(game)[sp.index - 1] || null) : null;
}

// Pasa a la pregunta siguiente (o a la primera). Devuelve null si ya no quedan: el alumno termina.
// Con opts.videoLearn (feature 24), una pregunta con vídeo empieza en fase de aprendizaje: el reloj
// no corre hasta que el alumno acaba el vídeo (finishLearning).
function beginNext(game, player, now, opts) {
  const sp = ensureState(player);
  if (sp.finished) return null;
  const next = sp.index + 1;
  if (next > questionsOf(game).length) {
    sp.finished = true;
    sp.startedAt = 0;
    sp.hand = false;
    sp.learning = false;
    return null;
  }
  sp.index = next;
  const learning = !!(opts && opts.videoLearn && questionsOf(game)[next - 1] && questionsOf(game)[next - 1].video);
  sp.learning = learning;
  sp.startedAt = learning ? 0 : now;
  sp.answered = false;
  sp.hand = false; // la mano alzada es de una pregunta
  return questionsOf(game)[next - 1];
}

function limitMsOf(game, question) {
  return Math.max(1, questionTimeOf(game.gameData, question)) * 1000;
}

// Milisegundos que le quedan al alumno en su pregunta (0 si no hay pregunta en curso).
function remainingMs(game, player, now) {
  const sp = ensureState(player);
  const q = currentQuestion(game, player);
  if (!q || sp.finished || !sp.startedAt) return 0;
  return Math.max(0, limitMsOf(game, q) - Math.max(0, now - sp.startedAt));
}

// Valida y puntúa la respuesta. `submission` ya viene normalizada. Devuelve
// { ok:false, reason } o { ok:true, isCorrect, scoreRatio, points, bonus, outcome }.
function submitAnswer(game, player, submission, now) {
  const sp = ensureState(player);
  const q = currentQuestion(game, player);
  if (sp.finished || !q) return { ok: false, reason: 'no-question' };
  if (sp.learning) return { ok: false, reason: 'learning' };
  if (sp.answered) return { ok: false, reason: 'already-answered' };
  const elapsed = Math.max(0, now - sp.startedAt);
  const limit = limitMsOf(game, q);
  if (elapsed > limit + SELF_PACED_GRACE_MS) return { ok: false, reason: 'timeout' };

  const meta = getQuestionMeta(q);
  const isPoll = meta.type === 'poll';
  const scoreRatio = getSubmissionScoreRatio(meta, submission);
  const isCorrect = !isPoll && scoreRatio === 1;
  let points = 0;
  if (scoreRatio > 0) {
    points = Math.round(pointsForElapsed(q, questionTimeOf(game.gameData, q), elapsed) * scoreRatio);
  }
  let bonus = 0;
  const gd = player.gameData;
  if (isStreakEnabled(game) && !isPoll) {
    gd.streak = nextStreak(gd.streak, isCorrect);
    gd.bestStreak = Math.max(Number(gd.bestStreak) || 0, gd.streak);
    if (isCorrect) bonus = streakBonus(gd.streak);
  }
  gd.score = (Number(gd.score) || 0) + points + bonus;
  if (isCorrect) gd.correctCount = (Number(gd.correctCount) || 0) + 1;
  else if (!isPoll && scoreRatio === 0) gd.wrongCount = (Number(gd.wrongCount) || 0) + 1;
  sp.answered = true;
  sp.answeredCount += 1;
  // Historial para el informe CSV (mismo formato que en la partida en vivo).
  if (!Array.isArray(gd.answerHistory)) gd.answerHistory = [];
  gd.answerHistory.push({ questionNumber: sp.index, submission, isCorrect, scoreRatio, answeredAt: now, elapsedMs: elapsed });
  const outcome = isPoll ? 'poll' : (isCorrect ? 'correct' : (scoreRatio > 0 ? 'partial' : 'incorrect'));
  return { ok: true, isCorrect, scoreRatio, points, bonus, outcome };
}

// Se acabó el tiempo sin respuesta: cuenta como fallo y reinicia la racha (salvo en encuestas).
// Devuelve false si el tiempo aún no ha terminado o ya había contestado.
function expireQuestion(game, player, now) {
  const sp = ensureState(player);
  const q = currentQuestion(game, player);
  if (sp.finished || !q || sp.answered || sp.learning) return false;
  if (now - sp.startedAt < limitMsOf(game, q)) return false;
  const meta = getQuestionMeta(q);
  sp.answered = true;
  sp.answeredCount += 1;
  if (meta.type !== 'poll') {
    player.gameData.wrongCount = (Number(player.gameData.wrongCount) || 0) + 1;
    if (isStreakEnabled(game)) player.gameData.streak = 0;
  }
  return true;
}

// Fin de la fase de vídeo (feature 24): el reloj de la pregunta empieza ahora. Devuelve false si no hay fase.
function finishLearning(game, player, now) {
  const sp = ensureState(player);
  if (!sp.learning || sp.finished) return false;
  sp.learning = false;
  sp.startedAt = now;
  return true;
}

// Cierre de la partida por el anfitrión: quien va a medias termina conservando sus puntos.
function finishPlayer(player) {
  const sp = ensureState(player);
  sp.finished = true;
  sp.startedAt = 0;
  sp.hand = false;
}

// Progreso para la vista del anfitrión: avance, sin puntos (decisión 2: no hay ranking en vivo).
function progressOf(game, player) {
  const sp = ensureState(player);
  return { question: sp.index, total: questionsOf(game).length, answered: sp.answeredCount, finished: sp.finished, hand: !!sp.hand };
}

module.exports = {
  SELF_PACED_MODE,
  SELF_PACED_GRACE_MS,
  isSelfPaced,
  ensureState,
  currentQuestion,
  beginNext,
  remainingMs,
  finishLearning,
  submitAnswer,
  expireQuestion,
  finishPlayer,
  progressOf
};
