const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

for (const [lang, signOut] of [['es', 'Salir'], ['va', 'Eixir']]) {
    test(`${lang}: header closes an authenticated session and survives reload`, async ({ page }) => {
        let authenticated = true;
        let logoutRequests = 0;
        await page.route(/^https:\/\//, route => route.abort());
        await page.route('**/socket.io/socket.io.js', route => route.fulfill({
            contentType: 'application/javascript',
            body: 'window.io=function(){return {on:function(){},emit:function(){},disconnect:function(){},connect:function(){}}};'
        }));
        await page.route('**/api/**', async route => {
            const path = new URL(route.request().url()).pathname;
            if (path === '/api/auth/me') {
                return route.fulfill({ status: authenticated ? 200 : 401, json: authenticated
                    ? { id: 'test-user', email: 'teacher@example.invalid', role: 'editor', nickname: 'Teacher' }
                    : { error: 'No autorizado' } });
            }
            if (path === '/api/auth/logout') {
                expect(route.request().method()).toBe('POST');
                authenticated = false;
                logoutRequests++;
                return route.fulfill({ json: { ok: true } });
            }
            return route.fulfill({ json: { enabled: false, tags: [], quizzes: [] } });
        });
        await page.goto(`/create/?lang=${lang}`);
        await expect(page.locator('#open-auth')).toHaveText(signOut);
        await expect(page.locator('#open-account')).toBeVisible();
        await page.locator('#open-auth').click();
        await expect(page.locator('#open-auth')).toHaveText('Entrar');
        await expect(page.locator('#open-account')).toBeHidden();
        expect(logoutRequests).toBe(1);
        await page.reload();
        await expect(page.locator('#open-auth')).toHaveText('Entrar');
    });
}
