(function(){
    var ENVS = {
        development: {
            label: '🛠️ Entorn: desenvolupament',
            titlePrefix: '🛠️ DEV — ',
            badgeBg: 'rgba(249,115,22,0.9)',
            badgeColor: '#fff7ed',
            tint: 'rgba(124,45,18,0.16)',
            href: '/dev/login',
            linkTitle: 'Entrar amb un usuari de prova'
        },
        staging: {
            label: '🧪 Entorn: stage',
            titlePrefix: '🧪 STAGE — ',
            badgeBg: 'rgba(22,163,74,0.9)',
            badgeColor: '#f0fdf4',
            tint: 'rgba(20,83,45,0.16)',
            href: '/',
            linkTitle: 'Anar a la portada de stage'
        }
    };

    function applyBadge(cfg, tag){
        // En dev el distintiu porta a /dev/login (accés amb usuaris de prova).
        var badge = document.createElement(cfg.href ? 'a' : 'div');
        var labelEl = document.createElement('span');
        labelEl.textContent = cfg.label;
        badge.appendChild(labelEl);
        if(tag){
            var tagEl = document.createElement('span');
            tagEl.textContent = tag;
            tagEl.style.display = 'block';
            tagEl.style.fontSize = '0.55em';
            tagEl.style.fontWeight = '400';
            tagEl.style.opacity = '0.85';
            tagEl.style.marginTop = '2px';
            badge.appendChild(tagEl);
        }
        if(cfg.href){
            badge.href = cfg.href;
            badge.title = cfg.linkTitle || '';
        }else{
            badge.setAttribute('aria-hidden', 'true');
        }
        var badgeStyle = badge.style;
        badgeStyle.position = 'fixed';
        badgeStyle.top = '10px';
        badgeStyle.left = '50%';
        badgeStyle.transform = 'translateX(-50%)';
        badgeStyle.zIndex = '999999';
        badgeStyle.padding = '8px 14px';
        badgeStyle.borderRadius = '10px';
        badgeStyle.font = '700 22px/1.3 system-ui, sans-serif';
        badgeStyle.textAlign = 'center';
        badgeStyle.background = cfg.badgeBg;
        badgeStyle.color = cfg.badgeColor;
        badgeStyle.pointerEvents = cfg.href ? 'auto' : 'none';
        badgeStyle.textDecoration = 'none';
        badgeStyle.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';

        var tint = document.createElement('div');
        var tintStyle = tint.style;
        tintStyle.position = 'fixed';
        tintStyle.inset = '0';
        tintStyle.zIndex = '999998';
        tintStyle.background = cfg.tint;
        tintStyle.pointerEvents = 'none';

        document.body.appendChild(tint);
        document.body.appendChild(badge);

        if(document.title.indexOf(cfg.titlePrefix) !== 0){
            document.title = cfg.titlePrefix + document.title;
        }
    }

    function init(){
        fetch('/api/env').then(function(res){
            return res.ok ? res.json() : null;
        }).then(function(data){
            var cfg = data && ENVS[data.env];
            if(!cfg) return;
            document.documentElement.classList.add('env-' + data.env);
            if(data.env === 'development'){
                // Sota el distintiu, mostra el professorat loguejat (si en té),
                // el mateix nom que ja ix entre claudàtors al títol de la pestanya
                // (create-auth.js/quizCreator.js, updateTitleUserId()).
                fetch('/api/auth/me', { credentials: 'include' }).then(function(res){
                    return res.ok ? res.json() : null;
                }).then(function(user){
                    applyBadge(cfg, user ? (user.nickname || user.email) : '');
                }).catch(function(){
                    applyBadge(cfg);
                });
                return;
            }
            if(data.env !== 'staging'){
                applyBadge(cfg);
                return;
            }
            // En stage, afig la tag amb què es va publicar la imatge (si en té).
            fetch('/api/version').then(function(res){
                return res.ok ? res.json() : null;
            }).then(function(v){
                applyBadge(cfg, v && v.tag ? v.tag : '');
            }).catch(function(){
                applyBadge(cfg);
            });
        }).catch(function(){
            // Sense distintiu si falla la petició; mai bloquejar la pàgina.
        });
    }

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init);
    }else{
        init();
    }
})();
