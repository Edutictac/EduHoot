const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    // Sin Commons: el chip no se pinta y se ve el selector de idioma propio.
    await page.route('https://commons.edutictac.es/**', route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { version: '1.2.0', tag: '' } }));
});

test('la portada (/) es la promo y reúne los enlaces de la antigua portada', async ({ page }) => {
    await page.goto('/?lang=es');
    await expect(page.locator('h1')).toContainText('aula');
    for (const href of ['/join.html', '/multiplayer/', '/solo/', '/create/', '/inicio/']) {
        await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
    await expect(page.locator('a.tile[href="/create/"]')).toContainText('Acceso profesorado');
    await expect(page.locator('.hero-actions a[href="/inicio/"]')).toContainText('Inicio rápido');
    await expect(page.locator('.hero-actions a[href="/create/"]')).toContainText('Profesorado');
    await expect(page.locator('.hero-actions a[href="/join.html"]')).toHaveCount(1);
    expect(await page.locator('.hero-actions a').evaluateAll(a => a.map(x => x.getAttribute('href')))).toEqual(['/inicio/', '/join.html', '/solo/', '/multiplayer/', '/create/']);
    await expect(page.locator('.top a.btn')).toHaveCount(0);
    await expect(page.locator('h1')).not.toContainText('.');
});

test('la cabecera lleva un enlace visible a edutictac.es, también en móvil', async ({ page }) => {
    await page.goto('/?lang=va');
    const link = page.locator('header a.nav-ett');
    await expect(link).toBeVisible();
    await expect(link).toHaveText('EduTicTac');
    await expect(link).toHaveAttribute('href', 'https://edutictac.es/');
    await expect(link).toHaveAttribute('target', '_blank');
    // Va justo después de «Programari lliure».
    expect(await page.locator('header nav a').evaluateAll(a => a.map(x => x.textContent.trim()).slice(-2))).toEqual(['Programari lliure', 'EduTicTac']);
});

test('muestra la versión en el pie y los enlaces comunes', async ({ page }) => {
    await page.goto('/?lang=es');
    await expect(page.locator('#app-version')).toHaveText(/v1\.2\.0/);
    await expect(page.locator('footer a[href="https://edutictac.es/"]')).toHaveCount(0);
    await expect(page.locator('footer a[href*="privacitat"]')).toBeVisible();
    await expect(page.locator('footer a[href*="LICENSE"]')).toHaveText('AGPL-3.0');
});

test('los testimonios van en carrusel y se avisa de que son de ejemplo', async ({ page }) => {
    await page.goto('/?lang=es');
    const slides = page.locator('.quote .slide');
    await expect(slides).toHaveCount(6);
    await expect(slides.nth(0)).toHaveClass(/is-active/);
    await page.locator('.q-next').click();
    await expect(slides.nth(1)).toHaveClass(/is-active/);
    await expect(slides.nth(0)).not.toHaveClass(/is-active/);
    await page.locator('.q-dot').nth(5).click();
    await expect(slides.nth(5)).toHaveClass(/is-active/);
    await page.locator('.q-prev').click();
    await expect(slides.nth(4)).toHaveClass(/is-active/);
    // Los tres últimos hablan de las tarjetas de repaso y de las preguntas de ordenar y de correspondencia.
    await expect(slides.nth(3)).toContainText('tarjetas');
    await expect(slides.nth(4)).toContainText('ordenar');
    await expect(slides.nth(5)).toContainText('correspondencia');
    await expect(page.locator('.quote-note')).toContainText('ejemplo');
    const size = await page.locator('.quote-note').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeLessThan(14);
});

test('el selector de idioma incluye el francés y traduce la promo', async ({ page }) => {
    await page.goto('/?lang=es');
    expect(await page.locator('#promo-lang button').evaluateAll(b => b.map(x => x.dataset.lang))).toEqual(['ca', 'va', 'es', 'en', 'fr']);
    await page.locator('#promo-lang [data-lang="fr"]').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('.hero-actions a.primary')).toContainText('Jouer maintenant');
    await expect(page.locator('.hero-actions a[href="/inicio/"]')).toContainText('Démarrage rapide');
    await expect(page.locator('.quote-note')).toContainText('exemple');
});

test('el selector de idioma propio sigue visible aunque el chip de cuenta se pinte', async ({ page }) => {
    await page.goto('/?lang=es');
    // Lo que hace edutictac-chip.js cuando el chip de Commons está listo.
    await page.evaluate(() => document.documentElement.classList.add('has-account-chip'));
    await expect(page.locator('#promo-lang')).toBeVisible();
    await expect(page.locator('#promo-lang [data-lang="fr"]')).toBeVisible();
});

test('Inicio rápido lleva a la portada de siempre, con enlaces de vuelta a la promo', async ({ page }) => {
    await page.goto('/?lang=es');
    await page.locator('.hero-actions a[href="/inicio/"]').click();
    await expect(page).toHaveURL(/\/inicio\/$/);
    await expect(page.locator('.landing-shell')).toBeVisible();
    await expect(page.locator('.landing-actions a')).toHaveCount(4);
    await expect(page.locator('.logo-link')).toHaveAttribute('href', '/');
});

test('los bloques de modos de juego llevan el emoticono grande y centrado; los chips de tipo se traducen', async ({ page }) => {
    await page.goto('/?lang=en');
    const tile = page.locator('a.tile[href="/solo/"]');
    const box = await tile.boundingBox();
    const emoji = await tile.locator('span').evaluate(el => {
        const style = getComputedStyle(el, '::before');
        return { size: parseFloat(style.fontSize), content: style.content, align: style.textAlign };
    });
    expect(emoji.size).toBeGreaterThanOrEqual(48);
    expect(await tile.locator('span').evaluate(el => getComputedStyle(el, '::before').animationName)).toBe('tile-bob');
    expect(emoji.align).toBe('center');
    expect(box.height).toBeGreaterThan(240);
    await expect(page.locator('.chips span', { hasText: 'Match' })).toBeVisible();
    await expect(page.locator('.chips span', { hasText: 'Order' })).toBeVisible();
});

test.describe('página inicial elegida (promo o inicio rápido)', () => {
    test('por defecto, / es la promo', async ({ page }) => {
        await page.goto('/?lang=es');
        await expect(page).toHaveURL(/\/\?lang=es$/);
        await expect(page.locator('h1')).toContainText('aula');
    });

    test('al elegir Inicio rápido, / entra directo a /inicio/ (y conserva el idioma)', async ({ page }) => {
        await page.goto('/?lang=es');
        await page.locator('.hero-actions a[href="/inicio/"]').click();
        await expect(page).toHaveURL(/\/inicio\/$/);
        expect(await page.evaluate(() => localStorage.getItem('eduhoot-home'))).toBe('quick');
        await page.goto('/?lang=fr');
        await expect(page).toHaveURL(/\/inicio\/\?lang=fr$/);
        await expect(page.locator('.landing-shell')).toBeVisible();
    });

    test('el icono de EduHoot en /inicio/ devuelve la promo como página inicial', async ({ page }) => {
        await page.addInitScript(() => { try { if (!localStorage.getItem('eduhoot-home')) localStorage.setItem('eduhoot-home', 'quick'); } catch (e) {} });
        await page.goto('/?lang=es');
        await expect(page).toHaveURL(/\/inicio\/\?lang=es$/);
        await page.locator('.logo-link').click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.locator('h1')).toContainText('aula');
        expect(await page.evaluate(() => localStorage.getItem('eduhoot-home'))).toBe('promo');
        await page.goto('/');
        await expect(page).toHaveURL(/\/$/);
        await expect(page.locator('h1')).toContainText('aula');
    });

    test('en /inicio/ el selector de idioma va dentro del recuadro, arriba a la derecha', async ({ page }) => {
        await page.goto('/inicio/?lang=es');
        const shell = await page.locator('.landing-shell').boundingBox();
        const sel = await page.locator('#lang-switcher').boundingBox();
        expect(sel.x).toBeGreaterThanOrEqual(shell.x);
        expect(sel.x + sel.width).toBeLessThanOrEqual(shell.x + shell.width);
        expect(sel.y).toBeGreaterThanOrEqual(shell.y);
        expect(sel.y + sel.height).toBeLessThan(shell.y + 80);
        expect(shell.x + shell.width - (sel.x + sel.width)).toBeLessThan(30);
    });
});

test('botonera del titular en valenciano: Inici ràpid, Jugar ara, A soles, Multijugador, Professorat', async ({ page }) => {
    await page.goto('/?lang=va');
    expect((await page.locator('.hero-actions a').allInnerTexts()).map(t => t.trim()))
        .toEqual(['Inici ràpid', 'Jugar ara', 'A soles', 'Multijugador', 'Professorat']);
});
