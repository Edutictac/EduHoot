const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Pregunta de correspondencia en el modo Solo, las flashcards y el multijugador local.
// Con Math.random = 0.999 el barajado deja el orden guardado y, como la derecha nunca
// puede quedar igual, se rota una posición: derecha = Roma, Berlín, Lisboa, París;
// solución = [3, 0, 1] (Francia → París, Italia → Roma, Alemania → Berlín).
const PAIRS = [
    { left: 'Francia', right: 'París' },
    { left: 'Italia', right: 'Roma' },
    { left: 'Alemania', right: 'Berlín' },
    { left: '', right: 'Lisboa' }
];
const SOLUTION = [3, 0, 1];
const matchingQuestion = { question: 'Relaciona cada país con su capital', type: 'matching', pairs: PAIRS, answers: ['', '', '', ''], time: 30 };
const quiz = {
    id: 'm1',
    name: 'Capitales',
    tags: [],
    questions: [
        matchingQuestion,
        { ...matchingQuestion, question: 'Otra vez' }
    ]
};
const catalog = [{ id: 'm1', name: 'Capitales', tags: [], questionsCount: 2, playsCount: 0, playersCount: 0, ratingAvg: 0, ratingCount: 0, createdAt: '2026-01-01T00:00:00Z' }];

async function mockBackend(page) {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.__errors = errors;
    await page.addInitScript(() => { Math.random = () => 0.999; });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/public-quizzes') return route.fulfill({ json: catalog });
        if (pathname === '/api/quizzes/m1') return route.fulfill({ json: quiz });
        if (/solo-ranking$/.test(pathname)) return route.fulfill({ json: { top: [] } });
        return route.fulfill({ json: {} });
    });
}

test.afterEach(async ({ page }) => {
    expect(page.__errors).toEqual([]);
});

async function pair(scope, left, right) {
    await scope.locator(`[data-match-left="${left}"]`).click();
    await scope.locator(`[data-match-right="${right}"]`).click();
}

async function startSolo(page) {
    await mockBackend(page);
    await page.clock.install();
    await page.goto('/solo/?id=m1&lang=es');
    await expect(page.locator('#start-form')).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.locator('#start-btn').click();
    await page.clock.runFor(3000);
}

test('Solo: parcial en naranja con la corrección; todo bien en verde', async ({ page }) => {
    await startSolo(page);
    await expect(page.locator('[data-match-left]')).toHaveCount(3);
    await expect(page.locator('[data-match-right] .matching-txt')).toHaveText(['Roma', 'Berlín', 'Lisboa', 'París']);
    await expect(page.locator('#answers button.answer')).toHaveCount(0);

    await pair(page, 0, 3);
    await pair(page, 1, 2);
    await page.locator('.matching-send').click();
    await expect(page.locator('#feedback')).toHaveClass(/feedback--partial/);
    await expect(page.locator('#feedback')).toHaveText('Respuesta parcialmente correcta: has sumado puntos. · 1 de 3 parejas');
    await expect(page.locator('#feedback-title')).toHaveText('Parcialmente correcta');
    await expect(page.locator('#feedback-body')).toContainText('1 Francia → París · 2 Italia → Roma · 3 Alemania → Berlín');
    await expect(page.locator('#score-pill')).toHaveText('Puntos: 333');
    await page.locator('#feedback-close').click();
    await page.clock.runFor(3000);

    await expect(page.locator('.matching-board')).toBeVisible();
    for (let i = 0; i < 3; i++) await pair(page, i, SOLUTION[i]);
    await page.locator('.matching-send').click();
    await expect(page.locator('#feedback')).toHaveText('¡Correcto!');
    await expect(page.locator('#feedback')).toHaveClass(/feedback--success/);
});

test('flashcards: el anverso enseña la columna izquierda y el reverso las parejas', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/solo/?id=m1&mode=cards&lang=es');
    await page.locator('#cards-start-all').click();
    await expect(page.locator('#flashcard-question')).toHaveText('Relaciona cada país con su capital');
    // Amb «Mostrar opciones de respuesta» (per defecte) la columna esquerra va a la taula de correspondència.
    await expect(page.locator('.flashcard__pairs tbody td:nth-child(1)')).toHaveText(['Francia', 'Italia', 'Alemania']);
    await expect(page.locator('#flashcard-answer li')).toHaveText(['Francia → París', 'Italia → Roma', 'Alemania → Berlín']);
});

test('multijugador local: cada jugador empareja en su panel y se revela al final', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/multiplayer/?id=m1&lang=es');
    await expect(page.locator('#setup')).toBeVisible();
    await page.locator('#player-name-0').fill('ANA');
    await page.locator('#player-name-1').fill('BOB');
    await page.locator('#start-btn').click();
    await expect(page.locator('#game')).toBeVisible();

    const ana = page.locator('.player-panel[data-player="0"]');
    const bob = page.locator('.player-panel[data-player="1"]');
    await expect(ana.locator('[data-match-left]')).toHaveCount(3);
    await expect(bob.locator('[data-match-left]')).toHaveCount(3);

    for (let i = 0; i < 3; i++) await pair(ana, i, SOLUTION[i]);
    await ana.locator('.matching-send').click();
    await expect(ana.locator('.matching-board')).toHaveCount(0);
    await expect(ana.locator('[data-feedback]')).toHaveText('');

    await pair(bob, 0, SOLUTION[0]);
    await bob.locator('.matching-send').click();
    await expect(ana.locator('[data-feedback]')).toHaveText('¡Correcto! · 3 de 3 parejas');
    await expect(bob.locator('[data-feedback]')).toHaveText('Parcialmente correcto · 1 de 3 parejas');
    await expect(bob.locator('[data-feedback]')).toHaveClass(/\bpartial\b/);
});

test('Solo: el tiempo de correspondencia suma el % extra elegido (por defecto +50 %)', async ({ page }) => {
    await mockBackend(page);
    await page.clock.install();
    await page.goto('/solo/?id=m1&lang=es');
    await expect(page.locator('#matching-extra')).toHaveValue('50');
    await page.locator('#matching-extra').selectOption('100');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.locator('#start-btn').click();
    await page.clock.runFor(3200);
    // Pregunta de 30 s con +100 % = 60 s (menos lo ya transcurrido).
    const left = parseInt((await page.locator('#timer-pill').innerText()).replace(/\D/g, ''), 10);
    expect(left).toBeGreaterThan(55);
    expect(left).toBeLessThanOrEqual(60);
});

test('Solo: opciones de la partida (barajar preguntas, mostrar respuestas) y racha siempre visible', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/solo/?id=m1&lang=es');
    await expect(page.locator('#opt-shuffle-questions')).not.toBeChecked();
    await expect(page.locator('#opt-show-answers')).toBeChecked();
    await page.locator('#opt-show-answers').uncheck();
    await page.clock.install();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.locator('#start-btn').click();
    await page.clock.runFor(3000);
    await expect(page.locator('#streak-pill')).toHaveText(/0/);
    await page.locator('[data-match-left="0"]').click();
    await page.locator('[data-match-right="0"]').click();
    await page.locator('[data-match-left="1"]').click();
    await page.locator('[data-match-right="1"]').click();
    await page.locator('[data-match-left="2"]').click();
    await page.locator('[data-match-right="2"]').click();
    await page.locator('.matching-send').click();
    await expect(page.locator('#feedback-body')).not.toContainText('→');
    await expect(page.locator('#feedback-body')).toHaveText('');
});

test('Solo con /solo/?id=…: el catálogo no se ve mientras carga el quiz; si falla, vuelve', async ({ page }) => {
    await mockBackend(page);
    let release;
    const gate = new Promise((r) => { release = r; });
    await page.route('**/api/quizzes/m1', async (route) => { await gate; await route.fulfill({ json: quiz }); });
    await page.goto('/solo/?id=m1&lang=es');
    await expect(page.locator('#catalog-panel')).toBeHidden();
    release();
    await expect(page.locator('#start-form')).toBeVisible();
    await expect(page.locator('#catalog-panel')).toBeHidden();

    await page.unroute('**/api/quizzes/m1');
    await page.route('**/api/quizzes/m1', (route) => route.fulfill({ status: 404, json: { error: 'x' } }));
    await page.goto('/solo/?id=m1&lang=es');
    await expect(page.locator('#catalog-panel')).toBeVisible();
});
