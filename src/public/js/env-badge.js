(function(){
    var ENVS = {
        development: {
            label: '🛠️ Entorn: desenvolupament',
            titlePrefix: '🛠️ DEV — ',
            badgeBg: 'rgba(249,115,22,0.9)',
            badgeColor: '#fff7ed',
            tint: 'rgba(124,45,18,0.16)'
        },
        staging: {
            label: '🧪 Entorn: stage',
            titlePrefix: '🧪 STAGE — ',
            badgeBg: 'rgba(22,163,74,0.9)',
            badgeColor: '#f0fdf4',
            tint: 'rgba(20,83,45,0.16)'
        }
    };

    function applyBadge(cfg){
        var badge = document.createElement('div');
        badge.textContent = cfg.label;
        badge.setAttribute('aria-hidden', 'true');
        var badgeStyle = badge.style;
        badgeStyle.position = 'fixed';
        badgeStyle.top = '10px';
        badgeStyle.left = '10px';
        badgeStyle.zIndex = '999999';
        badgeStyle.padding = '8px 14px';
        badgeStyle.borderRadius = '10px';
        badgeStyle.font = '700 22px/1.3 system-ui, sans-serif';
        badgeStyle.background = cfg.badgeBg;
        badgeStyle.color = cfg.badgeColor;
        badgeStyle.pointerEvents = 'none';
        badgeStyle.boxShadow = '0 2px 8px rgba(0,0,0,0.25)';

        var tint = document.createElement('div');
        var tintStyle = tint.style;
        tintStyle.position = 'fixed';
        tintStyle.inset = '0';
        tintStyle.zIndex = '999998';
        tintStyle.background = cfg.tint;
        tintStyle.pointerEvents = 'none';

        document.body.appendChild(tint);
        document.body.appendChild(badge);

        if(document.title.indexOf(cfg.titlePrefix) !== 0){
            document.title = cfg.titlePrefix + document.title;
        }
    }

    function init(){
        fetch('/api/env').then(function(res){
            return res.ok ? res.json() : null;
        }).then(function(data){
            var cfg = data && ENVS[data.env];
            if(cfg) applyBadge(cfg);
        }).catch(function(){
            // Sense distintiu si falla la petició; mai bloquejar la pàgina.
        });
    }

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', init);
    }else{
        init();
    }
})();
