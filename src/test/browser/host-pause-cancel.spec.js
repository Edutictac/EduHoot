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

test('anfitrión: junto al tiempo hay un símbolo de reproducción en marcha y de pausa si está pausada', async ({ page }) => {
    await openGame(page);
    const icon = page.locator('#timerStateIcon');
    await expect(icon).toHaveClass(/is-playing/);
    await expect(icon).toHaveAttribute('aria-label', 'Partida en marcha');
    await expect(icon.locator('path')).toHaveCount(1);
    await page.locator('#timerPauseBtn').click();
    await expect(icon).toHaveClass(/is-paused/);
    await expect(icon).toHaveAttribute('aria-label', 'Partida en pausa');
    await expect(icon.locator('rect')).toHaveCount(2);
    await page.locator('#timerPauseBtn').click();
    await expect(icon).toHaveClass(/is-playing/);
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

test('anfitrión (partida): quien abandona sale en la lista de estado como Abandono, con el botón deshabilitado', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.__serverEmit('answerStatus', [[
        { playerId: 'p1', name: 'Ana', icon: '🐱', answered: true, hand: false, away: false, streak: 0 },
        { playerId: 'p9', name: 'Lucía', icon: '🐰', answered: false, hand: false, away: false, streak: 0, left: true }
    ]]));
    const row = page.locator('#answerStatus li', { hasText: 'Lucía' });
    await expect(row).toHaveClass(/is-left/);
    await expect(row.locator('.answer-status-label--left')).toHaveText('Abandono');
    await expect(row.locator('.kick-btn')).toBeDisabled();
    await expect(row.locator('.kick-btn')).toHaveText('Abandonó');
    // El resumen cuenta solo a los alumnos que siguen en la partida.
    await expect(page.locator('#answerStatus .answer-status-summary')).toContainText('1 de 1');
    await expect(page.locator('#kicked-list')).toHaveCount(0);
});

test('anfitrión (partida): saltar, cancelar y Top 10 tienen el mismo tamaño', async ({ page }) => {
    await openGame(page);
    const skip = await page.locator('#skipQButton').boundingBox();
    const cancel = await page.locator('#cancelGameBtn').boundingBox();
    const top = await page.locator('#showRanking').boundingBox();
    for (const b of [skip, cancel, top]) expect(b).not.toBeNull();
    // En móvil los botones se apilan a propósito: el tamaño igual se comprueba en pantalla ancha.
    test.skip(page.viewportSize().width < 600, 'en móvil los botones se apilan');
    expect(Math.abs(skip.width - cancel.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(cancel.width - top.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(skip.height - cancel.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(cancel.height - top.height)).toBeLessThanOrEqual(1);
    await expect(page.locator('#showRanking')).toHaveText('Top 10');
    await expect(page.locator('#cancelGameBtn')).toHaveText('Cancelar partida');
});

test('anfitrión (partida): avance automático a la izquierda; puntuaciones a la derecha, con la casilla al final', async ({ page }) => {
    await openGame(page);
    const row = await page.locator('.top-row').boundingBox();
    const auto = await page.locator('.auto-advance-row label').first().boundingBox();
    const scores = await page.locator('.scores-toggle').boundingBox();
    const text = await page.locator('.scores-toggle span').boundingBox();
    const box = await page.locator('#scoresToggle').boundingBox();
    expect(Math.abs(auto.x - row.x)).toBeLessThanOrEqual(2);
    expect(Math.abs((scores.x + scores.width) - (row.x + row.width))).toBeLessThanOrEqual(2);
    expect(box.x).toBeGreaterThan(text.x + text.width - 1);
});

test('anfitrión (partida): las respuestas van en 2 columnas en pantalla ancha y en 1 en móvil', async ({ page }) => {
    await openGame(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    const a1 = await page.locator('#answer1').boundingBox();
    const a2 = await page.locator('#answer2').boundingBox();
    const a3 = await page.locator('#answer3').boundingBox();
    expect(Math.abs(a1.y - a2.y)).toBeLessThanOrEqual(2);
    expect(a2.x).toBeGreaterThan(a1.x + a1.width - 1);
    expect(Math.abs(a1.x - a3.x)).toBeLessThanOrEqual(2);
    expect(a3.y).toBeGreaterThan(a1.y + a1.height - 1);

    await page.setViewportSize({ width: 390, height: 844 });
    const m1 = await page.locator('#answer1').boundingBox();
    const m2 = await page.locator('#answer2').boundingBox();
    expect(Math.abs(m1.x - m2.x)).toBeLessThanOrEqual(2);
    expect(m2.y).toBeGreaterThan(m1.y + m1.height - 1);
});
