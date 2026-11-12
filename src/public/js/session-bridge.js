// Pont de sessió entre EduHoot i el xip de compte d'EduTicTac (Commons).
// EduHoot manté la seua pròpia sessió d'Authentik: quan el xip ja té sessió
// de professorat, s'entra a EduHoot sense demanar res més (SSO), i quan el
// xip la tanca, EduHoot també. L'usen /create/ i els panells /admin-*.
(function(){
    var RETRY_MS = 2 * 60 * 1000;

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

    // options:
    //   storageKey          clau de sessionStorage per a no reintentar en bucle
    //   defaultNext         ruta de tornada si la pàgina no en té
    //   getUser()           usuari actual d'EduHoot (o null)
    //   isChecked()         true quan ja s'ha consultat /api/auth/me
    //   isAuthentikEnabled()
    //   onCentralLogout()   el xip no té sessió però EduHoot sí (pot tornar una promesa)
    //   listenChipEvents    escolta també 'edutictac:sessionchange' del xip
    function create(options){
        var chip = document.querySelector('edutictac-account');
        var failed = false;
        var loggingOut = false;

        function chipBase(){
            return chip ? (chip.getAttribute('data-base') || '').replace(/\/+$/, '') : '';
        }

        function login(){
            var next = window.location.pathname + window.location.search;
            window.location.href = '/api/auth/authentik/start?next=' + encodeURIComponent(next || options.defaultNext);
        }

        function recentlyTried(){
            try{
                var last = Number(sessionStorage.getItem(options.storageKey) || 0);
                return !!last && (Date.now() - last) < RETRY_MS;
            }catch(e){
                return true;
            }
        }

        // Alinea la sessió d'EduHoot amb la del xip. Sense resposta de Commons no es toca res.
        function apply(central){
            if(!central || !options.isChecked()) return;
            var centralTeacher = !!central.authenticated && central.kind === 'oidc';
            var user = options.getUser();
            if(centralTeacher && !user){
                if(!options.isAuthentikEnabled() || failed || recentlyTried()) return;
                try{ sessionStorage.setItem(options.storageKey, String(Date.now())); }catch(e){ return; }
                login();
            }else if(!central.authenticated && user && !loggingOut){
                // sync() es pot cridar dues vegades seguides en carregar: un
                // sol tancament de sessió encara que arriben dues respostes.
                loggingOut = true;
                Promise.resolve(options.onCentralLogout()).then(function(){ loggingOut = false; }, function(){ loggingOut = false; });
            }
        }

        function sync(){
            if(!chip || !options.isChecked()) return;
            var base = chipBase();
            if(!base || !sameSiteAsPage(base)) return;
            fetch(base + '/api/auth/session', { credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' } })
                .then(function(res){ return res.ok ? res.json() : null; })
                .then(apply)
                .catch(function(){});
        }

        // Amb sessió a EduHoot, es pot tornar a intentar el pont més avant.
        function clearAttempt(){
            try{ sessionStorage.removeItem(options.storageKey); }catch(e){}
        }

        // Tornada d'Authentik (?authentik=ok|error): lleva el paràmetre de la
        // URL i torna el resultat. Si ha fallat, ja no s'intenta el pont.
        function handleReturnParam(){
            var result = null;
            try{
                var url = new URL(window.location.href);
                result = url.searchParams.get('authentik');
                if(result){
                    if(result !== 'ok') failed = true;
                    url.searchParams.delete('authentik');
                    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
                }
            }catch(e){}
            return result;
        }

        if(options.listenChipEvents){
            window.addEventListener('edutictac:sessionchange', function(e){
                if(chip && sameSiteAsPage(chip.getAttribute('data-base') || '')) apply(e.detail);
            });
        }

        return { login: login, sync: sync, apply: apply, clearAttempt: clearAttempt, handleReturnParam: handleReturnParam };
    }

    window.EduhootSessionBridge = { create: create, sameSiteAsPage: sameSiteAsPage };
})();
