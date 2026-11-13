// Partida del modo individual: preguntas, respuestas, temporizador y puntuación, extraído de solo.js
function startQuiz(){
        ensureSoloMusicPlaying();
        if(!state.quizData || !Array.isArray(state.quizData.questions) || !state.quizData.questions.length){
            alert(t('startError'));
            return;
        }
        document.body.classList.add('playing');
        state.idx = 0;
        state.score = 0;
        state.correct = 0;
        state.locked = false;
        var desiredCount = getDesiredQuestionCount();
        state.desiredQuestionCount = desiredCount;
        var randomized = randomizeQuestions(state.quizData.questions || []);
        if(desiredCount > 0 && desiredCount < randomized.length){
            state.questions = randomized.slice(0, desiredCount);
        }else{
            state.questions = randomized;
        }
        var cleanName = state.nameInput ? normalizeName(state.nameInput) : '';
        // Si se entró desde Commons, el código público es el nombre por defecto.
        state.playerName = cleanName || state.commonsPublicCode || t('namePlaceholder');
        state.nameInput = cleanName;
        state.view = 'game';
        renderQuestion();
    }

    function renderQuestion(){
        var questions = getQuestions();
        if(state.idx >= questions.length){
            finishQuiz();
            return;
        }
        state.locked = false;
        var q = questions[state.idx];
        var meta = normalizeQuestionMeta(q);
        state.multiSelections = [];
        state.marks = { correct: [], wrong: [] };
        state.freeText = '';
        state.feedback = { text: '', kind: '' };
        var time = (typeof state.desiredQuestionTime === 'number' && state.desiredQuestionTime > 0)
            ? state.desiredQuestionTime
            : ((typeof q.time === 'number' && q.time > 0) ? q.time : 20);
        state.timerTotal = Math.max(5, Math.min(120, time));
        state.timerLeft = state.timerTotal;
        // Compte arrere 3-2-1 (com en «Jugar a l'aula»): la pregunta, les
        // respostes i el temporitzador no comencen fins que acaba.
        state.locked = true;
        runCountdown(SOLO_COUNTDOWN_SECONDS, function(){
            state.locked = false;
            startTimer(time);
            if(meta.type === 'short-answer' || meta.type === 'numeric'){
                setTimeout(function(){
                    var input = document.getElementById('solo-free-input');
                    try{ if(input) input.focus(); }catch(e){}
                }, 50);
            }
        });
    }

    var SOLO_COUNTDOWN_SECONDS = 3;
    var countdownTimer = null;

    function runCountdown(seconds, done){
        stopCountdown();
        state.countdown = seconds;
        countdownTimer = setInterval(function(){
            state.countdown -= 1;
            if(state.countdown <= 0){
                stopCountdown();
                if(state.view === 'game') done();
            }
        }, 1000);
    }

    function stopCountdown(){
        if(countdownTimer){
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
        state.countdown = 0;
    }

    // Lo que se muestra de la pregunta actual (texto, medios, respuestas); lo
    // lee la plantilla de Vue.
    function currentQuestion(){
        if(state.view !== 'game') return null;
        return getQuestions()[state.idx] || null;
    }

    function mediaFor(q){
        var media = { image: '', youtube: '', video: '' };
        if(!q) return media;
        if(q.image) media.image = normalizeSvgDataUrlForImg(q.image);
        var ytId = parseYouTubeId(q.video);
        if(ytId) media.youtube = 'https://www.youtube-nocookie.com/embed/' + ytId;
        else if(q.video) media.video = q.video;
        return media;
    }

    function parseYouTubeId(url){
        if(!url) return null;
        try{
            var u = new URL(url);
            if(u.hostname.includes('youtu.be')){
                return u.pathname.replace('/','');
            }
            if(u.hostname.includes('youtube.com')){
                if(u.searchParams.get('v')) return u.searchParams.get('v');
                var parts = u.pathname.split('/');
                var last = parts[parts.length-1];
                if(last) return last;
            }
        }catch(e){}
        return null;
    }

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

        // Caso ya URL-encoded: recortar cualquier sufijo tras </svg>
        if(/%[0-9a-fA-F]{2}/.test(payload)){
            var lp = payload.toLowerCase();
            var endEnc = '%3c%2fsvg%3e';
            var posEnc = lp.lastIndexOf(endEnc);
            if(posEnc !== -1) return header + payload.slice(0, posEnc + endEnc.length);
            return raw;
        }

        // Caso raw: recortar tras </svg> y luego URL-encode
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



    function submitSoloFreeAnswer(){
        if(state.locked) return;
        var questions = getQuestions();
        var q = questions[state.idx];
        if(!q) return;
        var meta = normalizeQuestionMeta(q);
        if(meta.type !== 'short-answer' && meta.type !== 'numeric') return;
        answerQuestion((state.freeText || '').toString(), false);
    }



    function toggleSoloMultiSelection(choice){
        if(state.locked) return;
        var questions = getQuestions();
        var q = questions[state.idx];
        if(!q) return;
        if(normalizeQuestionMeta(q).type !== 'multiple') return;
        var idx = state.multiSelections.indexOf(choice);
        if(idx === -1){
            state.multiSelections.push(choice);
        }else{
            state.multiSelections.splice(idx, 1);
        }
    }

    function handleSoloAnswerInteraction(choice){
        var questions = getQuestions();
        var q = questions[state.idx];
        if(!q) return;
        if(normalizeQuestionMeta(q).type === 'multiple'){
            toggleSoloMultiSelection(choice);
            return;
        }
        answerQuestion(choice);
    }

    function submitSoloMultiAnswers(){
        if(state.locked) return;
        if(!Array.isArray(state.multiSelections) || !state.multiSelections.length) return;
        answerQuestion(state.multiSelections.slice());
    }

    function startTimer(seconds){
        state.timerTotal = Math.max(5, Math.min(120, seconds));
        state.timerLeft = state.timerTotal;
        if(state.timer) clearInterval(state.timer);
        state.timer = setInterval(function(){
            state.timerLeft = Math.max(0, state.timerLeft - 0.1);
            if(state.timerLeft <= 0){
                clearInterval(state.timer);
                state.timer = null;
                answerQuestion(null, true);
            }
        }, 100);
    }

    function stopTimer(){
        if(state.timer){
            clearInterval(state.timer);
            state.timer = null;
        }
    }



    function answerQuestion(choice, timedOut){
        if(state.locked) return;
        state.locked = true;
        stopTimer();
        var questions = getQuestions();
        var q = questions[state.idx];
        var meta = normalizeQuestionMeta(q);

        var isCorrect = false;
        var scoreRatio = 0;
        var correctAnswerText = '';

        if(meta.type === 'short-answer'){
            var rawText = timedOut ? '' : (typeof choice === 'string' ? choice : String(choice || ''));
            var normalized = normalizeFreeText(rawText);
            var accepted = Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers : splitAcceptedAnswers(meta.acceptedAnswers);
            isCorrect = !!normalized && accepted.some(function(ans){ return normalizeFreeText(ans) === normalized; });
            scoreRatio = isCorrect ? 1 : 0;
            correctAnswerText = accepted.join(', ');
        }else if(meta.type === 'numeric'){
            var rawNum = timedOut ? '' : (typeof choice === 'string' ? choice : String(choice || ''));
            var num = parseLenientNumber(rawNum);
            var target = (typeof meta.numericAnswer === 'number') ? meta.numericAnswer : parseLenientNumber(meta.numericAnswer);
            var tol = (typeof meta.tolerance === 'number') ? meta.tolerance : (parseLenientNumber(meta.tolerance) || 0);
            if(num !== null && target !== null){
                isCorrect = Math.abs(num - target) <= Math.max(0, tol);
            }else{
                isCorrect = false;
            }
            scoreRatio = isCorrect ? 1 : 0;
            if(target !== null){
                correctAnswerText = (tol && tol > 0) ? (String(target) + ' ± ' + String(tol)) : String(target);
            }
        }else{
            var selected = [];
            if(timedOut){
                selected = [];
            }else if(Array.isArray(choice)){
                selected = choice.slice();
            }else if(choice !== null && typeof choice !== 'undefined'){
                selected = [choice];
            }
            var correctList = meta.type === 'poll' ? [] : (Array.isArray(meta.correctAnswers) && meta.correctAnswers.length ? meta.correctAnswers : [(parseInt(q.correct, 10) || 1)]);
            if(meta.type === 'poll'){
                isCorrect = false;
            }else if(meta.type === 'multiple'){
                isCorrect = areAnswerSetsEqual(selected, correctList);
                var hits = correctList.filter(function(answer){ return selected.indexOf(answer) !== -1; }).length;
                var wrongs = selected.length - hits;
                scoreRatio = correctList.length ? Math.max(0, hits - wrongs) / correctList.length : 0;
            }else{
                isCorrect = selected.length && selected[0] === (meta.correct || correctList[0] || 1);
                scoreRatio = isCorrect ? 1 : 0;
            }

            state.marks = {
                correct: correctList.slice(),
                wrong: meta.type === 'poll' ? [] : selected.filter(function(n){ return correctList.indexOf(n) === -1; })
            };

            if(Array.isArray(q.answers)){
                var list = [];
                correctList.forEach(function(idx){
                    if(idx && q.answers[idx - 1]){
                        list.push(q.answers[idx - 1]);
                    }
                });
                correctAnswerText = list.join(', ');
            }
        }

        if(meta.type === 'poll'){
            scoreRatio = 0;
        }else if(meta.type === 'multiple' && scoreRatio === 1){
            isCorrect = true;
        }
        if(scoreRatio > 0){
            state.correct += 1;
            var bonus = Math.round(1000 * Math.max(0, Math.min(1, state.timerLeft / state.timerTotal)));
            state.score += Math.round(bonus * scoreRatio);
        }
        if(timedOut){
            state.feedback = { text: t('timeup'), kind: 'muted' };
        }else if(meta.type === 'poll'){
            state.feedback = { text: t('pollThanks'), kind: 'muted' };
        }else if(isCorrect){
            state.feedback = { text: t('correctText'), kind: 'success' };
        }else if(meta.type === 'multiple' && scoreRatio > 0){
            state.feedback = { text: t('partialText'), kind: 'success' };
        }else{
            var label = t('correctLabel');
            state.feedback = {
                text: correctAnswerText
                    ? t('wrongText') + ' · ' + (label === 'correctLabel' ? '' : label + ' ') + correctAnswerText
                    : t('wrongText'),
                kind: 'error'
            };
        }
        state.multiSelections = [];
        state.lastWrong = null;
        if(isCorrect || meta.type === 'poll'){
            setTimeout(function(){
                state.idx += 1;
                renderQuestion();
            }, 1200);
            return;
        }
        state.awaitingConfirm = true;
        state.lastWrong = {
            correct: Array.isArray(meta.correctAnswers) ? meta.correctAnswers : [1],
            correctText: correctAnswerText,
            question: q.question || ''
        };
        showFeedbackModal();
    }

    function finishQuiz(){
        stopTimer();
        var totalQs = getScoredQuestionCount();
        state.result = {
            correct: state.correct,
            total: totalQs,
            score: state.score,
            polls: getQuestions().length - totalQs
        };
        state.view = 'result';
        state.rankingBox = { visible: false, items: [] };
        if(totalQs > 0) prepareScoreSubmission();
    }

    function getScoredQuestionCount(){
        return getQuestions().filter(function(question){
            return normalizeQuestionMeta(question).type !== 'poll';
        }).length;
    }

// Parte del panel de juego de la app de Vue de /solo/ (Subfase B, bloque 2):
// formulario de inicio, pregunta, respuestas, resultado y los tres modales.
var soloPlay = {
    computed: {
        titleText: function(){
            return this.s.title.text || this.t(this.s.title.key);
        },
        selectedMeta: function(){
            var quiz = this.s.quizData;
            if(!quiz) return this.t('startSelect');
            var count = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
            var tags = Array.isArray(quiz.tags) ? quiz.tags.join(', ') : (Array.isArray(quiz.questionsTags) ? quiz.questionsTags.join(', ') : '');
            return format(this.t('selectedMeta'), { count: count, tags: tags || '—' });
        },
        quizTotal: function(){
            var quiz = this.s.quizData;
            return quiz && Array.isArray(quiz.questions) ? quiz.questions.length : 0;
        },
        question: function(){
            return currentQuestion();
        },
        meta: function(){
            return this.question ? normalizeQuestionMeta(this.question) : { type: 'quiz' };
        },
        isFree: function(){
            return this.meta.type === 'short-answer' || this.meta.type === 'numeric';
        },
        answers: function(){
            return this.question && !this.isFree ? getVisibleAnswers(this.question, this.meta.type) : [];
        },
        media: function(){
            return mediaFor(this.question);
        },
        hasMedia: function(){
            return !!(this.media.image || this.media.youtube || this.media.video);
        },
        // Barra de temps: mateix percentatge i colors que en «Jugar a l'aula».
        timerPct: function(){
            var total = this.s.timerTotal || 1;
            return Math.max(0, Math.min(100, (this.s.timerLeft / total) * 100));
        },
        timerColor: function(){
            var pct = this.timerPct;
            if(pct < 35) return 'linear-gradient(135deg, #f97316, #ef4444)';
            if(pct < 60) return 'linear-gradient(135deg, #facc15, #f97316)';
            return 'linear-gradient(135deg, #22c55e, #16a34a)';
        },
        progressText: function(){
            var total = getQuestions().length;
            return format(this.t('questionOf'), { current: this.s.idx + 1, total: total });
        },
        showMultiSubmit: function(){
            return this.meta.type === 'multiple' && !this.s.locked;
        },
        resultSummary: function(){
            var r = this.s.result;
            var scored = r.total ? format(this.t('resultSummary'), { correct: r.correct, total: r.total, score: r.score }) : '';
            var polls = r.polls ? format(this.t('pollSummary'), { total: r.polls }) : '';
            return [scored, polls].filter(Boolean).join(' · ');
        },
        feedbackBody: function(){
            var label = this.t('correctLabel');
            var text = this.s.lastWrong ? (this.s.lastWrong.correctText || '') : '';
            return (label === 'correctLabel' ? '' : label + ' ') + text;
        }
    },
    methods: {
        answerClass: function(n){
            return {
                correct: this.s.marks.correct.indexOf(n) !== -1,
                wrong: this.s.marks.wrong.indexOf(n) !== -1,
                'multi-selected': this.s.multiSelections.indexOf(n) !== -1
            };
        },
        itemText: function(item){
            if(item.row) return (item.row.playerName || this.t('namePlaceholder')) + ' — ' + (item.row.score || 0) + ' ' + this.t('scoreLabel');
            return item.text || this.t(item.key);
        },
        onCountInput: function(ev){
            var total = getQuizTotalQuestions();
            if(total <= 0) return;
            var v = clampInt(ev.target.value, 1, total);
            if(v == null) return;
            this.s.countInput = ev.target.value = String(v);
            this.s.desiredQuestionCount = v;
        },
        onTimeInput: function(ev){
            if(!ev.target.value){
                this.s.timeInput = '';
                this.s.desiredQuestionTime = null;
                return;
            }
            var v = clampInt(ev.target.value, 5, 120);
            if(v == null) return;
            this.s.timeInput = ev.target.value = String(v);
            this.s.desiredQuestionTime = v;
        },
        onNameInput: function(ev){
            this.s.nameInput = ev.target.value = normalizeName(ev.target.value);
        },
        start: function(){ startQuiz(); },
        playAgain: function(){ if(this.s.quizData) startQuiz(); },
        pickAnother: function(){ resetSelection(); },
        answer: function(n){ handleSoloAnswerInteraction(n); },
        submitFree: function(){ submitSoloFreeAnswer(); },
        submitMulti: function(){ submitSoloMultiAnswers(); },
        closeFeedback: function(){ hideFeedbackModal(); },
        closeRanking: function(){ hideRankingModal(); },
        saveName: function(){ saveNameAndSubmit(); },
        skipName: function(){ skipNameAndSubmit(); }
    }
};
