const {
  getDb,
  GAMES_COLLECTION,
  USERS_COLLECTION,
  SOLO_SCORES_COLLECTION,
  EPHEMERAL_COLLECTION,
  RATINGS_COLLECTION,
  RATING_VOTES_COLLECTION
} = require('./db');

async function getGamesCollection() {
  const database = await getDb();
  return database.collection(GAMES_COLLECTION);
}

async function getUsersCollection() {
  const database = await getDb();
  return database.collection(USERS_COLLECTION);
}

async function getSoloScoresCollection() {
  const database = await getDb();
  return database.collection(SOLO_SCORES_COLLECTION);
}

async function getEphemeralCollection() {
  const database = await getDb();
  return database.collection(EPHEMERAL_COLLECTION);
}

async function getRatingsCollection() {
  const database = await getDb();
  return database.collection(RATINGS_COLLECTION);
}

async function getRatingVotesCollection() {
  const database = await getDb();
  return database.collection(RATING_VOTES_COLLECTION);
}

module.exports = {
  getGamesCollection,
  getUsersCollection,
  getSoloScoresCollection,
  getEphemeralCollection,
  getRatingsCollection,
  getRatingVotesCollection
};
