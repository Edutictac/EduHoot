const { getGamesCollection } = require('../data/repositories');

// host-join, host-join-game, startGame, nextQuestion, skipQuestion, newQuiz.
module.exports = function createHostEvents({
  io,
  games,
  players,
  helpers,
  findGameById,
  canUseQuiz,
  cleanImportedText,
  isMultiplayerFreeTypeQuestion,
  cacheFinishedSessionReport,
  incrementQuizStats,
  commons,
  nextGameId,
  normalizeQuestions,
  normalizeTags,
  normalizeVisibility,
  normalizeAllowClone,
  GLOBAL_OWNER_ID,
  GLOBAL_OWNER_EMAIL
}) {
  const {
    GAME_INACTIVITY_TIMEOUT,
    markHostConnected,
    scheduleGameCleanup,
    getCurrentQuestionPayload,
    buildQuestions,
    scheduleQuestionCountdown,
    logGames
  } = helpers;

  return function registerHostEvents(socket) {
    socket.on('host-join', async (data) => {
      try {
        const pinParam = data && data.pin ? data.pin.toString() : '';
        const existingByPin = pinParam ? games.getGameByPin(pinParam) : null;
        if (existingByPin && existingByPin.gameData && String(existingByPin.gameData.gameid) === String(data.id)) {
          const previousHostId = existingByPin.hostId;
          markHostConnected(existingByPin);
          existingByPin.hostId = socket.id;
          existingByPin.gameOver = false;
          scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);
          socket.join(existingByPin.pin);

          for (let i = 0; i < Object.keys(players.players).length; i++) {
            if (players.players[i].hostId === previousHostId) {
              players.players[i].hostId = socket.id;
            }
          }

          const playersInGame = players.getPlayers(socket.id);
          socket.emit('showGamePin', { pin: existingByPin.pin });
          socket.emit('updatePlayerLobby', playersInGame);
          io.to(existingByPin.pin).emit('hostReconnected');
          return;
        }

        const kahoot = await findGameById(data.id);

        if (kahoot && canUseQuiz(kahoot, socket.user)) {
          let gamePin = null;
          for (let attempt = 0; attempt < 30; attempt++) {
            const candidate = Math.floor(Math.random() * 90000) + 10000;
            if (!games.getGameByPin(candidate)) {
              gamePin = candidate;
              break;
            }
          }
          if (!gamePin) {
            socket.emit('hostError', {
              error: 'No se pudo generar un PIN único. Inténtalo de nuevo.'
            });
            return;
          }

          const originalQuestions = Array.isArray(kahoot.questions) ? kahoot.questions : [];
          const multiplayerQuestions = originalQuestions.filter((q) => !isMultiplayerFreeTypeQuestion(q));
          if (multiplayerQuestions.length === 0) {
            socket.emit('hostError', {
              error: 'Este quiz no tiene preguntas compatibles con multijugador (se omiten las de escribir: respuesta corta/numérica).'
            });
            socket.emit('noGameFound');
            return;
          }

          games.addGame(gamePin, socket.id, false, {
            playersAnswered: 0,
            questionLive: false,
            gameid: data.id,
            quizName: cleanImportedText(kahoot.name || ''),
            question: 1,
            questions: [],
            originalQuestions: multiplayerQuestions,
            totalQuestions: multiplayerQuestions.length,
            options: {
              randomQuestions: false,
              randomAnswers: true,
              sendToMobile: true,
              showScoresBetween: true
            }
          });

          const game = games.getGame(socket.id);
          game.gameOver = false;
          scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);

          socket.join(game.pin);

          console.log('Game Created with pin:', game.pin);
          logGames('host-join');

          socket.emit('showGamePin', {
            pin: game.pin
          });
        } else {
          socket.emit('noGameFound');
        }
      } catch (err) {
        console.error('host-join error', err);
        socket.emit('noGameFound');
      }
    });

    socket.on('host-join-game', async (data) => {
      const oldHostId = data.id;
      const pinParam = data.pin ? data.pin.toString() : '';
      const game = games.getGame(oldHostId) || (pinParam ? games.getGameByPin(pinParam) : null);
      if (game) {
        const previousHostId = game.hostId;
        markHostConnected(game);
        game.hostId = socket.id;
        game.gameOver = false;
        scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);
        socket.join(game.pin);
        const playerData = players.getPlayers(previousHostId);
        for (let i = 0; i < Object.keys(players.players).length; i++) {
          if (players.players[i].hostId === previousHostId) {
            players.players[i].hostId = socket.id;
          }
        }
        const gameid = game.gameData.gameid;
        try {
          const kahootQuestions = game.gameData.questions || game.gameData.originalQuestions || [];
          if (kahootQuestions.length === 0) {
            socket.emit('noGameFound');
            return;
          }

          const currentIdx = Math.max(0, Math.min((game.gameData.question || 1) - 1, kahootQuestions.length - 1));
          const currentQuestion = kahootQuestions[currentIdx];
          const countdownRemaining = game.gameData.questionPending
            ? Math.max(0, Math.ceil(((game.gameData.questionCountdownEndsAt || Date.now()) - Date.now()) / 1000))
            : 0;

          if (game.gameData.questionPending) {
            socket.emit('questionCountdown', {
              seconds: countdownRemaining,
              questionNumber: game.gameData.question,
              totalQuestions: game.gameData.totalQuestions || kahootQuestions.length || 0
            });
          } else {
            const payload = getCurrentQuestionPayload(game);
            if (payload) {
              socket.emit('gameQuestions', {
                ...payload.hostPayload,
                playersInGame: playerData.length
              });
            }
          }
          socket.emit('gamePin', { pin: game.pin });
          socket.emit('hostSession', { hostId: game.hostId, pin: game.pin });
          io.to(game.pin).emit('hostReconnected');
          if (!game.gameData.questionPending) {
            io.to(game.pin).emit('questionMedia', { image: currentQuestion.image || '', video: currentQuestion.video || '' });
          }
          if (!game.gameData.questionPending && (!game.gameData.options || game.gameData.options.sendToMobile !== false)) {
            io.to(game.pin).emit('playerQuestion', {
              question: currentQuestion.question,
              answers: currentQuestion.answers,
              type: currentQuestion.type || 'quiz',
              image: currentQuestion.image || '',
              video: currentQuestion.video || '',
              pointsMultiplier: Number(currentQuestion.pointsMultiplier) > 1 ? 2 : 1
            });
          }
        } catch (err) {
          console.error('host-join-game error', err);
          socket.emit('noGameFound');
        }

        io.to(game.pin).emit('gameStartedPlayer');
      } else {
        socket.emit('noGameFound');
      }
    });

    socket.on('nextQuestion', async () => {
      for (let i = 0; i < Object.keys(players.players).length; i++) {
        if (players.players[i].hostId === socket.id) {
          players.players[i].gameData.answer = 0;
        }
      }

      const game = games.getGame(socket.id);
      game.gameData.playersAnswered = 0;
      game.gameData.questionLive = false;
      game.gameData.question += 1;
      game.gameData.questionStartedAt = null;

      try {
        const questions = game.gameData.questions || [];

        if (questions.length >= game.gameData.question) {
          io.to(game.pin).emit('nextQuestionPlayer');
          scheduleQuestionCountdown(game);
          scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);
          return;
        } else {
          const playersInGame = players.getPlayers(game.hostId);
          const first = { name: '', score: 0 };
          const second = { name: '', score: 0 };
          const third = { name: '', score: 0 };
          const fourth = { name: '', score: 0 };
          const fifth = { name: '', score: 0 };

          for (let i = 0; i < playersInGame.length; i++) {
            if (playersInGame[i].gameData.score > fifth.score) {
              if (playersInGame[i].gameData.score > fourth.score) {
                if (playersInGame[i].gameData.score > third.score) {
                  if (playersInGame[i].gameData.score > second.score) {
                    if (playersInGame[i].gameData.score > first.score) {
                      fifth.name = fourth.name;
                      fifth.score = fourth.score;

                      fourth.name = third.name;
                      fourth.score = third.score;

                      third.name = second.name;
                      third.score = second.score;

                      second.name = first.name;
                      second.score = first.score;

                      first.name = playersInGame[i].name;
                      first.score = playersInGame[i].gameData.score;
                    } else {
                      fifth.name = fourth.name;
                      fifth.score = fourth.score;

                      fourth.name = third.name;
                      fourth.score = third.score;

                      third.name = second.name;
                      third.score = second.score;

                      second.name = playersInGame[i].name;
                      second.score = playersInGame[i].gameData.score;
                    }
                  } else {
                    fifth.name = fourth.name;
                    fifth.score = fourth.score;

                    fourth.name = third.name;
                    fourth.score = third.score;

                    third.name = playersInGame[i].name;
                    third.score = playersInGame[i].gameData.score;
                  }
                } else {
                  fifth.name = fourth.name;
                  fifth.score = fourth.score;

                  fourth.name = playersInGame[i].name;
                  fourth.score = playersInGame[i].gameData.score;
                }
              } else {
                fifth.name = playersInGame[i].name;
                fifth.score = playersInGame[i].gameData.score;
              }
            }
          }

          io.to(game.pin).emit('GameOver', {
            num1: first.name,
            num2: second.name,
            num3: third.name,
            num4: fourth.name,
            num5: fifth.name
          });
          game.gameLive = false;
          game.gameOver = true;
          // Congelamos el informe con la foto de jugadores de este instante: si esperamos a los
          // await de abajo, los alumnos ya han recibido "GameOver" y sus dispositivos pueden
          // desconectarse (bloqueo de pantalla, cierre de pestaña...), vaciando players.getPlayers()
          // antes de generar el CSV y dejando solo a quien siga conectado como "ganador".
          cacheFinishedSessionReport(game, playersInGame);
          const uniquePlayers = Array.isArray(playersInGame) ? playersInGame.length : 0;
          await incrementQuizStats(game.gameData.gameid, uniquePlayers);
          await commons.reportCommonsScores(game, playersInGame);
          scheduleGameCleanup(socket.id);
        }
      } catch (err) {
        console.error('nextQuestion error', err);
        socket.emit('noGameFound');
      }
    });

    socket.on('skipQuestion', async () => {
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
        io.to(game.pin).emit('hostSkipped');
        helpers.emitQuestionOverPayloadDeferred(game);
        scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);
      } catch (err) {
        console.error('skipQuestion error', err);
        socket.emit('noGameFound');
      }
    });

    socket.on('startGame', (opts) => {
      let game = games.getGame(socket.id);
      if ((!game || !game.gameData) && opts && opts.pin) {
        const fallbackByPin = games.getGameByPin(opts.pin);
        if (fallbackByPin && fallbackByPin.gameData) {
          const previousHostId = fallbackByPin.hostId;
          markHostConnected(fallbackByPin);
          fallbackByPin.hostId = socket.id;
          for (let i = 0; i < Object.keys(players.players).length; i++) {
            if (players.players[i].hostId === previousHostId) {
              players.players[i].hostId = socket.id;
            }
          }
          socket.join(fallbackByPin.pin);
          game = fallbackByPin;
        }
      }
      if (!game || !game.gameData) {
        socket.emit('noGameFound');
        return;
      }
      const options = Object.assign({
        randomQuestions: false,
        randomAnswers: true,
        sendToMobile: true,
        showScoresBetween: true
      }, opts || {});
      if (options.timePerQuestion !== undefined && options.timePerQuestion !== null && String(options.timePerQuestion).trim() !== '') {
        const parsedTime = parseInt(options.timePerQuestion, 10);
        if (Number.isNaN(parsedTime)) {
          delete options.timePerQuestion;
        } else {
          options.timePerQuestion = Math.max(5, Math.min(120, parsedTime));
        }
      } else {
        delete options.timePerQuestion;
      }
      game.gameData.options = options;
      const originalQuestions = Array.isArray(game.gameData.originalQuestions) ? game.gameData.originalQuestions : [];
      // build question set based on options (incluye filtrado de tipos libres)
      game.gameData.questions = buildQuestions(originalQuestions, options);
      if (!game.gameData.questions || game.gameData.questions.length === 0) {
        socket.emit('hostError', {
          error: 'Este quiz no tiene preguntas compatibles con multijugador (se omiten las de escribir: respuesta corta/numérica).'
        });
        return;
      }
      game.gameData.totalQuestions = (game.gameData.questions || []).length;
      game.gameData.question = 1;
      game.gameData.playersAnswered = 0;
      game.gameData.questionLive = false;
      game.gameData.questionStartedAt = null;
      const gamePlayers = players.getPlayers(socket.id);
      for (let i = 0; i < gamePlayers.length; i++) {
        gamePlayers[i].gameData.answer = 0;
        gamePlayers[i].gameData.score = 0;
        gamePlayers[i].gameData.correctCount = 0;
        gamePlayers[i].gameData.wrongCount = 0;
        gamePlayers[i].gameData.answerHistory = [];
      }
      game.gameLive = true;
      game.gameOver = false;
      scheduleGameCleanup(socket.id, GAME_INACTIVITY_TIMEOUT);
      io.to(game.pin).emit('gameStartedPlayer');
      socket.emit('gameStarted', game.hostId);
      scheduleQuestionCountdown(game);
    });

    socket.on('newQuiz', async (data) => {
      try {
        const collection = await getGamesCollection();
        const newId = await nextGameId(collection);
        const quiz = {
          id: newId,
          name: (data.name || '').trim() || `Quiz ${newId}`,
          questions: normalizeQuestions(data.questions || []),
          tags: normalizeTags(data.tags || []),
          playsCount: 0,
          playersCount: 0,
          visibility: normalizeVisibility(data.visibility),
          allowClone: normalizeAllowClone(data.allowClone),
          ownerId: (socket.user && socket.user.id) || GLOBAL_OWNER_ID,
          ownerEmail: (socket.user && socket.user.email) || GLOBAL_OWNER_EMAIL,
          ownerNickname: (socket.user && socket.user.nickname) || '',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        if (!quiz.tags.length) {
          socket.emit('quizValidationError', { error: 'Añade al menos una etiqueta.' });
          return;
        }
        if (quiz.questions.length === 0) {
          socket.emit('noGameFound');
          return;
        }

        await collection.insertOne(quiz);
        socket.emit('startGameFromCreator', newId);
      } catch (err) {
        console.error('newQuiz error', err);
        socket.emit('noGameFound');
      }
    });
  };
};
