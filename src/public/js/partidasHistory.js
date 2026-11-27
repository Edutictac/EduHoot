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
    de: {
        delete: 'Löschen',
        deleteConfirm: 'Nochmal drücken zum Löschen',
        resultsClose: 'Schließen',
        results: 'Ergebnisse',
        resultsLoading: 'Ergebnisse werden geladen…',
        resultsError: 'Ergebnisse konnten nicht geladen werden.',
        resPlayers: 'Rangliste',
        resQuestions: 'Richtige Antworten pro Frage',
        colPos: 'Pl.',
        colStudent: 'Schüler',
        colPoints: 'Punkte',
        colCorrect: 'Richtig',
        colWrong: 'Falsch',
        colPartial: 'Teilweise',
        colNoAnswer: 'Ohne Antw.',
        colQ: 'Nr.',
        colQText: 'Frage',
        colOkPct: '% richtig',
        title: 'Meine Spiele',
        langLabel: 'Sprache',
        loading: 'Wird geladen…',
        needLogin: 'Melde dich an, um deine Spiele zu sehen.',
        goLogin: 'Zur Anmeldung',
        back: 'Bibliothek',
        myGames: 'Meine Spiele',
        myHomework: 'Meine Hausaufgaben',
        empty: 'Du hast noch kein Spiel beendet. Spiele, die du mit deinem Konto beendest, erscheinen hier 90 Tage lang.',
        colQuiz: 'Quiz',
        colMode: 'Modus',
        colStudents: 'Schüler',
        colFinished: 'Beendet',
        colExpires: 'Läuft ab',
        downloadCsv: 'CSV herunterladen',
        mode_selfPaced: 'Im eigenen Tempo',
        mode_live: 'Live',
        error_load: 'Die Spiele konnten nicht geladen werden.',
        viewLabel: 'Ansicht',
        viewCards: 'Karten',
        viewDetail: 'Liste',
        coverLabel: 'Hintergrundbild',
        coverNone: 'Kein Bild',
        cover10: 'Bild mit 10 %',
        cover20: 'Bild mit 20 %',
        cover30: 'Bild mit 30 %',
        paginationPrev: 'Zurück',
        paginationNext: 'Weiter',
        paginationPageInfo: 'Seite {current} von {total}',
        pageSizeLabel: 'Pro Seite',
        pageSizeAuto: 'An Fenster anpassen'
    },
    it: {
        delete: 'Elimina',
        deleteConfirm: 'Premi di nuovo per eliminare',
        resultsClose: 'Chiudi',
        results: 'Risultati',
        resultsLoading: 'Caricamento dei risultati…',
        resultsError: 'Impossibile caricare i risultati.',
        resPlayers: 'Classifica',
        resQuestions: 'Risposte corrette per domanda',
        colPos: 'Pos.',
        colStudent: 'Studente',
        colPoints: 'Punti',
        colCorrect: 'Corrette',
        colWrong: 'Errate',
        colPartial: 'Parziali',
        colNoAnswer: 'Senza risp.',
        colQ: 'N.',
        colQText: 'Domanda',
        colOkPct: '% corrette',
        title: 'Le mie partite',
        langLabel: 'Lingua',
        loading: 'Caricamento…',
        needLogin: 'Accedi per vedere le tue partite.',
        goLogin: 'Vai all\'accesso',
        back: 'Libreria',
        myGames: 'Le mie partite',
        myHomework: 'I miei compiti',
        empty: 'Non hai ancora terminato nessuna partita. Le partite che termini con il tuo account compaiono qui per 90 giorni.',
        colQuiz: 'Quiz',
        colMode: 'Modalità',
        colStudents: 'Stud.',
        colFinished: 'Terminata',
        colExpires: 'Scade',
        downloadCsv: 'Scarica CSV',
        mode_selfPaced: 'Al proprio ritmo',
        mode_live: 'Dal vivo',
        error_load: 'Impossibile caricare le partite.',
        viewLabel: 'Vista',
        viewCards: 'Schede',
        viewDetail: 'Elenco',
        coverLabel: 'Immagine di sfondo',
        coverNone: 'Nessuna immagine',
        cover10: 'Immagine al 10 %',
        cover20: 'Immagine al 20 %',
        cover30: 'Immagine al 30 %',
        paginationPrev: 'Precedente',
        paginationNext: 'Successivo',
        paginationPageInfo: 'Pagina {current} di {total}',
        pageSizeLabel: 'Per pagina',
        pageSizeAuto: 'Adatta alla finestra'
    },
    pt: {
        delete: 'Eliminar',
        deleteConfirm: 'Prima outra vez para eliminar',
        resultsClose: 'Fechar',
        results: 'Resultados',
        resultsLoading: 'A carregar resultados…',
        resultsError: 'Não foi possível carregar os resultados.',
        resPlayers: 'Classificação',
        resQuestions: 'Respostas certas por pergunta',
        colPos: 'Pos.',
        colStudent: 'Aluno',
        colPoints: 'Pontos',
        colCorrect: 'Certas',
        colWrong: 'Erradas',
        colPartial: 'Parciais',
        colNoAnswer: 'Sem resp.',
        colQ: 'N.º',
        colQText: 'Pergunta',
        colOkPct: '% certas',
        title: 'Os meus jogos',
        langLabel: 'Idioma',
        loading: 'A carregar…',
        needLogin: 'Inicie sessão para ver os seus jogos.',
        goLogin: 'Ir para o início de sessão',
        back: 'Biblioteca',
        myGames: 'Os meus jogos',
        myHomework: 'Os meus trabalhos de casa',
        empty: 'Ainda não terminou nenhum jogo. Os jogos que terminar com a sua conta aparecem aqui durante 90 dias.',
        colQuiz: 'Questionário',
        colMode: 'Modo',
        colStudents: 'Alun.',
        colFinished: 'Terminado',
        colExpires: 'Expira',
        downloadCsv: 'Descarregar CSV',
        mode_selfPaced: 'Ao seu ritmo',
        mode_live: 'Em direto',
        error_load: 'Não foi possível carregar os jogos.',
        viewLabel: 'Vista',
        viewCards: 'Cartões',
        viewDetail: 'Lista',
        coverLabel: 'Imagem de fundo',
        coverNone: 'Sem imagem',
        cover10: 'Imagem a 10 %',
        cover20: 'Imagem a 20 %',
        cover30: 'Imagem a 30 %',
        paginationPrev: 'Anterior',
        paginationNext: 'Seguinte',
        paginationPageInfo: 'Página {current} de {total}',
        pageSizeLabel: 'Por página',
        pageSizeAuto: 'Ajustar à janela'
    },
    bg: {
        delete: 'Изтрий',
        deleteConfirm: 'Натисни пак, за да изтриеш',
        resultsClose: 'Затвори',
        results: 'Резултати',
        resultsLoading: 'Зареждане на резултатите…',
        resultsError: 'Резултатите не можаха да се заредят.',
        resPlayers: 'Класиране',
        resQuestions: 'Верни отговори по въпрос',
        colPos: 'Поз.',
        colStudent: 'Ученик',
        colPoints: 'Точки',
        colCorrect: 'Верни',
        colWrong: 'Грешни',
        colPartial: 'Частични',
        colNoAnswer: 'Без отг.',
        colQ: '№',
        colQText: 'Въпрос',
        colOkPct: '% верни',
        title: 'Моите игри',
        langLabel: 'Език',
        loading: 'Зареждане…',
        needLogin: 'Влез, за да видиш игрите си.',
        goLogin: 'Към влизането',
        back: 'Библиотека',
        myGames: 'Моите игри',
        myHomework: 'Моите домашни',
        empty: 'Още не си завършил игра. Игрите, които завършиш с профила си, се показват тук 90 дни.',
        colQuiz: 'Куиз',
        colMode: 'Режим',
        colStudents: 'Уч.',
        colFinished: 'Приключила',
        colExpires: 'Изтича',
        downloadCsv: 'Изтегли CSV',
        mode_selfPaced: 'В собствен ритъм',
        mode_live: 'На живо',
        error_load: 'Игрите не можаха да се заредят.',
        viewLabel: 'Изглед',
        viewCards: 'Карти',
        viewDetail: 'Списък',
        coverLabel: 'Фоново изображение',
        coverNone: 'Без изображение',
        cover10: 'Изображение 10 %',
        cover20: 'Изображение 20 %',
        cover30: 'Изображение 30 %',
        paginationPrev: 'Назад',
        paginationNext: 'Напред',
        paginationPageInfo: 'Страница {current} от {total}',
        pageSizeLabel: 'На страница',
        pageSizeAuto: 'Побери в прозореца'
    },
    ar: {
        delete: 'حذف',
        deleteConfirm: 'اضغط مرة أخرى للحذف',
        resultsClose: 'إغلاق',
        results: 'النتائج',
        resultsLoading: 'جارٍ تحميل النتائج…',
        resultsError: 'تعذّر تحميل النتائج.',
        resPlayers: 'الترتيب',
        resQuestions: 'الإجابات الصحيحة لكل سؤال',
        colPos: 'المرتبة',
        colStudent: 'التلميذ',
        colPoints: 'النقاط',
        colCorrect: 'الصحيحة',
        colWrong: 'الخاطئة',
        colPartial: 'الجزئية',
        colNoAnswer: 'بلا إجابة',
        colQ: 'رقم',
        colQText: 'السؤال',
        colOkPct: '% الصحيحة',
        title: 'ألعابي',
        langLabel: 'اللغة',
        loading: 'جارٍ التحميل…',
        needLogin: 'سجّل الدخول لرؤية ألعابك.',
        goLogin: 'الذهاب إلى تسجيل الدخول',
        back: 'المكتبة',
        myGames: 'ألعابي',
        myHomework: 'واجباتي',
        empty: 'لم تُنهِ أي لعبة بعد. الألعاب التي تنهيها بحسابك تظهر هنا لمدة 90 يوماً.',
        colQuiz: 'الاختبار',
        colMode: 'النمط',
        colStudents: 'تلام.',
        colFinished: 'انتهت',
        colExpires: 'تنتهي',
        downloadCsv: 'تنزيل CSV',
        mode_selfPaced: 'بالإيقاع الشخصي',
        mode_live: 'مباشر',
        error_load: 'تعذّر تحميل الألعاب.',
        viewLabel: 'العرض',
        viewCards: 'بطاقات',
        viewDetail: 'قائمة',
        coverLabel: 'صورة الخلفية',
        coverNone: 'بدون صورة',
        cover10: 'صورة بنسبة 10 %',
        cover20: 'صورة بنسبة 20 %',
        cover30: 'صورة بنسبة 30 %',
        paginationPrev: 'السابق',
        paginationNext: 'التالي',
        paginationPageInfo: 'الصفحة {current} من {total}',
        pageSizeLabel: 'لكل صفحة',
        pageSizeAuto: 'ملاءمة النافذة'
    },
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
    var chain = lang === 'va' ? ['va', 'ca', 'es'] : [lang, 'en', 'es'];
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
