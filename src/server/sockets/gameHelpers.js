const {
  normalizeQuestionMeta,
  isFreeAnswerType,
  normalizeCorrectAnswers,
  getQuestionMeta,
  isSubmissionCorrect,
  buildMatchingLayout,
  normalizeMatchingBlindStyle
} = require('../questionUtils');
const { logger } = require('../logger');
const { isStreakEnabled } = require('../services/scoring');
const { buildAnswerStatus, leftListOf } = require('./answerStatus');

const { getTimings } = require('../services/gameTimings');
const { normalizeAutoAdvance, AutoAdvanceTimer } = require('../services/autoAdvance');
const { studentMetaOf, showCorrectAnswersOf } = require('../services/showAnswers');
const QUESTION_COUNTDOWN_SECONDS = 3;

const answerRate = new Map(); // clave: hostId:ip -> { count, windowStart }
const ANSWER_RATE_WINDOW_MS = 3000;
const ANSWER_RATE_MAX = 4;

function shuffleArray(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleQuestions(originalQuestions = []) {
  const ordered = shuffleArray(originalQuestions);
  return ordered;
}

function socketIp(socket) {
  const hdr = socket && socket.handshake && socket.handshake.headers && socket.handshake.headers['x-forwarded-for'];
  if (hdr && typeof hdr === 'string' && hdr.length) {
    return hdr.split(',')[0].trim();
  }
  if (socket && socket.handshake && socket.handshake.address) return socket.handshake.address;
  if (socket && socket.conn && socket.conn.remoteAddress) return socket.conn.remoteAddress;
  return 'unknown';
}

function allowAnswer(socket, hostId) {
  const identity = (socket && socket.id) || socketIp(socket);
  const key = `${hostId || 'nohost'}:${identity}`;
  const now = Date.now();
  const entry = answerRate.get(key) || { count: 0, windowStart: now };
  if (now - entry.windowStart > ANSWER_RATE_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }
  entry.count += 1;
  answerRate.set(key, entry);
  if (entry.count > ANSWER_RATE_MAX) {
    if (answerRate.size > 2000) {
      for (const [k, v] of answerRate.entries()) {
        if (now - v.windowStart > ANSWER_RATE_WINDOW_MS) answerRate.delete(k);
      }
    }
    return false;
  }
  if (answerRate.size > 2000) {
    for (const [k, v] of answerRate.entries()) {
      if (now - v.windowStart > ANSWER_RATE_WINDOW_MS) answerRate.delete(k);
    }
  }
  return true;
}

function recordPlayerAnswerHistory(player, game, questionNumber, submission, isCorrect, scoreRatio) {
  if (!player || !player.gameData) return;
  if (!Array.isArray(player.gameData.answerHistory)) {
    player.gameData.answerHistory = [];
  }
  const startedAt = Number(game && game.gameData && game.gameData.questionStartedAt) || 0;
  const elapsedMs = startedAt > 0 ? Math.max(0, Date.now() - startedAt) : null;
  const entry = {
    questionNumber: Number(questionNumber) || 0,
    submission,
    isCorrect: !!isCorrect,
    scoreRatio: Number(scoreRatio) || 0,
    answeredAt: Date.now(),
    elapsedMs
  };
  const idx = player.gameData.answerHistory.findIndex((item) => Number(item && item.questionNumber) === entry.questionNumber);
  if (idx >= 0) {
    player.gameData.answerHistory[idx] = entry;
  } else {
    player.gameData.answerHistory.push(entry);
  }
}

function logGames(games, tag) {
  const pins = games.games.map((g) => `${g.pin}(host:${g.hostId})`);
  logger.debug(`Active games: ${pins.length ? pins.join(', ') : 'none'}`, { tag });
}

// Factoria: la majoria d'estos helpers necessiten io/games/players, compartits
// amb la resta de server.js i amb les rutes ja mogudes en el Pas 4 — s'injecten
// en compte de moure's, igual que 'players' en services/sessionReport.js.
module.exports = function createGameHelpers({ io, games, players, cleanImportedText }) {
  // Tiempos vigentes de la partida de este anfitrión (se leen al usarlos, no al cargar).
  function timingsFor(hostId) {
    return getTimings(games.getGame(hostId));
  }

  function scheduleGameCleanup(hostId, delayMs) {
    const game = games.getGame(hostId);
    if (!game) return;
    const timings = getTimings(game);
    if (delayMs === undefined || delayMs === null) delayMs = timings.cleanupMs;
    if (game.cleanupTimer) clearTimeout(game.cleanupTimer);
    if (game.gameOver && delayMs > timings.cleanupMs) {
      delayMs = timings.cleanupMs;
    }
    game.cleanupTimer = setTimeout(() => {
      const current = games.getGame(hostId);
      if (!current) return;
      games.removeGame(hostId);
      const playersToRemove = players.getPlayers(hostId);
      for (let i = 0; i < playersToRemove.length; i++) {
        players.removePlayer(playersToRemove[i].playerId);
      }
      io.to(current.pin).emit('hostDisconnect');
    }, delayMs);
  }

  function clearHostDisconnectTimer(game) {
    if (!game || !game.hostDisconnectTimer) return;
    clearTimeout(game.hostDisconnectTimer);
    game.hostDisconnectTimer = null;
  }

  function markHostConnected(game) {
    if (!game) return;
    clearHostDisconnectTimer(game);
    game.hostDisconnectedAt = null;
    game.hostReconnectDeadline = null;
  }

  function scheduleHostReconnectCleanup(game, disconnectedHostId) {
    if (!game) return;
    clearHostDisconnectTimer(game);
    game.hostDisconnectedAt = Date.now();
    const graceMs = getTimings(game).hostReconnectMs;
    game.hostReconnectDeadline = game.hostDisconnectedAt + graceMs;
    game.hostDisconnectTimer = setTimeout(() => {
      const current = games.getGameByPin(game.pin);
      if (!current) return;
      if (!current.hostDisconnectedAt) return;
      if (current.hostId !== disconnectedHostId) return;
      games.removeGame(current.hostId);
      const playersToRemove = players.getPlayers(current.hostId);
      for (let i = 0; i < playersToRemove.length; i++) {
        players.removePlayer(playersToRemove[i].playerId);
      }
      io.to(current.pin).emit('hostDisconnect');
    }, graceMs);
  }

  function buildQuestions(questions = [], opts = {}) {
    const randomQ = opts.randomQuestions === true;
    const randomA = opts.randomAnswers !== false;
    const overrideTime = parseInt(opts.timePerQuestion, 10);
    const useOverrideTime = !Number.isNaN(overrideTime) && overrideTime > 0;

    const safeQuestions = Array.isArray(questions) ? questions : [];
    const base = randomQ ? shuffleQuestions(safeQuestions) : [...safeQuestions];

    return base.map((q) => {
      const meta = normalizeQuestionMeta(q);
      const type = meta.type || (q.type || 'quiz');

      // Tipos de respuesta libre: no barajar opciones y preservar meta.
      if (isFreeAnswerType(type)) {
        return {
          question: cleanImportedText(q.question),
          answers: Array.isArray(q.answers) ? q.answers.slice(0, 4).map(cleanImportedText) : [],
          correct: 1,
          correctAnswers: [1],
          type,
          time: useOverrideTime ? overrideTime : (q.time || 0),
          pointsMultiplier: Number(q.pointsMultiplier) > 1 ? 2 : 1,
          image: q.image || '',
          video: q.video || '',
          acceptedAnswers: Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers.map(cleanImportedText) : [],
          numericAnswer: typeof meta.numericAnswer === 'number' ? meta.numericAnswer : null,
          tolerance: typeof meta.tolerance === 'number' ? meta.tolerance : 0
        };
      }

      // Correspondencia: la izquierda en orden fijo y la derecha barajada siempre
      // (sin barajar, la solución sería el mismo orden). Se evita que salga igual.
      if (type === 'matching') {
        const pairs = Array.isArray(meta.pairs) ? meta.pairs : [];
        const domain = pairs.map((_, idx) => idx);
        let order = shuffleArray(domain);
        if (domain.length > 1 && order.every((v, i) => v === i)) {
          order = [...domain.slice(1), domain[0]];
        }
        const layout = buildMatchingLayout(pairs, order);
        return {
          question: cleanImportedText(q.question),
          answers: [],
          correct: 1,
          correctAnswers: [1],
          type,
          time: useOverrideTime ? overrideTime : (q.time || 0),
          pointsMultiplier: Number(q.pointsMultiplier) > 1 ? 2 : 1,
          image: q.image || '',
          video: q.video || '',
          matchLeft: layout.matchLeft.map(cleanImportedText),
          matchRight: layout.matchRight.map(cleanImportedText),
          matchSolution: layout.matchSolution
        };
      }

      // Para verdadero/falso: trabajamos solo con 2 opciones y evitamos que el shuffle
      // meta strings vacíos en A/B o que el correcto acabe en 3/4.
      const rawAnswers = Array.isArray(q.answers) ? q.answers.map(cleanImportedText) : [];
      const domainAnswers = type === 'true-false' ? rawAnswers.slice(0, 2) : rawAnswers;
      const indexDomain = domainAnswers.map((_, idx) => idx);

      const answerOrder = randomA ? shuffleArray(indexDomain) : indexDomain;
      const answers = answerOrder.map((idx) => domainAnswers[idx]);

      const originalCorrects = type === 'poll' ? [] : (type === 'true-false' ? meta.correctAnswers : normalizeCorrectAnswers(q.correctAnswers || q.correct));
      const shuffledCorrects = [];
      originalCorrects.forEach((orig) => {
        const zeroBased = orig - 1;
        const newIndex = answerOrder.indexOf(zeroBased);
        if (newIndex !== -1) {
          const candidate = newIndex + 1;
          if (!shuffledCorrects.includes(candidate)) {
            shuffledCorrects.push(candidate);
          }
        }
      });
      if (!shuffledCorrects.length && type !== 'poll') {
        shuffledCorrects.push(1);
      }
      return {
        question: cleanImportedText(q.question),
        answers,
        correct: shuffledCorrects[0] || 1,
        correctAnswers: shuffledCorrects,
        type,
        time: useOverrideTime ? overrideTime : (q.time || 0),
        pointsMultiplier: Number(q.pointsMultiplier) > 1 ? 2 : 1,
        image: q.image || '',
        video: q.video || ''
      };
    });
  }

  function clearQuestionStartTimer(game) {
    if (game && game.gameData && game.gameData.questionStartTimer) {
      clearTimeout(game.gameData.questionStartTimer);
      game.gameData.questionStartTimer = null;
    }
  }

  function getCurrentQuestionPayload(game) {
    if (!game || !game.gameData) return null;
    const questions = game.gameData.questions || [];
    const questionNum = (Number(game.gameData.question) || 1) - 1;
    const current = questions[questionNum];
    if (!current) return null;
    const meta = getQuestionMeta(current);
    const answerList = Array.isArray(current.answers) ? current.answers : [];
    const answer1 = answerList[0];
    const answer2 = answerList[1];
    const answer3 = answerList[2];
    const answer4 = answerList[3];
    // Correspondencia: el anfitrión recibe también la solución; el alumnado, solo las columnas.
    const matching = meta.type === 'matching'
      ? { matchLeft: meta.matchLeft, matchRight: meta.matchRight }
      : null;
    const image = current.image || '';
    const video = current.video || '';
    const time = (game.gameData.options && game.gameData.options.timePerQuestion) || current.time || 20;
    const pointsMultiplier = Number(current.pointsMultiplier) > 1 ? 2 : 1;
    return {
      current,
      meta,
      image,
      video,
      time,
      hostPayload: {
        q1: current.question,
        a1: answer1,
        a2: answer2,
        a3: answer3,
        a4: answer4,
        correct: current.correct,
        correctAnswers: meta.correctAnswers,
        type: meta.type,
        image,
        video,
        pointsMultiplier,
        playersInGame: players.getPlayers(game.hostId).length,
        showScores: game.gameData.options ? game.gameData.options.showScoresBetween !== false : true,
        questionNumber: game.gameData.question,
        totalQuestions: game.gameData.totalQuestions || questions.length,
        time,
        ...(matching ? { ...matching, matchSolution: meta.matchSolution } : {})
      },
      playerPayload: {
        question: current.question,
        answers: [answer1, answer2, answer3, answer4],
        type: meta.type,
        image,
        video,
        pointsMultiplier,
        time,
        ...(matching || {})
      }
    };
  }

  // Decidix si el jugador rep la pregunta completa o un payload "a cegues"
  // (sense text, només el nombre de respostes actives) quan l'amfitrió ha
  // desmarcat "Mostra la pregunta a l'alumnat" (options.sendToStudents).
  function buildStudentPlayerPayload(playerPayload, options) {
    const sendFull = !options || options.sendToStudents !== false;
    if (sendFull) return playerPayload;
    const answerCount = (playerPayload.answers || [])
      .filter((a) => a && String(a).trim()).length;
    // Correspondencia a ciegas: solo el número de elementos de cada columna; el móvil
    // muestra números (izquierda) y letras (derecha), y el texto está en el proyector.
    const matchingCounts = playerPayload.type === 'matching'
      ? {
        leftCount: (playerPayload.matchLeft || []).length,
        rightCount: (playerPayload.matchRight || []).length,
        blindStyle: normalizeMatchingBlindStyle(options.matchingBlindStyle)
      }
      : {};
    return {
      blind: true,
      answerCount,
      ...matchingCounts,
      type: playerPayload.type,
      pointsMultiplier: playerPayload.pointsMultiplier,
      time: playerPayload.time
    };
  }

  function startCurrentQuestion(game) {
    if (!game || !game.gameData || game.gameOver) return;
    clearQuestionStartTimer(game);
    const payload = getCurrentQuestionPayload(game);
    if (!payload) return;
    game.gameData.questionPending = false;
    game.gameData.questionLive = true;
    game.gameData.questionStartedAt = Date.now();
    io.to(game.hostId).emit('gameQuestions', payload.hostPayload);
    emitAutoAdvanceState(game);
    io.to(game.pin).emit('questionMedia', { image: payload.image, video: payload.video });
    io.to(game.pin).emit('playerQuestion', buildStudentPlayerPayload(payload.playerPayload, game.gameData.options));
  }

  function scheduleQuestionCountdown(game, delaySeconds = QUESTION_COUNTDOWN_SECONDS) {
    if (!game || !game.gameData) return;
    clearQuestionStartTimer(game);
    const seconds = Math.max(0, Math.round(Number(delaySeconds) || 0));
    game.gameData.questionLive = false;
    game.gameData.questionPending = true;
    game.gameData.questionCountdownEndsAt = Date.now() + (seconds * 1000);
    io.to(game.pin).emit('questionCountdown', {
      seconds,
      questionNumber: game.gameData.question,
      totalQuestions: game.gameData.totalQuestions || (game.gameData.questions || []).length
    });
    game.gameData.questionStartTimer = setTimeout(() => {
      startCurrentQuestion(game);
    }, seconds * 1000);
  }

  // 'allCorrect'/'allWrong' cuando el 100% del grupo acierta o falla la pregunta
  // (para la celebración/"funeral" del cliente); null si está mezclado o no hay jugadores.
  function getGroupAnswerResult(playerData, meta) {
    const list = Array.isArray(playerData) ? playerData : [];
    if (!list.length) return null;
    if (meta && meta.type === 'poll') return null;
    let correctCount = 0;
    list.forEach((player) => {
      if (isSubmissionCorrect(meta, player && player.gameData ? player.gameData.answer : undefined)) {
        correctCount += 1;
      }
    });
    if (correctCount === list.length) return 'allCorrect';
    if (correctCount === 0) return 'allWrong';
    return null;
  }

  // Avance automático: tras los resultados, el servidor pide al anfitrión que avance
  // (clasificación o siguiente pregunta). El anfitrión responde con el paso que ha dado.
  function autoAdvanceSecondsOf(game) {
    return normalizeAutoAdvance(game && game.gameData && game.gameData.options && game.gameData.options.autoAdvanceSec);
  }

  function emitAutoAdvanceState(game, extra) {
    if (!game || !game.gameData) return;
    const t = game.gameData.autoAdvance;
    const state = {
      seconds: autoAdvanceSecondsOf(game),
      active: !!(t && !t.cancelled),
      paused: !!(t && t.paused),
      remainingMs: t && !t.cancelled ? t.snapshot().remainingMs : 0,
      ...(extra || {})
    };
    io.to(game.pin).emit('autoAdvanceState', state);
  }

  function stopAutoAdvance(game) {
    if (!game || !game.gameData || !game.gameData.autoAdvance) return;
    game.gameData.autoAdvance.cancel();
    game.gameData.autoAdvance = null;
    emitAutoAdvanceState(game);
  }

  function armAutoAdvance(game) {
    const seconds = autoAdvanceSecondsOf(game);
    if (!seconds || !game.gameData) return;
    const question = game.gameData.question;
    const current = game.gameData.autoAdvance;
    // Idempotente: una misma pregunta no vuelve a armarse si ya está en marcha.
    if (current && current.question === question && !current.cancelled) return;
    if (current) current.cancel();
    const timer = new AutoAdvanceTimer(seconds * 1000, () => {
      io.to(game.hostId).emit('autoAdvanceStep');
    });
    timer.question = question;
    game.gameData.autoAdvance = timer;
    timer.start();
    emitAutoAdvanceState(game);
  }

  // El anfitrión avanzó un paso de resultados: si sigue en resultados (clasificación), rearma.
  function onAutoAdvanceStepDone(game, stage) {
    const t = game && game.gameData && game.gameData.autoAdvance;
    if (!t || t.cancelled) return;
    if (stage === 'ranking') {
      t.rearm();
      emitAutoAdvanceState(game);
    } else if (stage !== 'next') {
      stopAutoAdvance(game);
    }
  }

  function setAutoAdvancePaused(game, paused) {
    if (!game || !game.gameData) return;
    game.paused = !!paused;
    const t = game.gameData.autoAdvance;
    if (t && !t.cancelled) {
      if (paused) t.pause(); else t.resume();
    }
    emitAutoAdvanceState(game);
  }

  function emitQuestionOverPayload(game) {
    if (!game) return;
    const playerData = players.getPlayers(game.hostId);
    // Racha de aciertos (feature 11): quien no ha respondido esta pregunta la reinicia.
    // Es idempotente: al reiniciarse no vuelve a cambiar en un segundo aviso.
    if (isStreakEnabled(game)) {
      let changed = false;
      playerData.forEach((p) => {
        if (p.gameData && p.gameData.answeredQuestion !== game.gameData.question && (Number(p.gameData.streak) || 0) !== 0) {
          p.gameData.streak = 0;
          changed = true;
        }
      });
      if (changed) {
        io.to(game.hostId).emit('answerStatus', buildAnswerStatus(playerData, game.gameData.question, leftListOf(game, playerData)));
      }
    }
    const questions = game.gameData.questions || [];
    const current = questions[game.gameData.question - 1];
    const meta = getQuestionMeta(current);
    meta.groupResult = getGroupAnswerResult(playerData, meta);
    meta.showScores = game.gameData.options ? game.gameData.options.showScoresBetween !== false : true;
    // «Mostrar respuestas»: en una correspondencia, el proyector solo enseña la solución si está activado.
    meta.showCorrectAnswers = showCorrectAnswersOf(game);
    // El anfitrión recibe el resultado completo; el alumnado, sin la respuesta correcta si está desactivado.
    io.to(game.hostId).emit('questionOver', playerData, meta);
    io.to(game.pin).except(game.hostId).emit('questionOver', playerData, studentMetaOf(game, meta));
    armAutoAdvance(game);
  }

  function emitQuestionOverPayloadDeferred(game, delayMs = 250) {
    if (!game || !game.gameData) return;
    if (game.gameData.questionOverEmitTimer) {
      clearTimeout(game.gameData.questionOverEmitTimer);
    }
    game.gameData.questionOverEmitTimer = setTimeout(() => {
      game.gameData.questionOverEmitTimer = null;
      emitQuestionOverPayload(game);
    }, delayMs);
  }

  return {
    timingsFor,
    stopAutoAdvance,
    emitAutoAdvanceState,
    onAutoAdvanceStepDone,
    setAutoAdvancePaused,
    autoAdvanceSecondsOf,
    scheduleGameCleanup,
    markHostConnected,
    scheduleHostReconnectCleanup,
    buildQuestions,
    getCurrentQuestionPayload,
    startCurrentQuestion,
    buildStudentPlayerPayload,
    scheduleQuestionCountdown,
    emitQuestionOverPayload,
    emitQuestionOverPayloadDeferred,
    allowAnswer,
    recordPlayerAnswerHistory,
    logGames: (tag) => logGames(games, tag)
  };
};
