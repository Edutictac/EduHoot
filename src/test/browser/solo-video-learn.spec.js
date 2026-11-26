const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Fase «aprén i després respon» (feature 24) en Solo: amb vídeo, primer es mira; la pregunta, les
// respostes i el temps comencen en acabar el vídeo (botó o final de l'arxiu).
const VIDEO_Q = { question: 'Què has vist?', type: 'quiz', answers: ['Roma', 'París', 'Berlín', 'Londres'], correctAnswers: [1], time: 20, video: 'https://example.com/clip.mp4' };
const PLAIN_Q = { question: 'Capital de França?', type: 'quiz', answers: ['Roma', 'París', 'Berlín', 'Londres'], correctAnswers: [1], time: 20 };

async function openSolo(page, questions) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/quizzes/v1') return route.fulfill({ json: { id: 'v1', name: 'Vídeo', tags: [], questions } });
        if (/solo-ranking$/.test(pathname)) return route.fulfill({ json: { top: [] } });
        return route.fulfill({ json: [] });
    });
    await page.clock.install();
    await page.goto('/solo/?id=v1&lang=es');
    await expect(page.locator('#start-form')).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.locator('#start-btn').click();
}

test('solo amb vídeo: es mira primer; el botó d\'acabar comença la pregunta amb el compte arrere', async ({ page }) => {
    await openSolo(page, [VIDEO_Q]);
    await expect(page.locator('#solo-learning')).toBeVisible();
    await expect(page.locator('#question-text')).toHaveCount(0);
    await expect(page.locator('.answer')).toHaveCount(0);
    await page.locator('#solo-learn-finish').click();
    await expect(page.locator('#solo-learning')).toHaveCount(0);
    await expect(page.locator('#solo-countdown')).toBeVisible();
    await page.clock.runFor(3000);
    await expect(page.locator('#question-text')).toHaveText('Què has vist?');
    await expect(page.locator('.answer', { hasText: 'París' })).toBeVisible();
});

test('solo amb vídeo: en acabar l\'arxiu la fase es tanca sola', async ({ page }) => {
    await openSolo(page, [VIDEO_Q]);
    await expect(page.locator('#solo-learning')).toBeVisible();
    await page.evaluate(() => document.getElementById('solo-learn-video').dispatchEvent(new Event('ended')));
    await expect(page.locator('#solo-learning')).toHaveCount(0);
    await page.clock.runFor(3000);
    await expect(page.locator('#question-text')).toHaveText('Què has vist?');
});

test('solo sense vídeo: no hi ha fase de vídeo', async ({ page }) => {
    await openSolo(page, [PLAIN_Q]);
    await expect(page.locator('#solo-learning')).toHaveCount(0);
    await page.clock.runFor(3000);
    await expect(page.locator('#question-text')).toHaveText('Capital de França?');
});

// La fase de vídeo ocupa la altura libre de la pantalla en 16:9, sense tapar el botó.
test('solo amb vídeo de YouTube: el vídeo s\'expandeix en altura en 16:9 i el botó es veu sense tapar-lo', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 921 });
    await openSolo(page, [{ ...VIDEO_Q, video: 'https://youtu.be/abc123' }]);
    const frame = await page.locator('#solo-learn-iframe').boundingBox();
    const button = await page.locator('#solo-learn-finish').boundingBox();
    expect(frame.height).toBeGreaterThanOrEqual(440);
    expect(frame.width / frame.height).toBeGreaterThan(1.7);
    expect(frame.width / frame.height).toBeLessThan(1.85);
    expect(frame.y + frame.height).toBeLessThanOrEqual(button.y);
    expect(button.y + button.height).toBeLessThanOrEqual(921);
});
