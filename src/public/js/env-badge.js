(function(){
    var ENVS = {
        development: {
            cls: 'env-development',
            label: '🛠️ Entorn: desenvolupament',
            titlePrefix: '🛠️ DEV — ',
            badgeBg: 'rgba(249,115,22,0.35)',
            badgeColor: '#fff7ed',
            tint: 'rgba(124,45,18,0.16)',
            href: '/dev/login',
            linkTitle: 'Entrar amb un usuari de prova'
        },
        staging: {
            cls: 'env-staging',
            label: '🧪 Entorn: stage',
            titlePrefix: '🧪 STAGE — ',
            badgeBg: 'rgba(22,163,74,0.35)',
            badgeColor: '#f0fdf4',
            tint: 'rgba(20,83,45,0.16)',
            href: '/',
            linkTitle: 'Anar a la portada de stage'
        }
    };

    // info: { user: usuario actual (si lo hay), tag: etiqueta de la imagen (solo en stage) }.
    function applyBadge(cfg, info){
        info = info || {};
        // En dev el distintiu porta a /dev/login (accés amb usuaris de prova).
        var badge = document.createElement(cfg.href ? 'a' : 'div');
        badge.className = 'env-badge';
        var labelEl = document.createElement('span');
        labelEl.textContent = cfg.label;
        badge.appendChild(labelEl);
        // Segunda línea: usuario actual a la izquierda y tamaño de la ventana a la derecha (dev y stage).
        var infoRow = document.createElement('span');
        infoRow.className = 'env-badge__info';
        infoRow.style.display = 'flex';
        infoRow.style.justifyContent = 'space-between';
        infoRow.style.alignItems = 'baseline';
        infoRow.style.gap = '16px';
        infoRow.style.marginTop = '2px';
        infoRow.style.fontSize = '0.55em';
        infoRow.style.fontWeight = '400';
        infoRow.style.opacity = '0.85';
        infoRow.style.whiteSpace = 'nowrap';
        var userEl = document.createElement('span');
        userEl.className = 'env-badge__user';
        userEl.textContent = info.user || '';
        userEl.style.textAlign = 'left';
        infoRow.appendChild(userEl);
        // Ancho × alto de la ventana (en píxeles CSS), sin recargar: solo cambia al redimensionar.
        var sizeEl = document.createElement('span');
        sizeEl.className = 'env-badge__size';
        sizeEl.style.textAlign = 'right';
        sizeEl.style.marginLeft = 'auto';
        sizeEl.style.fontVariantNumeric = 'tabular-nums';
        var updateSize = function(){
            sizeEl.textContent = window.innerWidth + ' × ' + window.innerHeight;
        };
        updateSize();
        infoRow.appendChild(sizeEl);
        badge.appendChild(infoRow);
        // En stage, además, la etiqueta con la que se publicó la imagen, en una línea aparte.
        if(info.tag){
            var tagEl = document.createElement('span');
            tagEl.className = 'env-badge__tag';
            tagEl.textContent = info.tag;
            tagEl.style.display = 'block';
            tagEl.style.fontSize = '0.55em';
            tagEl.style.fontWeight = '400';
            tagEl.style.opacity = '0.85';
            tagEl.style.marginTop = '2px';
            badge.appendChild(tagEl);
        }
        window.addEventListener('resize', updateSize);
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
        // Fons molt transparent per a veure el que hi ha darrere; l'ombra
        // del text el manté llegible sobre qualsevol fons.
        badgeStyle.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
        badgeStyle.textShadow = '0 1px 3px rgba(0,0,0,0.7)';
        // En las pantallas de partida (alumnado y anfitrión, dev y stage) el distintivo va al 50 % para no tapar el juego.
        if(window.location.pathname.indexOf('/player/') === 0 || window.location.pathname.indexOf('/host/') === 0){
            badgeStyle.opacity = '0.5';
        }

        var tint = document.createElement('div');
        tint.className = 'env-badge-tint';
        var tintStyle = tint.style;
        tintStyle.position = 'fixed';
        tintStyle.inset = '0';
        tintStyle.zIndex = '999998';
        tintStyle.background = cfg.tint;
        tintStyle.pointerEvents = 'none';

        document.body.appendChild(tint);
        document.body.appendChild(badge);
        // Espai que ocupa el distintiu (fix a dalt): les pàgines que ho necessiten
        // baixen el contingut perquè no el tape en carregar (--env-badge-space).
        var space = function(){
            document.documentElement.style.setProperty('--env-badge-space', Math.ceil(badge.getBoundingClientRect().bottom + 8) + 'px');
        };
        space();
        window.addEventListener('resize', space);

        if(document.title.indexOf(cfg.titlePrefix) !== 0){
            document.title = cfg.titlePrefix + document.title;
        }

        // Tecla rápida (F9 o Alt+B) para ocultar/mostrar el distintivo, el tinte y los ajustes de dev/stage
        // y comprobar cómo se ve todo en producción. La elección se recuerda entre pantallas (localStorage).
        var STORE = 'eduhoot-env-badge-hidden';
        var applyHidden = function(hidden){
            badge.style.display = hidden ? 'none' : '';
            tint.style.display = hidden ? 'none' : '';
            document.documentElement.classList.toggle(cfg.cls, !hidden);
            document.documentElement.classList.toggle('env-badge-hidden', hidden);
            if(hidden){
                document.documentElement.style.setProperty('--env-badge-space', '0px');
            }else{
                space();
            }
        };
        var isHidden = function(){
            try{ return window.localStorage.getItem(STORE) === '1'; }catch(e){ return false; }
        };
        applyHidden(isHidden());
        window.addEventListener('keydown', function(ev){
            var isF9 = ev.key === 'F9' && !ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.shiftKey;
            var isAltB = ev.code === 'KeyB' && ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey;
            if(!isF9 && !isAltB) return;
            ev.preventDefault();
            var hidden = !isHidden();
            try{ window.localStorage.setItem(STORE, hidden ? '1' : '0'); }catch(e){}
            applyHidden(hidden);
        });
    }

    function init(){
        fetch('/api/env').then(function(res){
            return res.ok ? res.json() : null;
        }).then(function(data){
            // Avís per a convidar a provar Stage i vore les novetats: es
            // mostra a qualsevol entorn, només a les pàgines que en tinguen
            // l'element (opt-in per pàgina). En el propi Stage s'amaga només
            // el botó "Provar Stage" (no té sentit convidar a Stage estant-hi
            // ja), però el de "novetats" seguix visible.
            var stageNotice = document.getElementById('stage-notice');
            if(stageNotice && data){
                stageNotice.classList.remove('hidden');
                var tryStageBtn = document.getElementById('stage-notice-try-stage');
                if(tryStageBtn && data.env === 'staging'){
                    tryStageBtn.classList.add('hidden');
                }
            }
            var cfg = data && ENVS[data.env];
            if(!cfg) return;
            document.documentElement.classList.add('env-' + data.env);
            // Usuario actual (nickname o, si no tiene, el correo) en dev y en stage; en stage, además, la etiqueta de la imagen.
            var getUser = fetch('/api/auth/me', { credentials: 'include' }).then(function(res){
                return res.ok ? res.json() : null;
            }).then(function(user){
                return user ? (user.nickname || user.email || '') : '';
            }).catch(function(){ return ''; });
            var getTag = data.env === 'staging'
                ? fetch('/api/version').then(function(res){ return res.ok ? res.json() : null; })
                    .then(function(v){ return v && v.tag ? v.tag : ''; }).catch(function(){ return ''; })
                : Promise.resolve('');
            Promise.all([getUser, getTag]).then(function(parts){
                applyBadge(cfg, { user: parts[0], tag: parts[1] });
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
