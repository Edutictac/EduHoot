// Acciones sobre un quiz en /create/: jugar, renombrar, borrar, compartir y clonar, extraído de create.js
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
