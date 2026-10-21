const express = require('express');
const { getGamesCollection, getUsersCollection, getRatingsCollection } = require('../data/repositories');

// Pieza 1/2 del Pas 4 (routes/quizzes.js): rutas de solo lectura.
// Las rutas que mutan datos (PATCH/PUT/DELETE, rating, clone, claim,
// solo-run, upload-csv, import/kahoot, local) llegan en una pieza aparte.
module.exports = function createQuizzesRouter({
  findGameById,
  canUseQuiz,
  isMultiplayerFreeTypeQuestion,
  cleanImportedText,
  normalizeTags,
  normalizeQuestions,
  currentVisibility,
  normalizeAllowClone,
  ownerTokenFromReq,
  parseTagQuery,
  matchesTags,
  selectQuizzesForUser,
  getEphemeralQuiz,
  isEphemeralExpired,
  toFiniteNumber,
  requireResourcesIntegration,
  getTopSoloScores,
  quizToCsv,
  quizToMoodleXml
}) {
  const router = express.Router();

  router.get('/api/quizzes/:id', async (req, res) => {
    const quizIdParam = req.params.id;
    try {
      const quiz = await findGameById(quizIdParam);
      if (!quiz) {
        return res.status(404).json({ error: 'Quiz no encontrado.' });
      }
      if (!canUseQuiz(quiz, req.user)) {
        return res.status(403).json({ error: 'No autorizado para ver este quiz.' });
      }

      const mode = (req.query.mode || '').toString();
      const allQuestions = Array.isArray(quiz.questions) ? quiz.questions : [];
      const questions = mode === 'multiplayer'
        ? allQuestions.filter((q) => !isMultiplayerFreeTypeQuestion(q))
        : allQuestions;

      return res.json({
        id: quiz.id,
        name: cleanImportedText(quiz.name || ''),
        tags: normalizeTags(quiz.tags || []),
        playsCount: quiz.playsCount || 0,
        playersCount: quiz.playersCount || 0,
        questions: normalizeQuestions(questions),
        visibility: currentVisibility(quiz),
        allowClone: normalizeAllowClone(quiz.allowClone),
        ownerId: quiz.ownerId,
        ownerEmail: quiz.ownerEmail || '',
        sourceQuizName: quiz.sourceQuizName || '',
        sourceOwnerNickname: quiz.sourceOwnerNickname || '',
        sourceQuizId: quiz.sourceQuizId
      });
    } catch (err) {
      console.error('get-quiz error', err);
      return res.status(500).json({ error: 'No se pudo obtener el quiz.' });
    }
  });

  // Download quiz as CSV
  router.get('/api/quizzes/:id/csv', async (req, res) => {
    const quizIdParam = req.params.id;
    try {
      const quiz = await findGameById(quizIdParam);
      if (!quiz) {
        return res.status(404).json({ error: 'Quiz no encontrado.' });
      }
      if (!canUseQuiz(quiz, req.user)) {
        return res.status(403).json({ error: 'No autorizado para descargar este quiz.' });
      }
      const csv = quizToCsv(quiz);
      const fileName = `${(quiz.name || 'quiz').replace(/[^a-z0-9-_]+/gi, '_')}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(csv);
    } catch (err) {
      console.error('get-quiz-csv error', err);
      return res.status(500).json({ error: 'No se pudo generar el CSV.' });
    }
  });

  router.get('/api/quizzes/:id/moodle-xml', async (req, res) => {
    const quizIdParam = req.params.id;
    try {
      const quiz = await findGameById(quizIdParam);
      if (!quiz) {
        return res.status(404).json({ error: 'Quiz no encontrado.' });
      }
      if (!canUseQuiz(quiz, req.user)) {
        return res.status(403).json({ error: 'No autorizado para descargar este quiz.' });
      }
      const xml = quizToMoodleXml(quiz);
      const fileName = `${(quiz.name || 'quiz').replace(/[^a-z0-9-_]+/gi, '_')}.xml`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(xml);
    } catch (err) {
      console.error('get-quiz-moodle-xml error', err);
      return res.status(500).json({ error: 'No se pudo generar el XML de Moodle.' });
    }
  });

  router.get('/api/quizzes', async (req, res) => {
    try {
      const ownerToken = ownerTokenFromReq(req);
      if (ownerToken) {
        req.user = { ...(req.user || {}), ownerToken };
      }
      const normalized = parseTagQuery(req.query);
      const mineOnly = req.query.mine === '1';
      const tagMode = req.query.tagMode === 'any' ? 'any' : 'all';
      const matchesTagFilter = (quiz) => matchesTags(quiz, normalized, tagMode);
      const collection = await getGamesCollection();
      let quizzesRaw = await collection.find({}).project({ questions: 0 }).toArray();
      if (normalized.length) {
        quizzesRaw = quizzesRaw.filter(matchesTagFilter);
      }
      if (mineOnly) {
        if (!req.user) {
          quizzesRaw = [];
        } else {
          quizzesRaw = quizzesRaw.filter((q) => {
            if (q.ownerId && req.user.id && q.ownerId.toString() === req.user.id.toString()) return true;
            if (req.user.ownerToken && q.ownerToken && q.ownerToken === req.user.ownerToken) return true;
            return false;
          });
        }
      }
      const quizzes = selectQuizzesForUser(quizzesRaw, req.user).map((quiz) => ({
        id: quiz.id,
        name: cleanImportedText(quiz.name || ''),
        tags: quiz.tags || [],
        playsCount: quiz.playsCount || 0,
        playersCount: quiz.playersCount || 0,
        visibility: currentVisibility(quiz),
        allowClone: normalizeAllowClone(quiz.allowClone),
        ownerId: quiz.ownerId,
        ownerEmail: quiz.ownerEmail || '',
        ownerNickname: quiz.ownerNickname || '',
        sourceQuizName: quiz.sourceQuizName || '',
        sourceOwnerNickname: quiz.sourceOwnerNickname || '',
        sourceQuizId: quiz.sourceQuizId,
        createdAt: quiz.createdAt || quiz.updatedAt || new Date(0)
      }));
      // Añadir quizzes efímeros solicitados
      const localIdsParam = req.query.localIds;
      const localIds = Array.isArray(localIdsParam)
        ? localIdsParam
        : (typeof localIdsParam === 'string' && localIdsParam.length ? localIdsParam.split(',') : []);
      const validLocal = [];
      for (const id of localIds) {
        const q = await getEphemeralQuiz(id);
        if (q && !isEphemeralExpired(q) && matchesTagFilter(q)) {
          validLocal.push({
            id: q.id,
            name: cleanImportedText(q.name || ''),
            tags: normalizeTags(q.tags || []),
            playsCount: 0,
            playersCount: 0,
            visibility: currentVisibility(q),
            allowClone: normalizeAllowClone(q.allowClone),
            ownerId: null,
            ownerEmail: '',
            ownerNickname: '',
            sourceQuizId: q.sourceQuizId,
            createdAt: q.createdAt || q.updatedAt || new Date()
          });
        }
      }
      return res.json(quizzes.concat(validLocal));
    } catch (err) {
      console.error('list-quizzes error', err);
      return res.status(500).json({ error: 'No se pudo obtener la lista.' });
    }
  });

  // Listar solo quizzes públicos (para modo individual)
  router.get('/api/public-quizzes', async (req, res) => {
    try {
      const mode = (req.query.mode || '').toString();
      const multiplayerMode = mode === 'multiplayer';
      const tags = parseTagQuery(req.query);
      const tagMode = req.query.tagMode === 'all' ? 'all' : 'any';
      const collection = await getGamesCollection();
      const quizzes = await collection
        .find({ $or: [{ visibility: 'public' }, { visibility: { $exists: false } }] })
        .project({
          id: 1,
          name: 1,
          tags: 1,
          playsCount: 1,
          playersCount: 1,
          ownerNickname: 1,
          createdAt: 1,
          updatedAt: 1,
          questions: 1,
          language: 1,
          license: 1,
          description: 1
        })
        .toArray();

      const ratingCollection = await getRatingsCollection();
      const quizIds = (quizzes || []).map((quiz) => quiz.id).filter((id) => id !== undefined && id !== null);
      const ratingQueryIds = new Set();
      quizIds.forEach((id) => {
        ratingQueryIds.add(String(id));
        if (typeof id === 'number' && Number.isFinite(id)) {
          ratingQueryIds.add(id);
        }
      });
      const ratingsList = ratingQueryIds.size
        ? await ratingCollection.find({ quizId: { $in: Array.from(ratingQueryIds) } }).project({ quizId: 1, avg: 1, count: 1 }).toArray()
        : [];
      const ratingsById = new Map();
      ratingsList.forEach((r) => {
        if (!r || r.quizId === undefined || r.quizId === null) return;
        ratingsById.set(String(r.quizId), { avg: toFiniteNumber(r.avg, 0), count: toFiniteNumber(r.count, 0) });
      });

      let mapped = (quizzes || [])
        .filter((quiz) => matchesTags(quiz, tags, tagMode))
        .map((quiz) => {
          const allQuestions = Array.isArray(quiz.questions) ? quiz.questions : [];
          const questions = multiplayerMode
            ? allQuestions.filter((q) => !isMultiplayerFreeTypeQuestion(q))
            : allQuestions;

          const mediaQuestions = questions.filter((q) => q && (q.image || q.video));
          const mediaQuestion = mediaQuestions.length ? mediaQuestions[0] : null;
          const rating = ratingsById.get(String(quiz.id)) || { avg: 0, count: 0 };
          return {
            id: quiz.id,
            name: cleanImportedText(quiz.name || ''),
            tags: quiz.tags || [],
            playsCount: quiz.playsCount || 0,
            playersCount: quiz.playersCount || 0,
            ownerNickname: quiz.ownerNickname || '',
            language: quiz.language || '',
            license: quiz.license || '',
            description: quiz.description || '',
            createdAt: quiz.createdAt || quiz.updatedAt || new Date(0),
            questionsCount: questions.length,
            coverImage: mediaQuestion ? mediaQuestion.image : '',
            coverVideo: mediaQuestion ? mediaQuestion.video : '',
            ratingAvg: rating.avg,
            ratingCount: rating.count
          };
        });

      if (multiplayerMode) {
        mapped = mapped.filter((q) => (q.questionsCount || 0) > 0);
      }
      return res.json(mapped);
    } catch (err) {
      console.error('list-public-quizzes error', err);
      return res.status(500).json({ error: 'No se pudo obtener la lista.' });
    }
  });

  // Catálogo interno para Recursos: público para cualquiera y privado solo para
  // el docente Authentik propietario identificado por X-Teacher-Sub.
  router.get('/api/integrations/recursos/quizzes', async (req, res) => {
    if (!requireResourcesIntegration(req, res)) return;
    try {
      const teacherSub = (req.headers['x-teacher-sub'] || '').toString().trim();
      const collection = await getGamesCollection();
      const visibilityQuery = [{ visibility: 'public' }, { visibility: { $exists: false } }];
      if (teacherSub) {
        const users = await getUsersCollection();
        const teacher = await users.findOne({ authentikId: teacherSub }, { projection: { _id: 1 } });
        if (teacher) {
          visibilityQuery.push({ visibility: { $in: ['private', 'unlisted'] }, ownerId: teacher._id.toString() });
        }
      }
      const quizzes = await collection.find({ $or: visibilityQuery }).project({
        id: 1, name: 1, tags: 1, language: 1, license: 1, description: 1,
        visibility: 1, ownerNickname: 1, ownerId: 1, createdAt: 1, updatedAt: 1, questions: 1
      }).toArray();
      return res.json(quizzes.map((quiz) => ({
        id: quiz.id,
        name: cleanImportedText(quiz.name || ''),
        tags: normalizeTags(quiz.tags || []),
        language: quiz.language || '',
        license: quiz.license || '',
        description: quiz.description || '',
        visibility: currentVisibility(quiz),
        ownerNickname: quiz.ownerNickname || '',
        ownerId: quiz.ownerId || '',
        createdAt: quiz.createdAt || quiz.updatedAt || new Date(0),
        updatedAt: quiz.updatedAt || quiz.createdAt || new Date(0),
        questions: Array.isArray(quiz.questions) ? quiz.questions : []
      })));
    } catch (err) {
      console.error('recursos-quizzes error', err);
      return res.status(500).json({ error: 'No se pudo obtener el catálogo para Recursos.' });
    }
  });

  // Ranking global para modo individual
  router.get('/api/quizzes/:id/solo-ranking', async (req, res) => {
    const quizIdParam = req.params.id;
    try {
      const quiz = await findGameById(quizIdParam);
      if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado.' });
      if (currentVisibility(quiz) !== 'public') {
        return res.status(403).json({ error: 'Solo disponible para quizzes públicos.' });
      }
      const quizKey = quiz.id !== undefined && quiz.id !== null ? quiz.id.toString() : quizIdParam.toString();
      const top = await getTopSoloScores(quizKey, 10);
      return res.json({ quizId: quiz.id, top });
    } catch (err) {
      console.error('solo-ranking error', err);
      return res.status(500).json({ error: 'No se pudo obtener el ranking.' });
    }
  });

  router.get('/api/tags', async (req, res) => {
    try {
      const ownerToken = ownerTokenFromReq(req);
      if (ownerToken) {
        req.user = { ...(req.user || {}), ownerToken };
      }
      const collection = await getGamesCollection();
      const quizzesRaw = await collection
        .find({}, { projection: { tags: 1, visibility: 1, ownerId: 1, allowClone: 1 } })
        .toArray();
      const quizzes = selectQuizzesForUser(quizzesRaw, req.user);
      const set = new Set();
      quizzes.forEach((quiz) => {
        const normalized = normalizeTags(quiz.tags || []);
        normalized.forEach((t) => set.add(t));
      });
      return res.json({ tags: Array.from(set).sort() });
    } catch (err) {
      console.error('list-tags error', err);
      return res.status(500).json({ error: 'No se pudieron obtener etiquetas.' });
    }
  });

  return router;
};
