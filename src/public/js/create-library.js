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
var libState = Vue.reactive({
    data: [],
    page: 1,
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

// App de Vue de la biblioteca (#library-tpl).
var libraryApp = {
    template: '#library-tpl',
    data: function(){
        return {
            lib: libState,
            filters: currentFilters,
            auth: authState,
            exportGroups: LIBRARY_EXPORT_GROUPS,
            // Borradores por quiz (etiqueta nueva y permisos); se reinician
            // cada vez que llega la biblioteca, como al repintar antes.
            tagDrafts: {},
            sharing: {}
        };
    },
    computed: {
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
            return Math.max(1, Math.ceil(this.sortedQuizzes.length / LIBRARY_PAGE_SIZE));
        },
        currentPage: function(){
            return Math.max(1, Math.min(this.lib.page, this.totalPages));
        },
        pageQuizzes: function(){
            var start = (this.currentPage - 1) * LIBRARY_PAGE_SIZE;
            return this.sortedQuizzes.slice(start, start + LIBRARY_PAGE_SIZE);
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
        metaText: function(quiz){
            this.lib.lang;
            var visibilityLabel = quiz.visibility === 'private' ? t('visibilityPrivate') : (quiz.visibility === 'unlisted' ? t('visibilityUnlisted') : t('visibilityPublic'));
            var text = (quiz.ownerNickname ? quiz.ownerNickname : t('creatorUnknown')) + ' · ' + visibilityLabel;
            if(quiz.sourceQuizId){
                var basedOnLabel = (lang === 'en' ? 'Based on ' : (lang === 'ca' || lang === 'va' ? 'Basat en ' : 'Basado en '));
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
        onMine: function(){ fetchWithFilters(); },
        onSort: function(){ this.lib.page = 1; },
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
                this.sharing[quiz.id] = { visibility: quiz.visibility || 'public', allowClone: !!quiz.allowClone };
            }
            return this.sharing[quiz.id];
        },
        saveSharing: function(quiz){
            if(!this.perms(quiz).canEdit){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            var draft = this.share(quiz);
            updateSharing(quiz.id, draft.visibility, draft.allowClone);
        },
        // Acciones
        launch: function(quiz, mode){
            if(!this.perms(quiz).canStart){
                warnNoPermission(t('cannotStartPrivate'));
                return;
            }
            if(mode === 'solo') startSolo(quiz.id);
            else if(mode === 'multiplayer') startMultiplayer(quiz.id);
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
