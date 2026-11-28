const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Mode fantasma (ítem 26) en Solo: la primera partida fixa la marca; la segona compara pregunta a pregunta.
// Les opcions es barregen en cada pregunta, així que les respostes es trien pel text.
const quiz = {
    id: 'g1',
    name: 'Fantasma',
    tags: [],
    questions: [
        { question: 'Capital de França?', type: 'quiz', answers: ['Roma', 'París', 'Berlín', 'Londres'], correctAnswers: [2], time: 20 },
        { question: 'Capital d\'Itàlia?', type: 'quiz', answers: ['Roma', 'Milà', 'Nàpols', 'Torí'], correctAnswers: [2], time: 20 }
    ]
};
// Respostes correctes: París i Milà. Incorrecta de la primera pregunta: Roma.
const RIGHT = ['París', 'Milà'];

async function mockBackend(page, questions) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/quizzes/g1') return route.fulfill({ json: { ...quiz, questions: questions || quiz.questions } });
        if (/solo-ranking$/.test(pathname)) return route.fulfill({ json: { top: [] } });
        return route.fulfill({ json: [] });
    });
}

// Claus de marca al navegador (una per quiz: la clau és l'empremta).
const ghostKeys = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('eduh_ghost_')));

// Una partida: respon cada pregunta amb el text indicat, amb el rellotge fixat.
// «onAnswer» s'executa mentre la finestra de resultat està oberta.
async function playRun(page, answers, onAnswer, ghostOn = true) {
    await page.clock.install();
    await page.goto('/solo/?id=g1&lang=es');
    await expect(page.locator('#start-form')).toBeVisible();
    if (ghostOn) await page.locator('#opt-ghost').check();
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.locator('#start-btn').click();
    for (let i = 0; i < answers.length; i++) {
        await page.clock.runFor(3000);
        await page.locator('.answer', { hasText: answers[i] }).click();
        await expect(page.locator('#feedback-modal')).toHaveClass(/show/);
        if (onAnswer) await onAnswer(i);
        await page.locator('#feedback-close').click();
    }
}

test('mode fantasma: la primera partida fixa la marca i la segona mostra la diferència', async ({ page }) => {
    await mockBackend(page);
    await playRun(page, RIGHT);
    await expect(page.locator('#result-ghost')).toHaveText('Nova millor marca!');
    expect(await ghostKeys(page)).toHaveLength(1);

    // Partida 2: la primera pregunta s'erra. La diferència després de la pregunta és negativa.
    await playRun(page, ['Roma'], async () => {
        await expect(page.locator('#feedback-ghost')).toContainText('Fantasma: −');
    });
});

test('mode fantasma: el resum final compara amb la millor marca', async ({ page }) => {
    await mockBackend(page);
    await playRun(page, RIGHT);
    await playRun(page, ['Roma', 'Milà']);
    await expect(page.locator('#result-ghost')).toContainText('Millor marca');
});

test('mode fantasma: si el quiz canvia, la marca antiga no es mostra', async ({ page }) => {
    await mockBackend(page);
    await playRun(page, RIGHT);
    // El mateix id, però amb una pregunta editada: la marca ja no és comparable.
    await page.unroute('**/api/**');
    await mockBackend(page, [{ ...quiz.questions[0], question: 'Capital de França (editada)?' }, quiz.questions[1]]);
    await playRun(page, ['Roma'], async () => {
        await expect(page.locator('#feedback-ghost')).toHaveCount(0);
    });
});

test('mode fantasma: desactivat per defecte, no compara ni guarda la marca', async ({ page }) => {
    await mockBackend(page);
    await playRun(page, RIGHT, undefined, false);
    await expect(page.locator('#opt-ghost')).not.toBeChecked();
    expect(await ghostKeys(page)).toHaveLength(0);
    await playRun(page, ['Roma'], async () => {
        await expect(page.locator('#feedback-ghost')).toHaveCount(0);
    }, false);
});
