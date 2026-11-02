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
