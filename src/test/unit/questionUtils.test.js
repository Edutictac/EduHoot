const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeQuestionType,
  normalizeCorrectAnswers,
  splitAcceptedAnswers,
  parseLenientNumber,
  normalizeQuestionMeta
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
