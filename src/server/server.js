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
  getGamesCollection,
  getUsersCollection,
  getSoloScoresCollection,
  getEphemeralCollection,
  getRatingsCollection,
  getRatingVotesCollection
} = require('./data/repositories');

const publicPath = path.join(__dirname, '../public');
const BODY_LIMIT = '1mb';
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
const oauthStates = new Map();
const authentikOauthStates = new Map();
const soloScoreBuffer = [];
const SOLO_SCORE_BUFFER_DELAY = 150;
const SOLO_SCORE_BUFFER_MAX = 50;
let soloScoreFlushTimer = null;
let soloScoreFlushPromise = null;
let soloScoreFlushResolve = null;
let soloScoreFlushInFlight = false;

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
const GLOBAL_OWNER_ID = 'global-anon-owner';
const GLOBAL_OWNER_EMAIL = 'anon@local';
const GOOGLE_OAUTH_SCOPE = 'openid email profile';
const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_OAUTH_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const AUTHENTIK_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const AUTHENTIK_TEACHER_ROLES = new Set(
  (process.env.AUTHENTIK_TEACHER_ROLES || 'professorat,profesor,teacher,docente,administrador,admin')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
);
const AUTHENTIK_ROLE_CLAIM = (process.env.AUTHENTIK_ROLE_CLAIM || 'groups').trim();
const AUTHENTIK_ISSUER = (process.env.AUTHENTIK_ISSUER || '').trim().replace(/\/+$/, '');
const AUTHENTIK_CLIENT_ID = (process.env.AUTHENTIK_CLIENT_ID || '').trim();
const AUTHENTIK_CLIENT_SECRET = process.env.AUTHENTIK_CLIENT_SECRET || '';
const AUTHENTIK_REDIRECT_URI = (process.env.AUTHENTIK_REDIRECT_URI || '').trim();
const AUTHENTIK_DISCOVERY_URL = (process.env.AUTHENTIK_DISCOVERY_URL || '').trim();
const AUTHENTIK_AUTHORIZATION_URL = (process.env.AUTHENTIK_AUTHORIZATION_URL || '').trim();
const AUTHENTIK_TOKEN_URL = (process.env.AUTHENTIK_TOKEN_URL || '').trim();
const AUTHENTIK_USERINFO_URL = (process.env.AUTHENTIK_USERINFO_URL || '').trim();
const AUTHENTIK_SCOPE = (process.env.AUTHENTIK_SCOPE || 'openid profile email groups').trim();
const AUTHENTIK_ONLY = /^(1|true|yes)$/i.test(process.env.AUTHENTIK_ONLY || '');
const EDUHOOT_RESOURCES_TOKEN = process.env.EDUHOOT_RESOURCES_TOKEN || '';
const PUBLIC_IMPORT_SOURCE_URL = (process.env.PUBLIC_IMPORT_SOURCE_URL || '').trim().replace(/\/+$/, '');

const authRate = new Map(); // clave: ip:endpoint -> { count, windowStart }

function authRateLimiter(req, res, next) {
  const windowMs = 10 * 60 * 1000; // 10 minutos
  const max = 20; // máximo intentos por endpoint en la ventana
  const now = Date.now();
  const endpoint = (req.path || req.originalUrl || 'auth').toString();
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const key = `${ip}:${endpoint}`;
  const entry = authRate.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  authRate.set(key, entry);
  if (entry.count > max) {
    return res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' });
  }
  // limpieza ocasional
  if (authRate.size > 3000) {
    for (const [k, v] of authRate.entries()) {
      if (now - v.windowStart > windowMs) authRate.delete(k);
    }
  }
  return next();
}
function ownerTokenFromReq(req) {
  const hdr = req.headers['x-owner-token'];
  if (hdr && typeof hdr === 'string') return hdr.trim();
  return '';
}

function normalizeSoloName(name) {
  const clean = (name || '').toString().trim();
  if (!clean) return 'Anónimo';
  return clean.slice(0, 40);
}

function normalizePlayerName(name) {
  const chars = (name || '').toString().match(/[0-9a-zA-Z]/g) || [];
  const trimmed = chars.join('').toUpperCase().slice(0, 3);
  return trimmed || '???';
}

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

async function findGameById(gameId) {
  const collection = await getGamesCollection();
  const numId = parseInt(gameId, 10);
  const candidates = [];
  if (!Number.isNaN(numId)) candidates.push(numId);
  candidates.push(String(gameId));
  const query = {
    $or: [
      { id: { $in: candidates } },
      { _id: { $in: candidates } }
    ]
  };
  const [game] = await collection.find(query).limit(1).toArray();
  if (game) return game;
  if (typeof gameId === 'string' && gameId.startsWith('local-')) {
    return await getEphemeralQuiz(gameId);
  }
  return null;
}

async function nextGameId(collection) {
  const doc = await collection.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).next();
  const maxId = doc && doc.id ? doc.id : 0;
  return maxId + 1;
}

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '-',
    mdash: '-',
    hellip: '...',
    lsquo: "'",
    rsquo: "'",
    ldquo: '"',
    rdquo: '"',
    aacute: 'á',
    eacute: 'é',
    iacute: 'í',
    oacute: 'ó',
    uacute: 'ú',
    agrave: 'à',
    egrave: 'è',
    igrave: 'ì',
    ograve: 'ò',
    ugrave: 'ù',
    auml: 'ä',
    euml: 'ë',
    iuml: 'ï',
    ouml: 'ö',
    uuml: 'ü',
    ntilde: 'ñ',
    ccedil: 'ç',
    Aacute: 'Á',
    Eacute: 'É',
    Iacute: 'Í',
    Oacute: 'Ó',
    Uacute: 'Ú',
    Agrave: 'À',
    Egrave: 'È',
    Igrave: 'Ì',
    Ograve: 'Ò',
    Ugrave: 'Ù',
    Auml: 'Ä',
    Euml: 'Ë',
    Iuml: 'Ï',
    Ouml: 'Ö',
    Uuml: 'Ü',
    Ntilde: 'Ñ',
    Ccedil: 'Ç'
  };
  return (value || '').toString().replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1] && entity[1].toLowerCase() === 'x';
      const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isFinite(code) && code > 0) {
        try {
          return String.fromCodePoint(code);
        } catch (e) {}
      }
      return match;
    }
    return Object.prototype.hasOwnProperty.call(named, entity) ? named[entity] : match;
  });
}

function cleanImportedText(value) {
  let text = (value || '').toString();
  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeHtmlEntities(text);
    if (decoded === text) break;
    text = decoded;
  }
  text = text.replace(/<\s*br\s*\/?\s*>/gi, ' ');
  text = text.replace(/<\/?[a-z][^>]*>/gi, '');
  text = text.replace(/\u00a0/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeVideoUrl(value) {
  const raw = (value || '').toString().trim();
  if (!raw) return '';
  if (raw.startsWith('/uploads/')) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? raw : '';
  } catch (err) {
    return '';
  }
}

// Texto opcional de metadatos (idioma, licencia, descripción) con límite de tamaño.
function cleanMetaText(value, maxLength = 500) {
  if (value === undefined || value === null) return '';
  return cleanImportedText(value).slice(0, maxLength);
}

function normalizeQuestions(list = []) {
  return list
    .map((item) => {
      const answers = Array.isArray(item.answers) ? item.answers : [];
      const safeAnswers = [
        cleanImportedText(answers[0] || ''),
        cleanImportedText(answers[1] || ''),
        cleanImportedText(answers[2] || ''),
        cleanImportedText(answers[3] || '')
      ];
      const meta = normalizeQuestionMeta({
        ...item,
        question: cleanImportedText(item.question || ''),
        answers: safeAnswers,
        texto: cleanImportedText(item.texto || item.text || item.acceptedAnswers || item.correctText || ''),
        acceptedAnswers: Array.isArray(item.acceptedAnswers)
          ? item.acceptedAnswers.map(cleanImportedText)
          : cleanImportedText(item.acceptedAnswers || ''),
        correcta: cleanImportedText(item.correcta || ''),
        correct: Array.isArray(item.correct) ? item.correct : cleanImportedText(item.correct || ''),
        correctText: cleanImportedText(item.correctText || '')
      });
      const video = normalizeVideoUrl(item.video);
      const base = {
        question: cleanImportedText(item.question || ''),
        answers: safeAnswers,
        correct: meta.correct,
        correctAnswers: meta.correctAnswers,
        type: meta.type,
        time: Number(item.time) || 20,
        pointsMultiplier: Number(item.pointsMultiplier) > 1 ? 2 : 1,
        image: item.image || '',
        video
      };
      const answerFields = buildAnswerFields(item, meta, { hasVideo: Boolean(video) });
      if (Array.isArray(answerFields.acceptedAnswers)) {
        answerFields.acceptedAnswers = answerFields.acceptedAnswers.map(cleanImportedText);
      }
      return { ...base, ...answerFields };
    })
    .filter((q) => q.question.trim().length > 0);
}

function normalizeTags(list = []) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    let clean = (raw || '').toString().trim().toLowerCase();
    if (!clean) continue;
    try {
      clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (err) {}
    clean = clean.replace(
      /(^|[^a-z0-9])(\d+)\s*[\.\-]?\s*(º|ª|°|o|a|er|ero|era|ro|ra|do|da|to|ta|mo|ma|vo|va)(?=$|[^a-z0-9])/g,
      '$1$2'
    );
    clean = clean
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
      .replace(/^-|-$/g, '');
    if (!clean || out.includes(clean)) continue;
    out.push(clean);
  }
  return out;
}

function parseTagQuery(query = {}) {
  const values = [];
  const addValue = (value) => {
    if (Array.isArray(value)) {
      value.forEach(addValue);
      return;
    }
    if (typeof value !== 'string') return;
    value.split(',').forEach((part) => {
      if (part && part.trim()) values.push(part.trim());
    });
  };
  addValue(query.tag);
  addValue(query.tags);
  return normalizeTags(values);
}

function matchesTags(quiz, tags, tagMode = 'all') {
  if (!tags.length) return true;
  const quizTags = normalizeTags(quiz.tags || []);
  if (tagMode === 'all') {
    return tags.every((tag) => quizTags.includes(tag));
  }
  return tags.some((tag) => quizTags.includes(tag));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function verifyPassword(password, user) {
  if (!user || !user.passwordHash || !user.passwordSalt) return false;
  const hash = crypto.pbkdf2Sync(password, user.passwordSalt, 10000, 64, 'sha512').toString('hex');
  return hash === user.passwordHash;
}

function setPasswordFields(password) {
  const { salt, hash } = hashPassword(password);
  return { passwordSalt: salt, passwordHash: hash };
}

function publicBaseUrl(req) {
  const configured = (process.env.PUBLIC_BASE_URL || process.env.BASE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`).toString().split(',')[0].trim();
  return `${proto}://${host}`;
}

function googleCallbackUrl(req) {
  const configured = (process.env.GOOGLE_CALLBACK_URL || '').trim();
  if (configured) return configured;
  return `${publicBaseUrl(req)}/api/auth/google/callback`;
}

function googleOAuthConfig(req) {
  return {
    clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
    clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
    redirectUri: googleCallbackUrl(req)
  };
}

function authentikCallbackUrl(req) {
  return AUTHENTIK_REDIRECT_URI || `${publicBaseUrl(req)}/api/auth/authentik/callback`;
}

function authentikDiscoveryUrl() {
  return AUTHENTIK_DISCOVERY_URL || (AUTHENTIK_ISSUER ? `${AUTHENTIK_ISSUER}/.well-known/openid-configuration` : '');
}

function authentikConfigured() {
  return !!(AUTHENTIK_ISSUER && AUTHENTIK_CLIENT_ID && AUTHENTIK_CLIENT_SECRET);
}

function authentikOnly() {
  const deadline = Date.parse(process.env.AUTHENTIK_MIGRATION_END || '');
  return AUTHENTIK_ONLY || (authentikConfigured() && Number.isFinite(deadline) && Date.now() >= deadline);
}


function base64Url(value) {
  return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function authentikTeacher(profile) {
  const raw = profile && profile[AUTHENTIK_ROLE_CLAIM];
  const values = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return values.some((value) => AUTHENTIK_TEACHER_ROLES.has(String(value).trim().toLowerCase()));
}

function sanitizeRedirectTarget(raw) {
  const target = (raw || '').toString().trim();
  if (!target || !target.startsWith('/') || target.startsWith('//')) return '/create/';
  if (target === '/admin' || target === '/admin/' || target === '/admin-stats.html') {
    return '/admin/stats';
  }
  return target;
}

function cleanupOauthStates() {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (!data || data.expiresAt <= now) oauthStates.delete(state);
  }
  for (const [state, data] of authentikOauthStates.entries()) {
    if (!data || data.expiresAt <= now) authentikOauthStates.delete(state);
  }
}

function httpsJsonRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === 'http:' ? http : require('https');
    const body = options.body || '';
    const req = transport.request({
      method: options.method || 'GET',
      hostname: target.hostname,
      port: target.port || undefined,
      path: `${target.pathname}${target.search}`,
      headers: {
        Accept: 'application/json',
        ...(body ? {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        } : {}),
        ...(options.headers || {})
      }
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (err) {
          return reject(new Error('Respuesta OAuth no válida.'));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const msg = data.error_description || data.error || `HTTP ${res.statusCode}`;
          return reject(new Error(msg));
        }
        return resolve(data);
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function exchangeGoogleCode(code, config) {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code'
  }).toString();
  return httpsJsonRequest(GOOGLE_OAUTH_TOKEN_URL, { method: 'POST', body });
}

async function fetchGoogleProfile(accessToken) {
  return httpsJsonRequest(GOOGLE_OAUTH_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

async function authentikEndpoints() {
  const configured = {
    authorization_endpoint: AUTHENTIK_AUTHORIZATION_URL,
    token_endpoint: AUTHENTIK_TOKEN_URL,
    userinfo_endpoint: AUTHENTIK_USERINFO_URL
  };
  if (configured.authorization_endpoint && configured.token_endpoint && configured.userinfo_endpoint) return configured;
  const discoveryUrl = authentikDiscoveryUrl();
  if (!discoveryUrl) throw new Error('Authentik OIDC no está configurado.');
  const discovery = await httpsJsonRequest(discoveryUrl);
  return {
    authorization_endpoint: configured.authorization_endpoint || discovery.authorization_endpoint,
    token_endpoint: configured.token_endpoint || discovery.token_endpoint,
    userinfo_endpoint: configured.userinfo_endpoint || discovery.userinfo_endpoint
  };
}

async function exchangeAuthentikCode(code, config, verifier, endpoints) {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier
  }).toString();
  return httpsJsonRequest(endpoints.token_endpoint, { method: 'POST', body });
}

async function fetchAuthentikProfile(accessToken, endpoint) {
  return httpsJsonRequest(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
}

async function findOrCreateAuthentikUser(profile) {
  if (!authentikTeacher(profile)) throw new Error('La cuenta de Authentik no tiene rol docente.');
  return linkAuthentikUser(await getUsersCollection(), profile, AUTHENTIK_ISSUER);
}

async function findOrCreateGoogleUser(profile) {
  const email = (profile.email || '').toLowerCase().trim();
  if (!email) throw new Error('Google no devolvió email.');
  const users = await getUsersCollection();
  const now = new Date();
  const adminCount = await users.countDocuments({ role: 'admin' });
  const noAdminExists = adminCount === 0;
  const existing = await users.findOne({ email });
  if (existing) {
    const providers = Array.isArray(existing.authProviders) ? existing.authProviders : [];
    const update = {
      googleId: profile.sub,
      googlePicture: profile.picture || '',
      googleVerifiedEmail: !!profile.email_verified,
      lastLoginAt: now,
      updatedAt: now
    };
    if (!existing.nickname && profile.name) update.nickname = profile.name;
    if (!providers.includes('google')) update.authProviders = [...providers, 'google'];
    if (noAdminExists && existing.role !== 'admin') update.role = 'admin';
    await users.updateOne({ _id: existing._id }, { $set: update });
    return { ...existing, ...update };
  }
  const user = {
    email,
    googleId: profile.sub,
    googlePicture: profile.picture || '',
    googleVerifiedEmail: !!profile.email_verified,
    authProviders: ['google'],
    role: noAdminExists ? 'admin' : 'editor',
    nickname: profile.name || '',
    createdAt: now,
    lastLoginAt: now
  };
  const result = await users.insertOne(user);
  return { ...user, _id: result.insertedId };
}

async function sessionMiddleware(req, res, next) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionId = cookies.sessionId;
  if (sessionId && sessions.has(sessionId) && (!authentikOnly() || sessions.get(sessionId).provider === 'authentik')) {
    const session = sessions.get(sessionId);
    req.user = { id: session.userId, email: session.email, role: session.role, nickname: session.nickname || '' };
  }
  next();
}

function requireRole(role) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const rolesOrder = { editor: 1, admin: 2 };
    const current = rolesOrder[req.user.role] || 0;
    const needed = rolesOrder[role] || 0;
    if (current < needed) return res.status(403).json({ error: 'Permiso insuficiente' });
    return next();
  };
}

function toFiniteNumber(value, fallback = 0) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof value === 'object') {
    if (typeof value.toNumber === 'function') {
      try {
        const n = value.toNumber();
        return Number.isFinite(n) ? n : fallback;
      } catch (_) {
        // ignore
      }
    }
    if (typeof value.valueOf === 'function') {
      try {
        const v = value.valueOf();
        if (v !== value) return toFiniteNumber(v, fallback);
      } catch (_) {
        // ignore
      }
    }
    if (typeof value.toString === 'function') {
      try {
        const n = Number(value.toString());
        return Number.isFinite(n) ? n : fallback;
      } catch (_) {
        // ignore
      }
    }
  }
  return fallback;
}

function normalizeVisibility(value, fallback = 'private') {
  const allowed = ['private', 'unlisted', 'public'];
  if (!value) return fallback;
  const val = value.toString().toLowerCase();
  return allowed.includes(val) ? val : fallback;
}

function currentVisibility(quiz) {
  // legacy quizzes without visibility are treated as public
  return normalizeVisibility(quiz && quiz.visibility, 'public');
}

function normalizeAllowClone(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
}

function canManageQuiz(quiz, user) {
  if (!quiz) return false;
  if (user && user.ownerToken && quiz.ownerToken && quiz.ownerToken === user.ownerToken) return true;
  if (user && user.role === 'admin') return true;
  const ownerId = quiz.ownerId || quiz.owner_id || quiz.owner;
  if (!ownerId) {
    // Quizzes heredados sin dueño: permite gestionarlos a usuarios autenticados
    return !!user;
  }
  if (!user) return false;
  return ownerId.toString() === user.id;
}

function canUseQuiz(quiz, user) {
  const visibility = currentVisibility(quiz);
  if (visibility === 'public') return true;
  if (visibility === 'unlisted') return true;
  // Permitir usar (hostear) aunque sea "solo yo"; se controla por visibilidad solo en lectura/gestión.
  return true;
}

function canCloneQuiz(quiz, user) {
  if (!quiz) return false;
  if (quiz.allowClone) {
    return canUseQuiz(quiz, user);
  }
  return canManageQuiz(quiz, user);
}

function requireResourcesIntegration(req, res) {
  if (!EDUHOOT_RESOURCES_TOKEN) {
    res.status(503).json({ error: 'Integración con Recursos no configurada.' });
    return false;
  }
  const authorization = (req.headers.authorization || '').toString();
  const token = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
  const valid = token.length === EDUHOOT_RESOURCES_TOKEN.length
    && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(EDUHOOT_RESOURCES_TOKEN));
  if (!valid) {
    res.status(401).json({ error: 'Integración con Recursos no autorizada.' });
    return false;
  }
  return true;
}

function selectQuizzesForUser(quizzes, user, opts = {}) {
  const includeUnlistedForAll = opts.includeUnlistedForAll === true;
  return (quizzes || []).filter((quiz) => {
    const visibility = currentVisibility(quiz);
    if (visibility === 'public') return true;
    if (visibility === 'unlisted') {
      if (includeUnlistedForAll) return true;
      return canManageQuiz(quiz, user);
    }
    return canManageQuiz(quiz, user);
  });
}

// Multijugador: preguntas de respuesta libre (se omiten en multijugador).
function isMultiplayerFreeTypeQuestion(q) {
  if (!q) return false;
  const meta = normalizeQuestionMeta(q);
  if (isFreeAnswerType(meta.type)) return true;
  return looksLikeFreeTypeQuestion(q);
}

async function incrementQuizStats(gameId, playersInGame) {
  try {
    const collection = await getGamesCollection();
    const numericId = parseInt(gameId, 10);
    if (Number.isNaN(numericId)) return;
    const playersCount = Math.max(playersInGame || 0, 0);
    await collection.updateOne(
      { id: numericId },
      { $inc: { playsCount: 1, playersCount } }
    );
  } catch (err) {
    console.error('incrementQuizStats error', err);
  }
}

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

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '127.0.0.1';
if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log('Server started on ' + HOST + ':' + PORT);
  });
}

app.use(createGamesRouter({ games, finishedSessionReports, liveSessionToCsv, FINISHED_SESSION_REPORT_DIR }));

app.use('/api/player-auth', createPlayerAuthRouter({ commons, authRateLimiter }));

function coerceDate(value, fallback = null) {
  if (!value) return fallback;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

function normalizeQuizId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  const num = parseInt(raw, 10);
  if (!Number.isNaN(num) && String(num) === raw) return num;
  return raw;
}

function sanitizeImportedQuiz(raw = {}) {
  const id = normalizeQuizId(raw.id || raw._id);
  if (id === null) return { ok: false, error: 'Falta id' };
  const name = (raw.name || raw.title || '').toString().trim() || 'Quiz importado';
  const tags = normalizeTags(Array.isArray(raw.tags) ? raw.tags : []);
  const questions = normalizeQuestions(Array.isArray(raw.questions) ? raw.questions : []);
  if (!questions.length) return { ok: false, error: 'Sin preguntas' };

  const visibility = normalizeVisibility(raw.visibility, 'private');
  const allowClone = normalizeAllowClone(raw.allowClone, false);
  const createdAt = coerceDate(raw.createdAt, new Date());
  const updatedAt = coerceDate(raw.updatedAt, createdAt);

  const playsCount = Math.max(0, parseInt(raw.playsCount, 10) || 0);
  const playersCount = Math.max(0, parseInt(raw.playersCount, 10) || 0);

  const ownerToken = (raw.ownerToken || '').toString().trim();
  const ownerId = (raw.ownerId || raw.owner_id || raw.owner || GLOBAL_OWNER_ID).toString();
  const ownerEmail = (raw.ownerEmail || GLOBAL_OWNER_EMAIL).toString();
  const ownerNickname = (raw.ownerNickname || '').toString();
  const sourceQuizId = raw.sourceQuizId !== undefined && raw.sourceQuizId !== null
    ? String(raw.sourceQuizId)
    : '';
  const sourceQuizName = (raw.sourceQuizName || '').toString();
  const sourceOwnerNickname = (raw.sourceOwnerNickname || '').toString();

  const quiz = {
    id,
    name,
    tags,
    questions: normalizeQuestions(questions || []),
    playsCount,
    playersCount,
    visibility,
    allowClone,
    ownerId,
    ownerEmail,
    createdAt,
    updatedAt
  };

  if (ownerNickname) quiz.ownerNickname = ownerNickname;
  if (ownerToken) quiz.ownerToken = ownerToken;
  if (sourceQuizId) quiz.sourceQuizId = sourceQuizId;
  if (sourceQuizName) quiz.sourceQuizName = sourceQuizName;
  if (sourceOwnerNickname) quiz.sourceOwnerNickname = sourceOwnerNickname;
  return { ok: true, quiz };
}

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

async function buildQuizDoc({ name, tags, questions, visibility, allowClone, user, ownerToken, language = '', license = '', description = '', importSource = null }) {
  const collection = await getGamesCollection();
  const newId = await nextGameId(collection);
  const ownerTokenClean = (ownerToken || '').toString().trim();
  const quiz = {
    id: newId,
    name: cleanImportedText(name || ''),
    tags,
    language: cleanMetaText(language, 40),
    license: cleanMetaText(license, 120),
    description: cleanMetaText(description, 1000),
    questions: normalizeQuestions(questions || []),
    visibility,
    allowClone,
    playsCount: 0,
    playersCount: 0,
    ownerId: user && user.id ? user.id : GLOBAL_OWNER_ID,
    ownerEmail: user && user.email ? user.email : GLOBAL_OWNER_EMAIL,
    ownerNickname: user && user.nickname ? user.nickname : '',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  if (!ownerTokenClean) {
    delete quiz.ownerToken;
  } else {
    quiz.ownerToken = ownerTokenClean;
  }
  if (importSource) Object.assign(quiz, importSource);
  await collection.insertOne(quiz);
  return { quiz, collection };
}

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
