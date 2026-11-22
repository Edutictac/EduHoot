const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Modo Solo: pausar, reanudar y cancelar la partida; y «Volver» arriba a la izquierda.
// Con page.clock el tiempo solo avanza cuando el test lo pide.
const quiz = {
    id: 'q1',
    name: 'Geografia',
    tags: [],
    questions: [
        { question: 'Capital de França?', type: 'quiz', answers: ['París', 'Berlín', 'Roma', 'Londres'], correctAnswers: [1], time: 20 },
        { question: 'Capital d\'Itàlia?', type: 'quiz', answers: ['Roma', 'Berlín', 'París', 'Londres'], correctAnswers: [1], time: 20 }
    ]
};

test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.__errors = errors;
    await page.addInitScript(() => { Math.random = () => 0.999; });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/quizzes/q1') return route.fulfill({ json: quiz });
        if (pathname === '/api/public-quizzes') return route.fulfill({ json: [] });
        return route.fulfill({ json: {} });
    });
    await page.clock.install();
    await page.goto('/solo/?id=q1&lang=es');
    await expect(page.locator('#start-form')).toBeVisible();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
});

test.afterEach(async ({ page }) => {
    expect(page.__errors).toEqual([]);
});

async function start(page) {
    await page.locator('#start-btn').click();
    await expect(page.locator('#solo-countdown span')).toHaveText('3');
    await page.clock.runFor(3000);
    await expect(page.locator('#question-text')).toHaveText('Capital de França?');
}

test('pausar congela el tiempo y tapa la pregunta; reanudar sigue desde donde estaba', async ({ page }) => {
    await start(page);
    await page.clock.runFor(5000);
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 15s');

    await page.locator('#solo-pause').click();
    await expect(page.locator('#solo-paused')).toContainText('Partida en pausa');
    await expect(page.locator('#question-text')).toBeHidden();
    await expect(page.locator('#answers button.answer').first()).toBeHidden();
    await expect(page.locator('#solo-pause')).toHaveAccessibleName('Reanudar');
    await page.clock.runFor(30000);
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 15s');

    await page.locator('#solo-pause').click();
    await expect(page.locator('#solo-paused')).toHaveCount(0);
    await expect(page.locator('#question-text')).toBeVisible();
    await page.clock.runFor(4000);
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 11s');
    await page.locator('#answers button.answer').first().click();
    await expect(page.locator('#feedback')).toHaveText('¡Correcto!');
});

test('pausar durante la cuenta atrás la congela; al reanudar sigue y empieza la pregunta', async ({ page }) => {
    await page.locator('#start-btn').click();
    await page.clock.runFor(1000);
    await expect(page.locator('#solo-countdown span')).toHaveText('2');
    await page.locator('#solo-pause').click();
    await page.clock.runFor(10000);
    await page.locator('#solo-pause').click();
    await expect(page.locator('#solo-countdown span')).toHaveText('2');
    await page.clock.runFor(2000);
    await expect(page.locator('#question-text')).toHaveText('Capital de França?');
    await expect(page.locator('#timer-pill')).toHaveText('Tiempo: 20s');
});

test('tras responder no se puede pausar (no corre el tiempo)', async ({ page }) => {
    await start(page);
    await page.locator('#answers button.answer').first().click();
    await expect(page.locator('#solo-pause')).toBeDisabled();
});

test('cancelar pide confirmación y vuelve al formulario del quiz sin seguir la partida', async ({ page }) => {
    await start(page);
    await page.locator('#solo-cancel').click();
    await expect(page.locator('#solo-cancel')).toHaveAccessibleName('Confirmar cancelación');
    await expect(page.locator('#solo-cancel .solo-control__text')).toBeVisible();
    await expect(page.locator('#game-area')).toBeVisible();
    await page.locator('#solo-cancel').click();
    await expect(page.locator('#start-form')).toBeVisible();
    await expect(page.locator('#game-area')).toBeHidden();
    // Tras cancelar, la partida no sigue sola.
    await page.clock.runFor(5000);
    await expect(page.locator('#game-area')).toBeHidden();

    // Se puede volver a empezar.
    await start(page);
    await expect(page.locator('#question-progress')).toHaveText('Pregunta 1 de 2');
});

test('si no se confirma, la cancelación se olvida a los 4 s', async ({ page }) => {
    await start(page);
    await page.locator('#solo-pause').click();
    await page.locator('#solo-cancel').click();
    await page.clock.runFor(4500);
    await expect(page.locator('#solo-cancel')).toHaveAccessibleName('Cancelar partida');
    await expect(page.locator('#game-area')).toBeVisible();
});

test('«Volver» queda arriba, alineado con el borde izquierdo del recuadro y con su ancho, también durante la partida', async ({ page }) => {
    await start(page);
    const back = await page.locator('.back-link').first().boundingBox();
    const viewport = page.viewportSize();
    expect(back.width).toBeLessThan(viewport.width / 2);
    const panel = await page.locator('#game-panel').boundingBox();
    expect(Math.abs(back.x - panel.x)).toBeLessThan(2);
    expect(back.y).toBeLessThan(40);
});

// La música de fondo se pausa al pausar la partida (y vuelve al reanudar si sonaba) y se para al cancelarla.
async function fakeMusic(page) {
    await page.evaluate(async () => {
        const audio = window.soloMusicPlayerInstance.audio;
        let paused = true;
        Object.defineProperty(audio, 'paused', { get: () => paused });
        audio.play = () => { paused = false; return Promise.resolve(); };
        audio.pause = () => { paused = true; };
        await window.soloMusicPlayerInstance.play();
    });
}
const musicPaused = page => page.evaluate(() => window.soloMusicPlayerInstance.audio.paused);

test('pausar la partida pausa la música y reanudar la reanuda', async ({ page }) => {
    await fakeMusic(page);
    expect(await musicPaused(page)).toBe(false);
    await start(page);
    await page.locator('#solo-pause').click();
    expect(await musicPaused(page)).toBe(true);
    await page.locator('#solo-pause').click();
    expect(await musicPaused(page)).toBe(false);
});

test('si la música no sonaba, reanudar no la arranca', async ({ page }) => {
    await fakeMusic(page);
    await start(page);
    await page.evaluate(() => window.soloMusicPlayerInstance.pause());
    await page.locator('#solo-pause').click();
    await page.locator('#solo-pause').click();
    expect(await musicPaused(page)).toBe(true);
});

test('cancelar la partida para la música', async ({ page }) => {
    await fakeMusic(page);
    await start(page);
    await page.locator('#solo-cancel').click();
    await page.locator('#solo-cancel').click();
    await expect(page.locator('#start-form')).toBeVisible();
    expect(await musicPaused(page)).toBe(true);
});
