// Biblioteca de quizzes públicos: filtros, listado, paginación y selección, extraído de solo.js
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
        if(state.sortOrder === 'rating'){
            var ra = Number(a && a.ratingAvg) || 0;
            var rb = Number(b && b.ratingAvg) || 0;
            if(ra !== rb) return rb - ra;
            var ca = Number(a && a.ratingCount) || 0;
            var cb = Number(b && b.ratingCount) || 0;
            if(ca !== cb) return cb - ca;
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

function getAllTagsFromQuizzes(){
        var map = {};
        Vue.toRaw(state.quizzes).forEach(function(q){
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

// Normaliza tildes y mayúsculas para comparar etiquetas
function normalizeTag(str) {
    return (str || '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Lleva las etiquetas del filtro a la grafía exacta que usan los quizzes
// (p. ej. «SOCIALS» de la URL → «socials»); si no existe, la conserva para
// no perder filtros cargados desde la URL.
function normalizeTagFilters(){
    var allKeys = {};
    getAllTagsFromQuizzes().forEach(function(it){ allKeys[normalizeTag(it.tag)] = it.tag; });
    state.filters.tags = state.filters.tags.map(function(tag){
        return allKeys[normalizeTag(tag)] || tag;
    }).filter(function(tag){
        return !!(tag && tag.toString().trim());
    });
}

    function fetchPublicQuizzes(){
        var params = getSoloTagQueryParams();
        var qs = params.toString();
        var endpoint = '/api/public-quizzes' + (qs ? '?' + qs : '');
        state.loading = true;
        state.loadError = false;
        fetch(endpoint)
            .then(function(res){ return res.json(); })
            .then(function(data){
                state.quizzes = shuffleArray(Array.isArray(data) ? data : []);
                state.page = 0;
                state.loading = false;
                normalizeTagFilters();
                if(qs){
                    fetch('/api/public-quizzes')
                        .then(function(res){ return res.json(); })
                        .then(function(allData){
                            state.quizzes = shuffleArray(Array.isArray(allData) ? allData : []);
                            normalizeTagFilters();
                        })
                        .catch(function(){});
                }
            })
            .catch(function(){
                state.quizzes = [];
                state.loading = false;
                state.loadError = true;
            });
    }

// Miniatura de cada tarjeta: la portada del quiz o, si no tiene, el logo
// mientras se busca una imagen/vídeo entre sus preguntas. Se calcula una
// vez por quiz (antes se repetía la petición en cada repintado).
function ensureThumb(q){
    var key = String(q.id);
    if(state.thumbs[key]) return;
    var direct = mediaThumb(q.coverImage || q.coverVideo);
    state.thumbs[key] = { src: direct || '/icons/logo.svg', loaded: false, fallback: !direct };
    if(direct) return;
    fetch('/api/quizzes/' + encodeURIComponent(q.id))
        .then(function(res){ return res.json(); })
        .then(function(body){
            var altThumb = findMediaInQuestions(body.questions || []);
            if(altThumb){
                state.thumbs[key].src = altThumb;
                state.thumbs[key].fallback = false;
                state.thumbs[key].loaded = false;
            }
        })
        .catch(function(){});
}

// Parte del catálogo de la app de Vue de /solo/ (Subfase B, bloque 1). La
// lista se filtra y ordena sobre los datos «en crudo» (Vue.toRaw), así que
// marcar un favorito o valorar no reordena al instante: como antes, solo
// se reordena al cambiar búsqueda, filtros u orden.
var soloCatalog = {
    computed: {
        allTags: function(){
            this.s.quizzes;
            return getAllTagsFromQuizzes();
        },
        tagToggleLabel: function(){
            return this.s.tagFilterExpanded ? this.t('filterTagShowLess') : this.t('filterTagShowMore');
        },
        filteredQuizzes: function(){
            var s = this.s;
            var searchVal = (s.search || '').toLowerCase();
            var filterTagsNorm = s.filters.tags.map(normalizeTag);
            var tagMode = s.filters.tagMode;
            var minQ = parseInt(s.filters.minQuestions, 10);
            var maxQ = parseInt(s.filters.maxQuestions, 10);
            var onlyImage = s.filters.onlyImage;
            s.sortOrder; // sortPublicQuizzes lo lee de state: así el orden es dependencia.
            var favorites = Vue.toRaw(s.favoriteIds);
            var list = Vue.toRaw(s.quizzes).filter(function(q){
                if(searchVal){
                    var haystack = (q.name || '') + ' ' + (Array.isArray(q.tags) ? q.tags.join(' ') : '');
                    if(!haystack.toLowerCase().includes(searchVal)) return false;
                }
                if(filterTagsNorm.length){
                    var tags = (Array.isArray(q.tags) ? q.tags : []).map(normalizeTag);
                    var hasTag = function(tag){ return tags.indexOf(tag) !== -1; };
                    if(tagMode === 'all' ? !filterTagsNorm.every(hasTag) : !filterTagsNorm.some(hasTag)) return false;
                }
                var count = typeof q.questionsCount === 'number' ? q.questionsCount : 0;
                if(!Number.isNaN(minQ) && count < minQ) return false;
                if(!Number.isNaN(maxQ) && count > maxQ) return false;
                if(onlyImage && !q.coverImage) return false;
                return true;
            });
            var favs = list.filter(function(q){ return favorites.has(String(q.id)); });
            var rest = list.filter(function(q){ return !favorites.has(String(q.id)); });
            return sortPublicQuizzes(favs).concat(sortPublicQuizzes(rest));
        },
        totalPages: function(){
            return Math.max(1, Math.ceil(this.filteredQuizzes.length / this.s.pageSize));
        },
        currentPage: function(){
            return Math.min(this.s.page, this.totalPages - 1);
        },
        pageItems: function(){
            var start = this.currentPage * this.s.pageSize;
            return this.filteredQuizzes.slice(start, start + this.s.pageSize).map(function(q){ return Vue.reactive(q); });
        },
        emptyText: function(){
            if(this.s.loading) return this.t('loading');
            if(this.s.loadError || !this.filteredQuizzes.length) return this.t('publicEmpty');
            return '';
        }
    },
    watch: {
        pageItems: {
            handler: function(items){ items.forEach(ensureThumb); },
            immediate: true
        },
        's.filters.tags': {
            handler: function(){ syncSoloUrl(); },
            deep: true
        }
    },
    methods: {
        resetPage: function(){
            this.s.page = 0;
        },
        selectAllTags: function(){
            this.s.filters.tags = this.allTags.map(function(it){ return it.tag; });
            this.s.tagFilterExpanded = true;
            this.s.page = 0;
        },
        clearTags: function(){
            this.s.filters.tags = [];
            this.s.page = 0;
        },
        thumb: function(q){
            return this.s.thumbs[String(q.id)] || { src: null, loaded: false };
        },
        onThumbError: function(q){
            var th = this.s.thumbs[String(q.id)];
            if(!th || th.fallback) return;
            th.loaded = false;
            th.src = null;
        },
        cleanTags: function(q){
            return Array.isArray(q.tags) ? q.tags : [];
        },
        isFavorite: function(id){
            return isFavorite(id);
        },
        favoriteLabel: function(id){
            return isFavorite(id) ? this.t('favoriteRemove') : this.t('favoriteAdd');
        },
        toggleFavorite: function(id){
            toggleFavorite(id);
        },
        displayRating: function(q){
            var own = getUserRating(q.id);
            if(own) return own;
            var avg = Number(q.ratingAvg);
            return Math.round(Number.isFinite(avg) ? avg : 0);
        },
        ratingSummary: function(q){
            var avg = Number(q && q.ratingAvg);
            if(!Number.isFinite(avg)) avg = 0;
            var count = Number(q && q.ratingCount);
            if(!Number.isFinite(count)) count = 0;
            return formatRatingSummary(avg, Math.max(0, Math.round(count)));
        },
        rate: function(q, stars){
            setUserRating(q.id, stars);
            submitRating(q.id, stars, q);
        },
        play: function(id){
            ensureSoloMusicPlaying();
            selectQuiz(id);
        },
        showRanking: function(id){
            showQuizRanking(id);
        }
    }
};


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

// El campo «Preguntas a responder»: por defecto el total del quiz.
function syncQuestionCountControls(){
    var total = getQuizTotalQuestions();
    if(total > 0){
        if(state.desiredQuestionCount == null){
            state.countInput = String(total);
        }
    }else{
        state.countInput = '';
    }
}

function syncQuestionTimeControls(){
    state.timeInput = state.desiredQuestionTime == null ? '' : String(state.desiredQuestionTime);
}

function getDesiredQuestionCount(){
    var total = getQuizTotalQuestions();
    if(total <= 0) return 0;

    // Si ya se ha elegido una vez (p.ej. Play again), reutiliza.
    if(typeof state.desiredQuestionCount === 'number' && isFinite(state.desiredQuestionCount) && state.desiredQuestionCount > 0){
        return Math.max(1, Math.min(total, Math.round(state.desiredQuestionCount)));
    }

    var chosen = clampInt(state.countInput, 1, total);
    if(chosen == null) chosen = total;
    return chosen;
}

function renderSelectedMeta(){
    syncQuestionCountControls();
    syncQuestionTimeControls();
}

    function selectQuiz(id){
        state.title = { key: 'loading' };
        state.view = 'none';
        fetch('/api/quizzes/' + encodeURIComponent(id))
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                if(!payload.ok){
                    state.title = { key: 'startError' };
                    return;
                }
                state.quizData = payload.body;
                state.currentQuiz = payload.body.id;
                state.title = payload.body.name ? { text: payload.body.name } : { key: 'soloTitle' };
                document.body.classList.add('playing');
                // Nuevo flujo: antes de empezar, elegir cuántas preguntas jugar.
                state.desiredQuestionCount = null;
                renderSelectedMeta();
                state.view = 'start';
            })
            .catch(function(){
                state.title = { key: 'startError' };
            });
    }
