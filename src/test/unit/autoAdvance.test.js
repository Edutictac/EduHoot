const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeAutoAdvance, AutoAdvanceTimer, MIN_SECONDS, MAX_SECONDS } = require('../../server/services/autoAdvance');

test('avance automático: solo manual (0) o un entero de 3 a 20 s', () => {
  assert.equal(MIN_SECONDS, 3);
  assert.equal(MAX_SECONDS, 20);
  assert.equal(normalizeAutoAdvance(0), 0);
  assert.equal(normalizeAutoAdvance('12'), 12);
  assert.equal(normalizeAutoAdvance(3), 3);
  assert.equal(normalizeAutoAdvance(2), 0);
  assert.equal(normalizeAutoAdvance(20), 20);
  assert.equal(normalizeAutoAdvance(21), 0);
  assert.equal(normalizeAutoAdvance('abc'), 0);
  assert.equal(normalizeAutoAdvance(undefined), 0);
});

test('temporizador: dispara una vez al cumplirse el tiempo', async () => {
  let fired = 0;
  const t = new AutoAdvanceTimer(40, () => { fired += 1; });
  t.start();
  await new Promise((r) => setTimeout(r, 90));
  assert.equal(fired, 1);
});

test('temporizador: la pausa congela el tiempo restante y la reanudación lo continúa', async () => {
  let fired = 0;
  const t = new AutoAdvanceTimer(120, () => { fired += 1; });
  t.start();
  await new Promise((r) => setTimeout(r, 30));
  t.pause();
  const frozen = t.remainingMs;
  assert.ok(frozen > 0 && frozen <= 120);
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(fired, 0, 'no dispara mientras está pausado');
  assert.equal(t.remainingMs, frozen);
  t.resume();
  await new Promise((r) => setTimeout(r, frozen + 60));
  assert.equal(fired, 1);
});

test('temporizador: cancelar impide que dispare', async () => {
  let fired = 0;
  const t = new AutoAdvanceTimer(30, () => { fired += 1; });
  t.start();
  t.cancel();
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(fired, 0);
});

test('temporizador: rearmar da otro paso completo', async () => {
  let fired = 0;
  const t = new AutoAdvanceTimer(30, () => { fired += 1; });
  t.start();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(fired, 1);
  t.rearm();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(fired, 2);
});
