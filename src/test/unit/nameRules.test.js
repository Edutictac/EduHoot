const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isValidTypedName } = require('../../server/services/nameRules');

test('nombre escrito: letras y números, de 3 a 20, sin empezar por número', () => {
  assert.equal(isValidTypedName('Ana'), true);
  assert.equal(isValidTypedName('Ana2'), true);
  assert.equal(isValidTypedName('ñandú'), true);
  assert.equal(isValidTypedName('a'.repeat(20)), true);
  assert.equal(isValidTypedName('1ana'), false, 'no empieza por número');
  assert.equal(isValidTypedName('An'), false, 'mínimo 3');
  assert.equal(isValidTypedName('a'.repeat(21)), false, 'máximo 20');
  assert.equal(isValidTypedName('Ana Maria'), false, 'sin espacios');
  assert.equal(isValidTypedName('Ana!'), false, 'sin símbolos');
  assert.equal(isValidTypedName('Ana.'), false, 'sin puntuación');
  assert.equal(isValidTypedName(''), false, 'no vacío');
  assert.equal(isValidTypedName(undefined), false);
});
