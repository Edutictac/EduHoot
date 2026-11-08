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

// Issue #17: al acabar la partida no había forma de volver a la biblioteca.
test('al acabar la partida aparece el enlace a la biblioteca, traducido', async ({ page }) => {
    await page.goto('/host/game/?id=test&pin=12345&lang=es');
    const link = page.locator('#backToLibraryBtn');
    await expect(link).toBeHidden();

    await page.evaluate(data => window.__serverEmit('GameOver', data), GAME_OVER);
    await expect(link).toBeVisible();
    await expect(link).toHaveText('Volver');
    await expect(link).toHaveAttribute('title', 'Volver a la biblioteca');
    await expect(link).toHaveAttribute('href', '/create/');
    await expect(link).toHaveAttribute('target', '_top');

    await page.locator('#lang-select').selectOption('en');
    await expect(link).toHaveText('Back');
    await expect(link).toHaveAttribute('title', 'Back to the library');
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

    await frame.locator('#backToLibraryBtn').click();
    await expect(page).toHaveURL(/\/create\/$/);
    await expect(page.locator('#host-game-frame')).toHaveCount(0);
});
