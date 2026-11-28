const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Pregunta d'ordenar en el mode Solo. Amb Math.random = 0.999 la barreja de tres elements
// no és la de origen: es mostren B, C, A (orderShown = [1, 2, 0]). L'ordre correcte és A, B, C.
const ITEMS = ['Encender el equipo', 'Cargar el sistema', 'Iniciar sesión'];
const orderQuestion = { question: 'Pasos del arranque', type: 'order', items: ITEMS, orderGrading: 0, answers: ['', '', '', ''], time: 30 };
const quiz = { id: 'o1', name: 'Arranque', tags: [], questions: [orderQuestion] };
const catalog = [{ id: 'o1', name: 'Arranque', tags: [], questionsCount: 1, playsCount: 0, playersCount: 0, ratingAvg: 0, ratingCount: 0, createdAt: '2026-01-01T00:00:00Z' }];

async function mockBackend(page) {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.__errors = errors;
    await page.addInitScript(() => { Math.random = () => 0.999; });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/public-quizzes') return route.fulfill({ json: catalog });
        if (pathname === '/api/quizzes/o1') return route.fulfill({ json: quiz });
        if (/solo-ranking$/.test(pathname)) return route.fulfill({ json: { top: [] } });
        return route.fulfill({ json: {} });
    });
}

test.afterEach(async ({ page }) => {
    expect(page.__errors).toEqual([]);
});

async function startSolo(page) {
    await mockBackend(page);
    await page.clock.install();
    await page.goto('/solo/?id=o1&lang=es');
    await expect(page.locator('#start-form')).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.locator('#start-btn').click();
    await page.clock.runFor(3000);
}

test('Solo: ordenar muestra la lista barajada, sin la rejilla de respuestas', async ({ page }) => {
    await startSolo(page);
    await expect(page.locator('.order-board')).toBeVisible();
    await expect(page.locator('.order-item .order-text')).toHaveText(['Cargar el sistema', 'Iniciar sesión', 'Encender el equipo']);
    await expect(page.locator('#answers .answer')).toHaveCount(0);
});

test('Solo: enviar sin ordenar es error y muestra el orden correcto', async ({ page }) => {
    await startSolo(page);
    await page.locator('.order-submit').click();
    await expect(page.locator('#feedback')).toHaveClass(/feedback--error/);
    await expect(page.locator('#feedback')).toContainText('Encender el equipo · 2 Cargar el sistema · 3 Iniciar sesión');
});

test('Solo: ordenar bien con las flechas es acierto', async ({ page }) => {
    await startSolo(page);
    // «Encender el equipo» está en la posición 3: se sube dos veces con ▲.
    await page.locator('.order-item').nth(2).locator('.order-move').first().click();
    await page.locator('.order-item').nth(1).locator('.order-move').first().click();
    await expect(page.locator('.order-item .order-text').first()).toHaveText('Encender el equipo');
    await page.locator('.order-submit').click();
    await expect(page.locator('#feedback')).toHaveClass(/feedback--success/);
});
