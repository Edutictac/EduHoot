// Ordenar en els formats d'intercanvi: XML de Moodle (ida i volta) i CSV.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { quizToMoodleXml } = require('../../server/services/moodleExport');
const { parseMoodleXml } = require('../../server/services/moodleXmlImport');
const createSessionReportService = require('../../server/services/sessionReport');
const { quizToCsv } = createSessionReportService({ players: { getPlayers: () => [] }, onFinished: () => {} });
const { parseCsv, toQuestion } = require('../../server/importCsv');

const ORDER = { type: 'order', question: 'Pasos del arranque', items: ['Encender', 'Cargar', 'Iniciar'], orderGrading: -1, layout: 'horizontal', answers: ['', '', '', ''], time: 20 };

test('Moodle: l\'exportació escriu una pregunta «ordering» amb les respostes en ordre correcte', () => {
  const xml = quizToMoodleXml({ name: 'Arranque', questions: [ORDER] });
  assert.match(xml, /<question type="ordering">/);
  assert.match(xml, /<layouttype>HORIZONTAL<\/layouttype>/);
  assert.match(xml, /<gradingtype>ALL_OR_NOTHING<\/gradingtype>/);
  const fractions = [...xml.matchAll(/<answer fraction="(\d+)"[^>]*>\s*<text>([^<]*)<\/text>/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(fractions, [['1', 'Encender'], ['2', 'Cargar'], ['3', 'Iniciar']]);
  assert.doesNotMatch(xml, /type="multichoice"/);
});

test('Moodle: ida y vuelta de ordenar (elementos, puntuación y disposición)', () => {
  const { questions, skipped } = parseMoodleXml(quizToMoodleXml({ name: 'Arranque', questions: [ORDER] }));
  assert.deepEqual(skipped, []);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].type, 'order');
  assert.deepEqual(questions[0].items, ['Encender', 'Cargar', 'Iniciar']);
  assert.equal(questions[0].orderGrading, -1);
  assert.equal(questions[0].layout, 'horizontal');
});

test('Moodle: una «ordering» con un solo elemento o repetida s\'omet amb el motiu', () => {
  const xml = (answers) => `<?xml version="1.0"?><quiz><question type="ordering"><name><text>X</text></name>` +
    `<questiontext format="html"><text>Ordena</text></questiontext><gradingtype>ABSOLUTE_POSITION</gradingtype>` +
    answers.map((t, i) => `<answer fraction="${i + 1}"><text>${t}</text></answer>`).join('') + `</question></quiz>`;
  assert.deepEqual(parseMoodleXml(xml(['Solo'])).skipped.map((s) => s.code), ['not-enough-items']);
  assert.deepEqual(parseMoodleXml(xml(['A', 'A'])).skipped.map((s) => s.code), ['repeated-order-item']);
});

test('CSV: la sortida escriu ordenar amb els elements en ordre correcte a «texto», i l\'entrada els torna', () => {
  const csv = quizToCsv({ name: 'Arranque', questions: [ORDER] });
  const line = csv.split('\n')[1];
  assert.match(line, /^order;Pasos del arranque;/);
  assert.match(line, /Encender\|Cargar\|Iniciar/);
  const [row] = parseCsv(csv);
  const q = toQuestion(row);
  assert.equal(q.type, 'order');
  assert.deepEqual(q.items, ['Encender', 'Cargar', 'Iniciar']);
});

test('CSV: la paraula «ordenar» de la columna tipo també és ordenar, i amb menys de 2 elements la fila no es desa', () => {
  const ok = parseCsv('tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia\nordenar;Pasos;;;;;20;;;;A|B|C;;')[0];
  assert.equal(toQuestion(ok).type, 'order');
  const bad = parseCsv('tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia\nordenar;Pasos;;;;;20;;;;A;;')[0];
  assert.equal(toQuestion(bad), null);
});

test('CSV: un element amb «|» o barra torna intacte; la puntuació i la disposició també viatgen', () => {
  const tricky = { type: 'order', question: 'Fitxers', items: ['a|b', 'c\\d', 'e\\'], orderGrading: -1, layout: 'horizontal', answers: ['', '', '', ''], time: 20 };
  const csv = quizToCsv({ name: 'Fitxers', questions: [tricky] });
  const [row] = parseCsv(csv);
  const q = toQuestion(row);
  assert.deepEqual(q.items, ['a|b', 'c\\d', 'e\\']);
  assert.equal(q.orderGrading, -1);
  assert.equal(q.layout, 'horizontal');
});

test('CSV antic: sense puntuació ni disposició, ordenar és absoluta i vertical', () => {
  const [row] = parseCsv('tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia\nordenar;Pasos;;;;;20;;;;A|B|C;;');
  const q = toQuestion(row);
  assert.equal(q.orderGrading, 0);
  assert.equal(q.layout, 'vertical');
});
