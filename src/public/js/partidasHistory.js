// Mis partidas (docente): historial de las partidas acabadas con cuenta (GET /api/partidas, 90 días).
// Mismo patrón que homeworkManage.js: sesión con /api/auth/me y textos propios por idioma.
// La tabla cabe en la ventana: sin scroll interno; el número de filas sale del alto disponible
// (o se elige a mano) y el resto se pasa con el paginador, como en la biblioteca.
var lang = EduhootLang.init({ preferKey: 'lang' });

var PT_SIZE_KEY = 'eduhoot-partidas-page-size';
var PT_SIZES = [5, 10, 20];
var PT_ROW_PX = 52;     // altura fija de cada fila (partidas.css)
var PT_CHROME_PX = 260; // cabecera de la tarjeta, paginador, pie de página y márgenes que quedan debajo de la tabla

function readSizeChoice(){
    try{
        var v = localStorage.getItem(PT_SIZE_KEY) || 'auto';
        if(v === 'auto' || PT_SIZES.indexOf(Number(v)) !== -1) return v;
    }catch(e){}
    return 'auto';
}

var i18n = {
    es: { title: 'Mis partidas', langLabel: 'Idioma', loading: 'Cargando…', needLogin: 'Inicia sesión para ver tus partidas.', goLogin: 'Ir a iniciar sesión',
        myHomework: 'Mis deberes', empty: 'Aún no has terminado ninguna partida. Las partidas que acabes con tu cuenta aparecen aquí durante 90 días.',
        colQuiz: 'Quiz', colMode: 'Modo', colStudents: 'Alumnos', colFinished: 'Finalizada', colExpires: 'Caduca', downloadCsv: 'Descargar CSV',
        mode_selfPaced: 'A su ritmo', mode_live: 'En directo', error_load: 'No se han podido cargar las partidas.',
        paginationPrev: 'Anterior', paginationNext: 'Siguiente', paginationPageInfo: 'Página {current} de {total}', pageSizeLabel: 'Por página', pageSizeAuto: 'Ajustar a la ventana' },
    en: { title: 'My games', langLabel: 'Language', loading: 'Loading…', needLogin: 'Sign in to see your games.', goLogin: 'Go to sign in',
        myHomework: 'My homework', empty: 'You have not finished any game yet. Games you finish with your account appear here for 90 days.',
        colQuiz: 'Quiz', colMode: 'Mode', colStudents: 'Students', colFinished: 'Finished', colExpires: 'Expires', downloadCsv: 'Download CSV',
        mode_selfPaced: 'Self-paced', mode_live: 'Live', error_load: 'The games could not be loaded.',
        paginationPrev: 'Previous', paginationNext: 'Next', paginationPageInfo: 'Page {current} of {total}', pageSizeLabel: 'Per page', pageSizeAuto: 'Fit to window' },
    ca: { title: 'Les meves partides', langLabel: 'Idioma', loading: 'Carregant…', needLogin: 'Inicia sessió per a veure les teues partides.', goLogin: 'Anar a iniciar sessió',
        myHomework: 'Els meus deures', empty: 'Encara no has acabat cap partida. Les partides que acabes amb el teu compte apareixen ací durant 90 dies.',
        colQuiz: 'Quiz', colMode: 'Mode', colStudents: 'Alumnat', colFinished: 'Finalitzada', colExpires: 'Caduca', downloadCsv: 'Descarregar CSV',
        mode_selfPaced: 'Al seu ritme', mode_live: 'En directe', error_load: 'No s\'han pogut carregar les partides.',
        paginationPrev: 'Anterior', paginationNext: 'Següent', paginationPageInfo: 'Pàgina {current} de {total}', pageSizeLabel: 'Per pàgina', pageSizeAuto: 'Ajustar a la finestra' }
};

function t(key){
    var chain = lang === 'va' ? ['va', 'ca', 'es'] : [lang, 'es'];
    for(var i = 0; i < chain.length; i++){
        var d = i18n[chain[i]];
        if(d && d[key]) return d[key];
    }
    return key;
}

var app = Vue.createApp({
    template: '#pt-tpl',
    data: function(){
        return {
            loading: true, user: null, list: [], error: '', langTick: 0,
            page: 1, pageSizeChoice: readSizeChoice(),
            viewH: window.innerHeight, areaTop: 0, rowPx: PT_ROW_PX, chromeH: PT_CHROME_PX,
            pagerVisible: true, pagerReady: false
        };
    },
    computed: {
        sizes: function(){ return PT_SIZES; },
        // La barra flotante solo si el paginador de la lista está fuera de la vista.
        showFixed: function(){
            return this.pagerReady && !this.pagerVisible && !!this.user && this.list.length > 0 && this.totalPages > 1;
        },
        // Filas que caben entre la tabla y el borde inferior de la ventana.
        fitRows: function(){
            var avail = this.viewH - this.areaTop - this.chromeH;
            return Math.max(2, Math.min(40, Math.floor(avail / this.rowPx)));
        },
        pageSize: function(){
            return this.pageSizeChoice === 'auto' ? this.fitRows : Number(this.pageSizeChoice);
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
            return t('paginationPageInfo').replace('{current}', this.currentPage).replace('{total}', this.totalPages);
        }
    },
    mounted: function(){
        var self = this;
        EduhootLang.render();
        window.addEventListener('resize', function(){ self.measure(); });
        fetch('/api/auth/me', { credentials: 'include' })
            .then(function(res){ return res.ok ? res.json() : null; })
            .then(function(user){
                self.user = user;
                if(!user) return null;
                return fetch('/api/partidas', { credentials: 'include' })
                    .then(function(res){ if(!res.ok) throw new Error('load'); return res.json(); })
                    .then(function(list){ self.list = Array.isArray(list) ? list : []; });
            })
            .catch(function(){ self.error = 'error_load'; })
            .then(function(){
                self.loading = false;
                self.$nextTick(function(){ self.measure(); bindLangSelect(); self.observePager(); });
            });
    },
    methods: {
        t: function(key){ this.langTick; return t(key); },
        pageLabel: function(n){ return t('paginationPageInfo').replace('{current}', n).replace('{total}', this.totalPages); },
        measure: function(){
            this.viewH = window.innerHeight;
            var el = document.getElementById('ptTableArea') || document.getElementById('ptList');
            if(el) this.areaTop = el.getBoundingClientRect().top + window.scrollY;
            // Alçada real d'una fila (en estret cada partida ocupa més) i de la capçalera i el paginador.
            var tr = document.querySelector('#ptGames tbody tr');
            if(tr && tr.getBoundingClientRect().height > 0) this.rowPx = tr.getBoundingClientRect().height;
            var thead = document.querySelector('#ptGames thead');
            var headH = thead ? thead.getBoundingClientRect().height : 0;
            var pager = document.getElementById('ptPager');
            var pagerH = pager ? pager.getBoundingClientRect().height + 14 : 60;
            this.chromeH = headH + pagerH + 110;
        },
        // Observa el paginador de la lista: si sale de la pantalla, se muestra la barra flotante.
        observePager: function(){
            if(typeof IntersectionObserver !== 'function' || !this.$refs.pager) return;
            var self = this;
            if(this.pagerObserver) this.pagerObserver.disconnect();
            this.pagerObserver = new IntersectionObserver(function(entries){
                self.pagerVisible = entries[0].isIntersecting;
                self.pagerReady = true;
            });
            this.pagerObserver.observe(this.$refs.pager);
        },
        prevPage: function(){ if(this.currentPage > 1) this.page = this.currentPage - 1; },
        nextPage: function(){ if(this.currentPage < this.totalPages) this.page = this.currentPage + 1; },
        onPage: function(ev){
            var v = parseInt(ev.target.value, 10);
            if(v >= 1 && v <= this.totalPages) this.page = v;
        },
        onPageSize: function(ev){
            var v = ev.target.value;
            if(v !== 'auto' && PT_SIZES.indexOf(Number(v)) === -1) return;
            this.pageSizeChoice = v;
            this.page = 1;
            try{ localStorage.setItem(PT_SIZE_KEY, v); }catch(e){}
        },
        dateText: function(iso){
            if(!iso) return '—';
            var d = new Date(iso);
            if(isNaN(d.getTime())) return '—';
            return d.toLocaleString(lang === 'va' ? 'ca' : lang, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
    }
}).mount('#pt-app');

function bindLangSelect(){
    var select = document.getElementById('lang-select');
    if(!select || select.__bound) return;
    select.__bound = true;
    EduhootLang.render();
    select.value = lang;
    select.addEventListener('change', function(){ EduhootLang.persist(select.value); window.location.reload(); });
}
