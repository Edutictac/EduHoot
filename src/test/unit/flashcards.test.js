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
