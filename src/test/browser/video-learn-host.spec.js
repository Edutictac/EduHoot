const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Socket.IO falso (mismo patrón que player-game.spec.js): admite varios
// argumentos por evento (p. ej. questionOver(playerData, payload)).
const FAKE_SOCKET_IO = `
(function(){
    window.__emits = [];
    window.__sockets = [];
    window.io = function(){
        var handlers = {};
        var socket = {
            connected: false,
            on: function(name, fn){ (handlers[name] = handlers[name] || []).push(fn); return socket; },
            emit: function(name, data){ window.__emits.push({ name: name, data: JSON.parse(JSON.stringify(data === undefined ? null : data)) }); return socket; },
            disconnect: function(){ socket.connected = false; return socket; },
            __trigger: function(name, args){
                if(name === 'connect') socket.connected = true;
                if(name === 'disconnect') socket.connected = false;
                (handlers[name] || []).forEach(function(fn){ fn.apply(null, args || []); });
            }
        };
        window.__sockets.push(socket);
        return socket;
    };
    window.__serverEmit = function(name, args){
        window.__sockets[0].__trigger(name, args);
    };
})();
`;

async function mockBackend(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: FAKE_SOCKET_IO
    }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
}

async function openGame(page, query) {
    await mockBackend(page);
    await page.goto('/host/game/' + (query || '?id=g1&pin=12345&lang=es'));
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

function serverEmit(page, name, ...args) {
    return page.evaluate(x => window.__serverEmit(x.name, x.args), { name, args });
}

const ANSWERS = ['Paris', 'Londres', 'Roma', 'Berlin'];

function gameQuestionsPayload(overrides) {
    return Object.assign({
        q1: 'Capital de Francia?',
        a1: ANSWERS[0], a2: ANSWERS[1], a3: ANSWERS[2], a4: ANSWERS[3],
        type: 'quiz',
        time: 15,
        playersInGame: 2,
        questionNumber: 1,
        totalQuestions: 3,
        showScores: true
    }, overrides || {});
}

// Red de seguridad para la Subfase B (Vue): fija el comportamiento actual de
// /host/game/ (hostGame.js) para comprobar que sigue igual cuando pase a ser
// una app de Vue. El spec no debe cambiar en esa conversión. Complementa
// host-game-timer.spec.js (issue #21) y host-game-end.spec.js (issue #17),
// que ya cubren casos concretos y no se repiten aquí.
// Fase «aprén i després respon» (feature 24) al projector: el vídeo, el botó per tancar-la i la sortida a les respostes.
test('projector: la fase del vídeo mostra el botó per tancar-la, i la pregunta el fa desaparèixer', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'videoLearn', { questionNumber: 1, video: '/media/clip.mp4', image: '', startAt: 0 });
    await expect(page.locator('#finishVideoBtn')).toBeVisible();
    await page.locator('#finishVideoBtn').click();
    expect(await emitsNamed(page, 'finishVideoLearning')).toEqual([null]);
    await serverEmit(page, 'gameQuestions', { q1: 'Pregunta després del vídeo', a1: 'a', a2: 'b', a3: 'c', a4: 'd', type: 'quiz', time: 20, questionNumber: 1, totalQuestions: 2, playersInGame: 2, showScores: true });
    await expect(page.locator('#finishVideoBtn')).toHaveCount(0);
});
