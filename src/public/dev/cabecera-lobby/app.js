// Amplada de la maqueta: els botons canvien l'ample de tots els recuadres per a veure el reajust.
// Script extern: el servidor no permet scripts en línia (CSP script-src 'self').
(function(){
    var buttons = document.querySelectorAll('.bar button');
    var stages = document.querySelectorAll('[data-stage]');
    buttons.forEach(function(btn){
        btn.addEventListener('click', function(){
            var w = Number(btn.getAttribute('data-w'));
            buttons.forEach(function(b){ b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
            stages.forEach(function(st){ st.style.width = w + 'px'; });
        });
    });
    stages.forEach(function(st){ st.style.width = '1000px'; });
})();
