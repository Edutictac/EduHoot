const { isSubmissionCorrect } = require('../questionUtils');

const MAX_POINTS_PER_QUESTION = 1000;

function calculateQuestionScore(game) {
  const gameData = game && game.gameData ? game.gameData : {};
  const questions = Array.isArray(gameData.questions) ? gameData.questions : [];
  const current = questions[(Number(gameData.question) || 1) - 1] || {};
  const limitSeconds = Number(
    (gameData.options && gameData.options.timePerQuestion) || current.time || 20
  );
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
  if (meta.type !== 'multiple') return isSubmissionCorrect(meta, submission) ? 1 : 0;
  const selected = Array.isArray(submission) ? new Set(submission) : new Set();
  const correct = Array.isArray(meta.correctAnswers) ? meta.correctAnswers : [];
  if (!correct.length) return 0;
  // Cada selecció errònia resta el mateix que suma una encertada; mínim 0.
  const hits = correct.filter((answer) => selected.has(answer)).length;
  const wrongs = selected.size - hits;
  return Math.max(0, hits - wrongs) / correct.length;
}

module.exports = {
  MAX_POINTS_PER_QUESTION,
  calculateQuestionScore,
  getSubmissionScoreRatio
};
