const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Red de seguridad del comportamiento actual de /solo/ antes de pasarlo a
// Vue. Complementa solo-library.spec.js y solo-poll.spec.js. No hay
// Socket.IO: todo es REST, así que basta con mockear /api/**. Con
// Math.random = 0.999 los barajados dejan el orden original, y con
// page.clock el temporizador y los saltos de 1,2 s solo avanzan cuando el
// test lo pide.

const geoQuestions = [
    { question: 'Capital de França?', type: 'quiz', answers: ['París', 'Berlín', 'Roma', 'Londres'], correctAnswers: [1], time: 20 },
    { question: 'Quins són primers?', type: 'multiple', answers: ['2', '4', '5', '9'], correctAnswers: [1, 3], time: 20 },
    { question: 'El sol és una estrella', type: 'true-false', answers: ['Cert', 'Fals', 'x', 'y'], correctAnswers: [1], time: 20 },
    { question: "Capital d'Espanya", type: 'short-answer', acceptedAnswers: ['Madrid'], time: 20 },
    { question: 'Quant és pi?', type: 'numeric', numericAnswer: 3.14, tolerance: 0.01, time: 20 }
];

function catalogItem(id, name, extra) {
    return Object.assign({ id, name, tags: [], questionsCount: 5, playsCount: 0, playersCount: 0, ratingAvg: 0, ratingCount: 0, createdAt: '2026-01-01T00:00:00Z' }, extra);
}

const catalog = [
    catalogItem('q1', 'Geografia', { tags: ['socials', 'mapes'], playsCount: 30, playersCount: 12, ratingAvg: 3, ratingCount: 2, createdAt: '2026-01-01T00:00:00Z' }),
    catalogItem('q2', 'Àlgebra', { tags: ['mates'], questionsCount: 12, playsCount: 20, ratingAvg: 5, ratingCount: 1, coverImage: '/icons/logo.svg', createdAt: '2026-03-01T00:00:00Z' }),
    catalogItem('q3', 'Biologia', { tags: ['ciències', 'Socials'], questionsCount: 2, playsCount: 10, createdAt: '2026-02-01T00:00:00Z' })
];

async function mockBackend(page, options = {}) {
    const calls = { soloRuns: [], ratings: [], launch: [], publicQueries: [] };
    const list = options.catalog || catalog;
    const quizzes = Object.assign({
        q1: { id: 'q1', name: 'Geografia', tags: ['socials', 'mapes'], questions: geoQuestions },
        q2: { id: 'q2', name: 'Àlgebra', tags: ['mates'], questions: [geoQuestions[0]] },
        q3: { id: 'q3', name: 'Biologia', tags: [], questions: [geoQuestions[2]] }
    }, options.quizzes || {});
    const rankingTop = options.rankingTop || [];
    await page.addInitScript(() => { Math.random = () => 0.999; });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const request = route.request();
        const url = new URL(request.url());
        const { pathname } = url;
        const method = request.method();
        if (pathname === '/api/public-quizzes') {
            calls.publicQueries.push(url.search);
            return route.fulfill({ json: list });
        }
        if (pathname === '/api/player-auth/launch-token') {
            calls.launch.push(request.postDataJSON());
            return route.fulfill({ json: { join_token: 'join-1', public_code: 'Xé9z' } });
        }
        let m = pathname.match(/^\/api\/quizzes\/([^/]+)\/solo-ranking$/);
        if (m) return route.fulfill({ json: { top: rankingTop } });
        m = pathname.match(/^\/api\/quizzes\/([^/]+)\/solo-run$/);
        if (m) {
            calls.soloRuns.push({ id: m[1], body: request.postDataJSON() });
            return route.fulfill({ json: { top: [{ playerName: 'ABC', score: 1000 }, { playerName: '', score: 10 }] } });
        }
        m = pathname.match(/^\/api\/quizzes\/([^/]+)\/rating$/);
        if (m && method === 'POST') {
            calls.ratings.push({ id: m[1], body: request.postDataJSON() });
            return route.fulfill({ json: { avg: 4.5, count: 3 } });
        }
        m = pathname.match(/^\/api\/quizzes\/([^/]+)$/);
        if (m && quizzes[m[1]]) return route.fulfill({ json: quizzes[m[1]] });
        if (m) return route.fulfill({ status: 404, json: { error: 'no' } });
        return route.fulfill({ json: {} });
    });
    return calls;
}

const cards = page => page.locator('#public-list .card');
const cardTitles = page => page.locator('#public-list .card h3');
const answerButtons = page => page.locator('#answers button.answer');

async function openCatalog(page, query = '?lang=es') {
    await page.goto('/solo/' + query);
    await expect(cards(page).first()).toBeVisible();
}

async function selectQuiz(page, name) {
    await cards(page).filter({ hasText: name }).locator('.btn-primary').click();
    await expect(page.locator('#selected-title')).toHaveText(name);
    await expect(page.locator('#start-form')).toBeVisible();
}

// Abre un quiz con ?id= (como desde /create/) con el reloj controlado.
async function openQuizDirect(page, id, query = '&lang=es') {
    await page.clock.install();
    await page.goto('/solo/?id=' + id + query);
    await expect(page.locator('#start-form')).toBeVisible();
    // install() deja el reloj en marcha; se para para que solo avance con runFor.
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
}

// Compte arrere 3-2-1 abans de cada pregunta (proposta 23): es veu el 3 i
// es deixa passar sencer; el temporitzador de la pregunta encara no ha corregut.
async function countdown(page) {
    await expect(page.locator('#solo-countdown span')).toHaveText('3');
    await page.clock.runFor(3000);
    await expect(page.locator('#solo-countdown')).toHaveCount(0);
}

async function start(page) {
    await page.locator('#start-btn').click();
    await expect(page.locator('#game-area')).toBeVisible();
    await countdown(page);
}

test('catálogo: tarjetas ordenadas por partidas, con datos, sin paginación', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);

    await expect(cardTitles(page)).toHaveText(['Geografia', 'Àlgebra', 'Biologia']);
    const geo = cards(page).filter({ hasText: 'Geografia' });
    await expect(geo).toContainText('Preguntas: 5');
    await expect(geo.locator('.tag')).toHaveText(['socials', 'mapes']);
    await expect(geo.locator('.rating-summary')).toHaveText('3.0 · 2 votos');
    await expect(geo.locator('.rating-star.is-filled')).toHaveCount(3);
    await expect(geo.locator('.card-stats')).toHaveText('30 partidas · 12 jugadores');
    await expect(geo.locator('.btn-primary')).toHaveText('Jugar en solitario');
    await expect(geo.locator('.card-link')).toHaveText('Ver ranking');
    await expect(geo.locator('.favorite-btn')).toHaveAttribute('aria-pressed', 'false');
    await expect(cards(page).filter({ hasText: 'Biologia' }).locator('.rating-summary')).toHaveText('Sin valoraciones');
    await expect(page.locator('#public-empty')).toHaveText('');
    await expect(page.locator('#public-pagination')).toBeHidden();
    await expect(page.locator('#start-form')).toBeHidden();
    await expect(page.locator('#selected-title')).toHaveText('Elige un juego para empezar');
});

test('búsqueda por nombre o etiqueta, nº de preguntas, solo con imagen y lista vacía', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);

    await page.locator('#search').fill('mates');
    await expect(cardTitles(page)).toHaveText(['Àlgebra']);
    await page.locator('#search').fill('BIO');
    await expect(cardTitles(page)).toHaveText(['Biologia']);
    await page.locator('#search').fill('');

    await page.locator('#min-questions').fill('3');
    await expect(cardTitles(page)).toHaveText(['Geografia', 'Àlgebra']);
    await page.locator('#max-questions').fill('6');
    await expect(cardTitles(page)).toHaveText(['Geografia']);
    await page.locator('#min-questions').fill('');
    await page.locator('#max-questions').fill('');

    await page.locator('#only-image').check();
    await expect(cardTitles(page)).toHaveText(['Àlgebra']);
    await page.locator('#search').fill('zzz');
    await expect(cards(page)).toHaveCount(0);
    await expect(page.locator('#public-empty')).toHaveText('No hay juegos públicos disponibles.');
});

test('ordenar: A-Z, Z-A, mejor valorados y más recientes', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);
    await page.locator('#sort').selectOption('alpha');
    await expect(cardTitles(page)).toHaveText(['Àlgebra', 'Biologia', 'Geografia']);
    await page.locator('#sort').selectOption('alpha-desc');
    await expect(cardTitles(page)).toHaveText(['Geografia', 'Biologia', 'Àlgebra']);
    await page.locator('#sort').selectOption('rating');
    await expect(cardTitles(page)).toHaveText(['Àlgebra', 'Geografia', 'Biologia']);
    await page.locator('#sort').selectOption('recent');
    await expect(cardTitles(page)).toHaveText(['Àlgebra', 'Biologia', 'Geografia']);
});

test('filtro de etiquetas: mostrar, marcar, todas, limpiar y URL', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);
    const items = page.locator('#tag-filter .tag-filter__item');
    await expect(items).toHaveCount(0);
    await expect(page.locator('#tags-toggle')).toHaveAttribute('aria-label', 'Mostrar etiquetas');

    await page.locator('#tags-toggle').click();
    await expect(page.locator('#tags-toggle')).toHaveAttribute('aria-label', 'Ocultar etiquetas');
    // Por frecuencia y después alfabético; «Socials» y «socials» cuentan como una.
    await expect(items).toHaveText(['socials', 'ciències', 'mapes', 'mates']);

    await items.filter({ hasText: 'mates' }).locator('input').check();
    await expect(cardTitles(page)).toHaveText(['Àlgebra']);
    await expect(page).toHaveURL(/[?&]tag=mates(&|$)/);

    await items.filter({ hasText: 'socials' }).locator('input').check();
    await expect(cardTitles(page)).toHaveText(['Geografia', 'Àlgebra', 'Biologia']);
    await expect(page).toHaveURL(/[?&]tags=socials%2Cmates|[?&]tags=mates%2Csocials/);

    await page.locator('#tags-clear').click();
    await expect(items.locator('input:checked')).toHaveCount(0);
    await expect(page).not.toHaveURL(/tags?=/);

    await page.locator('#tags-toggle').click();
    await expect(items).toHaveCount(0);
    await page.locator('#tags-select-all').click();
    await expect(items).toHaveCount(4);
    await expect(items.locator('input:checked')).toHaveCount(4);
});

test('?tags=…&tagMode=all filtra al cargar y pide primero la lista filtrada', async ({ page }) => {
    const calls = await mockBackend(page);
    await page.goto('/solo/?lang=es&tags=SOCIALS,mapes&tagMode=all');
    await expect(cardTitles(page)).toHaveText(['Geografia']);
    expect(calls.publicQueries[0]).toBe('?tags=SOCIALS%2Cmapes&tagMode=all');
    expect(calls.publicQueries).toContain('');
    await page.locator('#tags-toggle').click();
    await expect(page.locator('#tag-filter input:checked')).toHaveCount(2);
});

test('favoritos van primero y se recuerdan', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);
    const bio = cards(page).filter({ hasText: 'Biologia' });
    await bio.locator('.favorite-btn').click();
    await expect(bio.locator('.favorite-btn')).toHaveAttribute('aria-pressed', 'true');
    await expect(bio.locator('.favorite-btn')).toHaveText('❤');
    await expect(bio.locator('.favorite-btn')).toHaveAttribute('aria-label', 'Quitar de favoritos');
    // No se reordena al instante; sí al cambiar filtros o al recargar.
    await expect(cardTitles(page)).toHaveText(['Geografia', 'Àlgebra', 'Biologia']);
    await page.locator('#search').fill('a');
    await expect(cardTitles(page)).toHaveText(['Biologia', 'Geografia', 'Àlgebra']);
    await page.reload();
    await expect(cardTitles(page)).toHaveText(['Biologia', 'Geografia', 'Àlgebra']);
});

test('valorar envía la nota con el deviceId y actualiza el resumen', async ({ page }) => {
    const calls = await mockBackend(page);
    await openCatalog(page);
    const geo = cards(page).filter({ hasText: 'Geografia' });
    await geo.locator('.rating-star[data-value="4"]').click();
    await expect(geo.locator('.rating-summary')).toHaveText('4.5 · 3 votos');
    await expect(geo.locator('.rating-star.is-filled')).toHaveCount(4);
    expect(calls.ratings).toHaveLength(1);
    expect(calls.ratings[0].id).toBe('q1');
    expect(calls.ratings[0].body.rating).toBe(4);
    expect(calls.ratings[0].body.deviceId).toMatch(/^[0-9a-f]{24}$/);
});

test('paginación de 12 en 12', async ({ page }) => {
    const many = Array.from({ length: 14 }, (_, i) => catalogItem('p' + i, 'Quiz ' + String(i).padStart(2, '0'), { playsCount: 100 - i }));
    await mockBackend(page, { catalog: many });
    await openCatalog(page);
    const pager = page.locator('#public-pagination');
    await expect(cards(page)).toHaveCount(12);
    await expect(pager).toBeVisible();
    await expect(pager.locator('span')).toHaveText('1 / 2');
    await expect(pager.locator('button').first()).toBeDisabled();
    await pager.locator('button').last().click();
    await expect(cardTitles(page)).toHaveText(['Quiz 12', 'Quiz 13']);
    await expect(pager.locator('span')).toHaveText('2 / 2');
    await expect(pager.locator('button').last()).toBeDisabled();
    await pager.locator('button').first().click();
    await expect(cards(page)).toHaveCount(12);
    // Filtrar vuelve a la primera página.
    await pager.locator('button').last().click();
    await page.locator('#search').fill('Quiz 1');
    await expect(cardTitles(page)).toHaveText(['Quiz 10', 'Quiz 11', 'Quiz 12', 'Quiz 13']);
    await expect(pager).toBeHidden();
});

test('«Ver ranking» abre el modal con el top y se cierra', async ({ page }) => {
    await mockBackend(page, { rankingTop: [{ playerName: 'ANA', score: 900 }, { score: 5 }] });
    await openCatalog(page);
    await cards(page).filter({ hasText: 'Geografia' }).locator('.card-link').click();
    const modal = page.locator('#ranking-modal');
    await expect(modal).toHaveClass(/\bshow\b/);
    await expect(page.locator('#ranking-modal-title')).toHaveText('Top 10 global');
    await expect(page.locator('#ranking-modal-list li')).toHaveText(['ANA — 900 Puntos', 'AAA — 5 Puntos']);
    await page.locator('#ranking-modal-close').click();
    await expect(modal).not.toHaveClass(/\bshow\b/);
});

test('ranking vacío y clic fuera del modal lo cierra', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);
    await cards(page).filter({ hasText: 'Biologia' }).locator('.card-link').click();
    await expect(page.locator('#ranking-modal-list li')).toHaveText(['Aún no hay puntuaciones.']);
    await page.locator('#ranking-modal').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#ranking-modal')).not.toHaveClass(/\bshow\b/);
});

test('seleccionar un quiz muestra el formulario con el nº de preguntas y limita los valores', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);
    await selectQuiz(page, 'Geografia');
    await expect(page.locator('#selected-meta')).toHaveText('Preguntas: 5 · Etiquetas: socials, mapes');
    await expect(page.locator('#question-count')).toHaveValue('5');
    await expect(page.locator('#question-count')).toHaveAttribute('max', '5');
    await expect(page.locator('#question-count-total')).toHaveText('de 5');
    await expect(page.locator('#question-time')).toHaveValue('');
    await expect(page.locator('body')).toHaveClass(/\bplaying\b/);

    await page.locator('#question-count').fill('99');
    await expect(page.locator('#question-count')).toHaveValue('5');
    await page.locator('#question-time').fill('500');
    await expect(page.locator('#question-time')).toHaveValue('120');

    // Un quiz que no existe deja el error en el título.
    await page.evaluate(() => selectQuiz('nope'));
    await expect(page.locator('#selected-title')).toHaveText('No se pudo cargar el quiz.');
});

test('partida completa: tipos de pregunta, puntos, avisos y resultado', async ({ page }) => {
    await mockBackend(page);
    await openQuizDirect(page, 'q1');
    await start(page);

    // 1. Respuesta única correcta: 1000 puntos (sin tiempo consumido).
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 1 de 5');
    await expect(page.locator('#score-pill')).toHaveText('Puntos: 0');
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 20s');
    await expect(answerButtons(page)).toHaveText(['París', 'Berlín', 'Roma', 'Londres']);
    await expect(page.locator('#multi-submit')).toBeHidden();
    await answerButtons(page).nth(0).click();
    await expect(page.locator('#feedback')).toHaveText('¡Correcto!');
    await expect(page.locator('#feedback')).toHaveClass(/feedback--success/);
    await expect(answerButtons(page).nth(0)).toHaveClass(/\bcorrect\b/);
    await expect(answerButtons(page).nth(1)).toBeDisabled();
    await expect(page.locator('#score-pill')).toHaveText('Puntos: 1000');
    // 1200 justos: la siguiente pregunta arranca su temporizador sin consumir nada.
    await page.clock.runFor(1200 + 3000);

    // 2. Múltiple, acierto parcial (2 y 4 → solo 2 es correcta): 1 acierto − 1 fallo = 0.
    // Se prueba primero marcar/desmarcar.
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 2 de 5');
    await expect(page.locator('#multi-submit')).toBeVisible();
    await expect(page.locator('#multi-submit')).toBeDisabled();
    await answerButtons(page).nth(0).click();
    await expect(answerButtons(page).nth(0)).toHaveClass(/multi-selected/);
    await expect(page.locator('#multi-submit')).toBeEnabled();
    await expect(page.locator('#multi-submit')).toHaveClass(/has-selection/);
    await answerButtons(page).nth(0).click();
    await expect(answerButtons(page).nth(0)).not.toHaveClass(/multi-selected/);
    await expect(page.locator('#multi-submit')).toBeDisabled();
    // 3 segundos de 20 → 850 de bonus; sólo marca la 1 (de 1 y 3) → 425.
    await page.clock.runFor(3000);
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 17s');
    await answerButtons(page).nth(0).click();
    await page.locator('#multi-submit').click();
    await expect(page.locator('#feedback')).toHaveText('Respuesta parcialmente correcta: has sumado puntos.');
    await expect(page.locator('#multi-submit')).toBeHidden();
    await expect(page.locator('#score-pill')).toHaveText('Puntos: 1425');
    // Parcial no cuenta como acierto: pide confirmar con el modal.
    const modal = page.locator('#feedback-modal');
    await expect(modal).toHaveClass(/\bshow\b/);
    await expect(page.locator('#feedback-title')).toHaveText('Respuesta incorrecta');
    await expect(page.locator('#feedback-body')).toHaveText('Respuesta correcta: 2, 5');
    await page.locator('#feedback-close').click();
    await expect(modal).not.toHaveClass(/\bshow\b/);
    await countdown(page);

    // 3. Verdadero/falso: solo dos botones; fallo con el modal y el texto correcto.
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 3 de 5');
    await expect(answerButtons(page)).toHaveText(['Cert', 'Fals']);
    await answerButtons(page).nth(1).click();
    await expect(page.locator('#feedback')).toHaveText('Respuesta incorrecta · Respuesta correcta: Cert');
    await expect(page.locator('#feedback')).toHaveClass(/feedback--error/);
    await expect(answerButtons(page).nth(1)).toHaveClass(/\bwrong\b/);
    await expect(modal).toHaveClass(/\bshow\b/);
    await modal.click({ position: { x: 5, y: 5 } });
    await countdown(page);

    // 4. Respuesta corta: sin tildes ni mayúsculas, con Enter.
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 4 de 5');
    await expect(answerButtons(page)).toHaveCount(0);
    const input = page.locator('#solo-free-input');
    await expect(input).toHaveAttribute('placeholder', 'Escribe tu respuesta');
    await input.fill('  MADRÍD ');
    await input.press('Enter');
    await expect(page.locator('#feedback')).toHaveText('¡Correcto!');
    await expect(input).toBeDisabled();
    await expect(page.locator('#solo-free-submit')).toBeDisabled();
    await expect(page.locator('#score-pill')).toHaveText('Puntos: 2425');
    await page.clock.runFor(1300 + 3000);

    // 5. Numérica con coma decimal y botón.
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 5 de 5');
    await expect(page.locator('#solo-free-input')).toHaveAttribute('placeholder', 'Introduce un número');
    await page.locator('#solo-free-input').fill('3,2');
    await page.locator('#solo-free-submit').click();
    await expect(page.locator('#feedback')).toHaveText('Respuesta incorrecta · Respuesta correcta: 3.14 ± 0.01');
    await page.locator('#feedback-close').click();

    await expect(page.locator('#result-area')).toBeVisible();
    await expect(page.locator('#game-area')).toBeHidden();
    await expect(page.locator('#result-summary')).toHaveText('Acertadas 3/5 · 2425 pts');
});

test('se acaba el tiempo: aviso, modal y siguiente pregunta', async ({ page }) => {
    await mockBackend(page);
    await openQuizDirect(page, 'q1');
    await page.locator('#question-time').fill('5');
    await start(page);
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 5s');
    await page.clock.runFor(5200);
    await expect(page.locator('#feedback')).toHaveText('Tiempo agotado');
    await expect(page.locator('#feedback')).toHaveClass(/feedback--muted/);
    await expect(page.locator('#feedback-modal')).toHaveClass(/\bshow\b/);
    await expect(page.locator('#feedback-body')).toHaveText('Respuesta correcta: París');
    await expect(answerButtons(page).nth(0)).toHaveClass(/\bcorrect\b/);
    await page.locator('#feedback-close').click();
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 2 de 5');
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 5s');
    await countdown(page);
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 5s');
});

test('elegir cuántas preguntas: juega solo esas y «Volver a jugar» las mantiene', async ({ page }) => {
    await mockBackend(page);
    await openQuizDirect(page, 'q1');
    await page.locator('#question-count').fill('1');
    await start(page);
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 1 de 1');
    await answerButtons(page).nth(0).click();
    await page.clock.runFor(1300 + 3000);
    await expect(page.locator('#result-area')).toBeVisible();
    await expect(page.locator('#result-summary')).toHaveText('Acertadas 1/1 · 1000 pts');

    await page.locator('#name-cancel').click();
    await page.locator('#play-again').click();
    await expect(page.locator('#game-area')).toBeVisible();
    await expect(page.locator('#result-area')).toBeHidden();
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 1 de 1');
    await expect(page.locator('#score-pill')).toHaveText('Puntos: 0');
});

test('final: pide el nombre, lo normaliza y guarda la puntuación en el ranking', async ({ page }) => {
    const calls = await mockBackend(page);
    await openQuizDirect(page, 'q2');
    await start(page);
    await answerButtons(page).nth(0).click();
    await page.clock.runFor(1300 + 3000);

    const nameModal = page.locator('#name-modal');
    await expect(nameModal).toHaveClass(/\bshow\b/);
    await expect(page.locator('#player-name')).toHaveValue('AAA');
    await page.locator('#player-name').fill('');
    await page.locator('#player-name').pressSequentially('é-b1z');
    await expect(page.locator('#player-name')).toHaveValue('EB1');
    await page.locator('#name-save').click();
    await expect(nameModal).not.toHaveClass(/\bshow\b/);

    await expect(page.locator('#ranking')).toBeVisible();
    await expect(page.locator('#ranking-list li')).toHaveText(['ABC — 1000 Puntos', 'AAA — 10 Puntos']);
    expect(calls.soloRuns).toEqual([{ id: 'q2', body: { name: 'EB1', studentJoinToken: '', score: 1000, totalQuestions: 1 } }]);
});

test('final: «Omitir» guarda como AAA y con el top lleno y peor nota no pregunta', async ({ page }) => {
    const calls = await mockBackend(page);
    await openQuizDirect(page, 'q2');
    await start(page);
    await answerButtons(page).nth(0).click();
    await page.clock.runFor(1300 + 3000);
    await page.locator('#name-cancel').click();
    await expect.poll(() => calls.soloRuns.length).toBe(1);
    expect(calls.soloRuns[0].body.name).toBe('AAA');

    const page2 = await page.context().newPage();
    const top = Array.from({ length: 10 }, (_, i) => ({ playerName: 'P' + i, score: 5000 - i }));
    const calls2 = await mockBackend(page2, { rankingTop: top });
    await openQuizDirect(page2, 'q2');
    await start(page2);
    await answerButtons(page2).nth(0).click();
    await page2.clock.runFor(1300 + 3000);
    await expect.poll(() => calls2.soloRuns.length).toBe(1);
    await expect(page2.locator('#name-modal')).not.toHaveClass(/\bshow\b/);
});

test('error al guardar la puntuación se muestra en el ranking', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/q2/solo-run', route => route.fulfill({ status: 429, json: { error: 'Massa intents' } }));
    await openQuizDirect(page, 'q2');
    await start(page);
    await answerButtons(page).nth(0).click();
    await page.clock.runFor(1300 + 3000);
    await page.locator('#name-save').click();
    await expect(page.locator('#ranking-list li')).toHaveText(['Massa intents']);
    await expect(page.locator('#ranking')).toBeVisible();
});

test('«Elegir otro quiz» vuelve al estado inicial del panel', async ({ page }) => {
    await mockBackend(page);
    await openQuizDirect(page, 'q2');
    await start(page);
    await answerButtons(page).nth(0).click();
    await page.clock.runFor(1300 + 3000);
    await page.locator('#name-cancel').click();
    await page.locator('#pick-another').click();
    await expect(page.locator('#result-area')).toBeHidden();
    await expect(page.locator('#start-form')).toBeHidden();
    await expect(page.locator('#game-area')).toBeHidden();
    await expect(page.locator('#selected-title')).toHaveText('Elige un juego para empezar');
    await expect(page.locator('#selected-meta')).toHaveText('Selecciona un juego público para empezar.');
    await expect(page.locator('body')).not.toHaveClass(/\bplaying\b/);
});

test('imagen y vídeo de YouTube de la pregunta', async ({ page }) => {
    await mockBackend(page, {
        quizzes: {
            qm: { id: 'qm', name: 'Mèdia', questions: [
                { question: 'Imatge', type: 'quiz', answers: ['a', 'b', '', ''], correctAnswers: [1], image: '/icons/logo.svg', time: 20 },
                { question: 'Vídeo', type: 'quiz', answers: ['', 'b', '', ''], correctAnswers: [1], video: 'https://youtu.be/abc123', time: 20 }
            ] }
        }
    });
    await openQuizDirect(page, 'qm');
    await start(page);
    await expect(page.locator('#question-media')).toBeVisible();
    await expect(page.locator('#question-image')).toBeVisible();
    await expect(page.locator('#question-image')).toHaveAttribute('src', '/icons/logo.svg');
    await expect(page.locator('#question-iframe')).toBeHidden();
    // Respuestas vacías se pintan como «Respuesta N».
    await expect(answerButtons(page)).toHaveText(['a', 'b', 'Respuesta 3', 'Respuesta 4']);
    await answerButtons(page).nth(0).click();
    await page.clock.runFor(1300 + 3000);
    await expect(page.locator('#question-image')).toBeHidden();
    await expect(page.locator('#question-iframe')).toBeVisible();
    await expect(page.locator('#question-iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abc123');
    await expect(answerButtons(page).nth(0)).toHaveText('Respuesta 1');
});

test('entrada desde Commons: canjea el token, lo quita de la URL y no pide nombre', async ({ page }) => {
    const calls = await mockBackend(page);
    await page.clock.install();
    await page.goto('/solo/?id=q2&lang=es&commonsLaunchToken=tok-9');
    await expect(page.locator('#start-form')).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await expect(page).not.toHaveURL(/commonsLaunchToken/);
    expect(calls.launch).toEqual([{ launch_token: 'tok-9' }]);
    await start(page);
    await answerButtons(page).nth(0).click();
    await page.clock.runFor(1300 + 3000);
    await expect.poll(() => calls.soloRuns.length).toBe(1);
    // public_code normalizado como un nombre de 3 caracteres.
    expect(calls.soloRuns[0].body).toMatchObject({ name: 'XE9', studentJoinToken: 'join-1' });
    await expect(page.locator('#name-modal')).not.toHaveClass(/\bshow\b/);
});

test('cambiar de idioma traduce el catálogo y el panel', async ({ page }) => {
    await mockBackend(page);
    await openCatalog(page);
    await page.locator('#lang-select').selectOption('en');
    const geo = cards(page).filter({ hasText: 'Geografia' });
    await expect(geo.locator('.btn-primary')).toHaveText('Play solo');
    await expect(geo.locator('.card-link')).toHaveText('View ranking');
    await expect(page.locator('#selected-title')).toHaveText('Pick a game to start');
    await expect(page.locator('#search')).toHaveAttribute('placeholder', 'Search by name or tag');
});

test('compte arrere 3-2-1 abans de cada pregunta: amaga la pregunta i no gasta temps', async ({ page }) => {
    await mockBackend(page);
    await openQuizDirect(page, 'q1');
    await page.locator('#start-btn').click();
    const cd = page.locator('#solo-countdown');
    await expect(cd).toBeVisible();
    await expect(cd.locator('.question-countdown__label')).toHaveText('¡Prepárate!');
    await expect(cd.locator('.question-countdown__hint')).toHaveText('La pregunta empieza en');
    await expect(cd.locator('span')).toHaveText('3');
    await expect(page.locator('#question-text')).toHaveCount(0);
    await expect(answerButtons(page)).toHaveCount(0);
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 20s');
    await page.clock.runFor(1000);
    await expect(cd.locator('span')).toHaveText('2');
    await page.clock.runFor(1000);
    await expect(cd.locator('span')).toHaveText('1');
    await page.clock.runFor(1000);
    await expect(cd).toHaveCount(0);
    await expect(answerButtons(page)).toHaveText(['París', 'Berlín', 'Roma', 'Londres']);
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 20s');
    await page.clock.runFor(2000);
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 18s');
});


// Maquetació igual que «Jugar a l'aula»: respostes amb forma, centrades, en
// 2x2 en PC (una columna en mòbil) i barra de temps; amb imatge, tot cap.
test('partida: misma estructura que en el aula y, con imagen, cabe en pantalla', async ({ page }, testInfo) => {
    if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 360, height: 640 });
    const IMG = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#4a8"/></svg>';
    await page.route('**/big.svg', r => r.fulfill({ contentType: 'image/svg+xml', body: IMG }));
    await mockBackend(page, { quizzes: { qi: { id: 'qi', name: 'Música: instruments bàsics i famílies', questions: [
        { question: 'Quin instrument es toca pinçant les cordes amb els dits?', type: 'quiz', answers: ['Trompeta', 'Flauta', 'Guitarra', 'Tambor'], correctAnswers: [3], image: '/big.svg', time: 20 }
    ] } } });
    await openQuizDirect(page, 'qi');
    await start(page);
    await expect(page.locator('#question-image')).toBeVisible();
    await expect(page.locator('.game-progress__title')).toHaveText('Música: instruments bàsics i famílies');
    await expect(page.locator('#selected-title')).toBeHidden();
    await expect(page.locator('#game-panel .eyebrow')).toBeVisible();
    const viewport = page.viewportSize();
    // Sense desplaçament horitzontal: el panel no es pot eixir per la dreta.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    const boxes = [];
    for (let i = 0; i < 4; i++) boxes.push(await answerButtons(page).nth(i).boundingBox());
    const timer = await page.locator('.solo-timer').boundingBox();
    expect(timer.height).toBeGreaterThan(15);
    for (const box of boxes) {
        expect(box.height).toBeGreaterThanOrEqual(testInfo.project.name === 'mobile' ? 57 : 63);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    const left = Math.min(...boxes.map(b => b.x));
    const right = Math.max(...boxes.map(b => b.x + b.width));
    expect(Math.abs(left - (viewport.width - right))).toBeLessThan(4);
    if (testInfo.project.name === 'desktop') {
        expect(boxes[0].y).toBe(boxes[1].y);
        expect(boxes[2].y).toBeGreaterThan(boxes[0].y);
    }
});
