const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Prova de concepte del mode fantasma (/dev/fantasma/): dues partides; la segona compara amb la primera.
async function answerAll(page, choices) {
    for (const n of choices) {
        await page.locator(`#answers [data-answer="${n}"]`).click();
        await expect(page.locator('#modal')).toHaveClass(/show/);
        if (choices.indexOf(n) === choices.length - 1) break;
        await page.locator('#m-ok').click();
    }
}

test('PoC fantasma: la primera partida fixa la marca i la segona mostra la diferència', async ({ page }) => {
    await page.goto('/dev/fantasma/');
    await expect(page.locator('#mark')).toContainText('Encara no hi ha cap marca');
    await page.locator('#start-btn').click();
    // 2 (París), 2 (Milà), 3 (4): totes correctes.
    await page.locator('#answers [data-answer="2"]').click();
    await expect(page.locator('#m-title')).toHaveText('Correcte!');
    await page.locator('#m-ok').click();
    await page.locator('#answers [data-answer="2"]').click();
    await page.locator('#m-ok').click();
    await page.locator('#answers [data-answer="3"]').click();
    await page.locator('#m-ok').click();
    await expect(page.locator('#result')).toBeVisible();
    await expect(page.locator('#ghost-result')).toHaveText('Nova millor marca!');
    await expect(page.locator('#mark')).toContainText('Millor marca guardada');

    // Partida 2: la primera pregunta s'erra (Roma). La diferència després de la pregunta és negativa.
    await page.locator('#again').click();
    await page.locator('#answers [data-answer="1"]').click();
    await expect(page.locator('#m-title')).toHaveText('Incorrecta');
    await expect(page.locator('#m-ghost')).toContainText('Fantasma: −');
    await page.locator('#m-ok').click();
    await page.locator('#answers [data-answer="2"]').click();
    await page.locator('#m-ok').click();
    await page.locator('#answers [data-answer="3"]').click();
    await page.locator('#m-ok').click();
    await expect(page.locator('#ghost-result')).toContainText('Millor marca:');
});

test('PoC fantasma: esborrar la marca la deixa en blanc', async ({ page }) => {
    await page.goto('/dev/fantasma/');
    await page.locator('#start-btn').click();
    await page.locator('#answers [data-answer="2"]').click();
    await page.locator('#m-ok').click();
    await page.locator('#answers [data-answer="2"]').click();
    await page.locator('#m-ok').click();
    await page.locator('#answers [data-answer="3"]').click();
    await page.locator('#m-ok').click();
    await expect(page.locator('#result')).toBeVisible();
    await page.reload();
    await expect(page.locator('#mark')).toContainText('Millor marca guardada');
    await page.locator('#reset-btn').click();
    await expect(page.locator('#mark')).toContainText('Encara no hi ha cap marca');
});
