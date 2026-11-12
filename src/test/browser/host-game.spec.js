const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Socket.IO falso (mismo patrón que player-game.spec.js): admite varios
// argumentos por evento (p. ej. questionOver(playerData, payload)).
const FAKE_SOCKET_IO = `
(function(){
    window.__emits = [];
    window.__sockets = [];
    window.io = function(){
        var handlers = {};
        var socket = {
            connected: false,
            on: function(name, fn){ (handlers[name] = handlers[name] || []).push(fn); return socket; },
            emit: function(name, data){ window.__emits.push({ name: name, data: JSON.parse(JSON.stringify(data === undefined ? null : data)) }); return socket; },
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

async function openGame(page, query) {
    await mockBackend(page);
    await page.goto('/host/game/' + (query || '?id=g1&pin=12345&lang=es'));
    await page.waitForLoadState('load');
    await page.evaluate(() => window.__serverEmit('connect'));
}

function emitsNamed(page, name) {
    return page.evaluate(n => window.__emits.filter(e => e.name === n).map(e => e.data), name);
}

function serverEmit(page, name, ...args) {
    return page.evaluate(x => window.__serverEmit(x.name, x.args), { name, args });
}

const ANSWERS = ['Paris', 'Londres', 'Roma', 'Berlin'];

function gameQuestionsPayload(overrides) {
    return Object.assign({
        q1: 'Capital de Francia?',
        a1: ANSWERS[0], a2: ANSWERS[1], a3: ANSWERS[2], a4: ANSWERS[3],
        type: 'quiz',
        time: 15,
        playersInGame: 2,
        questionNumber: 1,
        totalQuestions: 3,
        showScores: true
    }, overrides || {});
}

// Red de seguridad para la Subfase B (Vue): fija el comportamiento actual de
// /host/game/ (hostGame.js) para comprobar que sigue igual cuando pase a ser
// una app de Vue. El spec no debe cambiar en esa conversión. Complementa
// host-game-timer.spec.js (issue #21) y host-game-end.spec.js (issue #17),
// que ya cubren casos concretos y no se repiten aquí.
test('al conectar se une a la partida y muestra el PIN', async ({ page }) => {
    await openGame(page);
    expect(await emitsNamed(page, 'host-join-game')).toEqual([{ id: 'g1', pin: '12345', lang: 'es' }]);
    await expect(page.locator('#pin-badge')).toHaveText('PIN 12345');
});

test('gameQuestions pinta la pregunta, las respuestas y el contador de jugadores', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());

    await expect(page.locator('#question')).toHaveText('Capital de Francia?');
    for (let i = 0; i < 4; i++) {
        await expect(page.locator('#answer' + (i + 1))).toHaveText(ANSWERS[i]);
    }
    await expect(page.locator('#questionNum')).toHaveText('Pregunta 1 / 3');
    await expect(page.locator('#playersAnswered')).toHaveText('Han respondido 0 / 2');
    await expect(page.locator('#timerText')).toBeVisible();
    await expect(page.locator('#num')).toHaveText(' 15');

    await serverEmit(page, 'updatePlayersAnswered', { playersAnswered: 1, playersInGame: 2 });
    await expect(page.locator('#playersAnswered')).toHaveText('Han respondido 1 / 2');
});

test('preguntas de tipo cierto/falso solo muestran dos respuestas', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload({ type: 'true-false', a1: 'Cert', a2: 'Fals', a3: '', a4: '' }));
    await expect(page.locator('#answer1')).toBeVisible();
    await expect(page.locator('#answer2')).toBeVisible();
    await expect(page.locator('#answer3')).toBeHidden();
    await expect(page.locator('#answer4')).toBeHidden();
});

test('multiplicador de puntos dobles: muestra la insignia mientras está activo', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload({ pointsMultiplier: 2 }));
    await expect(page.locator('#questionPointsBadge')).toBeVisible();
    await expect(page.locator('#questionPointsBadge')).toContainText('x2');
    await expect(page.locator('#questionPointsBadge')).toContainText('Puntos dobles');

    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await expect(page.locator('#questionPointsBadge')).toBeHidden();
});

test('cuenta atrás: oculta el temporizador y los cuadrados, y pinta la cuenta', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await serverEmit(page, 'questionCountdown', { seconds: 3, questionNumber: 2, totalQuestions: 3 });

    await expect(page.locator('#questionCountdown')).toHaveClass(/is-visible/);
    await expect(page.locator('#questionCountdownNumber')).toHaveText('3');
    await expect(page.locator('#timerText')).toBeHidden();
    await expect(page.locator('#playersAnswered')).toHaveText('Prepara la siguiente pregunta...');
    await expect(page.locator('#questionNum')).toHaveText('Pregunta 2 / 3');
});

const PLAYER_DATA = [
    { playerId: 'p1', name: 'Ana', icon: '🐱', gameData: { score: 500, answer: 1 } },
    { playerId: 'p2', name: 'Pau', gameData: { score: 300, answer: 2 } }
];

test('resultado de una pregunta normal: resalta la correcta, pinta la gráfica y abre el modal en el paso de resultados', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await serverEmit(page, 'questionOver', PLAYER_DATA, { type: 'quiz', correctAnswers: [1] });

    await expect(page.locator('#answer1')).toHaveCSS('filter', 'none');
    await expect(page.locator('#answer1')).toContainText('Paris');
    await expect(page.locator('#answer2')).toHaveCSS('filter', /grayscale/);

    const bars = page.locator('#resultsChart .results-bar');
    await expect(bars).toHaveCount(4);
    await expect(bars.nth(0)).toHaveClass(/results-bar--correct/);
    await expect(bars.nth(0).locator('.results-bar-stats')).toHaveText('50% (1)');
    await expect(bars.nth(1).locator('.results-bar-stats')).toHaveText('50% (1)');

    await expect(page.locator('#rankingModal')).toBeVisible();
    await expect(page.locator('#resultsStepChart')).toBeVisible();
    await expect(page.locator('#resultsStepRanking')).toBeHidden();
    await expect(page.locator('#nextQButton')).toBeHidden();
    await expect(page.locator('#skipQButton')).toBeHidden();
    await expect(page.locator('#rankingNextBtn')).toHaveText('Ver clasificación');
});

test('resultado de una pregunta libre (numeric): resumen sin gráfica de barras', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload({ type: 'numeric', a1: '', a2: '', a3: '', a4: '' }));
    await serverEmit(page, 'questionOver', [
        { playerId: 'p1', name: 'Ana', gameData: { score: 10, answer: { number: '19' } } },
        { playerId: 'p2', name: 'Pau', gameData: { score: 0, answer: null } }
    ], { type: 'numeric', numericAnswer: 19, tolerance: 0 });

    await expect(page.locator('#resultsChart .results-bar')).toHaveCount(0);
    await expect(page.locator('#resultsChart')).toContainText('Respuestas recibidas 1 / 2');
    await expect(page.locator('#resultsChart')).toContainText('Respuesta correcta: 19');
});

test('paso del modal: gráfica -> ranking (con flechas desde la segunda vez) -> siguiente pregunta', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await serverEmit(page, 'questionOver', PLAYER_DATA, { type: 'quiz', correctAnswers: [1] });

    await page.locator('#rankingNextBtn').click();
    await expect(page.locator('#resultsStepChart')).toBeHidden();
    await expect(page.locator('#resultsStepRanking')).toBeVisible();
    await expect(page.locator('#rankingNextBtn')).toHaveText('Siguiente pregunta (Enter)');
    const rows = page.locator('#rankingList .ranking-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('.ranking-name')).toHaveText('🐱 Ana - 500');
    await expect(rows.nth(0).locator('.ranking-move')).toHaveText('');

    await page.locator('#rankingNextBtn').click();
    expect(await emitsNamed(page, 'nextQuestion')).toHaveLength(1);
    await expect(page.locator('#rankingModal')).toBeHidden();
    await expect(page.locator('#question')).toHaveText('');
    await expect(page.locator('#playersAnswered')).toHaveText('Prepara la siguiente pregunta...');
    await expect(page.locator('#skipQButton')).toBeVisible();

    // Segona ronda: la mateixa jugadora ja no és primera -> fletxa avall per a Pau.
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload({ questionNumber: 2 }));
    const playerDataRound2 = [
        { playerId: 'p2', name: 'Pau', gameData: { score: 700, answer: 1 } },
        { playerId: 'p1', name: 'Ana', icon: '🐱', gameData: { score: 500, answer: 2 } }
    ];
    await serverEmit(page, 'questionOver', playerDataRound2, { type: 'quiz', correctAnswers: [1] });
    await page.locator('#rankingNextBtn').click();
    const rows2 = page.locator('#rankingList .ranking-row');
    await expect(rows2.nth(0).locator('.ranking-name')).toHaveText('Pau - 700');
    await expect(rows2.nth(0).locator('.ranking-move')).toHaveText('▲1');
    await expect(rows2.nth(1).locator('.ranking-move')).toHaveText('▼1');
});

test('celebración de grupo cuando todo el grupo acierta o falla', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await serverEmit(page, 'questionOver', PLAYER_DATA, { type: 'quiz', correctAnswers: [1], groupResult: 'allCorrect' });
    await expect(page.locator('#groupCelebration')).toBeVisible();
    await expect(page.locator('#groupCelebration')).toHaveClass(/group-celebration--good/);
    await expect(page.locator('#groupCelebrationText')).toHaveText('¡Pleno de aciertos!');

    await page.locator('#rankingNextBtn').click();
    await page.locator('#rankingNextBtn').click();
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload({ questionNumber: 2 }));
    await serverEmit(page, 'questionOver', PLAYER_DATA, { type: 'quiz', correctAnswers: [1], groupResult: 'allWrong' });
    await expect(page.locator('#groupCelebration')).toHaveClass(/group-celebration--bad/);
    await expect(page.locator('#groupCelebrationText')).toHaveText('Nadie ha acertado esta vez');
});

// #skipQButton empieza oculto por CSS (display:none); gameQuestions lo
// muestra desde la primera pregunta (corregido: antes solo nextQuestion()
// lo mostraba, así que nunca se podía saltar la primera pregunta).
test('saltar pregunta: ya se puede desde la primera, y sigue disponible en las siguientes', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await expect(page.locator('#skipQButton')).toBeVisible();
    await page.locator('#skipQButton').click();
    expect(await emitsNamed(page, 'skipQuestion')).toHaveLength(1);
    await expect(page.locator('#skipQButton')).toBeDisabled();

    await serverEmit(page, 'questionOver', PLAYER_DATA, { type: 'quiz', correctAnswers: [1] });
    await expect(page.locator('#skipQButton')).toBeHidden();
    await page.locator('#rankingNextBtn').click();
    await page.locator('#rankingNextBtn').click();
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload({ questionNumber: 2 }));

    await expect(page.locator('#skipQButton')).toBeVisible();
    await expect(page.locator('#skipQButton')).toBeEnabled();
});

// #playersAnswered se ocultaba para siempre tras la primera pregunta
// (questionOver lo oculta y nada lo volvía a mostrar). Corregido:
// gameQuestions, questionCountdown y nextQuestion() lo muestran de nuevo.
test('playersAnswered reaparece en cada pregunta nueva, no solo en la primera', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await expect(page.locator('#playersAnswered')).toBeVisible();

    await serverEmit(page, 'questionOver', PLAYER_DATA, { type: 'quiz', correctAnswers: [1] });
    await expect(page.locator('#playersAnswered')).toBeHidden();

    await page.locator('#rankingNextBtn').click();
    await page.locator('#rankingNextBtn').click();
    await expect(page.locator('#playersAnswered')).toBeVisible();
    await expect(page.locator('#playersAnswered')).toHaveText('Prepara la siguiente pregunta...');

    await serverEmit(page, 'gameQuestions', gameQuestionsPayload({ questionNumber: 2 }));
    await expect(page.locator('#playersAnswered')).toBeVisible();
    await expect(page.locator('#playersAnswered')).toHaveText('Han respondido 0 / 2');
});

test('abrir el ranking a mano (sin fin de pregunta) permite cerrarlo', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await page.locator('#showRanking').click();

    await expect(page.locator('#rankingModal')).toBeVisible();
    await expect(page.locator('#resultsStepRanking')).toBeVisible();
    await expect(page.locator('#closeRanking')).toBeVisible();

    await page.locator('#closeRanking').click();
    await expect(page.locator('#rankingModal')).toBeHidden();
});

test('GameOver: muestra el top 5, el botón de descargar informe y el enlace de volver', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await serverEmit(page, 'GameOver', { num1: 'Ana', num2: 'Pau', num3: '', num4: '', num5: '' });

    await expect(page.locator('#question')).toHaveText('FIN DE LA PARTIDA');
    await expect(page.locator('#winner1')).toHaveText('1. Ana');
    await expect(page.locator('#winner2')).toHaveText('2. Pau');
    await expect(page.locator('#answer1')).toBeHidden();
    await expect(page.locator('#square1')).toBeHidden();
    await expect(page.locator('#downloadReportBtn')).toBeVisible();
    await expect(page.locator('#backToLibraryBtn')).toBeVisible();
});

test('al desconectar, muestra el aviso de reconexión', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'disconnect');
    await expect(page.locator('#playersAnswered')).toHaveText('Reconectando con la partida...');
});

test('cambiar de idioma traduce los textos en el sitio, sin recargar', async ({ page }) => {
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());
    await expect(page.locator('#skipQButton')).toHaveText('Saltar pregunta');

    await page.locator('#lang-select').selectOption('en');
    await expect(page.locator('#skipQButton')).toHaveText('Skip question');
    await expect(page.locator('#nextQButton')).toHaveText('Next question');
    await expect(page).toHaveURL(/\/host\/game\//);
});

// Estos botones usaban onclick="…" en el HTML; ahora son @click de Vue.
test('«Siguiente pregunta» pide la siguiente y ⛶ pide pantalla completa', async ({ page }) => {
    await page.addInitScript(() => {
        window.__fullscreenRequests = 0;
        Element.prototype.requestFullscreen = function(){ window.__fullscreenRequests++; return Promise.resolve(); };
    });
    await openGame(page);
    await serverEmit(page, 'gameQuestions', gameQuestionsPayload());

    await page.locator('#nextQButton').dispatchEvent('click');
    expect(await emitsNamed(page, 'nextQuestion')).toHaveLength(1);
    await expect(page.locator('#nextQButton')).toBeHidden();

    await page.locator('#fullscreenToggle').click();
    expect(await page.evaluate(() => window.__fullscreenRequests)).toBe(1);
});
