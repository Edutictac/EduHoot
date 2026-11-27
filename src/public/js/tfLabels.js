// Verdadero/Falso: el texto de las dos opciones se muestra en el idioma de la interfaz
// (ca, va, es, en) aunque el cuestionario lo tenga guardado en otro («true», «Falso»...)
// o vacío. Un texto distinto (p. ej. «Cierto») se respeta tal cual.
(function(){
    var LABELS = {
        es: ['Verdadero', 'Falso'],
        ca: ['Vertader', 'Fals'],
        va: ['Vertader', 'Fals'],
        en: ['True', 'False'],
        fr: ['Vrai', 'Faux'],
        de: ['Wahr', 'Falsch'],
        it: ['Vero', 'Falso'],
        pt: ['Verdadeiro', 'Falso'],
        bg: ['Вярно', 'Грешно']
    };
    var TRUE_WORDS = ['true', 'wahr', 'vero', 'verdadeiro', 'вярно', 'vrai', 'verdadero', 'vertader', 'vertadero', 'verdader', 'cierto', 'cert', 'v', 't'];
    var FALSE_WORDS = ['false', 'falsch', 'falso', 'грешно', 'невярно', 'faux', 'falso', 'fals', 'f'];

    function currentLang(){
        var lang = '';
        try{ if(window.EduhootLang) lang = window.EduhootLang.fromQuery() || window.EduhootLang.fromStorage(); }catch(e){}
        if(!lang){
            var nav = String(navigator.language || 'es').toLowerCase().split('-')[0];
            lang = nav;
        }
        return LABELS[lang] ? lang : 'es';
    }

    function text(stored, index, lang){
        var key = String(stored === null || stored === undefined ? '' : stored).trim().toLowerCase();
        var words = index === 0 ? TRUE_WORDS : FALSE_WORDS;
        if(key === '' || words.indexOf(key) !== -1) return LABELS[lang || currentLang()][index === 0 ? 0 : 1];
        return stored;
    }

    // Devuelve una copia de `answers` con las dos primeras posiciones traducidas si el tipo es V/F.
    function localize(type, answers, lang){
        var list = Array.isArray(answers) ? answers.slice() : [];
        if(type !== 'true-false') return list;
        while(list.length < 2) list.push('');
        list[0] = text(list[0], 0, lang);
        list[1] = text(list[1], 1, lang);
        return list;
    }

    window.EduhootTf = { text: text, localize: localize, currentLang: currentLang };
})();
