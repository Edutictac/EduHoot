const { test } = require('node:test');
const assert = require('node:assert/strict');

const { RANDOM_NAMES, isRandomName, loadRandomNames } = require('../../server/services/randomNames');

test('la lista fija tiene 250 palabras, sin repetidos y de hasta 20 caracteres', () => {
  assert.equal(RANDOM_NAMES.length, 250);
  assert.equal(new Set(RANDOM_NAMES).size, RANDOM_NAMES.length);
  assert.ok(RANDOM_NAMES.every((name) => name.length <= 20));
});

test('la lista es de palabras sueltas, solo letras (con acentos y punt volat)', () => {
  assert.ok(RANDOM_NAMES.every((name) => /^[A-Za-zÀ-ÿ]+(?:·[A-Za-zÀ-ÿ]+)?$/.test(name)), 'solo palabras sueltas');
});

test('la lista está ordenada alfabéticamente sin distinguir acentos', () => {
  const key = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sorted = [...RANDOM_NAMES].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  assert.deepEqual(RANDOM_NAMES, sorted);
});

test('isRandomName acepta solo nombres de la lista', () => {
  assert.equal(isRandomName(RANDOM_NAMES[0]), true);
  assert.equal(isRandomName('  ' + RANDOM_NAMES[0] + ' '), true);
  assert.equal(isRandomName('Ana'), false);
  assert.equal(isRandomName(''), false);
  assert.equal(isRandomName(undefined), false);
});

test('loadRandomNames ignora líneas vacías y espacios sobrantes', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'names-')), 'names.txt');
  fs.writeFileSync(file, 'Curiós\r\n\n  Metòdic  \n');
  assert.deepEqual(loadRandomNames(file), ['Curiós', 'Metòdic']);
});
