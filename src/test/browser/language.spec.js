const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
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

const LANG_CODES = ['ca', 'va', 'es', 'en'];
const LANG_NAMES = ['Català', 'Valencià', 'Español', 'English'];
const LANG_SHORT = ['CA', 'VA', 'ES', 'EN'];

for (const [route, selector, labels] of [
    ['/create/', '#lang-select', LANG_NAMES],
    ['/create/quiz-creator/', '#lang-select', LANG_NAMES],
    ['/host/', '#host-lang-select', LANG_NAMES],
    ['/host/game/?id=test&pin=12345', '#lang-select', LANG_NAMES],
    ['/solo/', '#lang-select', LANG_SHORT],
    ['/multiplayer/', '#lang-select', LANG_SHORT]
]) {
    test(`desplegable d'idiomes de ${route}: llista comuna, noms natius en tots els idiomes`, async ({ page }) => {
        for (const lang of LANG_CODES) {
            await page.goto(`${route}${route.includes('?') ? '&' : '?'}lang=${lang}`);
            const options = page.locator(`${selector} option`);
            expect(await options.evaluateAll(els => els.map(el => el.value))).toEqual(LANG_CODES);
            expect(await options.evaluateAll(els => els.map(el => el.textContent.trim()))).toEqual(labels);
            await expect(page.locator(selector)).toHaveValue(lang);
        }
    });
}

for (const route of ['/', '/join.html']) {
    test(`botons d'idioma de ${route}: llista comuna i botó actiu`, async ({ page }) => {
        for (const lang of LANG_CODES) {
            await page.goto(`${route}?lang=${lang}`);
            const buttons = page.locator('#lang-switcher button[data-lang]');
            expect(await buttons.evaluateAll(els => els.map(el => el.textContent.trim()))).toEqual(LANG_SHORT);
            await expect(page.locator(`#lang-switcher [data-lang="${lang}"]`)).toHaveClass(/active/);
        }
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
