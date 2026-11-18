const { getGamesCollection } = require('../data/repositories');
const { logger } = require('../logger');
const { buildAnswerStatus } = require('./answerStatus');
const { recordKick, listKicked, unkick } = require('./kick');
const { normalizeTimings } = require('../services/gameTimings');

// disconnect, getScore, time, timeUp, requestDbNames — esdeveniments de
// socket que no són específics ni d'amfitrió ni d'alumnat.
module.exports = function createCommonEvents({ io, games, players, helpers, selectQuizzesForUser }) {
  const { scheduleHostReconnectCleanup, timingsFor, scheduleGameCleanup, emitQuestionOverPayloadDeferred, logGames } = helpers;

  return function registerCommonEvents(socket) {
    socket.on('disconnect', () => {
      const game = games.getGame(socket.id);
      if (game) {
        if (game.gameLive === false) {
          scheduleHostReconnectCleanup(game, socket.id);
          io.to(game.pin).emit('hostReconnecting', {
            reconnectGraceMs: timingsFor(socket.id).hostReconnectMs
          });
        } else {
          scheduleHostReconnectCleanup(game, socket.id);
          io.to(game.pin).emit('hostReconnecting', {
            reconnectGraceMs: timingsFor(socket.id).hostReconnectMs
          });
        }
      } else {
        const player = players.getPlayer(socket.id);
        if (player) {
          const hostId = player.hostId;
          const hostGame = games.getGame(hostId);
          if (hostGame) {
            const pin = hostGame.pin;
            // gracia: no expulsar al instante, esperar unos segundos por si reanuda.
            // El cliente ya usa el valor por defecto y lo recibe en join/rejoin.
            setTimeout(() => {
              const stillMissing = players.getPlayer(socket.id);
              if (stillMissing) {
                players.removePlayer(socket.id);
                logger.info('Jugador eliminat tras el marge de reconnexió', { tag: 'player-leave', pin, hostId, playerId: socket.id });
                const playersInGame = players.getPlayers(hostId);
                io.to(pin).emit('updatePlayerLobby', playersInGame);
                io.to(hostId).emit('updatePlayerLobby', playersInGame);
                io.to(pin).emit('playersUpdated', playersInGame.length);
                // Si la pregunta sigue activa y ya respondieron todos los restantes, avanzar
                const hostGame = games.getGame(hostId);
                if (hostGame && hostGame.gameData && hostGame.gameData.questionLive === true) {
                  if (hostGame.gameData.playersAnswered >= playersInGame.length && playersInGame.length > 0) {
                    hostGame.gameData.questionLive = false;
                    io.to(pin).emit('time', { player: hostId, time: 0 });
                    emitQuestionOverPayloadDeferred(hostGame);
                  }
                }
              }
            }, timingsFor(hostId).playerReconnectMs);
            socket.leave(pin);
          }
        }
      }
      logGames('disconnect');
    });

    socket.on('getScore', () => {
      const player = players.getPlayer(socket.id);
      if (!player) {
        socket.emit('noGameFound');
        return;
      }
      socket.emit('newScore', player.gameData.score);
    });

    socket.on('time', () => {
      // Scoring is computed on playerAnswer using server time.
    });

    // Solo el anfitrión (su socket es el id de la partida): pide el estado de respuesta de la pregunta actual.
    socket.on('getAnswerStatus', () => {
      const game = games.getGame(socket.id);
      if (!game || !game.gameData) return;
      socket.emit('answerStatus', buildAnswerStatus(players.getPlayers(socket.id), game.gameData.question));
    });

    // Solo el anfitrión: pausa o tiempo restante del temporizador, para que los alumnos lo sigan.
    socket.on('timerSync', (data) => {
      const game = games.getGame(socket.id);
      if (!game || !game.gameData) return;
      // Partida pausada: no se aceptan respuestas ni avance mientras dure la pausa.
      game.paused = !!(data && data.paused);
      const time = Math.max(0, Math.min(600, Math.round(Number(data && data.time) || 0)));
      io.to(game.pin).emit('timerSync', { time, paused: !!(data && data.paused) });
    });

    // Solo el anfitrión de la partida puede expulsar a un alumno (issue #29).
    // Se bloquea su token y su nombre, y se le avisa solo a él.
    socket.on('kick-player', (data) => {
      const game = games.getGame(socket.id);
      const target = players.getPlayer(data && data.playerId);
      if (!game || !target || target.hostId !== socket.id) return;
      recordKick(game, target);
      players.removePlayer(target.playerId);
      const targetSocket = io.sockets.sockets.get(target.playerId);
      if (targetSocket) targetSocket.leave(game.pin);
      io.to(target.playerId).emit('kicked');
      const playersInGame = players.getPlayers(socket.id);
      io.to(game.pin).emit('updatePlayerLobby', playersInGame);
      io.to(socket.id).emit('updatePlayerLobby', playersInGame);
      io.to(game.pin).emit('playersUpdated', playersInGame.length);
      if (game.gameData) {
        io.to(socket.id).emit('answerStatus', buildAnswerStatus(playersInGame, game.gameData.question));
      }
      io.to(socket.id).emit('kickedList', listKicked(game));
      logger.info('Jugador expulsat per l\'amfitrió', { tag: 'player-kick', pin: game.pin, hostId: socket.id, playerId: target.playerId });
    });

    // Solo el anfitrión: lista de expulsados (sin tokens) y desbloqueo de uno de ellos.
    // Solo el anfitrión: cancela la partida (tras confirmar en la pantalla). Se cierra para todos.
    socket.on('cancelGame', () => {
      const game = games.getGame(socket.id);
      if (!game) return;
      const pin = game.pin;
      if (game.cleanupTimer) clearTimeout(game.cleanupTimer);
      games.removeGame(socket.id);
      players.getPlayers(socket.id).forEach((p) => players.removePlayer(p.playerId));
      io.to(pin).emit('hostDisconnect');
      socket.emit('gameCancelled');
      logger.info('Partida cancel·lada per l\'amfitrió', { tag: 'game-cancel', pin, hostId: socket.id });
    });

    // Solo el anfitrión: ampliación de tiempos de esta partida (issue #13). Vacío = mínimos.
    // Solo afecta a temporizadores que se programen después.
    socket.on('setGameTimings', (data) => {
      const game = games.getGame(socket.id);
      if (!game) return;
      game.timingOverrides = normalizeTimings(data);
    });

    // Solo el anfitrión: nombres aleatorios para el alumnado (feature 12). Se puede cambiar en el lobby
    // mientras no haya ningún alumno unido.
    socket.on('setRandomNames', (data) => {
      const game = games.getGame(socket.id);
      if (!game) return;
      if (players.getPlayers(socket.id).length > 0) return;
      game.randomNames = !!(data && data.enabled);
    });

    socket.on('getKickedList', () => {
      const game = games.getGame(socket.id);
      if (!game) return;
      socket.emit('kickedList', listKicked(game));
    });

    socket.on('unkick-player', (data) => {
      const game = games.getGame(socket.id);
      if (!game) return;
      if (unkick(game, data && data.id)) {
        logger.info('Expulsió retirada per l\'amfitrió', { tag: 'player-unkick', pin: game.pin, hostId: socket.id });
      }
      socket.emit('kickedList', listKicked(game));
    });

    socket.on('timeUp', async () => {
      const game = games.getGame(socket.id);
      if (!game) {
        socket.emit('noGameFound');
        return;
      }
      game.gameData.questionLive = false;
      const gameQuestion = game.gameData.question;

      try {
        const questions = game.gameData.questions || [];
        const current = questions[gameQuestion - 1];
        if (!current) {
          socket.emit('noGameFound');
          return;
        }
        emitQuestionOverPayloadDeferred(game);
        scheduleGameCleanup(socket.id, timingsFor(socket.id).inactivityMs);
      } catch (err) {
        logger.error('timeUp error', { tag: 'timeUp', error: err && err.message ? err.message : String(err) });
        socket.emit('noGameFound');
      }
    });

    socket.on('requestDbNames', async () => {
      try {
        const collection = await getGamesCollection();
        const res = await collection.find().project({ questions: 0 }).toArray();
        const filtered = selectQuizzesForUser(res, socket.user);
        socket.emit('gameNamesData', filtered);
      } catch (err) {
        logger.error('requestDbNames error', { tag: 'requestDbNames', error: err && err.message ? err.message : String(err) });
        socket.emit('gameNamesData', []);
      }
    });
  };
};
