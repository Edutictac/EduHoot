const { test } = require('node:test');
const assert = require('node:assert/strict');
const createHostEvents = require('../../server/sockets/hostEvents');

test('el drenatge impide crear una partida después de la búsqueda asíncrona', async () => {
  const handlers = {};
  const emitted = [];
  let addGameCalled = false;
  const socket = {
    on: (event, handler) => { handlers[event] = handler; },
    emit: (event, payload) => { emitted.push({ event, payload }); }
  };
  const register = createHostEvents({
    games: {
      getGameByPin: () => null,
      addGame: () => { addGameCalled = true; }
    },
    isDeploymentDraining: () => true,
    findGameById: async () => ({ questions: [{ question: 'Pregunta' }] }),
    canUseQuiz: () => true,
    isMultiplayerFreeTypeQuestion: () => false,
    helpers: {}
  });
  register(socket);

  await handlers['host-join']({ id: 123 });
  assert.equal(addGameCalled, false);
  assert.equal(emitted[0]?.event, 'hostError');
  assert.match(emitted[0]?.payload?.error || '', /actualizando/);
});
