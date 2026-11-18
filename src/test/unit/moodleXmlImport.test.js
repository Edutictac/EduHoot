const { test } = require('node:test');
const assert = require('node:assert/strict');

const { quizToMoodleXml } = require('../../server/services/moodleExport');
const { parseMoodleXml, decodeEntities } = require('../../server/services/moodleXmlImport');

const QUIZ = {
  name: 'Repaso',
  questions: [
    { question: 'Capital de Francia?', answers: ['Paris', 'Roma', 'Londres', 'Berlín'], type: 'quiz', correct: 1, correctAnswers: [1], time: 20 },
    { question: 'Lenguajes de marcado', answers: ['HTML', 'Python', 'XML', 'CSS'], type: 'multiple', correctAnswers: [1, 3], time: 0 },
    { question: 'La Tierra gira alrededor del Sol', answers: ['Verdadero', 'Falso'], type: 'true-false', correct: 1, correctAnswers: [1], time: 0 },
    { question: 'Siglas de CPU', answers: [], type: 'short-answer', acceptedAnswers: ['Unidad Central de Proceso', 'CPU'], time: 0 },
    { question: '12 + 7', answers: [], type: 'numeric', numericAnswer: 19, tolerance: 0, time: 0 }
  ]
};

test('ida y vuelta: lo que exporta EduHoot se importa con los mismos tipos y respuestas', () => {
  const { questions, skipped } = parseMoodleXml(quizToMoodleXml(QUIZ));
  assert.deepEqual(skipped, []);
  assert.equal(questions.length, 5);

  const [quiz, multiple, tf, short, numeric] = questions;
  assert.equal(quiz.type, 'quiz');
  assert.equal(quiz.question, 'Capital de Francia?');
  assert.deepEqual(quiz.answers, ['Paris', 'Roma', 'Londres', 'Berlín']);
  assert.deepEqual(quiz.correctAnswers, [1]);

  assert.equal(multiple.type, 'multiple');
  assert.deepEqual(multiple.correctAnswers, [1, 3]);

  assert.equal(tf.type, 'true-false');
  assert.deepEqual(tf.correctAnswers, [1]);

  assert.equal(short.type, 'short-answer');
  assert.deepEqual(short.acceptedAnswers, ['Unidad Central de Proceso', 'CPU']);

  assert.equal(numeric.type, 'numeric');
  assert.equal(numeric.numericAnswer, 19);
  assert.equal(numeric.tolerance, 0);
});

test('XML escrito a mano: entidades, CDATA y tipos no admitidos', () => {
  const xml = `<?xml version="1.0"?>
<quiz>
  <question type="category"><category><text>$course$</text></category></question>
  <question type="multichoice">
    <name><text>Pregunta 1</text></name>
    <questiontext format="html"><text><![CDATA[<p>¿Qué es 2 &amp;lt; 3?</p>]]></text></questiontext>
    <single>true</single>
    <answer fraction="100"><text><![CDATA[Sí &amp; no]]></text></answer>
    <answer fraction="0"><text>No &lt;lo sé&gt;</text></answer>
  </question>
  <question type="essay">
    <name><text>Redacción</text></name>
    <questiontext format="html"><text>Escribe un texto</text></questiontext>
  </question>
</quiz>`;
  const { questions, skipped } = parseMoodleXml(xml);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].type, 'quiz');
  // En el CDATA viene «&amp;lt;»: se decodifica una sola vez, así que queda «&lt;».
  assert.equal(questions[0].question, '¿Qué es 2 &lt; 3?');
  // Como en el CSV, las respuestas van hasta cuatro; las que faltan quedan vacías.
  assert.deepEqual(questions[0].answers, ['Sí & no', 'No <lo sé>', '', '']);
  assert.deepEqual(questions[0].correctAnswers, [1]);
  assert.deepEqual(skipped.map((s) => ({ name: s.name, reason: s.reason })), [{ name: 'Redacción', reason: 'tipo no compatible (essay)' }]);
});

test('una imagen incrustada en el enunciado llega como imagen de la pregunta', () => {
  const xml = `<quiz><question type="truefalse"><name><text>T</text></name>
    <questiontext format="html"><text><![CDATA[<p>Mira la imagen</p><p><img src="data:image/png;base64,AAAA" alt=""/></p>]]></text></questiontext>
    <answer fraction="100"><text>Verdadero</text></answer><answer fraction="0"><text>Falso</text></answer>
  </question></quiz>`;
  const [q] = parseMoodleXml(xml).questions;
  assert.equal(q.image, 'data:image/png;base64,AAAA');
  assert.equal(q.type, 'true-false');
});

test('un documento que no es un quiz de Moodle se rechaza', () => {
  assert.throws(() => parseMoodleXml('<html><body>hola</body></html>'), /no-moodle-quiz/);
});

test('decodeEntities resuelve entidades con nombre y numéricas', () => {
  assert.equal(decodeEntities('&lt;a&gt; &amp; &quot;b&quot; &#65; &#x42;'), '<a> & "b" A B');
});
