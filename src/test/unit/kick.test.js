const { test } = require('node:test');
const assert = require('node:assert/strict');

const { recordKick, isKicked, listKicked, unkick } = require('../../server/sockets/kick');

test('un alumno expulsado no puede volver con el mismo token', () => {
  const game = {};
  recordKick(game, { name: 'Ana', token: 'tok-1' });
  assert.equal(isKicked(game, { token: 'tok-1' }), true);
  assert.equal(isKicked(game, { token: 'tok-otro' }), false);
});

test('el nombre bloqueado no distingue mayúsculas ni espacios', () => {
  const game = {};
  recordKick(game, { name: 'Nombre Feo', token: 'tok-1' });
  assert.equal(isKicked(game, { name: '  nombre feo ' }), true);
  assert.equal(isKicked(game, { name: 'Ana' }), false);
});

test('sin expulsiones previas nadie está bloqueado', () => {
  assert.equal(isKicked({}, { token: 'x', name: 'Ana' }), false);
  assert.equal(isKicked(undefined, { token: 'x' }), false);
});

test('un jugador sin token solo bloquea su nombre', () => {
  const game = {};
  recordKick(game, { name: 'Pau' });
  assert.equal(isKicked(game, { token: undefined, name: 'Pau' }), true);
});

test('la lista para el anfitrión no incluye tokens', () => {
  const game = {};
  recordKick(game, { name: 'Ana', token: 'secreto' });
  const list = listKicked(game);
  assert.equal(list.length, 1);
  assert.deepEqual(Object.keys(list[0]).sort(), ['id', 'name']);
  assert.equal(JSON.stringify(list).includes('secreto'), false);
});

test('desbloquear quita la expulsión y permite volver a entrar', () => {
  const game = {};
  const entry = recordKick(game, { name: 'Ana', token: 'tok-1' });
  assert.equal(unkick(game, entry.id), true);
  assert.equal(isKicked(game, { token: 'tok-1', name: 'Ana' }), false);
  assert.deepEqual(listKicked(game), []);
});

test('desbloquear solo quita la expulsión indicada', () => {
  const game = {};
  const ana = recordKick(game, { name: 'Ana', token: 'tok-1' });
  recordKick(game, { name: 'Pau', token: 'tok-2' });
  unkick(game, ana.id);
  assert.equal(isKicked(game, { name: 'Ana' }), false);
  assert.equal(isKicked(game, { name: 'Pau' }), true);
});

test('desbloquear un identificador inexistente no hace nada', () => {
  const game = {};
  recordKick(game, { name: 'Ana', token: 'tok-1' });
  assert.equal(unkick(game, 999999), false);
  assert.equal(isKicked(game, { name: 'Ana' }), true);
});
