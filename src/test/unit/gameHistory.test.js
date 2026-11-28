const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const createGameHistoryService = require('../../server/services/gameHistory');

// Col·lecció simulada: només el necessari (insertOne, find amb projecció, sort, limit, findOne).
function fakeCollection() {
  const docs = [];
  const matches = (d, filter) => Object.keys(filter).every((k) => String(d[k]) === String(filter[k]));
  return {
    docs,
    async insertOne(doc) { const full = { _id: new ObjectId(), ...doc }; docs.push(full); return { insertedId: full._id }; },
    find(filter, opts) {
      const list = docs.filter((d) => matches(d, filter));
      const chain = {
        sort: () => chain,
        limit: () => chain,
        toArray: async () => list.map((d) => {
          const copy = { ...d };
          if (opts && opts.projection && opts.projection.csv === 0) delete copy.csv;
          return copy;
        })
      };
      return chain;
    },
    async findOne(filter) { return docs.find((d) => matches(d, filter)) || null; }
  };
}

const game = (ownerUserId, extra = {}) => ({
  pin: 12345,
  gameData: { gameid: 7, quizName: 'Geografia', ownerUserId, options: { mode: extra.mode || 'live' } }
});

test('retenció de 90 dies', () => {
  const svc = createGameHistoryService({ getGameHistoryCollection: async () => fakeCollection() });
  assert.equal(svc.RETENTION_DAYS, 90);
});

test('una partida d\'un usuari anònim no es guarda', async () => {
  const col = fakeCollection();
  const svc = createGameHistoryService({ getGameHistoryCollection: async () => col });
  const saved = await svc.recordFinishedGame({ game: game(''), csv: 'a,b', playersCount: 2 });
  assert.equal(saved, false);
  assert.equal(col.docs.length, 0);
});

test('una partida d\'un usuari amb compte es guarda amb el seu informe i només la veu ell', async () => {
  const col = fakeCollection();
  const svc = createGameHistoryService({ getGameHistoryCollection: async () => col });
  assert.equal(await svc.recordFinishedGame({ game: game('u1', { mode: 'selfPaced' }), csv: 'nom;puntuacio\nAna;10', playersCount: 1 }), true);

  const mine = await svc.listForOwner('u1');
  assert.equal(mine.length, 1);
  assert.equal(mine[0].quizName, 'Geografia');
  assert.equal(mine[0].mode, 'selfPaced');
  assert.equal(mine[0].playersCount, 1);
  assert.equal(mine[0].csv, undefined, 'la llista no porta el CSV');
  const days = (new Date(mine[0].expiresAt) - new Date(mine[0].finishedAt)) / (24 * 60 * 60 * 1000);
  assert.equal(days, 90);

  assert.deepEqual(await svc.listForOwner('u2'), []);
  assert.equal(await svc.csvForOwner('u2', mine[0].id), null, 'un altre usuari no pot descarregar-la');
  const file = await svc.csvForOwner('u1', mine[0].id);
  assert.equal(file.csv, 'nom;puntuacio\nAna;10');
  assert.match(file.fileName, /^partida-12345-\d{4}-\d{2}-\d{2}\.csv$/);
});

test('un id no vàlid no retorna cap informe', async () => {
  const svc = createGameHistoryService({ getGameHistoryCollection: async () => fakeCollection() });
  assert.equal(await svc.csvForOwner('u1', 'no-es-un-id'), null);
});
