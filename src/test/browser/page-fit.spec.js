const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Entrada, anfitrión y alumnado: el contenido ocupa el ancho disponible.
// Escritorio: 10 % de margen a cada lado. Móvil: 12 px (margen mínimo).
const PAGES = [
    '/join.html?pin=12345&lang=es',
    '/host/?lang=es',
    '/host/game/?id=g1&pin=12345&lang=es',
    '/player/?pin=12345&name=Ana&icon=gat&lang=es',
    '/player/game/?pin=12345&name=Ana&icon=gat&lang=es',
];

async function mock(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "x", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
}

for (const [name, size, expectedGutter] of [['escritorio', { width: 1280, height: 800 }, 128], ['móvil', { width: 390, height: 844 }, 12]]) {
    test(`ancho del contenido en ${name}: margen ${expectedGutter}px`, async ({ page }) => {
        await mock(page);
        await page.setViewportSize(size);
        for (const url of PAGES) {
            await page.goto(url);
            await page.waitForLoadState('load');
            const gutter = await page.evaluate(() => parseFloat(getComputedStyle(document.body).paddingLeft));
            expect(Math.round(gutter), url).toBe(expectedGutter);
            // Ancho ocupado por el contenido: el hijo visible más ancho del body.
            const width = await page.evaluate(() => {
                let max = 0;
                document.querySelectorAll('body *').forEach(el => {
                    const r = el.getBoundingClientRect();
                    const cs = getComputedStyle(el);
                    // Se ignoran los elementos fijos (modales, cabecera) y los ocultos.
                    if (r.width > max && cs.display !== 'none' && cs.position !== 'fixed' && r.height > 0) max = r.width;
                });
                return max;
            });
            expect(width, url).toBeGreaterThan(0);
            // El contenido no se sale: ocupa el ancho de la página menos los dos márgenes.
            expect(Math.abs(width - (size.width - 2 * expectedGutter)), url).toBeLessThanOrEqual(2);
        }
    });
}

test('alumnado: la lista de iconos ocupa todo el ancho de su contenedor', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "x", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    const picker = await page.locator('#icon-picker').boundingBox();
    const parent = await page.locator('#icon-picker').evaluate(el => el.parentElement.getBoundingClientRect().width);
    expect(Math.abs(picker.width - parent)).toBeLessThanOrEqual(1);
});

test('alumnado: el icono elegido sale grande y centrado debajo de la lista, y «Nom a mostrar» centrado', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "x", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    const preview = page.locator('#icon-preview');
    await expect(preview).toHaveCSS('text-align', 'center');
    const size = parseFloat(await preview.evaluate(el => getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(60);
    const picker = await page.locator('#icon-picker').boundingBox();
    const box = await preview.boundingBox();
    // Va debajo de la lista de iconos, sin taparla.
    expect(box.y).toBeGreaterThanOrEqual(picker.y + picker.height - 1);
    const nameLabel = page.locator('label.label-center', { hasText: 'Nombre a mostrar' });
    await expect(nameLabel).toHaveCSS('text-align', 'center');
});

test('alumnado (entrada): «Volver» a la izquierda y el idioma a la derecha, a la misma altura', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "x", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    const back = await page.locator('.back-link').boundingBox();
    const lang = await page.locator('#lang-switcher').boundingBox();
    expect(back.x).toBeLessThan(100);
    expect(lang.x + lang.width).toBeGreaterThan(1280 - 100);
    // Misma línea: se compara el centro vertical de cada control.
    expect(Math.abs((back.y + back.height / 2) - (lang.y + lang.height / 2))).toBeLessThanOrEqual(2);
});

test('alumnado (entrada): la ayuda del nombre es correcta y va centrada', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "x", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    const hint = page.locator('.join-name-hint');
    await expect(hint).toHaveText('Este es el nombre que verá el profesor.');
    await expect(hint).toHaveCSS('text-align', 'center');
    await expect(page.locator('body')).not.toContainText('sin PIN');
});

test('alumnado (entrada): el campo del nombre va centrado y admite hasta 20 caracteres', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "x", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    const name = page.locator('#name');
    await expect(name).toHaveCSS('text-align', 'center');
    await expect(name).toHaveAttribute('maxlength', '20');
});

test('anfitrión: logo a la izquierda del título y QR a la derecha, alineado con el bloque de unión', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "h", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit && 0);
    const logo = await page.locator('.host-logo').boundingBox();
    const text = await page.locator('.join-text').boundingBox();
    const qr = await page.locator('.qr-card').boundingBox();
    expect(logo.x + logo.width).toBeLessThanOrEqual(text.x + 1);
    expect(qr.x).toBeGreaterThanOrEqual(text.x + text.width - 1);
    expect(Math.abs(qr.y - text.y)).toBeLessThanOrEqual(2);
    expect(Math.abs((qr.y + qr.height) - (text.y + text.height))).toBeLessThanOrEqual(2);
});

test('anfitrión: el chip de cuenta sale arriba a la derecha, como en creación y portada', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    // Se simula el componente de cuenta, que en la prueba no se puede cargar desde commons.
    await page.route('https://commons.edutictac.es/assets/account-widget.js', route => route.fulfill({ contentType: 'application/javascript', body: "customElements.define('edutictac-account', class extends HTMLElement { connectedCallback(){ this.innerHTML = '<span style=\"display:inline-block;padding:6px 12px;border-radius:999px;background:#334\">Authentik</span>'; } });" }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "h", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.waitForTimeout(300);
    const chip = await page.locator('.host-top-row edutictac-account').boundingBox();
    const row = await page.locator('.host-top-row').boundingBox();
    const qr = await page.locator('.qr-card').boundingBox();
    // Arriba del todo y pegado a la derecha de la fila.
    expect(chip.y).toBeLessThanOrEqual(row.y + row.height);
    expect(Math.abs((chip.x + chip.width) - (row.x + row.width))).toBeLessThanOrEqual(2);
    // El QR queda debajo del chip, con margen: no se solapan.
    expect(qr.y).toBeGreaterThanOrEqual(chip.y + chip.height + 8);
});

test('alumnado (entrada): «Volver» no ocupa todo el ancho y queda a la izquierda', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "x", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    const back = await page.locator('.back-link').boundingBox();
    expect(back.width).toBeLessThan(200);
    expect(back.x).toBeLessThan(100);
});

test('alumnado (entrada): el selector de idiomas va arriba a la derecha, sin ocupar todo el ancho', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "x", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    const lang = await page.locator('#lang-switcher').boundingBox();
    expect(lang.width).toBeLessThan(400);
    expect(lang.x + lang.width).toBeGreaterThan(1280 - 40);
    expect(lang.y).toBeLessThanOrEqual(24);
});

test('alumnado (entrada): el campo para escribir el nombre va centrado', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "x", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    const name = await page.locator('#name').boundingBox();
    expect(Math.abs((name.x + name.width / 2) - 640)).toBeLessThanOrEqual(4);
});

test('alumnado (entrada): tras poner el PIN, «Salir» aparece arriba a la izquierda y vuelve a pedir el PIN', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "x", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    const leave = page.locator('button.back-link--leave');
    await expect(leave).toHaveText('Salir');
    const box = await leave.boundingBox();
    expect(box.x).toBeLessThan(100);
    expect(box.y).toBeLessThanOrEqual(24);
    await leave.click();
    await expect(page.locator('#pinModal')).not.toHaveClass(/hidden/);
});

test('alumnado (entrada): hay 40 iconos para elegir, sin repetidos', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "x", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    const icons = await page.locator('#icon-picker button').allTextContents();
    expect(icons.length).toBe(40);
    expect(new Set(icons).size).toBe(40);
});

test('anfitrión: en 1280×800 las opciones van en 2 columnas y «Iniciar» queda dentro de la pantalla', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "h", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    const xs = await page.locator('.opt-group--checks > label').evaluateAll(els => [...new Set(els.map(e => Math.round(e.getBoundingClientRect().x)))]);
    expect(xs.length).toBe(2);
    // Las casillas van juntas, arriba; los ajustes (listas y números) debajo, sin mezclarse.
    const checks = await page.locator('.opt-group--checks').boundingBox();
    const values = await page.locator('.opt-group--values').boundingBox();
    expect(values.y).toBeGreaterThanOrEqual(checks.y + checks.height - 1);
    expect(await page.locator('.opt-group--checks input[type=checkbox]').count()).toBe(6);
    expect(await page.locator('.opt-group--checks select, .opt-group--checks input[type=number]').count()).toBe(0);
    const start = await page.locator('#start').boundingBox();
    expect(start.y + start.height).toBeLessThanOrEqual(800);
});

test('anfitrión: todas las opciones y parámetros del lobby tienen tooltip de ayuda', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "h", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.goto('/host/?lang=es');
    await page.waitForLoadState('load');
    await page.locator('#opt-advanced summary').click();
    const sinAyuda = await page.evaluate(() => [...document.querySelectorAll('#host-options input, #host-options select, #host-options summary, #host-options fieldset')]
        .filter(el => { let n = el; while (n && n.id !== 'host-options') { if (n.title && n.title.length > 20) return false; n = n.parentElement; } return true; })
        .map(el => el.id || el.tagName));
    expect(sinAyuda).toEqual([]);
});

test('portada: el contenido ocupa el ancho disponible con el mismo margen', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    for (const [size, gutter] of [[{ width: 1280, height: 800 }, 128], [{ width: 390, height: 844 }, 12]]) {
        await page.setViewportSize(size);
        await page.goto('/');
        await page.waitForLoadState('load');
        const box = await page.locator('.landing-shell').boundingBox();
        expect(Math.abs(box.width - (size.width - 2 * gutter))).toBeLessThanOrEqual(2);
    }
});

test('alumnado: al validar el PIN, el icono se asigna al azar y queda marcado en la lista', async ({ page }) => {
    await page.addInitScript(() => { Math.random = () => 0; });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "x", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    const selected = page.locator('#icon-picker button.selected');
    await expect(selected).toHaveCount(1);
    // Con Math.random = 0 cae en el primer icono de la lista.
    await expect(selected).toHaveText('🦊');
});

test('portada: el recuadro baja para no solaparse con el chip; botones y texto centrados al 70 %', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('load');
    const shell = await page.locator('.landing-shell').boundingBox();
    const actions = await page.locator('.landing-actions').boundingBox();
    const tagline = await page.locator('.tagline').boundingBox();
    expect(shell.y).toBeGreaterThanOrEqual(90);
    const pad = await page.locator('.landing-shell').evaluate(el => parseFloat(getComputedStyle(el).paddingLeft) + parseFloat(getComputedStyle(el).paddingRight));
    expect(Math.abs(actions.width - 0.7 * (shell.width - pad))).toBeLessThanOrEqual(3);
    expect(Math.abs((actions.x + actions.width / 2) - (shell.x + shell.width / 2))).toBeLessThanOrEqual(3);
    expect(Math.abs((tagline.x + tagline.width / 2) - (shell.x + shell.width / 2))).toBeLessThanOrEqual(3);
});

test('anfitrión: el icono queda alineado a la izquierda y el QR a la derecha con el recuadro de opciones', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "h", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/host/?lang=va');
    await page.waitForLoadState('load');
    const opts = await page.locator('#host-options').boundingBox();
    const logo = await page.locator('.host-logo').boundingBox();
    const qr = await page.locator('.qr-card').boundingBox();
    const text = await page.locator('#title').boundingBox();
    expect(Math.abs(logo.x - opts.x)).toBeLessThanOrEqual(2);
    expect(Math.abs((qr.x + qr.width) - (opts.x + opts.width))).toBeLessThanOrEqual(2);
    expect(text.x - (logo.x + logo.width)).toBeGreaterThanOrEqual(24);
    expect((qr.x) - (text.x + text.width)).toBeGreaterThanOrEqual(24);
});

test('alumnado (unión): logo y «EduHoot» en la misma línea, centrados en vertical', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    const logo = await page.locator('#join-logo').boundingBox();
    const title = await page.locator('#title').boundingBox();
    expect(Math.abs((logo.y + logo.height / 2) - (title.y + title.height / 2))).toBeLessThanOrEqual(2);
    expect(title.x).toBeGreaterThan(logo.x + logo.width - 1);
});

test('alumnado (unión): en dev, la fila del logo baja al alto del distintivo y no se solapa', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { valid: true, randomNames: false } }));
    await page.route('**/api/env', route => route.fulfill({ json: { env: 'development' } }));
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/join.html?pin=12345&lang=es');
    await page.waitForLoadState('load');
    await expect(page.locator('.env-badge')).toBeVisible();
    const badge = await page.locator('.env-badge').boundingBox();
    const brand = await page.locator('.join-brand').boundingBox();
    expect(brand.y).toBeGreaterThanOrEqual(badge.y + badge.height);
});

test('portada: en pantallas anchas los botones van en 2 columnas; en estrechas, uno debajo de otro', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    const tops = async () => page.locator('.landing-actions .btn').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().top)));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?lang=es');
    await page.waitForLoadState('load');
    let t = await tops();
    expect(t[0]).toBe(t[1]);
    expect(t[2]).toBe(t[3]);
    expect(t[2]).toBeGreaterThan(t[0]);
    await page.setViewportSize({ width: 800, height: 800 });
    t = await tops();
    expect(t[1]).toBeGreaterThan(t[0]);
    expect(t[3]).toBeGreaterThan(t[2]);
});

test('portada en 2 columnas: «Instalar app» centrado, del ancho de una columna y con la altura de un botón normal', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/?lang=es');
    await page.waitForLoadState('load');
    await page.locator('#installApp').evaluate(el => { el.hidden = false; });
    const btn = await page.locator('.landing-actions .btn').first().boundingBox();
    const install = await page.locator('#installApp').boundingBox();
    const shell = await page.locator('.landing-shell').boundingBox();
    expect(Math.abs(install.width - btn.width)).toBeLessThanOrEqual(2);
    // Los botones de la rejilla crecen en alto; «Instalar app» mantiene la altura de un botón normal.
    expect(install.height).toBeGreaterThanOrEqual(44);
    expect(install.height).toBeLessThan(btn.height);
    expect(Math.abs((install.x + install.width / 2) - (shell.x + shell.width / 2))).toBeLessThanOrEqual(2);
});

test('portada en 2 columnas: los botones crecen en alto como mucho hasta el doble de un botón normal', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.goto('/?lang=es');
    await page.waitForLoadState('load');
    await page.locator('#installApp').evaluate(el => { el.hidden = false; });
    const heights = async () => {
        const btn = await page.locator('.landing-actions .btn').first().boundingBox();
        const normal = await page.locator('#installApp').boundingBox();
        return { btn: btn.height, normal: normal.height };
    };
    // Pantalla alta: el botón llega al tope (el doble) y no lo pasa.
    await page.setViewportSize({ width: 1280, height: 1400 });
    let h = await heights();
    expect(h.btn).toBeLessThanOrEqual(2 * h.normal + 1);
    expect(h.btn).toBeGreaterThanOrEqual(2 * h.normal - 2);
    // Pantalla más baja: crece algo, pero menos.
    await page.setViewportSize({ width: 1280, height: 640 });
    h = await heights();
    expect(h.btn).toBeLessThanOrEqual(2 * h.normal + 1);
});

test('modo Solo: un texto muy largo (sin espacios) no se sale de la ventana de corrección', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: [] }));
    await page.goto('/solo/?lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => {
        const long = 'Supercalifragilisticoespialidoso_sin_espacios_' + 'x'.repeat(200);
        document.getElementById('feedback-modal').classList.add('show');
        document.getElementById('feedback-body').textContent = 'Respuesta correcta: ' + 'texto largo '.repeat(120) + long;
    });
    const content = page.locator('#feedback-modal .solo-modal__content');
    const box = await content.boundingBox();
    const viewport = page.viewportSize();
    expect(await content.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    await expect(page.locator('#feedback-close')).toBeAttached();
});
