const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Flashcards d'ordenar. Amb Math.random = 0.999 la barreja de tres elements és B, C, A
// (orderShown = [1, 2, 0]); l'ordre correcte és A, B, C = posicions [2, 0, 1].
const ITEMS = ['Encender el equipo', 'Cargar el sistema', 'Iniciar sesión'];
const orderQuiz = {
    id: 'q1',
    name: 'Arranque',
    tags: [],
    questions: [{ question: 'Pasos del arranque', type: 'order', items: ITEMS, orderGrading: 0, time: 20 }]
};

async function openDeck(page, validate) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/public-quizzes') {
            return route.fulfill({ json: [{ id: 'q1', name: 'Arranque', tags: [], questionsCount: 1, playsCount: 0, playersCount: 0, ratingAvg: 0, ratingCount: 0, createdAt: '2026-01-01T00:00:00Z' }] });
        }
        if (pathname === '/api/quizzes/q1') return route.fulfill({ json: orderQuiz });
        return route.fulfill({ json: {} });
    });
    await page.addInitScript((v) => {
        Math.random = () => 0.999;
        localStorage.setItem('eduh_cards_validate', v);
    }, validate ? '1' : '0');
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
}

test('ordenar sin validar: el anverso muestra los elementos barajados y el reverso el orden correcto', async ({ page }) => {
    await openDeck(page, false);
    await expect(page.locator('.flashcard__order-list li')).toHaveText(['Cargar el sistema', 'Iniciar sesión', 'Encender el equipo']);
    await expect(page.locator('.flashcard__order .order-board')).toHaveCount(0);
    await expect(page.locator('#cards-check')).toHaveCount(0);
    await expect(page.locator('.flashcard__face--back .flashcard__answers li')).toHaveText(['1 Encender el equipo', '2 Cargar el sistema', '3 Iniciar sesión']);
});

test('ordenar con validar: el tablero sustituye al botón «Comprobar» y no gira la tarjeta al tocarlo', async ({ page }) => {
    await openDeck(page, true);
    await expect(page.locator('.flashcard__order .order-board')).toBeVisible();
    await expect(page.locator('#cards-check')).toHaveCount(0);
    await page.locator('.flashcard__order .order-text').first().click();
    await expect(page.locator('#flashcard')).not.toHaveClass(/is-back/);
});

test('ordenar con validar: enviar el orden correcto gira la tarjeta', async ({ page }) => {
    await openDeck(page, true);
    // «Encender el equipo» està en la posició 3: se sube dos veces con ▲.
    await page.locator('.flashcard__order .order-item').nth(2).locator('.order-move').first().click();
    await page.locator('.flashcard__order .order-item').nth(1).locator('.order-move').first().click();
    await page.locator('.flashcard__order .order-submit').click();
    await expect(page.locator('#flashcard')).toHaveClass(/is-back/);
});
