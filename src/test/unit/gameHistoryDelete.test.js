// Esborrar una partida: només la pròpia; un id no vàlid o d'un altre usuari no fa res.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const createGameHistoryService = require('../../server/services/gameHistory');

test('deleteForOwner filtra per propietari i retorna si s\'ha esborrat', async () => {
  const calls = [];
  const collection = { deleteOne: async (filter) => { calls.push(filter); return { deletedCount: 1 }; } };
  const svc = createGameHistoryService({ getGameHistoryCollection: async () => collection });
  const id = new ObjectId().toHexString();
  assert.equal(await svc.deleteForOwner('u1', id), true);
  assert.equal(String(calls[0].ownerId), 'u1');
  assert.equal(String(calls[0]._id), id);
});

test('un id no vàlid no toca la base de dades', async () => {
  let touched = false;
  const svc = createGameHistoryService({ getGameHistoryCollection: async () => { touched = true; return {}; } });
  assert.equal(await svc.deleteForOwner('u1', 'nope'), false);
  assert.equal(touched, false);
});
