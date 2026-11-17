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
    var answers = Array.isArray(q.answers) ? q.answers : [];
    return meta.correctAnswers
        .map(function(n){ return answers[n - 1]; })
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

function openFlashcards(quiz){
    state.quizData = null;
    state.currentQuiz = quiz.id;
    state.title = quiz.name ? { text: quiz.name } : { key: 'soloTitle' };
    document.body.classList.add('playing');
    var questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    var all = loadFlashcardsProgress();
    state.cards = {
        quizId: String(quiz.id),
        total: questions.length,
        all: EduhootFlashcards.buildCards(questions),
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
        cardsMedia: function(){
            var cur = this.cardsCurrent;
            return mediaFor(cur ? cur.q : null);
        },
        // Opcions que el alumnat veu en el anverso: només en preguntes de resposta múltiple
        // (varies correctes). Les de resposta única no les mostren.
        cardsOptions: function(){
            var cur = this.cardsCurrent;
            if(!cur) return [];
            if(normalizeQuestionMeta(cur.q).type !== 'multiple') return [];
            var answers = Array.isArray(cur.q.answers) ? cur.q.answers : [];
            return answers
                .map(function(a, i){ return { n: i + 1, text: a === null || a === undefined ? '' : String(a) }; })
                .filter(function(o){ return o.text.trim() !== ''; });
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
            snapCardFront(c);
            c.phase = deck.length ? 'card' : 'done';
        },
        // Clic de girar: espera FLIP_DELAY_MS i després gira. Si abans canvia la targeta, snapCardFront
        // incrementa turnId i el retard es descarta.
        cardsFlip: function(){
            var c = this.s.cards;
            if(!c || c.turning) return;
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
            // El vídeo i el YouTube tenen els seus propis controls: no giren la targeta. La imatge sí.
            if(ev.target.closest && ev.target.closest('video, iframe')) return;
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
            var parts = this.s.cards.flipped ? this.cardsBackParts : [this.cardsFrontText];
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
        cardsMarkUnknown: function(){ this.cardsMark(EduhootFlashcards.UNKNOWN); }
    }
};
