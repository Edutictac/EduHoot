const { MongoClient } = require('mongodb');

// MongoDB setup (single shared client to avoid legacy OP_QUERY code path)
// Prefer IPv4 loopback to avoid ::1 connection issues on some setups
const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/';
const DB_NAME = process.env.MONGO_DB || 'kahootDB';
const GAMES_COLLECTION = 'kahootGames';
const USERS_COLLECTION = 'users';
const SOLO_SCORES_COLLECTION = 'soloScores';
const EPHEMERAL_COLLECTION = 'ephemeralQuizzes';
const RATINGS_COLLECTION = 'quizRatings';
const RATING_VOTES_COLLECTION = 'quizRatingVotes';
const MONGO_MAX_RETRIES = 5;
const MONGO_RETRY_DELAY_MS = 3000;
const MONGO_MAX_POOL_SIZE = parseInt(process.env.MONGO_MAX_POOL_SIZE, 10) || 50;
const mongoClient = new MongoClient(mongoUrl, {
  serverSelectionTimeoutMS: 3000,
  maxPoolSize: MONGO_MAX_POOL_SIZE
});
let db;
let mongoReadyPromise = null;
let indexesReadyPromise = null;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectMongoWithRetry(attempt = 1) {
  try {
    console.log(`Connecting to MongoDB at ${mongoUrl} (attempt ${attempt})`);
    await mongoClient.connect();
    db = mongoClient.db(DB_NAME);
    await ensureIndexes(db);
    console.log(`Connected to MongoDB at ${mongoUrl}`);
    mongoReadyPromise = null;
    return db;
  } catch (err) {
    console.error(`MongoDB connection error (attempt ${attempt})`, err && err.message ? err.message : err);
    db = null;
    mongoReadyPromise = null;
    if (attempt >= MONGO_MAX_RETRIES) {
      throw err;
    }
    await wait(MONGO_RETRY_DELAY_MS * attempt);
    return connectMongoWithRetry(attempt + 1);
  }
}

async function getDb() {
  if (db) return db;
  if (mongoReadyPromise) return mongoReadyPromise;
  mongoReadyPromise = connectMongoWithRetry();
  return mongoReadyPromise;
}

async function ensureIndexes(dbInstance) {
  if (indexesReadyPromise) return indexesReadyPromise;
  const games = dbInstance.collection(GAMES_COLLECTION);
  const users = dbInstance.collection(USERS_COLLECTION);
  const soloScores = dbInstance.collection(SOLO_SCORES_COLLECTION);
  const ephemerals = dbInstance.collection(EPHEMERAL_COLLECTION);
  const ratings = dbInstance.collection(RATINGS_COLLECTION);
  const ratingVotes = dbInstance.collection(RATING_VOTES_COLLECTION);
  indexesReadyPromise = Promise.all([
    games.createIndex({ id: 1 }, { unique: true, sparse: true }),
    games.createIndex({ visibility: 1 }),
    games.createIndex({ ownerId: 1 }),
    soloScores.createIndex({ quizId: 1, score: -1, createdAt: 1 }),
    users.createIndex({ email: 1 }, { unique: true, sparse: true }),
    users.createIndex({ authentikIssuer: 1, authentikId: 1 }, { unique: true, partialFilterExpression: { authentikIssuer: { $type: 'string' }, authentikId: { $type: 'string' } } }),
    users.createIndex({ resetTokenHash: 1 }, { sparse: true }),
    ephemerals.createIndex({ id: 1 }, { unique: true, sparse: true }),
    ephemerals.createIndex({ expires: 1 }, { expireAfterSeconds: 0 }),
    ratings.createIndex({ quizId: 1 }, { unique: true, sparse: true }),
    ratingVotes.createIndex({ quizId: 1, deviceId: 1 }, { unique: true })
  ]).catch((err) => {
    console.error('ensureIndexes error', err);
    indexesReadyPromise = null;
  });
  return indexesReadyPromise;
}

module.exports = {
  mongoClient,
  getDb,
  GAMES_COLLECTION,
  USERS_COLLECTION,
  SOLO_SCORES_COLLECTION,
  EPHEMERAL_COLLECTION,
  RATINGS_COLLECTION,
  RATING_VOTES_COLLECTION
};
