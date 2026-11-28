const { test } = require('node:test');
const assert = require('node:assert/strict');

const createGameHelpers = require('../../server/sockets/gameHelpers');

// Regresión de la issue #24: "Jugar a l'aula" filtraba por error las preguntas
// de respuesta libre (short-answer/numeric), un filtro pensado solo para el
// modo Multijugador (pantalla compartida, sin teclado).
function makeHelpers() {
  return createGameHelpers({
    io: { to: () => ({ emit: () => {} }) },
    games: { games: [] },
    players: {},
    cleanImportedText: (value) => value || ''
  });
}

test('buildQuestions no filtra preguntas de respuesta libre (short-answer/numeric)', () => {
  const { buildQuestions } = makeHelpers();
  const questions = [
    { question: '¿Capital de Francia?', answers: ['París', 'Roma', 'Berlín', 'Lisboa'], correct: 1, type: 'quiz' },
    { question: 'CPU significa...', type: 'short-answer', acceptedAnswers: ['Unitat Central de Processament'] },
    { question: '12 + 7', type: 'numeric', numericAnswer: 19, tolerance: 0 }
  ];

  const built = buildQuestions(questions, {});

  assert.equal(built.length, 3, 'las preguntas de respuesta libre no deben descartarse');
  assert.deepEqual(built.map((q) => q.type), ['quiz', 'short-answer', 'numeric']);

  const shortAnswer = built[1];
  assert.deepEqual(shortAnswer.acceptedAnswers, ['Unitat Central de Processament']);

  const numeric = built[2];
  assert.equal(numeric.numericAnswer, 19);
  assert.equal(numeric.tolerance, 0);
});

test('buildQuestions con un quiz compuesto solo de preguntas numéricas no se queda vacío', () => {
  const { buildQuestions } = makeHelpers();
  const questions = [
    { question: '12 + 7', type: 'numeric', numericAnswer: 19, tolerance: 0 },
    { question: '9 x 6', type: 'numeric', numericAnswer: 54, tolerance: 0 }
  ];

  const built = buildQuestions(questions, {});

  assert.equal(built.length, 2);
});
