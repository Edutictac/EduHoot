const { isSubmissionCorrect, matchingScoreRatio, normalizeMatchingExtraTime } = require('../questionUtils');

const MAX_POINTS_PER_QUESTION = 1000;

// Segundos de una pregunta: el tiempo fijado en el lobby o el de la pregunta (20 si no
// tiene). Una correspondencia tiene además el margen elegido (25–100 %, 50 % por defecto).
function questionTimeOf(gameData, current) {
  const options = (gameData && gameData.options) || {};
  const base = Number(options.timePerQuestion || (current && current.time) || 20) || 20;
  if (!current || current.type !== 'matching') return base;
  return Math.round(base * (1 + normalizeMatchingExtraTime(options.matchingExtraTime) / 100));
}

function calculateQuestionScore(game) {
  const gameData = game && game.gameData ? game.gameData : {};
  const questions = Array.isArray(gameData.questions) ? gameData.questions : [];
  const current = questions[(Number(gameData.question) || 1) - 1] || {};
  const limitSeconds = questionTimeOf(gameData, current);
  const limitMs = Math.max(1, limitSeconds) * 1000;
  const startedAt = Number(gameData.questionStartedAt) || Date.now();
  const elapsedMs = Math.max(0, Date.now() - startedAt);
  const remainingRatio = Math.max(0, Math.min(1, (limitMs - elapsedMs) / limitMs));
  const multiplierRaw = Number(current.pointsMultiplier);
  const multiplier = Number.isFinite(multiplierRaw) && multiplierRaw > 0 ? multiplierRaw : 1;
  return Math.round(MAX_POINTS_PER_QUESTION * remainingRatio * multiplier);
}

function getSubmissionScoreRatio(meta, submission) {
  if (!meta || meta.type === 'poll') return 0;
  // Correspondencia: proporción de parejas acertadas, sin restar por los fallos.
  if (meta.type === 'matching') return matchingScoreRatio(meta, submission);
  if (meta.type !== 'multiple') return isSubmissionCorrect(meta, submission) ? 1 : 0;
  const selected = Array.isArray(submission) ? new Set(submission) : new Set();
  const correct = Array.isArray(meta.correctAnswers) ? meta.correctAnswers : [];
  if (!correct.length) return 0;
  // Cada selecció errònia resta el mateix que suma una encertada; mínim 0.
  const hits = correct.filter((answer) => selected.has(answer)).length;
  const wrongs = selected.size - hits;
  return Math.max(0, hits - wrongs) / correct.length;
}

// Racha de aciertos (feature 11): a partir de la tercera respuesta correcta seguida,
// +50 puntos por cada respuesta, con un tope de +250. Un fallo, un acierto parcial o no
// responder reinicia la racha. Una encuesta no la cambia.
const STREAK_MIN_FOR_BONUS = 3;
const STREAK_BONUS_PER_STEP = 50;
const STREAK_BONUS_MAX = 250;

function streakBonus(streak) {
  const n = Number(streak) || 0;
  if (n < STREAK_MIN_FOR_BONUS) return 0;
  return Math.min(STREAK_BONUS_MAX, (n - STREAK_MIN_FOR_BONUS + 1) * STREAK_BONUS_PER_STEP);
}

// Racha tras una respuesta: acierto completo suma 1; cualquier otro resultado la reinicia.
function nextStreak(streak, isFullyCorrect) {
  return isFullyCorrect ? (Number(streak) || 0) + 1 : 0;
}

// La racha está activada salvo que la partida la desactive en el lobby.
function isStreakEnabled(game) {
  return !(game && game.gameData && game.gameData.options && game.gameData.options.streak === false);
}

module.exports = {
  MAX_POINTS_PER_QUESTION,
  STREAK_MIN_FOR_BONUS,
  questionTimeOf,
  calculateQuestionScore,
  getSubmissionScoreRatio,
  streakBonus,
  nextStreak,
  isStreakEnabled
};
