// Sesión y cuenta en /create/: login, chip de EduTicTac, propiedad de quizzes anónimos y reclamarlos al entrar, extraído de create.js
function getAnonOwnerToken(){
    var key = 'anonOwnerToken';
    var existing = localStorage.getItem(key);
    if(existing) return existing;
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    var token = Array.from(arr).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
    localStorage.setItem(key, token);
    return token;
}

function ownsLocal(id){
    if(id === undefined || id === null) return false;
    try{
        var stored = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
        return stored.map(function(x){ return String(x); }).indexOf(String(id)) !== -1;
    }catch(e){
        return false;
    }
}

function openAuthModal(){
    if(!authModal) return;
    authModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    try{ if(authNick) authNick.focus(); }catch(e){}
}

function closeAuthModal(){
    if(!authModal) return;
    authModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function openCentralAccountMenu(){
    var menu = document.querySelector('edutictac-account details.eta-account');
    if(!menu){
        // Sense xip (Commons no respon): l'accés propi d'EduHoot fa de respost.
        if(authentikAuthEnabled) loginWithAuthentik();
        else if(authMsg) authMsg.textContent = t('accountUnavailable');
        return;
    }
    // El xip tanca el menú amb qualsevol clic de fora: s'obri quan este clic ja ha passat.
    window.setTimeout(function(){
        menu.open = true;
        try{ menu.querySelector('summary').focus(); }catch(e){}
    }, 0);
}

function requireLogin(message){
    if(authMsg) authMsg.textContent = message || t('loginToSave');
    openCentralAccountMenu();
}

function warnNoPermission(message){
    var msg = message || t('permissionDenied');
    if(!(authState && authState.user)){
        requireLogin(msg);
        return;
    }
    try{ window.alert(msg); }catch(e){}
}

function updateTitleUserId(){
    var base = document.title.replace(/ \[[^\]]*\]$/, '');
    var name = authState.user && (authState.user.nickname || authState.user.email);
    document.title = name ? (base + ' [' + name + ']') : base;
}

function updateAuthUI(){
    var isLogged = !!(authState && authState.user);
    if(newUserSignin){
        newUserSignin.classList.toggle('hidden', !authentikAuthEnabled || isLogged);
    }
    if(openAccountBtn) openAccountBtn.classList.toggle('hidden', !isLogged);

    if(authStatus){
        if(isLogged){
            var nickPart = authState.user.nickname ? ' · ' + authState.user.nickname : '';
            authStatus.textContent = authState.user.email + nickPart + ' (' + authState.user.role + ')';
            authStatus.classList.remove('pill-muted');
        }else{
            authStatus.textContent = t('authStatus');
            authStatus.classList.add('pill-muted');
        }
    }
    if(adminPanel){
        adminPanel.classList.toggle('hidden', !(isLogged && authState.user.role === 'admin'));
    }

    if(iaGenSvgWrap){
        iaGenSvgWrap.classList.toggle('hidden', !isLogged);
        if(!isLogged && iaGenSvg){
            iaGenSvg.checked = false;
            try{ localStorage.setItem('eduh_ia_gen_svg', '0'); }catch(e){}
        }
    }

    updateTitleUserId();
}

function fetchMe(){
    return fetch('/api/auth/me', { credentials: 'include' })
        .then(function(res){
            if(!res.ok) throw new Error();
            return res.json();
        })
        .then(function(user){
            authState.user = user;
            authState.checked = true;
            try{ sessionStorage.removeItem(AUTH_BRIDGE_KEY); }catch(e){}
            updateAuthUI();
            currentFilters.mineOnly = true;
            fetchWithFilters();
            claimPendingQuizAfterLogin();
        })
        .catch(function(){
            authState.user = null;
            authState.checked = true;
            updateAuthUI();
            fetchWithFilters();
        });
}

function logout(){
    return fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        .then(function(){
            authState.user = null;
            currentFilters.mineOnly = false;
            updateAuthUI();
            closeAuthModal();
            reconnectSocket();
            fetchWithFilters();
        })
        .catch(function(){});
}

function loginWithAuthentik(){
    var next = window.location.pathname + window.location.search;
    window.location.href = '/api/auth/authentik/start?next=' + encodeURIComponent(next || '/create/');
}

function bridgeRecentlyTried(){
    try{
        var last = Number(sessionStorage.getItem(AUTH_BRIDGE_KEY) || 0);
        return !!last && (Date.now() - last) < AUTH_BRIDGE_RETRY_MS;
    }catch(e){
        return true;
    }
}

// Alinea la sessió d'EduHoot amb la del xip. Sense resposta de Commons no es toca res.
function applyCentralSession(central){
    if(!central || !authState.checked) return;
    var centralTeacher = !!central.authenticated && central.kind === 'oidc';
    if(centralTeacher && !authState.user){
        if(!authentikAuthEnabled || authBridgeFailed || bridgeRecentlyTried()) return;
        try{ sessionStorage.setItem(AUTH_BRIDGE_KEY, String(Date.now())); }catch(e){ return; }
        loginWithAuthentik();
    }else if(!central.authenticated && authState.user){
        logout();
    }
}

// Només quan EduHoot i Commons són del mateix lloc: eduhoot.edutictac.es i
// commons.edutictac.es, o el mateix host d'un Commons local (edutictac.local, IP).
// Una instal·lació local no depén del Commons d'internet.
function sameSiteAsPage(base){
    try{
        var baseHost = new URL(base).hostname;
        var host = window.location.hostname;
        // Amb IP (o un nom sense domini, com edutictac.local) ha de ser el mateix host.
        if(/^[0-9.]+$|^\[|:/.test(baseHost) || baseHost.split('.').length < 3) return host === baseHost;
        var site = baseHost.split('.').slice(-2).join('.');
        return host === site || host.slice(-(site.length + 1)) === '.' + site;
    }catch(e){
        return false;
    }
}

function syncCentralSession(){
    if(!accountChip || !authState.checked) return;
    var base = (accountChip.getAttribute('data-base') || '').replace(/\/+$/, '');
    if(!base || !sameSiteAsPage(base)) return;
    fetch(base + '/api/auth/session', { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })
        .then(function(res){ return res.ok ? res.json() : null; })
        .then(applyCentralSession)
        .catch(function(){});
}

function removeLocalQuizId(id){
    if(!id) return;
    try{
        var stored = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
        stored = stored.filter(function(x){ return String(x) !== String(id); });
        localStorage.setItem('localQuizzes', JSON.stringify(stored));
    }catch(e){}
}

function rememberClaimableQuizId(id){
    if(id === undefined || id === null || authState.user) return;
    try{
        var stored = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
        var idText = String(id);
        var exists = stored.some(function(x){ return String(x) === idText; });
        if(!exists){
            stored.push(id);
            localStorage.setItem('localQuizzes', JSON.stringify(stored));
        }
    }catch(e){}
}

async function claimQuizToAccount(id, options){
    var silent = options && options.silent;
    if(!id) return false;
    if(!authState.user){
        try{ localStorage.setItem(PENDING_ACCOUNT_SAVE_KEY, String(id)); }catch(e){}
        requireLogin(t('loginToSave'));
        return false;
    }
    if(authMsg && !silent) authMsg.textContent = t('savingToAccount');
    try{
        var res = await fetch('/api/quizzes/' + encodeURIComponent(id) + '/claim', {
            method: 'POST',
            headers: { 'X-Owner-Token': getAnonOwnerToken() },
            credentials: 'include'
        });
        var body = {};
        try{ body = await res.json(); }catch(e){}
        if(!res.ok){
            if(authMsg && !silent) authMsg.textContent = body.error || t('saveToAccountError');
            if(!silent) alert(body.error || t('saveToAccountError'));
            return false;
        }
        removeLocalQuizId(body.previousId || id);
        try{ localStorage.removeItem(PENDING_ACCOUNT_SAVE_KEY); }catch(e){}
        if(authMsg) authMsg.textContent = t('saveToAccountOk');
        socket.emit('requestDbNames');
        fetchWithFilters();
        fetchTags();
        return true;
    }catch(err){
        if(authMsg && !silent) authMsg.textContent = t('saveToAccountError');
        if(!silent) alert(t('saveToAccountError'));
        return false;
    }
}

async function claimPendingQuizAfterLogin(){
    if(!authState.user) return;
    var pending = '';
    try{ pending = localStorage.getItem(PENDING_ACCOUNT_SAVE_KEY) || ''; }catch(e){}
    if(!pending) return;
    await claimQuizToAccount(pending, { silent: true });
}

async function saveNickname(){
    if(!authState.user) return;
    if(!authNick) return;
    var nick = authNick.value.trim();
    accountMsg.textContent = t('savingNick') || t('resetWaiting');
    try{
        var res = await fetch('/api/auth/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ nickname: nick })
        });
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
            accountMsg.textContent = body.error || t('nickSaveError') || t('resetUpdateError');
            return;
        }
        accountMsg.textContent = t('nickSaved') || t('saveOk');
        fetchMe();
    }catch(err){
        accountMsg.textContent = t('nickSaveError') || t('resetUpdateError');
    }
}
