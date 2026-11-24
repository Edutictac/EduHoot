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


// Projector: ordenar (feature 7). Durant la pregunta, la llista barrejada; en mostrar el resultat, la solució.
const ORDER_ITEMS = ['Primer', 'Segon', 'Tercer', 'Quart'];
const SHOWN = ['Tercer', 'Primer', 'Quart', 'Segon'];

function orderQuestionPayload() {
    return {
        q1: 'Ordena els ordinals', a1: '', a2: '', a3: '', a4: '', type: 'order', time: 20,
        orderItems: SHOWN, orderSolution: ORDER_ITEMS, questionNumber: 1, totalQuestions: 1, playersInGame: 2, showScores: true
    };
}

test('projector: durant una pregunta d\'ordenar mostra la llista barrejada', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', orderQuestionPayload());
    const shown = await page.locator('#hostOrder li').allTextContents();
    expect(shown.map((s) => s.trim()).map((s) => s.replace(/^[A-Z]/, '').trim())).toEqual(SHOWN);
    await expect(page.locator('#resultsOrder')).toHaveCount(0);
});

test('projector: en mostrar el resultat, la solució en ordre correcte (si «Mostrar respuestas» està activat)', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', orderQuestionPayload());
    await serverEmit(page, 'questionOver', [], { type: 'order', items: ORDER_ITEMS, showCorrectAnswers: true, showScores: true, orderSolution: ORDER_ITEMS });
    // Cada fila: el número de posició i l'element (1Primer, 2Segon…).
    await expect(page.locator('#resultsOrder li')).toHaveText(ORDER_ITEMS.map((s, i) => String(i + 1) + s));
});
