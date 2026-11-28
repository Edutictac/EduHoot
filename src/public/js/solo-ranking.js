// Puntuación y ranking del modo individual (incluido el modal del nombre), extraído de solo.js
// Las listas se guardan en state como elementos { row } (fila del ranking),
// { key } (texto traducible) o { text } (mensaje del servidor); la
// plantilla de Vue las pinta.
    function rankingItemsFrom(rows){
        return rows.slice(0, 10).map(function(row){ return { row: row }; });
    }

    function submitScore(nameToUse){
        state.rankingBox.items.push({ key: 'saving' });
        fetch('/api/quizzes/' + encodeURIComponent(state.currentQuiz) + '/solo-run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nameToUse || state.playerName,
                studentJoinToken: state.studentJoinToken || '',
                score: state.score,
                totalQuestions: getScoredQuestionCount()
            })
        })
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                if(!payload.ok){
                    var error = payload.body && payload.body.error;
                    state.rankingBox = { visible: true, items: [error ? { text: error } : { key: 'rankingError' }] };
                    return;
                }
                renderRanking(payload.body.top || []);
            })
            .catch(function(){
                state.rankingBox = { visible: true, items: [{ key: 'rankingError' }] };
            });
    }

    function renderRanking(list){
        state.rankingBox = {
            visible: true,
            items: list.length ? rankingItemsFrom(list) : [{ key: 'rankingError' }]
        };
    }

    function showQuizRanking(id){
        state.rankingModal = { open: true, items: [{ key: 'loading' }] };
        fetch('/api/quizzes/' + encodeURIComponent(id) + '/solo-ranking')
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                var rows = payload.ok && payload.body && Array.isArray(payload.body.top) ? payload.body.top : [];
                if(!rows.length){
                    var error = payload.body && payload.body.error;
                    state.rankingModal.items = [error ? { text: error } : { key: 'rankingEmpty' }];
                    return;
                }
                state.rankingModal.items = rankingItemsFrom(rows);
            })
            .catch(function(){
                state.rankingModal.items = [{ key: 'rankingError' }];
            });
    }

    function hideRankingModal(){
        state.rankingModal.open = false;
    }

    function openNameModal(){
        state.nameInput = normalizeName(state.nameInput || state.playerName || 'AAA');
        state.nameModalOpen = true;
        setTimeout(function(){
            var input = document.getElementById('player-name');
            if(input){ input.focus(); input.select(); }
        }, 10);
    }

    function closeNameModal(){
        state.nameModalOpen = false;
    }

    function shouldPromptName(topList, newScore){
        if(!Array.isArray(topList)) return true;
        if(topList.length < 10) return true;
        var minScore = topList[topList.length - 1] ? (topList[topList.length - 1].score || 0) : 0;
        return newScore >= minScore;
    }

    function prepareScoreSubmission(){
        if(state.studentJoinToken){
            submitScore(state.playerName || state.commonsPublicCode || t('namePlaceholder'));
            return;
        }
        var score = state.score;
        fetch('/api/quizzes/' + encodeURIComponent(state.currentQuiz) + '/solo-ranking')
            .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
            .then(function(payload){
                var top = (payload.ok && payload.body && Array.isArray(payload.body.top)) ? payload.body.top : [];
                if(shouldPromptName(top, score)){
                    openNameModal();
                }else{
                    submitScore(state.playerName || t('namePlaceholder'));
                }
            })
            .catch(function(){
                submitScore(state.playerName || t('namePlaceholder'));
            });
    }

    function saveNameAndSubmit(){
        var clean = normalizeName(state.nameInput || '');
        state.playerName = clean || t('namePlaceholder');
        closeNameModal();
        submitScore(state.playerName);
    }

    function skipNameAndSubmit(){
        closeNameModal();
        submitScore(state.playerName || t('namePlaceholder'));
    }
