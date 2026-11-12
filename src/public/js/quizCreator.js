var socket = null;
try{
    if(typeof io !== 'undefined'){
        socket = io();
    }
}catch(e){
    socket = null;
}
// Estado reactivo: las tarjetas de preguntas y el idioma de la interfaz.
var questionCards = Vue.reactive([]);
var nextQuestionUid = 1;
var editingId = null;
var ui = Vue.reactive({ lang: EduhootLang.init() });
// Datos del quiz (panel «Configuración») y estado de la sesión. La plantilla
// de Vue los lee y los escribe directamente (Subfase B, bloque 2).
var form = Vue.reactive({ name: '', tags: '', visibility: 'private', allowClone: false, language: '', license: '', description: '' });
var session = Vue.reactive({ authenticated: false, knownTags: [] });
function getAnonOwnerToken(){
    var key = 'anonOwnerToken';
    var existing = localStorage.getItem(key);
    if(existing) return existing;
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    var token = Array.from(arr).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
    localStorage.setItem(key, token);
    return token;
}

function rememberClaimableQuizId(id){
    if(id === undefined || id === null || session.authenticated) return;
    try{
        var stored = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
        var idText = String(id);
        var exists = stored.some(function(x){ return String(x) === idText; });
        if(!exists){
            stored.push(id);
            localStorage.setItem('localQuizzes', JSON.stringify(stored));
        }
    }catch(e){}
}

var i18n = {
    es: {
        back: 'Volver',
        title: 'Creador de quizzes',
        subtitle: 'Diseña las preguntas y guarda tu juego para lanzarlo cuando quieras.',
        langLabel: 'Idioma',
        configEyebrow: 'Configuración',
        configTitle: 'Datos del quiz',
        configDesc: 'Ponle un nombre para identificarlo en la biblioteca.',
        quizTitle: 'Título del quiz',
        tagsLabel: 'Etiquetas (separadas por comas)',
        visibilityLabel: 'Visibilidad del quiz',
        visibilityPrivate: 'Solo yo (privado)',
        visibilityUnlisted: 'Por enlace/ID',
        visibilityPublic: 'Público en la biblioteca',
        publicWarning: 'Al publicar el quiz se guardará como parte de la biblioteca global y no podrás editarlo después sin sesión.',
        allowCloneLabel: 'Permitir copia',
        languageLabel: 'Idioma del contenido (opcional)',
        licenseLabel: 'Licencia (opcional)',
        descriptionLabel: 'Descripción (opcional)',
        suggestedTags: 'Etiquetas usadas (toca para añadir)',
        questionsEyebrow: 'Preguntas',
        questionsTitle: 'Construye las preguntas',
        questionsDesc: 'Añade respuestas y elige el modo de cada pregunta.',
        addQuestion: '+ Añadir pregunta',
        btnSave: 'Guardar quiz',
        btnPlayLocal: 'Jugar sin guardar',
        btnCancel: 'Cancelar y volver',
        localInfo: 'Sin sesión: “Guardar” o “Jugar sin guardar” crean un quiz anónimo. Si es Solo yo caduca en 24h; Por enlace/Público se guarda globalmente. Con sesión se guarda en tu usuario.',
        questionLabel: 'Enunciado',
        answerLabel: 'Respuesta',
        correctLabel: 'Respuesta correcta (1-4)',
        questionTypeLabel: 'Modo de pregunta',
        questionTypeSingle: 'Quiz (1 correcta)',
        questionTypeMultiple: 'Respuesta múltiple',
        questionTypeTf: 'Verdadero / Falso',
        questionTypeShort: 'Respuesta corta',
        questionTypeNumeric: 'Numérica',
        questionTypePoll: 'Encuesta (sin puntuación)',
        questionTypeMultiHint: 'Marca todas las respuestas correctas.',
        questionTimeLabel: 'Tiempo límite (segundos)',
        shortAnswersLabel: 'Respuestas válidas (separadas por |)',
        numericAnswerLabel: 'Respuesta numérica',
        numericToleranceLabel: 'Tolerancia (±)',
        imageLabel: 'Imagen (URL opcional)',
        videoLabel: 'Video (URL opcional)',
        namePlaceholder: 'Ej: Repaso de energía',
        tagsPlaceholder: 'ej: física, 2ºESO, energía',
        languagePlaceholder: 'ej: español, català, english',
        licensePlaceholder: 'ej: CC BY-SA 4.0',
        descriptionPlaceholder: 'Breve descripción del quiz',
        urlPlaceholder: 'https://...',
        playErrorName: 'Ponle un nombre',
        playErrorTags: 'Añade al menos una etiqueta',
        playErrorQuestions: 'Añade preguntas',
        loadError: 'No se pudo cargar el quiz.',
        saveError: 'No se pudo guardar el quiz.',
        saveOk: 'Quiz actualizado',
        confirmCancel: '¿Seguro que quieres salir? Se perderán los cambios.',
    },
    en: {
        back: 'Back',
        title: 'Quiz builder',
        subtitle: 'Design questions and save your game to launch whenever you want.',
        langLabel: 'Language',
        configEyebrow: 'Settings',
        configTitle: 'Quiz data',
        configDesc: 'Give it a name to identify it in the library.',
        quizTitle: 'Quiz title',
        tagsLabel: 'Tags (comma separated)',
        visibilityLabel: 'Quiz visibility',
        visibilityPrivate: 'Only me (private)',
        visibilityUnlisted: 'By link/ID',
        visibilityPublic: 'Public in library',
        publicWarning: 'Public quizzes become part of the global library and cannot be edited later unless you sign in.',
        allowCloneLabel: 'Allow copy',
        languageLabel: 'Content language (optional)',
        licenseLabel: 'License (optional)',
        descriptionLabel: 'Description (optional)',
        suggestedTags: 'Suggested tags (tap to add)',
        questionsEyebrow: 'Questions',
        questionsTitle: 'Build the questions',
        questionsDesc: 'Add answers and choose a mode for each question.',
        addQuestion: '+ Add question',
        btnSave: 'Save quiz',
        btnPlayLocal: 'Play without saving',
        btnCancel: 'Cancel and go back',
        localInfo: 'Without session: “Save” or “Play without saving” create an anonymous quiz. "Only me" expires in 24h; "By link/Public" is stored globally. With session, it is saved to your user.',
        questionLabel: 'Question',
        answerLabel: 'Answer',
        correctLabel: 'Correct answer (1-4)',
        questionTypeLabel: 'Question mode',
        questionTypeSingle: 'Quiz (1 correct)',
        questionTypeMultiple: 'Multiple answers',
        questionTypeTf: 'True / False',
        questionTypeShort: 'Short answer',
        questionTypeNumeric: 'Numeric',
        questionTypePoll: 'Poll (unscored)',
        questionTypeMultiHint: 'Check every answer that counts.',
        questionTimeLabel: 'Time limit (seconds)',
        shortAnswersLabel: 'Accepted answers (separated by |)',
        numericAnswerLabel: 'Numeric answer',
        numericToleranceLabel: 'Tolerance (±)',
        imageLabel: 'Image (optional URL)',
        videoLabel: 'Video (optional URL)',
        namePlaceholder: 'e.g. Energy review',
        tagsPlaceholder: 'e.g. physics, grade8, energy',
        languagePlaceholder: 'e.g. english, español, català',
        licensePlaceholder: 'e.g. CC BY-SA 4.0',
        descriptionPlaceholder: 'Brief description of the quiz',
        urlPlaceholder: 'https://...',
        playErrorName: 'Give it a name',
        playErrorTags: 'Add at least one tag',
        playErrorQuestions: 'Add questions',
        loadError: 'Could not load quiz.',
        saveError: 'Could not save quiz.',
        saveOk: 'Quiz updated',
        confirmCancel: 'Are you sure? Changes will be lost.',
    },
    ca: {
        back: 'Tornar',
        title: 'Creador de quizzes',
        subtitle: 'Dissenya les preguntes i desa el joc per llançar-lo quan vulguis.',
        langLabel: 'Idioma',
        configEyebrow: 'Configuració',
        configTitle: 'Dades del quiz',
        configDesc: 'Posa-li un nom per identificar-lo a la biblioteca.',
        quizTitle: 'Títol del quiz',
        tagsLabel: 'Etiquetes (separades per comes)',
        visibilityLabel: 'Visibilitat del quiz',
        visibilityPrivate: 'Només jo (privat)',
        visibilityUnlisted: 'Per enllaç/ID',
        visibilityPublic: 'Públic a la biblioteca',
        publicWarning: 'Els quizzes públics passen a formar part de la biblioteca global i no es poden editar després sense iniciar sessió.',
        allowCloneLabel: 'Permetre còpia',
        languageLabel: 'Idioma del contingut (opcional)',
        licenseLabel: 'Llicència (opcional)',
        descriptionLabel: 'Descripció (opcional)',
        suggestedTags: 'Etiquetes usades (toca per afegir)',
        questionsEyebrow: 'Preguntes',
        questionsTitle: 'Construeix les preguntes',
        questionsDesc: 'Afegeix respostes i tria el mode de cada pregunta.',
        addQuestion: '+ Afegir pregunta',
        btnSave: 'Desar quiz',
        btnPlayLocal: 'Jugar sense desar',
        btnCancel: 'Cancel·lar i tornar',
        localInfo: 'Sense sessió: “Desar” o “Jugar sense desar” creen un quiz anònim. "Només jo" caduca en 24h; "Per enllaç/Públic" es guarda globalment. Amb sessió, queda al teu usuari.',
        questionLabel: 'Enunciat',
        answerLabel: 'Resposta',
        correctLabel: 'Resposta correcta (1-4)',
        questionTypeLabel: 'Mode de pregunta',
        questionTypeSingle: 'Quiz (1 correcta)',
        questionTypeMultiple: 'Resposta múltiple',
        questionTypeTf: 'Cert / Fals',
        questionTypeShort: 'Resposta curta',
        questionTypeNumeric: 'Numèrica',
        questionTypePoll: 'Enquesta (sense puntuació)',
        questionTypeMultiHint: 'Marca totes les respostes correctes.',
        questionTimeLabel: 'Temps límit (segons)',
        shortAnswersLabel: 'Respostes vàlides (separades per |)',
        numericAnswerLabel: 'Resposta numèrica',
        numericToleranceLabel: 'Tolerància (±)',
        imageLabel: 'Imatge (URL opcional)',
        videoLabel: 'Vídeo (URL opcional)',
        namePlaceholder: 'Ex: Repàs d\'energia',
        tagsPlaceholder: 'ex: física, 2nESO, energia',
        languagePlaceholder: 'ex: català, español, english',
        licensePlaceholder: 'ex: CC BY-SA 4.0',
        descriptionPlaceholder: 'Breu descripció del quiz',
        urlPlaceholder: 'https://...',
        playErrorName: 'Posa-li un nom',
        playErrorTags: 'Afegeix almenys una etiqueta',
        playErrorQuestions: 'Afegeix preguntes',
        loadError: 'No s\'ha pogut carregar el quiz.',
        saveError: 'No s\'ha pogut desar el quiz.',
        saveOk: 'Quiz actualitzat',
        confirmCancel: 'Segur que vols sortir? Es perdran els canvis.',
    },
    va: {
        subtitle: 'Dissenya les preguntes i guarda el joc per llançar-lo quan vulgues.',
        btnSave: 'Guardar quiz',
        btnPlayLocal: 'Jugar sense guardar',
        localInfo: 'Sense sessió: “Guardar” o “Jugar sense guardar” creen un quiz anònim. "Només jo" caduca en 24h; "Per enllaç/Públic" es guarda globalment. Amb sessió, queda al teu usuari.',
        confirmCancel: 'Segur que vols eixir? Es perdran els canvis.',
    }
};

function t(key){
    var chain = ui.lang === 'va' ? ['va', 'ca', 'es'] : [ui.lang, 'es'];
    for(var i = 0; i < chain.length; i++){
        var dict = i18n[chain[i]];
        if(dict && dict[key]) return dict[key];
    }
    return key;
}

// Solo traduce lo que queda fuera de la app de Vue (cabecera y subtítulo);
// dentro, la plantilla usa t() y se repinta sola al cambiar ui.lang.
function applyI18n(){
    document.querySelectorAll('[data-i18n]').forEach(function(el){
        if(el.closest('#creator-app')) return;
        var key = el.getAttribute('data-i18n');
        if(key === 'subtitle'){
            el.innerHTML = t(key);
        }else{
            el.textContent = t(key);
        }
    });
    var langSelect = document.getElementById('lang-select');
    if(langSelect) langSelect.value = ui.lang;
}

function updateTitleUserId(name){
    var base = document.title.replace(/ \[[^\]]*\]$/, '');
    document.title = name ? (base + ' [' + name + ']') : base;
}

function refreshAuthStatus(){
    fetch('/api/auth/me', { credentials: 'include' })
        .then(function(res){
            if(!res.ok) throw new Error();
            return res.json();
        })
        .then(function(user){
            session.authenticated = true;
            updateTitleUserId(user && (user.nickname || user.email));
        })
        .catch(function(){
            session.authenticated = false;
            updateTitleUserId(null);
        });
}

function updateDatabase(){
    var quiz = buildQuizPayload();
    quiz.id = editingId || 0;
    if(!validateQuizBasics(quiz)){
        return;
    }

    if(editingId){
        saveExistingQuiz(editingId, quiz);
        return;
    }

    // Si no hay sesión, guarda local y lanza
    fetch('/api/auth/me', { credentials: 'include' })
        .then(function(res){
            if(!res.ok) throw new Error();
            return res.json();
        })
        .then(function(){
            if(socket){
                socket.emit('newQuiz', quiz);
            }else{
                alert('No se pudo conectar con el servidor en tiempo real. Recarga la página e inténtalo de nuevo.');
            }
        })
        .catch(function(){
            saveLocal();
        });
}

function buildQuizPayload(){
    var questions = [];
    var name = form.name;
    var tags = parseTagsInput();
    var visibility = form.visibility || 'private';
    var allowClone = !!form.allowClone;
    var language = form.language.trim();
    var license = form.license.trim();
    var description = form.description.trim();
    questionCards.forEach(function(card){
        var question = card.question;
        var correct = card.correct;
        var shortText = card.short;
        var numText = card.num;
        var tolText = card.tol;
        var timeText = card.time;
        var image = card.image;
        var video = card.video;
        var questionType = card.type || 'quiz';
        var correctValues = [];
        if(questionType === 'multiple'){
            card.multi.forEach(function(checked, idx){
                if(checked) correctValues.push(idx + 1);
            });
        }
        if(!correctValues.length && questionType !== 'poll'){
            var single = parseInt(correct, 10);
            if(Number.isNaN(single) || single < 1 || single > 4){
                single = 1;
            }
            correctValues.push(single);
        }
        var answers = card.answers.slice();
        var time = parseInt(timeText, 10);
        if(Number.isNaN(time) || time < 5) time = 20;
        if(time > 120) time = 120;

        function splitAccepted(raw){
            var s = (raw || '').toString().trim();
            if(!s) return [];
            var parts = s.split(/[|\n]+/g);
            var out = [];
            var seen = {};
            parts.forEach(function(p){
                p.split(',').forEach(function(pp){
                    var clean = (pp || '').toString().trim();
                    if(!clean) return;
                    var key = clean.toLowerCase();
                    if(seen[key]) return;
                    seen[key] = true;
                    out.push(clean);
                });
            });
            return out;
        }

        function parseLenientNumber(v){
            if(v === undefined || v === null) return null;
            var raw = String(v).trim();
            if(!raw) return null;
            raw = raw.replace(/\s+/g, '').replace(',', '.');
            var n = parseFloat(raw);
            return isFinite(n) ? n : null;
        }

        var base = {
            "question": question,
            "answers": answers,
            "correct": correctValues[0],
            "correctAnswers": correctValues,
            "type": questionType,
            "time": time,
            "image": image,
            "video": video
        };

        if(questionType === 'poll') base.correctAnswers = [];

        if(questionType === 'short-answer'){
            base.answers = ['', '', '', ''];
            base.correct = 1;
            base.correctAnswers = [1];
            base.acceptedAnswers = splitAccepted(shortText);
        }

        if(questionType === 'numeric'){
            base.answers = ['', '', '', ''];
            base.correct = 1;
            base.correctAnswers = [1];
            base.numericAnswer = parseLenientNumber(numText);
            var tol = parseLenientNumber(tolText);
            base.tolerance = (tol === null ? 0 : tol);
        }

        questions.push(base);
    });
    return {
        name: name,
        tags: tags,
        visibility: visibility,
        allowClone: allowClone,
        language: language,
        license: license,
        description: description,
        questions: questions
    };
}

function validateQuizBasics(quiz){
    if(!quiz.name || !quiz.name.trim()){
        alert(t('playErrorName'));
        return false;
    }
    if(!quiz.tags || !quiz.tags.length){
        alert(t('playErrorTags'));
        return false;
    }
    if(!quiz.questions.length){
        alert(t('playErrorQuestions'));
        return false;
    }
    return true;
}

async function saveLocal(){
    var quiz = buildQuizPayload();
    if(!validateQuizBasics(quiz)){
        return;
    }
    try{
        var res = await fetch('/api/quizzes/local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: quiz.name,
                questions: quiz.questions,
                tags: quiz.tags,
                visibility: quiz.visibility,
                allowClone: quiz.allowClone,
                language: quiz.language,
                license: quiz.license,
                description: quiz.description,
                ownerToken: getAnonOwnerToken()
            })
        });
        var body = await res.json();
        if(!res.ok){
            alert(body.error || t('saveError'));
            return;
        }
        rememberClaimableQuizId(body.id);
        window.location.href = '../../host/?id=' + body.id;
    }catch(err){
        alert(t('saveError'));
    }
}

function normalizeSvgDataUrlForImg(url){
    if(!url) return url;
    var raw = String(url).trim();
    if(!raw) return raw;
    var lower = raw.toLowerCase();
    if(!lower.startsWith('data:image/svg+xml')) return raw;
    var comma = raw.indexOf(',');
    if(comma === -1) return raw;
    var header = raw.slice(0, comma + 1);
    var payload = raw.slice(comma + 1);
    if(!payload) return raw;
    if(/;base64/i.test(header)) return raw;

    // Ya URL-encoded: recortar cualquier sufijo tras </svg>
    if(/%[0-9a-fA-F]{2}/.test(payload)){
        var lp = payload.toLowerCase();
        var endEnc = '%3c%2fsvg%3e';
        var posEnc = lp.lastIndexOf(endEnc);
        if(posEnc !== -1) return header + payload.slice(0, posEnc + endEnc.length);
        return raw;
    }

    // Raw: recortar tras </svg> y URL-encode
    var lpr = payload.toLowerCase();
    var endRaw = '</svg>';
    var posRaw = lpr.lastIndexOf(endRaw);
    if(posRaw !== -1){
        payload = payload.slice(0, posRaw + endRaw.length);
    }
    if(payload.indexOf('<') !== -1 || payload.indexOf('#') !== -1 || payload.indexOf('"') !== -1 || payload.indexOf("'") !== -1){
        return header + encodeURIComponent(payload);
    }
    return raw;
}

// Tarjetas de preguntas (Subfase B, bloque 1). Cada tarjeta es un objeto de
// questionCards y la plantilla #creator-tpl lo pinta; buildQuizPayload lee
// de aquí, no del DOM. Los campos de texto se guardan como texto, igual que
// los valores de los <input> de antes.
function clampTime(value){
    var time = Number(value);
    if(!Number.isFinite(time) || time < 5) return 20;
    if(time > 120) return 120;
    return Math.round(time);
}

// Lo que antes hacía refreshTypeDependent al cambiar de tipo: V/F solo usa
// dos respuestas y respuesta corta/numérica ninguna.
function applyTypeRules(card){
    if(card.type === 'true-false'){
        card.answers[2] = '';
        card.answers[3] = '';
    }
    if(card.type === 'short-answer' || card.type === 'numeric'){
        card.answers = ['', '', '', ''];
    }
}

function makeQuestionCard(data){
    data = data || {};
    var correctAnswers = Array.isArray(data.correctAnswers) ? data.correctAnswers : [];
    var card = {
        uid: nextQuestionUid++,
        question: data.question || '',
        type: data.type || 'quiz',
        answers: [0, 1, 2, 3].map(function(i){ return (data.answers && data.answers[i]) || ''; }),
        multi: [1, 2, 3, 4].map(function(n){ return correctAnswers.indexOf(n) !== -1; }),
        correct: correctAnswers.length ? correctAnswers[0] : (data.correct || 1),
        time: String(clampTime(data.time)),
        short: Array.isArray(data.acceptedAnswers) ? data.acceptedAnswers.join('|') : '',
        num: (data.numericAnswer !== undefined && data.numericAnswer !== null) ? String(data.numericAnswer) : '',
        tol: (data.tolerance !== undefined && data.tolerance !== null) ? String(data.tolerance) : '0',
        image: data.image || '',
        video: data.video || '',
        imageOk: false,
        videoOk: false
    };
    applyTypeRules(card);
    return card;
}

function parseYouTubeId(url){
    if(!url) return null;
    try{
        var u = new URL(url);
        if(u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')){
            if(u.hostname.includes('youtu.be')){
                return u.pathname.replace('/','');
            }
            if(u.searchParams.get('v')) return u.searchParams.get('v');
            var parts = u.pathname.split('/');
            var last = parts[parts.length-1];
            if(last) return last;
        }
    }catch(e){}
    return null;
}

function addQuestion(prefill){
    questionCards.push(makeQuestionCard(prefill));
    Vue.nextTick(function(){
        var fields = document.querySelectorAll('#allQuestions .question');
        if(fields.length) fields[fields.length - 1].focus();
    });
}

Vue.createApp({
    template: '#creator-tpl',
    data: function(){
        return {
            cards: questionCards,
            ui: ui,
            form: form,
            session: session,
            typeOptions: [
                ['quiz', 'questionTypeSingle'], ['multiple', 'questionTypeMultiple'],
                ['true-false', 'questionTypeTf'], ['short-answer', 'questionTypeShort'],
                ['numeric', 'questionTypeNumeric'], ['poll', 'questionTypePoll']
            ]
        };
    },
    computed: {
        showPublicWarning: function(){
            return !this.session.authenticated && this.form.visibility !== 'private';
        },
        selectedTags: function(){
            return parseTagsInput();
        }
    },
    methods: {
        t: function(key){
            return t(key);
        },
        addTag: addTagToInput,
        addQuestion: function(){ addQuestion(); },
        save: function(){ updateDatabase(); },
        playLocal: function(){ saveLocal(); },
        cancel: function(){ cancelQuiz(); },
        pillText: function(num){
            return (this.ui.lang === 'en' ? 'Question ' : 'Pregunta ') + num;
        },
        removeCard: function(index){
            var l = this.ui.lang;
            var msg = l === 'en' ? 'Delete this question?' : (l === 'va' ? 'Eliminar esta pregunta?' : (l === 'ca' ? 'Eliminar aquesta pregunta?' : '¿Eliminar esta pregunta?'));
            if(window.confirm(msg)){
                this.cards.splice(index, 1);
            }
        },
        onTypeChange: function(card){
            applyTypeRules(card);
        },
        showCorrect: function(card){
            return ['multiple', 'short-answer', 'numeric', 'poll'].indexOf(card.type) === -1;
        },
        imageSrc: function(card){
            var url = (card.image || '').trim();
            // Misma normalización que en el juego: un SVG en data URL con #,
            // comillas o markup sin codificar rompe el src.
            return url ? normalizeSvgDataUrlForImg(url) : null;
        },
        youTubeEmbed: function(card){
            var id = parseYouTubeId((card.video || '').trim());
            return id ? 'https://www.youtube-nocookie.com/embed/' + id : null;
        },
        videoSrc: function(card){
            var url = (card.video || '').trim();
            return (url && !parseYouTubeId(url)) ? url : null;
        },
        onImageInput: function(card){
            if(!(card.image || '').trim()) card.imageOk = false;
        },
        onVideoInput: function(card){
            if(!(card.video || '').trim() || parseYouTubeId(card.video.trim())) card.videoOk = false;
        }
    }
}).mount('#creator-app');

//Called when user wants to exit quiz creator
function cancelQuiz(){
    if (confirm(t('confirmCancel'))) {
        window.location.href = "../";
    }
}

if(socket){
    socket.on('startGameFromCreator', function(data){
        window.location.href = "../../host/?id=" + data;
    });

    socket.on('quizValidationError', function(payload){
        var message = payload && payload.error ? payload.error : t('saveError');
        alert(message);
    });
}

async function saveExistingQuiz(id, quiz){
    try{
        var headers = { 'Content-Type': 'application/json' };
        try{
            var token = localStorage.getItem('anonOwnerToken');
            if(token) headers['X-Owner-Token'] = token;
        }catch(e){}
        var res = await fetch('/api/quizzes/' + id, {
            method: 'PUT',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify({
                name: quiz.name,
                questions: quiz.questions,
                tags: quiz.tags,
                visibility: quiz.visibility,
                allowClone: quiz.allowClone,
                language: quiz.language,
                license: quiz.license,
                description: quiz.description
            })
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('saveError'));
            return;
        }
        alert(t('saveOk'));
        window.location.href = '../';
    }catch(err){
        alert(t('saveError'));
    }
}

async function loadQuiz(id){
    try{
        var res = await fetch('/api/quizzes/' + id, { credentials: 'include' });
        var quiz = await res.json();
        if(!res.ok){
            alert(quiz.error || t('loadError'));
            return;
        }
        editingId = quiz.id;
        form.name = quiz.name || '';
        form.tags = (quiz.tags && quiz.tags.length) ? quiz.tags.join(', ') : form.tags;
        form.visibility = quiz.visibility || 'public';
        form.allowClone = !!quiz.allowClone;
        form.language = quiz.language || '';
        form.license = quiz.license || '';
        form.description = quiz.description || '';
        questionCards.splice(0);
        (quiz.questions || []).forEach(function(q){
            addQuestion(q);
        });
        if(questionCards.length === 0){
            addQuestion();
        }
        var subtitle = document.getElementById('subtitle');
        if(subtitle){
            subtitle.textContent = 'Editando quiz ID ' + id;
        }
    }catch(err){
        alert('No se pudo cargar el quiz.');
    }
}

function initQuizCreator(){
    addQuestion();
    var params = new URLSearchParams(window.location.search);
    var idParam = params.get('id');
    if(idParam){
        loadQuiz(idParam);
    }
}

initQuizCreator();
fetchKnownTags();

function parseTagsInput(){
    var raw = form.tags;
    if(!raw) return [];
    return raw.split(',').map(function(t){ return t.trim().toLowerCase(); }).filter(function(t){ return t.length; });
}

function addTagToInput(tag){
    var tags = parseTagsInput();
    if(tags.indexOf(tag) !== -1) return;
    tags.push(tag);
    form.tags = tags.join(', ');
}

function fetchKnownTags(){
    return fetch('/api/tags', { credentials: 'include' })
        .then(function(res){ return res.json(); })
        .then(function(data){
            session.knownTags = Array.isArray(data.tags) ? data.tags : [];
        })
        .catch(function(){
            session.knownTags = [];
        });
}

var langSelector = document.getElementById('lang-select');
if(langSelector){
    langSelector.value = ui.lang;
    langSelector.addEventListener('change', function(){
        ui.lang = langSelector.value;
        EduhootLang.persist(ui.lang);
        applyI18n();
    });
}
applyI18n();
refreshAuthStatus();
