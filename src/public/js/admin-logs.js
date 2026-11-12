(function(){
  // Subfase B: el que es pinta (configuració, filtres, taula, detall i
  // missatges) és estat d'una app de Vue; la sessió i les crides no canvien.
  var view = Vue.reactive({
    error: '', loginStatus: '', fallbackVisible: false,
    settings: { level: 'error', cappedMb: '' }, settingsStatus: '',
    filters: { level: '', tag: '', q: '', pin: '' },
    rows: [],
    detail: { title: 'Detalle del log', fields: [], stack: '' }
  });
  var accountChip = document.querySelector('edutictac-account');
  var detailModal = null;

  var authState = { user: null, checked: false };
  var authentikAuthEnabled = false;
  var authBridgeFailed = false;
  var AUTH_BRIDGE_KEY = 'eduh_auth_bridge_admin_logs';
  var AUTH_BRIDGE_RETRY_MS = 2 * 60 * 1000;

  function safeJson(res){
    return res.json().catch(function(){ return {}; });
  }

  function setLoginStatus(msg){
    view.loginStatus = msg || '';
  }

  // Puente de sesión con el xip de EduTicTac/Authentik. Misma lógica que
  // admin-stats.js, adaptada a esta página (clave de sessionStorage propia
  // para no interferir con /admin/stats).
  function loginWithAuthentik(){
    var next = window.location.pathname + window.location.search;
    window.location.href = '/api/auth/authentik/start?next=' + encodeURIComponent(next || '/admin/logs');
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
      .then(loadLogs)
      .catch(function(){});
  }

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

  function loadLogs(){
    var params = buildFilterParams();
    fetchJson('/api/admin/logs?' + params.toString())
      .then(function(payload){
        view.rows = (payload && payload.data) || [];
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

  Vue.createApp({
    template: '#logs-tpl',
    data: function(){ return view; },
    methods: {
      login: loginWithAuthentik,
      saveSettings: saveSettings,
      loadLogs: loadLogs,
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
