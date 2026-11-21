// Modo autoritme (feature 3): eventos de socket. Cada alumno pide su pregunta y la contesta
// con su propio reloj; el servidor valida y puntúa (services/selfPaced.js).
//
// Alumno → servidor: spNext, spAnswer(valor), spTimeUp, spHand({raised})
// Servidor → alumno: spQuestion, spResult, spAnswered, spFinished (y GameOver al cerrar)
// Anfitrión → servidor: spProgressRequest, spEnd
// Servidor → anfitrión: spProgress
const sp = require('../services/selfPaced');
const payloads = require('../services/selfPacedPayloads');
const { getQuestionMeta, normalizeSubmission } = require('../questionUtils');
const { logger } = require('../logger');

module.exports = function createSelfPacedEvents({
  io,
  games,
  players,
  helpers,
  cacheFinishedSessionReport,
  incrementQuizStats,
  commons
}) {
  const { allowAnswer, buildStudentPlayerPayload, scheduleGameCleanup, timingsFor } = helpers;

  function contextOf(socket) {
    const player = players.getPlayer(socket.id);
    const game = player ? games.getGame(player.hostId) : null;
    if (!game || !game.gameData || !sp.isSelfPaced(game)) return null;
    return { player, game };
  }

  // Como en el modo en vivo, el ranking depende de la casilla «Mostrar puntuaciones y ranking».
  function showScoresOf(game) {
    return game.gameData.options ? game.gameData.options.showScoresBetween !== false : true;
  }

  // Lo que ve el anfitrión: avance por alumno; con puntuaciones activadas, también los puntos (Top 10 en su pantalla).
  function progressList(game) {
    const showScores = showScoresOf(game);
    return players.getPlayers(game.hostId).map((p) => Object.assign(
      { playerId: p.playerId, name: p.name, icon: p.icon || '' },
      sp.progressOf(game, p),
      showScores ? { score: p.gameData.score || 0 } : {}
    ));
  }

  // Top 10 para el alumno tras cada resultado (solo con puntuaciones activadas).
  function rankingFor(game, player) {
    const sorted = players.getPlayers(game.hostId).slice().sort((a, b) => b.gameData.score - a.gameData.score);
    return {
      ranking: sorted.slice(0, 10).map((p) => ({ name: p.name, icon: p.icon || '', score: p.gameData.score || 0, me: p === player })),
      rank: sorted.indexOf(player) + 1,
      players: sorted.length
    };
  }
  function emitProgress(game) {
    io.to(game.hostId).emit('spProgress', progressList(game));
  }

  const questionPayload = (game, player, now) => payloads.questionPayload(game, player, now, buildStudentPlayerPayload);

  function finishedPayload(game, player) {
    const ranking = players.getPlayers(game.hostId).slice().sort((x, y) => y.gameData.score - x.gameData.score);
    // Ranking solo al final y solo si el anfitrión muestra puntuaciones.
    return {
      ...payloads.finishedPayload(game, player),
      ...(showScoresOf(game) ? { rank: ranking.findIndex((p) => p === player) + 1, players: ranking.length } : {})
    };
  }

  function sendQuestion(socket, game, player, now) {
    socket.emit('spQuestion', questionPayload(game, player, now));
    const q = sp.currentQuestion(game, player);
    socket.emit('questionMedia', { image: q.image || '', video: q.video || '' });
  }

  // Estado actual del alumno (primera carga o reconexión).
  function resume(socket, game, player) {
    const now = Date.now();
    const state = sp.ensureState(player);
    if (state.finished) { socket.emit('spFinished', finishedPayload(game, player)); return; }
    if (state.index === 0) { socket.emit('spIdle'); return; } // aún no ha pedido la primera pregunta
    if (!state.answered && sp.remainingMs(game, player, now) === 0 && sp.expireQuestion(game, player, now)) {
      emitProgress(game);
    }
    if (state.answered) { socket.emit('spAnswered', { questionNumber: state.index, totalQuestions: sp.progressOf(game, player).total }); return; }
    sendQuestion(socket, game, player, now);
  }

  function resultPayload(game, player, res) {
    return { ...payloads.resultPayload(game, player, res), ...(showScoresOf(game) ? rankingFor(game, player) : {}) };
  }

  // Cinco primeros (solo quien tiene puntos) y si se muestra el podio.
  function podiumOf(game) {
    const top = players.getPlayers(game.hostId).slice().sort((a, b) => b.gameData.score - a.gameData.score).slice(0, 5);
    const name = (i) => (top[i] && top[i].gameData.score > 0 ? top[i].name : '');
    return {
      num1: name(0), num2: name(1), num3: name(2), num4: name(3), num5: name(4),
      showPodium: showScoresOf(game)
    };
  }

  async function finishGame(game) {
    if (game.gameOver) return;
    const playersInGame = players.getPlayers(game.hostId);
    playersInGame.forEach((p) => sp.finishPlayer(p));
    game.gameLive = false;
    game.gameOver = true;
    game.gameData.selfPacedEnded = true;
    // Cada alumno recibe su resumen; después, el cierre general (podio) para quien lo muestra.
    playersInGame.forEach((p) => io.to(p.playerId).emit('spFinished', finishedPayload(game, p)));
    io.to(game.pin).emit('GameOver', podiumOf(game));
    emitProgress(game);
    logger.info('Partida autoritme finalitzada', { tag: 'game-end', pin: game.pin, hostId: game.hostId, playersCount: playersInGame.length });
    cacheFinishedSessionReport(game, playersInGame);
    await incrementQuizStats(game.gameData.gameid, playersInGame.length);
    await commons.reportCommonsScores(game, playersInGame);
    scheduleGameCleanup(game.hostId);
  }

  function register(socket) {
    socket.on('spNext', () => {
      const ctx = contextOf(socket);
      if (!ctx || ctx.game.gameOver || !ctx.game.gameLive) return;
      const { game, player } = ctx;
      const now = Date.now();
      const state = sp.ensureState(player);
      if (state.finished) { socket.emit('spFinished', finishedPayload(game, player)); return; }
      // No se salta una pregunta en curso: si aún hay tiempo, se reenvía la actual.
      if (state.index > 0 && !state.answered && !sp.expireQuestion(game, player, now)) {
        sendQuestion(socket, game, player, now);
        return;
      }
      if (!sp.beginNext(game, player, now)) {
        socket.emit('spFinished', finishedPayload(game, player));
      } else {
        sendQuestion(socket, game, player, now);
      }
      emitProgress(game);
      scheduleGameCleanup(game.hostId, timingsFor(game.hostId).inactivityMs);
    });

    socket.on('spAnswer', (value) => {
      const ctx = contextOf(socket);
      if (!ctx) { socket.emit('noGameFound'); return; }
      const { game, player } = ctx;
      if (!allowAnswer(socket, game.hostId)) { socket.emit('tooManyAnswers'); return; }
      if (game.gameOver) { socket.emit('answerRejected', { reason: 'game-over' }); return; }
      const q = sp.currentQuestion(game, player);
      if (!q) { socket.emit('answerRejected', { reason: 'no-question' }); return; }
      const submission = normalizeSubmission(getQuestionMeta(q), value);
      const res = sp.submitAnswer(game, player, submission, Date.now());
      if (!res.ok) { socket.emit('answerRejected', { reason: res.reason }); return; }
      player.gameData.sp.hand = false; // contestada: la mano ya no hace falta
      socket.emit('spResult', resultPayload(game, player, res));
      emitProgress(game);
    });

    // El cliente avisa de que se acabó el tiempo; el servidor lo comprueba con su reloj.
    socket.on('spTimeUp', () => {
      const ctx = contextOf(socket);
      if (!ctx) return;
      const { game, player } = ctx;
      if (!sp.expireQuestion(game, player, Date.now())) return;
      player.gameData.sp.hand = false;
      socket.emit('spResult', resultPayload(game, player, { outcome: 'timeout', scoreRatio: 0, points: 0, bonus: 0 }));
      emitProgress(game);
    });

    // Mano alzada: solo con una pregunta en curso; el anfitrión la ve junto al nombre.
    socket.on('spHand', (data) => {
      const ctx = contextOf(socket);
      if (!ctx || ctx.game.gameOver) return;
      const state = sp.ensureState(ctx.player);
      if (state.finished || state.index === 0) return;
      state.hand = !!(data && data.raised);
      emitProgress(ctx.game);
    });

    socket.on('spProgressRequest', () => {
      const game = games.getGame(socket.id);
      if (game && sp.isSelfPaced(game)) emitProgress(game);
    });

    socket.on('spEnd', () => {
      const game = games.getGame(socket.id);
      if (!game || !sp.isSelfPaced(game)) return;
      finishGame(game).catch((err) => logger.error('spEnd error', { tag: 'spEnd', error: err && err.message ? err.message : String(err) }));
    });
  }

  return { register, resume, emitProgress, podiumOf, startPlayers: (game) => players.getPlayers(game.hostId).forEach((p) => { delete p.gameData.sp; }) };
};
