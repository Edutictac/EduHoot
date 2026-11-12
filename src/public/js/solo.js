// Modo individual: listado de quizzes públicos + juego auto-dirigido con ranking global
// El estado es reactivo: la plantilla de Vue (#solo-tpl) lo lee directamente
// (Subfase B); el resto de funciones solo lo modifican.
var state = Vue.reactive({
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
        favoriteIds: new Set(),
        // Catálogo (bloque 1)
        search: '',
        loading: false,
        loadError: false,
        tagFilterExpanded: false,
        thumbs: {},
        // Se incrementa al cambiar de idioma para que la plantilla se repinte.
        lang: 0
});

state.favoriteIds = loadFavorites();
userRatings = Vue.reactive(loadUserRatings());
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
    state.lang += 1;
    renderSelectedMeta();
    updateSoloMusicLabels();
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

    Vue.createApp({
        template: '#solo-tpl',
        mixins: [soloCatalog],
        data: function(){
            return { s: state };
        },
        methods: {
            t: function(key){
                this.s.lang;
                return t(key);
            },
            format: format
        }
    }).mount('#solo-app');

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
