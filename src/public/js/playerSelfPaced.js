// Pantalla del alumnado en el modo autoritme (feature 3). El servidor lleva el reloj y la
// puntuación (sockets/selfPacedEvents.js); aquí solo se pinta la pregunta y se envía la respuesta.
// Eventos: spNext → spQuestion/spFinished; spAnswer → spResult; spTimeUp → spResult; spIdle (primera carga).
var socket = io({ reconnection: true, reconnectionAttempts: 30, reconnectionDelay: 500, reconnectionDelayMax: 3000 });
var token = null;
var lastAnswers = [];
var lastMatchAnswers = null;
var deadline = 0;
var tickTimer = null;
var timeUpTimer = null;
var leaveResetTimer = null;
var PARTIAL_COLOR = '#f57c00';
// Deures asíncrons (?hw=): el «socket» es un adaptador HTTP (js/homeworkTransport.js) y no hay anfitrión.
var isHomework = !!window.EDUHOOT_HOMEWORK;

function tPlayer(key, fallback){
    return window.i18nPlayer ? window.i18nPlayer.t(key) : (fallback || key);
}
function fmtPlayer(key, vars){
    return String(tPlayer(key)).replace(/\{(\w+)\}/g, function(_, k){
        return Object.prototype.hasOwnProperty.call(vars || {}, k) ? String(vars[k]) : '';
    });
}

var app = Vue.createApp({
    template: '#player-sp-tpl',
    mounted: function(){
        var self = this;
        EduhootTTS.watchAvailability(document.documentElement.lang, function(ok){ self.ttsReady = ok; });
    },
    watch: {
        // Al desaparecer el botón (respuesta o resultado) se para la lectura.
        ttsAvailable: function(ok){
            if(!ok){ EduhootTTS.cancel(); this.ttsSpeaking = false; }
        }
    },
    data: function(){
        return {
            // 'idle' | 'question' | 'result' | 'answered'
            state: 'idle',
            quizName: '',
            playerName: '',
            playerScore: 0,
            streak: 0,
            questionNumber: 0,
            totalQuestions: 0,
            questionText: '',
            questionType: 'quiz',
            answers: [],
            blind: false,
            blindActiveCount: 0,
            matchLeft: null,
            matchRight: null,
            matchLeftCount: 0,
            matchRightCount: 0,
            matchBlindStyle: 'codes',
            matchKey: 0,
            multiSelections: [],
            freeAnswerValue: '',
            timerLeft: 20,
            timerTotal: 20,
            message: '',
            result: { kind: 'info', message: '', detailHtml: '', points: 0, bonus: 0, ranking: null, rank: 0, players: 0 },
            done: false,
            closed: false,
            summary: { score: 0, correctCount: 0, total: 0, bestStreak: 0, rank: 0, players: 0 },
            leaveConfirming: false,
            ttsReady: false,
            ttsSpeaking: false,
            handRaised: false,
            // Deures: intento en curso (n de m).
            attemptNo: 0,
            maxAttempts: 1
        };
    },
    computed: {
        // «Intento 2 de 3», o «Último intento» cuando es el último; sin límite, solo el número; con un solo intento, nada.
        attemptText: function(){
            if(!isHomework || !this.attemptNo || this.maxAttempts === 1) return '';
            if(this.maxAttempts === 0) return fmtPlayer('hw_attempt', { n: this.attemptNo });
            var base = fmtPlayer('hw_attempt_of', { n: this.attemptNo, m: this.maxAttempts });
            return this.attemptNo >= this.maxAttempts ? base + ' · ' + tPlayer('hw_attempt_last') : base;
        },
        resultIcon: function(){
            var r = this.result;
            if(r.timeout) return '⏰';
            return { correct: '✅', partial: '👍', incorrect: '❌', poll: '🙏' }[r.kind] || '';
        },
        resultHint: function(){
            var r = this.result;
            return r.kind === 'incorrect' && !r.detailHtml && !r.timeout ? tPlayer('result_no_answer') : '';
        },
        donePct: function(){
            var s = this.summary;
            return s && s.total ? Math.round(100 * (Number(s.correctCount) || 0) / s.total) : 0;
        },
        nameDisplay: function(){ return this.t('name') + ' ' + this.playerName; },
        scoreDisplay: function(){ return this.t('score') + ' ' + this.playerScore; },
        progressText: function(){ return fmtPlayer('sp_question_of', { n: this.questionNumber, t: this.totalQuestions }); },
        isHomework: function(){ return isHomework; },
        isLast: function(){ return this.questionNumber >= this.totalQuestions; },
        questionHtml: function(){ return formatRichText(this.questionText); },
        freeAnswerType: function(){ return this.questionType === 'short-answer' || this.questionType === 'numeric'; },
        freePlaceholder: function(){
            return this.questionType === 'numeric' ? this.t('numeric_placeholder') : this.t('text_placeholder');
        },
        timerPct: function(){ return Math.max(0, Math.min(100, (this.timerLeft / this.timerTotal) * 100)); },
        timerColor: function(){
            var pct = this.timerPct;
            if(pct < 35) return 'linear-gradient(135deg, #f97316, #ef4444)';
            if(pct < 60) return 'linear-gradient(135deg, #facc15, #f97316)';
            return 'linear-gradient(135deg, #22c55e, #16a34a)';
        },
        ttsAvailable: function(){ return !this.blind && !!this.questionText && this.ttsReady && this.state === 'question'; },
        timerText: function(){ return Math.max(0, Math.ceil(this.timerLeft)) + 's'; }
    },
    methods: {
        t: function(key){ return tPlayer(key); },
        fmt: fmtPlayer,
        buttonVisible: function(i){
            if(this.questionType === 'matching' || this.freeAnswerType) return false;
            if(this.blind) return i < this.blindActiveCount;
            return !!(this.answers[i] && String(this.answers[i]).trim());
        },
        buttonHtml: function(i){ return this.blind ? '' : formatRichText(this.answers[i] || ''); },
        onAnswerClick: function(num){
            if(this.questionType === 'multiple'){
                var idx = this.multiSelections.indexOf(num);
                if(idx === -1) this.multiSelections.push(num); else this.multiSelections.splice(idx, 1);
                return;
            }
            this.send(num);
        },
        submitMulti: function(){ if(this.multiSelections.length) this.send(this.multiSelections.slice()); },
        submitFree: function(){
            var raw = String(this.freeAnswerValue || '');
            this.send(this.questionType === 'numeric' ? { number: raw } : { text: raw });
        },
        submitMatching: function(answers){ lastMatchAnswers = answers.slice(); this.send(answers); },
        send: function(payload){
            if(this.state !== 'question') return;
            // Se espera el resultado del servidor; si lo rechaza, se vuelve a la pregunta.
            this.state = 'answered-pending';
            socket.emit('spAnswer', payload);
        },
        next: function(){ socket.emit('spNext'); },
        // Deures con varios intentos: empieza otro; el servidor responde «spIdle» y se pide la primera pregunta.
        newAttempt: function(){ socket.emit('spNewAttempt'); },
        hwRecovery: function(){ return (window.EDUHOOT_HOMEWORK && window.EDUHOOT_HOMEWORK.recovery) || ''; },
        toggleHand: function(){
            this.handRaised = !this.handRaised;
            socket.emit('spHand', { raised: this.handRaised });
        },
        toggleSpeech: function(){
            var self = this;
            if(this.ttsSpeaking){ EduhootTTS.cancel(); this.ttsSpeaking = false; return; }
            this.ttsSpeaking = true;
            var started = EduhootTTS.speakParts([this.questionText].concat(this.answers || []), document.documentElement.lang, function(){
                self.ttsSpeaking = false;
            });
            if(!started) this.ttsSpeaking = false;
        },
        askLeave: function(){
            var self = this;
            if(!this.leaveConfirming){
                this.leaveConfirming = true;
                clearTimeout(leaveResetTimer);
                leaveResetTimer = setTimeout(function(){ self.leaveConfirming = false; }, 4000);
                return;
            }
            clearTimeout(leaveResetTimer);
            this.leaveConfirming = false;
            socket.emit('playerLeave');
        }
    }
}).component('matching-board', window.EduhootMatchingBoard).mount('#player-sp');

// ----- Parámetros y token (igual que en la pantalla en vivo) -----
var params = jQuery.deparam(window.location.search);
try{
  if(!isHomework){
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
  }
}catch(e){}
if(params.token){
    token = params.token;
}else{
    try{
        var tokens = JSON.parse(localStorage.getItem('playerTokens') || '{}');
        token = tokens[(params.pin || '') + ':' + (params.name || '')];
    }catch(e){}
}
function persistJoinState(){
    if(isHomework) return;
    try{
        localStorage.setItem('playerLastJoin', JSON.stringify({ pin: params.pin || '', name: params.name || '', token: token || '', icon: params.icon || '' }));
    }catch(e){}
}

// ----- Reloj de la pregunta: se calcula con la hora, no con ticks sueltos -----
function stopTick(){
    if(tickTimer){ clearInterval(tickTimer); tickTimer = null; }
    if(timeUpTimer){ clearInterval(timeUpTimer); timeUpTimer = null; }
}
function startTick(seconds){
    stopTick();
    deadline = Date.now() + seconds * 1000;
    app.timerLeft = seconds;
    tickTimer = setInterval(function(){
        app.timerLeft = Math.max(0, (deadline - Date.now()) / 1000);
        if(app.timerLeft <= 0 && !timeUpTimer){
            // El servidor decide: si aún no ha vencido en su reloj, se reintenta.
            socket.emit('spTimeUp');
            timeUpTimer = setInterval(function(){ socket.emit('spTimeUp'); }, 700);
        }
    }, 200);
}

// ----- Conexión -----
function emitJoin(){
    var payload = Object.assign({}, params);
    if(token) payload.token = token;
    socket.emit('player-join-game', payload);
}
socket.on('connect', function(){
    persistJoinState();
    emitJoin();
    var langSw = document.getElementById('lang-switcher');
    if(langSw) langSw.style.display = 'none';
    app.message = '';
});
socket.on('disconnect', function(){ app.message = tPlayer('reconnecting'); });
socket.on('noGameFound', function(){ window.location.href = '../../'; });
socket.on('hostDisconnect', function(){ app.message = tPlayer('reconnecting'); });
socket.on('playerLeft', function(){
    try{ localStorage.removeItem('playerLastJoin'); }catch(e){}
    socket.disconnect();
    window.location.href = '../../';
});
socket.on('kicked', function(){
    try{ localStorage.removeItem('playerLastJoin'); }catch(e){}
    socket.disconnect();
    app.message = tPlayer('reconnecting_kicked');
    setTimeout(function(){ window.location.href = '../../'; }, 2500);
});
socket.on('quizInfo', function(d){
    app.quizName = (d && d.quizName) ? String(d.quizName) : '';
    if(d && d.attemptNo){ app.attemptNo = Number(d.attemptNo) || 0; app.maxAttempts = d.maxAttempts === 0 ? 0 : (Number(d.maxAttempts) || 1); }
});
socket.on('playerGameData', function(data){
    for(var i = 0; i < data.length; i++){
        if(data[i].playerId === socket.id){
            app.playerName = data[i].name;
            app.playerScore = data[i].gameData.score;
            app.streak = Number(data[i].gameData.streak) || 0;
        }
    }
});
socket.on('questionMedia', function(d){ setMedia(d && d.image, d && d.video); });

// Primera carga: aún sin pregunta, se pide la primera.
socket.on('spIdle', function(){ socket.emit('spNext'); });

socket.on('spQuestion', function(d){
    stopTick();
    document.body.style.backgroundColor = '';
    app.done = false;
    app.message = '';
    app.questionNumber = d.questionNumber;
    app.totalQuestions = d.totalQuestions;
    app.questionType = d.type || 'quiz';
    app.questionText = d.blind ? tPlayer('blind_hint') : (d.question || '');
    app.multiSelections = [];
    app.freeAnswerValue = '';
    app.handRaised = !!d.hand;
    lastMatchAnswers = null;
    if(d.type === 'matching'){
        app.matchLeft = d.blind ? null : (d.matchLeft || []).slice();
        app.matchRight = d.blind ? null : (d.matchRight || []).slice();
        app.matchLeftCount = Number(d.leftCount) || 0;
        app.matchRightCount = Number(d.rightCount) || 0;
        app.matchBlindStyle = d.blindStyle || 'codes';
        app.matchKey += 1;
    }
    if(d.blind){
        app.blind = true;
        app.blindActiveCount = Math.max(0, Number(d.answerCount) || 0);
        app.answers = [];
        lastAnswers = [];
    }else{
        app.blind = false;
        app.blindActiveCount = 0;
        app.answers = (d.answers || []).slice(0, 4);
        lastAnswers = app.answers.slice();
    }
    app.timerTotal = Math.max(5, Number(d.timeTotal) || Number(d.time) || 20);
    app.state = 'question';
    startTick(Number(d.time) || app.timerTotal);
    if(!d.blind) setMedia(d.image, d.video);
    if(d.type === 'short-answer' || d.type === 'numeric'){
        Vue.nextTick(function(){ try{ app.$refs.freeAnswerInput.focus(); }catch(e){} });
    }
});

// Texto «Respuesta correcta: …» (solo si el anfitrión muestra respuestas: llega en meta).
function correctDetailHtml(meta){
    if(!meta) return '';
    if(meta.type === 'matching'){
        return Array.isArray(meta.matchSolution) && window.EduhootMatchingReview ? matchingReviewHtml(meta) : '';
    }
    var txt = '';
    if(meta.type === 'short-answer'){
        txt = (Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers : []).join(', ');
    }else if(meta.type === 'numeric'){
        if(meta.numericAnswer !== undefined && meta.numericAnswer !== null && meta.numericAnswer !== ''){
            txt = Number(meta.tolerance) > 0 ? meta.numericAnswer + ' ± ' + meta.tolerance : String(meta.numericAnswer);
        }
    }else{
        txt = (Array.isArray(meta.correctAnswers) ? meta.correctAnswers : [])
            .map(function(idx){ return lastAnswers[idx - 1]; }).filter(Boolean).join(', ');
    }
    return txt ? escapeHtml(tPlayer('correct_answer') + ' ') + formatRichText(txt) : '';
}
function matchingReviewHtml(meta){
    var rows = window.EduhootMatchingReview(meta, lastMatchAnswers);
    var html = '<span class="matching-review">';
    rows.forEach(function(row){
        html += '<span class="matching-review-row" data-ok="' + row.ok + '"><span aria-hidden="true">' + (row.ok ? '✓' : '✗') + '</span><span>' +
            '<b>' + escapeHtml(row.code + ' ' + row.left) + '</b> → ' +
            escapeHtml(row.chosen === null ? tPlayer('matching_unpaired') : row.chosen) +
            (row.ok ? '' : '<span class="matching-review-fix">' + escapeHtml(tPlayer('correct_answer') + ' ' + row.correct) + '</span>') +
            '</span></span>';
    });
    return html + '</span>';
}

socket.on('spResult', function(d){
    stopTick();
    EduhootTTS.cancel();
    setMedia(null, null);
    var kind = 'incorrect';
    var message = tPlayer('incorrect');
    var color = '#f94a1e';
    if(d.outcome === 'correct'){ kind = 'correct'; message = tPlayer('correct'); color = '#4CAF50'; }
    else if(d.outcome === 'partial'){ kind = 'partial'; message = tPlayer('partial'); color = PARTIAL_COLOR; }
    else if(d.outcome === 'poll'){ kind = 'poll'; message = tPlayer('poll_thanks'); color = '#607d8b'; }
    else if(d.outcome === 'timeout'){ message = tPlayer('sp_time_up'); }
    var detail = d.outcome === 'correct' || d.outcome === 'poll' ? '' : correctDetailHtml(d.meta);
    if(d.outcome === 'correct' && d.meta && d.meta.type === 'matching'){
        detail = fmtPlayer('matching_pairs_result', { h: (d.meta.matchLeft || []).length, t: (d.meta.matchLeft || []).length });
        detail = '<span class="matching-pairs">' + escapeHtml(detail) + '</span>';
    }
    document.body.style.backgroundColor = color;
    app.result = { kind: kind, timeout: d.outcome === 'timeout', message: message, detailHtml: detail, points: Number(d.points) || 0, bonus: Number(d.bonus) || 0,
        ranking: Array.isArray(d.ranking) ? d.ranking : null, rank: Number(d.rank) || 0, players: Number(d.players) || 0 };
    app.playerScore = d.score;
    app.streak = Number(d.streak) || 0;
    app.questionNumber = d.questionNumber;
    app.totalQuestions = d.totalQuestions;
    app.state = 'result';
});

// Reconexión: pregunta ya contestada y sin resultado a la vista.
socket.on('spAnswered', function(d){
    stopTick();
    document.body.style.backgroundColor = '';
    app.questionNumber = d.questionNumber;
    app.totalQuestions = d.totalQuestions;
    app.state = 'answered';
});

socket.on('answerRejected', function(){
    // Rechazada (p. ej. por demasiadas seguidas): se vuelve a la pregunta mientras quede tiempo.
    if(app.state === 'answered-pending') app.state = 'question';
});
socket.on('tooManyAnswers', function(){
    if(app.state === 'answered-pending') app.state = 'question';
});

socket.on('spFinished', function(d){
    stopTick();
    setMedia(null, null);
    document.body.style.backgroundColor = '';
    app.summary = d;
    app.playerScore = d.score;
    app.done = true;
});
// Cierre por el anfitrión (llega después de spFinished): solo cambia el aviso.
socket.on('GameOver', function(){
    stopTick();
    app.closed = true;
});
