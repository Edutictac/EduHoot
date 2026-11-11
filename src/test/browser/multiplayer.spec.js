const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Red de seguridad del comportamiento actual de /multiplayer/ (pantalla
// compartida, 2-4 jugadores) antes de pasarla a Vue. No hay Socket.IO: todo
// es REST + estado en el cliente, así que basta con mockear /api/**.

const geografiaQuestions = [
    { question: 'Capital de França?', type: 'quiz', answers: ['París', 'Berlín', 'Roma', 'Londres'], correct: 1, correctAnswers: [1], time: 20 },
    { question: "Capital d'Itàlia?", type: 'quiz', answers: ['Madrid', 'Roma', 'Lisboa', 'Atenes'], correct: 2, correctAnswers: [2], time: 20 },
    { question: "Escriu la capital d'Espanya", type: 'short-answer', acceptedAnswers: ['Madrid'] }
];

const mixtQuestions = [
    { question: 'Quins són primers?', type: 'multiple', answers: ['2', '4', '5', '9'], correctAnswers: [1, 3], time: 20 },
    { question: 'El sol és una estrella', type: 'true-false', answers: ['Vertader', 'Fals', '', ''], correctAnswers: [1], time: 20 },
    { question: 'Quin animal és?', type: 'quiz', answers: ['Gat', 'Gos', 'Peix', 'Ocell'], correctAnswers: [1], image: '/icons/logo.svg', time: 20 }
];

const catalog = [
    { id: 'q1', name: 'Geografia', tags: ['socials', 'mapes'], questionsCount: 2, playsCount: 10, playersCount: 30, ratingAvg: 4, ratingCount: 2, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'q2', name: 'Mixt', tags: ['proves'], questionsCount: 3, playsCount: 5, playersCount: 12, ratingAvg: 0, ratingCount: 0, coverImage: '/icons/logo.svg', createdAt: '2026-03-01T00:00:00Z' },
    { id: 'q3', name: 'Àlgebra', tags: [], questionsCount: 8, playsCount: 1, playersCount: 2, ratingAvg: 0, ratingCount: 0, createdAt: '2026-02-01T00:00:00Z' }
];

const quizzes = {
    q1: { id: 'q1', name: 'Geografia', questions: geografiaQuestions },
    q2: { id: 'q2', name: 'Mixt', questions: mixtQuestions },
    q3: { id: 'q3', name: 'Àlgebra', questions: [] }
};

async function mockBackend(page, options = {}) {
    const publicList = options.publicList || catalog;
    const ratingPosts = [];
    // Con 0.999 los barajados (Fisher-Yates) dejan el orden original.
    await page.addInitScript(() => { Math.random = () => 0.999; });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const request = route.request();
        const { pathname } = new URL(request.url());
        if (pathname === '/api/public-quizzes') {
            return route.fulfill({ json: publicList });
        }
        const rating = pathname.match(/^\/api\/quizzes\/([^/]+)\/rating$/);
        if (rating && request.method() === 'POST') {
            ratingPosts.push({ id: rating[1], body: request.postDataJSON() });
            return route.fulfill({ json: { avg: 4.5, count: 3 } });
        }
        const quiz = pathname.match(/^\/api\/quizzes\/([^/]+)$/);
        if (quiz && quizzes[quiz[1]]) {
            return route.fulfill({ json: quizzes[quiz[1]] });
        }
        return route.fulfill({ json: {} });
    });
    return { ratingPosts };
}

const cards = page => page.locator('#public-list .card');
const cardTitles = page => page.locator('#public-list .card h3');
const panel = (page, i) => page.locator(`.player-panel[data-player="${i}"]`);
const answerButtons = (page, i) => panel(page, i).locator('[data-answers] .answer');

async function openCatalog(page, query = '?lang=es') {
    await page.goto('/multiplayer/' + query);
    await expect(cards(page)).toHaveCount(3);
}

async function selectQuiz(page, name) {
    await cards(page).filter({ hasText: name }).locator('.btn-primary').click();
    await expect(page.locator('#selected-title')).toHaveText(name);
    await expect(page.locator('#setup')).toBeVisible();
}

async function setQuestionCount(page, value) {
    await page.locator('#question-count').fill(String(value));
    await page.locator('#question-count').dispatchEvent('change');
}

async function startWithNames(page, names) {
    for (let i = 0; i < names.length; i++) {
        await page.locator(`#player-name-${i}`).fill(names[i]);
    }
    await page.locator('#start-btn').click();
    await expect(page.locator('#game')).toBeVisible();
}

async function scoreOf(page, i) {
    const text = await panel(page, i).locator('[data-score]').textContent();
    return parseInt(text.replace(/\D/g, ''), 10);
}

async function continueAfterRound(page) {
    const modal = page.locator('#round-ranking-modal');
    await expect(modal).toHaveClass(/\bshow\b/);
    await page.locator('#round-ranking-continue').click();
    await expect(modal).not.toHaveClass(/\bshow\b/);
}

test('catálogo: lista los quizzes públicos por partidas jugadas, sin panel de partida', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);

    await expect(cardTitles(page)).toHaveText(['Geografia', 'Mixt', 'Àlgebra']);
    const geografia = cards(page).filter({ hasText: 'Geografia' });
    await expect(geografia).toContainText('Preguntas: 2');
    await expect(geografia).toContainText('10 partidas · 30 jugadores');
    await expect(geografia.locator('.tag')).toHaveText(['socials', 'mapes']);
    await expect(geografia.locator('.rating-summary')).toHaveText('4.0 · 2 votos');
    await expect(geografia.locator('.btn-primary')).toHaveText('Seleccionar');
    await expect(cards(page).filter({ hasText: 'Mixt' }).locator('.rating-summary')).toHaveText('Sin valoraciones');
    await expect(page.locator('#game-panel')).toBeHidden();
    await expect(page.locator('#public-pagination')).toBeHidden();
});

test('búsqueda por nombre o etiqueta, nº de preguntas y solo con imagen', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);

    await page.locator('#search').fill('mapes');
    await expect(cardTitles(page)).toHaveText(['Geografia']);
    await page.locator('#search').fill('MIX');
    await expect(cardTitles(page)).toHaveText(['Mixt']);
    await page.locator('#search').fill('');
    await expect(cards(page)).toHaveCount(3);

    await page.locator('#min-questions').fill('3');
    await expect(cardTitles(page)).toHaveText(['Mixt', 'Àlgebra']);
    await page.locator('#max-questions').fill('5');
    await expect(cardTitles(page)).toHaveText(['Mixt']);
    await page.locator('#min-questions').fill('');
    await page.locator('#max-questions').fill('');
    await expect(cards(page)).toHaveCount(3);

    await page.locator('#only-image').check();
    await expect(cardTitles(page)).toHaveText(['Mixt']);
});

test('etiquetas: desplegar, filtrar por una, seleccionar todas y limpiar', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);

    const checkboxes = page.locator('#tag-filter input[type="checkbox"]');
    await expect(checkboxes).toHaveCount(0);
    await page.locator('#tags-toggle').click();
    await expect(checkboxes).toHaveCount(3);

    await page.locator('#tag-filter label', { hasText: 'proves' }).locator('input').check();
    await expect(cardTitles(page)).toHaveText(['Mixt']);

    await page.locator('#tags-clear').click();
    await expect(cards(page)).toHaveCount(3);
    await expect(page.locator('#tag-filter input:checked')).toHaveCount(0);

    // "Todas" filtra por cualquier etiqueta: Àlgebra (sin etiquetas) queda fuera.
    await page.locator('#tags-select-all').click();
    await expect(page.locator('#tag-filter input:checked')).toHaveCount(3);
    await expect(cardTitles(page)).toHaveText(['Geografia', 'Mixt']);
});

test('orden: alfabético ascendente/descendente y más recientes', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);

    await page.locator('#sort').selectOption('alpha');
    await expect(cardTitles(page)).toHaveText(['Àlgebra', 'Geografia', 'Mixt']);
    await page.locator('#sort').selectOption('alpha-desc');
    await expect(cardTitles(page)).toHaveText(['Mixt', 'Geografia', 'Àlgebra']);
    await page.locator('#sort').selectOption('recent');
    await expect(cardTitles(page)).toHaveText(['Mixt', 'Àlgebra', 'Geografia']);
});

test('paginación de 12 en 12', async ({ page }) => {
    const many = Array.from({ length: 14 }, (_, i) => ({
        id: 'p' + i,
        name: 'Quiz ' + String(i + 1).padStart(2, '0'),
        tags: [],
        questionsCount: 1,
        playsCount: 100 - i
    }));
    await mockBackend(page, { publicList: many });
    await page.goto('/multiplayer/?lang=es');

    const pagination = page.locator('#public-pagination');
    await expect(cards(page)).toHaveCount(12);
    await expect(cardTitles(page).first()).toHaveText('Quiz 01');
    await expect(pagination).toBeVisible();
    await expect(pagination.locator('span')).toHaveText('1 / 2');
    await expect(pagination.locator('button').first()).toBeDisabled();

    await pagination.locator('button').last().click();
    await expect(cardTitles(page)).toHaveText(['Quiz 13', 'Quiz 14']);
    await expect(pagination.locator('span')).toHaveText('2 / 2');
    await expect(pagination.locator('button').last()).toBeDisabled();

    await pagination.locator('button').first().click();
    await expect(cards(page)).toHaveCount(12);
});

test('favorito persistente: se marca y pasa a encabezar el listado tras recargar', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);

    const favBtn = cards(page).filter({ hasText: 'Àlgebra' }).locator('.favorite-btn');
    await expect(favBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(favBtn).toHaveAttribute('aria-label', 'Guardar en favoritos');
    await favBtn.click();
    await expect(favBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(favBtn).toHaveAttribute('aria-label', 'Quitar de favoritos');
    await expect(favBtn).toHaveText('❤');

    await page.reload();
    await expect(cardTitles(page)).toHaveText(['Àlgebra', 'Geografia', 'Mixt']);
    await expect(cards(page).first().locator('.favorite-btn')).toHaveAttribute('aria-pressed', 'true');
});

test('valoración: envía la puntuación y recuerda la propia tras recargar', async ({ page }) => {
    const { ratingPosts } = await mockBackend(page);
    await openCatalog(page);

    const geografia = cards(page).filter({ hasText: 'Geografia' });
    await expect(geografia.locator('.rating-star.is-filled')).toHaveCount(4);
    await geografia.locator('.rating-star[data-value="5"]').click();
    await expect(geografia.locator('.rating-summary')).toHaveText('4.5 · 3 votos');
    await expect(geografia.locator('.rating-star.is-filled')).toHaveCount(5);
    expect(ratingPosts).toHaveLength(1);
    expect(ratingPosts[0].id).toBe('q1');
    expect(ratingPosts[0].body.rating).toBe(5);
    expect(ratingPosts[0].body.deviceId).toBeTruthy();

    // El listado mockeado sigue diciendo ratingAvg: 4, pero se pinta la propia (5).
    await page.reload();
    await expect(cards(page).filter({ hasText: 'Geografia' }).locator('.rating-star.is-filled')).toHaveCount(5);
});

test('seleccionar un quiz muestra la configuración y descarta las preguntas de respuesta libre', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);
    await selectQuiz(page, 'Geografia');

    await expect(page.locator('#game-panel')).toBeVisible();
    await expect(page.locator('#selected-meta')).toHaveText('Preguntas: 2');
    await expect(page.locator('#question-count')).toHaveValue('2');
    await expect(page.locator('#question-count-total')).toHaveText('de 2');
    await expect(page.locator('#question-mode')).toHaveValue('shared');
    await expect(page.locator('#question-time')).toHaveValue('');
    await expect(page.locator('#question-time')).toHaveAttribute('placeholder', 'Auto');
    await expect(page.locator('#player-names label')).toHaveText(['Jugador 1', 'Jugador 2']);
    await expect(page.locator('#game')).toBeHidden();
    await expect(page.locator('#results')).toBeHidden();
});

test('abrir directamente con ?id= selecciona el quiz', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/multiplayer/?id=q2&lang=es');

    await expect(page.locator('#selected-title')).toHaveText('Mixt');
    await expect(page.locator('#selected-meta')).toHaveText('Preguntas: 3');
    await expect(page.locator('#setup')).toBeVisible();
});

test('jugadores: nº de campos, nombres normalizados e iconos que se recuerdan', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);
    await selectQuiz(page, 'Geografia');

    await page.locator('#player-count').selectOption('4');
    await expect(page.locator('#player-names label')).toHaveText(['Jugador 1', 'Jugador 2', 'Jugador 3', 'Jugador 4']);
    await expect(page.locator('#player-name-0')).toHaveAttribute('placeholder', 'AAA');

    await page.locator('#player-name-0').fill('ana1x');
    await expect(page.locator('#player-name-0')).toHaveValue('ANA');
    await page.locator('#player-name-2').fill('José');
    await expect(page.locator('#player-name-2')).toHaveValue('JOS');

    const secondPicker = page.locator('.player-name-field').nth(1).locator('.mp-icon-btn');
    await expect(secondPicker.filter({ hasText: '🐱' })).toHaveAttribute('aria-pressed', 'true');
    await secondPicker.filter({ hasText: '🐼' }).click();
    await expect(secondPicker.filter({ hasText: '🐼' })).toHaveAttribute('aria-pressed', 'true');
    await expect(secondPicker.filter({ hasText: '🐱' })).toHaveAttribute('aria-pressed', 'false');

    await page.reload();
    await selectQuiz(page, 'Geografia');
    await expect(page.locator('#player-name-0')).toHaveValue('ANA');
    await expect(page.locator('.player-name-field').nth(1).locator('.mp-icon-btn', { hasText: '🐼' })).toHaveAttribute('aria-pressed', 'true');

    // Nombre vacío: en la partida se usa el número del jugador.
    await page.locator('#start-btn').click();
    await expect(panel(page, 0).locator('.player-name-text')).toHaveText('ANA');
    await expect(panel(page, 1).locator('.player-name-text')).toHaveText('2');
    await expect(panel(page, 1).locator('.player-icon')).toHaveText('🐼');
});

test('partida compartida: responder, revelar, ranking por ronda y resultados', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await mockBackend(page);
    await openCatalog(page);
    await selectQuiz(page, 'Geografia');
    await startWithNames(page, ['ANA', 'BOB']);

    await expect(page.locator('body')).toHaveClass(/\bplaying\b/);
    await expect(page.locator('body')).toHaveClass(/\bmode-shared\b/);
    await expect(page.locator('#setup')).toBeHidden();
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 1 de 2');
    await expect(page.locator('#timer-pill')).toContainText('Tiempo: ');
    await expect(page.locator('#question-text')).toHaveText('Capital de França?');
    await expect(page.locator('.player-panel')).toHaveCount(2);
    for (const i of [0, 1]) {
        await expect(panel(page, i).locator('[data-player-question]')).toHaveText('Capital de França?');
        await expect(answerButtons(page, i)).toHaveText(['París', 'Berlín', 'Roma', 'Londres']);
        await expect(panel(page, i).locator('[data-score]')).toHaveText('Puntos: 0');
        await expect(panel(page, i).locator('[data-multi-submit]')).toBeHidden();
    }
    await expect(panel(page, 0).locator('.player-name-text')).toHaveText('ANA');
    await expect(panel(page, 0).locator('.player-icon')).toHaveText('🦊');

    // Responder no revela nada hasta que responden todos: solo bloquea.
    await answerButtons(page, 0).filter({ hasText: 'París' }).click();
    await expect(answerButtons(page, 0).first()).toBeDisabled();
    await expect(answerButtons(page, 0).filter({ hasText: 'París' })).toHaveClass(/\bselected\b/);
    await expect(panel(page, 0).locator('[data-feedback]')).toHaveText('');
    await expect(answerButtons(page, 1).first()).toBeEnabled();

    await answerButtons(page, 1).filter({ hasText: 'Berlín' }).click();
    await expect(panel(page, 0).locator('[data-feedback]')).toHaveText('¡Correcto!');
    await expect(panel(page, 0).locator('[data-feedback]')).toHaveClass(/\bok\b/);
    await expect(panel(page, 1).locator('[data-feedback]')).toHaveText('Incorrecto');
    await expect(panel(page, 1).locator('[data-feedback]')).toHaveClass(/\bbad\b/);
    await expect(answerButtons(page, 1).filter({ hasText: 'Berlín' })).toHaveClass(/\bwrong\b/);
    await expect(answerButtons(page, 1).filter({ hasText: 'París' })).toHaveClass(/\bcorrect\b/);
    expect(await scoreOf(page, 0)).toBeGreaterThanOrEqual(100);
    await expect(panel(page, 1).locator('[data-score]')).toHaveText('Puntos: 0');

    await expect(page.locator('#round-ranking-modal')).toHaveClass(/\bshow\b/);
    await expect(page.locator('#round-ranking-modal')).toHaveAttribute('aria-hidden', 'false');
    const roundRanking = page.locator('#round-ranking-list li');
    await expect(roundRanking).toHaveCount(2);
    await expect(roundRanking.first()).toContainText('🦊 ANA — ');
    await expect(roundRanking.last()).toHaveText('🐱 BOB — 0');
    await continueAfterRound(page);

    await expect(page.locator('#question-progress')).toHaveText('Pregunta 2 de 2');
    await expect(page.locator('#question-text')).toHaveText("Capital d'Itàlia?");
    await expect(panel(page, 0).locator('[data-feedback]')).toHaveText('');
    await expect(answerButtons(page, 0).first()).toBeEnabled();

    await answerButtons(page, 0).filter({ hasText: 'Roma' }).click();
    await answerButtons(page, 1).filter({ hasText: 'Roma' }).click();
    await continueAfterRound(page);

    await expect(page.locator('#results')).toBeVisible();
    await expect(page.locator('#game')).toBeHidden();
    const ranking = page.locator('#ranking-list li');
    await expect(ranking).toHaveCount(2);
    await expect(ranking.first()).toContainText('🦊 ANA — ');
    await expect(ranking.last()).toContainText('🐱 BOB — ');
    expect(errors).toEqual([]);
});

test('respuesta múltiple (acierto y parcial), verdadero/falso y pregunta con imagen', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);
    await selectQuiz(page, 'Mixt');
    await startWithNames(page, ['ANA', 'BOB']);

    // Q1, múltiple: correctas "2" y "5".
    const submit0 = panel(page, 0).locator('[data-multi-submit]');
    const submit1 = panel(page, 1).locator('[data-multi-submit]');
    await expect(submit0).toBeVisible();
    await expect(submit0).toBeDisabled();
    await expect(submit0).toHaveText('Enviar respuestas');

    await answerButtons(page, 0).filter({ hasText: /^2$/ }).click();
    await expect(answerButtons(page, 0).filter({ hasText: /^2$/ })).toHaveClass(/\bmulti-selected\b/);
    await expect(submit0).toBeEnabled();
    await answerButtons(page, 0).filter({ hasText: /^5$/ }).click();
    await submit0.click();
    await expect(submit0).toBeHidden();
    await expect(panel(page, 0).locator('.answer.selected')).toHaveCount(2);
    await expect(answerButtons(page, 0).first()).toBeDisabled();

    await answerButtons(page, 1).filter({ hasText: /^2$/ }).click();
    await submit1.click();
    await expect(panel(page, 0).locator('[data-feedback]')).toHaveText('¡Correcto!');
    await expect(panel(page, 1).locator('[data-feedback]')).toHaveText('Parcialmente correcto');
    await expect(panel(page, 1).locator('[data-feedback]')).toHaveClass(/\bpartial\b/);
    expect(await scoreOf(page, 1)).toBeGreaterThan(0);
    expect(await scoreOf(page, 1)).toBeLessThan(await scoreOf(page, 0));
    await expect(panel(page, 1).locator('.answer.correct')).toHaveText(['2', '5']);
    await continueAfterRound(page);

    // Q2, verdadero/falso: solo 2 botones y sin "Enviar respuestas".
    await expect(answerButtons(page, 0)).toHaveText(['Vertader', 'Fals']);
    await expect(submit0).toBeHidden();
    await answerButtons(page, 0).filter({ hasText: 'Vertader' }).click();
    await answerButtons(page, 1).filter({ hasText: 'Fals' }).click();
    await expect(panel(page, 1).locator('[data-feedback]')).toHaveText('Incorrecto');
    await expect(answerButtons(page, 1).filter({ hasText: 'Fals' })).toHaveClass(/\bwrong\b/);
    await continueAfterRound(page);

    // Q3, con imagen: se pinta en cada panel y en la tarjeta compartida.
    await expect(page.locator('#question-text')).toHaveText('Quin animal és?');
    await expect(panel(page, 0).locator('[data-player-media]')).not.toHaveClass(/\bhidden\b/);
    await expect(panel(page, 0).locator('[data-player-image]')).toHaveAttribute('src', '/icons/logo.svg');
    await expect(page.locator('#question-media')).not.toHaveClass(/\bhidden\b/);
    await expect(page.locator('#question-image')).toHaveAttribute('src', /\/icons\/logo\.svg$/);
});

test('tiempo agotado: quien no responde queda como «Tiempo»', async ({ page }) => {
    await page.clock.install();
    await mockBackend(page);
    await openCatalog(page);
    await selectQuiz(page, 'Geografia');
    await setQuestionCount(page, 1);
    await startWithNames(page, ['ANA', 'BOB']);
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 20s');

    await answerButtons(page, 0).filter({ hasText: 'París' }).click();
    await page.clock.runFor(20_500);
    await expect(panel(page, 0).locator('[data-feedback]')).toHaveText('¡Correcto!');
    await expect(panel(page, 1).locator('[data-feedback]')).toHaveText('Tiempo');
    await expect(panel(page, 1).locator('[data-feedback]')).toHaveClass(/\bmuted\b/);
    await expect(answerButtons(page, 1).first()).toBeDisabled();
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 0s');

    await page.clock.runFor(1_200);
    await continueAfterRound(page);
    await expect(page.locator('#results')).toBeVisible();
});

test('nº de preguntas a jugar y tiempo por pregunta configurables', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);
    await selectQuiz(page, 'Geografia');

    await setQuestionCount(page, 9);
    await expect(page.locator('#question-count')).toHaveValue('2');
    await setQuestionCount(page, 1);
    await expect(page.locator('#question-count')).toHaveValue('1');

    const time = page.locator('#question-time');
    await time.fill('3');
    await expect(time).toHaveValue('5');
    await time.fill('200');
    await expect(time).toHaveValue('120');
    await time.fill('7');
    await expect(time).toHaveValue('7');

    await startWithNames(page, ['ANA', 'BOB']);
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 1 de 1');
    await expect(page.locator('#timer-pill')).toHaveText(/^Tiempo: [67]s$/);

    await answerButtons(page, 0).first().click();
    await answerButtons(page, 1).first().click();
    await continueAfterRound(page);
    await expect(page.locator('#results')).toBeVisible();
});

test('modo «una diferente por jugador»: cada panel con su propia pregunta', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);
    await selectQuiz(page, 'Geografia');
    await page.locator('#question-mode').selectOption('per-player');
    await startWithNames(page, ['ANA', 'BOB']);

    await expect(page.locator('body')).toHaveClass(/\bmode-per-player\b/);
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 1 de 2');
    await expect(page.locator('#question-text')).toHaveText('');
    await expect(panel(page, 0).locator('[data-player-question]')).toHaveText('Capital de França?');
    await expect(panel(page, 1).locator('[data-player-question]')).toHaveText("Capital d'Itàlia?");
    await expect(answerButtons(page, 1)).toHaveText(['Madrid', 'Roma', 'Lisboa', 'Atenes']);

    await answerButtons(page, 0).filter({ hasText: 'París' }).click();
    await answerButtons(page, 1).filter({ hasText: 'Roma' }).click();
    await expect(panel(page, 0).locator('[data-feedback]')).toHaveText('¡Correcto!');
    await expect(panel(page, 1).locator('[data-feedback]')).toHaveText('¡Correcto!');
    await continueAfterRound(page);
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 2 de 2');
});

test('resultados: repetir mismas preguntas, repetir y elegir otro quiz', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);
    await selectQuiz(page, 'Geografia');
    await setQuestionCount(page, 1);
    await startWithNames(page, ['ANA', 'BOB']);

    async function playOneRound() {
        await answerButtons(page, 0).filter({ hasText: 'París' }).click();
        await answerButtons(page, 1).filter({ hasText: 'París' }).click();
        await continueAfterRound(page);
        await expect(page.locator('#results')).toBeVisible();
    }

    await playOneRound();
    await page.locator('#play-same').click();
    await expect(page.locator('#results')).toBeHidden();
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 1 de 1');
    await expect(page.locator('#question-text')).toHaveText('Capital de França?');
    await expect(panel(page, 0).locator('[data-score]')).toHaveText('Puntos: 0');

    await playOneRound();
    await page.locator('#play-again').click();
    await expect(page.locator('#results')).toBeHidden();
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 1 de 1');
    await expect(panel(page, 1).locator('[data-score]')).toHaveText('Puntos: 0');

    await playOneRound();
    await page.locator('#pick-another').click();
    await expect(page.locator('#game-panel')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/\bplaying\b/);
    await expect(cards(page)).toHaveCount(3);
});

// El selector de idioma vive en la cabecera, que se oculta en configuración
// y partida (body.preparing/playing): solo se cambia desde el catálogo.
test('cambio de idioma en caliente desde el catálogo', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);

    await page.locator('#lang-select').selectOption('en');
    await expect(cards(page).first().locator('.btn-primary')).toHaveText('Select');
    await expect(cards(page).first()).toContainText('Questions: 2');
    await expect(page.locator('#search')).toHaveAttribute('placeholder', 'Search by name or tag');
    await expect(page.locator('#round-ranking-continue')).toHaveText('Continue');

    await selectQuiz(page, 'Geografia');
    await expect(page.locator('#selected-meta')).toHaveText('Questions: 2');
    await expect(page.locator('#start-btn')).toHaveText('Start');
    await expect(page.locator('#player-names label')).toHaveText(['Player 1', 'Player 2']);

    await startWithNames(page, ['ANA', 'BOB']);
    await expect(page.locator('#question-progress')).toHaveText('Question 1 of 2');
    await expect(panel(page, 0).locator('[data-score]')).toHaveText('Score: 0');
});
