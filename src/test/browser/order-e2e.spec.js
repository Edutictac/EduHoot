const { test, expect } = require('@playwright/test');
const QUESTIONS = require('../../public/dev/ordenar/questions.json');

// End-to-end real: servidor de desenvolupament (127.0.0.1:3000), quiz 69 (cinc preguntes d'ordenar),
// un anfitrió i dos alumnes en navegadors diferents. Es salta si el servidor no està en marxa.
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

// Porta cada element de la llista a la seua posició correcta amb les fletxes ▲ (o a l'inversa).
async function arrange(page, target) {
    for (let k = 0; k < target.length; k++) {
        const list = await page.locator('.order-item .order-text').allTextContents();
        const p = list.indexOf(target[k]);
        for (let step = p; step > k; step--) {
            await page.locator('.order-item').nth(step).locator('button').first().click();
        }
    }
}

test('partida completa amb el quiz 69: anfitrió i dos alumnes ordenen les cinc preguntes', async ({ browser }) => {
    test.setTimeout(420000);
    test.skip(!(await devAvailable()), 'servidor de desenvolupament no disponible (127.0.0.1:3000)');

    const hostCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    await host.goto(`${BASE}/host/?id=${QUIZ_ID}&lang=es`);
    await expect(host.locator('#gamePinText')).not.toHaveText('—', { timeout: 20000 });
    const pin = (await host.locator('#gamePinText').textContent()).trim();

    const students = [];
    for (const name of ['Ana', 'Bruno']) {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await page.goto(`${BASE}/join.html?lang=es`);
        await page.locator('#pinModalInput').fill(pin);
        await page.locator('#pinModalSubmit').click();
        await page.locator('#name').fill(name, { timeout: 15000 });
        await page.locator('#joinButton').click({ timeout: 15000 });
        students.push({ name, page });
    }

    await host.locator('#start').click();
    // El projector («/host/game/») pot anar en un iframe de l'anfitrió, o en la mateixa pàgina.
    // El projector viu a l'iframe #host-game-frame del lobby de l'anfitrió.
    const gl = (sel) => host.frameLocator('#host-game-frame').locator(sel);

    for (let q = 0; q < QUESTIONS.length; q++) {
        const sol = QUESTIONS[q].items;
        // Cada alumne ha de veure la llista barrejada i enviar-la.
        const [ana, bruno] = students.map((s) => s.page);
        await expect(ana.locator('.order-board')).toBeVisible({ timeout: 30000 });
        await expect(bruno.locator('.order-board')).toBeVisible({ timeout: 30000 });
        await expect(gl('#hostOrder li')).toHaveCount(sol.length, { timeout: 30000 });

        await arrange(ana, sol);
        await ana.locator('.order-submit').click();
        await arrange(bruno, [...sol].reverse());
        await bruno.locator('.order-submit').click();

        // Resultat: Ana encerta; Bruno no (el seu ordre no és el correcte).
        await expect(ana.locator('#message')).toHaveClass(/message--correct/, { timeout: 30000 });
        await expect(bruno.locator('#message')).not.toHaveClass(/message--correct/, { timeout: 30000 });
        if (q === 0) {
            await expect(gl('#resultsOrder li')).toHaveText(sol.map((s, i) => String(i + 1) + s), { timeout: 30000 });
        }
        if (q < QUESTIONS.length - 1) {
            // El pas a la següent pregunta és al modal de rànquing («#rankingNextBtn»): gràfic i després rànquing.
            await expect(gl('#rankingNextBtn')).toBeVisible({ timeout: 30000 });
            for (let k = 0; k < 3 && await gl('#rankingNextBtn').isVisible(); k++) {
                await gl('#rankingNextBtn').click();
                await host.waitForTimeout(400);
            }
        }
    }
    // Informe de la partida (CSV): cada pregunta d'ordenar es llegeix com a text. Ana l'encerta; Bruno l'invers.
    // El hostId que accepta el servidor és el que la pàgina del projector rep (params.id), no el de la URL.
    const gameFrame = host.frames().find((fr) => fr.parentFrame() && fr.url().includes('/host/game/'));
    const hostId = await gameFrame.evaluate(() => window.params && window.params.id);
    const res = await host.request.get(BASE + '/api/live-games/' + pin + '/report.csv?hostId=' + encodeURIComponent(hostId));
    expect(res.ok()).toBeTruthy();
    const rows = (await res.text()).split('\n').map((line) => line.split(';'));
    // Columnes: 5 alumne, 10 nombre de pregunta, 11 tipus, 14 resposta, 15 correcta.
    const textOf = (items) => items.map((text, i) => (i + 1) + ' ' + text).join(' | ');
    for (let q = 0; q < QUESTIONS.length; q++) {
        const items = QUESTIONS[q].items;
        const rowOf = (name) => rows.find((r) => r[5] === name && r[10] === String(q + 1) && r[11] === 'order');
        const ana = rowOf('Ana');
        const bruno = rowOf('Bruno');
        expect(ana, 'fila d\'Ana per a la pregunta ' + (q + 1)).toBeTruthy();
        expect(ana[14]).toBe(textOf(items));
        expect(ana[15]).toBe(textOf(items));
        expect(bruno[14]).toBe(textOf([...items].reverse()));
        expect(bruno[15]).toBe(textOf(items));
    }
    await hostCtx.close();
    for (const s of students) await s.page.context().close();
});
