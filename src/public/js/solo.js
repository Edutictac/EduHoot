// Modo individual: listado de quizzes públicos + juego auto-dirigido con ranking global
(function(){
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
var soloMusicPlayerInstance = null;
var SOLO_MUSIC_STORAGE_KEY = 'eduhoot-solo-music';
var SOLO_MUSIC_STORAGE_KEY_LEGACY = 'eduhook-solo-music';
var FAVORITES_STORAGE_KEY = 'eduhoot-favorite-quizzes';
var USER_RATING_STORAGE_KEY = 'eduhoot-user-ratings';
var DEVICE_ID_STORAGE_KEY = 'eduhoot-device-id';
var userRatings = {};
var deviceId = '';

function loadFavorites(){
    try{
        var raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
        if(!raw) return new Set();
        var parsed = JSON.parse(raw);
        if(!Array.isArray(parsed)) return new Set();
        return new Set(parsed.map(function(id){ return String(id); }));
    }catch(e){
        return new Set();
    }
}

function saveFavorites(){
    try{
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(state.favoriteIds)));
    }catch(e){}
}

function isFavorite(id){
    return state.favoriteIds && state.favoriteIds.has(String(id));
}

function toggleFavorite(id){
    var key = String(id);
    if(isFavorite(key)){
        state.favoriteIds.delete(key);
    }else{
        state.favoriteIds.add(key);
    }
    saveFavorites();
}

function updateFavoriteButton(btn, id){
    if(!btn) return;
    var active = isFavorite(id);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    var label = active ? t('favoriteRemove') : t('favoriteAdd');
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.textContent = active ? '❤' : '♡';
}

function getDeviceId(){
    try{
        var existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
        if(existing) return existing;
        var bytes = new Uint8Array(12);
        if(window.crypto && window.crypto.getRandomValues){
            window.crypto.getRandomValues(bytes);
        }else{
            for(var i = 0; i < bytes.length; i++){
                bytes[i] = Math.floor(Math.random() * 256);
            }
        }
        var id = Array.from(bytes).map(function(b){ return b.toString(16).padStart(2, '0'); }).join('');
        localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
        return id;
    }catch(e){
        return 'anon-' + Math.random().toString(16).slice(2);
    }
}

function loadUserRatings(){
    try{
        var raw = localStorage.getItem(USER_RATING_STORAGE_KEY);
        if(!raw) return {};
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    }catch(e){
        return {};
    }
}

function saveUserRatings(){
    try{
        localStorage.setItem(USER_RATING_STORAGE_KEY, JSON.stringify(userRatings));
    }catch(e){}
}

function getUserRating(id){
    return userRatings && userRatings[String(id)];
}

function setUserRating(id, rating){
    userRatings[String(id)] = rating;
    saveUserRatings();
}

function formatRatingSummary(avg, count){
    if(!count){
        return t('ratingEmpty');
    }
    return format(t('ratingSummary'), { avg: avg.toFixed(1), count: count });
}

function updateRatingStars(starsWrap, displayRating){
    if(!starsWrap) return;
    var buttons = starsWrap.querySelectorAll('button[data-value]');
    Array.prototype.forEach.call(buttons, function(btn){
        var value = parseInt(btn.getAttribute('data-value'), 10);
        btn.classList.toggle('is-filled', value <= displayRating);
    });
}

function submitRating(quizId, rating, summaryEl, starsWrap, quizRef){
    if(!deviceId) deviceId = getDeviceId();
    fetch('/api/quizzes/' + encodeURIComponent(quizId) + '/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: rating, deviceId: deviceId })
    })
        .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
        .then(function(payload){
            if(!payload.ok) return;
            var avg = Number(payload.body && payload.body.avg);
            if(!Number.isFinite(avg)) avg = 0;
            var count = Number(payload.body && payload.body.count);
            if(!Number.isFinite(count)) count = 0;
            count = Math.max(0, Math.round(count));
            if(quizRef){
                quizRef.ratingAvg = avg;
                quizRef.ratingCount = count;
            }
            setUserRating(quizId, rating);
            if(summaryEl) summaryEl.textContent = formatRatingSummary(avg, count);
            updateRatingStars(starsWrap, rating);
        })
        .catch(function(){});
}

function sortPublicQuizzes(list){
    if(!Array.isArray(list)) return list;
    return list.slice().sort(function(a, b){
        if(state.sortOrder === 'recent'){
            var ta = Date.parse(a && (a.createdAt || a.updatedAt)) || 0;
            var tb = Date.parse(b && (b.createdAt || b.updatedAt)) || 0;
            if(ta === tb) return Math.random() - 0.5;
            return tb - ta;
        }
        if(state.sortOrder === 'alpha'){
            var na = (a && a.name ? a.name : '').toLowerCase();
            var nb = (b && b.name ? b.name : '').toLowerCase();
            return na.localeCompare(nb);
        }
        if(state.sortOrder === 'alpha-desc'){
            var nda = (a && a.name ? a.name : '').toLowerCase();
            var ndb = (b && b.name ? b.name : '').toLowerCase();
            return ndb.localeCompare(nda);
        }
        var pa = a && typeof a.playsCount === 'number' ? a.playsCount : 0;
        var pb = b && typeof b.playsCount === 'number' ? b.playsCount : 0;
        if(state.sortOrder === 'least'){
            if(pa === pb) return Math.random() - 0.5;
            return pa - pb;
        }
        if(pa === pb){
            return Math.random() - 0.5;
        }
        return pb - pa;
    });
}

var LANG_KEYS = ['lang', 'lang-player', 'lang-host', 'edutictac-portal-lang', 'edutictac-lang'];
function normalizeLang(raw){
    var value = String(raw || '').toLowerCase();
    if(value.indexOf('valencia') !== -1) return 'va';
    var base = value.split('-')[0];
    return ['ca','va','es','en'].indexOf(base) !== -1 ? base : '';
}
function getQueryLang(){
    try{ return normalizeLang(new URLSearchParams(window.location.search).get('lang')); }catch(e){ return ''; }
}
function getStoredLang(){
    for(var i = 0; i < LANG_KEYS.length; i++){
        try{
            var value = normalizeLang(localStorage.getItem(LANG_KEYS[i]));
            if(value) return value;
        }catch(e){}
    }
    return '';
}
function persistLang(value){
    try {
        var url = new URL(window.location.href);
        if (url.searchParams.has('lang')) {
            url.searchParams.set('lang', value);
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        }
    } catch (e) {}
    for(var i = 0; i < LANG_KEYS.length; i++){
        try{ localStorage.setItem(LANG_KEYS[i], value); }catch(e){}
    }
}
var browserLang = normalizeLang(navigator.language || 'es');
    var lang = getQueryLang() || getStoredLang() || browserLang || 'es';
    persistLang(lang);

    var i18n = {
        es: {
            back: 'Volver',
            eyebrow: 'Modo individual',
            title: 'EduHoot',
            subtitle: 'Elige un quiz público, responde las preguntas y entra en el ranking global.',
            langLabel: 'Idioma',
            publicListEyebrow: 'Catálogo público',
            publicListTitle: 'Juegos públicos',
            publicListDesc: 'Solo se muestran quizzes públicos. Pulsa “Jugar en solitario” para arrancar.',
            searchPlaceholder: 'Buscar por nombre o etiqueta',
            filterTagLabel: 'Etiquetas',
            filterTagSelectAll: 'Seleccionar todas',
            filterTagClear: 'Limpiar',
            filterTagShowMore: 'Mostrar etiquetas',
            filterTagShowLess: 'Ocultar etiquetas',
            filterQuestionsLabel: 'Preguntas',
            filterMinPlaceholder: 'mín',
            filterMaxPlaceholder: 'máx',
            filterOnlyImage: 'Solo con imagen',
            sortLabel: 'Ordenar por',
            sortPlays: 'Más jugados',
            sortLeastPlays: 'Menos jugados',
            sortNewest: 'Más recientes',
            sortAlphaAsc: 'A-Z',
            sortAlphaDesc: 'Z-A',
            playsShort: 'partidas',
            playersShort: 'jugadores',
            ratingSummary: '{avg} · {count} votos',
            ratingEmpty: 'Sin valoraciones',
            ratingStarLabel: '{stars} estrellas',
            favoriteAdd: 'Guardar en favoritos',
            favoriteRemove: 'Quitar de favoritos',
            soloEyebrow: 'Modo individual',
            soloTitle: 'Elige un juego para empezar',
            nameLabel: 'Tu nombre (opcional)',
            nameTitle: 'Identifícate para el ranking',
            nameDesc: 'Solo se pedirá si entras al Top 10. Usa 3 letras o números.',
            nameSave: 'Guardar',
            nameSkip: 'Omitir',
            namePlaceholder: 'AAA',
            questionCountLabel: 'Preguntas a responder',
            questionCountTotal: 'de {total}',
            questionTimeLabel: 'Tiempo por pregunta (segundos)',
            questionTimePlaceholder: 'Auto',
            startButton: 'Jugar en solitario',
        startHint: 'El tiempo por pregunta se respeta si el quiz lo define.',
        questionOf: 'Pregunta {current} de {total}',
        score: 'Puntos',
        timer: 'Tiempo',
        correctText: '¡Correcto!',
        wrongText: 'Respuesta incorrecta',
        correctLabel: 'Respuesta correcta:',
        timeup: 'Tiempo agotado',
        finishTitle: 'Partida terminada',
        playAgain: 'Repetir quiz',
        pickAnother: 'Elegir otro quiz',
        rankingTitle: 'Top 10 global',
            rankingHint: 'Solo se muestra al finalizar la partida.',
        resultSummary: 'Acertadas {correct}/{total} · {score} pts',
        publicEmpty: 'No hay juegos públicos disponibles.',
        loading: 'Cargando...',
        startSelect: 'Selecciona un juego público para empezar.',
        saving: 'Guardando puntuación...',
        rankingError: 'No se pudo cargar el ranking.',
        startError: 'No se pudo cargar el quiz.',
        playCta: 'Jugar en solitario',
        byline: 'Preguntas: {count}',
        scoreLabel: 'Puntos',
        timerLabel: 'Tiempo',
        selectedMeta: 'Preguntas: {count} · Etiquetas: {tags}',
        topName: 'Nombre',
        topScore: 'Puntos',
        bgMusicTitle: 'Música de fondo',
        bgMusicChoose: 'Elige un tema',
        bgMusicPlay: 'Reproducir música',
        bgMusicPause: 'Pausar música',
            bgMusicPrev: 'Anterior',
            bgMusicNext: 'Siguiente',
        bgMusicVolume: 'Volumen',
        viewRanking: 'Ver ranking',
        rankingClose: 'Cerrar ranking',
        rankingEmpty: 'Aún no hay puntuaciones.',
        submitAnswers: 'Enviar respuestas',
        freeTextPlaceholder: 'Escribe tu respuesta',
        freeNumberPlaceholder: 'Introduce un número',
        submitFreeAnswer: 'Enviar',
        footerLicense: 'EduHoot · Licencia GNU Affero General Public License v3.0 (AGPL-3.0)',
        footerSource: 'Código fuente',
        footerContactLabel: 'Incidencias'
    },
        en: {
            back: 'Back',
            eyebrow: 'Solo mode',
            title: 'EduHoot',
            subtitle: 'Pick a public quiz, answer, and try to get into the global ranking.',
            langLabel: 'Language',
            publicListEyebrow: 'Public catalog',
            publicListTitle: 'Public games',
            publicListDesc: 'Only public quizzes are listed. Hit “Play solo” to start.',
            searchPlaceholder: 'Search by name or tag',
            filterTagLabel: 'Tags',
            filterTagSelectAll: 'Select all',
            filterTagClear: 'Clear',
            filterTagShowMore: 'Show tags',
            filterTagShowLess: 'Hide tags',
            filterQuestionsLabel: 'Questions',
            filterMinPlaceholder: 'min',
            filterMaxPlaceholder: 'max',
            filterOnlyImage: 'Only with image',
            sortLabel: 'Sort by',
            sortPlays: 'Most played',
            sortLeastPlays: 'Least played',
            sortNewest: 'Newest',
            sortAlphaAsc: 'A-Z',
            sortAlphaDesc: 'Z-A',
            playsShort: 'plays',
            playersShort: 'players',
            ratingSummary: '{avg} · {count} votes',
            ratingEmpty: 'No ratings yet',
            ratingStarLabel: '{stars} stars',
            favoriteAdd: 'Save as favorite',
            favoriteRemove: 'Remove favorite',
            soloEyebrow: 'Solo mode',
            soloTitle: 'Pick a game to start',
            nameLabel: 'Your name (optional)',
            nameTitle: 'Set your name for the ranking',
            nameDesc: 'Only asked if you reach the Top 10. Use 3 letters or numbers.',
            nameSave: 'Save',
            nameSkip: 'Skip',
            namePlaceholder: 'AAA',
            questionCountLabel: 'Questions to answer',
            questionCountTotal: 'of {total}',
            questionTimeLabel: 'Time per question (seconds)',
            questionTimePlaceholder: 'Auto',
            startButton: 'Play solo',
            startHint: 'Per-question timers are respected if set on the quiz.',
            questionOf: 'Question {current} of {total}',
            score: 'Score',
            timer: 'Time',
            correctText: 'Correct!',
            wrongText: 'Wrong answer',
            correctLabel: 'Correct answer:',
            timeup: 'Time is up',
            finishTitle: 'Game finished',
            playAgain: 'Play again',
            pickAnother: 'Pick another quiz',
            rankingTitle: 'Global Top 10',
            rankingHint: 'Only visible after finishing.',
            resultSummary: 'Correct {correct}/{total} · {score} pts',
            publicEmpty: 'No public games available.',
            loading: 'Loading...',
            startSelect: 'Select a public game to start.',
            saving: 'Saving score...',
            rankingError: 'Could not load ranking.',
            startError: 'Could not load the quiz.',
            playCta: 'Play solo',
            byline: 'Questions: {count}',
            scoreLabel: 'Score',
            timerLabel: 'Time',
            selectedMeta: 'Questions: {count} · Tags: {tags}',
            topName: 'Name',
            topScore: 'Score',
            bgMusicTitle: 'Background music',
            bgMusicChoose: 'Choose a track',
            bgMusicPlay: 'Play music',
            bgMusicPause: 'Pause music',
            bgMusicPrev: 'Prev',
            bgMusicNext: 'Next',
            bgMusicVolume: 'Volume',
            viewRanking: 'View ranking',
            rankingClose: 'Close ranking',
            rankingEmpty: 'No rankings yet.',
            submitAnswers: 'Submit answers',
                freeTextPlaceholder: 'Type your answer',
                freeNumberPlaceholder: 'Enter a number',
                submitFreeAnswer: 'Submit',
            footerLicense: 'EduHoot · GNU Affero General Public License v3.0 (AGPL-3.0)',
            footerSource: 'Source code',
            footerContactLabel: 'Issues'
    },
        ca: {
            back: 'Tornar',
            eyebrow: 'Mode individual',
            title: 'EduHoot',
            subtitle: 'Tria un quiz públic, respon i entra al rànquing global.',
            langLabel: 'Idioma',
            publicListEyebrow: 'Catàleg públic',
            publicListTitle: 'Jocs públics',
            publicListDesc: 'Només es mostren quizzes públics. Prem “Jugar en solitari” per començar.',
            searchPlaceholder: 'Cerca per nom o etiqueta',
            filterTagLabel: 'Etiquetes',
            filterTagSelectAll: 'Seleccionar totes',
            filterTagClear: 'Netejar',
            filterTagShowMore: 'Mostrar etiquetes',
            filterTagShowLess: 'Ocultar etiquetes',
            filterQuestionsLabel: 'Preguntes',
            filterMinPlaceholder: 'mín',
            filterMaxPlaceholder: 'màx',
            filterOnlyImage: 'Només amb imatge',
            sortLabel: 'Ordenar per',
            sortPlays: 'Més jugats',
            sortLeastPlays: 'Menys jugats',
            sortNewest: 'Més recents',
            sortAlphaAsc: 'A-Z',
            sortAlphaDesc: 'Z-A',
            playsShort: 'partides',
            playersShort: 'jugadors',
            ratingSummary: '{avg} · {count} vots',
            ratingEmpty: 'Sense valoracions',
            ratingStarLabel: '{stars} estrelles',
            favoriteAdd: 'Desar a favorits',
            favoriteRemove: 'Treure de favorits',
            soloEyebrow: 'Mode individual',
            soloTitle: 'Tria un joc per començar',
            nameLabel: 'El teu nom (opcional)',
            nameTitle: 'Identifica\'t per al rànquing',
            nameDesc: 'Només es demana si entres al Top 10. Usa 3 lletres o números.',
            nameSave: 'Desar',
            nameSkip: 'Ometre',
            namePlaceholder: 'AAA',
            questionCountLabel: 'Preguntes a respondre',
            questionCountTotal: 'de {total}',
            questionTimeLabel: 'Temps per pregunta (segons)',
            questionTimePlaceholder: 'Auto',
            startButton: 'Jugar en solitari',
            startHint: 'El temps per pregunta es respecta si el quiz el defineix.',
            questionOf: 'Pregunta {current} de {total}',
            score: 'Punts',
            timer: 'Temps',
            correctText: 'Correcte!',
            wrongText: 'Resposta incorrecta',
            correctLabel: 'Resposta correcta:',
            timeup: 'Temps exhaurit',
            finishTitle: 'Partida acabada',
            playAgain: 'Tornar a jugar',
            pickAnother: 'Triar un altre quiz',
            rankingTitle: 'Top 10 global',
            rankingHint: 'Només es mostra al final.',
            resultSummary: 'Encerts {correct}/{total} · {score} pts',
            publicEmpty: 'No hi ha jocs públics disponibles.',
            loading: 'Carregant...',
            startSelect: 'Selecciona un joc públic per començar.',
            saving: 'Desant puntuació...',
            rankingError: 'No s\'ha pogut carregar el rànquing.',
            startError: 'No s\'ha pogut carregar el quiz.',
            playCta: 'Jugar en solitari',
            byline: 'Preguntes: {count}',
            scoreLabel: 'Punts',
            timerLabel: 'Temps',
            selectedMeta: 'Preguntes: {count} · Etiquetes: {tags}',
            topName: 'Nom',
            topScore: 'Punts',
            bgMusicTitle: 'Música de fons',
            bgMusicChoose: 'Tria una pista',
            bgMusicPlay: 'Reprodueix música',
            bgMusicPause: 'Atura la música',
            bgMusicPrev: 'Anterior',
            bgMusicNext: 'Següent',
            bgMusicVolume: 'Volum',
            viewRanking: 'Veure rànquing',
            rankingClose: 'Tancar rànquing',
            rankingEmpty: 'Encara no hi ha puntuacions.',
            submitAnswers: 'Enviar respostes',
            freeTextPlaceholder: 'Escriu la teva resposta',
            freeNumberPlaceholder: 'Introdueix un número',
            submitFreeAnswer: 'Enviar',
            footerLicense: 'EduHoot · Llicència GNU Affero General Public License v3.0 (AGPL-3.0)',
            footerSource: 'Codi font',
            footerContactLabel: 'Incidències'
        },
        va: {
            freeTextPlaceholder: 'Escriu la teua resposta'
        }
    };

    state.favoriteIds = loadFavorites();
    userRatings = loadUserRatings();
    deviceId = getDeviceId();

    function t(key){
        var chain = lang === 'va' ? ['va', 'ca', 'es'] : [lang, 'es'];
        for(var i = 0; i < chain.length; i++){
            var dict = i18n[chain[i]];
            if(dict && dict[key]) return dict[key];
        }
        return key;
    }

    function format(str, data){
        if(!str) return '';
        return str.replace(/{(\w+)}/g, function(_, k){ return data[k] !== undefined ? data[k] : ''; });
    }

    function applyStaticText(){
        document.querySelectorAll('[data-i18n]').forEach(function(el){
            var key = el.getAttribute('data-i18n');
            if(el.classList && el.classList.contains('is-icon')){
                var label = t(key);
                el.setAttribute('aria-label', label);
                var sr = el.querySelector('.sr-only');
                if(sr) sr.textContent = label;
            }else{
                el.textContent = t(key);
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el){
            var key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = t(key);
        });
        var langSelect = document.getElementById('lang-select');
        if(langSelect){
            langSelect.value = lang;
        }
    }

    function getAllTagsFromQuizzes(){
        var map = {};
        state.quizzes.forEach(function(q){
            var list = Array.isArray(q.tags) ? q.tags : [];
            list.forEach(function(tag){
                var clean = (tag || '').toString().trim();
                if(!clean) return;
                var key = clean.toLowerCase();
                if(!map[key]) map[key] = { tag: clean, count: 0 };
                map[key].count++;
            });
        });
        var items = Object.keys(map).map(function(k){ return map[k]; });
        items.sort(function(a, b){
            if(b.count !== a.count) return b.count - a.count;
            return a.tag.localeCompare(b.tag);
        });
        return items;
    }

    var tagFilterExpanded = false;

    function parseTagFiltersFromUrl(){
        try{
            var params = new URLSearchParams(window.location.search || '');
            var values = [];
            var single = params.get('tag');
            var multi = params.get('tags');
            var tagMode = params.get('tagMode');
            if(single) values.push(single);
            if(multi){
                multi.split(',').forEach(function(tag){
                    values.push(tag);
                });
            }
            var seen = {};
            var normalized = values.map(function(tag){
                return (tag || '').toString().trim();
            }).filter(function(tag){
                if(!tag) return false;
                var key = tag.toLowerCase();
                if(seen[key]) return false;
                seen[key] = true;
                return true;
            });
            if(normalized.length){
                state.filters.tags = normalized;
                state.filters.tagMode = tagMode === 'all' ? 'all' : 'any';
            }
        }catch(e){}
    }

    function getSoloTagQueryParams(){
        var params = new URLSearchParams();
        if(state.filters.tags.length === 1){
            params.set('tag', state.filters.tags[0]);
        }else if(state.filters.tags.length > 1){
            params.set('tags', state.filters.tags.join(','));
            if(state.filters.tagMode === 'all'){
                params.set('tagMode', 'all');
            }
        }
        return params;
    }

    function syncSoloUrl(){
        try{
            var url = new URL(window.location.href);
            url.searchParams.delete('tag');
            url.searchParams.delete('tags');
            url.searchParams.delete('tagMode');
            getSoloTagQueryParams().forEach(function(value, key){
                url.searchParams.set(key, value);
            });
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
        }catch(e){}
    }

    function ensureTagToggleButton(total){
        var clearBtn = document.getElementById('tags-clear');
        if(!clearBtn || !clearBtn.parentElement) return;
        var actions = clearBtn.parentElement;
        var btn = document.getElementById('tags-toggle');
        if(!btn){
            btn = document.createElement('button');
            btn.id = 'tags-toggle';
            btn.type = 'button';
            btn.className = 'tag-filter__btn is-icon';
            btn.setAttribute('aria-label', t('filterTagShowMore'));
            btn.innerHTML = '<span class="tag-filter__icon" aria-hidden="true">▾</span><span class="sr-only"></span>';
            btn.addEventListener('click', function(){
                tagFilterExpanded = !tagFilterExpanded;
                updateTagFilterOptions();
            });
            actions.insertBefore(btn, clearBtn);
        }
        var label = tagFilterExpanded ? t('filterTagShowLess') : t('filterTagShowMore');
        var icon = tagFilterExpanded ? '▴' : '▾';
        btn.setAttribute('aria-label', label);
        var iconEl = btn.querySelector('.tag-filter__icon');
        if(iconEl) iconEl.textContent = icon;
        var sr = btn.querySelector('.sr-only');
        if(sr) sr.textContent = label;
        btn.style.display = total > 0 ? '' : 'none';
    }

    function getVisibleTagItems(allItems){
        return tagFilterExpanded ? allItems : [];
    }

    // Normaliza tildes y mayúsculas para comparar etiquetas
    function normalizeTag(str) {
        return (str || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function updateTagFilterOptions(){
        var wrap = document.getElementById('tag-filter');
        if(!wrap) return;
        var allItems = getAllTagsFromQuizzes();
        var allKeys = {};
        allItems.forEach(function(it){ allKeys[normalizeTag(it.tag)] = it.tag; });
        wrap.innerHTML = '';
        state.filters.tags = state.filters.tags.map(function(tag){
            var key = normalizeTag(tag);
            // Normalizar al caso exacto que usan los quizzes; si no se encuentra,
            // conservar el valor original para no perder filtros cargados desde URL.
            return allKeys[key] || tag;
        }).filter(function(tag){
            return !!(tag && tag.toString().trim());
        });
        syncSoloUrl();

        ensureTagToggleButton(allItems.length);
        if(!tagFilterExpanded) return;
        var items = getVisibleTagItems(allItems);

        items.forEach(function(item){
            var tag = item.tag;
            var label = document.createElement('label');
            label.className = 'tag-filter__item';
            var input = document.createElement('input');
            input.type = 'checkbox';
            input.value = tag;
            input.checked = state.filters.tags.indexOf(tag) !== -1;
            input.addEventListener('change', function(){
                var selected = [];
                var inputs = wrap.querySelectorAll('input[type="checkbox"]');
                Array.prototype.forEach.call(inputs, function(el){
                    if(el.checked) selected.push(el.value);
                });
                state.filters.tags = selected;
                state.page = 0;
                syncSoloUrl();
                renderList();
            });
            var span = document.createElement('span');
            span.textContent = tag;
            label.appendChild(input);
            label.appendChild(span);
            wrap.appendChild(label);
        });
    }

function setLang(newLang){
    lang = newLang;
    persistLang(lang);
    applyStaticText();
    updateTagFilterOptions();
    renderList();
    renderSelectedMeta();
    updateSoloMusicLabels();
}

function updateSoloMusicLabels(){
    if(!soloMusicPlayerInstance || typeof soloMusicPlayerInstance.updateLabels !== 'function') return;
    soloMusicPlayerInstance.updateLabels({
        title: t('bgMusicTitle'),
        choose: t('bgMusicChoose'),
        play: t('bgMusicPlay'),
        pause: t('bgMusicPause'),
        prev: t('bgMusicPrev'),
        next: t('bgMusicNext'),
        volume: t('bgMusicVolume')
    });
}

function clampInt(val, min, max){
    var n = parseInt(val, 10);
    if(isNaN(n)) return null;
    if(typeof min === 'number' && n < min) n = min;
    if(typeof max === 'number' && n > max) n = max;
    return n;
}

function getQuizTotalQuestions(){
    if(state.quizData && Array.isArray(state.quizData.questions)) return state.quizData.questions.length;
    return 0;
}

function syncQuestionCountControls(){
    var input = document.getElementById('question-count');
    var totalEl = document.getElementById('question-count-total');
    var total = getQuizTotalQuestions();

    if(totalEl){
        totalEl.textContent = total ? format(t('questionCountTotal'), { total: total }) : '';
    }
    if(!input) return;

    if(total > 0){
        input.max = String(total);
        input.disabled = false;
        // Por defecto: máximo.
        if(state.desiredQuestionCount == null){
            input.value = String(total);
        }
    }else{
        input.max = '';
        input.value = '';
        input.disabled = true;
    }
}

function syncQuestionTimeControls(){
    var input = document.getElementById('question-time');
    if(!input) return;
    if(state.desiredQuestionTime == null){
        input.value = '';
        return;
    }
    input.value = String(state.desiredQuestionTime);
}

function getDesiredQuestionCount(){
    var total = getQuizTotalQuestions();
    if(total <= 0) return 0;

    // Si ya se ha elegido una vez (p.ej. Play again), reutiliza.
    if(typeof state.desiredQuestionCount === 'number' && isFinite(state.desiredQuestionCount) && state.desiredQuestionCount > 0){
        return Math.max(1, Math.min(total, Math.round(state.desiredQuestionCount)));
    }

    var input = document.getElementById('question-count');
    var chosen = input ? clampInt(input.value, 1, total) : null;
    if(chosen == null) chosen = total;
    return chosen;
}

function renderSelectedMeta(){
    var meta = document.getElementById('selected-meta');
    if(!meta) return;
    if(!state.quizData){
        meta.textContent = t('startSelect');
        syncQuestionCountControls();
        syncQuestionTimeControls();
        return;
    }
    var count = Array.isArray(state.quizData.questions) ? state.quizData.questions.length : 0;
    var tags = Array.isArray(state.quizData.tags) ? state.quizData.tags.join(', ') : (Array.isArray(state.quizData.questionsTags) ? state.quizData.questionsTags.join(', ') : '');
    meta.textContent = format(t('selectedMeta'), { count: count, tags: tags || '—' });
    syncQuestionCountControls();
    syncQuestionTimeControls();
}

    function normalizeName(str){
        return (str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 3);
    }

    function mediaThumb(data){
        if(!data) return '';
        var yt = parseYouTubeId(data);
        if(yt){
            return 'https://img.youtube.com/vi/' + yt + '/hqdefault.jpg';
        }
        return normalizeSvgDataUrlForImg(data);
    }

    function shuffleArray(arr){
        var copy = arr.slice();
        for(var i = copy.length - 1; i > 0; i--){
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy;
    }

    function normalizeFreeText(value){
        var str = (value || '').toString().trim().toLowerCase();
        if(!str) return '';
        try{
            str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }catch(e){}
        str = str.replace(/[^a-z0-9\s]/g, ' ');
        str = str.replace(/\s+/g, ' ').trim();
        return str;
    }

    function splitAcceptedAnswers(raw){
        var text = (raw || '').toString().trim();
        if(!text) return [];
        var parts = text.split(/[|\n]+/g);
        var flat = [];
        parts.forEach(function(chunk){
            String(chunk || '').split(',').forEach(function(p){ flat.push(p); });
        });
        var out = [];
        var seen = {};
        flat.forEach(function(part){
            var original = (part || '').toString().trim();
            if(!original) return;
            var key = normalizeFreeText(original);
            if(!key) return;
            if(seen[key]) return;
            seen[key] = true;
            out.push(original);
        });
        return out;
    }

    function parseLenientNumber(value){
        if(value === undefined || value === null) return null;
        if(typeof value === 'number' && Number.isFinite(value)) return value;
        var raw = String(value).trim();
        if(!raw) return null;
        var normalized = raw.replace(/\s+/g, '').replace(',', '.');
        var num = Number.parseFloat(normalized);
        return Number.isFinite(num) ? num : null;
    }

    function normalizeQuestionMeta(q){
        var type = (q && q.type) ? String(q.type).toLowerCase() : 'quiz';
        var allowed = { 'quiz': true, 'multiple': true, 'true-false': true, 'short-answer': true, 'numeric': true };
        if(!allowed[type]){
            type = 'quiz';
        }

        var acceptedAnswers = [];
        var numericAnswer = null;
        var tolerance = 0;
        if(type === 'short-answer'){
            if(Array.isArray(q && q.acceptedAnswers)){
                acceptedAnswers = q.acceptedAnswers.slice();
            }else{
                acceptedAnswers = splitAcceptedAnswers((q && (q.texto || q.text || q.correctText || q.correct)) || '');
            }
        }
        if(type === 'numeric'){
            numericAnswer = parseLenientNumber(q && (q.numericAnswer !== undefined ? q.numericAnswer : (q.numero !== undefined ? q.numero : q.correct)));
            var tol = parseLenientNumber(q && (q.tolerance !== undefined ? q.tolerance : q.tolerancia));
            tolerance = (tol === null) ? 0 : tol;
        }

        // Para tipos no indexados mantenemos compatibilidad (correctAnswers = [1]).
        if(type === 'short-answer' || type === 'numeric'){
            return {
                type: type,
                correctAnswers: [1],
                correct: 1,
                acceptedAnswers: acceptedAnswers,
                numericAnswer: numericAnswer,
                tolerance: tolerance
            };
        }

        var answers = Array.isArray(q && q.correctAnswers) ? q.correctAnswers.slice() : [];
        if(!answers.length && q && typeof q.correct !== 'undefined'){
            var parsed = parseInt(q.correct, 10);
            if(!Number.isNaN(parsed)){
                answers.push(parsed);
            }
        }
        if(!answers.length){
            answers.push(1);
        }
        var maxAnswerIndex = (type === 'true-false') ? 2 : 4;
        var normalized = answers.map(function(value){
            var num = parseInt(value, 10);
            if(Number.isNaN(num)) return 1;
            return Math.max(1, Math.min(maxAnswerIndex, num));
        });
        var first = normalized.length ? normalized[0] : 1;
        return {
            type: type,
            correctAnswers: normalized,
            correct: first,
            acceptedAnswers: [],
            numericAnswer: null,
            tolerance: null
        };
    }

    function getVisibleAnswers(q, type){
        if(type === 'short-answer' || type === 'numeric'){
            return [];
        }
        var answers = Array.isArray(q && q.answers) ? q.answers.slice(0, 4) : ['', '', '', ''];
        while(answers.length < 4) answers.push('');
        if(type === 'true-false'){
            return answers.slice(0, 2);
        }
        return answers;
    }

    function areAnswerSetsEqual(left, right){
        if(!Array.isArray(left) || !Array.isArray(right)) return false;
        var sortedLeft = left.slice().sort(function(a, b){ return a - b; });
        var sortedRight = right.slice().sort(function(a, b){ return a - b; });
        if(sortedLeft.length !== sortedRight.length) return false;
        for(var i = 0; i < sortedLeft.length; i++){
            if(sortedLeft[i] !== sortedRight[i]) return false;
        }
        return true;
    }

    function randomizeOneQuestion(q){
        var meta = normalizeQuestionMeta(q);

        if(meta.type === 'short-answer' || meta.type === 'numeric'){
            return {
                question: q.question || '',
                answers: Array.isArray(q.answers) ? q.answers.slice(0, 4) : ['', '', '', ''],
                correct: 1,
                correctAnswers: [1],
                type: meta.type,
                image: q.image || '',
                video: q.video || '',
                time: q.time,
                acceptedAnswers: Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers : [],
                numericAnswer: meta.numericAnswer,
                tolerance: meta.tolerance
            };
        }

        var answers = Array.isArray(q.answers) ? q.answers.slice(0, 4) : ['', '', '', ''];
        while(answers.length < 4) answers.push('');

        // En true/false solo se muestran 2 opciones: barajamos solo 2 para que
        // el índice correcto no quede oculto fuera del slice(0,2).
        var baseOrder = (meta.type === 'true-false') ? [0, 1] : [0, 1, 2, 3];
        var answerOrder = shuffleArray(baseOrder);
        var newAnswers = answerOrder.map(function(idx){ return answers[idx]; });
        if(meta.type === 'true-false'){
            while(newAnswers.length < 4) newAnswers.push('');
        }
        var newCorrectAnswers = [];
        meta.correctAnswers.forEach(function(orig){
            var zero = Math.max(0, Math.min(3, orig - 1));
            var newIdx = answerOrder.indexOf(zero);
            if(newIdx !== -1){
                var candidate = newIdx + 1;
                if(newCorrectAnswers.indexOf(candidate) === -1){
                    newCorrectAnswers.push(candidate);
                }
            }
        });
        if(!newCorrectAnswers.length){
            newCorrectAnswers.push(1);
        }
        var newCorrect = newCorrectAnswers[0];
        return {
            question: q.question || '',
            answers: newAnswers,
            correct: newCorrect,
            correctAnswers: newCorrectAnswers,
            type: meta.type,
            image: q.image || '',
            video: q.video || '',
            time: q.time
        };
    }

    function randomizeQuestions(baseQuestions){
        var source = Array.isArray(baseQuestions) ? baseQuestions : [];
        var shuffledOrder = shuffleArray(source);
        return shuffledOrder.map(function(q){ return randomizeOneQuestion(q); });
    }

    function getQuestions(){
        if(Array.isArray(state.questions) && state.questions.length) return state.questions;
        if(state.quizData && Array.isArray(state.quizData.questions)) return state.quizData.questions;
        return [];
    }

    function findMediaInQuestions(questions){
        if(!Array.isArray(questions)) return '';
        var withMedia = questions.filter(function(q){ return q && (q.image || q.video); });
        if(!withMedia.length) return '';
        var random = withMedia[Math.floor(Math.random() * withMedia.length)];
        return mediaThumb(random.image || random.video || '');
    }

    function fetchPublicQuizzes(){
        var list = document.getElementById('public-list');
        var empty = document.getElementById('public-empty');
        var params = getSoloTagQueryParams();
        var qs = params.toString();
        var endpoint = '/api/public-quizzes' + (qs ? '?' + qs : '');
        if(empty) empty.textContent = t('loading');
        fetch(endpoint)
            .then(function(res){ return res.json(); })
            .then(function(data){
                state.quizzes = shuffleArray(Array.isArray(data) ? data : []);
                state.page = 0;
                updateTagFilterOptions();
                renderList();
                if(qs){
                    fetch('/api/public-quizzes')
                        .then(function(res){ return res.json(); })
                        .then(function(allData){
                            state.quizzes = shuffleArray(Array.isArray(allData) ? allData : []);
                            updateTagFilterOptions();
                            renderList();
                        })
                        .catch(function(){});
                }
            })
            .catch(function(){
                if(list) list.innerHTML = '';
                if(empty) empty.textContent = t('publicEmpty');
            });
    }

function renderList(){
    var list = document.getElementById('public-list');
        var empty = document.getElementById('public-empty');
        if(!list) return;
        list.innerHTML = '';
        var searchVal = (document.getElementById('search') && document.getElementById('search').value || '').toLowerCase();
        var minQ = parseInt(state.filters.minQuestions, 10);
        var maxQ = parseInt(state.filters.maxQuestions, 10);
        if(Number.isNaN(minQ)) minQ = null;
        if(Number.isNaN(maxQ)) maxQ = null;
        var filtered = state.quizzes.filter(function(q){
            if(!searchVal) return true;
            var haystack = (q.name || '') + ' ' + (Array.isArray(q.tags) ? q.tags.join(' ') : '');
            return haystack.toLowerCase().includes(searchVal);
        });
        if(state.filters.tags.length){
            var filterTagsNorm = state.filters.tags.map(normalizeTag);
            filtered = filtered.filter(function(q){
                var tags = (Array.isArray(q.tags) ? q.tags : []).map(normalizeTag);
                if(state.filters.tagMode === 'all'){
                    return filterTagsNorm.every(function(tag){ return tags.indexOf(tag) !== -1; });
                }
                return filterTagsNorm.some(function(tag){ return tags.indexOf(tag) !== -1; });
            });
        }
        if(minQ !== null){
            filtered = filtered.filter(function(q){
                var count = typeof q.questionsCount === 'number' ? q.questionsCount : 0;
                return count >= minQ;
            });
        }
        if(maxQ !== null){
            filtered = filtered.filter(function(q){
                var count = typeof q.questionsCount === 'number' ? q.questionsCount : 0;
                return count <= maxQ;
            });
        }
        if(state.filters.onlyImage){
            filtered = filtered.filter(function(q){
                return !!(q.coverImage);
            });
        }
        if(filtered.length === 0){
            if(empty) empty.textContent = t('publicEmpty');
            return;
        }
        if(empty) empty.textContent = '';
        var totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
        if(state.page >= totalPages){
            state.page = totalPages - 1;
        }
        var favorites = [];
        var nonFavorites = [];
        filtered.forEach(function(q){
            if(isFavorite(q.id)){
                favorites.push(q);
            }else{
                nonFavorites.push(q);
            }
        });
        favorites = sortPublicQuizzes(favorites);
        nonFavorites = sortPublicQuizzes(nonFavorites);
        filtered = favorites.concat(nonFavorites);
        var start = state.page * state.pageSize;
        var pageItems = filtered.slice(start, start + state.pageSize);
        pageItems.forEach(function(q){
            var card = document.createElement('div');
            card.className = 'card';
            var thumb = document.createElement('div');
            thumb.className = 'card-thumb placeholder';
            var img = document.createElement('img');
            img.alt = '';
            var thumbUrl = mediaThumb(q.coverImage || q.coverVideo);
            if(thumbUrl){
                img.onload = function(){
                    thumb.classList.add('has-media');
                    thumb.classList.remove('placeholder');
                };
                img.onerror = function(){
                    thumb.classList.remove('has-media');
                    thumb.classList.add('placeholder');
                    img.removeAttribute('src');
                };
                img.src = thumbUrl;
            } else {
                img.onload = function(){
                    thumb.classList.add('has-media');
                    thumb.classList.remove('placeholder');
                };
                img.src = '/icons/logo.svg';
                // keep placeholder background without text
                // Fallback: intenta obtener media del quiz completo
                fetch('/api/quizzes/' + encodeURIComponent(q.id))
                    .then(function(res){ return res.json(); })
                    .then(function(body){
                        var altThumb = findMediaInQuestions(body.questions || []);
                        if(altThumb){
                            img.onload = function(){
                                thumb.classList.add('has-media');
                                thumb.classList.remove('placeholder');
                            };
                            img.onerror = function(){
                                thumb.classList.remove('has-media');
                                thumb.classList.add('placeholder');
                                img.removeAttribute('src');
                            };
                            img.src = altThumb;
                        }
                    })
                    .catch(function(){});
            }
            thumb.appendChild(img);
            card.appendChild(thumb);
            var header = document.createElement('div');
            header.className = 'card-header';
            var title = document.createElement('h3');
            title.textContent = q.name || 'Quiz';
            var favBtn = document.createElement('button');
            favBtn.type = 'button';
            favBtn.className = 'favorite-btn';
            favBtn.addEventListener('click', function(ev){
                ev.stopPropagation();
                toggleFavorite(q.id);
                updateFavoriteButton(favBtn, q.id);
            });
            updateFavoriteButton(favBtn, q.id);
            header.appendChild(title);
            header.appendChild(favBtn);
            var meta = document.createElement('p');
            meta.className = 'muted';
            meta.textContent = format(t('byline'), { count: q.questionsCount || 0 });
            var tagsWrap = document.createElement('div');
            if(Array.isArray(q.tags)){
                q.tags.forEach(function(tag){
                    var el = document.createElement('span');
                    el.className = 'tag';
                    el.textContent = tag;
                    tagsWrap.appendChild(el);
                });
            }
            var ratingWrap = document.createElement('div');
            ratingWrap.className = 'card-rating';
            var ratingStars = document.createElement('div');
            ratingStars.className = 'rating-stars';
            for(var i = 1; i <= 5; i++){
                (function(stars){
                    var starBtn = document.createElement('button');
                    starBtn.type = 'button';
                    starBtn.className = 'rating-star';
                    starBtn.setAttribute('data-value', String(stars));
                    starBtn.textContent = '★';
                    var label = format(t('ratingStarLabel'), { stars: stars });
                    starBtn.setAttribute('aria-label', label);
                    starBtn.title = label;
                    starBtn.addEventListener('click', function(ev){
                        ev.stopPropagation();
                        updateRatingStars(ratingStars, stars);
                        setUserRating(q.id, stars);
                        submitRating(q.id, stars, ratingSummary, ratingStars, q);
                    });
                    ratingStars.appendChild(starBtn);
                })(i);
            }
            var ratingSummary = document.createElement('span');
            ratingSummary.className = 'rating-summary muted';
            var avg = Number(q && q.ratingAvg);
            if(!Number.isFinite(avg)) avg = 0;
            var count = Number(q && q.ratingCount);
            if(!Number.isFinite(count)) count = 0;
            count = Math.max(0, Math.round(count));
            ratingSummary.textContent = formatRatingSummary(avg, count);
            var userRating = getUserRating(q.id);
            var displayRating = userRating ? userRating : Math.round(avg || 0);
            updateRatingStars(ratingStars, displayRating);
            ratingWrap.appendChild(ratingStars);
            ratingWrap.appendChild(ratingSummary);
            var stats = document.createElement('div');
            stats.className = 'card-stats';
            var plays = q.playsCount || 0;
            var players = q.playersCount || 0;
            stats.textContent = plays + ' ' + t('playsShort') + ' · ' + players + ' ' + t('playersShort');
            var btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = t('playCta');
            btn.onclick = function(){ ensureSoloMusicPlaying(); selectQuiz(q.id); };
            card.appendChild(header);
            card.appendChild(meta);
            card.appendChild(tagsWrap);
            card.appendChild(ratingWrap);
            card.appendChild(stats);
            var cardLinks = document.createElement('div');
            cardLinks.className = 'card-links';
            var rankingLink = document.createElement('button');
            rankingLink.type = 'button';
            rankingLink.className = 'card-link';
            rankingLink.textContent = t('viewRanking');
            rankingLink.onclick = function(e){
                e.stopPropagation();
                showQuizRanking(q.id);
            };
            cardLinks.appendChild(rankingLink);
            card.appendChild(cardLinks);
            card.appendChild(btn);
            list.appendChild(card);
        });
        renderPagination(filtered.length);
    }

    function renderPagination(totalFiltered){
        var controls = document.getElementById('public-pagination');
        if(!controls) return;
        controls.innerHTML = '';
        var totalPages = Math.max(1, Math.ceil(totalFiltered / state.pageSize));
        if(totalPages <= 1){
            controls.classList.add('hidden');
            return;
        }
        controls.classList.remove('hidden');
        var prev = document.createElement('button');
        prev.textContent = '<';
        prev.disabled = state.page === 0;
        prev.onclick = function(){
            if(state.page > 0){
                state.page -= 1;
                renderList();
            }
        };
        var info = document.createElement('span');
        info.textContent = (state.page + 1) + ' / ' + totalPages;
        var next = document.createElement('button');
        next.textContent = '>';
        next.disabled = state.page >= totalPages - 1;
        next.onclick = function(){
            if(state.page < totalPages - 1){
                state.page += 1;
                renderList();
            }
        };
        controls.appendChild(prev);
        controls.appendChild(info);
        controls.appendChild(next);
    }

function initSoloMusicPlayer(){
    if(typeof initBackgroundMusic !== 'function') return;

    // Evita duplicar el widget si ya está inicializado.
    if(soloMusicPlayerInstance && soloMusicPlayerInstance.audio) return;

    // Migración: la clave antigua guardaba la URL de la pista.
    try{
        if(!localStorage.getItem(SOLO_MUSIC_STORAGE_KEY)){
            var legacy = localStorage.getItem(SOLO_MUSIC_STORAGE_KEY_LEGACY);
            if(legacy){
                localStorage.setItem(SOLO_MUSIC_STORAGE_KEY, legacy);
            }
        }
    }catch(e){}

    soloMusicPlayerInstance = initBackgroundMusic('#solo-music-player', {
        storageKey: SOLO_MUSIC_STORAGE_KEY,
        randomStart: true,
        volume: 0.6
    });
    updateSoloMusicLabels();
}

function ensureSoloMusicPlaying(){
    if(!soloMusicPlayerInstance) return;
    if(typeof soloMusicPlayerInstance.play === 'function'){
        soloMusicPlayerInstance.play();
        return;
    }
    if(!soloMusicPlayerInstance.audio) return;
    var audio = soloMusicPlayerInstance.audio;
    if(!audio.paused) return;
    audio.play().catch(function(){});
}

function pauseSoloMusic(){
    if(!soloMusicPlayerInstance) return;
    if(typeof soloMusicPlayerInstance.pause === 'function'){
        soloMusicPlayerInstance.pause();
        return;
    }
    if(!soloMusicPlayerInstance.audio) return;
    try{ soloMusicPlayerInstance.audio.pause(); }catch(e){}
}

    function selectQuiz(id){
        var title = document.getElementById('selected-title');
        var startForm = document.getElementById('start-form');
        var gameArea = document.getElementById('game-area');
        var resultArea = document.getElementById('result-area');
        var gamePanel = document.getElementById('game-panel');
        if(title) title.textContent = t('loading');
        if(startForm) startForm.classList.add('hidden');
        if(gameArea) gameArea.classList.add('hidden');
        if(resultArea) resultArea.classList.add('hidden');
        fetch('/api/quizzes/' + encodeURIComponent(id))
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                if(!payload.ok){
                    if(title) title.textContent = t('startError');
                    return;
                }
                state.quizData = payload.body;
                state.currentQuiz = payload.body.id;
                if(title) title.textContent = payload.body.name || t('soloTitle');
                document.body.classList.add('playing');
                if(gamePanel) gamePanel.classList.remove('hidden');
                // Nuevo flujo: antes de empezar, elegir cuántas preguntas jugar.
                state.desiredQuestionCount = null;
                renderSelectedMeta();
                if(startForm) startForm.classList.remove('hidden');
            })
            .catch(function(){
                if(title) title.textContent = t('startError');
            });
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
        var correctAnswerText = '';

        if(meta.type === 'short-answer'){
            var rawText = timedOut ? '' : (typeof choice === 'string' ? choice : String(choice || ''));
            var normalized = normalizeFreeText(rawText);
            var accepted = Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers : splitAcceptedAnswers(meta.acceptedAnswers);
            isCorrect = !!normalized && accepted.some(function(ans){ return normalizeFreeText(ans) === normalized; });
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
            var correctList = Array.isArray(meta.correctAnswers) && meta.correctAnswers.length ? meta.correctAnswers : [(parseInt(q.correct, 10) || 1)];
            if(meta.type === 'multiple'){
                isCorrect = areAnswerSetsEqual(selected, correctList);
            }else{
                isCorrect = selected.length && selected[0] === (meta.correct || correctList[0] || 1);
            }

            if(answersWrap){
                Array.prototype.slice.call(answersWrap.querySelectorAll('button.answer')).forEach(function(btnEl, idx){
                    var n = idx + 1;
                    btnEl.disabled = true;
                    if(correctList.indexOf(n) !== -1){
                        btnEl.classList.add('correct');
                    }
                    if(selected.indexOf(n) !== -1 && !isCorrect){
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

        if(isCorrect){
            state.correct += 1;
            var bonus = Math.round(1000 * Math.max(0, Math.min(1, state.timerLeft / state.timerTotal)));
            state.score += bonus;
        }
        if(feedback){
            if(timedOut){
                feedback.classList.remove('feedback--success', 'feedback--error');
                feedback.classList.add('feedback--muted');
                feedback.textContent = t('timeup');
            }else if(isCorrect){
                feedback.classList.remove('feedback--muted', 'feedback--error');
                feedback.classList.add('feedback--success');
                feedback.textContent = t('correctText');
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
        if(isCorrect){
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
            var totalQs = getQuestions().length;
            summary.textContent = format(t('resultSummary'), {
                correct: state.correct,
                total: totalQs,
                score: state.score
            });
        }
        var ranking = document.getElementById('ranking');
        var rankingList = document.getElementById('ranking-list');
        if(ranking) ranking.classList.add('hidden');
        if(rankingList) rankingList.innerHTML = '';
        prepareScoreSubmission();
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
                totalQuestions: getQuestions().length
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
})();
