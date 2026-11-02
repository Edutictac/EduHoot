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
