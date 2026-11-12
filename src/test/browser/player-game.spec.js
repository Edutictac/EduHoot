const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Socket.IO falso (mismo patrón que host-lobby.spec.js): guarda lo que la
// página emite (window.__emits) y deja lanzar eventos del servidor con
// window.__serverEmit. socket.id fijo para poder comprobar el ranking.
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
                if(name === 'disconnect') socket.connected = false;
                (handlers[name] || []).forEach(function(fn){ fn.apply(null, args || []); });
            }
        };
        window.__sockets.push(socket);
        return socket;
    };
    // Admite varios argumentos (p. ej. questionOver(playerData, payload)).
    window.__serverEmit = function(name, args){
        window.__sockets[0].__trigger(name, args);
    };
})();
`;

async function mockBackend(page) {
    await page.route(/^https:\/\//, route => route.abort());
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({
        contentType: 'application/javascript',
        body: FAKE_SOCKET_IO
    }));
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
}

async function openGame(page, query) {
    await mockBackend(page);
    await page.goto('/player/game/' + (query || '?pin=12345&name=Ana&icon=gat&lang=es'));
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

function serverEmit(page, name, ...args) {
    return page.evaluate(x => window.__serverEmit(x.name, x.args), { name, args });
}

const ANSWERS = ['Paris', 'Londres', 'Roma', 'Berlín'];

// Red de seguridad para la Subfase B (Vue): fija el comportamiento actual de
// /player/game/ (playerGame.js) para comprobar que sigue igual cuando pase a
// ser una app de Vue. El spec no debe cambiar en esa conversión.
test('al conectar se une a la partida con los datos de la URL', async ({ page }) => {
    await openGame(page);
    expect(await emitsNamed(page, 'player-join-game')).toEqual([{ pin: '12345', name: 'Ana', icon: 'gat', lang: 'es' }]);
    await expect(page.locator('#nameText')).toHaveText('Nombre:');
    await expect(page.locator('#scoreText')).toHaveText('Puntuación:');
});

// Cambio deliberado en la conversión a Vue (Subfase B, bloc 1): antes de
// recibir cualquier pregunta, los botones vacíos se veían (coloreados, sin
// texto) porque el código antiguo solo tocaba su `display` dentro de
// updatePlayerAnswerButtons(), que no se llamaba hasta la primera pregunta.
// Con la visibilidad ahora atada al contenido (vore ARCHITECTURE.md), se
// quedan ocultos hasta que llega contenido real; nunca llegan a verse así en
// el juego real, porque el servidor envía la pregunta casi enseguida.
test('antes de la primera pregunta, los botones de respuesta están ocultos (sin contenido)', async ({ page }) => {
    await openGame(page);
    for (let i = 1; i <= 4; i++) {
        await expect(page.locator('#answer' + i)).toBeHidden();
    }
});

test('playerGameData y newScore actualizan el nombre y la puntuación', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerGameData', [
        { playerId: 'p1', name: 'Ana', icon: '🐱', gameData: { score: 150 } },
        { playerId: 'p2', name: 'Pau', gameData: { score: 50 } }
    ]);
    await expect(page.locator('#nameText')).toHaveText('Nombre: 🐱 Ana');
    await expect(page.locator('#scoreText')).toHaveText('Puntuación: 150');

    await serverEmit(page, 'newScore', 300);
    await expect(page.locator('#scoreText')).toHaveText('Puntuación: 300');
});

test('pregunta normal: pinta la pregunta y las respuestas, y al responder se oculta y se envía la respuesta', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { question: 'Capital de Francia?', answers: ANSWERS, type: 'quiz', time: 15 });

    await expect(page.locator('#questionText')).toHaveText('Capital de Francia?');
    for (let i = 0; i < 4; i++) {
        await expect(page.locator('#answer' + (i + 1))).toHaveText(ANSWERS[i]);
    }

    await page.locator('#answer2').click();
    expect(await emitsNamed(page, 'playerAnswer')).toEqual([2]);
    for (let i = 1; i <= 4; i++) {
        await expect(page.locator('#answer' + i)).toBeHidden();
    }
    await expect(page.locator('#message')).toHaveText('Respuesta enviada. Esperando al resto...');
    await expect(page.locator('#playerAnswerStatus')).toHaveText('Respuesta enviada');
    await expect(page.locator('#playerAnswerStatus')).not.toHaveClass(/hidden/);
});

test('respuesta múltiple: permite marcar varias opciones y enviarlas juntas', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { question: '¿Cuáles son primos?', answers: ANSWERS, type: 'multiple', time: 20 });

    await page.locator('#answer1').click();
    await page.locator('#answer3').click();
    await expect(page.locator('#answer1')).toHaveClass(/multi-selected/);
    await expect(page.locator('#answer3')).toHaveClass(/multi-selected/);
    await expect(page.locator('#answer2')).not.toHaveClass(/multi-selected/);
    await expect(page.locator('#multiSubmitRow')).toBeVisible();
    expect(await emitsNamed(page, 'playerAnswer')).toEqual([]);

    await page.locator('#multiSubmitBtn').click();
    expect(await emitsNamed(page, 'playerAnswer')).toEqual([[1, 3]]);
    await expect(page.locator('#multiSubmitRow')).toBeHidden();
    for (let i = 1; i <= 4; i++) {
        await expect(page.locator('#answer' + i)).toBeHidden();
    }
});

test('respuesta libre de texto corto: muestra el campo y la envía como texto', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { question: '¿Capital de Italia?', type: 'short-answer', time: 20 });

    await expect(page.locator('#freeSubmitRow')).toBeVisible();
    for (let i = 1; i <= 4; i++) {
        await expect(page.locator('#answer' + i)).toBeHidden();
    }
    await expect(page.locator('#freeAnswerInput')).toHaveAttribute('placeholder', 'Escribe tu respuesta');
    await expect(page.locator('#freeSubmitBtn')).toHaveText('Enviar');

    await page.locator('#freeAnswerInput').fill('Roma');
    await page.locator('#freeSubmitBtn').click();
    expect(await emitsNamed(page, 'playerAnswer')).toEqual([{ text: 'Roma' }]);
    await expect(page.locator('#freeSubmitRow')).toBeHidden();
});

test('respuesta libre numérica: muestra el campo decimal y la envía como number', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { question: '¿Cuánto es 6x7?', type: 'numeric', time: 20 });

    await expect(page.locator('#freeAnswerInput')).toHaveAttribute('placeholder', 'Introduce un número');
    await expect(page.locator('#freeAnswerInput')).toHaveAttribute('inputmode', 'decimal');

    await page.locator('#freeAnswerInput').fill('42');
    await page.keyboard.press('Enter');
    expect(await emitsNamed(page, 'playerAnswer')).toEqual([{ number: '42' }]);
});

test('modo a ciegas: solo se ven las formas activas, sin texto, y se puede responder igual', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { blind: true, type: 'quiz', answerCount: 2, time: 20 });

    await expect(page.locator('#questionText')).toHaveText('Mira la pantalla para ver la pregunta');
    await expect(page.locator('#answer1')).toBeVisible();
    await expect(page.locator('#answer1')).toHaveText('');
    await expect(page.locator('#answer1')).toHaveAttribute('aria-label', 'Opción A: triángulo');
    await expect(page.locator('#answer2')).toBeVisible();
    await expect(page.locator('#answer3')).toBeHidden();
    await expect(page.locator('#answer3')).toHaveAttribute('aria-label', '');
    await expect(page.locator('#answer4')).toBeHidden();

    await page.locator('#answer1').click();
    expect(await emitsNamed(page, 'playerAnswer')).toEqual([1]);
});

test('multiplicador de puntos dobles: muestra la insignia mientras está activo', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { question: 'Bonus', answers: ANSWERS, type: 'quiz', time: 20, pointsMultiplier: 2 });
    await expect(page.locator('#playerPointsBadge')).toBeVisible();
    await expect(page.locator('#playerPointsBadge')).toContainText('x2');
    await expect(page.locator('#playerPointsBadge')).toContainText('Puntos dobles');

    await serverEmit(page, 'playerQuestion', { question: 'Normal', answers: ANSWERS, type: 'quiz', time: 20 });
    await expect(page.locator('#playerPointsBadge')).toBeHidden();
});

test('resultado correcto: pinta el mensaje y a los 3 s aparece el ranking', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { question: 'Capital de Francia?', answers: ANSWERS, type: 'quiz', time: 15 });
    await page.locator('#answer1').click();
    await serverEmit(page, 'answerResult', { outcome: 'correct' });

    const playerData = [
        { playerId: 'p1', name: 'Ana', gameData: { score: 500 } },
        { playerId: 'p2', name: 'Pau', gameData: { score: 100 } }
    ];
    await serverEmit(page, 'questionOver', playerData);

    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(76, 175, 80)');
    await expect(page.locator('#message')).toHaveText('¡Correcto!');
    await expect(page.locator('#rankText')).toHaveText('Top 10 - Puesto 1');

    const modal = page.locator('#playerRankingModal');
    await expect(modal).toHaveClass(/show/, { timeout: 4000 });
    const items = page.locator('#playerRankingList li');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveText('Ana - 500 (Tú)');
    await expect(items.nth(1)).toHaveText('Pau - 100');
});

test('resultado incorrecto: muestra la respuesta correcta a partir de las respuestas mostradas', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { question: 'Capital de Francia?', answers: ANSWERS, type: 'quiz', time: 15 });
    await page.locator('#answer2').click();

    await serverEmit(page, 'questionOver', [{ playerId: 'p1', name: 'Ana', gameData: { score: 0 } }], { type: 'quiz', correctAnswers: [1] });

    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(249, 74, 30)');
    await expect(page.locator('#message')).toContainText('¡Incorrecto!');
    await expect(page.locator('#message .player-correct-answer')).toHaveText('Respuesta correcta: Paris');
});

test('resultado parcial y de encuesta: fondo y mensaje propios de cada caso', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { question: 'Q1', answers: ANSWERS, type: 'quiz', time: 15 });
    await page.locator('#answer1').click();
    await serverEmit(page, 'answerResult', { outcome: 'partial' });
    await serverEmit(page, 'questionOver', [{ playerId: 'p1', name: 'Ana', gameData: { score: 10 } }]);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 179, 0)');
    await expect(page.locator('#message')).toHaveText('Respuesta parcialmente correcta: has sumado puntos.');

    await serverEmit(page, 'nextQuestionPlayer');
    await serverEmit(page, 'playerQuestion', { question: 'Q2 (encuesta)', answers: ANSWERS, type: 'quiz', time: 15 });
    await page.locator('#answer1').click();
    await serverEmit(page, 'questionOver', [{ playerId: 'p1', name: 'Ana', gameData: { score: 10 } }], { type: 'poll' });
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(96, 125, 139)');
    await expect(page.locator('#message')).toHaveText('¡Gracias por responder!');
});

// Orden real del servidor (sockets/hostEvents.js:216-217): nextQuestionPlayer
// primero (limpia el resultado anterior), scheduleQuestionCountdown después
// (cuenta atrás), y la siguiente playerQuestion al final.
test('nextQuestionPlayer limpia el resultado anterior, y luego se ve la cuenta atrás', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { question: 'Q1', answers: ANSWERS, type: 'quiz', time: 15 });
    await page.locator('#answer1').click();
    await serverEmit(page, 'questionOver', [{ playerId: 'p1', name: 'Ana', gameData: { score: 10 } }], { type: 'quiz', correctAnswers: [] });

    await serverEmit(page, 'nextQuestionPlayer');
    await expect(page.locator('#message')).toBeHidden();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    for (let i = 1; i <= 4; i++) {
        await expect(page.locator('#answer' + i)).toBeVisible();
    }

    await serverEmit(page, 'questionCountdown', { seconds: 3 });
    await expect(page.locator('#questionCountdown')).toHaveClass(/is-visible/);
    await expect(page.locator('#questionCountdownNumber')).toHaveText('3');
    for (let i = 1; i <= 4; i++) {
        await expect(page.locator('#answer' + i)).toBeHidden();
    }
});

// Caso real de la primera pregunta de cada partida (sockets/gameHelpers.js:
// scheduleQuestionCountdown + startCurrentQuestion): el servidor nunca manda
// nextQuestionPlayer antes de la pregunta 1, solo questionCountdown y luego
// playerQuestion. Encontrado jugando una partida real contra el contenedor
// de dev: sin este caso, los botones se quedaban ocultos en toda la primera
// pregunta (ninguna de las otras pruebas pasa primero por un countdown).
test('primera pregunta de la partida: tras el countdown (sin nextQuestionPlayer antes), los botones se ven', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'questionCountdown', { seconds: 3 });
    for (let i = 1; i <= 4; i++) {
        await expect(page.locator('#answer' + i)).toBeHidden();
    }

    await serverEmit(page, 'playerQuestion', { question: 'Q1', answers: ANSWERS, type: 'quiz', time: 15 });
    for (let i = 1; i <= 4; i++) {
        await expect(page.locator('#answer' + i)).toBeVisible();
    }
});

test('GameOver: muestra el mensaje final y oculta los controles de respuesta', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { question: 'Última', answers: ANSWERS, type: 'quiz', time: 15 });
    await serverEmit(page, 'GameOver');

    await expect(page.locator('#message')).toHaveText('PARTIDA TERMINADA');
    for (let i = 1; i <= 4; i++) {
        await expect(page.locator('#answer' + i)).toBeHidden();
    }
});

test('reconexión: al desconectar avisa, y al reconectar vuelve a unirse a la partida', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'disconnect');
    await expect(page.locator('#message')).toContainText('Reconectando... te hemos guardado el sitio durante');

    await serverEmit(page, 'connect');
    expect(await emitsNamed(page, 'player-join-game')).toHaveLength(2);
});

// Maquetació: en PC les respostes formen una quadrícula de 2x2 centrada; en
// mòbil, amb imatge, les quatre respostes caben en pantalla.
test('las respuestas están centradas y, con imagen, caben en pantalla', async ({ page }, testInfo) => {
    const IMG = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#4a8"/></svg>';
    await page.route('**/big.svg', r => r.fulfill({ contentType: 'image/svg+xml', body: IMG }));
    // Mòbil menut i habitual (el Pixel 7 del projecte és molt alt).
    if (testInfo.project.name === 'mobile') await page.setViewportSize({ width: 360, height: 640 });
    await openGame(page);
    await serverEmit(page, 'playerQuestion', { question: 'Quin instrument es toca pinçant les cordes amb els dits?', answers: ANSWERS, type: 'quiz', time: 20 });
    await serverEmit(page, 'questionMedia', { image: '/big.svg' });
    await expect(page.locator('#playerQuestionImage')).toBeVisible();
    const viewport = page.viewportSize();
    const boxes = [];
    for (const id of ['#answer1', '#answer2', '#answer3', '#answer4']) boxes.push(await page.locator(id).boundingBox());
    for (const box of boxes) expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    const left = Math.min(...boxes.map(b => b.x));
    const right = Math.max(...boxes.map(b => b.x + b.width));
    expect(Math.abs(left - (viewport.width - right))).toBeLessThan(4);
    if (testInfo.project.name === 'desktop') {
        expect(boxes[0].y).toBe(boxes[1].y);
        expect(boxes[2].y).toBe(boxes[3].y);
        expect(boxes[2].y).toBeGreaterThan(boxes[0].y);
    }
});
