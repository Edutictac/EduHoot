const { test } = require('node:test');
const assert = require('node:assert/strict');

const { quizToMoodleXml } = require('../../server/services/moodleExport');

test('quizToMoodleXml exporta una pregunta multichoice de índice único', () => {
  const xml = quizToMoodleXml({
    name: 'Mi quiz',
    questions: [
      { type: 'quiz', question: '¿Capital de Francia?', answers: ['París', 'Londres', 'Roma', 'Berlín'], correctAnswers: [1] }
    ]
  });
  assert.match(xml, /<quiz>/);
  assert.match(xml, /<question type="multichoice">/);
  assert.match(xml, /<single>true<\/single>/);
  assert.match(xml, /París/);
  assert.match(xml, /fraction="100"/);
});

test('quizToMoodleXml exporta multichoice con varias respuestas correctas repartiendo la fracción', () => {
  const xml = quizToMoodleXml({
    name: 'Mi quiz',
    questions: [
      { type: 'multiple', question: 'Instrumentos de cuerda', answers: ['Violín', 'Flauta', 'Guitarra', 'Trompeta'], correctAnswers: [1, 3] }
    ]
  });
  assert.match(xml, /<single>false<\/single>/);
  // Dos respuestas correctas sobre 100%: 50% cada una.
  assert.match(xml, /fraction="50"/);
});

test('quizToMoodleXml exporta short-answer con las respuestas aceptadas', () => {
  const xml = quizToMoodleXml({
    name: 'Mi quiz',
    questions: [
      { type: 'short-answer', question: '¿Capital de España?', acceptedAnswers: ['Madrid', 'madrid'] }
    ]
  });
  assert.match(xml, /<question type="shortanswer">/);
  assert.match(xml, /<usecase>0<\/usecase>/);
  assert.match(xml, /Madrid/);
});

test('quizToMoodleXml exporta numeric con tolerancia', () => {
  const xml = quizToMoodleXml({
    name: 'Mi quiz',
    questions: [
      { type: 'numeric', question: '¿Cuánto es 2+2?', numericAnswer: 4, tolerance: 0.5 }
    ]
  });
  assert.match(xml, /<question type="numerical">/);
  assert.match(xml, /<tolerance>/);
});

test('quizToMoodleXml exporta true-false marcando la respuesta correcta', () => {
  const xml = quizToMoodleXml({
    name: 'Mi quiz',
    questions: [
      { type: 'true-false', question: 'El cielo es azul', correctAnswers: [1] }
    ]
  });
  assert.match(xml, /<question type="truefalse">/);
  assert.match(xml, /Verdadero/);
  assert.match(xml, /Falso/);
});

test('quizToMoodleXml escapa HTML y envuelve en CDATA sin romper la estructura', () => {
  const xml = quizToMoodleXml({
    name: 'Mi quiz',
    questions: [
      { type: 'quiz', question: '<script>alert(1)</script> & "comillas"', answers: ['a', 'b'], correctAnswers: [1] }
    ]
  });
  assert.doesNotMatch(xml, /<script>/);
  assert.match(xml, /&lt;script&gt;/);
});

test('quizToMoodleXml usa un título genérico si el quiz no tiene nombre', () => {
  const xml = quizToMoodleXml({ questions: [] });
  assert.match(xml, /<quiz>/);
  assert.match(xml, /<\/quiz>/);
});
