// Mode fantasma (catàleg, ítem 26): la millor marca personal en Solo, guardada només al navegador.
// Compara la puntuació acumulada amb la de la millor partida anterior del mateix qüestionari,
// pregunta a pregunta. Les preguntes es comparen per la seua posició al quiz original (no per
// l'ordre en què surten), així que el barajat no trenca la comparació.
(function(root){
    'use strict';

    var KEY_PREFIX = 'eduh_ghost_';
    var VERSION = 1;

    // Hash FNV-1a de 32 bits: només serveix per detectar canvis, no és de seguretat.
    function hash(text){
        var h = 0x811c9dc5;
        for(var i = 0; i < text.length; i++){
            h ^= text.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return h.toString(16);
    }

    // Empremta del contingut de les preguntes: si canvia el quiz, la marca antiga ja no és comparable.
    function fingerprint(questions){
        var list = (Array.isArray(questions) ? questions : []).map(function(q){
            q = q || {};
            return [q.type, q.question, q.answers, q.correctAnswers, q.correct, q.items, q.pairs,
                q.acceptedAnswers, q.numericAnswer, q.tolerance, q.time, q.pointsMultiplier,
                q.orderGrading, q.layout, q.image, q.video];
        });
        return list.length + ':' + hash(JSON.stringify(list));
    }

    // Diferència amb signe per mostrar: «+30» o «−20».
    function signed(n){
        var v = Math.round(Number(n) || 0);
        return (v >= 0 ? '+' : '−') + Math.abs(v);
    }

    // Punts de la marca en les preguntes ja jugades (per la seua posició al quiz original).
    function ghostTotalFor(ghost, playedOrigs){
        var points = (ghost && ghost.points) || {};
        return (Array.isArray(playedOrigs) ? playedOrigs : []).reduce(function(sum, orig){
            return sum + (Number(points[orig]) || 0);
        }, 0);
    }

    // Diferència de la puntuació actual amb la marca, o null si no hi ha marca.
    function diffFor(ghost, playedOrigs, score){
        if(!ghost) return null;
        return (Number(score) || 0) - ghostTotalFor(ghost, playedOrigs);
    }

    // La clau és l'empremta del quiz: la mateixa marca serveix a solo i a aula.
    function storageKey(fp){
        return KEY_PREFIX + String(fp);
    }

    // La marca guardada, o null si no n'hi ha o si és d'un altre contingut de quiz.
    function loadGhost(storage, fp){
        if(!storage || !fp) return null;
        try{
            var raw = storage.getItem(storageKey(fp));
            if(!raw) return null;
            var data = JSON.parse(raw);
            if(!data || data.v !== VERSION || data.fp !== fp) return null;
            return { total: Number(data.total) || 0, points: data.points || {} };
        }catch(e){
            return null;
        }
    }

    // Guarda la partida només si és la millor del mateix qüestionari (o si la marca anterior era d'un altre).
    // Retorna true si l'ha guardada.
    function saveGhost(storage, fp, total, points){
        if(!storage || !fp) return false;
        var current = null;
        try{
            current = JSON.parse(storage.getItem(storageKey(fp)) || 'null');
        }catch(e){
            current = null;
        }
        var sameQuiz = !!current && current.v === VERSION && current.fp === fp;
        if(sameQuiz && (Number(current.total) || 0) >= total) return false;
        try{
            storage.setItem(storageKey(fp), JSON.stringify({ v: VERSION, fp: fp, total: total, points: points, savedAt: Date.now() }));
            return true;
        }catch(e){
            return false;
        }
    }

    var api = {
        fingerprint: fingerprint,
        signed: signed,
        ghostTotalFor: ghostTotalFor,
        diffFor: diffFor,
        loadGhost: loadGhost,
        saveGhost: saveGhost
    };

    root.EduhootGhost = api;
    if(typeof module !== 'undefined' && module.exports){
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
