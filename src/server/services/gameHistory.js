// Registre de partides per usuari. Es guarda l'informe de cada partida acabada només quan la crea un usuari
// amb compte (les partides anònimes no es guarden). Retenció: 90 dies (índex TTL a data/db.js).
const { ObjectId } = require('mongodb');

const RETENTION_DAYS = 90;
const LIST_LIMIT = 200;

module.exports = function createGameHistoryService({ getGameHistoryCollection }) {
  // info: { game, csv, playersCount }. Retorna true si s'ha guardat.
  async function recordFinishedGame({ game, csv, playersCount }) {
    const ownerId = game && game.gameData && game.gameData.ownerUserId;
    if (!ownerId) return false;
    const collection = await getGameHistoryCollection();
    await collection.insertOne({
      ownerId: String(ownerId),
      pin: String(game.pin),
      quizId: game.gameData.gameid,
      quizName: String(game.gameData.quizName || ''),
      mode: game.gameData.options && game.gameData.options.mode === 'selfPaced' ? 'selfPaced' : 'live',
      playersCount: Number(playersCount) || 0,
      finishedAt: new Date(),
      csv: String(csv || '')
    });
    return true;
  }

  function publicInfo(doc) {
    const finishedAt = new Date(doc.finishedAt);
    return {
      id: String(doc._id),
      pin: doc.pin,
      quizId: doc.quizId,
      quizName: doc.quizName,
      mode: doc.mode,
      playersCount: doc.playersCount,
      finishedAt: finishedAt.toISOString(),
      expiresAt: new Date(finishedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  // Només les partides del propi usuari, sense el CSV (es descarrega a part).
  async function listForOwner(ownerId) {
    const collection = await getGameHistoryCollection();
    const docs = await collection
      .find({ ownerId: String(ownerId) }, { projection: { csv: 0 } })
      .sort({ finishedAt: -1 })
      .limit(LIST_LIMIT)
      .toArray();
    return docs.map(publicInfo);
  }

  // El CSV d'una partida, només si és del propi usuari; si no, null.
  async function csvForOwner(ownerId, id) {
    if (!ObjectId.isValid(id)) return null;
    const collection = await getGameHistoryCollection();
    const doc = await collection.findOne({ _id: new ObjectId(id), ownerId: String(ownerId) });
    if (!doc) return null;
    const stamp = new Date(doc.finishedAt).toISOString().slice(0, 10);
    const pinSafe = String(doc.pin).replace(/[^a-z0-9_-]+/gi, '_');
    return { csv: doc.csv, fileName: `partida-${pinSafe}-${stamp}.csv` };
  }

  return { RETENTION_DAYS, recordFinishedGame, listForOwner, csvForOwner };
};
