const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Con un quiz ya elegido el catálogo se oculta y el paginador (normal y flotante) tampoco debe verse.
const QUIZZES = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, name: `Quiz ${i}`, tags: [], questionsCount: 1 }));
const QUIZ = { id: 'q0', name: 'Quiz 0', tags: [], questions: [{ question: 'Q?', type: 'quiz', answers: ['a', 'b', 'c', 'd'], correctAnswers: [0], time: 20 }] };

for (const path of ['/solo/', '/multiplayer/']) {
    test(`${path}: el paginador se oculta al elegir un quiz`, async ({ page }) => {
        await page.route(/^https:\/\//, route => route.abort());
        await page.route('**/api/**', route => {
            const { pathname } = new URL(route.request().url());
            if (pathname === '/api/quizzes/q0') return route.fulfill({ json: QUIZ });
            if (/ranking$/.test(pathname)) return route.fulfill({ json: { top: [] } });
            return route.fulfill({ json: QUIZZES });
        });
        await page.goto(`${path}?lang=es`);
        await expect(page.locator('#public-pagination')).toBeVisible();
        await page.locator('#catalog-panel .card').first().locator('.btn-primary').click();
        await expect(page.locator('#catalog-panel')).toBeHidden();
        await expect(page.locator('#public-pagination')).toBeHidden();
        await expect(page.locator('#public-pagination-fixed')).toBeHidden();
    });
}
