// Llista d'idiomes de la interfície i lògica comuna per a detectar-lo,
// guardar-lo i pintar els selectors. Cada pàgina manté els seus textos i
// la seua funció t(); ací només hi ha el que és igual en totes.
(function(){
    var LANGUAGES = [
        { code: 'ca', name: 'Català', short: 'CA' },
        { code: 'va', name: 'Valencià', short: 'VA' },
        { code: 'es', name: 'Español', short: 'ES' },
        { code: 'en', name: 'English', short: 'EN' }
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

    function fillButtons(container){
        if(container.querySelector('button[data-lang]')) return;
        LANGUAGES.forEach(function(l){
            var button = document.createElement('button');
            button.type = 'button';
            button.setAttribute('data-lang', l.code);
            button.setAttribute('title', l.name);
            button.textContent = l.short;
            container.appendChild(button);
        });
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
        render: render
    };

    // Els scripts de pàgina van al final del <body>, així que normalment
    // els selectors ja existixen; si no, s'omplin en DOMContentLoaded.
    render();
    document.addEventListener('DOMContentLoaded', render);
})();
