const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Prueba de concepto de la pregunta de correspondencia (feature 7): /dev/correspondencia/.
// La maqueta expone su estado en window.matchingPoc para conocer la solución.
const URL = '/dev/correspondencia/';

async function solution(page) {
    return page.evaluate(() => window.matchingPoc.state.game.solution.slice());
}

async function pair(page, left, right) {
    await page.locator(`[data-left="${left}"]`).click();
    await page.locator(`[data-right="${right}"]`).click();
}

test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.__errors = errors;
    await page.goto(URL);
});

test.afterEach(async ({ page }) => {
    expect(page.__errors).toEqual([]);
});

test('por defecto: 5 parejas a la izquierda y 7 elementos a la derecha (2 impostoras)', async ({ page }) => {
    await expect(page.locator('[data-left]')).toHaveCount(5);
    await expect(page.locator('[data-right]')).toHaveCount(7);
    await expect(page.locator('.send')).toBeDisabled();
});

test('tocar izquierda y luego derecha forma una pareja; tocarla otra vez la deshace', async ({ page }) => {
    await pair(page, 0, 3);
    const left = page.locator('[data-left="0"]');
    const right = page.locator('[data-right="3"]');
    await expect(left).toHaveClass(/paired/);
    await expect(left.locator('.tag')).toHaveText('D');
    await expect(right.locator('.tag')).toHaveText('1');
    await expect(page.locator('.count')).toHaveText('1 de 5 emparejadas');
    await expect(page.locator('.send')).toBeEnabled();

    await page.locator('[data-right="3"]').click();
    await expect(page.locator('[data-left="0"]')).not.toHaveClass(/paired/);
    await expect(page.locator('.count')).toHaveText('0 de 5 emparejadas');
});

test('también se empareja empezando por la derecha, y cada derecha solo vale para una pareja', async ({ page }) => {
    await page.locator('[data-right="2"]').click();
    await page.locator('[data-left="1"]').click();
    await expect(page.locator('[data-left="1"] .tag')).toHaveText('C');

    await pair(page, 0, 2);
    await expect(page.locator('[data-left="0"] .tag')).toHaveText('C');
    await expect(page.locator('[data-left="1"]')).not.toHaveClass(/paired/);
});

test('resultado: verde si todo está bien', async ({ page }) => {
    const sol = await solution(page);
    for (let i = 0; i < sol.length; i++) await pair(page, i, sol[i]);
    await page.locator('.send').click();
    const result = page.locator('.result');
    await expect(result).toHaveAttribute('data-kind', 'correct');
    await expect(result).toHaveCSS('background-color', 'rgb(76, 175, 80)');
    await expect(result.locator('.sub')).toHaveText('5 de 5 parejas');
});

test('resultado: naranja si solo algunas están bien, con la corrección', async ({ page }) => {
    const sol = await solution(page);
    await pair(page, 0, sol[0]);
    await pair(page, 1, sol[1]);
    await page.locator('.send').click();
    const result = page.locator('.result');
    await expect(result).toHaveAttribute('data-kind', 'partial');
    await expect(result).toHaveCSS('background-color', 'rgb(245, 124, 0)');
    await expect(result.locator('.sub')).toHaveText('2 de 5 parejas');
    await expect(result.locator('.review .row')).toHaveCount(5);
});

test('resultado: rojo si ninguna está bien; sin «Mostrar respuestas» no hay corrección', async ({ page }) => {
    await page.locator('#opt-show').uncheck();
    const { sol, rightCount } = await page.evaluate(() => ({
        sol: window.matchingPoc.state.game.solution.slice(),
        rightCount: window.matchingPoc.state.game.right.length
    }));
    // Una derecha que no es la solución de la pareja 0.
    const wrong = [...Array(rightCount).keys()].find((r) => r !== sol[0]);
    await pair(page, 0, wrong);
    await page.locator('.send').click();
    const result = page.locator('.result');
    await expect(result).toHaveAttribute('data-kind', 'incorrect');
    await expect(result).toHaveCSS('background-color', 'rgb(249, 74, 30)');
    await expect(result.locator('.review')).toHaveCount(0);
});

test('cambiar a 8 parejas deja 0 impostoras como máximo', async ({ page }) => {
    await page.locator('#opt-pairs').selectOption('8');
    await expect(page.locator('#opt-imp option')).toHaveCount(1);
    await expect(page.locator('[data-left]')).toHaveCount(8);
    await expect(page.locator('[data-right]')).toHaveCount(8);
});

async function blind(page, style) {
    await page.locator('#opt-blind').selectOption(style);
    await page.locator('.tab[data-view="blind"]').click();
    await expect(page.locator('[data-left]')).toHaveCount(0);
    await expect(page.locator('.txt')).toHaveCount(0);
}

test('a ciegas, desplegables: una letra por número; elegir una usada la mueve', async ({ page }) => {
    await blind(page, 'select');
    await expect(page.locator('[data-bsel]')).toHaveCount(5);
    await page.locator('#bsel-0').selectOption('2');
    await expect(page.locator('#bsel-1 option[value="2"]')).toHaveText('C (ahora en el 1)');
    await page.locator('#bsel-1').selectOption('2');
    await expect(page.locator('#bsel-1')).toHaveValue('2');
    await expect(page.locator('#bsel-0')).toHaveValue('');
    await expect(page.locator('.count')).toHaveText('1 de 5 emparejadas');
});

test('a ciegas, toques con códigos: mismo gesto que con texto', async ({ page }) => {
    await blind(page, 'codes');
    await page.locator('[data-bleft="0"]').click();
    await page.locator('[data-bright="3"]').click();
    await expect(page.locator('[data-bleft="0"] .tag')).toHaveText('D');
    await expect(page.locator('[data-bright="3"] .tag')).toHaveText('1');
    await expect(page.locator('.count')).toHaveText('1 de 5 emparejadas');
});

test('a ciegas, paso a paso: al elegir pasa al siguiente número y se puede volver', async ({ page }) => {
    await blind(page, 'steps');
    await expect(page.locator('.step-now')).toContainText('1');
    await page.locator('[data-bstep="1"]').click();
    await expect(page.locator('.step-now')).toContainText('2');
    await expect(page.locator('[data-bgo="0"]')).toHaveText('1 → B');

    await page.locator('[data-bgo="0"]').click();
    await page.locator('[data-bstep="4"]').click();
    await expect(page.locator('[data-bgo="0"]')).toHaveText('1 → E');
    await expect(page.locator('.count')).toHaveText('1 de 5 emparejadas');
});

test('a ciegas: enviar todo bien da verde', async ({ page }) => {
    await blind(page, 'select');
    const sol = await solution(page);
    for (let i = 0; i < sol.length; i++) await page.locator(`#bsel-${i}`).selectOption(String(sol[i]));
    await page.locator('.send').click();
    await expect(page.locator('.result')).toHaveAttribute('data-kind', 'correct');
});

test('proyector y resultados: la solución y las impostoras solo con «Mostrar respuestas»', async ({ page }) => {
    await page.locator('.tab[data-view="projector"]').click();
    await expect(page.locator('.pj-col').first().locator('.pj-item')).toHaveCount(5);

    await page.locator('.tab[data-view="results"]').click();
    await expect(page.locator('.pj-item.is-impostor')).toHaveCount(2);
    await expect(page.locator('.pj-bar').first()).toContainText('→');

    await page.locator('#opt-show').uncheck();
    await expect(page.locator('.pj-item.is-impostor')).toHaveCount(0);
    await expect(page.locator('.pj-bar').first()).not.toContainText('→');
});
