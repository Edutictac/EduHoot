// Normalización y aleatorización de preguntas, extraído de solo.js (usado por la biblioteca y por el juego)
    function normalizeName(str){
        return (str || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 3);
    }

    function mediaThumb(data){
        if(!data) return '';
        var yt = parseYouTubeId(data);
        if(yt){
            return 'https://img.youtube.com/vi/' + yt + '/hqdefault.jpg';
        }
        return normalizeSvgDataUrlForImg(data);
    }

    function shuffleArray(arr){
        var copy = arr.slice();
        for(var i = copy.length - 1; i > 0; i--){
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = copy[i];
            copy[i] = copy[j];
            copy[j] = tmp;
        }
        return copy;
    }

    function normalizeFreeText(value){
        var str = (value || '').toString().trim().toLowerCase();
        if(!str) return '';
        try{
            str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }catch(e){}
        str = str.replace(/[^a-z0-9\s]/g, ' ');
        str = str.replace(/\s+/g, ' ').trim();
        return str;
    }

    function splitAcceptedAnswers(raw){
        var text = (raw || '').toString().trim();
        if(!text) return [];
        var parts = text.split(/[|\n]+/g);
        var flat = [];
        parts.forEach(function(chunk){
            String(chunk || '').split(',').forEach(function(p){ flat.push(p); });
        });
        var out = [];
        var seen = {};
        flat.forEach(function(part){
            var original = (part || '').toString().trim();
            if(!original) return;
            var key = normalizeFreeText(original);
            if(!key) return;
            if(seen[key]) return;
            seen[key] = true;
            out.push(original);
        });
        return out;
    }

    function parseLenientNumber(value){
        if(value === undefined || value === null) return null;
        if(typeof value === 'number' && Number.isFinite(value)) return value;
        var raw = String(value).trim();
        if(!raw) return null;
        var normalized = raw.replace(/\s+/g, '').replace(',', '.');
        var num = Number.parseFloat(normalized);
        return Number.isFinite(num) ? num : null;
    }

    function normalizeQuestionMeta(q){
        var type = (q && q.type) ? String(q.type).toLowerCase() : 'quiz';
        var allowed = { 'quiz': true, 'multiple': true, 'true-false': true, 'short-answer': true, 'numeric': true, 'poll': true };
        if(!allowed[type]){
            type = 'quiz';
        }

        var acceptedAnswers = [];
        var numericAnswer = null;
        var tolerance = 0;
        if(type === 'short-answer'){
            if(Array.isArray(q && q.acceptedAnswers)){
                acceptedAnswers = q.acceptedAnswers.slice();
            }else{
                acceptedAnswers = splitAcceptedAnswers((q && (q.texto || q.text || q.correctText || q.correct)) || '');
            }
        }
        if(type === 'numeric'){
            numericAnswer = parseLenientNumber(q && (q.numericAnswer !== undefined ? q.numericAnswer : (q.numero !== undefined ? q.numero : q.correct)));
            var tol = parseLenientNumber(q && (q.tolerance !== undefined ? q.tolerance : q.tolerancia));
            tolerance = (tol === null) ? 0 : tol;
        }

        // Para tipos no indexados mantenemos compatibilidad (correctAnswers = [1]).
        if(type === 'poll'){
            return { type: type, correctAnswers: [], correct: 0, acceptedAnswers: [], numericAnswer: null, tolerance: null };
        }
        if(type === 'short-answer' || type === 'numeric'){
            return {
                type: type,
                correctAnswers: [1],
                correct: 1,
                acceptedAnswers: acceptedAnswers,
                numericAnswer: numericAnswer,
                tolerance: tolerance
            };
        }

        var answers = Array.isArray(q && q.correctAnswers) ? q.correctAnswers.slice() : [];
        if(!answers.length && q && typeof q.correct !== 'undefined'){
            var parsed = parseInt(q.correct, 10);
            if(!Number.isNaN(parsed)){
                answers.push(parsed);
            }
        }
        if(!answers.length){
            answers.push(1);
        }
        var maxAnswerIndex = (type === 'true-false') ? 2 : 4;
        var normalized = answers.map(function(value){
            var num = parseInt(value, 10);
            if(Number.isNaN(num)) return 1;
            return Math.max(1, Math.min(maxAnswerIndex, num));
        });
        var first = normalized.length ? normalized[0] : 1;
        return {
            type: type,
            correctAnswers: normalized,
            correct: first,
            acceptedAnswers: [],
            numericAnswer: null,
            tolerance: null
        };
    }

    function getVisibleAnswers(q, type){
        if(type === 'short-answer' || type === 'numeric'){
            return [];
        }
        var answers = Array.isArray(q && q.answers) ? q.answers.slice(0, 4) : ['', '', '', ''];
        while(answers.length < 4) answers.push('');
        if(type === 'true-false'){
            return answers.slice(0, 2);
        }
        return answers;
    }

    function areAnswerSetsEqual(left, right){
        if(!Array.isArray(left) || !Array.isArray(right)) return false;
        var sortedLeft = left.slice().sort(function(a, b){ return a - b; });
        var sortedRight = right.slice().sort(function(a, b){ return a - b; });
        if(sortedLeft.length !== sortedRight.length) return false;
        for(var i = 0; i < sortedLeft.length; i++){
            if(sortedLeft[i] !== sortedRight[i]) return false;
        }
        return true;
    }

    function randomizeOneQuestion(q){
        var meta = normalizeQuestionMeta(q);

        if(meta.type === 'short-answer' || meta.type === 'numeric'){
            return {
                question: q.question || '',
                answers: Array.isArray(q.answers) ? q.answers.slice(0, 4) : ['', '', '', ''],
                correct: 1,
                correctAnswers: [1],
                type: meta.type,
                image: q.image || '',
                video: q.video || '',
                time: q.time,
                acceptedAnswers: Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers : [],
                numericAnswer: meta.numericAnswer,
                tolerance: meta.tolerance
            };
        }

        var answers = Array.isArray(q.answers) ? q.answers.slice(0, 4) : ['', '', '', ''];
        while(answers.length < 4) answers.push('');

        // En true/false solo se muestran 2 opciones: barajamos solo 2 para que
        // el índice correcto no quede oculto fuera del slice(0,2).
        var baseOrder = (meta.type === 'true-false') ? [0, 1] : [0, 1, 2, 3];
        var answerOrder = shuffleArray(baseOrder);
        var newAnswers = answerOrder.map(function(idx){ return answers[idx]; });
        if(meta.type === 'true-false'){
            while(newAnswers.length < 4) newAnswers.push('');
        }
        var newCorrectAnswers = [];
        meta.correctAnswers.forEach(function(orig){
            var zero = Math.max(0, Math.min(3, orig - 1));
            var newIdx = answerOrder.indexOf(zero);
            if(newIdx !== -1){
                var candidate = newIdx + 1;
                if(newCorrectAnswers.indexOf(candidate) === -1){
                    newCorrectAnswers.push(candidate);
                }
            }
        });
        if(!newCorrectAnswers.length){
            newCorrectAnswers.push(1);
        }
        var newCorrect = newCorrectAnswers[0];
        return {
            question: q.question || '',
            answers: newAnswers,
            correct: newCorrect,
            correctAnswers: newCorrectAnswers,
            type: meta.type,
            image: q.image || '',
            video: q.video || '',
            time: q.time
        };
    }

    function randomizeQuestions(baseQuestions){
        var source = Array.isArray(baseQuestions) ? baseQuestions : [];
        var shuffledOrder = shuffleArray(source);
        return shuffledOrder.map(function(q){ return randomizeOneQuestion(q); });
    }

    function getQuestions(){
        if(Array.isArray(state.questions) && state.questions.length) return state.questions;
        if(state.quizData && Array.isArray(state.quizData.questions)) return state.quizData.questions;
        return [];
    }

    function findMediaInQuestions(questions){
        if(!Array.isArray(questions)) return '';
        var withMedia = questions.filter(function(q){ return q && (q.image || q.video); });
        if(!withMedia.length) return '';
        var random = withMedia[Math.floor(Math.random() * withMedia.length)];
        return mediaThumb(random.image || random.video || '');
    }
