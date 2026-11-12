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
        // Panel de juego (bloque 2). view: 'none' | 'start' | 'game' | 'result'.
        view: 'none',
        title: { key: 'soloTitle' },
        countInput: '',
        timeInput: '',
        nameInput: '',
        freeText: '',
        marks: { correct: [], wrong: [] },
        feedback: { text: '', kind: '' },
        result: { correct: 0, total: 0, score: 0, polls: 0 },
        rankingBox: { visible: false, items: [] },
        rankingModal: { open: false, items: [] },
        feedbackModalOpen: false,
        nameModalOpen: false,
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
        if(!state.lastWrong) return;
        state.feedbackModalOpen = true;
    }

    function hideFeedbackModal(){
        state.feedbackModalOpen = false;
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
        state.view = 'none';
        state.title = { key: 'soloTitle' };
        syncQuestionCountControls();
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
    }

    Vue.createApp({
        template: '#solo-tpl',
        mixins: [soloCatalog, soloPlay],
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
