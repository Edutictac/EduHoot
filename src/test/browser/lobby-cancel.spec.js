const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Lobby del anfitrión: «Cancelar partida» junto a «Iniciar partida», con confirmación.
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

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

test('lobby: cancelar está junto a iniciar, y iniciar es verde', async ({ page }) => {
    await openLobby(page);
    const cancel = await page.locator('#cancel').boundingBox();
    const start = await page.locator('#start').boundingBox();
    // En pantallas estrechas los dos botones se apilan a propósito.
    if (page.viewportSize().width >= 600) {
        expect(Math.abs(cancel.y - start.y)).toBeLessThanOrEqual(2);
    }
    await expect(page.locator('#start')).toHaveCSS('background-color', 'rgb(22, 163, 74)');
});

test('lobby: cancelar pide confirmación y luego cierra la partida', async ({ page }) => {
    await openLobby(page);
    await page.locator('#cancel').click();
    await expect(page.locator('#cancel')).toHaveText('Confirmar cancelación');
    expect(await emitsNamed(page, 'cancelGame')).toEqual([]);
    await page.locator('#cancel').click();
    expect(await emitsNamed(page, 'cancelGame')).toHaveLength(1);
});
