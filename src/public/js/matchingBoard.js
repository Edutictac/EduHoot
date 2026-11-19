// Tablero para responder una pregunta de correspondencia (feature 7, «emparejar»).
// Componente de Vue: window.EduhootMatchingBoard. Lo usa la pantalla del alumnado.
//
// Con `left` y `right` (textos) muestra dos columnas de botones. A ciegas (sin
// textos, solo `leftCount` y `rightCount`) muestra números y letras, como el
// proyector, de una de tres formas (`blindStyle`): codes (toques), select
// (desplegables) o steps (paso a paso).
//
// Al enviar emite `submit` con, para cada elemento de la izquierda, el índice
// (desde 0) del elemento de la derecha elegido, o null si se ha dejado sin pareja.
(function(){
    var LETTERS = 'ABCDEFGH';
    var PAIR_COLORS = ['#3b82f6', '#a855f7', '#06b6d4', '#ec4899', '#ca8a04', '#6366f1', '#0d9488', '#64748b'];

    function letter(i){ return LETTERS.charAt(i) || String(i + 1); }

    window.EduhootMatchingBoard = {
        props: {
            left: { type: Array, default: null },
            right: { type: Array, default: null },
            leftCount: { type: Number, default: 0 },
            rightCount: { type: Number, default: 0 },
            blindStyle: { type: String, default: 'codes' },
            t: { type: Function, required: true }
        },
        emits: ['submit'],
        data: function(){
            var n = this.left ? this.left.length : this.leftCount;
            var answers = [];
            for(var i = 0; i < n; i++) answers.push(null);
            return { answers: answers, selected: null, step: 0 };
        },
        computed: {
            blind: function(){ return !this.left || !this.right; },
            nLeft: function(){ return this.answers.length; },
            nRight: function(){ return this.blind ? this.rightCount : this.right.length; },
            leftIdx: function(){ return this.range(this.nLeft); },
            rightIdx: function(){ return this.range(this.nRight); },
            style: function(){
                if(!this.blind) return 'text';
                return ['codes', 'select', 'steps'].indexOf(this.blindStyle) === -1 ? 'codes' : this.blindStyle;
            },
            done: function(){
                return this.answers.filter(function(a){ return a !== null; }).length;
            },
            hint: function(){
                var keys = { text: 'matching_hint', codes: 'matching_hint_codes', select: 'matching_hint_select', steps: 'matching_hint_steps' };
                return this.t(keys[this.style]);
            },
            countText: function(){
                return this.t('matching_count').replace('{n}', this.done).replace('{t}', this.nLeft);
            }
        },
        methods: {
            range: function(n){
                var out = [];
                for(var i = 0; i < n; i++) out.push(i);
                return out;
            },
            letter: letter,
            color: function(i){ return PAIR_COLORS[i % PAIR_COLORS.length]; },
            ownerOf: function(r){ return this.answers.indexOf(r); },
            isSelected: function(side, idx){
                return !!this.selected && this.selected.side === side && this.selected.idx === idx;
            },
            // Cada elemento de la derecha solo puede estar en una pareja: si ya lo estaba, pasa a la nueva.
            link: function(l, r){
                var prev = this.answers.indexOf(r);
                if(prev !== -1) this.answers.splice(prev, 1, null);
                this.answers.splice(l, 1, r);
                this.selected = null;
            },
            // Toques: izquierda y luego derecha, o al revés. Tocar una pareja hecha la deshace.
            tap: function(side, idx){
                var sel = this.selected;
                if(sel && sel.side !== side){
                    if(side === 'left') this.link(idx, sel.idx); else this.link(sel.idx, idx);
                    return;
                }
                if(sel && sel.idx === idx){ this.selected = null; return; }
                if(side === 'left' && this.answers[idx] !== null) this.answers.splice(idx, 1, null);
                if(side === 'right'){
                    var owner = this.answers.indexOf(idx);
                    if(owner !== -1) this.answers.splice(owner, 1, null);
                }
                this.selected = { side: side, idx: idx };
            },
            onSelect: function(l, value){
                if(value === ''){
                    this.answers.splice(l, 1, null);
                    return;
                }
                this.link(l, Number(value));
            },
            selectOptionText: function(l, r){
                var owner = this.ownerOf(r);
                if(owner === -1 || owner === l) return letter(r);
                return letter(r) + ' ' + this.t('matching_now_in').replace('{n}', owner + 1);
            },
            // Paso a paso: al elegir una letra pasa al siguiente número sin pareja.
            pickStep: function(r){
                var i = this.step;
                if(this.answers[i] === r){
                    this.answers.splice(i, 1, null);
                    return;
                }
                this.link(i, r);
                for(var k = 1; k <= this.nLeft; k++){
                    var next = (i + k) % this.nLeft;
                    if(this.answers[next] === null){ this.step = next; return; }
                }
            },
            stepQuestion: function(){
                return this.t('matching_which_letter').replace('{n}', this.step + 1);
            },
            submit: function(){
                if(!this.done) return;
                this.$emit('submit', this.answers.slice());
            }
        },
        template: '' +
            '<div class="matching-board" :data-style="style">' +
                '<p class="matching-hint">{{ hint }}</p>' +
                '<div v-if="style === \'text\' || style === \'codes\'" class="matching-cols" :class="{ \'codes-only\': style === \'codes\' }">' +
                    '<div class="matching-col">' +
                        '<button v-for="i in leftIdx" :key="\'l\' + i" type="button" class="matching-item" :class="{ paired: answers[i] !== null, selected: isSelected(\'left\', i) }" :data-match-left="i" :style="answers[i] !== null ? { background: color(i) } : null" :aria-pressed="isSelected(\'left\', i) ? \'true\' : \'false\'" @click="tap(\'left\', i)">' +
                            '<span class="matching-code">{{ i + 1 }}</span>' +
                            '<span v-if="!blind" class="matching-txt">{{ left[i] }}</span>' +
                            '<span v-if="answers[i] !== null" class="matching-tag">{{ letter(answers[i]) }}</span>' +
                        '</button>' +
                    '</div>' +
                    '<div class="matching-col">' +
                        '<button v-for="j in rightIdx" :key="\'r\' + j" type="button" class="matching-item" :class="{ paired: ownerOf(j) !== -1, selected: isSelected(\'right\', j) }" :data-match-right="j" :style="ownerOf(j) !== -1 ? { background: color(ownerOf(j)) } : null" :aria-pressed="isSelected(\'right\', j) ? \'true\' : \'false\'" @click="tap(\'right\', j)">' +
                            '<span class="matching-code">{{ letter(j) }}</span>' +
                            '<span v-if="!blind" class="matching-txt">{{ right[j] }}</span>' +
                            '<span v-if="ownerOf(j) !== -1" class="matching-tag">{{ ownerOf(j) + 1 }}</span>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
                '<div v-else-if="style === \'select\'" class="matching-selects">' +
                    '<label v-for="i in leftIdx" :key="\'s\' + i" class="matching-sel-row" :for="\'match-sel-\' + i">' +
                        '<span class="matching-num" :style="{ background: color(i) }">{{ i + 1 }}</span>' +
                        '<select :id="\'match-sel-\' + i" :data-match-select="i" :value="answers[i] === null ? \'\' : String(answers[i])" @change="onSelect(i, $event.target.value)">' +
                            '<option value="">{{ t(\'matching_choose_letter\') }}</option>' +
                            '<option v-for="j in rightIdx" :key="j" :value="String(j)">{{ selectOptionText(i, j) }}</option>' +
                        '</select>' +
                    '</label>' +
                '</div>' +
                '<div v-else class="matching-steps">' +
                    '<div class="matching-step-now"><span class="matching-num big" :style="{ background: color(step) }">{{ step + 1 }}</span><span>{{ stepQuestion() }}</span></div>' +
                    '<div class="matching-letters">' +
                        '<button v-for="j in rightIdx" :key="\'b\' + j" type="button" class="matching-letter" :class="{ on: ownerOf(j) === step }" :data-match-step="j" :style="ownerOf(j) !== -1 ? { background: color(ownerOf(j)), color: \'#fff\' } : null" :aria-pressed="ownerOf(j) === step ? \'true\' : \'false\'" @click="pickStep(j)">' +
                            '{{ letter(j) }}<small v-if="ownerOf(j) !== -1 && ownerOf(j) !== step">{{ ownerOf(j) + 1 }}</small>' +
                        '</button>' +
                    '</div>' +
                    '<div class="matching-chips">' +
                        '<button v-for="i in leftIdx" :key="\'c\' + i" type="button" class="matching-chip" :class="{ current: i === step }" :data-match-go="i" @click="step = i">{{ (i + 1) + \' → \' + (answers[i] === null ? \'?\' : letter(answers[i])) }}</button>' +
                    '</div>' +
                '</div>' +
                '<div class="matching-footer">' +
                    '<span class="matching-count">{{ countText }}</span>' +
                    '<button type="button" class="button matching-send" :disabled="!done" @click="submit">{{ t(\'submit_free\') }}</button>' +
                '</div>' +
            '</div>'
    };

    // Texto de la corrección de una correspondencia (pantalla de resultado): una línea por
    // elemento de la izquierda, con lo elegido y, si falla, la pareja correcta.
    window.EduhootMatchingReview = function(meta, answers){
        var left = (meta && meta.matchLeft) || [];
        var right = (meta && meta.matchRight) || [];
        var solution = (meta && meta.matchSolution) || [];
        return left.map(function(text, i){
            var a = answers && answers[i] !== undefined ? answers[i] : null;
            return {
                code: String(i + 1),
                left: text,
                chosen: a === null ? null : letter(a) + ' ' + (right[a] || ''),
                correct: solution[i] === undefined ? '' : letter(solution[i]) + ' ' + (right[solution[i]] || ''),
                ok: a !== null && a === solution[i]
            };
        });
    };
})();
