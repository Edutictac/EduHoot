const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Socket.IO falso: el servidor de los specs solo sirve estáticos, así que se
// sustituye /socket.io/socket.io.js por un `io()` que guarda lo que emite la
// página (window.__emits) y deja que el test lance eventos del servidor
// (window.__serverEmit). No conecta solo: el test lanza 'connect' cuando la
// página ya ha cargado, como pasa con una conexión real.
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
            disconnect: function(){ socket.connected = false; window.__disconnected = true; return socket; },
            __trigger: function(name, data){
                if(name === 'connect') socket.connected = true;
                (handlers[name] || []).forEach(function(fn){ fn(data); });
            }
        };
        window.__sockets.push(socket);
        return socket;
    };
    window.__serverEmit = function(name, data){
        window.__sockets[0].__trigger(name, data);
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

async function openLobby(page, query) {
    await mockBackend(page);
    await page.goto('/host/' + query);
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

// Red de seguridad para el piloto de Vue (Subfase B): fija el comportamiento
// actual del lobby de /host/ para comprobar que sigue igual cuando host.js
// pase a ser una app de Vue. El spec no debe cambiar en esa conversión.
test('sin ?id= muestra el error y no pide partida', async ({ page }) => {
    await openLobby(page, '?lang=es');
    await expect(page.locator('#host-error')).toBeVisible();
    await expect(page.locator('#host-error')).toHaveText('Falta el quiz para generar la partida. Vuelve a elegirlo.');
    expect(await emitsNamed(page, 'host-join')).toEqual([]);
});

test('pide partida, muestra PIN y QR y lista los jugadores como texto', async ({ page }) => {
    await openLobby(page, '?id=q1&lang=es');
    expect(await emitsNamed(page, 'host-join')).toEqual([{ id: 'q1', lang: 'es' }]);
    await expect(page.locator('#gamePinText')).toHaveText('—');

    await page.evaluate(() => window.__serverEmit('showGamePin', { pin: '12345' }));
    await expect(page.locator('#gamePinText')).toHaveText('12345');
    await expect(page.locator('#join-url')).toContainText('PIN 12345');
    await expect(page.locator('#join-url')).toHaveAttribute('href', /\/join\.html\?pin=12345&lang=es$/);
    await expect(page.locator('#join-qr')).toHaveAttribute('src', /api\.qrserver\.com\/.*data=.*pin%3D12345/);
    expect(await page.evaluate(() => localStorage.getItem('lastGamePin'))).toBe('12345');

    // Un nombre con HTML se pinta como texto, no como etiquetas.
    await page.evaluate(() => window.__serverEmit('updatePlayerLobby', [
        { name: '<b>Ana</b>', icon: '🐱' },
        { name: 'Pau' }
    ]));
    const players = page.locator('#players .player-item');
    await expect(players).toHaveCount(2);
    await expect(players.nth(0).locator('.player-icon')).toHaveText('🐱');
    await expect(players.nth(0).locator('.player-name')).toHaveText('<b>Ana</b>');
    await expect(page.locator('#players b')).toHaveCount(0);
    await expect(players.nth(1).locator('.player-name')).toHaveText('Pau');

    // Cada actualización sustituye la lista entera.
    await page.evaluate(() => window.__serverEmit('updatePlayerLobby', [{ name: 'Pau', icon: '🐶' }]));
    await expect(players).toHaveCount(1);
    await expect(players.nth(0).locator('.player-name')).toHaveText('Pau');
});

test('iniciar emite una sola vez las opciones marcadas y el tiempo limitado', async ({ page }) => {
    await openLobby(page, '?id=q1&lang=es');
    await page.evaluate(() => window.__serverEmit('showGamePin', { pin: '12345' }));

    await page.locator('#opt-rand-q').check();
    await page.locator('#opt-send-students').uncheck();
    await page.locator('#opt-time').fill('200');
    await page.locator('#start').click();
    await page.locator('#start').click();

    // Espera al gong (como mucho ~3 s) antes de emitir.
    await expect.poll(() => emitsNamed(page, 'startGame'), { timeout: 6000 }).toHaveLength(1);
    expect((await emitsNamed(page, 'startGame'))[0]).toEqual({
        randomQuestions: true,
        randomAnswers: true,
        sendToStudents: false,
        showScoresBetween: true,
        pin: '12345',
        timePerQuestion: 120
    });
});

test('sin tiempo no envía timePerQuestion y por debajo de 5 s lo sube a 5', async ({ page }) => {
    await openLobby(page, '?id=q1&lang=es');
    await page.evaluate(() => window.__serverEmit('showGamePin', { pin: '12345' }));

    await page.locator('#start').click();
    await expect.poll(() => emitsNamed(page, 'startGame'), { timeout: 6000 }).toHaveLength(1);
    expect((await emitsNamed(page, 'startGame'))[0]).toEqual({
        randomQuestions: false,
        randomAnswers: true,
        sendToStudents: true,
        showScoresBetween: true,
        pin: '12345'
    });

    // Tras un error del servidor se puede volver a iniciar.
    await page.evaluate(() => window.__serverEmit('hostError', { error: 'Quiz no trobat' }));
    await expect(page.locator('#host-error')).toHaveText('Quiz no trobat');
    await page.locator('#opt-time').fill('3');
    await page.locator('#start').click();
    await expect.poll(() => emitsNamed(page, 'startGame'), { timeout: 6000 }).toHaveLength(2);
    expect((await emitsNamed(page, 'startGame'))[1].timePerQuestion).toBe(5);
});

test('al empezar la partida abre la vista de juego en un iframe', async ({ page }) => {
    await openLobby(page, '?id=q1&lang=es');
    await page.evaluate(() => window.__serverEmit('showGamePin', { pin: '12345' }));
    await page.locator('#start').click();
    await expect.poll(() => emitsNamed(page, 'startGame'), { timeout: 6000 }).toHaveLength(1);

    await page.evaluate(() => window.__serverEmit('gameStarted', 'g1'));
    await expect(page.locator('#host-game-frame')).toHaveAttribute('src', '/host/game/?id=g1&pin=12345');
    expect(await page.evaluate(() => window.__disconnected)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('lastHostId'))).toBe('g1');
});

test('cambiar de idioma traduce el lobby y el enlace de unión', async ({ page }) => {
    await openLobby(page, '?id=q1&lang=es');
    await page.evaluate(() => window.__serverEmit('showGamePin', { pin: '12345' }));
    await expect(page.locator('#start')).toHaveText('Iniciar partida');

    await page.locator('#host-lang-select').selectOption('en');
    await expect(page.locator('#start')).toHaveText('Start game');
    await expect(page.locator('#title')).toHaveText('Join this game with the PIN:');
    await expect(page.locator('#join-url')).toHaveAttribute('href', /pin=12345&lang=en$/);
});

// Antes, i18n-host.js cambiaba cualquier error visible por el genérico al
// cambiar de idioma («Falta el quiz…» → «No se pudo iniciar la partida…»).
test('al cambiar de idioma, el error visible se traduce y no pasa a ser el genérico', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await openLobby(page, '?lang=es');
    await expect(page.locator('#host-error')).toHaveText('Falta el quiz para generar la partida. Vuelve a elegirlo.');

    await page.locator('#host-lang-select').selectOption('en');
    await expect(page.locator('#host-error')).toHaveText('Missing quiz to create the game. Please pick it again.');
    expect(errors).toEqual([]);
});

// Issue #20 (CSP): el botó ja no és un onclick="…" en el HTML.
test('«Cancelar partida» vuelve a la portada', async ({ page }) => {
    await page.route(url => url.pathname === '/', route => route.fulfill({ contentType: 'text/html', body: '<p>portada</p>' }));
    await openLobby(page, '?id=q1&lang=es');
    await expect(page.locator('#cancel')).not.toHaveAttribute('onclick');
    await page.locator('#cancel').click();
    await page.waitForURL(url => url.pathname === '/');
});
