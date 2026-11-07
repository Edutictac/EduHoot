const createGameHelpers = require('./gameHelpers');
const createCommonEvents = require('./common');
const createHostEvents = require('./hostEvents');
const createPlayerEvents = require('./playerEvents');

// Registre de tots els handlers de Socket.IO. Mou el contingut de
// io.on('connection', ...) de server.js, repartit en tres grups
// (hostEvents, playerEvents, common) que comparteixen els helpers de
// gameHelpers.js — sense canviar comportament.
module.exports = function registerSocketHandlers(io, deps) {
  const {
    games,
    players,
    sessions,
    parseCookies,
    authentikOnly,
    cleanImportedText,
    isMultiplayerFreeTypeQuestion,
    findGameById,
    canUseQuiz,
    cacheFinishedSessionReport,
    incrementQuizStats,
    commons,
    nextGameId,
    normalizeQuestions,
    normalizeTags,
    normalizeVisibility,
    normalizeAllowClone,
    GLOBAL_OWNER_ID,
    GLOBAL_OWNER_EMAIL,
    normalizeSoloName,
    normalizePlayerName,
    getSubmissionScoreRatio,
    calculateQuestionScore,
    selectQuizzesForUser
  } = deps;

  const helpers = createGameHelpers({ io, games, players, cleanImportedText, isMultiplayerFreeTypeQuestion });

  const registerCommonEvents = createCommonEvents({ io, games, players, helpers, selectQuizzesForUser });
  const registerHostEvents = createHostEvents({
    io,
    games,
    players,
    helpers,
    findGameById,
    canUseQuiz,
    cleanImportedText,
    isMultiplayerFreeTypeQuestion,
    cacheFinishedSessionReport,
    incrementQuizStats,
    commons,
    nextGameId,
    normalizeQuestions,
    normalizeTags,
    normalizeVisibility,
    normalizeAllowClone,
    GLOBAL_OWNER_ID,
    GLOBAL_OWNER_EMAIL
  });
  const registerPlayerEvents = createPlayerEvents({
    io,
    games,
    players,
    helpers,
    commons,
    normalizeSoloName,
    normalizePlayerName,
    getSubmissionScoreRatio,
    calculateQuestionScore
  });

  io.on('connection', (socket) => {
    const cookies = parseCookies(socket.handshake.headers.cookie || '');
    const sessionId = cookies.sessionId;
    if (sessionId && sessions.has(sessionId) && (!authentikOnly() || sessions.get(sessionId).provider === 'authentik')) {
      socket.user = sessions.get(sessionId);
    }

    registerHostEvents(socket);
    registerPlayerEvents(socket);
    registerCommonEvents(socket);
  });
};
