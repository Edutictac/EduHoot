// Deures asíncrons (feature 1): un quiz amb data límit que l'alumnat fa al seu ritme, sense
// professorat present. Reutilitza el motor d'autoritme (services/selfPaced.js): el «game» i el
// «player» es construïxen des de MongoDB en cada petició i es guarden en acabar l'acció.
// El servidor mana: temps, puntuació i resposta correcta. Vore HOMEWORK_PLAN.md.
const crypto = require('crypto');
const sp = require('./selfPaced');
const payloads = require('./selfPacedPayloads');
const { getQuestionMeta, normalizeSubmission } = require('../questionUtils');
const { isValidTypedName } = require('./nameRules');

// Sense caràcters ambigus (0/O, 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const RECOVERY_LENGTH = 6;
const MAX_STUDENTS = 500;
const MAX_ATTEMPTS_LIMIT = 20;
const MIN_LEAD_MS = 60 * 1000;
const MAX_LEAD_MS = 30 * 24 * 60 * 60 * 1000;
// Una resposta enviada just abans de la data límit s'accepta (retard de la xarxa).
const DEADLINE_GRACE_MS = sp.SELF_PACED_GRACE_MS;

function randomString(length) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET.charAt(crypto.randomInt(ALPHABET.length));
  return out;
}

function normalizeCode(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hashRecovery(recovery) {
  return crypto.createHash('sha256').update(normalizeCode(recovery)).digest('hex');
}

function safeEqualHex(a, b) {
  const x = Buffer.from(String(a || ''), 'hex');
  const y = Buffer.from(String(b || ''), 'hex');
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

function studentKeyOf(name) {
  return String(name || '').normalize('NFC').trim().toLowerCase();
}

function emptyGameData() {
  return { score: 0, answer: 0, correctCount: 0, wrongCount: 0, streak: 0, bestStreak: 0, answerHistory: [] };
}

// Opcions del deure: només les que afecten el joc. El mode és sempre autoritme.
// Tiempo máximo por pregunta en un deber: 3 minutos.
const MAX_TIME_PER_QUESTION = 180;

function normalizeOptions(raw) {
  const o = raw || {};
  const out = { mode: 'selfPaced', sendToStudents: true, streak: o.streak !== false, showCorrectAnswers: o.showCorrectAnswers !== false };
  const time = parseInt(o.timePerQuestion, 10);
  if (Number.isFinite(time) && time > 0) out.timePerQuestion = Math.max(5, Math.min(MAX_TIME_PER_QUESTION, time));
  // Con varios intentos: cuenta el mejor (por defecto) o la media.
  out.attemptScoring = ['average', 'first', 'last'].includes(o.attemptScoring) ? o.attemptScoring : 'best';
  if (o.matchingExtraTime !== undefined) out.matchingExtraTime = o.matchingExtraTime;
  return out;
}

class ConflictError extends Error {}

module.exports = function createHomeworkService({ getHomeworksCollection, getHomeworkAttemptsCollection, buildQuestions }) {
  const identity = (full) => full;

  // ----- Docent -----

  async function createHomework({ ownerId, ownerNickname, quiz, title, deadline, maxAttempts, options }, now = Date.now()) {
    const deadlineMs = Number(deadline);
    if (!Number.isFinite(deadlineMs) || deadlineMs < now + MIN_LEAD_MS) return { error: 'deadline-too-soon' };
    if (deadlineMs > now + MAX_LEAD_MS) return { error: 'deadline-too-far' };
    const attempts = maxAttempts === undefined || maxAttempts === null || maxAttempts === '' ? 1 : parseInt(maxAttempts, 10);
    if (!Number.isInteger(attempts) || attempts < 0 || attempts > MAX_ATTEMPTS_LIMIT) return { error: 'bad-attempts' };
    const opts = normalizeOptions(options);
    // Còpia de les preguntes: si el docent edita el quiz després, el deure no canvia.
    const questions = buildQuestions(Array.isArray(quiz.questions) ? quiz.questions : [], {
      randomQuestions: false,
      randomAnswers: !(options && options.randomAnswers === false),
      timePerQuestion: opts.timePerQuestion
    });
    if (!questions || !questions.length) return { error: 'no-questions' };
    const collection = await getHomeworksCollection();
    const cleanTitle = String(title || quiz.name || '').trim().slice(0, 80);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const doc = {
        code: randomString(CODE_LENGTH),
        ownerId: String(ownerId || ''),
        ownerNickname: String(ownerNickname || ''),
        quizId: quiz.id !== undefined ? quiz.id : String(quiz._id || ''),
        quizName: String(quiz.name || ''),
        title: cleanTitle || String(quiz.name || ''),
        questions,
        totalQuestions: questions.length,
        scoredQuestionsCount: questions.filter((q) => q.type !== 'poll').length,
        options: opts,
        deadline: deadlineMs,
        maxAttempts: attempts,
        status: 'open',
        createdAt: now
      };
      try {
        await collection.insertOne(doc);
        return { homework: doc };
      } catch (err) {
        if (!(err && err.code === 11000)) throw err; // código repetido: otro intento
      }
    }
    return { error: 'code-unavailable' };
  }

  async function getByCode(code) {
    const c = normalizeCode(code);
    if (c.length !== CODE_LENGTH) return null;
    const collection = await getHomeworksCollection();
    return collection.findOne({ code: c });
  }

  async function listForOwner(ownerId) {
    const collection = await getHomeworksCollection();
    const attempts = await getHomeworkAttemptsCollection();
    const list = await collection.find({ ownerId: String(ownerId) }, { projection: { questions: 0 } }).sort({ createdAt: -1 }).toArray();
    const counts = await attempts.aggregate([
      { $match: { code: { $in: list.map((h) => h.code) } } },
      { $group: { _id: '$code', students: { $addToSet: '$studentKey' }, finished: { $sum: { $cond: ['$finished', 1, 0] } } } }
    ]).toArray();
    const byCode = new Map(counts.map((c) => [c._id, c]));
    return list.map((h) => ({ ...h, students: (byCode.get(h.code) || { students: [] }).students.length, finishedAttempts: (byCode.get(h.code) || { finished: 0 }).finished }));
  }

  async function setStatus(hw, status) {
    const collection = await getHomeworksCollection();
    await collection.updateOne({ code: hw.code }, { $set: { status } });
  }

  async function extendDeadline(hw, deadline, now = Date.now()) {
    const ms = Number(deadline);
    if (!Number.isFinite(ms) || ms < now + MIN_LEAD_MS || ms > now + MAX_LEAD_MS) return false;
    const collection = await getHomeworksCollection();
    await collection.updateOne({ code: hw.code }, { $set: { deadline: ms, status: 'open' } });
    return true;
  }

  async function remove(hw) {
    const collection = await getHomeworksCollection();
    const attempts = await getHomeworkAttemptsCollection();
    await attempts.deleteMany({ code: hw.code });
    await collection.deleteOne({ code: hw.code });
  }

  function isOpen(hw, now) {
    return hw.status === 'open' && now <= hw.deadline;
  }

  function scoringOf(hw) {
    const mode = hw && hw.options && hw.options.attemptScoring;
    return ['average', 'first', 'last'].includes(mode) ? mode : 'best';
  }

  // Puntuación que cuenta del alumno según la opción del deber: el mejor intento, la media de los
  // intentos contados (los acabados; si el deber está cerrado, también los que quedaron a medias),
  // el primero o el último. `scores` va en orden de intento.
  function countedScore(hw, scores) {
    if (!scores.length) return 0;
    const mode = scoringOf(hw);
    if (mode === 'first') return scores[0];
    if (mode === 'last') return scores[scores.length - 1];
    if (mode === 'average') return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
    return Math.max(...scores);
  }

  function publicInfo(hw, now = Date.now()) {
    return {
      code: hw.code,
      title: hw.title,
      quizId: hw.quizId,
      quizName: hw.quizName,
      totalQuestions: hw.totalQuestions,
      maxAttempts: hw.maxAttempts,
      scoring: scoringOf(hw),
      deadline: hw.deadline,
      open: isOpen(hw, now)
    };
  }

  // ----- Alumnat -----

  async function attemptsOf(code, studentKey) {
    const collection = await getHomeworkAttemptsCollection();
    return collection.find({ code, studentKey }).sort({ attemptNo: 1 }).toArray();
  }

  async function authenticate(hw, name, recovery) {
    const key = studentKeyOf(name);
    if (!key || !recovery) return { ok: false };
    const attempts = await attemptsOf(hw.code, key);
    if (!attempts.length || !safeEqualHex(attempts[0].recoveryHash, hashRecovery(recovery))) return { ok: false };
    return { ok: true, key, attempts };
  }

  function summaryOf(hw, attempts) {
    return attempts.map((a) => ({ attemptNo: a.attemptNo, finished: !!a.finished, score: Number(a.gameData && a.gameData.score) || 0 }));
  }

  // Alta (sin código de recuperación) o reentrada (con nombre y código).
  async function join(hw, { name, icon, recovery }, now = Date.now()) {
    const typed = String(name || '').trim();
    const key = studentKeyOf(typed);
    if (recovery) {
      const auth = await authenticate(hw, typed, recovery);
      if (!auth.ok) return { error: 'bad-recovery' };
      return { student: { name: auth.attempts[0].name, recovery: normalizeCode(recovery) }, attempts: summaryOf(hw, auth.attempts), maxAttempts: hw.maxAttempts, open: isOpen(hw, now) };
    }
    if (!isValidTypedName(typed)) return { error: 'bad-name' };
    if (!isOpen(hw, now)) return { error: 'closed' };
    const collection = await getHomeworkAttemptsCollection();
    if (await collection.countDocuments({ code: hw.code, studentKey: key })) return { error: 'name-taken' };
    if (await collection.countDocuments({ code: hw.code, attemptNo: 1 }) >= MAX_STUDENTS) return { error: 'full' };
    const code = randomString(RECOVERY_LENGTH);
    const doc = {
      code: hw.code, studentKey: key, name: typed, icon: String(icon || '').slice(0, 8), attemptNo: 1,
      recoveryHash: hashRecovery(code), gameData: emptyGameData(), finished: false, version: 0, startedAt: now, updatedAt: now
    };
    try {
      await collection.insertOne(doc);
    } catch (err) {
      if (err && err.code === 11000) return { error: 'name-taken' }; // dos altas a la vez con el mismo nombre
      throw err;
    }
    return { student: { name: typed, recovery: code }, attempts: summaryOf(hw, [doc]), maxAttempts: hw.maxAttempts, open: true };
  }

  function gameOf(hw) {
    return { gameData: { questions: hw.questions, options: hw.options, totalQuestions: hw.totalQuestions, scoredQuestionsCount: hw.scoredQuestionsCount, quizName: hw.quizName } };
  }

  async function save(attempt, player) {
    const collection = await getHomeworkAttemptsCollection();
    const res = await collection.updateOne(
      { _id: attempt._id, version: attempt.version },
      { $set: { gameData: player.gameData, finished: !!attempt.finished, finishedAt: attempt.finishedAt || null, updatedAt: attempt.updatedAt }, $inc: { version: 1 } }
    );
    if (!res.matchedCount) throw new ConflictError('conflict');
    attempt.version += 1;
  }

  function finishedEvent(hw, attempts, attempt, player, extra = {}) {
    const all = attempts.map((a) => (a._id === attempt._id ? { ...a, gameData: player.gameData, finished: true } : a));
    const scoreOf = (a) => Number(a.gameData && a.gameData.score) || 0;
    const best = all.reduce((m, a) => Math.max(m, scoreOf(a)), 0);
    const counted = all.filter((a) => a.finished || a._id === attempt._id);
    return {
      name: 'spFinished',
      data: {
        ...payloads.finishedPayload(gameOf(hw), player),
        homework: true,
        attemptNo: attempt.attemptNo,
        maxAttempts: hw.maxAttempts,
        bestScore: best,
        scoring: scoringOf(hw),
        averageScore: countedScore({ options: { attemptScoring: 'average' } }, counted.map(scoreOf)),
        // La puntuación que cuenta con la opción del deber (mejor, media, primero o último intento).
        countedScore: countedScore(hw, scoringOf(hw) === 'first' ? all.map(scoreOf) : counted.map(scoreOf)),
        canRetry: false,
        ...extra
      }
    };
  }

  function questionEvents(game, player, now) {
    const q = sp.currentQuestion(game, player);
    return [
      { name: 'spQuestion', data: payloads.questionPayload(game, player, now, identity) },
      { name: 'questionMedia', data: { image: q.image || '', video: q.video || '' } }
    ];
  }

  // Una acción del alumno sobre su intento más reciente. Devuelve { events } o { error }.
  async function actOnce(hw, { name, recovery }, op, value, now, ctx) {
    const auth = await authenticate(hw, name, recovery);
    if (!auth.ok) return { error: 'bad-recovery' };
    let attempts = auth.attempts;
    let attempt = attempts[attempts.length - 1];
    const game = gameOf(hw);
    const open = isOpen(hw, op === 'answer' ? now - DEADLINE_GRACE_MS : now);

    if (op === 'newAttempt') {
      if (!open) return { error: 'closed' };
      if (!attempt.finished) return { error: 'attempt-running' };
      if (hw.maxAttempts !== 0 && attempt.attemptNo >= hw.maxAttempts) return { error: 'no-attempts-left' };
      const fresh = {
        code: hw.code, studentKey: attempt.studentKey, name: attempt.name, icon: attempt.icon, attemptNo: attempt.attemptNo + 1,
        recoveryHash: attempt.recoveryHash, gameData: emptyGameData(), finished: false, version: 0, startedAt: now, updatedAt: now
      };
      const collection = await getHomeworkAttemptsCollection();
      try { await collection.insertOne(fresh); } catch (err) {
        if (err && err.code === 11000) throw new ConflictError('conflict');
        throw err;
      }
      return { events: [{ name: 'spIdle', data: null }], attemptNo: fresh.attemptNo };
    }

    const player = { name: attempt.name, gameData: attempt.gameData };
    ctx.player = player;
    const state = sp.ensureState(player);
    attempt.updatedAt = now;

    // Cerrado (fecha límite o cierre del docente): el intento a medias termina con sus puntos.
    if (!attempt.finished && !open) {
      sp.finishPlayer(player);
      attempt.finished = true;
      attempt.finishedAt = Math.min(now, hw.deadline);
      await save(attempt, player);
    }
    if (attempt.finished) {
      return { events: [finishedEvent(hw, attempts, attempt, player, { canRetry: open && (hw.maxAttempts === 0 || attempt.attemptNo < hw.maxAttempts), closed: !open })] };
    }

    if (op === 'resume') {
      if (state.index === 0) return { events: [{ name: 'spIdle', data: null }] };
      if (!state.answered && sp.remainingMs(game, player, now) === 0 && sp.expireQuestion(game, player, now)) await save(attempt, player);
      if (state.answered) return { events: [{ name: 'spAnswered', data: { questionNumber: state.index, totalQuestions: hw.totalQuestions } }] };
      return { events: questionEvents(game, player, now) };
    }

    if (op === 'next') {
      // No se salta una pregunta en curso: si aún hay tiempo se reenvía la misma.
      if (state.index > 0 && !state.answered && !sp.expireQuestion(game, player, now)) return { events: questionEvents(game, player, now) };
      if (!sp.beginNext(game, player, now)) {
        attempt.finished = true;
        attempt.finishedAt = now;
        await save(attempt, player);
        return { events: [finishedEvent(hw, attempts, attempt, player, { canRetry: open && (hw.maxAttempts === 0 || attempt.attemptNo < hw.maxAttempts) })] };
      }
      await save(attempt, player);
      return { events: questionEvents(game, player, now) };
    }

    if (op === 'answer') {
      const q = sp.currentQuestion(game, player);
      if (!q) return { events: [{ name: 'answerRejected', data: { reason: 'no-question' } }] };
      const res = sp.submitAnswer(game, player, normalizeSubmission(getQuestionMeta(q), value), now);
      if (!res.ok) return { events: [{ name: 'answerRejected', data: { reason: res.reason } }] };
      await save(attempt, player);
      return { events: [{ name: 'spResult', data: payloads.resultPayload(game, player, res) }] };
    }

    if (op === 'timeUp') {
      if (!sp.expireQuestion(game, player, now)) return { events: [] };
      await save(attempt, player);
      return { events: [{ name: 'spResult', data: payloads.resultPayload(game, player, { outcome: 'timeout', scoreRatio: 0, points: 0, bonus: 0 }) }] };
    }

    return { error: 'bad-op' };
  }

  // Dos dispositivos a la vez: si otro guardó antes, se vuelve a cargar y se reintenta una vez.
  async function act(hw, who, op, value, now = Date.now()) {
    let out;
    const ctx = {};
    try {
      out = await actOnce(hw, who, op, value, now, ctx);
    } catch (err) {
      if (!(err instanceof ConflictError)) throw err;
      out = await actOnce(hw, who, op, value, now, ctx);
    }
    // Puntos y racha actuales, para el encabezado de la pantalla del alumno.
    if (!out.error) {
      const gd = ctx.player ? ctx.player.gameData : emptyGameData();
      out.score = Number(gd.score) || 0;
      out.streak = Number(gd.streak) || 0;
      out.title = hw.title;
    }
    return out;
  }

  // ----- Resultados (docente) -----

  // Un intento sin acabar en un deure cerrado cuenta como terminado, con sus puntos.
  async function results(hw, now = Date.now()) {
    const collection = await getHomeworkAttemptsCollection();
    const all = await collection.find({ code: hw.code }).sort({ studentKey: 1, attemptNo: 1 }).toArray();
    const closed = !isOpen(hw, now);
    const byStudent = new Map();
    all.forEach((a) => {
      if (!byStudent.has(a.studentKey)) byStudent.set(a.studentKey, []);
      byStudent.get(a.studentKey).push(a);
    });
    const rows = [];
    const bestPlayers = [];
    const statSources = [];
    byStudent.forEach((list) => {
      const scored = list.map((a) => ({ a, score: Number(a.gameData && a.gameData.score) || 0 }));
      const best = scored.reduce((m, s) => (s.score > m.score ? s : m), scored[0]);
      // Intentos que cuentan para la media: los acabados (o todos, si el deber ya está cerrado).
      const mode = scoringOf(hw);
      const average = mode === 'average';
      const countedAll = scored.filter((s) => s.a.finished || closed);
      const counted = countedAll.length ? countedAll : [best];
      // Intento que representa al alumno: el mejor, el primero o el último contado (la media no tiene uno solo).
      const pick = mode === 'first' ? scored[0] : (mode === 'last' ? (countedAll.length ? countedAll[countedAll.length - 1] : scored[scored.length - 1]) : best);
      const finalScore = average ? countedScore(hw, counted.map((s) => s.score)) : pick.score;
      const mean = (key) => Math.round(counted.reduce((sum, s) => sum + (Number(s.a.gameData && s.a.gameData[key]) || 0), 0) / counted.length);
      const last = list[list.length - 1];
      const state = last.finished ? 'finished' : (closed ? 'expired' : (sp.ensureState({ gameData: last.gameData }).index > 0 ? 'in-progress' : 'not-started'));
      rows.push({
        name: list[0].name,
        icon: list[0].icon || '',
        state,
        attempts: list.length,
        bestScore: finalScore,
        correctCount: average ? mean('correctCount') : (pick.a.gameData.correctCount || 0),
        wrongCount: average ? mean('wrongCount') : (pick.a.gameData.wrongCount || 0),
        answered: (pick.a.gameData.answerHistory || []).length,
        finishedAt: pick.a.finishedAt || null
      });
      bestPlayers.push({ name: list[0].name, icon: list[0].icon || '', gameData: { ...pick.a.gameData, score: finalScore } });
      // Fuente de la estadística por pregunta: el mejor intento, o todos los que cuentan si se hace la media.
      statSources.push(...(average ? counted.map((s) => s.a.gameData) : [pick.a.gameData]));
    });
    rows.sort((x, y) => y.bestScore - x.bestScore || x.name.localeCompare(y.name, 'es'));
    // Estadística por pregunta, sobre el mejor intento de cada alumno (o sobre todos, con la media).
    const questionStats = hw.questions.map((q, i) => {
      let answered = 0;
      let correct = 0;
      statSources.forEach((gd) => {
        const h = (gd.answerHistory || []).find((x) => x.questionNumber === i + 1);
        if (h) { answered += 1; if (h.isCorrect) correct += 1; }
      });
      return { number: i + 1, question: q.question, type: q.type, answered, correct };
    });
    bestPlayers.sort((x, y) => (y.gameData.score || 0) - (x.gameData.score || 0));
    return { rows, questionStats, bestPlayers, students: rows.length };
  }

  return {
    createHomework, getByCode, listForOwner, setStatus, extendDeadline, remove,
    publicInfo, isOpen, join, act, results,
    // Para pruebas
    _internals: { normalizeCode, hashRecovery, studentKeyOf, randomString }
  };
};

module.exports.ALPHABET = ALPHABET;
module.exports.CODE_LENGTH = CODE_LENGTH;
