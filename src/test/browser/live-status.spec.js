const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Socket.IO falso igual que en los demás specs de partida: guarda lo que la página
// emite y deja lanzar eventos del servidor con __serverEmit.
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

// ---------- Anfitrión ----------

async function openHost(page) {
    await mockBackend(page);
    await page.goto('/host/game/?id=g1&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

function gameQuestionsPayload(overrides) {
    return Object.assign({
        q1: 'Capital de Francia?',
        a1: 'Paris', a2: 'Londres', a3: 'Roma', a4: 'Berlin',
        type: 'quiz',
        time: 15,
        playersInGame: 3,
        questionNumber: 1,
        totalQuestions: 3,
        showScores: true
    }, overrides || {});
}

const STATUS = [
    { playerId: 'p1', name: 'Ana', icon: '🐱', answered: true, hand: false, away: false },
    { playerId: 'p2', name: 'Pau', icon: '🐶', answered: false, hand: true, away: false },
    { playerId: 'p3', name: 'Joan', icon: '🐸', answered: false, hand: false, away: true }
];

test('anfitrión: muestra quién ha enviado, quién lo intenta, la mano y la pestaña', async ({ page }) => {
    await openHost(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await serverEmit(page, 'answerStatus', STATUS);

    await expect(page.locator('#answerStatus')).toBeVisible();
    await expect(page.locator('#answerStatus .answer-status-summary')).toContainText('1 de 3 han enviado');
    await expect(page.locator('#answerStatus .answer-status-summary')).toContainText('1 fuera de la pestaña');

    const items = page.locator('#answerStatus li');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('Ana');
    await expect(items.nth(0)).toContainText('Enviado');
    await expect(items.nth(1)).toContainText('Intentando');
    await expect(items.nth(1).locator('.answer-status-hand')).toBeVisible();
    await expect(items.nth(2).locator('.answer-status-away-dot')).toBeVisible();
});

test('anfitrión: al empezar una pregunta pide el estado de respuesta', async ({ page }) => {
    await openHost(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    expect((await emitsNamed(page, 'getAnswerStatus')).length).toBeGreaterThan(0);
});

test('anfitrión: pausar el temporizador lo para y avisa a los alumnos', async ({ page }) => {
    await openHost(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await expect(page.locator('#timerControls')).toBeVisible();

    await page.locator('#timerPauseBtn').click();
    await expect(page.locator('#timerPauseBtn')).toHaveText('Reanudar partida');
    const sync = await emitsNamed(page, 'timerSync');
    expect(sync[sync.length - 1]).toEqual({ time: 15, paused: true });

    await page.locator('#timerPauseBtn').click();
    await expect(page.locator('#timerPauseBtn')).toHaveText('Pausar partida');
});

test('anfitrión: +15 s suma tiempo a la pregunta y avisa a los alumnos', async ({ page }) => {
    await openHost(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());

    await page.locator('#timerAddBtn').click();
    await expect(page.locator('#num')).toHaveText('30');
    const sync = await emitsNamed(page, 'timerSync');
    expect(sync[sync.length - 1]).toEqual({ time: 30, paused: false });
});

// ---------- Alumno ----------

async function openPlayer(page) {
    await mockBackend(page);
    await page.goto('/player/game/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

const PLAYER_QUESTION = { question: 'Capital de Francia?', answers: ['Paris', 'Londres', 'Roma', 'Berlín'], type: 'quiz', time: 15 };

test('alumno: levantar la mano avisa al anfitrión y se puede bajar', async ({ page }) => {
    await openPlayer(page);
    await serverEmit(page, 'playerQuestion', PLAYER_QUESTION);

    await page.locator('#raiseHandBtn').click();
    await expect(page.locator('#raiseHandBtn')).toHaveAttribute('aria-pressed', 'true');
    let emits = await emitsNamed(page, 'raiseHand');
    expect(emits[emits.length - 1]).toEqual({ raised: true });

    await page.locator('#raiseHandBtn').click();
    await expect(page.locator('#raiseHandBtn')).toHaveAttribute('aria-pressed', 'false');
    emits = await emitsNamed(page, 'raiseHand');
    expect(emits[emits.length - 1]).toEqual({ raised: false });
});

test('alumno: al cambiar de pestaña lo comunica al anfitrión', async ({ page }) => {
    await openPlayer(page);
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    const emits = await emitsNamed(page, 'tabState');
    expect(emits[emits.length - 1]).toEqual({ away: true });
});

test('alumno: con el temporizador pausado por el anfitrión el tiempo no baja', async ({ page }) => {
    await openPlayer(page);
    await serverEmit(page, 'playerQuestion', PLAYER_QUESTION);
    await serverEmit(page, 'timerSync', { time: 10, paused: true });
    await expect(page.locator('#playerTimerText')).toHaveText('10s');

    await page.waitForTimeout(2200);
    await expect(page.locator('#playerTimerText')).toHaveText('10s');
});

test('alumno: al reanudar el anfitrión la cuenta atrás sigue desde el tiempo recibido', async ({ page }) => {
    await openPlayer(page);
    await serverEmit(page, 'playerQuestion', PLAYER_QUESTION);
    await serverEmit(page, 'timerSync', { time: 12, paused: false });
    await expect(page.locator('#playerTimerText')).toHaveText('11s', { timeout: 3000 });
});

test('alumno: durante la partida muestra el código de la partida agrupado', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/player/game/?pin=273658&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await expect(page.locator('#gamePin .game-pin__code')).toHaveText('273 658');
});
