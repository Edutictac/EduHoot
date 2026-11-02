var socket = io();

socket.on('connect', function(){
    socket.emit('requestDbNames');//Get database names to display to user
});

socket.on('gameNamesData', function(data){
    fetchWithFilters();
    fetchTags();
});

var currentFilters = {
    tags: [],
    mineOnly: false,
    search: '',
    tagMode: 'all'
};
var currentSort = 'newest';
var knownTags = [];
var currentDisplayedQuizzes = [];
var TAG_SUGGESTIONS_LIMIT = 12;
var tagSuggestionsExpanded = false;

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
var LIBRARY_PAGE_SIZE = 12;
var libraryCurrentPage = 1;
var libraryTotalPages = 1;
var libraryLatestData = [];
var PENDING_ACCOUNT_SAVE_KEY = 'eduhoot-pending-account-save';

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

readFiltersFromUrl();

function setLang(newLang){
    lang = newLang;
    EduhootLang.persist(lang);
    applyStaticTranslations();
    renderTagSuggestions();
    socket.emit('requestDbNames');
}

function fetchWithFilters(){
    var query = '';
    libraryCurrentPage = 1;
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
            libraryLatestData = data || [];
            renderGames(libraryLatestData);
            renderTagSuggestions();
        })
        .catch(function(){
            libraryLatestData = [];
            renderGames([]);
            renderTagSuggestions();
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
    var searchInput = document.getElementById('library-search');
    if(searchInput){
        searchInput.value = '';
    }
    var mineCheckbox = document.getElementById('filter-mine');
    if(mineCheckbox){
        mineCheckbox.checked = false;
    }
    fetchWithFilters();
}

function toggleTagMode(){
    currentFilters.tagMode = currentFilters.tagMode === 'all' ? 'any' : 'all';
    renderTagModeToggle();
    if(currentFilters.tags.length){
        fetchWithFilters();
    }
}

function renderTagModeToggle(){
    var toggle = document.getElementById('tag-mode-toggle');
    if(!toggle) return;
    if(currentFilters.tagMode === 'all'){
        toggle.textContent = t('matchAllTags');
        toggle.classList.add('is-active');
        toggle.setAttribute('aria-pressed', 'true');
    }else{
        toggle.textContent = t('matchAnyTags');
        toggle.classList.remove('is-active');
        toggle.setAttribute('aria-pressed', 'false');
    }
}

function renderTagSuggestions(){
    var wrap = document.getElementById('tag-suggestions');
    if(!wrap) return;
    wrap.innerHTML = '';
    renderTagModeToggle();
    var tagsToShow;
    var tagSource;
    if(currentFilters.tags.length){
        tagSource = currentDisplayedQuizzes;
        tagsToShow = getTagsFromLibraryData(tagSource);
    }else if(currentFilters.mineOnly){
        tagSource = libraryLatestData;
        tagsToShow = getTagsFromLibraryData(tagSource);
    }else{
        tagSource = libraryLatestData;
        tagsToShow = knownTags;
    }
    if(!tagsToShow.length){
        return;
    }
    var freqMap = getTagFrequencies(tagSource);
    var freqValues = Object.keys(freqMap).map(function(k){ return freqMap[k]; });
    var maxFreq = freqValues.length ? Math.max.apply(null, freqValues) : 1;
    var normalizedMax = Math.max(1, maxFreq);

    function tagSort(a, b){
        var ca = freqMap[a] || 0;
        var cb = freqMap[b] || 0;
        if(cb !== ca) return cb - ca;
        return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
    }

    var allTags = tagsToShow.slice();
    // Asegurar que las etiquetas seleccionadas siempre aparecen.
    currentFilters.tags.forEach(function(sel){
        if(allTags.indexOf(sel) === -1) allTags.unshift(sel);
        if(freqMap[sel] === undefined) freqMap[sel] = 0;
    });
    allTags.sort(tagSort);

    var selected = currentFilters.tags.slice();
    var maxVisible = Math.max(TAG_SUGGESTIONS_LIMIT, selected.length);
    var visibleTags = [];
    selected.forEach(function(t){
        if(visibleTags.indexOf(t) === -1) visibleTags.push(t);
    });
    if(!tagSuggestionsExpanded){
        for(var i = 0; i < allTags.length && visibleTags.length < maxVisible; i++){
            var tName = allTags[i];
            if(visibleTags.indexOf(tName) !== -1) continue;
            visibleTags.push(tName);
        }
    }else{
        visibleTags = allTags.slice();
    }

    var remaining = Math.max(0, allTags.length - visibleTags.length);
    var label = document.createElement('span');
    label.className = 'label';
    label.textContent = t('foldersTitle');
    wrap.appendChild(label);

    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'tag' + (currentFilters.tags.length === 0 ? ' active' : '');
    allBtn.textContent = t('foldersAll');
    allBtn.style.setProperty('--tag-weight', 0.3);
    allBtn.onclick = function(){
        currentFilters.tags = [];
        syncFiltersToUrl();
        fetchWithFilters();
    };
    wrap.appendChild(allBtn);

    visibleTags.forEach(function(tag){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tag' + (currentFilters.tags.indexOf(tag) !== -1 ? ' active' : '');
        btn.textContent = tag;
        var tagCount = freqMap[tag] || 0;
        var normalizedWeight = normalizedMax ? Math.min(1, tagCount / normalizedMax) : 0;
        btn.style.setProperty('--tag-weight', normalizedWeight);
        btn.setAttribute('data-weight', normalizedWeight.toFixed(2));
        btn.onclick = function(){ toggleTagFilter(tag); };
        wrap.appendChild(btn);
    });

    if(allTags.length > maxVisible){
        var toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'tag tag-more';
        toggleBtn.style.setProperty('--tag-weight', 0);
        if(tagSuggestionsExpanded){
            toggleBtn.textContent = t('tagsShowLess');
        }else{
            toggleBtn.textContent = t('tagsShowMore') + (remaining ? ' (' + remaining + ')' : '');
        }
        toggleBtn.onclick = function(){
            tagSuggestionsExpanded = !tagSuggestionsExpanded;
            renderTagSuggestions();
        };
        wrap.appendChild(toggleBtn);
    }
    renderTagModeToggle();
}

var mineFilter = document.getElementById('filter-mine');
if(mineFilter){
    mineFilter.addEventListener('change', function(){
        currentFilters.mineOnly = mineFilter.checked;
        fetchWithFilters();
    });
}
var clearFiltersBtn = document.getElementById('clear-filters');
if(clearFiltersBtn){
    clearFiltersBtn.addEventListener('click', clearFilters);
}
var tagModeToggleBtn = document.getElementById('tag-mode-toggle');
if(tagModeToggleBtn){
    tagModeToggleBtn.addEventListener('click', toggleTagMode);
    renderTagModeToggle();
}

var librarySearch = document.getElementById('library-search');
if(librarySearch){
    librarySearch.addEventListener('input', function(){
        currentFilters.search = librarySearch.value || '';
        fetchWithFilters();
    });
}

var librarySortSelect = document.getElementById('library-sort');
if(librarySortSelect){
    librarySortSelect.value = currentSort;
    librarySortSelect.addEventListener('change', function(){
        currentSort = librarySortSelect.value;
        libraryCurrentPage = 1;
        renderGames(libraryLatestData);
    });
}

var paginationPrevBtn = document.getElementById('library-pagination-prev');
if(paginationPrevBtn){
    paginationPrevBtn.addEventListener('click', function(){
        if(libraryCurrentPage <= 1) return;
        libraryCurrentPage -= 1;
        renderGames(libraryLatestData);
    });
}
var paginationNextBtn = document.getElementById('library-pagination-next');
if(paginationNextBtn){
    paginationNextBtn.addEventListener('click', function(){
        if(libraryCurrentPage >= libraryTotalPages) return;
        libraryCurrentPage += 1;
        renderGames(libraryLatestData);
    });
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
            knownTags = Array.isArray(data.tags) ? data.tags : [];
            renderTagSuggestions();
        })
        .catch(function(){
            knownTags = [];
            renderTagSuggestions();
        });
}

function renderGames(data){
    var div = document.getElementById('game-list');
    var count = document.getElementById('game-count');
    var filterInfo = document.getElementById('filter-info');
    if(!div) return;

    var sourceData = data || libraryLatestData;
    libraryLatestData = sourceData || [];

    div.innerHTML = '';
    var quizzes = [];
    var entries = sourceData || {};
    var entriesLength = Object.keys(entries).length;
    for(var i = 0; i < entriesLength; i++){
        quizzes.push(entries[i]);
    }

    if(currentFilters.search && currentFilters.search.trim()){
        var ql = currentFilters.search.trim().toLowerCase();
        var qlTag = normalizeTagSlug(ql);
        quizzes = quizzes.filter(function(q){
            var name = (q.name || '').toLowerCase();
            var tags = Array.isArray(q.tags) ? q.tags.map(function(t){ return normalizeTagSlug(t); }) : [];
            var matchName = name.includes(ql);
            var matchTag = tags.some(function(t){ return t.includes(qlTag || ql); });
            return matchName || matchTag;
        });
    }
    currentDisplayedQuizzes = quizzes.slice();

    quizzes = sortLibraryQuizzes(quizzes);

    if(count){
        var singular = t('gameSingular');
        var plural = t('gamePlural');
        count.textContent = quizzes.length + ' ' + (quizzes.length === 1 ? singular : plural);
    }
    if(filterInfo){
        var parts = [];
        if(currentFilters.tags.length){
            parts.push(t('filterBy') + currentFilters.tags.join(', '));
            parts.push(currentFilters.tagMode === 'all' ? t('filterModeAll') : t('filterModeAny'));
        }
        if(currentFilters.mineOnly){
            parts.push(t('filterMine'));
        }
        filterInfo.textContent = parts.length ? parts.join(' · ') : t('noFilters');
    }

    var totalQuizzes = quizzes.length;
    libraryTotalPages = Math.max(1, Math.ceil(totalQuizzes / LIBRARY_PAGE_SIZE));
    if(libraryCurrentPage > libraryTotalPages){
        libraryCurrentPage = libraryTotalPages;
    }
    if(libraryCurrentPage < 1){
        libraryCurrentPage = 1;
    }

    if(totalQuizzes === 0){
        var empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<p>'+t('noGames')+'</p><p>'+t('noGamesHint')+'</p>';
        div.appendChild(empty);
        libraryCurrentPage = 1;
        libraryTotalPages = 1;
        updatePaginationControls(false);
        return;
    }

    var startIndex = (libraryCurrentPage - 1) * LIBRARY_PAGE_SIZE;
    var pageQuizzes = quizzes.slice(startIndex, startIndex + LIBRARY_PAGE_SIZE);
    updatePaginationControls(libraryTotalPages > 1);

    pageQuizzes.forEach(function(quiz){
        var card = document.createElement('div');
        card.className = 'game-card';

        var head = document.createElement('div');
        head.className = 'game-card-head';

        var title = document.createElement('div');
        title.className = 'game-title';
        title.textContent = quiz.name || 'Quiz sin nombre';

        var badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = (t('idLabel') || 'ID') + ' ' + quiz.id;

        head.appendChild(title);
        head.appendChild(badge);

        var subtitle = document.createElement('p');
        subtitle.className = 'game-subtitle';
        subtitle.textContent = '';

        var meta = document.createElement('div');
        meta.className = 'game-meta';
        var visibilityLabel = quiz.visibility === 'private' ? t('visibilityPrivate') : (quiz.visibility === 'unlisted' ? t('visibilityUnlisted') : t('visibilityPublic'));
        var creatorText = quiz.ownerNickname ? quiz.ownerNickname : t('creatorUnknown');
        meta.textContent = creatorText + ' · ' + visibilityLabel;
        if(quiz.sourceQuizId){
            var basedOnLabel = (lang === 'en' ? 'Based on ' : (lang === 'ca' || lang === 'va' ? 'Basat en ' : 'Basado en '));
            var fromName = (quiz.sourceQuizName || '').trim();
            var sourceText = fromName ? ('"' + fromName + '"') : ('ID ' + quiz.sourceQuizId);
            if(fromName && quiz.sourceQuizId){
                sourceText += ' (ID ' + quiz.sourceQuizId + ')';
            }
            var sourceAuthor = (quiz.sourceOwnerNickname || '').trim();
            var sourceByLabel = (lang === 'en' ? 'by ' : (lang === 'ca' ? 'de ' : 'de '));
            meta.textContent += ' · ' + basedOnLabel + sourceText + (sourceAuthor ? (' · ' + sourceByLabel + sourceAuthor) : '');
        }
        var stats = document.createElement('div');
        stats.className = 'game-stats';
        var plays = quiz.playsCount || 0;
        var players = quiz.playersCount || 0;
        var statPlays = document.createElement('span');
        statPlays.className = 'game-stats__item';
        statPlays.textContent = plays + ' ' + t('playsShort');
        var statPlayers = document.createElement('span');
        statPlayers.className = 'game-stats__item';
        statPlayers.textContent = players + ' ' + t('playersShort');
        stats.appendChild(statPlays);
        stats.appendChild(statPlayers);

        var canEdit = false;
        if(authState.user){
            if(authState.user.role === 'admin') canEdit = true;
            else if(!quiz.ownerId) canEdit = true;
            else if(authState.user.id && quiz.ownerId && authState.user.id === quiz.ownerId.toString()) canEdit = true;
        }else if(ownsLocal(quiz.id)){
            canEdit = true;
        }
        var canStart = quiz.visibility !== 'private' || canEdit;
        var canClone = authState.user && (quiz.allowClone || canEdit);
        var canSaveToAccount = !authState.user && canEdit;

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

        var tagWrap = document.createElement('div');
        tagWrap.className = 'tag-wrap';
        var tags = normalizeInlineTags(Array.isArray(quiz.tags) ? quiz.tags : []);
        if(tags.length){
            tags.forEach(function(tagValue){
                if(!canEdit){
                    var tag = document.createElement('span');
                    tag.className = 'tag';
                    tag.textContent = tagValue;
                    tag.onclick = function(){ toggleTagFilter(tagValue); };
                    tagWrap.appendChild(tag);
                    return;
                }

                var tagEl = document.createElement('span');
                tagEl.className = 'tag tag-editable';

                var tagText = document.createElement('span');
                tagText.className = 'tag-text';
                tagText.textContent = tagValue;
                tagText.onclick = function(){ toggleTagFilter(tagValue); };

                var removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'tag-remove';
                removeBtn.setAttribute('aria-label', 'Remove');
                removeBtn.textContent = '×';
                removeBtn.onclick = async function(ev){
                    ev.preventDefault();
                    ev.stopPropagation();
                    if(tags.length <= 1){
                        alert(t('editTagsNeedOne'));
                        return;
                    }
                    var next = tags.filter(function(x){ return x !== tagValue; });
                    await updateQuizTags(quiz.id, next);
                };

                tagEl.appendChild(tagText);
                tagEl.appendChild(removeBtn);
                tagWrap.appendChild(tagEl);
            });
        }

        var tagEditor = null;
        if(canEdit){
            tagEditor = document.createElement('div');
            tagEditor.className = 'tag-editor';
            var tagInput = document.createElement('input');
            tagInput.type = 'text';
            tagInput.placeholder = t('editTagsPlaceholder');

            var addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'btn btn-ghost btn-small';
            addBtn.textContent = t('editTagsAdd');

            async function submitTags(){
                var raw = (tagInput.value || '').trim();
                if(!raw) return;
                var parsed = parseTagInput(raw);
                if(!parsed.length){
                    tagInput.value = '';
                    return;
                }
                var next = normalizeInlineTags(tags.concat(parsed));
                tagInput.value = '';
                await updateQuizTags(quiz.id, next);
            }

            addBtn.onclick = function(){ submitTags(); };
            tagInput.addEventListener('keydown', function(e){
                if(e.key === 'Enter'){
                    e.preventDefault();
                    submitTags();
                }
                if(e.key === ','){
                    // permite pegar/teclear y añadir rápido
                    setTimeout(function(){ submitTags(); }, 0);
                }
            });

            tagEditor.appendChild(tagInput);
            tagEditor.appendChild(addBtn);
        }

        var actions = document.createElement('div');
        actions.className = 'game-actions';

        if(canSaveToAccount){
            var saveAccountBtn = document.createElement('button');
            saveAccountBtn.className = 'btn btn-primary';
            saveAccountBtn.textContent = t('saveToAccount');
            saveAccountBtn.onclick = function(){
                claimQuizToAccount(quiz.id);
            };
            actions.appendChild(saveAccountBtn);
        }

        var playBtn = document.createElement('button');
        playBtn.className = 'btn btn-primary';
        playBtn.textContent = t('play');
        playBtn.onclick = function(){
            if(!canStart){
                warnNoPermission(t('cannotStartPrivate'));
                return;
            }
            startGame(quiz.id);
        };
        if(!canStart){
            playBtn.title = t('cannotStartPrivate');
            playBtn.disabled = true;
        }

        var soloBtn = document.createElement('button');
        soloBtn.className = 'btn btn-ghost';
        soloBtn.textContent = t('playSolo');
        soloBtn.onclick = function(){
            if(!canStart){
                warnNoPermission(t('cannotStartPrivate'));
                return;
            }
            startSolo(quiz.id);
        };
        if(!canStart){
            soloBtn.title = t('cannotStartPrivate');
            soloBtn.disabled = true;
        }

        var mpBtn = document.createElement('button');
        mpBtn.className = 'btn btn-ghost';
        mpBtn.textContent = t('playMultiplayer');
        mpBtn.onclick = function(){
            if(!canStart){
                warnNoPermission(t('cannotStartPrivate'));
                return;
            }
            startMultiplayer(quiz.id);
        };
        if(!canStart){
            mpBtn.title = t('cannotStartPrivate');
            mpBtn.disabled = true;
        }

        var editBtn = document.createElement('button');
        editBtn.className = 'btn btn-ghost icon-only';
        editBtn.innerHTML = '✏️';
        editBtn.title = canEdit ? t('edit') : t('cannotEditNotOwner');
        editBtn.disabled = !canEdit;
        editBtn.onclick = function(){
            if(!canEdit){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            window.location.href = '/create/quiz-creator/?id=' + quiz.id;
        };

        var downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-ghost icon-only';
        downloadBtn.innerHTML = '⬇️';
        downloadBtn.title = t('download');
        downloadBtn.onclick = function(){
            downloadCsv(quiz.id);
        };

        var moodleXmlBtn = document.createElement('button');
        moodleXmlBtn.className = 'btn btn-ghost icon-only';
        var moodleIcon = document.createElement('img');
        moodleIcon.src = '/icons/moodle.png';
        moodleIcon.alt = 'Moodle';
        moodleIcon.className = 'moodle-icon-img';
        moodleXmlBtn.appendChild(moodleIcon);
        moodleXmlBtn.title = t('exportMoodleXml');
        moodleXmlBtn.onclick = function(){
            downloadMoodleXml(quiz.id);
        };

        var exportSelect = document.createElement('select');
        exportSelect.className = 'export-select';
        exportSelect.setAttribute('aria-label', t('exportSelectLabel'));
        exportSelect.title = t('exportSelectLabel');
        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = t('exportSelectPlaceholder');
        placeholder.selected = true;
        placeholder.disabled = true;
        exportSelect.appendChild(placeholder);

        var pdfGroup = document.createElement('optgroup');
        pdfGroup.label = 'PDF';
        [
            { value: 'pdf-normal', label: t('pdfOptionNormal') },
            { value: 'pdf-no-answers', label: t('pdfOptionNoAnswers') },
            { value: 'pdf-random', label: t('pdfOptionRandom') },
            { value: 'pdf-random-no-answers', label: t('pdfOptionRandomNoAnswers') }
        ].forEach(function(opt){
            var option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            pdfGroup.appendChild(option);
        });

        var docxGroup = document.createElement('optgroup');
        docxGroup.label = 'DOCX';
        [
            { value: 'docx-normal', label: t('docOptionNormal') },
            { value: 'docx-no-answers', label: t('docOptionNoAnswers') },
            { value: 'docx-no-images', label: t('docOptionNoImages') },
            { value: 'docx-no-answers-no-images', label: t('docOptionNoAnswersNoImages') }
        ].forEach(function(opt){
            var option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            docxGroup.appendChild(option);
        });

        var odtGroup = document.createElement('optgroup');
        odtGroup.label = 'ODT';
        [
            { value: 'odt-normal', label: t('docOptionNormal') },
            { value: 'odt-no-answers', label: t('docOptionNoAnswers') },
            { value: 'odt-no-images', label: t('docOptionNoImages') },
            { value: 'odt-no-answers-no-images', label: t('docOptionNoAnswersNoImages') }
        ].forEach(function(opt){
            var option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            odtGroup.appendChild(option);
        });

        exportSelect.appendChild(pdfGroup);
        exportSelect.appendChild(docxGroup);
        exportSelect.appendChild(odtGroup);

        exportSelect.onchange = function(){
            var choice = exportSelect.value || '';
            if(!choice) return;
            var includeAnswers = !choice.includes('no-answers');
            var includeImages = !choice.includes('no-images');
            if(choice.indexOf('pdf-') === 0){
                var isRandom = choice.indexOf('random') !== -1;
                downloadPdf(quiz.id, {
                    includeAnswers: includeAnswers,
                    shuffleQuestions: isRandom,
                    shuffleAnswers: isRandom
                });
            }else if(choice.indexOf('docx-') === 0){
                downloadDocx(quiz.id, { includeAnswers: includeAnswers, includeImages: includeImages });
            }else if(choice.indexOf('odt-') === 0){
                downloadOdt(quiz.id, { includeAnswers: includeAnswers, includeImages: includeImages });
            }
            exportSelect.value = '';
        };

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger icon-only';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = canEdit ? t('delete') : t('cannotDeleteNotOwner');
        deleteBtn.disabled = !canEdit;
        deleteBtn.onclick = function(){
            if(!canEdit){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            if(confirm(t('confirmDelete'))){
                deleteQuiz(quiz.id);
            }
        };

        actions.appendChild(playBtn);
        actions.appendChild(mpBtn);
        actions.appendChild(soloBtn);
        actions.appendChild(editBtn);
        actions.appendChild(downloadBtn);
        actions.appendChild(moodleXmlBtn);

        var cloneBtn = document.createElement('button');
        cloneBtn.className = 'btn btn-ghost icon-only';
        cloneBtn.innerHTML = '📄';
        cloneBtn.title = canClone ? t('clone') : t('cannotCloneNotOwner');
        cloneBtn.disabled = !canClone;
        cloneBtn.onclick = function(){
            if(!canClone){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            cloneQuiz(quiz.id);
        };
        actions.appendChild(cloneBtn);
        actions.appendChild(deleteBtn);
        actions.appendChild(exportSelect);

        var share = document.createElement('div');
        share.className = 'share-controls';
        var shareTitle = document.createElement('div');
        shareTitle.className = 'share-row';
        shareTitle.innerHTML = '<strong>'+t('saveSharing')+'</strong>';

        var shareRow = document.createElement('div');
        shareRow.className = 'share-row';
        var select = document.createElement('select');
        var optPrivate = document.createElement('option');
        optPrivate.value = 'private';
        optPrivate.textContent = t('visibilityPrivate');
        var optUnlisted = document.createElement('option');
        optUnlisted.value = 'unlisted';
        optUnlisted.textContent = t('visibilityUnlisted');
        var optPublic = document.createElement('option');
        optPublic.value = 'public';
        optPublic.textContent = t('visibilityPublic');
        select.appendChild(optPrivate);
        select.appendChild(optUnlisted);
        select.appendChild(optPublic);
        select.value = quiz.visibility || 'public';
        select.disabled = !canEdit;

        var cloneLabel = document.createElement('label');
        cloneLabel.className = 'checkbox-label';
        var cloneCheck = document.createElement('input');
        cloneCheck.type = 'checkbox';
        cloneCheck.checked = !!quiz.allowClone;
        cloneCheck.disabled = !canEdit;
        cloneLabel.appendChild(cloneCheck);
        cloneLabel.appendChild(document.createTextNode(t('allowClone')));

        var shareBtn = document.createElement('button');
        shareBtn.className = 'btn btn-ghost';
        shareBtn.textContent = t('saveSharing');
        if(!canEdit){
            shareBtn.title = t('cannotEditNotOwner');
            shareBtn.disabled = true;
        }
        shareBtn.onclick = function(){
            if(!canEdit){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            updateSharing(quiz.id, select.value, cloneCheck.checked);
        };

        shareRow.appendChild(select);
        shareRow.appendChild(cloneLabel);
        shareRow.appendChild(shareBtn);
        share.appendChild(shareTitle);
        share.appendChild(shareRow);

        card.appendChild(head);
        card.appendChild(subtitle);
        card.appendChild(meta);
        card.appendChild(stats);
        card.appendChild(tagWrap);
        if(tagEditor) card.appendChild(tagEditor);
        card.appendChild(share);
        card.appendChild(actions);
        div.appendChild(card);
    });
}

function updatePaginationControls(visible){
    var pagination = document.getElementById('library-pagination');
    if(!pagination) return;
    pagination.classList.toggle('hidden', !visible);
    var info = document.getElementById('library-pagination-info');
    if(info){
        var template = t('paginationPageInfo');
        info.textContent = template.replace('{current}', libraryCurrentPage).replace('{total}', libraryTotalPages);
    }
    var prevBtn = document.getElementById('library-pagination-prev');
    var nextBtn = document.getElementById('library-pagination-next');
    if(prevBtn){
        prevBtn.disabled = libraryCurrentPage <= 1;
    }
    if(nextBtn){
        nextBtn.disabled = libraryCurrentPage >= libraryTotalPages;
    }
}

function startGame(data){
    window.location.href="/host/" + "?id=" + data;
}

function startSolo(data){
    window.location.href = "/solo/" + "?id=" + encodeURIComponent(data);
}

function startMultiplayer(data){
    window.location.href = "/multiplayer/" + "?id=" + encodeURIComponent(data);
}

async function renameQuiz(id, name){
    try{
        var headers = { 'Content-Type': 'application/json' };
        if(getAnonOwnerToken()){
            headers['X-Owner-Token'] = getAnonOwnerToken();
        }
        var res = await fetch('/api/quizzes/' + id, {
            method: 'PATCH',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify({ name: name })
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('renameError') || t('saveError'));
            return;
        }
        socket.emit('requestDbNames');
    }catch(err){
        alert(t('renameError') || t('saveError'));
    }
}

async function deleteQuiz(id){
    try{
        var headers = {};
        if(getAnonOwnerToken()){
            headers['X-Owner-Token'] = getAnonOwnerToken();
        }
        var res = await fetch('/api/quizzes/' + id, { method: 'DELETE', credentials: 'include', headers: headers });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('deleteError'));
            return;
        }
        socket.emit('requestDbNames');
    }catch(err){
        alert(t('deleteError'));
    }
}

async function updateSharing(id, visibility, allowClone){
    try{
        var headers = { 'Content-Type': 'application/json' };
        if(getAnonOwnerToken()){
            headers['X-Owner-Token'] = getAnonOwnerToken();
        }
        var res = await fetch('/api/quizzes/' + id + '/sharing', {
            method: 'PATCH',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify({ visibility: visibility, allowClone: allowClone })
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('sharingError') || t('saveError'));
            return;
        }
        if(result.migrated && result.id){
            try{
                var stored = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
                var idx = stored.map(function(x){ return String(x); }).indexOf(String(id));
                if(idx !== -1){
                    stored.splice(idx, 1);
                }
                var resultExists = stored.some(function(x){ return String(x) === String(result.id); });
                if(!resultExists){
                    stored.push(result.id);
                }
                localStorage.setItem('localQuizzes', JSON.stringify(stored));
            }catch(e){}
        }
        socket.emit('requestDbNames');
    }catch(err){
        alert(t('sharingError') || t('saveError'));
    }
}

async function cloneQuiz(id){
    if(!authState.user){
        alert(t('notLogged'));
        return;
    }
    try{
        var res = await fetch('/api/quizzes/' + id + '/clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('cloneError'));
            return;
        }
        alert(t('cloneOk'));
        socket.emit('requestDbNames');
    }catch(err){
        alert(t('cloneError'));
    }
}

var csvForm = document.getElementById('csv-form');
if (csvForm) {
    csvForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var fileInput = document.getElementById('csv-file');
        var nameInput = document.getElementById('csv-name');
        var status = document.getElementById('csv-status');

        if (!fileInput.files || fileInput.files.length === 0) {
            status.textContent = t('selectCsv');
            return;
        }

        var formData = new FormData();
        formData.append('file', fileInput.files[0]);
        if (nameInput.value && nameInput.value.trim()) {
            formData.append('name', nameInput.value.trim());
        }
        formData.append('ownerToken', getAnonOwnerToken());

        status.textContent = t('uploadCsv');
        try {
            var response = await fetch('/api/upload-csv', {
                method: 'POST',
                body: formData
            });
            var result = await response.json();
            if (!response.ok) {
                status.textContent = result.error || t('uploadCsvError');
                return;
            }
            status.textContent = t('importSuccess') + ': ' + result.name + ' (' + result.count + ') ';
            var startBtn = document.createElement('button');
            startBtn.textContent = t('startNow') || t('play');
            startBtn.onclick = function() { startGame(result.id); };
            status.appendChild(startBtn);
            csvForm.reset();
            rememberClaimableQuizId(result.id);
            socket.emit('requestDbNames');
            fetchWithFilters();
        } catch (err) {
            status.textContent = t('uploadCsvError');
        }
    });
}

var iaGenerate = document.getElementById('ia-generate');
var iaCopy = document.getElementById('ia-copy');
var iaPrompt = document.getElementById('ia-prompt');
var iaIdioma = document.getElementById('ia-idioma');
var iaIdiomaCustom = document.getElementById('ia-idioma-custom');
var iaUseDocs = document.getElementById('ia-use-docs');
var iaGenSvg = document.getElementById('ia-gen-svg');
var iaGenSvgWrap = document.getElementById('ia-gen-svg-wrap');
var iaDocsHint = document.getElementById('ia-docs-hint');
var iaTema = document.getElementById('ia-tema');

// --- Auth ---
// L'accés és el xip de compte d'EduTicTac (Commons). EduHoot manté la seua sessió
// Authentik: quan el xip ja té sessió de professorat, s'entra a EduHoot sense
// demanar res més (SSO), i quan el xip la tanca, EduHoot també.
var authModal = document.getElementById('auth-modal');
var openAccountBtn = document.getElementById('open-account');
var openAccountMenuBtn = document.getElementById('open-account-menu');
var newUserSignin = document.getElementById('new-user-signin');
var accountChip = document.querySelector('edutictac-account');
var AUTH_BRIDGE_KEY = 'eduh_auth_bridge';
var AUTH_BRIDGE_RETRY_MS = 2 * 60 * 1000;
var authBridgeFailed = false;

if(openAccountBtn) openAccountBtn.addEventListener('click', openAuthModal);

if(authModal){
    authModal.querySelectorAll('[data-modal-close]').forEach(function(el){
        el.addEventListener('click', function(){
            closeAuthModal();
        });
    });
}

document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && authModal && !authModal.classList.contains('hidden')){
        closeAuthModal();
    }
});

var authNick = document.getElementById('auth-nick');
var authStatus = document.getElementById('auth-status');
var authMsg = document.getElementById('auth-message');
var accountMsg = document.getElementById('account-message');
var authSaveNickBtn = document.getElementById('auth-save-nick');
var adminPanel = document.getElementById('user-admin');
var adminExportAllBtn = document.getElementById('admin-export-quizzes');
var adminImportFile = document.getElementById('admin-import-quizzes-file');
var adminImportReplace = document.getElementById('admin-import-quizzes-replace');
var adminImportBtn = document.getElementById('admin-import-quizzes');
var adminImportStatus = document.getElementById('admin-import-quizzes-status');
var adminMirrorKahootBtn = document.getElementById('admin-mirror-kahoot-images');
var adminMirrorKahootStatus = document.getElementById('admin-mirror-kahoot-status');
var adminMirrorExternalBtn = document.getElementById('admin-mirror-external-images');
var adminMirrorExternalStatus = document.getElementById('admin-mirror-external-status');
var adminImportPublicWrap = document.getElementById('admin-import-public-wrap');
var adminImportPublicBtn = document.getElementById('admin-import-public-btn');
var adminImportPublicStatus = document.getElementById('admin-import-public-status');
var authState = { user: null, checked: false };
var authentikAuthEnabled = false;

window.addEventListener('edutictac:sessionchange', function(e){
    if(accountChip && sameSiteAsPage(accountChip.getAttribute('data-base') || '')) applyCentralSession(e.detail);
});

if(openAccountMenuBtn){
    openAccountMenuBtn.addEventListener('click', openCentralAccountMenu);
}
if(authSaveNickBtn){
    authSaveNickBtn.addEventListener('click', saveNickname);
}
if(adminExportAllBtn){
    adminExportAllBtn.addEventListener('click', exportAllQuizzesAsAdmin);
}
if(adminImportBtn){
    adminImportBtn.addEventListener('click', importAllQuizzesAsAdmin);
}
if(adminMirrorKahootBtn){
    adminMirrorKahootBtn.addEventListener('click', async function(){
        if(adminMirrorKahootStatus) adminMirrorKahootStatus.textContent = t('mirrorKahootWorking');
        adminMirrorKahootBtn.disabled = true;
        try{
            var res = await fetch('/api/admin/mirror-kahoot-images', { method: 'POST', credentials: 'include' });
            var data = await res.json();
            if(!res.ok) throw new Error(data.error || '');
            if(adminMirrorKahootStatus) adminMirrorKahootStatus.textContent = t('mirrorKahootOk');
        }catch(e){
            if(adminMirrorKahootStatus) adminMirrorKahootStatus.textContent = t('mirrorKahootError') + (e.message ? ' ' + e.message : '');
        }finally{
            adminMirrorKahootBtn.disabled = false;
        }
    });
}
if(adminMirrorExternalBtn){
    adminMirrorExternalBtn.addEventListener('click', async function(){
        if(adminMirrorExternalStatus) adminMirrorExternalStatus.textContent = t('mirrorExternalWorking');
        adminMirrorExternalBtn.disabled = true;
        try{
            var res = await fetch('/api/admin/mirror-external-images', { method: 'POST', credentials: 'include' });
            var data = await res.json();
            if(!res.ok) throw new Error(data.error || '');
            if(adminMirrorExternalStatus) adminMirrorExternalStatus.textContent = t('mirrorExternalOk');
        }catch(e){
            if(adminMirrorExternalStatus) adminMirrorExternalStatus.textContent = t('mirrorExternalError') + (e.message ? ' ' + e.message : '');
        }finally{
            adminMirrorExternalBtn.disabled = false;
        }
    });
}
if(adminImportPublicBtn){
    adminImportPublicBtn.addEventListener('click', async function(){
        if(adminImportPublicStatus) adminImportPublicStatus.textContent = t('importPublicWorking');
        adminImportPublicBtn.disabled = true;
        try{
            var res = await fetch('/api/admin/import-public-activities', { method: 'POST', credentials: 'include' });
            var data = await res.json();
            if(!res.ok) throw new Error(data.error || '');
            if(adminImportPublicStatus) adminImportPublicStatus.textContent =
                t('importPublicOk') + ': ' + data.imported + ' / ' + data.total + ' (' + data.skipped + ' ' + t('importPublicSkipped') + ')';
            socket.emit('requestDbNames');
        }catch(e){
            if(adminImportPublicStatus) adminImportPublicStatus.textContent = t('importPublicError') + (e.message ? ' ' + e.message : '');
        }finally{
            adminImportPublicBtn.disabled = false;
        }
    });
}
// Start auth check on load
try{
    var authParams = new URLSearchParams(window.location.search);
    var authentikResult = authParams.get('authentik');
    if(authentikResult){
        if(authentikResult !== 'ok'){
            authBridgeFailed = true;
            if(authMsg) authMsg.textContent = t('loginError');
        }
        authParams.delete('authentik');
        var cleanUrl = window.location.pathname + (authParams.toString() ? '?' + authParams.toString() : '') + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
    }
}catch(e){}
fetchMe().then(syncCentralSession);
fetchTags();

fetch('/api/auth/authentik/config', { credentials: 'include' })
    .then(function(res){ return res.ok ? res.json() : { enabled: false }; })
    .then(function(cfg){
        authentikAuthEnabled = !!cfg.enabled;
        updateAuthUI();
        syncCentralSession();
    })
    .catch(function(){});

fetch('/api/admin/import-public-activities/config', { credentials: 'include' })
    .then(function(res){ return res.ok ? res.json() : { enabled: false }; })
    .then(function(cfg){
        if(adminImportPublicWrap) adminImportPublicWrap.classList.toggle('hidden', !cfg.enabled);
    })
    .catch(function(){});

if (iaIdioma) {
    iaIdioma.addEventListener('change', function(){
        if (iaIdioma.value === 'otro') {
            iaIdiomaCustom.classList.remove('hidden');
        } else {
            iaIdiomaCustom.classList.add('hidden');
            iaIdiomaCustom.value = '';
        }
    });
}

if(iaUseDocs){
    try{
        iaUseDocs.checked = localStorage.getItem('eduh_ia_use_docs') === '1';
    }catch(e){}
    applyIaDocsMode();
    iaUseDocs.addEventListener('change', function(){
        try{ localStorage.setItem('eduh_ia_use_docs', iaUseDocs.checked ? '1' : '0'); }catch(e){}
        applyIaDocsMode();
    });
}

if(iaGenSvg){
    try{
        iaGenSvg.checked = localStorage.getItem('eduh_ia_gen_svg') === '1';
    }catch(e){}
    iaGenSvg.addEventListener('change', function(){
        try{ localStorage.setItem('eduh_ia_gen_svg', iaGenSvg.checked ? '1' : '0'); }catch(e){}
    });
}

if (iaGenerate) {
    iaGenerate.addEventListener('click', function(){
        var params = {
            nombre: document.getElementById('ia-name').value.trim(),
            nivel: document.getElementById('ia-nivel').value.trim(),
            tema: document.getElementById('ia-tema').value.trim(),
            idioma: iaIdioma ? iaIdioma.value : 'Español',
            idiomaCustom: iaIdiomaCustom ? iaIdiomaCustom.value.trim() : '',
            num: parseInt(document.getElementById('ia-num').value, 10) || 10,
            extra: document.getElementById('ia-extra').value.trim(),
            tipos: getSelectedIaTypes(),
            useDocs: iaUseDocs ? iaUseDocs.checked : false,
            genSvg: iaGenSvg ? iaGenSvg.checked : false
        };
        iaPrompt.textContent = buildPrompt(params);
    });
}

if (iaCopy) {
    iaCopy.addEventListener('click', function(){
        if (!iaPrompt || !iaPrompt.textContent.trim()) return;
        navigator.clipboard.writeText(iaPrompt.textContent).catch(function(){});
    });
}

var iaUpload = document.getElementById('ia-upload');
var iaPreviewBtn = document.getElementById('ia-preview');
var iaOpenBtn = document.getElementById('ia-open');
var iaDownloadBtn = document.getElementById('ia-download');
var iaEditBtn = document.getElementById('ia-edit');
var iaCsvFile = document.getElementById('ia-csv-file');
var iaPreviewBox = document.getElementById('ia-preview-box');
var iaPreviewContent = document.getElementById('ia-preview-content');

var lastIaUploadedQuizId = null;

if(iaPreviewBtn){
    iaPreviewBtn.addEventListener('click', function(){
        var csvText = document.getElementById('ia-csv') ? document.getElementById('ia-csv').value : '';
        var clean = sanitizeIaCsv(csvText);
        var ta = document.getElementById('ia-csv');
        if(ta && clean) ta.value = clean;
        renderIaPreview(clean || csvText);
    });
}

if(iaOpenBtn && iaCsvFile){
    iaOpenBtn.addEventListener('click', function(){ iaCsvFile.click(); });
    iaCsvFile.addEventListener('change', function(e){
        var file = e.target.files && e.target.files[0];
        if(!file) return;
        var reader = new FileReader();
        reader.onload = function(ev){
            var ta = document.getElementById('ia-csv');
            if(ta) ta.value = String(ev.target.result || '');
            if(iaPreviewBox) iaPreviewBox.classList.add('hidden');
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = '';
    });
}

if(iaDownloadBtn){
    iaDownloadBtn.addEventListener('click', function(){
        var csvText = document.getElementById('ia-csv') ? document.getElementById('ia-csv').value : '';
        var cleaned = sanitizeIaCsv(csvText);
        var ta = document.getElementById('ia-csv');
        if(ta && cleaned) ta.value = cleaned;
        var normalized = normalizeCsvForDownload(cleaned || csvText);
        if(!normalized){
            alert(t('alertNothingToSave'));
            return;
        }
        var blob = new Blob(['\uFEFF' + normalized], { type: 'text/csv;charset=utf-8;' });
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'quiz.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    });
}

if(iaEditBtn){
    iaEditBtn.addEventListener('click', function(){
        if(!lastIaUploadedQuizId) return;
        window.location.href = 'quiz-creator/?id=' + encodeURIComponent(lastIaUploadedQuizId);
    });
}

if (iaUpload) {
    iaUpload.addEventListener('click', async function(){
        var status = document.getElementById('ia-status');
        var csvText = document.getElementById('ia-csv').value.trim();
        var cleaned = sanitizeIaCsv(csvText);
        if(cleaned){
            csvText = cleaned.trim();
            try{ document.getElementById('ia-csv').value = cleaned; }catch(e){}
        }
        var quizName = document.getElementById('ia-name').value.trim();
        if (!csvText) {
            status.textContent = t('selectCsv');
            return;
        }
        status.textContent = t('importing');
        if(iaEditBtn) iaEditBtn.disabled = true;
        lastIaUploadedQuizId = null;
        try{
            var blob = new Blob([csvText], { type: 'text/csv' });
            var file = new File([blob], 'ia.csv', { type: 'text/csv' });
            var formData = new FormData();
            formData.append('file', file);
            if (quizName) formData.append('name', quizName);
            formData.append('ownerToken', getAnonOwnerToken());
            var iaTags = buildIaTags();
            iaTags.forEach(function(tag){
                formData.append('tags', tag);
            });

            var response = await fetch('/api/upload-csv', { method: 'POST', body: formData });
            var result = await response.json();
            if (!response.ok) {
                status.textContent = result.error || t('uploadCsvError');
                return;
            }
            status.textContent = t('importSuccess') + ': ' + result.name + ' (' + result.count + ')';
            if (result.id) {
                lastIaUploadedQuizId = result.id;
                if(iaEditBtn) iaEditBtn.disabled = false;
                var startBtn = document.createElement('button');
                startBtn.className = 'btn btn-primary';
                startBtn.textContent = t('play');
                startBtn.style.marginLeft = '8px';
                startBtn.onclick = function(){ startGame(result.id); };
                status.appendChild(startBtn);
                rememberClaimableQuizId(result.id);
            }
            currentFilters.tags = [];
            socket.emit('requestDbNames');
            fetchWithFilters();
        }catch(err){
            status.textContent = t('uploadCsvError');
        }
    });
}

// Start auth check on load
fetchMe();

var langSelector = document.getElementById('lang-select');
if(langSelector){
    langSelector.value = lang;
    langSelector.addEventListener('change', function(){
        setLang(langSelector.value);
    });
}
applyStaticTranslations();
renderTagModeToggle();

function reconnectSocket(){
    try{
        socket.disconnect();
        socket.connect();
    }catch(e){}
}

// Importar Kahoot públic
var kahootForm = document.getElementById('kahoot-form');
var kahootUrlInput = document.getElementById('kahoot-url');
var kahootStatus = document.getElementById('kahoot-status');
var kahootVisSelect = document.getElementById('kahoot-visibility');
if(kahootForm){
    kahootForm.addEventListener('submit', async function(e){
        e.preventDefault();
        if(!kahootUrlInput || !kahootUrlInput.value.trim()){
            return;
        }
        var raw = kahootUrlInput.value.trim();
        var payload = {
            visibility: kahootVisSelect ? kahootVisSelect.value : 'public',
            ownerToken: getAnonOwnerToken()
        };
        if(/^https?:\/\//i.test(raw)) payload.url = raw;
        else payload.id = raw;

        var submitBtn = kahootForm.querySelector('button[type="submit"]');
        if(submitBtn) submitBtn.disabled = true;
        if(kahootStatus) kahootStatus.textContent = t('importing');
    try{
        var res = await fetch('/api/import/kahoot', {
            method: 'POST',
            headers: (function(){
                var base = { 'Content-Type': 'application/json' };
                var token = getAnonOwnerToken();
                if(token) base['X-Owner-Token'] = token;
                return base;
            })(),
            body: JSON.stringify(payload)
        });
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
                if(kahootStatus) kahootStatus.textContent = body.error || t('importError');
                if(submitBtn) submitBtn.disabled = false;
                return;
            }
            if(kahootStatus){
                kahootStatus.innerHTML = t('importSuccess') + ': ' + (body.name || '') + ' (' + body.count + ') ';
                var btn = document.createElement('button');
                btn.textContent = t('play');
                btn.onclick = function(){ startGame(body.id); };
                btn.className = 'btn btn-primary btn-small';
                kahootStatus.appendChild(btn);
                if(body.id){
                    var editBtn = document.createElement('button');
                    editBtn.textContent = t('editQuiz');
                    editBtn.className = 'btn btn-ghost btn-small';
                    editBtn.onclick = function(){ window.location.href = '/create/quiz-creator/?id=' + body.id; };
                    kahootStatus.appendChild(editBtn);
                }
            }
            if(submitBtn) submitBtn.disabled = false;
            if(body.id) rememberClaimableQuizId(body.id);
            socket.emit('requestDbNames');
        }catch(err){
            if(kahootStatus) kahootStatus.textContent = t('importError');
            if(submitBtn) submitBtn.disabled = false;
        }
    });
}
