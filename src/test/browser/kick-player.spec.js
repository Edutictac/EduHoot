const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Expulsión de alumnado (issue #29). Socket.IO falso: guarda lo que emite la página
// y deja lanzar eventos del servidor con __serverEmit.
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
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
}

function serverEmit(page, name, ...args) {
    return page.evaluate(x => window.__serverEmit(x.name, x.args), { name, args });
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

const PLAYERS = [
    { playerId: 'p1', name: 'Ana', icon: '🐱', gameData: { score: 0 } },
    { playerId: 'p2', name: 'NombreFeo', icon: '🐶', gameData: { score: 0 } }
];

// ---------- Anfitrión: lobby ----------

async function openHostLobby(page) {
    await mockBackend(page);
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'updatePlayerLobby', PLAYERS);
}

test('anfitrión (lobby): expulsar pide confirmación y solo después emite kick-player', async ({ page }) => {
    await openHostLobby(page);
    const row = page.locator('.player-item', { hasText: 'NombreFeo' });
    await row.locator('.kick-btn').click();
    await expect(row.locator('.kick-btn--confirm')).toHaveText('Confirmar');
    expect(await emitsNamed(page, 'kick-player')).toEqual([]);

    await row.locator('.kick-btn--confirm').click();
    expect(await emitsNamed(page, 'kick-player')).toEqual([{ playerId: 'p2' }]);
});

test('anfitrión (lobby): si no se confirma, el botón vuelve a Expulsar', async ({ page }) => {
    await openHostLobby(page);
    const row = page.locator('.player-item', { hasText: 'Ana' });
    await row.locator('.kick-btn').click();
    await expect(row.locator('.kick-btn--confirm')).toBeVisible();
    await expect(row.locator('.kick-btn')).toBeVisible({ timeout: 6000 });
    expect(await emitsNamed(page, 'kick-player')).toEqual([]);
});

// ---------- Anfitrión: partida ----------

test('anfitrión (partida): la lista de respuestas permite expulsar con dos pasos', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/host/game/?id=g1&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'gameQuestions', {
        q1: 'Capital de Francia?', a1: 'Paris', a2: 'Londres', a3: 'Roma', a4: 'Berlin',
        type: 'quiz', time: 15, playersInGame: 2, questionNumber: 1, totalQuestions: 3, showScores: true
    });
    await serverEmit(page, 'answerStatus', [
        { playerId: 'p1', name: 'Ana', icon: '🐱', answered: true, hand: false, away: false },
        { playerId: 'p2', name: 'NombreFeo', icon: '🐶', answered: false, hand: false, away: false }
    ]);
    const row = page.locator('#answerStatus li', { hasText: 'NombreFeo' });
    await row.locator('.kick-btn').click();
    await expect(row.locator('.kick-btn--confirm')).toHaveText('Confirmar');
    await row.locator('.kick-btn--confirm').click();
    expect(await emitsNamed(page, 'kick-player')).toEqual([{ playerId: 'p2' }]);
});

// ---------- Alumno ----------

async function openPlayerLobby(page) {
    await mockBackend(page);
    await page.goto('/player/?pin=12345&icon=%F0%9F%90%BC&name=Ana&token=tok1');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

test('alumno expulsado en el lobby ve el aviso y no vuelve a intentar entrar', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('lang', 'es'); });
    await openPlayerLobby(page);
    await serverEmit(page, 'playerJoinRejected', { code: 'kicked' });
    await expect(page.locator('#title1')).toHaveText('Has salido de la partida');
    const joins = await emitsNamed(page, 'player-join');
    await page.waitForTimeout(1500);
    expect(await emitsNamed(page, 'player-join')).toEqual(joins);
});

test('alumno que recibe el evento kicked en la sala muestra el aviso', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('lang', 'es'); });
    await openPlayerLobby(page);
    await serverEmit(page, 'playerJoinAck');
    await serverEmit(page, 'kicked');
    await expect(page.locator('#title1')).toHaveText('Has salido de la partida');
});
