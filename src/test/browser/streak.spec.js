const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Racha de aciertos (feature 11). Socket.IO falso, igual que en los demás specs de partida.
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

function serverEmit(page, name, ...args) {
    return page.evaluate(x => window.__serverEmit(x.name, x.args), { name, args });
}

test('anfitrión: la racha de aciertos está activada por defecto en el lobby', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await expect(page.locator('#opt-streak')).toBeChecked();
    await expect(page.locator('#host-options')).toContainText('Racha de aciertos');
});

test('alumno: tras un acierto muestra la racha y la bonificación', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/player/game/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'playerQuestion', { question: 'Capital de Francia?', answers: ['Paris', 'Roma', 'Londres', 'Berlín'], type: 'quiz', time: 15 });
    await expect(page.locator('#streakText')).toBeHidden();

    await serverEmit(page, 'answerResult', { outcome: 'correct', streak: 3, bonus: 50 });
    await expect(page.locator('#streakText')).toHaveText('🔥 3 · +50');
});

test('alumno: al fallar la racha desaparece', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/player/game/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'playerQuestion', { question: 'Capital de Francia?', answers: ['Paris', 'Roma', 'Londres', 'Berlín'], type: 'quiz', time: 15 });
    await serverEmit(page, 'answerResult', { outcome: 'correct', streak: 4, bonus: 100 });
    await expect(page.locator('#streakText')).toBeVisible();

    await serverEmit(page, 'answerResult', { outcome: 'incorrect', streak: 0 });
    await expect(page.locator('#streakText')).toBeHidden();
});

test('anfitrión (partida): quien lleva tres o más aciertos seguidos aparece con fuego', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/host/game/?id=g1&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'gameQuestions', {
        q1: 'Capital de Francia?', a1: 'Paris', a2: 'Londres', a3: 'Roma', a4: 'Berlin',
        type: 'quiz', time: 15, playersInGame: 2, questionNumber: 1, totalQuestions: 3, showScores: true
    });
    await serverEmit(page, 'answerStatus', [
        { playerId: 'p1', name: 'Ana', icon: '🐱', answered: true, hand: false, away: false, streak: 4 },
        { playerId: 'p2', name: 'Pau', icon: '🐶', answered: false, hand: false, away: false, streak: 1 }
    ]);
    const ana = page.locator('#answerStatus li', { hasText: 'Ana' });
    await expect(ana.locator('.answer-status-fire')).toHaveText('🔥4');
    await expect(page.locator('#answerStatus li', { hasText: 'Pau' }).locator('.answer-status-fire')).toHaveCount(0);
});
