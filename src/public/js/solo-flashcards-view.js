// Vista del mode flashcards a /solo/ (proposta 20 i 25): mixin de Vue amb el
// comportament de la pantalla. La lògica pura (progrés, barrejar, comptar)
// és a solo-flashcards.js. Depèn de funcions globals de /solo/: state, t,
// format, normalizeQuestionMeta, mediaFor, duckSoloMusic, unduckSoloMusic.
var FLASHCARDS_STORAGE = (function(){
    var fallback = { getItem: function(){ return null; }, setItem: function(){} };
    return EduhootFlashcards.defaultStorage() || fallback;
})();

function loadFlashcardsProgress(){
    return EduhootFlashcards.loadAllProgress(FLASHCARDS_STORAGE);
}

function saveFlashcardsProgress(all){
    EduhootFlashcards.saveAllProgress(FLASHCARDS_STORAGE, all);
}

// Vertader/fals: «Verdadero/Falso» (o la traducció de la interfície) encara que el quiz tinga el text
// guardat en un altre idioma. Si el text és un altre (p. ex. «Cierto»), es mostra tal com està.
var TF_TRUE_WORDS = ['true', 'صحيح', 'wahr', 'vero', 'verdadeiro', 'вярно', 'vrai', 'verdadero', 'vertader', 'vertadero', 'cierto', 'verdader'];
var TF_FALSE_WORDS = ['false', 'خطأ', 'غلط', 'falsch', 'грешно', 'невярно', 'faux', 'falso', 'fals'];
function trueFalseText(stored, index, t){
    var key = String(stored === null || stored === undefined ? '' : stored).trim().toLowerCase();
    if(index === 0 && (key === '' || TF_TRUE_WORDS.indexOf(key) !== -1)) return t('flashcardsTrue');
    if(index === 1 && (key === '' || TF_FALSE_WORDS.indexOf(key) !== -1)) return t('flashcardsFalse');
    return stored;
}

// Textos de la cara posterior: les respostes correctes tal com estan al quiz.
function cardAnswerTexts(q, t){
    var meta = normalizeQuestionMeta(q);
    if(meta.type === 'short-answer'){
        return meta.acceptedAnswers.slice();
    }
    if(meta.type === 'numeric'){
        if(meta.numericAnswer === null || meta.numericAnswer === undefined) return [];
        var text = String(meta.numericAnswer);
        if(meta.tolerance) text += ' (' + format(t('flashcardTolerance'), { tol: meta.tolerance }) + ')';
        return [text];
    }
    // Ordenar: en el reverso, los elementos en el orden correcto.
    if(meta.type === 'order'){
        return meta.items.map(function(text, i){ return (i + 1) + ' ' + text; });
    }
    // Correspondencia: en el reverso, las parejas («Francia → París»).
    if(meta.type === 'matching'){
        return meta.pairs
            .filter(function(p){ return p.left; })
            .map(function(p){ return p.left + ' → ' + p.right; });
    }
    var answers = Array.isArray(q.answers) ? q.answers : [];
    var isTf = meta.type === 'true-false';
    return meta.correctAnswers
        .map(function(n){ return isTf ? trueFalseText(answers[n - 1], n - 1, t) : answers[n - 1]; })
        .filter(function(a){ return a !== undefined && a !== null && String(a).trim() !== ''; });
}

// Preferència «Tarjetas con animación» (per dispositiu). Per defecte, activada.
var FLIP_ANIM_KEY = 'eduh_cards_anim';
// Retard entre el clic i el giro (ms), amb o sense animació.
var FLIP_DELAY_MS = 500;

function readFlipAnimPref(){
    try{
        var v = window.localStorage.getItem(FLIP_ANIM_KEY);
        return v === null ? true : v === '1';
    }catch(e){
        return true;
    }
}

function saveFlipAnimPref(on){
    try{ window.localStorage.setItem(FLIP_ANIM_KEY, on ? '1' : '0'); }catch(e){}
}

// Preferència «Respuestas con contraste alto» (per dispositiu). Per defecte, activada.
var CONTRAST_KEY = 'eduh_cards_contrast';

function readContrastPref(){
    try{
        var v = window.localStorage.getItem(CONTRAST_KEY);
        return v === null ? true : v === '1';
    }catch(e){
        return true;
    }
}

function saveContrastPref(on){
    try{ window.localStorage.setItem(CONTRAST_KEY, on ? '1' : '0'); }catch(e){}
}

// Preferència «Mostrar opciones de respuesta» (per dispositiu). Per defecte, activada.
var OPTIONS_KEY = 'eduh_cards_options';

function readOptionsPref(){
    try{
        var v = window.localStorage.getItem(OPTIONS_KEY);
        return v === null ? true : v === '1';
    }catch(e){
        return true;
    }
}

function saveOptionsPref(on){
    try{ window.localStorage.setItem(OPTIONS_KEY, on ? '1' : '0'); }catch(e){}
}

// Preferència «Voltear al hacer clic» (per dispositiu). Per defecte, activada: clicar la targeta la gira.
var FLIP_CLICK_KEY = 'eduh_cards_flip_click';

function readFlipClickPref(){
    try{
        var v = window.localStorage.getItem(FLIP_CLICK_KEY);
        return v === null ? true : v === '1';
    }catch(e){
        return true;
    }
}

function saveFlipClickPref(on){
    try{ window.localStorage.setItem(FLIP_CLICK_KEY, on ? '1' : '0'); }catch(e){}
}

// Preferència «Comprobar respuestas» (per dispositiu). Per defecte, activada.
var VALIDATE_KEY = 'eduh_cards_validate';

function readValidatePref(){
    try{
        var v = window.localStorage.getItem(VALIDATE_KEY);
        return v === null ? true : v === '1';
    }catch(e){
        return true;
    }
}

function saveValidatePref(on){
    try{ window.localStorage.setItem(VALIDATE_KEY, on ? '1' : '0'); }catch(e){}
}

// Torna la targeta al davant sense animació (en canviar de targeta, no ha de girar de nou).
// Cancel·la un giro en curs: el token invalida la part del giro que quedava per fer.
function snapCardFront(c){
    c.turnId = (c.turnId || 0) + 1;
    c.turning = false;
    var el = document.getElementById('flashcard');
    if(el && el.getAnimations) el.getAnimations().forEach(function(a){ a.cancel(); });
    if(c.flipped) c.flipped = false;
}

function stopFlashcardsSpeech(){
    if(window.EduhootTTS) EduhootTTS.cancel();
    state.ttsSpeaking = false;
}

// Correspondencia: la columna derecha de cada pregunta se baraja una vez al abrir el repaso,
// para que el anverso no revele las parejas (la de la izquierda ya va en el orden del quiz).
function buildMatchLayouts(cards){
    var layouts = {};
    cards.forEach(function(card){
        var meta = normalizeQuestionMeta(card.q);
        if(meta.type === 'matching') layouts[String(card.idx)] = EduhootMatching.shuffledLayout(meta.pairs);
    });
    return layouts;
}

// Ordenar: la barreja de cada pregunta també es fa en obrir el repàs, perquè l'anvers no revele l'ordre.
function buildOrderLayouts(cards){
    var layouts = {};
    cards.forEach(function(card){
        var meta = normalizeQuestionMeta(card.q);
        if(meta.type === 'order') layouts[String(card.idx)] = EduhootOrder.shuffledLayout(meta.items);
    });
    return layouts;
}

function openFlashcards(quiz){
    state.quizData = quiz;
    state.currentQuiz = quiz.id;
    state.title = quiz.name ? { text: quiz.name } : { key: 'soloTitle' };
    document.body.classList.add('playing');
    var questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    var all = loadFlashcardsProgress();
    var cards = EduhootFlashcards.buildCards(questions);
    state.cards = {
        quizId: String(quiz.id),
        total: questions.length,
        all: cards,
        matchLayouts: buildMatchLayouts(cards),
        orderLayouts: buildOrderLayouts(cards),
        orders: {},
        status: EduhootFlashcards.quizStatus(all, quiz.id, questions.length),
        deck: [],
        pos: 0,
        flipped: false,
        turning: false,
        turnId: 0,
        phase: 'start',
        shuffle: false,
        animate: readFlipAnimPref(),
        highContrast: readContrastPref(),
        showOptions: readOptionsPref(),
        // Resposta múltiple: true si alguna paraula no cap en el botó de dues columnes (cardsFitOptions).
        oneColumn: false,
        // Validació: l'alumnat contesta, es comprova i es marca sola. results: { '<idx>': 'ok'|'fail'|'skip' }.
        validate: readValidatePref(),
        flipOnClick: readFlipClickPref(),
        roundValidate: false,
        results: {},
        typed: {},
        matches: {},
        picks: {}
    };
    state.view = 'cards';
}

var soloFlashcards = {
    computed: {
        cardsTotal: function(){
            return this.s.cards ? this.s.cards.all.length : 0;
        },
        cardsCounts: function(){
            var c = this.s.cards;
            return c ? EduhootFlashcards.countStatus(c.all, c.status) : { known: 0, unknown: 0, pending: 0 };
        },
        cardsCountsText: function(){
            return format(this.t('flashcardsCounts'), this.cardsCounts);
        },
        cardsCurrent: function(){
            var c = this.s.cards;
            if(!c || c.phase !== 'card') return null;
            return c.deck[c.pos] || null;
        },
        cardsFrontText: function(){
            var cur = this.cardsCurrent;
            return cur ? (cur.q.question || '') : '';
        },
        // Al davant de la targeta només hi ha la imatge (o la miniatura de YouTube): el vídeo es mira abans (cardsLearning).
        cardsMedia: function(){
            var cur = this.cardsCurrent;
            var m = mediaFor(cur ? cur.q : null);
            if(!m.image && m.youtube){
                m.image = 'https://img.youtube.com/vi/' + m.youtube.split('/embed/')[1] + '/hqdefault.jpg';
            }
            return { image: m.image, video: '', youtube: '' };
        },
        // El vídeo complet de la targeta actual (per a la fase de vídeo).
        cardsVideoMedia: function(){
            var cur = this.cardsCurrent;
            return mediaFor(cur ? cur.q : null);
        },
        // Fase «aprén i després respon»: amb vídeo, primer es mira; després es respon.
        cardsLearning: function(){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            return !!(cur && c && cur.q && cur.q.video && !(c.learned && c.learned[cur.idx]));
        },
        cardsHasMedia: function(){
            var m = this.cardsMedia;
            return !!(m.image || m.video || m.youtube);
        },
        // Disposició de les opcions: 'two' (resposta múltiple, sempre dues columnes: 2×2 amb quatre opcions),
        // 'tf' (vertader/fals, els dos botons de la mateixa amplària) o '' (la resta, quadrícula automàtica).
        cardsOptionsColumns: function(){
            var cur = this.cardsCurrent;
            if(!cur) return '';
            var type = normalizeQuestionMeta(cur.q).type;
            if(type === 'true-false') return 'tf';
            // «Quiz (1 correcta)» i «Respuesta múltiple»: les dues amb opcions de text, el mateix tractament.
            if(type === 'quiz' || type === 'multiple') return this.s.cards.oneColumn ? 'one' : 'two';
            return '';
        },
        // Validació: la pregunta es comprova sola (quiz, múltiple, vertader/fals, curta i numèrica) amb la casella activada.
        cardsAutoCheck: function(){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            return !!cur && !!c && !!c.validate && EduhootFlashcards.isValidatableType(normalizeQuestionMeta(cur.q).type);
        },
        // Correspondència en validació: les opcions de la dreta (barajades) per a les desplegables.
        cardsMatchRight: function(){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            if(!cur || !c.validate) return [];
            var layout = c.matchLayouts && c.matchLayouts[String(cur.idx)];
            return layout ? layout.matchRight.slice() : [];
        },
        // Camp de text per a la resposta escrita: 'text' (curta), 'number' (numèrica) o '' (no n'hi ha).
        cardsTypedKind: function(){
            var cur = this.cardsCurrent;
            if(!cur || !this.cardsAutoCheck) return '';
            var type = normalizeQuestionMeta(cur.q).type;
            return type === 'short-answer' ? 'text' : (type === 'numeric' ? 'number' : '');
        },
        cardsTypedValue: function(){
            var cur = this.cardsCurrent;
            var typed = this.s.cards.typed || {};
            return cur && typed[String(cur.idx)] !== undefined ? typed[String(cur.idx)] : '';
        },
        cardsResult: function(){
            var cur = this.cardsCurrent;
            var results = this.s.cards.results || {};
            return cur ? (results[String(cur.idx)] || '') : '';
        },
        cardsResultText: function(){
            var r = this.cardsResult;
            if(r === 'ok') return this.t('flashcardsCorrect');
            if(r === 'fail') return this.t('flashcardsWrong');
            if(r === 'skip') return this.t('flashcardsSkipped');
            return '';
        },
        // Resum al final de la ronda (només si s'ha fet amb «Comprobar respuestas»): correctes, incorrectes i les incorrectes.
        cardsSummary: function(){
            var c = this.s.cards;
            if(!c || c.phase !== 'done' || !c.roundValidate) return null;
            var out = { ok: 0, fail: 0, skip: 0, review: [] };
            c.deck.forEach(function(card){
                var r = c.results[String(card.idx)];
                if(r === 'ok') out.ok += 1;
                else if(r === 'fail'){ out.fail += 1; out.review.push(card.q.question || ''); }
                else if(r === 'skip') out.skip += 1;
            });
            return out;
        },
        cardsSummaryText: function(){
            var s = this.cardsSummary;
            return s ? format(this.t('flashcardsSummary'), { ok: s.ok, fail: s.fail, skip: s.skip }) : '';
        },
        // Vertader/fals amb imatge: les dues opcions una sota l'altra (no en fila).
        cardsOptionsStacked: function(){
            var cur = this.cardsCurrent;
            return !!cur && this.cardsHasMedia && normalizeQuestionMeta(cur.q).type === 'true-false';
        },
        // Opcions que el alumnat veu en el anverso, si la casella de l'inici està activada: en les
        // preguntes de opcions (resposta única, múltiple i vertader/fals). En vertader/fals, només les dues primeres.
        // Respostes llargues: el text dels botons es fa més petit (la targeta pot passar de la finestra).
        cardsLongAnswers: function(){
            return this.cardsOptions.some(function(o){ return o.text.length > 40; });
        },
        cardsOptions: function(){
            var cur = this.cardsCurrent;
            if(!cur || !this.s.cards.showOptions) return [];
            var type = normalizeQuestionMeta(cur.q).type;
            if(type !== 'quiz' && type !== 'multiple' && type !== 'true-false') return [];
            var answers = Array.isArray(cur.q.answers) ? cur.q.answers : [];
            if(type === 'true-false') answers = answers.slice(0, 2);
            var t = this.t;
            return answers
                .map(function(a, i){
                    var text = type === 'true-false' ? trueFalseText(a, i, t) : a;
                    return { n: i + 1, shape: (i % 4) + 1, text: text === null || text === undefined ? '' : String(text) };
                })
                .filter(function(o){ return o.text.trim() !== ''; });
        },
        // Ordenar: en el anverso, los elementos barajados (la barreja de la tarjeta).
        cardsOrderItems: function(){
            var cur = this.cardsCurrent;
            if(!cur) return [];
            var meta = normalizeQuestionMeta(cur.q);
            if(meta.type !== 'order') return [];
            var layout = (this.s.cards.orderLayouts && this.s.cards.orderLayouts[String(cur.idx)]) || { orderItems: meta.items };
            return layout.orderItems.slice();
        },
        // Con la validación activada, el tablero para ordenar hace de comprobación (sustituye al botón).
        cardsOrderBoard: function(){
            return this.cardsOrderItems.length > 0 && this.cardsAutoCheck && !this.cardsResult;
        },
        // Correspondencia: en el anverso, la columna izquierda (lo que hay que emparejar).
        cardsMatchLeft: function(){
            var cur = this.cardsCurrent;
            if(!cur) return [];
            var meta = normalizeQuestionMeta(cur.q);
            return meta.type === 'matching' ? meta.matchLeft : [];
        },
        // Con la casilla de opciones activada, el anverso muestra las dos columnas (la derecha barajada), en tabla.
        cardsMatchTable: function(){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            // Amb la validació activada la correspondència sempre es respon a la taula (amb desplegables).
            if(!cur || !(c.showOptions || c.validate)) return [];
            var meta = normalizeQuestionMeta(cur.q);
            if(meta.type !== 'matching') return [];
            var layout = (c.matchLayouts && c.matchLayouts[String(cur.idx)]) || { matchRight: [] };
            // Una fila per element de l'esquerra; una resposta de la dreta sobrant (distractor) només surt a les desplegables.
            var rows = meta.matchLeft.length;
            var out = [];
            for(var i = 0; i < rows; i++){
                out.push({ left: meta.matchLeft[i] || '', right: layout.matchRight[i] || '' });
            }
            return out;
        },
        // Hay algún bloque de opciones en el anverso (opciones o tabla de correspondencia): se usa para centrar o dividir.
        cardsHasOptionsBlock: function(){
            return this.cardsOptions.length > 0 || this.cardsMatchTable.length > 0 || this.cardsOrderItems.length > 0;
        },
        cardsBackParts: function(){
            var cur = this.cardsCurrent;
            return cur ? cardAnswerTexts(cur.q, this.t) : [];
        },
        cardsProgressText: function(){
            var c = this.s.cards;
            return c ? format(this.t('questionOf'), { current: c.pos + 1, total: c.deck.length }) : '';
        },
        cardsTtsAvailable: function(){
            return !!(this.cardsCurrent && this.s.ttsReady);
        }
    },
    methods: {
        study: function(id){
            state.title = { key: 'loading' };
            state.view = 'none';
            fetch('/api/quizzes/' + encodeURIComponent(id))
                .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
                .then(function(payload){
                    if(!payload.ok){
                        document.body.classList.remove('playing');
                        state.title = { key: 'startError' };
                        return;
                    }
                    openFlashcards(payload.body);
                })
                .catch(function(){
                    document.body.classList.remove('playing');
                    state.title = { key: 'startError' };
                });
        },
        cardsStart: function(mode){
            var c = this.s.cards;
            if(!c) return;
            var deck = EduhootFlashcards.deckFor(c.all, c.status, mode);
            if(c.shuffle) deck = EduhootFlashcards.shuffleCopy(deck);
            stopFlashcardsSpeech();
            c.deck = deck;
            c.pos = 0;
            // Ronda nova: resultats, respostes escrites i opcions marcades de zero.
            c.results = {};
            c.typed = {};
            c.matches = {};
            c.picks = {};
            // Fase de vídeo (feature 24): les targetes amb vídeo ja vistes en aquesta ronda.
            c.learned = {};
            // El clic que inicia la sessió no ha de tancar la fase del primer vídeo (és anterior a aquest instant).
            c.learnFrom = performance.now();
            c.roundValidate = !!c.validate;
            snapCardFront(c);
            c.phase = deck.length ? 'card' : 'done';
        },
        // Clic de girar: espera FLIP_DELAY_MS i després gira. Si abans canvia la targeta, snapCardFront
        // incrementa turnId i el retard es descarta.
        // Acaba la fase de vídeo de la targeta actual (botó o final del vídeo).
        cardsFinishLearning: function(ev){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            if(!cur || !c) return;
            if(ev && ev.timeStamp && c.learnFrom && ev.timeStamp < c.learnFrom) return;
            if(!c.learned) c.learned = {};
            c.learned[cur.idx] = true;
        },
        cardsFlip: function(){
            var c = this.s.cards;
            if(!c || c.turning) return;
            if(this.cardsLearning) this.cardsFinishLearning();
            stopFlashcardsSpeech();
            c.turning = true;
            var self = this;
            var token = (c.turnId = (c.turnId || 0) + 1);
            setTimeout(function(){
                if(c.turnId !== token) return;
                self.cardsDoFlip(c, token);
            }, FLIP_DELAY_MS);
        },
        cardsToggleAnimate: function(){
            var c = this.s.cards;
            c.animate = !c.animate;
            saveFlipAnimPref(c.animate);
        },
        isCardPicked: function(n){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            var set = cur && c.picks ? c.picks[String(cur.idx)] : null;
            return !!(set && set[n]);
        },
        cardsPick: function(n){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            if(!cur) return;
            var key = String(cur.idx);
            var prev = (c.picks && c.picks[key]) || {};
            var multiple = normalizeQuestionMeta(cur.q).type === 'multiple';
            var next = multiple ? Object.assign({}, prev) : {};
            next[n] = !prev[n];
            var copy = Object.assign({}, c.picks);
            copy[key] = next;
            c.picks = copy;
        },
        cardsToggleContrast: function(){
            var c = this.s.cards;
            c.highContrast = !c.highContrast;
            saveContrastPref(c.highContrast);
        },
        cardsToggleOptions: function(){
            var c = this.s.cards;
            c.showOptions = !c.showOptions;
            saveOptionsPref(c.showOptions);
        },
        // Giro en dues meitats: la targeta s'estreny fins a una línia, canvia de cara i es torna a obrir.
        // Sense animació, canvia de cara de seguida.
        cardsDoFlip: function(c, token){
            var el = document.getElementById('flashcard');
            if(!c.animate || !el || !el.animate){
                c.flipped = !c.flipped;
                c.turning = false;
                return;
            }
            var self = this;
            var half1 = el.animate(
                [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }],
                { duration: 200, easing: 'ease-in', fill: 'forwards' }
            );
            half1.onfinish = function(){
                if(c.turnId !== token) return;
                c.flipped = !c.flipped;
                self.$nextTick(function(){
                    if(c.turnId !== token) return;
                    var half2 = el.animate(
                        [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
                        { duration: 200, easing: 'ease-out' }
                    );
                    half1.cancel();
                    half2.onfinish = function(){
                        if(c.turnId === token) c.turning = false;
                    };
                });
            };
        },
        // Clic a qualsevol punt de la targeta la gira. No ho fa en el media (vídeo, imatge, iframe),
        // ni si l'usuari està seleccionant text.
        cardsFlipFromCard: function(ev){
            // Amb «Voltear al hacer clic» desactivat, només gira el botó «Mostrar respuesta».
            if(!this.s.cards.flipOnClick) return;
            // El vídeo i el YouTube tenen els seus propis controls: no giren la targeta. La imatge sí.
            if(ev.target.closest && ev.target.closest('video, iframe')) return;
            // Durant la fase del vídeo, girar la targeta també la deixa com a vista (la fase acaba).
            if(this.cardsLearning) this.cardsFinishLearning();
            var sel = window.getSelection ? window.getSelection() : null;
            if(sel && !sel.isCollapsed && String(sel).trim() !== '') return;
            this.cardsFlip();
        },
        cardsPrev: function(){
            var c = this.s.cards;
            if(c.pos === 0) return;
            stopFlashcardsSpeech();
            c.pos -= 1;
            snapCardFront(c);
        },
        cardsNext: function(){
            var c = this.s.cards;
            this.cardsSkipIfUnchecked();
            stopFlashcardsSpeech();
            snapCardFront(c);
            if(c.pos + 1 < c.deck.length){
                c.pos += 1;
            }else{
                c.phase = 'done';
            }
        },
        // Marca la targeta actual i passa a la següent. El progrés es guarda al dispositiu.
        cardsMark: function(status){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            if(!cur) return;
            var all = loadFlashcardsProgress();
            c.status = EduhootFlashcards.setStatus(all, c.quizId, c.total, cur.idx, status);
            saveFlashcardsProgress(all);
            this.cardsSetResult(status === EduhootFlashcards.KNOWN ? 'ok' : 'fail');
            this.cardsNext();
        },
        cardsReset: function(){
            var c = this.s.cards;
            var all = loadFlashcardsProgress();
            delete all[c.quizId];
            saveFlashcardsProgress(all);
            c.status = {};
        },
        cardsShuffleNow: function(){
            var c = this.s.cards;
            stopFlashcardsSpeech();
            c.deck = EduhootFlashcards.shuffleCopy(c.deck);
            c.pos = 0;
            snapCardFront(c);
        },
        cardsSpeak: function(){
            if(this.s.ttsSpeaking){
                stopFlashcardsSpeech();
                return;
            }
            var cur = this.cardsCurrent;
            if(!cur) return;
            var parts = this.s.cards.flipped ? this.cardsBackParts : [this.cardsFrontText].concat(this.cardsMatchLeft);
            if(!parts.length) return;
            this.s.ttsSpeaking = true;
            var started = EduhootTTS.speakParts(parts, document.documentElement.lang, function(){
                state.ttsSpeaking = false;
                unduckSoloMusic();
            });
            if(started){
                duckSoloMusic();
            }else{
                this.s.ttsSpeaking = false;
            }
        },
        cardsStartAll: function(){ this.cardsStart('all'); },
        cardsStartUnknown: function(){ this.cardsStart('unknown'); },
        cardsToggleShuffle: function(){ this.s.cards.shuffle = !this.s.cards.shuffle; },
        cardsMarkKnown: function(){ this.cardsMark(EduhootFlashcards.KNOWN); },
        cardsMarkUnknown: function(){ this.cardsMark(EduhootFlashcards.UNKNOWN); },
        // Correspondència: l'element de la dreta triat per a la fila i (la desplegable).
        cardsSetMatch: function(i, value){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            if(!cur) return;
            var key = String(cur.idx);
            var current = Object.assign({}, c.matches[key]);
            if(value === '' || value === null || value === undefined) delete current[i];
            else current[i] = Number(value);
            var copy = Object.assign({}, c.matches);
            copy[key] = current;
            c.matches = copy;
        },
        cardsMatchValue: function(i){
            var cur = this.cardsCurrent;
            var m = cur ? this.s.cards.matches[String(cur.idx)] : null;
            return m && m[i] !== undefined ? String(m[i]) : '';
        },
        cardsToggleFlipOnClick: function(){
            var c = this.s.cards;
            c.flipOnClick = !c.flipOnClick;
            saveFlipClickPref(c.flipOnClick);
        },
        cardsToggleValidate: function(){
            var c = this.s.cards;
            c.validate = !c.validate;
            saveValidatePref(c.validate);
        },
        // Ordenar: l'alumnat envia el seu ordre des del tauler i la targeta es comprova com les altres.
        cardsSubmitOrder: function(order){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            if(!cur) return;
            var copy = Object.assign({}, c.orders);
            copy[String(cur.idx)] = order.slice();
            c.orders = copy;
            this.cardsCheck();
        },
        cardsSetTyped: function(value){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            if(!cur) return;
            var copy = Object.assign({}, c.typed);
            copy[String(cur.idx)] = value;
            c.typed = copy;
        },
        cardsSetResult: function(result){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            if(!cur) return;
            var copy = Object.assign({}, c.results);
            copy[String(cur.idx)] = result;
            c.results = copy;
        },
        // Guarda el resultat de la targeta actual: el progrés (sabida si és correcta) i el resum de la ronda.
        cardsAutoMark: function(result){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            if(!cur) return;
            var all = loadFlashcardsProgress();
            c.status = EduhootFlashcards.setStatus(all, c.quizId, c.total, cur.idx, result === 'ok' ? EduhootFlashcards.KNOWN : EduhootFlashcards.UNKNOWN);
            saveFlashcardsProgress(all);
            this.cardsSetResult(result);
        },
        // Comprova la resposta de l'alumnat i gira la targeta per ensenyar la correcta.
        cardsCheck: function(){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            if(!cur || !this.cardsAutoCheck || c.results[String(cur.idx)]) return;
            var meta = normalizeQuestionMeta(cur.q);
            // La solució de la correspondència és la de la disposició barajada que es mostra.
            if(meta.type === 'matching') meta = Object.assign({}, meta, { matchSolution: (c.matchLayouts[String(cur.idx)] || {}).matchSolution || [] });
            if(meta.type === 'order') meta = Object.assign({}, meta, { orderShown: (c.orderLayouts[String(cur.idx)] || {}).orderShown || [] });
            var ok = EduhootFlashcards.judgeCard(meta, c.picks[String(cur.idx)] || {}, c.typed[String(cur.idx)], c.matches[String(cur.idx)] || {}, c.orders[String(cur.idx)]);
            this.cardsAutoMark(ok ? 'ok' : 'fail');
            if(!c.flipped) this.cardsFlip();
        },
        // Amb la validació activada, passar una targeta sense comprovar-la compta com a «sense responder» (no sabuda).
        cardsSkipIfUnchecked: function(){
            var cur = this.cardsCurrent;
            var c = this.s.cards;
            if(!cur || !this.cardsAutoCheck || c.results[String(cur.idx)]) return;
            this.cardsAutoMark('skip');
        },
        // Resposta múltiple: les opcions es proven en dues columnes. Si alguna paraula es surt del botó
        // (no cap), passen a una columna i la targeta creix en alçada per encabir-les (no es talla cap paraula).
        cardsFitOptions: function(){
            var c = this.s.cards;
            if(!c) return;
            c.oneColumn = false;
            var type = this.cardsCurrent ? normalizeQuestionMeta(this.cardsCurrent.q).type : '';
            if(type !== 'quiz' && type !== 'multiple') return;
            this.$nextTick(function(){
                var buttons = document.querySelectorAll('#flashcard .flashcard__option');
                c.oneColumn = Array.prototype.some.call(buttons, function(b){ return b.scrollWidth > b.clientWidth + 1; });
            });
        }
    },
    watch: {
        cardsCurrent: function(){ this.cardsFitOptions(); }
    },
    mounted: function(){
        // En canviar la finestra, les opcions es tornen a provar (poden cabre en dues columnes).
        var self = this;
        var timer = null;
        window.addEventListener('resize', function(){
            clearTimeout(timer);
            timer = setTimeout(function(){ self.cardsFitOptions(); }, 150);
        });
    }
};
