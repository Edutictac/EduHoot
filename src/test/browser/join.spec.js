const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Red de seguridad per a passar /join.html a Vue: fixa el comportament de
// join.js (modal del PIN, icones, nom, identitat d'alumne i enviament).

async function mockBackend(page, options = {}) {
    const calls = { pins: [], student: [] };
    await page.addInitScript(() => { localStorage.setItem('lang', 'es'); });
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/player/?*', route => route.fulfill({ contentType: 'text/html', body: '<p>lobby</p>' }));
    await page.route('**/api/**', async route => {
        const request = route.request();
        const { pathname } = new URL(request.url());
        let m = pathname.match(/^\/api\/validate-pin\/(.+)$/);
        if (m) {
            calls.pins.push(decodeURIComponent(m[1]));
            return route.fulfill({ json: { valid: (options.validPins || ['12345']).includes(decodeURIComponent(m[1])) } });
        }
        if (pathname === '/api/player-auth/config') return route.fulfill({ json: options.studentAuth || { enabled: false, required: false } });
        if (pathname === '/api/player-auth/student') {
            calls.student.push(request.postDataJSON());
            const result = options.studentResult || { status: 401, json: { error: 'Credencials dolentes' } };
            return route.fulfill(result);
        }
        return route.fulfill({ json: {} });
    });
    return calls;
}

async function openJoin(page, query, options) {
    const calls = await mockBackend(page, options);
    await page.goto('/join.html' + (query || ''));
    await page.waitForLoadState('load');
    return calls;
}

function submittedParams(page) {
    return Object.fromEntries(new URL(page.url()).searchParams);
}

test('sin PIN en la URL muestra el modal y el botón Entrar está desactivado', async ({ page }) => {
    await openJoin(page);
    await expect(page.locator('#pinModal')).toBeVisible();
    await expect(page.locator('#pinModal h2')).toHaveText('Ingresa el PIN del juego');
    await expect(page.locator('body')).toHaveClass(/modal-open/);
    await expect(page.locator('#pinModalInput')).toBeFocused();
    await expect(page.locator('#joinButton')).toBeDisabled();
    await expect(page.locator('#joinButton')).toHaveText('Entrar');
    await expect(page.locator('#pin-display')).toBeHidden();
    // El primer icono queda elegido de entrada.
    await expect(page.locator('#icon')).toHaveValue('🦊');
    await expect(page.locator('#icon-preview')).toHaveText('🦊');
    await expect(page.locator('#icon-picker button.selected')).toHaveCount(1);
});

test('un PIN incorrecto muestra el error y deja el modal abierto', async ({ page }) => {
    const calls = await openJoin(page);
    await page.locator('#pinModalInput').fill('999');
    await page.locator('#pinModalSubmit').click();
    await expect(page.locator('#pinModalError')).toHaveText('PIN incorrecto. Intenta de nuevo.');
    await expect(page.locator('#pinModal')).toBeVisible();
    await expect(page.locator('#pinModalSubmit')).toBeEnabled();
    expect(calls.pins).toEqual(['999']);
});

test('enviar el modal sin PIN muestra el error sin llamar al servidor', async ({ page }) => {
    const calls = await openJoin(page);
    await page.locator('#pinModalSubmit').click();
    await expect(page.locator('#pinModalError')).toHaveText('PIN incorrecto. Intenta de nuevo.');
    expect(calls.pins).toEqual([]);
});

test('un PIN correcto cierra el modal, enseña el PIN y pasa el foco al nombre', async ({ page }) => {
    await openJoin(page);
    await page.locator('#pinModalInput').fill('12345');
    await page.locator('#pinModalInput').press('Enter');
    await expect(page.locator('#pinModal')).toBeHidden();
    await expect(page.locator('body')).not.toHaveClass(/modal-open/);
    await expect(page.locator('#pin-display')).toBeVisible();
    await expect(page.locator('#pin-display-value')).toHaveText('12345');
    await expect(page.locator('#pin')).toHaveValue('12345');
    await expect(page.locator('#joinButton')).toBeEnabled();
    await expect(page.locator('#name')).toBeFocused();
});

test('con ?pin= valida el PIN solo al cargar', async ({ page }) => {
    const calls = await openJoin(page, '?pin=12345');
    await expect(page.locator('#pin-display-value')).toHaveText('12345');
    await expect(page.locator('#pinModal')).toBeHidden();
    expect(calls.pins).toEqual(['12345']);
    await expect(page.locator('#pinModalInput')).toHaveValue('12345');
});

test('elegir un icono cambia la selección y la vista previa', async ({ page }) => {
    await openJoin(page, '?pin=12345');
    await page.locator('#icon-picker button[data-icon="🐼"]').click();
    await expect(page.locator('#icon')).toHaveValue('🐼');
    await expect(page.locator('#icon-preview')).toHaveText('🐼');
    await expect(page.locator('#icon-picker button.selected')).toHaveText('🐼');
    await expect(page.locator('#icon-picker button.selected')).toHaveCount(1);
});

test('el nombre junta espacios repetidos mientras se escribe y deja escribir varias palabras', async ({ page }) => {
    await openJoin(page, '?pin=12345');
    await page.locator('#name').pressSequentially('Ana  Maria ');
    await expect(page.locator('#name')).toHaveValue('Ana Maria ');
});

test('sin nombre no envía y deja el foco en el nombre', async ({ page }) => {
    await openJoin(page, '?pin=12345');
    await page.locator('#name').fill('   ');
    await page.locator('#joinButton').click();
    await expect(page.locator('#name')).toBeFocused();
    expect(page.url()).toContain('/join.html');
});

test('al entrar va a /player/ con PIN, icono, nombre limpio y un token que se reutiliza', async ({ page }) => {
    await openJoin(page, '?pin=12345');
    await page.locator('#icon-picker button[data-icon="🐸"]').first().click();
    await page.locator('#name').fill('  Ana   Maria  ');
    await page.locator('#joinButton').click();
    await page.waitForURL('**/player/?*');
    const first = submittedParams(page);
    expect(first).toEqual(expect.objectContaining({ pin: '12345', icon: '🐸', name: 'Ana Maria', studentJoinToken: '' }));
    expect(first.token).toMatch(/^[0-9a-f]{32}$/);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('playerTokens')));
    expect(stored['12345:Ana Maria']).toBe(first.token);

    await page.goto('/join.html?pin=12345');
    await page.locator('#name').fill('Ana Maria');
    await page.locator('#joinButton').click();
    await page.waitForURL('**/player/?*');
    expect(submittedParams(page).token).toBe(first.token);
});

test('sin identidad de alumno activada no se ven sus campos', async ({ page }) => {
    await openJoin(page, '?pin=12345');
    await expect(page.locator('#student-auth-fields')).toBeHidden();
    await expect(page.locator('#name')).toBeVisible();
});

test('identidad opcional: normaliza código y PIN, y un error del servidor se muestra', async ({ page }) => {
    const calls = await openJoin(page, '?pin=12345', { studentAuth: { enabled: true, required: false } });
    await expect(page.locator('#student-auth-fields')).toBeVisible();
    await expect(page.locator('#student-auth-fields .student-auth__intro')).toHaveText('O entra con tu identidad EduTicTac');
    await expect(page.locator('#name')).toBeVisible();
    await page.locator('#student-code').pressSequentially('a-b9z');
    await expect(page.locator('#student-code')).toHaveValue('AB9');
    await page.locator('#student-pin').pressSequentially('12a34');
    await expect(page.locator('#student-pin')).toHaveValue('1234');
    await page.locator('#joinButton').click();
    await expect(page.locator('#student-auth-status')).toHaveText('Credencials dolentes');
    await expect(page.locator('#student-pin')).toBeFocused();
    expect(calls.student).toEqual([{ public_code: 'AB9', pin: '1234' }]);
    expect(page.url()).toContain('/join.html');
});

test('identidad obligatoria: oculta el nombre, pide código y PIN y entra con el token del alumno', async ({ page }) => {
    const calls = await openJoin(page, '?pin=12345', {
        studentAuth: { enabled: true, required: true },
        studentResult: { json: { join_token: 'jt-1', display_name: 'abc', public_code: 'ABC', avatar_icon: '🦉' } }
    });
    await expect(page.locator('#student-auth-fields')).toBeVisible();
    await expect(page.locator('#name')).toBeHidden();
    await expect(page.locator('#student-code')).toHaveAttribute('required', '');
    await expect(page.locator('#student-pin')).toHaveAttribute('required', '');

    await page.locator('#student-code').fill('ABC');
    await page.locator('#student-pin').fill('1234');
    await page.locator('#joinButton').click();
    await page.waitForURL('**/player/?*');
    expect(calls.student).toEqual([{ public_code: 'ABC', pin: '1234' }]);
    expect(submittedParams(page)).toEqual(expect.objectContaining({ pin: '12345', name: 'ABC', icon: '🦉', studentJoinToken: 'jt-1' }));
});

test('con código pero sin PIN personal muestra «Introduce el código y el PIN.»', async ({ page }) => {
    const calls = await openJoin(page, '?pin=12345', { studentAuth: { enabled: true, required: false } });
    await page.locator('#name').fill('Ana');
    await page.locator('#student-code').fill('ABC');
    await page.locator('#joinButton').click();
    await expect(page.locator('#student-auth-status')).toHaveText('Introduce el código y el PIN.');
    expect(calls.student).toEqual([]);
    expect(page.url()).toContain('/join.html');
});
