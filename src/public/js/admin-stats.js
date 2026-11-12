(function(){
  // Subfase B: el que es pinta (targetes, desglossament, errors i botó
  // d'entrada) és estat d'una app de Vue; la resta no canvia.
  var view = Vue.reactive({ cards: [], panels: [], error: '', loginStatus: '', fallbackVisible: false });
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
    view.loginStatus = msg || '';
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
    var chipMounted = document.documentElement.classList.contains('has-account-chip');
    view.fallbackVisible = authentikAuthEnabled && !authState.user && !chipMounted;
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
    view.cards = [
      { label: 'Total de quizzes', value: data.totalQuizzes, badge: 'Todos' },
      { label: 'Preguntas totales', value: data.totalQuestions, badge: 'Contenido' },
      { label: 'Partidas jugadas', value: data.totalPlays, badge: 'Histórico' },
      { label: 'Jugadores totales', value: data.totalPlayers, badge: 'Histórico' },
      { label: 'Promedio de preguntas', value: data.avgQuestionsPerQuiz, badge: 'Media' },
      { label: 'Partidas activas', value: data.liveGames, badge: 'En vivo' },
      { label: 'Jugadores activos', value: data.livePlayers, badge: 'En vivo' },
      { label: 'Quizzes efímeros', value: data.ephemeral.totalQuizzes, badge: 'Local' }
    ];
  }

  function renderBreakdown(data){
    view.panels = [
      {
        title: 'Visibilidad',
        rows: ['public', 'unlisted', 'private'].map(function(key){
          return { label: key, value: data.visibilityCounts[key] };
        })
      },
      {
        title: 'Quizzes efímeros',
        rows: [
          { label: 'Quizzes', value: data.ephemeral.totalQuizzes },
          { label: 'Preguntas', value: data.ephemeral.totalQuestions }
        ]
      }
    ];
  }

  function showError(msg){
    view.error = msg || 'No se pudieron cargar las estadísticas.';
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
        view.error = '';
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

  Vue.createApp({
    template: '#stats-tpl',
    data: function(){ return view; },
    methods: { login: loginWithAuthentik }
  }).mount('#stats-app');

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
})();
