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
        // Un correo o un nombre largo se recorta con «…» para no ensanchar el distintivo.
        userEl.style.overflow = 'hidden';
        userEl.style.textOverflow = 'ellipsis';
        userEl.style.minWidth = '0';
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
        // Pista pequeña: cómo ocultar el distintivo (F9 o Alt+B).
        var hintEl = document.createElement('span');
        hintEl.className = 'env-badge__hint';
        hintEl.textContent = 'Pots ocultar-lo amb F9 o Alt+B';
        hintEl.style.display = 'block';
        hintEl.style.fontSize = '0.5em';
        hintEl.style.fontWeight = '400';
        hintEl.style.opacity = '0.8';
        hintEl.style.marginTop = '2px';
        badge.appendChild(hintEl);
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
        // Mismo ancho en dev y en stage (la etiqueta de dev es más larga); en pantallas estrechas, se encoge.
        badgeStyle.boxSizing = 'border-box';
        badgeStyle.width = '400px';
        badgeStyle.maxWidth = 'calc(100vw - 20px)';
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
            // En estes pantalles el distintiu no captura clics: no pot tapar els botons del joc (p. ex. «Ver clasificación»).
            badgeStyle.pointerEvents = 'none';
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
        var toggleHidden = function(){
            var hidden = !isHidden();
            try{ window.localStorage.setItem(STORE, hidden ? '1' : '0'); }catch(e){}
            applyHidden(hidden);
            return hidden;
        };
        window.addEventListener('keydown', function(ev){
            var isF9 = ev.key === 'F9' && !ev.ctrlKey && !ev.altKey && !ev.metaKey && !ev.shiftKey;
            var isAltB = ev.code === 'KeyB' && ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey;
            if(!isF9 && !isAltB) return;
            ev.preventDefault();
            toggleHidden();
        });
        // Portada: en dev y stage, el logo de EduHoot (#brand) muestra u oculta el distintivo al hacer clic.
        // En producción este código no llega a ejecutarse y el logo solo conserva su animación.
        var brand = document.getElementById('brand');
        if(brand){
            brand.classList.add('is-clickable');
            brand.setAttribute('role', 'button');
            brand.setAttribute('tabindex', '0');
            brand.setAttribute('title', cfg.label);
            var syncBrand = function(){ brand.setAttribute('aria-pressed', isHidden() ? 'false' : 'true'); };
            syncBrand();
            brand.addEventListener('click', function(){ toggleHidden(); syncBrand(); });
            brand.addEventListener('keydown', function(ev){
                if(ev.key !== 'Enter' && ev.key !== ' ') return;
                ev.preventDefault();
                toggleHidden();
                syncBrand();
            });
        }
    }

    // Textos del botó (només l'admin el veu): tooltip i etiqueta accessible.
    var STAGE_TOGGLE_TEXT = {
        ca: "Mostra o amaga l'avís de Stage (admin, per a tots)", va: "Mostra o amaga l'avís de Stage (admin, per a tots)",
        es: 'Mostrar u ocultar el aviso de Stage (admin, para todos)', en: 'Show or hide the Stage notice (admin, for everyone)',
        fr: "Afficher ou masquer l'avis Stage (admin, pour tous)", de: 'Stage-Hinweis ein- oder ausblenden (Admin, für alle)',
        it: "Mostra o nascondi l'avviso Stage (admin, per tutti)", pt: 'Mostrar ou ocultar o aviso do Stage (admin, para todos)',
        bg: 'Показване или скриване на известието за Stage (админ, за всички)', ar: 'إظهار أو إخفاء إشعار Stage (للمشرف، للجميع)'
    };

    // Només l'admin pot mostrar o amagar l'avís (per a tots els usuaris): té un botó 🧪 al costat de l'avís.
    function setupStageNoticeAdmin(notice){
        var toggle = document.getElementById('stage-notice-toggle');
        if(!toggle) return;
        fetch('/api/auth/me', { credentials: 'include' }).then(function(res){
            return res.ok ? res.json() : null;
        }).then(function(user){
            if(!user || user.role !== 'admin') return;
            var visible = function(){ return !notice.classList.contains('hidden'); };
            var code = String(document.documentElement.lang || 'es').toLowerCase();
            code = code.indexOf('valencia') !== -1 ? 'va' : code.split('-')[0];
            var label = STAGE_TOGGLE_TEXT[code] || STAGE_TOGGLE_TEXT.es;
            toggle.setAttribute('title', label);
            toggle.setAttribute('aria-label', label);
            var refresh = function(){
                toggle.setAttribute('aria-pressed', visible() ? 'true' : 'false');
                toggle.classList.toggle('is-off', !visible());
            };
            toggle.classList.remove('hidden');
            refresh();
            toggle.addEventListener('click', function(){
                var next = !visible();
                fetch('/api/admin/settings/stage-notice', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ visible: next })
                }).then(function(res){
                    if(res.ok){ notice.classList.toggle('hidden', !next); refresh(); }
                }).catch(function(){});
            });
        }).catch(function(){});
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
                // stageNoticeVisible (servidor): true o sense definir, es veu; false, amagat per a tots.
                if(data.stageNoticeVisible !== false) stageNotice.classList.remove('hidden');
                var tryStageBtn = document.getElementById('stage-notice-try-stage');
                if(tryStageBtn && data.env === 'staging'){
                    tryStageBtn.classList.add('hidden');
                }
                setupStageNoticeAdmin(stageNotice);
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
