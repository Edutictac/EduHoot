var socket = io({
    reconnection: true,
    reconnectionAttempts: 30,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000
});

var joinAck = false;
var joinRetryTimer = null;

function resolveLobbyToken(params){
    if(params && params.token){
        return params.token;
    }
    try{
        var pin = params && params.pin ? String(params.pin) : '';
        var name = params && params.name ? String(params.name) : '';
        if(pin && name){
            var map = JSON.parse(localStorage.getItem('playerTokens') || '{}');
            var key = pin + ':' + name;
            if(map[key]) return map[key];
        }
    }catch(e){}
    try{
        var last = JSON.parse(localStorage.getItem('playerLastJoin') || '{}');
        var samePin = params && params.pin && last && String(last.pin) === String(params.pin);
        var sameName = params && params.name && last && String(last.name) === String(params.name);
        if(samePin && sameName && last.token){
            return last.token;
        }
    }catch(e){}
    return '';
}

function tLobby(key){
    return window.i18nPlayer ? window.i18nPlayer.t(key) : key;
}

// Subfase B: els dos missatges de la sala són estat d'una app de Vue.
var initialParams = jQuery.deparam(window.location.search) || {};

var lobby = Vue.createApp({
    template: '#lobby-tpl',
    data: function(){
        return {
            title: tLobby('lobby_wait'),
            detail: tLobby('lobby_check'),
            // Nombre e icono tal como los ve el profesor en la pantalla compartida.
            playerName: initialParams.name ? String(initialParams.name) : '',
            playerIcon: initialParams.icon ? String(initialParams.icon) : '',
            // connecting | joined | slow | reconnecting | offline
            connState: 'connecting',
            // Número de alumnos en la sala. Solo se guarda el total, nunca los nombres.
            count: null,
            // Código de la partida, para comprobar que se está en la correcta.
            pin: initialParams.pin ? String(initialParams.pin) : ''
        };
    },
    computed: {
        countText: function(){
            if(this.count === null) return '';
            return tLobby('lobby_count').replace('{n}', String(this.count));
        },
        pinText: function(){
            return tLobby('lobby_pin') + ' ' + this.pin;
        }
    }
}).mount('#lobby-app');

function setLobbyStatus(waiting, detail){
    lobby.title = waiting || lobby.title;
    if(detail !== undefined){
        lobby.detail = detail;
    }
}

// Si en 10 s no llega la confirmación, se avisa sin abandonar la sala: sigue reintentando.
var slowTimer = null;
function clearSlowTimer(){
    if(slowTimer){
        clearTimeout(slowTimer);
        slowTimer = null;
    }
}
function startSlowTimer(){
    clearSlowTimer();
    slowTimer = setTimeout(function(){
        slowTimer = null;
        if(joinAck) return;
        lobby.connState = 'slow';
        setLobbyStatus(undefined, tLobby('lobby_slow'));
    }, 10000);
}

// Igual que en la partida: que el móvil no se bloquee mientras espera (si se bloquea, se pierde la conexión).
var wakeLockSentinel = null;
function requestLobbyWakeLock(){
    if(!('wakeLock' in navigator)) return;
    if(wakeLockSentinel && !wakeLockSentinel.released) return;
    navigator.wakeLock.request('screen').then(function(sentinel){
        wakeLockSentinel = sentinel;
        sentinel.addEventListener('release', function(){
            wakeLockSentinel = null;
        });
    }).catch(function(){});
}
document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible') requestLobbyWakeLock();
});

//When player connects to server
socket.on('connect', function() {
    joinAck = false;

    var params = jQuery.deparam(window.location.search); //Gets data from url
    var resolvedToken = resolveLobbyToken(params);
    if(resolvedToken){
        params.token = resolvedToken;
    }
    
    //Tell server that it is player connection
    socket.emit('player-join', params);
    lobby.connState = 'connecting';
    setLobbyStatus(tLobby('lobby_wait'), tLobby('lobby_name_hint'));
    startSlowTimer();
    requestLobbyWakeLock();
    if(joinRetryTimer){
        clearTimeout(joinRetryTimer);
    }
    joinRetryTimer = setTimeout(function(){
        if(joinAck) return;
        socket.emit('player-join', params);
    }, 1200);
});

socket.on('playerJoinAck', function(){
    joinAck = true;
    if(joinRetryTimer){
        clearTimeout(joinRetryTimer);
        joinRetryTimer = null;
    }
    clearSlowTimer();
    lobby.connState = 'joined';
    setLobbyStatus(tLobby('lobby_connected'), tLobby('lobby_connected_hint'));
});

// Contador de la sala: el servidor envía la lista completa en cada entrada o salida;
// aquí solo se usa el número.
socket.on('updatePlayerLobby', function(playersInGame){
    lobby.count = Array.isArray(playersInGame) ? playersInGame.length : null;
});

socket.on('disconnect', function(){
    clearSlowTimer();
    lobby.connState = 'offline';
    setLobbyStatus(undefined, tLobby('lobby_offline'));
});

socket.on('playerJoinRejected', function(data){
    joinAck = false;
    if(joinRetryTimer){
        clearTimeout(joinRetryTimer);
        joinRetryTimer = null;
    }
    clearSlowTimer();
    // Issue #28: el nom ja està en ús (dos alumnes entrant alhora amb el
    // mateix nom). Torna a l'entrada amb el PIN per a triar-ne un altre.
    if(data && data.code === 'nameTaken'){
        var joinParams = jQuery.deparam(window.location.search);
        setLobbyStatus(tLobby('join_name_taken'), '');
        setTimeout(function(){
            window.location.href = '/join.html?pin=' + encodeURIComponent(joinParams.pin || '') + '&nameTaken=1';
        }, 1200);
        return;
    }
    var message = data && data.error ? data.error : tLobby('lobby_access_error');
    setLobbyStatus(message, tLobby('lobby_reenter_hint'));
    setTimeout(function(){
        window.location.href = '../';
    }, 1800);
});

//Boot player back to join screen if game pin has no match
socket.on('noGameFound', function(){
    window.location.href = '../';
});
//If the host disconnects, then the player is booted to main screen
socket.on('hostDisconnect', function(){
    window.location.href = '../';
});

socket.on('hostReconnecting', function(){
    lobby.connState = 'reconnecting';
    setLobbyStatus(tLobby('lobby_reconnecting'), tLobby('lobby_reconnecting_hint'));
});

socket.on('hostReconnected', function(){
    lobby.connState = 'joined';
    setLobbyStatus(tLobby('lobby_wait'), tLobby('lobby_name_hint'));
});

//When the host clicks start game, the player screen changes
socket.on('gameStartedPlayer', function(){
    var params = jQuery.deparam(window.location.search);
    var url = "/player/game/?id=" + socket.id;
    if(params.pin) url += "&pin=" + encodeURIComponent(params.pin);
    if(params.token) url += "&token=" + encodeURIComponent(params.token);
    if(params.name) url += "&name=" + encodeURIComponent(params.name);
    window.location.href = url;
});

// Hide language switcher if present once the game starts
var langSw = document.getElementById('lang-switcher');
if (langSw) {
    socket.on('gameStartedPlayer', function(){
        langSw.style.display = 'none';
    });
}
