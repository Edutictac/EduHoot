// Paginador compartit del catàleg de solo i multijugador: el mateix comportament que el de la biblioteca.
// La barra flotant apareix quan el paginador de baix no es veu (IntersectionObserver).
var catalogFixedPager = Vue.reactive({ ready: false, bottomVisible: false });

var CATALOG_PAGER_I18N = {
    es: { prev: 'Anterior', next: 'Siguiente', info: 'Página {page} de {total}', size: 'Por página' },
    en: { prev: 'Previous', next: 'Next', info: 'Page {page} of {total}', size: 'Per page' },
    ca: { prev: 'Anterior', next: 'Següent', info: 'Pàgina {page} de {total}', size: 'Per pàgina' },
    va: { prev: 'Anterior', next: 'Següent', info: 'Pàgina {page} de {total}', size: 'Per pàgina' },
    fr: { prev: 'Précédent', next: 'Suivant', info: 'Page {page} sur {total}', size: 'Par page' }
};

function catalogPagerT(key, vars){
    var code = String(document.documentElement.lang || 'es').toLowerCase();
    code = code.indexOf('valencia') !== -1 ? 'va' : code.split('-')[0];
    var dict = CATALOG_PAGER_I18N[code] || CATALOG_PAGER_I18N.es;
    var text = dict[key] || CATALOG_PAGER_I18N.es[key] || '';
    if(vars) Object.keys(vars).forEach(function(k){ text = text.replace('{' + k + '}', vars[k]); });
    return text;
}

function watchCatalogPager(el){
    if(typeof IntersectionObserver !== 'function' || !el) return;
    var observer = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
            if(entry.target === el) catalogFixedPager.bottomVisible = entry.isIntersecting;
        });
        catalogFixedPager.ready = true;
    });
    observer.observe(el);
}
