const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeQuestionType,
  normalizeQuestionMeta,
  getQuestionMeta,
  parseMatchingPairs,
  buildMatchingLayout,
  normalizeMatchingSubmission,
  isSubmissionCorrect,
  MATCHING_MAX_ITEMS,
  normalizeMatchingBlindStyle,
  hasMatchingQuestion
} = require('../../server/questionUtils');
const { getSubmissionScoreRatio } = require('../../server/services/scoring');
const { studentMetaOf } = require('../../server/services/showAnswers');
const { normalizeQuestions, isMultiplayerFreeTypeQuestion } = require('../../server/services/quizNormalize');
const createGameHelpers = require('../../server/sockets/gameHelpers');

// Pregunta de correspondencia (feature 7, «emparejar»).

const capitals = [
  { left: 'Francia', right: 'París' },
  { left: 'Italia', right: 'Roma' },
  { left: 'Alemania', right: 'Berlín' },
  { left: '', right: 'Lisboa' } // impostora
];

function makeHelpers() {
  return createGameHelpers({
    io: { to: () => ({ emit: () => {} }) },
    games: { games: [] },
    players: { getPlayers: () => [] },
    cleanImportedText: (value) => value || ''
  });
}

test('normalizeQuestionType reconoce la correspondencia en varios idiomas', () => {
  ['matching', 'Matching', 'correspondència', 'Correspondencia', 'emparellar', 'emparejar', 'relacionar']
    .forEach((raw) => assert.equal(normalizeQuestionType(raw), 'matching', raw));
});

test('parseMatchingPairs lee el texto del CSV con impostoras', () => {
  assert.deepEqual(parseMatchingPairs('Francia -> París | Italia->Roma | -> Lisboa'), [
    { left: 'Francia', right: 'París' },
    { left: 'Italia', right: 'Roma' },
    { left: '', right: 'Lisboa' }
  ]);
});

test('parseMatchingPairs descarta derechas vacías o repetidas y limita a 8', () => {
  const pairs = parseMatchingPairs([
    { left: 'a', right: 'X' },
    { left: 'b', right: 'x' }, // repetida (sin distinguir mayúsculas)
    { left: 'c', right: '  ' } // vacía
  ]);
  assert.deepEqual(pairs, [{ left: 'a', right: 'X' }]);

  const many = Array.from({ length: 12 }, (_, i) => ({ left: 'L' + i, right: 'R' + i }));
  assert.equal(parseMatchingPairs(many).length, MATCHING_MAX_ITEMS);
});

test('normalizeQuestionMeta deduce la correspondencia del texto del CSV si no hay tipo', () => {
  const meta = normalizeQuestionMeta({ texto: 'Francia -> París | Italia -> Roma' });
  assert.equal(meta.type, 'matching');
  assert.equal(meta.pairs.length, 2);
  // Una respuesta corta con una sola flecha sigue siendo respuesta corta.
  assert.equal(normalizeQuestionMeta({ texto: 'a -> b' }).type, 'short-answer');
});

test('buildMatchingLayout: izquierda sin impostoras y solución según el orden de la derecha', () => {
  // Orden de la derecha: Lisboa, Berlín, París, Roma.
  const layout = buildMatchingLayout(capitals, [3, 2, 0, 1]);
  assert.deepEqual(layout.matchLeft, ['Francia', 'Italia', 'Alemania']);
  assert.deepEqual(layout.matchRight, ['Lisboa', 'Berlín', 'París', 'Roma']);
  assert.deepEqual(layout.matchSolution, [2, 3, 1]);
});

test('normalizeMatchingSubmission ajusta la longitud y descarta índices no válidos', () => {
  assert.deepEqual(normalizeMatchingSubmission([1, '2', 9, -1, 0], 4, 4), [1, 2, null, null]);
  assert.deepEqual(normalizeMatchingSubmission({ matches: [0] }, 2, 3), [0, null]);
  assert.deepEqual(normalizeMatchingSubmission('basura', 2, 3), [null, null]);
});

test('puntuación proporcional: aciertos / parejas, sin restar por fallos', () => {
  const meta = getQuestionMeta({ type: 'matching', pairs: capitals });
  // Sin barajar: la solución es [0, 1, 2].
  assert.equal(getSubmissionScoreRatio(meta, [0, 1, 2]), 1);
  assert.equal(isSubmissionCorrect(meta, [0, 1, 2]), true);
  assert.ok(Math.abs(getSubmissionScoreRatio(meta, [0, 1, 3]) - 2 / 3) < 1e-9);
  assert.equal(isSubmissionCorrect(meta, [0, 1, 3]), false);
  assert.equal(getSubmissionScoreRatio(meta, [3, 3, 3]), 0);
  assert.equal(getSubmissionScoreRatio(meta, []), 0);
});

test('normalizeQuestions guarda las parejas al guardar el cuestionario', () => {
  const [q] = normalizeQuestions([{ question: 'Capitales', type: 'matching', pairs: capitals }]);
  assert.equal(q.type, 'matching');
  assert.deepEqual(q.pairs, capitals);
});

test('buildQuestions baraja la derecha y la solución sigue siendo coherente', () => {
  const { buildQuestions } = makeHelpers();
  for (let i = 0; i < 20; i += 1) {
    const [q] = buildQuestions([{ question: 'Capitales', type: 'matching', pairs: capitals }], { randomAnswers: false });
    assert.deepEqual(q.matchLeft, ['Francia', 'Italia', 'Alemania']);
    assert.equal(q.matchRight.length, 4);
    assert.notDeepEqual(q.matchRight, ['París', 'Roma', 'Berlín', 'Lisboa'], 'la derecha no queda en el orden guardado');
    assert.deepEqual(q.matchSolution.map((idx) => q.matchRight[idx]), ['París', 'Roma', 'Berlín']);
    // La corrección en partida usa la disposición barajada.
    assert.equal(getSubmissionScoreRatio(getQuestionMeta(q), q.matchSolution), 1);
  }
});

test('datos de la pregunta: el alumnado recibe las columnas pero no la solución', () => {
  const { buildQuestions, getCurrentQuestionPayload, buildStudentPlayerPayload } = makeHelpers();
  const questions = buildQuestions([{ question: 'Capitales', type: 'matching', pairs: capitals }], {});
  const game = { hostId: 'h', gameData: { question: 1, questions, options: {} } };
  const payload = getCurrentQuestionPayload(game);

  assert.deepEqual(payload.hostPayload.matchSolution, questions[0].matchSolution);
  assert.deepEqual(payload.playerPayload.matchLeft, questions[0].matchLeft);
  assert.deepEqual(payload.playerPayload.matchRight, questions[0].matchRight);
  assert.equal(payload.playerPayload.matchSolution, undefined);

  const blind = buildStudentPlayerPayload(payload.playerPayload, { sendToStudents: false });
  assert.equal(blind.blind, true);
  assert.equal(blind.leftCount, 3);
  assert.equal(blind.rightCount, 4);
  assert.equal(blind.matchLeft, undefined);
  assert.equal(blind.blindStyle, 'codes');
  assert.equal(buildStudentPlayerPayload(payload.playerPayload, { sendToStudents: false, matchingBlindStyle: 'steps' }).blindStyle, 'steps');
});

test('estilo a ciegas de la correspondencia: tres valores y «codes» por defecto', () => {
  assert.equal(normalizeMatchingBlindStyle('select'), 'select');
  assert.equal(normalizeMatchingBlindStyle(' STEPS '), 'steps');
  assert.equal(normalizeMatchingBlindStyle('codes'), 'codes');
  assert.equal(normalizeMatchingBlindStyle('grid'), 'codes');
  assert.equal(normalizeMatchingBlindStyle(undefined), 'codes');
});

test('el lobby sabe si el quiz tiene alguna correspondencia', () => {
  assert.equal(hasMatchingQuestion([{ type: 'quiz', answers: ['a', 'b'], correct: 1 }, { type: 'matching', pairs: capitals }]), true);
  assert.equal(hasMatchingQuestion([{ type: 'quiz', answers: ['a', 'b'], correct: 1 }]), false);
  assert.equal(hasMatchingQuestion(undefined), false);
});

test('«Mostrar respuestas» desactivado: no llega la solución de la correspondencia', () => {
  const meta = getQuestionMeta({ type: 'matching', pairs: capitals });
  const out = studentMetaOf({ gameData: { options: { showCorrectAnswers: false } } }, meta);
  assert.equal(out.matchSolution, undefined);
  assert.deepEqual(out.matchLeft, ['Francia', 'Italia', 'Alemania']);
});

test('el multijugador local admite la correspondencia', () => {
  assert.equal(isMultiplayerFreeTypeQuestion({ type: 'matching', pairs: capitals }), false);
  assert.equal(isMultiplayerFreeTypeQuestion({ type: 'quiz', answers: ['a', 'b'], correct: 1 }), false);
});

test('CSV: la correspondencia sale en «texto» y vuelve igual al importar', () => {
  const { quizToCsv } = require('../../server/services/sessionReport')({ players: { getPlayers: () => [] } });
  const { parseCsv, toQuestion } = require('../../server/importCsv');
  const pairs = capitals;
  const csv = quizToCsv({ questions: [{ question: 'Capitales', type: 'matching', time: 30, pairs }] });
  const line = csv.split('\n')[1].split(';');
  assert.equal(line[0], 'matching');
  assert.equal(line[7], '');
  assert.equal(line[10], 'Francia -> París | Italia -> Roma | Alemania -> Berlín | -> Lisboa');

  const back = parseCsv(csv).map(toQuestion)[0];
  assert.equal(back.type, 'matching');
  assert.equal(back.time, 30);
  assert.deepEqual(back.pairs, pairs);
});

test('CSV: con «correspondencia» o sin tipo, el texto con -> se lee como correspondencia', () => {
  const { toQuestion } = require('../../server/importCsv');
  for (const tipo of ['correspondencia', '']) {
    const q = toQuestion({ tipo, pregunta: 'P', texto: 'a -> 1 | b -> 2 | -> 3', tiempo: '20' });
    assert.equal(q.type, 'matching', tipo);
    assert.deepEqual(q.pairs, [{ left: 'a', right: '1' }, { left: 'b', right: '2' }, { left: '', right: '3' }]);
  }
});

test('informe de la sesión: respuesta del alumno y correcta con números, letras y textos', () => {
  const { buildQuestions } = makeHelpers();
  const { liveSessionToCsv } = require('../../server/services/sessionReport')({ players: { getPlayers: () => [] } });
  const questions = buildQuestions([{ question: 'Capitales', type: 'matching', pairs: capitals }], {});
  const q = questions[0];
  const player = {
    name: 'Ana',
    gameData: {
      score: 300, correctCount: 0, wrongCount: 0,
      answerHistory: [{ questionNumber: 1, submission: [q.matchSolution[0], null, null], isCorrect: false, scoreRatio: 1 / 3 }]
    }
  };
  const csv = liveSessionToCsv({ pin: '123456', hostId: 'h', gameData: { questions, totalQuestions: 1, quizName: 'Q' } }, [player]);
  const row = csv.split('\n').find((line) => line.includes('Ana') && line.includes('matching')).split(';');
  const right = (i) => `${'ABCDEFGH'[q.matchSolution[i]]} ${q.matchRight[q.matchSolution[i]]}`;
  assert.equal(row[14], `1 Francia → ${right(0)} | 2 Italia → (sin pareja) | 3 Alemania → (sin pareja)`);
  assert.equal(row[15], `1 Francia → ${right(0)} | 2 Italia → ${right(1)} | 3 Alemania → ${right(2)}`);
  assert.equal(row[16], 'parcial');
});
