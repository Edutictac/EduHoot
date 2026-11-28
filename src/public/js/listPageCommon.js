// Parts comunes de les pàgines de llista (Mis partidas i Mis deberes): vista (tarjetes o detall), imatge de fons
// (la mateixa preferència que la biblioteca) i paginador amb «Ajustar a la finestra». Cada pàgina aporta els seus colors.
var EDUHOOT_COVER_KEY = 'eduhoot-library-cover-level';
var EDUHOOT_COVER_LEVELS = [0, 10, 20, 30];

function eduhootReadCoverLevel(){
    try{
        var v = parseInt(localStorage.getItem(EDUHOOT_COVER_KEY), 10);
        if(EDUHOOT_COVER_LEVELS.indexOf(v) !== -1) return v;
    }catch(e){}
    return 20;
}
// Amb sessió, es guarda a la compta (la mateixa preferència que la biblioteca).
function eduhootSaveCoverLevel(v, loggedIn){
    try{ localStorage.setItem(EDUHOOT_COVER_KEY, String(v)); }catch(e){}
    if(!loggedIn) return;
    fetch('/api/auth/preferences', {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryCoverLevel: v })
    }).catch(function(){});
}
function eduhootReadView(key){
    try{ return localStorage.getItem('eduhoot-view-' + key) === 'detail' ? 'detail' : 'cards'; }catch(e){ return 'cards'; }
}
function eduhootSaveView(key, v){
    try{ localStorage.setItem('eduhoot-view-' + key, v); }catch(e){}
}
function eduhootReadSizeChoice(key){
    try{
        var v = localStorage.getItem('eduhoot-pagesize-' + key) || 'auto';
        if(v === 'auto' || [6, 12, 24, 48].indexOf(Number(v)) !== -1) return v;
    }catch(e){}
    return 'auto';
}
function eduhootSaveSizeChoice(key, v){
    try{ localStorage.setItem('eduhoot-pagesize-' + key, v); }catch(e){}
}

// Mixin de Vue: paginació de `list` amb el mateix comportament que la biblioteca.
// La pàgina ha de definir al seu data(): `listKey` (nom de les preferències), `list`, i les
// preferències llegides amb eduhootReadView/eduhootReadSizeChoice/eduhootReadCoverLevel.
var EduhootListMixin = {
    // Valors per defecte; cada pàgina fixa `listKey`, `list`, `view`, `pageSizeChoice` i `coverLevel` al seu data().
    data: function(){
        return {
            page: 1, pageSizeChoice: 'auto', listView: 'cards',
            viewH: window.innerHeight, areaTop: 0, rowPx: 52, chromeH: 260, cols: 1,
            pagerVisible: true, pagerReady: false, coverLevel: 20
        };
    },
    computed: {
        sizes: function(){ return [6, 12, 24, 48]; },
        // Elements que caben entre la llista i el borde inferior de la finestra (tarjetes: files × columnes).
        fitItems: function(){
            var avail = this.viewH - this.areaTop - this.chromeH;
            var rows = Math.max(1, Math.floor(avail / this.rowPx));
            return this.listView === 'cards' ? Math.max(this.cols, rows * this.cols) : Math.max(3, Math.min(40, rows));
        },
        pageSize: function(){
            return this.pageSizeChoice === 'auto' ? this.fitItems : Number(this.pageSizeChoice);
        },
        totalPages: function(){ return Math.max(1, Math.ceil(this.list.length / this.pageSize)); },
        currentPage: function(){ return Math.max(1, Math.min(this.page, this.totalPages)); },
        pageItems: function(){
            var start = (this.currentPage - 1) * this.pageSize;
            return this.list.slice(start, start + this.pageSize);
        },
        pageNumbers: function(){
            var out = [];
            for(var n = 1; n <= this.totalPages; n++) out.push(n);
            return out;
        },
        pageInfo: function(){
            this.langTick;
            return this.t('paginationPageInfo').replace('{current}', this.currentPage).replace('{total}', this.totalPages);
        },
        // La barra flotant només si el paginador de la llista no es veu.
        showFixed: function(){
            return this.pagerReady && !this.pagerVisible && this.totalPages > 1 && this.list.length > 0;
        }
    },
    methods: {
        pageLabel: function(n){
            return this.t('paginationPageInfo').replace('{current}', n).replace('{total}', this.totalPages);
        },
        measure: function(){
            this.viewH = window.innerHeight;
            var area = document.getElementById('lpArea');
            if(area) this.areaTop = area.getBoundingClientRect().top + window.scrollY;
            var first = area && (area.querySelector('tbody tr') || area.querySelector('.game-card, .hw-item'));
            if(first && first.getBoundingClientRect().height > 0) this.rowPx = first.getBoundingClientRect().height;
            var grid = area && area.querySelector('.game-grid, .hw-list');
            if(grid){
                var cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
                if(cols > 0) this.cols = cols;
            }
            var pager = document.getElementById('lpPager');
            var pagerH = pager ? pager.getBoundingClientRect().height + 14 : 60;
            var head = area && area.querySelector('thead');
            // Relleno i reborde de la targeta que envolta la taula (vista detall).
            var card = area && area.querySelector('.hw-card');
            var cardExtra = 0;
            if(card){ var cs = getComputedStyle(card); cardExtra = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth); }
            this.chromeH = (head ? head.getBoundingClientRect().height : 0) + pagerH + 120 + cardExtra;
        },
        // Observa el paginador de la llista: si surt de la pantalla, es mostra la barra flotant.
        observePager: function(){
            if(typeof IntersectionObserver !== 'function') return;
            var el = document.getElementById('lpPager');
            if(!el) return;
            var self = this;
            if(this.pagerObserver) this.pagerObserver.disconnect();
            this.pagerObserver = new IntersectionObserver(function(entries){
                self.pagerVisible = entries[0].isIntersecting;
                self.pagerReady = true;
            });
            this.pagerObserver.observe(el);
        },
        prevPage: function(){ if(this.currentPage > 1) this.page = this.currentPage - 1; },
        nextPage: function(){ if(this.currentPage < this.totalPages) this.page = this.currentPage + 1; },
        onPage: function(ev){
            var v = parseInt(ev.target.value, 10);
            if(v >= 1 && v <= this.totalPages) this.page = v;
        },
        onPageSize: function(ev){
            var v = ev.target.value;
            if(v !== 'auto' && [6, 12, 24, 48].indexOf(Number(v)) === -1) return;
            this.pageSizeChoice = v;
            this.page = 1;
            eduhootSaveSizeChoice(this.listKey, v);
        },
        setView: function(v){
            this.listView = v;
            this.page = 1;
            eduhootSaveView(this.listKey, v);
            var self = this;
            this.$nextTick(function(){ self.measure(); self.observePager(); });
        },
        setCoverLevel: function(ev){
            var v = Number(ev.target.value);
            if(EDUHOOT_COVER_LEVELS.indexOf(v) === -1) return;
            this.coverLevel = v;
            eduhootSaveCoverLevel(v, !!(this.user));
        },
        coverSrc: function(item){
            return '/api/quizzes/' + encodeURIComponent(item.quizId || '') + '/cover';
        },
        onCoverError: function(ev){
            if(ev.target.getAttribute('src') !== '/icons/logo.svg') ev.target.src = '/icons/logo.svg';
        }
    }
};
