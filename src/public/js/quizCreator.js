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
var LANG_KEYS = ['lang', 'lang-player', 'lang-host', 'edutictac-portal-lang', 'edutictac-lang'];
function normalizeLang(raw){
    var value = String(raw || '').toLowerCase();
    if(value.indexOf('valencia') !== -1) return 'va';
    var base = value.split('-')[0];
    return ['ca','va','es','en'].indexOf(base) !== -1 ? base : '';
}
function getQueryLang(){
    try{ return normalizeLang(new URLSearchParams(window.location.search).get('lang')); }catch(e){ return ''; }
}
function getStoredLang(){
    for(var i = 0; i < LANG_KEYS.length; i++){
        try{
            var value = normalizeLang(localStorage.getItem(LANG_KEYS[i]));
            if(value) return value;
        }catch(e){}
    }
    return '';
}
function persistLang(value){
    try {
        var url = new URL(window.location.href);
        if (url.searchParams.has('lang')) {
            url.searchParams.set('lang', value);
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        }
    } catch (e) {}
    for(var i = 0; i < LANG_KEYS.length; i++){
        try{ localStorage.setItem(LANG_KEYS[i], value); }catch(e){}
    }
}
var browserLang = normalizeLang(navigator.language || 'es');
var lang = getQueryLang() || getStoredLang() || browserLang || 'es';
persistLang(lang);
var knownTags = [];
var isUserAuthenticated = false;
var moodleExportPendingQuiz = null;
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
        suggestedTags: 'Etiquetas usadas (toca para añadir)',
        questionsEyebrow: 'Preguntas',
        questionsTitle: 'Construye las preguntas',
        questionsDesc: 'Añade 4 posibles respuestas y marca la correcta (1-4).',
        addQuestion: '+ Añadir pregunta',
        btnSave: 'Guardar quiz',
        btnPlayLocal: 'Jugar sin guardar',
        btnExportCsv: 'Exportar CSV',
        btnExportPdf: 'Exportar PDF',
        btnExportPdfNoAnswers: 'Exportar PDF (sin respuestas)',
        btnExportMoodleXml: 'Exportar XML (Moodle)',
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
        questionTypeMultiHint: 'Marca todas las respuestas correctas.',
        questionTimeLabel: 'Tiempo límite (segundos)',
        shortAnswersLabel: 'Respuestas válidas (separadas por |)',
        numericAnswerLabel: 'Respuesta numérica',
        numericToleranceLabel: 'Tolerancia (±)',
        imageLabel: 'Imagen (URL opcional)',
        videoLabel: 'Video (URL opcional)',
        namePlaceholder: 'Ej: Repaso de energía',
        tagsPlaceholder: 'ej: física, 2ºESO, energía',
        urlPlaceholder: 'https://...',
        playErrorName: 'Ponle un nombre',
        playErrorTags: 'Añade al menos una etiqueta',
        playErrorQuestions: 'Añade preguntas',
        loadError: 'No se pudo cargar el quiz.',
        saveError: 'No se pudo guardar el quiz.',
        saveOk: 'Quiz actualizado',
        confirmCancel: '¿Seguro que quieres salir? Se perderán los cambios.',
        moodleModalTitle: 'Importar en Moodle',
        moodleModalDescription: 'Revisa estos pasos antes de descargar el XML para subirlo a tu curso.',
        moodleModalStep1: 'Accede al curso de Moodle donde quieres importar el quiz.',
        moodleModalStep2: 'Ve a Administración del curso > Importar y selecciona el tipo "Moodle XML".',
        moodleModalStep3: 'Sube el archivo descargado y sigue el asistente para confirmar las preguntas.',
        moodleModalCancel: 'Cerrar',
        moodleModalConfirm: 'Descargar XML',
        pdfTags: 'Etiquetas',
        pdfCorrect: 'Correcta',
        pdfAcceptedAnswers: 'Respuestas válidas',
        pdfNumericAnswer: 'Respuesta',
        pdfTolerance: 'Tolerancia',
        pdfImage: 'Imagen',
        pdfVideo: 'Video',
        pdfMissingLib: 'No se pudo generar el PDF (librería no disponible).'
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
        suggestedTags: 'Suggested tags (tap to add)',
        questionsEyebrow: 'Questions',
        questionsTitle: 'Build the questions',
        questionsDesc: 'Add 4 possible answers and mark the correct one (1-4).',
        addQuestion: '+ Add question',
        btnSave: 'Save quiz',
        btnPlayLocal: 'Play without saving',
        btnExportCsv: 'Export CSV',
        btnExportPdf: 'Export PDF',
        btnExportPdfNoAnswers: 'Export PDF (no answers)',
        btnExportMoodleXml: 'Export Moodle XML',
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
        questionTypeMultiHint: 'Check every answer that counts.',
        questionTimeLabel: 'Time limit (seconds)',
        shortAnswersLabel: 'Accepted answers (separated by |)',
        numericAnswerLabel: 'Numeric answer',
        numericToleranceLabel: 'Tolerance (±)',
        imageLabel: 'Image (optional URL)',
        videoLabel: 'Video (optional URL)',
        namePlaceholder: 'e.g. Energy review',
        tagsPlaceholder: 'e.g. physics, grade8, energy',
        urlPlaceholder: 'https://...',
        playErrorName: 'Give it a name',
        playErrorTags: 'Add at least one tag',
        playErrorQuestions: 'Add questions',
        loadError: 'Could not load quiz.',
        saveError: 'Could not save quiz.',
        saveOk: 'Quiz updated',
        confirmCancel: 'Are you sure? Changes will be lost.',
        moodleModalTitle: 'Import into Moodle',
        moodleModalDescription: 'Follow these steps before downloading the XML to upload it to your course.',
        moodleModalStep1: 'Open the Moodle course where you want to import the quiz.',
        moodleModalStep2: 'Go to Course administration > Import and choose "Moodle XML" as the source.',
        moodleModalStep3: 'Upload this file and follow the wizard to review questions and settings.',
        moodleModalCancel: 'Close',
        moodleModalConfirm: 'Download XML',
        pdfTags: 'Tags',
        pdfCorrect: 'Correct',
        pdfAcceptedAnswers: 'Accepted answers',
        pdfNumericAnswer: 'Answer',
        pdfTolerance: 'Tolerance',
        pdfImage: 'Image',
        pdfVideo: 'Video',
        pdfMissingLib: 'Could not generate the PDF (library not available).'
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
        suggestedTags: 'Etiquetes usades (toca per afegir)',
        questionsEyebrow: 'Preguntes',
        questionsTitle: 'Construeix les preguntes',
        questionsDesc: 'Afegeix 4 respostes i marca la correcta (1-4).',
        addQuestion: '+ Afegir pregunta',
        btnSave: 'Desar quiz',
        btnPlayLocal: 'Jugar sense desar',
        btnExportCsv: 'Exportar CSV',
        btnExportPdf: 'Exportar PDF',
        btnExportPdfNoAnswers: 'Exportar PDF (sense respostes)',
        btnExportMoodleXml: 'Exportar XML (Moodle)',
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
        questionTypeMultiHint: 'Marca totes les respostes correctes.',
        questionTimeLabel: 'Temps límit (segons)',
        shortAnswersLabel: 'Respostes vàlides (separades per |)',
        numericAnswerLabel: 'Resposta numèrica',
        numericToleranceLabel: 'Tolerància (±)',
        imageLabel: 'Imatge (URL opcional)',
        videoLabel: 'Vídeo (URL opcional)',
        namePlaceholder: 'Ex: Repàs d\'energia',
        tagsPlaceholder: 'ex: física, 2nESO, energia',
        urlPlaceholder: 'https://...',
        playErrorName: 'Posa-li un nom',
        playErrorTags: 'Afegeix almenys una etiqueta',
        playErrorQuestions: 'Afegeix preguntes',
        loadError: 'No s\'ha pogut carregar el quiz.',
        saveError: 'No s\'ha pogut desar el quiz.',
        saveOk: 'Quiz actualitzat',
        confirmCancel: 'Segur que vols sortir? Es perdran els canvis.',
        moodleModalTitle: 'Importar a Moodle',
        moodleModalDescription: 'Segueix aquests passos abans de descarregar l\'XML per pujar-lo al teu curs.',
        moodleModalStep1: 'Accedeix al curs de Moodle on vols importar el quiz.',
        moodleModalStep2: 'Vés a Administració del curs > Importa i tria "Moodle XML".',
        moodleModalStep3: 'Carrega aquest fitxer i segueix l\'assistència per revisar les preguntes.',
        moodleModalCancel: 'Tancar',
        moodleModalConfirm: 'Descarregar XML',
        pdfTags: 'Etiquetes',
        pdfCorrect: 'Correcta',
        pdfAcceptedAnswers: 'Respostes vàlides',
        pdfNumericAnswer: 'Resposta',
        pdfTolerance: 'Tolerància',
        pdfImage: 'Imatge',
        pdfVideo: 'Vídeo',
        pdfMissingLib: 'No s\'ha pogut generar el PDF (llibreria no disponible).'
    },
    va: {
        subtitle: 'Dissenya les preguntes i guarda el joc per llançar-lo quan vulgues.',
        btnSave: 'Guardar quiz',
        btnPlayLocal: 'Jugar sense guardar',
        localInfo: 'Sense sessió: “Guardar” o “Jugar sense guardar” creen un quiz anònim. "Només jo" caduca en 24h; "Per enllaç/Públic" es guarda globalment. Amb sessió, queda al teu usuari.',
        confirmCancel: 'Segur que vols eixir? Es perdran els canvis.',
        moodleModalStep3: 'Carrega este fitxer i segueix l\'assistència per revisar les preguntes.'
    }
};

function getJsPdf(){
    try{
        if(window.jspdf && window.jspdf.jsPDF){
            return window.jspdf.jsPDF;
        }
    }catch(e){
        // ignore
    }
    return null;
}

function sanitizeFilename(name, fallback){
    var base = (name || '').toString().trim();
    if(!base) base = fallback || 'quiz';
    // Quitar caracteres típicamente problemáticos en descargas
    base = base.replace(/[\\/\n\r\t\0]+/g, ' ');
    base = base.replace(/[:*?"<>|]+/g, '');
    base = base.replace(/\s+/g, ' ').trim();
    if(!base) base = fallback || 'quiz';
    return base;
}

function toLetterAnswer(n){
    var num = parseInt(n, 10);
    if(!isFinite(num)) return '';
    if(num === 1) return 'A';
    if(num === 2) return 'B';
    if(num === 3) return 'C';
    if(num === 4) return 'D';
    return String(num);
}

function getTfLabelsForPdf(question){
    var raw = Array.isArray(question && question.answers) ? question.answers : [];
    var a = (raw[0] || '').toString().trim();
    var b = (raw[1] || '').toString().trim();
    var fallback = getTfFallbackAnswers();
    return [a || fallback[0], b || fallback[1]];
}

function pdfAddWrapped(doc, text, x, y, maxWidth, opts){
    opts = opts || {};
    var fontSize = opts.fontSize || 11;
    var lineHeight = opts.lineHeight || Math.round(fontSize * 1.25);
    var isBold = !!opts.bold;
    var marginBottom = (opts.marginBottom === undefined ? 0 : opts.marginBottom);

    doc.setFontSize(fontSize);
    try{
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    }catch(e){
        // ignore if font set fails
    }

    var pageHeight = doc.internal.pageSize.getHeight();
    var marginTop = opts.marginTop || 40;
    var bottomLimit = pageHeight - (opts.marginBottomLimit || 40);

    var safeText = (text === undefined || text === null) ? '' : String(text);
    var lines = doc.splitTextToSize(safeText, maxWidth);
    for(var i = 0; i < lines.length; i++){
        if(y + lineHeight > bottomLimit){
            doc.addPage();
            y = marginTop;
        }
        doc.text(lines[i], x, y);
        y += lineHeight;
    }
    y += marginBottom;
    return y;
}

function getImageFormatFromDataUrl(dataUrl){
    var match = /^data:image\/(png|jpeg|jpg|webp);/i.exec(dataUrl || '');
    if(!match) return '';
    var ext = match[1].toLowerCase();
    if(ext === 'png') return 'PNG';
    if(ext === 'webp') return 'WEBP';
    return 'JPEG';
}

function extractSvgTextFromDataUrl(dataUrl){
    var comma = dataUrl.indexOf(',');
    if(comma === -1) return '';
    var header = dataUrl.slice(0, comma);
    var payload = dataUrl.slice(comma + 1);
    try{
        if(/;base64/i.test(header)){
            return atob(payload);
        }
        return decodeURIComponent(payload);
    }catch(e){
        return '';
    }
}

function getSvgSizeFromText(svgText){
    if(!svgText) return { width: 0, height: 0 };
    var widthMatch = svgText.match(/\bwidth=["']?([\d.]+)/i);
    var heightMatch = svgText.match(/\bheight=["']?([\d.]+)/i);
    var width = widthMatch ? parseFloat(widthMatch[1]) : 0;
    var height = heightMatch ? parseFloat(heightMatch[1]) : 0;
    if(width > 0 && height > 0) return { width: width, height: height };

    var viewBoxMatch = svgText.match(/\bviewBox=["']?([-\d.\s,]+)["']?/i);
    if(viewBoxMatch && viewBoxMatch[1]){
        var parts = viewBoxMatch[1].trim().split(/[,\s]+/).map(function(n){ return parseFloat(n); });
        if(parts.length === 4 && isFinite(parts[2]) && isFinite(parts[3])){
            return { width: Math.abs(parts[2]), height: Math.abs(parts[3]) };
        }
    }
    return { width: 0, height: 0 };
}

function rasterizeSvgDataUrl(dataUrl){
    return new Promise(function(resolve){
        var svgText = extractSvgTextFromDataUrl(dataUrl);
        if(!svgText) return resolve('');
        var size = getSvgSizeFromText(svgText);
        var img = new Image();
        img.onload = function(){
            var width = size.width || img.naturalWidth || img.width || 800;
            var height = size.height || img.naturalHeight || img.height || 600;
            var canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(width));
            canvas.height = Math.max(1, Math.round(height));
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = function(){ resolve(''); };
        img.src = dataUrl;
    });
}

function blobToDataUrl(blob){
    return new Promise(function(resolve){
        var reader = new FileReader();
        reader.onload = function(){ resolve(reader.result || ''); };
        reader.onerror = function(){ resolve(''); };
        reader.readAsDataURL(blob);
    });
}

function loadImageForPdf(url){
    return new Promise(function(resolve){
        var raw = (url || '').toString().trim();
        if(!raw) return resolve(null);
        var normalized = normalizeSvgDataUrlForImg(raw);
        var isDataUrl = normalized.toLowerCase().startsWith('data:image/');
    var dataUrlPromise = isDataUrl
        ? Promise.resolve(normalized)
        : fetch(normalized, { mode: 'cors', cache: 'no-store' })
            .then(function(res){ return res && res.ok ? res.blob() : null; })
            .then(function(blob){ return blob ? blobToDataUrl(blob) : ''; })
            .catch(function(){ return ''; });

    dataUrlPromise.then(function(dataUrl){
        if(!dataUrl) return resolve(null);
        var lower = dataUrl.toLowerCase();
        var finalize = function(finalUrl){
            var format = getImageFormatFromDataUrl(finalUrl);
            if(!format) return resolve(null);
            var img = new Image();
            img.onload = function(){
                resolve({
                    dataUrl: finalUrl,
                    format: format,
                    width: img.naturalWidth || img.width || 0,
                    height: img.naturalHeight || img.height || 0
                });
            };
            img.onerror = function(){ resolve(null); };
            img.src = finalUrl;
        };

        if(lower.startsWith('data:image/svg+xml')){
            rasterizeSvgDataUrl(dataUrl).then(function(pngUrl){
                if(!pngUrl) return resolve(null);
                finalize(pngUrl);
            });
        }else{
            finalize(dataUrl);
        }
    });
});
}

function pdfAddImage(doc, image, x, y, maxWidth, opts){
    opts = opts || {};
    var marginTop = opts.marginTop || 40;
    var bottomLimit = doc.internal.pageSize.getHeight() - (opts.marginBottomLimit || 40);
    var maxHeight = opts.maxHeight || 240;
    var marginBottom = opts.marginBottom === undefined ? 6 : opts.marginBottom;
    if(!image || !image.width || !image.height) return y;

    var scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    var drawWidth = image.width * scale;
    var drawHeight = image.height * scale;

    if(y + drawHeight > bottomLimit){
        doc.addPage();
        y = marginTop;
    }

    doc.addImage(image.dataUrl, image.format, x, y, drawWidth, drawHeight);
    y += drawHeight + marginBottom;
    return y;
}

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

function refreshAuthStatus(){
    fetch('/api/auth/me', { credentials: 'include' })
        .then(function(res){
            if(!res.ok) throw new Error();
            return res.json();
        })
        .then(function(){
            isUserAuthenticated = true;
            updateVisibilityWarning();
        })
        .catch(function(){
            isUserAuthenticated = false;
            updateVisibilityWarning();
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
        if(!correctValues.length){
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

function quizToCsv(quiz){
    var header = ['tipo','pregunta','r1','r2','r3','r4','tiempo','correcta','imagen','video','texto','numero','tolerancia'].join(';');
    var lines = (quiz.questions || []).map(function(q){
        var answers = q.answers || [];
        var type = q.type || 'quiz';
        var correctVals = Array.isArray(q.correctAnswers) && q.correctAnswers.length
            ? q.correctAnswers.join(',')
            : (q.correct || 1);

        var texto = '';
        var numero = '';
        var tolerancia = '';
        if(type === 'short-answer'){
            var acc = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
            texto = acc.join('|');
            correctVals = texto;
        }else if(type === 'numeric'){
            numero = (q.numericAnswer === undefined || q.numericAnswer === null) ? '' : String(q.numericAnswer);
            tolerancia = (q.tolerance === undefined || q.tolerance === null) ? '0' : String(q.tolerance);
            correctVals = numero;
        }
        function esc(v){
            if(v === undefined || v === null) return '';
            var s = String(v);
            if(s.indexOf(';') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0){
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        }
        return [
            type,
            esc(q.question||''),
            esc(answers[0]||''),
            esc(answers[1]||''),
            esc(answers[2]||''),
            esc(answers[3]||''),
            esc(q.time||20),
            esc(correctVals),
            esc(q.image||''),
            esc(q.video||''),
            esc(texto),
            esc(numero),
            esc(tolerancia)
        ].join(';');
    });
    return [header].concat(lines).join('\n');
}

function escapeHtmlText(value){
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeAttrValue(value){
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
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

function wrapCdata(value){
    var str = String(value || '');
    var safe = str.replace(/]]>/g, ']]]]><![CDATA[>');
    return '<![CDATA[' + safe + ']]>';
}

function buildQuestionHtml(question){
    var parts = [];
    var text = (question.question || '').trim();
    if(text){
        parts.push('<p>' + escapeHtmlText(text) + '</p>');
    }
    if(question.image){
        parts.push('<p><img src="' + escapeAttrValue(normalizeSvgDataUrlForImg(question.image)) + '" alt=""/></p>');
    }
    if(question.video){
        parts.push('<p><video controls="controls" preload="metadata" src="' + escapeAttrValue(question.video) + '"></video></p>');
    }
    return parts.join('');
}

function normalizeCorrectAnswersForExport(question, maxAnswerIndex){
    var limit = Math.max(1, parseInt(maxAnswerIndex, 10) || 4);
    var list = [];
    if(question && Array.isArray(question.correctAnswers) && question.correctAnswers.length){
        list = question.correctAnswers.slice();
    }else if(question && typeof question.correct !== 'undefined'){
        list = [question.correct];
    }
    var map = {};
    var out = [];
    list.forEach(function(v){
        var num = parseInt(v, 10);
        if(!isFinite(num)) return;
        num = Math.max(1, Math.min(limit, num));
        if(map[num]) return;
        map[num] = true;
        out.push(num);
    });
    if(!out.length) out = [1];
    out.sort(function(a, b){ return a - b; });
    return out;
}

function getNonEmptyAnswersForExport(question, maxCount){
    var raw = Array.isArray(question && question.answers) ? question.answers.slice(0, maxCount) : [];
    while(raw.length < maxCount) raw.push('');
    var out = [];
    raw.forEach(function(text, idx){
        var clean = (text || '').toString().trim();
        if(!clean) return;
        out.push({ index: idx + 1, text: clean });
    });
    return out;
}

function getTfFallbackAnswers(){
    if(lang === 'ca' || lang === 'va') return ['Cert', 'Fals'];
    if(lang === 'en') return ['True', 'False'];
    return ['Verdadero', 'Falso'];
}

function splitAcceptedAnswersForExport(raw){
    var text = (raw || '').toString().trim();
    if(!text) return [];
    var parts = text.split(/[|\n]+/g);
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

function parseLenientNumberForExport(value){
    if(value === undefined || value === null) return null;
    if(typeof value === 'number' && isFinite(value)) return value;
    var raw = String(value).trim();
    if(!raw) return null;
    raw = raw.replace(/\s+/g, '').replace(',', '.');
    var n = parseFloat(raw);
    return isFinite(n) ? n : null;
}

function buildMoodleXml(quiz){
    var title = (quiz.name || 'EduHoot quiz').trim() || 'EduHoot quiz';
    var lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<quiz>'];
    var questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    questions.forEach(function(question, index){
        var qType = (question && question.type) ? String(question.type) : 'quiz';
        var nameText = title + ' pregunta ' + (index + 1);
        var html = buildQuestionHtml(question) || '<p>' + escapeHtmlText((question && question.question) || '') + '</p>';

        if(qType === 'short-answer'){
            lines.push('  <question type="shortanswer">');
            lines.push('    <name><text>' + wrapCdata(nameText) + '</text></name>');
            lines.push('    <questiontext format="html">');
            lines.push('      <text>' + wrapCdata(html) + '</text>');
            lines.push('    </questiontext>');
            lines.push('    <defaultgrade>1</defaultgrade>');
            lines.push('    <penalty>0.0</penalty>');
            lines.push('    <hidden>0</hidden>');
            lines.push('    <usecase>0</usecase>');

            var accepted = Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length
                ? question.acceptedAnswers
                : splitAcceptedAnswersForExport(question.texto || question.correctText || question.correcta || '');
            if(!accepted.length) accepted = [''];
            accepted.forEach(function(ans){
                lines.push('    <answer fraction="100" format="html">');
                lines.push('      <text>' + wrapCdata(escapeHtmlText(ans || '')) + '</text>');
                lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
                lines.push('    </answer>');
            });
            lines.push('  </question>');
            return;
        }

        if(qType === 'numeric'){
            lines.push('  <question type="numerical">');
            lines.push('    <name><text>' + wrapCdata(nameText) + '</text></name>');
            lines.push('    <questiontext format="html">');
            lines.push('      <text>' + wrapCdata(html) + '</text>');
            lines.push('    </questiontext>');
            lines.push('    <defaultgrade>1</defaultgrade>');
            lines.push('    <penalty>0.0</penalty>');
            lines.push('    <hidden>0</hidden>');

            var n = parseLenientNumberForExport(question.numericAnswer);
            var tol = parseLenientNumberForExport(question.tolerance);
            if(tol === null) tol = 0;
            lines.push('    <answer fraction="100" format="html">');
            lines.push('      <text>' + wrapCdata(escapeHtmlText(n === null ? '' : String(n))) + '</text>');
            lines.push('      <tolerance>' + wrapCdata(escapeHtmlText(String(tol))) + '</tolerance>');
            lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
            lines.push('    </answer>');
            lines.push('  </question>');
            return;
        }

        if(qType === 'true-false'){
            lines.push('  <question type="truefalse">');
            lines.push('    <name><text>' + wrapCdata(nameText) + '</text></name>');
            lines.push('    <questiontext format="html">');
            lines.push('      <text>' + wrapCdata(html) + '</text>');
            lines.push('    </questiontext>');
            lines.push('    <defaultgrade>1</defaultgrade>');
            lines.push('    <penalty>0.0</penalty>');
            lines.push('    <hidden>0</hidden>');

            var tfAnswers = getNonEmptyAnswersForExport(question, 2);
            var tfFallback = getTfFallbackAnswers();
            var trueLabel = (tfAnswers[0] && tfAnswers[0].text) ? tfAnswers[0].text : tfFallback[0];
            var falseLabel = (tfAnswers[1] && tfAnswers[1].text) ? tfAnswers[1].text : tfFallback[1];
            var tfCorrect = normalizeCorrectAnswersForExport(question, 2);
            var correctIsTrue = tfCorrect[0] === 1;

            lines.push('    <answer fraction="' + (correctIsTrue ? '100' : '0') + '" format="html">');
            lines.push('      <text>' + wrapCdata(escapeHtmlText(trueLabel)) + '</text>');
            lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
            lines.push('    </answer>');
            lines.push('    <answer fraction="' + (correctIsTrue ? '0' : '100') + '" format="html">');
            lines.push('      <text>' + wrapCdata(escapeHtmlText(falseLabel)) + '</text>');
            lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
            lines.push('    </answer>');
            lines.push('  </question>');
            return;
        }

        // Por defecto: multichoice (single o multiple)
        var isMultiple = qType === 'multiple';
        lines.push('  <question type="multichoice">');
        lines.push('    <name><text>' + wrapCdata(nameText) + '</text></name>');
        lines.push('    <questiontext format="html">');
        lines.push('      <text>' + wrapCdata(html) + '</text>');
        lines.push('    </questiontext>');
        lines.push('    <defaultgrade>1</defaultgrade>');
        lines.push('    <penalty>0.0</penalty>');
        lines.push('    <hidden>0</hidden>');
        lines.push('    <single>' + (isMultiple ? 'false' : 'true') + '</single>');
        lines.push('    <shuffleanswers>true</shuffleanswers>');
        lines.push('    <answernumbering>abc</answernumbering>');

        var answerItems = getNonEmptyAnswersForExport(question, 4);
        if(answerItems.length < 2){
            // Moodle requiere al menos 2 respuestas en multichoice
            var fallback = getTfFallbackAnswers();
            answerItems = [
                { index: 1, text: fallback[0] },
                { index: 2, text: fallback[1] }
            ];
        }

        var correctAnswers = normalizeCorrectAnswersForExport(question, 4);
        var correctMap = {};
        correctAnswers.forEach(function(n){ correctMap[n] = true; });
        // Si la correcta apunta a una respuesta vacía, cae a la primera no-vacía
        var anyCorrectVisible = answerItems.some(function(it){ return !!correctMap[it.index]; });
        if(!anyCorrectVisible){
            correctMap = {};
            correctMap[answerItems[0].index] = true;
        }

        var correctCount = answerItems.reduce(function(acc, it){ return acc + (correctMap[it.index] ? 1 : 0); }, 0);
        if(correctCount <= 0) correctCount = 1;
        var perCorrect = isMultiple ? (100 / correctCount) : 100;

        answerItems.forEach(function(item){
            var fraction = correctMap[item.index] ? perCorrect : 0;
            // Moodle acepta float en fraction
            var fractionStr = (Math.round(fraction * 100000) / 100000).toString();
            lines.push('    <answer fraction="' + fractionStr + '" format="html">');
            lines.push('      <text>' + wrapCdata(escapeHtmlText(item.text || '')) + '</text>');
            lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
            lines.push('    </answer>');
        });
        lines.push('  </question>');
    });
    lines.push('</quiz>');
    return lines.join('\n');
}

function exportCsv(){
    var quiz = buildQuizPayload();
    if(!quiz.questions.length){
        alert('Añade preguntas');
        return;
    }
    var csv = quizToCsv(quiz);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (quiz.name || 'quiz') + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function exportMoodleXml(){
    var quiz = buildQuizPayload();
    if(!quiz.questions.length){
        alert('Añade preguntas');
        return;
    }
    openMoodleExportModal(quiz);
}

async function exportPdf(options){
    options = options || {};
    var includeAnswers = options.includeAnswers !== false;

    var quiz = buildQuizPayload();
    if(!quiz.questions.length){
        alert(t('playErrorQuestions'));
        return;
    }

    var JsPdfCtor = getJsPdf();
    if(!JsPdfCtor){
        alert(t('pdfMissingLib'));
        return;
    }

    var title = (quiz.name || '').toString().trim() || 'EduHoot quiz';
    var doc = new JsPdfCtor({ unit: 'pt', format: 'a4' });
    var pageWidth = doc.internal.pageSize.getWidth();
    var margin = 40;
    var maxWidth = pageWidth - (margin * 2);
    var y = margin;

    y = pdfAddWrapped(doc, title, margin, y, maxWidth, { fontSize: 18, bold: true, marginBottom: 10 });

    if(Array.isArray(quiz.tags) && quiz.tags.length){
        y = pdfAddWrapped(
            doc,
            t('pdfTags') + ': ' + quiz.tags.join(', '),
            margin,
            y,
            maxWidth,
            { fontSize: 11, bold: false, marginBottom: 12 }
        );
    }else{
        y += 6;
    }

    for(var idx = 0; idx < quiz.questions.length; idx++){
        var q = quiz.questions[idx];
        var qNum = idx + 1;
        var qText = (q && q.question) ? String(q.question).trim() : '';
        var qType = (q && q.type) ? String(q.type) : 'quiz';

        y = pdfAddWrapped(doc, qNum + '. ' + (qText || ''), margin, y, maxWidth, { fontSize: 12, bold: true, marginBottom: 6 });

        if(qType === 'short-answer'){
            var accepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
            if(includeAnswers && accepted.length){
                y = pdfAddWrapped(doc, t('pdfAcceptedAnswers') + ': ' + accepted.join(' | '), margin, y, maxWidth, { fontSize: 11 });
                y = pdfAddWrapped(doc, t('pdfCorrect') + ': ' + accepted.join(' | '), margin, y, maxWidth, { fontSize: 10, marginBottom: 8 });
            }else{
                y += 8;
            }
        }else if(qType === 'numeric'){
            var n = (q.numericAnswer === undefined || q.numericAnswer === null) ? '' : String(q.numericAnswer);
            var tol = (q.tolerance === undefined || q.tolerance === null) ? '0' : String(q.tolerance);
            if(includeAnswers){
                y = pdfAddWrapped(doc, t('pdfNumericAnswer') + ': ' + n + ' (± ' + t('pdfTolerance') + ': ' + tol + ')', margin, y, maxWidth, { fontSize: 11 });
                y = pdfAddWrapped(doc, t('pdfCorrect') + ': ' + n + ' (± ' + tol + ')', margin, y, maxWidth, { fontSize: 10, marginBottom: 8 });
            }else{
                y += 8;
            }
        }else if(qType === 'true-false'){
            var tf = getTfLabelsForPdf(q);
            y = pdfAddWrapped(doc, 'A) ' + tf[0], margin, y, maxWidth, { fontSize: 11 });
            y = pdfAddWrapped(doc, 'B) ' + tf[1], margin, y, maxWidth, { fontSize: 11, marginBottom: 6 });
        }else{
            var answers = Array.isArray(q.answers) ? q.answers : [];
            var labels = ['A', 'B', 'C', 'D'];
            for(var i = 0; i < 4; i++){
                var ans = (answers[i] || '').toString().trim();
                if(!ans) continue;
                y = pdfAddWrapped(doc, labels[i] + ') ' + ans, margin, y, maxWidth, { fontSize: 11 });
            }
            y += 6;
        }

        // URLs como texto (no embebemos imágenes/vídeos en PDF para mantenerlo simple y robusto)
        if(q && q.image){
            var imageData = await loadImageForPdf(q.image);
            if(imageData){
                y = pdfAddImage(doc, imageData, margin, y, maxWidth);
            }else{
                y = pdfAddWrapped(doc, t('pdfImage') + ': ' + String(q.image), margin, y, maxWidth, { fontSize: 10 });
            }
        }
        if(q && q.video){
            y = pdfAddWrapped(doc, t('pdfVideo') + ': ' + String(q.video), margin, y, maxWidth, { fontSize: 10 });
        }

        // Mostrar solución (índices/letters) para quizzes
        if(includeAnswers && (qType === 'quiz' || qType === 'multiple' || qType === 'true-false')){
            var correct = (Array.isArray(q.correctAnswers) && q.correctAnswers.length) ? q.correctAnswers : [q.correct];
            var printable = [];
            correct.forEach(function(v){
                if(qType === 'true-false'){
                    var num = parseInt(v, 10);
                    if(num === 1) printable.push('A');
                    else if(num === 2) printable.push('B');
                }else{
                    var letter = toLetterAnswer(v);
                    if(letter) printable.push(letter);
                }
            });
            if(printable.length){
                // unique
                var seen = {};
                printable = printable.filter(function(x){ if(seen[x]) return false; seen[x] = true; return true; });
                y = pdfAddWrapped(doc, t('pdfCorrect') + ': ' + printable.join(', '), margin, y, maxWidth, { fontSize: 10, marginBottom: 10 });
            }else{
                y += 6;
            }
        }else{
            y += 10;
        }
    }

    var baseName = sanitizeFilename(title, 'quiz');
    var filename = baseName + (includeAnswers ? '' : '_sin_respuestas') + '.pdf';
    doc.save(filename);
}

function downloadMoodleXmlFile(quiz){
    var xml = buildMoodleXml(quiz);
    var blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (quiz.name || 'quiz') + '.xml';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function closeMoodleExportModal(){
    var modal = document.getElementById('moodleModal');
    if(!modal) return;
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    moodleExportPendingQuiz = null;
}

function openMoodleExportModal(quiz){
    moodleExportPendingQuiz = quiz;
    var modal = document.getElementById('moodleModal');
    if(!modal){
        downloadMoodleXmlFile(quiz);
        moodleExportPendingQuiz = null;
        return;
    }
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function confirmMoodleExport(){
    if(moodleExportPendingQuiz){
        downloadMoodleXmlFile(moodleExportPendingQuiz);
    }
    closeMoodleExportModal();
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
    [['quiz', 'questionTypeSingle'], ['multiple', 'questionTypeMultiple'], ['true-false', 'questionTypeTf'], ['short-answer', 'questionTypeShort'], ['numeric', 'questionTypeNumeric']].forEach(function(pair){
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
        multiCorrect.classList.toggle('hidden', !showMultiple);
        correctLabel.style.display = (showMultiple || showShort || showNumeric) ? 'none' : '';
        correctField.style.display = (showMultiple || showShort || showNumeric) ? 'none' : '';

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
                allowClone: quiz.allowClone
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

function setupMoodleExportModal(){
    var modal = document.getElementById('moodleModal');
    if(!modal) return;
    var confirmBtn = document.getElementById('moodleModalConfirm');
    var cancelBtn = document.getElementById('moodleModalCancel');
    if(confirmBtn){
        confirmBtn.type = 'button';
        confirmBtn.addEventListener('click', function(event){
            event.preventDefault();
            confirmMoodleExport();
        });
    }
    if(cancelBtn){
        cancelBtn.type = 'button';
        cancelBtn.addEventListener('click', function(event){
            event.preventDefault();
            closeMoodleExportModal();
        });
    }
    modal.addEventListener('click', function(event){
        if(event.target === modal){
            closeMoodleExportModal();
        }
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
        persistLang(lang);
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
setupMoodleExportModal();
applyI18n();
updateVisibilityWarning();
refreshAuthStatus();
