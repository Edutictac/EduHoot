// Mode flashcards («repassar») del modo individual (proposta 20), amb la
// pràctica de les preguntes no sabudes (proposta 25). Només a /solo/: no
// toca la puntuació ni el ranking. El progrés (sabudes / no sabudes) es guarda
// per cuestionari en localStorage, al dispositiu de l'alumne.
(function(root){
    'use strict';

    var STORAGE_KEY = 'eduhoot-flashcards-progress';
    var KNOWN = 'known';
    var UNKNOWN = 'unknown';

    // Llegeix el progrés de tots els cuestionaris. Qualsevol error (mode
    // privat, emmagatzematge bloquejat, JSON trencat) torna un objecte buit.
    function loadAllProgress(storage){
        try{
            var raw = storage.getItem(STORAGE_KEY);
            var parsed = raw ? JSON.parse(raw) : {};
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
        }catch(e){
            return {};
        }
    }

    function saveAllProgress(storage, all){
        try{
            storage.setItem(STORAGE_KEY, JSON.stringify(all));
        }catch(e){}
    }

    // Estat per pregunta d'un cuestionari: { '<índex original>': 'known'|'unknown' }.
    // Si el nombre de preguntes ha canviat (cuestionari editat), el progrés
    // antic no és fiable i es descarta.
    function quizStatus(all, quizId, total){
        var entry = all && all[String(quizId)];
        if(!entry || entry.total !== total || !entry.status || typeof entry.status !== 'object'){
            return {};
        }
        return entry.status;
    }

    function setStatus(all, quizId, total, idx, status){
        var key = String(quizId);
        var current = quizStatus(all, quizId, total);
        var next = {};
        Object.keys(current).forEach(function(k){ next[k] = current[k]; });
        if(status === KNOWN || status === UNKNOWN){
            next[String(idx)] = status;
        }else{
            delete next[String(idx)];
        }
        all[key] = { total: total, status: next };
        return next;
    }

    // Una targeta per pregunta (no es repassen les enquestes, que no tenen resposta).
    // Conserva l'índex original perquè el progrés no depenga de l'ordre barrejat.
    function buildCards(questions){
        var list = Array.isArray(questions) ? questions : [];
        var cards = [];
        list.forEach(function(q, idx){
            if(!q) return;
            if(String(q.type || '').toLowerCase() === 'poll') return;
            cards.push({ idx: idx, q: q });
        });
        return cards;
    }

    // mode: 'all' (totes) o 'unknown' (només les marcades com a no sabudes).
    function deckFor(cards, status, mode){
        if(mode === UNKNOWN){
            return cards.filter(function(card){ return status[String(card.idx)] === UNKNOWN; });
        }
        return cards.slice();
    }

    function shuffleCopy(list, random){
        var rnd = typeof random === 'function' ? random : Math.random;
        var copy = list.slice();
        for(var i = copy.length - 1; i > 0; i--){
            var j = Math.floor(rnd() * (i + 1));
            var tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy;
    }

    function countStatus(cards, status){
        var counts = { known: 0, unknown: 0, pending: 0 };
        cards.forEach(function(card){
            var s = status[String(card.idx)];
            if(s === KNOWN) counts.known += 1;
            else if(s === UNKNOWN) counts.unknown += 1;
            else counts.pending += 1;
        });
        return counts;
    }

    function defaultStorage(){
        try{
            return root.localStorage;
        }catch(e){
            return null;
        }
    }

    var api = {
        KNOWN: KNOWN,
        UNKNOWN: UNKNOWN,
        STORAGE_KEY: STORAGE_KEY,
        loadAllProgress: loadAllProgress,
        saveAllProgress: saveAllProgress,
        quizStatus: quizStatus,
        setStatus: setStatus,
        buildCards: buildCards,
        deckFor: deckFor,
        shuffleCopy: shuffleCopy,
        countStatus: countStatus,
        defaultStorage: defaultStorage
    };

    root.EduhootFlashcards = api;
    if(typeof module !== 'undefined' && module.exports){
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
