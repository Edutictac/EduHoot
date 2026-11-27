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
// Barra fija de acciones: se ve si ni el bloque de arriba ni el de abajo están en pantalla y no hay teclado virtual.
var fixedBar = Vue.reactive({ ready: false, topVisible: false, bottomVisible: false, keyboard: false });
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
        back: 'Biblioteca',
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
        questionTypeMatching: 'Correspondencia (emparejar)',
        matchingHint: 'Escribe cada pareja. En la partida, la columna derecha se baraja.',
        matchingLeft: 'Izquierda',
        matchingRight: 'Derecha',
        matchingAddPair: '+ Añadir pareja',
        matchingImpostors: 'Impostoras: elementos de la derecha sin pareja (opcional)',
        matchingAddImpostor: '+ Añadir impostora',
        matchingCount: '{n} de 8 elementos en la columna derecha',
        matchingRemove: 'Quitar',
        matchingErrorPairs: 'Pregunta {n}: la correspondencia necesita al menos 2 parejas completas.',
        matchingErrorIncomplete: 'Pregunta {n}: completa las dos columnas de cada pareja o quítala.',
        matchingErrorDuplicate: 'Pregunta {n}: los elementos de la derecha no se pueden repetir.',
        matchingErrorMax: 'Pregunta {n}: como máximo 8 elementos en la columna derecha.',
        questionTypeOrder: 'Ordenar',
        orderHint: 'Escribe los elementos en el orden correcto. En la partida, se barajan.',
        orderItemLabel: 'Elemento {n}',
        orderAddItem: '+ Añadir elemento',
        orderCount: '{n} de 8 elementos',
        orderGradingLabel: 'Puntuación',
        orderGradingAbsolute: 'Posición absoluta (parcial)',
        orderGradingAll: 'Todo o nada',
        orderGradingRelativeCorrect: 'Relativa a la posición correcta',
        orderGradingNextExclude: 'Relativa al siguiente (sin contar el último)',
        orderGradingNextInclude: 'Relativa al siguiente (contando el último)',
        orderGradingOnePrevNext: 'Relativa al anterior y al siguiente',
        orderGradingAllPrevNext: 'Relativa a todos los anteriores y siguientes',
        orderGradingLongestOrdered: 'Subconjunto ordenado más largo',
        orderGradingLongestContiguous: 'Subconjunto contiguo más largo',
        orderLayoutLabel: 'Disposición',
        orderLayoutVertical: 'Vertical',
        orderLayoutHorizontal: 'Horizontal',
        orderErrorItems: 'Pregunta {n}: ordenar necesita al menos 2 elementos.',
        orderErrorMax: 'Pregunta {n}: como máximo 8 elementos.',
        orderErrorDuplicate: 'Pregunta {n}: los elementos no se pueden repetir.',
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
        realtimeError: 'No se pudo conectar con el servidor en tiempo real. Recarga la página e inténtalo de nuevo.',
        fixedActionsLabel: 'Acciones del quiz',
    },
    en: {
        back: 'Library',
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
        questionTypeMatching: 'Matching (pair up)',
        matchingHint: 'Write each pair. During the game, the right column is shuffled.',
        matchingLeft: 'Left',
        matchingRight: 'Right',
        matchingAddPair: '+ Add pair',
        matchingImpostors: 'Distractors: right-column items with no pair (optional)',
        matchingAddImpostor: '+ Add distractor',
        matchingCount: '{n} of 8 items in the right column',
        matchingRemove: 'Remove',
        matchingErrorPairs: 'Question {n}: matching needs at least 2 complete pairs.',
        matchingErrorIncomplete: 'Question {n}: fill in both columns of each pair or remove it.',
        matchingErrorDuplicate: 'Question {n}: right-column items cannot be repeated.',
        matchingErrorMax: 'Question {n}: at most 8 items in the right column.',
        questionTypeOrder: 'Order (sort)',
        orderHint: 'Write the items in the correct order. During the game, they are shuffled.',
        orderItemLabel: 'Item {n}',
        orderAddItem: '+ Add item',
        orderCount: '{n} of 8 items',
        orderGradingLabel: 'Scoring',
        orderGradingAbsolute: 'Absolute position (partial)',
        orderGradingAll: 'All or nothing',
        orderGradingRelativeCorrect: 'Relative to the correct position',
        orderGradingNextExclude: 'Relative to the next item (not counting the last)',
        orderGradingNextInclude: 'Relative to the next item (counting the last)',
        orderGradingOnePrevNext: 'Relative to the previous and next items',
        orderGradingAllPrevNext: 'Relative to all previous and next items',
        orderGradingLongestOrdered: 'Longest ordered subset',
        orderGradingLongestContiguous: 'Longest contiguous subset',
        orderLayoutLabel: 'Layout',
        orderLayoutVertical: 'Vertical',
        orderLayoutHorizontal: 'Horizontal',
        orderErrorItems: 'Question {n}: ordering needs at least 2 items.',
        orderErrorMax: 'Question {n}: at most 8 items.',
        orderErrorDuplicate: 'Question {n}: items cannot be repeated.',
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
        realtimeError: 'Could not connect to the real-time server. Reload the page and try again.',
        fixedActionsLabel: 'Quiz actions',
    },
    fr: {
        back: 'Bibliothèque',
        title: 'Créateur de quiz',
        subtitle: 'Conçois des questions et enregistre ta partie pour la lancer quand tu veux.',
        langLabel: 'Langue',
        configEyebrow: 'Réglages',
        configTitle: 'Données du quiz',
        configDesc: 'Donne-lui un nom pour l\'identifier dans la bibliothèque.',
        quizTitle: 'Titre du quiz',
        tagsLabel: 'Tags (séparés par des virgules)',
        visibilityLabel: 'Visibilité du quiz',
        visibilityPrivate: 'Moi seul (privé)',
        visibilityUnlisted: 'Par lien/ID',
        visibilityPublic: 'Public dans la bibliothèque',
        publicWarning: 'Les quiz publics font partie de la bibliothèque globale et ne peuvent plus être modifiés sauf si tu te connectes.',
        allowCloneLabel: 'Autoriser la copie',
        languageLabel: 'Langue du contenu (facultatif)',
        licenseLabel: 'Licence (facultatif)',
        descriptionLabel: 'Description (facultatif)',
        suggestedTags: 'Tags suggérés (touche pour ajouter)',
        questionsEyebrow: 'Questions',
        questionsTitle: 'Crée les questions',
        questionsDesc: 'Ajoute des réponses et choisis un mode pour chaque question.',
        addQuestion: '+ Ajouter une question',
        btnSave: 'Enregistrer le quiz',
        btnPlayLocal: 'Jouer sans enregistrer',
        btnCancel: 'Annuler et revenir',
        localInfo: 'Sans session : « Enregistrer » ou « Jouer sans enregistrer » créent un quiz anonyme. « Moi seul » expire en 24 h ; « Par lien/Public » est stocké globalement. Avec une session, il est enregistré sur ton compte.',
        questionLabel: 'Question',
        answerLabel: 'Réponse',
        correctLabel: 'Bonne réponse (1-4)',
        questionTypeLabel: 'Mode de question',
        questionTypeSingle: 'Quiz (1 correcte)',
        questionTypeMultiple: 'Réponses multiples',
        questionTypeTf: 'Vrai / Faux',
        questionTypeShort: 'Réponse courte',
        questionTypeNumeric: 'Numérique',
        questionTypePoll: 'Sondage (sans points)',
        questionTypeMatching: 'Association (relier)',
        matchingHint: 'Écris chaque paire. Pendant la partie, la colonne de droite est mélangée.',
        matchingLeft: 'Gauche',
        matchingRight: 'Droite',
        matchingAddPair: '+ Ajouter une paire',
        matchingImpostors: 'Leurres : éléments de la colonne de droite sans paire (facultatif)',
        matchingAddImpostor: '+ Ajouter un leurre',
        matchingCount: '{n} sur 8 éléments dans la colonne de droite',
        matchingRemove: 'Supprimer',
        matchingErrorPairs: 'Question {n} : l\'association demande au moins 2 paires complètes.',
        matchingErrorIncomplete: 'Question {n} : remplis les deux colonnes de chaque paire ou supprime-la.',
        matchingErrorDuplicate: 'Question {n} : les éléments de la colonne de droite ne peuvent pas se répéter.',
        matchingErrorMax: 'Question {n} : 8 éléments maximum dans la colonne de droite.',
        questionTypeOrder: 'Ordre (classer)',
        orderHint: 'Écris les éléments dans le bon ordre. Pendant la partie, ils sont mélangés.',
        orderItemLabel: 'Élément {n}',
        orderAddItem: '+ Ajouter un élément',
        orderCount: '{n} sur 8 éléments',
        orderGradingLabel: 'Notation',
        orderGradingAbsolute: 'Position absolue (partielle)',
        orderGradingAll: 'Tout ou rien',
        orderGradingRelativeCorrect: 'Relative à la bonne position',
        orderGradingNextExclude: 'Relative à l\'élément suivant (sans compter le dernier)',
        orderGradingNextInclude: 'Relative à l\'élément suivant (en comptant le dernier)',
        orderGradingOnePrevNext: 'Relative aux éléments précédent et suivant',
        orderGradingAllPrevNext: 'Relative à tous les éléments précédents et suivants',
        orderGradingLongestOrdered: 'Plus long sous-ensemble ordonné',
        orderGradingLongestContiguous: 'Plus long sous-ensemble contigu',
        orderLayoutLabel: 'Disposition',
        orderLayoutVertical: 'Verticale',
        orderLayoutHorizontal: 'Horizontale',
        orderErrorItems: 'Question {n} : l\'ordre demande au moins 2 éléments.',
        orderErrorMax: 'Question {n} : 8 éléments maximum.',
        orderErrorDuplicate: 'Question {n} : les éléments ne peuvent pas se répéter.',
        questionTypeMultiHint: 'Coche toutes les réponses qui comptent.',
        questionTimeLabel: 'Limite de temps (secondes)',
        shortAnswersLabel: 'Réponses acceptées (séparées par |)',
        numericAnswerLabel: 'Réponse numérique',
        numericToleranceLabel: 'Tolérance (±)',
        imageLabel: 'Image (URL facultative)',
        videoLabel: 'Vidéo (URL facultative)',
        namePlaceholder: 'ex. : Révision sur l\'énergie',
        tagsPlaceholder: 'ex. : physique, 4e, énergie',
        languagePlaceholder: 'ex. : français, español, català',
        licensePlaceholder: 'ex. : CC BY-SA 4.0',
        descriptionPlaceholder: 'Brève description du quiz',
        urlPlaceholder: 'https://...',
        playErrorName: 'Donne-lui un nom',
        playErrorTags: 'Ajoute au moins un tag',
        playErrorQuestions: 'Ajoute des questions',
        loadError: 'Impossible de charger le quiz.',
        saveError: 'Impossible d\'enregistrer le quiz.',
        saveOk: 'Quiz mis à jour',
        confirmCancel: 'Sûr ? Les modifications seront perdues.',
        realtimeError: 'Impossible de se connecter au serveur en temps réel. Recharge la page et réessaie.',
        fixedActionsLabel: 'Actions du quiz'
    },
    ca: {
        back: "Biblioteca",
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
        questionTypeMatching: 'Correspondència (emparellar)',
        matchingHint: 'Escriu cada parella. En la partida, la columna dreta es barreja.',
        matchingLeft: 'Esquerra',
        matchingRight: 'Dreta',
        matchingAddPair: '+ Afegir parella',
        matchingImpostors: 'Impostores: elements de la dreta sense parella (opcional)',
        matchingAddImpostor: '+ Afegir impostora',
        matchingCount: '{n} de 8 elements en la columna dreta',
        matchingRemove: 'Llevar',
        matchingErrorPairs: 'Pregunta {n}: la correspondència necessita almenys 2 parelles completes.',
        matchingErrorIncomplete: 'Pregunta {n}: completa les dues columnes de cada parella o lleva-la.',
        matchingErrorDuplicate: 'Pregunta {n}: els elements de la dreta no es poden repetir.',
        matchingErrorMax: 'Pregunta {n}: com a màxim 8 elements en la columna dreta.',
        questionTypeOrder: 'Ordenar',
        orderHint: "Escriu els elements en l'ordre correcte. En la partida, es barregen.",
        orderItemLabel: 'Element {n}',
        orderAddItem: '+ Afegir element',
        orderCount: '{n} de 8 elements',
        orderGradingLabel: 'Puntuació',
        orderGradingAbsolute: 'Posició absoluta (parcial)',
        orderGradingAll: 'Tot o res',
        orderGradingRelativeCorrect: 'Relativa a la posició correcta',
        orderGradingNextExclude: 'Relativa a l\'element següent (sense comptar l\'últim)',
        orderGradingNextInclude: 'Relativa a l\'element següent (comptant l\'últim)',
        orderGradingOnePrevNext: 'Relativa a l\'anterior i al següent',
        orderGradingAllPrevNext: 'Relativa a tots els anteriors i següents',
        orderGradingLongestOrdered: 'Subconjunt ordenat més llarg',
        orderGradingLongestContiguous: 'Subconjunt contigu més llarg',
        orderLayoutLabel: 'Disposició',
        orderLayoutVertical: 'Vertical',
        orderLayoutHorizontal: 'Horitzontal',
        orderErrorItems: 'Pregunta {n}: ordenar necessita almenys 2 elements.',
        orderErrorMax: 'Pregunta {n}: com a màxim 8 elements.',
        orderErrorDuplicate: 'Pregunta {n}: els elements no es poden repetir.',
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
        realtimeError: 'No s\'ha pogut connectar amb el servidor en temps real. Recarrega la pàgina i torna-ho a provar.',
        fixedActionsLabel: 'Accions del quiz',
    },
    va: {
        subtitle: 'Dissenya les preguntes i guarda el joc per llançar-lo quan vulgues.',
        btnSave: 'Guardar quiz',
        btnPlayLocal: 'Jugar sense guardar',
        localInfo: 'Sense sessió: “Guardar” o “Jugar sense guardar” creen un quiz anònim. "Només jo" caduca en 24h; "Per enllaç/Públic" es guarda globalment. Amb sessió, queda al teu usuari.',
        confirmCancel: 'Segur que vols eixir? Es perdran els canvis.',
        realtimeError: 'No s\'ha pogut connectar amb el servidor en temps real. Recarrega la pàgina i torna-ho a intentar.',
    }
};

function t(key){
    var chain = ui.lang === 'va' ? ['va', 'ca', 'es'] : [ui.lang, 'en', 'es'];
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
                alert(t('realtimeError'));
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

        // Correspondencia: parejas completas y, al final, impostoras (sin izquierda).
        if(questionType === 'matching'){
            base.answers = ['', '', '', ''];
            base.correct = 1;
            base.correctAnswers = [1];
            base.pairs = matchingPairsOf(card);
        }

        // Ordenar: els elements en l'ordre correcte (les files buides no es guarden); a la partida es barregen.
        if(questionType === 'order'){
            base.answers = ['', '', '', ''];
            base.correct = 1;
            base.correctAnswers = [1];
            base.items = orderItemsOf(card);
            base.orderGrading = card.orderGrading;
            base.layout = card.orderLayout;
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

var MATCHING_MAX_ITEMS = 8;
var ORDER_MAX_ITEMS = 8;

function trimText(v){
    return (v === undefined || v === null) ? '' : String(v).trim();
}

function matchingPairsOf(card){
    var out = [];
    (card.pairs || []).forEach(function(p){
        var left = trimText(p.left);
        var right = trimText(p.right);
        if(left && right) out.push({ left: left, right: right });
    });
    (card.impostors || []).forEach(function(text){
        var right = trimText(text);
        if(right) out.push({ left: '', right: right });
    });
    return out;
}

// Mensaje de error de la primera correspondencia mal hecha, o '' si están bien.
function matchingCardError(card, num){
    var msg = function(key){ return t(key).replace('{n}', num); };
    var incomplete = (card.pairs || []).some(function(p){
        return !trimText(p.left) !== !trimText(p.right);
    });
    if(incomplete) return msg('matchingErrorIncomplete');
    var pairs = matchingPairsOf(card);
    if(pairs.filter(function(p){ return p.left; }).length < 2) return msg('matchingErrorPairs');
    if(pairs.length > MATCHING_MAX_ITEMS) return msg('matchingErrorMax');
    var seen = {};
    var duplicate = pairs.some(function(p){
        var key = p.right.toLowerCase();
        if(seen[key]) return true;
        seen[key] = true;
        return false;
    });
    return duplicate ? msg('matchingErrorDuplicate') : '';
}

function orderItemsOf(card){
    return (card.orderItems || []).map(trimText).filter(function(v){ return v; });
}

// Mensaje de error de la pregunta de ordenar, o '' si está bien.
function orderCardError(card, num){
    var msg = function(key){ return t(key).replace('{n}', num); };
    var items = orderItemsOf(card);
    if(items.length < 2) return msg('orderErrorItems');
    if(items.length > ORDER_MAX_ITEMS) return msg('orderErrorMax');
    var seen = Object.create(null);
    var duplicate = items.some(function(v){
        if(seen[v]) return true;
        seen[v] = true;
        return false;
    });
    return duplicate ? msg('orderErrorDuplicate') : '';
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
    for(var i = 0; i < questionCards.length; i++){
        var error = '';
        if(questionCards[i].type === 'matching') error = matchingCardError(questionCards[i], i + 1);
        if(questionCards[i].type === 'order') error = orderCardError(questionCards[i], i + 1);
        if(error){
            alert(error);
            return false;
        }
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
    if(card.type === 'short-answer' || card.type === 'numeric' || card.type === 'matching'){
        card.answers = ['', '', '', ''];
    }
    if(card.type === 'matching'){
        while(card.pairs.length < 2) card.pairs.push({ left: '', right: '' });
    }
    if(card.type === 'order'){
        card.answers = ['', '', '', ''];
        while(card.orderItems.length < 2) card.orderItems.push('');
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
        // Correspondencia: parejas (izquierda y derecha) e impostoras (solo derecha).
        pairs: (Array.isArray(data.pairs) ? data.pairs : [])
            .filter(function(p){ return p && trimText(p.left); })
            .map(function(p){ return { left: trimText(p.left), right: trimText(p.right) }; }),
        impostors: (Array.isArray(data.pairs) ? data.pairs : [])
            .filter(function(p){ return p && !trimText(p.left) && trimText(p.right); })
            .map(function(p){ return trimText(p.right); }),
        // Ordenar: elementos en l'ordre correcte, puntuació (0 = posició absoluta, -1 = tot o res) i disposició.
        orderItems: (Array.isArray(data.items) ? data.items : []).map(trimText).filter(function(v){ return v; }),
        orderGrading: (data.orderGrading === undefined || data.orderGrading === null) ? 0 : Number(data.orderGrading),
        orderLayout: String(data.layout || '').toLowerCase() === 'horizontal' ? 'horizontal' : 'vertical',
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

// Vigila los dos bloques de acciones (arriba y abajo) y el teclado virtual para mostrar u ocultar la barra fija.
function watchFixedActions(topEl, bottomEl){
    if(typeof IntersectionObserver === 'function' && topEl && bottomEl){
        var observer = new IntersectionObserver(function(entries){
            entries.forEach(function(entry){
                if(entry.target === topEl) fixedBar.topVisible = entry.isIntersecting;
                if(entry.target === bottomEl) fixedBar.bottomVisible = entry.isIntersecting;
            });
            fixedBar.ready = true;
        });
        observer.observe(topEl);
        observer.observe(bottomEl);
    }
    // Teclado virtual (móvil): se oculta la barra mientras se escribe, para no tapar el campo.
    var coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    function typing(){
        var el = document.activeElement;
        if(!el) return false;
        var tag = el.tagName;
        if(tag === 'TEXTAREA') return true;
        if(tag !== 'INPUT') return false;
        return ['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].indexOf((el.type || '').toLowerCase()) === -1;
    }
    function updateKeyboard(){
        var vv = window.visualViewport;
        var shrunk = !!(vv && vv.height < window.innerHeight * 0.75);
        fixedBar.keyboard = shrunk || (coarse && typing());
    }
    document.addEventListener('focusin', function(){ setTimeout(updateKeyboard, 0); });
    document.addEventListener('focusout', function(){ setTimeout(updateKeyboard, 0); });
    if(window.visualViewport) window.visualViewport.addEventListener('resize', updateKeyboard);
}

Vue.createApp({
    template: '#creator-tpl',
    data: function(){
        return {
            cards: questionCards,
            ui: ui,
            fixedBar: fixedBar,
            form: form,
            session: session,
            // Els nou modes de puntuació de Moodle (gradingtype), amb el seu valor numèric.
            orderGradingChoices: [
                { value: 0, key: 'orderGradingAbsolute' }, { value: -1, key: 'orderGradingAll' },
                { value: 7, key: 'orderGradingRelativeCorrect' }, { value: 1, key: 'orderGradingNextExclude' },
                { value: 2, key: 'orderGradingNextInclude' }, { value: 3, key: 'orderGradingOnePrevNext' },
                { value: 4, key: 'orderGradingAllPrevNext' }, { value: 5, key: 'orderGradingLongestOrdered' },
                { value: 6, key: 'orderGradingLongestContiguous' }
            ],
            typeOptions: [
                ['quiz', 'questionTypeSingle'], ['multiple', 'questionTypeMultiple'],
                ['true-false', 'questionTypeTf'], ['short-answer', 'questionTypeShort'],
                ['numeric', 'questionTypeNumeric'], ['poll', 'questionTypePoll'],
                ['matching', 'questionTypeMatching'], ['order', 'questionTypeOrder']
            ]
        };
    },
    computed: {
        showFixedActions: function(){
            var f = this.fixedBar;
            return f.ready && !f.topVisible && !f.bottomVisible && !f.keyboard;
        },
        showPublicWarning: function(){
            return !this.session.authenticated && this.form.visibility !== 'private';
        },
        selectedTags: function(){
            return parseTagsInput();
        }
    },
    mounted: function(){
        watchFixedActions(this.$refs.topActions, this.$refs.bottomActions);
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
            var msg = l === 'en' ? 'Delete this question?' : { fr: 'Supprimer cette question ?', de: 'Diese Frage löschen?', it: 'Eliminare questa domanda?', pt: 'Eliminar esta pergunta?', bg: 'Да се изтрие ли този въпрос?', ar: 'هل تريد حذف هذا السؤال؟' }[l] || (l === 'va' ? 'Eliminar esta pregunta?' : (l === 'ca' ? 'Eliminar aquesta pregunta?' : '¿Eliminar esta pregunta?'));
            if(window.confirm(msg)){
                this.cards.splice(index, 1);
            }
        },
        onTypeChange: function(card){
            applyTypeRules(card);
        },
        showCorrect: function(card){
            return ['multiple', 'short-answer', 'numeric', 'poll', 'matching', 'order'].indexOf(card.type) === -1;
        },
        // Elementos de la columna derecha (parejas e impostoras); como máximo 8.
        rightCount: function(card){
            return card.pairs.length + card.impostors.length;
        },
        matchingCountText: function(card){
            return t('matchingCount').replace('{n}', this.rightCount(card));
        },
        addPair: function(card){
            if(this.rightCount(card) < MATCHING_MAX_ITEMS) card.pairs.push({ left: '', right: '' });
        },
        addImpostor: function(card){
            if(this.rightCount(card) < MATCHING_MAX_ITEMS) card.impostors.push('');
        },
        orderCountText: function(card){
            return t('orderCount').replace('{n}', card.orderItems.length);
        },
        addOrderItem: function(card){
            if(card.orderItems.length < ORDER_MAX_ITEMS) card.orderItems.push('');
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
        // Al editar, el cursor va al títol (addQuestion el posa a la última pregunta; aquest nextTick va després).
        Vue.nextTick(function(){
            var nameInput = document.getElementById('name');
            if(nameInput) nameInput.focus();
        });
        var subtitle = document.getElementById('subtitle');
        if(subtitle){
            subtitle.textContent = 'Editando quiz ID ' + id;
        }
    }catch(err){
        alert(t('loadError'));
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
