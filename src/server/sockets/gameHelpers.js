const {
  normalizeQuestionMeta,
  isFreeAnswerType,
  normalizeCorrectAnswers,
  getQuestionMeta,
  isSubmissionCorrect
} = require('../questionUtils');

const GAME_CLEANUP_DELAY = 100 * 1000; // 90 segundos tras GameOver
const GAME_INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos de inactividad
const HOST_RECONNECT_GRACE_MS = 30 * 1000; // 30 segundos para reanudar partida en aula
const PLAYER_RECONNECT_GRACE_MS = 40 * 1000; // 40 segundos para reconexion de alumno
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

function recordPlayerAnswerHistory(player, game, questionNumber, submission, isCorrect) {
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
  console.log(`[${tag}] Active games:`, pins.length ? pins.join(', ') : 'none');
}

// Factoria: la majoria d'estos helpers necessiten io/games/players, compartits
// amb la resta de server.js i amb les rutes ja mogudes en el Pas 4 — s'injecten
// en compte de moure's, igual que 'players' en services/sessionReport.js.
module.exports = function createGameHelpers({ io, games, players, cleanImportedText, isMultiplayerFreeTypeQuestion }) {
  function scheduleGameCleanup(hostId, delayMs = GAME_CLEANUP_DELAY) {
    const game = games.getGame(hostId);
    if (!game) return;
    if (game.cleanupTimer) clearTimeout(game.cleanupTimer);
    if (game.gameOver && delayMs > GAME_CLEANUP_DELAY) {
      delayMs = GAME_CLEANUP_DELAY;
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
    game.hostReconnectDeadline = game.hostDisconnectedAt + HOST_RECONNECT_GRACE_MS;
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
    }, HOST_RECONNECT_GRACE_MS);
  }

  function buildQuestions(questions = [], opts = {}) {
    const randomQ = opts.randomQuestions === true;
    const randomA = opts.randomAnswers !== false;
    const overrideTime = parseInt(opts.timePerQuestion, 10);
    const useOverrideTime = !Number.isNaN(overrideTime) && overrideTime > 0;

    const filtered = Array.isArray(questions) ? questions.filter((q) => !isMultiplayerFreeTypeQuestion(q)) : [];

    const base = randomQ ? shuffleQuestions(filtered) : [...filtered];

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
    const answer1 = current.answers[0];
    const answer2 = current.answers[1];
    const answer3 = current.answers[2];
    const answer4 = current.answers[3];
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
        time
      },
      playerPayload: {
        question: current.question,
        answers: [answer1, answer2, answer3, answer4],
        type: meta.type,
        image,
        video,
        pointsMultiplier,
        time
      }
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
    io.to(game.pin).emit('questionMedia', { image: payload.image, video: payload.video });
    if (!game.gameData.options || game.gameData.options.sendToMobile !== false) {
      io.to(game.pin).emit('playerQuestion', payload.playerPayload);
    }
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

  function emitQuestionOverPayload(game) {
    if (!game) return;
    const playerData = players.getPlayers(game.hostId);
    const questions = game.gameData.questions || [];
    const current = questions[game.gameData.question - 1];
    const meta = getQuestionMeta(current);
    meta.groupResult = getGroupAnswerResult(playerData, meta);
    io.to(game.pin).emit('questionOver', playerData, meta);
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
    GAME_INACTIVITY_TIMEOUT,
    HOST_RECONNECT_GRACE_MS,
    PLAYER_RECONNECT_GRACE_MS,
    scheduleGameCleanup,
    markHostConnected,
    scheduleHostReconnectCleanup,
    buildQuestions,
    getCurrentQuestionPayload,
    startCurrentQuestion,
    scheduleQuestionCountdown,
    emitQuestionOverPayload,
    emitQuestionOverPayloadDeferred,
    allowAnswer,
    recordPlayerAnswerHistory,
    logGames: (tag) => logGames(games, tag)
  };
};
