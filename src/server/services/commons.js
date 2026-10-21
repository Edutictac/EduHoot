const crypto = require('crypto');
const http = require('http');
const https = require('https');

const EDUTICTAC_ID_API_URL = (process.env.EDUTICTAC_ID_API_URL || '').replace(/\/+$/, '');
const EDUTICTAC_ID_APP_TOKEN = process.env.EDUTICTAC_ID_APP_TOKEN || '';
const EDUTICTAC_ID_AUTH_REQUIRED = /^(1|true|yes)$/i.test(process.env.EDUTICTAC_ID_AUTH_REQUIRED || '');
const STUDENT_JOIN_TOKEN_TTL_MS = 10 * 60 * 1000;
const STUDENT_ACTIVITY_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

const studentJoinTokens = new Map();

function isStudentIdentityEnabled() {
  return !!EDUTICTAC_ID_API_URL;
}

function postJson(url, payload, timeoutMs = 5000, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err);
      return;
    }
    const body = JSON.stringify(payload || {});
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'POST',
      timeout: timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        ...extraHeaders
      }
    }, (resp) => {
      const chunks = [];
      resp.on('data', (chunk) => chunks.push(chunk));
      resp.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (err) {}
        resolve({ statusCode: resp.statusCode || 0, data, text });
      });
    });
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function authenticateStudentIdentity(publicCode, pin) {
  if (!isStudentIdentityEnabled()) {
    throw new Error('student identity service not configured');
  }
  const result = await postJson(`${EDUTICTAC_ID_API_URL}/api/auth/student`, {
    public_code: publicCode,
    pin
  });
  if (result.statusCode < 200 || result.statusCode >= 300 || !result.data || !result.data.identity) {
    const err = new Error('invalid student credentials');
    err.statusCode = result.statusCode;
    throw err;
  }
  return result.data.identity;
}

async function consumeCommonsLaunchToken(token) {
  if (!EDUTICTAC_ID_API_URL || !EDUTICTAC_ID_APP_TOKEN) {
    throw new Error('student identity service not configured');
  }
  const result = await postJson(
    `${EDUTICTAC_ID_API_URL}/api/apps/eduhoot/launch-tokens/consume`,
    { token },
    5000,
    { Authorization: `Bearer ${EDUTICTAC_ID_APP_TOKEN}` }
  );
  if (
    result.statusCode < 200 ||
    result.statusCode >= 300 ||
    !result.data ||
    !result.data.identity
  ) {
    const err = new Error('invalid launch token');
    err.statusCode = result.statusCode;
    throw err;
  }
  return result.data;
}

async function reportCommonsScore(identityId, activityId, score, metadata = {}) {
  if (!EDUTICTAC_ID_API_URL || !EDUTICTAC_ID_APP_TOKEN || !identityId || !activityId) return;
  const result = await postJson(
    `${EDUTICTAC_ID_API_URL}/api/apps/eduhoot/scores`,
    {
      identity_id: identityId,
      activity_id: activityId,
      score: Math.max(0, Math.round(Number(score) || 0)),
      metadata
    },
    5000,
    { Authorization: `Bearer ${EDUTICTAC_ID_APP_TOKEN}` }
  );
  if (result.statusCode < 200 || result.statusCode >= 300) {
    console.error('[commons-score] failed', result.statusCode, result.text || result.data);
  }
}

async function reportCommonsScores(game, playersInGame) {
  if (!EDUTICTAC_ID_API_URL || !EDUTICTAC_ID_APP_TOKEN || !game || !game.gameData) return;
  const activityId = game.gameData.gameid ? String(game.gameData.gameid) : '';
  if (!activityId) return;
  const totalQuestions = Number(game.gameData.totalQuestions) || 0;
  const quizName = game.gameData.quizName || '';
  const reports = (Array.isArray(playersInGame) ? playersInGame : [])
    .filter((player) => player && player.gameData && player.gameData.identity && player.gameData.identity.id)
    .map((player) => {
      const correctCount = Number(player.gameData.correctCount) || 0;
      const wrongCount = Number(player.gameData.wrongCount) || 0;
      const rawScore = Number(player.gameData.score) || 0;
      return reportCommonsScore(
        player.gameData.identity.id,
        activityId,
        rawScore,
        {
          pin: String(game.pin || ''),
          quiz_name: quizName,
          correct: correctCount,
          wrong: wrongCount,
          total_questions: totalQuestions
        }
      ).catch((err) => {
        console.error('[commons-score] error', err);
      });
    });
  await Promise.all(reports);
}

// Factoria: createStudentJoinToken/consumeStudentJoinToken necessiten formatar
// el public_code amb normalizePlayerName, que es queda en server.js perquè
// també l'usa directament el handler de socket player-join — s'injecta ací en
// compte de moure-la, igual que 'players' en services/sessionReport.js.
module.exports = function createCommonsService({ normalizePlayerName }) {
  function cleanupStudentJoinTokens() {
    const now = Date.now();
    for (const [token, entry] of studentJoinTokens.entries()) {
      if (!entry || entry.expiresAt <= now) studentJoinTokens.delete(token);
    }
  }

  function createStudentJoinToken(identity, ttlMs = STUDENT_JOIN_TOKEN_TTL_MS) {
    cleanupStudentJoinTokens();
    const token = crypto.randomBytes(24).toString('hex');
    const publicCode = normalizePlayerName(identity && identity.public_code);
    studentJoinTokens.set(token, {
      identity: {
        id: identity && identity.id ? String(identity.id) : '',
        public_code: publicCode,
        avatar_icon: identity && identity.avatar_icon ? String(identity.avatar_icon) : '',
        assignment_id: identity && identity.assignment_id ? String(identity.assignment_id) : '',
        activity_id: identity && identity.activity_id ? String(identity.activity_id) : ''
      },
      expiresAt: Date.now() + ttlMs
    });
    return { token, publicCode };
  }

  function consumeStudentJoinToken(token) {
    cleanupStudentJoinTokens();
    const entry = token ? studentJoinTokens.get(String(token)) : null;
    if (!entry) return null;
    studentJoinTokens.delete(String(token));
    return entry.identity;
  }

  return {
    isStudentIdentityEnabled,
    createStudentJoinToken,
    consumeStudentJoinToken,
    authenticateStudentIdentity,
    consumeCommonsLaunchToken,
    reportCommonsScore,
    reportCommonsScores,
    EDUTICTAC_ID_AUTH_REQUIRED,
    EDUTICTAC_ID_APP_TOKEN,
    STUDENT_ACTIVITY_TOKEN_TTL_MS
  };
};
