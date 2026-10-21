const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeQuestionType,
  normalizeCorrectAnswers,
  splitAcceptedAnswers,
  parseLenientNumber,
  normalizeQuestionMeta,
  normalizeFreeText,
  isFreeAnswerType,
  looksLikeFreeTypeQuestion,
  isSubmissionCorrect,
  buildAnswerFields
} = require('../../server/questionUtils');

test('normalizeQuestionType reconoce los tipos canónicos', () => {
  assert.equal(normalizeQuestionType('quiz'), 'quiz');
  assert.equal(normalizeQuestionType('multiple'), 'multiple');
  assert.equal(normalizeQuestionType('short answer'), 'short-answer');
  assert.equal(normalizeQuestionType('true-false'), 'true-false');
  assert.equal(normalizeQuestionType('numeric'), 'numeric');
});

test('normalizeQuestionType normaliza mayúsculas, acentos y separadores', () => {
  assert.equal(normalizeQuestionType('TRUE FALSE'), 'true-false');
  assert.equal(normalizeQuestionType('Respuesta Corta'), 'short-answer');
  assert.equal(normalizeQuestionType('numérica'), 'numeric');
  assert.equal(normalizeQuestionType('MULTI'), 'multiple');
  assert.equal(normalizeQuestionType('verdadero_falso'), 'true-false');
});

test('normalizeQuestionType devuelve quiz ante valores vacíos o desconocidos', () => {
  assert.equal(normalizeQuestionType(''), 'quiz');
  assert.equal(normalizeQuestionType(undefined), 'quiz');
  assert.equal(normalizeQuestionType('cosa rara'), 'quiz');
});

test('parseLenientNumber acepta coma decimal y espacios', () => {
  assert.equal(parseLenientNumber('3,14'), 3.14);
  assert.equal(parseLenientNumber(' 42 '), 42);
  assert.equal(parseLenientNumber(7), 7);
  assert.equal(parseLenientNumber(''), null);
  assert.equal(parseLenientNumber(null), null);
  assert.equal(parseLenientNumber('abc'), null);
});

test('splitAcceptedAnswers separa por |, coma y salto de línea, sin duplicados', () => {
  assert.deepEqual(splitAcceptedAnswers('perro|gato'), ['perro', 'gato']);
  assert.deepEqual(splitAcceptedAnswers('perro, gato'), ['perro', 'gato']);
  assert.deepEqual(splitAcceptedAnswers('perro\ngato'), ['perro', 'gato']);
  // Los duplicados (ignorando acentos/mayúsculas) se eliminan.
  assert.deepEqual(splitAcceptedAnswers('PERRO, perro, gato'), ['PERRO', 'gato']);
  assert.deepEqual(splitAcceptedAnswers(''), []);
});

test('normalizeCorrectAnswers acota índices a 1..4 y elimina duplicados', () => {
  assert.deepEqual(normalizeCorrectAnswers('1,2,1'), [1, 2]);
  assert.deepEqual(normalizeCorrectAnswers([2]), [2]);
  assert.deepEqual(normalizeCorrectAnswers(3), [3]);
  // Valores fuera de rango se recortan.
  assert.deepEqual(normalizeCorrectAnswers('0,9'), [1, 4]);
  // Sin nada válido, cae a [1].
  assert.deepEqual(normalizeCorrectAnswers(''), [1]);
});

test('normalizeQuestionMeta infiere short-answer desde texto', () => {
  const meta = normalizeQuestionMeta({ type: '', texto: 'respuesta libre' });
  assert.equal(meta.type, 'short-answer');
  assert.ok(meta.acceptedAnswers.includes('respuesta libre'));
});

test('normalizeQuestionMeta infiere numeric desde número', () => {
  const meta = normalizeQuestionMeta({ type: '', numero: '3,5', tolerancia: '0,5' });
  assert.equal(meta.type, 'numeric');
  assert.equal(meta.numericAnswer, 3.5);
  assert.equal(meta.tolerance, 0.5);
});

test('normalizeQuestionMeta recorta true-false a 2 opciones', () => {
  const meta = normalizeQuestionMeta({ type: 'true-false', correct: '2' });
  assert.equal(meta.type, 'true-false');
  assert.deepEqual(meta.correctAnswers, [2]);
});

test('normalizeFreeText quita acentos, mayúsculas y puntuación', () => {
  assert.equal(normalizeFreeText('  Río, Ñandú!  '), 'rio nandu');
  assert.equal(normalizeFreeText(''), '');
  assert.equal(normalizeFreeText(null), '');
});

test('isFreeAnswerType distingue los tipos de respuesta libre', () => {
  assert.equal(isFreeAnswerType('short-answer'), true);
  assert.equal(isFreeAnswerType('numeric'), true);
  assert.equal(isFreeAnswerType('quiz'), false);
  assert.equal(isFreeAnswerType('multiple'), false);
  assert.equal(isFreeAnswerType('true-false'), false);
  assert.equal(isFreeAnswerType('poll'), false);
});

test('looksLikeFreeTypeQuestion detecta señales de tipo libre aunque el type venga corrupto', () => {
  assert.equal(looksLikeFreeTypeQuestion({ acceptedAnswers: ['gos'] }), true);
  assert.equal(looksLikeFreeTypeQuestion({ acceptedAnswers: '' }), false);
  assert.equal(looksLikeFreeTypeQuestion({ numericAnswer: 3 }), true);
  assert.equal(looksLikeFreeTypeQuestion({ numero: '3,5' }), true);
  assert.equal(looksLikeFreeTypeQuestion({ tolerancia: '0,5' }), true);
  assert.equal(looksLikeFreeTypeQuestion({ tolerance: 0.5 }), true);
  assert.equal(looksLikeFreeTypeQuestion({}), false);
  assert.equal(looksLikeFreeTypeQuestion(null), false);
});

test('isSubmissionCorrect en short-answer ignora acentos/mayúsculas y accepta acceptedAnswers como string', () => {
  const meta = { type: 'short-answer', correctAnswers: [1], acceptedAnswers: ['Perro', 'Gato'] };
  assert.equal(isSubmissionCorrect(meta, 'PERRO'), true);
  assert.equal(isSubmissionCorrect(meta, { text: 'perro' }), true);
  assert.equal(isSubmissionCorrect(meta, 'loro'), false);
  const metaStringAccepted = { type: 'short-answer', correctAnswers: [1], acceptedAnswers: 'perro, gato' };
  assert.equal(isSubmissionCorrect(metaStringAccepted, 'gato'), true);
});

test('isSubmissionCorrect en numeric respeta la tolerancia', () => {
  const meta = { type: 'numeric', correctAnswers: [1], numericAnswer: 10, tolerance: 0.5 };
  assert.equal(isSubmissionCorrect(meta, 10.4), true);
  assert.equal(isSubmissionCorrect(meta, 10.6), false);
});

test('isSubmissionCorrect en multiple exige el mismo conjunto exacto', () => {
  const meta = { type: 'multiple', correctAnswers: [1, 3] };
  assert.equal(isSubmissionCorrect(meta, [1, 3]), true);
  assert.equal(isSubmissionCorrect(meta, [3, 1]), true);
  assert.equal(isSubmissionCorrect(meta, [1]), false);
  assert.equal(isSubmissionCorrect(meta, [1, 2, 3]), false);
});

test('isSubmissionCorrect en tipos de índice único y casos sin correctAnswers', () => {
  const meta = { type: 'quiz', correctAnswers: [2] };
  assert.equal(isSubmissionCorrect(meta, 2), true);
  assert.equal(isSubmissionCorrect(meta, 1), false);
  assert.equal(isSubmissionCorrect({ type: 'quiz', correctAnswers: [] }, 1), false);
});

test('buildAnswerFields en numeric devuelve numericAnswer y tolerance', () => {
  const meta = { type: 'numeric', numericAnswer: 7, tolerance: 0.5 };
  assert.deepEqual(buildAnswerFields({}, meta, { hasVideo: false }), { numericAnswer: 7, tolerance: 0.5 });
});

test('buildAnswerFields en tipos no indexats no afig cap camp extra', () => {
  assert.deepEqual(buildAnswerFields({}, { type: 'quiz' }, { hasVideo: false }), {});
  assert.deepEqual(buildAnswerFields({}, { type: 'multiple' }, { hasVideo: false }), {});
  assert.deepEqual(buildAnswerFields({}, { type: 'true-false' }, { hasVideo: false }), {});
  assert.deepEqual(buildAnswerFields({}, { type: 'poll' }, { hasVideo: false }), {});
});

test('buildAnswerFields (caracterització): recupera acceptedAnswers des del camp video retrocompatible', () => {
  const meta = { type: 'short-answer', acceptedAnswers: [] };
  const item = { video: 'resposta1, resposta2' };
  assert.deepEqual(buildAnswerFields(item, meta, { hasVideo: false }).acceptedAnswers, ['resposta1', 'resposta2']);
  // Si ja hi ha un vídeo real, no s'interpreta eixe camp com a text de resposta.
  assert.deepEqual(buildAnswerFields(item, meta, { hasVideo: true }).acceptedAnswers, []);
  // Si ja hi ha acceptedAnswers del propi meta, no cal recuperar res del vídeo.
  const metaAmbAccepted = { type: 'short-answer', acceptedAnswers: ['ja existent'] };
  assert.deepEqual(buildAnswerFields(item, metaAmbAccepted, { hasVideo: false }).acceptedAnswers, ['ja existent']);
});
