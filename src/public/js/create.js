var socket = io();

socket.on('connect', function(){
    socket.emit('requestDbNames');//Get database names to display to user
});

socket.on('gameNamesData', function(data){
    fetchWithFilters();
    fetchTags();
});

var currentFilters = {
    tags: [],
    mineOnly: false,
    search: '',
    tagMode: 'all'
};
var currentSort = 'newest';
var knownTags = [];
var currentDisplayedQuizzes = [];
var TAG_SUGGESTIONS_LIMIT = 12;
var tagSuggestionsExpanded = false;

function getTagsFromLibraryData(data){
    var tags = new Set();
    if(!data) return [];
    var entries = data || {};
    var entriesLength = Object.keys(entries).length;
    for(var i = 0; i < entriesLength; i++){
        var q = entries[i];
        if(!q) continue;
        var tgs = Array.isArray(q.tags) ? q.tags : [];
        if(!tgs.length) continue;
        tgs.forEach(function(t){
            var clean = normalizeTagSlug(t);
            if(!clean) return;
            tags.add(clean);
        });
    }
    return Array.from(tags).filter(Boolean).slice(0, 40);
}
function getTagFrequencies(data){
    var frequencies = {};
    if(!data) return frequencies;
    var entries = Array.isArray(data) ? data : Object.values(data);
    entries.forEach(function(quiz){
        if(!quiz) return;
        var tagList = Array.isArray(quiz.tags) ? quiz.tags : [];
        tagList.forEach(function(raw){
            var clean = normalizeTagSlug(raw);
            if(!clean) return;
            frequencies[clean] = (frequencies[clean] || 0) + 1;
        });
    });
    return frequencies;
}
function getQuizTimestamp(quiz){
    if(!quiz) return 0;
    var raw = quiz.createdAt || quiz.updatedAt || quiz.id;
    var parsed = Date.parse(raw);
    if(!isNaN(parsed)) return parsed;
    return 0;
}
function getQuizRatingAvg(quiz){
    var avg = Number(quiz && quiz.ratingAvg);
    return Number.isFinite(avg) ? avg : 0;
}
function getQuizRatingCount(quiz){
    var count = Number(quiz && quiz.ratingCount);
    return Number.isFinite(count) ? count : 0;
}
function sortLibraryQuizzes(quizzes){
    if(!quizzes || !quizzes.slice) return quizzes;
    var sorted = quizzes.slice();
    if(currentSort === 'newest'){
        sorted.sort(function(a, b){
            return getQuizTimestamp(b) - getQuizTimestamp(a);
        });
    }else if(currentSort === 'oldest'){
        sorted.sort(function(a, b){
            return getQuizTimestamp(a) - getQuizTimestamp(b);
        });
    }else if(currentSort === 'rating'){
        sorted.sort(function(a, b){
            var ra = getQuizRatingAvg(a);
            var rb = getQuizRatingAvg(b);
            if(ra === rb){
                var ca = getQuizRatingCount(a);
                var cb = getQuizRatingCount(b);
                if(ca === cb){
                    return getQuizTimestamp(b) - getQuizTimestamp(a);
                }
                return cb - ca;
            }
            return rb - ra;
        });
    }else if(currentSort === 'alpha-asc'){
        sorted.sort(function(a, b){
            var na = (a.name || '').toLowerCase();
            var nb = (b.name || '').toLowerCase();
            return na.localeCompare(nb);
        });
    }else if(currentSort === 'alpha-desc'){
        sorted.sort(function(a, b){
            var na = (a.name || '').toLowerCase();
            var nb = (b.name || '').toLowerCase();
            return nb.localeCompare(na);
        });
    }
    return sorted;
}
var LIBRARY_PAGE_SIZE = 12;
var libraryCurrentPage = 1;
var libraryTotalPages = 1;
var libraryLatestData = [];
var PENDING_ACCOUNT_SAVE_KEY = 'eduhoot-pending-account-save';

function normalizeTagSlug(raw){
    var clean = (raw || '').toString().trim().toLowerCase();
    if(!clean) return '';
    try{ clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }catch(e){}
    clean = clean.replace(
        /(^|[^a-z0-9])(\d+)\s*[\.\-]?\s*(º|ª|°|o|a|er|ero|era|ro|ra|do|da|to|ta|mo|ma|vo|va)(?=$|[^a-z0-9])/g,
        '$1$2'
    );
    clean = clean
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)
        .replace(/^-|-$/g, '');
    return clean;
}

function normalizeInlineTags(list){
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function(raw){
        var clean = normalizeTagSlug(raw);
        if(!clean) return;
        if(out.indexOf(clean) === -1) out.push(clean);
    });
    return out;
}

function parseTagInput(raw){
    if(!raw) return [];
    return normalizeInlineTags((raw || '').toString().split(/[,;]+/));
}

function readFiltersFromUrl(){
    try{
        var params = new URLSearchParams(window.location.search || '');
        var tagValues = params.getAll('tags');
        var singleTag = params.get('tag');
        if(singleTag) tagValues.push(singleTag);
        var exploded = [];
        tagValues.forEach(function(value){
            (value || '').split(',').forEach(function(part){ exploded.push(part); });
        });
        currentFilters.tags = normalizeInlineTags(exploded);
        currentFilters.tagMode = params.get('tagMode') === 'any' ? 'any' : 'all';
    }catch(e){}
}

function syncFiltersToUrl(){
    try{
        var url = new URL(window.location.href);
        url.searchParams.delete('tags');
        url.searchParams.delete('tag');
        url.searchParams.delete('tagMode');
        currentFilters.tags.forEach(function(tag){
            url.searchParams.append('tags', tag);
        });
        if(currentFilters.tags.length){
            url.searchParams.set('tagMode', currentFilters.tagMode || 'all');
        }
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }catch(e){}
}

readFiltersFromUrl();

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
function ownsLocal(id){
    if(id === undefined || id === null) return false;
    try{
        var stored = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
        return stored.map(function(x){ return String(x); }).indexOf(String(id)) !== -1;
    }catch(e){
        return false;
    }
}

var browserLang = (navigator.language || 'es').slice(0,2);
var lang = localStorage.getItem('lang') || (['es','en','ca'].includes(browserLang) ? browserLang : 'es');
var i18n = {
    es: {
        back: 'Volver',
        title: 'Crea y lanza tu EduHoot',
        subtitle: 'Genera con IA, importa (CSV o Kahoot) o <a id="link" href="quiz-creator/">crea un cuestionario desde cero</a>.',
        langLabel: 'Idioma',
        modalClose: 'Cerrar',
        signinEyebrow: 'Nuevo en EduHoot',
        signinTitle: 'Guarda tus cuestionarios desde el primer minuto',
        signinDesc: 'Entra con Google para tener biblioteca propia, editar después y lanzar tus juegos desde cualquier equipo.',
        accessEyebrow: 'Acceso',
        accessTitle: 'Usuarios',
        accessDesc: 'Inicia sesión para crear, editar o borrar quizzes.',
        authStatus: 'No has iniciado sesión',
        labelEmail: 'Email',
        labelPass: 'Contraseña',
        labelRole: 'Rol',
        btnSaveNick: 'Guardar nombre visible',
        btnLogin: 'Entrar',
        btnGoogleLogin: 'Entrar con Google',
        btnUseEmail: 'Usar email',
        panelExpand: 'Desplegar',
        panelCollapse: 'Ocultar',
        btnAccount: 'Cuenta',
        btnLogout: 'Cerrar sesión',
        forgotPass: '¿Olvidaste la contraseña?',
        resetEyebrow: 'Recuperar acceso',
        resetDesc: 'Te enviaremos un token (se registra en el log del servidor si no hay correo configurado). Luego úsalo para poner una nueva contraseña.',
        btnGenToken: 'Generar token',
        labelToken: 'Token recibido',
        labelNewPass: 'Nueva contraseña',
        btnChangePass: 'Cambiar contraseña',
        adminOnly: 'Solo admins',
        adminBackupTitle: 'Importar / Exportar todos los quizzes',
        adminBackupDesc: 'Crea un backup completo (JSON) o restaura todos los quizzes desde un archivo.',
        btnExportAllQuizzes: 'Exportar todos',
        labelImportAllQuizzes: 'Archivo JSON',
        adminReplaceAll: 'Reemplazar todo',
        btnImportAllQuizzes: 'Importar',
        adminImportPickFile: 'Selecciona un archivo JSON.',
        adminImportWorking: 'Importando...',
        adminImportOk: 'Importación completada.',
        adminImportError: 'No se pudo importar.',
        adminReplaceConfirm: 'Esto eliminará TODOS los quizzes existentes antes de importar. ¿Continuar?',
        adminMirrorKahootTitle: 'Migrar imágenes de Kahoot',
        adminMirrorKahootDesc: 'Descarga al servidor las imágenes de quizzes importados desde Kahoot para evitar dependencia de su CDN.',
        btnMirrorKahootImages: 'Migrar imágenes',
        mirrorKahootWorking: 'Migrando imágenes... (puede tardar varios minutos)',
        mirrorKahootOk: 'Migración iniciada. Revisa los logs del servidor.',
        mirrorKahootError: 'No se pudo iniciar la migración.',
        adminMirrorExternalTitle: 'Migrar imágenes externas (S3, etc.)',
        adminMirrorExternalDesc: 'Descarga al servidor las imágenes alojadas en servidores externos (Amazon S3 y similares) para evitar que desaparezcan si la fuente cierra.',
        btnMirrorExternalImages: 'Migrar imágenes externas',
        mirrorExternalWorking: 'Migrando imágenes externas... (puede tardar varios minutos)',
        mirrorExternalOk: 'Migración iniciada. Revisa los logs del servidor.',
        mirrorExternalError: 'No se pudo iniciar la migración.',
        createUser: 'Crea un usuario nuevo',
        roleEditor: 'Editor',
        roleAdmin: 'Admin',
        btnCreateUser: 'Crear usuario',
        labelEmailReset: 'Email a resetear',
        btnResetPass: 'Resetear contraseña',
        aiEyebrow: 'Ayuda IA',
        aiTitle: 'Generador IA (CSV)',
        aiDesc: 'Rellena los campos y copia el prompt para generar tu cuestionario por IA.',
        iaNameLabel: 'Nombre del quiz (opcional)',
        iaLevel: 'Nivel del alumnado',
        iaTopic: 'Tema del cuestionario',
        iaUseDocs: 'Usar documentos como conocimiento exclusivo',
        iaGenSvg: 'Pedir a la IA imágenes SVG',
        iaDocsHint: 'Cuando ejecutes este prompt en la IA, te pedirá que adjuntes los documentos. No subas nada aquí: adjunta los archivos allí y las preguntas se generarán exclusivamente a partir de esos documentos.',
        iaLang: 'Idioma del cuestionario',
        iaNum: 'Número de preguntas',
        iaExtra: 'Instrucciones adicionales',
        iaTypesLabel: 'Tipos de pregunta',
        iaTypeQuiz: 'Quiz (1 correcta)',
        iaTypeMultiple: 'Respuesta Múltiple',
        iaTypeTf: 'Verdadero / Falso',
        iaTypeShort: 'Respuesta corta',
        iaTypeNumeric: 'Numérica',
        btnGenPrompt: 'Generar prompt',
        btnCopyPrompt: 'Copiar prompt',
        iaStep1: 'Genera el prompt y cópialo con el botón «Copiar prompt».',
        iaStep2: 'Abre una IA (ChatGPT, Gemini, Copilot…) y pega el prompt en el chat. Si activaste «Usar documentos», adjunta tus archivos allí.',
        iaStep3: 'La IA te devolverá un bloque de texto CSV. Cópialo entero.',
        iaStep4: 'Pégalo en el cuadro de abajo y pulsa Importar CSV en el cuestionario.',
        promptPlaceholder: 'El prompt aparecerá aquí...',
        iaCsvLabel: 'Contenido CSV generado por la IA',
        btnPreviewCsv: 'Vista previa',
        btnOpenCsv: 'Abrir CSV',
        btnDownloadCsv: 'Descargar CSV',
        exportPdf: 'Exportar PDF',
        exportPdfNoAnswers: 'PDF sin respuestas',
        pdfOptions: 'Opciones PDF',
        pdfOptionNormal: 'PDF (normal)',
        pdfOptionNoAnswers: 'PDF (sin respuestas)',
        pdfOptionRandom: 'PDF (aleatorio)',
        pdfOptionRandomNoAnswers: 'PDF (aleatorio sin respuestas)',
        exportDoc: 'Exportar DOC',
        docOptions: 'Opciones DOC',
        docFormatDocx: 'DOCX',
        docFormatOdt: 'ODT',
        docOptionNormal: 'Normal',
        docOptionNoAnswers: 'Sin respuestas',
        docOptionNoImages: 'Sin imágenes',
        docOptionNoAnswersNoImages: 'Sin respuestas ni imágenes',
        docMissingLib: 'No se pudo generar el documento (librería no disponible).',
        docDownloadError: 'No se pudo descargar el documento.',
        exportSelectLabel: 'Exportar',
        exportSelectPlaceholder: 'Exportar...',
        pdfMissingLib: 'No se pudo generar el PDF (librería no disponible).',
        pdfDownloadError: 'No se pudo descargar el PDF.',
        pdfTags: 'Etiquetas',
        pdfImage: 'Imagen',
        pdfVideo: 'Vídeo',
        pdfCorrect: 'Correcta',
        pdfAcceptedAnswers: 'Respuestas válidas',
        pdfNumericAnswer: 'Respuesta',
        pdfTolerance: 'Tolerancia',
        tfTrue: 'Verdadero',
        tfFalse: 'Falso',
        btnEditCreator: 'Editar en creador',
        previewTitle: 'Vista previa',
        alertPasteCsv: 'Pega primero el CSV.',
        alertNothingToSave: 'No hay nada que guardar.',
        btnImportIa: 'Importar CSV en el cuestionario',
        kahootTitle: 'Importar Kahoot público',
        kahootHelp: 'Pega la URL o el ID de un Kahoot público.',
        kahootWarning: '⚠️ Esta función está diseñada para importar tus propios Kahoots. EduHoot no se hace responsable del mal uso de esta funcionalidad ni de posibles infracciones de derechos de autor.',
        btnImportKahoot: 'Importar desde Kahoot',
        importEyebrow: 'Importación',
        importTitle: 'Importar cuestionario (CSV o Kahoot público)',
        importDesc: 'Sube un archivo CSV con tus preguntas para guardarlo en tu biblioteca.',
        btnUploadCsv: 'Subir CSV',
        libraryEyebrow: 'Biblioteca',
        libraryTitle: 'Cuestionarios importados',
        libraryDesc: 'Selecciona un cuestionario para hostearlo o gestiona su nombre y estado.',
        searchPlaceholder: 'Buscar por nombre o etiqueta',
        suggestedTags: 'Etiquetas usadas (toca para filtrar)',
        foldersTitle: 'Carpetas',
        foldersAll: 'Todos',
        editTagsPlaceholder: 'Añadir etiqueta (se guardará sin tildes ni símbolos)',
        editTagsAdd: 'Añadir',
        editTagsNeedOne: 'Debe quedar al menos una etiqueta.',
        editTagsSaveError: 'No se pudieron guardar las etiquetas.',
        noFilters: 'Sin filtros',
        filterBy: 'Filtrando por: ',
        filterMine: 'Sólo mis cuestionarios',
        clearFilters: 'Limpiar filtros',
        filterModeAny: 'Coincide con cualquiera',
        filterModeAll: 'Coincide con todas',
        tagsShowMore: 'Ver más',
        tagsShowLess: 'Ver menos',
        matchAnyTags: 'Cualquiera de las etiquetas',
        matchAllTags: 'Todas las etiquetas',
        sortLabel: 'Ordenar por',
        sortNewest: 'Más recientes primero',
        sortOldest: 'Más antiguos primero',
        sortRating: 'Mejor valorados',
        sortAlphaAsc: 'Orden alfabético A-Z',
        sortAlphaDesc: 'Orden alfabético Z-A',
        playsShort: 'partidas',
        playersShort: 'jugadores',
        paginationPrev: 'Anterior',
        paginationNext: 'Siguiente',
        paginationPageInfo: 'Página {current} de {total}',
        play: 'Jugar en el aula',
        playSolo: 'Solo',
        playMultiplayer: 'Multijugador',
        edit: 'Editar',
        download: 'Descargar CSV',
        editQuiz: 'Editar cuestionario',
        exportMoodleXml: 'Exportar XML (Moodle)',
        rename: 'Renombrar',
        delete: 'Eliminar',
        clone: 'Hacer una copia',
        renamePrompt: 'Nuevo nombre',
        confirmDelete: '¿Eliminar este quiz?',
        cannotStartPrivate: 'Solo el propietario puede usar un quiz privado.',
        needLogin: 'Inicia sesión para realizar esta acción.',
        permissionDenied: 'No tienes permiso para realizar esta acción.',
        saveSharing: 'Guardar permisos',
        allowClone: 'Permitir copia',
        visibilityPrivate: 'Solo yo (privado)',
        visibilityUnlisted: 'Por enlace/ID',
        visibilityPublic: 'Público',
        creatorUnknown: 'Creador desconocido',
        creatorHidden: 'Creador',
        labelNick: 'Nombre visible (opcional)',
        noGames: 'No hay cuestionarios importados aún.',
        noGamesHint: 'Sube un CSV o crea uno nuevo para verlo aquí.',
        importSuccess: 'Importado',
        importing: 'Importando...',
        uploadCsv: 'Subiendo...',
        uploadCsvError: 'No se pudo importar el CSV.',
        startNow: 'Jugar en el aula',
        createUserMissing: 'Introduce email y contraseña.',
        createUserWorking: 'Creando usuario...',
        createUserOk: 'Usuario creado.',
        createUserError: 'No se pudo crear.',
        savingNick: 'Guardando nombre visible...',
        nickSaved: 'Nombre visible actualizado.',
        nickSaveError: 'No se pudo guardar.',
        loginError: 'Error al iniciar sesión.',
        googleLoginError: 'No se pudo iniciar sesión con Google.',
        loginWait: 'Iniciando sesión...',
        loginOk: 'Sesión iniciada.',
        resetWaiting: 'Enviando...',
        resetTokenSent: 'Revisa tu correo (o el log del servidor) para ver el token.',
        resetTokenError: 'No se pudo generar el token.',
        resetNeedFields: 'Completa token y nueva contraseña.',
        resetUpdating: 'Actualizando...',
        resetUpdated: 'Contraseña actualizada. Inicia sesión.',
        resetUpdateError: 'No se pudo actualizar.',
        notLogged: 'Inicia sesión para clonar un quiz.',
        cloneOk: 'Copia creada en tu biblioteca.',
        cloneError: 'No se pudo clonar.',
        saveToAccount: 'Guardar en mi cuenta',
        loginToSave: 'Inicia sesión con Google para guardar este cuestionario en tu cuenta.',
        savingToAccount: 'Guardando en tu cuenta...',
        saveToAccountOk: 'Cuestionario guardado en tu cuenta.',
        saveToAccountError: 'No se pudo guardar en tu cuenta.',
        namePlaceholder: 'Nombre del quiz (opcional)',
        selectCsv: 'Selecciona un archivo CSV.',
        downloadCsvError: 'No se pudo descargar el CSV.',
        renameError: 'No se pudo renombrar.',
        deleteError: 'No se pudo eliminar.',
        sharingError: 'No se pudieron guardar los permisos.',
        gameSingular: 'cuestionario',
        gamePlural: 'cuestionarios',
        idLabel: 'ID',
        footerLicense: 'EduHoot · Licencia GNU Affero General Public License v3.0 (AGPL-3.0)',
        footerSource: 'Código fuente',
        importError: 'Error al importar.',
        emailPlaceholder: 'tu correo',
        authNickPlaceholder: 'Tu nick público',
        resetTokenPlaceholder: 'token del email/log',
        iaLevelPlaceholder: 'Ej: 2º ESO',
        iaTopicPlaceholder: 'Ej: Energía y calor',
        iaLangCustomPlaceholder: 'Otro idioma',
        iaExtraPlaceholder: 'Tono, nivel cognitivo, formato...',
        iaCsvPlaceholder: 'Pega aquí el CSV devuelto por la IA',
        kahootUrlPlaceholder: 'URL o ID (p. ej. https://create.kahoot.it/details/... o 01234567)',
        visibilityHelp: '<strong>Solo yo:</strong> si no inicias sesión, el quiz se guarda solo en tu sesión y caduca en 24h.<br><strong>Por enlace / Público:</strong> aunque no tengas cuenta, se guardan de forma global en el servidor y sobreviven a reinicios. Si inicias sesión, quedan ligados a tu usuario. Puedes permitir o no las copias.',
        langEs: 'Español',
        langEn: 'English',
        langCa: 'Català',
        optSpanish: 'Español',
        optCatalan: 'Catalán',
        optEnglish: 'Inglés',
        optOther: 'Otro'
    },
    en: {
        back: 'Back',
        title: 'Create and launch your EduHoot',
        subtitle: 'Generate with AI, import (CSV or Kahoot), or <a id="link" href="quiz-creator/">create a quiz from scratch</a>.',
        langLabel: 'Language',
        modalClose: 'Close',
        signinEyebrow: 'New to EduHoot',
        signinTitle: 'Save your quizzes from the first minute',
        signinDesc: 'Sign in with Google to get your own library, keep editing later and launch games from any device.',
        accessEyebrow: 'Access',
        accessTitle: 'Users',
        accessDesc: 'Sign in to create, edit or delete quizzes.',
        authStatus: 'Not signed in',
        labelEmail: 'Email',
        labelPass: 'Password',
        labelRole: 'Role',
        btnSaveNick: 'Save display name',
        btnLogin: 'Log in',
        btnGoogleLogin: 'Log in with Google',
        btnUseEmail: 'Use email',
        panelExpand: 'Expand',
        panelCollapse: 'Hide',
        btnAccount: 'Account',
        btnLogout: 'Log out',
        forgotPass: 'Forgot your password?',
        resetEyebrow: 'Recover access',
        resetDesc: 'We will generate a token (check server log if no email). Use it to set a new password.',
        btnGenToken: 'Generate token',
        labelToken: 'Received token',
        labelNewPass: 'New password',
        btnChangePass: 'Change password',
        adminOnly: 'Admins only',
        adminBackupTitle: 'Import / Export all quizzes',
        adminBackupDesc: 'Create a full JSON backup or restore all quizzes from a file.',
        btnExportAllQuizzes: 'Export all',
        labelImportAllQuizzes: 'JSON file',
        adminReplaceAll: 'Replace all',
        btnImportAllQuizzes: 'Import',
        adminImportPickFile: 'Pick a JSON file.',
        adminImportWorking: 'Importing...',
        adminImportOk: 'Import completed.',
        adminImportError: 'Could not import.',
        adminReplaceConfirm: 'This will DELETE ALL existing quizzes before importing. Continue?',
        adminMirrorKahootTitle: 'Migrate Kahoot images',
        adminMirrorKahootDesc: 'Download to the server the images from Kahoot-imported quizzes to avoid dependency on their CDN.',
        btnMirrorKahootImages: 'Migrate images',
        mirrorKahootWorking: 'Migrating images... (may take several minutes)',
        mirrorKahootOk: 'Migration started. Check server logs.',
        mirrorKahootError: 'Could not start the migration.',
        adminMirrorExternalTitle: 'Migrate external images (S3, etc.)',
        adminMirrorExternalDesc: 'Download to the server images hosted on external servers (Amazon S3 and similar) to avoid losing them if the source goes offline.',
        btnMirrorExternalImages: 'Migrate external images',
        mirrorExternalWorking: 'Migrating external images... (may take several minutes)',
        mirrorExternalOk: 'Migration started. Check server logs.',
        mirrorExternalError: 'Could not start the migration.',
        createUser: 'Create a new user',
        roleEditor: 'Editor',
        roleAdmin: 'Admin',
        btnCreateUser: 'Create user',
        labelEmailReset: 'Email to reset',
        btnResetPass: 'Reset password',
        aiEyebrow: 'AI helper',
        aiTitle: 'AI generator (CSV)',
        aiDesc: 'Fill the fields and copy the prompt to generate your quiz with AI.',
        iaNameLabel: 'Quiz name (optional)',
        iaLevel: 'Students level',
        iaTopic: 'Quiz topic',
        iaUseDocs: 'Use documents as exclusive knowledge',
        iaGenSvg: 'Ask the AI to generate SVG images',
        iaDocsHint: 'When you run this prompt in the AI, it will ask you to attach the documents. Do not upload anything here: attach the files there and the questions will be generated exclusively from those documents.',
        iaLang: 'Quiz language',
        iaNum: 'Number of questions',
        iaExtra: 'Extra instructions',
        iaTypesLabel: 'Question types',
        iaTypeQuiz: 'Quiz (1 correct)',
        iaTypeMultiple: 'Multiple answers',
        iaTypeTf: 'True / False',
        iaTypeShort: 'Short answer',
        iaTypeNumeric: 'Numeric',
        btnGenPrompt: 'Generate prompt',
        btnCopyPrompt: 'Copy prompt',
        iaStep1: 'Generate the prompt and copy it with the «Copy prompt» button.',
        iaStep2: 'Open any AI tool (ChatGPT, Gemini, Copilot…) and paste the prompt in the chat. If you enabled «Use documents», attach your files there.',
        iaStep3: 'The AI will return a block of CSV text. Copy it all.',
        iaStep4: 'Paste it in the box below and click Import CSV into the quiz.',
        promptPlaceholder: 'Prompt will appear here...',
        iaCsvLabel: 'CSV content from AI',
        btnPreviewCsv: 'Preview',
        btnOpenCsv: 'Open CSV',
        btnDownloadCsv: 'Download CSV',
        exportPdf: 'Export PDF',
        exportPdfNoAnswers: 'PDF without answers',
        pdfOptions: 'PDF options',
        pdfOptionNormal: 'PDF (standard)',
        pdfOptionNoAnswers: 'PDF (no answers)',
        pdfOptionRandom: 'PDF (random)',
        pdfOptionRandomNoAnswers: 'PDF (random, no answers)',
        exportDoc: 'Export DOC',
        docOptions: 'DOC options',
        docFormatDocx: 'DOCX',
        docFormatOdt: 'ODT',
        docOptionNormal: 'Normal',
        docOptionNoAnswers: 'No answers',
        docOptionNoImages: 'No images',
        docOptionNoAnswersNoImages: 'No answers or images',
        docMissingLib: 'Could not generate the document (library unavailable).',
        docDownloadError: 'Could not download the document.',
        exportSelectLabel: 'Export',
        exportSelectPlaceholder: 'Export...',
        pdfMissingLib: 'Could not generate the PDF (library unavailable).',
        pdfDownloadError: 'Could not download the PDF.',
        pdfTags: 'Tags',
        pdfImage: 'Image',
        pdfVideo: 'Video',
        pdfCorrect: 'Correct',
        pdfAcceptedAnswers: 'Accepted answers',
        pdfNumericAnswer: 'Answer',
        pdfTolerance: 'Tolerance',
        tfTrue: 'True',
        tfFalse: 'False',
        btnEditCreator: 'Edit in creator',
        previewTitle: 'Preview',
        alertPasteCsv: 'Paste the CSV first.',
        alertNothingToSave: 'Nothing to save.',
        btnImportIa: 'Import CSV into the quiz',
        kahootTitle: 'Import public Kahoot',
        kahootHelp: 'Paste a public Kahoot URL or ID.',
        kahootWarning: '⚠️ This feature is designed to import your own Kahoots. EduHoot is not responsible for misuse of this feature or any copyright infringement.',
        btnImportKahoot: 'Import from Kahoot',
        importEyebrow: 'Import',
        importTitle: 'Import quiz (CSV or public Kahoot)',
        importDesc: 'Upload a CSV with your questions to save it in your library.',
        btnUploadCsv: 'Upload CSV',
        libraryEyebrow: 'Library',
        libraryTitle: 'Imported quizzes',
        libraryDesc: 'Pick a quiz to host or manage its name and status.',
        searchPlaceholder: 'Search by name or tag',
        suggestedTags: 'Suggested tags (tap to filter)',
        foldersTitle: 'Folders',
        foldersAll: 'All',
        editTagsPlaceholder: 'Add tag (saved without accents or symbols)',
        editTagsAdd: 'Add',
        editTagsNeedOne: 'At least one tag is required.',
        editTagsSaveError: 'Could not save tags.',
        noFilters: 'No filters',
        filterBy: 'Filtering by: ',
        filterMine: 'Only my quizzes',
        clearFilters: 'Clear filters',
        filterModeAny: 'Matches any tag',
        tagsShowMore: 'Show more',
        tagsShowLess: 'Show less',
        filterModeAll: 'Matches all tags',
        matchAnyTags: 'Match any tag',
        matchAllTags: 'Match all tags',
        sortLabel: 'Sort by',
        sortNewest: 'Newest first',
        sortOldest: 'Oldest first',
        sortRating: 'Top rated',
        sortAlphaAsc: 'Alphabetical A-Z',
        sortAlphaDesc: 'Alphabetical Z-A',
        playsShort: 'plays',
        playersShort: 'players',
        paginationPrev: 'Previous',
        paginationNext: 'Next',
        paginationPageInfo: 'Page {current} of {total}',
        play: 'Play in the classroom',
        playSolo: 'Solo',
        playMultiplayer: 'Multiplayer',
        edit: 'Edit',
        download: 'Download CSV',
        editQuiz: 'Edit quiz',
        exportMoodleXml: 'Export Moodle XML',
        rename: 'Rename',
        delete: 'Delete',
        clone: 'Make a copy',
        renamePrompt: 'New name',
        confirmDelete: 'Delete this quiz?',
        cannotStartPrivate: 'Only the owner can use a private quiz.',
        needLogin: 'Sign in to perform this action.',
        permissionDenied: 'You don\'t have permission to perform this action.',
        saveSharing: 'Save permissions',
        allowClone: 'Allow copy',
        visibilityPrivate: 'Only me (private)',
        visibilityUnlisted: 'By link/ID',
        visibilityPublic: 'Public',
        creatorUnknown: 'Unknown creator',
        creatorHidden: 'Creator',
        labelNick: 'Display name (optional)',
        noGames: 'No quizzes yet.',
        noGamesHint: 'Upload a CSV or create one to see it here.',
        importSuccess: 'Imported',
        importing: 'Importing...',
        uploadCsv: 'Uploading...',
        uploadCsvError: 'Could not import CSV.',
        startNow: 'Play in the classroom',
        createUserMissing: 'Enter email and password.',
        createUserWorking: 'Creating user...',
        createUserOk: 'User created.',
        createUserError: 'Could not create user.',
        savingNick: 'Saving display name...',
        nickSaved: 'Display name updated.',
        nickSaveError: 'Could not save.',
        loginError: 'Login failed.',
        googleLoginError: 'Could not sign in with Google.',
        loginWait: 'Signing in...',
        loginOk: 'Session started.',
        resetWaiting: 'Sending...',
        resetTokenSent: 'Check your email or server log for the token.',
        resetTokenError: 'Could not generate the token.',
        resetNeedFields: 'Fill token and new password.',
        resetUpdating: 'Updating...',
        resetUpdated: 'Password updated. Sign in.',
        resetUpdateError: 'Could not update.',
        notLogged: 'Sign in to clone a quiz.',
        cloneOk: 'Copy created in your library.',
        cloneError: 'Could not clone.',
        saveToAccount: 'Save to my account',
        loginToSave: 'Sign in with Google to save this quiz to your account.',
        savingToAccount: 'Saving to your account...',
        saveToAccountOk: 'Quiz saved to your account.',
        saveToAccountError: 'Could not save to your account.',
        namePlaceholder: 'Quiz name (optional)',
        selectCsv: 'Select a CSV file.',
        downloadCsvError: 'Could not download the CSV.',
        renameError: 'Could not rename.',
        deleteError: 'Could not delete.',
        sharingError: 'Could not save permissions.',
        gameSingular: 'quiz',
        gamePlural: 'quizzes',
        idLabel: 'ID',
        footerLicense: 'EduHoot · GNU Affero General Public License v3.0 (AGPL-3.0)',
        footerSource: 'Source code',
        importError: 'Import failed.',
        emailPlaceholder: 'your email',
        authNickPlaceholder: 'Your public nickname',
        resetTokenPlaceholder: 'token from email/log',
        iaLevelPlaceholder: 'e.g. 8th grade',
        iaTopicPlaceholder: 'e.g. Energy and heat',
        iaLangCustomPlaceholder: 'Other language',
        iaExtraPlaceholder: 'Tone, cognitive level, format...',
        iaCsvPlaceholder: 'Paste here the CSV returned by the AI',
        kahootUrlPlaceholder: 'URL or ID (e.g. https://create.kahoot.it/details/... or 01234567)',
        visibilityHelp: '<strong>Only me:</strong> if you don\'t sign in, the quiz is stored only in your session and expires in 24h.<br><strong>By link / Public:</strong> even without an account it is stored globally on the server and survives restarts. If you sign in, it links to your user. You can allow or block copies.',
        langEs: 'Spanish',
        langEn: 'English',
        langCa: 'Catalan',
        optSpanish: 'Spanish',
        optCatalan: 'Catalan',
        optEnglish: 'English',
        optOther: 'Other'
    },
    ca: {
        back: 'Tornar',
        title: 'Crea i llança el teu EduHoot',
        subtitle: 'Genera amb IA, importa (CSV o Kahoot) o <a id="link" href="quiz-creator/">crea un qüestionari de zero</a>.',
        langLabel: 'Idioma',
        modalClose: 'Tancar',
        signinEyebrow: 'Nou a EduHoot',
        signinTitle: 'Desa els teus qüestionaris des del primer minut',
        signinDesc: 'Entra amb Google per tindre biblioteca pròpia, editar després i llançar els jocs des de qualsevol equip.',
        accessEyebrow: 'Accés',
        accessTitle: 'Usuaris',
        accessDesc: 'Inicia sessió per crear, editar o esborrar qüestionaris.',
        authStatus: 'No has iniciat sessió',
        labelEmail: 'Email',
        labelPass: 'Contrasenya',
        labelRole: 'Rol',
        btnSaveNick: 'Desar nom visible',
        btnLogin: 'Entrar',
        btnGoogleLogin: 'Entrar amb Google',
        btnUseEmail: 'Usar email',
        panelExpand: 'Desplegar',
        panelCollapse: 'Amagar',
        btnAccount: 'Compte',
        btnLogout: 'Tancar sessió',
        forgotPass: 'Has oblidat la contrasenya?',
        resetEyebrow: 'Recuperar accés',
        resetDesc: 'Generarem un token (mira el log del servidor si no hi ha correu). Després fes-lo servir per posar una nova contrasenya.',
        btnGenToken: 'Generar token',
        labelToken: 'Token rebut',
        labelNewPass: 'Nova contrasenya',
        btnChangePass: 'Canviar contrasenya',
        adminOnly: 'Només admins',
        adminBackupTitle: 'Importar / Exportar tots els qüestionaris',
        adminBackupDesc: 'Crea un backup complet (JSON) o restaura tots els qüestionaris des d\'un fitxer.',
        btnExportAllQuizzes: 'Exportar-ho tot',
        labelImportAllQuizzes: 'Fitxer JSON',
        adminReplaceAll: 'Reemplaçar-ho tot',
        btnImportAllQuizzes: 'Importar',
        adminImportPickFile: 'Selecciona un fitxer JSON.',
        adminImportWorking: 'Important...',
        adminImportOk: 'Importació completada.',
        adminImportError: 'No s\'ha pogut importar.',
        adminReplaceConfirm: 'Això eliminarà TOTS els qüestionaris existents abans d\'importar. Continuar?',
        adminMirrorKahootTitle: 'Migrar imatges de Kahoot',
        adminMirrorKahootDesc: 'Descarrega al servidor les imatges dels qüestionaris importats des de Kahoot per evitar dependència del seu CDN.',
        btnMirrorKahootImages: 'Migrar imatges',
        mirrorKahootWorking: 'Migrant imatges... (pot trigar uns minuts)',
        mirrorKahootOk: 'Migració iniciada. Comprova els logs del servidor.',
        mirrorKahootError: 'No s\'ha pogut iniciar la migració.',
        adminMirrorExternalTitle: 'Migrar imatges externes (S3, etc.)',
        adminMirrorExternalDesc: 'Descarrega al servidor les imatges allotjades en servidors externs (Amazon S3 i similars) per evitar que desapareguin si la font tanca.',
        btnMirrorExternalImages: 'Migrar imatges externes',
        mirrorExternalWorking: 'Migrant imatges externes... (pot trigar uns minuts)',
        mirrorExternalOk: 'Migració iniciada. Comprova els logs del servidor.',
        mirrorExternalError: 'No s\'ha pogut iniciar la migració.',
        createUser: 'Crea un usuari nou',
        roleEditor: 'Editor',
        roleAdmin: 'Admin',
        btnCreateUser: 'Crear usuari',
        labelEmailReset: 'Email a restablir',
        btnResetPass: 'Restablir contrasenya',
        aiEyebrow: 'Ajuda IA',
        aiTitle: 'Generador IA (CSV)',
        aiDesc: 'Omple els camps i copia el prompt per generar el qüestionari amb IA.',
        iaNameLabel: 'Nom del quiz (opcional)',
        iaLevel: 'Nivell de l\'alumnat',
        iaTopic: 'Tema del qüestionari',
        iaUseDocs: 'Usar documents com a coneixement exclusiu',
        iaGenSvg: 'Demanar a la IA imatges SVG',
        iaDocsHint: 'Quan executes aquest prompt a la IA, et demanarà adjuntar els documents. No puges res ací: adjunta els fitxers allí i les preguntes es generaran exclusivament a partir d\'aquests documents.',
        iaLang: 'Idioma del qüestionari',
        iaNum: 'Nombre de preguntes',
        iaExtra: 'Instruccions addicionals',
        iaTypesLabel: 'Tipus de pregunta',
        iaTypeQuiz: 'Quiz (1 correcta)',
        iaTypeMultiple: 'Resposta múltiple',
        iaTypeTf: 'Vertader / Fals',
        iaTypeShort: 'Resposta curta',
        iaTypeNumeric: 'Numèrica',
        btnGenPrompt: 'Generar prompt',
        btnCopyPrompt: 'Copiar prompt',
        iaStep1: 'Genera el prompt i copia\'l amb el botó «Copiar prompt».',
        iaStep2: 'Obre una IA (ChatGPT, Gemini, Copilot…) i enganxa el prompt al xat. Si has activat «Usar documents», adjunta els teus fitxers allà.',
        iaStep3: 'La IA et tornarà un bloc de text CSV. Copia\'l sencer.',
        iaStep4: 'Enganxa\'l al quadre de sota i prem Importar CSV al qüestionari.',
        promptPlaceholder: 'El prompt apareixerà aquí...',
        iaCsvLabel: 'Contingut CSV generat per la IA',
        btnPreviewCsv: 'Vista prèvia',
        btnOpenCsv: 'Obrir CSV',
        btnDownloadCsv: 'Descarregar CSV',
        exportPdf: 'Exportar PDF',
        exportPdfNoAnswers: 'PDF sense respostes',
        pdfOptions: 'Opcions PDF',
        pdfOptionNormal: 'PDF (normal)',
        pdfOptionNoAnswers: 'PDF (sense respostes)',
        pdfOptionRandom: 'PDF (aleatori)',
        pdfOptionRandomNoAnswers: 'PDF (aleatori sense respostes)',
        exportDoc: 'Exportar DOC',
        docOptions: 'Opcions DOC',
        docFormatDocx: 'DOCX',
        docFormatOdt: 'ODT',
        docOptionNormal: 'Normal',
        docOptionNoAnswers: 'Sense respostes',
        docOptionNoImages: 'Sense imatges',
        docOptionNoAnswersNoImages: 'Sense respostes ni imatges',
        docMissingLib: 'No s\'ha pogut generar el document (llibreria no disponible).',
        docDownloadError: 'No s\'ha pogut descarregar el document.',
        exportSelectLabel: 'Exportar',
        exportSelectPlaceholder: 'Exportar...',
        pdfMissingLib: 'No s\'ha pogut generar el PDF (llibreria no disponible).',
        pdfDownloadError: 'No s\'ha pogut descarregar el PDF.',
        pdfTags: 'Etiquetes',
        pdfImage: 'Imatge',
        pdfVideo: 'Vídeo',
        pdfCorrect: 'Correcta',
        pdfAcceptedAnswers: 'Respostes vàlides',
        pdfNumericAnswer: 'Resposta',
        pdfTolerance: 'Tolerància',
        tfTrue: 'Vertader',
        tfFalse: 'Fals',
        btnEditCreator: 'Editar al creador',
        previewTitle: 'Vista prèvia',
        alertPasteCsv: 'Enganxa primer el CSV.',
        alertNothingToSave: 'No hi ha res a guardar.',
        btnImportIa: 'Importar CSV al qüestionari',
        kahootTitle: 'Importar Kahoot públic',
        kahootHelp: 'Enganxa la URL o l\'ID d\'un Kahoot públic.',
        kahootWarning: '⚠️ Aquesta funció està dissenyada per importar els teus propis Kahoots. EduHoot no es fa responsable del mal ús d\'aquesta funcionalitat ni de possibles infraccions dels drets d\'autor.',
        btnImportKahoot: 'Importar des de Kahoot',
        importEyebrow: 'Importació',
        importTitle: 'Importar qüestionari (CSV o Kahoot públic)',
        importDesc: 'Puja un fitxer CSV amb les teves preguntes per desar-lo a la biblioteca.',
        btnUploadCsv: 'Pujar CSV',
        libraryEyebrow: 'Biblioteca',
        libraryTitle: 'Qüestionaris importats',
        libraryDesc: 'Selecciona un qüestionari per hostatjar-lo o gestiona el seu nom i estat.',
        searchPlaceholder: 'Cerca per nom o etiqueta',
        suggestedTags: 'Etiquetes usades (toca per filtrar)',
        foldersTitle: 'Carpetes',
        foldersAll: 'Tots',
        editTagsPlaceholder: 'Afegeix etiqueta (es desa sense accents ni símbols)',
        editTagsAdd: 'Afegir',
        editTagsNeedOne: 'Ha de quedar com a mínim una etiqueta.',
        editTagsSaveError: 'No s\'han pogut desar les etiquetes.',
        noFilters: 'Sense filtres',
        filterBy: 'Filtrant per: ',
        filterMine: 'Només els meus qüestionaris',
        clearFilters: 'Eliminar filtres',
        filterModeAny: 'Coincideix amb qualsevol etiqueta',
        filterModeAll: 'Coincideix amb totes les etiquetes',
        tagsShowMore: 'Veure més',
        tagsShowLess: 'Veure menys',
        matchAnyTags: 'Qualsevol etiqueta',
        matchAllTags: 'Totes les etiquetes',
        sortLabel: 'Ordenar per',
        sortNewest: 'Els més recents primer',
        sortOldest: 'Els més antics primer',
        sortRating: 'Més ben valorats',
        sortAlphaAsc: 'Alfabètic A-Z',
        sortAlphaDesc: 'Alfabètic Z-A',
        playsShort: 'partides',
        playersShort: 'jugadors',
        paginationPrev: 'Anterior',
        paginationNext: 'Següent',
        paginationPageInfo: 'Pàgina {current} de {total}',
        play: 'Jugar a l\'aula',
        playSolo: 'Solo',
        playMultiplayer: 'Multijugador',
        edit: 'Editar',
        download: 'Descarregar CSV',
        editQuiz: 'Editar qüestionari',
        exportMoodleXml: 'Exportar XML (Moodle)',
        rename: 'Reanomenar',
        delete: 'Eliminar',
        clone: 'Fer una còpia',
        renamePrompt: 'Nom nou',
        confirmDelete: 'Eliminar aquest quiz?',
        cannotStartPrivate: 'Només el propietari pot usar un quiz privat.',
        needLogin: 'Inicia sessió per realitzar aquesta acció.',
        permissionDenied: 'No tens permís per realitzar aquesta acció.',
        saveSharing: 'Desar permisos',
        allowClone: 'Permetre còpia',
        visibilityPrivate: 'Només jo (privat)',
        visibilityUnlisted: 'Per enllaç/ID',
        visibilityPublic: 'Públic',
        creatorUnknown: 'Creador desconegut',
        creatorHidden: 'Creador',
        labelNick: 'Nom visible (opcional)',
        noGames: 'Encara no hi ha qüestionaris.',
        noGamesHint: 'Puja un CSV o crea\'n un per veure\'l aquí.',
        importSuccess: 'Importat',
        importing: 'Important...',
        uploadCsv: 'Pujant...',
        uploadCsvError: 'No s\'ha pogut importar el CSV.',
        startNow: 'Jugar a l\'aula',
        createUserMissing: 'Introdueix email i contrasenya.',
        createUserWorking: 'Creant usuari...',
        createUserOk: 'Usuari creat.',
        createUserError: 'No s\'ha pogut crear.',
        savingNick: 'Desant nom visible...',
        nickSaved: 'Nom visible actualitzat.',
        nickSaveError: 'No s\'ha pogut desar.',
        loginError: 'Error en iniciar sessió.',
        googleLoginError: 'No s\'ha pogut iniciar sessió amb Google.',
        loginWait: 'Iniciant sessió...',
        loginOk: 'Sessió iniciada.',
        resetWaiting: 'Enviant...',
        resetTokenSent: 'Mira el correu o el log del servidor per al token.',
        resetTokenError: 'No s\'ha pogut generar el token.',
        resetNeedFields: 'Omple token i nova contrasenya.',
        resetUpdating: 'Actualitzant...',
        resetUpdated: 'Contrasenya actualitzada. Inicia sessió.',
        resetUpdateError: 'No s\'ha pogut actualitzar.',
        notLogged: 'Inicia sessió per clonar un quiz.',
        cloneOk: 'Còpia creada a la teva biblioteca.',
        cloneError: 'No s\'ha pogut clonar.',
        saveToAccount: 'Desar al meu compte',
        loginToSave: 'Inicia sessió amb Google per desar aquest qüestionari al teu compte.',
        savingToAccount: 'Desant al teu compte...',
        saveToAccountOk: 'Qüestionari desat al teu compte.',
        saveToAccountError: 'No s\'ha pogut desar al teu compte.',
        namePlaceholder: 'Nom del quiz (opcional)',
        selectCsv: 'Selecciona un fitxer CSV.',
        downloadCsvError: 'No s\'ha pogut descarregar el CSV.',
        renameError: 'No s\'ha pogut reanomenar.',
        deleteError: 'No s\'ha pogut eliminar.',
        sharingError: 'No s\'han pogut desar els permisos.',
        gameSingular: 'qüestionari',
        gamePlural: 'qüestionaris',
        idLabel: 'ID',
        footerLicense: 'EduHoot · Llicència GNU Affero General Public License v3.0 (AGPL-3.0)',
        footerSource: 'Codi font',
        importError: 'Error en importar.',
        emailPlaceholder: 'el teu correu',
        authNickPlaceholder: 'El teu nick públic',
        resetTokenPlaceholder: 'token del correu/log',
        iaLevelPlaceholder: 'Ex: 2n ESO',
        iaTopicPlaceholder: 'Ex: Energia i calor',
        iaLangCustomPlaceholder: 'Un altre idioma',
        iaExtraPlaceholder: 'To, nivell cognitiu, format...',
        iaCsvPlaceholder: 'Enganxa aquí el CSV retornat per la IA',
        kahootUrlPlaceholder: 'URL o ID (p. ex. https://create.kahoot.it/details/... o 01234567)',
        visibilityHelp: '<strong>Només jo:</strong> si no inicies sessió, el quiz es desa només a la teva sessió i caduca en 24h.<br><strong>Per enllaç / Públic:</strong> encara que no tinguis compte, es desa globalment al servidor i sobreviu a reinicis. Si inicies sessió, queda lligat al teu usuari. Pots permetre o no les còpies.',
        langEs: 'Espanyol',
        langEn: 'Anglès',
        langCa: 'Català',
        optSpanish: 'Espanyol',
        optCatalan: 'Català',
        optEnglish: 'Anglès',
        optOther: 'Un altre'
    }
};

function t(key){
    return (i18n[lang] && i18n[lang][key]) || i18n.es[key] || key;
}

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
    if(!a) a = t('tfTrue');
    if(!b) b = t('tfFalse');
    return [a, b];
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

    if(/%[0-9a-fA-F]{2}/.test(payload)){
        var lp = payload.toLowerCase();
        var endEnc = '%3c%2fsvg%3e';
        var posEnc = lp.lastIndexOf(endEnc);
        if(posEnc !== -1) return header + payload.slice(0, posEnc + endEnc.length);
        return raw;
    }

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

function dataUrlToUint8Array(dataUrl){
    var comma = dataUrl.indexOf(',');
    if(comma === -1) return new Uint8Array();
    var header = dataUrl.slice(0, comma);
    var payload = dataUrl.slice(comma + 1);
    var binary = '';
    if(/;base64/i.test(header)){
        binary = atob(payload);
    }else{
        binary = decodeURIComponent(payload);
    }
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for(var i = 0; i < len; i++){
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function ensurePngDataUrl(dataUrl){
    return new Promise(function(resolve){
        var lower = (dataUrl || '').toLowerCase();
        if(lower.startsWith('data:image/png')){
            return resolve(dataUrl);
        }
        var img = new Image();
        img.onload = function(){
            var canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 800;
            canvas.height = img.naturalHeight || img.height || 600;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = function(){ resolve(''); };
        img.src = dataUrl;
    });
}

function getImageFormatFromDataUrl(dataUrl){
    var match = /^data:image\/(png|jpeg|jpg|webp);/i.exec(dataUrl || '');
    if(!match) return '';
    var ext = match[1].toLowerCase();
    if(ext === 'png') return 'PNG';
    if(ext === 'webp') return 'WEBP';
    return 'JPEG';
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

function shuffleArray(arr){
    for(var i = arr.length - 1; i > 0; i--){
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

function normalizePdfAnswers(question, qType){
    var answers = Array.isArray(question && question.answers) ? question.answers.slice() : [];
    if(qType === 'true-false'){
        if(answers.length < 2){
            answers = getTfLabelsForPdf(question).slice();
        }else{
            answers = [answers[0] || t('tfTrue'), answers[1] || t('tfFalse')];
        }
    }else{
        while(answers.length < 4) answers.push('');
    }
    return answers;
}

function getCorrectListForPdf(question){
    var list = (question && Array.isArray(question.correctAnswers) && question.correctAnswers.length)
        ? question.correctAnswers.slice()
        : [question && question.correct];
    return list
        .map(function(v){ return parseInt(v, 10); })
        .filter(function(v){ return isFinite(v) && v > 0; });
}

function shuffleAnswersForPdf(question, qType){
    var answers = normalizePdfAnswers(question, qType);
    var items = answers.map(function(text, idx){ return { text: text, idx: idx }; });
    shuffleArray(items);
    var newAnswers = items.map(function(item){ return item.text; });
    var correct = getCorrectListForPdf(question);
    var mapped = correct.map(function(c){
        var origIdx = c - 1;
        var newIdx = items.findIndex(function(item){ return item.idx === origIdx; });
        return newIdx >= 0 ? newIdx + 1 : null;
    }).filter(function(v){ return v !== null; });
    return { answers: newAnswers, correct: mapped };
}

function applyStaticTranslations(){
    document.querySelectorAll('[data-i18n]').forEach(function(el){
        var key = el.getAttribute('data-i18n');
        // Avoid touching labels with form controls to prevent hiding inputs
        if(el.tagName === 'LABEL' && el.querySelector('input,select,textarea')){
            var textNode = Array.from(el.childNodes).find(function(node){
                if(node.nodeType === Node.TEXT_NODE && node.textContent.trim()){
                    return true;
                }
                if(node.nodeType === Node.ELEMENT_NODE && !['INPUT','SELECT','TEXTAREA'].includes(node.tagName)){
                    return true;
                }
                return false;
            });
            if(textNode){
                if(textNode.nodeType === Node.TEXT_NODE){
                    textNode.textContent = t(key) + ' ';
                }else{
                    textNode.textContent = t(key);
                }
            }else{
                var span = document.createElement('span');
                span.textContent = t(key);
                el.insertBefore(span, el.firstChild);
            }
            return;
        }
        if(key === 'subtitle' || key === 'promptPlaceholder' || key === 'visibilityHelp'){
            el.innerHTML = t(key);
        }else{
            el.textContent = t(key);
        }
    });
    var authEmail = document.getElementById('auth-email');
    if(authEmail) authEmail.placeholder = t('emailPlaceholder');
    var authPass = document.getElementById('auth-pass');
    if(authPass) authPass.placeholder = '••••••••';
    var authNick = document.getElementById('auth-nick');
    if(authNick) authNick.placeholder = t('authNickPlaceholder');
    var resetEmail = document.getElementById('reset-email');
    if(resetEmail) resetEmail.placeholder = t('emailPlaceholder');
    var resetToken = document.getElementById('reset-token');
    if(resetToken) resetToken.placeholder = t('resetTokenPlaceholder');
    var resetPass = document.getElementById('reset-pass');
    if(resetPass) resetPass.placeholder = '••••••••';
    var newUserEmail = document.getElementById('new-user-email');
    if(newUserEmail) newUserEmail.placeholder = t('emailPlaceholder');
    var newUserPass = document.getElementById('new-user-pass');
    if(newUserPass) newUserPass.placeholder = '••••••••';
    var newUserNick = document.getElementById('new-user-nick');
    if(newUserNick) newUserNick.placeholder = t('authNickPlaceholder');
        var resetAdminEmail = document.getElementById('reset-admin-email');
        if(resetAdminEmail) resetAdminEmail.placeholder = t('emailPlaceholder');
        var resetAdminPass = document.getElementById('reset-admin-pass');
        if(resetAdminPass) resetAdminPass.placeholder = '••••••••';
        var iaName = document.getElementById('ia-name');
    if(iaName) iaName.placeholder = t('namePlaceholder');
    var iaNivel = document.getElementById('ia-nivel');
    if(iaNivel) iaNivel.placeholder = t('iaLevelPlaceholder');
    var iaTema = document.getElementById('ia-tema');
    if(iaTema) iaTema.placeholder = t('iaTopicPlaceholder');
    var iaLangCustom = document.getElementById('ia-idioma-custom');
    if(iaLangCustom) iaLangCustom.placeholder = t('iaLangCustomPlaceholder');
    var iaExtra = document.getElementById('ia-extra');
    if(iaExtra) iaExtra.placeholder = t('iaExtraPlaceholder');
    var iaCsv = document.getElementById('ia-csv');
    if(iaCsv) iaCsv.placeholder = t('iaCsvPlaceholder');
    var csvName = document.getElementById('csv-name');
    if(csvName) csvName.placeholder = t('namePlaceholder');
    var kahootUrl = document.getElementById('kahoot-url');
    if(kahootUrl) kahootUrl.placeholder = t('kahootUrlPlaceholder');
    var langSelect = document.getElementById('lang-select');
    if(langSelect) langSelect.value = lang;
    var libSearch = document.getElementById('library-search');
    if(libSearch && i18n[lang] && i18n[lang].searchPlaceholder) libSearch.placeholder = t('searchPlaceholder');
}

function setLang(newLang){
    lang = newLang;
    localStorage.setItem('lang', lang);
    applyStaticTranslations();
    renderTagSuggestions();
    socket.emit('requestDbNames');
}

function fetchWithFilters(){
    var query = '';
    libraryCurrentPage = 1;
    currentFilters.tags = normalizeInlineTags(currentFilters.tags);
    syncFiltersToUrl();
    if(currentFilters.tags.length){
        var parts = currentFilters.tags.map(function(t){ return 'tags=' + encodeURIComponent(t); });
        query = '?' + parts.join('&');
        query += '&tagMode=' + encodeURIComponent(currentFilters.tagMode || 'any');
    }
    try{
        var localIds = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
        if(localIds.length){
            query += (query ? '&' : '?') + 'localIds=' + localIds.join(',');
        }
    }catch(e){}
    if(currentFilters.mineOnly){
        query += (query ? '&' : '?') + 'mine=1';
    }
    var headers = {};
    var anonToken = getAnonOwnerToken();
    if(anonToken){
        headers['X-Owner-Token'] = anonToken;
    }
    fetch('/api/quizzes' + query, { headers: headers, credentials: 'include' })
        .then(function(res){ return res.json(); })
        .then(function(data){
            libraryLatestData = data || [];
            renderGames(libraryLatestData);
            renderTagSuggestions();
        })
        .catch(function(){
            libraryLatestData = [];
            renderGames([]);
            renderTagSuggestions();
        });
}

function toggleTagFilter(tag){
    tag = normalizeTagSlug(tag);
    if(!tag) return;
    var idx = currentFilters.tags.indexOf(tag);
    if(idx === -1){
        currentFilters.tags.push(tag);
    }else{
        currentFilters.tags.splice(idx, 1);
    }
    fetchWithFilters();
}

function clearFilters(){
    var hasSearch = currentFilters.search && currentFilters.search.trim();
    if(!currentFilters.tags.length && !currentFilters.mineOnly && !hasSearch){
        return;
    }
    currentFilters.tags = [];
    currentFilters.mineOnly = false;
    currentFilters.search = '';
    currentFilters.tagMode = 'all';
    var searchInput = document.getElementById('library-search');
    if(searchInput){
        searchInput.value = '';
    }
    var mineCheckbox = document.getElementById('filter-mine');
    if(mineCheckbox){
        mineCheckbox.checked = false;
    }
    fetchWithFilters();
}

function toggleTagMode(){
    currentFilters.tagMode = currentFilters.tagMode === 'all' ? 'any' : 'all';
    renderTagModeToggle();
    if(currentFilters.tags.length){
        fetchWithFilters();
    }
}

function renderTagModeToggle(){
    var toggle = document.getElementById('tag-mode-toggle');
    if(!toggle) return;
    if(currentFilters.tagMode === 'all'){
        toggle.textContent = t('matchAllTags');
        toggle.classList.add('is-active');
        toggle.setAttribute('aria-pressed', 'true');
    }else{
        toggle.textContent = t('matchAnyTags');
        toggle.classList.remove('is-active');
        toggle.setAttribute('aria-pressed', 'false');
    }
}

function renderTagSuggestions(){
    var wrap = document.getElementById('tag-suggestions');
    if(!wrap) return;
    wrap.innerHTML = '';
    renderTagModeToggle();
    var tagsToShow;
    var tagSource;
    if(currentFilters.tags.length){
        tagSource = currentDisplayedQuizzes;
        tagsToShow = getTagsFromLibraryData(tagSource);
    }else if(currentFilters.mineOnly){
        tagSource = libraryLatestData;
        tagsToShow = getTagsFromLibraryData(tagSource);
    }else{
        tagSource = libraryLatestData;
        tagsToShow = knownTags;
    }
    if(!tagsToShow.length){
        return;
    }
    var freqMap = getTagFrequencies(tagSource);
    var freqValues = Object.keys(freqMap).map(function(k){ return freqMap[k]; });
    var maxFreq = freqValues.length ? Math.max.apply(null, freqValues) : 1;
    var normalizedMax = Math.max(1, maxFreq);

    function tagSort(a, b){
        var ca = freqMap[a] || 0;
        var cb = freqMap[b] || 0;
        if(cb !== ca) return cb - ca;
        return String(a).toLowerCase().localeCompare(String(b).toLowerCase());
    }

    var allTags = tagsToShow.slice();
    // Asegurar que las etiquetas seleccionadas siempre aparecen.
    currentFilters.tags.forEach(function(sel){
        if(allTags.indexOf(sel) === -1) allTags.unshift(sel);
        if(freqMap[sel] === undefined) freqMap[sel] = 0;
    });
    allTags.sort(tagSort);

    var selected = currentFilters.tags.slice();
    var maxVisible = Math.max(TAG_SUGGESTIONS_LIMIT, selected.length);
    var visibleTags = [];
    selected.forEach(function(t){
        if(visibleTags.indexOf(t) === -1) visibleTags.push(t);
    });
    if(!tagSuggestionsExpanded){
        for(var i = 0; i < allTags.length && visibleTags.length < maxVisible; i++){
            var tName = allTags[i];
            if(visibleTags.indexOf(tName) !== -1) continue;
            visibleTags.push(tName);
        }
    }else{
        visibleTags = allTags.slice();
    }

    var remaining = Math.max(0, allTags.length - visibleTags.length);
    var label = document.createElement('span');
    label.className = 'label';
    label.textContent = t('foldersTitle');
    wrap.appendChild(label);

    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'tag' + (currentFilters.tags.length === 0 ? ' active' : '');
    allBtn.textContent = t('foldersAll');
    allBtn.style.setProperty('--tag-weight', 0.3);
    allBtn.onclick = function(){
        currentFilters.tags = [];
        syncFiltersToUrl();
        fetchWithFilters();
    };
    wrap.appendChild(allBtn);

    visibleTags.forEach(function(tag){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tag' + (currentFilters.tags.indexOf(tag) !== -1 ? ' active' : '');
        btn.textContent = tag;
        var tagCount = freqMap[tag] || 0;
        var normalizedWeight = normalizedMax ? Math.min(1, tagCount / normalizedMax) : 0;
        btn.style.setProperty('--tag-weight', normalizedWeight);
        btn.setAttribute('data-weight', normalizedWeight.toFixed(2));
        btn.onclick = function(){ toggleTagFilter(tag); };
        wrap.appendChild(btn);
    });

    if(allTags.length > maxVisible){
        var toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'tag tag-more';
        toggleBtn.style.setProperty('--tag-weight', 0);
        if(tagSuggestionsExpanded){
            toggleBtn.textContent = t('tagsShowLess');
        }else{
            toggleBtn.textContent = t('tagsShowMore') + (remaining ? ' (' + remaining + ')' : '');
        }
        toggleBtn.onclick = function(){
            tagSuggestionsExpanded = !tagSuggestionsExpanded;
            renderTagSuggestions();
        };
        wrap.appendChild(toggleBtn);
    }
    renderTagModeToggle();
}

var mineFilter = document.getElementById('filter-mine');
if(mineFilter){
    mineFilter.addEventListener('change', function(){
        currentFilters.mineOnly = mineFilter.checked;
        fetchWithFilters();
    });
}
var clearFiltersBtn = document.getElementById('clear-filters');
if(clearFiltersBtn){
    clearFiltersBtn.addEventListener('click', clearFilters);
}
var tagModeToggleBtn = document.getElementById('tag-mode-toggle');
if(tagModeToggleBtn){
    tagModeToggleBtn.addEventListener('click', toggleTagMode);
    renderTagModeToggle();
}

var librarySearch = document.getElementById('library-search');
if(librarySearch){
    librarySearch.addEventListener('input', function(){
        currentFilters.search = librarySearch.value || '';
        fetchWithFilters();
    });
}

var librarySortSelect = document.getElementById('library-sort');
if(librarySortSelect){
    librarySortSelect.value = currentSort;
    librarySortSelect.addEventListener('change', function(){
        currentSort = librarySortSelect.value;
        libraryCurrentPage = 1;
        renderGames(libraryLatestData);
    });
}

var paginationPrevBtn = document.getElementById('library-pagination-prev');
if(paginationPrevBtn){
    paginationPrevBtn.addEventListener('click', function(){
        if(libraryCurrentPage <= 1) return;
        libraryCurrentPage -= 1;
        renderGames(libraryLatestData);
    });
}
var paginationNextBtn = document.getElementById('library-pagination-next');
if(paginationNextBtn){
    paginationNextBtn.addEventListener('click', function(){
        if(libraryCurrentPage >= libraryTotalPages) return;
        libraryCurrentPage += 1;
        renderGames(libraryLatestData);
    });
}

function fetchTags(){
    var headers = {};
    var anonToken = getAnonOwnerToken();
    if(anonToken){
        headers['X-Owner-Token'] = anonToken;
    }
    return fetch('/api/tags', { credentials: 'include', headers: headers })
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

function renderGames(data){
    var div = document.getElementById('game-list');
    var count = document.getElementById('game-count');
    var filterInfo = document.getElementById('filter-info');
    if(!div) return;

    var sourceData = data || libraryLatestData;
    libraryLatestData = sourceData || [];

    div.innerHTML = '';
    var quizzes = [];
    var entries = sourceData || {};
    var entriesLength = Object.keys(entries).length;
    for(var i = 0; i < entriesLength; i++){
        quizzes.push(entries[i]);
    }

    if(currentFilters.search && currentFilters.search.trim()){
        var ql = currentFilters.search.trim().toLowerCase();
        var qlTag = normalizeTagSlug(ql);
        quizzes = quizzes.filter(function(q){
            var name = (q.name || '').toLowerCase();
            var tags = Array.isArray(q.tags) ? q.tags.map(function(t){ return normalizeTagSlug(t); }) : [];
            var matchName = name.includes(ql);
            var matchTag = tags.some(function(t){ return t.includes(qlTag || ql); });
            return matchName || matchTag;
        });
    }
    currentDisplayedQuizzes = quizzes.slice();

    quizzes = sortLibraryQuizzes(quizzes);

    if(count){
        var singular = t('gameSingular');
        var plural = t('gamePlural');
        count.textContent = quizzes.length + ' ' + (quizzes.length === 1 ? singular : plural);
    }
    if(filterInfo){
        var parts = [];
        if(currentFilters.tags.length){
            parts.push(t('filterBy') + currentFilters.tags.join(', '));
            parts.push(currentFilters.tagMode === 'all' ? t('filterModeAll') : t('filterModeAny'));
        }
        if(currentFilters.mineOnly){
            parts.push(t('filterMine'));
        }
        filterInfo.textContent = parts.length ? parts.join(' · ') : t('noFilters');
    }

    var totalQuizzes = quizzes.length;
    libraryTotalPages = Math.max(1, Math.ceil(totalQuizzes / LIBRARY_PAGE_SIZE));
    if(libraryCurrentPage > libraryTotalPages){
        libraryCurrentPage = libraryTotalPages;
    }
    if(libraryCurrentPage < 1){
        libraryCurrentPage = 1;
    }

    if(totalQuizzes === 0){
        var empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.innerHTML = '<p>'+t('noGames')+'</p><p>'+t('noGamesHint')+'</p>';
        div.appendChild(empty);
        libraryCurrentPage = 1;
        libraryTotalPages = 1;
        updatePaginationControls(false);
        return;
    }

    var startIndex = (libraryCurrentPage - 1) * LIBRARY_PAGE_SIZE;
    var pageQuizzes = quizzes.slice(startIndex, startIndex + LIBRARY_PAGE_SIZE);
    updatePaginationControls(libraryTotalPages > 1);

    pageQuizzes.forEach(function(quiz){
        var card = document.createElement('div');
        card.className = 'game-card';

        var head = document.createElement('div');
        head.className = 'game-card-head';

        var title = document.createElement('div');
        title.className = 'game-title';
        title.textContent = quiz.name || 'Quiz sin nombre';

        var badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = (t('idLabel') || 'ID') + ' ' + quiz.id;

        head.appendChild(title);
        head.appendChild(badge);

        var subtitle = document.createElement('p');
        subtitle.className = 'game-subtitle';
        subtitle.textContent = '';

        var meta = document.createElement('div');
        meta.className = 'game-meta';
        var visibilityLabel = quiz.visibility === 'private' ? t('visibilityPrivate') : (quiz.visibility === 'unlisted' ? t('visibilityUnlisted') : t('visibilityPublic'));
        var creatorText = quiz.ownerNickname ? quiz.ownerNickname : t('creatorUnknown');
        meta.textContent = creatorText + ' · ' + visibilityLabel;
        if(quiz.sourceQuizId){
            var basedOnLabel = (lang === 'en' ? 'Based on ' : (lang === 'ca' ? 'Basat en ' : 'Basado en '));
            var fromName = (quiz.sourceQuizName || '').trim();
            var sourceText = fromName ? ('"' + fromName + '"') : ('ID ' + quiz.sourceQuizId);
            if(fromName && quiz.sourceQuizId){
                sourceText += ' (ID ' + quiz.sourceQuizId + ')';
            }
            var sourceAuthor = (quiz.sourceOwnerNickname || '').trim();
            var sourceByLabel = (lang === 'en' ? 'by ' : (lang === 'ca' ? 'de ' : 'de '));
            meta.textContent += ' · ' + basedOnLabel + sourceText + (sourceAuthor ? (' · ' + sourceByLabel + sourceAuthor) : '');
        }
        var stats = document.createElement('div');
        stats.className = 'game-stats';
        var plays = quiz.playsCount || 0;
        var players = quiz.playersCount || 0;
        var statPlays = document.createElement('span');
        statPlays.className = 'game-stats__item';
        statPlays.textContent = plays + ' ' + t('playsShort');
        var statPlayers = document.createElement('span');
        statPlayers.className = 'game-stats__item';
        statPlayers.textContent = players + ' ' + t('playersShort');
        stats.appendChild(statPlays);
        stats.appendChild(statPlayers);

        var canEdit = false;
        if(authState.user){
            if(authState.user.role === 'admin') canEdit = true;
            else if(!quiz.ownerId) canEdit = true;
            else if(authState.user.id && quiz.ownerId && authState.user.id === quiz.ownerId.toString()) canEdit = true;
        }else if(ownsLocal(quiz.id)){
            canEdit = true;
        }
        var canStart = quiz.visibility !== 'private' || canEdit;
        var canClone = authState.user && (quiz.allowClone || canEdit);
        var canSaveToAccount = !authState.user && canEdit;

        async function updateQuizTags(id, nextTags){
            try{
                var headers = { 'Content-Type': 'application/json' };
                if(getAnonOwnerToken()){
                    headers['X-Owner-Token'] = getAnonOwnerToken();
                }
                var res = await fetch('/api/quizzes/' + id + '/tags', {
                    method: 'PATCH',
                    headers: headers,
                    credentials: 'include',
                    body: JSON.stringify({ tags: nextTags })
                });
                var body = {};
                try{ body = await res.json(); }catch(e){}
                if(!res.ok){
                    alert((body && body.error) || t('editTagsSaveError'));
                    return false;
                }
                socket.emit('requestDbNames');
                fetchTags();
                return true;
            }catch(err){
                alert(t('editTagsSaveError'));
                return false;
            }
        }

        var tagWrap = document.createElement('div');
        tagWrap.className = 'tag-wrap';
        var tags = normalizeInlineTags(Array.isArray(quiz.tags) ? quiz.tags : []);
        if(tags.length){
            tags.forEach(function(tagValue){
                if(!canEdit){
                    var tag = document.createElement('span');
                    tag.className = 'tag';
                    tag.textContent = tagValue;
                    tag.onclick = function(){ toggleTagFilter(tagValue); };
                    tagWrap.appendChild(tag);
                    return;
                }

                var tagEl = document.createElement('span');
                tagEl.className = 'tag tag-editable';

                var tagText = document.createElement('span');
                tagText.className = 'tag-text';
                tagText.textContent = tagValue;
                tagText.onclick = function(){ toggleTagFilter(tagValue); };

                var removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'tag-remove';
                removeBtn.setAttribute('aria-label', 'Remove');
                removeBtn.textContent = '×';
                removeBtn.onclick = async function(ev){
                    ev.preventDefault();
                    ev.stopPropagation();
                    if(tags.length <= 1){
                        alert(t('editTagsNeedOne'));
                        return;
                    }
                    var next = tags.filter(function(x){ return x !== tagValue; });
                    await updateQuizTags(quiz.id, next);
                };

                tagEl.appendChild(tagText);
                tagEl.appendChild(removeBtn);
                tagWrap.appendChild(tagEl);
            });
        }

        var tagEditor = null;
        if(canEdit){
            tagEditor = document.createElement('div');
            tagEditor.className = 'tag-editor';
            var tagInput = document.createElement('input');
            tagInput.type = 'text';
            tagInput.placeholder = t('editTagsPlaceholder');

            var addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'btn btn-ghost btn-small';
            addBtn.textContent = t('editTagsAdd');

            async function submitTags(){
                var raw = (tagInput.value || '').trim();
                if(!raw) return;
                var parsed = parseTagInput(raw);
                if(!parsed.length){
                    tagInput.value = '';
                    return;
                }
                var next = normalizeInlineTags(tags.concat(parsed));
                tagInput.value = '';
                await updateQuizTags(quiz.id, next);
            }

            addBtn.onclick = function(){ submitTags(); };
            tagInput.addEventListener('keydown', function(e){
                if(e.key === 'Enter'){
                    e.preventDefault();
                    submitTags();
                }
                if(e.key === ','){
                    // permite pegar/teclear y añadir rápido
                    setTimeout(function(){ submitTags(); }, 0);
                }
            });

            tagEditor.appendChild(tagInput);
            tagEditor.appendChild(addBtn);
        }

        var actions = document.createElement('div');
        actions.className = 'game-actions';

        if(canSaveToAccount){
            var saveAccountBtn = document.createElement('button');
            saveAccountBtn.className = 'btn btn-primary';
            saveAccountBtn.textContent = t('saveToAccount');
            saveAccountBtn.onclick = function(){
                claimQuizToAccount(quiz.id);
            };
            actions.appendChild(saveAccountBtn);
        }

        var playBtn = document.createElement('button');
        playBtn.className = 'btn btn-primary';
        playBtn.textContent = t('play');
        playBtn.onclick = function(){
            if(!canStart){
                warnNoPermission(t('cannotStartPrivate'));
                return;
            }
            startGame(quiz.id);
        };
        if(!canStart) playBtn.title = t('cannotStartPrivate');

        var soloBtn = document.createElement('button');
        soloBtn.className = 'btn btn-ghost';
        soloBtn.textContent = t('playSolo');
        soloBtn.onclick = function(){
            if(!canStart){
                warnNoPermission(t('cannotStartPrivate'));
                return;
            }
            startSolo(quiz.id);
        };
        if(!canStart) soloBtn.title = t('cannotStartPrivate');

        var mpBtn = document.createElement('button');
        mpBtn.className = 'btn btn-ghost';
        mpBtn.textContent = t('playMultiplayer');
        mpBtn.onclick = function(){
            if(!canStart){
                warnNoPermission(t('cannotStartPrivate'));
                return;
            }
            startMultiplayer(quiz.id);
        };
        if(!canStart) mpBtn.title = t('cannotStartPrivate');

        var editBtn = document.createElement('button');
        editBtn.className = 'btn btn-ghost icon-only';
        editBtn.innerHTML = '✏️';
        editBtn.title = t('edit');
        editBtn.onclick = function(){
            if(!canEdit){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            window.location.href = '/create/quiz-creator/?id=' + quiz.id;
        };

        var downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-ghost icon-only';
        downloadBtn.innerHTML = '⬇️';
        downloadBtn.title = t('download');
        downloadBtn.onclick = function(){
            downloadCsv(quiz.id);
        };

        var moodleXmlBtn = document.createElement('button');
        moodleXmlBtn.className = 'btn btn-ghost icon-only';
        var moodleIcon = document.createElement('img');
        moodleIcon.src = '/icons/moodle.png';
        moodleIcon.alt = 'Moodle';
        moodleIcon.className = 'moodle-icon-img';
        moodleXmlBtn.appendChild(moodleIcon);
        moodleXmlBtn.title = t('exportMoodleXml');
        moodleXmlBtn.onclick = function(){
            downloadMoodleXml(quiz.id);
        };

        var exportSelect = document.createElement('select');
        exportSelect.className = 'export-select';
        exportSelect.setAttribute('aria-label', t('exportSelectLabel'));
        exportSelect.title = t('exportSelectLabel');
        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = t('exportSelectPlaceholder');
        placeholder.selected = true;
        placeholder.disabled = true;
        exportSelect.appendChild(placeholder);

        var pdfGroup = document.createElement('optgroup');
        pdfGroup.label = 'PDF';
        [
            { value: 'pdf-normal', label: t('pdfOptionNormal') },
            { value: 'pdf-no-answers', label: t('pdfOptionNoAnswers') },
            { value: 'pdf-random', label: t('pdfOptionRandom') },
            { value: 'pdf-random-no-answers', label: t('pdfOptionRandomNoAnswers') }
        ].forEach(function(opt){
            var option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            pdfGroup.appendChild(option);
        });

        var docxGroup = document.createElement('optgroup');
        docxGroup.label = 'DOCX';
        [
            { value: 'docx-normal', label: t('docOptionNormal') },
            { value: 'docx-no-answers', label: t('docOptionNoAnswers') },
            { value: 'docx-no-images', label: t('docOptionNoImages') },
            { value: 'docx-no-answers-no-images', label: t('docOptionNoAnswersNoImages') }
        ].forEach(function(opt){
            var option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            docxGroup.appendChild(option);
        });

        var odtGroup = document.createElement('optgroup');
        odtGroup.label = 'ODT';
        [
            { value: 'odt-normal', label: t('docOptionNormal') },
            { value: 'odt-no-answers', label: t('docOptionNoAnswers') },
            { value: 'odt-no-images', label: t('docOptionNoImages') },
            { value: 'odt-no-answers-no-images', label: t('docOptionNoAnswersNoImages') }
        ].forEach(function(opt){
            var option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            odtGroup.appendChild(option);
        });

        exportSelect.appendChild(pdfGroup);
        exportSelect.appendChild(docxGroup);
        exportSelect.appendChild(odtGroup);

        exportSelect.onchange = function(){
            var choice = exportSelect.value || '';
            if(!choice) return;
            var includeAnswers = !choice.includes('no-answers');
            var includeImages = !choice.includes('no-images');
            if(choice.indexOf('pdf-') === 0){
                var isRandom = choice.indexOf('random') !== -1;
                downloadPdf(quiz.id, {
                    includeAnswers: includeAnswers,
                    shuffleQuestions: isRandom,
                    shuffleAnswers: isRandom
                });
            }else if(choice.indexOf('docx-') === 0){
                downloadDocx(quiz.id, { includeAnswers: includeAnswers, includeImages: includeImages });
            }else if(choice.indexOf('odt-') === 0){
                downloadOdt(quiz.id, { includeAnswers: includeAnswers, includeImages: includeImages });
            }
            exportSelect.value = '';
        };

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger icon-only';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = t('delete');
        deleteBtn.onclick = function(){
            if(!canEdit){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            if(confirm(t('confirmDelete'))){
                deleteQuiz(quiz.id);
            }
        };

        actions.appendChild(playBtn);
        actions.appendChild(mpBtn);
        actions.appendChild(soloBtn);
        actions.appendChild(editBtn);
        actions.appendChild(downloadBtn);
        actions.appendChild(moodleXmlBtn);

        var cloneBtn = document.createElement('button');
        cloneBtn.className = 'btn btn-ghost icon-only';
        cloneBtn.innerHTML = '📄';
        cloneBtn.title = t('clone');
        cloneBtn.onclick = function(){
            if(!canClone){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            cloneQuiz(quiz.id);
        };
        actions.appendChild(cloneBtn);
        actions.appendChild(deleteBtn);
        actions.appendChild(exportSelect);

        var share = document.createElement('div');
        share.className = 'share-controls';
        var shareTitle = document.createElement('div');
        shareTitle.className = 'share-row';
        shareTitle.innerHTML = '<strong>'+t('saveSharing')+'</strong>';

        var shareRow = document.createElement('div');
        shareRow.className = 'share-row';
        var select = document.createElement('select');
        var optPrivate = document.createElement('option');
        optPrivate.value = 'private';
        optPrivate.textContent = t('visibilityPrivate');
        var optUnlisted = document.createElement('option');
        optUnlisted.value = 'unlisted';
        optUnlisted.textContent = t('visibilityUnlisted');
        var optPublic = document.createElement('option');
        optPublic.value = 'public';
        optPublic.textContent = t('visibilityPublic');
        select.appendChild(optPrivate);
        select.appendChild(optUnlisted);
        select.appendChild(optPublic);
        select.value = quiz.visibility || 'public';
        select.disabled = !canEdit;

        var cloneLabel = document.createElement('label');
        cloneLabel.className = 'checkbox-label';
        var cloneCheck = document.createElement('input');
        cloneCheck.type = 'checkbox';
        cloneCheck.checked = !!quiz.allowClone;
        cloneCheck.disabled = !canEdit;
        cloneLabel.appendChild(cloneCheck);
        cloneLabel.appendChild(document.createTextNode(t('allowClone')));

        var shareBtn = document.createElement('button');
        shareBtn.className = 'btn btn-ghost';
        shareBtn.textContent = t('saveSharing');
        shareBtn.onclick = function(){
            if(!canEdit){
                warnNoPermission(authState.user ? t('permissionDenied') : t('needLogin'));
                return;
            }
            updateSharing(quiz.id, select.value, cloneCheck.checked);
        };

        shareRow.appendChild(select);
        shareRow.appendChild(cloneLabel);
        shareRow.appendChild(shareBtn);
        share.appendChild(shareTitle);
        share.appendChild(shareRow);

        card.appendChild(head);
        card.appendChild(subtitle);
        card.appendChild(meta);
        card.appendChild(stats);
        card.appendChild(tagWrap);
        if(tagEditor) card.appendChild(tagEditor);
        card.appendChild(share);
        card.appendChild(actions);
        div.appendChild(card);
    });
}

function updatePaginationControls(visible){
    var pagination = document.getElementById('library-pagination');
    if(!pagination) return;
    pagination.classList.toggle('hidden', !visible);
    var info = document.getElementById('library-pagination-info');
    if(info){
        var template = t('paginationPageInfo');
        info.textContent = template.replace('{current}', libraryCurrentPage).replace('{total}', libraryTotalPages);
    }
    var prevBtn = document.getElementById('library-pagination-prev');
    var nextBtn = document.getElementById('library-pagination-next');
    if(prevBtn){
        prevBtn.disabled = libraryCurrentPage <= 1;
    }
    if(nextBtn){
        nextBtn.disabled = libraryCurrentPage >= libraryTotalPages;
    }
}

function startGame(data){
    window.location.href="/host/" + "?id=" + data;
}

function startSolo(data){
    window.location.href = "/solo/" + "?id=" + encodeURIComponent(data);
}

function startMultiplayer(data){
    window.location.href = "/multiplayer/" + "?id=" + encodeURIComponent(data);
}

async function renameQuiz(id, name){
    try{
        var headers = { 'Content-Type': 'application/json' };
        if(getAnonOwnerToken()){
            headers['X-Owner-Token'] = getAnonOwnerToken();
        }
        var res = await fetch('/api/quizzes/' + id, {
            method: 'PATCH',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify({ name: name })
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('renameError') || t('saveError'));
            return;
        }
        socket.emit('requestDbNames');
    }catch(err){
        alert(t('renameError') || t('saveError'));
    }
}

async function deleteQuiz(id){
    try{
        var headers = {};
        if(getAnonOwnerToken()){
            headers['X-Owner-Token'] = getAnonOwnerToken();
        }
        var res = await fetch('/api/quizzes/' + id, { method: 'DELETE', credentials: 'include', headers: headers });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('deleteError'));
            return;
        }
        socket.emit('requestDbNames');
    }catch(err){
        alert(t('deleteError'));
    }
}

async function updateSharing(id, visibility, allowClone){
    try{
        var headers = { 'Content-Type': 'application/json' };
        if(getAnonOwnerToken()){
            headers['X-Owner-Token'] = getAnonOwnerToken();
        }
        var res = await fetch('/api/quizzes/' + id + '/sharing', {
            method: 'PATCH',
            headers: headers,
            credentials: 'include',
            body: JSON.stringify({ visibility: visibility, allowClone: allowClone })
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('sharingError') || t('saveError'));
            return;
        }
        if(result.migrated && result.id){
            try{
                var stored = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
                var idx = stored.map(function(x){ return String(x); }).indexOf(String(id));
                if(idx !== -1){
                    stored.splice(idx, 1);
                }
                var resultExists = stored.some(function(x){ return String(x) === String(result.id); });
                if(!resultExists){
                    stored.push(result.id);
                }
                localStorage.setItem('localQuizzes', JSON.stringify(stored));
            }catch(e){}
        }
        socket.emit('requestDbNames');
    }catch(err){
        alert(t('sharingError') || t('saveError'));
    }
}

async function cloneQuiz(id){
    if(!authState.user){
        alert(t('notLogged'));
        return;
    }
    try{
        var res = await fetch('/api/quizzes/' + id + '/clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        var result = await res.json();
        if(!res.ok){
            alert(result.error || t('cloneError'));
            return;
        }
        alert(t('cloneOk'));
        socket.emit('requestDbNames');
    }catch(err){
        alert(t('cloneError'));
    }
}

function downloadCsv(id){
    fetch('/api/quizzes/' + id + '/csv')
        .then(function(res){
            if(!res.ok){
                    return res.json().then(function(body){
                    alert((body && body.error) || t('downloadCsvError'));
                    throw new Error('Download failed');
                }).catch(function(){
                    alert(t('downloadCsvError'));
                    throw new Error('Download failed');
                });
            }
            var name = res.headers.get('Content-Disposition') || '';
            var match = name.match(/filename=\"?([^\";]+)\"?/i);
            var filename = match && match[1] ? match[1] : ('quiz-' + id + '.csv');
            return res.blob().then(function(blob){
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            });
        })
        .catch(function(){
            // ya se alertó
        });
}

function downloadMoodleXml(id){
    fetch('/api/quizzes/' + id + '/moodle-xml', { credentials: 'include' })
        .then(function(res){
            if(!res.ok){
                return res.json().then(function(body){
                    alert((body && body.error) || t('downloadCsvError'));
                    throw new Error('Download failed');
                }).catch(function(){
                    alert(t('downloadCsvError'));
                    throw new Error('Download failed');
                });
            }
            var fileName = 'quiz-' + id + '.xml';
            var disposition = res.headers.get('Content-Disposition') || '';
            var match = disposition.match(/filename=\"?([^\";]+)\"?/i);
            if(match && match[1]) fileName = match[1];
            return res.blob().then(function(blob){
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            });
        })
        .catch(function(){
            // ya se alertó
        });
}

async function downloadPdf(id, options){
    options = options || {};
    var includeAnswers = options.includeAnswers !== false;
    var shuffleQuestions = options.shuffleQuestions === true;
    var shuffleAnswers = options.shuffleAnswers === true;
    var JsPdfCtor = getJsPdf();
    if(!JsPdfCtor){
        alert(t('pdfMissingLib'));
        return;
    }
    try{
        var res = await fetch('/api/quizzes/' + id, { credentials: 'include' });
        if(!res.ok){
            alert(t('pdfDownloadError'));
            return;
        }
        var quiz = await res.json();
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

        var questions = Array.isArray(quiz.questions) ? quiz.questions.slice() : [];
        if(shuffleQuestions){
            shuffleArray(questions);
        }
        for(var idx = 0; idx < questions.length; idx++){
            var q = questions[idx];
            var qNum = idx + 1;
            var qText = (q && q.question) ? String(q.question).trim() : '';
            var qType = (q && q.type) ? String(q.type) : 'quiz';
            var localAnswers = null;
            var localCorrect = null;
            if(shuffleAnswers && (qType === 'quiz' || qType === 'multiple' || qType === 'true-false')){
                var shuffled = shuffleAnswersForPdf(q, qType);
                localAnswers = shuffled.answers;
                localCorrect = shuffled.correct;
            }else if(qType === 'true-false'){
                localAnswers = normalizePdfAnswers(q, qType);
            }

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
                var tfAnswers = localAnswers || getTfLabelsForPdf(q);
                y = pdfAddWrapped(doc, 'A) ' + tfAnswers[0], margin, y, maxWidth, { fontSize: 11 });
                y = pdfAddWrapped(doc, 'B) ' + tfAnswers[1], margin, y, maxWidth, { fontSize: 11, marginBottom: 6 });
            }else{
                var answers = localAnswers || (Array.isArray(q.answers) ? q.answers : []);
                var labels = ['A', 'B', 'C', 'D'];
                for(var i = 0; i < 4; i++){
                    var ans = (answers[i] || '').toString().trim();
                    if(!ans) continue;
                    y = pdfAddWrapped(doc, labels[i] + ') ' + ans, margin, y, maxWidth, { fontSize: 11 });
                }
                y += 6;
            }

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

            if(includeAnswers && (qType === 'quiz' || qType === 'multiple' || qType === 'true-false')){
                var correct = localCorrect || ((Array.isArray(q.correctAnswers) && q.correctAnswers.length) ? q.correctAnswers : [q.correct]);
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
        var suffix = includeAnswers ? '' : '_sin_respuestas';
        doc.save(baseName + suffix + '.pdf');
    }catch(err){
        alert(t('pdfDownloadError'));
    }
}

function escapeXml(value){
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function pxToMm(px){
    return (px * 25.4) / 96;
}

function getDocx(){
    if(window.docx) return window.docx;
    return null;
}

async function downloadDocx(id, options){
    var docxLib = getDocx();
    if(!docxLib){
        alert(t('docMissingLib'));
        return;
    }
    options = options || {};
    var includeAnswers = options.includeAnswers !== false;
    var includeImages = options.includeImages !== false;
    try{
        var res = await fetch('/api/quizzes/' + id, { credentials: 'include' });
        if(!res.ok){
            alert(t('docDownloadError'));
            return;
        }
        var quiz = await res.json();
        var title = (quiz.name || '').toString().trim() || 'EduHoot quiz';

        var parts = [];
        parts.push(new docxLib.Paragraph({
            text: title,
            heading: docxLib.HeadingLevel.HEADING_1
        }));
        if(Array.isArray(quiz.tags) && quiz.tags.length){
            parts.push(new docxLib.Paragraph(t('pdfTags') + ': ' + quiz.tags.join(', ')));
        }

        for(var idx = 0; idx < (quiz.questions || []).length; idx++){
            var q = quiz.questions[idx];
            var qNum = idx + 1;
            var qText = (q && q.question) ? String(q.question).trim() : '';
            var qType = (q && q.type) ? String(q.type) : 'quiz';

            parts.push(new docxLib.Paragraph({
                children: [
                    new docxLib.TextRun({ text: qNum + '. ' + qText, bold: true })
                ]
            }));

            if(qType === 'short-answer'){
                var accepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
                if(includeAnswers && accepted.length){
                    parts.push(new docxLib.Paragraph(t('pdfAcceptedAnswers') + ': ' + accepted.join(' | ')));
                    parts.push(new docxLib.Paragraph(t('pdfCorrect') + ': ' + accepted.join(' | ')));
                }
            }else if(qType === 'numeric'){
                var n = (q.numericAnswer === undefined || q.numericAnswer === null) ? '' : String(q.numericAnswer);
                var tol = (q.tolerance === undefined || q.tolerance === null) ? '0' : String(q.tolerance);
                if(includeAnswers){
                    parts.push(new docxLib.Paragraph(t('pdfNumericAnswer') + ': ' + n + ' (± ' + t('pdfTolerance') + ': ' + tol + ')'));
                    parts.push(new docxLib.Paragraph(t('pdfCorrect') + ': ' + n + ' (± ' + tol + ')'));
                }
            }else if(qType === 'true-false'){
                var tfAnswers = normalizePdfAnswers(q, qType);
                parts.push(new docxLib.Paragraph({ text: 'A) ' + tfAnswers[0], bullet: { level: 0 } }));
                parts.push(new docxLib.Paragraph({ text: 'B) ' + tfAnswers[1], bullet: { level: 0 } }));
            }else{
                var answers = Array.isArray(q.answers) ? q.answers : [];
                var labels = ['A', 'B', 'C', 'D'];
                for(var i = 0; i < 4; i++){
                    var ans = (answers[i] || '').toString().trim();
                    if(!ans) continue;
                    parts.push(new docxLib.Paragraph({ text: labels[i] + ') ' + ans, bullet: { level: 0 } }));
                }
            }

            if(includeImages && q && q.image){
                var imageData = await loadImageForPdf(q.image);
                if(imageData){
                    var data = dataUrlToUint8Array(imageData.dataUrl);
                    var maxWidth = 500;
                    var scale = Math.min(maxWidth / imageData.width, 1);
                    var width = Math.round(imageData.width * scale);
                    var height = Math.round(imageData.height * scale);
                    parts.push(new docxLib.Paragraph({
                        children: [
                            new docxLib.ImageRun({
                                data: data,
                                transformation: { width: width, height: height }
                            })
                        ]
                    }));
                }
            }

            if(q && q.video){
                parts.push(new docxLib.Paragraph(t('pdfVideo') + ': ' + String(q.video)));
            }

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
                    var seen = {};
                    printable = printable.filter(function(x){ if(seen[x]) return false; seen[x] = true; return true; });
                    parts.push(new docxLib.Paragraph(t('pdfCorrect') + ': ' + printable.join(', ')));
                }
            }
        }

        var doc = new docxLib.Document({
            sections: [{ children: parts }]
        });
        var blob = await docxLib.Packer.toBlob(doc);
        var baseName = sanitizeFilename(title, 'quiz');
        var a = document.createElement('a');
        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = baseName + '.docx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }catch(err){
        alert(t('docDownloadError'));
    }
}

async function downloadOdt(id, options){
    if(!window.JSZip){
        alert(t('docMissingLib'));
        return;
    }
    options = options || {};
    var includeAnswers = options.includeAnswers !== false;
    var includeImages = options.includeImages !== false;
    try{
        var res = await fetch('/api/quizzes/' + id, { credentials: 'include' });
        if(!res.ok){
            alert(t('docDownloadError'));
            return;
        }
        var quiz = await res.json();
        var title = (quiz.name || '').toString().trim() || 'EduHoot quiz';

        var zip = new JSZip();
        zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });

        var images = [];
        var contentParts = [];
        contentParts.push('<text:h text:outline-level="1">' + escapeXml(title) + '</text:h>');
        if(Array.isArray(quiz.tags) && quiz.tags.length){
            contentParts.push('<text:p>' + escapeXml(t('pdfTags') + ': ' + quiz.tags.join(', ')) + '</text:p>');
        }

        for(var idx = 0; idx < (quiz.questions || []).length; idx++){
            var q = quiz.questions[idx];
            var qNum = idx + 1;
            var qText = (q && q.question) ? String(q.question).trim() : '';
            var qType = (q && q.type) ? String(q.type) : 'quiz';
            contentParts.push('<text:p><text:span text:style-name="Bold">' + escapeXml(qNum + '. ' + qText) + '</text:span></text:p>');

            if(qType === 'short-answer'){
                var accepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
                if(includeAnswers && accepted.length){
                    contentParts.push('<text:p>' + escapeXml(t('pdfAcceptedAnswers') + ': ' + accepted.join(' | ')) + '</text:p>');
                    contentParts.push('<text:p>' + escapeXml(t('pdfCorrect') + ': ' + accepted.join(' | ')) + '</text:p>');
                }
            }else if(qType === 'numeric'){
                var n = (q.numericAnswer === undefined || q.numericAnswer === null) ? '' : String(q.numericAnswer);
                var tol = (q.tolerance === undefined || q.tolerance === null) ? '0' : String(q.tolerance);
                if(includeAnswers){
                    contentParts.push('<text:p>' + escapeXml(t('pdfNumericAnswer') + ': ' + n + ' (± ' + t('pdfTolerance') + ': ' + tol + ')') + '</text:p>');
                    contentParts.push('<text:p>' + escapeXml(t('pdfCorrect') + ': ' + n + ' (± ' + tol + ')') + '</text:p>');
                }
            }else if(qType === 'true-false'){
                var tfAnswers = normalizePdfAnswers(q, qType);
                contentParts.push('<text:p>' + escapeXml('A) ' + tfAnswers[0]) + '</text:p>');
                contentParts.push('<text:p>' + escapeXml('B) ' + tfAnswers[1]) + '</text:p>');
            }else{
                var answers = Array.isArray(q.answers) ? q.answers : [];
                var labels = ['A', 'B', 'C', 'D'];
                for(var i = 0; i < 4; i++){
                    var ans = (answers[i] || '').toString().trim();
                    if(!ans) continue;
                    contentParts.push('<text:p>' + escapeXml(labels[i] + ') ' + ans) + '</text:p>');
                }
            }

            if(includeImages && q && q.image){
                var imageData = await loadImageForPdf(q.image);
                if(imageData){
                    var pngUrl = await ensurePngDataUrl(imageData.dataUrl);
                    if(pngUrl){
                        var fileName = 'Pictures/image_' + idx + '_' + images.length + '.png';
                        var bytes = dataUrlToUint8Array(pngUrl);
                        images.push({ name: fileName, bytes: bytes });
                        var widthMm = pxToMm(imageData.width || 800);
                        var heightMm = pxToMm(imageData.height || 600);
                        contentParts.push(
                            '<text:p><draw:frame text:anchor-type="as-char" svg:width="' + widthMm.toFixed(2) + 'mm" svg:height="' + heightMm.toFixed(2) + 'mm">' +
                            '<draw:image xlink:href="' + escapeXml(fileName) + '" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>' +
                            '</draw:frame></text:p>'
                        );
                    }
                }
            }

            if(q && q.video){
                contentParts.push('<text:p>' + escapeXml(t('pdfVideo') + ': ' + String(q.video)) + '</text:p>');
            }

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
                    var seen = {};
                    printable = printable.filter(function(x){ if(seen[x]) return false; seen[x] = true; return true; });
                    contentParts.push('<text:p>' + escapeXml(t('pdfCorrect') + ': ' + printable.join(', ')) + '</text:p>');
                }
            }
        }

        var contentXml = '' +
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<office:document-content ' +
            'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
            'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
            'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
            'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" ' +
            'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
            'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" ' +
            'office:version="1.2">' +
            '<office:styles>' +
            '<style:style style:name="Bold" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>' +
            '</office:styles>' +
            '<office:body><office:text>' + contentParts.join('') + '</office:text></office:body>' +
            '</office:document-content>';

        var stylesXml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.2"></office:document-styles>';
        var metaXml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.2"></office:document-meta>';

        zip.file('content.xml', contentXml);
        zip.file('styles.xml', stylesXml);
        zip.file('meta.xml', metaXml);

        if(images.length){
            images.forEach(function(img){
                zip.file(img.name, img.bytes);
            });
        }

        var manifestEntries = [
            '<manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.text" manifest:full-path="/"/>',
            '<manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>',
            '<manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>',
            '<manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>'
        ];
        images.forEach(function(img){
            manifestEntries.push('<manifest:file-entry manifest:media-type="image/png" manifest:full-path="' + escapeXml(img.name) + '"/>');
        });
        var manifestXml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">' +
            manifestEntries.join('') +
            '</manifest:manifest>';
        zip.file('META-INF/manifest.xml', manifestXml);

        var blob = await zip.generateAsync({ type: 'blob' });
        var baseName = sanitizeFilename(title, 'quiz');
        var a = document.createElement('a');
        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = baseName + '.odt';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }catch(err){
        alert(t('docDownloadError'));
    }
}

var csvForm = document.getElementById('csv-form');
if (csvForm) {
    csvForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var fileInput = document.getElementById('csv-file');
        var nameInput = document.getElementById('csv-name');
        var status = document.getElementById('csv-status');

        if (!fileInput.files || fileInput.files.length === 0) {
            status.textContent = t('selectCsv');
            return;
        }

        var formData = new FormData();
        formData.append('file', fileInput.files[0]);
        if (nameInput.value && nameInput.value.trim()) {
            formData.append('name', nameInput.value.trim());
        }
        formData.append('ownerToken', getAnonOwnerToken());

        status.textContent = t('uploadCsv');
        try {
            var response = await fetch('/api/upload-csv', {
                method: 'POST',
                body: formData
            });
            var result = await response.json();
            if (!response.ok) {
                status.textContent = result.error || t('uploadCsvError');
                return;
            }
            status.textContent = t('importSuccess') + ': ' + result.name + ' (' + result.count + ') ';
            var startBtn = document.createElement('button');
            startBtn.textContent = t('startNow') || t('play');
            startBtn.onclick = function() { startGame(result.id); };
            status.appendChild(startBtn);
            csvForm.reset();
            rememberClaimableQuizId(result.id);
            socket.emit('requestDbNames');
            fetchWithFilters();
        } catch (err) {
            status.textContent = t('uploadCsvError');
        }
    });
}

// --- Generador IA ---
function buildPrompt(params){
    var idioma = params.idioma === 'otro' && params.idiomaCustom ? params.idiomaCustom : params.idioma;
    var tipos = Array.isArray(params.tipos) && params.tipos.length ? params.tipos : ['quiz'];
    var useDocs = !!params.useDocs;
    var genSvg = !!params.genSvg;
    var tema = useDocs ? '' : (params.tema || '');
    var prompt = {
        objetivo: "Generar un cuestionario en CSV con separador ';' siguiendo el formato: tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia",
        nivel: params.nivel || '',
        tema: tema,
        idioma: idioma || 'Español',
        numero_preguntas: params.num,
        tipos: tipos,
        usar_documentos: useDocs,
        generar_imagenes_svg: genSvg,
        instrucciones: params.extra || '',
        notas: [
            "Usa el punto y coma ';' como separador.",
            "Si algún campo contiene ';' o comillas o saltos de línea, envuélvelo en comillas dobles y escapa comillas internas como \"\" (CSV estándar).",
            "Columna 'tipo': usa uno de: quiz | multiple | true-false | short-answer | numeric.",
            "Tipos quiz/multiple/true-false: usa r1..r4 y 'correcta' (quiz/tf: índice; multiple: lista 1,3).",
            "Tipo short-answer: deja r1..r4 vacío y pon respuestas válidas en 'texto' separadas por '|' (ej: madrid|barcelona).",
            "Tipo numeric: deja r1..r4 vacío y pon la respuesta en 'numero' (acepta coma decimal) y la tolerancia en 'tolerancia' (0 si exacta).",
            "Si 'usar_documentos' es true, genera las preguntas SOLO a partir de los documentos adjuntos en la IA (no inventes contenido fuera de ellos).",
            "Imágenes: PROHIBIDO usar URLs externas (http/https) y PROHIBIDO Wikimedia. Si no puedes generar una imagen embebida, deja 'imagen' vacío.",
            (genSvg
                ? "Columna 'imagen': genera SVG como data URL con el SVG URL-encoded (muy importante para que '#' en colores no rompa la URL). Ejemplo: \"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2010%2010%22%3E%3Crect%20width%3D%2210%22%20height%3D%2210%22%20fill%3D%22%2523ff0000%22%2F%3E%3C%2Fsvg%3E\". Si contiene ';', pon el campo entrecomillado."
                : "Columna 'imagen': déjala VACÍA (no uses URLs externas)."),
            "Columna 'video': URLs de vídeo (YouTube/Vimeo/MP4). Si hay vídeo, deja 'imagen' vacía.",
            "Tiempo: en segons (ex: 20)."
        ]
    };
    return JSON.stringify(prompt, null, 2);
}

function getSelectedIaTypes(){
    var selected = [];
    var quiz = document.getElementById('ia-type-quiz');
    var multiple = document.getElementById('ia-type-multiple');
    var tf = document.getElementById('ia-type-tf');
    var shortAns = document.getElementById('ia-type-short');
    var numeric = document.getElementById('ia-type-numeric');
    if(quiz && quiz.checked) selected.push('quiz');
    if(multiple && multiple.checked) selected.push('multiple');
    if(tf && tf.checked) selected.push('true-false');
    if(shortAns && shortAns.checked) selected.push('short-answer');
    if(numeric && numeric.checked) selected.push('numeric');
    if(!selected.length) selected.push('quiz');
    return selected;
}

function buildIaTags(){
    // Objetivo: pocas tags útiles (sin ruido tipo "generado-ia" o prefijos "ia-").
    // Priorizamos: tema(s), nivel(es), idioma, y si usa documentos.
    var tags = [];
    var seen = new Set();

    function addTag(text){
        var clean = normalizeTagSlug(text);
        if(!clean) return;
        // filtros anti-ruido
        if(clean === 'generado-ia') return;
        if(clean.indexOf('ia-') === 0) return;
        if(clean.indexOf('ai-') === 0) return;
        if(seen.has(clean)) return;
        seen.add(clean);
        tags.push(clean);
    }

    function addFromList(text){
        (text || '').split(/[,;]+/).forEach(function(part){
            addTag(part);
        });
    }

    function addSingleFromList(text){
        // Para campos como "nivel educativo": nos interesa solo 1 etiqueta.
        var raw = (text || '').toString();
        var parts = raw.split(/[,;|]+/);
        for(var i=0;i<parts.length;i++){
            var p = (parts[i] || '').toString().trim();
            if(p){
                addTag(p);
                return;
            }
        }
    }

    var temaVal = document.getElementById('ia-tema') ? document.getElementById('ia-tema').value : '';
    var nivelVal = document.getElementById('ia-nivel') ? document.getElementById('ia-nivel').value : '';
    // Nivel: solo una etiqueta (la primera si hay varias)
    addSingleFromList(nivelVal);
    // Tema: puede aportar 1-2 tags útiles
    addFromList(temaVal);

    var idiomaVal = '';
    if(iaIdioma){
        idiomaVal = iaIdioma.value === 'otro' && iaIdiomaCustom ? iaIdiomaCustom.value : iaIdioma.value;
    }
    addTag(idiomaVal);

    if(iaUseDocs && iaUseDocs.checked){
        addTag('con-documentos');
    }

    // límite: suficientemente informativas sin volverse repetitivas
    return tags.slice(0, 4);
}

var iaGenerate = document.getElementById('ia-generate');
var iaCopy = document.getElementById('ia-copy');
var iaPrompt = document.getElementById('ia-prompt');
var iaIdioma = document.getElementById('ia-idioma');
var iaIdiomaCustom = document.getElementById('ia-idioma-custom');
var iaUseDocs = document.getElementById('ia-use-docs');
var iaGenSvg = document.getElementById('ia-gen-svg');
var iaGenSvgWrap = document.getElementById('ia-gen-svg-wrap');
var iaDocsHint = document.getElementById('ia-docs-hint');
var iaTema = document.getElementById('ia-tema');

// --- Auth modal ---
var authModal = document.getElementById('auth-modal');
var openAuthBtn = document.getElementById('open-auth');
var newUserSignin = document.getElementById('new-user-signin');
var authGoogleHeroBtn = document.getElementById('auth-google-hero');

function openAuthModal(){
    if(!authModal) return;
    authModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    try{ if(authEmail) authEmail.focus(); }catch(e){}
}

function closeAuthModal(){
    if(!authModal) return;
    authModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function warnNoPermission(message){
    var msg = message || t('permissionDenied');
    if(authMsg){
        authMsg.textContent = msg;
        if(!authState.user) openAuthModal();
        return;
    }
    try{ window.alert(msg); }catch(e){}
}

function updateTopAuthButton(){
    if(!openAuthBtn) return;
    if(authState && authState.user){
        openAuthBtn.setAttribute('data-i18n', 'btnAccount');
        openAuthBtn.textContent = t('btnAccount');
    }else{
        openAuthBtn.setAttribute('data-i18n', 'btnLogin');
        openAuthBtn.textContent = t('btnLogin');
    }
}

if(openAuthBtn){
    openAuthBtn.addEventListener('click', function(){
        openAuthModal();
    });
}

if(authModal){
    authModal.querySelectorAll('[data-modal-close]').forEach(function(el){
        el.addEventListener('click', function(){
            closeAuthModal();
        });
    });
}

document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && authModal && !authModal.classList.contains('hidden')){
        closeAuthModal();
    }
});

// --- Auth ---
var authEmail = document.getElementById('auth-email');
var authPass = document.getElementById('auth-pass');
var authNick = document.getElementById('auth-nick');
var authLoginForm = document.getElementById('auth-login-form');
var authStatus = document.getElementById('auth-status');
var authMsg = document.getElementById('auth-message');
var authLoginBtn = document.getElementById('auth-login');
var authLogoutBtn = document.getElementById('auth-logout');
var authSaveNickBtn = document.getElementById('auth-save-nick');
var adminPanel = document.getElementById('user-admin');
var newUserEmail = document.getElementById('new-user-email');
var newUserPass = document.getElementById('new-user-pass');
var newUserRole = document.getElementById('new-user-role');
var newUserNick = document.getElementById('new-user-nick');
var createUserBtn = document.getElementById('create-user-btn');
var createUserStatus = document.getElementById('create-user-status');
var resetAdminEmail = document.getElementById('reset-admin-email');
var resetAdminPass = document.getElementById('reset-admin-pass');
var resetAdminBtn = document.getElementById('reset-admin-btn');
var resetAdminStatus = document.getElementById('reset-admin-status');
var adminExportAllBtn = document.getElementById('admin-export-quizzes');
var adminImportFile = document.getElementById('admin-import-quizzes-file');
var adminImportReplace = document.getElementById('admin-import-quizzes-replace');
var adminImportBtn = document.getElementById('admin-import-quizzes');
var adminImportStatus = document.getElementById('admin-import-quizzes-status');
var adminMirrorKahootBtn = document.getElementById('admin-mirror-kahoot-images');
var adminMirrorKahootStatus = document.getElementById('admin-mirror-kahoot-status');
var adminMirrorExternalBtn = document.getElementById('admin-mirror-external-images');
var adminMirrorExternalStatus = document.getElementById('admin-mirror-external-status');
var toggleResetBtn = document.getElementById('toggle-reset');
var resetPanel = document.getElementById('reset-panel');
var resetEmail = document.getElementById('reset-email');
var resetToken = document.getElementById('reset-token');
var resetPass = document.getElementById('reset-pass');
var resetRequestBtn = document.getElementById('reset-request');
var resetConfirmBtn = document.getElementById('reset-confirm');
var resetStatus = document.getElementById('reset-status');
var authState = { user: null };
var googleAuthEnabled = false;

function updateAuthUI(){
    if(newUserSignin){
        newUserSignin.classList.toggle('hidden', !googleAuthEnabled || !!(authState && authState.user));
    }

    if(authStatus){
        if(authState.user){
            var nickPart = authState.user.nickname ? ' · ' + authState.user.nickname : '';
            authStatus.textContent = authState.user.email + nickPart + ' (' + authState.user.role + ')';
            authStatus.classList.remove('pill-muted');
        }else{
            authStatus.textContent = t('authStatus');
            authStatus.classList.add('pill-muted');
        }
    }
    if(adminPanel){
        if(authState.user && authState.user.role === 'admin'){
            adminPanel.classList.remove('hidden');
        }else{
            adminPanel.classList.add('hidden');
        }
    }

    if(authLoginBtn){
        authLoginBtn.classList.toggle('hidden', !!(authState && authState.user));
    }
    if(authSaveNickBtn){
        authSaveNickBtn.classList.toggle('hidden', !(authState && authState.user));
    }
    if(authLogoutBtn){
        authLogoutBtn.classList.toggle('hidden', !(authState && authState.user));
    }

    if(iaGenSvgWrap){
        var isLogged = !!(authState && authState.user);
        iaGenSvgWrap.classList.toggle('hidden', !isLogged);
        if(!isLogged && iaGenSvg){
            iaGenSvg.checked = false;
            try{ localStorage.setItem('eduh_ia_gen_svg', '0'); }catch(e){}
        }
    }

    updateTopAuthButton();
}

function fetchMe(){
    return fetch('/api/auth/me', { credentials: 'include' })
        .then(function(res){
            if(!res.ok) throw new Error();
            return res.json();
        })
        .then(function(user){
            authState.user = user;
            updateAuthUI();
            currentFilters.mineOnly = true;
            var mineCb = document.getElementById('filter-mine');
            if(mineCb) mineCb.checked = true;
            fetchWithFilters();
            claimPendingQuizAfterLogin();
        })
        .catch(function(){
            authState.user = null;
            updateAuthUI();
            fetchWithFilters();
        });
}

function login(){
    if(!authEmail || !authPass) return;
    var email = authEmail.value.trim();
    var pass = authPass.value;
    var nick = authNick ? authNick.value.trim() : '';
    authMsg.textContent = t('loginWait');
    fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email, password: pass, nickname: nick })
    }).then(async function(res){
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
            authMsg.textContent = body.error || t('loginError');
            return;
        }
        authMsg.textContent = t('loginOk') || t('authStatus');
        authPass.value = '';
        if(authNick) authNick.value = '';
        closeAuthModal();
        reconnectSocket();
        fetchMe();
    }).catch(function(){
        authMsg.textContent = t('loginError');
    });
}

function logout(){
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
        .then(function(){
            authState.user = null;
            currentFilters.mineOnly = false;
            var mineCb = document.getElementById('filter-mine');
            if(mineCb) mineCb.checked = false;
            updateAuthUI();
            closeAuthModal();
            reconnectSocket();
            fetchWithFilters();
        })
        .catch(function(){});
}

function loginWithGoogle(){
    var next = window.location.pathname + window.location.search;
    window.location.href = '/api/auth/google/start?next=' + encodeURIComponent(next || '/create/');
}

function removeLocalQuizId(id){
    if(!id) return;
    try{
        var stored = JSON.parse(localStorage.getItem('localQuizzes') || '[]');
        stored = stored.filter(function(x){ return String(x) !== String(id); });
        localStorage.setItem('localQuizzes', JSON.stringify(stored));
    }catch(e){}
}

function rememberClaimableQuizId(id){
    if(id === undefined || id === null || authState.user) return;
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

async function claimQuizToAccount(id, options){
    var silent = options && options.silent;
    if(!id) return false;
    if(!authState.user){
        try{ localStorage.setItem(PENDING_ACCOUNT_SAVE_KEY, String(id)); }catch(e){}
        if(authMsg) authMsg.textContent = t('loginToSave');
        openAuthModal();
        return false;
    }
    if(authMsg && !silent) authMsg.textContent = t('savingToAccount');
    try{
        var res = await fetch('/api/quizzes/' + encodeURIComponent(id) + '/claim', {
            method: 'POST',
            headers: { 'X-Owner-Token': getAnonOwnerToken() },
            credentials: 'include'
        });
        var body = {};
        try{ body = await res.json(); }catch(e){}
        if(!res.ok){
            if(authMsg && !silent) authMsg.textContent = body.error || t('saveToAccountError');
            if(!silent) alert(body.error || t('saveToAccountError'));
            return false;
        }
        removeLocalQuizId(body.previousId || id);
        try{ localStorage.removeItem(PENDING_ACCOUNT_SAVE_KEY); }catch(e){}
        if(authMsg) authMsg.textContent = t('saveToAccountOk');
        socket.emit('requestDbNames');
        fetchWithFilters();
        fetchTags();
        return true;
    }catch(err){
        if(authMsg && !silent) authMsg.textContent = t('saveToAccountError');
        if(!silent) alert(t('saveToAccountError'));
        return false;
    }
}

async function claimPendingQuizAfterLogin(){
    if(!authState.user) return;
    var pending = '';
    try{ pending = localStorage.getItem(PENDING_ACCOUNT_SAVE_KEY) || ''; }catch(e){}
    if(!pending) return;
    await claimQuizToAccount(pending, { silent: true });
}

async function createUser(){
    if(!authState.user || authState.user.role !== 'admin') return;
    if(!newUserEmail || !newUserPass || !newUserRole) return;
    var email = newUserEmail.value.trim();
    var pass = newUserPass.value;
    var role = newUserRole.value;
    var nick = newUserNick ? newUserNick.value.trim() : '';
    if(!email || !pass){
        if(createUserStatus) createUserStatus.textContent = t('createUserMissing') || t('resetNeedFields');
        return;
    }
    if(createUserStatus) createUserStatus.textContent = t('createUserWorking') || t('resetWaiting');
    try{
        var res = await fetch('/api/auth/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: email, password: pass, role: role, nickname: nick })
        });
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
            if(createUserStatus) createUserStatus.textContent = body.error || t('createUserError') || t('resetUpdateError');
            return;
        }
        if(createUserStatus) createUserStatus.textContent = t('createUserOk') || t('saveOk');
        newUserEmail.value = '';
        newUserPass.value = '';
    }catch(err){
        if(createUserStatus) createUserStatus.textContent = t('createUserError') || t('resetUpdateError');
    }
}

async function saveNickname(){
    if(!authState.user) return;
    if(!authNick) return;
    var nick = authNick.value.trim();
    authMsg.textContent = t('savingNick') || t('resetWaiting');
    try{
        var res = await fetch('/api/auth/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ nickname: nick })
        });
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
            authMsg.textContent = body.error || t('nickSaveError') || t('resetUpdateError');
            return;
        }
        authMsg.textContent = t('nickSaved') || t('saveOk');
        fetchMe();
    }catch(err){
        authMsg.textContent = t('nickSaveError') || t('resetUpdateError');
    }
}
async function resetPasswordAsAdmin(){
    if(!authState.user || authState.user.role !== 'admin') return;
    if(!resetAdminEmail || !resetAdminPass) return;
    var email = resetAdminEmail.value.trim();
    var pass = resetAdminPass.value;
    if(!email || !pass){
        if(resetAdminStatus) resetAdminStatus.textContent = t('resetNeedFields');
        return;
    }
    if(resetAdminStatus) resetAdminStatus.textContent = t('resetUpdating');
    try{
        var res = await fetch('/api/auth/reset-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: email, password: pass })
        });
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
            if(resetAdminStatus) resetAdminStatus.textContent = body.error || t('resetUpdateError');
            return;
        }
        if(resetAdminStatus) resetAdminStatus.textContent = t('resetUpdated');
        resetAdminPass.value = '';
    }catch(err){
        if(resetAdminStatus) resetAdminStatus.textContent = t('resetUpdateError');
    }
}

function exportAllQuizzesAsAdmin(){
    if(!authState.user || authState.user.role !== 'admin'){
        warnNoPermission();
        return;
    }
    // Descargar como archivo (cookies incluidas al navegar)
    window.location.href = '/api/admin/quizzes/export';
}

async function importAllQuizzesAsAdmin(){
    if(!authState.user || authState.user.role !== 'admin'){
        warnNoPermission();
        return;
    }
    if(!adminImportFile || !adminImportFile.files || !adminImportFile.files[0]){
        if(adminImportStatus) adminImportStatus.textContent = t('adminImportPickFile');
        return;
    }
    var replaceAll = !!(adminImportReplace && adminImportReplace.checked);
    if(replaceAll){
        var ok = false;
        try{ ok = window.confirm(t('adminReplaceConfirm')); }catch(e){ ok = false; }
        if(!ok) return;
    }
    if(adminImportStatus) adminImportStatus.textContent = t('adminImportWorking');
    try{
        var fd = new FormData();
        fd.append('file', adminImportFile.files[0]);
        if(replaceAll) fd.append('confirm', 'REPLACE_ALL');
        var url = '/api/admin/quizzes/import' + (replaceAll ? '?mode=replace' : '?mode=upsert');
        var res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            body: fd
        });
        var body = {};
        try{ body = await res.json(); }catch(e){}
        if(!res.ok){
            if(adminImportStatus) adminImportStatus.textContent = (body && body.error) ? body.error : t('adminImportError');
            return;
        }
        if(adminImportStatus){
            var detail = '';
            if(body && body.mode === 'replace'){
                detail = ' (' + (body.imported || 0) + ')';
            }else{
                detail = ' (' + (body.processed || 0) + ')';
            }
            adminImportStatus.textContent = t('adminImportOk') + detail;
        }
        adminImportFile.value = '';
        if(adminImportReplace) adminImportReplace.checked = false;
        fetchWithFilters();
        fetchTags();
    }catch(err){
        if(adminImportStatus) adminImportStatus.textContent = t('adminImportError');
    }
}

if(authLoginForm){
    authLoginForm.addEventListener('submit', function(e){
        e.preventDefault();
        login();
    });
}else if(authLoginBtn){
    // Fallback por si el HTML no tiene el form (compatibilidad)
    authLoginBtn.addEventListener('click', function(e){
        if(e && e.preventDefault) e.preventDefault();
        login();
    });
}
if(authLogoutBtn){
    authLogoutBtn.addEventListener('click', logout);
}
if(authGoogleHeroBtn){
    authGoogleHeroBtn.addEventListener('click', loginWithGoogle);
}
if(createUserBtn){
    createUserBtn.addEventListener('click', createUser);
}
if(authSaveNickBtn){
    authSaveNickBtn.addEventListener('click', saveNickname);
}
if(resetAdminBtn){
    resetAdminBtn.addEventListener('click', resetPasswordAsAdmin);
}
if(adminExportAllBtn){
    adminExportAllBtn.addEventListener('click', exportAllQuizzesAsAdmin);
}
if(adminImportBtn){
    adminImportBtn.addEventListener('click', importAllQuizzesAsAdmin);
}
if(adminMirrorKahootBtn){
    adminMirrorKahootBtn.addEventListener('click', async function(){
        if(adminMirrorKahootStatus) adminMirrorKahootStatus.textContent = t('mirrorKahootWorking');
        adminMirrorKahootBtn.disabled = true;
        try{
            var res = await fetch('/api/admin/mirror-kahoot-images', { method: 'POST', credentials: 'include' });
            var data = await res.json();
            if(!res.ok) throw new Error(data.error || '');
            if(adminMirrorKahootStatus) adminMirrorKahootStatus.textContent = t('mirrorKahootOk');
        }catch(e){
            if(adminMirrorKahootStatus) adminMirrorKahootStatus.textContent = t('mirrorKahootError') + (e.message ? ' ' + e.message : '');
        }finally{
            adminMirrorKahootBtn.disabled = false;
        }
    });
}
if(adminMirrorExternalBtn){
    adminMirrorExternalBtn.addEventListener('click', async function(){
        if(adminMirrorExternalStatus) adminMirrorExternalStatus.textContent = t('mirrorExternalWorking');
        adminMirrorExternalBtn.disabled = true;
        try{
            var res = await fetch('/api/admin/mirror-external-images', { method: 'POST', credentials: 'include' });
            var data = await res.json();
            if(!res.ok) throw new Error(data.error || '');
            if(adminMirrorExternalStatus) adminMirrorExternalStatus.textContent = t('mirrorExternalOk');
        }catch(e){
            if(adminMirrorExternalStatus) adminMirrorExternalStatus.textContent = t('mirrorExternalError') + (e.message ? ' ' + e.message : '');
        }finally{
            adminMirrorExternalBtn.disabled = false;
        }
    });
}
if(toggleResetBtn && resetPanel){
    toggleResetBtn.addEventListener('click', function(){
        resetPanel.classList.toggle('hidden');
    });
}
if(resetRequestBtn){
    resetRequestBtn.addEventListener('click', async function(){
        if(!resetEmail) return;
        var email = resetEmail.value.trim();
        if(!email){
            if(resetStatus) resetStatus.textContent = t('labelEmail');
            return;
        }
        if(resetStatus) resetStatus.textContent = t('resetWaiting');
        try{
            var res = await fetch('/api/auth/request-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email })
            });
            await res.json().catch(function(){});
            if(resetStatus) resetStatus.textContent = t('resetTokenSent');
        }catch(err){
            if(resetStatus) resetStatus.textContent = t('resetTokenError');
        }
    });
}
if(resetConfirmBtn){
    resetConfirmBtn.addEventListener('click', async function(){
        if(!resetToken || !resetPass) return;
        var token = resetToken.value.trim();
        var pass = resetPass.value;
        if(!token || !pass){
            if(resetStatus) resetStatus.textContent = t('resetNeedFields');
            return;
        }
        if(resetStatus) resetStatus.textContent = t('resetUpdating');
        try{
            var res = await fetch('/api/auth/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, password: pass })
            });
            var body = {};
            try { body = await res.json(); } catch(e){}
            if(!res.ok){
                if(resetStatus) resetStatus.textContent = body.error || t('resetUpdateError');
                return;
            }
            if(resetStatus) resetStatus.textContent = t('resetUpdated');
            resetPass.value = '';
            resetToken.value = '';
        }catch(err){
            if(resetStatus) resetStatus.textContent = t('resetUpdateError');
        }
    });
}

// Start auth check on load
try{
    var authParams = new URLSearchParams(window.location.search);
    var googleResult = authParams.get('google');
    if(googleResult && authMsg){
        authMsg.textContent = googleResult === 'ok' ? t('loginOk') : t('googleLoginError');
        authParams.delete('google');
        var cleanUrl = window.location.pathname + (authParams.toString() ? '?' + authParams.toString() : '') + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
    }
}catch(e){}
fetchMe();
fetchTags();

fetch('/api/auth/google/config', { credentials: 'include' })
    .then(function(res){ return res.ok ? res.json() : { enabled: false }; })
    .then(function(cfg){
        googleAuthEnabled = !!cfg.enabled;
        updateAuthUI();
    })
    .catch(function(){});

if (iaIdioma) {
    iaIdioma.addEventListener('change', function(){
        if (iaIdioma.value === 'otro') {
            iaIdiomaCustom.classList.remove('hidden');
        } else {
            iaIdiomaCustom.classList.add('hidden');
            iaIdiomaCustom.value = '';
        }
    });
}

function applyIaDocsMode(){
    if(!iaUseDocs) return;
    var active = !!iaUseDocs.checked;
    if(iaDocsHint) iaDocsHint.classList.toggle('hidden', !active);
    if(iaTema){
        iaTema.disabled = active;
        if(active) iaTema.value = '';
    }
}

if(iaUseDocs){
    try{
        iaUseDocs.checked = localStorage.getItem('eduh_ia_use_docs') === '1';
    }catch(e){}
    applyIaDocsMode();
    iaUseDocs.addEventListener('change', function(){
        try{ localStorage.setItem('eduh_ia_use_docs', iaUseDocs.checked ? '1' : '0'); }catch(e){}
        applyIaDocsMode();
    });
}

if(iaGenSvg){
    try{
        iaGenSvg.checked = localStorage.getItem('eduh_ia_gen_svg') === '1';
    }catch(e){}
    iaGenSvg.addEventListener('change', function(){
        try{ localStorage.setItem('eduh_ia_gen_svg', iaGenSvg.checked ? '1' : '0'); }catch(e){}
    });
}

if (iaGenerate) {
    iaGenerate.addEventListener('click', function(){
        var params = {
            nombre: document.getElementById('ia-name').value.trim(),
            nivel: document.getElementById('ia-nivel').value.trim(),
            tema: document.getElementById('ia-tema').value.trim(),
            idioma: iaIdioma ? iaIdioma.value : 'Español',
            idiomaCustom: iaIdiomaCustom ? iaIdiomaCustom.value.trim() : '',
            num: parseInt(document.getElementById('ia-num').value, 10) || 10,
            extra: document.getElementById('ia-extra').value.trim(),
            tipos: getSelectedIaTypes(),
            useDocs: iaUseDocs ? iaUseDocs.checked : false,
            genSvg: iaGenSvg ? iaGenSvg.checked : false
        };
        iaPrompt.textContent = buildPrompt(params);
    });
}

if (iaCopy) {
    iaCopy.addEventListener('click', function(){
        if (!iaPrompt || !iaPrompt.textContent.trim()) return;
        navigator.clipboard.writeText(iaPrompt.textContent).catch(function(){});
    });
}

var iaUpload = document.getElementById('ia-upload');
var iaPreviewBtn = document.getElementById('ia-preview');
var iaOpenBtn = document.getElementById('ia-open');
var iaDownloadBtn = document.getElementById('ia-download');
var iaEditBtn = document.getElementById('ia-edit');
var iaCsvFile = document.getElementById('ia-csv-file');
var iaPreviewBox = document.getElementById('ia-preview-box');
var iaPreviewContent = document.getElementById('ia-preview-content');

var lastIaUploadedQuizId = null;

function normalizeCsvForDownload(csvText){
    var text = (csvText || '').trim();
    if(!text) return '';
    var header = 'Tipo;Pregunta;R1;R2;R3;R4;Tiempo;Correcta;URL Imagen;Video;Texto;Numero;Tolerancia';
    if(!text.toLowerCase().includes('tipo;pregunta')){
        text = header + '\n' + text;
    }
    return text;
}

function escapeCsvField(value){
    var s = (value === undefined || value === null) ? '' : String(value);
    if(/[";\r\n]/.test(s)){
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function sanitizeIaCsv(csvText){
    // Objetivo: evitar portadas rotas por URLs externas (Wikimedia y similares).
    // Solo se aplica al flujo de IA (textarea/archivo) antes de previsualizar/guardar/subir.
    var raw = (csvText || '').trim();
    if(!raw) return '';

    var linesRaw = raw.split(/\r?\n/);
    var headerIndex = -1;
    for(var i=0;i<linesRaw.length;i++){
        if((linesRaw[i] || '').toLowerCase().includes('tipo;pregunta')){ headerIndex = i; break; }
    }

    var outLines = [];
    if(headerIndex !== -1){
        for(var h=0;h<=headerIndex;h++) outLines.push(linesRaw[h]);
    }

    var start = headerIndex !== -1 ? headerIndex + 1 : 0;
    for(var li=start; li<linesRaw.length; li++){
        var line = (linesRaw[li] || '').trim();
        if(!line) continue;
        var fields = splitSemicolons(line);
        if(!fields || fields.length < 8){
            outLines.push(linesRaw[li]);
            continue;
        }
        while(fields.length < 13) fields.push('');

        var img = (fields[8] || '').toString().trim();
        // Quita URLs externas (http/https) y especialmente Wikimedia.
        if(/^https?:\/\//i.test(img) || /upload\.wikimedia\.org/i.test(img)){
            fields[8] = '';
        }

        outLines.push(fields.map(escapeCsvField).join(';'));
    }

    return outLines.join('\n');
}

function splitSemicolons(line){
    var parts = [];
    var current = '';
    var inQuotes = false;
    for(var i=0;i<line.length;i++){
        var ch = line[i];
        if(ch === '"'){
            if(inQuotes && line[i+1] === '"'){
                current += '"';
                i += 1;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }
        if(ch === ';' && !inQuotes){
            parts.push(current);
            current = '';
        }else{
            current += ch;
        }
    }
    parts.push(current);
    return parts.map(function(field){
        return (field || '').toString().trim();
    });
}

function parseCsvLines(csvText){
    var text = (csvText || '').trim();
    if(!text) return [];
    var linesRaw = text.split(/\r?\n/);
    var headerIndex = -1;
    for(var i=0;i<linesRaw.length;i++){
        if((linesRaw[i] || '').toLowerCase().includes('tipo;pregunta')){ headerIndex = i; break; }
    }
    var lines = headerIndex !== -1 ? linesRaw.slice(headerIndex + 1) : linesRaw;
    var out = [];
    lines.forEach(function(line){
        var l = (line || '').trim();
        if(!l) return;
        var fields = splitSemicolons(l);
        if(!fields || fields.length < 8) return;
        out.push({
            tipo: fields[0],
            pregunta: fields[1],
            respuestas: fields.slice(2, 6).concat(['','','','']).slice(0,4),
            tiempo: fields[6],
            correcta: fields[7],
            imagen: fields[8] || '',
            video: fields[9] || '',
            texto: fields[10] || '',
            numero: fields[11] || '',
            tolerancia: fields[12] || ''
        });
    });
    return out;
}

function renderIaPreview(csvText){
    if(!iaPreviewBox || !iaPreviewContent) return;
    var questions = parseCsvLines(csvText);
    iaPreviewContent.innerHTML = '';
    if(!questions.length){
        iaPreviewContent.textContent = t('alertPasteCsv');
        iaPreviewBox.classList.remove('hidden');
        return;
    }
    questions.forEach(function(q, idx){
        var card = document.createElement('div');
        card.className = 'ia-preview__q';
        var title = document.createElement('div');
        title.className = 'ia-preview__qtitle';
        title.textContent = (idx + 1) + '. ' + (q.pregunta || '');
        card.appendChild(title);
        var list = document.createElement('div');
        list.className = 'ia-preview__answers';

        var qType = (q.tipo || '').toString().toLowerCase().trim();

        function splitAccepted(raw){
            var s = (raw || '').toString().trim();
            if(!s) return [];
            var parts = s.split(/[|\n]+/g);
            var out = [];
            parts.forEach(function(p){
                p.split(',').forEach(function(pp){
                    var clean = (pp || '').toString().trim();
                    if(clean) out.push(clean);
                });
            });
            return out;
        }

        if(qType === 'short-answer' || qType === 'shortanswer'){
            var accepted = splitAccepted(q.texto || q.correcta);
            if(!accepted.length) accepted = [''];
            accepted.forEach(function(a){
                var row = document.createElement('div');
                row.className = 'ia-preview__answer is-correct';
                var bullet = document.createElement('span');
                bullet.className = 'ia-preview__bullet';
                bullet.textContent = '✓';
                var txt = document.createElement('span');
                txt.className = 'ia-preview__text';
                txt.textContent = a;
                row.appendChild(bullet);
                row.appendChild(txt);
                list.appendChild(row);
            });
        }else if(qType === 'numeric' || qType === 'numerical'){
            var n = (q.numero || q.correcta || '').toString().trim();
            var tol = (q.tolerancia || '').toString().trim();
            var label = n;
            if(tol && tol !== '0') label = n + ' ± ' + tol;
            var row = document.createElement('div');
            row.className = 'ia-preview__answer is-correct';
            var bullet = document.createElement('span');
            bullet.className = 'ia-preview__bullet';
            bullet.textContent = '✓';
            var txt = document.createElement('span');
            txt.className = 'ia-preview__text';
            txt.textContent = label;
            row.appendChild(bullet);
            row.appendChild(txt);
            list.appendChild(row);
        }else{
            var correctIdx = [];
            (q.correcta || '').split(',').forEach(function(n){
                var i = parseInt(String(n).trim(), 10);
                if(!isNaN(i)) correctIdx.push(i - 1);
            });
            q.respuestas.forEach(function(a, i){
                if(!a) return;
                var row = document.createElement('div');
                row.className = 'ia-preview__answer' + (correctIdx.indexOf(i) !== -1 ? ' is-correct' : '');
                var bullet = document.createElement('span');
                bullet.className = 'ia-preview__bullet';
                bullet.textContent = (correctIdx.indexOf(i) !== -1 ? '✓' : '•');
                var txt = document.createElement('span');
                txt.className = 'ia-preview__text';
                txt.textContent = a;
                row.appendChild(bullet);
                row.appendChild(txt);
                list.appendChild(row);
            });
        }
        card.appendChild(list);
        iaPreviewContent.appendChild(card);
    });
    iaPreviewBox.classList.remove('hidden');
}

if(iaPreviewBtn){
    iaPreviewBtn.addEventListener('click', function(){
        var csvText = document.getElementById('ia-csv') ? document.getElementById('ia-csv').value : '';
        var clean = sanitizeIaCsv(csvText);
        var ta = document.getElementById('ia-csv');
        if(ta && clean) ta.value = clean;
        renderIaPreview(clean || csvText);
    });
}

if(iaOpenBtn && iaCsvFile){
    iaOpenBtn.addEventListener('click', function(){ iaCsvFile.click(); });
    iaCsvFile.addEventListener('change', function(e){
        var file = e.target.files && e.target.files[0];
        if(!file) return;
        var reader = new FileReader();
        reader.onload = function(ev){
            var ta = document.getElementById('ia-csv');
            if(ta) ta.value = String(ev.target.result || '');
            if(iaPreviewBox) iaPreviewBox.classList.add('hidden');
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = '';
    });
}

if(iaDownloadBtn){
    iaDownloadBtn.addEventListener('click', function(){
        var csvText = document.getElementById('ia-csv') ? document.getElementById('ia-csv').value : '';
        var cleaned = sanitizeIaCsv(csvText);
        var ta = document.getElementById('ia-csv');
        if(ta && cleaned) ta.value = cleaned;
        var normalized = normalizeCsvForDownload(cleaned || csvText);
        if(!normalized){
            alert(t('alertNothingToSave'));
            return;
        }
        var blob = new Blob(['\uFEFF' + normalized], { type: 'text/csv;charset=utf-8;' });
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'quiz.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    });
}

if(iaEditBtn){
    iaEditBtn.addEventListener('click', function(){
        if(!lastIaUploadedQuizId) return;
        window.location.href = 'quiz-creator/?id=' + encodeURIComponent(lastIaUploadedQuizId);
    });
}

if (iaUpload) {
    iaUpload.addEventListener('click', async function(){
        var status = document.getElementById('ia-status');
        var csvText = document.getElementById('ia-csv').value.trim();
        var cleaned = sanitizeIaCsv(csvText);
        if(cleaned){
            csvText = cleaned.trim();
            try{ document.getElementById('ia-csv').value = cleaned; }catch(e){}
        }
        var quizName = document.getElementById('ia-name').value.trim();
        if (!csvText) {
            status.textContent = t('selectCsv');
            return;
        }
        status.textContent = t('importing');
        if(iaEditBtn) iaEditBtn.disabled = true;
        lastIaUploadedQuizId = null;
        try{
            var blob = new Blob([csvText], { type: 'text/csv' });
            var file = new File([blob], 'ia.csv', { type: 'text/csv' });
            var formData = new FormData();
            formData.append('file', file);
            if (quizName) formData.append('name', quizName);
            formData.append('ownerToken', getAnonOwnerToken());
            var iaTags = buildIaTags();
            iaTags.forEach(function(tag){
                formData.append('tags', tag);
            });

            var response = await fetch('/api/upload-csv', { method: 'POST', body: formData });
            var result = await response.json();
            if (!response.ok) {
                status.textContent = result.error || t('uploadCsvError');
                return;
            }
            status.textContent = t('importSuccess') + ': ' + result.name + ' (' + result.count + ')';
            if (result.id) {
                lastIaUploadedQuizId = result.id;
                if(iaEditBtn) iaEditBtn.disabled = false;
                var startBtn = document.createElement('button');
                startBtn.className = 'btn btn-primary';
                startBtn.textContent = t('play');
                startBtn.style.marginLeft = '8px';
                startBtn.onclick = function(){ startGame(result.id); };
                status.appendChild(startBtn);
                rememberClaimableQuizId(result.id);
            }
            currentFilters.tags = [];
            socket.emit('requestDbNames');
            fetchWithFilters();
        }catch(err){
            status.textContent = t('uploadCsvError');
        }
    });
}

// Start auth check on load
fetchMe();

var langSelector = document.getElementById('lang-select');
if(langSelector){
    langSelector.value = lang;
    langSelector.addEventListener('change', function(){
        setLang(langSelector.value);
    });
}
applyStaticTranslations();
renderTagModeToggle();

function reconnectSocket(){
    try{
        socket.disconnect();
        socket.connect();
    }catch(e){}
}

// Importar Kahoot públic
var kahootForm = document.getElementById('kahoot-form');
var kahootUrlInput = document.getElementById('kahoot-url');
var kahootStatus = document.getElementById('kahoot-status');
var kahootVisSelect = document.getElementById('kahoot-visibility');
if(kahootForm){
    kahootForm.addEventListener('submit', async function(e){
        e.preventDefault();
        if(!kahootUrlInput || !kahootUrlInput.value.trim()){
            return;
        }
        var raw = kahootUrlInput.value.trim();
        var payload = {
            visibility: kahootVisSelect ? kahootVisSelect.value : 'public',
            ownerToken: getAnonOwnerToken()
        };
        if(/^https?:\/\//i.test(raw)) payload.url = raw;
        else payload.id = raw;

        var submitBtn = kahootForm.querySelector('button[type="submit"]');
        if(submitBtn) submitBtn.disabled = true;
        if(kahootStatus) kahootStatus.textContent = t('importing');
    try{
        var res = await fetch('/api/import/kahoot', {
            method: 'POST',
            headers: (function(){
                var base = { 'Content-Type': 'application/json' };
                var token = getAnonOwnerToken();
                if(token) base['X-Owner-Token'] = token;
                return base;
            })(),
            body: JSON.stringify(payload)
        });
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
                if(kahootStatus) kahootStatus.textContent = body.error || t('importError');
                if(submitBtn) submitBtn.disabled = false;
                return;
            }
            if(kahootStatus){
                kahootStatus.innerHTML = t('importSuccess') + ': ' + (body.name || '') + ' (' + body.count + ') ';
                var btn = document.createElement('button');
                btn.textContent = t('play');
                btn.onclick = function(){ startGame(body.id); };
                btn.className = 'btn btn-primary btn-small';
                kahootStatus.appendChild(btn);
                if(body.id){
                    var editBtn = document.createElement('button');
                    editBtn.textContent = t('editQuiz');
                    editBtn.className = 'btn btn-ghost btn-small';
                    editBtn.onclick = function(){ window.location.href = '/create/quiz-creator/?id=' + body.id; };
                    kahootStatus.appendChild(editBtn);
                }
            }
            if(submitBtn) submitBtn.disabled = false;
            if(body.id) rememberClaimableQuizId(body.id);
            socket.emit('requestDbNames');
        }catch(err){
            if(kahootStatus) kahootStatus.textContent = t('importError');
            if(submitBtn) submitBtn.disabled = false;
        }
    });
}
