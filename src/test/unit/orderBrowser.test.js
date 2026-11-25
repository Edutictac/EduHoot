// Paritat: la puntuació i la barreja del navegador (public/js/orderBoard.js, EduhootOrder)
// són les mateixes que les del servidor (orderQuestion.js i questionUtils.js).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const orderQuestion = require('../../server/services/orderQuestion');
const { orderScoreRatioFromMeta } = require('../../server/questionUtils');

function loadBrowserOrder() {
  const win = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js/orderBoard.js'), 'utf8'), { window: win, Math });
  return win.EduhootOrder;
}
const browser = loadBrowserOrder();

function permutations(n) {
  if (n === 0) return [[]];
  const out = [];
  for (const p of permutations(n - 1)) {
    for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  }
  return out;
}

const MODES = Object.values(orderQuestion.ORDER_GRADING);

test('els nou modes de puntuació coincideixen amb el servidor en totes les permutacions de 2 a 5', () => {
  for (let n = 2; n <= 5; n++) {
    for (const answer of permutations(n)) {
      for (const mode of MODES) {
        assert.equal(browser.orderScoreRatio(answer, n, mode), orderQuestion.orderScoreRatio(answer, n, mode),
          `n=${n} mode=${mode} answer=${answer}`);
      }
    }
  }
});

test('respostes no vàlides puntuen 0 (com al servidor)', () => {
  for (const bad of [[0, 0, 1], [0, 1], [0, 1, 3], [0, 1.5, 2], 'abc', null]) {
    for (const mode of MODES) {
      assert.equal(browser.orderScoreRatio(bad, 3, mode), 0);
      assert.equal(orderQuestion.orderScoreRatio(bad, 3, mode), 0);
    }
  }
});

test('traducció de posicions barajades: igual que orderScoreRatioFromMeta del servidor', () => {
  const items = ['A', 'B', 'C', 'D'];
  const shownList = [[2, 0, 3, 1], [1, 2, 3, 0], [3, 2, 1, 0]];
  for (const orderShown of shownList) {
    for (const grading of MODES) {
      for (const answer of permutations(4)) {
        const meta = { items, orderShown, orderGrading: grading };
        assert.equal(browser.scoreRatio(meta, answer), orderScoreRatioFromMeta(meta, answer),
          `shown=${orderShown} grading=${grading} answer=${answer}`);
      }
    }
  }
});

test('la barreja mai és la disposició d\'origen i és una permutació', () => {
  for (let n = 2; n <= 8; n++) {
    for (let k = 0; k < 50; k++) {
      const order = browser.shuffledOrder(n);
      assert.ok(orderQuestion.isPermutation(order, n));
      assert.notDeepEqual(order, Array.from({ length: n }, (_, i) => i));
    }
  }
});

test('layoutOf conserva la barreja guardada i, sense ella, deixa l\'ordre original', () => {
  const items = ['x', 'y', 'z'];
  assert.deepEqual(browser.layoutOf({ items, orderShown: [2, 0, 1] }).orderItems, ['z', 'x', 'y']);
  assert.deepEqual(browser.layoutOf({ items, orderShown: [0, 0, 1] }).orderItems, ['x', 'y', 'z']);
  assert.deepEqual(browser.layoutOf({ items }).orderItems, ['x', 'y', 'z']);
});
