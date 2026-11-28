const express = require('express');

// Deures asíncrons: rutes de l'alumnat (/api/homework/:code/…, sense compte) i del
// docent (/api/homeworks, amb sessió). La lògica és en services/homework.js.
const STUDENT_ERRORS = {
  'bad-name': 400, 'bad-recovery': 401, 'name-taken': 409, closed: 403, full: 409,
  'attempt-running': 409, 'no-attempts-left': 403, 'bad-op': 400
};

// Límit d'intents fallits del codi de recuperació (força bruta). Per IP+deure+nom (10) i, com a
// reserva, per deure+nom sense IP (200), cada 10 minuts.
function createRecoveryLimiter() {
  const windowMs = 10 * 60 * 1000;
  const hits = new Map();
  function bump(key, now) {
    const e = hits.get(key);
    if (!e || now - e.start > windowMs) { hits.set(key, { start: now, count: 1 }); return; }
    e.count += 1;
  }
  function over(key, max, now) {
    const e = hits.get(key);
    return !!e && now - e.start <= windowMs && e.count >= max;
  }
  return {
    blocked(ip, code, name, now = Date.now()) {
      return over(`${ip}|${code}|${name}`, 10, now) || over(`${code}|${name}`, 200, now);
    },
    fail(ip, code, name, now = Date.now()) {
      bump(`${ip}|${code}|${name}`, now);
      bump(`${code}|${name}`, now);
      if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
    }
  };
}

module.exports = function createHomeworkRouter({ homework, requireRole, findGameById, canUseQuiz, liveSessionToCsv, buildReportFileName }) {
  const router = express.Router();
  const limiter = createRecoveryLimiter();

  async function loadHomework(req, res) {
    const hw = await homework.getByCode(req.params.code);
    if (!hw) { res.status(404).json({ error: 'not-found' }); return null; }
    return hw;
  }

  function nameOf(req) { return String((req.body && req.body.name) || '').trim().toLowerCase(); }

  // ----- Alumnado -----

  router.get('/api/homework/:code', async (req, res) => {
    try {
      const hw = await loadHomework(req, res);
      if (hw) res.json(homework.publicInfo(hw));
    } catch (err) { res.status(500).json({ error: 'server-error' }); }
  });

  router.post('/api/homework/:code/join', async (req, res) => {
    try {
      const hw = await loadHomework(req, res);
      if (!hw) return;
      const body = req.body || {};
      const key = nameOf(req);
      if (body.recovery && limiter.blocked(req.ip, hw.code, key)) return res.status(429).json({ error: 'too-many-attempts' });
      const out = await homework.join(hw, body);
      if (out.error) {
        if (out.error === 'bad-recovery') limiter.fail(req.ip, hw.code, key);
        return res.status(STUDENT_ERRORS[out.error] || 400).json({ error: out.error });
      }
      return res.json({ ok: true, ...out, homework: homework.publicInfo(hw) });
    } catch (err) { return res.status(500).json({ error: 'server-error' }); }
  });

  router.post('/api/homework/:code/act', async (req, res) => {
    try {
      const hw = await loadHomework(req, res);
      if (!hw) return;
      const body = req.body || {};
      const key = nameOf(req);
      if (limiter.blocked(req.ip, hw.code, key)) return res.status(429).json({ error: 'too-many-attempts' });
      const out = await homework.act(hw, { name: body.name, recovery: body.recovery }, String(body.op || ''), body.value);
      if (out.error) {
        if (out.error === 'bad-recovery') limiter.fail(req.ip, hw.code, key);
        return res.status(STUDENT_ERRORS[out.error] || 400).json({ error: out.error });
      }
      return res.json({ ok: true, ...out });
    } catch (err) { return res.status(500).json({ error: 'server-error' }); }
  });

  // ----- Docente -----

  function mine(req, hw) {
    return String(hw.ownerId) === String(req.user.id) || req.user.role === 'admin';
  }

  router.post('/api/homeworks', requireRole('editor'), async (req, res) => {
    try {
      const body = req.body || {};
      const quiz = await findGameById(body.quizId);
      if (!quiz || !canUseQuiz(quiz, req.user)) return res.status(404).json({ error: 'quiz-not-found' });
      const out = await homework.createHomework({
        ownerId: req.user.id, ownerNickname: req.user.nickname, quiz,
        title: body.title, deadline: body.deadline, maxAttempts: body.maxAttempts, options: body.options
      });
      if (out.error) return res.status(400).json({ error: out.error });
      return res.json({ ok: true, homework: homework.publicInfo(out.homework) });
    } catch (err) { return res.status(500).json({ error: 'server-error' }); }
  });

  router.get('/api/homeworks', requireRole('editor'), async (req, res) => {
    try {
      const list = await homework.listForOwner(req.user.id);
      res.json(list.map((h) => ({ ...homework.publicInfo(h), status: h.status, createdAt: h.createdAt, students: h.students, finishedAttempts: h.finishedAttempts })));
    } catch (err) { res.status(500).json({ error: 'server-error' }); }
  });

  router.get('/api/homeworks/:code/results', requireRole('editor'), async (req, res) => {
    try {
      const hw = await loadHomework(req, res);
      if (!hw) return;
      if (!mine(req, hw)) return res.status(403).json({ error: 'forbidden' });
      const out = await homework.results(hw);
      return res.json({ homework: { ...homework.publicInfo(hw), status: hw.status }, rows: out.rows, questionStats: out.questionStats, students: out.students });
    } catch (err) { return res.status(500).json({ error: 'server-error' }); }
  });

  router.get('/api/homeworks/:code/report.csv', requireRole('editor'), async (req, res) => {
    try {
      const hw = await loadHomework(req, res);
      if (!hw) return;
      if (!mine(req, hw)) return res.status(403).json({ error: 'forbidden' });
      const out = await homework.results(hw);
      const gameLike = { gameData: { quizName: hw.title, questions: hw.questions, totalQuestions: hw.totalQuestions, options: hw.options } };
      const csv = liveSessionToCsv(gameLike, out.bestPlayers);
      const fileName = buildReportFileName({ quizName: hw.title, pin: hw.code, timestampMs: Date.now() });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.send(csv);
    } catch (err) { return res.status(500).json({ error: 'server-error' }); }
  });

  // Cerrar, reabrir o cambiar la fecha límite.
  router.patch('/api/homeworks/:code', requireRole('editor'), async (req, res) => {
    try {
      const hw = await loadHomework(req, res);
      if (!hw) return;
      if (!mine(req, hw)) return res.status(403).json({ error: 'forbidden' });
      const body = req.body || {};
      if (body.deadline !== undefined) {
        if (!(await homework.extendDeadline(hw, body.deadline))) return res.status(400).json({ error: 'bad-deadline' });
      } else if (body.status === 'closed' || body.status === 'open') {
        await homework.setStatus(hw, body.status);
      } else {
        return res.status(400).json({ error: 'nothing-to-change' });
      }
      const fresh = await homework.getByCode(hw.code);
      return res.json({ ok: true, homework: { ...homework.publicInfo(fresh), status: fresh.status } });
    } catch (err) { return res.status(500).json({ error: 'server-error' }); }
  });

  router.delete('/api/homeworks/:code', requireRole('editor'), async (req, res) => {
    try {
      const hw = await loadHomework(req, res);
      if (!hw) return;
      if (!mine(req, hw)) return res.status(403).json({ error: 'forbidden' });
      await homework.remove(hw);
      return res.json({ ok: true });
    } catch (err) { return res.status(500).json({ error: 'server-error' }); }
  });

  return router;
};
module.exports.createRecoveryLimiter = createRecoveryLimiter;
