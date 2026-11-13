var socket = io({
    reconnection: true,
    reconnectionAttempts: 30,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000
});
var correct = false;
var name;
var score = 0;
var token = null;
var lastAnswers = [];
var rankingTimeout = null;
var timerInterval = null;
var questionCountdownTimer = null;
var wakeLock = null;
var questionActive = false;
var reconnectGraceTimer = null;
var reconnectGraceMs = 40000;
var RECONNECT_GRACE_STORAGE_KEY = 'playerReconnectGrace';
var ANSWER_SHAPE_KEYS = ['shape_triangle', 'shape_diamond', 'shape_circle', 'shape_square'];
var ANSWER_LETTERS = ['A', 'B', 'C', 'D'];

function tPlayer(key, fallback){
    return window.i18nPlayer ? window.i18nPlayer.t(key) : (fallback || key);
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

// Pregunta/respostes (bloc 1) i nom/puntuació/rànquing/missatge (bloc 2):
// tot el que depenia de 156 operacions manuals sobre el DOM ara és estat
// reactiu, en una sola app de Vue (Subfase B).
var app = Vue.createApp({
    template: '#player-game-tpl',
    data: function(){
        return {
            questionText: '',
            ttsSpeaking: false,
            answers: [],
            questionType: 'quiz',
            blind: false,
            blindActiveCount: 0,
            multiSelections: [],
            playerAnswered: false,
            answersVisible: true,
            freeAnswerValue: '',
            pointsMultiplier: 1,
            badgeKey: 0,
            countdownVisible: false,
            countdownSeconds: 0,
            timerLeft: 20,
            timerTotal: 20,
            answerStatusState: '',
            playerName: '',
            playerIcon: '',
            playerScore: null,
            rankText: '',
            message: '',
            messageDetailHtml: '',
            messageVisible: true,
            rankingVisible: false,
            rankingList: []
        };
    },
    computed: {
        nameLabel: function(){
            return this.t('name', 'Name:');
        },
        scoreLabel: function(){
            return this.t('score', 'Score:');
        },
        nameDisplay: function(){
            if(!this.playerName) return this.nameLabel;
            var icon = this.playerIcon ? this.playerIcon + ' ' : '';
            return this.nameLabel + ' ' + icon + this.playerName;
        },
        scoreDisplay: function(){
            return this.playerScore !== null ? (this.scoreLabel + ' ' + this.playerScore) : this.scoreLabel;
        },
        questionHtml: function(){
            return formatRichText(this.questionText);
        },
        // Lectura en veu alta (proposta 13). Mai amb el mode «a cegues»:
        // llavors el text no arriba a l'alumnat.
        ttsAvailable: function(){
            return !this.blind && !!this.questionText && EduhootTTS.canSpeak(document.documentElement.lang);
        },
        freeAnswerType: function(){
            return this.questionType === 'short-answer' || this.questionType === 'numeric';
        },
        freeRowVisible: function(){
            return this.freeAnswerType && !this.playerAnswered && this.answersVisible;
        },
        multiRowVisible: function(){
            return this.questionType === 'multiple' && !this.playerAnswered && this.answersVisible;
        },
        freePlaceholder: function(){
            return this.questionType === 'numeric'
                ? this.t('numeric_placeholder', 'Introduce un número')
                : this.t('text_placeholder', 'Escribe tu respuesta');
        },
        badgeVisible: function(){
            var m = Number(this.pointsMultiplier);
            return Number.isFinite(m) && m > 1;
        },
        badgeText: function(){
            return 'x' + this.pointsMultiplier + ' · ' + this.t('points_double', 'Double points');
        },
        answerStatusVisible: function(){
            return this.answerStatusState === 'pending' || this.answerStatusState === 'submitted';
        },
        answerStatusText: function(){
            return this.answerStatusState === 'submitted'
                ? this.t('status_submitted', 'Respuesta enviada')
                : this.t('status_pending', 'Responde ahora');
        },
        timerPct: function(){
            return Math.max(0, Math.min(100, (this.timerLeft / this.timerTotal) * 100));
        },
        timerColor: function(){
            var pct = this.timerPct;
            if(pct < 35) return 'linear-gradient(135deg, #f97316, #ef4444)';
            if(pct < 60) return 'linear-gradient(135deg, #facc15, #f97316)';
            return 'linear-gradient(135deg, #22c55e, #16a34a)';
        },
        timerText: function(){
            return Math.max(0, Math.ceil(this.timerLeft)) + 's';
        }
    },
    methods: {
        t: function(key, fallback){
            return tPlayer(key, fallback);
        },
        buttonHasContent: function(i){
            if(this.blind) return i < this.blindActiveCount;
            var text = this.answers[i];
            return !!(text && String(text).trim());
        },
        buttonVisible: function(i){
            return this.answersVisible && this.buttonHasContent(i);
        },
        buttonHtml: function(i){
            return this.blind ? '' : formatRichText(this.answers[i] || '');
        },
        buttonAriaLabel: function(i){
            if(!this.blind) return null;
            var active = i < this.blindActiveCount;
            return active
                ? (this.t('answer_option') + ' ' + ANSWER_LETTERS[i] + ': ' + this.t(ANSWER_SHAPE_KEYS[i]))
                : '';
        },
        isMultiSelected: function(num){
            return this.multiSelections.indexOf(num) !== -1;
        },
        onAnswerClick: function(num){
            if(this.questionType === 'multiple'){
                this.toggleMultiAnswer(num);
                return;
            }
            if(this.freeAnswerType) return;
            this.submitAnswer(num);
        },
        toggleMultiAnswer: function(num){
            if(this.playerAnswered) return;
            var idx = this.multiSelections.indexOf(num);
            if(idx === -1){
                this.multiSelections.push(num);
            }else{
                this.multiSelections.splice(idx, 1);
            }
        },
        submitMultiAnswers: function(){
            if(this.playerAnswered || !this.multiSelections.length) return;
            this.submitAnswer(this.multiSelections.slice());
        },
        submitFree: function(){
            if(this.playerAnswered) return;
            if(!this.freeAnswerType) return;
            var raw = (this.freeAnswerValue || '').toString();
            if(this.questionType === 'numeric'){
                this.submitAnswer({ number: raw });
            }else{
                this.submitAnswer({ text: raw });
            }
        },
        submitAnswer: function(payload){
            if(this.playerAnswered) return;
            this.playerAnswered = true;
            socket.emit('playerAnswer', payload);
            this.answersVisible = false;
            this.multiSelections = [];
            this.answerStatusState = 'submitted';
            showMessage(tPlayer('submitted', 'Answer Submitted! Waiting on other players...'));
        },
        hidePlayerRanking: function(){
            this.rankingVisible = false;
        },
        toggleSpeech: function(){
            var self = this;
            if(this.ttsSpeaking){
                EduhootTTS.cancel();
                this.ttsSpeaking = false;
                return;
            }
            var parts = [this.questionText].concat(this.answers || []);
            this.ttsSpeaking = true;
            var started = EduhootTTS.speakParts(parts, document.documentElement.lang, function(){
                self.ttsSpeaking = false;
            });
            if(!started) this.ttsSpeaking = false;
        }
    }
}).mount('#player-game');

// Mostra/oculta el missatge gran (#message), substituint tot el seu
// contingut (igual que feia abans `textContent = ...`, que esborrava
// qualsevol detall afegit amb appendChild).
function showMessage(text){
    app.message = text;
    app.messageVisible = true;
    app.messageDetailHtml = '';
}

function hideMessage(clearText){
    app.messageVisible = false;
    if(clearText){
        app.message = '';
        app.messageDetailHtml = '';
    }
}

var params = jQuery.deparam(window.location.search); //Gets the id from url
try{
    var last = localStorage.getItem('playerLastJoin');
    if(last && (!params.pin || !params.name)){
        var parsed = JSON.parse(last);
        if(parsed && parsed.pin && parsed.name){
            params.pin = params.pin || parsed.pin;
            params.name = params.name || parsed.name;
            params.icon = params.icon || parsed.icon;
            if(!token && parsed.token) token = parsed.token;
        }
    }
}catch(e){}
if(params.token){
    token = params.token;
}else{
    try{
        var tokens = JSON.parse(localStorage.getItem('playerTokens') || '{}');
        var key = (params.pin || '') + ':' + (params.name || '');
        token = tokens[key];
    }catch(e){}
}

function persistJoinState(){
    try{
        var data = {
            pin: params.pin || '',
            name: params.name || '',
            token: token || '',
            icon: params.icon || ''
        };
        localStorage.setItem('playerLastJoin', JSON.stringify(data));
    }catch(e){}
}

function removePlayerToken(){
    try{
        var tokens = JSON.parse(localStorage.getItem('playerTokens') || '{}');
        var key = (params.pin || '') + ':' + (params.name || '');
        if(tokens && Object.prototype.hasOwnProperty.call(tokens, key)){
            delete tokens[key];
            localStorage.setItem('playerTokens', JSON.stringify(tokens));
        }
    }catch(e){}
}

function clearPersistedJoinState(){
    try{ localStorage.removeItem('playerLastJoin'); }catch(e){}
    removePlayerToken();
    token = null;
}

function saveReconnectGrace(ms){
    var graceMs = Number(ms);
    if(!Number.isFinite(graceMs) || graceMs <= 0) return;
    reconnectGraceMs = graceMs;
    var existingExpiresAt = null;
    try{
        var prev = JSON.parse(localStorage.getItem(RECONNECT_GRACE_STORAGE_KEY) || '{}');
        var prevExpiresAt = Number(prev.expiresAt);
        if(Number.isFinite(prevExpiresAt) && prevExpiresAt > Date.now()){
            existingExpiresAt = prevExpiresAt;
        }
    }catch(e){}
    try{
        localStorage.setItem(RECONNECT_GRACE_STORAGE_KEY, JSON.stringify({
            ms: graceMs,
            expiresAt: existingExpiresAt
        }));
    }catch(e){}
}

function loadReconnectGrace(){
    try{
        var raw = localStorage.getItem(RECONNECT_GRACE_STORAGE_KEY);
        if(!raw) return null;
        var parsed = JSON.parse(raw);
        if(!parsed || typeof parsed !== 'object') return null;
        var ms = Number(parsed.ms);
        var expiresAt = Number(parsed.expiresAt);
        if(!Number.isFinite(ms) || ms <= 0 || !Number.isFinite(expiresAt)) return null;
        reconnectGraceMs = ms;
        return { ms: ms, expiresAt: expiresAt };
    }catch(e){
        return null;
    }
}

function clearReconnectGrace(){
    if(reconnectGraceTimer){
        clearInterval(reconnectGraceTimer);
        reconnectGraceTimer = null;
    }
    try{ localStorage.removeItem(RECONNECT_GRACE_STORAGE_KEY); }catch(e){}
}

function setReconnectMessage(text){
    showMessage(text);
}

function tPlayerFormat(key, fallback, vars){
    var txt = tPlayer(key, fallback || key);
    if(!vars || typeof vars !== 'object') return txt;
    return String(txt).replace(/\{(\w+)\}/g, function(_, name){
        return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : '';
    });
}

function startReconnectGraceCountdown(){
    if(reconnectGraceTimer){
        clearInterval(reconnectGraceTimer);
        reconnectGraceTimer = null;
    }
    var grace = loadReconnectGrace();
    if(!grace){
        grace = { ms: reconnectGraceMs, expiresAt: Date.now() + reconnectGraceMs };
    }else if(!Number.isFinite(grace.expiresAt) || grace.expiresAt <= Date.now()){
        grace.expiresAt = Date.now() + grace.ms;
    }
    try{
        localStorage.setItem(RECONNECT_GRACE_STORAGE_KEY, JSON.stringify({
            ms: grace.ms,
            expiresAt: grace.expiresAt
        }));
    }catch(e){}

    if(grace.ms > 0){
        reconnectGraceMs = grace.ms;
    }

    function render(){
        var remainingMs = Math.max(0, grace.expiresAt - Date.now());
        var remainingSec = Math.ceil(remainingMs / 1000);
        if(!navigator.onLine){
            setReconnectMessage(
                tPlayerFormat(
                    'reconnecting_waiting_network',
                    'Sin conexión - esperando red... ({seconds} s)',
                    { seconds: remainingSec }
                )
            );
        }else{
            setReconnectMessage(
                tPlayerFormat(
                    'reconnecting_saved_spot',
                    'Reconectando... te hemos guardado el sitio durante {seconds} s',
                    { seconds: remainingSec }
                )
            );
        }
        if(remainingMs <= 0){
            clearReconnectGrace();
            clearPersistedJoinState();
            setReconnectMessage(tPlayer('reconnecting_kicked', 'Has salido de la partida'));
        }
    }

    render();
    reconnectGraceTimer = setInterval(render, 500);
}

async function requestWakeLock(){
    if(!questionActive) return;
    if(!('wakeLock' in navigator)) return;
    if(wakeLock && !wakeLock.released) return;
    try{
        wakeLock = await navigator.wakeLock.request('screen');
        if(wakeLock && typeof wakeLock.addEventListener === 'function'){
            wakeLock.addEventListener('release', function(){
                if(wakeLock && wakeLock.released){
                    wakeLock = null;
                }
            });
        }
    }catch(e){}
}

function releaseWakeLock(){
    if(wakeLock){
        try{ wakeLock.release(); }catch(e){}
        wakeLock = null;
    }
}

function emitJoin(){
    var payload = Object.assign({}, params);
    if(token) payload.token = token;
    socket.emit('player-join-game', payload);
}

socket.on('connect', function() {
    persistJoinState();
    //Tell server that it is host connection from game view
    emitJoin();

    app.answersVisible = true;

    // Hide language switcher once in game view
    var langSw = document.getElementById('lang-switcher');
    if (langSw) langSw.style.display = 'none';

    resetTimer();
    clearReconnectGrace();
    if(questionActive){
        requestWakeLock();
    }
});

// NOTA: no registrar 'reconnect' — Socket.io ya dispara 'connect' al reconectar,
// registrar ambos causaría doble player-join-game al servidor.

socket.on('disconnect', function(){
    startReconnectGraceCountdown();
});

socket.on('playerGracePeriod', function(data){
    if(data && data.ms){
        saveReconnectGrace(data.ms);
    }
});

socket.on('hostReconnecting', function(){
    showMessage('Esperando reconexion del profesor...');
});

socket.on('hostReconnected', function(){
    if(!app.playerAnswered){
        hideMessage(true);
    }
});

socket.on('noGameFound', function(){
    window.location.href = '../../';//Redirect user to 'join game' page
});

function restoreAnswerControlsAfterReject(messageText){
    app.playerAnswered = false;
    app.answersVisible = true;
    app.answerStatusState = 'pending';
    showMessage(messageText || 'No se pudo enviar la respuesta. Intenta de nuevo.');
}

socket.on('tooManyAnswers', function(){
    restoreAnswerControlsAfterReject('Se han enviado demasiadas respuestas seguidas. Espera un instante y vuelve a probar.');
});

socket.on('answerRejected', function(){
    restoreAnswerControlsAfterReject('La pregunta ya no estaba activa. Vuelve a intentar en cuanto aparezca la siguiente.');
});

//Get results on last question
socket.on('answerResult', function(data){
    if(data === true || (data && data.outcome === 'correct')){
        correct = true;
    }else if(data && data.outcome){
        correct = data.outcome;
    }
});

function updatePlayerRank(playerData){
    if(!Array.isArray(playerData) || playerData.length === 0){
        app.rankText = '';
        return;
    }
    var sorted = playerData.slice().sort(function(a, b){
        return (b.gameData.score || 0) - (a.gameData.score || 0);
    });
    var position = sorted.findIndex(function(p){ return p.playerId === socket.id; });
    if(position !== -1 && position < 10){
        var label = window.i18nPlayer ? window.i18nPlayer.t('rank_top') : 'Top 10 - Puesto';
        app.rankText = label + ' ' + (position + 1);
    }else{
        app.rankText = window.i18nPlayer ? window.i18nPlayer.t('rank_out') : 'Fuera del Top 10';
    }
}

socket.on('questionOver', function(playerData, payload){
    EduhootTTS.cancel();
    questionActive = false;
    releaseWakeLock();
    setMedia(null, null);
    app.answersVisible = false;
    if(correct === 'poll' || (payload && payload.type === 'poll')){
        document.body.style.backgroundColor = '#607d8b';
        showMessage(tPlayer('poll_thanks', '¡Gracias por responder!'));
    }else if(correct === 'partial'){
        document.body.style.backgroundColor = '#ffb300';
        showMessage(tPlayer('partial', 'Respuesta parcialmente correcta: has sumado puntos.'));
    }else if(correct == true){
        document.body.style.backgroundColor = "#4CAF50";
        showMessage(window.i18nPlayer ? window.i18nPlayer.t('correct') : "Correct!");
    }else{
        document.body.style.backgroundColor = "#f94a1e";
        var incorrectMsg = window.i18nPlayer ? window.i18nPlayer.t('incorrect') : "Incorrect!";
        var correctLabel = window.i18nPlayer ? window.i18nPlayer.t('correct_answer') : "Correct answer:";
        var answerTxt = '';
        if(payload && (payload.type === 'short-answer' || payload.type === 'numeric')){
            if(payload.type === 'short-answer'){
                var accepted = Array.isArray(payload.acceptedAnswers) ? payload.acceptedAnswers : [];
                answerTxt = accepted.join(', ');
            }else{
                var n = (payload.numericAnswer !== undefined && payload.numericAnswer !== null) ? payload.numericAnswer : '';
                var tol = (payload.tolerance !== undefined && payload.tolerance !== null) ? payload.tolerance : 0;
                if(n !== ''){
                    if(Number(tol) > 0){
                        answerTxt = String(n) + ' ± ' + String(tol);
                    }else{
                        answerTxt = String(n);
                    }
                }
            }
        }else{
            var correctAnswers = (payload && Array.isArray(payload.correctAnswers)) ? payload.correctAnswers : [];
            var answerList = [];
            (correctAnswers || []).forEach(function(idx){
                if(lastAnswers && idx && lastAnswers[idx - 1]){
                    answerList.push(lastAnswers[idx - 1]);
                }
            });
            answerTxt = answerList.join(', ');
        }
        showMessage(incorrectMsg);
        if(answerTxt){
            app.messageDetailHtml = escapeHtml(correctLabel + ' ') + formatRichText(answerTxt);
        }
    }
    app.answerStatusState = '';
    updatePlayerRank(playerData);
    stopTimer();
    if(rankingTimeout){
        clearTimeout(rankingTimeout);
    }
    rankingTimeout = setTimeout(function(){
        showPlayerRanking(playerData);
    }, 3000);
    socket.emit('getScore');
});

socket.on('newScore', function(data){
    app.playerScore = data;
});

socket.on('nextQuestionPlayer', function(){
    correct = false;
    app.playerAnswered = false;
    if(rankingTimeout){
        clearTimeout(rankingTimeout);
        rankingTimeout = null;
    }
    app.questionType = 'quiz';
    app.multiSelections = [];
    app.answersVisible = true;

    hideMessage(false);
    document.body.style.backgroundColor = "white";
    app.rankText = '';
    app.hidePlayerRanking();
    stopTimer();
    resetTimer();
    app.answerStatusState = 'pending';
});

socket.on('hostDisconnect', function(){
    window.location.href = "../../";
});

socket.on('playerGameData', function(data){
   for(var i = 0; i < data.length; i++){
       if(data[i].playerId == socket.id){
           app.playerName = data[i].name;
           app.playerIcon = data[i].icon || '';
           app.playerScore = data[i].gameData.score;
       }
   }
});

socket.on('questionMedia', function(data){
    setMedia(data && data.image, data && data.video);
});

function clearQuestionCountdown(){
    if(questionCountdownTimer){
        clearInterval(questionCountdownTimer);
        questionCountdownTimer = null;
    }
    app.countdownVisible = false;
}

function showQuestionCountdown(data){
    clearQuestionCountdown();
    questionActive = false;
    releaseWakeLock();
    stopTimer();
    setMedia(null, null);
    app.playerAnswered = true;
    correct = false;
    app.questionType = 'quiz';
    app.pointsMultiplier = 1;
    app.multiSelections = [];
    app.answersVisible = false;

    var seconds = Math.max(0, Math.ceil(Number(data && data.seconds) || 0));
    app.questionText = '';
    showMessage('');
    app.answerStatusState = 'pending';
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

socket.on('playerQuestion', function(data){
    EduhootTTS.cancel();
    clearQuestionCountdown();
    questionActive = true;
    requestWakeLock();
    app.playerAnswered = false;
    correct = false;
    document.body.style.backgroundColor = "#FFFFFF";
    hideMessage(true);
    app.questionText = data.blind ? tPlayer('blind_hint', 'Mira la pantalla para ver la pregunta') : (data.question || '');
    app.pointsMultiplier = Number(data && data.pointsMultiplier) > 1 ? Number(data.pointsMultiplier) : 1;
    if(app.pointsMultiplier > 1) app.badgeKey += 1;
    app.questionType = data.type || 'quiz';
    app.multiSelections = [];
    app.freeAnswerValue = '';
    // updatePlayerAnswerButtons() original sempre tornava visibility='visible'
    // als 4 botons en pintar qualsevol pregunta (a cegues o no) — sense això,
    // la primera pregunta de cada partida es queda invisible (l'únic cas on
    // no hi ha un nextQuestionPlayer/connect previ que ja ho faça).
    app.answersVisible = true;
    if(data.blind){
        app.blind = true;
        app.blindActiveCount = Math.max(0, Number(data.answerCount) || 0);
        app.answers = [];
        lastAnswers = [];
    }else{
        app.blind = false;
        app.blindActiveCount = 0;
        app.answers = (data.answers || []).slice(0, 4);
        lastAnswers = (data.answers || []).slice(0, 4);
    }
    if(typeof data.time === 'number'){
        app.timerTotal = Math.max(5, Math.min(120, data.time));
    }else{
        app.timerTotal = 20;
    }
    resetTimer();
    if(!data.blind){
        setMedia(data.image, data.video);
    }

    if(data && (data.type === 'short-answer' || data.type === 'numeric')){
        Vue.nextTick(function(){
            try{ app.$refs.freeAnswerInput.focus(); }catch(e){}
        });
    }
});

socket.on('GameOver', function(){
    questionActive = false;
    releaseWakeLock();
    document.body.style.backgroundColor = "#FFFFFF";
    app.answersVisible = false;
    showMessage(window.i18nPlayer ? window.i18nPlayer.t('game_over') : "GAME OVER");
    app.pointsMultiplier = 1;
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
    var img = document.getElementById('playerQuestionImage');
    var vid = document.getElementById('playerQuestionVideo');
    var iframe = document.getElementById('playerQuestionIframe');
    if(img){
        if(imageUrl){
            img.src = normalizeSvgDataUrlForImg(imageUrl);
            img.style.display = 'block';
        }else{
            img.removeAttribute('src');
            img.style.display = 'none';
        }
    }
    if(vid && iframe){
        var ytId = parseYouTubeId(videoUrl);
        if(ytId){
            vid.removeAttribute('src');
            vid.pause();
            vid.style.display = 'none';
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + ytId;
            iframe.style.display = 'block';
        }else if(videoUrl){
            iframe.removeAttribute('src');
            iframe.style.display = 'none';
            vid.src = videoUrl;
            vid.style.display = 'block';
        }else{
            iframe.removeAttribute('src');
            iframe.style.display = 'none';
            vid.removeAttribute('src');
            vid.pause();
            vid.style.display = 'none';
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

socket.on('hostSkipped', function(){
    showMessage(window.i18nPlayer ? window.i18nPlayer.t('host_skipped') : 'El anfitrión saltó la pregunta');
});

function showPlayerRanking(playerData){
    var sorted = Array.isArray(playerData) ? playerData.slice().sort(function(a, b){
        return (b.gameData.score || 0) - (a.gameData.score || 0);
    }) : [];
    var top = sorted.slice(0, 10);
    var myId = socket.id;
    var youLabel = (window.i18nPlayer && window.i18nPlayer.t('player_ranking_you')) || 'You';
    if(youLabel === 'player_ranking_you') youLabel = 'You';
    app.rankingList = top.map(function(p){
        var icon = p.icon ? p.icon + ' ' : '';
        var meMark = p.playerId === myId ? ' (' + youLabel + ')' : '';
        return icon + p.name + ' - ' + (p.gameData.score || 0) + meMark;
    });
    app.rankingVisible = true;
}

socket.on('time', function(data){
    if(typeof data.time === 'number'){
        app.timerLeft = Math.max(0, Math.min(app.timerTotal, data.time));
    }
});

function resetTimer(){
    app.timerLeft = app.timerTotal;
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(function(){
        if(app.timerLeft > 0){
            app.timerLeft -= 1;
        }
    }, 1000);
}

function stopTimer(){
    if(timerInterval){
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

window.addEventListener('online', function(){
    if(!socket.connected){
        socket.connect();
        startReconnectGraceCountdown();
    }
});

window.addEventListener('offline', function(){
    startReconnectGraceCountdown();
});

document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible'){
        if(!socket.connected){
            socket.connect();
            startReconnectGraceCountdown();
        }
        if(questionActive){
            requestWakeLock();
        }
    }else{
        releaseWakeLock();
    }
});
