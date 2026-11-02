// Modo individual: listado de quizzes públicos + juego auto-dirigido con ranking global
var state = {
        quizzes: [],
        currentQuiz: null,
        quizData: null,
        questions: [],
    desiredQuestionCount: null,
        desiredQuestionTime: null,
        page: 0,
        pageSize: 12,
        sortOrder: 'plays',
        filters: {
            tags: [],
            tagMode: 'any',
            minQuestions: '',
            maxQuestions: '',
            onlyImage: false
        },
        idx: 0,
        score: 0,
        correct: 0,
        timer: null,
        timerTotal: 20,
        timerLeft: 20,
        locked: false,
        playerName: 'Anónimo',
        studentJoinToken: '',
        commonsPublicCode: '',
        awaitingConfirm: false,
        lastWrong: null,
        multiSelections: [],
        favoriteIds: new Set()
};

state.favoriteIds = loadFavorites();
userRatings = loadUserRatings();
deviceId = getDeviceId();

function t(key){
    return window.getSoloTranslation(key);
}

function format(str, data){
    return window.formatSoloTranslation(str, data);
}

function applyStaticText(){
    window.applySoloTranslations();
}

function setLang(newLang){
    window.applySoloTranslations(newLang);
    updateTagFilterOptions();
    renderList();
    renderSelectedMeta();
    updateSoloMusicLabels();
}

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

    function submitScore(nameToUse){
        var ranking = document.getElementById('ranking');
        var rankingList = document.getElementById('ranking-list');
        if(rankingList){
            var li = document.createElement('li');
            li.textContent = t('saving');
            rankingList.appendChild(li);
        }
        fetch('/api/quizzes/' + encodeURIComponent(state.currentQuiz) + '/solo-run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nameToUse || state.playerName,
                studentJoinToken: state.studentJoinToken || '',
                score: state.score,
                totalQuestions: getScoredQuestionCount()
            })
        })
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                if(!payload.ok){
                    if(rankingList){
                        rankingList.innerHTML = '';
                        var li = document.createElement('li');
                        li.textContent = payload.body && payload.body.error ? payload.body.error : t('rankingError');
                        rankingList.appendChild(li);
                    }
                    if(ranking) ranking.classList.remove('hidden');
                    return;
                }
                renderRanking(payload.body.top || []);
            })
            .catch(function(){
                if(rankingList){
                    rankingList.innerHTML = '';
                    var li = document.createElement('li');
                    li.textContent = t('rankingError');
                    rankingList.appendChild(li);
                }
                if(ranking) ranking.classList.remove('hidden');
            });
    }

    function renderRanking(list){
        var ranking = document.getElementById('ranking');
        var rankingList = document.getElementById('ranking-list');
        if(!ranking || !rankingList) return;
        rankingList.innerHTML = '';
        if(!list.length){
            var empty = document.createElement('li');
            empty.textContent = t('rankingError');
            rankingList.appendChild(empty);
            ranking.classList.remove('hidden');
            return;
        }
        appendRankingRows(rankingList, list);
        ranking.classList.remove('hidden');
    }

    function appendRankingRows(targetList, rows){
        rows.slice(0, 10).forEach(function(row){
            var li = document.createElement('li');
            var name = row.playerName || t('namePlaceholder');
            var score = row.score || 0;
            li.textContent = name + ' — ' + score + ' ' + t('scoreLabel');
            targetList.appendChild(li);
        });
    }

    function showQuizRanking(id){
        var modal = document.getElementById('ranking-modal');
        var list = document.getElementById('ranking-modal-list');
        var title = document.getElementById('ranking-modal-title');
        if(!modal || !list || !title) return;
        title.textContent = t('rankingTitle');
        list.innerHTML = '';
        var loading = document.createElement('li');
        loading.textContent = t('loading');
        list.appendChild(loading);
        modal.classList.add('show');
        fetch('/api/quizzes/' + encodeURIComponent(id) + '/solo-ranking')
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                list.innerHTML = '';
                var rows = payload.ok && payload.body && Array.isArray(payload.body.top) ? payload.body.top : [];
                if(!rows.length){
                    var empty = document.createElement('li');
                    empty.textContent = (payload.body && payload.body.error) ? payload.body.error : t('rankingEmpty');
                    list.appendChild(empty);
                    return;
                }
                appendRankingRows(list, rows);
            })
            .catch(function(){
                list.innerHTML = '';
                var empty = document.createElement('li');
                empty.textContent = t('rankingError');
                list.appendChild(empty);
            });
    }

    function hideRankingModal(){
        var modal = document.getElementById('ranking-modal');
        if(modal) modal.classList.remove('show');
    }

    function openNameModal(){
        var modal = document.getElementById('name-modal');
        var input = document.getElementById('player-name');
        if(!modal || !input) return;
        input.value = normalizeName(input.value || state.playerName || 'AAA');
        modal.classList.add('show');
        setTimeout(function(){ input.focus(); input.select(); }, 10);
    }

    function closeNameModal(){
        var modal = document.getElementById('name-modal');
        if(modal) modal.classList.remove('show');
    }

    function shouldPromptName(topList, newScore){
        if(!Array.isArray(topList)) return true;
        if(topList.length < 10) return true;
        var minScore = topList[topList.length - 1] ? (topList[topList.length - 1].score || 0) : 0;
        return newScore >= minScore;
    }

    function prepareScoreSubmission(){
        if(state.studentJoinToken){
            submitScore(state.playerName || state.commonsPublicCode || t('namePlaceholder'));
            return;
        }
        var score = state.score;
        fetch('/api/quizzes/' + encodeURIComponent(state.currentQuiz) + '/solo-ranking')
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                var top = (payload.ok && payload.body && Array.isArray(payload.body.top)) ? payload.body.top : [];
                if(shouldPromptName(top, score)){
                    openNameModal();
                }else{
                    submitScore(state.playerName || t('namePlaceholder'));
                }
            })
            .catch(function(){
                submitScore(state.playerName || t('namePlaceholder'));
            });
    }

    function removeLaunchTokenFromUrl(){
        try{
            var url = new URL(window.location.href);
            if(!url.searchParams.has('commonsLaunchToken')) return;
            url.searchParams.delete('commonsLaunchToken');
            window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
        }catch(e){}
    }

    function initCommonsLaunch(){
        var launchToken = '';
        try{
            var params = new URLSearchParams(window.location.search || '');
            launchToken = (params.get('commonsLaunchToken') || '').trim();
        }catch(e){}
        if(!launchToken) return Promise.resolve();
        removeLaunchTokenFromUrl();
        return fetch('/api/player-auth/launch-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ launch_token: launchToken })
        })
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                if(!payload.ok || !payload.body || !payload.body.join_token){
                    throw new Error(payload.body && payload.body.error ? payload.body.error : 'Commons login error');
                }
                state.studentJoinToken = payload.body.join_token;
                state.commonsPublicCode = normalizeName(payload.body.public_code || payload.body.display_name || '');
                state.playerName = state.commonsPublicCode || t('namePlaceholder');
                return payload.body;
            })
            .catch(function(err){
                console.error('commons launch error', err);
                state.studentJoinToken = '';
                state.commonsPublicCode = '';
            });
    }

    function showFeedbackModal(){
        var modal = document.getElementById('feedback-modal');
        var title = document.getElementById('feedback-title');
        var body = document.getElementById('feedback-body');
        if(!modal || !title || !body || !state.lastWrong) return;
        var label = t('correctLabel');
        var correctText = state.lastWrong.correctText || '';
        title.textContent = t('wrongText');
        body.textContent = (label === 'correctLabel' ? '' : label + ' ') + correctText;
        modal.classList.add('show');
    }

    function hideFeedbackModal(){
        var modal = document.getElementById('feedback-modal');
        if(modal) modal.classList.remove('show');
        if(state.awaitingConfirm){
            state.awaitingConfirm = false;
            state.idx += 1;
            renderQuestion();
        }
    }

    function resetSelection(){
        state.quizData = null;
        state.currentQuiz = null;
        state.desiredQuestionCount = null;
        var startForm = document.getElementById('start-form');
        var gameArea = document.getElementById('game-area');
        var resultArea = document.getElementById('result-area');
        var title = document.getElementById('selected-title');
        var meta = document.getElementById('selected-meta');
        if(startForm) startForm.classList.add('hidden');
        if(gameArea) gameArea.classList.add('hidden');
        if(resultArea) resultArea.classList.add('hidden');
        if(title) title.textContent = t('soloTitle');
        if(meta) meta.textContent = t('startSelect');
        syncQuestionCountControls();
        setMedia(null, null);
        document.body.classList.remove('playing');
        pauseSoloMusic();
        state.awaitingConfirm = false;
        state.lastWrong = null;
        state.multiSelections = [];
        state.questions = [];
    }

    function bindEvents(){
        var backLink = document.querySelector('a.back-link');
        if(backLink){
            backLink.addEventListener('click', function(){
                pauseSoloMusic();
            });
        }
        var langSelect = document.getElementById('lang-select');
        if(langSelect){
            langSelect.addEventListener('change', function(){
                setLang(langSelect.value);
            });
        }
        var search = document.getElementById('search');
        if(search){
            search.addEventListener('input', function(){
                state.page = 0;
                renderList();
            });
        }
        var sortSelect = document.getElementById('sort');
        if(sortSelect){
            sortSelect.value = state.sortOrder;
            sortSelect.addEventListener('change', function(){
                state.sortOrder = sortSelect.value;
                state.page = 0;
                renderList();
            });
        }
        var tagsSelectAll = document.getElementById('tags-select-all');
        if(tagsSelectAll){
            tagsSelectAll.addEventListener('click', function(){
                // Selecciona todas las etiquetas (y las muestra)
                var all = getAllTagsFromQuizzes().map(function(it){ return it.tag; });
                state.filters.tags = all;
                tagFilterExpanded = true;
                updateTagFilterOptions();
                state.page = 0;
                renderList();
            });
        }
        var tagsClear = document.getElementById('tags-clear');
        if(tagsClear){
            tagsClear.addEventListener('click', function(){
                state.filters.tags = [];
                updateTagFilterOptions();
                state.page = 0;
                renderList();
            });
        }
        var tagFilter = document.getElementById('tag-filter');
        if(tagFilter){
            updateTagFilterOptions();
        }
        var minQuestions = document.getElementById('min-questions');
        if(minQuestions){
            minQuestions.value = state.filters.minQuestions;
            minQuestions.addEventListener('input', function(){
                state.filters.minQuestions = minQuestions.value;
                state.page = 0;
                renderList();
            });
        }
        var maxQuestions = document.getElementById('max-questions');
        if(maxQuestions){
            maxQuestions.value = state.filters.maxQuestions;
            maxQuestions.addEventListener('input', function(){
                state.filters.maxQuestions = maxQuestions.value;
                state.page = 0;
                renderList();
            });
        }
        var onlyImage = document.getElementById('only-image');
        if(onlyImage){
            onlyImage.checked = !!state.filters.onlyImage;
            onlyImage.addEventListener('change', function(){
                state.filters.onlyImage = !!onlyImage.checked;
                state.page = 0;
                renderList();
            });
        }
        var startBtn = document.getElementById('start-btn');
        if(startBtn){
            startBtn.addEventListener('click', startQuiz);
        }
        var multiSubmitBtn = document.getElementById('multi-submit');
        if(multiSubmitBtn){
            multiSubmitBtn.addEventListener('click', submitSoloMultiAnswers);
        }
        var questionCount = document.getElementById('question-count');
        if(questionCount){
            questionCount.addEventListener('input', function(){
                var total = getQuizTotalQuestions();
                if(total <= 0) return;
                var v = clampInt(questionCount.value, 1, total);
                if(v == null) return;
                questionCount.value = String(v);
                state.desiredQuestionCount = v;
            });
        }
        var questionTime = document.getElementById('question-time');
        if(questionTime){
            questionTime.addEventListener('input', function(){
                if(!questionTime.value){
                    state.desiredQuestionTime = null;
                    return;
                }
                var v = clampInt(questionTime.value, 5, 120);
                if(v == null) return;
                questionTime.value = String(v);
                state.desiredQuestionTime = v;
            });
        }
        var playAgain = document.getElementById('play-again');
        if(playAgain){
            playAgain.addEventListener('click', function(){
                if(state.quizData){
                    startQuiz();
                }
            });
        }
        var pickAnother = document.getElementById('pick-another');
        if(pickAnother){
            pickAnother.addEventListener('click', resetSelection);
        }
        var nameInput = document.getElementById('player-name');
        if(nameInput){
            nameInput.addEventListener('input', function(){
                nameInput.value = normalizeName(nameInput.value);
            });
        }
        var feedbackClose = document.getElementById('feedback-close');
        if(feedbackClose){
            feedbackClose.addEventListener('click', hideFeedbackModal);
        }
        var feedbackModal = document.getElementById('feedback-modal');
        if(feedbackModal){
            feedbackModal.addEventListener('click', function(e){
                if(e.target === feedbackModal){
                    hideFeedbackModal();
                }
            });
        }
        var rankingModalClose = document.getElementById('ranking-modal-close');
        if(rankingModalClose){
            rankingModalClose.addEventListener('click', hideRankingModal);
        }
        var rankingModal = document.getElementById('ranking-modal');
        if(rankingModal){
            rankingModal.addEventListener('click', function(e){
                if(e.target === rankingModal){
                    hideRankingModal();
                }
            });
        }
        var nameSave = document.getElementById('name-save');
        if(nameSave){
            nameSave.addEventListener('click', function(){
                var input = document.getElementById('player-name');
                var clean = normalizeName(input ? input.value : '');
                state.playerName = clean || t('namePlaceholder');
                closeNameModal();
                submitScore(state.playerName);
            });
        }
        var nameCancel = document.getElementById('name-cancel');
        if(nameCancel){
            nameCancel.addEventListener('click', function(){
                closeNameModal();
                submitScore(state.playerName || t('namePlaceholder'));
            });
        }
        var nameModal = document.getElementById('name-modal');
        if(nameModal){
            nameModal.addEventListener('click', function(e){
                if(e.target === nameModal){
                    closeNameModal();
                    submitScore(state.playerName || t('namePlaceholder'));
                }
            });
        }
    }

    applyStaticText();
    initSoloMusicPlayer();
    parseTagFiltersFromUrl();
    bindEvents();
    // Asegura que el selector quede consistente al cargar.
    syncQuestionCountControls();
    fetchPublicQuizzes();
    initCommonsLaunch();

    // Permite abrir directamente un quiz desde Create: /solo/?id=<quizId>
    (function(){
        var id = null;
        try{
            var params = new URLSearchParams(window.location.search || '');
            id = params.get('id');
        }catch(e){}
        if(id){
            selectQuiz(id);
        }
    })();
