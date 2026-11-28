const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Opció «Mostrar pregunta durante la cuenta atrás» en solo: marcada per defecte i recordada en el navegador.
const QUIZ = [{ question: 'Capital de França?', type: 'quiz', answers: ['Roma', 'París', 'Berlín', 'Londres'], correctAnswers: [1], time: 20 }];

async function openSolo(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/quizzes/c1') return route.fulfill({ json: { id: 'c1', name: 'Compte', tags: [], questions: QUIZ } });
        if (/solo-ranking$/.test(pathname)) return route.fulfill({ json: { top: [] } });
        return route.fulfill({ json: [] });
    });
    await page.clock.install();
    await page.goto('/solo/?id=c1&lang=es');
    await expect(page.locator('#start-form')).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
}

test('solo: la opció ve marcada i, durant la compte arrere, es veu la pregunta', async ({ page }) => {
    await openSolo(page);
    await expect(page.locator('#opt-show-question-countdown')).toBeChecked();
    await page.locator('#start-btn').click();
    await expect(page.locator('#solo-countdown')).toBeVisible();
    await expect(page.locator('#solo-countdown-question')).toContainText('Capital de França?');
});

test('solo: desmarcar-la es recorda en el navegador i la pregunta no es mostra durant la compte arrere', async ({ page }) => {
    await openSolo(page);
    await page.locator('#opt-show-question-countdown').uncheck();
    expect(await page.evaluate(() => localStorage.getItem('eduhoot-solo-show-question-countdown'))).toBe('0');
    await page.goto('/solo/?id=c1&lang=es');
    await expect(page.locator('#start-form')).toBeVisible();
    await expect(page.locator('#opt-show-question-countdown')).not.toBeChecked();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.locator('#start-btn').click();
    await expect(page.locator('#solo-countdown')).toBeVisible();
    await expect(page.locator('#solo-countdown-question')).toHaveCount(0);
});

test('solo: la opció de la compte arrere té el botó d\'ajuda «?» que mostra la explicació', async ({ page }) => {
    await openSolo(page);
    const help = page.locator('label:has(#opt-show-question-countdown) button.help-btn');
    await expect(help).toBeVisible();
    await help.click();
    await expect(page.locator('label:has(#opt-show-question-countdown) .help-pop')).toContainText('3-2-1');
});
