// Mida de la finestra visible del navegador, per a les pantalles de joc
// (/player/game/ i /solo/). Ho deixa en --app-vh i --app-vw perquè el CSS
// ocupe exactament eixa àrea, amb un marge petit, sense sortir-se'n. Quan
// surt el teclat al mòbil, la finestra visible es reduïx i el joc s'adapta.
(function(){
    'use strict';
    var root = document.documentElement;
    var vv = window.visualViewport || null;

    function measure(){
        var h = vv && vv.height ? vv.height : window.innerHeight;
        var w = vv && vv.width ? vv.width : window.innerWidth;
        if(!h || !w) return;
        root.style.setProperty('--app-vh', Math.floor(h) + 'px');
        root.style.setProperty('--app-vw', Math.floor(w) + 'px');
    }

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    if(vv){
        vv.addEventListener('resize', measure);
        vv.addEventListener('scroll', measure);
    }
    window.EduhootViewportFit = { measure: measure };
})();
