const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Red de seguridad per a passar /admin-stats.html a Vue: fixa les targetes,
// el desglossament, els errors i el botó d'entrada de reserva.

const STATS = {
    totalQuizzes: 12, totalQuestions: 140, totalPlays: 33, totalPlayers: 0, avgQuestionsPerQuiz: 11.7,
    liveGames: 2, livePlayers: 9,
    visibilityCounts: { public: 7, private: 5 },
    ephemeral: { totalQuizzes: 3, totalQuestions: 21 }
};

async function openStats(page, options = {}) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/auth/me') return options.user ? route.fulfill({ json: options.user }) : route.fulfill({ status: 401, json: {} });
        if (pathname === '/api/auth/authentik/config') return route.fulfill({ json: { enabled: !!options.authentik } });
        if (pathname === '/api/admin/stats') return route.fulfill(options.stats || { json: { data: STATS } });
        if (pathname === '/api/auth/authentik/start') return route.fulfill({ contentType: 'text/html', body: '<p>login</p>' });
        return route.fulfill({ json: {} });
    });
    await page.goto('/admin-stats.html' + (options.query || ''));
    await page.waitForLoadState('load');
}

test('pinta las 8 tarjetas con sus valores y el desglose', async ({ page }) => {
    await openStats(page, { user: { id: 'a', role: 'admin' } });
    const cards = page.locator('#cards .card');
    await expect(cards).toHaveCount(8);
    await expect(cards.locator('h3')).toHaveText([
        'Total de quizzes', 'Preguntas totales', 'Partidas jugadas', 'Jugadores totales',
        'Promedio de preguntas', 'Partidas activas', 'Jugadores activos', 'Quizzes efímeros'
    ]);
    await expect(cards.locator('.value')).toHaveText(['12', '140', '33', '0', '11.7', '2', '9', '3']);
    await expect(cards.locator('.sub')).toHaveText(['Todos', 'Contenido', 'Histórico', 'Histórico', 'Media', 'En vivo', 'En vivo', 'Local']);

    const panels = page.locator('#breakdown .panel');
    await expect(panels.locator('h4')).toHaveText(['Visibilidad', 'Quizzes efímeros']);
    await expect(panels.nth(0).locator('li')).toHaveText(['public7', 'unlisted0', 'private5']);
    await expect(panels.nth(1).locator('li')).toHaveText(['Quizzes3', 'Preguntas21']);
    await expect(page.locator('#stats-error')).toHaveText('');
});

test('sin rol admin (403) lo explica', async ({ page }) => {
    await openStats(page, { user: { id: 'u' }, stats: { status: 403, json: { error: 'no' } } });
    await expect(page.locator('#stats-error')).toHaveText('Tu cuenta está autenticada, pero no tiene rol admin.');
    await expect(page.locator('#cards .card')).toHaveCount(0);
});

test('sin sesión (401) pide entrar y, con Authentik, enseña el botón de reserva', async ({ page }) => {
    await openStats(page, { authentik: true, stats: { status: 401, json: {} } });
    await expect(page.locator('#stats-error')).toHaveText('Necesitas iniciar sesión para ver estadísticas.');
    await expect(page.locator('#login-fallback')).toBeVisible();
    await page.locator('#login-fallback').click();
    await page.waitForURL('**/api/auth/authentik/start?*');
    expect(new URL(page.url()).searchParams.get('next')).toBe('/admin-stats.html');
});

test('otro error o respuesta incompleta da el mensaje genérico', async ({ page }) => {
    await openStats(page, { user: { id: 'a' }, stats: { json: {} } });
    await expect(page.locator('#stats-error')).toHaveText('No se pudieron cargar las estadísticas. ¿Tienes sesión de admin iniciada?');
});

test('con sesión o sin Authentik el botón de reserva no se ve', async ({ page }) => {
    await openStats(page, { user: { id: 'a' }, authentik: true });
    await expect(page.locator('#cards .card')).toHaveCount(8);
    await expect(page.locator('#login-fallback')).toBeHidden();
});

test('sin Authentik activado tampoco se ve el botón', async ({ page }) => {
    await openStats(page, { stats: { status: 401, json: {} } });
    await expect(page.locator('#stats-error')).toHaveText('Necesitas iniciar sesión para ver estadísticas.');
    await expect(page.locator('#login-fallback')).toBeHidden();
});

test('al volver de Authentik con error lo dice y limpia la URL', async ({ page }) => {
    await openStats(page, { query: '?authentik=error&x=1' });
    await expect(page.locator('#login-status')).toHaveText('No se pudo completar el acceso con EduTicTac. Inténtalo de nuevo.');
    expect(new URL(page.url()).search).toBe('?x=1');
});

test('enlaza con el panel de logs', async ({ page }) => {
    await openStats(page, { user: { id: 'a', role: 'admin' } });
    await expect(page.locator('.admin-nav a')).toHaveText('Logs del servidor →');
    await expect(page.locator('.admin-nav a')).toHaveAttribute('href', '/admin/logs');
});
