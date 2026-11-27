// Mis partidas (docente): historial de las partidas acabadas con cuenta (GET /api/partidas, 90 días).
// Vista de tarjetas o detalle, imagen de fondo y paginador compartidos (listPageCommon.js); colores propios.
var lang = EduhootLang.init({ preferKey: 'lang' });

var i18n = {
    es: { delete: 'Borrar', deleteConfirm: 'Pulsa otra vez para borrar', resultsClose: 'Cerrar', results: 'Resultados', resultsLoading: 'Cargando resultados…', resultsError: 'No se pudieron cargar los resultados.', resPlayers: 'Clasificación', resQuestions: 'Aciertos por pregunta', colPos: 'Pos.', colStudent: 'Alumno', colPoints: 'Puntos', colCorrect: 'Aciertos', colWrong: 'Fallos', colPartial: 'Parciales', colNoAnswer: 'Sin resp.', colQ: 'Nº', colQText: 'Pregunta', colOkPct: '% acierto', title: 'Mis partidas', langLabel: 'Idioma', loading: 'Cargando…', needLogin: 'Inicia sesión para ver tus partidas.', goLogin: 'Ir a iniciar sesión',
        back: 'Biblioteca', myGames: 'Mis partidas', myHomework: 'Mis deberes', empty: 'Aún no has terminado ninguna partida. Las partidas que acabes con tu cuenta aparecen aquí durante 90 días.',
        colQuiz: 'Quiz', colMode: 'Modo', colStudents: 'Alum', colFinished: 'Finalizada', colExpires: 'Caduca', downloadCsv: 'Descargar CSV',
        mode_selfPaced: 'A su ritmo', mode_live: 'En directo', error_load: 'No se han podido cargar las partidas.',
        viewLabel: 'Vista', viewCards: 'Tarjetas', viewDetail: 'Lista', coverLabel: 'Imagen de fondo', coverNone: 'Sin imagen', cover10: 'Imagen al 10 %', cover20: 'Imagen al 20 %', cover30: 'Imagen al 30 %',
        paginationPrev: 'Anterior', paginationNext: 'Siguiente', paginationPageInfo: 'Página {current} de {total}', pageSizeLabel: 'Por página', pageSizeAuto: 'Ajustar a la ventana' },
    en: { delete: 'Delete', deleteConfirm: 'Press again to delete', resultsClose: 'Close', results: 'Results', resultsLoading: 'Loading results…', resultsError: 'Could not load the results.', resPlayers: 'Ranking', resQuestions: 'Correct answers per question', colPos: 'Pos.', colStudent: 'Student', colPoints: 'Points', colCorrect: 'Correct', colWrong: 'Wrong', colPartial: 'Partial', colNoAnswer: 'No answer', colQ: 'No.', colQText: 'Question', colOkPct: '% correct', title: 'My games', langLabel: 'Language', loading: 'Loading…', needLogin: 'Sign in to see your games.', goLogin: 'Go to sign in',
        back: 'Library', myGames: 'My games', myHomework: 'My homework', empty: 'You have not finished any game yet. Games you finish with your account appear here for 90 days.',
        colQuiz: 'Quiz', colMode: 'Mode', colStudents: 'Stud', colFinished: 'Finished', colExpires: 'Expires', downloadCsv: 'Download CSV',
        mode_selfPaced: 'Self-paced', mode_live: 'Live', error_load: 'The games could not be loaded.',
        viewLabel: 'View', viewCards: 'Cards', viewDetail: 'List', coverLabel: 'Background image', coverNone: 'No image', cover10: 'Image at 10 %', cover20: 'Image at 20 %', cover30: 'Image at 30 %',
        paginationPrev: 'Previous', paginationNext: 'Next', paginationPageInfo: 'Page {current} of {total}', pageSizeLabel: 'Per page', pageSizeAuto: 'Fit to window' },
    fr: {
        delete: 'Supprimer',
        deleteConfirm: 'Appuie encore pour supprimer',
        resultsClose: 'Fermer',
        results: 'Résultats',
        resultsLoading: 'Chargement des résultats…',
        resultsError: 'Impossible de charger les résultats.',
        resPlayers: 'Classement',
        resQuestions: 'Bonnes réponses par question',
        colPos: 'Pos.',
        colStudent: 'Élève',
        colPoints: 'Points',
        colCorrect: 'Correctes',
        colWrong: 'Fausses',
        colPartial: 'Partielles',
        colNoAnswer: 'Sans rép.',
        colQ: 'N°',
        colQText: 'Question',
        colOkPct: '% réussite',
        title: 'Mes parties',
        langLabel: 'Langue',
        loading: 'Chargement…',
        needLogin: 'Connecte-toi pour voir tes parties.',
        goLogin: 'Aller à la connexion',
        back: 'Bibliothèque',
        myGames: 'Mes parties',
        myHomework: 'Mes devoirs',
        empty: 'Tu n\'as terminé aucune partie. Les parties terminées avec ton compte apparaissent ici pendant 90 jours.',
        colQuiz: 'Quiz',
        colMode: 'Mode',
        colStudents: 'Élèv.',
        colFinished: 'Terminée',
        colExpires: 'Expire',
        downloadCsv: 'Télécharger le CSV',
        mode_selfPaced: 'À son rythme',
        mode_live: 'En direct',
        error_load: 'Impossible de charger les parties.',
        viewLabel: 'Vue',
        viewCards: 'Cartes',
        viewDetail: 'Liste',
        coverLabel: 'Image de fond',
        coverNone: 'Aucune image',
        cover10: 'Image à 10 %',
        cover20: 'Image à 20 %',
        cover30: 'Image à 30 %',
        paginationPrev: 'Précédent',
        paginationNext: 'Suivant',
        paginationPageInfo: 'Page {current} sur {total}',
        pageSizeLabel: 'Par page',
        pageSizeAuto: 'Adapter à la fenêtre'
    },
    ca: { delete: 'Esborrar', deleteConfirm: 'Torna a premre per a esborrar', resultsClose: 'Tancar', results: 'Resultats', resultsLoading: 'Carregant resultats…', resultsError: 'No s\'han pogut carregar els resultats.', resPlayers: 'Classificació', resQuestions: 'Encerts per pregunta', colPos: 'Pos.', colStudent: 'Alumne', colPoints: 'Punts', colCorrect: 'Encerts', colWrong: 'Errors', colPartial: 'Parcials', colNoAnswer: 'Sense resp.', colQ: 'Nº', colQText: 'Pregunta', colOkPct: '% encert', title: 'Les meves partides', langLabel: 'Idioma', loading: 'Carregant…', needLogin: 'Inicia sessió per a veure les teues partides.', goLogin: 'Anar a iniciar sessió',
        back: 'Biblioteca', myGames: 'Mis partidas', myHomework: 'Els meus deures', empty: 'Encara no has acabat cap partida. Les partides que acabes amb el teu compte apareixen ací durant 90 dies.',
        colQuiz: 'Quiz', colMode: 'Mode', colStudents: 'Alum', colFinished: 'Finalitzada', colExpires: 'Caduca', downloadCsv: 'Descarregar CSV',
        mode_selfPaced: 'Al seu ritme', mode_live: 'En directe', error_load: 'No s\'han pogut carregar les partides.',
        viewLabel: 'Vista', viewCards: 'Targetes', viewDetail: 'Llista', coverLabel: 'Imatge de fons', coverNone: 'Sense imatge', cover10: 'Imatge al 10 %', cover20: 'Imatge al 20 %', cover30: 'Imatge al 30 %',
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
    mixins: [EduhootListMixin],
    data: function(){
        return {
            listKey: 'partidas', loading: true, user: null, list: [], error: '', langTick: 0,
            results: null, resultsGame: '', resultsLoading: false, resultsError: '', deleting: '',
            listView: eduhootReadView('partidas'), pageSizeChoice: eduhootReadSizeChoice('partidas'), coverLevel: eduhootReadCoverLevel()
        };
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
        dateText: function(iso){
            if(!iso) return '—';
            var d = new Date(iso);
            if(isNaN(d.getTime())) return '—';
            return d.toLocaleString(lang === 'va' ? 'ca' : lang, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        },
        // Resultats d'una partida: classificació i aciertos per pregunta (com a Mis deberes).
        openResults: function(g){
            var self = this;
            this.resultsGame = g.quizName || '';
            this.results = null;
            this.resultsError = '';
            this.resultsLoading = true;
            fetch('/api/partidas/' + encodeURIComponent(g.id) + '/results', { credentials: 'include' })
                .then(function(res){ if(!res.ok) throw new Error('results'); return res.json(); })
                .then(function(data){ self.results = data; })
                .catch(function(){ self.resultsError = 'error'; })
                .then(function(){
                    self.resultsLoading = false;
                    self.$nextTick(function(){
                        var el = document.getElementById('ptResults');
                        if(el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                });
        },
        closeResults: function(){ this.results = null; this.resultsError = ''; },
        // Esborrar una partida: primer clic demana confirmació (4 s), el segon l'esborra.
        askDelete: function(g){
            var self = this;
            if(this.deleting !== g.id){
                this.deleting = g.id;
                clearTimeout(deleteTimer);
                deleteTimer = setTimeout(function(){ self.deleting = ''; }, 4000);
                return;
            }
            this.deleting = '';
            fetch('/api/partidas/' + encodeURIComponent(g.id), { method: 'DELETE', credentials: 'include' })
                .then(function(res){ if(!res.ok) throw new Error('delete'); return res.json(); })
                .then(function(){
                    self.list = self.list.filter(function(x){ return x.id !== g.id; });
                    if(self.results && self.results.id === g.id) self.closeResults();
                })
                .catch(function(){ self.error = 'error_delete'; });
        },
        // Percentatge d'aciertos sobre les respostes de la pregunta (les enquestes no compten).
        pct: function(q){
            var total = q.correct + q.partial + q.wrong + q.unanswered;
            return total ? Math.round(100 * q.correct / total) + '%' : '—';
        },
        // La portada és la del quiz de la partida (si ja no existeix, el logo).
        coverSrc: function(g){
            return '/api/quizzes/' + encodeURIComponent(g.quizId || '') + '/cover';
        }
    }
}).mount('#pt-app');

var deleteTimer = null;

function bindLangSelect(){
    var select = document.getElementById('lang-select');
    if(!select || select.__bound) return;
    select.__bound = true;
    EduhootLang.render();
    select.value = lang;
    select.addEventListener('change', function(){ EduhootLang.persist(select.value); window.location.reload(); });
}
