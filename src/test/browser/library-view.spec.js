const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Biblioteca: vista de targetes (per defecte) o de detall; la tria es recorda al navegador.
const quizzes = Array.from({ length: 3 }, (_, i) => ({
    id: 'v' + i, name: 'Quiz ' + i, tags: [], visibility: 'public', allowClone: true,
    questionCount: 4 + i, playsCount: i, playersCount: i * 2, createdAt: '2026-10-0' + (i + 1) + 'T00:00:00Z', ownerNickname: 'Teacher'
}));

async function open(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io=function(){return {on:function(){},emit:function(){},disconnect:function(){},connect:function(){}};};' }));
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/quizzes') return route.fulfill({ json: quizzes });
        if (pathname === '/api/tags') return route.fulfill({ json: [] });
        return route.fulfill({ json: { enabled: false } });
    });
    await page.goto('/create/?lang=es');
}

test('biblioteca: por defecto en tarjetas; el selector Detalle muestra una tabla con las mismas acciones', async ({ page }) => {
    await open(page);
    await expect(page.locator('#game-list .game-card')).toHaveCount(3);
    await expect(page.locator('#libDetail')).toHaveCount(0);
    await page.locator('#libViewDetail').click();
    await expect(page.locator('#libDetail tbody tr')).toHaveCount(3);
    await expect(page.locator('#game-list')).toHaveCount(0);
    // Las mismas acciones que en la tarjeta (jugar, editar…).
    await expect(page.locator('#libDetail tbody tr').first().locator('button[aria-label]').first()).toBeVisible();
    await page.locator('#libViewCards').click();
    await expect(page.locator('#game-list .game-card')).toHaveCount(3);
});

test('biblioteca: la vista elegida se recuerda al recargar', async ({ page }) => {
    await open(page);
    await page.locator('#libViewDetail').click();
    await page.reload();
    await expect(page.locator('#libDetail tbody tr')).toHaveCount(3);
    await expect(page.locator('#libViewDetail')).toHaveAttribute('aria-pressed', 'true');
});
