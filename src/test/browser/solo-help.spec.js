const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Ajuda «?» al costat de «Tiempo por pregunta» (com al lobby): s'obre i es tanca.
const quiz = { id: 'h1', name: 'Ajuda', tags: [], questions: [{ question: 'Quant és 2+2?', type: 'quiz', answers: ['3', '4', '5', '6'], correctAnswers: [2], time: 15 }] };

async function open(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/quizzes/h1') return route.fulfill({ json: quiz });
        if (pathname === '/api/public-quizzes') return route.fulfill({ json: [] });
        return route.fulfill({ json: {} });
    });
    await page.goto('/solo/?id=h1&lang=es');
    await expect(page.locator('#start-form')).toBeVisible();
}

test('Solo: el ? del tiempo por pregunta abre la explicación y se cierra al hacer clic fuera o con Escape', async ({ page }) => {
    await open(page);
    const help = page.locator('label[for="question-time"] .help-btn');
    await expect(help).toHaveText('?');
    await expect(page.locator('.help-pop')).toHaveCount(0);

    await help.click();
    await expect(page.locator('.help-pop')).toHaveText('Por defecto, el tiempo de cada pregunta. Si se cambia, se aplica a todas las preguntas.');
    await expect(help).toHaveAttribute('aria-expanded', 'true');

    await page.locator('#start-form h2, #start-form').first().click({ position: { x: 4, y: 4 } });
    await expect(page.locator('.help-pop')).toHaveCount(0);

    await help.click();
    await expect(page.locator('.help-pop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.help-pop')).toHaveCount(0);
});

test('Solo: el texto antiguo bajo «Empezar» ya no aparece', async ({ page }) => {
    await open(page);
    await expect(page.locator('#start-form')).not.toContainText('se respeta si el quiz');
});
