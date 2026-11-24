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
