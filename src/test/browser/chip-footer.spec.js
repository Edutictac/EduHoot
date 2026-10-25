const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

const PAGES = ['/', '/join.html', '/solo/', '/create/', '/multiplayer/', '/host/', '/player/'];

const SOCKET_STUB = 'window.testSocketEvents = {}; window.io = function(){ return {on: function(name, fn){window.testSocketEvents[name] = fn;}, emit: function(){}, disconnect: function(){}, connect: function(){}}; };';

async function stubBase(page) {
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: SOCKET_STUB
    }));
    await page.route('**/api/**', route => route.fulfill({ json: route.request().url().endsWith('/api/version')
        ? { version: '9.9.9' }
        : { tags: [], quizzes: [], enabled: false, top: [] } }));
}

async function stubCommons(page) {
    await page.route('https://commons.edutictac.es/assets/account-widget.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: `customElements.define('edutictac-account', class extends HTMLElement {
            connectedCallback() {
                this.innerHTML = '<nav class="eta"><a class="eta-home" href="https://edutictac.es/">Inici</a><span class="eta-name">Compte</span></nav>';
            }
        });`
    }));
}

test.describe('peu comú', () => {
    for (const path of PAGES) {
        test(`${path}: el peu comú és visible`, async ({ page }) => {
            await page.route(/^https:\/\//, route => route.abort());
            await stubBase(page);
            await page.goto(path);

            const footer = page.locator('footer.ett-footer');
            await expect(footer).toBeVisible();
            await expect(footer.locator('.ett-footer__brand')).toHaveText('EduTicTac');
            await expect(footer.locator('.ett-footer__service')).toHaveText('EduHoot');
            await expect(footer.locator('a[href="https://edutictac.es/privacitat.html"]')).toBeVisible();
            await expect(footer.locator('a[href$="/LICENSE"]')).toBeVisible();
            await expect(footer.locator('#app-version')).toHaveText('v9.9.9');
        });
    }
});

test.describe('xip de compte', () => {
    test('amb Commons, el xip substitueix el selector propi i canvia l’idioma', async ({ page }) => {
        await page.route(/^https:\/\//, route => route.abort());
        await stubBase(page);
        await stubCommons(page);
        await page.goto('/create/?lang=es');

        await expect(page.locator('html')).toHaveClass(/has-account-chip/);
        await expect(page.locator('html')).toHaveAttribute('lang', 'es');
        await expect(page.locator('edutictac-account')).toBeVisible();
        await expect(page.locator('.top-actions .lang-switch')).toBeHidden();
        await expect(page.locator('#lang-select')).toHaveValue('es');

        expect(await page.evaluate(() => window.edutictacLanguage.languages)).toEqual(['ca', 'va', 'es', 'en']);
        expect(await page.evaluate(() => window.edutictacLanguage.get())).toBe('es');

        await page.evaluate(() => window.edutictacLanguage.set('va'));
        await expect(page.locator('#lang-select')).toHaveValue('va');
        await expect(page.locator('html')).toHaveAttribute('lang', 'ca-ES-valencia');
    });

    test('sense Commons, es mostra el selector propi i el xip queda amagat', async ({ page }) => {
        await page.route(/^https:\/\//, route => route.abort());
        await stubBase(page);
        await page.goto('/create/?lang=es');

        await expect(page.locator('html')).toHaveClass(/account-fallback/);
        await expect(page.locator('.top-actions .lang-switch')).toBeVisible();
        await expect(page.locator('edutictac-account')).toBeHidden();
    });

    for (const path of ['/join.html', '/player/', '/solo/', '/multiplayer/']) {
        test(`${path}: alumnat i joc públic només tenen «Inici» i conserven el selector propi`, async ({ page }) => {
            await page.route(/^https:\/\//, route => route.abort());
            await stubBase(page);
            await stubCommons(page);
            await page.goto(path);

            await expect(page.locator('edutictac-account')).toHaveAttribute('data-home-only', '');
            await expect(page.locator('html')).toHaveClass(/account-home-only/);
            await expect(page.locator('#lang-switcher, .lang-switch').first()).toBeVisible();
        });
    }
});
