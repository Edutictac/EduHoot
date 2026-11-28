// Pont de sessió a la portada: si el xip d'EduTicTac ja té sessió de professorat
// i EduHoot no en té, EduHoot entra sense que el docent haja d'anar a «Acceso
// profesorado». Usa session-bridge.js, igual que /create/.
(function(){
    if(!window.EduhootSessionBridge) return;

    var checked = false;
    var user = null;
    var authentikEnabled = false;

    var bridge = EduhootSessionBridge.create({
        storageKey: 'eduh_landing_bridge',
        defaultNext: '/',
        getUser: function(){ return user; },
        isChecked: function(){ return checked; },
        isAuthentikEnabled: function(){ return authentikEnabled; },
        onCentralLogout: function(){
            return fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
                .then(function(){ user = null; }, function(){});
        },
        listenChipEvents: true
    });

    // Tornada d'Authentik (?authentik=…): lleva el paràmetre de la URL.
    bridge.handleReturnParam();

    function getJson(url){
        return fetch(url, { credentials: 'include', cache: 'no-store' })
            .then(function(res){ return res.ok ? res.json() : null; })
            .catch(function(){ return null; });
    }

    Promise.all([getJson('/api/auth/me'), getJson('/api/auth/authentik/config')])
        .then(function(res){
            user = res[0] || null;
            authentikEnabled = !!(res[1] && res[1].enabled);
            checked = true;
            bridge.sync();
        });
})();
