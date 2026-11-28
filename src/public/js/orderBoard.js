// Tauler per respondre una pregunta d'ordenar (feature 7, «ordenar»).
// Component de Vue: window.EduhootOrderBoard. Lo usa la pantalla del alumnado.
//
// Amb `items` (textos) mostra una llista vertical en l'ordre barrejat que rep. A ciegas
// (sense textos, només `count`) mostra codis (A, B, C…), com el proyector.
// Es pot reordenar amb l'asa (arrossegar, en escriptori) o amb les fletxes ↑ ↓ (en qualsevol dispositiu).
//
// En enviar emet `submit` amb la seqüència d'índexs de la llista barrejada, en l'ordre que ha
// triat l'alumne (posició 0 primer). El servidor la tradueix a l'ordre correcte.
(function(){
    var LETTERS = 'ABCDEFGH';

    function letter(i){ return LETTERS.charAt(i) || String(i + 1); }

    // Lògica compartida (com EduhootMatching a matchingBoard.js): barreja, disposició i puntuació.
    // Mateixes regles que server/services/orderQuestion.js (proves: test/unit/orderBrowser.test.js).
    var GRADING = {
        ALL_OR_NOTHING: -1, ABSOLUTE_POSITION: 0, RELATIVE_NEXT_EXCLUDE_LAST: 1, RELATIVE_NEXT_INCLUDE_LAST: 2,
        RELATIVE_ONE_PREVIOUS_AND_NEXT: 3, RELATIVE_ALL_PREVIOUS_AND_NEXT: 4, LONGEST_ORDERED_SUBSET: 5,
        LONGEST_CONTIGUOUS_SUBSET: 6, RELATIVE_TO_CORRECT: 7
    };

    // És una permutació de 0..n-1?
    function isPermutation(answer, n){
        if(!Array.isArray(answer) || answer.length !== n) return false;
        var seen = {};
        for(var i = 0; i < n; i++){
            var v = answer[i];
            if(typeof v !== 'number' || v % 1 !== 0 || v < 0 || v >= n || seen[v]) return false;
            seen[v] = true;
        }
        return true;
    }

    // Mida de la subseqüència creixent més llarga (valors diferents).
    function longestIncreasing(values){
        var tails = [];
        values.forEach(function(v){
            var lo = 0, hi = tails.length;
            while(lo < hi){
                var mid = (lo + hi) >> 1;
                if(tails[mid] < v) lo = mid + 1; else hi = mid;
            }
            tails[lo] = v;
        });
        return tails.length;
    }

    // Proporció (0..1) segons el mode de Moodle. Resposta incompleta o no vàlida: 0.
    function orderScoreRatio(answer, n, mode){
        if(mode === undefined) mode = GRADING.ABSOLUTE_POSITION;
        if(typeof n !== 'number' || n % 1 !== 0 || n < 2) return 0;
        if(!isPermutation(answer, n)) return 0;
        var last = n - 1;
        var i, hits, total, run, best;
        switch(mode){
            case GRADING.ALL_OR_NOTHING:
                return answer.every(function(v, k){ return v === k; }) ? 1 : 0;
            case GRADING.ABSOLUTE_POSITION:
                return answer.filter(function(v, k){ return v === k; }).length / n;
            case GRADING.RELATIVE_TO_CORRECT:
                total = answer.reduce(function(sum, v, k){ return sum + Math.max(0, last - Math.abs(k - v)); }, 0);
                return total / (n * last);
            case GRADING.RELATIVE_NEXT_EXCLUDE_LAST:
                hits = 0;
                for(i = 0; i < last; i++) if(answer[i + 1] === answer[i] + 1) hits++;
                return hits / last;
            case GRADING.RELATIVE_NEXT_INCLUDE_LAST:
                hits = 0;
                for(i = 0; i < last; i++) if(answer[i + 1] === answer[i] + 1) hits++;
                if(answer[last] === last) hits++;
                return hits / n;
            case GRADING.RELATIVE_ONE_PREVIOUS_AND_NEXT:
                total = 0;
                for(i = 0; i < n; i++){
                    var prevOk = i === 0 ? answer[i] === 0 : answer[i - 1] === answer[i] - 1;
                    var nextOk = i === last ? answer[i] === last : answer[i + 1] === answer[i] + 1;
                    if(prevOk) total++;
                    if(nextOk) total++;
                }
                return total / (2 * n);
            case GRADING.RELATIVE_ALL_PREVIOUS_AND_NEXT:
                total = 0;
                for(i = 0; i < n; i++){
                    for(var j = 0; j < n; j++){
                        if(i === j) continue;
                        if((j < i && answer[j] < answer[i]) || (j > i && answer[j] > answer[i])) total++;
                    }
                }
                return total / (n * last);
            case GRADING.LONGEST_ORDERED_SUBSET:
                var len = longestIncreasing(answer);
                return len >= 2 ? len / n : 0;
            case GRADING.LONGEST_CONTIGUOUS_SUBSET:
                best = 1; run = 1;
                for(i = 0; i < last; i++){
                    run = answer[i + 1] === answer[i] + 1 ? run + 1 : 1;
                    if(run > best) best = run;
                }
                return best >= 2 ? best / n : 0;
            default:
                return 0;
        }
    }

    // Ordre aleatori dels índexs 0..n-1; mai és el d'origen (com a la correspondència).
    function shuffledOrder(n){
        var order = [];
        for(var i = 0; i < n; i++) order.push(i);
        for(i = n - 1; i > 0; i--){
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
        }
        if(n > 1 && order.every(function(v, k){ return v === k; })){
            order = order.slice(1).concat(order[0]);
        }
        return order;
    }

    // Disposició nova d'una pregunta: elements barrejats i el mapa cap a l'ordre correcte.
    function shuffledLayout(items){
        var list = Array.isArray(items) ? items : [];
        var shown = shuffledOrder(list.length);
        return { orderShown: shown, orderItems: shown.map(function(i){ return list[i]; }) };
    }

    // Disposició d'una pregunta: la barrejada que trau (orderShown vàlid) o la del guardat.
    function layoutOf(q){
        var items = Array.isArray(q && q.items) ? q.items.slice() : [];
        var shown = isPermutation(q && q.orderShown, items.length)
            ? q.orderShown.slice()
            : items.map(function(_, i){ return i; });
        return { items: items, orderShown: shown, orderItems: shown.map(function(i){ return items[i]; }) };
    }

    // Proporció de la resposta: l'alumne envia posicions de la llista barrejada; es tradueixen a índexs
    // de la solució (com orderScoreRatioFromMeta del servidor) i es puntuen amb el mode de la pregunta.
    function scoreRatio(meta, answer){
        var shown = Array.isArray(meta && meta.orderShown) ? meta.orderShown : [];
        var n = shown.length;
        if(!Array.isArray(answer) || answer.length !== n) return 0;
        var mapped = answer.map(function(v){ return shown[Number(v)]; });
        return orderScoreRatio(mapped, n, meta.orderGrading);
    }

    window.EduhootOrder = {
        GRADING: GRADING,
        isPermutation: isPermutation,
        orderScoreRatio: orderScoreRatio,
        shuffledOrder: shuffledOrder,
        shuffledLayout: shuffledLayout,
        layoutOf: layoutOf,
        scoreRatio: scoreRatio
    };

    window.EduhootOrderBoard = {
        props: {
            items: { type: Array, default: null },
            count: { type: Number, default: 0 },
            layout: { type: String, default: 'vertical' },
            t: { type: Function, required: true }
        },
        emits: ['submit'],
        data: function(){
            var n = this.items ? this.items.length : (Number(this.count) || 0);
            var order = [];
            for(var i = 0; i < n; i++) order.push(i);
            return { order: order, dragFrom: null };
        },
        methods: {
            label: function(idx){
                return this.items ? this.items[idx] : letter(idx);
            },
            move: function(pos, delta){
                var target = pos + delta;
                if(target < 0 || target >= this.order.length) return;
                var copy = this.order.slice();
                var tmp = copy[pos];
                copy[pos] = copy[target];
                copy[target] = tmp;
                this.order = copy;
            },
            onDragStart: function(pos){
                this.dragFrom = pos;
            },
            onDrop: function(pos){
                if(this.dragFrom === null || this.dragFrom === pos) { this.dragFrom = null; return; }
                var copy = this.order.slice();
                var moved = copy.splice(this.dragFrom, 1)[0];
                copy.splice(pos, 0, moved);
                this.order = copy;
                this.dragFrom = null;
            },
            submit: function(){
                this.$emit('submit', this.order.slice());
            }
        },
        template: [
            '<div class="order-board" :class="\'order-board--\' + layout" role="group" :aria-label="t(\'order_board_label\', \'Ordena los elementos\')">',
            '  <ol class="order-list">',
            '    <li v-for="(idx, pos) in order" :key="idx" class="order-item" draggable="true"',
            '        @dragstart="onDragStart(pos)" @dragover.prevent @drop.prevent="onDrop(pos)">',
            '      <span class="order-handle" aria-hidden="true">&#x2630;</span>',
            '      <span class="order-text">{{ label(idx) }}</span>',
            '      <button type="button" class="order-move" :disabled="pos === 0" :aria-label="t(\'order_up\', \'Subir\')" @click="move(pos, -1)">&#x25B2;</button>',
            '      <button type="button" class="order-move" :disabled="pos === order.length - 1" :aria-label="t(\'order_down\', \'Bajar\')" @click="move(pos, 1)">&#x25BC;</button>',
            '    </li>',
            '  </ol>',
            '  <button type="button" class="button order-submit" @click="submit">{{ t(\'submit_order\', \'Enviar\') }}</button>',
            '</div>'
        ].join('\n')
    };
})();
