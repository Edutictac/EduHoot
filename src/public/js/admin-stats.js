(function(){
  // Subfase B: el que es pinta (targetes, desglossament, errors i botó
  // d'entrada) és estat d'una app de Vue; la resta no canvia.
  var view = Vue.reactive({ cards: [], panels: [], error: '', loginStatus: '', fallbackVisible: false });

  var authState = { user: null, checked: false };
  var authentikAuthEnabled = false;

  function safeJson(res){
    return res.json().catch(function(){ return {}; });
  }

  function setLoginStatus(msg){
    view.loginStatus = msg || '';
  }

  // Pont de sessió amb el xip d'EduTicTac (session-bridge.js), amb clau
  // de sessionStorage pròpia per a no interferir amb /create/.
  var sessionBridge = EduhootSessionBridge.create({
    storageKey: 'eduh_auth_bridge_admin',
    defaultNext: '/admin/stats',
    getUser: function(){ return authState.user; },
    isChecked: function(){ return authState.checked; },
    isAuthentikEnabled: function(){ return authentikAuthEnabled; },
    onCentralLogout: logoutLite
  });
  var loginWithAuthentik = sessionBridge.login;
  var syncCentralSession = sessionBridge.sync;

  function logoutLite(){
    return fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .then(fetchMeLite)
      .then(loadStats)
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
        sessionBridge.clearAttempt();
        updateFallbackButton();
      })
      .catch(function(){
        authState.user = null;
        authState.checked = true;
        updateFallbackButton();
      });
  }

  function handleAuthentikReturnParam(){
    var result = sessionBridge.handleReturnParam();
    if(result && result !== 'ok'){
      setLoginStatus('No se pudo completar el acceso con EduTicTac. Inténtalo de nuevo.');
    }
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
