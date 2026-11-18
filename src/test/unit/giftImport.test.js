const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseGift, splitAnswers, numericFromInner } = require('../../server/services/giftImport');

test('tipos básicos: opción múltiple, verdadero/falso, respuesta corta y numérica', () => {
  const { questions, skipped } = parseGift(`
// Un comentario que se ignora
$CATEGORY: $course$/Repaso

::P1:: Capital de Francia? {=Paris ~Roma ~Londres ~Berlín}

::P2:: La Tierra es plana {F}

::P3:: Siglas de CPU {=CPU =Unidad Central de Proceso}

::P4:: 12 + 7 {#19:0}
`);
  assert.deepEqual(skipped, []);
  assert.equal(questions.length, 4);

  assert.equal(questions[0].type, 'quiz');
  assert.equal(questions[0].question, 'Capital de Francia?');
  assert.deepEqual(questions[0].answers, ['Paris', 'Roma', 'Londres', 'Berlín']);
  assert.deepEqual(questions[0].correctAnswers, [1]);

  assert.equal(questions[1].type, 'true-false');
  assert.deepEqual(questions[1].correctAnswers, [2]);

  assert.equal(questions[2].type, 'short-answer');
  assert.deepEqual(questions[2].acceptedAnswers, ['CPU', 'Unidad Central de Proceso']);

  assert.equal(questions[3].type, 'numeric');
  assert.equal(questions[3].numericAnswer, 19);
  assert.equal(questions[3].tolerance, 0);
});

test('varias correctas pasan a opción múltiple', () => {
  const [q] = parseGift('::M:: Marcado {=HTML =XML ~Python ~CSS}').questions;
  assert.equal(q.type, 'multiple');
  assert.deepEqual(q.correctAnswers, [1, 2]);
});

test('pesos parciales y retroalimentación se separan de la respuesta', () => {
  const answers = splitAnswers('=Sí #Muy bien ~%50%Parcial ~No#Mal');
  assert.deepEqual(answers.map((a) => [a.prefix, a.weight, a.text]), [
    ['=', 100, 'Sí'],
    ['~', 50, 'Parcial'],
    ['~', 0, 'No']
  ]);
});

test('los caracteres escapados no cuentan como separadores', () => {
  const [q] = parseGift('::E:: Expresión {=a\\=b ~c\\~d}').questions;
  assert.deepEqual(q.answers.slice(0, 2), ['a=b', 'c~d']);
  assert.equal(q.type, 'quiz');
});

test('un rango numérico se convierte en valor central y tolerancia', () => {
  assert.deepEqual(numericFromInner('#10..14'), { numero: '12', tolerancia: '2' });
  assert.deepEqual(numericFromInner('#5:0.5'), { numero: '5', tolerancia: '0.5' });
  assert.equal(numericFromInner('#abc'), null);
});

test('preguntas no admitidas quedan en skipped con motivo', () => {
  const { questions, skipped } = parseGift(`
::Redacción:: Escribe un texto {}

::Emparejar:: Une {=capital -> Paris =país -> Francia}

::Demasiadas:: Elige {=a ~b ~c ~d ~e}

::Sin correcta:: Elige {~a ~b}

::Rota:: Pregunta sin cerrar {=a ~b
`);
  assert.equal(questions.length, 0);
  assert.deepEqual(skipped.map((s) => [s.name, s.code]), [
    ['Redacción', 'unsupported-type:essay'],
    ['Emparejar', 'unsupported-type:matching'],
    ['Demasiadas', 'too-many-answers'],
    ['Sin correcta', 'no-correct-answer'],
    ['Rota', 'malformed']
  ]);
  assert.equal(skipped[0].reason, 'tipo no compatible (essay)');
});
