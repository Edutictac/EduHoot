const { getSoloScoresCollection } = require('../data/repositories');

// Rànquing del mode Solo: les puntuacions s'acumulen en un buffer i
// s'escriuen a Mongo en lots (bulkWrite) per a no fer una escriptura per
// partida. Mou el contingut de server.js, sense canviar comportament.
const soloScoreBuffer = [];
const SOLO_SCORE_BUFFER_DELAY = 150;
const SOLO_SCORE_BUFFER_MAX = 50;
let soloScoreFlushTimer = null;
let soloScoreFlushPromise = null;
let soloScoreFlushResolve = null;
let soloScoreFlushInFlight = false;

async function getTopSoloScores(quizIdKey, limit = 10) {
  const collection = await getSoloScoresCollection();
  const top = await collection
    .find({ quizId: quizIdKey })
    .sort({ score: -1, createdAt: 1 })
    .limit(limit)
    .project({ _id: 0, quizId: 1, quizName: 1, playerName: 1, score: 1, totalQuestions: 1, createdAt: 1 })
    .toArray();
  return top;
}

function scheduleSoloScoreFlush(immediate = false) {
  if (!soloScoreFlushPromise) {
    soloScoreFlushPromise = new Promise((resolve) => {
      soloScoreFlushResolve = resolve;
    });
  }
  if (immediate) {
    if (soloScoreFlushTimer) {
      clearTimeout(soloScoreFlushTimer);
      soloScoreFlushTimer = null;
    }
    setImmediate(runSoloScoreFlush);
    return soloScoreFlushPromise;
  }
  if (!soloScoreFlushTimer) {
    soloScoreFlushTimer = setTimeout(runSoloScoreFlush, SOLO_SCORE_BUFFER_DELAY);
  }
  return soloScoreFlushPromise;
}

async function runSoloScoreFlush() {
  if (soloScoreFlushInFlight) {
    if (!soloScoreFlushTimer) {
      soloScoreFlushTimer = setTimeout(runSoloScoreFlush, SOLO_SCORE_BUFFER_DELAY);
    }
    return;
  }
  soloScoreFlushInFlight = true;
  if (soloScoreFlushTimer) {
    clearTimeout(soloScoreFlushTimer);
    soloScoreFlushTimer = null;
  }
  const docs = soloScoreBuffer.splice(0, soloScoreBuffer.length);
  const resolve = soloScoreFlushResolve;
  soloScoreFlushPromise = null;
  soloScoreFlushResolve = null;
  try {
    if (docs.length > 0) {
      const collection = await getSoloScoresCollection();
      const ops = docs.map((doc) => ({ insertOne: { document: doc } }));
      await collection.bulkWrite(ops, { ordered: false });
    }
  } catch (err) {
    console.error('soloScore bulkWrite error', err);
  } finally {
    soloScoreFlushInFlight = false;
    if (resolve) resolve();
  }
}

function enqueueSoloScore(doc) {
  soloScoreBuffer.push(doc);
  const immediate = soloScoreBuffer.length >= SOLO_SCORE_BUFFER_MAX;
  return scheduleSoloScoreFlush(immediate);
}

module.exports = { getTopSoloScores, enqueueSoloScore };
