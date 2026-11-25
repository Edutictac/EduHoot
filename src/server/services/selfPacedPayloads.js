// Mensajes que recibe el alumno en el modo autoritme (en clase) y en los deberes:
// pregunta, resultado y resumen final. Puros: no dependen de sockets ni de MongoDB.
const sp = require('./selfPaced');
const { getQuestionMeta, orderDisplayOf } = require('../questionUtils');
const { studentMetaOf } = require('./showAnswers');
const { questionTimeOf } = require('./scoring');

// `toStudent(full, options)` decide si el alumno recibe la pregunta completa o a ciegas
// (solo en clase); en los deberes es la identidad.
function questionPayload(game, player, now, toStudent) {
  const q = sp.currentQuestion(game, player);
  const state = sp.ensureState(player);
  const meta = getQuestionMeta(q);
  const full = {
    question: q.question,
    answers: [0, 1, 2, 3].map((i) => (Array.isArray(q.answers) ? q.answers[i] : undefined)),
    type: meta.type,
    image: q.image || '',
    video: q.video || '',
    pointsMultiplier: Number(q.pointsMultiplier) > 1 ? 2 : 1,
    time: Math.ceil(sp.remainingMs(game, player, now) / 1000),
    ...(meta.type === 'matching' ? { matchLeft: meta.matchLeft, matchRight: meta.matchRight } : {}),
    ...(meta.type === 'order' ? { orderItems: orderDisplayOf(meta), layout: meta.layout } : {})
  };
  return {
    ...toStudent(full, game.gameData.options),
    questionNumber: state.index,
    totalQuestions: sp.progressOf(game, player).total,
    timeTotal: questionTimeOf(game.gameData, q),
    hand: !!state.hand
  };
}

// Resultado de una pregunta (sin ranking: lo añade quien lo tenga).
function resultPayload(game, player, res) {
  const q = sp.currentQuestion(game, player);
  const meta = getQuestionMeta(q);
  const state = sp.ensureState(player);
  return {
    outcome: res.outcome,
    ratio: res.scoreRatio,
    points: res.points,
    bonus: res.bonus,
    streak: Number(player.gameData.streak) || 0,
    score: player.gameData.score,
    questionNumber: state.index,
    totalQuestions: sp.progressOf(game, player).total,
    // Respuesta correcta solo si «Mostrar respuestas» está activado.
    meta: studentMetaOf(game, meta)
  };
}

// Resumen final del alumno (sin puesto: lo añade quien lo tenga).
function finishedPayload(game, player) {
  return {
    score: player.gameData.score,
    correctCount: player.gameData.correctCount || 0,
    wrongCount: player.gameData.wrongCount || 0,
    bestStreak: player.gameData.bestStreak || 0,
    total: game.gameData.scoredQuestionsCount || 0
  };
}

module.exports = { questionPayload, resultPayload, finishedPayload };
