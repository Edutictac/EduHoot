const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Prova de concepte d'ordenar (feature 7): /dev/ordenar/. Usa el component real (orderBoard.js).
// La maqueta exposa l'estat a window.orderPoc per conèixer la solució.
const URL = '/dev/ordenar/';

const solution = (page) => page.evaluate(() => window.orderPoc.state.solution.slice());
const texts = (page) => page.locator('.order-item .order-text').allTextContents();

// Porta cada element a la seua posició correcta amb les fletxes ▲.
async function arrangeCorrectly(page) {
    const sol = await solution(page);
    for (let k = 0; k < sol.length; k++) {
        const list = await texts(page);
        const p = list.indexOf(sol[k]);
        for (let step = p; step > k; step--) {
            await page.locator('.order-item').nth(step).locator('button').first().click();
        }
    }
}

test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.__errors = errors;
    await page.goto(URL);
    await expect(page.locator('.order-item').first()).toBeVisible();
});

test.afterEach(async ({ page }) => {
    expect(page.__errors).toEqual([]);
});

test('carrega cinc preguntes i mostra tots els elements, barrejats', async ({ page }) => {
    await expect(page.locator('#progress')).toHaveText('Pregunta 1 de 5');
    const sol = await solution(page);
    const list = await texts(page);
    expect(list).toHaveLength(sol.length);
    expect([...list].sort()).toEqual([...sol].sort());
    expect(list).not.toEqual(sol);
});

test('les fletxes reordenen la llista', async ({ page }) => {
    const before = await texts(page);
    await page.locator('.order-item').nth(0).locator('button').nth(1).click();
    const after = await texts(page);
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);
});

test('arrossegar un element el mou a una altra posició', async ({ page }) => {
    const before = await texts(page);
    await page.locator('.order-item').nth(2).dragTo(page.locator('.order-item').nth(0));
    const after = await texts(page);
    expect(after[0]).toBe(before[2]);
});

test('l\'ordre correcte es puntua com a correcte', async ({ page }) => {
    await arrangeCorrectly(page);
    expect(await texts(page)).toEqual(await solution(page));
    await page.locator('.order-submit').click();
    await expect(page.locator('#result')).toHaveText('Correcta');
});

test('un ordre incorrecte mostra quants elements són a la posició correcta', async ({ page }) => {
    await page.locator('.order-submit').click();
    await expect(page.locator('#result')).toHaveText(/Incorrecta: \d+ de \d+ en su posición/);
});

test('la pregunta següent canvia l\'enunciat i reinicia la llista', async ({ page }) => {
    const first = await page.locator('#question').textContent();
    await page.locator('#next').click();
    await expect(page.locator('#progress')).toHaveText('Pregunta 2 de 5');
    await expect(page.locator('#question')).not.toHaveText(first);
    await expect(page.locator('#result')).toHaveText('');
});
