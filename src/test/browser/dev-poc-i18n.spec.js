const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Las maquetas de /dev se pueden ver en los cuatro idiomas (ca, va, es, en).
const POCS = ['/dev/correspondencia/', '/dev/anfitrion/'];
const LANGS = ['ca', 'va', 'es', 'en'];

for (const url of POCS) {
    test(`${url}: se ve en los cuatro idiomas, sin claves sin traducir`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', (err) => errors.push(err.message));
        const titles = new Set();
        for (const lang of LANGS) {
            await page.goto(`${url}?lang=${lang}`);
            await page.waitForSelector('#stage > *');
            titles.add(await page.locator('h1').textContent());
            const text = await page.locator('body').innerText();
            // Una clave sin traducir se vería tal cual (p. ej. «tip_send», «notes_student»).
            expect(text, lang).not.toMatch(/\b(tip_[a-zA-Z]+|notes_[a-z]+|opt[A-Z][a-zA-Z]+)\b/);
            expect(await page.locator('html').getAttribute('lang')).toBe(lang === 'va' ? 'ca-valencia' : lang);
        }
        // es, ca y en tienen textos distintos (va comparte el título con ca).
        expect(titles.size).toBeGreaterThanOrEqual(3);
        expect(errors).toEqual([]);
    });

    test(`${url}: el selector de idioma cambia los textos`, async ({ page }) => {
        await page.goto(`${url}?lang=es`);
        await page.waitForSelector('#stage > *');
        const before = await page.locator('h1').textContent();
        await page.selectOption('#poc-lang', 'en');
        await expect(page.locator('h1')).not.toHaveText(before);
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
}
