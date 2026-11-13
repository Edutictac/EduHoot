const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Pantalla completa de la partida (/solo/ i /player/game/): ocupa la finestra
// visible del navegador amb un marge petit, sense desplaçament horizontal.
// La mida la llig js/viewport-fit.js i la deixa en --app-vh.

const Q = 'Quina és la capital del país que limita amb Portugal?';
const ANS = ['Madrid', 'Barcelona', 'València', 'Sevilla'];
const quiz = { id: 'q1', name: 'Geografia', tags: [], questions: [{ question: Q, type: 'quiz', answers: ANS, correctAnswers: [1], time: 20 }] };
const VIEWPORTS = [
    { name: 'PC', size: { width: 1280, height: 800 } },
    { name: 'mòbil', size: { width: 360, height: 640 } },
    { name: 'mòbil horitzontal', size: { width: 740, height: 360 } }
];

const FAKE_IO = `(function(){ window.__sockets=[]; window.io=function(){ var h={}; var s={id:'p1',connected:false,
 on:function(n,f){(h[n]=h[n]||[]).push(f);return s;}, emit:function(){return s;}, connect:function(){return s;}, disconnect:function(){return s;},
 __trigger:function(n,a){ (h[n]||[]).forEach(function(f){f.apply(null,a||[]);}); } }; window.__sockets.push(s); return s; };
 window.__serverEmit=function(n,a){ window.__sockets[0].__trigger(n,a); }; })();`;

async function measure(page) {
    return page.evaluate(() => {
        const area = document.querySelector('#game-panel, #player-game');
        const grid = document.querySelector('#answers, #answerGrid');
        const b = area.getBoundingClientRect();
        const g = grid.getBoundingClientRect();
        return {
            vh: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-vh')),
            innerH: window.innerHeight,
            innerW: window.innerWidth,
            panelBottom: Math.round(b.bottom),
            panelLeft: Math.round(b.left),
            panelRight: Math.round(b.right),
            gridBottom: Math.round(g.bottom),
            scrollW: document.documentElement.scrollWidth
        };
    });
}

function expectFullScreen(m, vp) {
    const margin = vp.size.height - m.panelBottom;
    expect(m.scrollW).toBeLessThanOrEqual(vp.size.width);
    expect(m.innerH).toBe(vp.size.height);
    expect(m.vh).toBe(vp.size.height);
    // Marge petit i constant a baix (uns 12 px), i la partida no es queda amunt.
    expect(margin).toBeGreaterThanOrEqual(8);
    expect(margin).toBeLessThanOrEqual(16);
    expect(m.panelLeft).toBeGreaterThanOrEqual(0);
    expect(m.panelRight).toBeLessThanOrEqual(vp.size.width);
    // Les respostes també caben: no es desborden per baix.
    expect(m.gridBottom).toBeLessThanOrEqual(vp.size.height - 4);
}

for (const vp of VIEWPORTS) {
    test(`/solo/ ocupa la pantalla (${vp.name})`, async ({ page }) => {
        await page.setViewportSize(vp.size);
        await page.addInitScript(() => { Math.random = () => 0.999; });
        await page.route(/^https:\/\//, r => r.abort());
        await page.route('**/api/**', r => {
            const p = new URL(r.request().url()).pathname;
            if (p === '/api/public-quizzes') return r.fulfill({ json: [] });
            if (p.endsWith('/solo-ranking')) return r.fulfill({ json: { top: [] } });
            if (p === '/api/quizzes/q1') return r.fulfill({ json: quiz });
            return r.fulfill({ json: {} });
        });
        await page.clock.install();
        await page.goto('/solo/?id=q1&lang=es');
        await expect(page.locator('#start-form')).toBeVisible();
        await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
        await page.locator('#start-btn').click();
        await expect(page.locator('#solo-countdown span')).toHaveText('3');
        await page.clock.runFor(3000);
        await expect(page.locator('#answers .answer').first()).toBeVisible();
        expect(await page.locator('.ett-footer').isVisible()).toBe(false);
        expectFullScreen(await measure(page), vp);
    });

    test(`«Jugar a l'aula» ocupa la pantalla (${vp.name})`, async ({ page }) => {
        await page.setViewportSize(vp.size);
        await page.route(/^https:\/\//, r => r.abort());
        await page.route('**/socket.io/socket.io.js', r => r.fulfill({ contentType: 'application/javascript', body: FAKE_IO }));
        await page.route('**/api/**', r => r.fulfill({ json: {} }));
        await page.goto('/player/game/?pin=12345&name=Ana&icon=gat&lang=es');
        await page.evaluate(() => window.__serverEmit('connect'));
        await page.evaluate(([q, a]) => window.__serverEmit('playerQuestion', [{ question: q, answers: a, type: 'quiz', time: 20 }]), [Q, ANS]);
        await expect(page.locator('#answerGrid .button').first()).toBeVisible();
        expectFullScreen(await measure(page), vp);
    });
}
