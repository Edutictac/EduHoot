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

test('botones de la tarjeta: «No la sé» en rojos, anterior/siguiente en amarillos, mostrar en blanco con texto rosa y ocultar al revés', async ({ page }) => {
    await mockBackend(page);
    await page.addInitScript(() => localStorage.setItem('eduh_cards_validate', '0')); // marcat manual (sense validació)
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const bg = sel => page.locator(sel).evaluate(el => getComputedStyle(el).backgroundImage);
    // Primera color de cada degradado.
    await expect(page.locator('#cards-flip')).toHaveClass(/btn-cards-show/);
    await expect(page.locator('#cards-flip')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('#cards-flip')).toHaveCSS('color', 'rgb(190, 24, 93)');
    expect(await bg('#cards-next')).toContain('rgb(255, 200, 0)');
    expect(await bg('#cards-prev')).toContain('rgb(255, 200, 0)');
    await page.locator('#cards-flip').click();
    await expect(page.locator('#cards-flip')).toHaveClass(/btn-cards-hide/);
    expect(await bg('#cards-flip')).toContain('rgb(190, 24, 93)');
    await expect(page.locator('#cards-flip')).toHaveCSS('color', 'rgb(255, 255, 255)');
    expect(await bg('#cards-dont-know')).toContain('rgb(220, 38, 38)');
});

test('el repàs mostra les targetes sense les enquestes i deixa marcar sabudes i no sabudes', async ({ page }) => {
    await mockBackend(page);
    await page.addInitScript(() => localStorage.setItem('eduh_cards_validate', '0')); // marcat manual (sense validació)
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
    await page.addInitScript(() => localStorage.setItem('eduh_cards_validate', '0')); // marcat manual (sense validació)
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
    await page.addInitScript(() => localStorage.setItem('eduh_cards_validate', '0')); // marcat manual (sense validació)
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

test('en pantalla estreta, la imagen de la pregunta va encima de las opciones de respuesta', async ({ page }) => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    await page.setViewportSize({ width: 600, height: 900 });
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'Quin animal és?', type: 'quiz', image: png, answers: ['Gos', 'Peix'], correctAnswers: [1], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const img = await page.locator('.flashcard__media img').boundingBox();
    const firstOption = await page.locator('.flashcard__option').first().boundingBox();
    expect(img.y + img.height).toBeLessThanOrEqual(firstOption.y);
});

// Pantalla ancha: con imagen, la imagen a la izquierda y las opciones a la dreta; sense imatge, les opcions centrades.
const matchingQuiz = { question: 'Relaciona capital y país', type: 'matching', time: 30,
    pairs: [{ left: 'França', right: 'París' }, { left: 'Espanya', right: 'Madrid' }, { left: 'Itàlia', right: 'Roma' }] };

test('correspondencia: con la casilla activada, el anverso muestra las dos columnas en una tabla sin bordes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [matchingQuiz] } }));
    await page.addInitScript(() => localStorage.setItem('eduh_cards_validate', '0'));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const rows = page.locator('.flashcard__pairs tbody tr');
    await expect(rows).toHaveCount(3);
    const lefts = await rows.locator('td:nth-child(1)').allTextContents();
    const rights = await rows.locator('td:nth-child(2)').allTextContents();
    expect(lefts).toEqual(['França', 'Espanya', 'Itàlia']);
    // La derecha va barajada: nunca en el mismo orden que la izquierda (no revela las parejas).
    expect(rights).not.toEqual(['París', 'Madrid', 'Roma']);
    expect(rights.slice().sort()).toEqual(['Madrid', 'París', 'Roma']);
    expect(await page.locator('.flashcard__pairs').evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
    expect(await page.locator('.flashcard__pairs td').first().evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
});

test('correspondencia: con la casilla desactivada, solo sale la columna izquierda', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [matchingQuiz] } }));
    await page.addInitScript(() => localStorage.setItem('eduh_cards_validate', '0'));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-options').uncheck();
    await page.locator('#cards-start-all').click();
    await expect(page.locator('.flashcard__pairs')).toHaveCount(0);
    await expect(page.locator('.flashcard__match-left li')).toHaveText(['França', 'Espanya', 'Itàlia']);
});

test('correspondencia en pantalla ancha con imagen: la tabla va a la derecha de la imagen', async ({ page }) => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [{ ...matchingQuiz, image: png }] } }));
    await page.addInitScript(() => localStorage.setItem('eduh_cards_validate', '0'));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const img = await page.locator('.flashcard__media img').boundingBox();
    const table = await page.locator('.flashcard__pairs').boundingBox();
    expect(img.x + img.width).toBeLessThanOrEqual(table.x);
});

test('en pantalla ancha, con imagen las opciones van a la derecha; sin imagen, centradas', async ({ page }) => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'Quin animal és?', type: 'quiz', image: png, answers: ['Gos', 'Peix'], correctAnswers: [1], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const img = await page.locator('.flashcard__media img').boundingBox();
    const options = await page.locator('.flashcard__options').boundingBox();
    expect(img.x + img.width).toBeLessThanOrEqual(options.x);

    // Sin imagen: el bloque de opciones queda centrado en la cara de la pregunta.
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'Quin animal és?', type: 'quiz', answers: ['Gos', 'Peix'], correctAnswers: [1], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const face = await page.locator('.flashcard__face--front').boundingBox();
    const centred = await page.locator('.flashcard__options').boundingBox();
    expect(Math.abs((centred.x + centred.width / 2) - (face.x + face.width / 2))).toBeLessThan(2);
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
    // Cada opción lleva la forma y el color de su número (como en el juego) y van en dos columnas.
    await expect(options.nth(0)).toHaveClass(/answer-shape--1/);
    await expect(options.nth(3)).toHaveClass(/answer-shape--4/);
    const first = await options.nth(0).boundingBox();
    const second = await options.nth(1).boundingBox();
    expect(Math.abs(first.y - second.y)).toBeLessThan(1);
    expect(second.x).toBeGreaterThan(first.x + first.width - 1);
    // Palabras cortas no se parten a mitad (p. ej. «Madri-d»): cada texto ocupa una sola línea.
    const lines = await page.evaluate(() => [...document.querySelectorAll('.flashcard__option')].map(b => {
        const r = document.createRange();
        r.selectNodeContents(b.lastChild);
        return r.getClientRects().length;
    }));
    expect(lines).toEqual([1, 1, 1, 1]);
    await options.nth(0).click();
    await expect(options.nth(0)).toHaveClass(/is-picked/);
    await options.nth(2).click();
    await expect(options.nth(0)).toHaveClass(/is-picked/);
    await expect(options.nth(2)).toHaveClass(/is-picked/);
    await expect(page.locator('.flashcard')).not.toHaveClass(/is-back/);
});

test('en respuesta múltiple las opciones van en dos columnas, también en pantalla ancha', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'Quines són capitals?', type: 'multiple', answers: ['París', 'Madrid', 'Roma', 'Lisboa'], correctAnswers: [1, 3], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const boxes = [];
    for (let i = 0; i < 4; i++) boxes.push(await page.locator('.flashcard__option').nth(i).boundingBox());
    expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
    expect(Math.abs(boxes[2].y - boxes[3].y)).toBeLessThan(1);
    expect(boxes[2].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 1);
});

test('en preguntas de respuesta única el anverso muestra las opciones; elegir una sustituye la anterior', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: '¿Cuál de las siguientes opciones es un animal de compañía?', type: 'quiz', answers: ['Vaca', 'Perro', 'Oveja', 'Cabra'], correctAnswers: [2], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const options = page.locator('.flashcard__option');
    await expect(options).toHaveCount(4);
    await options.nth(0).click();
    await options.nth(1).click();
    await expect(options.nth(0)).not.toHaveClass(/is-picked/);
    await expect(options.nth(1)).toHaveClass(/is-picked/);
    await expect(page.locator('.flashcard')).not.toHaveClass(/is-back/);
});

test('la casella «Mostrar opciones de respuesta» oculta las opciones y se guarda en localStorage', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: '¿Cuál de las siguientes opciones es un animal de compañía?', type: 'quiz', answers: ['Vaca', 'Perro', 'Oveja', 'Cabra'], correctAnswers: [2], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await expect(page.locator('#cards-options')).toBeChecked();
    await page.locator('#cards-options').uncheck();
    expect(await page.evaluate(() => localStorage.getItem('eduh_cards_options'))).toBe('0');
    await page.locator('#cards-start-all').click();
    await expect(page.locator('#flashcard-question')).toBeVisible();
    await expect(page.locator('.flashcard__option')).toHaveCount(0);
});

test('vertadero/fals con imagen: las dos opciones salen una debajo de otra', async ({ page }) => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'La Tierra es plana.', type: 'true-false', image: png, answers: ['Vertader', 'Fals'], correctAnswers: [2], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const [a, b] = [await page.locator('.flashcard__option').nth(0).boundingBox(), await page.locator('.flashcard__option').nth(1).boundingBox()];
    // Els dos botons tenen la mateixa amplària (la del text més llarg), centrats; una va sota l'altra.
    expect(Math.abs(a.width - b.width)).toBeLessThan(1);
    expect(Math.abs((a.x + a.width / 2) - (b.x + b.width / 2))).toBeLessThan(1);
    expect(b.y).toBeGreaterThan(a.y + a.height - 1);
});

test('vertadero/fals sin imagen: las dos opciones siguen en fila', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'La Tierra es plana.', type: 'true-false', answers: ['Vertader', 'Fals'], correctAnswers: [2], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const [a, b] = [await page.locator('.flashcard__option').nth(0).boundingBox(), await page.locator('.flashcard__option').nth(1).boundingBox()];
    expect(Math.abs(a.y - b.y)).toBeLessThan(1);
    // Botones del tamaño del texto (no de todo el ancho) y con las etiquetas traducidas (quiz en «Vertader/Fals»).
    expect(await page.locator('.flashcard__option').allTextContents()).toEqual(['Verdadero', 'Falso']);
    expect(a.width).toBeLessThan(200);
    expect(Math.abs(a.width - b.width)).toBeLessThan(1);
});

test('en respuesta múltiple con textos muy largos, sigue en 2×2', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'Quines són correctes?', type: 'multiple', answers: ['Una resposta bastant més llarga del que és normal', 'Una altra resposta amb bastant text també', 'Tercera opció molt llarga per provar', 'Quarta opció amb un text extens'], correctAnswers: [1, 3], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const first = await page.locator('.flashcard__option').nth(0).boundingBox();
    const second = await page.locator('.flashcard__option').nth(1).boundingBox();
    const third = await page.locator('.flashcard__option').nth(2).boundingBox();
    expect(second.x).toBeGreaterThan(first.x + first.width - 1);
    expect(third.y).toBeGreaterThan(first.y + first.height - 1);
});

test('respuesta múltiple: una palabra que no cabe en el botón pasa a una columna y la targeta crece', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 800 });
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'Quines són correctes?', type: 'multiple', answers: ['Constantinopolitanismo', 'Madrid', 'Roma', 'Lisboa'], correctAnswers: [1, 3], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    await expect(page.locator('.flashcard.is-tall')).toHaveCount(1);
    const boxes = [];
    for (let i = 0; i < 4; i++) boxes.push(await page.locator('.flashcard__option').nth(i).boundingBox());
    // Una columna: cuatro filas, cada una a la izquierda de la siguiente.
    expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 1);
    expect(Math.abs(boxes[0].x - boxes[1].x)).toBeLessThan(1);
    // La targeta contiene las opciones (no hay scroll interno) y la palabra larga no se parte.
    const card = await page.locator('#flashcard').boundingBox();
    expect(boxes[3].y + boxes[3].height).toBeLessThanOrEqual(card.y + card.height + 1);
    const lines = await page.locator('.flashcard__option').first().evaluate(b => { const r = document.createRange(); r.selectNodeContents(b.lastChild); return r.getClientRects().length; });
    expect(lines).toBe(1);
});

test('quiz de una correcta con imagen y cuatro opciones: 2×2 a la derecha de la imagen, nunca en fila', async ({ page }) => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    await page.setViewportSize({ width: 1920, height: 921 });
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'Con qué programa podemos hacer dibujos parecidos?', type: 'quiz', image: png, answers: ['Inkscape', 'Gwenview', 'GIMP', 'Okular'], correctAnswers: [1], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const img = await page.locator('.flashcard__media img').boundingBox();
    const boxes = [];
    for (let i = 0; i < 4; i++) boxes.push(await page.locator('.flashcard__option').nth(i).boundingBox());
    expect(img.x + img.width).toBeLessThanOrEqual(Math.min(...boxes.map(b => b.x)));
    expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1);
    expect(boxes[2].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 1);
});

test('respuesta múltiple con imagen: 2×2 a la derecha de la imagen en pantalla ancha', async ({ page }) => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'Quines són capitals?', type: 'multiple', image: png, answers: ['París', 'Madrid', 'Roma', 'Lisboa'], correctAnswers: [1], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const img = await page.locator('.flashcard__media img').boundingBox();
    const boxes = [];
    for (let i = 0; i < 4; i++) boxes.push(await page.locator('.flashcard__option').nth(i).boundingBox());
    expect(img.x + img.width).toBeLessThanOrEqual(Math.min(...boxes.map(b => b.x)));
    expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1);
    expect(boxes[2].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 1);
});

test('respuesta múltiple con imagen en pantalla estrecha: 2×2 debajo de la imagen', async ({ page }) => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
    await page.setViewportSize({ width: 600, height: 900 });
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'Quines són capitals?', type: 'multiple', image: png, answers: ['París', 'Madrid', 'Roma', 'Lisboa'], correctAnswers: [1], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const img = await page.locator('.flashcard__media img').boundingBox();
    const boxes = [];
    for (let i = 0; i < 4; i++) boxes.push(await page.locator('.flashcard__option').nth(i).boundingBox());
    expect(img.y + img.height).toBeLessThanOrEqual(Math.min(...boxes.map(b => b.y)));
    expect(Math.abs(boxes[0].y - boxes[1].y)).toBeLessThan(1);
    expect(boxes[2].y).toBeGreaterThan(boxes[0].y + boxes[0].height - 1);
});

test('en respuesta múltiple en ventana estrecha (320 px), sigue en dos columnas', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'Quines són capitals?', type: 'multiple', answers: ['París', 'Madrid', 'Roma', 'Lisboa'], correctAnswers: [1, 3], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const first = await page.locator('.flashcard__option').nth(0).boundingBox();
    const second = await page.locator('.flashcard__option').nth(1).boundingBox();
    const third = await page.locator('.flashcard__option').nth(2).boundingBox();
    expect(Math.abs(first.y - second.y)).toBeLessThan(1);
    expect(third.y).toBeGreaterThan(first.y + first.height - 1);
});

test('en preguntas de vertadero/fals el anverso muestra solo les dues opcions', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: { ...quiz, questions: [
        { question: 'La Tierra es plana.', type: 'true-false', answers: ['Vertader', 'Fals'], correctAnswers: [2], time: 20 }
    ] } }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    await expect(page.locator('.flashcard__option')).toHaveCount(2);
});

// Validació de respostes («Comprobar respuestas», activada per defecte).
const validateQuiz = (questions) => ({ ...quiz, questions });
const capitalQuestion = { question: 'Quina és la capital d\'Espanya?', type: 'quiz', answers: ['Barcelona', 'Madrid', 'Sevilla', 'València'], correctAnswers: [2], time: 20 };

test('comprobar respuestas: por defecto activada; una opción incorrecta se marca sola y sale el resumen', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: validateQuiz([capitalQuestion]) }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await expect(page.locator('#cards-validate')).toBeChecked();
    await page.locator('#cards-start-all').click();
    await page.locator('.flashcard__option', { hasText: 'Barcelona' }).click();
    await page.locator('#cards-check').click();
    await expect(page.locator('#cards-result')).toHaveText('✕ Incorrecta');
    await expect(page.locator('.flashcard')).toHaveClass(/is-back/);
    await expect(page.locator('.cards-mark')).toHaveCount(0);
    await page.locator('#cards-next').click();
    await expect(page.locator('#cards-summary')).toContainText('Correctas: 0 · Incorrectas: 1 · Sin responder: 0');
    await expect(page.locator('#cards-summary li')).toHaveText(['Quina és la capital d\'Espanya?']);
    // El progreso se guarda: la tarjeta queda como no sabida.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('eduhoot-flashcards-progress'))['q1'].status)).toEqual({ '0': 'unknown' });
});

test('comprobar respuestas: la opción correcta cuenta como sabida; pasar sin comprobar cuenta como sin responder', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: validateQuiz([
        capitalQuestion,
        { question: 'Quina és la capital de França?', type: 'quiz', answers: ['París', 'Lió', 'Niça', 'Lyon'], correctAnswers: [1], time: 20 }
    ]) }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    await page.locator('.flashcard__option', { hasText: 'Madrid' }).click();
    await page.locator('#cards-check').click();
    await expect(page.locator('#cards-result')).toHaveText('✓ Correcta');
    await page.locator('#cards-next').click();
    await page.locator('#cards-next').click();
    await expect(page.locator('#cards-summary')).toContainText('Correctas: 1 · Incorrectas: 0 · Sin responder: 1');
    await expect(page.locator('#cards-summary .cards-summary__title')).toHaveCount(0);
});

test('comprobar respuestas: la respuesta escrita se valida con Enter (curta)', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: validateQuiz([
        { question: 'Capital d\'Espanya?', type: 'short-answer', acceptedAnswers: ['Madrid'], time: 20 }
    ]) }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    await page.locator('#cards-typed').fill('madrid');
    await page.locator('#cards-typed').press('Enter');
    await expect(page.locator('#cards-result')).toHaveText('✓ Correcta');
    await page.locator('#cards-next').click();
    await expect(page.locator('#cards-summary')).toContainText('Correctas: 1 · Incorrectas: 0 · Sin responder: 0');
});

test('comprobar respuestas desactivada: no hay comprobación y aparecen los botones de marcar a mano', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: validateQuiz([capitalQuestion]) }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-validate').uncheck();
    expect(await page.evaluate(() => localStorage.getItem('eduh_cards_validate'))).toBe('0');
    await page.locator('#cards-start-all').click();
    await expect(page.locator('#cards-check')).toHaveCount(0);
    await page.locator('#cards-flip').click();
    await expect(page.locator('#cards-know')).toBeVisible();
});

// Correspondencia validada: cada elemento de la izquierda se empareja en una desplegable y se comprueba al final.
const matchingValidated = { question: 'Relaciona capital i país', type: 'matching', time: 30,
    pairs: [{ left: 'França', right: 'París' }, { left: 'Espanya', right: 'Madrid' }] };

test('comprobar respuestas en correspondencia: parejas correctas en desplegables se marcan como correctas', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: validateQuiz([matchingValidated]) }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const selects = page.locator('.flashcard__select');
    await expect(selects).toHaveCount(2);
    await selects.nth(0).selectOption({ label: 'París' });
    await selects.nth(1).selectOption({ label: 'Madrid' });
    await page.locator('#cards-check').click();
    await expect(page.locator('#cards-result')).toHaveText('✓ Correcta');
    await page.locator('#cards-next').click();
    await expect(page.locator('#cards-summary')).toContainText('Correctas: 1 · Incorrectas: 0 · Sin responder: 0');
});

test('comprobar respuestas en correspondencia: una pareja mal emparejada cuenta como incorrecta', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: validateQuiz([matchingValidated]) }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const selects = page.locator('.flashcard__select');
    await selects.nth(0).selectOption({ label: 'Madrid' });
    await selects.nth(1).selectOption({ label: 'París' });
    await page.locator('#cards-check').click();
    await expect(page.locator('#cards-result')).toHaveText('✕ Incorrecta');
    await page.locator('#cards-next').click();
    await expect(page.locator('#cards-summary')).toContainText('Correctas: 0 · Incorrectas: 1 · Sin responder: 0');
    await expect(page.locator('#cards-summary li')).toHaveText(['Relaciona capital i país']);
});

test('accesibilidad: la respuesta escrita tiene nombre accesible y el resultado va en una región en vivo', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: validateQuiz([
        { question: 'Capital d\'Espanya?', type: 'short-answer', acceptedAnswers: ['Madrid'], time: 20 }
    ]) }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    const field = page.getByRole('textbox', { name: 'Escribe tu respuesta' });
    await expect(field).toBeVisible();
    // La región del resultado existe antes de comprobar; solo cambia su texto.
    await expect(page.locator('#cards-result')).toHaveAttribute('role', 'status');
    await field.fill('Madrid');
    await field.press('Enter');
    await expect(page.locator('#cards-result')).toHaveText('✓ Correcta');
});

test('el resumen final va en una fila propia debajo de la información, a todo el ancho', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q1', route => route.fulfill({ json: validateQuiz([capitalQuestion]) }));
    await page.goto('/solo/?lang=es');
    await page.locator('.card-actions .btn', { hasText: 'Repasar' }).click();
    await page.locator('#cards-start-all').click();
    await page.locator('.flashcard__option', { hasText: 'Barcelona' }).click();
    await page.locator('#cards-check').click();
    await page.locator('#cards-next').click();
    const summary = await page.locator('#cards-summary').boundingBox();
    const info = await page.locator('.cards-start__info').boundingBox();
    const options = await page.locator('.cards-start__options').boundingBox();
    // Debajo de la información y de las opciones, y ocupando el ancho de las dos columnas.
    expect(summary.y).toBeGreaterThanOrEqual(Math.max(info.y + info.height, options.y + options.height) - 1);
    expect(summary.width).toBeGreaterThan(info.width);
});
