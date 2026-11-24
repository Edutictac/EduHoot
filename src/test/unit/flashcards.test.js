const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// solo-flashcards.js és un script de navegador; en Node exporta les funcions pures.
const fc = require(path.join(__dirname, '..', '..', 'public', 'js', 'solo-flashcards.js'));

function memoryStorage(initial){
    const data = Object.assign({}, initial || {});
    return {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
        setItem: (k, v) => { data[k] = String(v); },
        _data: data
    };
}

test('buildCards exclou les enquestes i conserva l\'índex original', () => {
    const questions = [
        { type: 'quiz', question: 'A' },
        { type: 'poll', question: 'Enquesta' },
        { type: 'numeric', question: 'B' },
        null,
        { type: 'short-answer', question: 'C' }
    ];
    const cards = fc.buildCards(questions);
    assert.deepEqual(cards.map((c) => c.idx), [0, 2, 4]);
    assert.deepEqual(cards.map((c) => c.q.question), ['A', 'B', 'C']);
});

test('buildCards tolera entrades no vàlides', () => {
    assert.deepEqual(fc.buildCards(undefined), []);
    assert.deepEqual(fc.buildCards(null), []);
});

test('deckFor amb mode "all" torna totes les targetes, sense alterar l\'original', () => {
    const cards = fc.buildCards([{ question: 'A' }, { question: 'B' }]);
    const deck = fc.deckFor(cards, {}, 'all');
    assert.equal(deck.length, 2);
    assert.notEqual(deck, cards);
});

test('deckFor amb mode "unknown" només torna les no sabudes', () => {
    const cards = fc.buildCards([{ question: 'A' }, { question: 'B' }, { question: 'C' }]);
    const status = { 0: 'known', 2: 'unknown' };
    const deck = fc.deckFor(cards, status, 'unknown');
    assert.deepEqual(deck.map((c) => c.idx), [2]);
});

test('setStatus desa i esborra l\'estat per pregunta, sense perdre les altres', () => {
    const all = {};
    fc.setStatus(all, 'quiz1', 3, 0, 'known');
    let status = fc.setStatus(all, 'quiz1', 3, 2, 'unknown');
    assert.deepEqual(status, { 0: 'known', 2: 'unknown' });
    status = fc.setStatus(all, 'quiz1', 3, 0, null);
    assert.deepEqual(status, { 2: 'unknown' });
    assert.deepEqual(all.quiz1, { total: 3, status: { 2: 'unknown' } });
});

test('quizStatus descarta el progrés si el nombre de preguntes ha canviat', () => {
    const all = { quiz1: { total: 3, status: { 0: 'known' } } };
    assert.deepEqual(fc.quizStatus(all, 'quiz1', 3), { 0: 'known' });
    assert.deepEqual(fc.quizStatus(all, 'quiz1', 4), {});
    assert.deepEqual(fc.quizStatus(all, 'quiz2', 3), {});
});

test('loadAllProgress tolera JSON trencat i valors no esperats', () => {
    assert.deepEqual(fc.loadAllProgress(memoryStorage({ [fc.STORAGE_KEY]: '{no és json' })), {});
    assert.deepEqual(fc.loadAllProgress(memoryStorage({ [fc.STORAGE_KEY]: '[1,2]' })), {});
    assert.deepEqual(fc.loadAllProgress(memoryStorage()), {});
});

test('loadAllProgress no falla si el magatzem llança error', () => {
    const broken = {
        getItem: () => { throw new Error('blocked'); },
        setItem: () => { throw new Error('blocked'); }
    };
    assert.deepEqual(fc.loadAllProgress(broken), {});
    assert.doesNotThrow(() => fc.saveAllProgress(broken, { a: 1 }));
});

test('save i load fan el viatge complet', () => {
    const storage = memoryStorage();
    const all = {};
    fc.setStatus(all, 'q', 2, 1, 'known');
    fc.saveAllProgress(storage, all);
    assert.deepEqual(fc.loadAllProgress(storage), all);
});

test('countStatus compta sabudes, no sabudes i pendents', () => {
    const cards = fc.buildCards([{ question: 'A' }, { question: 'B' }, { question: 'C' }, { question: 'D' }]);
    const counts = fc.countStatus(cards, { 0: 'known', 1: 'unknown', 2: 'known' });
    assert.deepEqual(counts, { known: 2, unknown: 1, pending: 1 });
});

test('shuffleCopy no modifica l\'original i conserva els elements', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = fc.shuffleCopy(original, () => 0);
    assert.deepEqual(original, [1, 2, 3, 4, 5]);
    assert.deepEqual([...shuffled].sort(), [1, 2, 3, 4, 5]);
    assert.notEqual(shuffled, original);
});

test('validació: quiz d\'una correcta, resposta múltiple, vertader/fals', () => {
  const quiz = { type: 'quiz', correctAnswers: [2] };
  assert.equal(fc.judgeCard(quiz, { 2: true }, null), true);
  assert.equal(fc.judgeCard(quiz, { 1: true }, null), false);
  assert.equal(fc.judgeCard(quiz, { 1: true, 2: true }, null), false);
  assert.equal(fc.judgeCard(quiz, {}, null), false);
  assert.equal(fc.judgeCard(quiz, { 2: false, 1: true }, null), false);

  const multi = { type: 'multiple', correctAnswers: [1, 3] };
  assert.equal(fc.judgeCard(multi, { 3: true, 1: true }, null), true);
  assert.equal(fc.judgeCard(multi, { 1: true }, null), false);
  assert.equal(fc.judgeCard(multi, { 1: true, 3: true, 4: true }, null), false);

  const tf = { type: 'true-false', correctAnswers: [2] };
  assert.equal(fc.judgeCard(tf, { 2: true }, null), true);
  assert.equal(fc.judgeCard(tf, { 1: true }, null), false);
});

test('validació: resposta curta sense accents ni majúscules; numèrica dins de la tolerància', () => {
  const short = { type: 'short-answer', acceptedAnswers: ['París', 'Paris'] };
  assert.equal(fc.judgeCard(short, {}, '  paris '), true);
  assert.equal(fc.judgeCard(short, {}, 'Madrid'), false);
  assert.equal(fc.judgeCard(short, {}, ''), false);

  const num = { type: 'numeric', numericAnswer: 3.14, tolerance: 0.01 };
  assert.equal(fc.judgeCard(num, {}, '3,14'), true);
  assert.equal(fc.judgeCard(num, {}, '3.135'), true);
  assert.equal(fc.judgeCard(num, {}, '3.2'), false);
  assert.equal(fc.judgeCard(num, {}, 'tres'), false);
});

test('validació: correspondència (totes les parelles han de ser correctes); enquesta no es valida', () => {
  const m = { type: 'matching', matchSolution: [1, 0, 2] };
  assert.equal(fc.judgeCard(m, {}, null, { 0: 1, 1: 0, 2: 2 }), true);
  assert.equal(fc.judgeCard(m, {}, null, { 0: 1, 1: 2, 2: 0 }), false);
  assert.equal(fc.judgeCard(m, {}, null, { 0: 1, 1: 0 }), false);
  assert.equal(fc.judgeCard(m, {}, null, {}), false);
  assert.equal(fc.judgeCard({ type: 'poll' }, {}, null), null);
  assert.equal(fc.isValidatableType('matching'), true);
  assert.equal(fc.isValidatableType('poll'), false);
});
