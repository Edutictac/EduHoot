const { getQuestionMeta, normalizeCorrectAnswers } = require('../questionUtils');

// player-join, player-join-game, playerAnswer.
module.exports = function createPlayerEvents({
  io,
  games,
  players,
  helpers,
  commons,
  normalizeSoloName,
  normalizePlayerName,
  getSubmissionScoreRatio,
  calculateQuestionScore
}) {
  const {
    GAME_INACTIVITY_TIMEOUT,
    PLAYER_RECONNECT_GRACE_MS,
    allowAnswer,
    scheduleGameCleanup,
    emitQuestionOverPayloadDeferred,
    recordPlayerAnswerHistory,
    logGames
  } = helpers;

  return function registerPlayerEvents(socket) {
    socket.on('player-join', (params) => {
      console.log('[player-join] params:', {
        pin: params && params.pin ? String(params.pin) : '',
        name: params && params.name ? normalizeSoloName(params.name) : '',
        hasToken: !!(params && params.token),
        hasStudentJoinToken: !!(params && params.studentJoinToken)
      });
      logGames('player-join');
      const pinParam = params.pin ? params.pin.toString() : '';
      const token = params.token;

      const game = pinParam ? games.getGameByPin(pinParam) : null;
      if (!game) {
        console.log('[player-join] noGameFound for pin:', params.pin);
        socket.emit('noGameFound');
        return;
      }

      console.log('Player connected to game pin', pinParam);
      const hostId = game.hostId;

      let existing = null;
      if (token) {
        existing = players.getByToken(token);
        if (existing && existing.hostId === hostId) {
          existing.playerId = socket.id;
          socket.join(game.pin);
          const playersInGame = players.getPlayers(hostId);
          io.to(game.pin).emit('updatePlayerLobby', playersInGame);
          io.to(hostId).emit('updatePlayerLobby', playersInGame);
          socket.emit('playerJoinAck', { ok: true, pin: game.pin, hostId });
          socket.emit('playerRejoin', { ok: true });
          if (game.gameLive) {
            socket.emit('gameStartedPlayer');
          }
          console.log('[player-join] rejoined pin:', game.pin, 'playerId:', socket.id);
          return;
        }
      }

      let studentIdentity = null;
      if (commons.isStudentIdentityEnabled()) {
        studentIdentity = commons.consumeStudentJoinToken(params.studentJoinToken);
        if (commons.EDUTICTAC_ID_AUTH_REQUIRED && !studentIdentity) {
          socket.emit('playerJoinRejected', { error: 'Identificació de l’alumnat no vàlida.' });
          return;
        }
      }

      const safeName = studentIdentity ? normalizePlayerName(studentIdentity.public_code) : normalizeSoloName(params.name);
      players.addPlayer(hostId, socket.id, safeName, {
        score: 0,
        answer: 0,
        correctCount: 0,
        wrongCount: 0,
        answerHistory: [],
        identity: studentIdentity || null
      }, studentIdentity && studentIdentity.avatar_icon ? studentIdentity.avatar_icon : (params.icon || ''), token);
      socket.join(game.pin);

      const playersInGame = players.getPlayers(hostId);
      io.to(game.pin).emit('updatePlayerLobby', playersInGame);
      io.to(hostId).emit('updatePlayerLobby', playersInGame);
      socket.emit('playerJoinAck', { ok: true, pin: game.pin, hostId });
      if (game.gameLive) {
        socket.emit('gameStartedPlayer');
      }
      console.log('[player-join] joined pin:', game.pin, 'playerId:', socket.id);
    });

    socket.on('player-join-game', (data) => {
      let player = players.getPlayer(data.id);
      if (!player && data.token) {
        player = players.getByToken(data.token);
        if (player) {
          player.playerId = socket.id;
        }
      }
      if (player) {
        const game = games.getGame(player.hostId);
        if (!game) {
          socket.emit('noGameFound');
          return;
        }
        socket.join(game.pin);
        player.playerId = socket.id;
        socket.emit('playerGracePeriod', { ms: PLAYER_RECONNECT_GRACE_MS });

        const playerData = players.getPlayers(game.hostId);
        socket.emit('playerGameData', playerData);
        const questions = game.gameData.questions || [];
        const current = questions[game.gameData.question - 1];
        if (current) {
          if (game.gameData.questionPending) {
            socket.emit('questionCountdown', {
              seconds: Math.max(0, Math.ceil(((game.gameData.questionCountdownEndsAt || Date.now()) - Date.now()) / 1000)),
              questionNumber: game.gameData.question,
              totalQuestions: game.gameData.totalQuestions || questions.length
            });
            return;
          }
          const questionTimeSecs = (game.gameData.options && game.gameData.options.timePerQuestion) || current.time || 20;
          let timeLeft = questionTimeSecs;
          if (game.gameData.questionLive && game.gameData.questionStartedAt) {
            const elapsed = Math.floor((Date.now() - game.gameData.questionStartedAt) / 1000);
            timeLeft = Math.max(0, questionTimeSecs - elapsed);
          }
          socket.emit('playerQuestion', {
            question: current.question,
            answers: current.answers,
            type: current.type || 'quiz',
            image: current.image || '',
            video: current.video || '',
            pointsMultiplier: Number(current.pointsMultiplier) > 1 ? 2 : 1,
            time: timeLeft
          });
          socket.emit('questionMedia', { image: current.image || '', video: current.video || '' });
          // Si la pregunta ya cerró, informar al jugador reconectado
          if (game.gameData.questionLive === false) {
            const meta = getQuestionMeta(current);
            const allPlayers = players.getPlayers(game.hostId);
            socket.emit('questionOver', allPlayers, meta);
          }
        }
      } else {
        socket.emit('noGameFound');
      }
    });

    socket.on('playerAnswer', async (num) => {
      const player = players.getPlayer(socket.id);
      if (!player) {
        socket.emit('noGameFound');
        return;
      }
      const hostId = player.hostId;
      if (!allowAnswer(socket, hostId)) {
        socket.emit('tooManyAnswers');
        return;
      }
      const playerNum = players.getPlayers(hostId);
      const game = games.getGame(hostId);
      if (!game || !game.gameData) {
        socket.emit('noGameFound');
        return;
      }

      if (game.gameData.questionLive !== true) {
        if (game.gameData.questionPending) {
          socket.emit('answerRejected', { reason: 'countdown' });
          return;
        }
        const looksLikeFirstQuestionRace = game.gameLive === true
          && Number(game.gameData.question || 0) === 1
          && Number(game.gameData.playersAnswered || 0) === 0;
        if (looksLikeFirstQuestionRace) {
          game.gameData.questionLive = true;
        } else {
          socket.emit('answerRejected', { reason: 'question-not-live' });
          return;
        }
      }

      // Evitar doble respuesta: si el jugador ya respondió (tras reconexión), rechazar
      if (player.gameData.answer !== undefined && player.gameData.answer !== 0) {
        socket.emit('answerRejected', { reason: 'already-answered' });
        return;
      }

      if (game.gameData.questionLive === true) {
        game.gameData.playersAnswered += 1;

        const gameQuestion = game.gameData.question;
        try {
          const questions = game.gameData.questions || [];
          const current = questions[gameQuestion - 1];
          if (!current) {
            socket.emit('noGameFound');
            return;
          }

          const meta = getQuestionMeta(current);
            let normalizedSubmission;
            if (meta.type === 'multiple') {
              normalizedSubmission = normalizeCorrectAnswers(num, false);
            } else if (meta.type === 'short-answer') {
              if (num && typeof num === 'object' && num.text !== undefined) {
                normalizedSubmission = { text: String(num.text || '') };
              } else {
                normalizedSubmission = { text: String(num || '') };
              }
            } else if (meta.type === 'numeric') {
              if (num && typeof num === 'object' && num.number !== undefined) {
                normalizedSubmission = { number: num.number };
              } else {
                normalizedSubmission = { number: num };
              }
            } else {
              normalizedSubmission = Number(num);
            }
            player.gameData.answer = normalizedSubmission;

            const isPoll = meta.type === 'poll';
            const scoreRatio = getSubmissionScoreRatio(meta, normalizedSubmission);
            const isCorrect = !isPoll && scoreRatio === 1;
            if (scoreRatio > 0) {
              player.gameData.score += Math.round(calculateQuestionScore(game) * scoreRatio);
            }
            if (isCorrect) {
              player.gameData.correctCount = (Number(player.gameData.correctCount) || 0) + 1;
              socket.emit('answerResult', { outcome: 'correct' });
            } else if (scoreRatio > 0) {
              socket.emit('answerResult', { outcome: 'partial', ratio: scoreRatio });
            } else if (isPoll) {
              socket.emit('answerResult', { outcome: 'poll' });
            } else {
              player.gameData.wrongCount = (Number(player.gameData.wrongCount) || 0) + 1;
              socket.emit('answerResult', { outcome: 'incorrect' });
            }
            recordPlayerAnswerHistory(player, game, gameQuestion, normalizedSubmission, isCorrect);

          if (game.gameData.playersAnswered === playerNum.length) {
            game.gameData.questionLive = false;
            // Agotar tiempo en clientes porque ya contestaron todos
            io.to(game.pin).emit('time', { player: player.hostId, time: 0 });
            // Dejamos un margen corto para que los clientes reciban el feedback antes del ranking.
            emitQuestionOverPayloadDeferred(game);
          } else {
            io.to(game.pin).emit('updatePlayersAnswered', {
              playersInGame: playerNum.length,
              playersAnswered: game.gameData.playersAnswered
            });
          }
          scheduleGameCleanup(hostId, GAME_INACTIVITY_TIMEOUT);
        } catch (err) {
          console.error('playerAnswer error', err);
          socket.emit('noGameFound');
        }
      }
    });
  };
};
