// Lectura en veu alta (proposta 13) amb la Web Speech API del navegador.
// Sense serveis externs: res surt del dispositiu. Cada alumne decidix
// quan escoltar (botó); no hi ha lectura automàtica ni so a l'aula.
(function(root){
    'use strict';

    // Chrome i Safari tallen les locucions llargues cap als 15 s; per això
    // el text es reparteix en fragments curts, cadascun com una locució.
    var MAX_CHUNK = 180;
    var NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

    function decodeEntities(text){
        return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function(match, code){
            if(code.charAt(0) === '#'){
                var n = code.charAt(1).toLowerCase() === 'x'
                    ? parseInt(code.slice(2), 16)
                    : parseInt(code.slice(1), 10);
                return (isFinite(n) && n > 0 && n <= 0x10FFFF) ? String.fromCodePoint(n) : match;
            }
            var named = NAMED_ENTITIES[code.toLowerCase()];
            return named !== undefined ? named : match;
        });
    }

    // Text pla a partir del que es guarda per a les preguntas (pot tindre
    // <br>, <b>, <i>, <u> i entitats HTML).
    function plainText(value){
        var s = String(value == null ? '' : value);
        s = s.replace(/<br\s*\/?>/gi, '. ').replace(/<[^>]*>/g, '');
        s = decodeEntities(s);
        return s.replace(/\s+/g, ' ').trim();
    }

    // Trossos de com a molt MAX_CHUNK caràcters, tallats per frases quan es
    // pot i per espais quan una frase és massa llarga.
    function splitForSpeech(text, max){
        max = max || MAX_CHUNK;
        var sentences = String(text || '').match(/[^.!?;:]+[.!?;:]*/g) || [];
        var chunks = [];
        var current = '';

        function add(piece){
            if(!piece) return;
            if(current && current.length + 1 + piece.length > max){
                chunks.push(current);
                current = '';
            }
            current = current ? current + ' ' + piece : piece;
        }

        sentences.forEach(function(sentence){
            var rest = sentence.trim();
            while(rest.length > max){
                var cut = rest.lastIndexOf(' ', max);
                if(cut < 1) cut = max;
                add(rest.slice(0, cut).trim());
                rest = rest.slice(cut).trim();
            }
            add(rest);
        });
        if(current) chunks.push(current);
        return chunks;
    }

    // Codi BCP 47 a partir del que guarda <html lang>: ca, ca-ES-valencia, es, en...
    function bcp47(lang){
        var l = String(lang || '').toLowerCase();
        if(l.indexOf('ca') === 0 || l.indexOf('va') === 0) return 'ca-ES';
        if(l.indexOf('es') === 0) return 'es-ES';
        if(l.indexOf('en') === 0) return 'en-US';
        return 'es-ES';
    }

    function synth(){
        try{ return root.speechSynthesis || null; }catch(e){ return null; }
    }

    function supported(){
        return !!(synth() && root.SpeechSynthesisUtterance);
    }

    function voicesList(){
        var s = synth();
        try{ return s ? (s.getVoices() || []) : []; }catch(e){ return []; }
    }

    function voiceFor(lang){
        var wanted = bcp47(lang).toLowerCase();
        var prefix = wanted.slice(0, 2);
        var list = voicesList();
        var exact = null;
        var loose = null;
        list.forEach(function(v){
            var code = String(v.lang || '').toLowerCase();
            if(!exact && code === wanted) exact = v;
            if(!loose && code.slice(0, 2) === prefix) loose = v;
        });
        return exact || loose;
    }

    // Només és disponible si el navegador té alguna veu per a este idioma.
    // Sense veus (passa en Brave i en Firefox sense motor de veu) el botó no
    // es mostra: no tindria cap efecte.
    function canSpeak(lang){
        if(!supported()) return false;
        if(!voicesList().length) return false;
        return !!voiceFor(lang);
    }

    // Crida callback(true/false) amb la disponibilitat actual i cada vegada
    // que canvia la llista de veus: algunes veus arriben més tard (Chrome les
    // carrega de manera asíncrona), i el botó ha de reaccionar.
    function watchAvailability(lang, callback){
        var last = null;
        function report(){
            var ok = canSpeak(lang);
            if(ok !== last){
                last = ok;
                callback(ok);
            }
        }
        if(!supported()){
            callback(false);
            return;
        }
        report();
        try{
            synth().addEventListener('voiceschanged', report);
        }catch(e){}
    }

    // Cada crida invalida les anteriors: els esdeveniments de locucions
    // vells no tornen a tocar l'estat.
    var generation = 0;
    var pendingEnd = null;
    var keepAlive = [];

    function finish(){
        var cb = pendingEnd;
        pendingEnd = null;
        keepAlive = [];
        if(cb){
            try{ cb(); }catch(e){}
        }
    }

    function cancel(){
        generation += 1;
        var s = synth();
        if(s){
            try{ s.cancel(); }catch(e){}
        }
        finish();
    }

    // parts: textos en ordre (pregunta, després respostes). S'encolen totes
    // de cop, dins del mateix gest de l'usuari, perquè Safari només dona permís dins d'un clic.
    // onEnd s'executa en acabar, en error o en cancel·lar.
    function speakParts(parts, lang, onEnd){
        cancel();
        if(!supported()) return false;
        var chunks = [];
        (parts || []).forEach(function(part){
            splitForSpeech(plainText(part)).forEach(function(chunk){ chunks.push(chunk); });
        });
        if(!chunks.length) return false;

        var myGeneration = generation;
        var voice = voiceFor(lang);
        var locale = bcp47(lang);
        pendingEnd = onEnd || null;

        chunks.forEach(function(chunk, i){
            var utterance = new root.SpeechSynthesisUtterance(chunk);
            utterance.lang = locale;
            if(voice) utterance.voice = voice;
            var last = i === chunks.length - 1;
            utterance.onend = function(){
                if(myGeneration !== generation) return;
                if(last) finish();
            };
            utterance.onerror = function(event){
                if(myGeneration !== generation) return;
                // Quan no sona, el motiu queda en consola (p. ex. synthesis-unavailable).
                try{ console.warn('[tts] la lectura ha fallat:', event && event.error); }catch(e){}
                finish();
            };
            // Referència viva: alguns navegadors aturen la locució si es
            // recull la memòria abans d'acabar.
            keepAlive.push(utterance);
            synth().speak(utterance);
        });
        return true;
    }

    var api = {
        MAX_CHUNK: MAX_CHUNK,
        plainText: plainText,
        splitForSpeech: splitForSpeech,
        bcp47: bcp47,
        supported: supported,
        canSpeak: canSpeak,
        watchAvailability: watchAvailability,
        speakParts: speakParts,
        cancel: cancel
    };

    root.EduhootTTS = api;
    if(typeof module !== 'undefined' && module.exports){
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
