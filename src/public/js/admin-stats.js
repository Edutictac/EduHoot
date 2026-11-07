(function(){
  var cardsEl = document.getElementById('cards');
  var breakdownEl = document.getElementById('breakdown');
  var errorEl = document.getElementById('stats-error');
  var loginFallbackBtn = document.getElementById('login-fallback');
  var loginStatus = document.getElementById('login-status');
  var accountChip = document.querySelector('edutictac-account');

  var authState = { user: null, checked: false };
  var authentikAuthEnabled = false;
  var authBridgeFailed = false;
  var AUTH_BRIDGE_KEY = 'eduh_auth_bridge_admin';
  var AUTH_BRIDGE_RETRY_MS = 2 * 60 * 1000;

  function safeJson(res){
    return res.json().catch(function(){ return {}; });
  }

  function setLoginStatus(msg){
    if(loginStatus) loginStatus.textContent = msg || '';
  }

  // Puente de sesión con el xip de EduTicTac/Authentik. Versión reducida de
  // create-auth.js: solo las partes genéricas, sin biblioteca/sockets/nicknames,
  // con su propia clave de sessionStorage para no interferir con /create/.
  function loginWithAuthentik(){
    var next = window.location.pathname + window.location.search;
    window.location.href = '/api/auth/authentik/start?next=' + encodeURIComponent(next || '/admin/stats');
  }

  function bridgeRecentlyTried(){
    try{
      var last = Number(sessionStorage.getItem(AUTH_BRIDGE_KEY) || 0);
      return !!last && (Date.now() - last) < AUTH_BRIDGE_RETRY_MS;
    }catch(e){
      return true;
    }
  }

  function logoutLite(){
    return fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .then(fetchMeLite)
      .then(loadStats)
      .catch(function(){});
  }

  // Alinea la sesión de EduHoot con la del xip. Sin respuesta de Commons no se toca nada.
  function applyCentralSession(central){
    if(!central || !authState.checked) return;
    var centralTeacher = !!central.authenticated && central.kind === 'oidc';
    if(centralTeacher && !authState.user){
      if(!authentikAuthEnabled || authBridgeFailed || bridgeRecentlyTried()) return;
      try{ sessionStorage.setItem(AUTH_BRIDGE_KEY, String(Date.now())); }catch(e){ return; }
      loginWithAuthentik();
    }else if(!central.authenticated && authState.user){
      logoutLite();
    }
  }

  // Solo cuando EduHoot y Commons son el mismo sitio: eduhoot.edutictac.es y
  // commons.edutictac.es, o el mismo host de un Commons local (edutictac.local, IP).
  function sameSiteAsPage(base){
    try{
      var baseHost = new URL(base).hostname;
      var host = window.location.hostname;
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

  function updateFallbackButton(){
    if(!loginFallbackBtn) return;
    var chipMounted = document.documentElement.classList.contains('has-account-chip');
    loginFallbackBtn.style.display = (authentikAuthEnabled && !authState.user && !chipMounted) ? '' : 'none';
  }

  function fetchMeLite(){
    return fetch('/api/auth/me', { credentials: 'include' })
      .then(function(res){
        if(!res.ok) throw new Error();
        return res.json();
      })
      .then(function(user){
        authState.user = user;
        authState.checked = true;
        try{ sessionStorage.removeItem(AUTH_BRIDGE_KEY); }catch(e){}
        updateFallbackButton();
      })
      .catch(function(){
        authState.user = null;
        authState.checked = true;
        updateFallbackButton();
      });
  }

  function handleAuthentikReturnParam(){
    try{
      var url = new URL(window.location.href);
      var result = url.searchParams.get('authentik');
      if(result && result !== 'ok'){
        authBridgeFailed = true;
        setLoginStatus('No se pudo completar el acceso con EduTicTac. Inténtalo de nuevo.');
      }
      if(result){
        url.searchParams.delete('authentik');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    }catch(e){}
  }

  function renderCards(data){
    if(!cardsEl) return;
    cardsEl.innerHTML = '';
    var cardData = [
      { label: 'Total de quizzes', value: data.totalQuizzes, badge: 'Todos' },
      { label: 'Preguntas totales', value: data.totalQuestions, badge: 'Contenido' },
      { label: 'Partidas jugadas', value: data.totalPlays, badge: 'Histórico' },
      { label: 'Jugadores totales', value: data.totalPlayers, badge: 'Histórico' },
      { label: 'Promedio de preguntas', value: data.avgQuestionsPerQuiz, badge: 'Media' },
      { label: 'Partidas activas', value: data.liveGames, badge: 'En vivo' },
      { label: 'Jugadores activos', value: data.livePlayers, badge: 'En vivo' },
      { label: 'Quizzes efímeros', value: data.ephemeral.totalQuizzes, badge: 'Local' }
    ];
    cardData.forEach(function(item, idx){
      var card = document.createElement('div');
      card.className = 'card';
      var h3 = document.createElement('h3');
      h3.textContent = item.label;
      var val = document.createElement('p');
      val.className = 'value';
      val.textContent = item.value || 0;
      var sub = document.createElement('div');
      sub.className = 'sub';
      sub.textContent = item.badge;
      card.appendChild(h3);
      card.appendChild(val);
      card.appendChild(sub);
      cardsEl.appendChild(card);
    });
  }

  function renderBreakdown(data){
    if(!breakdownEl) return;
    breakdownEl.innerHTML = '';
    var visPanel = document.createElement('div');
    visPanel.className = 'panel';
    var visTitle = document.createElement('h4');
    visTitle.textContent = 'Visibilidad';
    var ul = document.createElement('ul');
    ['public','unlisted','private'].forEach(function(key){
      var li = document.createElement('li');
      li.innerHTML = '<span>'+key+'</span><span class="value">'+(data.visibilityCounts[key] || 0)+'</span>';
      ul.appendChild(li);
    });
    visPanel.appendChild(visTitle);
    visPanel.appendChild(ul);

    var ephPanel = document.createElement('div');
    ephPanel.className = 'panel';
    var ephTitle = document.createElement('h4');
    ephTitle.textContent = 'Quizzes efímeros';
    var ul2 = document.createElement('ul');
    var li1 = document.createElement('li');
    li1.innerHTML = '<span>Quizzes</span><span class="value">'+(data.ephemeral.totalQuizzes || 0)+'</span>';
    var li2 = document.createElement('li');
    li2.innerHTML = '<span>Preguntas</span><span class="value">'+(data.ephemeral.totalQuestions || 0)+'</span>';
    ul2.appendChild(li1);
    ul2.appendChild(li2);
    ephPanel.appendChild(ephTitle);
    ephPanel.appendChild(ul2);

    breakdownEl.appendChild(visPanel);
    breakdownEl.appendChild(ephPanel);
  }

  function showError(msg){
    if(errorEl){
      errorEl.textContent = msg || 'No se pudieron cargar las estadísticas.';
    }
  }

  function loadStats(){
    fetch('/api/admin/stats', { credentials: 'include' })
      .then(function(res){
        if(!res.ok){
          return safeJson(res).then(function(body){
            var err = new Error((body && body.error) || ('Error HTTP ' + res.status));
            err.status = res.status;
            throw err;
          });
        }
        return safeJson(res);
      })
      .then(function(payload){
        if(!payload || !payload.data) throw new Error('Respuesta incompleta');
        renderCards(payload.data);
        renderBreakdown(payload.data);
        if(errorEl) errorEl.textContent = '';
        updateFallbackButton();
      })
      .catch(function(err){
        console.error(err);
        if(err && err.status === 403){
          showError('Tu cuenta está autenticada, pero no tiene rol admin.');
          updateFallbackButton();
          return;
        }
        if(err && err.status === 401){
          showError('Necesitas iniciar sesión para ver estadísticas.');
          updateFallbackButton();
          return;
        }
        showError('No se pudieron cargar las estadísticas. ¿Tienes sesión de admin iniciada?');
        updateFallbackButton();
      });
  }

  handleAuthentikReturnParam();
  loadStats();
  fetchMeLite().then(syncCentralSession);

  fetch('/api/auth/authentik/config', { credentials: 'include' })
    .then(function(res){ return res.ok ? res.json() : { enabled: false }; })
    .then(function(cfg){
      authentikAuthEnabled = !!cfg.enabled;
      updateFallbackButton();
      syncCentralSession();
    })
    .catch(function(){});

  if(loginFallbackBtn){
    loginFallbackBtn.addEventListener('click', loginWithAuthentik);
  }
})();
