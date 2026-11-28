const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// El aviso «Prueba las novedades» lo muestra o esconde el administrador para todos, con el botón 🧪 (solo visible para admin).
async function setup(page, { role, visible = true }) {
    const state = { visible, posts: [] };
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/env') return route.fulfill({ json: { env: 'production', stageNoticeVisible: state.visible } });
        if (url.pathname === '/api/auth/me') return role ? route.fulfill({ json: { id: 'u1', email: 'a@b.c', role, nickname: 'U' } }) : route.fulfill({ status: 401, json: {} });
        if (url.pathname === '/api/admin/settings/stage-notice') {
            const body = route.request().postDataJSON();
            state.posts.push(body.visible);
            state.visible = body.visible;
            return route.fulfill({ json: { ok: true, stageNoticeVisible: body.visible } });
        }
        return route.fulfill({ json: { tags: [], quizzes: [], enabled: false, top: [] } });
    });
    return state;
}

test('stageNoticeVisible=false: el aviso no se ve', async ({ page }) => {
    await setup(page, { role: null, visible: false });
    await page.goto('/create/?lang=es');
    await page.waitForTimeout(500);
    await expect(page.locator('#stage-notice')).toBeHidden();
});

test('stageNoticeVisible=true: el aviso se ve y el editor no tiene el botón 🧪', async ({ page }) => {
    const state = await setup(page, { role: 'editor' });
    await page.goto('/create/?lang=es');
    await expect(page.locator('#stage-notice')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator('#stage-notice-toggle')).toBeHidden();
    await expect(page.locator('#admin-link')).toBeHidden();
    expect(state.posts).toEqual([]);
});

test('anónimo: sin botón 🧪', async ({ page }) => {
    await setup(page, { role: null });
    await page.goto('/create/?lang=es');
    await expect(page.locator('#stage-notice')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator('#stage-notice-toggle')).toBeHidden();
    await expect(page.locator('#admin-link')).toBeHidden();
});

test('admin: el botón 🧪 alterna el aviso, lo guarda en el servidor y sigue tras recargar', async ({ page }) => {
    const state = await setup(page, { role: 'admin' });
    await page.goto('/create/?lang=es');
    const toggle = page.locator('#stage-notice-toggle');
    await expect(toggle).toBeVisible();
    // Junto al 🧪, el ⚙️ lleva al panel de administración.
    await expect(page.locator('#admin-link')).toBeVisible();
    await expect(page.locator('#admin-link')).toHaveAttribute('href', '/admin');
    await expect(page.locator('#stage-notice')).toBeVisible();
    await toggle.click();
    await expect(page.locator('#stage-notice')).toBeHidden();
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(page.locator('#stage-notice')).toBeVisible();
    await toggle.click();
    expect(state.posts).toEqual([false, true, false]);
    // Persistente: al recargar el servidor dice que está oculto y el botón sigue ahí.
    await page.reload();
    await expect(toggle).toBeVisible();
    await expect(page.locator('#stage-notice')).toBeHidden();
});
