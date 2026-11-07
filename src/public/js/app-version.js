/* Versió d'EduHoot al peu: la de la imatge desplegada (package.json). */
(function(){
    function render(data){
        var el = document.getElementById('app-version');
        if(!el || !data || !data.version) return;
        var text = 'v' + data.version;
        if(data.tag){
            text += ' · ' + data.tag;
        }
        el.textContent = text;
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
