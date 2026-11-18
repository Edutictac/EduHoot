const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Pausar partida y cancelar partida desde la pantalla del anfitrión.
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

async function openGame(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.goto('/host/game/?id=g1&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.evaluate(() => window.__serverEmit('gameQuestions', [{
        q1: 'Capital de Francia?', a1: 'Paris', a2: 'Londres', a3: 'Roma', a4: 'Berlin',
        type: 'quiz', time: 15, playersInGame: 2, questionNumber: 1, totalQuestions: 3, showScores: true
    }]));
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

test('anfitrión: pausar la partida congela el tiempo y bloquea saltar la pregunta', async ({ page }) => {
    await openGame(page);
    await page.locator('#timerPauseBtn').click();
    await expect(page.locator('#timerPauseBtn')).toHaveText('Reanudar partida');
    const sync = await emitsNamed(page, 'timerSync');
    expect(sync[sync.length - 1].paused).toBe(true);
    await expect(page.locator('#skipQButton')).toBeDisabled();

    await page.locator('#timerPauseBtn').click();
    await expect(page.locator('#timerPauseBtn')).toHaveText('Pausar partida');
    await expect(page.locator('#skipQButton')).toBeEnabled();
});

test('anfitrión: cancelar partida pide confirmación antes de cerrar', async ({ page }) => {
    await openGame(page);
    await page.locator('#cancelGameBtn').click();
    await expect(page.locator('#cancelGameBtn')).toHaveText('Confirmar cancelación');
    // Al confirmar, el botón usa el rojo del logo de EduHoot (#da4453).
    await expect(page.locator('#cancelGameBtn')).toHaveCSS('background-color', 'rgb(218, 68, 83)');
    expect(await emitsNamed(page, 'cancelGame')).toEqual([]);

    await page.locator('#cancelGameBtn').click();
    expect(await emitsNamed(page, 'cancelGame')).toHaveLength(1);
});

test('anfitrión: al confirmarse la cancelación se vuelve a crear', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.__serverEmit('gameCancelled'));
    await page.waitForURL(url => url.pathname === '/create/', { timeout: 5000 }).catch(() => {});
    expect(new URL(page.url()).pathname).toBe('/create/');
});

test('anfitrión: la lista de alumnos se ve durante la partida, también sin pregunta en curso', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.goto('/host/game/?id=g1&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.evaluate(() => window.__serverEmit('answerStatus', [[
        { playerId: 'p1', name: 'Ana', icon: '🐱', answered: false, hand: false, away: false, streak: 0 }
    ]]));
    await expect(page.locator('#answerStatus')).toBeVisible();
    await expect(page.locator('#answerStatus li', { hasText: 'Ana' }).locator('.kick-btn')).toBeVisible();
});

test('anfitrión (partida): un alumno expulsado se puede readmitir desde la lista de expulsados', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.goto('/host/game/?id=g1&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.evaluate(() => window.__serverEmit('kickedList', [[{ id: 7, name: 'NombreFeo' }]]));
    await expect(page.locator('#kicked-list .kicked-name')).toHaveText('NombreFeo');
    await page.locator('#kicked-list .unkick-btn').click();
    const emits = await emitsNamed(page, 'unkick-player');
    expect(emits).toEqual([{ id: 7 }]);
});

test('anfitrión (partida): saltar y cancelar van encima de la pregunta; la lista de alumnado debajo', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.__serverEmit('answerStatus', [[{ playerId: 'p1', name: 'Ana', icon: '🐱', answered: false, hand: false, away: false, streak: 0 }]]));
    const skip = await page.locator('#skipQButton').boundingBox();
    const cancel = await page.locator('#cancelGameBtn').boundingBox();
    const question = await page.locator('#question').boundingBox();
    const list = await page.locator('#answerStatus').boundingBox();
    expect(skip.y + skip.height).toBeLessThanOrEqual(question.y);
    expect(cancel.y + cancel.height).toBeLessThanOrEqual(question.y);
    const lastAnswer = await page.locator('#answer4').boundingBox();
    expect(list.y).toBeGreaterThanOrEqual(lastAnswer.y + lastAnswer.height - 1);
});

test('anfitrión (partida): siguiente pregunta y ver ranking se reparten el ancho', async ({ page }) => {
    await openGame(page);
    // Se fuerza la visibilidad: en la partida aparecen al terminar la pregunta; aquí se mide solo el reparto y el color.
    await page.evaluate(() => { document.getElementById('nextQButton').style.display = 'inline-block'; document.getElementById('showRanking').style.display = 'inline-block'; });
    const next = await page.locator('#nextQButton').boundingBox();
    const rank = await page.locator('#showRanking').boundingBox();
    expect(Math.abs(next.width - rank.width)).toBeLessThanOrEqual(2);
    await expect(page.locator('#nextQButton')).toHaveCSS('background-color', 'rgba(16, 185, 129, 0.22)');
    await expect(page.locator('#showRanking')).toHaveCSS('background-color', 'rgb(253, 188, 75)');
});

test('anfitrión (resultados): el botón de siguiente va arriba del modal y se queda visible al desplazarse', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => { document.getElementById('rankingModal').style.display = 'block'; });
    const first = await page.evaluate(() => document.querySelector('#rankingModal .modal-content').firstElementChild.id);
    expect(first).toBe('rankingNextBtn');
    await expect(page.locator('#rankingNextBtn')).toHaveCSS('position', 'sticky');
});

test('anfitrión (partida): quien abandona aparece como Abandono, separado de los expulsados', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.__serverEmit('leftList', [[{ id: 'p9', name: 'Lucía', icon: '🐰' }]]));
    await expect(page.locator('#left-list .left-name')).toHaveText('Lucía');
    await expect(page.locator('#left-list .left-tag')).toHaveText('Abandono');
    await expect(page.locator('#kicked-list')).toHaveCount(0);
    await expect(page.locator('#left-list .kick-btn, #left-list .unkick-btn')).toHaveCount(0);
});
