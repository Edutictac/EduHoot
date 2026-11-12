const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Red de seguridad del comportamiento actual de /create/ (biblioteca,
// generador IA, importaciones y cuenta) antes de pasarlo a Vue. Complementa
// create-library.spec.js, auth-state.spec.js y chip-footer.spec.js. El
// servidor de los specs solo sirve estáticos: /api/** se mockea y
// /socket.io/socket.io.js se sustituye por un `io()` que guarda lo que emite
// la página (window.__emits) y deja lanzar eventos del servidor
// (window.__serverEmit).

const FAKE_SOCKET_IO = `
(function(){
    window.__emits = [];
    window.io = function(){
        var handlers = {};
        window.__serverEmit = function(name, data){ (handlers[name] || []).forEach(function(fn){ fn(data); }); };
        return {
            on: function(name, fn){ (handlers[name] = handlers[name] || []).push(fn); },
            emit: function(name){ window.__emits.push(name); },
            disconnect: function(){}, connect: function(){}
        };
    };
})();
`;

const TEACHER = { id: 'u1', email: 'teacher@example.invalid', role: 'editor', nickname: 'Profe' };
const ADMIN = { id: 'u9', email: 'admin@example.invalid', role: 'admin', nickname: '' };

function quiz(id, name, extra) {
    return Object.assign({
        id, name, tags: [], ownerId: 'other', ownerNickname: 'Teacher', visibility: 'public', allowClone: false,
        questionsCount: 2, playsCount: 0, playersCount: 0, ratingAvg: 0, ratingCount: 0, createdAt: '2026-01-01T00:00:00Z'
    }, extra);
}

const library = [
    quiz('q1', 'Geografia', { tags: ['socials', 'mapes'], ownerId: 'u1', playsCount: 7, playersCount: 21, createdAt: '2026-03-01T00:00:00Z', ratingAvg: 4, ratingCount: 2, allowClone: true }),
    quiz('q2', 'Àlgebra', { tags: ['mates'], ownerNickname: '', createdAt: '2026-01-01T00:00:00Z', ratingAvg: 5, ratingCount: 1 }),
    quiz('q3', 'Biologia', { tags: ['ciencies', 'socials'], visibility: 'private', createdAt: '2026-02-01T00:00:00Z', sourceQuizId: 'q1', sourceQuizName: 'Geografia', sourceOwnerNickname: 'Ana' })
];

async function mockBackend(page, options = {}) {
    const calls = { quizQueries: [], tagPatches: [], sharing: [], deleted: [], cloned: [], claimed: [], me: 0, uploads: [], kahoot: [], profile: [], admin: [] };
    const state = { user: options.user || null, quizzes: options.quizzes || library };
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    for (const target of ['**/host/**', '**/solo/?*', '**/multiplayer/?*', '**/create/quiz-creator/**', '**/api/admin/quizzes/export']) {
        await page.route(target, route => route.fulfill({ contentType: 'text/html', body: '<p>destí</p>' }));
    }
    await page.route('**/api/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        const { pathname } = url;
        const method = request.method();
        if (pathname === '/api/auth/me') {
            calls.me++;
            return state.user ? route.fulfill({ json: state.user }) : route.fulfill({ status: 401, json: { error: 'no' } });
        }
        if (pathname === '/api/auth/authentik/config') return route.fulfill({ json: { enabled: !!options.authentik } });
        if (pathname === '/api/admin/import-public-activities/config') return route.fulfill({ json: { enabled: !!options.importPublic } });
        if (pathname === '/api/tags') return route.fulfill({ json: { tags: options.tags || [] } });
        if (pathname === '/api/quizzes' && method === 'GET') {
            calls.quizQueries.push(url.search);
            return route.fulfill({ json: state.quizzes });
        }
        let m = pathname.match(/^\/api\/quizzes\/([^/]+)\/tags$/);
        if (m) { calls.tagPatches.push({ id: m[1], body: request.postDataJSON() }); return route.fulfill({ json: { ok: true } }); }
        m = pathname.match(/^\/api\/quizzes\/([^/]+)\/sharing$/);
        if (m) {
            calls.sharing.push({ id: m[1], body: request.postDataJSON() });
            return route.fulfill({ json: options.sharingResult || { ok: true } });
        }
        m = pathname.match(/^\/api\/quizzes\/([^/]+)\/clone$/);
        if (m) { calls.cloned.push(m[1]); return route.fulfill({ json: { id: 'c1' } }); }
        m = pathname.match(/^\/api\/quizzes\/([^/]+)\/claim$/);
        if (m) { calls.claimed.push({ id: m[1], token: request.headers()['x-owner-token'] }); return route.fulfill({ json: { ok: true } }); }
        m = pathname.match(/^\/api\/quizzes\/([^/]+)$/);
        if (m && method === 'DELETE') { calls.deleted.push(m[1]); return route.fulfill({ json: { ok: true } }); }
        if (pathname === '/api/upload-csv') {
            calls.uploads.push(request.postData() || '');
            if (options.uploadError) return route.fulfill({ status: 400, json: { error: options.uploadError } });
            return route.fulfill({ json: { id: 'n1', name: 'Nou', count: 3 } });
        }
        if (pathname === '/api/import/kahoot') {
            calls.kahoot.push(request.postDataJSON());
            if (options.kahootError) return route.fulfill({ status: 400, json: { error: options.kahootError } });
            return route.fulfill({ json: { id: 'k1', name: 'Kahoot', count: 4 } });
        }
        if (pathname === '/api/auth/profile') { calls.profile.push(request.postDataJSON()); return route.fulfill({ json: { ok: true } }); }
        if (pathname.startsWith('/api/admin/')) {
            calls.admin.push(pathname);
            return route.fulfill({ json: { imported: 3, total: 5, skipped: 2 } });
        }
        return route.fulfill({ json: {} });
    });
    return { calls, state };
}

const cards = page => page.locator('#game-list .game-card');
// Por el título exacto: «Basado en "Geografia"» de otra tarjeta no cuenta.
const card = (page, name) => cards(page).filter({ has: page.locator('.game-title').getByText(name, { exact: true }) });
const titles = page => page.locator('#game-list .game-title');
const tagButtons = page => page.locator('#tag-suggestions button.tag');

async function openCreate(page, query = '?lang=es') {
    await page.goto('/create/' + query);
    await expect(cards(page).first()).toBeVisible();
}

function collectDialogs(page, accept = true) {
    const dialogs = [];
    page.on('dialog', d => { dialogs.push(d.message()); return accept ? d.accept() : d.dismiss(); });
    return dialogs;
}

// ---------- Biblioteca ----------

test('biblioteca sin sesión: tarjetas, recuento, metadatos y permisos', async ({ page }) => {
    await mockBackend(page);
    await openCreate(page);

    await expect(page.locator('#game-count')).toHaveText('3 cuestionarios');
    await expect(page.locator('#filter-info')).toHaveText('Sin filtros');
    // Por defecto, más recientes primero.
    await expect(titles(page)).toHaveText(['Geografia', 'Biologia', 'Àlgebra']);

    const geo = card(page, 'Geografia');
    await expect(geo.locator('.badge')).toHaveText('ID q1');
    await expect(geo.locator('.game-meta')).toHaveText('Teacher · Público');
    await expect(geo.locator('.game-stats__item')).toHaveText(['7 partidas', '21 jugadores']);
    await expect(geo.locator('.tag-wrap .tag')).toHaveText(['socials', 'mapes']);
    await expect(card(page, 'Àlgebra').locator('.game-meta')).toHaveText('Creador desconocido · Público');
    await expect(card(page, 'Biologia').locator('.game-meta')).toHaveText('Teacher · Solo yo (privado) · Basado en "Geografia" (ID q1) · de Ana');

    // Sin sesión y sin ser propietario: no se edita, borra ni clona.
    await expect(geo.locator('button', { hasText: '✏️' })).toBeDisabled();
    await expect(geo.locator('button', { hasText: '✏️' })).toHaveAttribute('title', 'Solo el propietario puede editar este quiz.');
    await expect(geo.locator('button.btn-danger')).toBeDisabled();
    await expect(geo.locator('button', { hasText: '📄' })).toBeDisabled();
    await expect(geo.locator('button', { hasText: '📄' })).toHaveAttribute('title', 'No puedes clonar este quiz.');
    await expect(geo.locator('.share-controls select')).toBeDisabled();
    await expect(geo.locator('.share-controls select')).toHaveValue('public');
    await expect(geo.locator('.share-controls button')).toBeDisabled();
    await expect(geo.locator('.tag-editor')).toHaveCount(0);
    await expect(geo.locator('.tag-remove')).toHaveCount(0);
    await expect(geo.locator('button', { hasText: 'Guardar en mi cuenta' })).toHaveCount(0);
    await expect(geo.locator('.game-actions > button.btn-primary')).toHaveText('Jugar en el aula');
    await expect(geo.locator('.game-actions > button')).toHaveText(['Jugar en el aula', 'Multijugador', 'Solo', '✏️', '⬇️', '', '📄', '🗑️']);

    // Privado de otro: no se puede lanzar.
    const bio = card(page, 'Biologia');
    for (const label of ['Jugar en el aula', 'Multijugador', 'Solo']) {
        await expect(bio.locator('.game-actions > button', { hasText: label })).toBeDisabled();
        await expect(bio.locator('.game-actions > button', { hasText: label })).toHaveAttribute('title', 'Solo el propietario puede usar un quiz privado.');
    }

    await expect(page.locator('#new-user-signin')).toBeHidden();
    await expect(page.locator('#open-account')).toBeHidden();
});

test('sin sesión, un quiz anónimo propio (localQuizzes) se puede editar y «Guardar en mi cuenta» pide entrar', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('localQuizzes', JSON.stringify(['q2'])));
    const { calls } = await mockBackend(page);
    await openCreate(page);
    expect(calls.quizQueries[0]).toContain('localIds=q2');
    const alg = card(page, 'Àlgebra');
    await expect(alg.locator('button', { hasText: '✏️' })).toBeEnabled();
    await expect(alg.locator('button.btn-danger')).toBeEnabled();
    await expect(alg.locator('.share-controls select')).toBeEnabled();
    await expect(alg.locator('.tag-editor input')).toHaveAttribute('placeholder', 'Añadir etiqueta (se guardará sin tildes ni símbolos)');
    await expect(alg.locator('.tag-editable .tag-text')).toHaveText(['mates']);
    // Clonar exige sesión aunque sea propio.
    await expect(alg.locator('button', { hasText: '📄' })).toBeDisabled();

    await alg.locator('.game-actions > button', { hasText: 'Guardar en mi cuenta' }).click();
    // requireLogin() pone «Entra con tu cuenta…», pero sin el xip de Commons
    // (aquí no se carga) openCentralAccountMenu() lo sustituye por este aviso.
    await expect(page.locator('#auth-message')).toHaveText('No se puede conectar con la cuenta EduTicTac. Vuelve a intentarlo en un momento.');
    expect(await page.evaluate(() => localStorage.getItem('eduhoot-pending-account-save'))).toBe('q2');
    expect(calls.claimed).toEqual([]);
});

test('con sesión: marca «Sólo mis cuestionarios», pide mine=1 y reclama el quiz pendiente', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('anonOwnerToken', 'tok1');
        localStorage.setItem('eduhoot-pending-account-save', 'q2');
    });
    const { calls } = await mockBackend(page, { user: TEACHER, authentik: true });
    await openCreate(page);
    await expect(page.locator('#filter-mine')).toBeChecked();
    await expect.poll(() => calls.quizQueries.some(q => q.includes('mine=1'))).toBe(true);
    await expect(page.locator('#filter-info')).toHaveText('Sólo mis cuestionarios');
    await expect.poll(() => calls.claimed.length).toBe(1);
    expect(calls.claimed[0]).toEqual(expect.objectContaining({ id: 'q2', token: 'tok1' }));
    expect(calls.me).toBe(1);
    await expect(page.locator('#auth-message')).toHaveText('Cuestionario guardado en tu cuenta.');
    await expect(page).toHaveTitle(/\[Profe\]$/);
    await expect(page.locator('#new-user-signin')).toBeHidden();
    await expect(page.locator('#open-account')).toBeVisible();

    // Propio (ownerId = u1): editable y clonable.
    const geo = card(page, 'Geografia');
    await expect(geo.locator('button', { hasText: '✏️' })).toBeEnabled();
    await expect(geo.locator('button', { hasText: '📄' })).toBeEnabled();
    await expect(geo.locator('button', { hasText: '📄' })).toHaveAttribute('title', 'Hacer una copia');
    // De otro, sin permitir copia: no.
    await expect(card(page, 'Àlgebra').locator('button', { hasText: '📄' })).toBeDisabled();

    await page.locator('#filter-mine').uncheck();
    await expect.poll(() => calls.quizQueries[calls.quizQueries.length - 1].includes('mine=1')).toBe(false);
});

test('sin cuestionarios: estado vacío y sin paginación', async ({ page }) => {
    await mockBackend(page, { quizzes: [] });
    await page.goto('/create/?lang=es');
    await expect(page.locator('#game-list .empty-state p')).toHaveText(['No hay cuestionarios importados aún.', 'Sube un CSV o crea uno nuevo para verlo aquí.']);
    await expect(page.locator('#game-count')).toHaveText('0 cuestionarios');
    await expect(page.locator('#library-pagination')).toBeHidden();
});

test('búsqueda por nombre o por etiqueta (sin tildes) y orden', async ({ page }) => {
    await mockBackend(page);
    await openCreate(page);
    await page.locator('#library-search').fill('ciències');
    await expect(titles(page)).toHaveText(['Biologia']);
    await page.locator('#library-search').fill('ALG');
    await expect(titles(page)).toHaveText([]);
    await page.locator('#library-search').fill('àlg');
    await expect(titles(page)).toHaveText(['Àlgebra']);
    await expect(page.locator('#game-count')).toHaveText('1 cuestionario');
    await page.locator('#library-search').fill('');

    await page.locator('#library-sort').selectOption('oldest');
    await expect(titles(page)).toHaveText(['Àlgebra', 'Biologia', 'Geografia']);
    await page.locator('#library-sort').selectOption('rating');
    await expect(titles(page)).toHaveText(['Àlgebra', 'Geografia', 'Biologia']);
    await page.locator('#library-sort').selectOption('alpha-asc');
    await expect(titles(page)).toHaveText(['Àlgebra', 'Biologia', 'Geografia']);
    await page.locator('#library-sort').selectOption('alpha-desc');
    await expect(titles(page)).toHaveText(['Geografia', 'Biologia', 'Àlgebra']);
});

test('carpetas: etiquetas conocidas, filtrar, modo todas/cualquiera, URL y «Todos»', async ({ page }) => {
    const { calls } = await mockBackend(page, { tags: ['socials', 'mates', 'ciencies', 'mapes'] });
    await openCreate(page);
    await expect(page.locator('#tag-suggestions .label')).toHaveText('Carpetas');
    // «Todos» y después por frecuencia en la biblioteca y alfabético.
    await expect(tagButtons(page)).toHaveText(['Todos', 'socials', 'ciencies', 'mapes', 'mates']);
    await expect(tagButtons(page).first()).toHaveClass(/\bactive\b/);
    await expect(tagButtons(page).filter({ hasText: 'socials' })).toHaveAttribute('data-weight', '1.00');
    await expect(tagButtons(page).filter({ hasText: 'mates' })).toHaveAttribute('data-weight', '0.50');
    await expect(page.locator('#tag-mode-toggle')).toHaveText('Todas las etiquetas');
    await expect(page.locator('#tag-mode-toggle')).toHaveAttribute('aria-pressed', 'true');

    await tagButtons(page).filter({ hasText: 'socials' }).click();
    await expect.poll(() => calls.quizQueries[calls.quizQueries.length - 1]).toBe('?tags=socials&tagMode=all');
    await expect(page).toHaveURL(/\/create\/\?lang=es&tags=socials&tagMode=all$/);
    await expect(page.locator('#filter-info')).toHaveText('Filtrando por: socials · Coincide con todas');
    await expect(tagButtons(page).filter({ hasText: 'socials' })).toHaveClass(/\bactive\b/);
    await expect(tagButtons(page).first()).not.toHaveClass(/\bactive\b/);

    await page.locator('#tag-mode-toggle').click();
    await expect(page.locator('#tag-mode-toggle')).toHaveText('Cualquiera de las etiquetas');
    await expect(page.locator('#tag-mode-toggle')).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => calls.quizQueries[calls.quizQueries.length - 1]).toBe('?tags=socials&tagMode=any');
    await expect(page.locator('#filter-info')).toHaveText('Filtrando por: socials · Coincide con cualquiera');

    // Clic en una etiqueta de la tarjeta también filtra.
    await card(page, 'Geografia').locator('.tag-wrap .tag', { hasText: 'mapes' }).click();
    await expect.poll(() => calls.quizQueries[calls.quizQueries.length - 1]).toBe('?tags=socials&tags=mapes&tagMode=any');

    await tagButtons(page).first().click();
    await expect.poll(() => calls.quizQueries[calls.quizQueries.length - 1]).toBe('');
    await expect(page).toHaveURL(/\/create\/\?lang=es$/);
    await expect(page.locator('#filter-info')).toHaveText('Sin filtros');
});

test('?tags=… de la URL se normaliza y «Limpiar filtros» lo quita todo', async ({ page }) => {
    const { calls } = await mockBackend(page);
    await page.goto('/create/?lang=es&tags=Física,2º ESO&tagMode=any');
    await expect(cards(page).first()).toBeVisible();
    expect(calls.quizQueries[0]).toBe('?tags=fisica&tags=2-eso&tagMode=any');
    await expect(page.locator('#tag-mode-toggle')).toHaveText('Cualquiera de las etiquetas');
    await page.locator('#library-search').fill('geo');
    await page.locator('#clear-filters').click();
    await expect(page.locator('#library-search')).toHaveValue('');
    await expect.poll(() => calls.quizQueries[calls.quizQueries.length - 1]).toBe('');
    await expect(page.locator('#tag-mode-toggle')).toHaveText('Todas las etiquetas');
});

test('«Ver más» muestra el resto de carpetas y «Ver menos» las recoge', async ({ page }) => {
    const many = Array.from({ length: 15 }, (_, i) => 'tag' + String(i).padStart(2, '0'));
    await mockBackend(page, { tags: many });
    await openCreate(page);
    await expect(tagButtons(page)).toHaveCount(1 + 12 + 1);
    await expect(tagButtons(page).last()).toHaveText('Ver más (3)');
    await expect(tagButtons(page).last()).toHaveClass(/tag-more/);
    await tagButtons(page).last().click();
    await expect(tagButtons(page)).toHaveCount(1 + 15 + 1);
    await expect(tagButtons(page).last()).toHaveText('Ver menos');
    await tagButtons(page).last().click();
    await expect(tagButtons(page)).toHaveCount(14);
});

test('paginación de 12 en 12', async ({ page }) => {
    const many = Array.from({ length: 13 }, (_, i) => quiz('p' + i, 'Quiz ' + String(i).padStart(2, '0'), { createdAt: '2026-01-' + String(i + 1).padStart(2, '0') + 'T00:00:00Z' }));
    await mockBackend(page, { quizzes: many });
    await openCreate(page);
    await expect(cards(page)).toHaveCount(12);
    await expect(page.locator('#library-pagination')).toBeVisible();
    await expect(page.locator('#library-pagination-info')).toHaveText('Página 1 de 2');
    await expect(page.locator('#library-pagination-prev')).toBeDisabled();
    await page.locator('#library-pagination-next').click();
    await expect(titles(page)).toHaveText(['Quiz 00']);
    await expect(page.locator('#library-pagination-info')).toHaveText('Página 2 de 2');
    await expect(page.locator('#library-pagination-next')).toBeDisabled();
    // Cambiar el orden vuelve a la primera página.
    await page.locator('#library-sort').selectOption('oldest');
    await expect(page.locator('#library-pagination-info')).toHaveText('Página 1 de 2');
    await expect(titles(page).first()).toHaveText('Quiz 00');
});

test('editar etiquetas de un quiz propio: añadir, quitar y mínimo una', async ({ page }) => {
    const { calls } = await mockBackend(page, { user: TEACHER });
    const dialogs = collectDialogs(page);
    await openCreate(page);
    const geo = card(page, 'Geografia');
    await geo.locator('.tag-editor input').fill('Física, 3º ESO');
    await geo.locator('.tag-editor input').press('Enter');
    await expect.poll(() => calls.tagPatches).toEqual([{ id: 'q1', body: { tags: ['socials', 'mapes', 'fisica', '3-eso'] } }]);
    await expect(geo.locator('.tag-editor input')).toHaveValue('');
    await expect.poll(() => page.evaluate(() => window.__emits.includes('requestDbNames'))).toBe(true);

    await geo.locator('.tag-editor input').fill('nova');
    await geo.locator('.tag-editor button').click();
    await expect.poll(() => calls.tagPatches.length).toBe(2);
    expect(calls.tagPatches[1].body.tags).toEqual(['socials', 'mapes', 'nova']);

    await geo.locator('.tag-editable', { hasText: 'mapes' }).locator('.tag-remove').click();
    await expect.poll(() => calls.tagPatches.length).toBe(3);
    expect(calls.tagPatches[2].body.tags).toEqual(['socials']);

    expect(dialogs).toEqual([]);
});

test('una etiqueta sola no se puede quitar', async ({ page }) => {
    await mockBackend(page, { user: TEACHER, quizzes: [quiz('q1', 'Única', { tags: ['sola'], ownerId: 'u1' })] });
    const dialogs = collectDialogs(page);
    await openCreate(page);
    await card(page, 'Única').locator('.tag-remove').click();
    await expect.poll(() => dialogs).toEqual(['Debe quedar al menos una etiqueta.']);
});

test('guardar permisos: visibilidad y copia, y migración del id anónimo', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('localQuizzes', JSON.stringify(['q2'])));
    const { calls } = await mockBackend(page, { sharingResult: { migrated: true, id: 'q2b' } });
    await openCreate(page);
    const alg = card(page, 'Àlgebra');
    await expect(alg.locator('.share-row strong')).toHaveText('Guardar permisos');
    await alg.locator('.share-controls select').selectOption('unlisted');
    await alg.locator('.share-controls input[type="checkbox"]').check();
    await expect(alg.locator('.share-controls label')).toHaveText('Permitir copia');
    await alg.locator('.share-controls button').click();
    await expect.poll(() => calls.sharing).toEqual([{ id: 'q2', body: { visibility: 'unlisted', allowClone: true } }]);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('localQuizzes')))).toEqual(['q2b']);
});

test('clonar con sesión y borrar con confirmación', async ({ page }) => {
    const { calls } = await mockBackend(page, { user: TEACHER });
    const dialogs = collectDialogs(page);
    await openCreate(page);
    await card(page, 'Geografia').locator('button', { hasText: '📄' }).click();
    await expect.poll(() => dialogs).toEqual(['Copia creada en tu biblioteca.']);
    expect(calls.cloned).toEqual(['q1']);

    await card(page, 'Geografia').locator('button.btn-danger').click();
    await expect.poll(() => dialogs.length).toBe(2);
    expect(dialogs[1]).toBe('¿Eliminar este quiz?');
    await expect.poll(() => calls.deleted).toEqual(['q1']);
});

test('rechazar el borrado no borra', async ({ page }) => {
    const { calls } = await mockBackend(page, { user: TEACHER });
    collectDialogs(page, false);
    await openCreate(page);
    await card(page, 'Geografia').locator('button.btn-danger').click();
    await page.waitForTimeout(200);
    expect(calls.deleted).toEqual([]);
});

test('botones de jugar y editar llevan a su pantalla', async ({ page }) => {
    await mockBackend(page, { user: TEACHER });
    await openCreate(page);
    for (const [label, re] of [['Jugar en el aula', /\/host\/\?id=q1$/], ['Multijugador', /\/multiplayer\/\?id=q1$/], ['Solo', /\/solo\/\?id=q1$/], ['✏️', /\/create\/quiz-creator\/\?id=q1$/]]) {
        await card(page, 'Geografia').locator('.game-actions > button', { hasText: label }).click();
        await expect(page).toHaveURL(re);
        await openCreate(page);
    }
});

test('exportar: Moodle y el desplegable llaman a la función de cada formato', async ({ page }) => {
    await mockBackend(page);
    await openCreate(page);
    await page.evaluate(() => {
        window.__exports = [];
        window.downloadMoodleXml = id => window.__exports.push(['moodle', id]);
        window.downloadPdf = (id, o) => window.__exports.push(['pdf', id, o]);
        window.downloadDocx = (id, o) => window.__exports.push(['docx', id, o]);
        window.downloadOdt = (id, o) => window.__exports.push(['odt', id, o]);
    });
    const geo = card(page, 'Geografia');
    await geo.locator('.game-actions > button[title="Exportar XML (Moodle)"]').click();
    const select = geo.locator('select.export-select');
    await expect(select).toHaveAttribute('aria-label', 'Exportar');
    await expect(select.locator('option').first()).toHaveText('Exportar...');
    await expect(select.locator('optgroup')).toHaveCount(3);
    await select.selectOption('pdf-random-no-answers');
    await expect(select).toHaveValue('');
    await select.selectOption('docx-no-images');
    await select.selectOption('odt-normal');
    expect(await page.evaluate(() => window.__exports)).toEqual([
        ['moodle', 'q1'],
        ['pdf', 'q1', { includeAnswers: false, shuffleQuestions: true, shuffleAnswers: true }],
        ['docx', 'q1', { includeAnswers: true, includeImages: false }],
        ['odt', 'q1', { includeAnswers: true, includeImages: true }]
    ]);
});

test('gameNamesData del servidor vuelve a pedir la biblioteca y las etiquetas', async ({ page }) => {
    const { calls, state } = await mockBackend(page);
    await openCreate(page);
    state.quizzes = [library[0]];
    const before = calls.quizQueries.length;
    await page.evaluate(() => window.__serverEmit('gameNamesData', []));
    await expect(cards(page)).toHaveCount(1);
    expect(calls.quizQueries.length).toBe(before + 1);
});

test('cambiar de idioma traduce las tarjetas y las carpetas', async ({ page }) => {
    await mockBackend(page, { tags: ['socials'] });
    await openCreate(page);
    await page.locator('#lang-select').selectOption('en');
    // Las tarjetas se repintan cuando el servidor responde a requestDbNames.
    expect(await page.evaluate(() => window.__emits.filter(n => n === 'requestDbNames').length)).toBeGreaterThan(0);
    await page.evaluate(() => window.__serverEmit('gameNamesData', []));
    await expect(card(page, 'Geografia').locator('.game-actions > button.btn-primary')).toHaveText('Play in the classroom');
    await expect(page.locator('#title')).toHaveText('Create and launch your EduHoot');
    await expect(page.locator('#tag-mode-toggle')).toHaveText('Match all tags');
    await expect(page.locator('#game-count')).toHaveText(/^3 /);
});

// ---------- Importación ----------

test('subir CSV: sin archivo avisa; con archivo envía nombre y token y ofrece jugar', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('anonOwnerToken', 'tok1'));
    const { calls } = await mockBackend(page);
    await openCreate(page);
    await page.locator('#csv-import summary').click();
    // El input es «required»: se envía el formulario a mano para ver el aviso.
    await page.evaluate(() => document.getElementById('csv-form').requestSubmit ? document.getElementById('csv-form').dispatchEvent(new Event('submit', { cancelable: true })) : null);
    await expect(page.locator('#csv-status')).toHaveText('Selecciona un archivo CSV.');

    await page.locator('#csv-file').setInputFiles({ name: 'q.csv', mimeType: 'text/csv', buffer: Buffer.from('tipo;pregunta\n') });
    await page.locator('#csv-name').fill('  Nou  ');
    await page.locator('#csv-form button[type="submit"]').click();
    await expect(page.locator('#csv-status')).toHaveText('Importado: Nou (3) Jugar en el aula');
    expect(calls.uploads[0]).toContain('name="name"\r\n\r\nNou');
    expect(calls.uploads[0]).toContain('name="ownerToken"\r\n\r\ntok1');
    await expect(page.locator('#csv-name')).toHaveValue('');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('localQuizzes')))).toEqual(['n1']);
    await page.locator('#csv-status button').click();
    await expect(page).toHaveURL(/\/host\/\?id=n1$/);
});

test('subir CSV con error del servidor', async ({ page }) => {
    await mockBackend(page, { uploadError: 'CSV mal format' });
    await openCreate(page);
    await page.locator('#csv-import summary').click();
    await page.locator('#csv-file').setInputFiles({ name: 'q.csv', mimeType: 'text/csv', buffer: Buffer.from('x') });
    await page.locator('#csv-form button[type="submit"]').click();
    await expect(page.locator('#csv-status')).toHaveText('CSV mal format');
});

test('importar Kahoot: URL o ID, visibilidad y botones de jugar/editar', async ({ page }) => {
    const { calls } = await mockBackend(page);
    await openCreate(page);
    await page.locator('#csv-import summary').click();
    await page.locator('#kahoot-url').fill('https://create.kahoot.it/details/abc');
    await page.locator('#kahoot-visibility').selectOption('unlisted');
    await page.locator('#kahoot-form button[type="submit"]').click();
    await expect(page.locator('#kahoot-status')).toHaveText('Importado: Kahoot (4) Jugar en el aulaEditar cuestionario');
    expect(calls.kahoot[0]).toMatchObject({ url: 'https://create.kahoot.it/details/abc', visibility: 'unlisted' });
    expect(calls.kahoot[0].ownerToken).toMatch(/^[0-9a-f]{32}$/);
    await expect(page.locator('#kahoot-form button[type="submit"]')).toBeEnabled();
    expect(await page.evaluate(() => window.__emits.includes('requestDbNames'))).toBe(true);

    await page.locator('#kahoot-url').fill('abc-123');
    await page.locator('#kahoot-form button[type="submit"]').click();
    await expect.poll(() => calls.kahoot.length).toBe(2);
    expect(calls.kahoot[1]).toMatchObject({ id: 'abc-123' });
    expect(calls.kahoot[1].url).toBeUndefined();

    await page.locator('#kahoot-status button', { hasText: 'Editar cuestionario' }).click();
    await expect(page).toHaveURL(/\/create\/quiz-creator\/\?id=k1$/);
});

test('importar Kahoot con error', async ({ page }) => {
    await mockBackend(page, { kahootError: 'No és públic' });
    await openCreate(page);
    await page.locator('#csv-import summary').click();
    await page.locator('#kahoot-url').fill('x');
    await page.locator('#kahoot-form button[type="submit"]').click();
    await expect(page.locator('#kahoot-status')).toHaveText('No és públic');
});

// ---------- Generador IA ----------

test('IA: el prompt recoge los campos, idioma propio, tipos y modo documentos', async ({ page }) => {
    await mockBackend(page);
    await openCreate(page);
    await page.locator('#ia-box summary').click();
    await expect(page.locator('#ia-prompt')).toHaveText('El prompt aparecerá aquí...');
    await page.locator('#ia-nivel').fill('2º ESO');
    await page.locator('#ia-tema').fill('Energia');
    await expect(page.locator('#ia-idioma-custom')).toBeHidden();
    await page.locator('#ia-idioma').selectOption('otro');
    await expect(page.locator('#ia-idioma-custom')).toBeVisible();
    await page.locator('#ia-idioma-custom').fill('Euskera');
    await page.locator('#ia-num').fill('7');
    await page.locator('#ia-extra').fill('Curt');
    await page.locator('#ia-type-quiz').uncheck();
    await page.locator('#ia-type-tf').check();
    await page.locator('#ia-type-numeric').check();
    await page.locator('#ia-generate').click();
    const prompt = JSON.parse(await page.locator('#ia-prompt').textContent());
    expect(prompt).toMatchObject({
        nivel: '2º ESO', tema: 'Energia', idioma: 'Euskera', numero_preguntas: 7,
        tipos: ['true-false', 'numeric'], usar_documentos: false, generar_imagenes_svg: false, instrucciones: 'Curt'
    });
    expect(prompt.notas.some(n => n.includes("déjala VACÍA"))).toBe(true);

    // Modo documentos: oculta el tema, enseña la pista y se recuerda.
    await expect(page.locator('#ia-docs-hint')).toBeHidden();
    await page.locator('#ia-use-docs').check();
    await expect(page.locator('#ia-docs-hint')).toBeVisible();
    await expect(page.locator('#ia-tema')).toBeDisabled();
    await expect(page.locator('#ia-tema')).toHaveValue('');
    await page.locator('#ia-generate').click();
    expect(JSON.parse(await page.locator('#ia-prompt').textContent())).toMatchObject({ tema: '', usar_documentos: true });
    expect(await page.evaluate(() => localStorage.getItem('eduh_ia_use_docs'))).toBe('1');

    // Volver a «Español» oculta y vacía el idioma propio.
    await page.locator('#ia-idioma').selectOption('Español');
    await expect(page.locator('#ia-idioma-custom')).toBeHidden();
    await expect(page.locator('#ia-idioma-custom')).toHaveValue('');
    // Las imágenes SVG solo se ofrecen con sesión.
    await expect(page.locator('#ia-gen-svg-wrap')).toBeHidden();
});

test('IA con sesión: opción de imágenes SVG en el prompt', async ({ page }) => {
    await mockBackend(page, { user: TEACHER });
    await openCreate(page);
    await page.locator('#ia-box summary').click();
    await expect(page.locator('#ia-gen-svg-wrap')).toBeVisible();
    await page.locator('#ia-gen-svg').check();
    await page.locator('#ia-generate').click();
    const prompt = JSON.parse(await page.locator('#ia-prompt').textContent());
    expect(prompt.generar_imagenes_svg).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('eduh_ia_gen_svg'))).toBe('1');
});

const IA_CSV = [
    'tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia',
    'quiz;Capital?;París;Roma;;;20;1;https://upload.wikimedia.org/x.png;;;;',
    'multiple;Primers?;2;4;5;;20;1,3;;;;;',
    'short-answer;Ciutat?;;;;;20;;;;Madrid|Barcelona;;',
    'numeric;Pi?;;;;;20;;;;;3,14;0,01'
].join('\n');

test('IA: vista previa limpia imágenes externas y marca las correctas', async ({ page }) => {
    await mockBackend(page);
    await openCreate(page);
    await page.locator('#ia-box summary').click();
    await page.locator('#ia-preview').click();
    await expect(page.locator('#ia-preview-box')).toBeVisible();
    await expect(page.locator('#ia-preview-content')).toHaveText('Pega primero el CSV.');

    await page.locator('#ia-csv').fill(IA_CSV);
    await page.locator('#ia-preview').click();
    await expect(page.locator('#ia-csv')).not.toHaveValue(/wikimedia/);
    const qs = page.locator('#ia-preview-content .ia-preview__q');
    await expect(qs.locator('.ia-preview__qtitle')).toHaveText(['1. Capital?', '2. Primers?', '3. Ciutat?', '4. Pi?']);
    await expect(qs.nth(0).locator('.ia-preview__answer')).toHaveText(['✓París', '•Roma']);
    await expect(qs.nth(0).locator('.ia-preview__answer.is-correct')).toHaveText(['✓París']);
    await expect(qs.nth(1).locator('.ia-preview__answer.is-correct')).toHaveText(['✓2', '✓5']);
    await expect(qs.nth(2).locator('.ia-preview__answer')).toHaveText(['✓Madrid', '✓Barcelona']);
    await expect(qs.nth(3).locator('.ia-preview__answer')).toHaveText(['✓3,14 ± 0,01']);
});

test('IA: descargar CSV añade la cabecera; vacío avisa', async ({ page }) => {
    await mockBackend(page);
    const dialogs = collectDialogs(page);
    await openCreate(page);
    await page.locator('#ia-box summary').click();
    await page.locator('#ia-download').click();
    await expect.poll(() => dialogs).toEqual(['No hay nada que guardar.']);
    await page.locator('#ia-csv').fill('quiz;Capital?;París;Roma;;;20;1;;;;;');
    const download = page.waitForEvent('download');
    await page.locator('#ia-download').click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('quiz.csv');
    const text = require('fs').readFileSync(await file.path(), 'utf8');
    expect(text).toBe('﻿Tipo;Pregunta;R1;R2;R3;R4;Tiempo;Correcta;URL Imagen;Video;Texto;Numero;Tolerancia\nquiz;Capital?;París;Roma;;;20;1;;;;;');
});

test('IA: abrir un CSV lo carga en el cuadro', async ({ page }) => {
    await mockBackend(page);
    await openCreate(page);
    await page.locator('#ia-box summary').click();
    await page.locator('#ia-csv-file').setInputFiles({ name: 'a.csv', mimeType: 'text/csv', buffer: Buffer.from('quiz;Hola?;a;b;;;20;1;;;;;') });
    await expect(page.locator('#ia-csv')).toHaveValue('quiz;Hola?;a;b;;;20;1;;;;;');
});

test('IA: importar el CSV con etiquetas de nivel, tema e idioma, y editar en el creador', async ({ page }) => {
    const { calls } = await mockBackend(page);
    await openCreate(page);
    await page.locator('#ia-box summary').click();
    await page.locator('#ia-upload').click();
    await expect(page.locator('#ia-status')).toHaveText('Selecciona un archivo CSV.');
    await expect(page.locator('#ia-edit')).toBeDisabled();

    await page.locator('#ia-name').fill('Energia IA');
    await page.locator('#ia-nivel').fill('2º ESO, 3º ESO');
    await page.locator('#ia-tema').fill('Energia; Calor');
    await page.locator('#ia-csv').fill(IA_CSV);
    await page.locator('#ia-upload').click();
    await expect(page.locator('#ia-status')).toHaveText('Importado: Nou (3)Jugar en el aula');
    const body = calls.uploads[0];
    expect(body).toContain('name="name"\r\n\r\nEnergia IA');
    const tags = [...body.matchAll(/name="tags"\r\n\r\n([^\r]*)/g)].map(m => m[1]);
    expect(tags).toEqual(['2-eso', 'energia', 'calor', 'espanol']);
    expect(body).not.toContain('wikimedia');
    await expect(page.locator('#ia-edit')).toBeEnabled();
    await page.locator('#ia-edit').click();
    await expect(page).toHaveURL(/\/create\/quiz-creator\/\?id=n1$/);
});

// ---------- Cuenta y administración ----------

test('cuenta: modal de preferencias, estado, nombre visible y cerrar', async ({ page }) => {
    const { calls } = await mockBackend(page, { user: TEACHER });
    await openCreate(page);
    await page.locator('#open-account').click();
    await expect(page.locator('#auth-modal')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/modal-open/);
    await expect(page.locator('#auth-status')).toHaveText('teacher@example.invalid · Profe (editor)');
    await expect(page.locator('#auth-status')).not.toHaveClass(/pill-muted/);
    await expect(page.locator('#auth-nick')).toBeFocused();
    await expect(page.locator('#user-admin')).toBeHidden();

    await page.locator('#auth-nick').fill('  Nou nom ');
    await page.locator('#auth-save-nick').click();
    await expect(page.locator('#account-message')).toHaveText('Nombre visible actualizado.');
    expect(calls.profile).toEqual([{ nickname: 'Nou nom' }]);

    await page.keyboard.press('Escape');
    await expect(page.locator('#auth-modal')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/modal-open/);
    await page.locator('#open-account').click();
    await page.locator('#auth-modal-close').click();
    await expect(page.locator('#auth-modal')).toBeHidden();
});

test('admin: panel visible, importar sin archivo, migrar imágenes, importar públicas y exportar', async ({ page }) => {
    const { calls } = await mockBackend(page, { user: ADMIN, importPublic: true });
    await openCreate(page);
    await page.locator('#open-account').click();
    await expect(page.locator('#user-admin')).toBeVisible();
    await expect(page.locator('#auth-status')).toHaveText('admin@example.invalid (admin)');

    await page.locator('#admin-import-quizzes').click();
    await expect(page.locator('#admin-import-quizzes-status')).toHaveText('Selecciona un archivo JSON.');

    await page.locator('#admin-mirror-kahoot-images').click();
    await expect(page.locator('#admin-mirror-kahoot-status')).toHaveText('Migración iniciada. Revisa los logs del servidor.');
    await expect(page.locator('#admin-mirror-kahoot-images')).toBeEnabled();

    await expect(page.locator('#admin-import-public-wrap')).toBeVisible();
    await page.locator('#admin-import-public-btn').click();
    await expect(page.locator('#admin-import-public-status')).toHaveText('Importación completada: 3 / 5 (2 ya existían)');
    expect(calls.admin).toEqual(['/api/admin/mirror-kahoot-images', '/api/admin/import-public-activities']);

    await page.locator('#admin-export-quizzes').click();
    await expect(page).toHaveURL(/\/api\/admin\/quizzes\/export$/);
});

test('sin sesión y con Authentik: aviso «Nuevo en EduHoot» y error de login por URL', async ({ page }) => {
    await mockBackend(page, { authentik: true });
    await page.goto('/create/?lang=es&authentik=error');
    await expect(page.locator('#new-user-signin')).toBeVisible();
    await expect(page.locator('#auth-message')).toHaveText('Error al iniciar sesión.');
    await expect(page).toHaveURL(/\/create\/\?lang=es$/);
    await expect(page.locator('#auth-status')).toHaveText('No has iniciado sesión');
});
