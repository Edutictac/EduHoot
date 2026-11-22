const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// El distintivo de entorno (env-badge.js) va al 50 % en las pantallas del alumnado,
// en desarrollo y en stage, y al 100 % en el resto.
async function openWithEnv(page, path, env) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: 'window.io = function(){ var s = { on: function(){ return s; }, emit: function(){ return s; } }; return s; };'
    }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/api/env', route => route.fulfill({ json: { env } }));
    await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: {} }));
    await page.goto(path);
    await page.waitForLoadState('load');
}

function badge(page) {
    return page.locator('div, a').filter({ hasText: /Entorn: (desenvolupament|stage)/ }).last();
}

test('desarrollo: el distintivo va al 50 % en la pantalla del alumno', async ({ page }) => {
    await openWithEnv(page, '/player/game/?pin=12345&name=Ana&lang=es', 'development');
    await expect(badge(page)).toBeVisible();
    await expect(badge(page)).toHaveCSS('opacity', '0.5');
});

test('stage: el distintivo va al 50 % en la pantalla del alumno', async ({ page }) => {
    await openWithEnv(page, '/player/game/?pin=12345&name=Ana&lang=es', 'staging');
    await expect(badge(page)).toBeVisible();
    await expect(badge(page)).toHaveCSS('opacity', '0.5');
});

test('desarrollo: en la pantalla del anfitrión el distintivo también va al 50 %', async ({ page }) => {
    await openWithEnv(page, '/host/game/?id=g1&pin=12345&lang=es', 'development');
    await expect(badge(page)).toBeVisible();
    await expect(badge(page)).toHaveCSS('opacity', '0.5');
});

test('desarrollo: fuera de las pantallas de partida el distintivo se ve completo', async ({ page }) => {
    await openWithEnv(page, '/create/?lang=es', 'development');
    await expect(badge(page)).toBeVisible();
    await expect(badge(page)).toHaveCSS('opacity', '1');
});

// El distintivo muestra el ancho × alto de la ventana y solo se actualiza al redimensionar.
for (const env of ['development', 'staging']) {
    test(`${env}: el distintivo muestra el tamaño de la ventana y lo actualiza al redimensionar`, async ({ page }) => {
        await page.setViewportSize({ width: 900, height: 700 });
        await openWithEnv(page, '/?lang=es', env);
        const size = page.locator('.env-badge__size');
        await expect(size).toHaveText('900 × 700');
        await page.setViewportSize({ width: 640, height: 480 });
        await expect(size).toHaveText('640 × 480');
        // Sin redimensionar no cambia: el texto se mantiene.
        await page.waitForTimeout(300);
        await expect(size).toHaveText('640 × 480');
    });
}

// F9 (o Alt+B) oculta y muestra el distintivo para ver la pantalla como en producción; se recuerda entre pantallas.
for (const env of ['development', 'staging']) {
    test(`${env}: F9 oculta y muestra el distintivo, sin tinte ni clase de entorno, y se recuerda`, async ({ page }) => {
        await openWithEnv(page, '/?lang=es', env);
        const badgeEl = page.locator('.env-badge');
        await expect(badgeEl).toBeVisible();
        const cls = env === 'development' ? 'env-development' : 'env-staging';
        await expect(page.locator('html')).toHaveClass(new RegExp(cls));
        await page.keyboard.press('F9');
        await expect(badgeEl).toBeHidden();
        await expect(page.locator('.env-badge-tint')).toBeHidden();
        await expect(page.locator('html')).not.toHaveClass(new RegExp(cls));
        expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--env-badge-space'))).toBe('0px');
        // Se recuerda al cambiar de pantalla.
        await page.goto('/create/?lang=es');
        await page.waitForLoadState('load');
        await expect(page.locator('.env-badge')).toBeHidden();
        // Alt+B lo vuelve a mostrar.
        await page.keyboard.press('Alt+KeyB');
        await expect(page.locator('.env-badge')).toBeVisible();
        await expect(page.locator('html')).toHaveClass(new RegExp(cls));
    });
}
