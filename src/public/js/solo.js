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
var soloMusicPlayerInstance = null;
var SOLO_MUSIC_STORAGE_KEY = 'eduhoot-solo-music';
var SOLO_MUSIC_STORAGE_KEY_LEGACY = 'eduhook-solo-music';

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
    window.applySoloTranslations(newLang);
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
