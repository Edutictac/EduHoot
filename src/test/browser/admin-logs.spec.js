const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Red de seguridad per a passar /admin-logs.html a Vue: fixa la configuració,
// els filtres, la taula, el detall i les descàrregues.

const LOGS = [
    { createdAt: '2026-11-01T10:00:00Z', level: 'error', tag: 'express-error', message: 'Falla <b>gorda</b>', pin: '123', hostId: 'h1', playerId: '', meta: { stack: 'Error: x\n  at y' } },
    { createdAt: '2026-11-01T10:01:00Z', level: 'info', tag: 'player-join', message: 'Entra Ana', pin: '123', hostId: 'h1', playerId: 'p1', meta: { name: 'Ana' } },
    { createdAt: '2026-11-01T10:02:00Z', level: 'debug', tag: 'timeUp', message: 'Temps', pin: '', hostId: '', playerId: '', meta: {} }
];

async function openLogs(page, options = {}) {
    const calls = { logQueries: [], saved: [] };
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => {
        const request = route.request();
        const url = new URL(request.url());
        const { pathname } = url;
        if (pathname === '/api/auth/me') return route.fulfill({ json: { id: 'a', role: 'admin' } });
        if (pathname === '/api/auth/authentik/config') return route.fulfill({ json: { enabled: false } });
        if (pathname === '/api/admin/settings/logging') {
            if (request.method() === 'POST') {
                calls.saved.push(request.postDataJSON());
                return route.fulfill(options.saveResult || { json: { ok: true } });
            }
            return route.fulfill(options.settings || { json: { data: { level: 'warn', cappedSizeBytes: 50 * 1024 * 1024 } } });
        }
        if (pathname === '/api/admin/logs') {
            calls.logQueries.push(url.search);
            return route.fulfill(options.logs || { json: { data: LOGS } });
        }
        if (pathname === '/api/admin/logs/export') return route.fulfill({ contentType: 'text/plain', body: 'export' });
        return route.fulfill({ json: {} });
    });
    await page.goto('/admin-logs.html');
    await page.waitForLoadState('load');
    return calls;
}

test('carga la configuración actual', async ({ page }) => {
    await openLogs(page);
    await expect(page.locator('#logs-level-select')).toHaveValue('warn');
    await expect(page.locator('#logs-capped-mb')).toHaveValue('50');
});

test('guardar envía nivel y tamaño en bytes y avisa', async ({ page }) => {
    await page.clock.install();
    const calls = await openLogs(page);
    await expect(page.locator('#logs-capped-mb')).toHaveValue('50');
    await page.locator('#logs-level-select').selectOption('debug');
    await page.locator('#logs-capped-mb').fill('8');
    await page.locator('#logs-settings-save').click();
    await expect(page.locator('#logs-settings-status')).toHaveText('Guardado.');
    expect(calls.saved).toEqual([{ level: 'debug', cappedSizeBytes: 8 * 1024 * 1024 }]);
    await page.clock.runFor(2100);
    await expect(page.locator('#logs-settings-status')).toHaveText('');
});

test('si guardar falla enseña el error del servidor', async ({ page }) => {
    await openLogs(page, { saveResult: { status: 400, json: { error: 'Nivell no vàlid' } } });
    await page.locator('#logs-settings-save').click();
    await expect(page.locator('#logs-settings-status')).toHaveText('Nivell no vàlid');
});

test('pinta la tabla escapando el texto y con «Ver» solo si hay detalle', async ({ page }) => {
    const calls = await openLogs(page);
    const rows = page.locator('#logs-tbody tr');
    await expect(rows).toHaveCount(3);
    expect(calls.logQueries).toEqual(['']);
    const first = rows.nth(0).locator('td');
    await expect(first.nth(0)).not.toHaveText('');
    await expect(first.nth(1)).toHaveText('error');
    await expect(first.nth(1)).toHaveClass('level-error');
    await expect(first.nth(2)).toHaveText('express-error');
    await expect(first.nth(3)).toHaveText('Falla <b>gorda</b>');
    await expect(rows.nth(1).locator('td')).toHaveText([/./, 'info', 'player-join', 'Entra Ana', '123', 'h1', 'p1', 'Ver']);
    await expect(rows.nth(0).locator('.logs-detail-btn')).toHaveText('Ver');
    await expect(rows.nth(2).locator('.logs-detail-btn')).toHaveCount(0);
    await expect(page.locator('#logs-error')).toHaveText('');
});

test('«Ver» abre el detalle con los campos no vacíos y la pila', async ({ page }) => {
    await openLogs(page);
    await page.locator('#logs-tbody tr').nth(0).locator('.logs-detail-btn').click();
    const modal = page.locator('#logs-detail-modal');
    await expect(modal).toBeVisible();
    await expect(page.locator('#logs-detail-modal-title')).toHaveText('Detalle: express-error');
    await expect(modal.locator('dt')).toHaveText(['Fecha', 'Nivel', 'Tag', 'Mensaje', 'PIN', 'hostId']);
    await expect(modal.locator('dd').nth(3)).toHaveText('Falla <b>gorda</b>');
    await expect(page.locator('#logs-detail-modal-stack')).toHaveText('Error: x\n  at y');
    await modal.locator('.logs-detail-modal__close').click();
    await expect(modal).toBeHidden();

    await page.locator('#logs-tbody tr').nth(1).locator('.logs-detail-btn').click();
    await expect(page.locator('#logs-detail-modal-stack')).toHaveText(JSON.stringify({ name: 'Ana' }, null, 2));
    await expect(modal.locator('dt')).toHaveCount(7);
});

test('Filtrar y Refrescar piden los logs con los filtros', async ({ page }) => {
    const calls = await openLogs(page);
    await expect(page.locator('#logs-tbody tr')).toHaveCount(3);
    await page.locator('#logs-filter-level').selectOption('error');
    await page.locator('#logs-filter-tag').selectOption('game-end');
    await page.locator('#logs-filter-q').fill('Ana');
    await page.locator('#logs-filter-pin').fill('123');
    await page.locator('#logs-filter-apply').click();
    await expect.poll(() => calls.logQueries.length).toBe(2);
    expect(calls.logQueries[1]).toBe('?level=error&tag=game-end&q=Ana&pin=123');
    await page.locator('#logs-filter-refresh').click();
    await expect.poll(() => calls.logQueries.length).toBe(3);
    expect(calls.logQueries[2]).toBe('?level=error&tag=game-end&q=Ana&pin=123');
});

test('las descargas llevan los filtros y el formato', async ({ page }) => {
    await openLogs(page);
    await page.locator('#logs-filter-level').selectOption('warn');
    await page.locator('#logs-export-csv').click();
    await page.waitForURL('**/api/admin/logs/export?*');
    expect(new URL(page.url()).search).toBe('?level=warn&format=csv');

    await openLogs(page);
    await page.locator('#logs-export-ndjson').click();
    await page.waitForURL('**/api/admin/logs/export?*');
    expect(new URL(page.url()).search).toBe('?format=ndjson');
});

test('sin sesión lo explica y deja la tabla vacía', async ({ page }) => {
    await openLogs(page, { logs: { status: 401, json: {} }, settings: { status: 401, json: {} } });
    await expect(page.locator('#logs-error')).toHaveText('Necesitas iniciar sesión para ver esta página.');
    await expect(page.locator('#logs-tbody tr')).toHaveCount(0);
});

test('otro error al cargar los logs da el mensaje genérico', async ({ page }) => {
    await openLogs(page, { logs: { status: 500, json: {} } });
    await expect(page.locator('#logs-error')).toHaveText('No se pudieron cargar los logs.');
});
