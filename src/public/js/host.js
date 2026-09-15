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
var joinQrImg = document.getElementById('join-qr');
var joinUrlAnchor = document.getElementById('join-url');
var gamePinText = document.getElementById('gamePinText');
var hostError = document.getElementById('host-error');
var pinLoaded = false;
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
            var msg = (window.getHostTranslation && window.getHostTranslation('host_error')) || 'No se pudo iniciar la partida. Vuelve a intentarlo.';
            showHostError(msg);
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
    var l = null;
    try{ l = localStorage.getItem('lang-host') || localStorage.getItem('lang') || localStorage.getItem('edutictac-portal-lang') || localStorage.getItem('edutictac-lang'); }catch(e){}
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

function buildJoinUrl(pin){
    var l = getHostLobbyLang();
    var qs = [];
    if(pin){
        qs.push('pin=' + encodeURIComponent(pin));
    }
    if(l){
        qs.push('lang=' + encodeURIComponent(l));
    }
    return qs.length ? baseJoinUrl + '?' + qs.join('&') : baseJoinUrl;
}

function updateJoinQr(pin){
    var url = buildJoinUrl(pin);
    var qrSize = 240;
    if(joinQrImg){
        joinQrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=' + qrSize + 'x' + qrSize + '&data=' + encodeURIComponent(url);
        joinQrImg.setAttribute('aria-label', url);
    }
    if(joinUrlAnchor){
        joinUrlAnchor.href = url;
        try{
            var parsed = new URL(url);
            joinUrlAnchor.textContent = parsed.host + (pin ? (' · PIN ' + pin) : '');
        }catch(e){
            joinUrlAnchor.textContent = (pin ? ('PIN ' + pin) : 'Unirse');
        }
    }
}

function setDisplayedPin(pin){
    var safePin = (pin || '').toString();
    pinLoaded = !!pin;
    if(gamePinText){
        gamePinText.textContent = safePin || '—';
    }
    updateJoinQr(safePin);
}

function showHostError(msg){
    if(!hostError) return;
    hostError.textContent = msg || '';
    hostError.style.display = 'block';
}

function syncLangStorage(val){
    if(!val) return;
    try{
        localStorage.setItem('lang-host', val);
        localStorage.setItem('lang', val); // reutiliza la misma clave que usa la vista de juego
        localStorage.setItem('lang-player', val);
        localStorage.setItem('edutictac-portal-lang', val);
        localStorage.setItem('edutictac-lang', val);
    }catch(e){}
}

// Mostrar botón de reanudar si hay partida activa guardada
try{
    var savedHost = localStorage.getItem(lastHostKey);
    var storedPin = localStorage.getItem(lastPinKey);
    if(storedPin){
        params.pin = params.pin || storedPin;
        setDisplayedPin(storedPin);
    }else{
        updateJoinQr();
    }
    // inicializar selector de idioma con preferencia previa
    var storedLang = localStorage.getItem('lang-host') || localStorage.getItem('lang') || localStorage.getItem('edutictac-portal-lang') || localStorage.getItem('edutictac-lang');
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
        updateJoinQr(params.pin || '');
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
    document.getElementById('players').value = "";
    if(!params.id){
        showHostError((window.getHostTranslation && window.getHostTranslation('host_error_missing_id')) || 'Falta el quiz para generar la partida. Vuelve a elegirlo.');
        return;
    }
    //Tell server that it is host connection
    socket.emit('host-join', params);
    setTimeout(function(){
        if(!pinLoaded){
            socket.emit('host-join', params);
        }
    }, 2000);
    clearTimeout(hostErrorTimeout);
    hostErrorTimeout = setTimeout(function(){
        if(!pinLoaded){
            showHostError((window.getHostTranslation && window.getHostTranslation('host_error_timeout')) || 'No pudimos obtener el PIN. Revisa la conexión y vuelve a elegir el quiz.');
        }
    }, 4000);
});

socket.on('showGamePin', function(data){
   setDisplayedPin(data.pin);
    params.pin = data.pin;
   try{ localStorage.setItem(lastPinKey, data.pin); }catch(e){}
});

//Adds player's name to screen and updates player count
socket.on('updatePlayerLobby', function(data){
    
    var container = document.getElementById('players');
    if(!container) return;
    container.innerHTML = '';
    for(var i = 0; i < data.length; i++){
        var icon = data[i].icon ? data[i].icon : '';
        var item = document.createElement('div');
        item.className = 'player-item';
        var iconEl = document.createElement('span');
        iconEl.className = 'player-icon';
        iconEl.textContent = icon;
        var nameEl = document.createElement('span');
        nameEl.className = 'player-name';
        nameEl.textContent = data[i].name || '';
        item.appendChild(iconEl);
        item.appendChild(nameEl);
        container.appendChild(item);
    }
    
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

    var opts = {
        randomQuestions: document.getElementById('opt-rand-q') ? document.getElementById('opt-rand-q').checked : true,
        randomAnswers: document.getElementById('opt-rand-a') ? document.getElementById('opt-rand-a').checked : true,
        sendToMobile: document.getElementById('opt-send-mobile') ? document.getElementById('opt-send-mobile').checked : true,
        showScoresBetween: document.getElementById('opt-show-scores') ? document.getElementById('opt-show-scores').checked : true,
        pin: (function(){
            try{
                return (params && params.pin) || localStorage.getItem(lastPinKey) || '';
            }catch(e){
                return (params && params.pin) || '';
            }
        })()
    };
    var timeInput = document.getElementById('opt-time');
    var rawTime = timeInput && typeof timeInput.value === 'string' ? timeInput.value.trim() : '';
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
    window.location.href="/host/game/" + qs;
});

// Precarga del gong al cargar la portada
initHostLobbyGong();

socket.on('noGameFound', function(){
   hostStartGameEmitted = false;
   if(hostStartWatchdog){
       clearTimeout(hostStartWatchdog);
       hostStartWatchdog = null;
   }
   var msg = (window.getHostTranslation && window.getHostTranslation('host_error')) || 'No se pudo iniciar la partida. Vuelve a elegir el quiz y prueba de nuevo.';
   showHostError(msg);
});

socket.on('hostError', function(payload){
    hostStartGameEmitted = false;
    if(hostStartWatchdog){
        clearTimeout(hostStartWatchdog);
        hostStartWatchdog = null;
    }
    var msg = payload && payload.error ? payload.error : ((window.getHostTranslation && window.getHostTranslation('host_error')) || 'No se pudo iniciar la partida. Vuelve a elegir el quiz y prueba de nuevo.');
    showHostError(msg);
});
