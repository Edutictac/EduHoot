const express = require('express');
const path = require('path');
const multer = require('multer');
const { getGamesCollection, getEphemeralCollection, getLogsCollection, getSettingsCollection } = require('../data/repositories');
const { getDb, LOGS_COLLECTION, DEFAULT_LOGS_CAPPED_SIZE_BYTES } = require('../data/db');
const { logger, setLevel, LOG_LEVELS, DEFAULT_LEVEL } = require('../logger');

const bulkUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

module.exports = function createAdminRouter({
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
}) {
  const router = express.Router();
  let kahootMirrorJobRunning = false;
  let externalMirrorJobRunning = false;

  // Admin: export/import masivo de quizzes
  router.get('/api/admin/quizzes/export', requireRole('admin'), async (req, res) => {
    try {
      const collection = await getGamesCollection();
      const docs = await collection.find({}).toArray();
      const quizzes = docs.map((doc) => {
        const { _id, ...rest } = doc;
        return rest;
      });

      const payload = {
        format: 'eduhoot-quizzes',
        version: 1,
        exportedAt: new Date().toISOString(),
        count: quizzes.length,
        quizzes
      };
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `eduhoot-quizzes-${stamp}.json`;
      res.type('application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(JSON.stringify(payload, null, 2));
    } catch (err) {
      console.error('admin-export-quizzes error', err);
      return res.status(500).json({ error: 'No se pudo exportar.' });
    }
  });

  router.post('/api/admin/quizzes/import', requireRole('admin'), bulkUpload.single('file'), async (req, res) => {
    const mode = (req.query.mode || 'upsert').toString();
    const replaceAll = mode === 'replace';
    if (replaceAll) {
      const confirm = (req.body && req.body.confirm ? String(req.body.confirm) : '').trim();
      if (confirm !== 'REPLACE_ALL') {
        return res.status(400).json({ error: 'Confirma con confirm=REPLACE_ALL para reemplazar todo.' });
      }
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Selecciona un archivo JSON.' });
    }
    try {
      const content = req.file.buffer.toString('utf8').trim();
      let data;
      try {
        data = JSON.parse(content);
      } catch (e) {
        return res.status(400).json({ error: 'JSON inválido.' });
      }

      const quizzesRaw = Array.isArray(data) ? data : (data && Array.isArray(data.quizzes) ? data.quizzes : null);
      if (!quizzesRaw) {
        return res.status(400).json({ error: 'Formato no reconocido. Se esperaba { quizzes: [...] }.' });
      }

      const sanitized = [];
      const errors = [];
      const seen = new Set();
      quizzesRaw.forEach((q, idx) => {
        const result = sanitizeImportedQuiz(q);
        if (!result.ok) {
          errors.push({ index: idx, error: result.error });
          return;
        }
        const key = String(result.quiz.id);
        if (seen.has(key)) {
          // última gana
          const existingIndex = sanitized.findIndex((x) => String(x.id) === key);
          if (existingIndex !== -1) sanitized[existingIndex] = result.quiz;
          return;
        }
        seen.add(key);
        sanitized.push(result.quiz);
      });

      if (!sanitized.length) {
        return res.status(400).json({ error: 'No hay quizzes válidos para importar.', details: errors.slice(0, 20) });
      }

      const collection = await getGamesCollection();
      let deleted = 0;
      if (replaceAll) {
        const delRes = await collection.deleteMany({});
        deleted = delRes.deletedCount || 0;
        await collection.insertMany(sanitized, { ordered: false });
        return res.json({ ok: true, mode: 'replace', deleted, imported: sanitized.length, invalid: errors.length, errors: errors.slice(0, 20) });
      }

      const ops = sanitized.map((quiz) => ({
        replaceOne: {
          filter: { id: quiz.id },
          replacement: quiz,
          upsert: true
        }
      }));
      const result = await collection.bulkWrite(ops, { ordered: false });
      return res.json({
        ok: true,
        mode: 'upsert',
        processed: sanitized.length,
        upserted: result.upsertedCount || 0,
        modified: result.modifiedCount || 0,
        matched: result.matchedCount || 0,
        invalid: errors.length,
        errors: errors.slice(0, 20)
      });
    } catch (err) {
      console.error('admin-import-quizzes error', err);
      return res.status(500).json({ error: 'No se pudo importar.' });
    }
  });

  router.post('/api/admin/mirror-kahoot-images', requireRole('admin'), async (req, res) => {
    if (kahootMirrorJobRunning) {
      return res.status(409).json({ error: 'Ya hay una migración en curso.' });
    }
    kahootMirrorJobRunning = true;
    res.json({ message: 'Migración iniciada en background. Consulta los logs del servidor para el progreso.' });

    // Ejecutar en background sin bloquear la respuesta
    (async () => {
      try {
        const collection = await getGamesCollection();
        const quizzes = await collection.find(
          { 'questions.image': { $regex: 'media\\.kahoot\\.it', $options: 'i' } },
          { projection: { id: 1, questions: 1 } }
        ).toArray();

        console.log(`[mirror-kahoot-images] ${quizzes.length} quizzes con imágenes de Kahoot encontrados.`);
        let updatedQuizzes = 0;
        let updatedImages = 0;

        for (const quiz of quizzes) {
          let changed = false;
          const newQuestions = await Promise.all((quiz.questions || []).map(async (q) => {
            if (!q.image || !q.image.includes('media.kahoot.it')) return q;
            const localUrl = await mirrorKahootImage(q.image);
            if (localUrl !== q.image) {
              changed = true;
              updatedImages++;
              return { ...q, image: localUrl };
            }
            return q;
          }));
          if (changed) {
            await collection.updateOne({ id: quiz.id }, { $set: { questions: newQuestions, updatedAt: new Date() } });
            updatedQuizzes++;
          }
        }
        console.log(`[mirror-kahoot-images] Completado: ${updatedImages} imágenes migradas en ${updatedQuizzes} quizzes.`);
      } catch (err) {
        console.error('[mirror-kahoot-images] Error:', err);
      } finally {
        kahootMirrorJobRunning = false;
      }
    })();
  });

  router.post('/api/admin/mirror-external-images', requireRole('admin'), async (req, res) => {
    if (externalMirrorJobRunning) {
      return res.status(409).json({ error: 'Ya hay una migración en curso.' });
    }
    externalMirrorJobRunning = true;
    res.json({ message: 'Migración de imágenes externas iniciada en background. Consulta los logs del servidor para el progreso.' });

    (async () => {
      try {
        const collection = await getGamesCollection();
        const quizzes = await collection.find(
          { 'questions.image': { $regex: 'https?://', $options: 'i' } },
          { projection: { id: 1, questions: 1 } }
        ).toArray();

        const candidates = quizzes.filter(q =>
          (q.questions || []).some(qq => qq.image && /^https?:\/\//.test(qq.image) && !qq.image.startsWith('/'))
        );

        console.log(`[mirror-external-images] ${candidates.length} quizzes con imágenes externas encontrados.`);
        let updatedQuizzes = 0;
        let updatedImages = 0;

        for (const quiz of candidates) {
          let changed = false;
          const newQuestions = await Promise.all((quiz.questions || []).map(async (q) => {
            if (!q.image || !/^https?:\/\//.test(q.image)) return q;
            const localUrl = await mirrorExternalImage(q.image);
            if (localUrl !== q.image) {
              changed = true;
              updatedImages++;
              return { ...q, image: localUrl };
            }
            return q;
          }));
          if (changed) {
            await collection.updateOne({ id: quiz.id }, { $set: { questions: newQuestions, updatedAt: new Date() } });
            updatedQuizzes++;
          }
        }
        console.log(`[mirror-external-images] Completado: ${updatedImages} imágenes migradas en ${updatedQuizzes} quizzes.`);
      } catch (err) {
        console.error('[mirror-external-images] Error:', err);
      } finally {
        externalMirrorJobRunning = false;
      }
    })();
  });

  router.get('/api/admin/import-public-activities/config', (req, res) => {
    res.json({ enabled: !!PUBLIC_IMPORT_SOURCE_URL, sourceUrl: PUBLIC_IMPORT_SOURCE_URL });
  });

  router.post('/api/admin/import-public-activities', requireRole('admin'), async (req, res) => {
    if (!PUBLIC_IMPORT_SOURCE_URL) {
      return res.status(400).json({ error: 'PUBLIC_IMPORT_SOURCE_URL no está configurado.' });
    }
    try {
      const listResponse = await fetch(`${PUBLIC_IMPORT_SOURCE_URL}/api/public-quizzes`, { signal: AbortSignal.timeout(20000) });
      if (!listResponse.ok) {
        return res.status(502).json({ error: 'No se pudo obtener la lista de actividades públicas.' });
      }
      const list = await listResponse.json();
      const collection = await getGamesCollection();
      let imported = 0;
      let skipped = 0;
      let failed = 0;
      const errors = [];

      for (const item of Array.isArray(list) ? list : []) {
        const remoteId = item && item.id;
        if (remoteId === undefined || remoteId === null) continue;
        try {
          const existing = await collection.findOne({ importedFrom: PUBLIC_IMPORT_SOURCE_URL, sourceQuizId: String(remoteId) });
          if (existing) {
            skipped++;
            continue;
          }
          const detailResponse = await fetch(`${PUBLIC_IMPORT_SOURCE_URL}/api/quizzes/${encodeURIComponent(remoteId)}`, { signal: AbortSignal.timeout(20000) });
          if (!detailResponse.ok) {
            failed++;
            errors.push(`#${remoteId}: HTTP ${detailResponse.status}`);
            continue;
          }
          const detail = await detailResponse.json();
          const { quiz } = await buildQuizDoc({
            name: detail.name,
            tags: detail.tags,
            questions: detail.questions,
            visibility: 'public',
            allowClone: true,
            user: null,
            ownerToken: '',
            language: detail.language,
            license: detail.license,
            description: detail.description
          });
          await collection.updateOne({ id: quiz.id }, { $set: {
            sourceQuizId: String(remoteId),
            sourceQuizName: (detail.name || '').toString(),
            importedFrom: PUBLIC_IMPORT_SOURCE_URL
          } });
          imported++;
        } catch (err) {
          failed++;
          errors.push(`#${remoteId}: ${err.message || err}`);
        }
      }

      console.log(`[import-public-activities] total=${Array.isArray(list) ? list.length : 0} imported=${imported} skipped=${skipped} failed=${failed}`);
      return res.json({ ok: true, total: Array.isArray(list) ? list.length : 0, imported, skipped, failed, errors: errors.slice(0, 20) });
    } catch (err) {
      console.error('[import-public-activities] Error:', err);
      return res.status(500).json({ error: 'No se pudo importar las actividades públicas.' });
    }
  });

  router.get('/api/admin/stats', requireRole('admin'), async (req, res) => {
    try {
      const collection = await getGamesCollection();
      const gamesList = await collection.find({}, { projection: { questions: 1, playsCount: 1, playersCount: 1, visibility: 1 } }).toArray();
      const totalQuizzes = gamesList.length;
      const totalQuestions = gamesList.reduce((sum, g) => sum + ((g.questions || []).length), 0);
      const totalPlays = gamesList.reduce((sum, g) => sum + (g.playsCount || 0), 0);
      const totalPlayers = gamesList.reduce((sum, g) => sum + (g.playersCount || 0), 0);
      const visibilityCounts = gamesList.reduce((acc, g) => {
        const vis = currentVisibility(g);
        acc[vis] = (acc[vis] || 0) + 1;
        return acc;
      }, { public: 0, unlisted: 0, private: 0 });

      const liveGames = games.games.length;
      const livePlayers = games.games.reduce((acc, g) => acc + players.getPlayers(g.hostId).length, 0);

      const ephemerals = await getEphemeralCollection();
      const now = new Date();
      const ephemeralList = await ephemerals.find(
        { $or: [{ expires: { $exists: false } }, { expires: { $gte: now } }] },
        { projection: { questions: 1 } }
      ).toArray();
      const ephemeralQuestions = ephemeralList.reduce((sum, q) => sum + ((q.questions || []).length), 0);

      const avgQuestionsPerQuiz = totalQuizzes ? Number((totalQuestions / totalQuizzes).toFixed(2)) : 0;

      return res.json({
        ok: true,
        data: {
          totalQuizzes,
          totalQuestions,
          totalPlays,
          totalPlayers,
          avgQuestionsPerQuiz,
          visibilityCounts,
          liveGames,
          livePlayers,
          ephemeral: {
            totalQuizzes: ephemeralList.length,
            totalQuestions: ephemeralQuestions
          }
        }
      });
    } catch (err) {
      console.error('admin-stats error', err);
      return res.status(500).json({ error: 'No se pudieron obtener las estadísticas.' });
    }
  });

  router.get('/admin/stats', (req, res) => {
    res.sendFile(path.join(publicPath, 'admin-stats.html'));
  });

  router.get(['/admin', '/admin/', '/admin-stats.html'], (req, res) => {
    res.redirect('/admin/stats');
  });

  // Construeix el filtre Mongo a partir dels paràmetres de consulta,
  // compartit pel visor (paginat) i per la descàrrega (sense tope).
  function buildLogsQuery(reqQuery) {
    const query = {};
    if (reqQuery.level && LOG_LEVELS.includes(reqQuery.level)) {
      query.level = reqQuery.level;
    }
    if (reqQuery.pin) {
      // El PIN es guarda tal qual el genera el joc (número), no com a text;
      // s'accepten ambdues formes perquè qui filtra no haja d'endevinar-ho.
      const pinStr = String(reqQuery.pin);
      const pinNum = Number(reqQuery.pin);
      query.pin = Number.isFinite(pinNum) ? { $in: [pinStr, pinNum] } : pinStr;
    }
    if (reqQuery.tag) {
      query.tag = String(reqQuery.tag);
    }
    if (reqQuery.hostId) {
      query.hostId = String(reqQuery.hostId);
    }
    if (reqQuery.playerId) {
      query.playerId = String(reqQuery.playerId);
    }
    if (reqQuery.from || reqQuery.to) {
      query.createdAt = {};
      if (reqQuery.from) query.createdAt.$gte = new Date(reqQuery.from);
      if (reqQuery.to) query.createdAt.$lte = new Date(reqQuery.to);
    }
    if (reqQuery.q) {
      const safeText = String(reqQuery.q).slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(safeText, 'i');
      // searchText ja inclou message+tag+meta (p. ex. el nom de l'alumnat);
      // es manté message/tag com a alternativa per a entrades anteriors a
      // l'existència d'eixe camp.
      query.$or = [{ searchText: re }, { message: re }, { tag: re }];
    }
    return query;
  }

  function csvField(value) {
    const str = value === null || value === undefined ? '' : String(value);
    if (/[",\n;]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  // Admin: visor de logs (col·lecció capped `appLogs`)
  router.get('/api/admin/logs', requireRole('admin'), async (req, res) => {
    try {
      const collection = await getLogsCollection();
      const query = buildLogsQuery(req.query);
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
      const docs = await collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
      return res.json({ ok: true, data: docs });
    } catch (err) {
      console.error('admin-logs error', err);
      return res.status(500).json({ error: 'No s\'han pogut obtindre els logs.' });
    }
  });

  // Admin: descàrrega dels logs (mateixos filtres que el visor, sense el
  // tope de 500 files; la col·lecció és capped, així que el volum ja està
  // acotat per la mida configurada).
  router.get('/api/admin/logs/export', requireRole('admin'), async (req, res) => {
    const format = req.query.format === 'ndjson' ? 'ndjson' : 'csv';
    try {
      const collection = await getLogsCollection();
      const query = buildLogsQuery(req.query);
      const cursor = collection.find(query).sort({ createdAt: -1 });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      if (format === 'ndjson') {
        res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="eduhoot-logs-${stamp}.ndjson"`);
        for await (const doc of cursor) {
          res.write(JSON.stringify(doc) + '\n');
        }
        return res.end();
      }
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="eduhoot-logs-${stamp}.csv"`);
      res.write('createdAt,level,tag,pin,hostId,playerId,message,meta\n');
      for await (const doc of cursor) {
        const row = [
          doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
          doc.level,
          doc.tag,
          doc.pin,
          doc.hostId,
          doc.playerId,
          doc.message,
          doc.meta ? JSON.stringify(doc.meta) : ''
        ].map(csvField).join(',');
        res.write(row + '\n');
      }
      return res.end();
    } catch (err) {
      console.error('admin-logs-export error', err);
      if (res.headersSent) return res.end();
      return res.status(500).json({ error: 'No s\'han pogut exportar els logs.' });
    }
  });

  router.get('/api/admin/settings/logging', requireRole('admin'), async (req, res) => {
    try {
      const settings = await getSettingsCollection();
      const doc = await settings.findOne({ _id: 'logging' });
      return res.json({
        ok: true,
        data: {
          level: (doc && doc.level) || DEFAULT_LEVEL,
          cappedSizeBytes: (doc && doc.cappedSizeBytes) || DEFAULT_LOGS_CAPPED_SIZE_BYTES
        }
      });
    } catch (err) {
      console.error('admin-settings-logging GET error', err);
      return res.status(500).json({ error: 'No s\'ha pogut obtindre la configuració.' });
    }
  });

  router.post('/api/admin/settings/logging', requireRole('admin'), async (req, res) => {
    try {
      const { level, cappedSizeBytes } = req.body || {};
      const update = {};
      if (level !== undefined) {
        if (!LOG_LEVELS.includes(level)) {
          return res.status(400).json({ error: `Nivell invàlid. Valors permesos: ${LOG_LEVELS.join(', ')}` });
        }
        update.level = level;
      }
      let newSizeBytes = null;
      if (cappedSizeBytes !== undefined) {
        newSizeBytes = parseInt(cappedSizeBytes, 10);
        if (!Number.isFinite(newSizeBytes) || newSizeBytes < 1024 * 1024) {
          return res.status(400).json({ error: 'La mida mínima de la col·lecció de logs és 1MB.' });
        }
        update.cappedSizeBytes = newSizeBytes;
      }
      if (!Object.keys(update).length) {
        return res.status(400).json({ error: 'Cal indicar level i/o cappedSizeBytes.' });
      }
      const settings = await getSettingsCollection();
      await settings.updateOne({ _id: 'logging' }, { $set: update }, { upsert: true });
      if (update.level) {
        setLevel(update.level);
      }
      if (newSizeBytes) {
        const database = await getDb();
        await database.command({ collMod: LOGS_COLLECTION, cappedSize: newSizeBytes });
      }
      logger.info('Configuració de logging actualitzada', { tag: 'admin-settings', ...update });
      return res.json({ ok: true });
    } catch (err) {
      console.error('admin-settings-logging POST error', err);
      return res.status(500).json({ error: 'No s\'ha pogut actualitzar la configuració.' });
    }
  });

  router.get('/admin/logs', (req, res) => {
    res.sendFile(path.join(publicPath, 'admin-logs.html'));
  });

  return router;
};
