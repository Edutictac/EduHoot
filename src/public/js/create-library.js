// Cuestionarios por página de la biblioteca. Con sesión se guarda en la cuenta (/api/auth/preferences, mismos valores
// que el servidor); sin sesión, en el navegador.
var LIBRARY_PAGE_SIZES = [6, 12, 24, 48, 96];
var LIBRARY_PAGE_SIZE = 6;
var LIBRARY_PAGE_SIZE_KEY = 'eduhoot-library-page-size';
// Transparència de la imatge de fons de les targetes: 0 (sense imatge), 10, 20 (per defecte) o 30 %. Amb sessió, es guarda a la cuenta.
var LIBRARY_COVERS_KEY = 'eduhoot-library-cover-level';
var LIBRARY_COVER_LEVELS = [0, 10, 20, 30];
// Vista de la biblioteca: targetes (per defecte) o detall; es recorda al navegador.
var LIBRARY_VIEW_KEY = 'eduhoot-view-biblioteca';
function readLibraryView(){
    try{ return localStorage.getItem(LIBRARY_VIEW_KEY) === 'detail' ? 'detail' : 'cards'; }catch(e){ return 'cards'; }
}
function readLibraryCoverLevel(){
    try{
        var v = parseInt(localStorage.getItem(LIBRARY_COVERS_KEY), 10);
        if(LIBRARY_COVER_LEVELS.indexOf(v) !== -1) return v;
    }catch(e){}
    return 20;
}

// Biblioteca de /create/: etiquetas, filtros (también en la URL), listado y paginación, extraído de create.js
function getTagsFromLibraryData(data){
    var tags = new Set();
    if(!data) return [];
    var entries = data || {};
    var entriesLength = Object.keys(entries).length;
    for(var i = 0; i < entriesLength; i++){
        var q = entries[i];
        if(!q) continue;
        var tgs = Array.isArray(q.tags) ? q.tags : [];
        if(!tgs.length) continue;
        tgs.forEach(function(t){
            var clean = normalizeTagSlug(t);
            if(!clean) return;
            tags.add(clean);
        });
    }
    return Array.from(tags).filter(Boolean).slice(0, 40);
}

function getTagFrequencies(data){
    var frequencies = {};
    if(!data) return frequencies;
    var entries = Array.isArray(data) ? data : Object.values(data);
    entries.forEach(function(quiz){
        if(!quiz) return;
        var tagList = Array.isArray(quiz.tags) ? quiz.tags : [];
        tagList.forEach(function(raw){
            var clean = normalizeTagSlug(raw);
            if(!clean) return;
            frequencies[clean] = (frequencies[clean] || 0) + 1;
        });
    });
    return frequencies;
}

function getQuizTimestamp(quiz){
    if(!quiz) return 0;
    var raw = quiz.createdAt || quiz.updatedAt || quiz.id;
    var parsed = Date.parse(raw);
    if(!isNaN(parsed)) return parsed;
    return 0;
}

// Data de creació o modificació en text curt (dd/mm/aaaa hh:mm). Els quizzes antics sense data real
// (el servidor els marca amb 1970) no mostren res.
var QUIZ_DATE_MIN_MS = Date.UTC(2000, 0, 1);
function formatQuizDate(value){
    var ms = Date.parse(value);
    if(!(ms > QUIZ_DATE_MIN_MS)) return '';
    var locale = lang === 'en' ? 'en-GB' : { fr: 'fr-FR', de: 'de-DE', it: 'it-IT', pt: 'pt-PT', bg: 'bg-BG' }[lang] || (lang === 'ca' || lang === 'va' ? 'ca-ES' : 'es-ES');
    return new Date(ms).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getQuizRatingAvg(quiz){
    var avg = Number(quiz && quiz.ratingAvg);
    return Number.isFinite(avg) ? avg : 0;
}

function getQuizRatingCount(quiz){
    var count = Number(quiz && quiz.ratingCount);
    return Number.isFinite(count) ? count : 0;
}

function sortLibraryQuizzes(quizzes){
    if(!quizzes || !quizzes.slice) return quizzes;
    var sorted = quizzes.slice();
    var currentSort = libState.sort;
    if(currentSort === 'newest'){
        sorted.sort(function(a, b){
            return getQuizTimestamp(b) - getQuizTimestamp(a);
        });
    }else if(currentSort === 'oldest'){
        sorted.sort(function(a, b){
            return getQuizTimestamp(a) - getQuizTimestamp(b);
        });
    }else if(currentSort === 'played'){
        // Més jugats primer; a igualtat, el més recent.
        sorted.sort(function(a, b){
            var pa = Number(a.playsCount) || 0;
            var pb = Number(b.playsCount) || 0;
            if(pa === pb) return getQuizTimestamp(b) - getQuizTimestamp(a);
            return pb - pa;
        });
    }else if(currentSort === 'rating'){
        sorted.sort(function(a, b){
            var ra = getQuizRatingAvg(a);
            var rb = getQuizRatingAvg(b);
            if(ra === rb){
                var ca = getQuizRatingCount(a);
                var cb = getQuizRatingCount(b);
                if(ca === cb){
                    return getQuizTimestamp(b) - getQuizTimestamp(a);
                }
                return cb - ca;
            }
            return rb - ra;
        });
    }else if(currentSort === 'alpha-asc'){
        sorted.sort(function(a, b){
            var na = (a.name || '').toLowerCase();
            var nb = (b.name || '').toLowerCase();
            return na.localeCompare(nb);
        });
    }else if(currentSort === 'alpha-desc'){
        sorted.sort(function(a, b){
            var na = (a.name || '').toLowerCase();
            var nb = (b.name || '').toLowerCase();
            return nb.localeCompare(na);
        });
    }
    return sorted;
}

function normalizeTagSlug(raw){
    var clean = (raw || '').toString().trim().toLowerCase();
    if(!clean) return '';
    try{ clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }catch(e){}
    clean = clean.replace(
        /(^|[^a-z0-9])(\d+)\s*[\.\-]?\s*(º|ª|°|o|a|er|ero|era|ro|ra|do|da|to|ta|mo|ma|vo|va)(?=$|[^a-z0-9])/g,
        '$1$2'
    );
    clean = clean
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)
        .replace(/^-|-$/g, '');
    return clean;
}

function normalizeInlineTags(list){
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function(raw){
        var clean = normalizeTagSlug(raw);
        if(!clean) return;
        if(out.indexOf(clean) === -1) out.push(clean);
    });
    return out;
}

function parseTagInput(raw){
    if(!raw) return [];
    return normalizeInlineTags((raw || '').toString().split(/[,;]+/));
}

// «Sólo mis cuestionarios» se recuerda mientras dure la sesión del navegador (también al volver de editar o jugar).
var MINE_ONLY_KEY = 'eduhoot-library-mine-only';
function storedMineOnly(){
    try{
        var v = sessionStorage.getItem(MINE_ONLY_KEY);
        return v === '1' ? true : (v === '0' ? false : null);
    }catch(e){ return null; }
}
function storeMineOnly(value){
    try{
        if(value === null) sessionStorage.removeItem(MINE_ONLY_KEY);
        else sessionStorage.setItem(MINE_ONLY_KEY, value ? '1' : '0');
    }catch(e){}
}

function readFiltersFromUrl(){
    try{
        var params = new URLSearchParams(window.location.search || '');
        var tagValues = params.getAll('tags');
        var singleTag = params.get('tag');
        if(singleTag) tagValues.push(singleTag);
        var exploded = [];
        tagValues.forEach(function(value){
            (value || '').split(',').forEach(function(part){ exploded.push(part); });
        });
        currentFilters.tags = normalizeInlineTags(exploded);
        currentFilters.tagMode = params.get('tagMode') === 'any' ? 'any' : 'all';
    }catch(e){}
}

function syncFiltersToUrl(){
    try{
        var url = new URL(window.location.href);
        url.searchParams.delete('tags');
        url.searchParams.delete('tag');
        url.searchParams.delete('tagMode');
        currentFilters.tags.forEach(function(tag){
            url.searchParams.append('tags', tag);
        });
        if(currentFilters.tags.length){
            url.searchParams.set('tagMode', currentFilters.tagMode || 'all');
        }
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }catch(e){}
}

// Estado reactivo de la biblioteca (Subfase B, bloque 1). La plantilla
// #library-tpl lo lee; las funciones de abajo solo lo modifican.
function readLibraryPageSize(){
    try{
        var v = parseInt(localStorage.getItem(LIBRARY_PAGE_SIZE_KEY), 10);
        if(LIBRARY_PAGE_SIZES.indexOf(v) !== -1) return v;
    }catch(e){}
    return LIBRARY_PAGE_SIZE;
}

// Amb sessió: el valor de la cuenta (si en té) substituïx el del navegador. Errors silenciosos: la biblioteca segueix.
function loadUserLibraryPageSize(){
    return fetch('/api/auth/preferences', { credentials: 'include' })
        .then(function(res){ return res.ok ? res.json() : null; })
        .then(function(data){
            var v = data && data.libraryPageSize;
            if(LIBRARY_PAGE_SIZES.indexOf(v) !== -1){
                libState.pageSize = v;
                try{ localStorage.setItem(LIBRARY_PAGE_SIZE_KEY, String(v)); }catch(e){}
            }
            var c = data && data.libraryCoverLevel;
            if(LIBRARY_COVER_LEVELS.indexOf(c) !== -1){
                libState.coverLevel = c;
                try{ localStorage.setItem(LIBRARY_COVERS_KEY, String(c)); }catch(e){}
            }
        })
        .catch(function(){});
}

function saveUserLibraryCoverLevel(v){
    return fetch('/api/auth/preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryCoverLevel: v })
    }).catch(function(){});
}

function saveUserLibraryPageSize(v){
    return fetch('/api/auth/preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryPageSize: v })
    }).catch(function(){});
}

// Valoració amb estrelles (com al mode solo): mateixa clau de dispositiu i de valoracions al navegador.
var LIBRARY_RATINGS_KEY = 'eduhoot-user-ratings';
var LIBRARY_DEVICE_KEY = 'eduhoot-device-id';

function getLibraryUserRating(id){
    try{
        var all = JSON.parse(localStorage.getItem(LIBRARY_RATINGS_KEY) || '{}');
        return all[String(id)] || 0;
    }catch(e){ return 0; }
}

function setLibraryUserRating(id, value){
    try{
        var all = JSON.parse(localStorage.getItem(LIBRARY_RATINGS_KEY) || '{}');
        all[String(id)] = value;
        localStorage.setItem(LIBRARY_RATINGS_KEY, JSON.stringify(all));
    }catch(e){}
}

function getLibraryDeviceId(){
    try{
        var existing = localStorage.getItem(LIBRARY_DEVICE_KEY);
        if(existing) return existing;
        var bytes = new Uint8Array(12);
        if(window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
        var id = Array.from(bytes).map(function(b){ return b.toString(16).padStart(2, '0'); }).join('');
        localStorage.setItem(LIBRARY_DEVICE_KEY, id);
        return id;
    }catch(e){ return ''; }
}

var libState = Vue.reactive({
    data: [],
    page: 1,
    pageSize: readLibraryPageSize(),
    coverLevel: readLibraryCoverLevel(),
    sort: 'newest',
    knownTags: [],
    tagsExpanded: false,
    // Se incrementa al cambiar de idioma para que la plantilla se repinte.
    lang: 0
});

function fetchWithFilters(){
    var query = '';
    libState.page = 1;
    currentFilters.tags = normalizeInlineTags(currentFilters.tags);
    syncFiltersToUrl();
    if(currentFilters.tags.length){
        var parts = currentFilters.tags.map(function(t){ return 'tags=' + encodeURIComponent(t); });
        query = '?' + parts.join('&');
        query += '&tagMode=' + encodeURIComponent(currentFilters.tagMode || 'any');
    }
    try{
        var localIds = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
        if(localIds.length){
            query += (query ? '&' : '?') + 'localIds=' + localIds.join(',');
        }
    }catch(e){}
    if(currentFilters.mineOnly){
        query += (query ? '&' : '?') + 'mine=1';
    }
    var headers = {};
    var anonToken = getAnonOwnerToken();
    if(anonToken){
        headers['X-Owner-Token'] = anonToken;
    }
    fetch('/api/quizzes' + query, { headers: headers, credentials: 'include' })
        .then(function(res){ return res.json(); })
        .then(function(data){
            libState.data = data || [];
        })
        .catch(function(){
            libState.data = [];
        });
}

function toggleTagFilter(tag){
    tag = normalizeTagSlug(tag);
    if(!tag) return;
    var idx = currentFilters.tags.indexOf(tag);
    if(idx === -1){
        currentFilters.tags.push(tag);
    }else{
        currentFilters.tags.splice(idx, 1);
    }
    fetchWithFilters();
}

function clearFilters(){
    var hasSearch = currentFilters.search && currentFilters.search.trim();
    if(!currentFilters.tags.length && !currentFilters.mineOnly && !hasSearch){
        return;
    }
    currentFilters.tags = [];
    currentFilters.mineOnly = false;
    storeMineOnly(false);
    currentFilters.search = '';
    currentFilters.tagMode = 'all';
    fetchWithFilters();
}

function toggleTagMode(){
    currentFilters.tagMode = currentFilters.tagMode === 'all' ? 'any' : 'all';
    if(currentFilters.tags.length){
        fetchWithFilters();
    }
}

function fetchTags(){
    var headers = {};
    var anonToken = getAnonOwnerToken();
    if(anonToken){
        headers['X-Owner-Token'] = anonToken;
    }
    return fetch('/api/tags', { credentials: 'include', headers: headers })
        .then(function(res){ return res.json(); })
        .then(function(data){
            libState.knownTags = Array.isArray(data.tags) ? data.tags : [];
        })
        .catch(function(){
            libState.knownTags = [];
        });
}

async function updateQuizTags(id, nextTags){
    try{
        var headers = { 'Content-Type': 'application/json' };
        if(getAnonOwnerToken()){
            headers['X-Owner-Token'] = getAnonOwnerToken();
        }
        var res = await fetch('/api/quizzes/' + id + '/tags', {
            method: 'PATCH',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify({ tags: nextTags })
        });
        var body = {};
        try{ body = await res.json(); }catch(e){}
        if(!res.ok){
            alert((body && body.error) || t('editTagsSaveError'));
            return false;
        }
        socket.emit('requestDbNames');
        fetchTags();
        return true;
    }catch(err){
        alert(t('editTagsSaveError'));
        return false;
    }
}

// Qué puede hacer el usuario con un quiz (editar, lanzar, clonar, guardar en su cuenta).
function quizPermissions(quiz){
    var user = authState.user;
    var canEdit = false;
    if(user){
        if(user.role === 'admin') canEdit = true;
        else if(!quiz.ownerId) canEdit = true;
        else if(user.id && quiz.ownerId && user.id === quiz.ownerId.toString()) canEdit = true;
    }else if(ownsLocal(quiz.id)){
        canEdit = true;
    }
    return {
        canEdit: canEdit,
        canStart: quiz.visibility !== 'private' || canEdit,
        canClone: !!(user && (quiz.allowClone || canEdit)),
        canSaveToAccount: !user && canEdit
    };
}

var LIBRARY_EXPORT_GROUPS = [
    { label: 'PDF', options: [['pdf-normal', 'pdfOptionNormal'], ['pdf-no-answers', 'pdfOptionNoAnswers'], ['pdf-random', 'pdfOptionRandom'], ['pdf-random-no-answers', 'pdfOptionRandomNoAnswers']] },
    { label: 'DOCX', options: [['docx-normal', 'docOptionNormal'], ['docx-no-answers', 'docOptionNoAnswers'], ['docx-no-images', 'docOptionNoImages'], ['docx-no-answers-no-images', 'docOptionNoAnswersNoImages']] },
    { label: 'ODT', options: [['odt-normal', 'docOptionNormal'], ['odt-no-answers', 'docOptionNoAnswers'], ['odt-no-images', 'docOptionNoImages'], ['odt-no-answers-no-images', 'docOptionNoAnswersNoImages']] }
];

// Barra flotante del paginador (com la de les accions del creador): apareix quan ni el paginador de dalt
// ni el de baix es veuen. Vigila els dos amb IntersectionObserver.
var libFixedPager = Vue.reactive({ ready: false, topVisible: false, bottomVisible: false });

function watchLibraryPager(topEl, bottomEl){
    if(typeof IntersectionObserver !== 'function' || !bottomEl) return;
    var observer = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
            if(entry.target === topEl) libFixedPager.topVisible = entry.isIntersecting;
            if(entry.target === bottomEl) libFixedPager.bottomVisible = entry.isIntersecting;
        });
        libFixedPager.ready = true;
    });
    if(topEl) observer.observe(topEl);
    observer.observe(bottomEl);
}

// App de Vue de la biblioteca (#library-tpl).
var libraryApp = {
    template: '#library-tpl',
    data: function(){
        return {
            listView: readLibraryView(),
            lib: libState,
            filters: currentFilters,
            auth: authState,
            exportGroups: LIBRARY_EXPORT_GROUPS,
            // Borradores por quiz (etiqueta nueva y permisos); se reinician
            // cada vez que llega la biblioteca, como al repintar antes.
            tagDrafts: {},
            sharing: {},
            fixedPager: libFixedPager
        };
    },
    mounted: function(){
        watchLibraryPager(null, this.$refs.pagerBottom);
    },
    computed: {
        // Opcions del desplegable «Página X de Y» (una per pàgina).
        pageOptions: function(){
            var out = [];
            for(var n = 1; n <= this.totalPages; n++){
                out.push({ n: n, label: this.t('paginationPageInfo').replace('{current}', n).replace('{total}', this.totalPages) });
            }
            return out;
        },
        // La barra flotante només es mostra quan hi ha més d'una pàgina i ni el paginador de dalt ni el de baix es veuen.
        showFixedPager: function(){
            var f = this.fixedPager;
            return f.ready && this.showPager && this.totalPages > 1 && !f.topVisible && !f.bottomVisible;
        },
        // Lo que se ve tras la búsqueda (antes currentDisplayedQuizzes).
        searchedQuizzes: function(){
            var quizzes = Array.isArray(this.lib.data) ? this.lib.data.slice() : [];
            var search = this.filters.search;
            if(search && search.trim()){
                var ql = search.trim().toLowerCase();
                var qlTag = normalizeTagSlug(ql);
                quizzes = quizzes.filter(function(q){
                    var name = (q.name || '').toLowerCase();
                    var tags = Array.isArray(q.tags) ? q.tags.map(function(t){ return normalizeTagSlug(t); }) : [];
                    return name.includes(ql) || tags.some(function(t){ return t.includes(qlTag || ql); });
                });
            }
            return quizzes;
        },
        sortedQuizzes: function(){
            this.lib.sort;
            return sortLibraryQuizzes(this.searchedQuizzes);
        },
        totalPages: function(){
            return Math.max(1, Math.ceil(this.sortedQuizzes.length / this.lib.pageSize));
        },
        currentPage: function(){
            return Math.max(1, Math.min(this.lib.page, this.totalPages));
        },
        pageQuizzes: function(){
            var start = (this.currentPage - 1) * this.lib.pageSize;
            return this.sortedQuizzes.slice(start, start + this.lib.pageSize);
        },
        pageSizes: function(){
            return LIBRARY_PAGE_SIZES;
        },
        // La barra de paginación (con el selector) se ve cuando hay más cuestionarios que la página más pequeña.
        showPager: function(){
            return this.sortedQuizzes.length > LIBRARY_PAGE_SIZES[0];
        },
        countText: function(){
            var n = this.sortedQuizzes.length;
            return n + ' ' + (n === 1 ? this.t('gameSingular') : this.t('gamePlural'));
        },
        filterInfo: function(){
            var parts = [];
            if(this.filters.tags.length){
                parts.push(this.t('filterBy') + this.filters.tags.join(', '));
                parts.push(this.filters.tagMode === 'all' ? this.t('filterModeAll') : this.t('filterModeAny'));
            }
            if(this.filters.mineOnly){
                parts.push(this.t('filterMine'));
            }
            return parts.length ? parts.join(' · ') : this.t('noFilters');
        },
        paginationInfo: function(){
            return this.t('paginationPageInfo').replace('{current}', this.currentPage).replace('{total}', this.totalPages);
        },
        // Carpetas: etiquetas a mostrar, con su peso según la frecuencia.
        folders: function(){
            var filters = this.filters;
            var tagSource, tagsToShow;
            if(filters.tags.length){
                tagSource = this.searchedQuizzes;
                tagsToShow = getTagsFromLibraryData(tagSource);
            }else if(filters.mineOnly){
                tagSource = this.lib.data;
                tagsToShow = getTagsFromLibraryData(tagSource);
            }else{
                tagSource = this.lib.data;
                tagsToShow = this.lib.knownTags;
            }
            if(!tagsToShow.length) return null;
            var freqMap = getTagFrequencies(tagSource);
            var freqValues = Object.keys(freqMap).map(function(k){ return freqMap[k]; });
            var normalizedMax = Math.max(1, freqValues.length ? Math.max.apply(null, freqValues) : 1);
            var allTags = tagsToShow.slice();
            // Las etiquetas seleccionadas siempre aparecen.
            filters.tags.forEach(function(sel){
                if(allTags.indexOf(sel) === -1) allTags.unshift(sel);
                if(freqMap[sel] === undefined) freqMap[sel] = 0;
            });
            allTags.sort(function(a, b){
                var ca = freqMap[a] || 0;
                var cb = freqMap[b] || 0;
                if(cb !== ca) return cb - ca;
                return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
            });
            var maxVisible = Math.max(TAG_SUGGESTIONS_LIMIT, filters.tags.length);
            var visible = filters.tags.slice();
            if(this.lib.tagsExpanded){
                visible = allTags.slice();
            }else{
                for(var i = 0; i < allTags.length && visible.length < maxVisible; i++){
                    if(visible.indexOf(allTags[i]) === -1) visible.push(allTags[i]);
                }
            }
            return {
                tags: visible.map(function(tag){
                    var weight = Math.min(1, (freqMap[tag] || 0) / normalizedMax);
                    return { tag: tag, weight: weight };
                }),
                showToggle: allTags.length > maxVisible,
                remaining: Math.max(0, allTags.length - visible.length)
            };
        }
    },
    watch: {
        'lib.data': function(){
            this.tagDrafts = {};
            this.sharing = {};
        }
    },
    methods: {
        t: function(key){
            this.lib.lang;
            return t(key);
        },
        perms: function(quiz){
            return quizPermissions(quiz);
        },
        quizTags: function(quiz){
            return normalizeInlineTags(Array.isArray(quiz.tags) ? quiz.tags : []);
        },
        // Estrelles de la targeta (només quizzes públics, un vot per dispositiu).
        ratingShown: function(quiz){
            var own = getLibraryUserRating(quiz.id);
            if(own) return own;
            var avg = Number(quiz.ratingAvg);
            return Math.round(Number.isFinite(avg) ? avg : 0);
        },
        ratingSummaryText: function(quiz){
            var avg = Number(quiz.ratingAvg);
            if(!Number.isFinite(avg)) avg = 0;
            var count = Number(quiz.ratingCount);
            if(!Number.isFinite(count)) count = 0;
            if(!count) return t('ratingEmpty');
            return t('ratingSummary').replace('{avg}', avg.toFixed(1)).replace('{count}', String(count));
        },
        rateLibraryQuiz: function(quiz, stars){
            setLibraryUserRating(quiz.id, stars);
            fetch('/api/quizzes/' + encodeURIComponent(quiz.id) + '/rating', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: stars, deviceId: getLibraryDeviceId() })
            })
                .then(function(res){ return res.ok ? res.json() : null; })
                .then(function(body){
                    if(body){
                        quiz.ratingAvg = body.avg;
                        quiz.ratingCount = body.count;
                    }
                })
                .catch(function(){});
        },
        // Fons de la tarjeta: la portada del quiz, la miniatura de su vídeo o el logo de EduHoot.
        coverSrc: function(quiz){
            if(!this.lib.coverLevel) return '';
            if(quiz.coverImage) return quiz.coverImage;
            var m = /(?:youtube\.com\/(?:.*[?&]v=|embed\/)|youtu\.be\/)([\w-]{11})/.exec(quiz.coverVideo || '');
            if(m) return 'https://img.youtube.com/vi/' + m[1] + '/hqdefault.jpg';
            return '/icons/logo.svg';
        },
        // Si la portada no carga, se usa el logo de EduHoot.
        onCoverError: function(ev){
            if(ev.target.getAttribute('src') !== '/icons/logo.svg') ev.target.src = '/icons/logo.svg';
        },
        // Línia discreta sota les estadístiques: «Creat … · Modificat …».
        // Només les dates (a la taula de detall la columna ja té l'etiqueta).
        datesValue: function(quiz){
            this.lib.lang;
            var created = formatQuizDate(quiz.createdAt);
            if(!created) return '';
            var updated = formatQuizDate(quiz.updatedAt);
            return updated ? created + ' · ' + t('updatedAtLabel') + ' ' + updated : created;
        },
        datesText: function(quiz){
            this.lib.lang;
            var created = formatQuizDate(quiz.createdAt);
            if(!created) return '';
            var text = t('createdAtLabel') + ' ' + created;
            var updated = formatQuizDate(quiz.updatedAt);
            if(updated) text += ' · ' + t('updatedAtLabel') + ' ' + updated;
            return text;
        },
        metaText: function(quiz){
            this.lib.lang;
            var visibilityLabel = quiz.visibility === 'private' ? t('visibilityPrivate') : (quiz.visibility === 'unlisted' ? t('visibilityUnlisted') : t('visibilityPublic'));
            var text = (quiz.ownerNickname ? quiz.ownerNickname : t('creatorUnknown')) + ' · ' + visibilityLabel;
            if(quiz.sourceQuizId){
                var basedOnLabel = (lang === 'en' ? 'Based on ' : { fr: 'Basé sur ', de: 'Basierend auf ', it: 'Basato su ', pt: 'Baseado em ', bg: 'Базиран на ' }[lang] || (lang === 'ca' || lang === 'va' ? 'Basat en ' : 'Basado en '));
                var fromName = (quiz.sourceQuizName || '').trim();
                var sourceText = fromName ? ('"' + fromName + '"') : ('ID ' + quiz.sourceQuizId);
                if(fromName && quiz.sourceQuizId){
                    sourceText += ' (ID ' + quiz.sourceQuizId + ')';
                }
                var sourceAuthor = (quiz.sourceOwnerNickname || '').trim();
                var sourceByLabel = (lang === 'en' ? 'by ' : 'de ');
                text += ' · ' + basedOnLabel + sourceText + (sourceAuthor ? (' · ' + sourceByLabel + sourceAuthor) : '');
            }
            return text;
        },
        foldersMoreText: function(){
            if(this.lib.tagsExpanded) return this.t('tagsShowLess');
            var remaining = this.folders.remaining;
            return this.t('tagsShowMore') + (remaining ? ' (' + remaining + ')' : '');
        },
        // Filtros y orden
        onSearch: function(){ fetchWithFilters(); },
        onMine: function(){ storeMineOnly(!!currentFilters.mineOnly); fetchWithFilters(); },
        onSort: function(){ this.lib.page = 1; },
        onPageChange: function(ev){
            var v = parseInt(ev.target.value, 10);
            if(v >= 1 && v <= this.totalPages) this.lib.page = v;
        },
        onPageSize: function(ev){
            var v = parseInt(ev.target.value, 10);
            if(LIBRARY_PAGE_SIZES.indexOf(v) === -1) return;
            this.lib.pageSize = v;
            this.lib.page = 1;
            try{ localStorage.setItem(LIBRARY_PAGE_SIZE_KEY, String(v)); }catch(e){}
            if(authState.user) saveUserLibraryPageSize(v);
        },
        setListView: function(v){
            this.listView = v === 'detail' ? 'detail' : 'cards';
            try{ localStorage.setItem(LIBRARY_VIEW_KEY, this.listView); }catch(e){}
        },
        onCoverLevel: function(){
            var v = Number(this.lib.coverLevel);
            if(LIBRARY_COVER_LEVELS.indexOf(v) === -1) return;
            try{ localStorage.setItem(LIBRARY_COVERS_KEY, String(v)); }catch(e){}
            if(authState.user) saveUserLibraryCoverLevel(v);
        },
        clearFilters: function(){ clearFilters(); },
        toggleTagMode: function(){ toggleTagMode(); },
        toggleTag: function(tag){ toggleTagFilter(tag); },
        showAllFolders: function(){
            currentFilters.tags = [];
            syncFiltersToUrl();
            fetchWithFilters();
        },
        prevPage: function(){ if(this.currentPage > 1) this.lib.page = this.currentPage - 1; },
        nextPage: function(){ if(this.currentPage < this.totalPages) this.lib.page = this.currentPage + 1; },
        // Etiquetas de un quiz
        removeTag: async function(quiz, tagValue){
            var tags = this.quizTags(quiz);
            if(tags.length <= 1){
                alert(t('editTagsNeedOne'));
                return;
            }
            await updateQuizTags(quiz.id, tags.filter(function(x){ return x !== tagValue; }));
        },
        submitTags: async function(quiz){
            var raw = (this.tagDrafts[quiz.id] || '').trim();
            if(!raw) return;
            var parsed = parseTagInput(raw);
            this.tagDrafts[quiz.id] = '';
            if(!parsed.length) return;
            await updateQuizTags(quiz.id, normalizeInlineTags(this.quizTags(quiz).concat(parsed)));
        },
        onTagKey: function(ev, quiz){
            var self = this;
            if(ev.key === 'Enter'){
                ev.preventDefault();
                self.submitTags(quiz);
            }
            if(ev.key === ','){
                // permite pegar/teclear y añadir rápido
                setTimeout(function(){ self.submitTags(quiz); }, 0);
            }
        },
        // Permisos de compartir
        share: function(quiz){
            if(!this.sharing[quiz.id]){
                var visibility = quiz.visibility || 'public';
                var allowClone = !!quiz.allowClone;
                // saved: último valor confirmado por el servidor (para volver atrás si falla el guardado).
                this.sharing[quiz.id] = { visibility: visibility, allowClone: allowClone, saved: { visibility: visibility, allowClone: allowClone }, saving: false, done: false };
            }
            return this.sharing[quiz.id];
        },
        // Se guarda al cambiar el desplegable o la casilla; si falla, el control vuelve al valor anterior.
        saveSharing: async function(quiz){
            var draft = this.share(quiz);
            if(!this.perms(quiz).canEdit){
                draft.visibility = draft.saved.visibility;
                draft.allowClone = draft.saved.allowClone;
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            draft.saving = true;
            draft.done = false;
            clearTimeout(draft.doneTimer);
            var ok = await updateSharing(quiz.id, draft.visibility, draft.allowClone);
            draft.saving = false;
            if(ok){
                draft.saved = { visibility: draft.visibility, allowClone: draft.allowClone };
                draft.done = true;
                // El check se ve 3 segundos; si se guarda otra vez antes, el plazo empieza de nuevo.
                clearTimeout(draft.doneTimer);
                draft.doneTimer = setTimeout(function(){ draft.done = false; }, 3000);
            }else{
                draft.visibility = draft.saved.visibility;
                draft.allowClone = draft.saved.allowClone;
            }
        },
        // Acciones
        launch: function(quiz, mode){
            if(!this.perms(quiz).canStart){
                warnNoPermission(t('cannotStartPrivate'));
                return;
            }
            if(mode === 'solo') startSolo(quiz.id);
            else if(mode === 'cards') startSoloCards(quiz.id);
            else if(mode === 'multiplayer') startMultiplayer(quiz.id);
            else if(mode === 'homework') window.location.href = '/create/homework/?quiz=' + encodeURIComponent(quiz.id);
            else startGame(quiz.id);
        },
        edit: function(quiz){
            if(!this.perms(quiz).canEdit){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            window.location.href = '/create/quiz-creator/?id=' + quiz.id;
        },
        remove: function(quiz){
            if(!this.perms(quiz).canEdit){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            if(confirm(t('confirmDelete'))){
                deleteQuiz(quiz.id);
            }
        },
        clone: function(quiz){
            if(!this.perms(quiz).canClone){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            cloneQuiz(quiz.id);
        },
        saveToAccount: function(quiz){ claimQuizToAccount(quiz.id); },
        downloadCsv: function(quiz){ downloadCsv(quiz.id); },
        downloadMoodle: function(quiz){ downloadMoodleXml(quiz.id); },
        exportAs: function(ev, quiz){
            var choice = ev.target.value || '';
            if(!choice) return;
            var includeAnswers = !choice.includes('no-answers');
            var includeImages = !choice.includes('no-images');
            if(choice.indexOf('pdf-') === 0){
                var isRandom = choice.indexOf('random') !== -1;
                downloadPdf(quiz.id, { includeAnswers: includeAnswers, shuffleQuestions: isRandom, shuffleAnswers: isRandom });
            }else if(choice.indexOf('docx-') === 0){
                downloadDocx(quiz.id, { includeAnswers: includeAnswers, includeImages: includeImages });
            }else if(choice.indexOf('odt-') === 0){
                downloadOdt(quiz.id, { includeAnswers: includeAnswers, includeImages: includeImages });
            }
            ev.target.value = '';
        }
    }
};
