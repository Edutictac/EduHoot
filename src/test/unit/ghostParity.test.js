// Paritat: l'empremta del quiz és la mateixa al servidor (aula) i al navegador (solo i aula).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { liveGhostFingerprint } = require('../../server/services/ghostMark');

function loadBrowserGhost() {
  const win = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../public/js/solo-ghost.js'), 'utf8'), { window: win, Math });
  return win.EduhootGhost;
}
const browser = loadBrowserGhost();

const QUESTIONS = [
  { type: 'quiz', question: 'Capital de França?', answers: ['Roma', 'París', 'Berlín', 'Londres'], correctAnswers: [2], time: 20, pointsMultiplier: 1 },
  { type: 'numeric', question: 'Quant és 2+2?', numericAnswer: 4, tolerance: 0, time: 15 },
  { type: 'order', question: 'Ordena', items: ['A', 'B', 'C'], orderGrading: -1, layout: 'horizontal', time: 30, image: '', video: '' }
];

test('el servidor i el navegador calculen la mateixa empremta per al mateix quiz', () => {
  assert.equal(liveGhostFingerprint(QUESTIONS), browser.fingerprint(QUESTIONS));
});

test('els canvis en el contingut també es veuen igual als dos costats', () => {
  const edited = JSON.parse(JSON.stringify(QUESTIONS));
  edited[1].tolerance = 0.5;
  assert.equal(liveGhostFingerprint(edited), browser.fingerprint(edited));
  assert.notEqual(liveGhostFingerprint(edited), liveGhostFingerprint(QUESTIONS));
});
