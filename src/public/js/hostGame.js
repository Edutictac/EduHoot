var socket = io({
    reconnection: true,
    reconnectionAttempts: 200,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000
});

var params = jQuery.deparam(window.location.search); //Gets the id from url
var lastHostKey = 'lastHostId';
var lastPinKey = 'lastGamePin';
// Aquests elements viuen dins del <template> de Vue: no existixen al DOM
// real fins que l'app es munta (vore més avall, després de crear `app`).
// Fallback: si faltan id o pin en la URL, usa localStorage
try{
    if(!params.id){
        var storedId = localStorage.getItem(lastHostKey);
        if(storedId) params.id = storedId;
    }
    if(!params.pin){
        var storedPin = localStorage.getItem(lastPinKey);
        if(storedPin) params.pin = storedPin;
    }
}catch(e){}

var timer;

var time = 20;
var defaultTime = 20;
var lang = EduhootLang.init({ preferKey: 'lang-host' });
var hostMusicPlayerInstance = null;
var HOST_AUTOPLAY_MUSIC_KEY = 'eduhoot_host_autoplay_music';
var HOST_MUSIC_SHOULD_PLAY_KEY = 'eduhoot_host_music_should_play';
var HOST_MUSIC_ACTIVATION_DONE_KEY = 'eduhoot_host_music_activation_done';
var hostAutoMusicEnabled = false;
var hostAutoMusicShouldPlay = false;
var hostQuestionEnded = false;
var hostRankingGongPlayed = false;
var hostResumeMusicAfterRanking = false;
var hostMusicActivationOverlayEl = null;
var hostMusicActivationKeydownHandler = null;
var currentQuestionType = 'quiz';
var currentAnswerTexts = ['', '', '', ''];
var questionCountdownTimer = null;
var gongAudio = null;
var gongUrl = '/effects/gong.mp3';
// Audio de la sala cuando esta vista va incrustada en ella (ver openEmbeddedHostGame en host.js).
var hostSharedAudio = (function(){
    try{
        if(window.parent && window.parent !== window && window.parent.eduhootHostAudio){
            return window.parent.eduhootHostAudio;
        }
    }catch(e){}
    return null;
})();
var GONG_VOLUME_BOOST = 1.25;
var currentPointsMultiplier = 1;
// playerId -> posición (0 = 1º) del último ranking mostrado, para pintar flechas
// de avance/retroceso al estilo Kahoot. Se resetea al empezar cada partida.
var previousRankingPositions = null;
var i18n = {
    es: {
        questionXofY: function(n, t){ return 'Pregunta ' + n + ' / ' + t; },
        playersAnswered: function(ans, total){ return 'Han respondido ' + ans + ' / ' + total; },
        timeLeft: 'Tiempo restante:',
        skip: 'Saltar pregunta',
        next: 'Siguiente pregunta',
        showRanking: 'Top 10',
        rankingTitle: 'Top 10',
        topPlayers: 'Top 5 jugadores',
        gameOver: 'FIN DE LA PARTIDA',
        bgMusicTitle: 'Música de fondo',
        pauseVideo: 'Pausar',
        playVideo: 'Reproducir',
        finishVideo: 'Parar',
        bgMusicNone: 'Sin música',
        bgMusicChoose: 'Elige un tema',
        bgMusicPlay: 'Reproducir música',
        bgMusicPause: 'Pausar música',
        bgMusicPrev: 'Anterior',
        bgMusicNext: 'Siguiente',
        bgMusicVolume: 'Volumen',
        musicActivationTitle: 'Activar audio',
        musicActivationBody: '',
        musicActivationEnable: '¡Empezamos!',
        resultsTitle: 'Resultados',
        resultsNextToRanking: 'Ver clasificación',
        resultsNextQuestion: 'Siguiente pregunta (Enter)',
        leftTag: 'Abandono',
        leftBtn: 'Abandonó',
        autoLabel: 'Avance automático',
        statePaused: 'Partida en pausa',
        statePlaying: 'Partida en marcha',
        matchingExtraLabel: 'Tiempo extra en preguntas compuestas',
        autoTip: 'Pasa solo a la siguiente pregunta tras los resultados, esperando los segundos indicados. «Manual» = lo decides tú con el botón. Se aplica desde la siguiente pregunta.',
        scoresTip: 'Muestra u oculta la puntuación y el ranking entre preguntas y el podio final.',
        matchingExtraTip: 'Tiempo extra (en %) para las preguntas de correspondencia y de ordenar. Se aplica desde la siguiente pregunta.',
        autoManual: 'Manual',
        autoIn: 'Siguiente en {s} s',
        autoPaused: 'Avance pausado',
        autoPause: 'Pausar avance',
        autoResume: 'Reanudar avance',
        scoresToggle: 'Puntuaciones y ranking',
        timerPause: 'Pausar partida',
        timerResume: 'Reanudar partida',
        cancelGame: 'Cancelar partida',
        cancelConfirm: 'Confirmar cancelación',
        timerAdd15: '+15 s',
        answerSent: 'Enviado',
        answerTrying: 'Intentando',
        answerStatusCount: '{sent} de {total} han enviado',
        handRaised: 'Mano levantada',
        awayFromTab: 'Fuera de la pestaña',
        awayCount: '{n} fuera de la pestaña',
        streakInRow: 'seguidos',
        kickedTitle: 'Expulsados',
        unkickBtn: 'Permitir entrar',
        kickBtn: 'Expulsar',
        kickConfirm: 'Confirmar',
        freeAnswersReceived: function(ans, total){ return 'Respuestas recibidas ' + ans + ' / ' + total; },
        correctAnswerLabel: 'Respuesta correcta:',
        matchingResultsHint: 'Porcentaje de alumnos que aciertan cada pareja',
        matchingSummary: 'Todo bien: {f} · parcial: {p} · ninguna: {n} (de {t})',
        matchingNoPair: 'sin pareja',
        matchingImpostors: 'Elementos sin pareja:',
        orderSolutionLabel: 'Orden correcto:',
        correctOptionBadge: 'Correcta',
        pointsDouble: 'Puntos dobles',
        questionCountdown: 'Prepara la siguiente pregunta...',
        questionCountdownHint: 'La siguiente empieza en',
        downloadReport: 'Descargar informe (CSV)',
        downloadReportError: 'No se pudo descargar el informe de la sesión.',
        backToLibrary: 'Biblioteca',
        fullscreenEnter: 'Pantalla completa',
        fullscreenExit: 'Salir de pantalla completa',
        groupAllCorrect: '¡Pleno de aciertos!',
        groupAllWrong: 'Nadie ha acertado esta vez'
    },
    en: {
        questionXofY: function(n, t){ return 'Question ' + n + ' / ' + t; },
        playersAnswered: function(ans, total){ return 'Players Answered ' + ans + ' / ' + total; },
        timeLeft: 'Time Left:',
        skip: 'Skip question',
        next: 'Next question',
        showRanking: 'Top 10',
        rankingTitle: 'Top 10',
        topPlayers: 'Top 5 Players',
        gameOver: 'GAME OVER',
        bgMusicTitle: 'Background music',
        pauseVideo: 'Pause',
        playVideo: 'Play',
        finishVideo: 'Stop',
        bgMusicNone: 'No music',
        bgMusicChoose: 'Choose a track',
        bgMusicPlay: 'Play music',
        bgMusicPause: 'Pause music',
        bgMusicPrev: 'Prev',
        bgMusicNext: 'Next',
        bgMusicVolume: 'Volume',
        musicActivationTitle: 'Enable audio',
        musicActivationBody: '',
        musicActivationEnable: "Let's go!",
        resultsTitle: 'Results',
        resultsNextToRanking: 'View ranking',
        resultsNextQuestion: 'Next question (Enter)',
        leftTag: 'Left',
        leftBtn: 'Left',
        autoLabel: 'Automatic advance',
        statePaused: 'Game paused',
        statePlaying: 'Game running',
        matchingExtraLabel: 'Extra time on composite questions',
        autoTip: 'Moves on to the next question by itself after the results, waiting the seconds shown. "Manual" = you decide with the button. Applies from the next question.',
        scoresTip: 'Shows or hides scores and ranking between questions and the final podium.',
        matchingExtraTip: 'Extra time (in %) for matching and ordering questions. Applies from the next question.',
        scoresToggle: 'Scores and ranking',
        autoManual: 'Manual',
        autoIn: 'Next in {s} s',
        autoPaused: 'Advance paused',
        autoPause: 'Pause advance',
        autoResume: 'Resume advance',
        timerPause: 'Pause game',
        timerResume: 'Resume game',
        cancelGame: 'Cancel game',
        cancelConfirm: 'Confirm cancellation',
        timerAdd15: '+15 s',
        answerSent: 'Sent',
        answerTrying: 'Trying',
        answerStatusCount: '{sent} of {total} sent',
        handRaised: 'Hand raised',
        awayFromTab: 'Away from tab',
        awayCount: '{n} away from tab',
        streakInRow: 'in a row',
        kickedTitle: 'Removed',
        unkickBtn: 'Allow back',
        kickBtn: 'Remove',
        kickConfirm: 'Confirm',
        freeAnswersReceived: function(ans, total){ return 'Answers received ' + ans + ' / ' + total; },
        correctAnswerLabel: 'Correct answer:',
        matchingResultsHint: 'Share of students who got each pair right',
        matchingSummary: 'All right: {f} · partly: {p} · none: {n} (of {t})',
        matchingNoPair: 'no pair',
        matchingImpostors: 'Items with no pair:',
        orderSolutionLabel: 'Correct order:',
        correctOptionBadge: 'Correct',
        pointsDouble: 'Double points',
        questionCountdown: 'Get ready for the next question...',
        questionCountdownHint: 'Next question starts in',
        downloadReport: 'Download report (CSV)',
        downloadReportError: 'Could not download the session report.',
        backToLibrary: 'Library',
        fullscreenEnter: 'Fullscreen',
        fullscreenExit: 'Exit fullscreen',
        groupAllCorrect: 'Everyone got it right!',
        groupAllWrong: 'Nobody got it this time'
    },
    ca: {
        questionXofY: function(n, t){ return 'Pregunta ' + n + ' / ' + t; },
        playersAnswered: function(ans, total){ return 'Han respost ' + ans + ' / ' + total; },
        timeLeft: 'Temps restant:',
        skip: 'Saltar pregunta',
        next: 'Següent pregunta',
        showRanking: 'Top 10',
        rankingTitle: 'Top 10',
        topPlayers: 'Top 5 jugadors',
        gameOver: 'FI DE LA PARTIDA',
        bgMusicTitle: 'Música de fons',
        pauseVideo: 'Pausar',
        playVideo: 'Reproduir',
        finishVideo: 'Aturar',
        bgMusicNone: 'Sense música',
        bgMusicChoose: 'Tria un tema',
        bgMusicPlay: 'Reprodueix música',
        bgMusicPause: 'Atura la música',
        bgMusicPrev: 'Anterior',
        bgMusicNext: 'Següent',
        bgMusicVolume: 'Volum',
        musicActivationTitle: 'Activar àudio',
        musicActivationBody: '',
        musicActivationEnable: 'Comencem!',
        resultsTitle: 'Resultats',
        resultsNextToRanking: 'Veure classificació',
        resultsNextQuestion: 'Següent pregunta (Enter)',
        leftTag: 'Abandonament',
        leftBtn: 'Va abandonar',
        autoLabel: 'Avanç automàtic',
        statePaused: 'Partida en pausa',
        statePlaying: 'Partida en marxa',
        matchingExtraLabel: 'Temps extra en preguntes compostes',
        autoTip: 'Passa sol a la pregunta següent després dels resultats, esperant els segons indicats. «Manual» = ho decidixes tu amb el botó. S\'aplica des de la pregunta següent.',
        scoresTip: 'Mostra o amaga la puntuació i el rànquing entre preguntes i el podi final.',
        matchingExtraTip: 'Temps extra (en %) per a les preguntes de correspondència i d\'ordenar. S\'aplica des de la pregunta següent.',
        scoresToggle: 'Puntuacions i rànquing',
        autoManual: 'Manual',
        autoIn: 'Següent en {s} s',
        autoPaused: 'Avanç pausat',
        autoPause: 'Pausar avanç',
        autoResume: 'Reprendre avanç',
        timerPause: 'Pausar partida',
        timerResume: 'Reprendre partida',
        cancelGame: 'Cancel·lar partida',
        cancelConfirm: 'Confirmar cancel·lació',
        timerAdd15: '+15 s',
        answerSent: 'Enviat',
        answerTrying: 'Intentant',
        answerStatusCount: '{sent} de {total} han enviat',
        handRaised: 'Mà alçada',
        awayFromTab: 'Fora de la pestanya',
        awayCount: '{n} fora de la pestanya',
        streakInRow: 'seguits',
        kickedTitle: 'Expulsats',
        unkickBtn: 'Permetre entrar',
        kickBtn: 'Expulsar',
        kickConfirm: 'Confirmar',
        freeAnswersReceived: function(ans, total){ return 'Respostes rebudes ' + ans + ' / ' + total; },
        correctAnswerLabel: 'Resposta correcta:',
        matchingResultsHint: "Percentatge d'alumnes que encerten cada parella",
        matchingSummary: 'Tot bé: {f} · parcial: {p} · cap: {n} (de {t})',
        matchingNoPair: 'sense parella',
        matchingImpostors: 'Elements sense parella:',
        orderSolutionLabel: 'Ordre correcte:',
        correctOptionBadge: 'Correcta',
        pointsDouble: 'Punts dobles',
        questionCountdown: 'Prepara la pregunta següent...',
        questionCountdownHint: 'La següent comença en',
        downloadReport: 'Descarregar informe (CSV)',
        downloadReportError: 'No s\'ha pogut descarregar l\'informe de la sessió.',
        backToLibrary: "Biblioteca",
        fullscreenEnter: 'Pantalla completa',
        fullscreenExit: 'Eixir de pantalla completa',
        groupAllCorrect: 'Ple d\'encerts!',
        groupAllWrong: 'Ningú ha encertat esta vegada'
    },
    va: {
        resultsNextToRanking: 'Vore classificació'
    }
};

function t(key, langOverride){
    var l = langOverride || lang;
    var chain = l === 'va' ? ['va', 'ca', 'es'] : [l, 'es'];
    for(var i = 0; i < chain.length; i++){
        var dict = i18n[chain[i]];
        if(dict && dict[key]) return dict[key];
    }
    return key;
}

// Pregunta/respostes, insígnia de punts, comptador de jugadors, temporitzador
// i compte arrere (Subfase B, Vue, bloc 1): com en playerGame.js, Vue mai
// reescriu un node sense directives, així que la resta de la pantalla
// (modal de resultats, rànquing, celebració de grup, GameOver) es queda
// estàtica dins de la mateixa arrel fins al bloc 2 (vore ARCHITECTURE.md).
// Cancela la confirmación de expulsión si no se confirma a tiempo.
var kickGameResetTimer = null;
var cancelGameResetTimer = null;

var app = Vue.createApp({
    template: '#host-game-tpl',
    data: function(){
        return {
            lang: lang,
            pin: '',
            questionNumText: '',
            pointsMultiplier: 1,
            pointsBadgeText: '',
            badgeKey: 0,
            playersAnsweredVisible: true,
            playersAnsweredText: '',
            timerVisible: true,
            timerText: ' ' + time,
            countdownVisible: false,
            countdownSeconds: 0,
            countdownPreview: '',
            questionText: '',
            answers: ['', '', '', ''],
            questionType: 'quiz',
            answerHighlight: [null, null, null, null],
            skipVisible: false,
            skipDisabled: false,
            rankingVisible: false,
            closeVisible: true,
            modalStep: 'chart',
            resultsHasRanking: true,
            resultsMode: 'bars',
            resultsBars: [],
            resultsFreeLines: [],
            // Correspondencia: columnas en pantalla y resultados por pareja.
            matchLeft: [],
            videoLearning: false,
            videoPlaying: false,
            videoIsYoutube: false,
            matchRight: [],
            // Ordenar: la llista barrejada (durant la pregunta) i la solució (en mostrar el resultat).
            orderItems: [],
            orderSolution: [],
            resultsMatching: { rows: [], impostors: [], summary: '' },
            rankingRows: [],
            groupCelebrationVisible: false,
            groupCelebrationGood: true,
            groupCelebrationEmoji: '🎉',
            groupCelebrationText: '',
            winnersVisible: false,
            showRankingButton: true,
            answerStatus: [],
            pendingKickId: '',
            cancelGameConfirming: false,
            // Avance automático entre preguntas (servidor): 0 = manual.
            autoAdvanceSec: 0,
            // Título del quiz y margen de las correspondencias (si el quiz tiene alguna).
            quizName: '',
            hasMatching: false,
            hasComposite: false,
            matchingExtraTime: 50,
            matchingExtraChoices: [25, 50, 75, 100],
            // Puntuaciones y ranking: se puede cambiar en cualquier momento de la partida.
            showScoresToggle: true,
            autoActive: false,
            autoPaused: false,
            autoLeft: 0,
            autoEndAt: 0,
            kickedList: [],
            timerPaused: false,
            winners: ['', '', '', '', ''],
            downloadReportVisible: false,
            // Partida terminada: «Cancelar partida» pasa a «Volver» (vuelve a la biblioteca).
            gameOverMode: false
        };
    },
    computed: {
        autoAdvanceChoices: function(){
            var list = [];
            for(var n = 3; n <= 20; n++) list.push(n);
            return list;
        },
        autoAdvanceText: function(){
            if(this.autoPaused) return this.t('autoPaused');
            return this.t('autoIn').replace('{s}', this.autoLeft);
        },
        pinText: function(){
            return this.pin ? ('PIN ' + this.pin) : '';
        },
        badgeVisible: function(){
            var m = Number(this.pointsMultiplier);
            return Number.isFinite(m) && m > 1;
        },
        questionHtml: function(){
            return formatRichText(this.questionText);
        },
        answerStatusSummary: function(){
            // Quien ha abandonado no cuenta: ya no responde.
            var active = this.answerStatus.filter(function(p){ return !p.left; });
            var sent = active.filter(function(p){ return p.answered; }).length;
            return this.t('answerStatusCount').replace('{sent}', String(sent)).replace('{total}', String(active.length));
        },
        awayCount: function(){
            return this.answerStatus.filter(function(p){ return p.away; }).length;
        },
        awayText: function(){
            return this.t('awayCount').replace('{n}', String(this.awayCount));
        },
        rankingNextLabel: function(){
            if(this.modalStep === 'chart'){
                return this.resultsHasRanking ? this.t('resultsNextToRanking') : this.t('resultsNextQuestion');
            }
            return this.t('resultsNextQuestion');
        }
    },
    methods: {
        t: function(key){
            return t(key, this.lang);
        },
        // Antes eran onclick="…" en el HTML; con @click no hacen falta
        // atributos on… y la CSP puede prohibir los scripts en línea.
        toggleFullscreen: function(){ toggleHostFullscreen(); },
        goNextQuestion: function(){ nextQuestion(); },
        finishVideo: function(){ socket.emit('finishVideoLearning'); },
        // Reprodueix o pausa el vídeo de la fase (arxiu: element <video>; YouTube: ordres a l'iframe).
        toggleVideoPlay: function(){
            if(this.videoIsYoutube){
                youtubePost({ event: 'command', func: this.videoPlaying ? 'pauseVideo' : 'playVideo', args: '' });
                this.videoPlaying = !this.videoPlaying;
                return;
            }
            var v = document.getElementById('questionVideo');
            if(!v) return;
            if(v.paused) v.play().catch(function(){}); else v.pause();
        },
        showRankingToggle: function(){ toggleRanking(); },
        // Expulsión en dos pasos desde la lista de respuestas (issue #29).
        askKick: function(player){
            this.pendingKickId = player.playerId;
            clearTimeout(kickGameResetTimer);
            kickGameResetTimer = setTimeout(function(){
                app.pendingKickId = '';
            }, 4000);
        },
        confirmKick: function(player){
            clearTimeout(kickGameResetTimer);
            this.pendingKickId = '';
            socket.emit('kick-player', { playerId: player.playerId });
        },
        toggleTimerPause: function(){ hostToggleTimerPause(); },
        // Readmitir a un alumno expulsado de esta partida.
        unkickGame: function(entry){
            socket.emit('unkick-player', { id: entry.id });
        },
        // Cancelar y volver a crear: dos pasos (primero se pide confirmación).
        goBackToLibrary: function(){
            (window.top || window).location.href = '/create/';
        },
        askCancelGame: function(){
            if(!this.cancelGameConfirming){
                this.cancelGameConfirming = true;
                clearTimeout(cancelGameResetTimer);
                cancelGameResetTimer = setTimeout(function(){ app.cancelGameConfirming = false; }, 4000);
                return;
            }
            clearTimeout(cancelGameResetTimer);
            this.cancelGameConfirming = false;
            stopHostMusicOnCancel();
            socket.emit('cancelGame');
        },
        addTimerSeconds: function(seconds){ hostAddTimerSeconds(seconds); },
        matchLetter: function(i){
            return 'ABCDEFGH'.charAt(i) || String(i + 1);
        },
        answerHasContent: function(i){
            if(this.questionType === 'short-answer' || this.questionType === 'numeric' || this.questionType === 'matching') return false;
            if(this.questionType === 'true-false' && i >= 2) return false;
            var text = this.answers[i];
            return !!(text && String(text).trim());
        },
        answerVisible: function(i){
            return this.answerHasContent(i);
        },
        answerHtml: function(i){
            var prefix = this.answerHighlight[i] === 'correct' ? '✓ ' : '';
            return prefix + formatRichText(this.answers[i] || '');
        },
        answerFilter: function(i){
            if(!this.answerVisible(i)) return '';
            return this.answerHighlight[i] === 'wrong' ? 'grayscale(50%)' : '';
        },
        skipQuestion: function(){
            skipQuestion();
        },
        closeRanking: function(){
            closeRankingModal();
        },
        emitAutoAdvanceSec: function(){
            socket.emit('setAutoAdvance', { seconds: this.autoAdvanceSec });
        },
        emitMatchingExtraTime: function(){
            socket.emit('setMatchingExtraTime', { percent: this.matchingExtraTime });
        },
        emitShowScores: function(){
            socket.emit('setShowScores', { enabled: !!this.showScoresToggle });
            window.hostShowScores = !!this.showScoresToggle;
            this.showRankingButton = !!this.showScoresToggle;
        },
        toggleAutoPause: function(){
            socket.emit('autoAdvancePause', { paused: !this.autoPaused });
        },
        rankingNext: function(){
            if(this.modalStep === 'chart'){
                if(this.resultsHasRanking){
                    this.modalStep = 'ranking';
                    return;
                }
                if(hostQuestionEnded){
                    nextQuestion();
                }
                this.rankingVisible = false;
                return;
            }
            // Paso ranking
            if(hostQuestionEnded){
                nextQuestion();
            }
            this.rankingVisible = false;
        },
        downloadReport: function(){
            downloadSessionReportCsv();
        }
    }
}).mount('#host-game');

// Ara que Vue ha muntat la plantilla, #lang-select ja existix de veres al
// DOM: cal omplir les seues opcions ara (languages.js ja ha fet la seua
// crida inicial a render(), abans de muntar, quan encara no hi havia cap
// <select> real dins de l'arrel de Vue). Si no, applyStaticText() fixaria
// lang-select.value sobre un <select> encara buit, i es perdria.
if(window.EduhootLang && typeof window.EduhootLang.render === 'function'){
    window.EduhootLang.render();
}

function decodeBasicEntities(value){
    var txt = document.createElement('textarea');
    txt.innerHTML = String(value || '');
    return txt.value;
}

function escapeHtml(value){
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatRichText(value){
    var decoded = decodeBasicEntities(value);
    var safe = escapeHtml(decoded);
    safe = safe.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    safe = safe.replace(/&lt;(\/?)(b|strong|i|em|u)&gt;/gi, '<$1$2>');
    return safe;
}

function setRichText(el, value){
    if(!el) return;
    el.innerHTML = formatRichText(value);
}

function updateHostMusicLabels(){
    if(!hostMusicPlayerInstance || typeof hostMusicPlayerInstance.updateLabels !== 'function') return;
    hostMusicPlayerInstance.updateLabels({
        title: t('bgMusicTitle'),
        choose: t('bgMusicChoose'),
        play: t('bgMusicPlay'),
        pause: t('bgMusicPause'),
        prev: t('bgMusicPrev'),
        next: t('bgMusicNext'),
        volume: t('bgMusicVolume'),
        none: t('bgMusicNone')
    });
}

function applyStaticText(){
    var langSelect = document.getElementById('lang-select');
    if(langSelect){
        langSelect.value = lang;
    }
    var nextBtn = document.getElementById('nextQButton');
    if(nextBtn) nextBtn.textContent = t('next');

    updateFullscreenToggleUI();
}

function isHostFullscreen(){
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function updateFullscreenToggleUI(){
    var btn = document.getElementById('fullscreenToggle');
    if(!btn) return;
    var active = isHostFullscreen();
    btn.textContent = active ? '⤢' : '⛶';
    btn.title = active ? t('fullscreenExit') : t('fullscreenEnter');
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
}

function toggleHostFullscreen(){
    var el = document.documentElement;
    if(isHostFullscreen()){
        if(document.exitFullscreen) document.exitFullscreen();
        else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
    }else if(el.requestFullscreen){
        el.requestFullscreen();
    }else if(el.webkitRequestFullscreen){
        el.webkitRequestFullscreen();
    }
}

document.addEventListener('fullscreenchange', updateFullscreenToggleUI);
document.addEventListener('webkitfullscreenchange', updateFullscreenToggleUI);

// Aviso visual breve cuando el 100% del grupo acierta ("pleno") o falla ("funeral") una
// pregunta. No toca puntuación ni ranking: solo se muestra sobre la pantalla y desaparece sola.
var groupCelebrationHideTimer = null;
function showGroupCelebration(kind){
    var isGood = kind === 'allCorrect';
    app.groupCelebrationGood = isGood;
    app.groupCelebrationEmoji = isGood ? '🎉' : '💀';
    app.groupCelebrationText = t(isGood ? 'groupAllCorrect' : 'groupAllWrong');
    app.groupCelebrationVisible = true;
    if(groupCelebrationHideTimer) clearTimeout(groupCelebrationHideTimer);
    groupCelebrationHideTimer = setTimeout(function(){
        app.groupCelebrationVisible = false;
    }, 2600);
}

function updateQuestionPointsBadge(multiplier){
    var m = Number(multiplier);
    if(!Number.isFinite(m) || m <= 1){
        app.pointsMultiplier = 1;
        app.pointsBadgeText = '';
        return;
    }
    app.pointsMultiplier = m;
    app.pointsBadgeText = 'x' + m + ' · ' + t('pointsDouble');
    app.badgeKey += 1;
}


async function downloadSessionReportCsv(){
    if(!params.pin || !params.id){
        alert(t('downloadReportError'));
        return;
    }
    try{
        var url = '/api/live-games/' + encodeURIComponent(params.pin) + '/report.csv?hostId=' + encodeURIComponent(params.id);
        var res = await fetch(url, { credentials: 'include' });
        if(!res.ok){
            var errMsg = '';
            try{
                var body = await res.json();
                errMsg = body && body.error ? String(body.error) : '';
            }catch(e){}
            throw new Error(errMsg || 'download-failed');
        }
        var disposition = res.headers.get('Content-Disposition') || '';
        var match = disposition.match(/filename="?([^";]+)"?/i);
        var fileName = (match && match[1]) ? match[1] : ('informe-' + params.pin + '.csv');
        var blob = await res.blob();
        var fileUrl = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = fileUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(fileUrl);
    }catch(err){
        alert((err && err.message && err.message !== 'download-failed') ? err.message : t('downloadReportError'));
    }
}

function setHostModalStep(step){
    app.modalStep = step === 'ranking' ? 'ranking' : 'chart';
}

function renderResultsChart(answerCounts, totalPlayers, correctAnswers){
    var total = (typeof totalPlayers === 'number' && totalPlayers > 0) ? totalPlayers : 0;
    var denom = total > 0 ? total : 1;
    var visible = getVisibleAnswerFlags();
    var letters = ['A', 'B', 'C', 'D'];
    var correctSet = new Set((Array.isArray(correctAnswers) ? correctAnswers : []).map(Number));
    var bars = [];

    for(var i = 0; i < 4; i++){
        if(!visible[i]) continue;
        var count = Number((answerCounts && answerCounts[i]) || 0);
        if(Number.isNaN(count) || count < 0) count = 0;
        var pct = Math.round((count / denom) * 100);
        if(pct < 0) pct = 0;
        if(pct > 100) pct = 100;

        bars.push({
            index: i + 1,
            letter: letters[i],
            pct: pct,
            count: count,
            correct: correctSet.has(i + 1),
            html: formatRichText((currentAnswerTexts[i] || '').trim())
        });
    }
    app.resultsMode = 'bars';
    app.resultsBars = bars;
}

// Correspondencia: para cada pareja, el porcentaje del alumnado que la ha acertado,
// y cuántos lo han hecho todo bien, en parte o nada. Quien no ha respondido cuenta como «ninguna».
var currentMatchSolution = [];
function buildMatchingResults(playerData, payload){
    var left = (payload && payload.matchLeft) || app.matchLeft || [];
    var right = (payload && payload.matchRight) || app.matchRight || [];
    var solution = (payload && Array.isArray(payload.matchSolution)) ? payload.matchSolution : currentMatchSolution;
    var list = Array.isArray(playerData) ? playerData : [];
    var total = list.length;
    var hits = left.map(function(){ return 0; });
    var full = 0, partial = 0, none = 0;
    list.forEach(function(player){
        var answer = player && player.gameData ? player.gameData.answer : null;
        var own = 0;
        if(Array.isArray(answer)){
            solution.forEach(function(r, i){
                if(answer[i] !== null && answer[i] !== undefined && Number(answer[i]) === r){
                    hits[i] += 1;
                    own += 1;
                }
            });
        }
        if(solution.length && own === solution.length) full += 1;
        else if(own > 0) partial += 1;
        else none += 1;
    });
    var letter = function(i){ return 'ABCDEFGH'.charAt(i) || String(i + 1); };
    // Con «Mostrar respuestas» desactivado, la clase ve los porcentajes pero no la solución.
    var showSolution = !(payload && payload.showCorrectAnswers === false);
    var rows = left.map(function(text, i){
        var r = solution[i];
        return {
            code: String(i + 1),
            left: text,
            right: (!showSolution || r === undefined || r === null) ? '' : letter(r) + ' ' + (right[r] || ''),
            pct: total ? Math.round(hits[i] / total * 100) : 0
        };
    });
    var impostors = [];
    right.forEach(function(text, j){
        if(showSolution && solution.indexOf(j) === -1) impostors.push(letter(j) + ' ' + text);
    });
    return {
        rows: rows,
        impostors: impostors,
        summary: t('matchingSummary').replace('{f}', full).replace('{p}', partial).replace('{n}', none).replace('{t}', total)
    };
}

function setLang(newLang){
    lang = newLang;
    app.lang = newLang;
    EduhootLang.persist(lang);
    applyStaticText();
    updateHostMusicLabels();
}

function initHostMusicPlayer(){
    if(typeof initBackgroundMusic !== 'function') return;
    hostMusicPlayerInstance = initBackgroundMusic('#host-music-player', {
        sharedAudio: hostSharedAudio && hostSharedAudio.music,
        storageKey: 'eduhoot-host-music',
        randomStart: true,
        volume: 0.7,
        noneOption: true
    });
    updateHostMusicLabels();
}

function setCurrentAnswerTexts(answers){
    currentAnswerTexts = [];
    for(var i = 0; i < 4; i++){
        currentAnswerTexts[i] = answers[i] || '';
    }
    app.answers = currentAnswerTexts.slice();
}

function getVisibleAnswerFlags(){
    if(currentQuestionType === 'short-answer' || currentQuestionType === 'numeric'){
        return [false, false, false, false];
    }
    var flags = [];
    for(var i = 0; i < 4; i++){
        var text = currentAnswerTexts[i];
        var visible = !!text && text.trim().length;
        if(currentQuestionType === 'true-false' && i >= 2){
            visible = false;
        }
        flags.push(visible);
    }
    return flags;
}

function hideAnswerSquares(){
    for(var k = 1; k <= 4; k++){
        var square = document.getElementById('square' + k);
        if(square){
            square.style.display = 'none';
            square.style.height = '0px';
        }
    }
}

function highlightCorrectAnswers(correctAnswers){
    if(currentQuestionType === 'short-answer' || currentQuestionType === 'numeric'){
        app.answerHighlight = [null, null, null, null];
        return;
    }
    var valid = Array.isArray(correctAnswers) ? correctAnswers : [];
    var correctSet = new Set(valid.map(Number));
    var visibleFlags = getVisibleAnswerFlags();
    var highlight = [null, null, null, null];
    for(var idx = 1; idx <= 4; idx++){
        if(!visibleFlags[idx - 1]){
            continue;
        }
        highlight[idx - 1] = correctSet.has(idx) ? 'correct' : 'wrong';
    }
    app.answerHighlight = highlight;
}

function updateSquareHeights(counts, total){
    var visible = getVisibleAnswerFlags();
    var denominator = total > 0 ? total : 1;
    for(var i = 1; i <= 4; i++){
        var square = document.getElementById('square' + i);
        if(!square) continue;
        if(!visible[i - 1]){
            square.style.display = 'none';
            square.style.height = '0px';
            continue;
        }
        square.style.display = "inline-block";
        var height = Math.round((counts[i - 1] || 0) / denominator * 100);
        square.style.height = height + "px";
    }
}

function initGong(){
    if(gongAudio) return;
    if(hostSharedAudio && hostSharedAudio.gong){
        gongAudio = hostSharedAudio.gong;
        return;
    }
    try{
        gongAudio = new Audio(gongUrl);
        gongAudio.preload = 'auto';
    }catch(e){
        gongAudio = null;
    }
}

function getHostMusicVolume(){
    try{
        if(hostMusicPlayerInstance && hostMusicPlayerInstance.audio && typeof hostMusicPlayerInstance.audio.volume === 'number'){
            return hostMusicPlayerInstance.audio.volume;
        }
    }catch(e){}
    // Fallback al volumen persistido por el widget
    try{
        var v = localStorage.getItem('eduhoot-host-music:volume');
        if(v != null){
            var parsed = parseFloat(v);
            if(!isNaN(parsed)) return parsed;
        }
    }catch(e){}
    return 0.7;
}

function getGongVolume(){
    var base = getHostMusicVolume();
    if(typeof base !== 'number' || isNaN(base)) base = 0.7;
    if(base < 0) base = 0;
    if(base > 1) base = 1;
    var v = base * GONG_VOLUME_BOOST;
    if(v > 1) v = 1;
    if(v < 0) v = 0;
    return v;
}

function playGong(){
    initGong();
    if(!gongAudio) return;
    try{
        gongAudio.pause();
        gongAudio.currentTime = 0;
    }catch(e){}
    try{ gongAudio.volume = getGongVolume(); }catch(e){}
    gongAudio.play().catch(function(){});
}

function ensureHostMusicPlaying(){
    if(!hostMusicPlayerInstance) return;
    if(typeof hostMusicPlayerInstance.play === 'function'){
        hostMusicPlayerInstance.play();
        return;
    }
    if(!hostMusicPlayerInstance.audio) return;
    var audio = hostMusicPlayerInstance.audio;
    if(!audio.paused) return;
    audio.play().catch(function(){});
}

function attemptHostMusicPlay(){
    if(!hostMusicPlayerInstance) return Promise.resolve(false);
    // Preferimos ir al <audio> real para poder detectar rechazo de autoplay.
    var audio = hostMusicPlayerInstance.audio;
    if(!audio){
        try{ ensureHostMusicPlaying(); }catch(e){}
        return Promise.resolve(isHostMusicPlaying());
    }
    if(!audio.paused) return Promise.resolve(true);
    try{
        var p = audio.play();
        if(p && typeof p.then === 'function'){
            return p.then(function(){ return true; }).catch(function(){ return false; });
        }
    }catch(e){
        return Promise.resolve(false);
    }
    return Promise.resolve(!audio.paused);
}

function hasCompletedMusicActivation(){
    try{ return sessionStorage.getItem(HOST_MUSIC_ACTIVATION_DONE_KEY) === '1'; }catch(e){ return false; }
}

function markMusicActivationCompleted(){
    try{ sessionStorage.setItem(HOST_MUSIC_ACTIVATION_DONE_KEY, '1'); }catch(e){}
}

function hideMusicActivationOverlay(){
    if(!hostMusicActivationOverlayEl) return;
    if(hostMusicActivationKeydownHandler){
        try{ document.removeEventListener('keydown', hostMusicActivationKeydownHandler, true); }catch(e){}
        hostMusicActivationKeydownHandler = null;
    }
    try{ hostMusicActivationOverlayEl.remove(); }catch(e){
        try{ hostMusicActivationOverlayEl.style.display = 'none'; }catch(e2){}
    }
    hostMusicActivationOverlayEl = null;
}

function showMusicActivationOverlay(opts){
    opts = opts || {};
    if(hostMusicActivationOverlayEl) return;
    if(hasCompletedMusicActivation()) return;

    var overlay = document.createElement('div');
    overlay.className = 'music-activation-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', t('musicActivationTitle'));

    var card = document.createElement('div');
    card.className = 'music-activation-card';

    var p = document.createElement('p');
    p.className = 'music-activation-body';
    p.textContent = t('musicActivationBody');

    var actions = document.createElement('div');
    actions.className = 'music-activation-actions';

    var btnEnable = document.createElement('button');
    btnEnable.type = 'button';
    btnEnable.className = 'music-activation-btn music-activation-btn-primary';
    btnEnable.textContent = t('musicActivationEnable');

    function activateAudio(){
        // Este click/tap es el gesto que desbloquea autoplay.
        attemptHostMusicPlay().finally(function(){
            markMusicActivationCompleted();
            hideMusicActivationOverlay();
        });
    }

    btnEnable.addEventListener('click', function(){ activateAudio(); });

    actions.appendChild(btnEnable);

    if(p.textContent){
        card.appendChild(p);
    }
    card.appendChild(actions);
    overlay.appendChild(card);

    document.body.appendChild(overlay);
    hostMusicActivationOverlayEl = overlay;

    hostMusicActivationKeydownHandler = function(ev){
        if(!hostMusicActivationOverlayEl) return;
        if(ev.key === 'Enter'){
            ev.preventDefault();
            activateAudio();
            return;
        }
        if(ev.key === 'Escape'){
            ev.preventDefault();
            hideMusicActivationOverlay();
        }
    };
    document.addEventListener('keydown', hostMusicActivationKeydownHandler, true);

    try{ btnEnable.focus(); }catch(e){}
}

function isHostMusicPlaying(){
    if(!hostMusicPlayerInstance) return false;
    if(typeof hostMusicPlayerInstance.isPlaying === 'function'){
        try{ return !!hostMusicPlayerInstance.isPlaying(); }catch(e){ return false; }
    }
    if(hostMusicPlayerInstance.audio){
        return !hostMusicPlayerInstance.audio.paused;
    }
    return false;
}

function pauseHostMusicForRanking(){
    if(!hostMusicPlayerInstance) return;
    hostResumeMusicAfterRanking = isHostMusicPlaying();
    if(typeof hostMusicPlayerInstance.pause === 'function'){
        hostMusicPlayerInstance.pause();
        return;
    }
    if(hostMusicPlayerInstance.audio){
        try{ hostMusicPlayerInstance.audio.pause(); }catch(e){}
    }
}

function openRankingModal(playGongOnce){
    app.rankingVisible = true;

    // En fin de pregunta, forzamos el flujo Resultados -> Ranking -> Siguiente.
    // Si el host abre manualmente el modal en mitad de la pregunta, permitimos cerrar.
    app.closeVisible = !hostQuestionEnded;

    // Solo actuamos (parar música + gong) cuando es fin de pregunta.
    if(!hostQuestionEnded) return;
    pauseHostMusicForRanking();
    if(playGongOnce && !hostRankingGongPlayed){
        hostRankingGongPlayed = true;
        playGong();
    }
}

function closeRankingModal(){
    app.rankingVisible = false;
}

function maybeAutoplayHostMusicFromLobby(){
    try{
        if(sessionStorage.getItem(HOST_AUTOPLAY_MUSIC_KEY) === '1'){
            sessionStorage.removeItem(HOST_AUTOPLAY_MUSIC_KEY);
            hostAutoMusicEnabled = true;
        }
        if(sessionStorage.getItem(HOST_MUSIC_SHOULD_PLAY_KEY) === '1'){
            // Lo dejamos en sessionStorage para que sobreviva recargas durante la partida.
            hostAutoMusicShouldPlay = true;
        }
        if(hostAutoMusicEnabled && hostAutoMusicShouldPlay){
            ensureHostMusicPlaying();
        }
    }catch(e){}
}

//When host connects to server
socket.on('connect', function() {
    
    //Tell server that it is host connection from game view
    socket.emit('host-join-game', params);
    if(params.id){
        try{ localStorage.setItem(lastHostKey, params.id); }catch(e){}
    }
    if(params.pin){
        try{ localStorage.setItem(lastPinKey, params.pin); }catch(e){}
    }
    app.pin = params.pin || '';
});

socket.on('noGameFound', function(){
   // Si vamos incrustados en la sala, salimos en la ventana principal.
   var target = window;
   try{ if(hostSharedAudio && window.top) target = window.top; }catch(e){}
   target.location.href = '/';//Redirect user to 'join game' page
});

socket.on('disconnect', function(){
    app.playersAnsweredText = 'Reconectando con la partida...';
});

function clearQuestionCountdown(){
    if(questionCountdownTimer){
        clearInterval(questionCountdownTimer);
        questionCountdownTimer = null;
    }
    app.countdownVisible = false;
    document.body.classList.remove('is-question-countdown');
}

function showQuestionCountdown(data){
    clearQuestionCountdown();
    // Opció «Mostrar pregunta durante la cuenta atrás»: el text de la pregunta a la pantalla.
    app.countdownPreview = (data && data.preview && data.preview.question) || '';
    clearInterval(timer);
    closeRankingModal();
    hideAnswerSquares();
    setMedia(null, null);
    currentQuestionType = 'quiz';
    app.questionType = 'quiz';
    currentPointsMultiplier = 1;
    app.pointsMultiplier = 1;
    app.pointsBadgeText = '';
    currentAnswerTexts = ['', '', '', ''];
    app.answers = ['', '', '', ''];
    var seconds = Math.max(0, Math.ceil(Number(data && data.seconds) || 0));
    document.body.classList.add('is-question-countdown');
    app.questionText = '';
    app.playersAnsweredText = t('questionCountdown');
    app.playersAnsweredVisible = true;
    app.timerVisible = false;
    if(data && data.questionNumber && data.totalQuestions){
        app.questionNumText = t('questionXofY')(data.questionNumber, data.totalQuestions);
    }
    function render(){
        if(seconds <= 0){
            clearQuestionCountdown();
            return;
        }
        app.countdownVisible = true;
        app.countdownSeconds = seconds;
        seconds -= 1;
    }
    render();
    questionCountdownTimer = setInterval(render, 1000);
}

socket.on('questionCountdown', showQuestionCountdown);

// Fase «aprén i després respon» (feature 24): el vídeo a la pantalla abans de les respostes.
// YouTube: l'iframe s'activa amb enablejsapi=1 i es controla per missatges (postMessage), sense carregar
// l'API de YouTube (la CSP no ho permet). Només s'accepta l'origen de l'embed.
var YT_ORIGIN = 'https://www.youtube-nocookie.com';
function youtubePost(payload){
    var iframe = document.getElementById('questionIframe');
    if(iframe && iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify(payload), YT_ORIGIN);
}
var videoLearnEventsBound = false;
function bindVideoLearnEvents(){
    if(videoLearnEventsBound) return;
    videoLearnEventsBound = true;
    window.addEventListener('message', function(e){
        if(e.origin !== YT_ORIGIN) return;
        var d;
        try{ d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; }catch(err){ return; }
        if(!d) return;
        var state = d.event === 'infoDelivery' && d.info ? d.info.playerState : (d.event === 'onStateChange' ? d.info : undefined);
        if(state === 1) app.videoPlaying = true;
        if(state === 2) app.videoPlaying = false;
        // 0 = acabat: la fase es tanca, com amb un arxiu.
        if(state === 0){
            app.videoPlaying = false;
            if(app.videoLearning) socket.emit('finishVideoLearning');
        }
    });
}
// Arxiu: en acabar, la fase es tanca sola; el estat de reproducció es segueix amb els esdeveniments del <video>.
function bindFileVideoEvents(v){
    if(v.dataset.learnBound) return;
    v.dataset.learnBound = '1';
    v.addEventListener('ended', function(){ if(app.videoLearning) socket.emit('finishVideoLearning'); });
    v.addEventListener('play', function(){ app.videoPlaying = true; });
    v.addEventListener('pause', function(){ app.videoPlaying = false; });
}

// Fase «aprén i després respon» (feature 24): el vídeo a la pantalla abans de les respostes.
function startVideoLearning(data){
    app.videoLearning = true;
    app.videoPlaying = false;
    var startAt = Number(data && data.startAt) || 0;
    var video = (data && data.video) || '';
    var ytId = parseYouTubeId(video);
    app.videoIsYoutube = !!ytId;
    setMedia(null, video);
    var v = document.getElementById('questionVideo');
    var iframe = document.getElementById('questionIframe');
    bindVideoLearnEvents();
    if(ytId && iframe){
        // El segon d'inici va al paràmetre «start»; enablejsapi=1 permet controlar-lo i rebre el final.
        iframe.src = YT_ORIGIN + '/embed/' + ytId + '?enablejsapi=1' + (startAt > 0 ? '&start=' + startAt : '');
        iframe.onload = function(){ youtubePost({ event: 'listening' }); };
    }
    if(v && !ytId){
        bindFileVideoEvents(v);
        if(startAt > 0){
            var seek = function(){ try{ v.currentTime = startAt; }catch(e){} };
            if(v.readyState >= 1) seek(); else v.addEventListener('loadedmetadata', seek, { once: true });
        }
    }
}
socket.on('videoLearn', startVideoLearning);

socket.on('gameQuestions', function(data){
    app.videoLearning = false;
    clearQuestionCountdown();
    hostQuestionEnded = false;
    hostRankingGongPlayed = false;
    closeRankingModal();
    if(data && Number(data.questionNumber) === 1){
        previousRankingPositions = null;
    }

    // Si venimos de "Iniciar partida" intentamos que suene música en cada pregunta.
    // También reanudamos si la pausamos automáticamente al mostrar el ranking.
    if(hostAutoMusicEnabled && hostAutoMusicShouldPlay && (hostResumeMusicAfterRanking || !isHostMusicPlaying())){
        hostResumeMusicAfterRanking = false;
        // En la primera pregunta de la vista, algunos navegadores bloquean autoplay.
        // Si falla, mostramos un popup para forzar un gesto y desbloquear audio.
        attemptHostMusicPlay().then(function(ok){
            if(!ok){
                showMusicActivationOverlay();
            }
        });
    }

    currentQuestionType = data.type || 'quiz';
    app.questionType = currentQuestionType;
    currentPointsMultiplier = Number(data && data.pointsMultiplier) > 1 ? Number(data.pointsMultiplier) : 1;
    updateQuestionPointsBadge(currentPointsMultiplier);
    app.questionText = data.q1 || '';
    setCurrentAnswerTexts(window.EduhootTf ? window.EduhootTf.localize(currentQuestionType, [data.a1, data.a2, data.a3, data.a4]) : [data.a1, data.a2, data.a3, data.a4]);
    app.matchLeft = currentQuestionType === 'matching' ? (data.matchLeft || []).slice() : [];
    app.matchRight = currentQuestionType === 'matching' ? (data.matchRight || []).slice() : [];
    app.orderItems = currentQuestionType === 'order' ? (data.orderItems || []).slice() : [];
    app.orderSolution = [];
    currentMatchSolution = currentQuestionType === 'matching' ? (data.matchSolution || []).slice() : [];
    app.answerHighlight = [null, null, null, null];
    hideAnswerSquares();
    defaultTime = data.time || defaultTime || 20;
    window.hostShowScores = data.showScores !== false;
    app.showRankingButton = window.hostShowScores;
    app.showScoresToggle = window.hostShowScores;
    setMedia(data.image, data.video);
    app.playersAnsweredText = t('playersAnswered')(0, data.playersInGame);
    app.playersAnsweredVisible = true;
    app.timerVisible = true;
    app.skipVisible = true;
    app.skipDisabled = false;
    if (data.questionNumber && data.totalQuestions) {
        app.questionNumText = t('questionXofY')(data.questionNumber, data.totalQuestions);
    }
    app.answerStatus = [];
    socket.emit('getAnswerStatus');
    socket.emit('getKickedList');
    updateTimer();
});

// Partida cancelada: el servidor confirma y volvemos a crear.
socket.on('gameCancelled', function(){
    stopHostMusicOnCancel();
    (window.top || window).location.href = '/create/';
});

// Cancelar la partida para la música: no vuelve a sonar sola al siguiente juego.
function stopHostMusicOnCancel(){
    hostAutoMusicShouldPlay = false;
    hostResumeMusicAfterRanking = false;
    pauseHostMusicForRanking();
}

// Avance automático: el servidor pide un paso de resultados; el anfitrión lo da igual que el botón
// y responde con la etapa en la que queda (clasificación, siguiente pregunta o nada).
function hostAutoAdvanceStep(){
    if(!hostQuestionEnded){
        socket.emit('autoAdvanceStepDone', { stage: 'none' });
        return;
    }
    app.rankingVisible = true;
    app.rankingNext();
    socket.emit('autoAdvanceStepDone', { stage: app.rankingVisible ? 'ranking' : 'next' });
}
socket.on('autoAdvanceStep', hostAutoAdvanceStep);

// Estado del avance automático (lo recibe también el alumnado).
socket.on('autoAdvanceState', function(s){
    s = s || {};
    app.autoActive = !!s.active;
    app.autoPaused = !!s.paused;
    app.autoAdvanceSec = Number(s.seconds) || 0;
    var ms = Math.max(0, Number(s.remainingMs) || 0);
    app.autoLeft = Math.ceil(ms / 1000);
    app.autoEndAt = Date.now() + ms;
});
// La cuenta atrás se actualiza en el propio anfitrión; en pausa se queda fija.
setInterval(function(){
    if(app.autoActive && !app.autoPaused){
        app.autoLeft = Math.max(0, Math.ceil((app.autoEndAt - Date.now()) / 1000));
    }
}, 250);

socket.on('kickedList', function(list){
    app.kickedList = Array.isArray(list) ? list : [];
});

socket.on('answerStatus', function(list){
    app.answerStatus = Array.isArray(list) ? list : [];
});

socket.on('updatePlayersAnswered', function(data){
    app.playersAnsweredText = t('playersAnswered')(data.playersAnswered, data.playersInGame);
});

socket.on('gamePin', function(data){
    if(data){
        app.quizName = (data.quizName || '').toString();
        app.hasMatching = !!data.hasMatching;
        app.hasComposite = !!data.hasComposite;
        if(data.matchingExtraTime) app.matchingExtraTime = Number(data.matchingExtraTime) || 50;
    }
    if(data && data.pin){
        setPinBadge(data.pin);
        try{ localStorage.setItem(lastPinKey, data.pin); }catch(e){}
    }
});

socket.on('hostSession', function(data){
    if(data && data.hostId){
        try{ localStorage.setItem(lastHostKey, data.hostId); }catch(e){}
        params.id = data.hostId;
    }
    if(data && data.pin){
        setPinBadge(data.pin);
        try{ localStorage.setItem(lastPinKey, data.pin); }catch(e){}
        params.pin = data.pin;
    }
});

// Control: botón y tecla Enter para pasar a la siguiente pregunta desde el modal
document.addEventListener('keydown', function(ev){
    if(ev.key === 'Enter' && app.rankingVisible && !app.autoPaused){
        ev.preventDefault();
        app.rankingNext();
    }
});

socket.on('questionOver', function(playerData, payload){
    hostQuestionEnded = true;
    clearInterval(timer);
    app.playersAnsweredVisible = false;
    app.timerVisible = false;
    setMedia(null, null);
    currentQuestionType = (payload && payload.type) || currentQuestionType;
    app.questionType = currentQuestionType;
    var totalPlayers = Array.isArray(playerData) ? playerData.length : 0;

    if(currentQuestionType === 'order'){
        hideAnswerSquares();
        app.resultsMode = 'order';
        app.orderSolution = payload.showCorrectAnswers === false ? [] : (payload.items || []).slice();
    }else if(currentQuestionType === 'matching'){
        hideAnswerSquares();
        app.resultsMode = 'matching';
        app.resultsMatching = buildMatchingResults(playerData, payload);
    }else
    // Tipos libres: no hay buckets 1-4; mostramos resumen simple.
    if(currentQuestionType === 'short-answer' || currentQuestionType === 'numeric'){
        hideAnswerSquares();
        var answeredCount = 0;
        (playerData || []).forEach(function(player){
            var answer = player && player.gameData ? player.gameData.answer : null;
            if(!answer) return;
            if(currentQuestionType === 'short-answer'){
                var txt = (answer && typeof answer === 'object') ? (answer.text || '') : String(answer || '');
                if(String(txt).trim()) answeredCount += 1;
            }else{
                var n = (answer && typeof answer === 'object') ? answer.number : answer;
                if(String(n || '').trim()) answeredCount += 1;
            }
        });

        var correctTxt = '';
        if(payload && payload.type === 'short-answer'){
            var acc = Array.isArray(payload.acceptedAnswers) ? payload.acceptedAnswers : [];
            correctTxt = acc.join(', ');
        }else if(payload && payload.type === 'numeric'){
            var base = (payload.numericAnswer !== undefined && payload.numericAnswer !== null) ? payload.numericAnswer : '';
            var tol = (payload.tolerance !== undefined && payload.tolerance !== null) ? payload.tolerance : 0;
            if(base !== ''){
                correctTxt = Number(tol) > 0 ? (String(base) + ' ± ' + String(tol)) : String(base);
            }
        }

        var freeLines = [t('freeAnswersReceived')(answeredCount, totalPlayers)];
        if(correctTxt){
            freeLines.push(t('correctAnswerLabel') + ' ' + correctTxt);
        }
        app.resultsMode = 'free';
        app.resultsFreeLines = freeLines;
    }else{
        highlightCorrectAnswers(payload && payload.correctAnswers);
        var answerCounts = [0, 0, 0, 0];
        function incrementAnswer(value){
            var num = Number(value);
            if(Number.isNaN(num) || num < 1 || num > 4) return;
            answerCounts[num - 1] += 1;
        }
        (playerData || []).forEach(function(player){
            var answer = player.gameData.answer;
            if(Array.isArray(answer)){
                answer.forEach(incrementAnswer);
            }else{
                incrementAnswer(answer);
            }
        });
        // La gráfica se muestra dentro del modal (más visible) en lugar de en la vista principal.
        hideAnswerSquares();
        renderResultsChart(answerCounts, totalPlayers, payload && payload.correctAnswers);
    }

    if(totalPlayers > 0 && payload && (payload.groupResult === 'allCorrect' || payload.groupResult === 'allWrong')){
        showGroupCelebration(payload.groupResult);
    }

    // El avance se hace desde el modal (Resultados -> Ranking -> Siguiente).
    document.getElementById('nextQButton').style.display = "none";
    app.skipVisible = false;

    app.resultsHasRanking = (window.hostShowScores !== false);
    if(app.resultsHasRanking){
        var sorted = playerData.slice().sort(function(a, b){
            return (b.gameData.score || 0) - (a.gameData.score || 0);
        });
        var top = sorted.slice(0, 10);
        // ¿Es la primera vez que se muestra el ranking en esta partida? Si es así no
        // pintamos flechas (todo el mundo "sube desde la nada", no aporta información).
        var isFirstRanking = !previousRankingPositions;
        var nextRankingPositions = {};
        var rows = [];
        for(var r = 0; r < top.length; r++){
            var icon = top[r].icon ? top[r].icon + ' ' : '';
            var moveClass = '';
            var moveText = '';
            if(!isFirstRanking && top[r].playerId){
                var oldIndex = previousRankingPositions[top[r].playerId];
                if(oldIndex !== undefined){
                    var delta = oldIndex - r;
                    if(delta > 0){
                        moveClass = 'ranking-move--up';
                        moveText = '▲' + delta;
                    }else if(delta < 0){
                        moveClass = 'ranking-move--down';
                        moveText = '▼' + Math.abs(delta);
                    }
                }else{
                    moveClass = 'ranking-move--new';
                    moveText = '★';
                }
            }
            rows.push({
                moveClass: moveClass,
                moveText: moveText,
                name: icon + top[r].name + ' - ' + (top[r].gameData.score || 0)
            });
            if(top[r].playerId){
                nextRankingPositions[top[r].playerId] = r;
            }
        }
        previousRankingPositions = nextRankingPositions;
        app.rankingRows = rows;
    }

    // Abrimos el modal primero en el paso de resultados (gráfica)
    setHostModalStep('chart');
    openRankingModal(true);
    
});

function toggleRanking(){
    if(app.rankingVisible){
        closeRankingModal();
        return;
    }
    // Apertura manual: enseñamos directamente el ranking.
    setHostModalStep('ranking');
    // Si el host abre el ranking manualmente en mitad de la pregunta, no paramos música ni gong.
    // Si es fin de pregunta, solo paramos música (gong ya se habrá disparado en la auto-apertura).
    openRankingModal(false);
}

socket.on('questionMedia', function(data){
    setMedia(data.image, data.video);
});

function normalizeSvgDataUrlForImg(url){
    if(!url) return url;
    var raw = String(url).trim();
    if(!raw) return raw;
    var lower = raw.toLowerCase();
    if(!lower.startsWith('data:image/svg+xml')) return raw;
    var comma = raw.indexOf(',');
    if(comma === -1) return raw;
    var header = raw.slice(0, comma + 1);
    var payload = raw.slice(comma + 1);
    if(!payload) return raw;
    if(/;base64/i.test(header)) return raw;

    // Ya URL-encoded: recortar cualquier sufijo tras </svg>
    if(/%[0-9a-fA-F]{2}/.test(payload)){
        var lp = payload.toLowerCase();
        var endEnc = '%3c%2fsvg%3e';
        var posEnc = lp.lastIndexOf(endEnc);
        if(posEnc !== -1) return header + payload.slice(0, posEnc + endEnc.length);
        return raw;
    }

    // Raw: recortar tras </svg> y URL-encode
    var lpr = payload.toLowerCase();
    var endRaw = '</svg>';
    var posRaw = lpr.lastIndexOf(endRaw);
    if(posRaw !== -1){
        payload = payload.slice(0, posRaw + endRaw.length);
    }
    if(payload.indexOf('<') !== -1 || payload.indexOf('#') !== -1 || payload.indexOf('"') !== -1 || payload.indexOf("'") !== -1){
        return header + encodeURIComponent(payload);
    }
    return raw;
}

function setMedia(imageUrl, videoUrl){
    var imgEl = document.getElementById('questionImage');
    var videoEl = document.getElementById('questionVideo');
    var iframeEl = document.getElementById('questionIframe');
    if (imgEl) {
        if (imageUrl) {
            imgEl.src = normalizeSvgDataUrlForImg(imageUrl);
            imgEl.style.display = 'block';
        } else {
            imgEl.removeAttribute('src');
            imgEl.style.display = 'none';
        }
    }
    if (videoEl && iframeEl) {
        var ytId = parseYouTubeId(videoUrl);
        if (ytId) {
            videoEl.removeAttribute('src');
            videoEl.pause();
            videoEl.style.display = 'none';
            iframeEl.src = 'https://www.youtube-nocookie.com/embed/' + ytId;
            iframeEl.style.display = 'block';
        } else if (videoUrl) {
            iframeEl.removeAttribute('src');
            iframeEl.style.display = 'none';
            videoEl.src = videoUrl;
            videoEl.style.display = 'block';
        } else {
            iframeEl.removeAttribute('src');
            iframeEl.style.display = 'none';
            videoEl.removeAttribute('src');
            videoEl.pause();
            videoEl.style.display = 'none';
        }
    }
}

function parseYouTubeId(url){
    if(!url) return null;
    try{
        var u = new URL(url);
        if(u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')){
            if(u.hostname.includes('youtu.be')){
                return u.pathname.replace('/','');
            }
            if(u.searchParams.get('v')) return u.searchParams.get('v');
            var parts = u.pathname.split('/');
            var last = parts[parts.length-1];
            if(last) return last;
        }
    }catch(e){}
    return null;
}

function nextQuestion(){
    closeRankingModal();
    document.getElementById('nextQButton').style.display = "none";
    app.skipVisible = true;
    app.skipDisabled = false;

    // Activamos la pantalla de espera de forma optimista, sin esperar al evento
    // 'questionCountdown' del servidor: el modal de ranking es semitransparente
    // (se ve la pregunta anterior de fondo) y al cerrarlo de golpe aquí, si
    // esperásemos la ida y vuelta de red, la pregunta anterior reaparecería un
    // instante a pantalla completa (ya sin el difuminado del modal) antes de que
    // llegue el aviso de "preparando siguiente pregunta". showQuestionCountdown()
    // repetirá este mismo estado en cuanto llegue el evento real, sin parpadeo.
    clearQuestionCountdown();
    hideAnswerSquares();
    setMedia(null, null);
    currentQuestionType = 'quiz';
    app.questionType = 'quiz';
    currentPointsMultiplier = 1;
    updateQuestionPointsBadge(1);
    setCurrentAnswerTexts(['', '', '', '']);
    document.body.classList.add('is-question-countdown');
    app.questionText = '';
    app.playersAnsweredText = t('questionCountdown');
    app.playersAnsweredVisible = true;
    app.timerVisible = false;

    // Gesto del usuario: si la música debe sonar, este es el momento más fiable para (re)arrancarla.
    if(hostAutoMusicEnabled && hostAutoMusicShouldPlay){
        hostResumeMusicAfterRanking = false;
        ensureHostMusicPlaying();
    }
    socket.emit('nextQuestion'); //Tell server to start new question
}

function skipQuestion(){
    app.skipDisabled = true;
    clearInterval(timer);
    if(hostAutoMusicEnabled && hostAutoMusicShouldPlay){
        ensureHostMusicPlaying();
    }
    socket.emit('skipQuestion');
}

function updateTimer(){
    clearInterval(timer);
    time = defaultTime;
    // Pintar ya el tiempo inicial: si no, hasta el primer segundo se veía el
    // de la pregunta anterior (o el 20 del HTML) (issue #21).
    app.timerText = " " + time;
    app.timerPaused = false;
    startTimerInterval();
}

function startTimerInterval(){
    clearInterval(timer);
    timer = setInterval(function(){
        time -= 1;
        app.timerText = " " + time;
        if(time == 0){
            socket.emit('timeUp');
        }
    }, 1000);
}

// Pausa o reanuda el temporizador y avisa a los alumnos del tiempo que queda.
function hostToggleTimerPause(){
    if(!app.timerVisible) return;
    if(app.timerPaused){
        app.timerPaused = false;
        startTimerInterval();
    }else{
        app.timerPaused = true;
        clearInterval(timer);
    }
    // Partida pausada: no se puede saltar la pregunta hasta reanudarla.
    app.skipDisabled = app.timerPaused;
    socket.emit('timerSync', { time: time, paused: app.timerPaused });
}

// Añade segundos a la pregunta en curso (p. ej. +15 s) y avisa a los alumnos.
function hostAddTimerSeconds(seconds){
    if(!app.timerVisible) return;
    time += seconds;
    app.timerText = " " + time;
    socket.emit('timerSync', { time: time, paused: app.timerPaused });
}
socket.on('GameOver', function(data){
    document.getElementById('nextQButton').style.display = "none";
    document.getElementById('square1').style.display = "none";
    document.getElementById('square2').style.display = "none";
    document.getElementById('square3').style.display = "none";
    document.getElementById('square4').style.display = "none";
    
    // nextQuestion() vuelve a mostrar «Saltar pregunta» al pasar de la última
    // pregunta, y la celebración de grupo podía seguir encima del podio.
    app.skipVisible = false;
    if(groupCelebrationHideTimer) clearTimeout(groupCelebrationHideTimer);
    app.groupCelebrationVisible = false;
    app.answers = ['', '', '', ''];
    app.timerText = "";
    app.questionText = t('gameOver');
    // Fi de partida: no es queda cap imatge ni vídeo de la darrera pregunta (ni de la primera).
    setMedia(null, null);
    app.playersAnsweredText = "";
    updateQuestionPointsBadge(1);

    // Sin puntuaciones entre preguntas tampoco se muestra el podio final.
    app.winnersVisible = data.showPodium !== false;
    app.winners = [
        "1. " + data.num1,
        "2. " + data.num2,
        "3. " + data.num3,
        "4. " + data.num4,
        "5. " + data.num5
    ];
    app.downloadReportVisible = true;
    app.gameOverMode = true;
    try{
        localStorage.removeItem(lastHostKey);
        localStorage.removeItem(lastPinKey);
    }catch(e){}
});

function setPinBadge(pin){
    app.pin = pin || '';
}



socket.on('getTime', function(player){
    socket.emit('time', {
        player: player,
        time: time
    });
});

// Lang selector init
applyStaticText();
var langSelectEl = document.getElementById('lang-select');
if(langSelectEl){
    langSelectEl.addEventListener('change', function(){
        setLang(langSelectEl.value);
    });
}
initHostMusicPlayer();
maybeAutoplayHostMusicFromLobby();

// Fallback: primer gesto del usuario en la vista de juego.
// Algunos navegadores (p.ej. iOS) pueden no disparar Pointer Events.
(function armFirstGestureAutoplay(){
    var fired = false;
    function handler(){
        if(fired) return;
        fired = true;
        ensureHostMusicPlaying();
    }
    document.addEventListener('pointerdown', handler, { once: true, passive: true });
    document.addEventListener('touchstart', handler, { once: true, passive: true });
    document.addEventListener('mousedown', handler, { once: true, passive: true });
    document.addEventListener('keydown', handler, { once: true });
})();
