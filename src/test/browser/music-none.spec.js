const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Selector de música amb l'opció «sense música» a la pantalla inicial de solo i al lobby de l'anfitrió.
const quiz = { id: 'm1', name: 'Música', tags: [], questions: [{ question: 'Quant és 2+2?', type: 'quiz', answers: ['3', '4', '5', '6'], correctAnswers: [2], time: 15 }] };

async function openSolo(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/quizzes/m1') return route.fulfill({ json: quiz });
        return route.fulfill({ json: [] });
    });
    await page.goto('/solo/?id=m1&lang=es');
    await expect(page.locator('#start-form')).toBeVisible();
}

test('Solo: la pantalla inicial tiene el selector de música con «Sin música», que se recuerda', async ({ page }) => {
    await openSolo(page);
    const select = page.locator('#solo-music-player .music-player__select');
    await expect(select.locator('option').first()).toHaveText('Sin música');
    // El selector va al formulario de inicio, no al pie de la página.
    await expect(page.locator('#start-form #solo-music-player')).toHaveCount(1);
    await expect(page.locator('.bottom-music')).toHaveCount(0);

    await select.selectOption('');
    await expect(page.locator('#solo-music-player .music-player__toggle')).toBeDisabled();
    expect(await page.evaluate(() => localStorage.getItem('eduhoot-solo-music'))).toBe('off');

    await page.reload();
    await expect(page.locator('#start-form')).toBeVisible();
    await expect(page.locator('#solo-music-player .music-player__select')).toHaveValue('');
    await expect(page.locator('#solo-music-player .music-player__toggle')).toBeDisabled();
});

test('Solo: al elegir una pista vuelve la música y el botón de reproducir se activa', async ({ page }) => {
    await openSolo(page);
    const select = page.locator('#solo-music-player .music-player__select');
    await select.selectOption('');
    await select.selectOption({ index: 1 });
    await expect(page.locator('#solo-music-player .music-player__toggle')).toBeEnabled();
    expect(await page.evaluate(() => localStorage.getItem('eduhoot-solo-music'))).not.toBe('off');
});

test('Solo: el ? del título de la música explica la opción', async ({ page }) => {
    await openSolo(page);
    await page.locator('.start-music__title .help-btn').click();
    await expect(page.locator('.start-music .help-pop')).toContainText('«Sin música» la desactiva');
});

test('Anfitrión: el lobby tiene el selector de música con «Sin música»', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ return { on: function(){}, emit: function(){}, connected: false }; };' }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.goto('/host/?lang=es');
    const select = page.locator('#host-lobby-music-player .music-player__select');
    await expect(select.locator('option').first()).toHaveText('Sin música');
});
