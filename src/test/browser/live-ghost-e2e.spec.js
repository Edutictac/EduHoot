const { test, expect } = require('@playwright/test');
const QUESTIONS = require('../../public/dev/ordenar/questions.json');

// Mode fantasma en aula, de extrem a extrem (servidor de desenvolupament, quiz 69, cinc preguntes d'ordenar).
// Tres partides amb els mateixos alumnes: sense el check no apareix res; amb el check, la primera marca;
// i la segona, amb l'Ana equivocada, mostra la diferència per pregunta i la marca final.
// Es salta si el servidor de desenvolupament no és a 127.0.0.1:3000.
const BASE = 'http://127.0.0.1:3000';
const QUIZ_ID = 69;

async function devAvailable() {
    try {
        const res = await fetch(`${BASE}/api/quizzes/${QUIZ_ID}`);
        return res.ok;
    } catch (err) {
        return false;
    }
}

async function arrange(page, target) {
    for (let k = 0; k < target.length; k++) {
        const list = await page.locator('.order-item .order-text').allTextContents();
        const p = list.indexOf(target[k]);
        for (let step = p; step > k; step--) {
            await page.locator('.order-item').nth(step).locator('button').first().click();
        }
    }
}

// Una partida completa. anaCorrect: si l'Ana encerta totes les preguntes. ghost: si el check del fantasma està actiu.
async function playGame(browser, students, { ghost, anaCorrect, afterQuestion }) {
    const hostCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    await host.goto(`${BASE}/host/?id=${QUIZ_ID}&lang=es`);
    await expect(host.locator('#gamePinText')).not.toHaveText('—', { timeout: 20000 });
    const pin = (await host.locator('#gamePinText').textContent()).trim();
    if (ghost) await host.locator('#opt-ghost-live').check();
    for (const s of students) {
        await s.page.goto(`${BASE}/join.html?lang=es`);
        await s.page.locator('#pinModalInput').fill(pin);
        await s.page.locator('#pinModalSubmit').click();
        await s.page.locator('#name').fill(s.name, { timeout: 15000 });
        await s.page.locator('#joinButton').click({ timeout: 15000 });
    }
    await host.locator('#start').click();
    const gl = (sel) => host.frameLocator('#host-game-frame').locator(sel);
    const [ana, bruno] = students.map((s) => s.page);
    for (let q = 0; q < QUESTIONS.length; q++) {
        const sol = QUESTIONS[q].items;
        await expect(ana.locator('.order-board')).toBeVisible({ timeout: 30000 });
        await expect(bruno.locator('.order-board')).toBeVisible({ timeout: 30000 });
        await expect(gl('#hostOrder li')).toHaveCount(sol.length, { timeout: 30000 });
        await arrange(ana, anaCorrect ? sol : [...sol].reverse());
        await ana.locator('.order-submit').click();
        await arrange(bruno, [...sol].reverse());
        await bruno.locator('.order-submit').click();
        await expect(ana.locator('#message')).toHaveClass(anaCorrect ? /message--correct/ : /message--incorrect|message--partial/, { timeout: 30000 });
        if (ghost && !anaCorrect && q === 0) {
            // Ja després de la primera pregunta, l'Ana veu la diferència amb la marca (negativa).
            await expect(ana.locator('#ghostLine')).toContainText('Fantasma: −', { timeout: 30000 });
        }
        // Pas a la següent pregunta (o final, a la darrera): el modal de rànquing.
        await expect(gl('#rankingNextBtn')).toBeVisible({ timeout: 30000 });
        for (let k = 0; k < 3 && await gl('#rankingNextBtn').isVisible(); k++) {
            await gl('#rankingNextBtn').click();
            await host.waitForTimeout(400);
        }
        if (afterQuestion) await afterQuestion(q, students);
    }
    await hostCtx.close();
}

test('mode fantasma en aula: sense el check no hi ha marques; amb el check, la marca i la diferència per pregunta', async ({ browser }) => {
    test.setTimeout(900000);
    test.skip(!(await devAvailable()), 'servidor de desenvolupament no disponible (127.0.0.1:3000)');

    const students = [];
    for (const name of ['Ana', 'Bruno']) {
        const ctx = await browser.newContext();
        students.push({ name, page: await ctx.newPage() });
    }
    const [ana, bruno] = students.map((s) => s.page);

    // 1) Sense el check: cap línia del fantasma i cap marca guardada.
    await playGame(browser, students, { ghost: false, anaCorrect: true });
    await expect(ana.locator('#ghostLine')).toHaveCount(0);
    expect(await ana.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('eduh_ghost_')).length)).toBe(0);

    // 2) Amb el check, l'Ana encerta: primera marca.
    await playGame(browser, students, { ghost: true, anaCorrect: true });
    await expect(ana.locator('#ghostLine')).toHaveText('Nova millor marca!', { timeout: 30000 });
    // La marca va sota l'empremta del quiz (la mateixa que calcula el servidor i que usaria solo).
    expect(await ana.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('eduh_ghost_')))).toEqual(['eduh_ghost_5:ade5fa25']);
    await expect(bruno.locator('#ghostLine')).toHaveText('Nova millor marca!', { timeout: 30000 });

    // 3) Amb el check, l'Ana falla: diferència negativa després de la primera pregunta i marca final.
    await playGame(browser, students, { ghost: true, anaCorrect: false });
    await expect(ana.locator('#ghostLine')).toContainText('Millor marca:', { timeout: 30000 });
    for (const s of students) await s.page.context().close();
});

test('mode fantasma en aula: recarregar la pàgina a mitad de partida no perd la marca', async ({ browser }) => {
    test.setTimeout(900000);
    test.skip(!(await devAvailable()), 'servidor de desenvolupament no disponible (127.0.0.1:3000)');
    const students = [];
    for (const name of ['Ana', 'Bruno']) {
        const ctx = await browser.newContext();
        students.push({ name, page: await ctx.newPage() });
    }
    const [ana] = students.map((s) => s.page);
    // L'Ana recarrega la pàgina després de la segona pregunta, encara amb la partida en curs.
    await playGame(browser, students, {
        ghost: true,
        anaCorrect: true,
        afterQuestion: async (q) => {
            if (q === 1) await ana.reload();
        }
    });
    // La marca guardada és coherent: hi ha els punts de cada pregunta, i el total és la puntuació final d'Ana.
    await expect(ana.locator('#ghostLine')).toHaveText('Nova millor marca!', { timeout: 30000 });
    const score = Number((await ana.locator('#resultSub').textContent()).match(/: (\d+)/)[1]);
    const stored = await ana.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('eduh_ghost_')))));
    expect(stored.total).toBe(score);
    // Cada pregunta té la seua entrada (la de les dues primeres no es perd en recarregar) i cap és negativa.
    expect(Object.keys(stored.points).map(Number).sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4]);
    for (const v of Object.values(stored.points)) expect(v).toBeGreaterThanOrEqual(0);
    for (const s of students) await s.page.context().close();
});
