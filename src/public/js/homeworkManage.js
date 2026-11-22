// Deures asíncrons, lado del docente (feature 1): crear un deber desde un quiz (?quiz=ID), ver los
// suyos y consultar resultados (?code=). La API está en server/routes/homework.js.
var lang = EduhootLang.init({ preferKey: 'lang' });
var params = new URLSearchParams(window.location.search);

var i18n = {
    es: { title: 'Mis deberes', langLabel: 'Idioma', back: 'Biblioteca', loading: 'Cargando…', needLogin: 'Inicia sesión para gestionar deberes.', goLogin: 'Ir a iniciar sesión',
        newTitle: 'Nuevo deber', quizLabel: 'Quiz', fTitle: 'Título', fDeadline: 'Fecha límite', fAttempts: 'Intentos por alumno', attempts1: '1 (un solo intento)', attemptsUnlimited: 'Ilimitados', fScoring: 'Puntuación con varios intentos', scoringBest: 'Cuenta el mejor intento', scoringAverage: 'Cuenta la media de los intentos', colAvg: 'Puntuación media', myHomeworkLink: 'Mis deberes',
        fTime: 'Tiempo por pregunta', timeQuiz: 'El de cada pregunta', fShowAnswers: 'Mostrar la respuesta correcta tras contestar', fShuffle: 'Barajar las respuestas', create: 'Crear deber',
        createdTitle: 'Deber creado', createdText: 'Comparte este enlace con tu alumnado. Entran con un nombre y reciben un código para continuar desde otro dispositivo.', code: 'Código', copyLink: 'Copiar enlace', copied: '¡Copiado!',
        myHomework: 'Mis deberes', empty: 'Aún no has creado ningún deber. Crea uno desde la biblioteca con el botón 📚.', results: 'Resultados', close: 'Cerrar', reopen: 'Reabrir', reopenOk: 'Reabrir con esta fecha', newDeadline: 'Nueva fecha límite',
        delete: 'Eliminar', deleteConfirm: '¿Seguro? Se borran los resultados', status_open: 'Abierto', status_closed: 'Cerrado', status_expired: 'Vencido', deadlineAt: 'Límite: {d}', studentsN: '{n} alumnos', finishedN: '{n} intentos terminados',
        downloadCsv: 'Descargar CSV', refresh: 'Actualizar', noStudents: 'Todavía no ha entrado nadie.', colName: 'Alumno', colState: 'Estado', colAttempts: 'Intentos', colBest: 'Mejor puntuación', colCorrect: 'Aciertos', byQuestion: 'Por pregunta', colQuestion: 'Pregunta', colOk: 'Aciertos',
        state_finished: 'Terminado', 'state_in-progress': 'En curso', 'state_not-started': 'Sin empezar', state_expired: 'Sin terminar (plazo vencido)',
        err_deadline_too_soon: 'La fecha límite debe ser al menos 1 minuto posterior a ahora.', err_deadline_too_far: 'La fecha límite no puede superar los 30 días.', err_bad_attempts: 'Número de intentos no válido.', err_no_questions: 'Este quiz no tiene preguntas válidas.', err_quiz_not_found: 'No se encuentra el quiz.', err_generic: 'No se ha podido completar la acción.', err_bad_deadline: 'Fecha límite no válida.' },
    ca: { title: 'Els meus deures', langLabel: 'Idioma', back: "Biblioteca", loading: 'Carregant…', needLogin: 'Inicia sessió per a gestionar deures.', goLogin: 'Anar a iniciar sessió',
        newTitle: 'Nou deure', quizLabel: 'Quiz', fTitle: 'Títol', fDeadline: 'Data límit', fAttempts: 'Intents per alumne', attempts1: '1 (un sol intent)', attemptsUnlimited: 'Il·limitats', fScoring: 'Puntuació amb diversos intents', scoringBest: 'Compta el millor intent', scoringAverage: 'Compta la mitjana dels intents', colAvg: 'Puntuació mitjana', myHomeworkLink: 'Els meus deures',
        fTime: 'Temps per pregunta', timeQuiz: 'El de cada pregunta', fShowAnswers: 'Mostrar la resposta correcta després de contestar', fShuffle: 'Barrejar les respostes', create: 'Crear deure',
        createdTitle: 'Deure creat', createdText: 'Comparteix este enllaç amb el teu alumnat. Entren amb un nom i reben un codi per a continuar des d\'un altre dispositiu.', code: 'Codi', copyLink: 'Copiar enllaç', copied: 'Copiat!',
        myHomework: 'Els meus deures', empty: 'Encara no has creat cap deure. Crea\'n un des de la biblioteca amb el botó 📚.', results: 'Resultats', close: 'Tancar', reopen: 'Reobrir', reopenOk: 'Reobrir amb esta data', newDeadline: 'Nova data límit',
        delete: 'Eliminar', deleteConfirm: 'Segur? S\'esborren els resultats', status_open: 'Obert', status_closed: 'Tancat', status_expired: 'Vençut', deadlineAt: 'Límit: {d}', studentsN: '{n} alumnes', finishedN: '{n} intents acabats',
        downloadCsv: 'Descarregar CSV', refresh: 'Actualitzar', noStudents: 'Encara no ha entrat ningú.', colName: 'Alumne', colState: 'Estat', colAttempts: 'Intents', colBest: 'Millor puntuació', colCorrect: 'Encerts', byQuestion: 'Per pregunta', colQuestion: 'Pregunta', colOk: 'Encerts',
        state_finished: 'Acabat', 'state_in-progress': 'En curs', 'state_not-started': 'Sense començar', state_expired: 'Sense acabar (termini vençut)',
        err_deadline_too_soon: 'La data límit ha de ser com a mínim 1 minut posterior a ara.', err_deadline_too_far: 'La data límit no pot superar els 30 dies.', err_bad_attempts: 'Nombre d\'intents no vàlid.', err_no_questions: 'Este quiz no té preguntes vàlides.', err_quiz_not_found: 'No es troba el quiz.', err_generic: 'No s\'ha pogut completar l\'acció.', err_bad_deadline: 'Data límit no vàlida.' },
    en: { title: 'My homework', langLabel: 'Language', back: 'Library', loading: 'Loading…', needLogin: 'Sign in to manage homework.', goLogin: 'Go to sign in',
        newTitle: 'New homework', quizLabel: 'Quiz', fTitle: 'Title', fDeadline: 'Deadline', fAttempts: 'Attempts per student', attempts1: '1 (single attempt)', attemptsUnlimited: 'Unlimited', fScoring: 'Scoring with several attempts', scoringBest: 'Best attempt counts', scoringAverage: 'Average of the attempts counts', colAvg: 'Average score', myHomeworkLink: 'My homework',
        fTime: 'Time per question', timeQuiz: 'Each question\'s own', fShowAnswers: 'Show the correct answer after answering', fShuffle: 'Shuffle the answers', create: 'Create homework',
        createdTitle: 'Homework created', createdText: 'Share this link with your students. They join with a name and get a code to continue from another device.', code: 'Code', copyLink: 'Copy link', copied: 'Copied!',
        myHomework: 'My homework', empty: 'You have not created any homework yet. Create one from the library with the 📚 button.', results: 'Results', close: 'Close', reopen: 'Reopen', reopenOk: 'Reopen with this date', newDeadline: 'New deadline',
        delete: 'Delete', deleteConfirm: 'Sure? Results are deleted', status_open: 'Open', status_closed: 'Closed', status_expired: 'Expired', deadlineAt: 'Deadline: {d}', studentsN: '{n} students', finishedN: '{n} finished attempts',
        downloadCsv: 'Download CSV', refresh: 'Refresh', noStudents: 'Nobody has joined yet.', colName: 'Student', colState: 'Status', colAttempts: 'Attempts', colBest: 'Best score', colCorrect: 'Correct', byQuestion: 'By question', colQuestion: 'Question', colOk: 'Correct',
        state_finished: 'Finished', 'state_in-progress': 'In progress', 'state_not-started': 'Not started', state_expired: 'Unfinished (deadline passed)',
        err_deadline_too_soon: 'The deadline must be at least 1 minute from now.', err_deadline_too_far: 'The deadline cannot be more than 30 days away.', err_bad_attempts: 'Invalid number of attempts.', err_no_questions: 'This quiz has no valid questions.', err_quiz_not_found: 'Quiz not found.', err_generic: 'The action could not be completed.', err_bad_deadline: 'Invalid deadline.' }
};
function t(key){
    var chain = lang === 'va' ? ['va', 'ca', 'es'] : [lang, 'es'];
    for(var i = 0; i < chain.length; i++){
        var d = i18n[chain[i]];
        if(d && d[key]) return d[key];
    }
    return key;
}
function fmt(key, vars){
    return t(key).replace(/\{(\w+)\}/g, function(_, k){ return String(vars[k]); });
}
document.documentElement.setAttribute('lang', lang);
(function(){ var b = document.getElementById('back'); if(b) b.textContent = t('back'); })();

function pad(n){ return n < 10 ? '0' + n : String(n); }
// Valor de <input type="datetime-local"> a partir de una fecha (hora local, sin segundos).
function toLocalInput(ms){
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
function defaultDeadline(){
    var d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    d.setHours(23, 59, 0, 0);
    return toLocalInput(d.getTime());
}
function errKey(code){ return 'err_' + String(code || 'generic').replace(/-/g, '_'); }

var copyTimer = null;
var deleteTimer = null;

var app = Vue.createApp({
    template: '#hw-tpl',
    data: function(){
        var quizId = params.get('quiz');
        var code = params.get('code');
        return {
            loading: true, user: null, langTick: 0,
            view: quizId ? 'new' : (code ? 'results' : 'list'),
            quizId: quizId, quizName: '', code: code,
            form: { title: '', deadline: defaultDeadline(), maxAttempts: '1', attemptScoring: 'best', timePerQuestion: '', showCorrectAnswers: true, randomAnswers: true },
            created: null, busy: false, error: '', copied: '',
            list: [], results: null, deleting: '', reopening: '', newDeadline: '',
            sortKey: '', sortDir: 1,
            sortCols: [{ key: 'name', label: 'colName' }, { key: 'state', label: 'colState' }, { key: 'attempts', label: 'colAttempts' }, { key: 'bestScore', label: 'colBest' }, { key: 'correctCount', label: 'colCorrect' }]
        };
    },
    computed: {
        // Orden por columna al pulsar el encabezado (sin orden = el del servidor).
        sortedRows: function(){
            var rows = this.results ? this.results.rows.slice() : [];
            var key = this.sortKey;
            if(!key) return rows;
            var dir = this.sortDir;
            return rows.sort(function(a, b){
                var x = a[key], y = b[key];
                if(typeof x === 'string') return x.localeCompare(y, lang) * dir;
                return ((x || 0) - (y || 0)) * dir;
            });
        }
    },
    mounted: function(){
        var self = this;
        EduhootLang.render();
        fetch('/api/auth/me', { credentials: 'include' })
            .then(function(res){ return res.ok ? res.json() : null; })
            .then(function(user){ self.user = user; return user ? self.load() : null; })
            .catch(function(){ self.user = null; })
            .then(function(){ self.loading = false; self.$nextTick(bindLangSelect); });
    },
    methods: {
        t: function(key){ this.langTick; return t(key); },
        fmt: fmt,
        // Con la media, la columna de puntuación pasa a llamarse «Puntuación media».
        colLabel: function(c){
            return c.key === 'bestScore' && this.results && this.results.homework.scoring === 'average' ? 'colAvg' : c.label;
        },
        sortBy: function(key){
            if(this.sortKey === key) this.sortDir = -this.sortDir;
            else { this.sortKey = key; this.sortDir = 1; }
        },
        plain: function(html){ var d = document.createElement('div'); d.innerHTML = String(html || '').replace(/<br\s*\/?>/gi, ' '); return d.textContent || ''; },
        linkOf: function(h){ return window.location.origin + '/homework/?code=' + h.code; },
        stateOf: function(h){
            if(h.status === 'closed') return 'closed';
            return h.deadline < Date.now() ? 'expired' : 'open';
        },
        statusText: function(h){ return t('status_' + this.stateOf(h)); },
        deadlineText: function(h){
            return fmt('deadlineAt', { d: new Date(h.deadline).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }) });
        },
        load: function(){
            if(this.view === 'new') return this.loadQuiz();
            if(this.view === 'results') return this.loadResults();
            return this.loadList();
        },
        loadQuiz: function(){
            var self = this;
            return fetch('/api/quizzes/' + encodeURIComponent(this.quizId), { credentials: 'include' })
                .then(function(res){ return res.ok ? res.json() : null; })
                .then(function(q){ if(q){ self.quizName = q.name || ''; if(!self.form.title) self.form.title = q.name || ''; } });
        },
        loadList: function(){
            var self = this;
            return fetch('/api/homeworks', { credentials: 'include' }).then(function(res){ return res.ok ? res.json() : []; })
                .then(function(list){ self.list = list; });
        },
        loadResults: function(){
            var self = this;
            return fetch('/api/homeworks/' + encodeURIComponent(this.code) + '/results', { credentials: 'include' })
                .then(function(res){ if(!res.ok) throw new Error('x'); return res.json(); })
                .then(function(r){ self.results = r; self.error = ''; })
                .catch(function(){ self.error = 'err_generic'; self.view = 'list'; return self.loadList(); });
        },
        create: function(){
            var self = this;
            var f = this.form;
            var deadline = new Date(f.deadline).getTime();
            if(!isFinite(deadline)){ this.error = 'err_bad_deadline'; return; }
            this.busy = true;
            this.error = '';
            var options = { showCorrectAnswers: !!f.showCorrectAnswers, randomAnswers: !!f.randomAnswers };
            if(Number(f.maxAttempts) !== 1) options.attemptScoring = f.attemptScoring === 'average' ? 'average' : 'best';
            if(f.timePerQuestion) options.timePerQuestion = Number(f.timePerQuestion);
            fetch('/api/homeworks', {
                method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quizId: this.quizId, title: f.title, deadline: deadline, maxAttempts: Number(f.maxAttempts), options: options })
            }).then(function(res){ return res.json().then(function(b){ return { ok: res.ok, body: b }; }); })
            .then(function(r){
                self.busy = false;
                if(!r.ok){ self.error = errKey(r.body.error); return; }
                self.created = r.body.homework;
            }).catch(function(){ self.busy = false; self.error = 'err_generic'; });
        },
        copy: function(h){
            var self = this;
            var link = this.linkOf(h);
            var done = function(){ self.copied = h.code; clearTimeout(copyTimer); copyTimer = setTimeout(function(){ self.copied = ''; }, 2000); };
            if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(link).then(done, done); }
            else done();
        },
        patch: function(h, body){
            var self = this;
            return fetch('/api/homeworks/' + encodeURIComponent(h.code), {
                method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
            }).then(function(res){ return res.json().then(function(b){ return { ok: res.ok, body: b }; }); })
            .then(function(r){ self.error = r.ok ? '' : errKey(r.body.error); return self.loadList(); });
        },
        setStatus: function(h, status){ return this.patch(h, { status: status }); },
        reopen: function(h){
            // Cerrado a mano con plazo vigente: basta reabrir. Vencido: hay que fijar una fecha nueva.
            if(h.deadline > Date.now()) return this.patch(h, { status: 'open' });
            this.reopening = h.code;
            this.newDeadline = defaultDeadline();
        },
        confirmReopen: function(h){
            var ms = new Date(this.newDeadline).getTime();
            this.reopening = '';
            return this.patch(h, { deadline: ms });
        },
        askDelete: function(h){
            var self = this;
            if(this.deleting !== h.code){
                this.deleting = h.code;
                clearTimeout(deleteTimer);
                deleteTimer = setTimeout(function(){ self.deleting = ''; }, 4000);
                return;
            }
            this.deleting = '';
            fetch('/api/homeworks/' + encodeURIComponent(h.code), { method: 'DELETE', credentials: 'include' })
                .then(function(){ return self.loadList(); });
        }
    }
}).mount('#hw-app');

function bindLangSelect(){
    var select = document.getElementById('lang-select');
    if(!select || select.__bound) return;
    select.__bound = true;
    EduhootLang.render();
    select.value = lang;
    select.addEventListener('change', function(){ EduhootLang.persist(select.value); window.location.reload(); });
}
