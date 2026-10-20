const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

const poll = {
    question: 'En quina etapa fas classe?', type: 'poll',
    answers: ['Infantil', 'Primària inicial', 'Primària superior', 'Especialitat'],
    correct: 1, correctAnswers: [], time: 30
};
const quiz = {
    question: 'Pregunta de coneixements', type: 'quiz',
    answers: ['Correcta', 'Incorrecta', 'Una altra', 'Cap'],
    correct: 1, correctAnswers: [1], time: 30
};

async function openQuiz(page, questions) {
    await page.addInitScript(() => { Math.random = () => 0.999; });
    await page.route('https://**', route => route.abort());
    await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/quizzes/123') {
            return route.fulfill({ json: { id: 123, name: 'Diagnòstic', questions } });
        }
        return route.fulfill({ json: { tags: [], quizzes: [], enabled: false, top: [] } });
    });
    await page.goto('/solo/?id=123&lang=va');
    await page.locator('#start-btn').click();
    await expect(page.locator('#question-text')).toHaveText(poll.question);
}

for (const choice of [0, 1, 2, 3]) {
    test(`poll choice ${choice + 1} is accepted without error feedback or score`, async ({ page }) => {
        await openQuiz(page, [poll, quiz]);
        await page.locator('#answers button.answer').nth(choice).click();
        await expect(page.locator('#feedback')).toHaveText('Gràcies per respondre!');
        await expect(page.locator('#answers .wrong, #answers .correct')).toHaveCount(0);
        await expect(page.locator('#feedback-modal')).not.toHaveClass(/show/);
        await expect(page.locator('#question-text')).toHaveText(quiz.question);
        await page.locator('#answers button.answer').nth(0).click();
        await expect(page.locator('#result-area')).toBeVisible();
        await expect(page.locator('#result-summary')).toContainText('Encerts 1/1');
        await expect(page.locator('#result-summary')).toContainText('Enquestes: 1 · sense puntuació');
    });
}

test('an incorrect knowledge answer still opens the error dialog', async ({ page }) => {
    await openQuiz(page, [poll, quiz]);
    await page.locator('#answers button.answer').nth(3).click();
    await expect(page.locator('#question-text')).toHaveText(quiz.question);
    await page.locator('#answers button.answer').nth(1).click();
    await expect(page.locator('#feedback-modal')).toHaveClass(/show/);
    await expect(page.locator('#answers button.answer').nth(1)).toHaveClass(/wrong/);
});

test('a poll-only quiz has no incorrect count or ranking submission', async ({ page }) => {
    await openQuiz(page, [poll]);
    await page.locator('#answers button.answer').nth(2).click();
    await expect(page.locator('#result-area')).toBeVisible();
    await expect(page.locator('#result-summary')).toHaveText('Enquestes: 1 · sense puntuació');
    await expect(page.locator('#feedback-modal')).not.toHaveClass(/show/);
    await expect(page.locator('#name-modal')).not.toHaveClass(/show/);
});
