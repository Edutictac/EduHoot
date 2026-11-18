const { test } = require('node:test');
const assert = require('node:assert/strict');

const { streakBonus, nextStreak, isStreakEnabled, STREAK_MIN_FOR_BONUS } = require('../../server/services/scoring');

test('sin bonificación antes de la tercera respuesta seguida', () => {
  assert.equal(STREAK_MIN_FOR_BONUS, 3);
  assert.equal(streakBonus(0), 0);
  assert.equal(streakBonus(1), 0);
  assert.equal(streakBonus(2), 0);
});

test('a partir de la tercera, +50 por respuesta, con tope de +250', () => {
  assert.equal(streakBonus(3), 50);
  assert.equal(streakBonus(4), 100);
  assert.equal(streakBonus(5), 150);
  assert.equal(streakBonus(6), 200);
  assert.equal(streakBonus(7), 250);
  assert.equal(streakBonus(12), 250);
});

test('un acierto completo suma a la racha; cualquier otro resultado la reinicia', () => {
  assert.equal(nextStreak(0, true), 1);
  assert.equal(nextStreak(4, true), 5);
  assert.equal(nextStreak(4, false), 0);
  assert.equal(nextStreak(undefined, false), 0);
});

test('la racha está activada salvo que la partida la desactive', () => {
  assert.equal(isStreakEnabled({ gameData: {} }), true);
  assert.equal(isStreakEnabled({ gameData: { options: {} } }), true);
  assert.equal(isStreakEnabled({ gameData: { options: { streak: true } } }), true);
  assert.equal(isStreakEnabled({ gameData: { options: { streak: false } } }), false);
  assert.equal(isStreakEnabled(undefined), true);
});
