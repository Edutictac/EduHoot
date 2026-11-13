const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Lectura en veu alta (proposta 13) a /solo/. La veu real no es pot provar
// amb Playwright: aquí es simula speechSynthesis i es comprova què es
// demana llegir i quan. Les proves manuals en iPad/iPhone són a TTS_PLAN.md.

const quiz = {
    id: 'q1',
    name: 'Geografia',
    tags: [],
    questions: [
        { question: 'Capital de <b>França</b>?', type: 'quiz', answers: ['París', 'Berlín', 'Roma', 'Londres'], correctAnswers: [1], time: 20 }
    ]
};

const FAKE_SPEECH = `
    window.__spoken = [];
    window.__cancelCount = 0;
    window.SpeechSynthesisUtterance = function(text){ this.text = text; };
    // speechSynthesis és de només lectura: cal redefinir-la.
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
        getVoices: function(){ return [{ lang: 'es-ES', name: 'Voz de prueba' }]; },
        speak: function(u){ window.__spoken.push(u.text); },
        cancel: function(){ window.__cancelCount += 1; }
    } });
`;

async function mockBackend(page) {
    await page.addInitScript(() => { Math.random = () => 0.999; });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/public-quizzes') return route.fulfill({ json: [] });
        if (pathname === '/api/quizzes/q1/solo-ranking') return route.fulfill({ json: { top: [] } });
        if (pathname === '/api/quizzes/q1') return route.fulfill({ json: quiz });
        return route.fulfill({ json: {} });
    });
}

async function startGame(page) {
    await page.clock.install();
    await page.goto('/solo/?id=q1&lang=es');
    await expect(page.locator('#start-form')).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.locator('#start-btn').click();
    await expect(page.locator('#game-area')).toBeVisible();
    // Compte arrere 3-2-1: es deixa passar perquè aparega la pregunta.
    await expect(page.locator('#solo-countdown span')).toHaveText('3');
    await page.clock.runFor(3000);
    await expect(page.locator('#solo-countdown')).toHaveCount(0);
}

test('el botó llig la pregunta i les respostes, i para quan es torna a prémer', async ({ page }) => {
    await mockBackend(page);
    await page.addInitScript(FAKE_SPEECH);
    await startGame(page);

    const button = page.locator('#tts-button');
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-pressed', 'false');

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    const spoken = await page.evaluate(() => window.__spoken);
    expect(spoken).toEqual(['Capital de França?', 'París', 'Berlín', 'Roma', 'Londres']);

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => window.__cancelCount)).toBeGreaterThan(0);
});

test('sense speechSynthesis no es mostra el botó', async ({ page }) => {
    await mockBackend(page);
    await page.addInitScript(() => {
        Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
    });
    await startGame(page);
    await expect(page.locator('#question-text')).toBeVisible();
    await expect(page.locator('#tts-button')).toHaveCount(0);
});

// Jugador («Jugar a l'aula»): el mateix botó, amb la pregunta i les
// respostes que arriben per socket. Socket.IO fals com a player-game.spec.
const FAKE_SOCKET_IO = `
(function(){
    window.__sockets = [];
    window.io = function(){
        var handlers = {};
        var socket = {
            id: 'p1', connected: false,
            on: function(name, fn){ (handlers[name] = handlers[name] || []).push(fn); return socket; },
            emit: function(){ return socket; },
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

async function openPlayer(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.addInitScript(FAKE_SPEECH);
    await page.goto('/player/game/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

test('jugador: el botó llig la pregunta i les respostes', async ({ page }) => {
    await openPlayer(page);
    await page.evaluate(() => window.__serverEmit('playerQuestion', [{
        question: 'Capital de <b>França</b>?<br>Tria una',
        answers: ['París', 'Berlín', 'Roma', 'Londres'],
        type: 'quiz',
        time: 20
    }]));
    const button = page.locator('#ttsButton');
    await expect(button).toBeVisible();
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.__spoken)).toEqual([
        'Capital de França?. Tria una', 'París', 'Berlín', 'Roma', 'Londres'
    ]);
});

test('jugador: en mode «a cegues» no hi ha botó ni es llig res', async ({ page }) => {
    await openPlayer(page);
    await page.evaluate(() => window.__serverEmit('playerQuestion', [{ blind: true, type: 'quiz', answerCount: 2, time: 20 }]));
    await expect(page.locator('#questionText')).toBeVisible();
    await expect(page.locator('#ttsButton')).toHaveCount(0);
});
