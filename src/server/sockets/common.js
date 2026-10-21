const { getGamesCollection } = require('../data/repositories');

// disconnect, getScore, time, timeUp, requestDbNames — esdeveniments de
// socket que no són específics ni d'amfitrió ni d'alumnat.
module.exports = function createCommonEvents({ io, games, players, helpers, selectQuizzesForUser }) {
  const { scheduleHostReconnectCleanup, HOST_RECONNECT_GRACE_MS, PLAYER_RECONNECT_GRACE_MS, scheduleGameCleanup, GAME_INACTIVITY_TIMEOUT, emitQuestionOverPayloadDeferred, logGames } = helpers;

  return function registerCommonEvents(socket) {
    socket.on('disconnect', () => {
      const game = games.getGame(socket.id);
      if (game) {
        if (game.gameLive === false) {
          scheduleHostReconnectCleanup(game, socket.id);
          io.to(game.pin).emit('hostReconnecting', {
            reconnectGraceMs: HOST_RECONNECT_GRACE_MS
          });
        } else {
          scheduleHostReconnectCleanup(game, socket.id);
          io.to(game.pin).emit('hostReconnecting', {
            reconnectGraceMs: HOST_RECONNECT_GRACE_MS
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
            }, PLAYER_RECONNECT_GRACE_MS);
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
        scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);
      } catch (err) {
        console.error('timeUp error', err);
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
        console.error('requestDbNames error', err);
        socket.emit('gameNamesData', []);
      }
    });
  };
};
