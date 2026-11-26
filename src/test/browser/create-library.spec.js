const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

const TEACHER = { id: 'teacher-1', email: 'teacher@example.invalid', role: 'editor', nickname: 'Teacher' };

function quiz(id, name, tags) {
    return {
        id, name, tags, ownerId: TEACHER.id, visibility: 'public', allowClone: true,
        questionsCount: 2, playsCount: 0, playersCount: 0, createdAt: '2026-10-01T00:00:00Z'
    };
}

// Backend y socket simulados; `state.quizzes` cambia cuando el test borra un quiz.
async function stubBackend(page, state) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: 'window.testSocketEvents = {}; window.testSocketEmits = [];'
            + 'window.io = function(){ return { on: function(n, fn){ window.testSocketEvents[n] = fn; },'
            + ' emit: function(n){ window.testSocketEmits.push(n); }, disconnect: function(){}, connect: function(){} }; };'
    }));
    await page.route('**/api/**', route => {
        const request = route.request();
        const { pathname } = new URL(request.url());
        if (pathname === '/api/auth/me') return route.fulfill({ json: TEACHER });
        if (pathname === '/api/quizzes' && request.method() === 'GET') return route.fulfill({ json: state.quizzes });
        if (pathname === '/api/tags') return route.fulfill({ json: [] });
        if (pathname === '/api/quizzes/q1/csv') {
            return route.fulfill({
                contentType: 'text/csv',
                headers: { 'Content-Disposition': 'attachment; filename="geografia.csv"' },
                body: 'pregunta;respuesta\n'
            });
        }
        if (pathname === '/api/quizzes/q2' && request.method() === 'DELETE') {
            state.deleted.push('q2');
            state.quizzes = state.quizzes.filter(q => q.id !== 'q2');
            return route.fulfill({ json: { ok: true } });
        }
        return route.fulfill({ json: { enabled: false } });
    });
}

// Camino feliz de la biblioteca de /create/, que no cubren los specs
// existentes (solo miran el selector de idioma y el xip): listado, buscar,
// filtrar por etiqueta, descargar CSV y borrar. Red de seguridad para
// repartir create.js en varios ficheros, no cobertura exhaustiva.
test('biblioteca de /create/: listado, búsqueda, etiqueta, CSV y borrado', async ({ page }) => {
    const state = {
        quizzes: [quiz('q1', 'Geografia', ['socials']), quiz('q2', 'Matemàtiques', ['numeros'])],
        deleted: []
    };
    await stubBackend(page, state);
    await page.goto('/create/?lang=es');

    const cards = page.locator('#game-list .game-card');
    await expect(cards).toHaveCount(2);
    await expect(page.locator('#game-count')).toContainText('2');

    await page.locator('#library-search').fill('Geo');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Geografia');
    await page.locator('#library-search').fill('');
    await expect(cards).toHaveCount(2);

    const quizzesRequest = page.waitForRequest(req => new URL(req.url()).pathname === '/api/quizzes'
        && new URL(req.url()).searchParams.getAll('tags').includes('numeros'));
    await page.locator('#tag-suggestions button.tag', { hasText: 'numeros' }).click();
    await quizzesRequest;
    await expect(page.locator('#filter-info')).toContainText('numeros');
    await page.locator('#clear-filters').click();
    await expect(cards).toHaveCount(2);

    const download = page.waitForEvent('download');
    await cards.filter({ hasText: 'Geografia' }).locator('button[title]', { hasText: '⬇️' }).click();
    expect((await download).suggestedFilename()).toBe('geografia.csv');

    page.once('dialog', dialog => dialog.accept());
    await cards.filter({ hasText: 'Matemàtiques' }).locator('button.btn-danger').click();
    await expect.poll(() => state.deleted).toEqual(['q2']);
    await page.evaluate(() => window.testSocketEvents.gameNamesData([]));
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Geografia');
});

test('biblioteca de /create/: fecha de creación y de modificación en una línea discreta', async ({ page }) => {
    const state = {
        quizzes: [
            { ...quiz('q1', 'Geografia', []), createdAt: '2026-10-01T09:30:00Z', updatedAt: '2026-11-20T18:05:00Z' },
            // Quiz antiguo sin fecha real: el servidor lo marca con 1970 y no se muestra nada.
            { ...quiz('q2', 'Antiga', []), createdAt: '1970-01-01T00:00:00.000Z' }
        ],
        deleted: []
    };
    await stubBackend(page, state);
    await page.goto('/create/?lang=es');

    const cards = page.locator('#game-list .game-card');
    await expect(cards).toHaveCount(2);
    const dates = cards.nth(0).locator('.game-dates');
    await expect(dates).toContainText('Creado 01/10/2026');
    await expect(dates).toContainText('Modificado 20/11/2026');
    expect(await dates.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeLessThanOrEqual(12);
    expect(await dates.evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(20);
    await expect(cards.nth(1).locator('.game-dates')).toHaveCount(0);
});

test('biblioteca: valorar un quiz público con cinco estrellas, como en el modo solo', async ({ page }) => {
    const state = { quizzes: [quiz('q1', 'Geografia', ['socials'])], deleted: [] };
    await stubBackend(page, state);
    const posts = [];
    await page.route('**/api/quizzes/q1/rating', route => {
        posts.push(route.request().postDataJSON());
        return route.fulfill({ json: { avg: 4, count: 1 } });
    });
    await page.goto('/create/?lang=es');
    const card = page.locator('#game-list .game-card').first();
    await expect(card.locator('.rating-star')).toHaveCount(5);
    await expect(card.locator('.rating-summary')).toHaveText('Sin valoraciones');
    await card.locator('.rating-star').nth(3).click();
    await expect(card.locator('.rating-summary')).toHaveText('4.0 · 1 votos');
    await expect(card.locator('.rating-star.is-filled')).toHaveCount(4);
    expect(posts).toHaveLength(1);
    expect(posts[0].rating).toBe(4);
    expect(typeof posts[0].deviceId).toBe('string');
});

// Cada quiz muestra el total de preguntas en su tarjeta, junto a partidas y jugadores.
test('biblioteca de /create/: cada tarjeta muestra el total de preguntas', async ({ page }) => {
    const state = {
        quizzes: [
            { ...quiz('q1', 'Informàtica', ['informatica']), questionCount: 3 },
            { ...quiz('q2', 'Sense preguntes', ['informatica']), questionCount: 0 }
        ],
        deleted: []
    };
    await stubBackend(page, state);
    await page.goto('/create/?lang=es');
    const cards = page.locator('#game-list .game-card');
    await expect(cards).toHaveCount(2);
    await expect(cards.filter({ hasText: 'Informàtica' })).toContainText('3 preguntas');
    await expect(cards.filter({ hasText: 'Sense preguntes' })).toContainText('0 preguntas');
    // El número y la palabra, en el groc corporatiu (la regla base de la tarjeta no els ha de guanyar).
    const qStat = cards.filter({ hasText: 'Informàtica' }).locator('.game-stats__item--questions');
    await expect(qStat).toHaveCSS('color', 'rgb(255, 230, 112)');
    await expect(qStat.locator('.game-stats__num')).toHaveCSS('color', 'rgb(255, 230, 112)');
});

// Fons de cada tarjeta: portada del quiz, miniatura del seu vídeo o el logo de EduHoot; transparent i darrere del contingut.
test('biblioteca de /create/: la tarjeta usa la portada, la miniatura del vídeo o el logo de EduHoot', async ({ page }) => {
    const state = {
        quizzes: [
            Object.assign(quiz('q1', 'Amb imatge', []), { coverImage: '/api/quizzes/q1/cover' }),
            Object.assign(quiz('q2', 'Amb vídeo', []), { coverVideo: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
            quiz('q3', 'Sense res', [])
        ],
        deleted: []
    };
    await stubBackend(page, state);
    // Portada que serveix /api/quizzes/q1/cover (la lista només envia la URL).
    await page.route('**/api/quizzes/q1/cover', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
    // Miniatura de YouTube simulada (stubBackend corta les peticions https).
    await page.route('https://img.youtube.com/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
    await page.goto('/create/?lang=es');

    const covers = page.locator('#game-list .game-card .game-card__cover');
    await expect(covers).toHaveCount(3);
    await expect(covers.nth(0)).toHaveAttribute('src', '/api/quizzes/q1/cover');
    await expect(covers.nth(1)).toHaveAttribute('src', 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    await expect(covers.nth(2)).toHaveAttribute('src', '/icons/logo.svg');
    // Transparència i capa per sota del text (el contingut es pinta per damunt).
    const style = await covers.nth(2).evaluate(el => {
        const s = getComputedStyle(el);
        return { opacity: s.opacity, zIndex: s.zIndex, position: s.position };
    });
    expect(style).toEqual({ opacity: '0.2', zIndex: '-1', position: 'absolute' });
    // El degradat (::after) i la portada no capten clics.
    await expect(page.locator('#game-list .game-card').nth(0).locator('.game-title')).toBeVisible();
    await page.locator('#game-list .game-card .game-title').nth(0).click({ trial: true });
});

test('biblioteca de /create/: el desplegable «Imagen de fondo» tiene 20 % por defecto y se guarda en la cuenta', async ({ page }) => {
    const state = {
        quizzes: [Object.assign(quiz('q1', 'Amb imatge', []), { coverImage: '/api/quizzes/q1/cover' }), quiz('q2', 'Sense res', [])],
        deleted: []
    };
    await stubBackend(page, state);
    await page.route('**/api/quizzes/q1/cover', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
    await page.goto('/create/?lang=es');

    const covers = page.locator('#game-list .game-card .game-card__cover');
    const select = page.locator('#library-cover-level');
    await expect(select.locator('option')).toHaveText(['Sin imagen', 'Imagen al 10 %', 'Imagen al 20 %', 'Imagen al 30 %']);
    await expect(select).toHaveValue('20');
    await expect(covers).toHaveCount(2);
    await expect(covers.nth(0)).toHaveCSS('opacity', '0.2');

    const patch = page.waitForRequest(r => r.url().includes('/api/auth/preferences') && r.method() === 'PATCH');
    await select.selectOption('30');
    expect((await patch).postDataJSON()).toEqual({ libraryCoverLevel: 30 });
    await expect(covers.nth(0)).toHaveCSS('opacity', '0.3');

    await select.selectOption('0');
    await expect(covers).toHaveCount(0);
});

// «Imagen de fondo» va justo sota del text de visibilitat, amb l'estil del selector d'elements per pàgina.
test('biblioteca de /create/: «Imagen de fondo» va just sota del texto de visibilidad, con el estilo del selector de página', async ({ page }) => {
    const state = { quizzes: [quiz('q1', 'Geografia', [])], deleted: [] };
    await stubBackend(page, state);
    await page.goto('/create/?lang=es');
    await expect(page.locator('#library-cover-level')).toBeVisible();
    await expect(page.locator('.filter-bar #library-cover-level')).toHaveCount(0);
    const help = await page.locator('.library-main p.subtext').boundingBox();
    const cover = await page.locator('.cover-pagination').boundingBox();
    expect(cover.y).toBeGreaterThanOrEqual(help.y + help.height - 1);
    expect(cover.y - (help.y + help.height)).toBeLessThanOrEqual(40);
    const styles = await page.evaluate(() => {
        const pageSize = getComputedStyle(document.querySelector('#library-page-size-top'));
        const cover = getComputedStyle(document.querySelector('#library-cover-level'));
        return { radius: cover.borderRadius === pageSize.borderRadius, weight: cover.fontWeight === pageSize.fontWeight };
    });
    expect(styles).toEqual({ radius: true, weight: true });
    // Alineada a la izquierda del text i amb text més petit que el selector d'elements per pàgina.
    const sub = await page.locator('.library-main p.subtext').boundingBox();
    const label = await page.locator('.cover-pagination .page-size').boundingBox();
    expect(Math.abs(label.x - sub.x)).toBeLessThanOrEqual(2);
    const sizes = await page.evaluate(() => ({
        cover: parseFloat(getComputedStyle(document.querySelector('.cover-pagination .page-size')).fontSize),
        pageSize: parseFloat(getComputedStyle(document.querySelector('#library-page-size-top').closest('.page-size')).fontSize)
    }));
    expect(sizes.cover).toBeLessThan(sizes.pageSize);
});

// Con «Sin imagen» no se pide ninguna portada ni miniatura de YouTube (el logo de la cabecera sí se carga, como siempre).
test('biblioteca de /create/: con «Sin imagen» no se descarga ninguna portada ni miniatura', async ({ page }) => {
    const state = {
        quizzes: [
            Object.assign(quiz('q1', 'Amb imatge', []), { coverImage: '/api/quizzes/q1/cover' }),
            Object.assign(quiz('q2', 'Amb vídeo', []), { coverVideo: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
        ],
        deleted: []
    };
    await stubBackend(page, state);
    await page.route('**/api/quizzes/q1/cover', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
    await page.route('https://img.youtube.com/**', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
    const imageRequests = [];
    page.on('request', req => { if (/\/cover$|img\.youtube\.com/.test(req.url())) imageRequests.push(req.url()); });
    await page.addInitScript(() => { try { localStorage.setItem('eduhoot-library-cover-level', '0'); } catch (e) {} });
    await page.goto('/create/?lang=es');
    await expect(page.locator('#game-list .game-card')).toHaveCount(2);
    await expect(page.locator('#library-cover-level')).toHaveValue('0');
    await expect(page.locator('#game-list .game-card__cover')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    expect(imageRequests).toEqual([]);
});
