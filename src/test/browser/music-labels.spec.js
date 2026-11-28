const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Los botones de música deben seguir en el idioma elegido al pulsar reproducir o pausar.
test('anfitrión: el botón de música sigue traducido al pulsar reproducir', async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ var s = { id: "h", connected: false, on: function(){ return s; }, emit: function(){ return s; }, connect: function(){ return s; }, disconnect: function(){ return s; } }; return s; };' }));
    await page.goto('/host/game/?id=g1&pin=12345&lang=es');
    await page.waitForLoadState('load');
    const toggle = page.locator('#host-music-player .music-player__toggle');
    await expect(toggle).toHaveText('Reproducir música');
    // Al pulsar, el botón cambia a «Pausar música» (en el idioma elegido, no en inglés).
    await page.evaluate(() => { hostMusicPlayerInstance.play(); });
    await expect(toggle).toHaveText('Pausar música', { timeout: 5000 });
    await expect(toggle).not.toHaveText('Pause music');
});
