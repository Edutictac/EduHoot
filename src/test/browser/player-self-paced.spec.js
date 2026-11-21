const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Pantalla del alumnado en modo autoritme (/player/self-paced/), con Socket.IO falso.
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


async function open(page) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.__errors = errors;
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.goto('/player/self-paced/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}
const serverEmit = (page, name, ...args) => page.evaluate(x => window.__serverEmit(x.name, x.args), { name, args });
const emitsNamed = (page, name) => page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);

test.afterEach(async ({ page }) => { expect(page.__errors || []).toEqual([]); });

const Q1 = { question: '¿Capital de Francia?', answers: ['París', 'Londres', 'Roma', 'Berlín'], type: 'quiz', time: 20, timeTotal: 20, questionNumber: 1, totalQuestions: 2 };

test('autoritme: se une, pide la primera pregunta y contesta; luego pasa a la siguiente', async ({ page }) => {
    await open(page);
    expect(await emitsNamed(page, 'player-join-game')).toHaveLength(1);
    await serverEmit(page, 'quizInfo', { quizName: 'Capitales' });
    await serverEmit(page, 'spIdle');
    expect(await emitsNamed(page, 'spNext')).toHaveLength(1);

    await serverEmit(page, 'spQuestion', Q1);
    await expect(page.locator('#quizNameText')).toHaveText('Capitales');
    await expect(page.locator('#questionText')).toHaveText('¿Capital de Francia?');
    await expect(page.locator('#progressText')).toHaveText('Pregunta 1 de 2');
    await expect(page.locator('#answerGrid button:visible')).toHaveCount(4);

    await page.locator('#answer1').click();
    expect(await emitsNamed(page, 'spAnswer')).toEqual([1]);
    await serverEmit(page, 'spResult', { outcome: 'correct', points: 900, bonus: 0, streak: 1, score: 900, questionNumber: 1, totalQuestions: 2, meta: { type: 'quiz', correctAnswers: [1] } });
    await expect(page.locator('#message')).toHaveText('¡Correcto!');
    await expect(page.locator('#spPoints')).toHaveText('+900 puntos');
    await expect(page.locator('#scoreText')).toContainText('900');
    await expect(page.locator('#spNextBtn')).toHaveText('Siguiente pregunta');
    await page.locator('#spNextBtn').click();
    expect(await emitsNamed(page, 'spNext')).toHaveLength(2);
});

test('autoritme: fallo con «Mostrar respuestas» muestra la correcta; sin ella, no', async ({ page }) => {
    await open(page);
    await serverEmit(page, 'spQuestion', Q1);
    await page.locator('#answer2').click();
    await serverEmit(page, 'spResult', { outcome: 'incorrect', points: 0, bonus: 0, streak: 0, score: 0, questionNumber: 1, totalQuestions: 2, meta: { type: 'quiz', correctAnswers: [1] } });
    await expect(page.locator('#message')).toContainText('¡Incorrecto!');
    await expect(page.locator('#message')).toContainText('Respuesta correcta: París');

    await page.locator('#spNextBtn').click();
    await serverEmit(page, 'spQuestion', { ...Q1, questionNumber: 2 });
    await page.locator('#answer2').click();
    await serverEmit(page, 'spResult', { outcome: 'incorrect', points: 0, bonus: 0, streak: 0, score: 0, questionNumber: 2, totalQuestions: 2, meta: { type: 'quiz' } });
    await expect(page.locator('#message')).toHaveText('¡Incorrecto!');
    await expect(page.locator('#spNextBtn')).toHaveText('Ver mi resultado');
});

test('autoritme: el reloj propio avisa al servidor al agotarse el tiempo', async ({ page }) => {
    await open(page);
    await serverEmit(page, 'spQuestion', { ...Q1, time: 1, timeTotal: 5 });
    await expect.poll(async () => (await emitsNamed(page, 'spTimeUp')).length, { timeout: 4000 }).toBeGreaterThan(0);
    await serverEmit(page, 'spResult', { outcome: 'timeout', points: 0, bonus: 0, streak: 0, score: 0, questionNumber: 1, totalQuestions: 2, meta: { type: 'quiz' } });
    await expect(page.locator('#message')).toContainText('¡Se acabó el tiempo!');
});

test('autoritme: resumen final con puesto y cierre del anfitrión', async ({ page }) => {
    await open(page);
    await serverEmit(page, 'spFinished', { score: 1700, correctCount: 2, wrongCount: 0, bestStreak: 2, total: 2, rank: 1, players: 5 });
    await expect(page.locator('#spDone')).toContainText('¡Has terminado!');
    await expect(page.locator('#spDone')).toContainText('Puntuación: 1700');
    await expect(page.locator('#spDone')).toContainText('Aciertos: 2 de 2');
    await expect(page.locator('#spDone')).toContainText('Puesto 1 de 5');
    await serverEmit(page, 'GameOver', {});
    await expect(page.locator('.sp-done__hint')).toHaveText('El profesorado ha cerrado la partida.');
});

test('autoritme: respuesta rechazada devuelve a la pregunta; reconexión sin resultado muestra «Siguiente»', async ({ page }) => {
    await open(page);
    await serverEmit(page, 'spQuestion', Q1);
    await page.locator('#answer1').click();
    await serverEmit(page, 'answerRejected', { reason: 'timeout' });
    await expect(page.locator('#answerGrid button:visible')).toHaveCount(4);
    await serverEmit(page, 'spAnswered', { questionNumber: 1, totalQuestions: 2 });
    await expect(page.locator('#spNextBtn')).toBeVisible();
});

test('lobby: «gameStartedPlayer» con modo autoritme lleva a la pantalla nueva', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/player/self-paced/**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>sp</body></html>' }));
    await page.goto('/player/?pin=12345&name=Ana&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await Promise.all([
        page.waitForURL(/\/player\/self-paced\//),
        page.evaluate(() => window.__serverEmit('gameStartedPlayer', [{ mode: 'selfPaced' }]))
    ]);
});

test('autoritme: mano alzada y lectura en voz alta de la pregunta', async ({ page }) => {
    await page.addInitScript(() => {
        window.__spoken = [];
        window.SpeechSynthesisUtterance = function(text){ this.text = text; };
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
            getVoices: function(){ return [{ lang: 'es-ES', name: 'Voz de prueba' }]; },
            speak: function(u){ window.__spoken.push(u.text); },
            cancel: function(){},
            addEventListener: function(){}
        } });
    });
    await open(page);
    await serverEmit(page, 'spQuestion', Q1);

    await page.locator('#ttsButton').click();
    await expect(page.locator('#ttsButton')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.__spoken)).toEqual(['¿Capital de Francia?', 'París', 'Londres', 'Roma', 'Berlín']);

    await page.locator('#raiseHandBtn').click();
    await expect(page.locator('#raiseHandBtn')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#raiseHandBtn').click();
    expect(await emitsNamed(page, 'spHand')).toEqual([{ raised: true }, { raised: false }]);

    // Al contestar desaparecen la mano y la lectura.
    await serverEmit(page, 'spResult', { outcome: 'correct', score: 900, points: 900, bonus: 0, streak: 1, questionNumber: 1, totalQuestions: 2, meta: { type: 'quiz', correctAnswers: [1] } });
    await expect(page.locator('#raiseHandRow')).toHaveCount(0);
    await expect(page.locator('#ttsButton')).toHaveCount(0);
});

test('autoritme: sin speechSynthesis no hay botón de lectura', async ({ page }) => {
    await page.addInitScript(() => { Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); });
    await open(page);
    await serverEmit(page, 'spQuestion', Q1);
    await expect(page.locator('#questionText')).toBeVisible();
    await expect(page.locator('#ttsButton')).toHaveCount(0);
});

test('autoritme: Top 10 tras el resultado solo si el servidor lo envía (casilla de puntuaciones)', async ({ page }) => {
    await open(page);
    await serverEmit(page, 'spQuestion', Q1);
    const base = { outcome: 'correct', score: 900, points: 900, bonus: 0, streak: 1, questionNumber: 1, totalQuestions: 2, meta: { type: 'quiz', correctAnswers: [1] } };
    await serverEmit(page, 'spResult', { ...base, ranking: [{ name: 'Bruno', icon: '', score: 1200, me: false }, { name: 'Ana', icon: '', score: 900, me: true }], rank: 2, players: 2 });
    await expect(page.locator('#spRanking li')).toHaveCount(2);
    await expect(page.locator('#spRanking li.is-me')).toContainText('Ana - 900');

    await serverEmit(page, 'spQuestion', { ...Q1, questionNumber: 2 });
    await serverEmit(page, 'spResult', base);
    await expect(page.locator('#spRanking')).toHaveCount(0);
});
