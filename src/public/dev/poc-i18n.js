// Idiomas de las maquetas de /dev (ca, va, es, en). Usa la lista y la detección de /js/languages.js
// (parámetro ?lang=, idioma guardado o el del navegador). Cada maqueta pasa sus textos:
//   var i18n = PocI18n({ es: {...}, ca: {...}, en: {...} });
// El valenciano (va) usa los textos del catalán salvo los que se definan aparte.
(function(){
  window.PocI18n = function(dicts){
    var lang = EduhootLang.init({ fallback: 'es' });
    var listeners = [];

    function lookup(key){
      var chain = lang === 'va' ? ['va', 'ca', 'es'] : [lang, 'es'];
      for(var i = 0; i < chain.length; i++){
        var d = dicts[chain[i]];
        if(d && d[key] !== undefined) return d[key];
      }
      return key;
    }
    function t(key, vars){
      var text = lookup(key);
      if(vars) Object.keys(vars).forEach(function(k){ text = text.split('{' + k + '}').join(vars[k]); });
      return text;
    }
    // Textos fijos del HTML: data-i18n (texto), data-i18n-title (title) y las opciones de los <select>.
    function apply(){
      document.documentElement.lang = lang === 'va' ? 'ca-valencia' : lang;
      document.querySelectorAll('[data-i18n]').forEach(function(el){ el.textContent = t(el.getAttribute('data-i18n')); });
      document.querySelectorAll('[data-i18n-title]').forEach(function(el){ el.title = t(el.getAttribute('data-i18n-title')); });
      var title = document.querySelector('title[data-i18n]');
      if(title) document.title = t(title.getAttribute('data-i18n'));
    }
    function setLang(next){
      if(next === lang) return;
      lang = next;
      EduhootLang.persist(lang);
      apply();
      listeners.forEach(function(fn){ fn(lang); });
    }

    EduhootLang.render();
    var select = document.getElementById('poc-lang');
    if(select){
      select.value = lang;
      select.addEventListener('change', function(){ setLang(select.value); });
    }
    apply();

    return {
      t: t,
      get lang(){ return lang; },
      apply: apply,
      onChange: function(fn){ listeners.push(fn); }
    };
  };
})();
