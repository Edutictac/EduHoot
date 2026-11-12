const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Red de seguridad per a passar /player/ (lobby.js) a Vue: fixa el que la
// sala d'espera envia i mostra segons els esdeveniments del servidor.
const FAKE_SOCKET_IO = `
(function(){
    window.__emits = [];
    window.__sockets = [];
    window.io = function(){
        var handlers = {};
        var socket = {
            id: 'p1',
            on: function(name, fn){ (handlers[name] = handlers[name] || []).push(fn); return socket; },
            emit: function(name, data){ window.__emits.push({ name: name, data: JSON.parse(JSON.stringify(data === undefined ? null : data)) }); return socket; },
            __trigger: function(name, args){ (handlers[name] || []).forEach(function(fn){ fn.apply(null, args || []); }); }
        };
        window.__sockets.push(socket);
        return socket;
    };
    window.__serverEmit = function(name, args){ window.__sockets[0].__trigger(name, args); };
})();
`;

async function openLobby(page, query) {
    await page.addInitScript(() => { localStorage.setItem('lang', 'es'); });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.route('**/player/game/**', route => route.fulfill({ contentType: 'text/html', body: '<p>joc</p>' }));
    await page.route(url => url.pathname === '/', route => route.fulfill({ contentType: 'text/html', body: '<p>portada</p>' }));
    await page.route('**/join.html?*', route => route.fulfill({ contentType: 'text/html', body: '<p>entrada</p>' }));
    await page.goto('/player/' + (query || '?pin=12345&icon=%F0%9F%90%BC&name=Ana&studentJoinToken=&token=tok1'));
    await page.waitForLoadState('load');
}

function serverEmit(page, name, ...args) {
    return page.evaluate(x => window.__serverEmit(x.name, x.args), { name, args });
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

test('antes de conectar muestra los textos traducidos de espera', async ({ page }) => {
    await openLobby(page);
    await expect(page.locator('#title1')).toHaveText('Esperando a que el anfitrión inicie la partida');
    await expect(page.locator('#title2')).toHaveText('¿Ves tu nombre en pantalla?');
    expect(await emitsNamed(page, 'player-join')).toEqual([]);
});

test('al conectar se une con los datos de la URL y reintenta si no llega confirmación', async ({ page }) => {
    await page.clock.install();
    await openLobby(page);
    await serverEmit(page, 'connect');
    const expected = { pin: '12345', icon: '🐼', name: 'Ana', studentJoinToken: '', token: 'tok1' };
    expect(await emitsNamed(page, 'player-join')).toEqual([expected]);
    await expect(page.locator('#title1')).toHaveText('Esperando a que empiece la partida');
    await expect(page.locator('#title2')).toHaveText('Comprueba que tu nombre aparece en la pantalla');
    await page.clock.runFor(1300);
    expect(await emitsNamed(page, 'player-join')).toEqual([expected, expected]);
});

test('con confirmación no reintenta y avisa de que está conectado', async ({ page }) => {
    await page.clock.install();
    await openLobby(page);
    await serverEmit(page, 'connect');
    await serverEmit(page, 'playerJoinAck');
    await expect(page.locator('#title1')).toHaveText('Conectado a la partida');
    await expect(page.locator('#title2')).toHaveText('Si no apareces en pantalla del profesor, espera 1-2 segundos.');
    await page.clock.runFor(1300);
    expect(await emitsNamed(page, 'player-join')).toHaveLength(1);
});

test('sin token en la URL usa el guardado para ese PIN y nombre', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('playerTokens', JSON.stringify({ '12345:Ana': 'guardat' })); });
    await openLobby(page, '?pin=12345&name=Ana');
    await serverEmit(page, 'connect');
    expect((await emitsNamed(page, 'player-join'))[0]).toEqual({ pin: '12345', name: 'Ana', token: 'guardat' });
});

test('sin token propio usa el de la última entrada si coinciden PIN y nombre', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('playerLastJoin', JSON.stringify({ pin: '12345', name: 'Ana', token: 'ultim' })); });
    await openLobby(page, '?pin=12345&name=Ana');
    await serverEmit(page, 'connect');
    expect((await emitsNamed(page, 'player-join'))[0].token).toBe('ultim');
});

test('reconexión del profesor: avisa y vuelve al mensaje de espera', async ({ page }) => {
    await openLobby(page);
    await serverEmit(page, 'hostReconnecting');
    await expect(page.locator('#title1')).toHaveText('Reconectando con el profesor...');
    await expect(page.locator('#title2')).toHaveText('La partida sigue reservada. No cierres esta pantalla.');
    await serverEmit(page, 'hostReconnected');
    await expect(page.locator('#title1')).toHaveText('Esperando a que empiece la partida');
});

test('acceso rechazado: muestra el error y vuelve a la portada', async ({ page }) => {
    await openLobby(page);
    await serverEmit(page, 'playerJoinRejected', { error: 'Token caducat' });
    await expect(page.locator('#title1')).toHaveText('Token caducat');
    await expect(page.locator('#title2')).toHaveText('Vuelve a entrar con tu código y PIN.');
    await page.waitForURL(url => url.pathname === '/');
});

test('sin partida vuelve a la portada', async ({ page }) => {
    await openLobby(page);
    await serverEmit(page, 'noGameFound');
    await page.waitForURL(url => url.pathname === '/');
});

test('si el profesor se desconecta vuelve a la portada', async ({ page }) => {
    await openLobby(page);
    await serverEmit(page, 'hostDisconnect');
    await page.waitForURL(url => url.pathname === '/');
});

test('al empezar la partida oculta el idioma y va a /player/game/ con sus datos', async ({ page }) => {
    await openLobby(page);
    await expect(page.locator('#lang-switcher button[data-lang]').first()).toBeVisible();
    await serverEmit(page, 'gameStartedPlayer');
    await page.waitForURL('**/player/game/**');
    const params = Object.fromEntries(new URL(page.url()).searchParams);
    expect(params).toEqual({ id: 'p1', pin: '12345', token: 'tok1', name: 'Ana' });
});

test('nombre ya en uso: lo avisa y vuelve a la entrada con el PIN', async ({ page }) => {
    await openLobby(page);
    await serverEmit(page, 'playerJoinRejected', { code: 'nameTaken', error: 'x' });
    await expect(page.locator('#title1')).toHaveText('Ese nombre ya está en uso en esta partida. Elige otro.');
    await page.waitForURL('**/join.html?*');
    expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ pin: '12345', nameTaken: '1' });
});
