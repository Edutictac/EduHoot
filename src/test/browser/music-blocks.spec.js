// El bloc de música de fons és el mateix component (music-player.js) a solo, a l'anfitrió (lobby, a su ritmo i partida)
// i a multijugador: reprodueix i para amb el botó, i canvia de pista amb els botons i amb el selector,
// sense aturar-se ni tornar a sonar si estava parat.
const { test, expect } = require('@playwright/test');

const TEACHER = { id: 't', email: 'x@example.invalid', role: 'editor', nickname: 'Teacher' };
const FAKE_SOCKET_IO = 'window.io=function(){var h={};var s={id:"host-1",connected:false,on:function(n,f){(h[n]=h[n]||[]).push(f);return s;},emit:function(){return s;},disconnect:function(){},connect:function(){s.connected=true;return s;},__trigger:function(n,d){if(n==="connect")s.connected=true;(h[n]||[]).forEach(function(f){f(d);});}};window.__sockets=[s];window.__serverEmit=function(n,d){s.__trigger(n,d);};return s;};';

const PAGES = [
    { name: 'solo', url: '/solo/?id=q1&lang=es', container: 'solo-music-player' },
    { name: 'anfitrión (sala)', url: '/host/?id=q1&lang=es', container: 'host-lobby-music-player' },
    { name: 'anfitrión (a su ritmo)', url: '/host/self-paced/?id=q1&lang=es', container: 'sp-music-player' },
    { name: 'anfitrión (partida)', url: '/host/game/?lang=es', container: 'host-music-player' },
    { name: 'multijugador', url: '/multiplayer/?lang=es', container: 'multiplayer-music-player' },
];

async function openPage(page, url) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/auth/me') return route.fulfill({ status: 401, json: {} });
        if (pathname === '/api/quizzes') return route.fulfill({ json: [{ id: 'q1', name: 'Geografia', tags: [], visibility: 'public', allowClone: true, questionCount: 5, playsCount: 0, playersCount: 0, createdAt: '2026-10-01T00:00:00Z', ownerNickname: 'T', ownerId: 't' }] });
        if (pathname === '/api/public-quizzes') return route.fulfill({ json: [] });
        return route.fulfill({ json: { enabled: false } });
    });
    await page.goto(url);
    await page.waitForTimeout(400);
}

function state(page, id) {
    return page.evaluate((cid) => {
        const c = document.getElementById(cid);
        const a = c.querySelector('audio');
        return { paused: a.paused, src: a.src, value: c.querySelector('.music-player__select').value };
    }, id);
}

for (const p of PAGES) {
    test(`música de fons (${p.name}): reproduir, parar i canviar de pista amb botons i selector`, async ({ page }) => {
        await openPage(page, p.url);
        const c = `#${p.container}`;
        const toggle = page.locator(`${c} .music-player__toggle`);
        const next = page.locator(`${c} .music-player__nav--next`);
        const select = page.locator(`${c} .music-player__select`);

        // Reprodueix i para amb el botó.
        await toggle.click();
        await expect.poll(async () => (await state(page, p.container)).paused).toBe(false);
        await toggle.click();
        await expect.poll(async () => (await state(page, p.container)).paused).toBe(true);

        // Parat: el botó «següent» canvia la pista i continua parat.
        const before = await state(page, p.container);
        await next.click();
        await expect.poll(async () => (await state(page, p.container)).src).not.toBe(before.src);
        expect((await state(page, p.container)).paused).toBe(true);

        // Sonant: el botó «següent» canvia la pista i continua sonant.
        await toggle.click();
        await expect.poll(async () => (await state(page, p.container)).paused).toBe(false);
        const playing = await state(page, p.container);
        await next.click();
        await expect.poll(async () => (await state(page, p.container)).src).not.toBe(playing.src);
        await expect.poll(async () => (await state(page, p.container)).paused).toBe(false);

        // Sonant: el selector canvia la pista i continua sonant.
        const options = await select.locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
        const current = (await state(page, p.container)).value;
        const other = options.find(v => v !== current);
        await select.selectOption(other);
        await expect.poll(async () => (await state(page, p.container)).value).toBe(other);
        await expect.poll(async () => (await state(page, p.container)).paused).toBe(false);

        // Parat: el selector canvia la pista i continua parat.
        await toggle.click();
        await expect.poll(async () => (await state(page, p.container)).paused).toBe(true);
        const second = options.find(v => v !== other) || options[0];
        await select.selectOption(second);
        await expect.poll(async () => (await state(page, p.container)).value).toBe(second);
        await expect.poll(async () => (await state(page, p.container)).paused).toBe(true);
    });
}
