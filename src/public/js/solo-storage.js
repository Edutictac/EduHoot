// Favoritos, valoraciones con estrellas y deviceId (localStorage), extraído de solo.js
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
