const { test } = require('node:test');
const assert = require('node:assert/strict');

const { DEFAULTS_MS, normalizeTimings, getTimings } = require('../../server/services/gameTimings');

test('sin ampliación se usan los mínimos actuales', () => {
  assert.deepEqual(getTimings({}), {
    hostReconnectMs: 30000,
    playerReconnectMs: 40000,
    cleanupMs: 100000,
    inactivityMs: 30 * 60 * 1000
  });
  assert.deepEqual(getTimings(undefined), getTimings({}));
  assert.equal(DEFAULTS_MS.cleanupMs, 100000);
});

test('los valores ampliados se convierten a milisegundos (segundos o minutos)', () => {
  const game = { timingOverrides: normalizeTimings({ hostReconnectSec: 90, cleanupSec: 300, inactivityMin: 45 }) };
  const t = getTimings(game);
  assert.equal(t.hostReconnectMs, 90000);
  assert.equal(t.cleanupMs, 300000);
  assert.equal(t.inactivityMs, 45 * 60 * 1000);
  assert.equal(t.playerReconnectMs, 40000);
});

test('vacío, por debajo del mínimo, por encima del tope o no entero se descarta', () => {
  assert.deepEqual(normalizeTimings({ hostReconnectSec: '', playerReconnectSec: null }), {});
  assert.deepEqual(normalizeTimings({ hostReconnectSec: 29 }), {});
  assert.deepEqual(normalizeTimings({ hostReconnectSec: 121 }), {});
  assert.deepEqual(normalizeTimings({ inactivityMin: 61 }), {});
  assert.deepEqual(normalizeTimings({ inactivityMin: 30.5 }), {});
  assert.deepEqual(normalizeTimings({ cleanupSec: 'abc' }), {});
  assert.deepEqual(normalizeTimings(null), {});
});

test('los límites inclusivos se aceptan', () => {
  assert.deepEqual(normalizeTimings({ hostReconnectSec: 30, playerReconnectSec: 120, cleanupSec: 600, inactivityMin: 60 }), {
    hostReconnectSec: 30, playerReconnectSec: 120, cleanupSec: 600, inactivityMin: 60
  });
});
