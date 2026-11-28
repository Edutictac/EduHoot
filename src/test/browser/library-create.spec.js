const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Biblioteca: el botón «Crear» (al editor) se ve siempre, con o sin sesión y con o sin cuestionarios.
async function open(page, { quizzes, lang = 'es', role = null }) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ return { on: function(){}, emit: function(){}, disconnect: function(){}, connect: function(){} }; };' }));
    await page.route('**/api/auth/me', route => role ? route.fulfill({ json: { id: 'u1', email: 'a@b.c', role, nickname: 'U' } }) : route.fulfill({ status: 401, json: {} }));
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/auth/me') return route.fallback();
        if (pathname === '/api/quizzes') return route.fulfill({ json: quizzes });
        if (pathname === '/api/auth/authentik/config') return route.fulfill({ json: { enabled: false } });
        if (pathname === '/api/tags') return route.fulfill({ json: { tags: [] } });
        return route.fulfill({ json: { tags: [], quizzes: [], enabled: false } });
    });
    await page.goto(`/create/?lang=${lang}`);
}

const QUIZ = { id: 'q1', name: 'Quiz uno', tags: [], questionsCount: 2, ownerId: 'u1' };

for (const [label, role] of [['sin sesión', null], ['con sesión', 'editor']]) {
    test(`«Crear» en la cabecera del catálogo, ${label}`, async ({ page }) => {
        await open(page, { quizzes: [QUIZ], role });
        const create = page.locator('#library-create');
        await expect(create).toBeVisible();
        await expect(create).toContainText('Crear');
        await expect(create).toHaveAttribute('href', 'quiz-creator/');
    });
}

test('«Crear» también en el estado vacío', async ({ page }) => {
    await open(page, { quizzes: [] });
    await expect(page.locator('#library-create')).toBeVisible();
    await expect(page.locator('.empty-state .library-create-empty')).toBeVisible();
    await expect(page.locator('.empty-state .library-create-empty')).toHaveAttribute('href', 'quiz-creator/');
});

test('«Crear» se traduce', async ({ page }) => {
    await open(page, { quizzes: [QUIZ], lang: 'de' });
    await expect(page.locator('#library-create')).toContainText('Erstellen');
});
