// Piezas comunes de las pantallas de partida del alumnado (en vivo y autoritme):
// texto enriquecido seguro y medios (imagen, vídeo, YouTube) de la pregunta.

function decodeBasicEntities(value){
    var txt = document.createElement('textarea');
    txt.innerHTML = String(value || '');
    return txt.value;
}

function escapeHtml(value){
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatRichText(value){
    var decoded = decodeBasicEntities(value);
    var safe = escapeHtml(decoded);
    safe = safe.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    safe = safe.replace(/&lt;(\/?)(b|strong|i|em|u)&gt;/gi, '<$1$2>');
    return safe;
}

function normalizeSvgDataUrlForImg(url){
    if(!url) return url;
    var raw = String(url).trim();
    if(!raw) return raw;
    var lower = raw.toLowerCase();
    if(!lower.startsWith('data:image/svg+xml')) return raw;
    var comma = raw.indexOf(',');
    if(comma === -1) return raw;
    var header = raw.slice(0, comma + 1);
    var payload = raw.slice(comma + 1);
    if(!payload) return raw;
    if(/;base64/i.test(header)) return raw;

    // Ya URL-encoded: recortar cualquier sufijo tras </svg>
    if(/%[0-9a-fA-F]{2}/.test(payload)){
        var lp = payload.toLowerCase();
        var endEnc = '%3c%2fsvg%3e';
        var posEnc = lp.lastIndexOf(endEnc);
        if(posEnc !== -1) return header + payload.slice(0, posEnc + endEnc.length);
        return raw;
    }

    // Raw: recortar tras </svg> y URL-encode
    var lpr = payload.toLowerCase();
    var endRaw = '</svg>';
    var posRaw = lpr.lastIndexOf(endRaw);
    if(posRaw !== -1){
        payload = payload.slice(0, posRaw + endRaw.length);
    }
    if(payload.indexOf('<') !== -1 || payload.indexOf('#') !== -1 || payload.indexOf('"') !== -1 || payload.indexOf("'") !== -1){
        return header + encodeURIComponent(payload);
    }
    return raw;
}

function setMedia(imageUrl, videoUrl){
    var img = document.getElementById('playerQuestionImage');
    var vid = document.getElementById('playerQuestionVideo');
    var iframe = document.getElementById('playerQuestionIframe');
    if(img){
        if(imageUrl){
            img.src = normalizeSvgDataUrlForImg(imageUrl);
            img.style.display = 'block';
        }else{
            img.removeAttribute('src');
            img.style.display = 'none';
        }
    }
    if(vid && iframe){
        var ytId = parseYouTubeId(videoUrl);
        if(ytId){
            vid.removeAttribute('src');
            vid.pause();
            vid.style.display = 'none';
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + ytId;
            iframe.style.display = 'block';
        }else if(videoUrl){
            iframe.removeAttribute('src');
            iframe.style.display = 'none';
            vid.src = videoUrl;
            vid.style.display = 'block';
        }else{
            iframe.removeAttribute('src');
            iframe.style.display = 'none';
            vid.removeAttribute('src');
            vid.pause();
            vid.style.display = 'none';
        }
    }
}

function parseYouTubeId(url){
    if(!url) return null;
    try{
        var u = new URL(url);
        if(u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')){
            if(u.hostname.includes('youtu.be')){
                return u.pathname.replace('/','');
            }
            if(u.searchParams.get('v')) return u.searchParams.get('v');
            var parts = u.pathname.split('/');
            var last = parts[parts.length-1];
            if(last) return last;
        }
    }catch(e){}
    return null;
}
