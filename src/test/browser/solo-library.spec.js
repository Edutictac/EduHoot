const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

const question = {
    question: 'Quina és la capital de França?', type: 'quiz',
    answers: ['París', 'Berlín', 'Roma', 'Londres'],
    correct: 0, correctAnswers: [0], time: 30
};

const quizzes = [
    { id: 'q1', name: 'Geografia', tags: ['socials'], questionsCount: 1, playsCount: 4, playersCount: 2, ratingAvg: 4, ratingCount: 2 },
    { id: 'q2', name: 'Matemàtiques', tags: [], questionsCount: 1, playsCount: 0, playersCount: 0, ratingAvg: 0, ratingCount: 0 }
];

async function mockBackend(page) {
    await page.addInitScript(() => { Math.random = () => 0.999; });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        const method = route.request().method();
        if (pathname === '/api/public-quizzes') {
            return route.fulfill({ json: quizzes });
        }
        if (pathname === '/api/quizzes/q1' && method === 'GET') {
            return route.fulfill({ json: { id: 'q1', name: 'Geografia', questions: [question] } });
        }
        if (pathname === '/api/quizzes/q1/rating') {
            return route.fulfill({ json: { avg: 5, count: 3 } });
        }
        // Resto de llamadas (p. ej. la miniatura de q2 sin coverImage): respuesta neutra.
        return route.fulfill({ json: {} });
    });
}

// Camino feliz de /solo/ que no cubren los specs existentes (que arrancan
// directamente con ?id=): listado público, favorito persistente, valoración
// con estrellas, selección de un quiz y una partida hasta el resultado.
// Pensado como red de seguridad reutilizable mientras se reparte solo.js en
// varios ficheros (ver .local/MIGRATION_PROGRESS.md), no como cobertura
// exhaustiva del frontend.
test('listado, favorito, valoración, jugar y resultado', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/solo/?lang=es');

    const cards = page.locator('#public-list .card');
    await expect(cards).toHaveCount(2);

    const geografia = cards.filter({ hasText: 'Geografia' });
    await expect(geografia).toBeVisible();

    const favBtn = geografia.locator('.favorite-btn');
    await favBtn.click();
    await expect(favBtn).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(cards.filter({ hasText: 'Geografia' }).locator('.favorite-btn')).toHaveAttribute('aria-pressed', 'true');

    const geografiaAfterReload = cards.filter({ hasText: 'Geografia' });
    await geografiaAfterReload.locator('.rating-star[data-value="5"]').click();
    await expect(geografiaAfterReload.locator('.rating-summary')).toContainText('3');

    await geografiaAfterReload.locator('.btn-primary').click();
    await expect(page.locator('#selected-title')).toHaveText('Geografia');
    await page.locator('#start-btn').click();
    await expect(page.locator('#question-text')).toHaveText(question.question);
    await page.locator('#answers button.answer').nth(0).click();
    await expect(page.locator('#result-area')).toBeVisible();
});
