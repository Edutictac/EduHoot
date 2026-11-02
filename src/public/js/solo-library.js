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
