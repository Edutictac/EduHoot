const express = require('express');
const multer = require('multer');
const path = require('path');
const { parseCsv, toQuestion } = require('../importCsv');
const {
  getGamesCollection,
  getUsersCollection,
  getRatingsCollection,
  getRatingVotesCollection
} = require('../data/repositories');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const uploadRate = new Map(); // clave: ip -> { count, windowStart }

function uploadRateLimiter(req, res, next) {
  const windowMs = 10 * 60 * 1000; // 10 minutos
  const max = 10; // máximo subidas por IP en la ventana
  const now = Date.now();
  const key = req.ip || req.connection.remoteAddress || 'unknown';
  const entry = uploadRate.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  uploadRate.set(key, entry);
  if (entry.count > max) {
    return res.status(429).json({ error: 'Límite de subidas alcanzado. Intenta más tarde.' });
  }
  // limpieza ocasional
  if (uploadRate.size > 1000) {
    for (const [k, v] of uploadRate.entries()) {
      if (now - v.windowStart > windowMs) uploadRate.delete(k);
    }
  }
  return next();
}

function logEvent(tag, payload) {
  console.log(`[${tag}]`, payload);
}

module.exports = function createQuizzesRouter({
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
}) {
  const router = express.Router();
  let catalogueImportRunning = false;

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

  router.post('/api/upload-csv', uploadRateLimiter, upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Selecciona un archivo CSV para importar.' });
    }

    const quizName =
      (req.body.name && req.body.name.trim()) ||
      path.basename(req.file.originalname, path.extname(req.file.originalname));

    try {
      logEvent('upload-csv:start', {
        filename: req.file.originalname,
        size: req.file.size,
        quizName
      });

      const content = req.file.buffer.toString('utf8');
      const rows = parseCsv(content);
      if (rows.length === 0) {
        logEvent('upload-csv:empty', { filename: req.file.originalname });
        return res.status(400).json({ error: 'No se encontraron preguntas en el CSV.' });
      }

      const questions = rows.map(toQuestion);
      const tags = normalizeTags(req.body.tags ? [].concat(req.body.tags) : []);
      const ownerToken = (req.body.ownerToken || req.headers['x-owner-token'] || '').toString().trim();
      const language = cleanMetaText(req.body.language, 40);
      const license = cleanMetaText(req.body.license, 120);
      const description = cleanMetaText(req.body.description, 1000);

      const visibility = normalizeVisibility(req.body.visibility, req.user ? 'private' : 'private');
      const allowClone = normalizeAllowClone(req.body.allowClone);

      if (!req.user) {
        if (visibility === 'public') {
          const collection = await getGamesCollection();
          const newId = await nextGameId(collection);
          const quiz = {
            id: newId,
            name: cleanImportedText(quizName),
            tags,
            language,
            license,
            description,
            questions: normalizeQuestions(questions),
            ownerToken,
            playsCount: 0,
            playersCount: 0,
            visibility,
            allowClone,
            ownerId: GLOBAL_OWNER_ID,
            ownerEmail: GLOBAL_OWNER_EMAIL,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await collection.insertOne(quiz);
          logEvent('upload-csv:public-anon', { filename: req.file.originalname, newId, count: questions.length });
          return res.json({ id: newId, name: quizName, count: questions.length, local: false });
        } else {
          const saved = await saveEphemeralQuiz({ name: quizName, tags, questions, visibility: 'private', allowClone, ownerToken });
          logEvent('upload-csv:local', { filename: req.file.originalname, id: saved.id, count: questions.length });
          return res.json({ id: saved.id, name: quizName, count: questions.length, local: true });
        }
      }

      const collection = await getGamesCollection();
      const newId = await nextGameId(collection);
      const quiz = {
        id: newId,
        name: cleanImportedText(quizName),
        tags,
        language,
        license,
        description,
        questions: normalizeQuestions(questions),
        playsCount: 0,
        playersCount: 0,
        visibility,
        allowClone,
        ownerId: req.user.id,
        ownerEmail: req.user.email,
        ownerNickname: req.user.nickname || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await collection.insertOne(quiz);
      logEvent('upload-csv:success', { filename: req.file.originalname, newId, count: questions.length });
      return res.json({ id: newId, name: quizName, count: questions.length, local: false });
    } catch (err) {
      console.error('upload-csv error', err);
      return res.status(500).json({ error: 'No se pudo importar el CSV.' });
    }
  });

  router.post('/api/import/kahoot', async (req, res) => {
    const rawUrl = (req.body.url || '').trim();
    const rawId = (req.body.id || '').trim();
    const kahootId = extractKahootId(rawUrl) || extractKahootId(rawId);
    if (!kahootId) return res.status(400).json({ error: 'Falta URL o id de Kahoot.' });
    const visibility = normalizeVisibility(req.body.visibility || 'public');
    const allowClone = normalizeAllowClone(req.body.allowClone);
    const ownerToken = (req.body.ownerToken || req.headers['x-owner-token'] || '').toString().trim();
    try {
      const response = await fetch(`https://create.kahoot.it/rest/kahoots/${kahootId}/card/?includeKahoot=true`);
      if (!response.ok) {
        if (response.status === 404) return res.status(404).json({ error: 'Quiz de Kahoot no encontrado.' });
        return res.status(502).json({ error: `Kahoot respondió ${response.status}.` });
      }
      const data = await response.json();
      const k = data.kahoot || {};
      const name = cleanImportedText(k.title || 'Kahoot importado');
      const tags = normalizeTags(
        Array.isArray(k.tags) ? k.tags : (typeof k.tags === 'string' ? k.tags.split(',') : [])
      );
      const questions = mapKahootQuestions(k.questions || []);
      if (!questions.length) return res.status(400).json({ error: 'No se encontraron preguntas en el Kahoot.' });

      // Descargar imágenes de Kahoot al servidor local para evitar dependencia de su CDN
      await Promise.all(questions.map(async (q) => {
        if (q.image) q.image = await mirrorKahootImage(q.image);
      }));

      // Si no hay usuario y es privado, se guarda en memoria; si es público/unlisted se persiste con owner global
      if (!req.user && visibility === 'private') {
        const saved = await saveEphemeralQuiz({ name, tags, questions, visibility, allowClone, ownerToken, sourceQuizId: kahootId });
        return res.json({ id: saved.id, name, count: questions.length, local: true });
      }

      const { quiz } = await buildQuizDoc({
        name,
        tags,
        questions,
        visibility,
        allowClone,
        user: req.user,
        ownerToken,
        language: req.body.language || '',
        license: req.body.license || '',
        description: req.body.description || ''
      });
      return res.json({ id: quiz.id, name, count: questions.length, local: false });
    } catch (err) {
      console.error('import-kahoot error', err);
      return res.status(500).json({ error: 'No se pudo importar desde Kahoot.' });
    }
  });

  // Rename quiz
  router.patch('/api/quizzes/:id', async (req, res) => {
    const quizIdParam = req.params.id;
    const newName = (req.body.name || '').trim();
    if (!quizIdParam || !newName) {
      return res.status(400).json({ error: 'Faltan id o nombre.' });
    }
    const ownerToken = ownerTokenFromReq(req);
    if (ownerToken) req.user = { ...(req.user || {}), ownerToken };
    try {
      // Permitir renombrar quizzes locales sin sesión
      if (isLocalQuizId(quizIdParam)) {
        const q = await getEphemeralQuiz(quizIdParam);
        if (!q) return res.status(404).json({ error: 'Quiz no encontrado.' });
        const updated = { ...q, name: newName, updatedAt: new Date() };
        await persistEphemeralQuiz(updated);
        return res.json({ ok: true, id: q.id, name: newName, local: true });
      }
      if (!req.user) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const collection = await getGamesCollection();
      const quiz = await findGameById(quizIdParam);
      if (!quiz || typeof quiz.id === 'string') {
        return res.status(404).json({ error: 'Quiz no encontrado.' });
      }
      if (!canManageQuiz(quiz, req.user)) {
        return res.status(403).json({ error: 'No autorizado.' });
      }
      await collection.updateOne({ id: quiz.id }, { $set: { name: newName, updatedAt: new Date() } });
      return res.json({ ok: true, id: quiz.id, name: newName });
    } catch (err) {
      console.error('rename-quiz error', err);
      return res.status(500).json({ error: 'No se pudo renombrar.' });
    }
  });

  // Update quiz tags (without replacing full quiz)
  router.patch('/api/quizzes/:id/tags', async (req, res) => {
    const quizIdParam = req.params.id;
    const rawTags = req.body && req.body.tags !== undefined ? req.body.tags : [];
    const tags = normalizeTags(Array.isArray(rawTags) ? rawTags : String(rawTags || '').split(/[,;]+/));
    if (!quizIdParam) {
      return res.status(400).json({ error: 'Falta id.' });
    }
    if (!tags.length) {
      return res.status(400).json({ error: 'Añade al menos una etiqueta.' });
    }

    const ownerToken = ownerTokenFromReq(req);
    if (ownerToken) req.user = { ...(req.user || {}), ownerToken };
    try {
      // Permitir editar tags de quizzes locales sin sesión
      if (isLocalQuizId(quizIdParam)) {
        const q = await getEphemeralQuiz(quizIdParam);
        if (!q) return res.status(404).json({ error: 'Quiz no encontrado.' });
        const updated = { ...q, tags, updatedAt: new Date() };
        await persistEphemeralQuiz(updated);
        return res.json({ ok: true, id: quizIdParam, tags, local: true });
      }

      if (!req.user) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const collection = await getGamesCollection();
      const quiz = await findGameById(quizIdParam);
      if (!quiz || typeof quiz.id === 'string') {
        return res.status(404).json({ error: 'Quiz no encontrado.' });
      }
      if (!canManageQuiz(quiz, req.user)) {
        return res.status(403).json({ error: 'No autorizado.' });
      }
      await collection.updateOne({ id: quiz.id }, { $set: { tags, updatedAt: new Date() } });
      return res.json({ ok: true, id: quiz.id, tags });
    } catch (err) {
      console.error('update-quiz-tags error', err);
      return res.status(500).json({ error: 'No se pudieron actualizar las etiquetas.' });
    }
  });

  // Replace quiz content
  router.put('/api/quizzes/:id', async (req, res) => {
    const quizIdParam = req.params.id;
    const name = (req.body.name || '').trim();
    const questions = normalizeQuestions(req.body.questions || []);
    const tags = normalizeTags(req.body.tags || []);
    const visibility = normalizeVisibility(req.body.visibility);
    const allowClone = normalizeAllowClone(req.body.allowClone);
    const ownerToken = ownerTokenFromReq(req);
    if (ownerToken) req.user = { ...(req.user || {}), ownerToken };
    if (!name) {
      return res.status(400).json({ error: 'Falta nombre.' });
    }
    if (!tags.length) {
      return res.status(400).json({ error: 'Añade al menos una etiqueta.' });
    }
    if (!questions.length) {
      return res.status(400).json({ error: 'Añade al menos una pregunta.' });
    }
    try {
      if (isLocalQuizId(quizIdParam)) {
        const q = await getEphemeralQuiz(quizIdParam);
        if (!q) return res.status(404).json({ error: 'Quiz no encontrado.' });
        const updated = {
          ...q,
          name,
          tags,
          questions,
          visibility,
          allowClone,
          updatedAt: new Date()
        };
        await persistEphemeralQuiz(updated);
        return res.json({ ok: true, id: quizIdParam, name, local: true });
      }
      if (!req.user) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const collection = await getGamesCollection();
      const quiz = await findGameById(quizIdParam);
      if (!quiz || typeof quiz.id === 'string') {
        return res.status(404).json({ error: 'Quiz no encontrado.' });
      }
      if (!canManageQuiz(quiz, req.user)) {
        return res.status(403).json({ error: 'No autorizado.' });
      }
      await collection.updateOne(
        { id: quiz.id },
        {
          $set: {
            name,
            questions,
            tags,
            visibility,
            allowClone,
            updatedAt: new Date()
          }
        }
      );
      return res.json({ ok: true, id: quiz.id, name });
    } catch (err) {
      console.error('update-quiz error', err);
      return res.status(500).json({ error: 'No se pudo actualizar.' });
    }
  });

  // Delete quiz
  router.delete('/api/quizzes/:id', async (req, res) => {
    const quizIdParam = req.params.id;
    const ownerToken = ownerTokenFromReq(req);
    if (ownerToken) req.user = { ...(req.user || {}), ownerToken };
    try {
      if (isLocalQuizId(quizIdParam)) {
        const exists = await getEphemeralQuiz(quizIdParam);
        if (!exists) return res.status(404).json({ error: 'Quiz no encontrado.' });
        await deleteEphemeralQuiz(quizIdParam);
        return res.json({ ok: true, id: quizIdParam, local: true });
      }
      if (!req.user) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const collection = await getGamesCollection();
      const quiz = await findGameById(quizIdParam);
      if (!quiz || typeof quiz.id === 'string') {
        return res.status(404).json({ error: 'Quiz no encontrado.' });
      }
      if (!canManageQuiz(quiz, req.user)) {
        return res.status(403).json({ error: 'No autorizado.' });
      }
      await collection.deleteOne({ id: quiz.id });
      return res.json({ ok: true, id: quiz.id });
    } catch (err) {
      console.error('delete-quiz error', err);
      return res.status(500).json({ error: 'No se pudo eliminar.' });
    }
  });

  // Update visibility and clone permission
  router.patch('/api/quizzes/:id/sharing', async (req, res) => {
    const quizIdParam = req.params.id;
    if (!quizIdParam) {
      return res.status(400).json({ error: 'Falta id.' });
    }
    const visibility = normalizeVisibility(req.body.visibility);
    const allowClone = normalizeAllowClone(req.body.allowClone);
    const ownerToken = ownerTokenFromReq(req);
    if (ownerToken) req.user = { ...(req.user || {}), ownerToken };
    try {
      if (isLocalQuizId(quizIdParam)) {
        const q = await getEphemeralQuiz(quizIdParam);
        if (!q) return res.status(404).json({ error: 'Quiz no encontrado.' });
        // Permitir marcar como público: se mueve a la colección persistente
        if (visibility === 'public') {
          const collection = await getGamesCollection();
          const newId = await nextGameId(collection);
          const doc = {
            id: newId,
            name: cleanImportedText(q.name || ''),
            tags: normalizeTags(q.tags || []),
            questions: q.questions || [],
            visibility: 'public',
            allowClone,
            ownerToken: q.ownerToken || ownerToken || '',
            playsCount: 0,
            playersCount: 0,
            ownerId: GLOBAL_OWNER_ID,
            ownerEmail: GLOBAL_OWNER_EMAIL,
            ownerNickname: '',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await collection.insertOne(doc);
          await deleteEphemeralQuiz(quizIdParam);
          return res.json({ ok: true, id: newId, visibility: 'public', migrated: true });
        }
        const updated = { ...q, visibility, allowClone, ownerToken: q.ownerToken || ownerToken || '', updatedAt: new Date() };
        await persistEphemeralQuiz(updated);
        return res.json({ ok: true, id: quizIdParam, visibility, allowClone, local: true });
      }
      if (!req.user) {
        return res.status(401).json({ error: 'No autorizado' });
      }
      const collection = await getGamesCollection();
      const quiz = await findGameById(quizIdParam);
      if (!quiz || typeof quiz.id === 'string') {
        return res.status(404).json({ error: 'Quiz no encontrado.' });
      }
      if (!canManageQuiz(quiz, req.user)) {
        return res.status(403).json({ error: 'No autorizado.' });
      }
      await collection.updateOne(
        { id: quiz.id },
        { $set: { visibility, allowClone, updatedAt: new Date() } }
      );
      return res.json({ ok: true, visibility, allowClone });
    } catch (err) {
      console.error('update-sharing error', err);
      return res.status(500).json({ error: 'No se pudo actualizar permisos.' });
    }
  });

  router.post('/api/quizzes/:id/rating', async (req, res) => {
    const quizIdParam = req.params.id;
    const rating = parseInt(req.body && req.body.rating, 10);
    const deviceId = (req.body && req.body.deviceId ? req.body.deviceId : '').toString().trim();
    if (!quizIdParam) return res.status(400).json({ error: 'Falta id.' });
    if (!deviceId) return res.status(400).json({ error: 'Falta deviceId.' });
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Valor inválido.' });
    }
    try {
      const quiz = await findGameById(quizIdParam);
      if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado.' });
      if (currentVisibility(quiz) !== 'public') {
        return res.status(403).json({ error: 'No autorizado.' });
      }
      const ratings = await getRatingsCollection();
      const votes = await getRatingVotesCollection();
      const quizIdStr = String(quiz.id);
      const existing = await votes.findOne({ deviceId, quizId: { $in: [quiz.id, quizIdStr] } });

      if (existing) {
        if (existing.rating === rating) {
          const agg = await ratings.findOne({ quizId: { $in: [quiz.id, quizIdStr] } }) || { avg: rating, count: 1 };
          return res.json({ avg: toFiniteNumber(agg.avg, rating), count: toFiniteNumber(agg.count, 1) });
        }
        await votes.updateOne(
          { _id: existing._id },
          { $set: { quizId: quizIdStr, rating, updatedAt: new Date() } }
        );
      } else {
        await votes.insertOne({ quizId: quizIdStr, deviceId, rating, createdAt: new Date(), updatedAt: new Date() });
      }

      const agg = await votes.aggregate([
        { $match: { quizId: { $in: [quiz.id, quizIdStr] } } },
        { $group: { _id: null, sum: { $sum: '$rating' }, count: { $sum: 1 } } }
      ]).next();
      const sum = toFiniteNumber(agg && agg.sum, 0);
      const count = toFiniteNumber(agg && agg.count, 0);
      const avg = count ? Number((sum / count).toFixed(2)) : 0;
      await ratings.updateOne(
        { quizId: quizIdStr },
        { $set: { quizId: quizIdStr, sum, count, avg, updatedAt: new Date() } },
        { upsert: true }
      );
      return res.json({ avg, count });
    } catch (err) {
      console.error('rate-quiz error', err);
      return res.status(500).json({ error: 'No se pudo registrar la valoración.' });
    }
  });

  // Registrar partida individual y devolver top 10
  router.post('/api/quizzes/:id/solo-run', async (req, res) => {
    const quizIdParam = req.params.id;
    try {
      const quiz = await findGameById(quizIdParam);
      if (!quiz) return res.status(404).json({ error: 'Quiz no encontrado.' });
      if (currentVisibility(quiz) !== 'public') {
        return res.status(403).json({ error: 'Solo disponible para quizzes públicos.' });
      }
      const quizKey = quiz.id !== undefined && quiz.id !== null ? quiz.id.toString() : quizIdParam.toString();
      let studentIdentity = null;
      const studentJoinToken = (req.body.studentJoinToken || '').toString().trim();
      if (studentJoinToken) {
        studentIdentity = commons.consumeStudentJoinToken(studentJoinToken);
        if (!studentIdentity) {
          return res.status(401).json({ error: 'Sessió Commons no vàlida.' });
        }
      }
      const playerName = studentIdentity ? normalizeSoloName(studentIdentity.public_code) : normalizeSoloName(req.body.name);
      const rawScore = parseInt(req.body.score, 10);
      const rawTotal = parseInt(req.body.totalQuestions, 10);
      if (Number.isNaN(rawScore) || Number.isNaN(rawTotal)) {
        return res.status(400).json({ error: 'Datos inválidos.' });
      }
      const score = Math.max(0, Math.min(rawScore, 1000000));
      const totalQuestions = Math.max(0, Math.min(rawTotal, 500));
      await enqueueSoloScore({
        quizId: quizKey,
        quizName: quiz.name || '',
        playerName,
        score,
        totalQuestions,
        createdAt: new Date()
      });
      const top = await getTopSoloScores(quizKey, 10);
      const position = top.findIndex((r) => r.playerName === playerName && r.score === score);
      try{
        await incrementQuizStats(quiz.id, 1);
      }catch(e){
        console.error('solo-run stat increment failed', e);
      }
      if (studentIdentity && studentIdentity.id) {
        try {
          await commons.reportCommonsScore(
            studentIdentity.id,
            studentIdentity.activity_id || quizKey,
            score,
            {
              mode: 'solo',
              assignment_id: studentIdentity.assignment_id || '',
              quiz_name: quiz.name || '',
              total_questions: totalQuestions
            }
          );
        } catch (err) {
          console.error('[commons-score] solo error', err);
        }
      }
      return res.json({ ok: true, top, position });
    } catch (err) {
      console.error('solo-run error', err);
      return res.status(500).json({ error: 'No se pudo registrar la partida.' });
    }
  });

  // Clone quiz (when permitted)
  router.post('/api/quizzes/:id/clone', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Debes iniciar sesión para clonar.' });
    }
    const quizIdParam = req.params.id;
    try {
      const collection = await getGamesCollection();
      const original = await findGameById(quizIdParam);
      if (!original) {
        return res.status(404).json({ error: 'Quiz no encontrado.' });
      }
      if (!canCloneQuiz(original, req.user)) {
        return res.status(403).json({ error: 'No se puede clonar este quiz.' });
      }
      const newId = await nextGameId(collection);
      const cloned = {
        id: newId,
        name: `${original.name || 'Quiz'} (copia)`,
        questions: normalizeQuestions(original.questions || []),
        tags: normalizeTags(original.tags || []),
        playsCount: 0,
        playersCount: 0,
        visibility: 'private',
        allowClone: false,
        ownerId: req.user.id,
        ownerEmail: req.user.email,
        sourceQuizId: original.id,
        sourceQuizName: (original.name || '').toString(),
        sourceOwnerNickname: (original.ownerNickname || '').toString(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await collection.insertOne(cloned);
      return res.json({ ok: true, id: newId });
    } catch (err) {
      console.error('clone-quiz error', err);
      return res.status(500).json({ error: 'No se pudo clonar.' });
    }
  });

  router.post('/api/quizzes/:id/claim', async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Debes iniciar sesión para guardar este quiz en tu cuenta.' });
    }
    const quizIdParam = req.params.id;
    const ownerToken = ownerTokenFromReq(req);
    if (!ownerToken) {
      return res.status(403).json({ error: 'No se pudo verificar la propiedad local.' });
    }
    try {
      const collection = await getGamesCollection();
      if (isLocalQuizId(quizIdParam)) {
        const localQuiz = await getEphemeralQuiz(quizIdParam);
        if (!localQuiz) return res.status(404).json({ error: 'Quiz no encontrado.' });
        if (!localQuiz.ownerToken || localQuiz.ownerToken !== ownerToken) {
          return res.status(403).json({ error: 'No autorizado.' });
        }
        const newId = await nextGameId(collection);
        const doc = {
          id: newId,
          name: localQuiz.name || 'Quiz local',
          questions: normalizeQuestions(localQuiz.questions || []),
          tags: normalizeTags(localQuiz.tags || []),
          playsCount: localQuiz.playsCount || 0,
          playersCount: localQuiz.playersCount || 0,
          visibility: currentVisibility(localQuiz),
          allowClone: normalizeAllowClone(localQuiz.allowClone),
          ownerId: req.user.id,
          ownerEmail: req.user.email,
          ownerNickname: req.user.nickname || '',
          sourceQuizId: localQuiz.sourceQuizId,
          createdAt: localQuiz.createdAt || new Date(),
          updatedAt: new Date()
        };
        await collection.insertOne(doc);
        await deleteEphemeralQuiz(quizIdParam);
        return res.json({ ok: true, id: newId, previousId: quizIdParam, migrated: true });
      }

      const quiz = await findGameById(quizIdParam);
      if (!quiz || typeof quiz.id === 'string') {
        return res.status(404).json({ error: 'Quiz no encontrado.' });
      }
      if (!quiz.ownerToken || quiz.ownerToken !== ownerToken) {
        return res.status(403).json({ error: 'No autorizado.' });
      }
      await collection.updateOne(
        { id: quiz.id },
        {
          $set: {
            ownerId: req.user.id,
            ownerEmail: req.user.email,
            ownerNickname: req.user.nickname || '',
            updatedAt: new Date()
          },
          $unset: { ownerToken: '' }
        }
      );
      return res.json({ ok: true, id: quiz.id, claimed: true });
    } catch (err) {
      console.error('claim-quiz error', err);
      return res.status(500).json({ error: 'No se pudo guardar en tu cuenta.' });
    }
  });

  // Crear quiz en memoria (sin login)
  router.post('/api/quizzes/local', async (req, res) => {
    try {
      const name = (req.body.name || '').trim();
      const questions = normalizeQuestions(req.body.questions || []);
      const tags = normalizeTags(req.body.tags || []);
      const visibility = normalizeVisibility(req.body.visibility);
      const allowClone = normalizeAllowClone(req.body.allowClone);
      if (!name) return res.status(400).json({ error: 'Falta nombre.' });
      if (!tags.length) return res.status(400).json({ error: 'Añade al menos una etiqueta.' });
      if (!questions.length) return res.status(400).json({ error: 'Añade preguntas.' });
      const ownerToken = (req.body.ownerToken || req.headers['x-owner-token'] || '').toString().trim();
      if (req.user) {
        const { quiz } = await buildQuizDoc({ name, tags, questions, visibility, allowClone, user: req.user, ownerToken });
        return res.json({ ok: true, id: quiz.id, count: questions.length });
      }
      if (visibility === 'private') {
        const saved = await saveEphemeralQuiz({ name, questions, tags, visibility, allowClone, ownerToken });
        return res.json({ ok: true, id: saved.id, count: questions.length });
      }
      const collection = await getGamesCollection();
      const newId = await nextGameId(collection);
      const quiz = {
        id: newId,
        name,
        questions,
        tags,
        playsCount: 0,
        playersCount: 0,
        visibility,
        allowClone,
        ownerId: GLOBAL_OWNER_ID,
        ownerEmail: GLOBAL_OWNER_EMAIL,
        ownerNickname: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      if (ownerToken) quiz.ownerToken = ownerToken;
      await collection.insertOne(quiz);
      return res.json({ ok: true, id: newId, count: questions.length });
    } catch (err) {
      console.error('local-quiz error', err);
      return res.status(500).json({ error: 'No se pudo crear el quiz local.' });
    }
  });

  router.post('/api/integrations/recursos/import-catalog', async (req, res) => {
    if (!requireResourcesIntegration(req, res)) return;
    if (!PUBLIC_IMPORT_SOURCE_URL) return res.status(503).json({ error: 'Fuente de importación no configurada.' });
    const items = req.body && req.body.items;
    if (!Array.isArray(items) || items.length > 1000 || items.some(item =>
      !item || !['string', 'number'].includes(typeof item.id) || !String(item.id).trim() ||
      typeof item.name !== 'string' || !item.name.trim() ||
      !Array.isArray(item.questions) || !item.questions.length ||
      item.questions.some(q => !q || typeof q.question !== 'string')
    )) return res.status(400).json({ error: 'Catálogo de cuestionarios no válido.' });
    if (catalogueImportRunning) return res.status(409).json({ error: 'Ya hay una importación en curso.' });
    catalogueImportRunning = true;
    let imported = 0;
    let skipped = 0;
    try {
      const collection = await getGamesCollection();
      for (const item of items) {
        const source = { importedFrom: PUBLIC_IMPORT_SOURCE_URL, sourceQuizId: String(item.id) };
        if (await collection.findOne(source)) {
          skipped++;
          continue;
        }
        const questions = item.questions.map(q => {
          const result = { ...q };
          for (const field of ['image', 'video']) {
            if (typeof result[field] === 'string' && result[field].startsWith('/uploads/')) {
              result[field] = new URL(result[field], PUBLIC_IMPORT_SOURCE_URL).href;
            }
          }
          return result;
        });
        const { quiz } = await buildQuizDoc({
          name: item.name, tags: normalizeTags(item.tags || []), questions,
          visibility: 'public', allowClone: true, user: null, ownerToken: '',
          language: item.language, license: item.license, description: item.description,
          importSource: source
        });
        if (quiz) imported++;
      }
      return res.json({ ok: true, total: items.length, imported, skipped, failed: 0 });
    } catch (err) {
      return res.status(500).json({ error: 'Importación incompleta. Puedes reintentar.', imported, skipped });
    } finally {
      catalogueImportRunning = false;
    }
  });

  return router;
};
