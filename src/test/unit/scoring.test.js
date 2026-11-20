const { test } = require('node:test');
const assert = require('node:assert/strict');

const { MAX_POINTS_PER_QUESTION, calculateQuestionScore, getSubmissionScoreRatio } = require('../../server/services/scoring');

test('calculateQuestionScore otorga el máximo recién empezada la pregunta', () => {
  const game = {
    gameData: {
      question: 1,
      questions: [{ time: 20 }],
      questionStartedAt: Date.now()
    }
  };
  assert.equal(calculateQuestionScore(game), MAX_POINTS_PER_QUESTION);
});

test('calculateQuestionScore decae con el tiempo transcurrido', () => {
  const game = {
    gameData: {
      question: 1,
      questions: [{ time: 20 }],
      questionStartedAt: Date.now() - 10000 // mitad del tiempo consumido
    }
  };
  const score = calculateQuestionScore(game);
  assert.ok(score > 0 && score < MAX_POINTS_PER_QUESTION, `esperaba puntuación intermedia, obtuvo ${score}`);
});

test('calculateQuestionScore no da puntos negativos si se agota el tiempo', () => {
  const game = {
    gameData: {
      question: 1,
      questions: [{ time: 20 }],
      questionStartedAt: Date.now() - 60000
    }
  };
  assert.equal(calculateQuestionScore(game), 0);
});

test('calculateQuestionScore aplica el multiplicador de puntos si está activo', () => {
  const game = {
    gameData: {
      question: 1,
      questions: [{ time: 20, pointsMultiplier: 2 }],
      questionStartedAt: Date.now()
    }
  };
  assert.equal(calculateQuestionScore(game), MAX_POINTS_PER_QUESTION * 2);
});

test('calculateQuestionScore ignora un multiplicador inválido', () => {
  const game = {
    gameData: {
      question: 1,
      questions: [{ time: 20, pointsMultiplier: -3 }],
      questionStartedAt: Date.now()
    }
  };
  assert.equal(calculateQuestionScore(game), MAX_POINTS_PER_QUESTION);
});

test('getSubmissionScoreRatio en poll siempre da 0, aunque haya respuesta', () => {
  assert.equal(getSubmissionScoreRatio({ type: 'poll', correctAnswers: [] }, [1]), 0);
});

test('getSubmissionScoreRatio en tipos de índice único delega en isSubmissionCorrect', () => {
  const meta = { type: 'quiz', correctAnswers: [2] };
  assert.equal(getSubmissionScoreRatio(meta, 2), 1);
  assert.equal(getSubmissionScoreRatio(meta, 1), 0);
});

test('getSubmissionScoreRatio en multiple pondera aciertos y fallos', () => {
  const meta = { type: 'multiple', correctAnswers: [1, 2] };
  assert.equal(getSubmissionScoreRatio(meta, [1, 2]), 1);
  assert.equal(getSubmissionScoreRatio(meta, [1]), 0.5);
  assert.equal(getSubmissionScoreRatio(meta, [1, 2, 3]), 0.5);
  assert.equal(getSubmissionScoreRatio(meta, [1, 2, 3, 4]), 0);
  assert.equal(getSubmissionScoreRatio(meta, [3]), 0);
});

test('getSubmissionScoreRatio en multiple sin correctAnswers da 0', () => {
  assert.equal(getSubmissionScoreRatio({ type: 'multiple', correctAnswers: [] }, [1]), 0);
});

test('questionTimeOf: una correspondencia tiene un 50 % más por defecto y el margen elegido', () => {
  const { questionTimeOf } = require('../../server/services/scoring');
  const matching = { type: 'matching', time: 20 };
  assert.equal(questionTimeOf({ options: {} }, matching), 30);
  assert.equal(questionTimeOf({ options: { matchingExtraTime: 25 } }, matching), 25);
  assert.equal(questionTimeOf({ options: { matchingExtraTime: 100 } }, matching), 40);
  assert.equal(questionTimeOf({ options: { matchingExtraTime: 33 } }, matching), 30);
  // El tiempo fijado en el lobby también se amplía en las correspondencias.
  assert.equal(questionTimeOf({ options: { timePerQuestion: 60, matchingExtraTime: 75 } }, matching), 105);
  // Las demás preguntas no cambian.
  assert.equal(questionTimeOf({ options: { matchingExtraTime: 100 } }, { type: 'quiz', time: 20 }), 20);
});
