const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// /solo/?id=… : el catàleg no es veu en cap moment mentre es carrega el quiz (ni tan sols un instant).
test('solo amb ?id=…: el catàleg queda ocult des del principi i apareix la pantalla d\'inici del quiz', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', async route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/quizzes/c1') {
            await new Promise(r => setTimeout(r, 800));
            return route.fulfill({ json: { id: 'c1', name: 'Quiz', tags: [], questions: [{ question: 'Q?', type: 'quiz', answers: ['a', 'b', 'c', 'd'], correctAnswers: [0], time: 20 }] } });
        }
        if (/solo-ranking$/.test(pathname)) return route.fulfill({ json: { top: [] } });
        return route.fulfill({ json: [{ id: 'x1', name: 'Llista', tags: [] }] });
    });
    await page.goto('/solo/?id=c1&lang=es', { waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => document.documentElement.classList.contains('quiz-from-url'))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('catalog-panel')).display)).toBe('none');
    await expect(page.locator('#start-form')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#catalog-panel')).toBeHidden();
});
