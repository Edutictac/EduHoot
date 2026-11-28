const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: 'window.testSocketEvents = {}; window.io = function(){ return {on: function(name, fn){window.testSocketEvents[name] = fn;}, emit: function(){}, disconnect: function(){}}; };'
    }));
    await page.route('**/api/**', route => route.fulfill({ json: { tags: [], quizzes: [], enabled: false } }));
});

// Botones CA VA ES EN y, a su derecha, un desplegable con el resto de idiomas.
const PRIMARY = ['ca', 'va', 'es', 'en'];
const MORE = ['fr', 'de', 'it', 'pt', 'bg', 'ar'];
const ALL = [...PRIMARY, ...MORE];

async function chooseLang(page, lang) {
    if (PRIMARY.includes(lang)) await page.locator(`#lang-switcher [data-lang="${lang}"]`).click();
    else await page.locator('#lang-switcher select.lang-more').selectOption(lang);
}

async function expectActiveLang(page, lang, scope = '#lang-switcher') {
    if (PRIMARY.includes(lang)) {
        await expect(page.locator(`${scope} [data-lang="${lang}"]`)).toHaveClass(/active/);
        await expect(page.locator(`${scope} select.lang-more`)).not.toHaveClass(/active/);
    } else {
        await expect(page.locator(`${scope} select.lang-more`)).toHaveValue(lang);
        await expect(page.locator(`${scope} select.lang-more`)).toHaveClass(/active/);
    }
}

for (const lang of ALL) {
    test(`${lang}: seleccio, recarrega i navegacio des de Commons`, async ({ page }) => {
        await page.goto('/inicio/?lang=va');
        await chooseLang(page, lang);
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        // El árabe escribe de derecha a izquierda: el documento cambia de sentido.
        await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
        await page.reload();
        await expectActiveLang(page, lang);
        await page.goto('/create/quiz-creator/');
        await expect(page.locator('#lang-select')).toHaveValue(lang);
        expect(await page.locator('#lang-select option').evaluateAll(options => options.map(option => option.value))).toEqual(ALL);
        const playLocal = { ca: 'Jugar sense desar', va: 'Jugar sense guardar', es: 'Jugar sin guardar', en: 'Play without saving', fr: 'Jouer sans enregistrer', de: 'Ohne Speichern spielen', it: 'Gioca senza salvare', pt: 'Jogar sem guardar', bg: 'Играй без запазване', ar: 'العب دون حفظ' };
        await expect(page.locator('[data-i18n="btnPlayLocal"]')).toHaveText(playLocal[lang]);
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

const LANG_CODES = ALL;
const LANG_NAMES = ['Català', 'Valencià', 'Español', 'English', 'Français', 'Deutsch', 'Italiano', 'Português', 'Български', 'العربية (المغرب)'];
const LANG_SHORT = ['CA', 'VA', 'ES', 'EN', 'FR', 'DE', 'IT', 'PT', 'BG', 'AR'];

for (const [route, selector, labels] of [
    ['/create/', '#lang-select', LANG_SHORT],
    ['/create/quiz-creator/', '#lang-select', LANG_SHORT],
    ['/create/partidas/', '#lang-select', LANG_SHORT],
    ['/create/homework/?quiz=7', '#lang-select', LANG_SHORT],
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

for (const [route, id] of [['/', 'promo-lang'], ['/inicio/', 'lang-switcher'], ['/join.html', 'lang-switcher']]) {
    test(`botons d'idioma de ${route}: llista comuna i botó actiu`, async ({ page }) => {
        for (const lang of LANG_CODES) {
            await page.goto(`${route}?lang=${lang}`);
            const buttons = page.locator(`#${id} button[data-lang]`);
            expect(await buttons.evaluateAll(els => els.map(el => el.textContent.trim()))).toEqual(['CA', 'VA', 'ES', 'EN']);
            // El resto de idiomas van en un desplegable a la derecha de los botones.
            expect(await page.locator(`#${id} select.lang-more option`).evaluateAll(o => o.map(x => x.value))).toEqual(['', ...MORE]);
            await expectActiveLang(page, lang, `#${id}`);
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
