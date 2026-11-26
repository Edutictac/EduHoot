// Informe guardat d'una partida → classificació i aciertos per pregunta (Mis partidas, «Resultados»).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseReportResults, parseCsvRows } = require('../../server/services/reportResults');

const CSV = [
  'RESUMEN FINAL',
  'pin;quizId;quizNombre;preguntasTotales;posicion;alumno;puntuacionFinal;aciertos;fallos;sinResponder',
  '1234;q1;Geografia;2;1;Ana;1800;2;0;0',
  '1234;q1;Geografia;2;2;"Luis; B";900;1;1;0',
  '',
  'pin;quizId;quizNombre;preguntasTotales;posicion;alumno;puntuacionFinal;aciertos;fallos;sinResponder;preguntaNumero;tipo;enunciado;tiempoLimiteSegundos;respuestaJugador;respuestaCorrecta;resultado;tiempoRespuestaMs',
  '1234;q1;Geografia;2;1;Ana;1800;2;0;0;1;quiz;"Capital de Francia";20;B: París;B: París;correcta;1200',
  '1234;q1;Geografia;2;1;Ana;1800;2;0;0;2;quiz;"Río más largo";20;C: Nilo;A: Amazonas;incorrecta;3000',
  '1234;q1;Geografia;2;2;"Luis; B";900;1;1;0;1;quiz;"Capital de Francia";20;A: Lyon;B: París;incorrecta;4000',
  '1234;q1;Geografia;2;2;"Luis; B";900;1;1;0;2;quiz;"Río más largo";20;A: Amazonas;A: Amazonas;correcta;2500'
].join('\n');

test('la classificació surt ordenada per posició, amb els noms amb punt i coma', () => {
  const { players } = parseReportResults(CSV);
  assert.deepEqual(players.map(p => p.name), ['Ana', 'Luis; B']);
  assert.deepEqual(players[0], { position: 1, name: 'Ana', score: 1800, correct: 2, wrong: 0, unanswered: 0 });
  assert.equal(players[1].score, 900);
});

test('els aciertos per pregunta compten correctes, fallos i sin responder', () => {
  const { questions } = parseReportResults(CSV);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].text, 'Capital de Francia');
  assert.deepEqual(
    { correct: questions[0].correct, wrong: questions[0].wrong, unanswered: questions[0].unanswered },
    { correct: 1, wrong: 1, unanswered: 0 }
  );
  assert.deepEqual({ correct: questions[1].correct, wrong: questions[1].wrong }, { correct: 1, wrong: 1 });
});

test('un informe buit o sense detall no falla', () => {
  assert.deepEqual(parseReportResults(''), { players: [], questions: [] });
  assert.deepEqual(parseReportResults(null), { players: [], questions: [] });
});

test('les cometes escapades i els salts de línia dins de cometes es llegeixen bé', () => {
  const rows = parseCsvRows('a;"b ""c"" d";"e\nf"\n');
  assert.deepEqual(rows, [['a', 'b "c" d', 'e\nf']]);
});
