// Llista d'idiomes de la interfície i lògica comuna per a detectar-lo,
// guardar-lo i pintar els selectors. Cada pàgina manté els seus textos i
// la seua funció t(); ací només hi ha el que és igual en totes.
(function(){
    var LANGUAGES = [
        // «primary»: van como botones en los selectores de botones; el resto, en un desplegable a su derecha.
        { code: 'ca', name: 'Català', short: 'CA', primary: true },
        { code: 'va', name: 'Valencià', short: 'VA', primary: true },
        { code: 'es', name: 'Español', short: 'ES', primary: true },
        { code: 'en', name: 'English', short: 'EN', primary: true },
        { code: 'fr', name: 'Français', short: 'FR' },
        { code: 'de', name: 'Deutsch', short: 'DE' },
        { code: 'it', name: 'Italiano', short: 'IT' },
        { code: 'pt', name: 'Português', short: 'PT' },
        { code: 'bg', name: 'Български', short: 'BG' }
    ];
    var CODES = LANGUAGES.map(function(l){ return l.code; });
    // Totes les claus s'escriuen sempre juntes; l'ordre només decidix
    // quina guanya si algú les ha deixat diferents.
    var STORAGE_KEYS = ['lang', 'lang-player', 'lang-host', 'edutictac-portal-lang', 'edutictac-lang'];

    function normalize(raw){
        var value = String(raw || '').toLowerCase();
        if(value.indexOf('valencia') !== -1) return 'va';
        var base = value.split('-')[0];
        return CODES.indexOf(base) !== -1 ? base : '';
    }

    function fromQuery(){
        try{ return normalize(new URLSearchParams(window.location.search).get('lang')); }catch(e){ return ''; }
    }

    function storageKeys(preferKey){
        if(!preferKey) return STORAGE_KEYS;
        return [preferKey].concat(STORAGE_KEYS.filter(function(k){ return k !== preferKey; }));
    }

    function fromStorage(preferKey){
        var keys = storageKeys(preferKey);
        for(var i = 0; i < keys.length; i++){
            try{
                var value = normalize(window.localStorage.getItem(keys[i]));
                if(value) return value;
            }catch(e){}
        }
        return '';
    }

    function persist(value){
        try{
            var url = new URL(window.location.href);
            if(url.searchParams.has('lang')){
                url.searchParams.set('lang', value);
                window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
            }
        }catch(e){}
        for(var i = 0; i < STORAGE_KEYS.length; i++){
            try{ window.localStorage.setItem(STORAGE_KEYS[i], value); }catch(e){}
        }
    }

    function init(opts){
        opts = opts || {};
        var lang = fromQuery()
            || fromStorage(opts.preferKey)
            || normalize(navigator.language || navigator.userLanguage || 'es')
            || opts.fallback
            || 'es';
        persist(lang);
        return lang;
    }

    function fillSelect(select){
        if(select.options.length) return;
        var label = select.getAttribute('data-lang-options') === 'short' ? 'short' : 'name';
        LANGUAGES.forEach(function(l){
            var option = document.createElement('option');
            option.value = l.code;
            option.textContent = l[label];
            select.appendChild(option);
        });
    }

    function current(){
        return fromQuery() || fromStorage() || normalize(navigator.language || navigator.userLanguage || 'es') || 'es';
    }

    // El desplegable de «más idiomas» marca el activo si el idioma actual no es uno de los botones.
    function syncMore(lang){
        var active = lang || current();
        document.querySelectorAll('select.lang-more').forEach(function(select){
            var isExtra = LANGUAGES.some(function(l){ return !l.primary && l.code === active; });
            select.value = isExtra ? active : '';
            select.classList.toggle('active', isExtra);
        });
    }

    function fillButtons(container){
        if(container.querySelector('button[data-lang], select.lang-more')) return;
        var extras = [];
        LANGUAGES.forEach(function(l){
            if(!l.primary){ extras.push(l); return; }
            var button = document.createElement('button');
            button.type = 'button';
            button.setAttribute('data-lang', l.code);
            button.setAttribute('title', l.name);
            button.textContent = l.short;
            container.appendChild(button);
        });
        if(!extras.length) return;
        var select = document.createElement('select');
        select.className = 'lang-more';
        select.setAttribute('aria-label', 'Language');
        select.setAttribute('title', extras.map(function(l){ return l.name; }).join(', '));
        var blank = document.createElement('option');
        blank.value = '';
        blank.textContent = '🌐';
        select.appendChild(blank);
        extras.forEach(function(l){
            var option = document.createElement('option');
            option.value = l.code;
            // Las dos iniciales en mayúsculas, como los botones; el nombre completo queda en la ayuda.
            option.textContent = l.short;
            option.title = l.name;
            select.appendChild(option);
        });
        // Cada pantalla ya escucha el clic en `button[data-lang]` del contenedor: se reutiliza con un botón temporal.
        select.addEventListener('change', function(){
            if(!select.value) return;
            var button = document.createElement('button');
            button.type = 'button';
            button.setAttribute('data-lang', select.value);
            button.hidden = true;
            container.appendChild(button);
            button.click();
            button.remove();
        });
        container.appendChild(select);
        syncMore();
    }

    function render(){
        document.querySelectorAll('select[data-lang-options]').forEach(fillSelect);
        document.querySelectorAll('[data-lang-buttons]').forEach(fillButtons);
    }

    window.EduhootLang = {
        LANGUAGES: LANGUAGES,
        normalize: normalize,
        fromQuery: fromQuery,
        fromStorage: fromStorage,
        persist: persist,
        init: init,
        render: render,
        syncMore: syncMore,
        current: current
    };

    // Els scripts de pàgina van al final del <body>, així que normalment
    // els selectors ja existixen; si no, s'omplin en DOMContentLoaded.
    render();
    document.addEventListener('DOMContentLoaded', render);
})();
