const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
    // Sin Commons: el chip no se pinta y se ve el selector de idioma propio.
    await page.route('https://commons.edutictac.es/**', route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { version: '1.2.0', tag: '' } }));
});

test('la portada (/) es la promo y reúne los enlaces de la antigua portada', async ({ page }) => {
    await page.goto('/?lang=es');
    await expect(page.locator('h1#motto')).toHaveAttribute('data-i18n', /^motto_\d+$/);
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
    expect(await page.locator('#promo-lang button').evaluateAll(b => b.map(x => x.dataset.lang))).toEqual(['ca', 'va', 'es', 'en']);
    expect(await page.locator('#promo-lang select.lang-more option').evaluateAll(o => o.map(x => x.value))).toEqual(['', 'fr', 'de', 'it', 'pt', 'bg', 'ar']);
    await page.locator('#promo-lang select.lang-more').selectOption('fr');
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
    await expect(page.locator('#promo-lang select.lang-more')).toBeVisible();
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
        await expect(page.locator('h1#motto')).toHaveAttribute('data-i18n', /^motto_\d+$/);
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
        await expect(page.locator('h1#motto')).toHaveAttribute('data-i18n', /^motto_\d+$/);
        expect(await page.evaluate(() => localStorage.getItem('eduhoot-home'))).toBe('promo');
        await page.goto('/');
        await expect(page).toHaveURL(/\/$/);
        await expect(page.locator('h1#motto')).toHaveAttribute('data-i18n', /^motto_\d+$/);
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
    expect((await page.locator('.hero-actions a').evaluateAll(a => a.map(x => x.textContent.trim()))))
        .toEqual(['Inici ràpid', 'Jugar ara', 'A soles', 'Multijugador', 'Professorat']);
});

test('los idiomas nuevos (alemán, italiano, portugués y búlgaro) traducen la promo desde el desplegable', async ({ page }) => {
    await page.goto('/?lang=es');
    const expected = { de: 'Jetzt spielen', it: 'Gioca ora', pt: 'Jogar agora', bg: 'Играй сега', ar: 'العب الآن' };
    for (const [lang, text] of Object.entries(expected)) {
        await page.locator('#promo-lang select.lang-more').selectOption(lang);
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        await expect(page.locator('.hero-actions a.primary')).toContainText(text);
        await expect(page.locator('#promo-lang select.lang-more')).toHaveValue(lang);
        await expect(page.locator('#promo-lang select.lang-more')).toHaveClass(/active/);
    }
});

test('el desplegable de más idiomas muestra las dos iniciales en mayúsculas, no el nombre', async ({ page }) => {
    await page.goto('/?lang=es');
    expect(await page.locator('#promo-lang select.lang-more option').evaluateAll(o => o.map(x => x.textContent.trim()))).toEqual(['🌐', 'FR', 'DE', 'IT', 'PT', 'BG', 'AR']);
    await page.locator('#promo-lang select.lang-more').selectOption('de');
    await expect(page.locator('#promo-lang select.lang-more option:checked')).toHaveText('DE');
});

test('en árabe la promo se muestra de derecha a izquierda y vuelve a izquierda a derecha al cambiar', async ({ page }) => {
    await page.goto('/?lang=ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('#promo-lang select.lang-more option:checked')).toHaveText('AR');
    await page.locator('#promo-lang [data-lang="es"]').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});

test('«Y además…»: 12 características en PC, 6 en móvil y tablet, y «Todas las características» despliega hasta 33', async ({ page }) => {
    await page.goto('/?lang=es');
    const wide = page.viewportSize().width > 1024;
    const mainItems = page.locator('.extras ul:not(.extras-more) li');
    await expect(mainItems).toHaveCount(12);
    // Las 6 primeras (las más importantes) se ven siempre; de la 7 a la 12, solo en PC.
    await expect(page.locator('.extras ul:not(.extras-more) li:visible')).toHaveCount(wide ? 12 : 6);
    const more = page.locator('#all-features');
    await expect(more).toBeHidden();
    const btn = page.locator('#all-features-btn');
    await expect(btn).toHaveText('Todas las características');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await btn.click();
    await expect(more).toBeVisible();
    await expect(more.locator('li')).toHaveCount(21);
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(btn).toHaveText('Menos características');
    await expect(page.locator('.extras li:visible')).toHaveCount(33);
    await btn.click();
    await expect(more).toBeHidden();
    await expect(page.locator('.extras ul:not(.extras-more) li:visible')).toHaveCount(wide ? 12 : 6);
    await expect(btn).toHaveText('Todas las características');
});

test('las 6 más importantes son las mismas en todas las pantallas y van primero', async ({ page }) => {
    await page.goto('/?lang=es');
    const keys = await page.locator('.extras ul:not(.extras-more) li').evaluateAll(els => els.map(e => ({ k: e.getAttribute('data-i18n'), pc: e.classList.contains('pc-only') })));
    expect(keys.slice(0, 6).every(x => !x.pc)).toBe(true);
    expect(keys.slice(6).every(x => x.pc)).toBe(true);
});

test('las características se traducen (también el botón) y el idioma se conserva al desplegar', async ({ page }) => {
    await page.goto('/?lang=fr');
    await expect(page.locator('#all-features-btn')).toHaveText('Toutes les fonctionnalités');
    await page.locator('#all-features-btn').click();
    await expect(page.locator('#all-features-btn')).toHaveText('Moins de fonctionnalités');
    await expect(page.locator('#all-features li[data-i18n="f_pause"]')).toHaveText('Pause et +15 secondes');
    for (const lang of ['de', 'it', 'pt', 'bg', 'ar']) {
        await page.locator('#promo-lang select.lang-more').selectOption(lang);
        await expect(page.locator('#all-features-btn')).not.toHaveText(/Toutes|Moins/);
        await expect(page.locator('.extras li[data-i18n="f_selfpaced"]')).not.toHaveText('Modo a su ritmo');
    }
});

test('todos los botones de la portada usan la tipografía de la página (Raleway), también los <button>', async ({ page }) => {
    await page.goto('/?lang=es');
    const fonts = await page.locator('.btn').evaluateAll(els => els.map(e => ({ tag: e.tagName, text: e.textContent.trim(), family: getComputedStyle(e).fontFamily })));
    expect(fonts.length).toBeGreaterThan(5);
    for (const f of fonts) expect(f.family, `${f.tag} «${f.text}»`).toContain('Raleway');
    const btn = await page.locator('#all-features-btn').evaluate(e => getComputedStyle(e).fontSize);
    const ref = await page.locator('.hero-actions a.btn.ghost').first().evaluate(e => getComputedStyle(e).fontSize);
    expect(btn).toBe(ref);
});

test('en /inicio/ los botones (Instalar app y selector de idioma) también usan Raleway', async ({ page }) => {
    await page.goto('/inicio/?lang=es');
    await page.locator('#installApp').evaluate(el => { el.hidden = false; });
    for (const sel of ['#installApp', '#lang-switcher button[data-lang="es"]', '.landing-actions .btn']) {
        expect(await page.locator(sel).first().evaluate(e => getComputedStyle(e).fontFamily), sel).toContain('Raleway');
    }
});

test.describe('frase motivadora', () => {
    test('hay 11 frases por idioma, de longitud parecida', async ({ page }) => {
        await page.goto('/?lang=es');
        const stats = await page.evaluate(() => {
            const T = window.EduhootPromoTexts, out = {};
            for (const lang of Object.keys(T)) {
                const phrases = Array.from({ length: 11 }, (_, i) => T[lang]['motto_' + (i + 1)]);
                out[lang] = { count: phrases.filter(Boolean).length, distinct: new Set(phrases).size, min: Math.min(...phrases.map(p => p.length)), max: Math.max(...phrases.map(p => p.length)) };
            }
            return out;
        });
        expect(Object.keys(stats).sort()).toEqual(['ar', 'bg', 'ca', 'de', 'en', 'es', 'fr', 'it', 'pt', 'va']);
        for (const [lang, s] of Object.entries(stats)) {
            expect(s.count, lang).toBe(11);
            expect(s.distinct, lang).toBe(11);
            // Longitud parecida: la más larga no pasa de 1,5 veces la más corta.
            expect(s.max / s.min, lang).toBeLessThanOrEqual(1.5);
        }
    });

    test('el titular grande es la frase y cambia en cada recarga (no hay otra frase bajo los botones)', async ({ page }) => {
        await page.goto('/?lang=es');
        await expect(page.locator('h1#motto')).toBeVisible();
        expect(await page.locator('.hero p.motto').count()).toBe(0);
        const size = await page.locator('h1#motto').evaluate(e => parseFloat(getComputedStyle(e).fontSize));
        expect(size).toBeGreaterThanOrEqual(36);
        // Va antes de la botonera, en el sitio del titular.
        const y = async sel => (await page.locator(sel).first().boundingBox()).y;
        expect(await y('h1#motto')).toBeLessThan(await y('.hero-actions'));
        expect((await page.locator('h1#motto').textContent()).trim()).not.toMatch(/\.$/);
    });

    test('en cada recarga sale una frase distinta de la anterior', async ({ page }) => {
        await page.goto('/?lang=es');
        const read = () => page.locator('#motto').evaluate(el => ({ key: el.getAttribute('data-i18n'), text: el.textContent.trim() }));
        let prev = await read();
        expect(prev.text.length).toBeGreaterThan(20);
        const seen = new Set([prev.key]);
        for (let i = 0; i < 8; i++) {
            await page.reload();
            const cur = await read();
            expect(cur.key).not.toBe(prev.key);
            expect(cur.text.length).toBeGreaterThan(20);
            seen.add(cur.key);
            prev = cur;
        }
        expect(seen.size).toBeGreaterThan(3);
    });

    test('la frase se traduce al cambiar de idioma sin cambiar de frase', async ({ page }) => {
        await page.goto('/?lang=es');
        const key = await page.locator('#motto').getAttribute('data-i18n');
        const es = (await page.locator('#motto').textContent()).trim();
        await page.locator('#promo-lang select.lang-more').selectOption('fr');
        await expect(page.locator('#motto')).toHaveAttribute('data-i18n', key);
        await expect(page.locator('#motto')).not.toHaveText(es);
    });
});

test('los enlaces del pie van en el mismo orden que los botones bajo el titular', async ({ page }) => {
    await page.goto('/?lang=es');
    const hrefs = sel => page.locator(sel).evaluateAll(a => a.map(x => x.getAttribute('href')));
    const hero = await hrefs('.hero-actions a');
    expect(hero).toEqual(['/inicio/', '/join.html', '/solo/', '/multiplayer/', '/create/']);
    expect(await hrefs('.foot-nav a')).toEqual(hero);
});

test.describe('titular del bloque final («Libre, abierto y tuyo»…)', () => {
    test('hay 8 frases por idioma, ninguna promete «gratuito»', async ({ page }) => {
        await page.goto('/?lang=es');
        const stats = await page.evaluate(() => {
            const T = window.EduhootPromoTexts, out = {};
            for (const lang of Object.keys(T)) {
                const phrases = Array.from({ length: 8 }, (_, i) => T[lang]['cta_h2_' + (i + 1)]);
                out[lang] = { count: phrases.filter(Boolean).length, distinct: new Set(phrases).size, old: T[lang].cta_h2 !== undefined, all: phrases.join(' | ') };
            }
            return out;
        });
        for (const [lang, s] of Object.entries(stats)) {
            expect(s.count, lang).toBe(8);
            expect(s.distinct, lang).toBe(8);
            expect(s.old, `${lang}: la clave antigua ya no se usa`).toBe(false);
            expect(s.all, lang).not.toMatch(/gratu|gratis|free of charge|kostenlos/i);
        }
    });

    test('en cada recarga sale una frase distinta de la anterior', async ({ page }) => {
        await page.goto('/?lang=es');
        const read = () => page.locator('#cta-title').evaluate(el => ({ key: el.getAttribute('data-i18n'), text: el.textContent.trim() }));
        let prev = await read();
        expect(prev.key).toMatch(/^cta_h2_[1-8]$/);
        const seen = new Set([prev.key]);
        for (let i = 0; i < 8; i++) {
            await page.reload();
            const cur = await read();
            expect(cur.key).not.toBe(prev.key);
            expect(cur.text.length).toBeGreaterThan(10);
            seen.add(cur.key);
            prev = cur;
        }
        expect(seen.size).toBeGreaterThan(3);
    });

    test('la frase se traduce al cambiar de idioma sin cambiar de frase', async ({ page }) => {
        await page.goto('/?lang=es');
        const key = await page.locator('#cta-title').getAttribute('data-i18n');
        const es = (await page.locator('#cta-title').textContent()).trim();
        await page.locator('#promo-lang select.lang-more').selectOption('de');
        await expect(page.locator('#cta-title')).toHaveAttribute('data-i18n', key);
        await expect(page.locator('#cta-title')).not.toHaveText(es);
    });
});
