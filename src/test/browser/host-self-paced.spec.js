const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Modo autoritme, lado del anfitrión: selector del lobby y pantalla de progreso (Socket.IO falso).
const FAKE_SOCKET_IO = `
(function(){
    window.__emits = [];
    window.__sockets = [];
    window.io = function(){
        var handlers = {};
        var socket = {
            id: 'h1',
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


async function setup(page) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.__errors = errors;
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
}
const serverEmit = (page, name, ...args) => page.evaluate(x => window.__serverEmit(x.name, x.args), { name, args });
const emitsNamed = (page, name) => page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
test.afterEach(async ({ page }) => { expect(page.__errors || []).toEqual([]); });

test('lobby: el modo «a su ritmo» se envía en startGame y oculta el avance automático', async ({ page }) => {
    await setup(page);
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await expect(page.locator('#opt-mode')).toHaveValue('live');
    await expect(page.locator('#opt-auto')).toBeVisible();
    await page.locator('#opt-mode').selectOption('selfPaced');
    await expect(page.locator('#opt-auto')).toHaveCount(0);
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.locator('#start').click();
    await expect.poll(async () => (await emitsNamed(page, 'startGame')).length, { timeout: 8000 }).toBe(1);
    expect((await emitsNamed(page, 'startGame'))[0].mode).toBe('selfPaced');
});

test('lobby: por defecto el modo es en directo', async ({ page }) => {
    await setup(page);
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.locator('#start').click();
    await expect.poll(async () => (await emitsNamed(page, 'startGame')).length, { timeout: 8000 }).toBe(1);
    expect((await emitsNamed(page, 'startGame'))[0].mode).toBe('live');
});

test('pantalla del anfitrión en autoritme: progreso por alumno, expulsar y acabar con confirmación', async ({ page }) => {
    await setup(page);
    await page.goto('/host/self-paced/?id=h0&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    expect(await emitsNamed(page, 'host-join-game')).toHaveLength(1);
    await serverEmit(page, 'gamePin', { pin: '12345', quizName: 'Capitales' });
    await expect(page.locator('#quizName')).toHaveText('Capitales');
    await expect(page.locator('#spEmpty')).toBeVisible();

    await serverEmit(page, 'spProgress', [
        { playerId: 'a', name: 'Ana', icon: '🦊', question: 2, total: 4, answered: 2, finished: false },
        { playerId: 'b', name: 'Bruno', icon: '🐶', question: 4, total: 4, answered: 4, finished: true }
    ]);
    await expect(page.locator('#spSummary')).toHaveText('2 alumnos · 1 han terminado');
    await expect(page.locator('.sp-row')).toHaveCount(2);
    await expect(page.locator('.sp-row').first().locator('.sp-row__count')).toHaveText('2 / 4');
    await expect(page.locator('.sp-row').nth(1).locator('.sp-row__count')).toHaveText('Terminado');

    // Expulsar: dos pasos; luego se pide de nuevo el progreso.
    await page.locator('.sp-row').first().locator('.kick-btn').click();
    expect(await emitsNamed(page, 'kick-player')).toEqual([]);
    await page.locator('.sp-row').first().locator('.kick-btn').click();
    expect(await emitsNamed(page, 'kick-player')).toEqual([{ playerId: 'a' }]);
    await serverEmit(page, 'updatePlayerLobby', []);
    expect((await emitsNamed(page, 'spProgressRequest')).length).toBeGreaterThan(0);

    // Acabar: pide confirmación.
    await page.locator('#spEndBtn').click();
    expect(await emitsNamed(page, 'spEnd')).toEqual([]);
    await expect(page.locator('#spEndBtn')).toHaveText('Confirmar: acabar');
    await page.locator('#spEndBtn').click();
    expect(await emitsNamed(page, 'spEnd')).toHaveLength(1);

    await serverEmit(page, 'GameOver', { num1: 'Ana', num2: 'Bruno', num3: '', num4: '', num5: '', showPodium: true, hostPodium: true });
    await expect(page.locator('#spPodium')).toContainText('1. Ana');
    await expect(page.locator('#spPodium')).toContainText('2. Bruno');
    await expect(page.locator('#spDownloadBtn')).toBeVisible();
    await expect(page.locator('#spEndBtn')).toHaveCount(0);
});

test('pantalla del anfitrión en autoritme: sin podio si no se muestran puntuaciones', async ({ page }) => {
    await setup(page);
    await page.goto('/host/self-paced/?id=h0&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'GameOver', { num1: 'Ana', num2: '', num3: '', num4: '', num5: '', showPodium: false });
    await expect(page.locator('#spPodium')).toHaveCount(0);
    await expect(page.locator('#spDownloadBtn')).toBeVisible();
});

test('pantalla del anfitrión en autoritme: muestra la mano levantada junto al nombre', async ({ page }) => {
    await setup(page);
    await page.goto('/host/self-paced/?id=h0&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'spProgress', [
        { playerId: 'a', name: 'Ana', icon: '🦊', question: 1, total: 4, answered: 0, finished: false, hand: true },
        { playerId: 'b', name: 'Bruno', icon: '🐶', question: 1, total: 4, answered: 0, finished: false, hand: false }
    ]);
    await expect(page.locator('.sp-row__hand')).toHaveCount(1);
    await expect(page.locator('.sp-row').first().locator('.sp-row__hand')).toHaveAttribute('title', 'Mano levantada');
});

test('pantalla del anfitrión en autoritme: Top 10 ordenado solo si llegan puntos', async ({ page }) => {
    await setup(page);
    await page.goto('/host/self-paced/?id=h0&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'spHostScoresState', { enabled: true });
    await serverEmit(page, 'spProgress', [
        { playerId: 'a', name: 'Ana', icon: '', question: 1, total: 4, answered: 1, finished: false, score: 500 },
        { playerId: 'b', name: 'Bruno', icon: '', question: 1, total: 4, answered: 1, finished: false, score: 900 }
    ]);
    await expect(page.locator('#spRanking li')).toHaveText(['Bruno - 900', 'Ana - 500']);
    await serverEmit(page, 'spProgress', [
        { playerId: 'a', name: 'Ana', icon: '', question: 1, total: 4, answered: 1, finished: false }
    ]);
    await expect(page.locator('#spRanking')).toHaveCount(0);
});

// Al cerrar o acabar la partida a su ritmo (vista incrustada en el lobby), la música de la sala se para
// y la salida se hace en la ventana principal.
async function openEmbedded(page) {
    await setup(page);
    await page.route('**/create/**', route => route.fulfill({ contentType: 'text/html', body: '<p>biblioteca</p>' }));
    await page.route('**/zz-wrapper', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body><script>
        window.__played = true;
        window.eduhootHostAudio = { music: { pause: function(){ window.__played = false; } }, gong: null };
    </script><iframe id="f" src="/host/self-paced/?id=h1&pin=12345&lang=es" style="width:900px;height:700px"></iframe></body></html>` }));
    await page.goto('/zz-wrapper');
    const frame = page.frame({ url: /host\/self-paced/ });
    await frame.waitForLoadState('load');
    await frame.evaluate(() => window.__serverEmit('connect'));
    return frame;
}

test('a su ritmo incrustado: al cancelar la partida se sale en la ventana principal (no solo en el marco)', async ({ page }) => {
    const frame = await openEmbedded(page);
    await frame.evaluate(() => window.__serverEmit('gameCancelled'));
    await page.waitForURL('**/create/**');
});

test('a su ritmo incrustado: al acabar la partida la música se para', async ({ page }) => {
    const frame = await openEmbedded(page);
    expect(await page.evaluate(() => window.__played)).toBe(true);
    await frame.evaluate(() => window.__serverEmit('GameOver', [{ podium: [] }]));
    await expect.poll(() => page.evaluate(() => window.__played)).toBe(false);
});

test('pantalla del anfitrión en autoritme: el check de puntuaciones envía la opción i mostra el Top 10 només quan està activat', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.goto('/host/self-paced/?id=h0&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'spProgress', [
        { playerId: 'a', name: 'Ana', icon: '', question: 1, total: 4, answered: 1, finished: false, score: 500 },
        { playerId: 'b', name: 'Bruno', icon: '', question: 1, total: 4, answered: 1, finished: false, score: 900 }
    ]);
    // Per defecte el check està desmarcat i el Top 10 no es mostra.
    await expect(page.locator('#spHostScores')).not.toBeChecked();
    await expect(page.locator('#spRanking')).toHaveCount(0);
    await page.locator('#spHostScores').check();
    expect(await emitsNamed(page, 'spHostScores')).toEqual([{ enabled: true }]);
    // El servidor confirma l'estat i el Top 10 apareix amb els punts.
    await serverEmit(page, 'spHostScoresState', { enabled: true });
    await expect(page.locator('#spHostScores')).toBeChecked();
    await expect(page.locator('#spRanking li')).toHaveText(['Bruno - 900', 'Ana - 500']);
    await page.locator('#spHostScores').uncheck();
    expect(await emitsNamed(page, 'spHostScores')).toEqual([{ enabled: true }, { enabled: false }]);
});

test('lobby: con una partida a su ritmo en marcha, el título de la página es «Eduhoot | <título del quiz>»', async ({ page }) => {
    await setup(page);
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.locator('#opt-mode').selectOption('selfPaced');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'showGamePin', { pin: '12345', quizName: 'Repàs de física' });
    await page.locator('#start').click();
    await expect.poll(async () => (await emitsNamed(page, 'startGame')).length, { timeout: 8000 }).toBe(1);
    await serverEmit(page, 'gameStarted', 'g1');
    await expect(page).toHaveTitle('Eduhoot | Repàs de física');
});

test('autoritme: la música de fons es una fila inferior con els mateixos controls que el lobby', async ({ page }) => {
    await setup(page);
    await page.goto('/host/self-paced/?id=h0&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'spProgress', [{ playerId: 'a', name: 'Ana', icon: '', question: 1, total: 4, answered: 1, finished: false }]);
    const player = page.locator('#sp-music-player .music-player-shell, #sp-music-player > *').first();
    await expect(player).toBeVisible();
    const list = await page.locator('#spList').boundingBox();
    const music = await page.locator('#sp-music-player').boundingBox();
    expect(music.y).toBeGreaterThanOrEqual(list.y + list.height - 1);
    await expect(page.locator('#sp-music-player')).toContainText('Música de fondo');
});
