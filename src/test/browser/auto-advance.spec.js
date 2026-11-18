const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Avance automático entre preguntas: desplegable (Manual, 3–20 s), cuenta atrás y pausa.
const FAKE_SOCKET_IO = `
(function(){
    window.__emits = [];
    window.__sockets = [];
    window.io = function(){
        var handlers = {};
        var socket = {
            id: 'host-1',
            connected: false,
            on: function(name, fn){ (handlers[name] = handlers[name] || []).push(fn); return socket; },
            emit: function(name, data){ window.__emits.push({ name: name, data: JSON.parse(JSON.stringify(data === undefined ? null : data)) }); return socket; },
            connect: function(){ socket.connected = true; return socket; },
            disconnect: function(){ socket.connected = false; return socket; },
            __trigger: function(name, args){
                if(name === 'connect') socket.connected = true;
                (handlers[name] || []).forEach(function(fn){ fn.apply(null, args || []); });
            }
        };
        window.__sockets.push(socket);
        return socket;
    };
    window.__serverEmit = function(name, args){ window.__sockets[0].__trigger(name, args); };
})();
`;

async function mockBackend(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

test('lobby: el avance automático ofrece Manual y de 3 a 20 s, y se envía al iniciar', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/host/?id=q1&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    const select = page.locator('#opt-auto');
    await expect(select.locator('option')).toHaveCount(19);
    await expect(select).toHaveValue('0');
    await select.selectOption('12');
    await page.evaluate(() => window.__serverEmit('showGamePin', [{ pin: '12345' }]));
    await page.locator('#start').click();
    await expect.poll(() => emitsNamed(page, 'startGame')).toHaveLength(1);
    expect((await emitsNamed(page, 'startGame'))[0].autoAdvanceSec).toBe(12);
});

test('anfitrión (partida): al recibir el paso automático lo ejecuta y responde la etapa', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/host/game/?id=g1&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.evaluate(() => window.__serverEmit('gameQuestions', [{
        q1: 'Capital de Francia?', a1: 'Paris', a2: 'Londres', a3: 'Roma', a4: 'Berlin',
        type: 'quiz', time: 15, playersInGame: 2, questionNumber: 1, totalQuestions: 3, showScores: true
    }]));
    await page.evaluate(() => window.__serverEmit('questionOver', [[], { type: 'quiz', showScores: true }]));
    await page.evaluate(() => window.__serverEmit('autoAdvanceStep', []));
    const done = await emitsNamed(page, 'autoAdvanceStepDone');
    expect(done.length).toBe(1);
    expect(['ranking', 'next']).toContain(done[0].stage);
});

test('anfitrión (resultados): la cuenta atrás se ve y se puede pausar', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/host/game/?id=g1&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.evaluate(() => window.__serverEmit('autoAdvanceState', [{ active: true, paused: false, seconds: 10, remainingMs: 9000 }]));
    await page.evaluate(() => { document.getElementById('rankingModal').style.display = 'block'; });
    await expect(page.locator('#autoAdvanceText')).toHaveText('Siguiente en 9 s');
    await page.locator('#autoPauseBtn').click();
    const pauses = await emitsNamed(page, 'autoAdvancePause');
    expect(pauses[pauses.length - 1]).toEqual({ paused: true });

    await page.evaluate(() => window.__serverEmit('autoAdvanceState', [{ active: true, paused: true, seconds: 10, remainingMs: 4000 }]));
    await expect(page.locator('#autoAdvanceText')).toHaveText('Avance pausado');
    await expect(page.locator('#rankingNextBtn')).toBeDisabled();
});

test('alumnado: muestra la cuenta atrás hasta la siguiente pregunta', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/player/game/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.evaluate(() => window.__serverEmit('playerQuestion', [{ question: 'Capital de Francia?', answers: ['Paris', 'Roma', 'Londres', 'Berlín'], type: 'quiz', time: 15 }]));
    await page.evaluate(() => window.__serverEmit('autoAdvanceState', [{ active: true, paused: false, seconds: 8, remainingMs: 7500 }]));
    await expect(page.locator('#autoAdvanceNotice')).toContainText('Siguiente pregunta en');
    await page.evaluate(() => window.__serverEmit('nextQuestionPlayer', []));
    await expect(page.locator('#autoAdvanceNotice')).toHaveCount(0);
});
