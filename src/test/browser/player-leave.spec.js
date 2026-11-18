const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Salir de la partida desde la pantalla del alumnado: pide confirmación antes de salir.
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
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

test('alumnado (partida): salir pide confirmación y luego avisa al servidor', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/player/game/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.evaluate(() => window.__serverEmit('playerQuestion', [{ question: 'Capital de Francia?', answers: ['Paris', 'Roma', 'Londres', 'Berlín'], type: 'quiz', time: 15 }]));

    await page.locator('#leaveGameBtn').click();
    await expect(page.locator('#leaveGameBtn')).toHaveText('Confirmar salida');
    expect(await emitsNamed(page, 'playerLeave')).toEqual([]);

    await page.locator('#leaveGameBtn').click();
    expect(await emitsNamed(page, 'playerLeave')).toHaveLength(1);
});

test('alumnado (lobby): salir pide confirmación y luego avisa al servidor', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/player/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await expect(page.locator('#leaveGameBtn')).toBeVisible();

    await page.locator('#leaveGameBtn').click();
    await expect(page.locator('#leaveGameBtn')).toHaveText('Confirmar salida');
    await page.locator('#leaveGameBtn').click();
    expect(await emitsNamed(page, 'playerLeave')).toHaveLength(1);
});

test('alumnado (partida): el botón de salir va flotante abajo a la izquierda, fuera de la cabecera', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/player/game/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.evaluate(() => window.__serverEmit('playerQuestion', [{ question: 'Capital de Francia?', answers: ['Paris', 'Roma', 'Londres', 'Berlín'], type: 'quiz', time: 15 }]));
    await expect(page.locator('#leaveGameBtn')).toHaveCSS('position', 'fixed');
    await expect(page.locator('#leaveGameBtn')).toHaveCSS('background-color', 'rgb(218, 68, 83)');
    const inStats = await page.evaluate(() => !!document.querySelector('#stats #leaveGameBtn'));
    expect(inStats).toBe(false);
    const box = await page.locator('#leaveGameBtn').boundingBox();
    const vp = page.viewportSize();
    expect(box.x).toBeLessThan(vp.width / 3);
    expect(box.y + box.height).toBeGreaterThan(vp.height * 0.6);
});

test('alumnado que abandonó: al volver recupera su nombre anterior, sin dado ni campo', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('playerTokens', JSON.stringify({ '12345:Lucía': 'tok-1' }));
    });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/validate-pin/**', route => {
        const withToken = route.request().url().includes('tokens=tok-1');
        return route.fulfill({ json: { valid: true, randomNames: false, lockedName: withToken ? 'Lucía' : null } });
    });
    await page.route('**/api/random-names', route => route.fulfill({ json: ['Curious Owl'] }));
    await page.route('**/api/validate-name**', route => route.fulfill({ json: { available: true } }));
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');

    await expect(page.locator('#randomName')).toHaveText('Lucía');
    await expect(page.locator('#rerollNameBtn')).toHaveCount(0);
    await expect(page.locator('#name')).toHaveCount(0);
    await expect(page.locator('.join-name-hint')).toHaveText('Recuperas tu nombre de antes.');
});
