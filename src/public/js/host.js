var socket = io({
    reconnection: true,
    reconnectionAttempts: 30,
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
        bgMusicVolume: 'Volumen'
    },
    en: {
        bgMusicTitle: 'Background music',
        bgMusicChoose: 'Choose a track',
        bgMusicPlay: 'Play music',
        bgMusicPause: 'Pause music',
        bgMusicPrev: 'Prev',
        bgMusicNext: 'Next',
        bgMusicVolume: 'Volume'
    },
    ca: {
        bgMusicTitle: 'Música de fons',
        bgMusicChoose: 'Tria un tema',
        bgMusicPlay: 'Reprodueix música',
        bgMusicPause: 'Atura la música',
        bgMusicPrev: 'Anterior',
        bgMusicNext: 'Següent',
        bgMusicVolume: 'Volum'
    },
    va: {
        bgMusicTitle: 'Música de fons',
        bgMusicChoose: 'Tria un tema',
        bgMusicPlay: 'Reprodueix música',
        bgMusicPause: 'Atura la música',
        bgMusicPrev: 'Anterior',
        bgMusicNext: 'Següent',
        bgMusicVolume: 'Volum'
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
        labels: {
            title: hostLobbyT('bgMusicTitle'),
            choose: hostLobbyT('bgMusicChoose'),
            play: hostLobbyT('bgMusicPlay'),
            pause: hostLobbyT('bgMusicPause'),
            prev: hostLobbyT('bgMusicPrev'),
            next: hostLobbyT('bgMusicNext'),
            volume: hostLobbyT('bgMusicVolume')
        }
    });
}

function syncLangStorage(val){
    if(!val) return;
    EduhootLang.persist(val);
}

// Lobby (Vue): PIN, QR, error, opciones y jugadores salen de estos datos y
// Vue repinta solo cuando cambian. Los textos se traducen con t(), que lee
// `lang` para que Vue sepa que debe repintar al cambiar de idioma.
var lobby = Vue.createApp({
    template: '#host-lobby-tpl',
    data: function(){
        return {
            lang: getHostLobbyLang(),
            pin: '',
            players: [],
            errorKey: '',
            errorText: '',
            options: {
                randomQuestions: false,
                randomAnswers: true,
                sendToStudents: true,
                showScoresBetween: true,
                time: ''
            }
        };
    },
    computed: {
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
        qrSrc: function(){
            var qrSize = 240;
            return 'https://api.qrserver.com/v1/create-qr-code/?size=' + qrSize + 'x' + qrSize + '&data=' + encodeURIComponent(this.joinUrl);
        },
        // Se guarda la clave (no el texto) para que el error cambie de idioma
        // con el resto; los errores que envía el servidor llegan ya escritos.
        errorMessage: function(){
            return this.errorKey ? this.t(this.errorKey) : this.errorText;
        }
    },
    methods: {
        t: function(key){
            void this.lang;
            return window.getHostTranslation ? window.getHostTranslation(key) : key;
        },
        showErrorKey: function(key){
            this.errorText = '';
            this.errorKey = key;
        },
        showErrorText: function(text){
            this.errorKey = '';
            this.errorText = text || '';
        },
        startGame: function(){
            startGame();
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
    params.pin = data.pin;
    try{ localStorage.setItem(lastPinKey, data.pin); }catch(e){}
});

//Adds player's name to screen and updates player count
socket.on('updatePlayerLobby', function(data){
    lobby.players = Array.isArray(data) ? data : [];
});

//Tell server to start game if button is clicked
function startGame(){
    if(hostStartGameEmitted){
        return;
    }
    hostStartClicked = true;
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
        pin: (function(){
            try{
                return (params && params.pin) || localStorage.getItem(lastPinKey) || '';
            }catch(e){
                return (params && params.pin) || '';
            }
        })()
    };
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
    emitStartGameWhenGongEnds(opts);
}
function endGame(){
    window.location.href = "/";
}
// Abans era onclick="endGame()" en el HTML, que la CSP no permet.
var cancelButton = document.getElementById('cancel');
if(cancelButton) cancelButton.addEventListener('click', endGame);

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
    if(!openEmbeddedHostGame("/host/game/" + qs)){
        window.location.href="/host/game/" + qs;
    }
});

// Carga la vista de juego en un iframe sin salir de esta página. Así la música y el
// gong siguen siendo los <audio> que desbloqueó el clic en "Iniciar partida" y el
// navegador no vuelve a bloquear el autoplay al cambiar de página.
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
                document.title = frame.contentDocument.title || document.title;
                frame.contentWindow.focus();
            }catch(e){}
        });
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
