(function(){
  // Subfase B: el que es pinta (configuració, filtres, taula, detall i
  // missatges) és estat d'una app de Vue; la sessió i les crides no canvien.
  var view = Vue.reactive({
    error: '', loginStatus: '', fallbackVisible: false,
    settings: { level: 'error', cappedMb: '' }, settingsStatus: '',
    filters: { level: '', tag: '', q: '', pin: '' },
    rows: [], hasMore: false, loadingMore: false,
    detail: { title: 'Detalle del log', fields: [], stack: '' }
  });
  var detailModal = null;

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
    storageKey: 'eduh_auth_bridge_admin_logs',
    defaultNext: '/admin/logs',
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
      .then(loadLogs)
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

  function showError(msg){
    view.error = msg || '';
  }

  function fetchJson(url, opts){
    return fetch(url, Object.assign({ credentials: 'include' }, opts || {}))
      .then(function(res){
        if(!res.ok){
          return safeJson(res).then(function(body){
            var err = new Error((body && body.error) || ('Error HTTP ' + res.status));
            err.status = res.status;
            throw err;
          });
        }
        return safeJson(res);
      });
  }

  function describeAuthError(err){
    if(err && err.status === 403) return 'Tu cuenta está autenticada, pero no tiene rol admin.';
    if(err && err.status === 401) return 'Necesitas iniciar sesión para ver esta página.';
    return null;
  }

  function loadSettings(){
    fetchJson('/api/admin/settings/logging')
      .then(function(payload){
        var data = payload && payload.data;
        if(!data) return;
        view.settings.level = data.level;
        view.settings.cappedMb = Math.round(data.cappedSizeBytes / (1024 * 1024));
      })
      .catch(function(err){
        var authMsg = describeAuthError(err);
        if(authMsg) showError(authMsg);
      });
  }

  function saveSettings(){
    view.settingsStatus = 'Guardando...';
    var body = { level: view.settings.level };
    if(view.settings.cappedMb !== '' && view.settings.cappedMb !== null) body.cappedSizeBytes = Math.round(Number(view.settings.cappedMb) * 1024 * 1024);
    fetchJson('/api/admin/settings/logging', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function(){
        view.settingsStatus = 'Guardado.';
        setTimeout(function(){ view.settingsStatus = ''; }, 2000);
      })
      .catch(function(err){
        view.settingsStatus = (err && err.message) || 'Error al guardar.';
      });
  }

  function formatDate(value){
    return value ? new Date(value).toLocaleString() : '';
  }

  function openLogDetail(row){
    if(!detailModal) return;
    var meta = row.meta || {};
    view.detail = {
      title: row.tag ? ('Detalle: ' + row.tag) : 'Detalle del log',
      fields: [
        ['Fecha', formatDate(row.createdAt)],
        ['Nivel', row.level],
        ['Tag', row.tag],
        ['Mensaje', row.message],
        ['PIN', row.pin],
        ['hostId', row.hostId],
        ['playerId', row.playerId]
      ].filter(function(f){ return f[1] !== null && f[1] !== undefined && f[1] !== ''; }),
      stack: meta.stack || meta.error || (Object.keys(meta).length ? JSON.stringify(meta, null, 2) : 'Sin detalle adicional.')
    };
    if(typeof detailModal.showModal === 'function'){
      detailModal.showModal();
    }
  }

  function hasDetail(row){
    return !!(row.meta && (row.meta.stack || row.meta.error || Object.keys(row.meta).length));
  }

  function buildFilterParams(){
    var params = new URLSearchParams();
    var f = view.filters;
    if(f.level) params.set('level', f.level);
    if(f.tag) params.set('tag', f.tag);
    if(f.q) params.set('q', f.q);
    if(f.pin) params.set('pin', f.pin);
    return params;
  }

  function downloadLogs(format){
    var params = buildFilterParams();
    params.set('format', format);
    window.location.href = '/api/admin/logs/export?' + params.toString();
  }

  // Filtres de l'última càrrega: «Carregar més» continua amb els mateixos,
  // encara que després s'haja escrit en els camps sense prémer «Filtrar».
  var appliedParams = '';

  function loadLogs(){
    var params = buildFilterParams();
    appliedParams = params.toString();
    fetchJson('/api/admin/logs?' + appliedParams)
      .then(function(payload){
        view.rows = (payload && payload.data) || [];
        view.hasMore = !!(payload && payload.hasMore);
        showError('');
        updateFallbackButton();
      })
      .catch(function(err){
        console.error(err);
        var authMsg = describeAuthError(err);
        showError(authMsg || 'No se pudieron cargar los logs.');
        updateFallbackButton();
      });
  }

  // Els 100 següents, a partir de l'última fila que es veu.
  function loadMoreLogs(){
    var last = view.rows[view.rows.length - 1];
    if(!last || view.loadingMore) return;
    var params = new URLSearchParams(appliedParams);
    params.set('before', last.createdAt);
    if(last._id) params.set('beforeId', last._id);
    view.loadingMore = true;
    fetchJson('/api/admin/logs?' + params.toString())
      .then(function(payload){
        view.rows = view.rows.concat((payload && payload.data) || []);
        view.hasMore = !!(payload && payload.hasMore);
        showError('');
      })
      .catch(function(err){
        console.error(err);
        showError(describeAuthError(err) || 'No se pudieron cargar los logs.');
      })
      .finally(function(){ view.loadingMore = false; });
  }

  Vue.createApp({
    template: '#logs-tpl',
    data: function(){ return view; },
    methods: {
      login: loginWithAuthentik,
      saveSettings: saveSettings,
      loadLogs: loadLogs,
      loadMore: loadMoreLogs,
      download: downloadLogs,
      formatDate: formatDate,
      hasDetail: hasDetail,
      openDetail: openLogDetail
    },
    mounted: function(){ detailModal = this.$refs.detailModal; }
  }).mount('#logs-app');

  handleAuthentikReturnParam();
  loadSettings();
  loadLogs();
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
