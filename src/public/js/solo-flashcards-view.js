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
        phase: 'start',
        shuffle: false
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
                        state.title = { key: 'startError' };
                        return;
                    }
                    openFlashcards(payload.body);
                })
                .catch(function(){
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
            c.flipped = false;
            c.phase = deck.length ? 'card' : 'done';
        },
        cardsFlip: function(){
            stopFlashcardsSpeech();
            this.s.cards.flipped = !this.s.cards.flipped;
        },
        cardsPrev: function(){
            var c = this.s.cards;
            if(c.pos === 0) return;
            stopFlashcardsSpeech();
            c.pos -= 1;
            c.flipped = false;
        },
        cardsNext: function(){
            var c = this.s.cards;
            stopFlashcardsSpeech();
            c.flipped = false;
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
            c.flipped = false;
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
