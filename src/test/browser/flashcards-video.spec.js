const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Flashcards amb vídeo (feature 24): primer es mira el vídeo; després, la targeta sense vídeo al davant.
const quiz = {
    id: 'v2',
    name: 'Vídeo a les targetes',
    tags: [],
    questions: [
        { question: 'Què has vist?', type: 'quiz', answers: ['Roma', 'París', 'Berlín', 'Londres'], correctAnswers: [1], time: 20, video: 'https://example.com/clip.mp4' },
        { question: 'Capital de França?', type: 'quiz', answers: ['Roma', 'París', 'Berlín', 'Londres'], correctAnswers: [1], time: 20 }
    ]
};

async function mockBackend(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/public-quizzes') return route.fulfill({ json: [{ id: 'v2', name: 'Vídeo a les targetes', tags: [], questionsCount: 2, playsCount: 0, playersCount: 0, ratingAvg: 0, ratingCount: 0, createdAt: '2026-03-01T00:00:00Z' }] });
        if (pathname === '/api/quizzes/v2') return route.fulfill({ json: quiz });
        return route.fulfill({ json: {} });
    });
}

test('flashcards amb vídeo: primer es mira el vídeo; en acabar, la targeta sense vídeo al davant', async ({ page }) => {
    await mockBackend(page);
    await page.addInitScript(() => localStorage.setItem('eduh_cards_validate', '0'));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();

    // La targeta es queda: el vídeo és dins seu, i els botons de navegació es veuen des del principi.
    await expect(page.locator('#flashcard #cards-learning')).toBeVisible();
    await expect(page.locator('#cards-learn-video')).toHaveAttribute('src', 'https://example.com/clip.mp4');
    await expect(page.locator('#cards-next')).toBeVisible();
    await expect(page.locator('.flashcard__options')).toBeHidden();

    await page.locator('#cards-learn-finish').click();
    await expect(page.locator('#cards-learning')).toHaveCount(0);
    await expect(page.locator('#flashcard-question')).toHaveText('Què has vist?');
    await expect(page.locator('#flashcard video')).toHaveCount(0);
});

test('flashcards amb vídeo: la targeta següent sense vídeo no té fase', async ({ page }) => {
    await mockBackend(page);
    await page.addInitScript(() => localStorage.setItem('eduh_cards_validate', '0'));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    await page.locator('#cards-learn-finish').click();
    await page.locator('#cards-next').click();
    await expect(page.locator('#flashcard-question')).toHaveText('Capital de França?');
    await expect(page.locator('#cards-learning')).toHaveCount(0);
});

// Durant el vídeo, un clic a la targeta la gira (i acaba la fase).
test('flashcards amb vídeo: un clic a la targeta durant el vídeo la gira', async ({ page }) => {
    await mockBackend(page);
    await page.addInitScript(() => localStorage.setItem('eduh_cards_validate', '0'));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    await expect(page.locator('#cards-learning')).toBeVisible();
    await page.locator('#flashcard-question').click();
    await expect(page.locator('#cards-learning')).toHaveCount(0);
    await expect(page.locator('#flashcard')).toHaveClass(/is-back/, { timeout: 3000 });
});
