const crypto = require('crypto');

// Factoria del subsistema de quizzes efímers ("local-*"): es creen sense
// compte (p. ex. invitats) i caduquen als 24h. Mou el contingut de
// server.js, sense canviar comportament.
module.exports = function createEphemeralQuizzesService({
  getEphemeralCollection,
  coerceDate,
  cleanImportedText,
  normalizeQuestions,
  normalizeTags,
  normalizeVisibility,
  normalizeAllowClone
}) {
  const ephemeralQuizzes = new Map();

  function isEphemeralExpired(quiz) {
    if (!quiz || !quiz.expires) return false;
    const exp = coerceDate(quiz.expires);
    if (!exp) return false;
    return exp.getTime() < Date.now();
  }

  function normalizeEphemeralQuiz(raw) {
    if (!raw) return null;
    return {
      ...raw,
      createdAt: coerceDate(raw.createdAt, new Date()),
      updatedAt: coerceDate(raw.updatedAt, new Date()),
      expires: coerceDate(raw.expires, null)
    };
  }

  async function persistEphemeralQuiz(quiz) {
    if (!quiz || !quiz.id) return;
    ephemeralQuizzes.set(quiz.id, quiz);
    try {
      const collection = await getEphemeralCollection();
      await collection.replaceOne({ id: quiz.id }, quiz, { upsert: true });
    } catch (err) {
      console.error('persistEphemeralQuiz error', err);
    }
  }

  async function deleteEphemeralQuiz(id) {
    if (!id) return;
    ephemeralQuizzes.delete(id);
    try {
      const collection = await getEphemeralCollection();
      await collection.deleteOne({ id });
    } catch (err) {
      console.error('deleteEphemeralQuiz error', err);
    }
  }

  async function saveEphemeralQuiz(quiz) {
    const id = `local-${crypto.randomBytes(6).toString('hex')}`;
    const visibility = normalizeVisibility(quiz.visibility, 'public');
    const allowClone = normalizeAllowClone(quiz.allowClone, false);
    // Si se usa para invitados, caduca en 24h
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const ownerToken = (quiz.ownerToken || '').toString().trim();
    const sanitized = {
      id,
      name: cleanImportedText(quiz.name || 'Quiz local'),
      questions: normalizeQuestions(quiz.questions || []),
      tags: normalizeTags(quiz.tags || []),
      playsCount: 0,
      playersCount: 0,
      visibility,
      allowClone,
      sourceQuizId: quiz.sourceQuizId,
      createdAt: new Date(),
      updatedAt: new Date(),
      expires
    };
    if (ownerToken) {
      sanitized.ownerToken = ownerToken;
    }
    await persistEphemeralQuiz(sanitized);
    return sanitized;
  }

  async function getEphemeralQuiz(id) {
    if (!id) return null;
    const cached = ephemeralQuizzes.get(id);
    if (cached) {
      if (isEphemeralExpired(cached)) {
        await deleteEphemeralQuiz(id);
        return null;
      }
      return cached;
    }
    try {
      const collection = await getEphemeralCollection();
      const doc = await collection.findOne({ id });
      if (!doc) return null;
      const normalized = normalizeEphemeralQuiz(doc);
      if (!normalized || isEphemeralExpired(normalized)) {
        await deleteEphemeralQuiz(id);
        return null;
      }
      ephemeralQuizzes.set(id, normalized);
      return normalized;
    } catch (err) {
      console.error('getEphemeralQuiz error', err);
      return null;
    }
  }

  function isLocalQuizId(id) {
    return typeof id === 'string' && id.startsWith('local-');
  }

  return {
    isEphemeralExpired,
    normalizeEphemeralQuiz,
    persistEphemeralQuiz,
    deleteEphemeralQuiz,
    saveEphemeralQuiz,
    getEphemeralQuiz,
    isLocalQuizId
  };
};
