const {
  getDb,
  GAMES_COLLECTION,
  USERS_COLLECTION,
  SOLO_SCORES_COLLECTION,
  EPHEMERAL_COLLECTION,
  RATINGS_COLLECTION,
  RATING_VOTES_COLLECTION,
  LOGS_COLLECTION,
  SETTINGS_COLLECTION,
  HOMEWORK_COLLECTION,
  HOMEWORK_ATTEMPTS_COLLECTION
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

async function getLogsCollection() {
  const database = await getDb();
  return database.collection(LOGS_COLLECTION);
}

async function getSettingsCollection() {
  const database = await getDb();
  return database.collection(SETTINGS_COLLECTION);
}

async function getHomeworksCollection() {
  const database = await getDb();
  return database.collection(HOMEWORK_COLLECTION);
}

async function getHomeworkAttemptsCollection() {
  const database = await getDb();
  return database.collection(HOMEWORK_ATTEMPTS_COLLECTION);
}

module.exports = {
  getHomeworksCollection,
  getHomeworkAttemptsCollection,
  getGamesCollection,
  getUsersCollection,
  getSoloScoresCollection,
  getEphemeralCollection,
  getRatingsCollection,
  getRatingVotesCollection,
  getLogsCollection,
  getSettingsCollection
};
