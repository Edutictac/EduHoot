// Modo individual: listado de quizzes públicos + juego auto-dirigido con ranking global
// El estado es reactivo: la plantilla de Vue (#solo-tpl) lo lee directamente
// (Subfase B); el resto de funciones solo lo modifican.
function readFeedbackSeconds(){
        try{
            var v = parseInt(localStorage.getItem('eduhoot-solo-feedback-seconds'), 10);
            if(v >= 1 && v <= 30) return v;
        }catch(e){}
        return 5;
    }
    var state = Vue.reactive({
        quizzes: [],
        currentQuiz: null,
        ttsSpeaking: false,
        streak: 0,
        streakBonus: 0,
        ttsReady: false,
        quizData: null,
        questions: [],
    desiredQuestionCount: null,
        desiredQuestionTime: null,
        // Porcentaje extra de tiempo en preguntas de correspondencia (25/50/75/100).
        matchingExtraTime: 50,
        // Opciones de la partida: orden de preguntas barajado (no por defecto) y mostrar la respuesta correcta.
        shuffleQuestions: false,
        showAnswers: true,
        // Segundos que se ve la ventana de resultado (acierto o fallo) antes de pasar a la siguiente pregunta.
        feedbackSeconds: readFeedbackSeconds(),
        feedbackSecondsInput: String(readFeedbackSeconds()),
        // Milisegundos que le quedan a la ventana de resultado abierta.
        feedbackLeftMs: 0,
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
        // Segons que queden del compte arrere 3-2-1 (0 = no se'n mostra cap).
        countdown: 0,
        // Pausa de la partida (la pregunta y el tiempo quedan congelados) y
        // confirmación en dos pasos de «Cancelar partida».
        paused: false,
        cancelConfirming: false,
        timerTotal: 20,
        timerLeft: 20,
        locked: false,
        playerName: 'Anónimo',
        studentJoinToken: '',
        commonsPublicCode: '',
        awaitingConfirm: false,
        lastResult: null,
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
        // Mode flashcards (proposta 20): progrés de la sessió de repàs.
        cards: null,
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
        // Mode fantasma: desactivat per defecte; només amb el check activat es compara i es guarda la marca.
        ghostEnabled: false,
        // Mode fantasma: marca anterior, diferència després de la pregunta i punts de la partida.
        ghost: null,
        ghostDiff: null,
        runOrigs: [],
        runPoints: {},
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

    var feedbackTimer = null;

    function clearFeedbackTimer(){
        if(feedbackTimer){ clearInterval(feedbackTimer); feedbackTimer = null; }
    }

    function showFeedbackModal(){
        if(!state.lastResult) return;
        state.feedbackModalOpen = true;
        // Cuenta atrás visible (barra y segundos): se cierra sola a los N segundos (configurable);
        // también se puede cerrar antes con OK o pulsando fuera.
        clearFeedbackTimer();
        var totalMs = (state.feedbackSeconds || 5) * 1000;
        var endAt = Date.now() + totalMs;
        state.feedbackLeftMs = totalMs;
        feedbackTimer = setInterval(function(){
            var left = Math.max(0, endAt - Date.now());
            state.feedbackLeftMs = left;
            if(left <= 0 && state.feedbackModalOpen) hideFeedbackModal();
            else if(left <= 0) clearFeedbackTimer();
        }, 100);
    }

    function hideFeedbackModal(){
        clearFeedbackTimer();
        state.feedbackModalOpen = false;
        if(state.awaitingConfirm){
            state.awaitingConfirm = false;
            state.idx += 1;
            renderQuestion();
        }
    }

    function resetSelection(){
        stopFlashcardsSpeech();
        state.cards = null;
        state.quizData = null;
        state.currentQuiz = null;
        state.desiredQuestionCount = null;
        clearFeedbackTimer();
        state.feedbackModalOpen = false;
        state.view = 'none';
        state.title = { key: 'soloTitle' };
        syncQuestionCountControls();
        document.body.classList.remove('playing');
        stopCountdown();
        pauseSoloMusic();
        state.awaitingConfirm = false;
        state.lastResult = null;
        state.multiSelections = [];
        state.questions = [];
    }

    function bindEvents(){
        // Al salir (a Inicio o a la biblioteca) la música se para.
        document.querySelectorAll('a.back-link').forEach(function(backLink){
            backLink.addEventListener('click', function(){
                pauseSoloMusic();
            });
        });
        // Se llegó desde la biblioteca (?from=library): se ofrece también volver a ella.
        try{
            if(new URLSearchParams(window.location.search || '').get('from') === 'library'){
                var libraryLink = document.getElementById('back-library');
                if(libraryLink) libraryLink.classList.remove('hidden');
            }
        }catch(e){}
        var langSelect = document.getElementById('lang-select');
        if(langSelect){
            langSelect.addEventListener('change', function(){
                setLang(langSelect.value);
            });
        }
    }

    // Enllaç directe al repàs (/solo/?id=…&mode=cards): amaga el catàleg des del primer
    // render, perquè no es veja la llista mentre es carrega el quiz.
    var deepLink = null;
    try{
        var deepParams = new URLSearchParams(window.location.search || '');
        if(deepParams.get('id') && deepParams.get('mode') === 'cards'){
            deepLink = deepParams.get('id');
        }
        // Con un quiz elegido en la URL (/solo/?id=…) tampoco se enseña el catálogo mientras carga.
        if(deepParams.get('id')){
            document.body.classList.add('playing');
        }
    }catch(e){}

    var soloVm = Vue.createApp({
        template: '#solo-tpl',
        mixins: [soloCatalog, soloPlay, soloFlashcards],
        mounted: function(){
            EduhootTTS.watchAvailability(document.documentElement.lang, function(ok){ state.ttsReady = ok; });
            var vm = this;
            document.addEventListener('click', function(e){
                if(vm.helpOpen && !e.target.closest('.help')) vm.helpOpen = null;
            });
            document.addEventListener('keydown', function(e){
                if(e.key === 'Escape' && vm.helpOpen) vm.helpOpen = null;
            });
        },
        watch: {
            // En desaparéixer el botó (cuenta atrás o resposta) es para la lectura.
            ttsAvailable: function(ok){
                if(!ok){
                    EduhootTTS.cancel();
                    state.ttsSpeaking = false;
                }
            }
        },
        data: function(){
            return { s: state, helpOpen: null };
        },
        methods: {
            t: function(key){
                this.s.lang;
                return t(key);
            },
            format: format,
            toggleHelp: function(key){ this.helpOpen = (this.helpOpen === key) ? null : key; }
        }
    }).component('matching-board', window.EduhootMatchingBoard).component('order-board', window.EduhootOrderBoard).mount('#solo-app');

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
        if(deepLink){
            soloVm.study(deepLink);
        }else if(id){
            selectQuiz(id);
        }
    })();
