const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Socket.IO falso (mismo patrón que player-game.spec.js): admite varios
// argumentos por evento (p. ej. questionOver(playerData, payload)).
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
    window.__serverEmit = function(name, args){
        window.__sockets[0].__trigger(name, args);
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

async function openGame(page, query) {
    await mockBackend(page);
    await page.goto('/host/game/' + (query || '?id=g1&pin=12345&lang=es'));
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

function serverEmit(page, name, ...args) {
    return page.evaluate(x => window.__serverEmit(x.name, x.args), { name, args });
}


// Correspondencia en el proyector (Jugar a l'aula).
const LEFT = ['Francia', 'Italia', 'Alemania'];
const RIGHT = ['Roma', 'Lisboa', 'Berlín', 'París'];
const SOLUTION = [3, 0, 2];

test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.__errors = errors;
});
test.afterEach(async ({ page }) => {
    expect(page.__errors).toEqual([]);
});

async function matchingQuestion(page) {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', {
        q1: 'Relaciona cada país con su capital', a1: '', a2: '', a3: '', a4: '',
        type: 'matching', time: 30, playersInGame: 4, questionNumber: 1, totalQuestions: 3, showScores: true,
        matchLeft: LEFT, matchRight: RIGHT, matchSolution: SOLUTION
    });
}

test('durante la pregunta: izquierda numerada y derecha con letras, sin las cuatro respuestas', async ({ page }) => {
    await matchingQuestion(page);
    await expect(page.locator('[data-host-left]')).toHaveText(['1Francia', '2Italia', '3Alemania']);
    await expect(page.locator('[data-host-right]')).toHaveText(['ARoma', 'BLisboa', 'CBerlín', 'DParís']);
    await expect(page.locator('#answer1')).toBeHidden();
});

test('resultados: porcentaje de acierto por pareja, impostoras y resumen', async ({ page }) => {
    await matchingQuestion(page);
    const players = [
        { playerId: 'a', name: 'Ana', gameData: { score: 900, answer: [3, 0, 2] } },
        { playerId: 'b', name: 'Biel', gameData: { score: 300, answer: [3, 1, null] } },
        { playerId: 'c', name: 'Clara', gameData: { score: 0, answer: [0, 3, 1] } },
        { playerId: 'd', name: 'Dani', gameData: { score: 0, answer: 0 } }
    ];
    await serverEmit(page, 'questionOver', players, { type: 'matching', matchLeft: LEFT, matchRight: RIGHT, matchSolution: SOLUTION });
    const rows = page.locator('.results-matching-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Francia → D París');
    await expect(rows.nth(0).locator('.results-matching-pct')).toHaveText('50%');
    await expect(rows.nth(1).locator('.results-matching-pct')).toHaveText('25%');
    await expect(rows.nth(2).locator('.results-matching-pct')).toHaveText('25%');
    await expect(page.locator('.results-matching-impostors')).toHaveText('Elementos sin pareja: B Lisboa');
    await expect(page.locator('.results-matching-summary')).toHaveText('Todo bien: 1 · parcial: 1 · ninguna: 2 (de 4)');
    await expect(page.locator('#resultsChart')).toBeHidden();
    await expect(page.locator('#hostMatching')).toHaveCount(0);
});

test('resultados sin «Mostrar respuestas»: porcentajes, pero sin solución ni impostoras', async ({ page }) => {
    await matchingQuestion(page);
    const players = [{ playerId: 'a', name: 'Ana', gameData: { score: 900, answer: [3, 0, null] } }];
    await serverEmit(page, 'questionOver', players, {
        type: 'matching', matchLeft: LEFT, matchRight: RIGHT, matchSolution: SOLUTION, showCorrectAnswers: false
    });
    const rows = page.locator('.results-matching-row');
    await expect(rows.nth(0).locator('.results-matching-text')).toHaveText('Francia');
    await expect(rows.nth(0).locator('.results-matching-pct')).toHaveText('100%');
    await expect(rows.nth(2).locator('.results-matching-pct')).toHaveText('0%');
    await expect(page.locator('#resultsMatching')).not.toContainText('→');
    await expect(page.locator('.results-matching-impostors')).toHaveCount(0);
});
