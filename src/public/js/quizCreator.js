var socket = null;
try{
    if(typeof io !== 'undefined'){
        socket = io();
    }
}catch(e){
    socket = null;
}
var questionNum = 0; // Se incrementa cuando se añaden tarjetas
var editingId = null;
var lang = EduhootLang.init();
var knownTags = [];
var isUserAuthenticated = false;
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
    if(id === undefined || id === null || isUserAuthenticated) return;
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
    var chain = lang === 'va' ? ['va', 'ca', 'es'] : [lang, 'es'];
    for(var i = 0; i < chain.length; i++){
        var dict = i18n[chain[i]];
        if(dict && dict[key]) return dict[key];
    }
    return key;
}

function applyI18n(){
    document.querySelectorAll('[data-i18n]').forEach(function(el){
        var key = el.getAttribute('data-i18n');
        // skip labels with form controls to avoid hiding inputs
        if(el.tagName === 'LABEL' && el.querySelector('input,select,textarea,textarea')){
            return;
        }
        if(key === 'subtitle' || key === 'localInfo'){
            el.innerHTML = t(key);
        }else{
            el.textContent = t(key);
        }
    });
    var nameInput = document.getElementById('name');
    if(nameInput) nameInput.placeholder = t('namePlaceholder');
    var tagsInput = document.getElementById('tags');
    if(tagsInput) tagsInput.placeholder = t('tagsPlaceholder');
    var languageInput = document.getElementById('language');
    if(languageInput) languageInput.placeholder = t('languagePlaceholder');
    var licenseInput = document.getElementById('license');
    if(licenseInput) licenseInput.placeholder = t('licensePlaceholder');
    var descriptionInput = document.getElementById('description');
    if(descriptionInput) descriptionInput.placeholder = t('descriptionPlaceholder');
    var langSelect = document.getElementById('lang-select');
    if(langSelect) langSelect.value = lang;
    renderTagSuggestions();
}

function updateVisibilityWarning(){
    var warning = document.getElementById('public-warning');
    if(!warning) return;
    var visibilitySelect = document.getElementById('visibility');
    var show = false;
    if(visibilitySelect){
        var value = visibilitySelect.value;
        show = !isUserAuthenticated && value && value !== 'private';
    }
    warning.classList.toggle('hidden', !show);
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
            isUserAuthenticated = true;
            updateVisibilityWarning();
            updateTitleUserId(user && (user.nickname || user.email));
        })
        .catch(function(){
            isUserAuthenticated = false;
            updateVisibilityWarning();
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
    var name = document.getElementById('name').value;
    var tags = parseTagsInput();
    var visibility = document.getElementById('visibility') ? document.getElementById('visibility').value : 'private';
    var allowClone = document.getElementById('allow-clone') ? document.getElementById('allow-clone').checked : false;
    var language = document.getElementById('language') ? document.getElementById('language').value.trim() : '';
    var license = document.getElementById('license') ? document.getElementById('license').value.trim() : '';
    var description = document.getElementById('description') ? document.getElementById('description').value.trim() : '';
    for(var i = 1; i <= questionNum; i++){
        var question = document.getElementById('q' + i).value;
        var answer1 = document.getElementById(i + 'a1').value;
        var answer2 = document.getElementById(i + 'a2').value;
        var answer3 = document.getElementById(i + 'a3').value;
        var answer4 = document.getElementById(i + 'a4').value;
        var correct = document.getElementById('correct' + i).value;
        var shortText = document.getElementById('short' + i) ? document.getElementById('short' + i).value : '';
        var numText = document.getElementById('num' + i) ? document.getElementById('num' + i).value : '';
        var tolText = document.getElementById('tol' + i) ? document.getElementById('tol' + i).value : '';
        var timeText = document.getElementById('time' + i) ? document.getElementById('time' + i).value : '';
        var image = document.getElementById('img' + i) ? document.getElementById('img' + i).value : '';
        var video = document.getElementById('vid' + i) ? document.getElementById('vid' + i).value : '';
        var card = document.querySelector('.question-card[data-question="' + i + '"]');
        var typeEl = document.getElementById('type' + i);
        var questionType = typeEl ? typeEl.value : 'quiz';
        var correctValues = [];
        if(questionType === 'multiple' && card){
            var checkboxes = card.querySelectorAll('.multi-correct input[type="checkbox"]');
            checkboxes.forEach(function(cb){
                if(cb.checked){
                    var val = parseInt(cb.value, 10);
                    if(!Number.isNaN(val)){
                        correctValues.push(val);
                    }
                }
            });
        }
        if(!correctValues.length && questionType !== 'poll'){
            var single = parseInt(correct, 10);
            if(Number.isNaN(single) || single < 1 || single > 4){
                single = 1;
            }
            correctValues.push(single);
        }
        var answers = [answer1, answer2, answer3, answer4];
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
    }
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

function buildQuestionCard(num, data){
    var card = document.createElement('div');
    card.className = 'question-card';
    card.setAttribute('data-question', String(num));

    var head = document.createElement('div');
    head.className = 'question-card-head';
    var pill = document.createElement('span');
    pill.className = 'pill pill-muted';
    pill.textContent = (lang === 'en' ? 'Question ' : (lang === 'ca' ? 'Pregunta ' : 'Pregunta ')) + String(num);
    head.appendChild(pill);
    var removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-ghost btn-small';
    removeBtn.type = 'button';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Eliminar';
    removeBtn.onclick = function(){
        var confirmMsg = lang === 'en' ? 'Delete this question?' : (lang === 'va' ? 'Eliminar esta pregunta?' : (lang === 'ca' ? 'Eliminar aquesta pregunta?' : '¿Eliminar esta pregunta?'));
        if(window.confirm(confirmMsg)){
            card.remove();
            renumberQuestions();
        }
    };
    head.appendChild(removeBtn);

    var questionLabel = document.createElement('label');
    questionLabel.textContent = t('questionLabel');
    var questionField = document.createElement('textarea');
    questionField.className = 'question';
    questionField.id = 'q' + String(num);
    questionField.rows = 3;
    questionField.placeholder = '?';
    questionField.value = (data && data.question) || '';

    var typeRow = document.createElement('div');
    typeRow.className = 'question-type-row';
    var typeLabel = document.createElement('label');
    typeLabel.textContent = t('questionTypeLabel');
    var typeSelect = document.createElement('select');
    typeSelect.className = 'question-type';
    typeSelect.id = 'type' + String(num);
    [['quiz', 'questionTypeSingle'], ['multiple', 'questionTypeMultiple'], ['true-false', 'questionTypeTf'], ['short-answer', 'questionTypeShort'], ['numeric', 'questionTypeNumeric'], ['poll', 'questionTypePoll']].forEach(function(pair){
        var option = document.createElement('option');
        option.value = pair[0];
        option.textContent = t(pair[1]);
        typeSelect.appendChild(option);
    });
    typeRow.appendChild(typeLabel);
    typeRow.appendChild(typeSelect);

    var answersWrap = document.createElement('div');
    answersWrap.className = 'answers';
    var answerGroups = [];
    for(var n = 1; n <= 4; n++){
        var answerLabel = document.createElement('label');
        answerLabel.textContent = t('answerLabel') + ' ' + n;
        var answerField = document.createElement('input');
        answerField.id = String(num) + 'a' + n;
        answerField.type = 'text';
        answerField.placeholder = t('answerLabel') + ' ' + n;
        var ans = data && data.answers && data.answers[n-1];
        answerField.value = ans || '';
        answerLabel.appendChild(answerField);
        answersWrap.appendChild(answerLabel);
        answerGroups.push({ label: answerLabel, input: answerField });
    }

    var multiCorrect = document.createElement('div');
    multiCorrect.className = 'multi-correct hidden';
    var multiHint = document.createElement('p');
    multiHint.className = 'multi-correct__hint';
    multiHint.textContent = t('questionTypeMultiHint');
    multiCorrect.appendChild(multiHint);
    var multiCheckboxes = [];
    for(var m = 1; m <= 4; m++){
        var multiLabel = document.createElement('label');
        multiLabel.className = 'multi-correct__label';
        var multiInput = document.createElement('input');
        multiInput.type = 'checkbox';
        multiInput.value = String(m);
        multiInput.dataset.answer = String(m);
        multiLabel.appendChild(multiInput);
        multiLabel.append(' ' + t('answerLabel') + ' ' + m);
        multiCorrect.appendChild(multiLabel);
        multiCheckboxes.push(multiInput);
    }

    var correctLabel = document.createElement('label');
    correctLabel.textContent = t('correctLabel');
    var correctField = document.createElement('input');
    correctField.className = 'correct';
    correctField.id = 'correct' + String(num);
    correctField.type = 'number';
    correctField.min = '1';
    correctField.max = '4';
    var providedCorrect = (data && Array.isArray(data.correctAnswers) && data.correctAnswers.length)
        ? data.correctAnswers[0]
        : ((data && data.correct) ? data.correct : 1);
    correctField.value = providedCorrect;

    var timeLabel = document.createElement('label');
    timeLabel.textContent = t('questionTimeLabel');
    var timeField = document.createElement('input');
    timeField.className = 'question-time';
    timeField.id = 'time' + String(num);
    timeField.type = 'number';
    timeField.min = '5';
    timeField.max = '120';
    timeField.step = '1';
    var providedTime = data && Number(data.time);
    if(!Number.isFinite(providedTime) || providedTime < 5){
        providedTime = 20;
    }else if(providedTime > 120){
        providedTime = 120;
    }
    timeField.value = String(Math.round(providedTime));
    timeLabel.appendChild(timeField);

    var shortLabel = document.createElement('label');
    shortLabel.textContent = t('shortAnswersLabel');
    var shortField = document.createElement('input');
    shortField.id = 'short' + String(num);
    shortField.type = 'text';
    shortField.placeholder = 'madrid|barcelona';
    shortField.value = (data && Array.isArray(data.acceptedAnswers)) ? data.acceptedAnswers.join('|') : '';
    shortLabel.appendChild(shortField);

    var numLabel = document.createElement('label');
    numLabel.textContent = t('numericAnswerLabel');
    var numField = document.createElement('input');
    numField.id = 'num' + String(num);
    numField.type = 'text';
    numField.placeholder = '3,14';
    numField.value = (data && data.numericAnswer !== undefined && data.numericAnswer !== null) ? String(data.numericAnswer) : '';
    numLabel.appendChild(numField);

    var tolLabel = document.createElement('label');
    tolLabel.textContent = t('numericToleranceLabel');
    var tolField = document.createElement('input');
    tolField.id = 'tol' + String(num);
    tolField.type = 'text';
    tolField.placeholder = '0,1';
    tolField.value = (data && data.tolerance !== undefined && data.tolerance !== null) ? String(data.tolerance) : '0';
    tolLabel.appendChild(tolField);

    var initialType = (data && data.type) ? data.type : 'quiz';
    typeSelect.value = initialType;
    var initialCorrectAnswers = data && Array.isArray(data.correctAnswers) ? data.correctAnswers : [];
    multiCheckboxes.forEach(function(cb){
        cb.checked = initialCorrectAnswers.indexOf(parseInt(cb.value, 10)) !== -1;
    });
    function refreshTypeDependent(){
        var currentType = typeSelect.value;
        var showMultiple = currentType === 'multiple';
        var showTf = currentType === 'true-false';
        var showShort = currentType === 'short-answer';
        var showNumeric = currentType === 'numeric';
        var showPoll = currentType === 'poll';
        multiCorrect.classList.toggle('hidden', !showMultiple);
        correctLabel.style.display = (showMultiple || showShort || showNumeric || showPoll) ? 'none' : '';
        correctField.style.display = (showMultiple || showShort || showNumeric || showPoll) ? 'none' : '';

        answersWrap.style.display = (showShort || showNumeric) ? 'none' : '';

        shortLabel.style.display = showShort ? '' : 'none';
        numLabel.style.display = showNumeric ? '' : 'none';
        tolLabel.style.display = showNumeric ? '' : 'none';

        answerGroups.forEach(function(group, idx){
            if(showTf && idx >= 2){
                group.label.style.display = 'none';
                group.input.value = '';
            }else{
                group.label.style.display = '';
            }
        });

        if(showShort || showNumeric){
            answerGroups.forEach(function(group){ group.input.value = ''; });
        }
    }
    typeSelect.addEventListener('change', refreshTypeDependent);
    refreshTypeDependent();

    var imageLabel = document.createElement('label');
    imageLabel.textContent = t('imageLabel');
    var imageField = document.createElement('input');
    imageField.id = 'img' + String(num);
    imageField.type = 'text';
    imageField.placeholder = t('urlPlaceholder');
    imageField.value = (data && data.image) || '';

    var imagePreview = document.createElement('div');
    imagePreview.className = 'image-preview';
    var imageTag = document.createElement('img');
    imageTag.alt = 'Vista previa';
    imageTag.className = 'image-thumb hidden';
    imagePreview.appendChild(imageTag);

    var videoLabel = document.createElement('label');
    videoLabel.textContent = t('videoLabel');
    var videoField = document.createElement('input');
    videoField.id = 'vid' + String(num);
    videoField.type = 'text';
    videoField.placeholder = t('urlPlaceholder');
    videoField.value = (data && data.video) || '';
    var videoPreview = document.createElement('div');
    videoPreview.className = 'video-preview';
    var videoTag = document.createElement('video');
    videoTag.controls = true;
    videoTag.className = 'video-thumb hidden';
    var videoFrame = document.createElement('iframe');
    videoFrame.className = 'video-thumb hidden';
    videoFrame.allowFullscreen = true;
    videoFrame.loading = 'lazy';
    videoPreview.appendChild(videoTag);
    videoPreview.appendChild(videoFrame);

    imageField.addEventListener('input', function(){
        updateImagePreview(imageField, imageTag);
    });
    // set initial preview
    updateImagePreview(imageField, imageTag);
    videoField.addEventListener('input', function(){
        updateVideoPreview(videoField, videoTag, videoFrame);
    });
    updateVideoPreview(videoField, videoTag, videoFrame);

    card.appendChild(head);
    card.appendChild(questionLabel);
    card.appendChild(questionField);
    card.appendChild(typeRow);
    card.appendChild(answersWrap);
    card.appendChild(multiCorrect);
    card.appendChild(correctLabel);
    card.appendChild(correctField);
    card.appendChild(timeLabel);
    card.appendChild(shortLabel);
    card.appendChild(numLabel);
    card.appendChild(tolLabel);
    card.appendChild(imageLabel);
    card.appendChild(imageField);
    card.appendChild(imagePreview);
    card.appendChild(videoLabel);
    card.appendChild(videoField);
    card.appendChild(videoPreview);

    return card;
}

function updateImagePreview(inputEl, imgEl){
    if(!inputEl || !imgEl) return;
    var url = (inputEl.value || '').trim();
    if(!url){
        imgEl.classList.add('hidden');
        imgEl.src = '';
        return;
    }
    // Usar la misma normalización que en la exportación y el juego. Los SVG
    // introducidos como data URL pueden contener #, comillas o markup sin
    // codificar, lo que rompe el atributo src si se asignan directamente.
    imgEl.src = normalizeSvgDataUrlForImg(url);
    imgEl.onload = function(){ imgEl.classList.remove('hidden'); };
    imgEl.onerror = function(){ imgEl.classList.add('hidden'); };
}

function updateVideoPreview(inputEl, videoEl, iframeEl){
    if(!inputEl || !videoEl) return;
    var url = (inputEl.value || '').trim();
    if(!url){
        videoEl.classList.add('hidden');
        videoEl.removeAttribute('src');
        videoEl.load();
        if(iframeEl){
            iframeEl.classList.add('hidden');
            iframeEl.removeAttribute('src');
        }
        return;
    }
    var ytId = parseYouTubeId(url);
    if(ytId && iframeEl){
        videoEl.classList.add('hidden');
        videoEl.removeAttribute('src');
        videoEl.pause();
        iframeEl.src = 'https://www.youtube-nocookie.com/embed/' + ytId;
        iframeEl.classList.remove('hidden');
    }else{
        if(iframeEl){
            iframeEl.classList.add('hidden');
            iframeEl.removeAttribute('src');
        }
        videoEl.src = url;
        videoEl.load();
        videoEl.onloadeddata = function(){ videoEl.classList.remove('hidden'); };
        videoEl.onerror = function(){ videoEl.classList.add('hidden'); };
    }
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
    questionNum += 1;
    var questionsDiv = document.getElementById('allQuestions');
    var card = buildQuestionCard(questionNum, prefill);
    questionsDiv.appendChild(card);
    card.querySelector('.question').focus();
}

function renumberQuestions(){
    var cards = document.querySelectorAll('.question-card');
    questionNum = 0;
    cards.forEach(function(card, idx){
        var num = idx + 1;
        questionNum = num;
        card.setAttribute('data-question', String(num));
        var pill = card.querySelector('.pill');
        if(pill){
            pill.textContent = (lang === 'en' ? 'Question ' : (lang === 'ca' ? 'Pregunta ' : 'Pregunta ')) + String(num);
        }
        // update ids to keep order consistent
        var qField = card.querySelector('.question');
        if(qField) qField.id = 'q' + num;
        ['a1','a2','a3','a4'].forEach(function(suffix, idxAns){
            var inp = card.querySelector('input[id$="'+suffix+'"]');
            if(inp) inp.id = num + suffix;
        });
        var typeSelect = card.querySelector('.question-type');
        if(typeSelect) typeSelect.id = 'type' + num;
        var correct = card.querySelector('.correct');
        if(correct) correct.id = 'correct' + num;
        var shortField = card.querySelector('input[id^="short"]');
        if(shortField) shortField.id = 'short' + num;
        var numField = card.querySelector('input[id^="num"]');
        if(numField) numField.id = 'num' + num;
        var tolField = card.querySelector('input[id^="tol"]');
        if(tolField) tolField.id = 'tol' + num;
        var timeField = card.querySelector('input[id^="time"]');
        if(timeField) timeField.id = 'time' + num;
        var img = card.querySelector('input[id^="img"]');
        if(img) img.id = 'img' + num;
        var vid = card.querySelector('input[id^="vid"]');
        if(vid) vid.id = 'vid' + num;
    });
}

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
        document.getElementById('name').value = quiz.name || '';
        if(quiz.tags && quiz.tags.length){
            document.getElementById('tags').value = quiz.tags.join(', ');
            renderTagSuggestions();
        }
        if(document.getElementById('visibility')){
            document.getElementById('visibility').value = quiz.visibility || 'public';
        }
        if(document.getElementById('allow-clone')){
            document.getElementById('allow-clone').checked = !!quiz.allowClone;
        }
        if(document.getElementById('language')){
            document.getElementById('language').value = quiz.language || '';
        }
        if(document.getElementById('license')){
            document.getElementById('license').value = quiz.license || '';
        }
        if(document.getElementById('description')){
            document.getElementById('description').value = quiz.description || '';
        }
        var container = document.getElementById('allQuestions');
        container.innerHTML = '';
        questionNum = 0;
        (quiz.questions || []).forEach(function(q){
            addQuestion(q);
        });
        if(questionNum === 0){
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
    var raw = document.getElementById('tags') ? document.getElementById('tags').value : '';
    if(!raw) return [];
    return raw.split(',').map(function(t){ return t.trim().toLowerCase(); }).filter(function(t){ return t.length; });
}

function addTagToInput(tag){
    var input = document.getElementById('tags');
    if(!input) return;
    var tags = parseTagsInput();
    if(tags.indexOf(tag) !== -1) return;
    tags.push(tag);
    input.value = tags.join(', ');
}

function renderTagSuggestions(){
    var wrap = document.getElementById('tag-suggestions');
    if(!wrap) return;
    wrap.innerHTML = '';
    if(!knownTags.length){
        return;
    }
    var label = document.createElement('span');
    label.className = 'label';
    label.textContent = t('suggestedTags');
    wrap.appendChild(label);
    knownTags.forEach(function(tag){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tag' + (parseTagsInput().indexOf(tag) !== -1 ? ' active' : '');
        btn.textContent = tag;
        btn.onclick = function(){ addTagToInput(tag); renderTagSuggestions(); };
        wrap.appendChild(btn);
    });
}


function fetchKnownTags(){
    return fetch('/api/tags', { credentials: 'include' })
        .then(function(res){ return res.json(); })
        .then(function(data){
            knownTags = Array.isArray(data.tags) ? data.tags : [];
            renderTagSuggestions();
        })
        .catch(function(){
            knownTags = [];
            renderTagSuggestions();
        });
}

var langSelector = document.getElementById('lang-select');
if(langSelector){
    langSelector.value = lang;
    langSelector.addEventListener('change', function(){
        lang = langSelector.value;
        EduhootLang.persist(lang);
        applyI18n();
    });
}
var tagsInputEl = document.getElementById('tags');
if(tagsInputEl){
    tagsInputEl.addEventListener('input', function(){
        renderTagSuggestions();
    });
}
var visibilitySelect = document.getElementById('visibility');
if(visibilitySelect){
    visibilitySelect.addEventListener('change', updateVisibilityWarning);
}
applyI18n();
updateVisibilityWarning();
refreshAuthStatus();
