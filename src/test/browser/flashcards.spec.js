const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Mode flashcards (proposta 20) i repàs de les no sabudes (proposta 25) a /solo/.
// Només es comprova la pantalla i el progrés guardat; no toca la puntuació.

const quiz = {
    id: 'q1',
    name: 'Geografia',
    tags: [],
    questions: [
        { question: 'Capital de França?', type: 'quiz', answers: ['París', 'Berlín', 'Roma', 'Londres'], correctAnswers: [1], time: 20 },
        { question: 'Enquesta', type: 'poll', answers: ['A', 'B', 'C', 'D'], time: 20 },
        { question: "Capital d'Espanya", type: 'short-answer', acceptedAnswers: ['Madrid'], time: 20 },
        { question: 'Quant és pi?', type: 'numeric', numericAnswer: 3.14, tolerance: 0.01, time: 20 }
    ]
};

async function mockBackend(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/public-quizzes') {
            return route.fulfill({ json: [{ id: 'q1', name: 'Geografia', tags: [], questionsCount: 4, playsCount: 0, playersCount: 0, ratingAvg: 0, ratingCount: 0, createdAt: '2026-01-01T00:00:00Z' }] });
        }
        if (pathname === '/api/quizzes/q1') return route.fulfill({ json: quiz });
        return route.fulfill({ json: {} });
    });
}

test('el repàs mostra les targetes sense les enquestes i deixa marcar sabudes i no sabudes', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();

    await expect(page.locator('#cards-area')).toBeVisible();
    await expect(page.locator('#cards-start-all')).toHaveText('Repasar todas (3)');
    await expect(page.locator('#cards-start-unknown')).toBeDisabled();

    await page.locator('#cards-start-all').click();
    await expect(page.locator('#cards-progress')).toHaveText('Pregunta 1 de 3');
    await expect(page.locator('#flashcard-question')).toHaveText('Capital de França?');

    // Girar: es mostra la resposta correcta, no les incorrectes.
    await page.locator('#cards-flip').click();
    await expect(page.locator('#flashcard-answer li')).toHaveText(['París']);
    await page.locator('#cards-dont-know').click();

    // Després de marcar, passa a la següent targeta (la resposta curta).
    await expect(page.locator('#cards-progress')).toHaveText('Pregunta 2 de 3');
    await expect(page.locator('#flashcard-question')).toHaveText("Capital d'Espanya");
    await page.locator('#cards-flip').click();
    await expect(page.locator('#flashcard-answer li')).toHaveText(['Madrid']);
    await page.locator('#cards-know').click();

    await page.locator('#cards-flip').click();
    await expect(page.locator('#flashcard-answer li')).toHaveText(['3.14 (margen ±0.01)']);
    await page.locator('#cards-know').click();

    // Final: resum amb el progrés i la pràctica de les no sabudes disponible.
    await expect(page.locator('.cards-start h3')).toHaveText('Repaso terminado');
    await expect(page.locator('#cards-start-unknown')).toHaveText('Repetir las no sabidas (1)');
    await expect(page.locator('#cards-start-unknown')).toBeEnabled();
});

test('el progrés es guarda i el repàs de les no sabudes només porta aquestes targetes', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();

    // Marca només la primera com a no sabuda i surt.
    await page.locator('#cards-flip').click();
    await page.locator('#cards-dont-know').click();
    await page.locator('#cards-exit').click();
    await expect(page.locator('#cards-area')).toBeHidden();

    // Torna a entrar: el progrés continua desat al dispositiu.
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await expect(page.locator('#cards-start-unknown')).toHaveText('Repetir las no sabidas (1)');
    await page.locator('#cards-start-unknown').click();
    await expect(page.locator('#cards-progress')).toHaveText('Pregunta 1 de 1');
    await expect(page.locator('#flashcard-question')).toHaveText('Capital de França?');
});

test('reiniciar el progrés esborra les marques', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    await page.locator('#cards-flip').click();
    await page.locator('#cards-know').click();
    await page.locator('#cards-exit').click();

    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await expect(page.locator('#cards-reset')).toBeEnabled();
    await page.locator('#cards-reset').click();
    await expect(page.locator('#cards-reset')).toBeDisabled();
    await expect(page.locator('#cards-start-unknown')).toBeDisabled();
});
