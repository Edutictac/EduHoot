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
        state.streak = 0;
        state.streakBonus = 0;
        state.locked = false;
        // Mode fantasma: la millor marca d'este qüestionari (null si no n'hi ha o si el quiz ha canviat).
        state.runOrigs = [];
        state.runPoints = {};
        state.ghostDiff = null;
        state.ghost = state.ghostEnabled && window.EduhootGhost && state.quizData
            ? EduhootGhost.loadGhost(ghostStorage(), state.quizData.id, EduhootGhost.fingerprint(state.quizData.questions))
            : null;
        var desiredCount = getDesiredQuestionCount();
        state.desiredQuestionCount = desiredCount;
        var randomized = randomizeQuestions(state.quizData.questions || [], state.shuffleQuestions);
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
    // Lectura en veu alta: la pregunta anterior no es llig sobre la nova.
    EduhootTTS.cancel();
    state.ttsSpeaking = false;
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
        time = Math.max(5, Math.min(120, time));
        // Correspondencia: más margen (+25/50/75/100 %), elegido por el alumno.
        // Preguntas compuestas (correspondencia y ordenar): más margen, elegido por el alumno.
        if(meta.type === 'matching' || meta.type === 'order'){
            time = Math.round(time * (1 + (state.matchingExtraTime || 0) / 100));
        }
        state.timerTotal = time;
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
    var countdownDone = null;

    function runCountdown(seconds, done){
        stopCountdown();
        countdownDone = done;
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
        state.timerTotal = Math.max(5, Math.min(240, seconds));
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

    // Sigue contando desde el tiempo que quedaba (tras una pausa).
    function resumeTimer(){
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

    // Pausa: se puede mientras corre el tiempo de una pregunta o la cuenta atrás.
    // La pregunta se tapa (no se puede leer ni responder) y el tiempo se congela.
    function canPauseSolo(){
        return state.view === 'game' && !state.paused && (!!state.timer || state.countdown > 0);
    }

    // «Pasar»: salta a la siguiente pregunta sin responder (no suma puntos ni aciertos y corta la racha).
    // Se puede mientras corre el tiempo o la cuenta atrás; no con la partida en pausa.
    function canSkipSolo(){
        return state.view === 'game' && !state.paused && !state.feedbackModalOpen && (!!state.timer || state.countdown > 0);
    }

    function skipQuestion(){
        if(!canSkipSolo()) return;
        stopTimer();
        stopCountdown();
        var q = getQuestions()[state.idx];
        if(normalizeQuestionMeta(q).type !== 'poll') state.streak = 0;
        state.streakBonus = 0;
        state.locked = true;
        state.idx += 1;
        renderQuestion();
    }

    var pausedCountdown = 0;
    var musicWasPlaying = false;
    function pauseSolo(){
        if(!canPauseSolo()) return;
        // La música de fondo también se pausa; al reanudar vuelve solo si sonaba.
        musicWasPlaying = !!(soloMusicPlayerInstance && soloMusicPlayerInstance.audio && !soloMusicPlayerInstance.audio.paused);
        pauseSoloMusic();
        EduhootTTS.cancel();
        state.ttsSpeaking = false;
        if(state.countdown > 0){
            pausedCountdown = state.countdown;
            if(countdownTimer){
                clearInterval(countdownTimer);
                countdownTimer = null;
            }
        }else{
            pausedCountdown = 0;
            stopTimer();
        }
        state.paused = true;
    }

    function resumeSolo(){
        if(!state.paused) return;
        state.paused = false;
        if(musicWasPlaying){
            musicWasPlaying = false;
            ensureSoloMusicPlaying();
        }
        if(pausedCountdown > 0){
            var seconds = pausedCountdown;
            pausedCountdown = 0;
            runCountdown(seconds, countdownDone);
        }else{
            resumeTimer();
        }
    }

    // Cancelar la partida: primer toque pide confirmación unos segundos; el segundo
    // la termina sin guardar la puntuación y vuelve al formulario del quiz.
    var cancelResetTimer = null;
    function askCancelSolo(){
        if(!state.cancelConfirming){
            state.cancelConfirming = true;
            clearTimeout(cancelResetTimer);
            cancelResetTimer = setTimeout(function(){ state.cancelConfirming = false; }, 4000);
            return;
        }
        clearTimeout(cancelResetTimer);
        cancelSolo();
    }

    function cancelSolo(){
        state.cancelConfirming = false;
        state.paused = false;
        pausedCountdown = 0;
        musicWasPlaying = false;
        pauseSoloMusic();
        stopTimer();
        stopCountdown();
        EduhootTTS.cancel();
        state.ttsSpeaking = false;
        clearFeedbackTimer();
        state.feedbackModalOpen = false;
        state.awaitingConfirm = false;
        state.lastResult = null;
        state.locked = false;
        state.multiSelections = [];
        state.feedback = { text: '', kind: '' };
        state.questions = [];
        state.idx = 0;
        // El formulario del quiz también se ve en modo «playing»: no se quita.
        state.view = 'start';
    }



    function answerQuestion(choice, timedOut){
        if(state.locked) return;
        state.locked = true;
        var scoreBefore = state.score;
        stopTimer();
        var questions = getQuestions();
        var q = questions[state.idx];
        var meta = normalizeQuestionMeta(q);

        var isCorrect = false;
        var scoreRatio = 0;
        var correctAnswerText = '';

        if(meta.type === 'matching'){
            // Proporcional: cada pareja acertada suma; las mal hechas no restan.
            var solution = meta.matchSolution || [];
            var matchResult = EduhootMatching.score(solution, timedOut ? [] : choice);
            scoreRatio = matchResult.ratio;
            isCorrect = matchResult.total > 0 && matchResult.hits === matchResult.total;
            correctAnswerText = solution.map(function(r, i){
                return (i + 1) + ' ' + meta.matchLeft[i] + ' → ' + (meta.matchRight[r] || '');
            }).join(' · ');
            state.lastMatchHits = { hits: matchResult.hits, total: matchResult.total };
        }else if(meta.type === 'order'){
            // Proporcional, com la correspondència: el mode de puntuació el marca la pregunta.
            scoreRatio = timedOut ? 0 : EduhootOrder.scoreRatio(meta, choice);
            isCorrect = scoreRatio === 1;
            correctAnswerText = meta.items.map(function(text, i){ return (i + 1) + ' ' + text; }).join(' · ');
        }else if(meta.type === 'short-answer'){
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
                correct: state.showAnswers ? correctList.slice() : [],
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
        // Racha de aciertos (feature 11). Misma regla que el servidor (server/services/scoring.js):
        // acierto completo suma 1 a la racha; cualquier otro resultado la reinicia; una encuesta no la cambia.
        state.streakBonus = 0;
        if(meta.type !== 'poll'){
            state.streak = isCorrect ? (state.streak || 0) + 1 : 0;
            if(isCorrect && state.streak >= 3){
                state.streakBonus = Math.min(250, (state.streak - 2) * 50);
                state.score += state.streakBonus;
            }
        }
        if(timedOut){
            state.feedback = { text: t('timeup'), kind: 'muted' };
        }else if(meta.type === 'poll'){
            state.feedback = { text: t('pollThanks'), kind: 'muted' };
        }else if(isCorrect){
            state.feedback = { text: t('correctText'), kind: 'success' };
        }else if((meta.type === 'multiple' || meta.type === 'matching' || meta.type === 'order') && scoreRatio > 0){
            var partialText = t('partialText');
            if(meta.type === 'matching'){
                partialText += ' · ' + format(t('matchingPairsResult'), state.lastMatchHits);
            }
            state.feedback = { text: partialText, kind: 'partial' };
        }else{
            var label = t('correctLabel');
            state.feedback = {
                text: correctAnswerText
                    ? t('wrongText') + ' · ' + (label === 'correctLabel' ? '' : label + ' ') + correctAnswerText
                    : t('wrongText'),
                kind: 'error'
            };
        }
        // «Mostrar respuestas» desmarcado: no se revela cuál era la correcta.
        if(!state.showAnswers && state.feedback.kind === 'error'){
            state.feedback = { text: t('wrongText'), kind: 'error' };
            correctAnswerText = '';
        }
        // Mode fantasma: els punts d'esta pregunta i la diferència amb la marca (les enquestes no puntuen).
        if(meta.type !== 'poll' && state.ghostEnabled && window.EduhootGhost){
            state.runOrigs.push(q.origIdx);
            state.runPoints[q.origIdx] = state.score - scoreBefore;
            state.ghostDiff = EduhootGhost.diffFor(state.ghost, state.runOrigs, state.score);
        }
        state.multiSelections = [];
        state.lastResult = null;
        if(meta.type === 'poll'){
            var runAt = state.questions;
            setTimeout(function(){
                // Si se ha cancelado la partida mientras tanto, no se sigue.
                if(state.view !== 'game' || state.questions !== runAt) return;
                state.idx += 1;
                renderQuestion();
            }, 1200);
            return;
        }
        // Acierto, acierto parcial o fallo: ventana de resultado en el centro; al cerrarse (sola o con OK) sigue la partida.
        state.awaitingConfirm = true;
        state.lastResult = {
            kind: isCorrect ? 'correct' : (scoreRatio > 0 ? 'partial' : 'wrong'),
            partial: !isCorrect && scoreRatio > 0,
            correct: Array.isArray(meta.correctAnswers) ? meta.correctAnswers : [1],
            correctText: correctAnswerText,
            question: q.question || ''
        };
        showFeedbackModal();
    }

    function ghostResultText(ghost, t){
        if(ghost.newBest) return t('ghostNewBest');
        return format(t('ghostBest'), { score: ghost.best, diff: EduhootGhost.signed(ghost.diff) });
    }

    // localStorage del navegador (la marca es perd si s'esborra; no es guarda res al servidor).
    function ghostStorage(){
        try{
            return window.localStorage;
        }catch(e){
            return null;
        }
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
        if(totalQs > 0 && state.ghostEnabled && window.EduhootGhost){
            var newBest = EduhootGhost.saveGhost(ghostStorage(), state.quizData.id,
                EduhootGhost.fingerprint(state.quizData.questions), state.score, state.runPoints);
            state.result.ghost = state.ghost
                ? { best: state.ghost.total, diff: state.score - state.ghost.total, newBest: newBest }
                : { best: state.score, diff: 0, newBest: true };
        }
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
        // Imagen representativa del quiz: la misma de su tarjeta; si no hay, la portada o la primera pregunta con imagen.
        quizImage: function(){
            var quiz = this.s.quizData;
            if(!quiz) return '';
            var th = this.s.thumbs[String(quiz.id)];
            if(th && th.src && !th.fallback) return th.src;
            var direct = mediaThumb(quiz.coverImage || quiz.coverVideo);
            if(direct) return direct;
            var questions = Array.isArray(quiz.questions) ? quiz.questions : [];
            for(var i = 0; i < questions.length; i++){
                var q = questions[i];
                if(q && (q.image || q.video)) return mediaThumb(q.image || q.video);
            }
            return '';
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
        // Preguntas compuestas (correspondencia y ordenar): el selector de tiempo extra es visible si n'hi ha.
        hasComposite: function(){
            return (this.s.quizData && Array.isArray(this.s.quizData.questions) ? this.s.quizData.questions : [])
                .some(function(q){ return q && (q.type === 'matching' || q.type === 'order'); });
        },
        showMatching: function(){
            return this.meta.type === 'matching' && !this.s.locked && !(this.s.countdown > 0);
        },
        showOrder: function(){
            return this.meta.type === 'order' && !this.s.locked && !(this.s.countdown > 0);
        },
        feedbackLeftSec: function(){
            return Math.ceil((this.s.feedbackLeftMs || 0) / 1000);
        },
        feedbackBarWidth: function(){
            var total = (this.s.feedbackSeconds || 5) * 1000;
            return Math.max(0, Math.min(100, 100 * (this.s.feedbackLeftMs || 0) / total)) + '%';
        },
        feedbackKind: function(){
            return this.s.lastResult ? this.s.lastResult.kind : 'wrong';
        },
        feedbackIcon: function(){
            return { correct: '✓', partial: '◐', wrong: '✕' }[this.feedbackKind] || '✕';
        },
        feedbackTitle: function(){
            if(this.feedbackKind === 'correct') return this.t('correctText');
            return this.feedbackKind === 'partial' ? this.t('partialTitle') : this.t('wrongText');
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
        // Lectura en veu alta (proposta 13). Només amb la pregunta visible.
        ttsAvailable: function(){
            // Només mentre la pregunta està en pantalla: ni durant la cuenta
            // atrás (locked i countdown) ni després de contestar (locked).
            return !!(this.question && this.question.question) && !!this.s.ttsReady && !this.s.locked && !(this.s.countdown > 0);
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
        canPause: function(){
            return this.s.paused || canPauseSolo();
        },
        canSkip: function(){
            return canSkipSolo();
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
        // Mode fantasma: la marca al resum final (en el seu propi paragraf, sense canviar el resum).
        resultGhostText: function(){
            var r = this.s.result;
            return r && r.ghost ? ghostResultText(r.ghost, this.t) : '';
        },
        // Mode fantasma: diferència amb la millor marca, després de cada pregunta puntuada.
        ghostDiffText: function(){
            var d = this.s.ghostDiff;
            if(!this.s.ghost || d === null || d === undefined || !this.s.lastResult) return '';
            return format(this.t('ghostDiff'), { diff: EduhootGhost.signed(d) });
        },
        feedbackBody: function(){
            var label = this.t('correctLabel');
            var text = this.s.lastResult ? (this.s.lastResult.correctText || '') : '';
            // Sin respuesta que mostrar («Mostrar respuestas» desmarcado), tampoco la etiqueta.
            if(!text) return '';
            return (label === 'correctLabel' ? '' : label + ' ') + text;
        }
    },
    methods: {
        toggleSpeech: function(){
            if(this.s.ttsSpeaking){
                EduhootTTS.cancel();
                this.s.ttsSpeaking = false;
                return;
            }
            if(!this.question) return;
            var parts = [this.question.question || ''].concat(this.answers || []);
            this.s.ttsSpeaking = true;
            var started = EduhootTTS.speakParts(parts, document.documentElement.lang, function(){
                state.ttsSpeaking = false;
                unduckSoloMusic();
            });
            if(started){
                duckSoloMusic();
            } else {
                this.s.ttsSpeaking = false;
            }
        },
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
        onFeedbackSecondsInput: function(ev){
            var v = clampInt(ev.target.value, 1, 30);
            if(v == null) return;
            this.s.feedbackSecondsInput = ev.target.value = String(v);
            this.s.feedbackSeconds = v;
            try{ localStorage.setItem('eduhoot-solo-feedback-seconds', String(v)); }catch(e){}
        },
        onMatchingExtra: function(ev){
            this.s.matchingExtraTime = parseInt(ev.target.value, 10) || 50;
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
        togglePause: function(){ if(this.s.paused) resumeSolo(); else pauseSolo(); },
        askCancel: function(){ askCancelSolo(); },
        submitMatching: function(answers){ answerQuestion(answers); },
        submitOrder: function(order){ answerQuestion(order); },
        // Textos del tablero de correspondencia (matchingBoard.js) con el diccionario de /solo/.
        boardT: function(key){
            var map = { matching_hint: 'matchingHint', matching_count: 'matchingCount', submit_free: 'submitFreeAnswer', order_board_label: 'orderBoardLabel', order_up: 'orderUp', order_down: 'orderDown', submit_order: 'submitOrder' };
            return t(map[key] || key);
        },
        skip: function(){ skipQuestion(); },
        closeFeedback: function(){ hideFeedbackModal(); },
        closeRanking: function(){ hideRankingModal(); },
        saveName: function(){ saveNameAndSubmit(); },
        skipName: function(){ skipNameAndSubmit(); }
    }
};
