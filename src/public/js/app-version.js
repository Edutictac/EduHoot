/* Versió d'EduHoot al peu: la de la imatge desplegada (package.json). */
(function(){
    function render(data){
        var el = document.getElementById('app-version');
        if(!el || !data || !data.version) return;
        el.textContent = 'v' + data.version;
    }

    function init(){
        if(!document.getElementById('app-version')) return;
        fetch('/api/version', { headers: { Accept: 'application/json' } })
            .then(function(res){ return res.ok ? res.json() : null; })
            .then(render)
            .catch(function(){});
    }

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init);
    }else{
        init();
    }
})();
