// /homework/?code=ABCD2345 → /player/self-paced/?hw=ABCD2345 (conserva ?lang=).
(function(){
    var q = new URLSearchParams(window.location.search);
    var code = String(q.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if(!code){ window.location.replace('/'); return; }
    var url = '/player/self-paced/?hw=' + encodeURIComponent(code);
    if(q.get('lang')) url += '&lang=' + encodeURIComponent(q.get('lang'));
    window.location.replace(url);
})();
