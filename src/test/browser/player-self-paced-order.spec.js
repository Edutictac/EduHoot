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

// Autoritme amb una pregunta d'ordenar: el tauler, l'enviament de l'ordre i el resultat amb l'ordre correcte.
const ITEMS = ['Encender el equipo', 'Cargar el sistema', 'Iniciar sesión'];
const ORDER_Q = { question: 'Pasos del arranque', type: 'order', orderItems: ['Cargar el sistema', 'Iniciar sesión', 'Encender el equipo'], layout: 'vertical', time: 20, timeTotal: 20, questionNumber: 1, totalQuestions: 1 };

test('autoritme: ordenar muestra el tablero con los elementos y envía la posición elegida', async ({ page }) => {
    await open(page);
    await serverEmit(page, 'spIdle');
    await serverEmit(page, 'spQuestion', ORDER_Q);
    await expect(page.locator('.order-board')).toBeVisible();
    await expect(page.locator('.order-item .order-text')).toHaveText(['Cargar el sistema', 'Iniciar sesión', 'Encender el equipo']);
    // «Encender el equipo» (posición 2) sube a la primera con ▲ dos veces; luego se envía.
    await page.locator('.order-item').nth(2).locator('.order-move').first().click();
    await page.locator('.order-item').nth(1).locator('.order-move').first().click();
    await page.locator('.order-submit').click();
    expect(await emitsNamed(page, 'spAnswer')).toEqual([[2, 0, 1]]);
});

test('autoritme: a cegues, el tablero muestra códigos y no los textos', async ({ page }) => {
    await open(page);
    await serverEmit(page, 'spIdle');
    await serverEmit(page, 'spQuestion', { ...ORDER_Q, blind: true, orderCount: 3, orderItems: undefined });
    await expect(page.locator('.order-item .order-text')).toHaveText(['A', 'B', 'C']);
});

test('autoritme: fallar ordenar muestra el orden correcto, con «Mostrar respuestas»', async ({ page }) => {
    await open(page);
    await serverEmit(page, 'spIdle');
    await serverEmit(page, 'spQuestion', ORDER_Q);
    await page.locator('.order-submit').click();
    await serverEmit(page, 'spResult', { outcome: 'incorrect', points: 0, bonus: 0, streak: 0, score: 0, questionNumber: 1, totalQuestions: 1, meta: { type: 'order', items: ITEMS } });
    await expect(page.locator('.order-review')).toContainText('1. Encender el equipo · 2. Cargar el sistema · 3. Iniciar sesión');
});
