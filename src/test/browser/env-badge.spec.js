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
