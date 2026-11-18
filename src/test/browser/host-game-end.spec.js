const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Socket.IO falso (mismo patrón que host-lobby.spec.js): guarda lo emitido y
// deja lanzar eventos del servidor con window.__serverEmit.
const FAKE_SOCKET_IO = `
(function(){
    window.__sockets = [];
    window.io = function(){
        var handlers = {};
        var socket = {
            on: function(name, fn){ (handlers[name] = handlers[name] || []).push(fn); return socket; },
            emit: function(){ return socket; },
            disconnect: function(){ return socket; },
            __trigger: function(name, data){ (handlers[name] || []).forEach(function(fn){ fn(data); }); }
        };
        window.__sockets.push(socket);
        return socket;
    };
    window.__serverEmit = function(name, data){ window.__sockets[0].__trigger(name, data); };
})();
`;

const GAME_OVER = { num1: 'Ana', num2: 'Pau', num3: '', num4: '', num5: '' };

test.beforeEach(async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
});

// Issue #17: al acabar la partida hay forma de volver a la biblioteca.
// «Cancelar partida» pasa a «Volver» (valenciano: «Tornar») y lleva a /create/.
test('al acabar la partida, «Cancelar partida» pasa a «Volver», traducido', async ({ page }) => {
    await page.goto('/host/game/?id=test&pin=12345&lang=es');
    const btn = page.locator('#cancelGameBtn');
    await expect(btn).toHaveText('Cancelar partida');
    await expect(page.locator('#backToLibraryBtn')).toHaveCount(0);

    await page.evaluate(data => window.__serverEmit('GameOver', data), GAME_OVER);
    await expect(btn).toHaveText('Volver');

    await page.locator('#lang-select').selectOption('en');
    await expect(btn).toHaveText('Back');
});

test('dentro del iframe del lobby, el enlace saca de la partida a /create/', async ({ page }) => {
    await page.goto('/host/?id=q1&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => {
        window.__serverEmit('connect');
        window.__serverEmit('showGamePin', { pin: '12345' });
    });
    await page.locator('#start').click();
    await page.evaluate(() => window.__serverEmit('gameStarted', 'g1'));

    const frameEl = page.locator('#host-game-frame');
    await expect(frameEl).toBeAttached({ timeout: 8000 });
    const frame = page.frameLocator('#host-game-frame');
    await expect(frame.locator('#lang-select')).toBeAttached();
    await (await frameEl.elementHandle()).contentFrame().then(f => f.evaluate(data => window.__serverEmit('GameOver', data), GAME_OVER));

    await frame.locator('#cancelGameBtn').click();
    await expect(page).toHaveURL(/\/create\/$/);
    await expect(page.locator('#host-game-frame')).toHaveCount(0);
});

test('al acabar la partida no se muestra el botón de expulsar', async ({ page }) => {
    await page.goto('/host/game/?id=test&pin=12345&lang=es');
    await page.evaluate(() => window.__serverEmit('answerStatus', [[
        { playerId: 'p1', name: 'Ana', icon: '🐱', answered: true, hand: false, away: false, streak: 0 }
    ]]));
    await expect(page.locator('#answerStatus .kick-btn')).toHaveCount(1);

    await page.evaluate(data => window.__serverEmit('GameOver', data), GAME_OVER);
    await expect(page.locator('#answerStatus .kick-btn')).toHaveCount(0);
});

test('al acabar la partida se ocultan el avance automático y la casilla de puntuaciones', async ({ page }) => {
    await page.goto('/host/game/?id=test&pin=12345&lang=es');
    await expect(page.locator('#autoAdvanceSelect')).toBeVisible();
    await expect(page.locator('#scoresToggle')).toBeVisible();

    await page.evaluate(data => window.__serverEmit('GameOver', data), GAME_OVER);
    await expect(page.locator('#autoAdvanceSelect')).toBeHidden();
    await expect(page.locator('#scoresToggle')).toBeHidden();
});

test('al acabar, el informe CSV va en la misma fila que los botones de la partida', async ({ page }) => {
    await page.goto('/host/game/?id=test&pin=12345&lang=es');
    await page.evaluate(data => window.__serverEmit('GameOver', data), GAME_OVER);
    // En móvil los botones se apilan a propósito.
    test.skip(page.viewportSize().width < 600, 'en móvil los botones se apilan');
    const report = await page.locator('#downloadReportBtn').boundingBox();
    const cancel = await page.locator('#cancelGameBtn').boundingBox();
    expect(Math.abs(report.y - cancel.y)).toBeLessThanOrEqual(2);
});
