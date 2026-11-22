const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Deures, lado del docente (/create/homework/). La API se simula con page.route; el servidor real
// ya se prueba en test/integration/homework.test.js.
const USER = { id: 't1', email: 't1@example.org', role: 'editor', nickname: 'Docent' };
const DAY = 24 * 3600 * 1000;
const HW = (over = {}) => ({ code: 'ABCD2345', title: 'Capitales', quizName: 'Quiz de capitales', totalQuestions: 3, maxAttempts: 1, deadline: Date.now() + 2 * DAY, open: true, status: 'open', createdAt: Date.now(), students: 2, finishedAttempts: 1, ...over });

async function setup(page, { user = USER, routes } = {}) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.__errors = errors;
    page.__calls = [];
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/api/auth/me', route => (user ? route.fulfill({ json: user }) : route.fulfill({ status: 401, json: { error: 'no' } })));
    await page.route('**/api/quizzes/7', route => route.fulfill({ json: { id: 7, name: 'Capitales' } }));
    if (routes) await routes(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || []).toEqual([]); });

test('sin sesión: pide iniciar sesión', async ({ page }) => {
    await setup(page, { user: null });
    await page.goto('/create/homework/?lang=es');
    await expect(page.locator('#hwNeedLogin')).toBeVisible();
});

test('crear un deber desde un quiz: envía las opciones y muestra el enlace para compartir', async ({ page }) => {
    await setup(page, {
        routes: async (p) => {
            await p.route('**/api/homeworks', route => {
                p.__calls.push(route.request().postDataJSON());
                return route.fulfill({ json: { ok: true, homework: HW() } });
            });
        }
    });
    await page.goto('/create/homework/?quiz=7&lang=es');
    await expect(page.locator('#hwFTitle')).toHaveValue('Capitales');
    await page.locator('#hwFTitle').fill('Capitales de Europa');
    await page.locator('#hwFDeadline').fill('2030-05-20T23:59');
    await page.locator('#hwFAttempts').selectOption('3');
    await page.locator('#hwFTime').selectOption('30');
    await page.locator('#hwFShuffle').uncheck();
    await page.locator('#hwCreateBtn').click();

    await expect(page.locator('#hwLink')).toHaveText(/\/homework\/\?code=ABCD2345$/);
    await expect(page.locator('#hwCode')).toHaveText('ABCD2345');
    const body = page.__calls[0];
    expect(body).toMatchObject({ quizId: '7', title: 'Capitales de Europa', maxAttempts: 3, options: { showCorrectAnswers: true, randomAnswers: false, timePerQuestion: 30 } });
    expect(body.deadline).toBe(new Date('2030-05-20T23:59').getTime());
    await page.locator('#hwCopyBtn').click();
});

test('crear: el error del servidor se muestra y se puede corregir', async ({ page }) => {
    await setup(page, {
        routes: async (p) => {
            await p.route('**/api/homeworks', route => route.fulfill({ status: 400, json: { error: 'deadline-too-soon' } }));
        }
    });
    await page.goto('/create/homework/?quiz=7&lang=es');
    await page.locator('#hwCreateBtn').click();
    await expect(page.locator('#hwFormError')).toContainText('al menos 1 minuto');
    await expect(page.locator('#hwCreateBtn')).toBeEnabled();
});

test('lista: estados, cerrar, reabrir vencido con fecha nueva y borrar en dos pasos', async ({ page }) => {
    let list = [HW(), HW({ code: 'ZZZZ2222', title: 'Vencido', deadline: Date.now() - DAY, open: false })];
    await setup(page, {
        routes: async (p) => {
            await p.route('**/api/homeworks', route => route.fulfill({ json: list }));
            await p.route('**/api/homeworks/*', route => {
                const req = route.request();
                p.__calls.push({ method: req.method(), url: req.url().split('/').pop(), body: req.postDataJSON() });
                if (req.method() === 'DELETE') list = list.filter((h) => !req.url().endsWith(h.code));
                if (req.method() === 'PATCH') list = list.map((h) => (req.url().endsWith(h.code) ? { ...h, ...(req.postDataJSON().status ? { status: req.postDataJSON().status } : { deadline: req.postDataJSON().deadline, open: true }) } : h));
                return route.fulfill({ json: { ok: true } });
            });
        }
    });
    await page.goto('/create/homework/?lang=es');
    const first = page.locator('.hw-item[data-code="ABCD2345"]');
    const old = page.locator('.hw-item[data-code="ZZZZ2222"]');
    await expect(first.locator('.hw-badge')).toHaveText('Abierto');
    await expect(old.locator('.hw-badge')).toHaveText('Vencido');
    await expect(first.locator('.hw-link')).toHaveText(/\/homework\/\?code=ABCD2345$/);
    await expect(first.locator('.hw-results')).toHaveAttribute('href', '/create/homework/?code=ABCD2345');

    await first.locator('.hw-toggle').click();
    await expect(first.locator('.hw-badge')).toHaveText('Cerrado');
    expect(page.__calls.at(-1)).toEqual({ method: 'PATCH', url: 'ABCD2345', body: { status: 'closed' } });
    // Cerrado con plazo vigente: reabrir basta.
    await first.locator('.hw-reopen').click();
    await expect(first.locator('.hw-badge')).toHaveText('Abierto');

    // Vencido: pide fecha nueva.
    await old.locator('.hw-reopen').click();
    await old.locator('.hw-new-deadline').fill('2031-01-01T10:00');
    await old.locator('.hw-reopen-ok').click();
    await expect(old.locator('.hw-badge')).toHaveText('Abierto');
    expect(page.__calls.at(-1).body.deadline).toBe(new Date('2031-01-01T10:00').getTime());

    // Borrar: primero confirma.
    await first.locator('.hw-delete').click();
    expect(page.__calls.some((c) => c.method === 'DELETE')).toBe(false);
    await expect(first.locator('.hw-delete')).toContainText('¿Seguro?');
    await first.locator('.hw-delete').click();
    await expect(first).toHaveCount(0);
});

test('lista vacía', async ({ page }) => {
    await setup(page, { routes: async (p) => { await p.route('**/api/homeworks', route => route.fulfill({ json: [] })); } });
    await page.goto('/create/homework/?lang=es');
    await expect(page.locator('#hwEmpty')).toBeVisible();
});

test('resultados: tabla por alumno, estadística por pregunta y descarga CSV', async ({ page }) => {
    await setup(page, {
        routes: async (p) => {
            await p.route('**/api/homeworks/ABCD2345/results', route => route.fulfill({
                json: {
                    homework: HW(), students: 2,
                    rows: [
                        { name: 'Ana', icon: '🦊', state: 'finished', attempts: 2, bestScore: 2500, correctCount: 3, wrongCount: 0, answered: 3 },
                        { name: 'Bruno', icon: '', state: 'in-progress', attempts: 1, bestScore: 900, correctCount: 1, wrongCount: 1, answered: 2 }
                    ],
                    questionStats: [{ number: 1, question: 'Capital de <b>Francia</b>', type: 'quiz', answered: 2, correct: 2 }, { number: 2, question: 'P2', type: 'quiz', answered: 2, correct: 1 }, { number: 3, question: 'P3', type: 'quiz', answered: 1, correct: 1 }]
                }
            }));
        }
    });
    await page.goto('/create/homework/?code=ABCD2345&lang=es');
    await expect(page.locator('#hwStudents tbody tr')).toHaveCount(2);
    await expect(page.locator('#hwStudents tbody tr').first()).toContainText('🦊 Ana');
    await expect(page.locator('#hwStudents tbody tr').first()).toContainText('Terminado');
    await expect(page.locator('#hwStudents tbody tr').nth(1)).toContainText('En curso');
    await expect(page.locator('#hwQuestions tbody tr').first()).toContainText('Capital de Francia');
    await expect(page.locator('#hwQuestions tbody tr').first()).toContainText('100 %');
    await expect(page.locator('#hwQuestions tbody tr').nth(1)).toContainText('50 %');
    await expect(page.locator('#hwCsvBtn')).toHaveAttribute('href', '/api/homeworks/ABCD2345/report.csv');
});

test('resultados sin alumnado', async ({ page }) => {
    await setup(page, {
        routes: async (p) => {
            await p.route('**/api/homeworks/ABCD2345/results', route => route.fulfill({ json: { homework: HW(), students: 0, rows: [], questionStats: [] } }));
        }
    });
    await page.goto('/create/homework/?code=ABCD2345&lang=ca');
    await expect(page.locator('#hwNoStudents')).toHaveText('Encara no ha entrat ningú.');
});

// Maquetación: el panel ocupa el ancho de la página (margen lateral como la biblioteca) y no se sale en móvil.
test('maquetación: el panel ocupa el ancho de la página y no desborda', async ({ page }) => {
    await setup(page, { routes: async (p) => { await p.route('**/api/homeworks', route => route.fulfill({ json: [HW()] })); } });
    await page.goto('/create/homework/?lang=es');
    await expect(page.locator('.hw-item')).toHaveCount(1);
    const m = await page.evaluate(() => {
        const shell = document.querySelector('.hw-shell').getBoundingClientRect();
        return { left: shell.left, right: document.documentElement.clientWidth - shell.right, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(m.scroll).toBeLessThanOrEqual(0);
    expect(Math.abs(m.left - m.right)).toBeLessThan(2);
    const w = await page.evaluate(() => window.innerWidth);
    if (w >= 900) expect(m.left).toBeGreaterThan(w * 0.08);
    else expect(m.left).toBeLessThan(20);
});

test('resultados: la tabla por alumno se ordena al pulsar el encabezado', async ({ page }) => {
    await setup(page, {
        routes: async (p) => {
            await p.route('**/api/homeworks/ABCD2345/results', route => route.fulfill({
                json: {
                    homework: HW(), students: 2,
                    rows: [
                        { name: 'Ana', icon: '', state: 'finished', attempts: 1, bestScore: 900, correctCount: 1, wrongCount: 0, answered: 1 },
                        { name: 'Bruno', icon: '', state: 'finished', attempts: 1, bestScore: 2500, correctCount: 3, wrongCount: 0, answered: 3 }
                    ],
                    questionStats: []
                }
            }));
        }
    });
    await page.goto('/create/homework/?code=ABCD2345&lang=es');
    const names = () => page.locator('#hwStudents tbody tr td:first-child').allTextContents();
    expect(await names()).toEqual(['Ana', 'Bruno']);
    await page.locator('#hwStudents .hw-sort', { hasText: 'Mejor puntuación' }).click();
    expect(await names()).toEqual(['Ana', 'Bruno']);
    await page.locator('#hwStudents .hw-sort', { hasText: 'Mejor puntuación' }).click();
    expect(await names()).toEqual(['Bruno', 'Ana']);
});

test('nuevo deber: tarjeta centrada, «Volver a la biblioteca», enlace a «Mis deberes», 180 s y puntuación con varios intentos', async ({ page }) => {
    await setup(page, {
        routes: async (p) => {
            await p.route('**/api/homeworks', route => {
                p.__calls.push(route.request().postDataJSON());
                return route.fulfill({ json: { ok: true, homework: HW() } });
            });
        }
    });
    await page.goto('/create/homework/?quiz=7&lang=es');
    await expect(page.locator('#back')).toHaveText('Volver a la biblioteca');
    await expect(page.locator('#hwMineLink')).toHaveText('Mis deberes');
    await expect(page.locator('#hwMineLink')).toHaveAttribute('href', '/create/homework/');
    // Centrada: el margen izquierdo y el derecho de la tarjeta son iguales (si cabe en la página).
    const m = await page.locator('#hwNew').evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: document.documentElement.clientWidth - r.right }; });
    expect(Math.abs(m.left - m.right)).toBeLessThan(2);
    // 180 s es la última opción de tiempo.
    await expect(page.locator('#hwFTime option').last()).toHaveText('180 s');
    // Con un solo intento no hay elección de puntuación; con varios, sí.
    await expect(page.locator('#hwFScoring')).toHaveCount(0);
    await page.locator('#hwFAttempts').selectOption('3');
    await expect(page.locator('#hwFScoring')).toBeVisible();
    await page.locator('#hwFScoring').selectOption('average');
    await page.locator('#hwFTime').selectOption('180');
    await page.locator('#hwCreateBtn').click();
    await expect(page.locator('#hwLink')).toBeVisible();
    expect(page.__calls[0].options).toMatchObject({ attemptScoring: 'average', timePerQuestion: 180 });
});

test('resultados con media: la columna se llama «Puntuación media»', async ({ page }) => {
    await setup(page, {
        routes: async (p) => {
            await p.route('**/api/homeworks/ABCD2345/results', route => route.fulfill({
                json: { homework: HW({ scoring: 'average' }), students: 1, rows: [{ name: 'Ana', icon: '', state: 'finished', attempts: 2, bestScore: 1200, correctCount: 2, wrongCount: 1, answered: 3 }], questionStats: [] }
            }));
        }
    });
    await page.goto('/create/homework/?code=ABCD2345&lang=es');
    await expect(page.locator('#hwStudents .hw-sort', { hasText: 'Puntuación media' })).toBeVisible();
});
