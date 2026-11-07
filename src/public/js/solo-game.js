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
        var nameInput = document.getElementById('player-name');
        var cleanName = nameInput && nameInput.value ? normalizeName(nameInput.value) : '';
        state.playerName = cleanName || t('namePlaceholder');
        if(nameInput){
            nameInput.value = cleanName;
        }
        var startForm = document.getElementById('start-form');
        var gameArea = document.getElementById('game-area');
        var resultArea = document.getElementById('result-area');
        if(startForm) startForm.classList.add('hidden');
        if(resultArea) resultArea.classList.add('hidden');
        if(gameArea) gameArea.classList.remove('hidden');
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
        var questionEl = document.getElementById('question-text');
        if(questionEl) questionEl.textContent = q.question || '';
        setMedia(q.image, q.video);
        var progress = document.getElementById('question-progress');
        if(progress){
            var current = state.idx + 1;
            var total = questions.length;
            progress.textContent = format(t('questionOf'), { current: current, total: total });
            progress.setAttribute('aria-label', current + ' / ' + total);
        }
        updateScorePill();
        state.multiSelections = [];
        renderAnswers(q, meta);
        updateSoloSelectionStyles();
        updateSoloMultiSubmitVisibility(meta);
        var time = (typeof state.desiredQuestionTime === 'number' && state.desiredQuestionTime > 0)
            ? state.desiredQuestionTime
            : ((typeof q.time === 'number' && q.time > 0) ? q.time : 20);
        startTimer(time);
        var feedback = document.getElementById('feedback');
        if(feedback){
            feedback.textContent = '';
            feedback.classList.remove('feedback--success', 'feedback--error', 'feedback--muted');
        }
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

    function setMedia(imageUrl, videoUrl){
        var wrap = document.getElementById('question-media');
        var img = document.getElementById('question-image');
        var vid = document.getElementById('question-video');
        var iframe = document.getElementById('question-iframe');
        if(!wrap || !img || !vid || !iframe) return;
        wrap.classList.add('hidden');
        img.style.display = 'none';
        vid.style.display = 'none';
        iframe.style.display = 'none';
        img.removeAttribute('src');
        vid.removeAttribute('src');
        iframe.removeAttribute('src');

        var hasMedia = false;
        if(imageUrl){
            img.src = normalizeSvgDataUrlForImg(imageUrl);
            img.style.display = 'block';
            hasMedia = true;
        }
        var ytId = parseYouTubeId(videoUrl);
        if(ytId){
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + ytId;
            iframe.style.display = 'block';
            hasMedia = true;
        }else if(videoUrl){
            vid.src = videoUrl;
            vid.style.display = 'block';
            hasMedia = true;
        }
        if(hasMedia){
            wrap.classList.remove('hidden');
            wrap.classList.add('show');
        }else{
            wrap.classList.remove('show');
        }
    }

    function renderAnswers(q, meta){
        var answersWrap = document.getElementById('answers');
        if(!answersWrap) return;
        answersWrap.innerHTML = '';
        var metaInfo = meta || normalizeQuestionMeta(q);

        if(metaInfo.type === 'short-answer' || metaInfo.type === 'numeric'){
            var row = document.createElement('div');
            row.className = 'free-answer-row';

            var input = document.createElement('input');
            input.id = 'solo-free-input';
            input.className = 'free-answer-input';
            input.type = 'text';
            input.autocomplete = 'off';
            input.placeholder = metaInfo.type === 'numeric' ? t('freeNumberPlaceholder') : t('freeTextPlaceholder');
            input.addEventListener('keydown', function(ev){
                if(ev.key === 'Enter'){
                    ev.preventDefault();
                    submitSoloFreeAnswer();
                }
            });

            var btn = document.createElement('button');
            btn.id = 'solo-free-submit';
            btn.className = 'free-answer-submit';
            btn.type = 'button';
            btn.textContent = t('submitFreeAnswer');
            btn.addEventListener('click', function(){ submitSoloFreeAnswer(); });

            row.appendChild(input);
            row.appendChild(btn);
            answersWrap.appendChild(row);

            setTimeout(function(){
                try{ input.focus(); }catch(e){}
            }, 50);
            return;
        }

        var answers = getVisibleAnswers(q, metaInfo.type);
        answers.forEach(function(ans, idx){
            var btn = document.createElement('button');
            btn.className = 'answer';
            btn.type = 'button';
            btn.textContent = ans || ('Respuesta ' + (idx + 1));
            btn.setAttribute('data-answer', String(idx + 1));
            btn.addEventListener('click', function(){ handleSoloAnswerInteraction(idx + 1); });
            answersWrap.appendChild(btn);
        });
    }

    function submitSoloFreeAnswer(){
        if(state.locked) return;
        var questions = getQuestions();
        var q = questions[state.idx];
        if(!q) return;
        var meta = normalizeQuestionMeta(q);
        if(meta.type !== 'short-answer' && meta.type !== 'numeric') return;
        var input = document.getElementById('solo-free-input');
        if(!input) return;
        answerQuestion((input.value || '').toString(), false);
    }

    function updateSoloSelectionStyles(){
        var answersWrap = document.getElementById('answers');
        if(!answersWrap) return;
        Array.prototype.slice.call(answersWrap.querySelectorAll('button.answer')).forEach(function(btn, idx){
            var n = idx + 1;
            if(Array.isArray(state.multiSelections) && state.multiSelections.indexOf(n) !== -1){
                btn.classList.add('multi-selected');
            }else{
                btn.classList.remove('multi-selected');
            }
        });
    }

    function updateSoloMultiSubmitVisibility(meta){
        var btn = document.getElementById('multi-submit');
        if(!btn) return;
        var questions = getQuestions();
        var question = questions[state.idx] || {};
        var currentMeta = meta || normalizeQuestionMeta(question);
        var isMultiple = currentMeta && currentMeta.type === 'multiple';
        var show = isMultiple && !state.locked;
        btn.classList.toggle('hidden', !show);
        var hasSelection = Array.isArray(state.multiSelections) && state.multiSelections.length > 0;
        btn.disabled = !hasSelection;
        if(show){
            btn.classList.toggle('has-selection', hasSelection);
        }else{
            btn.classList.remove('has-selection');
        }
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
        updateSoloSelectionStyles();
        updateSoloMultiSubmitVisibility();
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
        updateTimerPill();
        if(state.timer) clearInterval(state.timer);
        state.timer = setInterval(function(){
            state.timerLeft = Math.max(0, state.timerLeft - 0.1);
            updateTimerPill();
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

    function updateTimerPill(){
        var pill = document.getElementById('timer-pill');
        if(!pill) return;
        pill.textContent = t('timer') + ': ' + Math.ceil(state.timerLeft) + 's';
    }

    function updateScorePill(){
        var scorePill = document.getElementById('score-pill');
        if(scorePill){
            scorePill.textContent = t('score') + ': ' + state.score;
        }
    }

    function answerQuestion(choice, timedOut){
        if(state.locked) return;
        state.locked = true;
        stopTimer();
        var questions = getQuestions();
        var q = questions[state.idx];
        var meta = normalizeQuestionMeta(q);
        var answersWrap = document.getElementById('answers');
        var feedback = document.getElementById('feedback');

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

            var input = document.getElementById('solo-free-input');
            var btn = document.getElementById('solo-free-submit');
            if(input) input.disabled = true;
            if(btn) btn.disabled = true;
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

            var input2 = document.getElementById('solo-free-input');
            var btn2 = document.getElementById('solo-free-submit');
            if(input2) input2.disabled = true;
            if(btn2) btn2.disabled = true;
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

            if(answersWrap){
                Array.prototype.slice.call(answersWrap.querySelectorAll('button.answer')).forEach(function(btnEl, idx){
                    var n = idx + 1;
                    btnEl.disabled = true;
                    if(correctList.indexOf(n) !== -1){
                        btnEl.classList.add('correct');
                    }
                    if(meta.type !== 'poll' && selected.indexOf(n) !== -1 && correctList.indexOf(n) === -1){
                        btnEl.classList.add('wrong');
                    }
                });
            }

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
        if(feedback){
            if(timedOut){
                feedback.classList.remove('feedback--success', 'feedback--error');
                feedback.classList.add('feedback--muted');
                feedback.textContent = t('timeup');
            }else if(meta.type === 'poll'){
                feedback.classList.remove('feedback--error', 'feedback--success');
                feedback.classList.add('feedback--muted');
                feedback.textContent = t('pollThanks');
            }else if(isCorrect){
                feedback.classList.remove('feedback--muted', 'feedback--error');
                feedback.classList.add('feedback--success');
                feedback.textContent = t('correctText');
            }else if(meta.type === 'multiple' && scoreRatio > 0){
                feedback.classList.remove('feedback--muted', 'feedback--error');
                feedback.classList.add('feedback--success');
                feedback.textContent = t('partialText');
            }else{
                feedback.classList.remove('feedback--muted', 'feedback--success');
                feedback.classList.add('feedback--error');
                var label = t('correctLabel');
                feedback.textContent = correctAnswerText
                    ? t('wrongText') + ' · ' + (label === 'correctLabel' ? '' : label + ' ') + correctAnswerText
                    : t('wrongText');
            }
        }
        state.multiSelections = [];
        updateSoloSelectionStyles();
        updateSoloMultiSubmitVisibility();
        state.lastWrong = null;
        if(isCorrect || meta.type === 'poll'){
            updateScorePill();
            setTimeout(function(){
                state.idx += 1;
                renderQuestion();
            }, 1200);
            return;
        }
        updateScorePill();
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
        setMedia(null, null);
        var gameArea = document.getElementById('game-area');
        var resultArea = document.getElementById('result-area');
        if(gameArea) gameArea.classList.add('hidden');
        if(resultArea) resultArea.classList.remove('hidden');
        var summary = document.getElementById('result-summary');
        if(summary){
            var totalQs = getScoredQuestionCount();
            var pollCount = getQuestions().length - totalQs;
            var scoredSummary = totalQs ? format(t('resultSummary'), {
                correct: state.correct,
                total: totalQs,
                score: state.score
            }) : '';
            var pollSummary = pollCount ? format(t('pollSummary'), { total: pollCount }) : '';
            summary.textContent = [scoredSummary, pollSummary].filter(Boolean).join(' · ');
        }
        var ranking = document.getElementById('ranking');
        var rankingList = document.getElementById('ranking-list');
        if(ranking) ranking.classList.add('hidden');
        if(rankingList) rankingList.innerHTML = '';
        if(getScoredQuestionCount() > 0) prepareScoreSubmission();
    }

    function getScoredQuestionCount(){
        return getQuestions().filter(function(question){
            return normalizeQuestionMeta(question).type !== 'poll';
        }).length;
    }
