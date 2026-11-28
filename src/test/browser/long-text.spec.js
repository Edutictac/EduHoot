const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Un enunciado o una respuesta con una palabra muy larga (sin espacios) se parte y
// no se sale de su recuadro ni provoca desplazamiento horizontal, en todos los modos.
const LONG = 'Pregunta' + 'larguisima'.repeat(15);
const LONG_ANSWER = 'Respuesta' + 'sinespacios'.repeat(12);
const quiz = {
    id: 'q1',
    name: 'Prueba',
    tags: [],
    questions: [{ question: LONG, type: 'quiz', answers: [LONG_ANSWER, 'B', 'C', 'D'], correctAnswers: [1], time: 20 }]
};

const FAKE_SOCKET_IO = `
(function(){
    window.__sockets = [];
    window.io = function(){
        var handlers = {};
        var socket = {
            id: 'p1', connected: false,
            on: function(name, fn){ (handlers[name] = handlers[name] || []).push(fn); return socket; },
            emit: function(){ return socket; },
            disconnect: function(){ return socket; },
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

test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.__errors = errors;
    await page.addInitScript(() => { Math.random = () => 0.999; });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/quizzes/q1') return route.fulfill({ json: quiz });
        return route.fulfill({ json: pathname === '/api/public-quizzes' ? [] : {} });
    });
});

test.afterEach(async ({ page }) => {
    expect(page.__errors).toEqual([]);
});

// Comprueba que cada elemento cabe en su recuadro y que la página no se desplaza en horizontal.
async function expectFits(page, selectors) {
    for (const sel of selectors) {
        const el = page.locator(sel).first();
        await expect(el).toBeVisible();
        const fits = await el.evaluate(node => node.scrollWidth <= node.clientWidth + 1);
        expect(fits, sel).toBe(true);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
}

test('Solo', async ({ page }) => {
    await page.clock.install();
    await page.goto('/solo/?id=q1&lang=es');
    await page.locator('#start-btn').click();
    await page.clock.runFor(3000);
    await expectFits(page, ['#question-text', '#answers button.answer']);
});

test('Flashcards', async ({ page }) => {
    await page.goto('/solo/?id=q1&mode=cards&lang=es');
    await page.locator('#cards-start-all').click();
    await expectFits(page, ['#flashcard-question']);
    await page.locator('#cards-flip').click();
    await expectFits(page, ['#flashcard-answer li']);
});

test('Multijugador local', async ({ page }) => {
    await page.goto('/multiplayer/?id=q1&lang=es');
    await page.locator('#player-name-0').fill('ANA');
    await page.locator('#player-name-1').fill('BOB');
    await page.locator('#start-btn').click();
    // En partida, el enunciado se ve en cada panel (el general queda oculto).
    await expectFits(page, ['.player-panel [data-player-question]', '.player-panel .answer']);
});

test('Jugar en el aula: móvil del alumnado', async ({ page }) => {
    await page.goto('/player/game/?pin=123456&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.evaluate(([q, a]) => window.__serverEmit('playerQuestion', [{ question: q, answers: [a, 'B', 'C', 'D'], type: 'quiz', time: 20 }]), [LONG, LONG_ANSWER]);
    await expectFits(page, ['#questionText', '#answer1']);
});

test('Jugar en el aula: proyector', async ({ page }) => {
    await page.goto('/host/game/?id=g1&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.evaluate(([q, a]) => window.__serverEmit('gameQuestions', [{ q1: q, a1: a, a2: 'B', a3: 'C', a4: 'D', type: 'quiz', time: 20, playersInGame: 1, questionNumber: 1, totalQuestions: 1, showScores: true }]), [LONG, LONG_ANSWER]);
    await expectFits(page, ['#question', '#answer1']);
});
