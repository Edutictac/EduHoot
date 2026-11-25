const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// La pantalla inicial de Solo cap sencera en un PC normal (1366 × 768) sense desplaçar-se.
const quiz = { id: 'l1', name: 'Disposició', tags: [], questions: [{ question: 'Quant és 2+2?', type: 'quiz', answers: ['3', '4', '5', '6'], correctAnswers: [2], time: 15 }] };

test('Solo: en 1366 × 768 tots els controls de la pantalla inicial es veuen sense desplaçar-se', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/quizzes/l1') return route.fulfill({ json: quiz });
        return route.fulfill({ json: [] });
    });
    await page.goto('/solo/?id=l1&lang=es');
    await expect(page.locator('#start-form')).toBeVisible();
    for (const sel of ['#question-count', '#question-time', '#feedback-seconds', '#opt-shuffle-questions', '#opt-show-answers', '#opt-ghost', '#start-btn', '#solo-music-player']) {
        const box = await page.locator(sel).boundingBox();
        expect(box, sel).not.toBeNull();
        expect(box.y + box.height, sel).toBeLessThanOrEqual(768);
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(768);
});
