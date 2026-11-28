// Flashcards: judici d'una targeta d'ordenar (mateixa puntuació que la partida).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const EduhootFlashcards = require('../../public/js/solo-flashcards.js');

// EduhootOrder és global al navegador; aquí es carrega el mateix fitxer amb un window fals.
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js/orderBoard.js'), 'utf8'), { window: win, Math });
globalThis.EduhootOrder = win.EduhootOrder;

const meta = { type: 'order', items: ['A', 'B', 'C'], orderShown: [1, 2, 0], orderGrading: 0 };

test('ordenar: correcta només amb l\'ordre complet (posicions de la llista barrejada)', () => {
  // Mostrats: B, C, A. Ordre correcte A, B, C = posicions [2, 0, 1].
  assert.equal(EduhootFlashcards.judgeCard(meta, {}, undefined, {}, [2, 0, 1]), true);
  assert.equal(EduhootFlashcards.judgeCard(meta, {}, undefined, {}, [0, 1, 2]), false);
  assert.equal(EduhootFlashcards.judgeCard(meta, {}, undefined, {}, [2, 1, 0]), false);
});

test('ordenar: sense ordre o incompleta, és errònia; el tipus és validable', () => {
  assert.equal(EduhootFlashcards.judgeCard(meta, {}, undefined, {}, undefined), false);
  assert.equal(EduhootFlashcards.judgeCard(meta, {}, undefined, {}, [2, 0]), false);
  assert.equal(EduhootFlashcards.isValidatableType('order'), true);
});
