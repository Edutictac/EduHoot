const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Tiempos ampliados por partida (issue #13), desde «Opciones avanzadas» del lobby.
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

async function openHost(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

test('anfitrión: las opciones avanzadas están plegadas y tienen valores normales', async ({ page }) => {
    await openHost(page);
    await expect(page.locator('#opt-advanced')).not.toHaveAttribute('open', /.*/);
    await expect(page.locator('#opt-advanced summary')).toHaveText(/^Opciones avanzadas/);
    await expect(page.locator('#opt-t-inactivity')).toHaveValue('');
});

test('anfitrión: ampliar un tiempo envía solo ese ajuste al servidor', async ({ page }) => {
    await openHost(page);
    await page.locator('#opt-advanced summary').click({ position: { x: 20, y: 14 } });
    await page.locator('#opt-t-inactivity').fill('45');
    await page.locator('#opt-t-inactivity').dispatchEvent('change');
    const emits = await emitsNamed(page, 'setGameTimings');
    expect(emits[emits.length - 1]).toEqual({ inactivityMin: 45 });
});

test('anfitrión: las opciones avanzadas empiezan en línea nueva y cada tiempo va en su propia línea', async ({ page }) => {
    await openHost(page);
    await page.locator('#opt-advanced summary').click({ position: { x: 20, y: 14 } });
    // Espera a que el desplegable termine de abrirse antes de medir.
    await expect(page.locator('#opt-t-inactivity')).toBeVisible();
    await page.waitForTimeout(300);
    const container = await page.locator('#host-options').boundingBox();
    const details = await page.locator('#opt-advanced').boundingBox();
    // Ocupa todo el ancho del bloque de opciones.
    // (se descuenta el relleno del contenedor: 12 px a cada lado y el borde).
    expect(details.width).toBeGreaterThan(container.width - 40);
    // Empieza debajo de la última casilla de las opciones normales (línea nueva).
    const lastCheckbox = await page.locator('#opt-show-scores').boundingBox();
    expect(details.y).toBeGreaterThanOrEqual(lastCheckbox.y + lastCheckbox.height - 1);
    // Cada tiempo en su propia línea, una debajo de otra.
    const ids = ['#opt-t-host', '#opt-t-player', '#opt-t-cleanup', '#opt-t-inactivity'];
    const boxes = [];
    for (const id of ids) boxes.push(await page.locator(id).boundingBox());
    for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y + boxes[i - 1].height / 2);
    }
});

test('anfitrión: al pulsar Iniciar partida se ve el aviso de espera de inmediato', async ({ page }) => {
    await openHost(page);
    await page.evaluate(() => window.__serverEmit('showGamePin', [{ pin: '12345' }]));
    await page.locator('#start').click();
    await expect(page.locator('#start')).toBeDisabled();
    await expect(page.locator('.starting-msg')).toHaveText('Iniciando partida… espera');
});
