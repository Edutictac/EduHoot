// Mode fantasma (ítem 26): la millor marca del quiz, guardada només al navegador i compartida entre solo i aula.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ghost = require('../../public/js/solo-ghost.js');

function fakeStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    _data: data
  };
}

const QUIZ = [
  { type: 'quiz', question: 'Capital de França?', answers: ['Roma', 'París', '', ''], correctAnswers: [1], time: 20 },
  { type: 'numeric', question: 'Quant és 2+2?', numericAnswer: 4, tolerance: 0, time: 15 }
];

test('la huella canvia només si canvia el contingut del quiz', () => {
  const same = JSON.parse(JSON.stringify(QUIZ));
  assert.equal(ghost.fingerprint(QUIZ), ghost.fingerprint(same));
  const edited = JSON.parse(JSON.stringify(QUIZ));
  edited[0].question = 'Capital de França (editada)?';
  assert.notEqual(ghost.fingerprint(QUIZ), ghost.fingerprint(edited));
  const slower = JSON.parse(JSON.stringify(QUIZ));
  slower[1].time = 30;
  assert.notEqual(ghost.fingerprint(QUIZ), ghost.fingerprint(slower));
  assert.notEqual(ghost.fingerprint(QUIZ), ghost.fingerprint(QUIZ.slice(0, 1)));
});

test('la diferència es compara per pregunta jugada, encara que l\'ordre siga aleatori', () => {
  // La marca va fer 100 a la pregunta 0 (original) i 200 a la 1.
  const g = { total: 300, points: { 0: 100, 1: 200 } };
  assert.equal(ghost.ghostTotalFor(g, [1]), 200);
  assert.equal(ghost.ghostTotalFor(g, [1, 0]), 300);
  assert.equal(ghost.diffFor(g, [1], 250), 50);
  assert.equal(ghost.diffFor(g, [1, 0], 250), -50);
  assert.equal(ghost.diffFor(null, [1], 250), null);
});

test('signe de la diferència: «+» i «−» amb el signe menys tipogràfic', () => {
  assert.equal(ghost.signed(30), '+30');
  assert.equal(ghost.signed(0), '+0');
  assert.equal(ghost.signed(-20), '−20');
});

test('només es guarda la millor partida del mateix quiz', () => {
  const store = fakeStorage();
  const fp = ghost.fingerprint(QUIZ);
  assert.equal(ghost.saveGhost(store, fp, 500, { 0: 500 }), true);
  assert.equal(ghost.saveGhost(store, fp, 300, { 0: 300 }), false);
  assert.equal(ghost.saveGhost(store, fp, 800, { 0: 800 }), true);
  assert.equal(ghost.loadGhost(store, fp).total, 800);
});

test('la marca és la mateixa per a qualsevol que tinga el mateix quiz (solo i aula)', () => {
  const store = fakeStorage();
  const fp = ghost.fingerprint(QUIZ);
  // Solo guarda la marca; l'aula, amb la mateixa empremta, la troba.
  ghost.saveGhost(store, fp, 900, { 0: 900 });
  assert.equal(ghost.loadGhost(store, fp).total, 900);
});

test('si el quiz ha canviat, la marca antiga no es carrega i es substitueix', () => {
  const store = fakeStorage();
  const fp = ghost.fingerprint(QUIZ);
  ghost.saveGhost(store, fp, 900, { 0: 900 });
  const otherFp = ghost.fingerprint([{ ...QUIZ[0], question: 'Altra' }, QUIZ[1]]);
  assert.equal(ghost.loadGhost(store, otherFp), null);
  // Una partida amb el quiz nou es guarda encara que siga inferior: és la nova base de comparació.
  assert.equal(ghost.saveGhost(store, otherFp, 100, { 0: 100 }), true);
  assert.equal(ghost.loadGhost(store, otherFp).total, 100);
});

test('dades corruptes o absents: no hi ha marca, sense errors', () => {
  const store = fakeStorage();
  store.setItem('eduh_ghost_x', '{no és json');
  assert.equal(ghost.loadGhost(store, 'x'), null);
  assert.equal(ghost.loadGhost(store, 'absent'), null);
  assert.equal(ghost.loadGhost(null, 'absent'), null);
  assert.equal(ghost.saveGhost(null, 'absent', 10, {}), false);
});
