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

test('botones de la tarjeta: «No la sé» en rojos, anterior/siguiente en amarillos, mostrar en verdes y ocultar en rosas', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const bg = sel => page.locator(sel).evaluate(el => getComputedStyle(el).backgroundImage);
    // Primera color de cada degradado.
    await expect(page.locator('#cards-flip')).toHaveClass(/btn-cards-show/);
    expect(await bg('#cards-flip')).toContain('rgb(21, 128, 61)');
    expect(await bg('#cards-next')).toContain('rgb(255, 200, 0)');
    expect(await bg('#cards-prev')).toContain('rgb(255, 200, 0)');
    await page.locator('#cards-flip').click();
    await expect(page.locator('#cards-flip')).toHaveClass(/btn-cards-hide/);
    expect(await bg('#cards-flip')).toContain('rgb(190, 24, 93)');
    expect(await bg('#cards-dont-know')).toContain('rgb(220, 38, 38)');
});

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

test('girar la targeta muestra la cara de la resposta i oculta la de la pregunta', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();

    const front = page.locator('.flashcard__face--front');
    const back = page.locator('.flashcard__face--back');
    await expect(front).toHaveAttribute('aria-hidden', 'false');
    await expect(back).toHaveAttribute('aria-hidden', 'true');

    await page.locator('#cards-flip').click();
    await expect(page.locator('.flashcard')).toHaveClass(/is-back/);
    await expect(front).toHaveAttribute('aria-hidden', 'true');
    await expect(front).toHaveJSProperty('inert', true);
    await expect(back).toHaveAttribute('aria-hidden', 'false');
    await expect(back).toHaveJSProperty('inert', false);

    // En canviar de targeta, la nova és al davant i no fa un giro en sentit contrari.
    await page.locator('#cards-next').click();
    await expect(page.locator('.flashcard')).not.toHaveClass(/is-back/);
});

test('clicar la targeta la gira i tornar a clicar-la la retorna', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();

    await page.locator('#flashcard-question').click();
    await expect(page.locator('.flashcard')).toHaveClass(/is-back/);
    await expect(page.locator('#flashcard-answer li')).toHaveText(['París']);

    await page.locator('.flashcard__answers').click();
    await expect(page.locator('.flashcard')).not.toHaveClass(/is-back/);
    await expect(page.locator('#cards-progress')).toHaveText('Pregunta 1 de 3');
});

test('el giro es animat també amb reducir movimiento activat al sistema', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mockBackend(page);
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    await page.locator('#cards-flip').click();
    await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(0);
    await expect(page.locator('.flashcard')).toHaveClass(/is-back/);
});

test('si la pregunta té imatge, clicar-la gira la targeta', async ({ page }) => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'Quina és?', type: 'quiz', image: png, answers: ['A', 'B'], correctAnswers: [2], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    await expect(page.locator('.flashcard__media img')).toBeVisible();
    await page.locator('.flashcard__media img').click();
    await expect(page.locator('.flashcard')).toHaveClass(/is-back/);
    await expect(page.locator('#flashcard-answer li')).toHaveText(['B']);
});

test('la casella «Tarjetas con animación» desactiva el giro animat i es guarda en localStorage', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await expect(page.locator('#cards-animate')).toBeChecked();
    await page.locator('#cards-animate').uncheck();
    await page.locator('#cards-start-all').click();
    await page.locator('#cards-flip').click();
    await expect(page.locator('.flashcard')).toHaveClass(/is-back/);
    expect(await page.evaluate(() => document.getElementById('flashcard').getAnimations().length)).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('eduh_cards_anim'))).toBe('0');
});

test('/solo/?id=…&mode=cards abre directamente las tarjetas del quiz', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/solo/?id=q1&mode=cards&lang=es');
    await expect(page.locator('#cards-start-all')).toBeVisible();
});

test('en preguntas de respuesta múltiple el anverso muestra las opciones; marcar-les no gira la targeta', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'Quines són capitals?', type: 'multiple', answers: ['París', 'Madrid', 'Roma', 'Lisboa'], correctAnswers: [1, 3], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const options = page.locator('.flashcard__option');
    await expect(options).toHaveCount(4);
    await options.nth(0).click();
    await expect(options.nth(0)).toHaveClass(/is-picked/);
    await options.nth(2).click();
    await expect(options.nth(0)).toHaveClass(/is-picked/);
    await expect(options.nth(2)).toHaveClass(/is-picked/);
    await expect(page.locator('.flashcard')).not.toHaveClass(/is-back/);
});

test('en preguntas de respuesta única no se muestran las opciones en el anverso', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    await expect(page.locator('#flashcard-question')).toBeVisible();
    await expect(page.locator('.flashcard__option')).toHaveCount(0);
});
