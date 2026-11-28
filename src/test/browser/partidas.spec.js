const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Mis partidas: historial de la cuenta (GET /api/partidas) y el enlace desde la biblioteca.
const TEACHER = { id: 'teacher-1', email: 'teacher@example.invalid', role: 'editor', nickname: 'Teacher' };
const GAMES = [
    { id: 'g1', pin: '24423', quizId: '71', quizName: 'Supervivencia digital', mode: 'selfPaced', playersCount: 2, finishedAt: '2026-11-26T01:06:22.739Z', expiresAt: '2026-02-24T01:06:22.739Z' },
    { id: 'g2', pin: '44938', quizId: '70', quizName: 'Informática básica', mode: 'live', playersCount: 1, finishedAt: '2026-11-25T23:58:15.764Z', expiresAt: '2026-02-23T23:58:15.764Z' }
];

async function stubBackend(page, { loggedIn }) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io=function(){return {on:function(){},emit:function(){},disconnect:function(){},connect:function(){}};};' }));
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/auth/me') return loggedIn ? route.fulfill({ json: TEACHER }) : route.fulfill({ status: 401, json: { error: 'No autorizado' } });
        if (pathname === '/api/partidas') return route.fulfill({ json: GAMES });
        if (pathname === '/api/tags') return route.fulfill({ json: [] });
        return route.fulfill({ json: {} });
    });
}

test('Mis partidas: con sesión, lista las partidas con su modo y el enlace al CSV', async ({ page }) => {
    await stubBackend(page, { loggedIn: true });
    await page.addInitScript(() => localStorage.setItem('eduhoot-view-partidas', 'detail'));
    await page.goto('/create/partidas/?lang=es');
    const rows = page.locator('#ptGames tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('td').nth(0)).toHaveText('Supervivencia digital');
    await expect(rows.nth(0).locator('.pt-badge')).toHaveText('A su ritmo');
    await expect(rows.nth(1).locator('.pt-badge')).toHaveText('En directo');
    await expect(rows.nth(0).locator('.pt-csv')).toHaveAttribute('href', '/api/partidas/g1/report.csv');
    await expect(page.locator('#ptPageTitle')).toContainText('Mis partidas');
});

test('Mis partidas: sin sesión, pide iniciar sesión y no muestra partidas', async ({ page }) => {
    await stubBackend(page, { loggedIn: false });
    await page.goto('/create/partidas/?lang=es');
    await expect(page.locator('#ptNeedLogin')).toBeVisible();
    await expect(page.locator('#ptGames')).toHaveCount(0);
});

test('biblioteca: «Mis partidas» aparece junto a «Mis deberes» solo con sesión', async ({ page }) => {
    await stubBackend(page, { loggedIn: true });
    await page.goto('/create/?lang=es');
    await expect(page.locator('#my-games')).toBeVisible();
    await expect(page.locator('#my-games')).toHaveText('Partidas');
    await expect(page.locator('#my-games')).toHaveAttribute('href', 'partidas/');

    await page.unroute('**/api/**');
    await stubBackend(page, { loggedIn: false });
    await page.goto('/create/?lang=es');
    await expect(page.locator('#my-games')).toBeHidden();
});

test('Mis partidas: con muchas partidas, el paginador reparte las filas y la página no hace scroll', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('eduhoot-view-partidas', 'detail'));
    const many = Array.from({ length: 30 }, (_, i) => ({ ...GAMES[0], id: 'm' + i, pin: String(10000 + i) }));
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io=function(){return {on:function(){},emit:function(){},disconnect:function(){},connect:function(){}};};' }));
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/auth/me') return route.fulfill({ json: TEACHER });
        if (pathname === '/api/partidas') return route.fulfill({ json: many });
        return route.fulfill({ json: [] });
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/create/partidas/?lang=es');
    await expect(page.locator('#ptGames tbody tr').first()).toBeVisible();
    const rows = await page.locator('#ptGames tbody tr').count();
    expect(rows).toBeLessThan(30);
    await expect(page.locator('#ptNext')).toBeEnabled();
    await page.locator('#ptNext').click();
    await expect(page.locator('#ptPageInfo')).toHaveValue('2');
    const fits = await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.getElementById('lpArea').scrollHeight <= document.getElementById('lpArea').clientHeight + 1);
    expect(fits).toBe(true);
});

test('Mis partidas: borrar una partida con dos clics (emoticona amb títol), i desapareix del llistat', async ({ page }) => {
    let list = GAMES.map(g => ({ ...g }));
    const deleted = [];
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io=function(){return {on:function(){},emit:function(){},disconnect:function(){},connect:function(){}};};' }));
    await page.route('**/api/**', route => {
        const req = route.request();
        const { pathname } = new URL(req.url());
        if (pathname === '/api/auth/me') return route.fulfill({ json: TEACHER });
        if (pathname === '/api/partidas' && req.method() === 'GET') return route.fulfill({ json: list });
        if (pathname.startsWith('/api/partidas/') && req.method() === 'DELETE') {
            const id = pathname.split('/')[3];
            deleted.push(id);
            list = list.filter(g => g.id !== id);
            return route.fulfill({ json: { ok: true } });
        }
        return route.fulfill({ json: [] });
    });
    await page.addInitScript(() => localStorage.setItem('eduhoot-view-partidas', 'detail'));
    await page.goto('/create/partidas/?lang=es');
    const btn = page.locator('#ptGames tbody tr').first().locator('.pt-delete-btn');
    await expect(btn).toHaveAttribute('title', 'Borrar');
    await btn.click();
    await expect(btn).toHaveClass(/is-confirming/);
    expect(deleted).toEqual([]);
    await btn.click();
    await expect(page.locator('#ptGames tbody tr')).toHaveCount(GAMES.length - 1);
    expect(deleted).toEqual(['g1']);
});
