const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Biblioteca: con los botones debajo del título, el subtítulo está de ellos a la misma distancia que del título en pantalla ancha.
async function gaps(page, width) {
    await page.setViewportSize({ width, height: 800 });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { tags: [], quizzes: [] } }));
    await page.goto('/create/?lang=es');
    await expect(page.locator('#subtitle')).toBeVisible();
    return page.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect();
        const t = r('#title'), a = r('.top-actions'), s = r('#subtitle');
        return { titleToSub: s.top - t.bottom, actionsToSub: s.top - a.bottom, stacked: a.top >= t.bottom - 1 };
    });
}

test('subtítulo: distancia a los botones (debajo del título) igual que al título en ancho', async ({ browser }) => {
    const wide = await (async () => { const p = await browser.newPage(); const g = await gaps(p, 1400); await p.close(); return g; })();
    expect(wide.stacked).toBe(false);
    for (const width of [900, 700, 360]) {
        const p = await browser.newPage();
        const narrow = await gaps(p, width);
        await p.close();
        expect(narrow.stacked, `${width}px: botones bajo el título`).toBe(true);
        expect(Math.abs(narrow.actionsToSub - wide.titleToSub), `${width}px`).toBeLessThanOrEqual(1);
    }
});
