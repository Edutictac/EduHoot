const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Red de seguridad del comportamiento actual de /create/quiz-creator/ antes de
// pasarlo a Vue. El servidor de los specs solo sirve estáticos: /api/** se
// mockea y /socket.io/socket.io.js se sustituye por un `io()` que guarda lo
// que emite la página (window.__emits) y deja lanzar eventos del servidor
// (window.__serverEmit).
const FAKE_SOCKET_IO = `
(function(){
    window.__emits = [];
    window.__sockets = [];
    window.io = function(){
        var handlers = {};
        var socket = {
            on: function(name, fn){ (handlers[name] = handlers[name] || []).push(fn); return socket; },
            emit: function(name, data){ window.__emits.push({ name: name, data: JSON.parse(JSON.stringify(data === undefined ? null : data)) }); return socket; },
            __trigger: function(name, data){ (handlers[name] || []).forEach(function(fn){ fn(data); }); }
        };
        window.__sockets.push(socket);
        return socket;
    };
    window.__serverEmit = function(name, data){ window.__sockets[0].__trigger(name, data); };
})();
`;

const editableQuiz = {
    id: 'q9',
    name: 'Repàs',
    tags: ['física', 'eso'],
    visibility: 'unlisted',
    allowClone: true,
    language: 'català',
    license: 'CC BY-SA 4.0',
    description: 'Un repàs curt',
    questions: [
        { question: 'Capital de França?', type: 'quiz', answers: ['Roma', 'París', 'Berlín', 'Lisboa'], correct: 2, correctAnswers: [2], time: 30 },
        { question: 'Quins són primers?', type: 'multiple', answers: ['2', '4', '5', '9'], correctAnswers: [1, 3], time: 20 },
        { question: 'Capital?', type: 'short-answer', acceptedAnswers: ['Madrid', 'madriz'], time: 20 },
        { question: 'Pi?', type: 'numeric', numericAnswer: 3.14, tolerance: 0.01, time: 20 }
    ]
};

async function mockBackend(page, options = {}) {
    const calls = { local: [], put: [] };
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: FAKE_SOCKET_IO
    }));
    await page.route('**/api/**', route => {
        const request = route.request();
        const { pathname } = new URL(request.url());
        if (pathname === '/api/auth/me') {
            return options.user
                ? route.fulfill({ json: options.user })
                : route.fulfill({ status: 401, json: { error: 'no auth' } });
        }
        if (pathname === '/api/tags') {
            return route.fulfill({ json: { tags: options.tags || [] } });
        }
        if (pathname === '/api/quizzes/local' && request.method() === 'POST') {
            calls.local.push(request.postDataJSON());
            return route.fulfill({ json: { id: 'new1' } });
        }
        const quiz = pathname.match(/^\/api\/quizzes\/([^/]+)$/);
        if (quiz && request.method() === 'PUT') {
            calls.put.push({ id: quiz[1], body: request.postDataJSON(), ownerToken: request.headers()['x-owner-token'] || null });
            return route.fulfill({ json: { ok: true } });
        }
        if (quiz && options.quiz) {
            return route.fulfill({ json: options.quiz });
        }
        return route.fulfill({ json: {} });
    });
    // Los clics de «Guardar»/«Jugar» acaban en /host/; no hace falta cargarlo.
    await page.route('**/host/**', route => route.fulfill({ contentType: 'text/html', body: '<p>host</p>' }));
    return calls;
}

// Recoge alert/confirm y responde a los confirm con `accept`.
function collectDialogs(page, accept = true) {
    const dialogs = [];
    page.on('dialog', dialog => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        return accept ? dialog.accept() : dialog.dismiss();
    });
    return dialogs;
}

const cards = page => page.locator('#allQuestions .question-card');
const card = (page, n) => page.locator(`.question-card[data-question="${n}"]`);

async function openCreator(page, query = '?lang=es') {
    await page.goto('/create/quiz-creator/' + query);
    await expect(cards(page)).toHaveCount(1);
}

async function fillBasics(page, { name = 'Mi quiz', tags = 'física, ESO' } = {}) {
    await page.locator('#name').fill(name);
    await page.locator('#tags').fill(tags);
}

test('arranca con una pregunta vacía de tipo quiz y textos en español', async ({ page }) => {
    await mockBackend(page);
    await openCreator(page);

    await expect(page.locator('#title')).toHaveText('Creador de quizzes');
    await expect(page.locator('[data-i18n="addQuestion"]')).toHaveText('+ Añadir pregunta');
    await expect(card(page, 1).locator('.pill')).toHaveText('Pregunta 1');
    await expect(page.locator('#type1')).toHaveValue('quiz');
    await expect(page.locator('#correct1')).toHaveValue('1');
    await expect(page.locator('#time1')).toHaveValue('20');
    await expect(page.locator('#type1 option')).toHaveCount(6);
    await expect(page.locator('#visibility')).toHaveValue('private');
    await expect(page.locator('#public-warning')).toBeHidden();
});

test('cambiar el idioma traduce la página y lo recuerda', async ({ page }) => {
    await mockBackend(page);
    await openCreator(page);
    await page.locator('#lang-select').selectOption('en');
    await expect(page.locator('#title')).toHaveText('Quiz builder');
    await page.reload();
    await expect(page.locator('#title')).toHaveText('Quiz builder');
});

test('el tipo de pregunta muestra solo los campos que le tocan', async ({ page }) => {
    await mockBackend(page);
    await openCreator(page);
    const c = card(page, 1);
    const answers = c.locator('.answers');
    const answerLabels = answers.locator('label');

    await expect(answers).toBeVisible();
    await expect(page.locator('#correct1')).toBeVisible();
    await expect(c.locator('.multi-correct')).toBeHidden();
    await expect(page.locator('#short1')).toBeHidden();
    await expect(page.locator('#num1')).toBeHidden();

    await page.locator('#type1').selectOption('multiple');
    await expect(c.locator('.multi-correct')).toBeVisible();
    await expect(page.locator('#correct1')).toBeHidden();

    await page.locator('[id="1a3"]').fill('tres');
    await page.locator('#type1').selectOption('true-false');
    await expect(answerLabels.nth(0)).toBeVisible();
    await expect(answerLabels.nth(2)).toBeHidden();
    await expect(answerLabels.nth(3)).toBeHidden();
    await expect(page.locator('[id="1a3"]')).toHaveValue('');
    await expect(page.locator('#correct1')).toBeVisible();

    await page.locator('[id="1a1"]').fill('uno');
    await page.locator('#type1').selectOption('short-answer');
    await expect(answers).toBeHidden();
    await expect(page.locator('#short1')).toBeVisible();
    await expect(page.locator('[id="1a1"]')).toHaveValue('');

    await page.locator('#type1').selectOption('numeric');
    await expect(page.locator('#num1')).toBeVisible();
    await expect(page.locator('#tol1')).toBeVisible();
    await expect(page.locator('#tol1')).toHaveValue('0');
    await expect(page.locator('#short1')).toBeHidden();

    await page.locator('#type1').selectOption('poll');
    await expect(answers).toBeVisible();
    await expect(page.locator('#correct1')).toBeHidden();
    await expect(page.locator('#num1')).toBeHidden();
});

test('añadir y eliminar preguntas renumera las tarjetas', async ({ page }) => {
    await mockBackend(page);
    const dialogs = collectDialogs(page);
    await openCreator(page);
    await page.locator('#q1').fill('Primera');
    await page.locator('[data-i18n="addQuestion"]').click();
    await page.locator('#q2').fill('Segunda');
    await page.locator('[data-i18n="addQuestion"]').click();
    await page.locator('#q3').fill('Tercera');
    await expect(cards(page)).toHaveCount(3);
    await expect(page.locator('#q3')).toBeFocused();

    await card(page, 1).locator('.question-card-head button').click();
    expect(dialogs).toEqual([{ type: 'confirm', message: '¿Eliminar esta pregunta?' }]);
    await expect(cards(page)).toHaveCount(2);
    await expect(card(page, 1).locator('.pill')).toHaveText('Pregunta 1');
    await expect(page.locator('#q1')).toHaveValue('Segunda');
    await expect(page.locator('#q2')).toHaveValue('Tercera');
    await expect(card(page, 2).locator('.pill')).toHaveText('Pregunta 2');
});

test('rechazar el confirm no elimina la pregunta', async ({ page }) => {
    await mockBackend(page);
    collectDialogs(page, false);
    await openCreator(page);
    await card(page, 1).locator('.question-card-head button').click();
    await expect(cards(page)).toHaveCount(1);
});

test('etiquetas sugeridas: se añaden al tocarlas y se marcan como activas', async ({ page }) => {
    await mockBackend(page, { tags: ['física', 'química'] });
    await openCreator(page);
    const suggestions = page.locator('#tag-suggestions');
    await expect(suggestions.locator('.label')).toHaveText('Etiquetas usadas (toca para añadir)');
    await expect(suggestions.locator('.tag')).toHaveText(['física', 'química']);

    await page.locator('#tags').fill('ESO');
    await suggestions.locator('.tag', { hasText: 'química' }).click();
    await expect(page.locator('#tags')).toHaveValue('eso, química');
    await expect(suggestions.locator('.tag.active')).toHaveText(['química']);
    // Tocar una que ya está no la duplica.
    await suggestions.locator('.tag', { hasText: 'química' }).click();
    await expect(page.locator('#tags')).toHaveValue('eso, química');
});

test('sin etiquetas conocidas no hay bloque de sugerencias', async ({ page }) => {
    await mockBackend(page);
    await openCreator(page);
    await expect(page.locator('#tag-suggestions')).toBeEmpty();
});

test('aviso de visibilidad: solo sin sesión y si no es privado', async ({ page }) => {
    await mockBackend(page);
    await openCreator(page);
    await page.locator('#visibility').selectOption('public');
    await expect(page.locator('#public-warning')).toBeVisible();
    await page.locator('#visibility').selectOption('unlisted');
    await expect(page.locator('#public-warning')).toBeVisible();
    await page.locator('#visibility').selectOption('private');
    await expect(page.locator('#public-warning')).toBeHidden();
});

test('con sesión no hay aviso y el título lleva el usuario', async ({ page }) => {
    await mockBackend(page, { user: { nickname: 'profe' } });
    await openCreator(page);
    await page.locator('#visibility').selectOption('public');
    await expect(page).toHaveTitle('Creator | EduHoot [profe]');
    await expect(page.locator('#public-warning')).toBeHidden();
});

test('validación: nombre, etiquetas y preguntas obligatorios', async ({ page }) => {
    const calls = await mockBackend(page);
    const dialogs = collectDialogs(page);
    await openCreator(page);

    await page.locator('[data-i18n="btnPlayLocal"]').click();
    await page.locator('#name').fill('  ');
    await page.locator('[data-i18n="btnSave"]').click();
    await page.locator('#name').fill('Quiz');
    await page.locator('[data-i18n="btnPlayLocal"]').click();
    await page.locator('#tags').fill('a');
    await card(page, 1).locator('.question-card-head button').click(); // confirm → acepta
    await page.locator('[data-i18n="btnPlayLocal"]').click();

    await expect.poll(() => dialogs.length).toBe(5);
    expect(dialogs.map(d => d.message)).toEqual([
        'Ponle un nombre',
        'Ponle un nombre',
        'Añade al menos una etiqueta',
        '¿Eliminar esta pregunta?',
        'Añade preguntas'
    ]);
    expect(calls.local).toEqual([]);
});

test('«Jugar sin guardar» crea un quiz anónimo con todo el payload y va a /host/', async ({ page }) => {
    const calls = await mockBackend(page);
    await openCreator(page);
    await fillBasics(page);
    await page.locator('#visibility').selectOption('unlisted');
    await page.locator('#allow-clone').check();
    await page.locator('#language').fill(' català ');
    await page.locator('#license').fill('CC BY');
    await page.locator('#description').fill('Desc');

    await page.locator('#q1').fill('Capital?');
    for (const [i, v] of ['Roma', 'París', 'Berlín', 'Lisboa'].entries()) {
        await page.locator(`[id="1a${i + 1}"]`).fill(v);
    }
    await page.locator('#correct1').fill('2');
    await page.locator('#time1').fill('200');
    await page.locator('#img1').fill('/icons/logo.svg');

    await page.locator('[data-i18n="addQuestion"]').click();
    await page.locator('#q2').fill('Primers?');
    await page.locator('#type2').selectOption('multiple');
    for (const [i, v] of ['2', '4', '5', '9'].entries()) {
        await page.locator(`[id="2a${i + 1}"]`).fill(v);
    }
    await card(page, 2).locator('.multi-correct input[value="1"]').check();
    await card(page, 2).locator('.multi-correct input[value="3"]').check();
    await page.locator('#time2').fill('2');

    await page.locator('[data-i18n="addQuestion"]').click();
    await page.locator('#q3').fill('Ciutat?');
    await page.locator('#type3').selectOption('short-answer');
    await page.locator('#short3').fill('Madrid|madrid, Barcelona');

    await page.locator('[data-i18n="addQuestion"]').click();
    await page.locator('#q4').fill('Pi?');
    await page.locator('#type4').selectOption('numeric');
    await page.locator('#num4').fill('3,14');
    await page.locator('#tol4').fill('0,01');

    await page.locator('[data-i18n="addQuestion"]').click();
    await page.locator('#q5').fill('Color?');
    await page.locator('#type5').selectOption('poll');
    await page.locator('[id="5a1"]').fill('Roig');
    await page.locator('[id="5a2"]').fill('Blau');

    await page.locator('[data-i18n="btnPlayLocal"]').click();
    await page.waitForURL('**/host/?id=new1');

    expect(calls.local).toHaveLength(1);
    const body = calls.local[0];
    expect(body.ownerToken).toMatch(/^[0-9a-f]{32}$/);
    delete body.ownerToken;
    expect(body).toEqual({
        name: 'Mi quiz',
        tags: ['física', 'eso'],
        visibility: 'unlisted',
        allowClone: true,
        language: 'català',
        license: 'CC BY',
        description: 'Desc',
        questions: [
            { question: 'Capital?', answers: ['Roma', 'París', 'Berlín', 'Lisboa'], correct: 2, correctAnswers: [2], type: 'quiz', time: 120, image: '/icons/logo.svg', video: '' },
            { question: 'Primers?', answers: ['2', '4', '5', '9'], correct: 1, correctAnswers: [1, 3], type: 'multiple', time: 20, image: '', video: '' },
            { question: 'Ciutat?', answers: ['', '', '', ''], correct: 1, correctAnswers: [1], type: 'short-answer', time: 20, image: '', video: '', acceptedAnswers: ['Madrid', 'Barcelona'] },
            { question: 'Pi?', answers: ['', '', '', ''], correct: 1, correctAnswers: [1], type: 'numeric', time: 20, image: '', video: '', numericAnswer: 3.14, tolerance: 0.01 },
            { question: 'Color?', answers: ['Roig', 'Blau', '', ''], correctAnswers: [], type: 'poll', time: 20, image: '', video: '' }
        ]
    });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('localQuizzes') || '[]'));
    expect(stored).toEqual(['new1']);
});

test('«Guardar» sin sesión también crea el quiz anónimo', async ({ page }) => {
    const calls = await mockBackend(page);
    await openCreator(page);
    await fillBasics(page);
    await page.locator('#q1').fill('P');
    await page.locator('[data-i18n="btnSave"]').click();
    await page.waitForURL('**/host/?id=new1');
    expect(calls.local).toHaveLength(1);
});

test('«Guardar» con sesión emite newQuiz y va a /host/ al recibir startGameFromCreator', async ({ page }) => {
    const calls = await mockBackend(page, { user: { nickname: 'profe' } });
    await openCreator(page);
    await fillBasics(page, { name: 'Amb sessió', tags: 'x' });
    await page.locator('#q1').fill('P');
    await page.locator('[data-i18n="btnSave"]').click();

    await expect.poll(() => page.evaluate(() => window.__emits.length)).toBe(1);
    const emit = await page.evaluate(() => window.__emits[0]);
    expect(emit.name).toBe('newQuiz');
    expect(emit.data).toMatchObject({ id: 0, name: 'Amb sessió', tags: ['x'], visibility: 'private' });
    expect(emit.data.questions).toHaveLength(1);
    expect(calls.local).toEqual([]);

    await page.evaluate(() => window.__serverEmit('startGameFromCreator', 'srv7'));
    await page.waitForURL('**/host/?id=srv7');
});

test('quizValidationError del servidor se muestra como alert', async ({ page }) => {
    await mockBackend(page, { user: { nickname: 'profe' } });
    const dialogs = collectDialogs(page);
    await openCreator(page);
    await page.evaluate(() => window.__serverEmit('quizValidationError', { error: 'Massa preguntes' }));
    await page.evaluate(() => window.__serverEmit('quizValidationError', null));
    await expect.poll(() => dialogs.map(d => d.message)).toEqual(['Massa preguntes', 'No se pudo guardar el quiz.']);
});

test('error del servidor al crear el quiz anónimo: alert y no navega', async ({ page }) => {
    await mockBackend(page);
    await page.route('**/api/quizzes/local', route => route.fulfill({ status: 400, json: { error: 'Quiz invàlid' } }));
    const dialogs = collectDialogs(page);
    await openCreator(page);
    await fillBasics(page);
    await page.locator('[data-i18n="btnPlayLocal"]').click();
    await expect.poll(() => dialogs.map(d => d.message)).toEqual(['Quiz invàlid']);
    expect(page.url()).toContain('/create/quiz-creator/');
});

test('?id= carga el quiz para editarlo con todos sus campos', async ({ page }) => {
    await mockBackend(page, { quiz: editableQuiz, tags: ['física'] });
    await page.goto('/create/quiz-creator/?id=q9&lang=es');
    await expect(cards(page)).toHaveCount(4);

    await expect(page.locator('#subtitle')).toHaveText('Editando quiz ID q9');
    await expect(page.locator('#name')).toHaveValue('Repàs');
    await expect(page.locator('#tags')).toHaveValue('física, eso');
    await expect(page.locator('#tag-suggestions .tag.active')).toHaveText(['física']);
    await expect(page.locator('#visibility')).toHaveValue('unlisted');
    await expect(page.locator('#allow-clone')).toBeChecked();
    await expect(page.locator('#language')).toHaveValue('català');
    await expect(page.locator('#license')).toHaveValue('CC BY-SA 4.0');
    await expect(page.locator('#description')).toHaveValue('Un repàs curt');

    await expect(page.locator('#q1')).toHaveValue('Capital de França?');
    await expect(page.locator('[id="1a2"]')).toHaveValue('París');
    await expect(page.locator('#correct1')).toHaveValue('2');
    await expect(page.locator('#time1')).toHaveValue('30');
    await expect(page.locator('#type2')).toHaveValue('multiple');
    await expect(card(page, 2).locator('.multi-correct input:checked')).toHaveCount(2);
    await expect(page.locator('#type3')).toHaveValue('short-answer');
    await expect(page.locator('#short3')).toHaveValue('Madrid|madriz');
    await expect(page.locator('#type4')).toHaveValue('numeric');
    await expect(page.locator('#num4')).toHaveValue('3.14');
    await expect(page.locator('#tol4')).toHaveValue('0.01');
});

test('editar y guardar hace PUT con el token anónimo y vuelve a /create/', async ({ page }) => {
    const calls = await mockBackend(page, { quiz: editableQuiz });
    const dialogs = collectDialogs(page);
    await page.addInitScript(() => localStorage.setItem('anonOwnerToken', 'tok123'));
    await page.goto('/create/quiz-creator/?id=q9&lang=es');
    await expect(cards(page)).toHaveCount(4);

    await page.locator('#name').fill('Repàs 2');
    await page.locator('[data-i18n="btnSave"]').click();
    await page.waitForURL(url => url.pathname === '/create/');

    expect(dialogs.map(d => d.message)).toEqual(['Quiz actualizado']);
    expect(calls.local).toEqual([]);
    expect(calls.put).toHaveLength(1);
    expect(calls.put[0].id).toBe('q9');
    expect(calls.put[0].ownerToken).toBe('tok123');
    expect(calls.put[0].body).toMatchObject({ name: 'Repàs 2', tags: ['física', 'eso'], visibility: 'unlisted', allowClone: true });
    expect(calls.put[0].body.questions).toHaveLength(4);
    expect(calls.put[0].body).not.toHaveProperty('id');
});

test('«Cancelar y volver» pide confirmación antes de salir', async ({ page }) => {
    await mockBackend(page);
    let accept = false;
    const messages = [];
    page.on('dialog', d => { messages.push(d.message()); return accept ? d.accept() : d.dismiss(); });
    await openCreator(page);

    await page.locator('[data-i18n="btnCancel"]').click();
    expect(messages).toEqual(['¿Seguro que quieres salir? Se perderán los cambios.']);
    expect(page.url()).toContain('/create/quiz-creator/');

    accept = true;
    await page.locator('[data-i18n="btnCancel"]').click();
    await page.waitForURL(url => url.pathname === '/create/');
});

test('vista previa de imagen y de vídeo de YouTube', async ({ page }) => {
    await mockBackend(page);
    await openCreator(page);
    const c = card(page, 1);
    await page.locator('#img1').fill('/icons/logo.svg');
    await expect(c.locator('.image-thumb')).toBeVisible();
    await page.locator('#img1').fill('');
    await expect(c.locator('.image-thumb')).toBeHidden();

    await page.locator('#vid1').fill('https://youtu.be/abc123');
    await expect(c.locator('iframe.video-thumb')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abc123');
    await expect(c.locator('iframe.video-thumb')).not.toHaveClass(/hidden/);
    await page.locator('#vid1').fill('');
    await expect(c.locator('iframe.video-thumb')).toHaveClass(/hidden/);
});
