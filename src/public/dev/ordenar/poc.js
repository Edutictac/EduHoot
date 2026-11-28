// Prova de concepte d'ordenar: usa el component real (window.EduhootOrderBoard) amb les preguntes de questions.json.
// Exposa l'estat a window.orderPoc per als tests. La correcció aquí és només de la maqueta (posició absoluta).
(function(){
    function shuffled(n){
        var idx = [];
        for(var i = 0; i < n; i++) idx.push(i);
        for(var j = idx.length - 1; j > 0; j--){
            var k = Math.floor(Math.random() * (j + 1));
            var tmp = idx[j]; idx[j] = idx[k]; idx[k] = tmp;
        }
        if(n > 1 && idx.every(function(v, i){ return v === i; })) idx = idx.slice(1).concat(idx[0]);
        return idx;
    }

    fetch('questions.json').then(function(res){ return res.json(); }).then(function(questions){
        Vue.createApp({
            data: function(){
                return { questions: questions, idx: 0, order: [], key: 0, result: '' };
            },
            computed: {
                q: function(){ return this.questions[this.idx]; },
                question: function(){ return this.q.question; },
                items: function(){ return this.order.map(function(i){ return this.q.items[i]; }, this); },
                progress: function(){ return 'Pregunta ' + (this.idx + 1) + ' de ' + this.questions.length; }
            },
            methods: {
                t: function(key, fallback){ return fallback; },
                load: function(){
                    this.order = shuffled(this.q.items.length);
                    this.key += 1;
                    this.result = '';
                    this.expose();
                },
                next: function(){ if(this.idx < this.questions.length - 1){ this.idx += 1; this.load(); } },
                prev: function(){ if(this.idx > 0){ this.idx -= 1; this.load(); } },
                onSubmit: function(seq){
                    // seq: posicions de la llista barrejada, en l'ordre triat; es tradueix a índexs correctes.
                    var orig = seq.map(function(j){ return this.order[j]; }, this);
                    var n = this.q.items.length;
                    var hits = orig.filter(function(v, i){ return v === i; }).length;
                    this.result = hits === n ? 'Correcta' : 'Incorrecta: ' + hits + ' de ' + n + ' en su posición';
                    this.expose();
                },
                expose: function(){
                    window.orderPoc = { state: {
                        index: this.idx,
                        question: this.q.question,
                        solution: this.q.items.slice(),
                        shown: this.items.slice(),
                        order: this.order.slice(),
                        result: this.result
                    } };
                }
            },
            mounted: function(){ this.load(); }
        }).component('order-board', window.EduhootOrderBoard).mount('#app');
    });
})();
