const crypto = require('crypto');
const { getGamesCollection } = require('../data/repositories');
const {
  cleanImportedText,
  cleanMetaText,
  normalizeQuestions,
  normalizeTags,
  normalizeVisibility,
  currentVisibility,
  normalizeAllowClone,
  coerceDate,
  normalizeQuizId
} = require('./quizNormalize');

const GLOBAL_OWNER_ID = 'global-anon-owner';
const GLOBAL_OWNER_EMAIL = 'anon@local';
const EDUHOOT_RESOURCES_TOKEN = process.env.EDUHOOT_RESOURCES_TOKEN || '';

// Accés, permisos i persistència de quizzes (cerca per id, permisos de
// gestió/ús/clonatge, filtre per visibilitat, estadístiques, creació i
// sanejament en importar). Mou el contingut de server.js, sense canviar
// comportament. Factoria perquè findGameById cau en els quizzes efímers.
module.exports = function createQuizzesService({ getEphemeralQuiz }) {
  function ownerTokenFromReq(req) {
    const hdr = req.headers['x-owner-token'];
    if (hdr && typeof hdr === 'string') return hdr.trim();
    return '';
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

  return {
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
  };
};
