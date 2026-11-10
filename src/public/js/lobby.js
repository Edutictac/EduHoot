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

function setLobbyStatus(waiting, detail){
    var title1 = document.getElementById('title1');
    var title2 = document.getElementById('title2');
    if(title1){
        title1.textContent = waiting || title1.textContent;
    }
    if(title2 && detail !== undefined){
        title2.textContent = detail;
    }
}

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
    setLobbyStatus('Esperando a que empiece la partida', 'Comprueba que tu nombre aparece en la pantalla');
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
    setLobbyStatus('Conectado a la partida', 'Si no apareces en pantalla del profesor, espera 1-2 segundos.');
});

socket.on('playerJoinRejected', function(data){
    joinAck = false;
    if(joinRetryTimer){
        clearTimeout(joinRetryTimer);
        joinRetryTimer = null;
    }
    var message = data && data.error ? data.error : 'No se pudo validar el acceso.';
    setLobbyStatus(message, 'Vuelve a entrar con tu código y PIN.');
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
    setLobbyStatus('Reconectando con el profesor...', 'La partida sigue reservada. No cierres esta pantalla.');
});

socket.on('hostReconnected', function(){
    setLobbyStatus('Esperando a que empiece la partida', 'Comprueba que tu nombre aparece en la pantalla');
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
