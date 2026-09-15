const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    await page.route('https://**', route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: 'window.testSocketEvents = {}; window.io = function(){ return {on: function(name, fn){window.testSocketEvents[name] = fn;}, emit: function(){}, disconnect: function(){}}; };'
    }));
    await page.route('**/api/**', route => route.fulfill({ json: { tags: [], quizzes: [], enabled: false } }));
});

for (const lang of ['ca', 'va', 'es', 'en']) {
    test(`${lang}: seleccio, recarrega i navegacio des de Commons`, async ({ page }) => {
        await page.goto('/?lang=va');
        await page.locator(`[data-lang="${lang}"]`).click();
        await expect(page.locator(`[data-lang="${lang}"]`)).toHaveClass(/active/);
        await page.reload();
        await expect(page.locator(`[data-lang="${lang}"]`)).toHaveClass(/active/);
        await page.goto('/create/quiz-creator/');
        await expect(page.locator('#lang-select')).toHaveValue(lang);
        expect(await page.locator('#lang-select option').evaluateAll(options => options.map(option => option.value))).toEqual(['ca', 'va', 'es', 'en']);
        const expected = lang === 'en' ? ['True', 'False'] : lang === 'es' ? ['Verdadero', 'Falso'] : ['Cert', 'Fals'];
        expect(await page.evaluate(() => getTfFallbackAnswers())).toEqual(expected);
    });

    test(`${lang}: joc renderitza preguntes i respostes sense errors`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`/host/game/?id=test&pin=12345&lang=${lang}`);
        await expect(page.locator('#lang-select')).toHaveValue(lang);
        await page.evaluate(() => {
            window.testSocketEvents.gameQuestions({
                q1: 'Prova', a1: 'A', a2: 'B', a3: 'C', a4: 'D',
                questionNumber: 1, totalQuestions: 3, playersInGame: 2, time: 20
            });
            window.testSocketEvents.updatePlayersAnswered({ playersAnswered: 1, playersInGame: 2 });
        });
        await expect(page.locator('#questionNum')).toContainText('1 / 3');
        await expect(page.locator('#question')).toHaveText('Prova');
        await expect(page.locator('#playersAnswered')).toContainText('1 / 2');
        expect(errors).toEqual([]);
    });
}

for (const route of ['/create/', '/create/quiz-creator/', '/solo/', '/multiplayer/', '/host/game/?id=test&pin=12345']) {
    test(`canvi VA a EN persistent: ${route}`, async ({ page }) => {
        await page.goto(`${route}${route.includes('?') ? '&' : '?'}lang=va`);
        await page.locator('#lang-select').selectOption('en');
        await page.reload();
        await expect(page.locator('#lang-select')).toHaveValue('en');
        expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
    });
}
