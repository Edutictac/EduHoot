const createGameHelpers = require('./gameHelpers');
const createCommonEvents = require('./common');
const createHostEvents = require('./hostEvents');
const createPlayerEvents = require('./playerEvents');
const createSelfPacedEvents = require('./selfPacedEvents');

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

  const helpers = createGameHelpers({ io, games, players, cleanImportedText });

  const registerCommonEvents = createCommonEvents({ io, games, players, helpers, selectQuizzesForUser });
  const selfPaced = createSelfPacedEvents({ io, games, players, helpers, cacheFinishedSessionReport, incrementQuizStats, commons });
  const registerHostEvents = createHostEvents({
    selfPaced,
    io,
    games,
    players,
    helpers,
    findGameById,
    canUseQuiz,
    parseCookies,
    cleanImportedText,
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
    selfPaced,
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
      // Mateixa forma que req.user (services/authMiddleware.js): id, no userId.
      const session = sessions.get(sessionId);
      socket.user = { id: session.userId, email: session.email, role: session.role, nickname: session.nickname || '', provider: session.provider };
    }

    registerHostEvents(socket);
    registerPlayerEvents(socket);
    selfPaced.register(socket);
    registerCommonEvents(socket);
  });
};
