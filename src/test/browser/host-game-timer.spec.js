const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

test.beforeEach(async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: 'window.testSocketEvents = {}; window.io = function(){ return {on: function(name, fn){window.testSocketEvents[name] = fn;}, emit: function(){}, disconnect: function(){}}; };'
    }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
});

function showQuestion(page, number) {
    return page.evaluate(n => window.testSocketEvents.gameQuestions({
        q1: 'Pregunta ' + n, a1: 'A', a2: 'B', a3: 'C', a4: 'D',
        questionNumber: n, totalQuestions: 2, playersInGame: 2, time: 8
    }), number);
}

// Issue #21: el temporizador del anfitrión no se repintaba hasta el primer
// segundo. Empezaba mostrando el «20» del HTML (o el valor de la pregunta
// anterior), y si todos respondían enseguida se quedaba así.
test('el temporizador muestra el tiempo de la pregunta en cuanto llega', async ({ page }) => {
    await page.goto('/host/game/?id=test&pin=12345&lang=es');

    await showQuestion(page, 1);
    await expect(page.locator('#num')).toHaveText('8', { timeout: 900 });
    await expect(page.locator('#num')).toHaveText('7');

    await showQuestion(page, 2);
    await expect(page.locator('#num')).toHaveText('8', { timeout: 900 });
});
