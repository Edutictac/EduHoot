var socket = io({
    reconnection: true,
    reconnectionAttempts: 200,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000
});
var params = jQuery.deparam(window.location.search);
var lastHostKey = 'lastHostId';
var lastPinKey = 'lastGamePin';
var hostLangSelect = document.getElementById('host-lang-select');
var baseJoinUrl = (function(){
    try{
        var origin = window.location.origin;
        if(origin){
            return origin.replace(/\/$/, '') + '/join.html';
        }
    }catch(e){}
    return 'https://eduhoot.edutictac.es/join.html';
})();
var hostErrorTimeout = null;
var hostStartClicked = false;
var hostStartGameEmitted = false;
var hostStartWatchdog = null;
var hostStartLastOpts = null;
var HOST_START_ACK_TIMEOUT_MS = 9000;

var HOST_AUTOPLAY_MUSIC_KEY = 'eduhoot_host_autoplay_music';
var HOST_MUSIC_SHOULD_PLAY_KEY = 'eduhoot_host_music_should_play';

var hostLobbyMusicPlayerInstance = null;

var hostLobbyGongAudio = null;
var hostLobbyGongUrl = '/effects/gong.mp3';
var HOST_GONG_VOLUME_BOOST = 1.25;
// Máximo tiempo que esperamos al gong antes de iniciar la partida.
// (Así suena el “golpe” del gong pero no se siente lento.)
var HOST_START_GONG_MAX_WAIT_MS = 2900;

function getHostLobbyMusicVolume(){
    try{
        if(hostLobbyMusicPlayerInstance && hostLobbyMusicPlayerInstance.audio && typeof hostLobbyMusicPlayerInstance.audio.volume === 'number'){
            return hostLobbyMusicPlayerInstance.audio.volume;
        }
    }catch(e){}
    try{
        var v = localStorage.getItem('eduhoot-host-music:volume');
        if(v != null){
            var parsed = parseFloat(v);
            if(!isNaN(parsed)) return parsed;
        }
    }catch(e){}
    return 0.7;
}

function getHostLobbyGongVolume(){
    var base = getHostLobbyMusicVolume();
    if(typeof base !== 'number' || isNaN(base)) base = 0.7;
    if(base < 0) base = 0;
    if(base > 1) base = 1;
    var v = base * HOST_GONG_VOLUME_BOOST;
    if(v > 1) v = 1;
    if(v < 0) v = 0;
    return v;
}

function initHostLobbyGong(){
    if(hostLobbyGongAudio) return;
    try{
        hostLobbyGongAudio = new Audio(hostLobbyGongUrl);
        hostLobbyGongAudio.preload = 'auto';
        // Intentar adelantar carga/decodificación
        try{ hostLobbyGongAudio.load(); }catch(e){}
    }catch(e){
        hostLobbyGongAudio = null;
    }
}

function playHostLobbyGong(){
    initHostLobbyGong();
    if(!hostLobbyGongAudio) return;
    try{
        hostLobbyGongAudio.pause();
        hostLobbyGongAudio.currentTime = 0;
    }catch(e){}
    try{ hostLobbyGongAudio.volume = getHostLobbyGongVolume(); }catch(e){}
    hostLobbyGongAudio.play().catch(function(){});
}

function emitStartGameWhenGongEnds(opts){
    if(hostStartGameEmitted) return;
    function emitNow(){
        if(hostStartGameEmitted) return;
        hostStartGameEmitted = true;
        hostStartLastOpts = opts || null;
        if(hostStartWatchdog){
            clearTimeout(hostStartWatchdog);
        }
        hostStartWatchdog = setTimeout(function(){
            hostStartGameEmitted = false;
            hostStartWatchdog = null;
            lobby.starting = false;
            lobby.showErrorKey('host_error');
        }, HOST_START_ACK_TIMEOUT_MS);
        socket.emit('startGame', opts);
    }
    if(!hostLobbyGongAudio){
        emitNow();
        return;
    }
    var remainingMs = null;
    try{
        var d = hostLobbyGongAudio.duration;
        var t = hostLobbyGongAudio.currentTime;
        if(typeof d === 'number' && isFinite(d) && d > 0 && typeof t === 'number' && isFinite(t) && t >= 0){
            remainingMs = Math.ceil(Math.max(0, d - t) * 1000);
        }
    }catch(e){}
    var maxWaitMs = HOST_START_GONG_MAX_WAIT_MS;
    if(typeof maxWaitMs !== 'number' || !isFinite(maxWaitMs) || maxWaitMs < 0) maxWaitMs = 0;
    // Si conocemos lo que queda, esperamos como mucho hasta ese final (con un pequeño margen), pero capado.
    // Si no lo conocemos, esperamos el máximo establecido.
    var waitMs = (typeof remainingMs === 'number') ? Math.min(maxWaitMs, remainingMs + 80) : maxWaitMs;
    var fired = false;
    function done(){
        if(fired) return;
        fired = true;
        try{ hostLobbyGongAudio.removeEventListener('ended', done); }catch(e){}
        emitNow();
    }
    try{
        if(hostLobbyGongAudio.ended){
            emitNow();
            return;
        }
    }catch(e){}
    try{ hostLobbyGongAudio.addEventListener('ended', done, { once: true }); }catch(e){}
    setTimeout(done, waitMs);
}

var hostLobbyMusicI18n = {
    es: {
        bgMusicTitle: 'Música de fondo',
        bgMusicChoose: 'Elige un tema',
        bgMusicPlay: 'Reproducir música',
        bgMusicPause: 'Pausar música',
        bgMusicPrev: 'Anterior',
        bgMusicNext: 'Siguiente',
        bgMusicVolume: 'Volumen',
        bgMusicNone: 'Sin música',
    },
    en: {
        bgMusicTitle: 'Background music',
        bgMusicChoose: 'Choose a track',
        bgMusicPlay: 'Play music',
        bgMusicPause: 'Pause music',
        bgMusicPrev: 'Prev',
        bgMusicNext: 'Next',
        bgMusicVolume: 'Volume',
        bgMusicNone: 'No music',
    },
    ca: {
        bgMusicTitle: 'Música de fons',
        bgMusicChoose: 'Tria un tema',
        bgMusicPlay: 'Reprodueix música',
        bgMusicPause: 'Atura la música',
        bgMusicPrev: 'Anterior',
        bgMusicNext: 'Següent',
        bgMusicVolume: 'Volum',
        bgMusicNone: 'Sense música',
    },
    va: {
        bgMusicTitle: 'Música de fons',
        bgMusicChoose: 'Tria un tema',
        bgMusicPlay: 'Reprodueix música',
        bgMusicPause: 'Atura la música',
        bgMusicPrev: 'Anterior',
        bgMusicNext: 'Següent',
        bgMusicVolume: 'Volum',
        bgMusicNone: 'Sense música',
    }
};

function getHostLobbyLang(){
    var l = EduhootLang.fromStorage('lang-host');
    if(l && hostLobbyMusicI18n[l]) return l;
    return 'es';
}

function hostLobbyT(key){
    var l = getHostLobbyLang();
    return (hostLobbyMusicI18n[l] && hostLobbyMusicI18n[l][key]) || hostLobbyMusicI18n.es[key] || key;
}

function updateHostLobbyMusicLabels(){
    if(!hostLobbyMusicPlayerInstance || typeof hostLobbyMusicPlayerInstance.updateLabels !== 'function') return;
    hostLobbyMusicPlayerInstance.updateLabels({
        title: hostLobbyT('bgMusicTitle'),
        choose: hostLobbyT('bgMusicChoose'),
        play: hostLobbyT('bgMusicPlay'),
        pause: hostLobbyT('bgMusicPause'),
        prev: hostLobbyT('bgMusicPrev'),
        next: hostLobbyT('bgMusicNext'),
        volume: hostLobbyT('bgMusicVolume')
    });
}

function initHostLobbyMusicPlayer(){
    if(typeof initBackgroundMusic !== 'function') return;
    hostLobbyMusicPlayerInstance = initBackgroundMusic('#host-lobby-music-player', {
        // Reutiliza la misma selección que en la vista de juego.
        storageKey: 'eduhoot-host-music',
        randomStart: true,
        volume: 0.7,
        noneOption: true,
        labels: {
            title: hostLobbyT('bgMusicTitle'),
            choose: hostLobbyT('bgMusicChoose'),
            play: hostLobbyT('bgMusicPlay'),
            pause: hostLobbyT('bgMusicPause'),
            prev: hostLobbyT('bgMusicPrev'),
            next: hostLobbyT('bgMusicNext'),
            volume: hostLobbyT('bgMusicVolume'),
            none: hostLobbyT('bgMusicNone')
        }
    });
}

function syncLangStorage(val){
    if(!val) return;
    EduhootLang.persist(val);
}

// Lobby (Vue): PIN, QR, error, opciones y jugadores salen de estos datos y
// Vue repinta solo cuando cambian. Los textos se traducen con t(), que lee
// Temporizador que cancela la confirmación de expulsión si no se confirma a tiempo.
var kickResetTimer = null;

// `lang` para que Vue sepa que debe repintar al cambiar de idioma.
// Vista de les opcions de la partida: A (dos blocs) o B (targetes per tema). Es recorda en este dispositiu.
var HOST_OPTIONS_VIEW_KEY = 'eduhoot-host-options-view';
function readHostOptionsView(){
    try{ return localStorage.getItem(HOST_OPTIONS_VIEW_KEY) === 'b' ? 'b' : 'a'; }catch(e){ return 'a'; }
}
// Mostrar la pregunta durant la compte arrere (partida en vivo): marcada per defecte; es recorda en este navegador.
function readShowQuestionCountdownHost(){
    try{
        if(localStorage.getItem('eduhoot-host-show-question-countdown') === '0') return false;
    }catch(e){}
    return true;
}
function saveHostOptionsView(view){
    try{ localStorage.setItem(HOST_OPTIONS_VIEW_KEY, view); }catch(e){}
}
// Con sesión, la vista también se guarda en la cuenta (/api/auth/preferences, igual que la biblioteca).
function saveAccountOptionsView(view){
    fetch('/api/auth/preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostOptionsView: view })
    }).catch(function(){});
}

var lobby = Vue.createApp({
    template: '#host-lobby-tpl',
    data: function(){
        return {
            lang: getHostLobbyLang(),
            // Clave de la ayuda «?» abierta (null = ninguna).
            helpOpen: null,
            optionsView: readHostOptionsView(),
            // true mientras se aplica la vista que llega de la cuenta (así no se vuelve a guardar).
            optionsViewFromAccount: false,
            pin: '',
            players: [],
            // Alumno pendiente de confirmar la expulsión (dos pasos, issue #29).
            pendingKickId: '',
            cancelConfirming: false,
            // Al pulsar «Iniciar partida», mientras suena el gong y llega la confirmación.
            starting: false,
            // Alumnado expulsado en esta partida (sin tokens), para poder desbloquearlo.
            kickedList: [],
            // El quiz tiene alguna correspondencia: se ofrece cómo responderla a ciegas.
            hasMatching: false,
            hasComposite: false,
            // El quiz té alguna pregunta amb vídeo: només aleshores es mostra l'inici del vídeo.
            hasVideo: false,
            // Título del quiz elegido (lo envía el servidor con el PIN).
            quizName: '',
            matchingExtraChoices: [25, 50, 75, 100],
            errorKey: '',
            errorText: '',
            options: {
                randomQuestions: false,
                randomAnswers: true,
                sendToStudents: true,
                showScoresBetween: true,
                // Mostrar respuestas: por defecto activado; si se desactiva, el alumnado no ve la correcta.
                showCorrectAnswers: true,
                // typed: el alumnado escribe su nombre; random: nombre aleatorio de la lista (feature 12).
                nameMode: 'typed',
                // Racha de aciertos (feature 11): bonificación para quien encadena aciertos.
                streak: true,
                // Mode fantasma en aula (opcional): cada alumne compara amb la seua millor marca, al seu navegador.
                ghostMode: false,
                copiedUrl: false,
                // Avance automático entre preguntas: 0 = manual; 3–20 s.
                autoAdvanceSec: 0,
                // Modo de la partida: 'live' (en directo) o 'selfPaced' (cada alumno a su ritmo).
                mode: 'live',
                // Correspondencia a ciegas: codes (toques, por defecto), select o steps.
                matchingBlindStyle: 'codes',
                // Más tiempo en las correspondencias: 25, 50, 75 o 100 % (por defecto, 50 %).
                matchingExtraTime: 50,
                // Tiempos ampliados de esta partida (issue #13). Vacío = mínimo.
                timings: { hostReconnectSec: '', playerReconnectSec: '', cleanupSec: '', inactivityMin: '' },
                time: '',
                // Fase del vídeo: segon en què comença el vídeo (0 = des del principi).
                videoStartSec: 0,
                // Mostrar la pregunta durant la compte arrere: marcada per defecte; es recorda en este navegador.
                showQuestionDuringCountdown: readShowQuestionCountdownHost()
            }
        };
    },
    watch: {
        'options.showQuestionDuringCountdown': function(value){
            try{ localStorage.setItem('eduhoot-host-show-question-countdown', value ? '1' : '0'); }catch(e){}
        },
        optionsView: function(view){
            saveHostOptionsView(view);
            if(this.optionsViewFromAccount){
                this.optionsViewFromAccount = false;
                return;
            }
            saveAccountOptionsView(view);
        }
    },
    // Sin sesión la petición falla o no trae la vista: se queda la del dispositivo.
    mounted: function(){
        var app = this;
        fetch('/api/auth/preferences', { credentials: 'include' })
            .then(function(res){ return res.ok ? res.json() : null; })
            .then(function(data){
                var v = data && data.hostOptionsView;
                if(v !== 'a' && v !== 'b') return;
                if(app.optionsView === v) return;
                app.optionsViewFromAccount = true;
                app.optionsView = v;
            })
            .catch(function(){});
    },
    computed: {
        autoAdvanceChoices: function(){
            var list = [];
            for(var n = 3; n <= 20; n++) list.push(n);
            return list;
        },
        joinUrl: function(){
            var qs = [];
            if(this.pin){
                qs.push('pin=' + encodeURIComponent(this.pin));
            }
            if(this.lang){
                qs.push('lang=' + encodeURIComponent(this.lang));
            }
            return qs.length ? baseJoinUrl + '?' + qs.join('&') : baseJoinUrl;
        },
        joinLabel: function(){
            try{
                return new URL(this.joinUrl).host + (this.pin ? (' · PIN ' + this.pin) : '');
            }catch(e){
                return this.pin ? ('PIN ' + this.pin) : 'Unirse';
            }
        },
        // Copia l'enllaç d'entrada complet (amb el PIN); si el navegador no té el portapapers, selecciona el camp.
        copyJoinUrl: function(){
            var self = this;
            var done = function(){
                self.copiedUrl = true;
                clearTimeout(self._copyTimer);
                self._copyTimer = setTimeout(function(){ self.copiedUrl = false; }, 2000);
            };
            var fallback = function(){
                var input = document.getElementById('join-url-text');
                if(!input) return;
                input.focus();
                input.select();
                try{ if(document.execCommand('copy')) done(); }catch(e){}
            };
            if(navigator.clipboard && navigator.clipboard.writeText){
                navigator.clipboard.writeText(this.joinUrl).then(done, fallback);
            }else{
                fallback();
            }
        },
        qrSrc: function(){
            var qrSize = 240;
            return 'https://api.qrserver.com/v1/create-qr-code/?size=' + qrSize + 'x' + qrSize + '&data=' + encodeURIComponent(this.joinUrl);
        },
        // Se guarda la clave (no el texto) para que el error cambie de idioma
        // con el resto; los errores que envía el servidor llegan ya escritos.
        errorMessage: function(){
            return this.errorKey ? this.t(this.errorKey) : this.errorText;
        },
        // Con alumnado unido no se puede cambiar cómo se llaman (nombres escritos o aleatorios).
        nameModeLocked: function(){
            return this.players.length > 0;
        }
    },
    methods: {
        toggleHelp: function(key){ this.helpOpen = (this.helpOpen === key) ? null : key; },
        // Expulsión en dos pasos: el primer toque pide confirmación durante unos segundos.
        askKick: function(player){
            this.pendingKickId = player.playerId;
            clearTimeout(kickResetTimer);
            kickResetTimer = setTimeout(function(){
                lobby.pendingKickId = '';
            }, 4000);
        },
        emitGameTimings: function(){
            var payload = {};
            var t = this.options.timings;
            Object.keys(t).forEach(function(key){
                if(t[key] !== '' && t[key] !== null && t[key] !== undefined) payload[key] = Number(t[key]);
            });
            socket.emit('setGameTimings', payload);
        },
        emitNameMode: function(){
            socket.emit('setRandomNames', { enabled: this.options.nameMode === 'random' });
        },
        unkick: function(entry){
            socket.emit('unkick-player', { id: entry.id });
        },
        confirmKick: function(player){
            clearTimeout(kickResetTimer);
            this.pendingKickId = '';
            socket.emit('kick-player', { playerId: player.playerId });
        },
        t: function(key){
            void this.lang;
            return window.getHostTranslation ? window.getHostTranslation(key) : key;
        },
        showErrorKey: function(key){
            this.errorText = '';
            this.errorKey = key;
            // Si el error llega al intentar iniciar, la partida no arranca: se reactiva el botón.
            this.starting = false;
        },
        showErrorText: function(text){
            this.errorKey = '';
            this.errorText = text || '';
        },
        startGame: function(){
            startGame();
        },
        askCancelLobby: function(){
            askCancelLobbyStep();
        }
    }
}).mount('#host-lobby');

// Mostrar botón de reanudar si hay partida activa guardada
try{
    var storedPin = localStorage.getItem(lastPinKey);
    if(storedPin){
        params.pin = params.pin || storedPin;
        lobby.pin = storedPin;
    }
    // inicializar selector de idioma con preferencia previa
    var storedLang = EduhootLang.fromStorage('lang-host');
    if(hostLangSelect && storedLang){
        hostLangSelect.value = storedLang;
        syncLangStorage(storedLang);
    }
}catch(e){}

if(hostLangSelect){
    hostLangSelect.addEventListener('change', function(){
        syncLangStorage(hostLangSelect.value);
        if(window.applyHostTranslations){
            window.applyHostTranslations(hostLangSelect.value);
        }
        lobby.lang = getHostLobbyLang();
        updateHostLobbyMusicLabels();
    });
}

initHostLobbyMusicPlayer();

//When host connects to server
socket.on('connect', function() {
    hostStartGameEmitted = false;
    lobby.starting = false;
    if(hostStartWatchdog){
        clearTimeout(hostStartWatchdog);
        hostStartWatchdog = null;
    }
    if(!params.id){
        lobby.showErrorKey('host_error_missing_id');
        return;
    }
    //Tell server that it is host connection
    socket.emit('host-join', params);
    setTimeout(function(){
        if(!lobby.pin){
            socket.emit('host-join', params);
        }
    }, 2000);
    clearTimeout(hostErrorTimeout);
    hostErrorTimeout = setTimeout(function(){
        if(!lobby.pin){
            lobby.showErrorKey('host_error_timeout');
        }
    }, 4000);
});

socket.on('showGamePin', function(data){
    lobby.pin = (data.pin || '').toString();
    lobby.hasMatching = !!data.hasMatching;
    lobby.hasComposite = !!data.hasComposite;
    lobby.hasVideo = !!data.hasVideo;
    lobby.quizName = (data.quizName || '').toString();
    params.pin = data.pin;
    try{ localStorage.setItem(lastPinKey, data.pin); }catch(e){}
});

//Adds player's name to screen and updates player count
socket.on('updatePlayerLobby', function(data){
    lobby.players = Array.isArray(data) ? data : [];
    socket.emit('getKickedList');
});

// Al crearse la partida, el servidor conoce ya la opción de nombres: se sincroniza la elegida.
socket.on('gamePin', function(){
    if(lobby && lobby.emitNameMode) lobby.emitNameMode();
    if(lobby && lobby.emitGameTimings) lobby.emitGameTimings();
});

socket.on('kickedList', function(list){
    lobby.kickedList = Array.isArray(list) ? list : [];
});

//Tell server to start game if button is clicked
function startGame(){
    if(hostStartGameEmitted){
        return;
    }
    hostStartClicked = true;
    // Respuesta inmediata: el botón se bloquea y se avisa de que la partida está arrancando.
    lobby.starting = true;
    try{
        sessionStorage.setItem(HOST_AUTOPLAY_MUSIC_KEY, '1');
        // Requisitos:
        // - al iniciar partida: sonar gong
        // - la música debe continuar / arrancar automáticamente aunque no se hubiese dado a "Reproducir"
        sessionStorage.setItem(HOST_MUSIC_SHOULD_PLAY_KEY, '1');
    }catch(e){}

    // Gesto del usuario: podemos disparar audio aquí sin bloqueo de autoplay.
    playHostLobbyGong();
    if(hostLobbyMusicPlayerInstance && typeof hostLobbyMusicPlayerInstance.play === 'function'){
        hostLobbyMusicPlayerInstance.play();
    }

    var options = lobby.options;
    var opts = {
        randomQuestions: !!options.randomQuestions,
        randomAnswers: !!options.randomAnswers,
        sendToStudents: !!options.sendToStudents,
        showScoresBetween: !!options.showScoresBetween,
        showCorrectAnswers: !!options.showCorrectAnswers,
        streak: !!options.streak,
        ghostMode: !!options.ghostMode,
        showQuestionDuringCountdown: !!options.showQuestionDuringCountdown,
        autoAdvanceSec: parseInt(options.autoAdvanceSec, 10) || 0,
        mode: options.mode === 'selfPaced' ? 'selfPaced' : 'live',
        pin: (function(){
            try{
                return (params && params.pin) || localStorage.getItem(lastPinKey) || '';
            }catch(e){
                return (params && params.pin) || '';
            }
        })()
    };
    if(lobby.hasMatching && !opts.sendToStudents){
        opts.matchingBlindStyle = options.matchingBlindStyle || 'codes';
    }
    if(lobby.hasComposite){
        opts.matchingExtraTime = parseInt(options.matchingExtraTime, 10) || 50;
    }
    // v-model en un input numérico da un número o '' si está vacío.
    var rawTime = options.time == null ? '' : String(options.time).trim();
    if(rawTime){
        var parsedTime = parseInt(rawTime, 10);
        if(!isNaN(parsedTime)){
            if(parsedTime < 5) parsedTime = 5;
            if(parsedTime > 120) parsedTime = 120;
            opts.timePerQuestion = parsedTime;
        }
    }
    opts.videoStartSec = Math.max(0, Math.min(3600, parseInt(options.videoStartSec, 10) || 0));
    emitStartGameWhenGongEnds(opts);
}
// Cancelar desde el lobby: pide confirmación (dos pasos) y el servidor cierra la partida.
var lobbyCancelResetTimer = null;
function askCancelLobbyStep(){
    if(!lobby.cancelConfirming){
        lobby.cancelConfirming = true;
        clearTimeout(lobbyCancelResetTimer);
        lobbyCancelResetTimer = setTimeout(function(){ lobby.cancelConfirming = false; }, 4000);
        return;
    }
    clearTimeout(lobbyCancelResetTimer);
    lobby.cancelConfirming = false;
    socket.emit('cancelGame');
}
socket.on('gameCancelled', function(){
    // Cerrar el lobby para la música.
    if(hostLobbyMusicPlayerInstance && typeof hostLobbyMusicPlayerInstance.pause === 'function') hostLobbyMusicPlayerInstance.pause();
    window.location.href = "/";
});

//When server starts the game
socket.on('gameStarted', function(id){
    console.log('Game Started!');
    hostStartGameEmitted = false;
    if(hostStartWatchdog){
        clearTimeout(hostStartWatchdog);
        hostStartWatchdog = null;
    }
    try{ localStorage.setItem(lastHostKey, id); }catch(e){}
    var pin = null;
    try{ pin = localStorage.getItem(lastPinKey); }catch(e){}
    var qs = '?id=' + encodeURIComponent(id);
    if(pin) qs += '&pin=' + encodeURIComponent(pin);
    // Autoritme: pantalla propia del anfitrión (progreso por alumno).
    var gameUrl = (lobby.options.mode === 'selfPaced' ? "/host/self-paced/" : "/host/game/") + qs;
    if(!openEmbeddedHostGame(gameUrl)){
        window.location.href = gameUrl;
    }
});

// Carga la vista de juego en un iframe sin salir de esta página. Así la música y el
// gong siguen siendo los <audio> que desbloqueó el clic en "Iniciar partida" y el
// navegador no vuelve a bloquear el autoplay al cambiar de página.
// Títol de la pàgina durant una partida a su ritmo: «EduHoot | <títol del quiz>». Buit en els altres casos.
function hostEmbeddedTitle(){
    if(lobby.options.mode !== 'selfPaced') return '';
    var name = (lobby.quizName || '').trim();
    return name ? 'EduHoot | ' + name : 'EduHoot';
}

function openEmbeddedHostGame(url){
    if(!hostStartClicked || document.getElementById('host-game-frame')) return false;
    var music = hostLobbyMusicPlayerInstance;
    if(!music || !music.audio || typeof music.detach !== 'function') return false;
    try{
        music.detach();
        window.eduhootHostAudio = { music: music.audio, gong: hostLobbyGongAudio };
        // La vista de juego abre su propia conexión de anfitrión, como al navegar.
        socket.disconnect();
        var frame = document.createElement('iframe');
        frame.id = 'host-game-frame';
        frame.className = 'host-game-frame';
        frame.setAttribute('allow', 'autoplay; fullscreen');
        frame.setAttribute('allowfullscreen', '');
        frame.addEventListener('load', function(){
            try{
                document.title = hostEmbeddedTitle() || frame.contentDocument.title || document.title;
                frame.contentWindow.focus();
            }catch(e){}
        });
        document.title = hostEmbeddedTitle() || document.title;
        frame.src = url;
        document.body.classList.add('host-game-embedded');
        document.body.appendChild(frame);
        // Si se recarga, se abre directamente la vista de juego (como antes).
        try{ window.history.replaceState(null, '', url); }catch(e){}
        return true;
    }catch(e){
        return false;
    }
}

// La ayuda «?» se cierra al pulsar fuera o con Esc.
document.addEventListener('click', function(e){
    if(lobby.helpOpen && !e.target.closest('.help')){ lobby.helpOpen = null; }
});
document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && lobby.helpOpen){ lobby.helpOpen = null; }
});

// Precarga del gong al cargar la portada
initHostLobbyGong();

socket.on('noGameFound', function(){
   hostStartGameEmitted = false;
   if(hostStartWatchdog){
       clearTimeout(hostStartWatchdog);
       hostStartWatchdog = null;
   }
   lobby.showErrorKey('host_error');
});

socket.on('hostError', function(payload){
    hostStartGameEmitted = false;
    lobby.starting = false;
    if(hostStartWatchdog){
        clearTimeout(hostStartWatchdog);
        hostStartWatchdog = null;
    }
    if(payload && payload.error){
        lobby.showErrorText(payload.error);
    }else{
        lobby.showErrorKey('host_error');
    }
});
