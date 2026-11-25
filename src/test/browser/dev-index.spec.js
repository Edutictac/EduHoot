const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Índex de /dev/: enllaça l'entrada de desenvolvement i les proves de concepte, i totes responen.
test('/dev/ mostra l\'entrada de desenvolvement i totes les proves de concepte', async ({ page, request }) => {
    await page.goto('/dev/');
    await expect(page.locator('h1')).toHaveText('Entorno de desarrollo');
    const links = page.locator('a.card');
    await expect(links).toHaveCount(5);
    const hrefs = await links.evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    expect(hrefs).toContain('/dev/login');
    for (const href of hrefs.filter((h) => h !== '/dev/login')) {
        const res = await request.get(new URL(href, page.url()).toString());
        expect(res.status(), href).toBe(200);
    }
});
