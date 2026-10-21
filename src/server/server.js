const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const express = require('express');
const socketIO = require('socket.io');
const helmet = require('helmet');
const { ObjectId } = require('mongodb');
const crypto = require('crypto');

const { LiveGames } = require('./utils/liveGames');
const { Players } = require('./utils/players');
const { linkAuthentikUser } = require('./authentikUsers');
const {
  normalizeQuestionMeta,
  normalizeCorrectAnswers,
  splitAcceptedAnswers,
  parseLenientNumber,
  isFreeAnswerType,
  looksLikeFreeTypeQuestion,
  isSubmissionCorrect,
  buildAnswerFields,
  getQuestionMeta
} = require('./questionUtils');
const { mongoClient, getDb } = require('./data/db');
const { calculateQuestionScore, getSubmissionScoreRatio } = require('./services/scoring');
const { quizToMoodleXml } = require('./services/moodleExport');
const {
  normalizeSoloName,
  normalizePlayerName,
  cleanImportedText,
  cleanMetaText,
  normalizeQuestions,
  normalizeTags,
  parseTagQuery,
  matchesTags,
  toFiniteNumber,
  normalizeVisibility,
  currentVisibility,
  normalizeAllowClone,
  isMultiplayerFreeTypeQuestion,
  coerceDate,
  normalizeQuizId
} = require('./services/quizNormalize');
const {
  getGamesCollection,
  getUsersCollection,
  getEphemeralCollection,
  getRatingsCollection,
  getRatingVotesCollection
} = require('./data/repositories');

const publicPath = path.join(__dirname, '../public');
const BODY_LIMIT = '1mb';
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  pingInterval: 10000,
  pingTimeout: 15000,
  transports: ['websocket', 'polling']
});
const games = new LiveGames();
const players = new Players();
const {
  quizToCsv,
  liveSessionToCsv,
  cacheFinishedSessionReport,
  finishedSessionReports,
  FINISHED_SESSION_REPORT_DIR
} = require('./services/sessionReport')({ players });
const { sessions, getCookieOptions, createSession, parseCookies } = require('./services/sessions');
const createCommonsService = require('./services/commons');
const createPlayerAuthRouter = require('./routes/playerAuth');
const createGamesRouter = require('./routes/games');
const createAdminRouter = require('./routes/admin');
const createQuizzesRouter = require('./routes/quizzes');
const createAuthRouter = require('./routes/auth');
const registerSocketHandlers = require('./sockets');
const createKahootImportService = require('./services/kahootImport');
const createEphemeralQuizzesService = require('./services/ephemeralQuizzes');
const { getTopSoloScores, enqueueSoloScore } = require('./services/soloScores');
const commons = createCommonsService({ normalizePlayerName });
const kahootImport = createKahootImportService({ publicPath, normalizeQuestions, cleanImportedText });
const { extractKahootId, mirrorExternalImage, mirrorKahootImage, mapKahootQuestions } = kahootImport;
const ephemeralQuizzes = createEphemeralQuizzesService({
  getEphemeralCollection,
  coerceDate,
  cleanImportedText,
  normalizeQuestions,
  normalizeTags,
  normalizeVisibility,
  normalizeAllowClone
});
const {
  isEphemeralExpired,
  normalizeEphemeralQuiz,
  persistEphemeralQuiz,
  deleteEphemeralQuiz,
  saveEphemeralQuiz,
  getEphemeralQuiz,
  isLocalQuizId
} = ephemeralQuizzes;
const {
  GLOBAL_OWNER_ID,
  GLOBAL_OWNER_EMAIL,
  ownerTokenFromReq,
  findGameById,
  nextGameId,
  canManageQuiz,
  canUseQuiz,
  canCloneQuiz,
  requireResourcesIntegration,
  selectQuizzesForUser,
  incrementQuizStats,
  sanitizeImportedQuiz,
  buildQuizDoc
} = require('./services/quizzes')({ getEphemeralQuiz });
const { hashPassword, hashResetToken, verifyPassword, setPasswordFields } = require('./services/passwords');
const {
  oauthStates,
  authentikOauthStates,
  GOOGLE_OAUTH_SCOPE,
  GOOGLE_OAUTH_AUTH_URL,
  GOOGLE_OAUTH_STATE_TTL_MS,
  AUTHENTIK_OAUTH_STATE_TTL_MS,
  AUTHENTIK_CLIENT_ID,
  AUTHENTIK_CLIENT_SECRET,
  AUTHENTIK_SCOPE,
  googleOAuthConfig,
  authentikCallbackUrl,
  authentikConfigured,
  authentikOnly,
  base64Url,
  sanitizeRedirectTarget,
  cleanupOauthStates,
  exchangeGoogleCode,
  fetchGoogleProfile,
  authentikEndpoints,
  exchangeAuthentikCode,
  fetchAuthentikProfile,
  findOrCreateAuthentikUser,
  findOrCreateGoogleUser
} = require('./services/oauth')({ PORT });
const { authRateLimiter, sessionMiddleware, requireRole } = require('./services/authMiddleware')({ authentikOnly });

// Log y absorbe errores no controlados para evitar que el proceso caiga
process.on('unhandledRejection', (reason, promise) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
  process.exit(1);
});
io.on('error', (err) => {
  console.error('[socket-io-error]', err);
});
io.engine.on('connection_error', (err) => {
  console.error('[socket-connection-error]', err);
});
const PUBLIC_IMPORT_SOURCE_URL = (process.env.PUBLIC_IMPORT_SOURCE_URL || '').trim().replace(/\/+$/, '');


// Body parsers (bump limit to allow quizzes con recursos más pesados)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.get('/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json');
  res.set('Cache-Control', 'no-cache, must-revalidate, max-age=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(publicPath, 'manifest.webmanifest'));
});
app.get(['/create', '/create/', '/create/index.html'], (req, res) => {
  const config = googleOAuthConfig(req);
  const googleEnabled = !!(config.clientId && config.clientSecret);
  fs.readFile(path.join(publicPath, 'create', 'index.html'), 'utf8', (err, html) => {
    if (err) return res.status(500).send('Internal error');
    const out = googleEnabled
      ? html.replace('id="new-user-signin" class="signin-callout hidden"', 'id="new-user-signin" class="signin-callout"')
      : html;
    res.set('Cache-Control', 'no-cache, must-revalidate, max-age=0');
    res.type('html').send(out);
  });
});
app.use(express.static(publicPath, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    const lower = (filePath || '').toLowerCase();
    const isHtml = lower.endsWith('.html');

    // Permitir carga de recursos desde el mismo origen y contextos embebidos
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    // HTML: evitar caché para que los cambios se reflejen al recargar.
    if (isHtml) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return;
    }

    // Assets: permitir caché pero forzar revalidación (evita quedarse con JS/CSS antiguos).
    res.setHeader('Cache-Control', 'no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));
app.use(sessionMiddleware);

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log('Server started on ' + HOST + ':' + PORT);
  });
}

app.use(createGamesRouter({ games, finishedSessionReports, liveSessionToCsv, FINISHED_SESSION_REPORT_DIR }));

app.use('/api/player-auth', createPlayerAuthRouter({ commons, authRateLimiter }));

app.use(createAdminRouter({
  requireRole,
  sanitizeImportedQuiz,
  buildQuizDoc,
  currentVisibility,
  games,
  players,
  mirrorKahootImage,
  mirrorExternalImage,
  PUBLIC_IMPORT_SOURCE_URL,
  publicPath
}));

app.use(createQuizzesRouter({
  findGameById,
  canUseQuiz,
  canManageQuiz,
  canCloneQuiz,
  isMultiplayerFreeTypeQuestion,
  cleanImportedText,
  cleanMetaText,
  normalizeTags,
  normalizeQuestions,
  normalizeVisibility,
  currentVisibility,
  normalizeAllowClone,
  normalizeSoloName,
  ownerTokenFromReq,
  parseTagQuery,
  matchesTags,
  selectQuizzesForUser,
  getEphemeralQuiz,
  isEphemeralExpired,
  isLocalQuizId,
  saveEphemeralQuiz,
  persistEphemeralQuiz,
  deleteEphemeralQuiz,
  buildQuizDoc,
  nextGameId,
  toFiniteNumber,
  requireResourcesIntegration,
  getTopSoloScores,
  enqueueSoloScore,
  incrementQuizStats,
  extractKahootId,
  mapKahootQuestions,
  mirrorKahootImage,
  commons,
  quizToCsv,
  quizToMoodleXml,
  GLOBAL_OWNER_ID,
  GLOBAL_OWNER_EMAIL,
  PUBLIC_IMPORT_SOURCE_URL
}));

registerSocketHandlers(io, {
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
});

app.use(createAuthRouter({
  requireRole,
  authRateLimiter,
  authentikOnly,
  hashPassword,
  verifyPassword,
  setPasswordFields,
  hashResetToken,
  googleOAuthConfig,
  authentikConfigured,
  authentikEndpoints,
  cleanupOauthStates,
  base64Url,
  sanitizeRedirectTarget,
  authentikCallbackUrl,
  exchangeAuthentikCode,
  fetchAuthentikProfile,
  findOrCreateAuthentikUser,
  exchangeGoogleCode,
  fetchGoogleProfile,
  findOrCreateGoogleUser,
  oauthStates,
  authentikOauthStates,
  AUTHENTIK_CLIENT_ID,
  AUTHENTIK_CLIENT_SECRET,
  AUTHENTIK_SCOPE,
  AUTHENTIK_OAUTH_STATE_TTL_MS,
  GOOGLE_OAUTH_STATE_TTL_MS,
  GOOGLE_OAUTH_SCOPE,
  GOOGLE_OAUTH_AUTH_URL
}));

// Fallback para errores de rutas no capturados
app.use((err, req, res, next) => {
  console.error('[express-error]', err);
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: 'Error interno. Inténtalo de nuevo.' });
});

// Exportaciones para tests (no alteran el arranque en producción).
module.exports = {
  app,
  server,
  io,
  mongoClient,
  extractKahootId,
  isEphemeralExpired,
  normalizeEphemeralQuiz,
  calculateQuestionScore,
  isSubmissionCorrect,
  getSubmissionScoreRatio,
  normalizeSoloName,
  normalizePlayerName,
  cleanMetaText,
  sanitizeRedirectTarget,
  hashPassword,
  hashResetToken,
  setPasswordFields,
  normalizeQuizId,
  buildQuizDoc,
  sessions,
  oauthStates,
  games,
  players,
  finishedSessionReports,
  liveSessionToCsv,
  cacheFinishedSessionReport
};
