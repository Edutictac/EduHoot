const { test, expect } = require('@playwright/test');

// EduHoot servit com a eduhoot.edutictac.es, al mateix lloc que Commons.
const SITE = 'http://eduhoot.edutictac.es:18090';
const launchOptions = { args: ['--host-resolver-rules=MAP eduhoot.edutictac.es 127.0.0.1'] };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
}
test.use({ launchOptions });

const COMMONS = 'https://commons.edutictac.es';
const TEACHER = { id: 'test-user', email: 'teacher@example.invalid', role: 'editor', nickname: 'Teacher' };

// Xip mínim: inici + menú de compte, com el de Commons.
const WIDGET_STUB = `customElements.define('edutictac-account', class extends HTMLElement {
    connectedCallback() {
        this.innerHTML = '<nav class="eta"><a class="eta-home" href="https://edutictac.es/">Inici</a>'
            + '<details class="eta-account"><summary class="eta-chip">Entrar</summary>'
            + '<div class="eta-menu"><a class="eta-item" href="${COMMONS}/login">Professorat</a></div></details></nav>';
    }
});`;

// EduHoot i Commons simulats; `state` es pot canviar durant la prova.
async function stubServers(page, state) {
    await page.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === COMMONS) {
            if (url.pathname === '/assets/account-widget.js') {
                return route.fulfill({ contentType: 'application/javascript', body: WIDGET_STUB });
            }
            if (url.pathname === '/api/auth/session') {
                return route.fulfill({
                    headers: { 'Access-Control-Allow-Origin': new URL(page.url()).origin, 'Access-Control-Allow-Credentials': 'true' },
                    json: state.central
                });
            }
            return route.abort();
        }
        if (url.protocol === 'https:') return route.abort();
        if (url.pathname === '/socket.io/socket.io.js') {
            return route.fulfill({
                contentType: 'application/javascript',
                body: 'window.io=function(){return {on:function(){},emit:function(){},disconnect:function(){},connect:function(){}}};'
            });
        }
        if (url.pathname === '/api/auth/me') {
            return route.fulfill(state.user ? { json: state.user } : { status: 401, json: { error: 'No autorizado' } });
        }
        if (url.pathname === '/api/auth/logout') {
            state.user = null;
            state.logouts++;
            return route.fulfill({ json: { ok: true } });
        }
        if (url.pathname === '/api/auth/authentik/config') return route.fulfill({ json: { enabled: true } });
        if (url.pathname === '/api/auth/authentik/start') {
            state.starts.push(url.searchParams.get('next'));
            return route.fulfill({ contentType: 'text/html', body: '<p>authentik</p>' });
        }
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { enabled: false, tags: [], quizzes: [] } });
        return route.continue();
    });
}

function newState(overrides) {
    return Object.assign({ user: null, central: { authenticated: false, kind: 'anonymous' }, logouts: 0, starts: [] }, overrides);
}

test('el xip és l’únic accés: no queda formulari de contrasenya ni botó propi', async ({ page }) => {
    await stubServers(page, newState());
    await page.goto(SITE + '/create/?lang=va');
    await expect(page.locator('#new-user-signin')).toBeVisible();
    await expect(page.locator('#auth-email, #auth-pass, #open-auth, #auth-google-hero, #reset-panel')).toHaveCount(0);
    await expect(page.locator('#open-account')).toBeHidden();
    await page.locator('#open-account-menu').click();
    await expect(page.locator('edutictac-account details.eta-account')).toHaveAttribute('open', '');
});

test('amb sessió de professorat al xip, EduHoot entra per SSO una sola vegada', async ({ page }) => {
    const state = newState({ central: { authenticated: true, kind: 'oidc', role: 'docent' } });
    await stubServers(page, state);
    await page.goto(SITE + '/create/?lang=va');
    await expect.poll(() => state.starts.length).toBe(1);
    expect(state.starts[0]).toBe('/create/?lang=va');
    // Si Authentik torna amb error, no es reintenta en bucle.
    await page.goto(SITE + '/create/?lang=va&authentik=error');
    await expect(page.locator('#auth-message')).not.toBeEmpty();
    await page.waitForTimeout(500);
    expect(state.starts.length).toBe(1);
});

test('quan el xip tanca la sessió, EduHoot també la tanca', async ({ page }) => {
    const state = newState({ user: TEACHER, central: { authenticated: true, kind: 'oidc', role: 'docent' } });
    await stubServers(page, state);
    await page.goto(SITE + '/create/?lang=va');
    await expect(page.locator('#open-account')).toBeVisible();
    await expect(page.locator('#new-user-signin')).toBeHidden();
    expect(state.logouts).toBe(0);

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('edutictac:sessionchange', {
        detail: { authenticated: false, kind: 'anonymous' }
    })));
    await expect.poll(() => state.logouts).toBe(1);
    await expect(page.locator('#open-account')).toBeHidden();
    await expect(page.locator('#new-user-signin')).toBeVisible();
});

test('en una instal·lació local, el Commons d’internet no toca la sessió d’EduHoot', async ({ page }) => {
    const state = newState({ user: TEACHER, central: { authenticated: false, kind: 'anonymous' } });
    await stubServers(page, state);
    await page.goto('/create/?lang=va');
    await expect(page.locator('#open-account')).toBeVisible();
    await page.waitForTimeout(500);
    expect(state.logouts).toBe(0);
});
