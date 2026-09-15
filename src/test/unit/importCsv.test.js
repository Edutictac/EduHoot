const { test } = require('node:test');
const assert = require('node:assert/strict');

const { parseCsv, toQuestion } = require('../../server/importCsv');

const SAMPLE_CSV = [
  'tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia',
  'quiz;¿Capital de Francia?;París;Londres;Roma;Madrid;20;1;;;;;',
  'multiple;¿Colores primarios?;Rojo;Azul;Verde;Negro;30;1,2;;;;;'
].join('\n');

test('parseCsv omite la cabecera y parsea las filas', () => {
  const rows = parseCsv(SAMPLE_CSV);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].pregunta, '¿Capital de Francia?');
  assert.equal(rows[0].tipo, 'quiz');
  assert.equal(rows[0].correcta, '1');
  assert.equal(rows[1].tipo, 'multiple');
  assert.equal(rows[1].correcta, '1,2');
});

test('parseCsv maneja campos entrecomillados con separador interno', () => {
  const csv = 'quiz;"¿Cuál es 2+2?; Piénsalo";4;5;6;7;15;1;;;;;';
  const rows = parseCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pregunta, '¿Cuál es 2+2?; Piénsalo');
  assert.equal(rows[0].r1, '4');
});

test('parseCsv ignora filas con menos de 8 columnas', () => {
  const rows = parseCsv('quiz;corto;1;2\n');
  assert.equal(rows.length, 0);
});

test('toQuestion construye pregunta tipo quiz con índice correcto', () => {
  const q = toQuestion({
    tipo: 'quiz',
    pregunta: 'Pregunta',
    r1: 'A', r2: 'B', r3: 'C', r4: 'D',
    tiempo: '20', correcta: '3'
  });
  assert.equal(q.type, 'quiz');
  assert.equal(q.correct, 3);
  assert.deepEqual(q.correctAnswers, [3]);
  assert.deepEqual(q.answers, ['A', 'B', 'C', 'D']);
  assert.equal(q.time, 20);
});

test('toQuestion genera short-answer con respuestas aceptadas', () => {
  const q = toQuestion({
    tipo: 'short-answer',
    pregunta: 'Escribe un color',
    r1: '', r2: '', r3: '', r4: '',
    texto: 'rojo|azul'
  });
  assert.equal(q.type, 'short-answer');
  assert.deepEqual(q.acceptedAnswers, ['rojo', 'azul']);
});

test('toQuestion genera numeric con número y tolerancia', () => {
  const q = toQuestion({
    tipo: 'numeric',
    pregunta: '¿Raíz de 2?',
    r1: '', r2: '', r3: '', r4: '',
    numero: '1,41', tolerancia: '0,01'
  });
  assert.equal(q.type, 'numeric');
  assert.equal(q.numericAnswer, 1.41);
  assert.equal(q.tolerance, 0.01);
});
