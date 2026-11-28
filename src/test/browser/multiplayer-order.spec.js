const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Multijugador local amb una pregunta d'ordenar. Amb Math.random = 0.999 la ronda mostra B, C, A;
// l'ordre correcte és A, B, C. Ana l'ordena bé; Bob envia la llista tal com ve (equivocada).
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
        return route.fulfill({ json: {} });
    });
}

test.afterEach(async ({ page }) => {
    expect(page.__errors).toEqual([]);
});

test('multijugador local: cada jugador ordena en su panel y se revela al final', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/multiplayer/?id=o1&lang=es');
    await expect(page.locator('#setup')).toBeVisible();
    await page.locator('#player-name-0').fill('ANA');
    await page.locator('#player-name-1').fill('BOB');
    await page.locator('#start-btn').click();
    await expect(page.locator('#game')).toBeVisible();

    const ana = page.locator('.player-panel[data-player="0"]');
    const bob = page.locator('.player-panel[data-player="1"]');
    await expect(ana.locator('.order-item .order-text')).toHaveText(['Cargar el sistema', 'Iniciar sesión', 'Encender el equipo']);
    await expect(bob.locator('.order-item .order-text')).toHaveText(['Cargar el sistema', 'Iniciar sesión', 'Encender el equipo']);

    // Ana: «Encender el equipo» sube a la primera posición con ▲ (dos veces) y envía.
    await ana.locator('.order-item').nth(2).locator('.order-move').first().click();
    await ana.locator('.order-item').nth(1).locator('.order-move').first().click();
    await ana.locator('.order-submit').click();
    await expect(ana.locator('.order-board')).toHaveCount(0);
    await expect(ana.locator('[data-feedback]')).toHaveText('');

    // Bob envía sin cambios: no está bien ordenada.
    await bob.locator('.order-submit').click();
    await expect(ana.locator('[data-feedback]')).toHaveText('¡Correcto!');
    await expect(bob.locator('[data-feedback]')).toHaveClass(/\bbad\b/);
});
