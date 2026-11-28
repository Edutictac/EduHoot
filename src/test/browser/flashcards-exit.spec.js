const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// «Salir del repaso»: vuelve a la biblioteca si se entró desde ella (?from=library); si no, al catálogo de /solo/.
const quiz = { id: 'e1', name: 'Capitals', tags: [], questions: [{ question: 'Capital de Francia', type: 'quiz', answers: ['París', 'Roma', 'Madrid', 'Berlín'], correctAnswers: [0], time: 20 }] };

test.beforeEach(async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/public-quizzes') return route.fulfill({ json: [{ id: 'e1', name: 'Capitals', tags: [], questionsCount: 1, playsCount: 0, playersCount: 0, ratingAvg: 0, ratingCount: 0, createdAt: '2026-10-01T00:00:00Z' }] });
        if (pathname === '/api/quizzes/e1') return route.fulfill({ json: quiz });
        return route.fulfill({ json: {} });
    });
    await page.addInitScript(() => localStorage.setItem('eduh_cards_validate', '0'));
});

test('desde la biblioteca, salir del repaso vuelve a /create/', async ({ page }) => {
    await page.goto('/solo/?id=e1&mode=cards&from=library&lang=es');
    await page.locator('#cards-start-all').click();
    await page.locator('#cards-exit').click();
    await page.waitForURL(/\/create\//);
    expect(new URL(page.url()).pathname).toBe('/create/');
});

test('desde el catálogo, salir del repaso sigue en /solo/', async ({ page }) => {
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    await page.locator('#cards-exit').click();
    await expect(page.locator('#selected-title')).toContainText('Elige un juego');
    expect(new URL(page.url()).pathname).toBe('/solo/');
});
