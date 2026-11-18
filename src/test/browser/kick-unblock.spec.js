const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Desbloqueo de alumnado expulsado (issue #29) y aviso de expulsión durante la
// partida en la pantalla del alumno. Socket.IO falso, como en los demás specs.
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

// ---------- Anfitrión: desbloqueo en el lobby ----------

test('anfitrión: la lista de expulsados permite volver a dejar entrar a un alumno', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'kickedList', [{ id: 7, name: 'NombreFeo' }]);

    await expect(page.locator('#kicked-list')).toBeVisible();
    await expect(page.locator('#kicked-list .kicked-name')).toHaveText('NombreFeo');
    await page.locator('#kicked-list .unkick-btn').click();
    expect(await emitsNamed(page, 'unkick-player')).toEqual([{ id: 7 }]);
});

test('anfitrión: sin expulsados no aparece la lista', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'kickedList', []);
    await expect(page.locator('#kicked-list')).toHaveCount(0);
});

// ---------- Alumno: expulsado durante la partida ----------

test('alumno en la partida: al ser expulsado ve el aviso y vuelve a la portada', async ({ page }) => {
    await mockBackend(page);
    await page.route(url => url.pathname === '/', route => route.fulfill({ contentType: 'text/html', body: '<p>portada</p>' }));
    await page.addInitScript(() => { localStorage.setItem('lang', 'es'); });
    await page.goto('/player/game/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'playerQuestion', { question: 'Capital de Francia?', answers: ['Paris', 'Londres', 'Roma', 'Berlín'], type: 'quiz', time: 15 });

    await serverEmit(page, 'kicked');
    await expect(page.locator('#message')).toHaveText('Has salido de la partida');
    await page.waitForURL(url => url.pathname === '/', { timeout: 6000 });
});

test('alumno en la partida: al ser expulsado deja de intentar reconectarse', async ({ page }) => {
    await mockBackend(page);
    await page.route(url => url.pathname === '/', route => route.fulfill({ contentType: 'text/html', body: '<p>portada</p>' }));
    await page.addInitScript(() => { localStorage.setItem('lang', 'es'); });
    await page.goto('/player/game/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await serverEmit(page, 'playerQuestion', { question: 'Capital de Francia?', answers: ['Paris', 'Londres', 'Roma', 'Berlín'], type: 'quiz', time: 15 });

    await serverEmit(page, 'kicked');
    const sockets = await page.evaluate(() => window.__sockets[0].connected);
    expect(sockets).toBe(false);
});
