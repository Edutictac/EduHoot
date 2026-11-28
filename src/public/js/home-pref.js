// Página inicial a elegir: la promo (`/`, por defecto) o el inicio rápido (`/inicio/`).
// - «Inicio rápido» en la promo guarda la preferencia «quick»: las siguientes veces `/` entra directo a `/inicio/`.
// - El icono de EduHoot en `/inicio/` guarda «promo»: `/` vuelve a mostrar la promo.
// La preferencia vive solo en este navegador (localStorage). Va en un script externo, sin inline, por la CSP.
(function(){
    var KEY = 'eduhoot-home';

    function get(){
        try{ return window.localStorage.getItem(KEY); }catch(e){ return null; }
    }
    function set(value){
        try{ window.localStorage.setItem(KEY, value); }catch(e){}
    }

    var path = window.location.pathname;
    var isPromo = path === '/' || path === '/index.html';
    if(isPromo && get() === 'quick'){
        // Se conserva ?lang= y el resto de parámetros.
        window.location.replace('/inicio/' + window.location.search + window.location.hash);
        return;
    }

    document.addEventListener('click', function(event){
        var link = event.target.closest && event.target.closest('a[href]');
        if(!link) return;
        if(link.getAttribute('href') === '/inicio/') set('quick');
        else if(link.classList.contains('logo-link')) set('promo');
    });

    window.eduhootHomePref = { get: get, set: set };
})();
