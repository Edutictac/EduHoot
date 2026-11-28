const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Casilla «Puntuaciones entre preguntas y ranking» desmarcada (showScores /
// showPodium = false). Socket.IO falso igual que en player-game.spec.js y
// host-game.spec.js.
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

function serverEmit(page, name, ...args) {
    return page.evaluate(x => window.__serverEmit(x.name, x.args), { name, args });
}

// ---------- Alumno ----------

async function openPlayer(page) {
    await mockBackend(page);
    await page.goto('/player/game/?pin=12345&name=Ana&icon=gat&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

const PLAYER_ANSWERS = ['Paris', 'Londres', 'Roma', 'Berlín'];

test('alumno: sin puntuaciones entre preguntas no ve posición ni Top 10 tras la pregunta', async ({ page }) => {
    await openPlayer(page);
    await serverEmit(page, 'playerQuestion', { question: 'Capital de Francia?', answers: PLAYER_ANSWERS, type: 'quiz', time: 15 });
    await page.locator('#answer1').click();
    await serverEmit(page, 'answerResult', { outcome: 'correct' });

    const playerData = [
        { playerId: 'p1', name: 'Ana', gameData: { score: 500 } },
        { playerId: 'p2', name: 'Pau', gameData: { score: 100 } }
    ];
    await serverEmit(page, 'questionOver', playerData, { type: 'quiz', correctAnswers: [1], showScores: false });

    // El feedback de la respuesta sigue igual; lo que cambia es el ranking.
    await expect(page.locator('#message')).toHaveText('¡Correcto!');
    await expect(page.locator('#rankText')).toBeHidden();

    // El Top 10 se abre a los 3 s cuando la casilla está marcada; aquí no debe abrirse.
    await page.waitForTimeout(3500);
    await expect(page.locator('#playerRankingModal')).not.toHaveClass(/show/);
});

test('alumno: con la casilla marcada sigue mostrando la posición y el Top 10', async ({ page }) => {
    await openPlayer(page);
    await serverEmit(page, 'playerQuestion', { question: 'Capital de Francia?', answers: PLAYER_ANSWERS, type: 'quiz', time: 15 });
    await page.locator('#answer1').click();
    await serverEmit(page, 'answerResult', { outcome: 'correct' });

    const playerData = [{ playerId: 'p1', name: 'Ana', gameData: { score: 500 } }];
    await serverEmit(page, 'questionOver', playerData, { type: 'quiz', correctAnswers: [1], showScores: true });

    await expect(page.locator('#rankText')).toHaveText('Top 10 - Puesto 1');
    await expect(page.locator('#playerRankingModal')).toHaveClass(/show/, { timeout: 4000 });
});

// ---------- Host ----------

async function openHost(page) {
    await mockBackend(page);
    await page.goto('/host/game/?id=g1&pin=12345&lang=es');
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

function gameQuestionsPayload(overrides) {
    return Object.assign({
        q1: 'Capital de Francia?',
        a1: 'Paris', a2: 'Londres', a3: 'Roma', a4: 'Berlin',
        type: 'quiz',
        time: 15,
        playersInGame: 2,
        questionNumber: 1,
        totalQuestions: 3,
        showScores: false
    }, overrides || {});
}

const HOST_PLAYER_DATA = [
    { playerId: 'p1', name: 'Ana', icon: '🐱', gameData: { score: 500, answer: 1 } },
    { playerId: 'p2', name: 'Pau', gameData: { score: 300, answer: 2 } }
];

test('host: sin puntuaciones entre preguntas no ofrece el botón de ranking', async ({ page }) => {
    await openHost(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());

    await expect(page.locator('#showRanking')).toBeHidden();
});

test('host: con puntuaciones entre preguntas el botón de ranking sigue visible', async ({ page }) => {
    await openHost(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload({ showScores: true }));

    await expect(page.locator('#showRanking')).toBeVisible();
});

test('host: al terminar la pregunta, el paso de resultados va directo a la siguiente pregunta', async ({ page }) => {
    await openHost(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await serverEmit(page, 'questionOver', HOST_PLAYER_DATA, { type: 'quiz', correctAnswers: [1], showScores: false });

    await expect(page.locator('#resultsStepChart')).toBeVisible();
    await expect(page.locator('#rankingNextBtn')).toHaveText('Siguiente pregunta (Enter)');

    // Con la casilla desmarcada no hay paso de clasificación: avanza a la siguiente pregunta.
    await page.locator('#rankingNextBtn').click();
    await expect(page.locator('#rankingModal')).toBeHidden();
    await expect(page.locator('#resultsStepRanking')).toBeHidden();
});

test('host: GameOver sin puntuaciones entre preguntas no muestra el podio final', async ({ page }) => {
    await openHost(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await serverEmit(page, 'GameOver', { num1: 'Ana', num2: 'Pau', num3: '', num4: '', num5: '', showPodium: false });

    await expect(page.locator('#question')).toHaveText('FIN DE LA PARTIDA');
    await expect(page.locator('#winnerTitle')).toBeHidden();
    await expect(page.locator('#winner1')).toBeHidden();
    await expect(page.locator('#downloadReportBtn')).toBeVisible();
});

test('host: GameOver con puntuaciones entre preguntas muestra el podio', async ({ page }) => {
    await openHost(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload({ showScores: true }));
    await serverEmit(page, 'GameOver', { num1: 'Ana', num2: 'Pau', num3: '', num4: '', num5: '', showPodium: true });

    await expect(page.locator('#winnerTitle')).toBeVisible();
    await expect(page.locator('#winner1')).toHaveText('1. Ana');
});
