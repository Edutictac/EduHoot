const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Enlaces de retorno: «Inicio» (/) y «Biblioteca» (/create/) en las pantallas docentes.
async function open(page, path) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/auth/me', route => route.fulfill({ json: { id: 'u1', email: 'a@b.c', role: 'admin', nickname: 'U' } }));
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/auth/me') return route.fallback();
        return route.fulfill({ json: { tags: [], quizzes: [], homeworks: [], games: [], top: [], enabled: false } });
    });
    await page.goto(path);
}

for (const [path, home, library] of [
    ['/create/quiz-creator/?lang=es', '#backHome', '#back'],
    ['/create/partidas/?lang=es', '#ptHomeLink', '#ptBackLink'],
    ['/create/homework/?quiz=7&lang=es', '#hwHomeLink', '#hwBackLink'],
    ['/multiplayer/?from=library&lang=es', '.back-link[href="/"]', '#back-library'],
    ['/admin-stats.html', '.admin-nav a[href="/"]', '.admin-nav a[href="/create/"]'],
    ['/admin-logs.html', '.admin-nav a[href="/"]', '.admin-nav a[href="/create/"]']
]) {
    test(`${path}: tiene «Inicio» y «Biblioteca»`, async ({ page }) => {
        await open(page, path);
        await expect(page.locator(home).first()).toBeVisible();
        await expect(page.locator(home).first()).toHaveAttribute('href', '/');
        await expect(page.locator(library).first()).toBeVisible();
        await expect(page.locator(library).first()).toHaveAttribute('href', /^(\/create\/|\.\.\/)$/);
    });
}

test('/multiplayer/: «Biblioteca» solo si se llega desde la biblioteca', async ({ page }) => {
    await open(page, '/multiplayer/?lang=es');
    await expect(page.locator('.back-link[href="/"]')).toBeVisible();
    await expect(page.locator('#back-library')).toBeHidden();
});

test('«Inicio» se traduce (alemán) en el editor', async ({ page }) => {
    await open(page, '/create/quiz-creator/?lang=de');
    await expect(page.locator('#backHome')).toHaveText('Startseite');
});
