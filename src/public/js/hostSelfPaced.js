// Pantalla del anfitrión en el modo autoritme (feature 3): progreso por alumno y cierre de la partida.
// Eventos: spProgress (lista), updatePlayerLobby (entradas y salidas → se pide el progreso),
// spEnd (cerrar), GameOver (podio). La puntuación no se muestra en vivo (decisión 2 del plan).
var socket = io({ reconnection: true, reconnectionAttempts: 30, reconnectionDelay: 500, reconnectionDelayMax: 3000 });
var lang = EduhootLang.init({ preferKey: 'lang-host' });
var params = jQuery.deparam(window.location.search);

var i18n = {
    es: { endGame: 'Acabar partida', endConfirm: 'Confirmar: acabar', downloadReport: 'Descargar informe (CSV)', downloadReportError: 'No se ha podido descargar el informe de la sesión.',
        backToLibrary: 'Biblioteca', noStudents: 'Esperando alumnado…', finished: 'Terminado', handRaised: 'Mano levantada', kickBtn: 'Expulsar', kickConfirm: '¿Seguro?',
        topPlayers: 'Mejores jugadores', summary: '{n} alumnos · {f} han terminado', summaryEnded: 'Partida terminada · {n} alumnos' },
    en: { endGame: 'End game', endConfirm: 'Confirm: end it', downloadReport: 'Download report (CSV)', downloadReportError: 'Could not download the session report.',
        backToLibrary: 'Library', noStudents: 'Waiting for students…', finished: 'Finished', handRaised: 'Hand raised', kickBtn: 'Kick', kickConfirm: 'Sure?',
        topPlayers: 'Top players', summary: '{n} students · {f} finished', summaryEnded: 'Game over · {n} students' },
    ca: { endGame: 'Acabar partida', endConfirm: 'Confirma: acabar', downloadReport: 'Descarregar informe (CSV)', downloadReportError: 'No s\'ha pogut descarregar l\'informe de la sessió.',
        backToLibrary: 'Biblioteca', noStudents: 'Esperant alumnat…', finished: 'Acabat', handRaised: 'Mà alçada', kickBtn: 'Expulsar', kickConfirm: 'Segur?',
        topPlayers: 'Millors jugadors', summary: '{n} alumnes · {f} han acabat', summaryEnded: 'Partida acabada · {n} alumnes' }
};
function t(key){
    var chain = lang === 'va' ? ['va', 'ca', 'es'] : [lang, 'es'];
    for(var i = 0; i < chain.length; i++){
        var d = i18n[chain[i]];
        if(d && d[key]) return d[key];
    }
    return key;
}
function fmt(key, vars){
    return t(key).replace(/\{(\w+)\}/g, function(_, k){ return String(vars[k]); });
}

var endResetTimer = null;
var kickResetTimer = null;
var app = Vue.createApp({
    template: '#host-sp-tpl',
    data: function(){
        return { pin: '', quizName: '', list: [], ended: false, endConfirming: false, pendingKickId: null,
            podium: { showPodium: true, num1: '', num2: '', num3: '', num4: '', num5: '' }, langTick: 0 };
    },
    computed: {
        pinText: function(){ return 'PIN: ' + this.pin; },
        summaryText: function(){
            var n = this.list.length;
            if(this.ended) return fmt('summaryEnded', { n: n });
            var f = this.list.filter(function(p){ return p.finished; }).length;
            return fmt('summary', { n: n, f: f });
        },
        // Top 10 en vivo: solo si el servidor envía puntos (casilla de puntuaciones activada).
        top: function(){
            return this.list.filter(function(p){ return typeof p.score === 'number'; })
                .sort(function(a, b){ return b.score - a.score; }).slice(0, 10);
        },
        podiumNames: function(){
            var p = this.podium;
            return [p.num1, p.num2, p.num3, p.num4, p.num5].filter(function(n){ return !!n; });
        }
    },
    methods: {
        t: function(key){ this.langTick; return t(key); },
        pct: function(p){ return p.total ? Math.min(100, Math.round((p.answered / p.total) * 100)) : 0; },
        askEnd: function(){
            if(!this.endConfirming){
                this.endConfirming = true;
                clearTimeout(endResetTimer);
                endResetTimer = setTimeout(function(){ app.endConfirming = false; }, 4000);
                return;
            }
            clearTimeout(endResetTimer);
            this.endConfirming = false;
            socket.emit('spEnd');
        },
        askKick: function(p){
            this.pendingKickId = p.playerId;
            clearTimeout(kickResetTimer);
            kickResetTimer = setTimeout(function(){ app.pendingKickId = null; }, 4000);
        },
        confirmKick: function(p){
            clearTimeout(kickResetTimer);
            this.pendingKickId = null;
            socket.emit('kick-player', { playerId: p.playerId });
        },
        goBack: function(){ window.location.href = '/create/'; },
        downloadReport: function(){ downloadSessionReportCsv(); }
    }
}).mount('#host-sp');

if(window.EduhootLang && typeof window.EduhootLang.render === 'function') window.EduhootLang.render();
document.querySelectorAll('select[data-lang-options]').forEach(function(sel){
    sel.value = lang;
    sel.addEventListener('change', function(){ lang = sel.value; EduhootLang.persist(lang); app.langTick += 1; });
});

socket.on('connect', function(){ socket.emit('host-join-game', params); });
socket.on('noGameFound', function(){ window.location.href = '/create/'; });
socket.on('gamePin', function(d){ app.pin = d.pin || ''; app.quizName = d.quizName || ''; });
socket.on('hostSession', function(d){
    // El anfitrión puede cambiar de conexión: se guarda el id nuevo para el informe.
    if(d && d.hostId) params.id = d.hostId;
    if(d && d.pin) params.pin = d.pin;
});
socket.on('spProgress', function(list){ app.list = Array.isArray(list) ? list : []; });
// Entradas, salidas y expulsiones: se pide el progreso actualizado.
socket.on('updatePlayerLobby', function(){ socket.emit('spProgressRequest'); });
socket.on('GameOver', function(data){
    app.podium = data || app.podium;
    app.ended = true;
    app.endConfirming = false;
    try{ localStorage.removeItem('lastHostId'); localStorage.removeItem('lastGamePin'); }catch(e){}
});
socket.on('gameCancelled', function(){ window.location.href = '/create/'; });

async function downloadSessionReportCsv(){
    if(!params.pin || !params.id){ alert(t('downloadReportError')); return; }
    try{
        var url = '/api/live-games/' + encodeURIComponent(params.pin) + '/report.csv?hostId=' + encodeURIComponent(params.id);
        var res = await fetch(url, { credentials: 'include' });
        if(!res.ok) throw new Error('download-failed');
        var disposition = res.headers.get('Content-Disposition') || '';
        var match = disposition.match(/filename="?([^";]+)"?/i);
        var blob = await res.blob();
        var a = document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = (match && match[1]) ? match[1] : ('informe-' + params.pin + '.csv');
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(a.href);
    }catch(err){
        alert(t('downloadReportError'));
    }
}
