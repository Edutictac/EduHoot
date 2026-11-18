const { test } = require('node:test');
const assert = require('node:assert/strict');

const { RANDOM_NAMES, isRandomName, loadRandomNames } = require('../../server/services/randomNames');

test('la lista tiene al menos 250 nombres, sin repetidos y de hasta 20 caracteres', () => {
  assert.ok(RANDOM_NAMES.length >= 250, `total ${RANDOM_NAMES.length}`);
  assert.equal(new Set(RANDOM_NAMES).size, RANDOM_NAMES.length);
  // Una sola palabra, en inglés (sin espacios ni signos).
  assert.ok(RANDOM_NAMES.every((name) => /^[A-Za-z]+$/.test(name)), 'solo palabras sueltas');
  assert.ok(RANDOM_NAMES.every((name) => name.length <= 20));
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
  fs.writeFileSync(file, 'Curious Owl\r\n\n  Wise Owl  \n');
  assert.deepEqual(loadRandomNames(file), ['Curious Owl', 'Wise Owl']);
});
