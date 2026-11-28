const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Nombres aleatorios (feature 12): el anfitrión elige la opción en el lobby y el
// alumnado recibe un nombre de la lista, sin poder escribirlo.
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

const NAMES = ['Curious Owl', 'Wise Owl', 'Brave Reader'];

async function mockBackend(page, { randomNames }) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.route('**/api/validate-pin/**', route => route.fulfill({ json: { valid: true, randomNames } }));
    await page.route('**/api/random-names', route => route.fulfill({ json: NAMES }));
    await page.route('**/api/validate-name**', route => route.fulfill({ json: { available: true } }));
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

test('alumnado: con nombres aleatorios no ve campo de texto y recibe un nombre de la lista', async ({ page }) => {
    await mockBackend(page, { randomNames: true });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');

    await expect(page.locator('#name')).toHaveCount(0);
    await expect(page.locator('#randomName')).toBeVisible();
    await expect(page.locator('#randomName')).toHaveText(new RegExp('^(' + NAMES.join('|') + ')$'));
    // El formulario envía el mismo nombre que se muestra (si no, la entrada llega sin nombre).
    const shown = await page.locator('#randomName').innerText();
    await expect(page.locator('form input[name="name"]')).toHaveValue(shown);
});

test('alumnado: el dado gira y el nombre nuevo sale a los 3 s, de la lista', async ({ page }) => {
    await mockBackend(page, { randomNames: true });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    await expect(page.locator('#randomName')).toBeVisible();
    const before = await page.locator('#randomName').innerText();

    const started = Date.now();
    await page.locator('#rerollNameBtn').click();
    await expect(page.locator('#rerollNameBtn')).toHaveClass(/is-rolling/);
    await expect(page.locator('#rerollNameBtn')).toBeDisabled();
    await expect(page.locator('#randomName')).toHaveText(before);

    await expect(page.locator('#rerollNameBtn')).toBeEnabled({ timeout: 6000 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(2900);
    await expect(page.locator('#rerollNameBtn')).not.toHaveClass(/is-rolling/);
    expect(NAMES).toContain(await page.locator('#randomName').innerText());
});

test('alumnado: sin la opción aleatoria sigue el campo de texto', async ({ page }) => {
    await mockBackend(page, { randomNames: false });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');

    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#randomName')).toHaveCount(0);
});

test('anfitrión: elegir nombres aleatorios en el lobby avisa al servidor', async ({ page }) => {
    await mockBackend(page, { randomNames: false });
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));

    await page.locator('#opt-name-mode input[value="random"]').check();
    const emits = await emitsNamed(page, 'setRandomNames');
    expect(emits[emits.length - 1]).toEqual({ enabled: true });

    await page.locator('#opt-name-mode input[value="typed"]').check();
    const after = await emitsNamed(page, 'setRandomNames');
    expect(after[after.length - 1]).toEqual({ enabled: false });
});

test('anfitrión: la opción aleatoria se llama «Aleatorio», sin aclaraciones', async ({ page }) => {
    await mockBackend(page, { randomNames: false });
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await expect(page.locator('#opt-name-mode')).toContainText('Aleatorio');
    await expect(page.locator('#opt-name-mode')).not.toContainText('lista');
});

test('anfitrión: con alumnado unido no se puede cambiar la opción de nombres', async ({ page }) => {
    await mockBackend(page, { randomNames: false });
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await expect(page.locator('#opt-name-mode input[value="typed"]')).toBeEnabled();

    await page.evaluate(() => window.__serverEmit('updatePlayerLobby', [[{ playerId: 'p1', name: 'Ana', icon: '🐱' }]]));
    await expect(page.locator('#opt-name-mode input[value="typed"]')).toBeDisabled();
    await expect(page.locator('#opt-name-mode input[value="random"]')).toBeDisabled();
});

test('alumnado: el dado permite cambiar de nombre como mucho 2 veces', async ({ page }) => {
    test.setTimeout(60000);
    await mockBackend(page, { randomNames: true });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');

    const dice = page.locator('#rerollNameBtn');
    await expect(dice).toBeEnabled();
    for (let i = 0; i < 2; i++) {
        await dice.click();
        // Espera a que termine el giro (el botón puede quedar bloqueado tras el último).
        await expect(dice).not.toHaveClass(/is-rolling/, { timeout: 5000 });
    }
    await expect(dice).toBeDisabled();
    await expect(dice).toHaveAttribute('title', 'Ya has cambiado de nombre 2 veces');
});
