const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Resultado en la pantalla del alumnado: la barra de tiempo se oculta y vuelve con la cuenta atrás.
const FAKE_SOCKET_IO = `
(function(){
    window.__emits = [];
    window.__sockets = [];
    window.io = function(){
        var handlers = {};
        var socket = {
            id: 'p1',
            connected: false,
            on: function(name, fn){ (handlers[name] = handlers[name] || []).push(fn); return socket; },
            emit: function(name, data){ window.__emits.push({ name: name, data: JSON.parse(JSON.stringify(data === undefined ? null : data)) }); return socket; },
            connect: function(){ socket.connected = true; return socket; },
            disconnect: function(){ socket.connected = false; return socket; },
            __trigger: function(name, args){
                if(name === 'connect') socket.connected = true;
                (handlers[name] || []).forEach(function(fn){ fn.apply(null, args || []); });
            }
        };
        window.__sockets.push(socket);
        return socket;
    };
    window.__serverEmit = function(name, args){ window.__sockets[0].__trigger(name, args); };
})();
`;

async function openGame(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.goto('/player/game/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
    await page.evaluate(() => window.__serverEmit('playerQuestion', [{ question: 'Capital de Francia?', answers: ['Paris', 'Roma', 'Londres', 'Berlín'], type: 'quiz', time: 15 }]));
}

test('alumnado: al mostrar «Correcto» se oculta la barra de tiempo, y vuelve con la cuenta atrás', async ({ page }) => {
    await openGame(page);
    await expect(page.locator('#playerTimer')).toBeVisible();

    await page.evaluate(() => window.__serverEmit('answerResult', [{ outcome: 'correct', streak: 1, bonus: 0 }]));
    await page.evaluate(() => window.__serverEmit('questionOver', [[], { type: 'quiz' }]));
    await expect(page.locator('#message')).toHaveText('¡Correcto!');
    await expect(page.locator('#playerTimer')).toBeHidden();

    await page.evaluate(() => window.__serverEmit('nextQuestionPlayer', []));
    await expect(page.locator('#playerTimer')).toBeVisible();
});

test('alumnado: «Correcto» en amarillo del logo sobre recuadro verde, 40 % más grande', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.__serverEmit('answerResult', [{ outcome: 'correct', streak: 1, bonus: 0 }]));
    await page.evaluate(() => window.__serverEmit('questionOver', [[], { type: 'quiz' }]));
    const msg = page.locator('#message');
    await expect(msg).toHaveCSS('color', 'rgb(253, 188, 75)');
    await expect(msg).toHaveCSS('background-color', 'rgb(22, 101, 52)');
    await expect(msg).toHaveCSS('font-size', page.viewportSize().width <= 600 ? '30.8px' : '39.2px');
});

test('alumnado: «Incorrecto» en blanco sobre recuadro rojo vivo, 40 % más grande', async ({ page }) => {
    await openGame(page);
    await page.evaluate(() => window.__serverEmit('answerResult', [{ outcome: 'incorrect', streak: 0, bonus: 0 }]));
    await page.evaluate(() => window.__serverEmit('questionOver', [[], { type: 'quiz' }]));
    const msg = page.locator('#message');
    await expect(msg).toHaveText(/Incorrecto/);
    await expect(msg).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(msg).toHaveCSS('background-color', 'rgb(255, 23, 68)');
    await expect(msg).toHaveCSS('font-size', page.viewportSize().width <= 600 ? '30.8px' : '39.2px');
});
