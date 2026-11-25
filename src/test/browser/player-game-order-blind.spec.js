const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Socket.IO falso (mismo patrón que host-lobby.spec.js): guarda lo que la
// página emite (window.__emits) y deja lanzar eventos del servidor con
// window.__serverEmit. socket.id fijo para poder comprobar el ranking.
const FAKE_SOCKET_IO = `
(function(){
    window.__emits = [];
    window.__sockets = [];
    window.io = function(){
        var handlers = {};
        var socket = {
            id: 'p1',
            connected: false,
            on: function(name, fn){ (handlers[name] = handlers[name] || []).push(fn); return socket; },
            emit: function(name, data){ window.__emits.push({ name: name, data: JSON.parse(JSON.stringify(data === undefined ? null : data)) }); return socket; },
            connect: function(){ socket.connected = true; return socket; },
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
    // Admite varios argumentos (p. ej. questionOver(playerData, payload)).
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
    await page.goto('/player/game/' + (query || '?pin=12345&name=Ana&icon=gat&lang=es'));
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

function serverEmit(page, name, ...args) {
    return page.evaluate(x => window.__serverEmit(x.name, x.args), { name, args });
}

const ANSWERS = ['Paris', 'Londres', 'Roma', 'Berlín'];

// Red de seguridad para la Subfase B (Vue): fija el comportamiento actual de
// /player/game/ (playerGame.js) para comprobar que sigue igual cuando pase a
// ser una app de Vue. El spec no debe cambiar en esa conversión.
// Ordenar a cegues (el alumnat no rep els textos): el tauler mostra codis A, B, C i envia les posicions.
test('ordenar a cegues: el tauler mostra codis i envia la posició triada', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { blind: true, type: 'order', orderCount: 3, layout: 'vertical', time: 20, questionNumber: 1, totalQuestions: 1 });
    await expect(page.locator('.order-item .order-text')).toHaveText(['A', 'B', 'C']);
    // Posició triada: C (2) primer, després A (0), després B (1). Les fletxes ▲ mouen cada element.
    await page.locator('.order-item').nth(2).locator('.order-move').first().click();
    await page.locator('.order-item').nth(1).locator('.order-move').first().click();
    await page.locator('.order-submit').click();
    expect(await emitsNamed(page, 'playerAnswer')).toEqual([[2, 0, 1]]);
});
