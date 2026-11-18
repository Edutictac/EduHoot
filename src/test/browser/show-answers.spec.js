const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// «Mostrar respuestas»: activado por defecto en el lobby y se envía al iniciar.
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

async function openLobby(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.goto('/host/?id=q1&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

test('lobby: «Mostrar respuestas» está activado por defecto y se envía al iniciar', async ({ page }) => {
    await openLobby(page);
    await expect(page.locator('#opt-show-answers')).toBeChecked();
    await page.evaluate(() => window.__serverEmit('showGamePin', [{ pin: '12345' }]));
    await page.locator('#start').click();
    await expect.poll(() => page.evaluate(() => window.__emits.filter(e => e.name === 'startGame').length)).toBe(1);
    const sent = await page.evaluate(() => window.__emits.find(e => e.name === 'startGame').data);
    expect(sent.showCorrectAnswers).toBe(true);
});

test('lobby: desmarcar «Mostrar respuestas» envía que no se muestre la respuesta correcta', async ({ page }) => {
    await openLobby(page);
    await page.locator('#opt-show-answers').uncheck();
    await page.evaluate(() => window.__serverEmit('showGamePin', [{ pin: '12345' }]));
    await page.locator('#start').click();
    await expect.poll(() => page.evaluate(() => window.__emits.filter(e => e.name === 'startGame').length)).toBe(1);
    const sent = await page.evaluate(() => window.__emits.find(e => e.name === 'startGame').data);
    expect(sent.showCorrectAnswers).toBe(false);
});
