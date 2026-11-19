const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Pregunta de correspondencia en el móvil del alumnado (Jugar a l'aula), con el
// Socket.IO falso de player-game.spec.js.
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
            disconnect: function(){ socket.connected = false; return socket; },
            __trigger: function(name, args){
                if(name === 'connect') socket.connected = true;
                (handlers[name] || []).forEach(function(fn){ fn.apply(null, args); });
            }
        };
        window.__sockets.push(socket);
        return socket;
    };
    window.__serverEmit = function(name, args){ window.__sockets[0].__trigger(name, args || []); };
})();
`;

const LEFT = ['Francia', 'Italia', 'Alemania'];
const RIGHT = ['Roma', 'Lisboa', 'Berlín', 'París'];
const SOLUTION = [3, 0, 2];
const PLAYERS = [{ playerId: 'p1', name: 'Ana', gameData: { score: 10 } }];

async function openGame(page) {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.__errors = errors;
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: FAKE_SOCKET_IO }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.goto('/player/game/?pin=123456&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

const serverEmit = (page, name, ...args) => page.evaluate(([n, a]) => window.__serverEmit(n, a), [name, args]);
const answers = (page) => page.evaluate(() => window.__emits.filter(e => e.name === 'playerAnswer').map(e => e.data));

test.afterEach(async ({ page }) => {
    expect(page.__errors).toEqual([]);
});

async function question(page, extra = {}) {
    await serverEmit(page, 'playerQuestion', { question: 'Capitales', type: 'matching', answers: [], matchLeft: LEFT, matchRight: RIGHT, time: 30, ...extra });
}

test('con texto: dos columnas, se empareja con toques y se envía un índice por elemento', async ({ page }) => {
    await openGame(page);
    await question(page);
    await expect(page.locator('[data-match-left]')).toHaveCount(3);
    await expect(page.locator('[data-match-right]')).toHaveCount(4);
    await expect(page.locator('#answer1')).toBeHidden();
    await expect(page.locator('.matching-send')).toBeDisabled();

    await page.locator('[data-match-left="0"]').click();
    await page.locator('[data-match-right="3"]').click();
    await page.locator('[data-match-right="0"]').click();
    await page.locator('[data-match-left="1"]').click();
    await expect(page.locator('[data-match-left="0"] .matching-tag')).toHaveText('D');
    await expect(page.locator('.matching-count')).toHaveText('2 de 3 emparejadas');

    await page.locator('.matching-send').click();
    await expect(page.locator('.matching-board')).toHaveCount(0);
    expect(await answers(page)).toEqual([[3, 0, null]]);
});

test('resultado parcial: naranja, parejas acertadas y corrección', async ({ page }) => {
    await openGame(page);
    await question(page);
    await page.locator('[data-match-left="0"]').click();
    await page.locator('[data-match-right="3"]').click();
    await page.locator('[data-match-left="1"]').click();
    await page.locator('[data-match-right="1"]').click();
    await page.locator('.matching-send').click();

    await serverEmit(page, 'answerResult', { outcome: 'partial', ratio: 1 / 3 });
    await serverEmit(page, 'questionOver', PLAYERS, { type: 'matching', matchLeft: LEFT, matchRight: RIGHT, matchSolution: SOLUTION });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(245, 124, 0)');
    await expect(page.locator('#message')).toHaveClass(/message--partial/);
    await expect(page.locator('.matching-pairs')).toHaveText('1 de 3 parejas');
    const rows = page.locator('.matching-review-row');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toHaveAttribute('data-ok', 'true');
    await expect(rows.nth(1)).toContainText('2 Italia → B Lisboa');
    await expect(rows.nth(1)).toContainText('Respuesta correcta: A Roma');
    await expect(rows.nth(2)).toContainText('sin emparejar');
});

test('sin «Mostrar respuestas» (sin solución): solo el número de parejas, sin corrección', async ({ page }) => {
    await openGame(page);
    await question(page);
    await page.locator('[data-match-left="0"]').click();
    await page.locator('[data-match-right="1"]').click();
    await page.locator('.matching-send').click();
    await serverEmit(page, 'answerResult', { outcome: 'incorrect' });
    await serverEmit(page, 'questionOver', PLAYERS, { type: 'matching', matchLeft: LEFT, matchRight: RIGHT });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(249, 74, 30)');
    await expect(page.locator('.matching-pairs')).toHaveText('0 de 3 parejas');
    await expect(page.locator('.matching-review-row')).toHaveCount(0);
});

test('todo bien: verde y todas las parejas', async ({ page }) => {
    await openGame(page);
    await question(page);
    for (let i = 0; i < 3; i++) {
        await page.locator(`[data-match-left="${i}"]`).click();
        await page.locator(`[data-match-right="${SOLUTION[i]}"]`).click();
    }
    await page.locator('.matching-send').click();
    expect(await answers(page)).toEqual([SOLUTION]);
    await serverEmit(page, 'answerResult', { outcome: 'correct' });
    await serverEmit(page, 'questionOver', PLAYERS, { type: 'matching', matchLeft: LEFT, matchRight: RIGHT, matchSolution: SOLUTION });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(76, 175, 80)');
    await expect(page.locator('.matching-pairs')).toHaveText('3 de 3 parejas');
});

const blindQuestion = (page, blindStyle) => serverEmit(page, 'playerQuestion', {
    blind: true, answerCount: 0, type: 'matching', leftCount: 3, rightCount: 4, blindStyle, time: 30
});

test('a ciegas, toques con códigos: solo números y letras', async ({ page }) => {
    await openGame(page);
    await blindQuestion(page, 'codes');
    await expect(page.locator('.matching-txt')).toHaveCount(0);
    await expect(page.locator('[data-match-left="2"]')).toHaveText('3');
    await page.locator('[data-match-left="2"]').click();
    await page.locator('[data-match-right="1"]').click();
    await page.locator('.matching-send').click();
    expect(await answers(page)).toEqual([[null, null, 1]]);
});

test('a ciegas, desplegables: una letra por número', async ({ page }) => {
    await openGame(page);
    await blindQuestion(page, 'select');
    await expect(page.locator('[data-match-select]')).toHaveCount(3);
    await page.locator('#match-sel-0').selectOption('2');
    await expect(page.locator('#match-sel-1 option[value="2"]')).toHaveText('C (ahora en el 1)');
    await page.locator('#match-sel-1').selectOption('3');
    await page.locator('.matching-send').click();
    expect(await answers(page)).toEqual([[2, 3, null]]);
});

test('a ciegas, paso a paso: al elegir pasa al siguiente número', async ({ page }) => {
    await openGame(page);
    await blindQuestion(page, 'steps');
    await expect(page.locator('.matching-step-now')).toContainText('¿Qué letra va con el 1?');
    await page.locator('[data-match-step="3"]').click();
    await expect(page.locator('.matching-step-now')).toContainText('¿Qué letra va con el 2?');
    await page.locator('[data-match-step="0"]').click();
    await page.locator('[data-match-go="0"]').click();
    await page.locator('[data-match-step="2"]').click();
    await expect(page.locator('[data-match-go="0"]')).toHaveText('1 → C');
    await page.locator('.matching-send').click();
    expect(await answers(page)).toEqual([[2, 0, null]]);
});
