const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Deures asíncrons, pantalla del alumnado (/player/self-paced/?hw=CÓDIGO). La API se simula con page.route:
// el servidor real ya se prueba en test/integration/homework.test.js.
const CODE = 'ABCD2345';
const INFO = { code: CODE, title: 'Capitales', quizName: 'Capitales', totalQuestions: 2, maxAttempts: 2, deadline: Date.now() + 2 * 24 * 3600 * 1000, open: true };
const Q1 = { question: '¿Capital de Francia?', answers: ['París', 'Londres', 'Roma', 'Berlín'], type: 'quiz', time: 20, timeTotal: 20, questionNumber: 1, totalQuestions: 2 };

async function setup(page, { actReply, joinReply, info = INFO } = {}) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.__errors = errors;
    page.__acts = [];
    page.__joins = [];
    await page.route(/^https:\/\//, route => route.abort());
    // Las rutas más recientes tienen prioridad: primero la genérica, luego las concretas.
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route(`**/api/homework/${CODE}`, route => route.fulfill({ json: info }));
    await page.route(`**/api/homework/${CODE}/join`, route => {
        const body = route.request().postDataJSON();
        page.__joins.push(body);
        const reply = joinReply ? joinReply(body) : { status: 200, body: { ok: true, student: { name: body.name, recovery: 'K7M2QX' }, attempts: [], maxAttempts: 2, open: true } };
        return route.fulfill({ status: reply.status, json: reply.body });
    });
    await page.route(`**/api/homework/${CODE}/act`, route => {
        const body = route.request().postDataJSON();
        page.__acts.push(body);
        const reply = actReply(body, page.__acts.length);
        if (reply === 'fail') return route.abort();
        return route.fulfill({ status: reply.status || 200, json: reply.body || reply });
    });
}
test.afterEach(async ({ page }) => { expect(page.__errors || []).toEqual([]); });

const events = (list, extra = {}) => ({ ok: true, score: 0, streak: 0, title: 'Capitales', events: list, ...extra });

test('el enlace corto /homework/?code= lleva a la pantalla del alumnado conservando el idioma', async ({ page }) => {
    await setup(page, { actReply: () => events([]) });
    await page.goto(`/homework/?code=${CODE.toLowerCase()}&lang=ca`);
    await expect(page).toHaveURL(new RegExp(`/player/self-paced/\\?hw=${CODE}&lang=ca$`));
});

test('alumno nuevo: entra con su nombre, apunta el código, responde y ve su resumen con reintento', async ({ page }) => {
    await setup(page, {
        actReply: (body) => {
            if (body.op === 'resume') return events([{ name: 'spIdle', data: null }]);
            if (body.op === 'next') return events([{ name: 'spQuestion', data: Q1 }]);
            if (body.op === 'answer') return events([{ name: 'spResult', data: { outcome: 'correct', score: 950, points: 950, bonus: 0, streak: 1, questionNumber: 1, totalQuestions: 2, meta: { type: 'quiz', correctAnswers: [1] } } }], { score: 950, streak: 1 });
            if (body.op === 'newAttempt') return events([{ name: 'spIdle', data: null }]);
            return events([]);
        }
    });
    await page.goto(`/player/self-paced/?hw=${CODE}&lang=es`);
    await expect(page.locator('#hwTitle')).toHaveText('Capitales');
    await expect(page.locator('#hwMeta')).toContainText('2 preguntas · Hasta 2 intentos');
    await expect(page.locator('#player-sp')).toBeHidden();

    await page.locator('#hwName').fill('Marta');
    await page.locator('#hwSubmit').click();
    await expect(page.locator('#hwCodeValue')).toHaveText('K7M2QX');
    expect(page.__joins[0].name).toBe('Marta');
    expect(page.__joins[0].recovery).toBeUndefined();
    expect(await page.evaluate((c) => JSON.parse(localStorage.getItem('eduhootHomework:' + c)), CODE)).toEqual({ name: 'Marta', recovery: 'K7M2QX' });

    await page.locator('#hwCodeGo').click();
    await expect(page.locator('#hwEntry')).toBeHidden();
    await expect(page.locator('#questionText')).toHaveText('¿Capital de Francia?');
    await expect(page.locator('#nameText')).toContainText('Marta');
    // Sin anfitrión no hay mano alzada.
    await expect(page.locator('#raiseHandRow')).toHaveCount(0);
    expect(page.__acts.map((a) => a.op)).toEqual(['resume', 'next']);
    expect(page.__acts[0]).toMatchObject({ name: 'Marta', recovery: 'K7M2QX' });

    await page.locator('#answer1').click();
    expect(page.__acts.at(-1)).toMatchObject({ op: 'answer', value: 1 });
    await expect(page.locator('#scoreText')).toContainText('950');

    // El resumen final con reintento (el servidor decide si se puede).
    await page.route(`**/api/homework/${CODE}/act`, route => {
        const body = route.request().postDataJSON();
        page.__acts.push(body);
        const list = body.op === 'newAttempt'
            ? [{ name: 'spIdle', data: null }]
            : [{ name: 'spFinished', data: { score: 950, correctCount: 1, wrongCount: 0, bestStreak: 1, total: 2, homework: true, attemptNo: 1, maxAttempts: 2, bestScore: 950, canRetry: true } }];
        return route.fulfill({ json: events(list, { score: 950 }) });
    });
    await page.locator('#spNextBtn').click();
    await expect(page.locator('.sp-done')).toBeVisible();
    await expect(page.locator('.sp-done')).toContainText('Mejor puntuación: 950');
    await expect(page.locator('.sp-done')).toContainText('Marta · K7M2QX');
    await page.locator('#hwRetryBtn').click();
    // «Intentarlo de nuevo»: el servidor abre otro intento y la pantalla pide su primera pregunta.
    await expect.poll(() => page.__acts.map((a) => a.op).slice(-2)).toEqual(['newAttempt', 'next']);
});

test('muestra el intento en curso (n de m) y lo actualiza al reintentar', async ({ page }) => {
    await setup(page, {
        actReply: (body) => {
            if (body.op === 'newAttempt') return { ...events([{ name: 'spIdle', data: null }]), attemptNo: 2 };
            if (body.op === 'next') return events([{ name: 'spQuestion', data: Q1 }]);
            if (body.op === 'answer') return events([{ name: 'spFinished', data: { score: 950, correctCount: 1, wrongCount: 0, bestStreak: 1, total: 1, homework: true, attemptNo: 1, maxAttempts: 2, bestScore: 950, canRetry: true } }], { score: 950 });
            return events([{ name: 'spIdle', data: null }]);
        }
    });
    await page.goto(`/player/self-paced/?hw=${CODE}&lang=es`);
    await page.locator('#hwName').fill('Marta');
    await page.locator('#hwSubmit').click();
    await page.locator('#hwCodeGo').click();
    await expect(page.locator('#attemptText')).toHaveText('Intento 1 de 2');
    await page.locator('#answer1').click();
    await expect(page.locator('.sp-done')).toBeVisible();
    await page.locator('#hwRetryBtn').click();
    await expect(page.locator('#attemptText')).toHaveText('Intento 2 de 2 · Último intento');
});

test('dispositivo conocido: entra directamente con el código guardado', async ({ page }) => {
    await page.addInitScript((c) => localStorage.setItem('eduhootHomework:' + c, JSON.stringify({ name: 'Marta', recovery: 'K7M2QX' })), CODE);
    await setup(page, {
        actReply: (body) => (body.op === 'resume' ? events([{ name: 'spQuestion', data: { ...Q1, time: 12 } }]) : events([]))
    });
    await page.goto(`/player/self-paced/?hw=${CODE}&lang=es`);
    await expect(page.locator('#questionText')).toHaveText('¿Capital de Francia?');
    await expect(page.locator('#hwEntry')).toBeHidden();
    expect(page.__joins[0]).toMatchObject({ name: 'Marta', recovery: 'K7M2QX' });
});

test('código guardado que ya no vale: se pide de nuevo la entrada', async ({ page }) => {
    await page.addInitScript((c) => localStorage.setItem('eduhootHomework:' + c, JSON.stringify({ name: 'Marta', recovery: 'MALO22' })), CODE);
    await setup(page, { actReply: () => events([]), joinReply: () => ({ status: 401, body: { error: 'bad-recovery' } }) });
    await page.goto(`/player/self-paced/?hw=${CODE}&lang=es`);
    await expect(page.locator('#hwForm')).toBeVisible();
    expect(await page.evaluate((c) => localStorage.getItem('eduhootHomework:' + c), CODE)).toBeNull();
});

test('errores de entrada: nombre ocupado y reentrada con nombre y código', async ({ page }) => {
    await setup(page, {
        actReply: (body) => (body.op === 'resume' ? events([{ name: 'spIdle', data: null }]) : events([{ name: 'spQuestion', data: Q1 }])),
        joinReply: (body) => (body.recovery
            ? { status: 200, body: { ok: true, student: { name: 'Marta', recovery: 'K7M2QX' }, attempts: [], maxAttempts: 2, open: true } }
            : { status: 409, body: { error: 'name-taken' } })
    });
    await page.goto(`/player/self-paced/?hw=${CODE}&lang=es`);
    await page.locator('#hwName').fill('Marta');
    await page.locator('#hwSubmit').click();
    await expect(page.locator('#hwError')).toContainText('Ese nombre ya está en uso');

    await page.locator('#hwModeToggle').click();
    await expect(page.locator('#hwRecoveryRow')).toBeVisible();
    await page.locator('#hwRecovery').fill('k7m2qx');
    await page.locator('#hwSubmit').click();
    await expect(page.locator('#hwEntry')).toBeHidden();
    await expect(page.locator('#questionText')).toHaveText('¿Capital de Francia?');
    expect(page.__joins.at(-1)).toMatchObject({ name: 'Marta', recovery: 'k7m2qx' });
});

test('deber cerrado: sin código no se puede empezar y se avisa', async ({ page }) => {
    await setup(page, { info: { ...INFO, open: false }, actReply: () => events([]) });
    await page.goto(`/player/self-paced/?hw=${CODE}&lang=es`);
    await expect(page.locator('#hwClosed')).toBeVisible();
    // Solo se ofrece la reentrada de quien ya participó.
    await expect(page.locator('#hwRecoveryRow')).toBeVisible();
});

test('corte de red: se avisa, se reintenta y se continúa', async ({ page }) => {
    await page.addInitScript((c) => localStorage.setItem('eduhootHomework:' + c, JSON.stringify({ name: 'Marta', recovery: 'K7M2QX' })), CODE);
    let calls = 0;
    await setup(page, {
        actReply: () => {
            calls += 1;
            if (calls === 1) return 'fail';
            return events([{ name: 'spQuestion', data: Q1 }]);
        }
    });
    await page.goto(`/player/self-paced/?hw=${CODE}&lang=es`);
    await expect(page.locator('#message')).toContainText('Reconectando');
    await expect(page.locator('#questionText')).toHaveText('¿Capital de Francia?', { timeout: 10000 });
});

test('sin ?hw= la pantalla de autoritme en clase no cambia', async ({ page }) => {
    await setup(page, { actReply: () => events([]) });
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io=function(){return {on:function(){},emit:function(){},disconnect:function(){}}}' }));
    await page.goto('/player/self-paced/?pin=12345&name=Ana&lang=es');
    await expect(page.locator('#hwEntry')).toBeHidden();
    expect(await page.evaluate(() => document.body.classList.contains('hw-mode'))).toBe(false);
});
