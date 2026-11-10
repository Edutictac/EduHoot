(function(){
  var errorEl = document.getElementById('logs-error');
  var loginFallbackBtn = document.getElementById('login-fallback');
  var loginStatus = document.getElementById('login-status');
  var accountChip = document.querySelector('edutictac-account');

  var levelSelect = document.getElementById('logs-level-select');
  var cappedMbInput = document.getElementById('logs-capped-mb');
  var settingsSaveBtn = document.getElementById('logs-settings-save');
  var settingsStatus = document.getElementById('logs-settings-status');

  var filterLevel = document.getElementById('logs-filter-level');
  var filterQ = document.getElementById('logs-filter-q');
  var filterPin = document.getElementById('logs-filter-pin');
  var filterApplyBtn = document.getElementById('logs-filter-apply');
  var filterRefreshBtn = document.getElementById('logs-filter-refresh');
  var exportCsvBtn = document.getElementById('logs-export-csv');
  var exportNdjsonBtn = document.getElementById('logs-export-ndjson');
  var tbody = document.getElementById('logs-tbody');

  var authState = { user: null, checked: false };
  var authentikAuthEnabled = false;
  var authBridgeFailed = false;
  var AUTH_BRIDGE_KEY = 'eduh_auth_bridge_admin_logs';
  var AUTH_BRIDGE_RETRY_MS = 2 * 60 * 1000;

  function safeJson(res){
    return res.json().catch(function(){ return {}; });
  }

  function setLoginStatus(msg){
    if(loginStatus) loginStatus.textContent = msg || '';
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

  function showError(msg){
    if(errorEl) errorEl.textContent = msg || '';
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
        if(levelSelect) levelSelect.value = data.level;
        if(cappedMbInput) cappedMbInput.value = Math.round(data.cappedSizeBytes / (1024 * 1024));
      })
      .catch(function(err){
        var authMsg = describeAuthError(err);
        if(authMsg) showError(authMsg);
      });
  }

  function saveSettings(){
    if(settingsStatus) settingsStatus.textContent = 'Guardando...';
    var body = {};
    if(levelSelect) body.level = levelSelect.value;
    if(cappedMbInput && cappedMbInput.value) body.cappedSizeBytes = Math.round(Number(cappedMbInput.value) * 1024 * 1024);
    fetchJson('/api/admin/settings/logging', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function(){
        if(settingsStatus) settingsStatus.textContent = 'Guardado.';
        setTimeout(function(){ if(settingsStatus) settingsStatus.textContent = ''; }, 2000);
      })
      .catch(function(err){
        if(settingsStatus) settingsStatus.textContent = (err && err.message) || 'Error al guardar.';
      });
  }

  function escapeHtml(str){
    return String(str == null ? '' : str).replace(/[&<>"']/g, function(ch){
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[ch];
    });
  }

  function renderLogs(rows){
    if(!tbody) return;
    tbody.innerHTML = '';
    rows.forEach(function(row){
      var tr = document.createElement('tr');
      var date = row.createdAt ? new Date(row.createdAt).toLocaleString() : '';
      tr.innerHTML =
        '<td>' + escapeHtml(date) + '</td>' +
        '<td class="level-' + escapeHtml(row.level) + '">' + escapeHtml(row.level) + '</td>' +
        '<td>' + escapeHtml(row.tag) + '</td>' +
        '<td>' + escapeHtml(row.message) + '</td>' +
        '<td>' + escapeHtml(row.pin) + '</td>' +
        '<td>' + escapeHtml(row.hostId) + '</td>' +
        '<td>' + escapeHtml(row.playerId) + '</td>';
      tbody.appendChild(tr);
    });
  }

  function buildFilterParams(){
    var params = new URLSearchParams();
    if(filterLevel && filterLevel.value) params.set('level', filterLevel.value);
    if(filterQ && filterQ.value) params.set('q', filterQ.value);
    if(filterPin && filterPin.value) params.set('pin', filterPin.value);
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
        renderLogs((payload && payload.data) || []);
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

  if(loginFallbackBtn){
    loginFallbackBtn.addEventListener('click', loginWithAuthentik);
  }
  if(settingsSaveBtn){
    settingsSaveBtn.addEventListener('click', saveSettings);
  }
  if(filterApplyBtn){
    filterApplyBtn.addEventListener('click', loadLogs);
  }
  if(filterRefreshBtn){
    filterRefreshBtn.addEventListener('click', loadLogs);
  }
  if(exportCsvBtn){
    exportCsvBtn.addEventListener('click', function(){ downloadLogs('csv'); });
  }
  if(exportNdjsonBtn){
    exportNdjsonBtn.addEventListener('click', function(){ downloadLogs('ndjson'); });
  }
})();
