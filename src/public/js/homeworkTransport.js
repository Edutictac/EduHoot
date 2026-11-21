// Deures asíncrons: pantalla del alumnat. Se carga en /player/self-paced/ y solo actúa con ?hw=CÓDIGO.
// Hace dos cosas: (1) la entrada (nombre, o nombre + código de recuperación) y (2) un «socket» falso
// que habla con la API HTTP (/api/homework/:code/act) y entrega los mismos eventos que el servidor
// en directo, de modo que playerSelfPaced.js sirve tal cual. Vore HOMEWORK_PLAN.md.
(function(){
    'use strict';
    var code = String(new URLSearchParams(window.location.search).get('hw') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if(!code) return;

    var API = '/api/homework/' + encodeURIComponent(code);
    var KEY = 'eduhootHomework:' + code;
    var ICONS = ['🦊', '🐼', '🦁', '🐸', '🐙', '🦉', '🐢', '🦄', '🐧', '🐳'];
    var hw = window.EDUHOOT_HOMEWORK = { code: code, name: '', recovery: '' };
    document.body.classList.add('hw-mode', 'hw-entry-open');

    function t(key){ return window.i18nPlayer ? window.i18nPlayer.t(key) : key; }
    function fmt(key, vars){
        return String(t(key)).replace(/\{(\w+)\}/g, function(_, k){ return vars && vars[k] !== undefined ? String(vars[k]) : ''; });
    }
    function $(id){ return document.getElementById(id); }
    function loadSaved(){
        try{ var v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && v.name && v.recovery ? v : null; }catch(e){ return null; }
    }
    function save(){
        try{ localStorage.setItem(KEY, JSON.stringify({ name: hw.name, recovery: hw.recovery })); }catch(e){}
    }
    function forget(){ try{ localStorage.removeItem(KEY); }catch(e){} }

    // ----- «Socket» falso sobre HTTP -----
    var handlers = {};
    var queue = Promise.resolve();
    var timeUpBusy = false;
    var retrying = false;
    var socket = {
        id: 'hw-self',
        connected: false,
        on: function(name, fn){ (handlers[name] = handlers[name] || []).push(fn); return socket; },
        disconnect: function(){ socket.connected = false; return socket; },
        connect: function(){ return socket; },
        emit: function(name, data){
            if(name === 'player-join-game') request('resume');
            else if(name === 'spNext') request('next');
            else if(name === 'spAnswer') request('answer', data);
            else if(name === 'spNewAttempt') request('newAttempt');
            else if(name === 'spTimeUp'){
                if(timeUpBusy) return socket;
                timeUpBusy = true;
                request('timeUp').then(function(){ timeUpBusy = false; });
            }else if(name === 'playerLeave') trigger('playerLeft', []);
            return socket;
        }
    };
    function trigger(name, args){
        (handlers[name] || []).forEach(function(fn){ fn.apply(null, args || []); });
    }
    window.io = function(){ return socket; };

    function post(op, value){
        return fetch(API + '/act', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: hw.name, recovery: hw.recovery, op: op, value: value })
        }).then(function(res){ return res.json().catch(function(){ return {}; }).then(function(body){ return { status: res.status, body: body }; }); });
    }

    // Las acciones van en fila, para que lleguen en orden. Si la red falla, se avisa y se reintenta.
    function request(op, value){
        var job = queue.then(function(){ return post(op, value); }).then(function(res){
            if(res.status === 200){ deliver(res.body); return; }
            if(res.status === 401 || res.status === 404){ forget(); trigger('noGameFound', []); return; }
            if(res.status >= 500 || res.status === 429) throw new Error('retry');
            // 403/409 (cerrado, sin intentos…): no hay nada que pintar; se vuelve a pedir el estado.
            if(op !== 'resume') return request('resume');
        }).catch(function(){ goOffline(); });
        queue = job.then(function(){}, function(){});
        return job;
    }

    function deliver(body){
        if(retrying){ retrying = false; trigger('connect', []); }
        trigger('quizInfo', [{ quizName: body.title || '' }]);
        trigger('playerGameData', [[{ playerId: socket.id, name: hw.name, gameData: { score: body.score || 0, streak: body.streak || 0 } }]]);
        (body.events || []).forEach(function(ev){ trigger(ev.name, ev.data === null || ev.data === undefined ? [] : [ev.data]); });
    }

    function goOffline(){
        if(retrying) return;
        retrying = true;
        trigger('disconnect', []);
        (function again(){
            setTimeout(function(){
                post('resume').then(function(res){
                    if(res.status === 200){ retrying = false; trigger('connect', []); }
                    else if(res.status === 401 || res.status === 404){ forget(); trigger('noGameFound', []); }
                    else again();
                }).catch(again);
            }, 2500);
        })();
    }

    // ----- Entrada -----
    var info = null;

    function show(id, on){ var el = $(id); if(el) el.hidden = !on; }
    function setError(key){
        var el = $('hwError');
        el.textContent = key ? t(key) : '';
        el.hidden = !key;
    }
    var ERRORS = {
        'bad-name': 'hw_err_bad_name', 'name-taken': 'hw_err_name_taken', 'bad-recovery': 'hw_err_bad_recovery',
        closed: 'hw_err_closed', full: 'hw_err_full', 'too-many-attempts': 'hw_err_too_many', 'not-found': 'hw_err_not_found'
    };

    function startGame(){
        document.body.classList.remove('hw-entry-open');
        show('hwEntry', false);
        socket.connected = true;
        trigger('connect', []);
    }

    function fillInfo(){
        $('hwTitle').textContent = info.title || info.quizName || t('hw_heading');
        var d = new Date(info.deadline);
        $('hwDeadline').textContent = fmt('hw_deadline', { d: d.toLocaleString(window.i18nPlayer ? window.i18nPlayer.lang : undefined, { dateStyle: 'medium', timeStyle: 'short' }) });
        var attempts = info.maxAttempts === 1 ? t('hw_attempts_one') : (info.maxAttempts === 0 ? t('hw_attempts_unlimited') : fmt('hw_attempts_n', { n: info.maxAttempts }));
        $('hwMeta').textContent = fmt('hw_questions', { n: info.totalQuestions }) + ' · ' + attempts;
        $('hwClosed').hidden = info.open;
        if(!info.open) $('hwClosed').textContent = t('hw_closed_info');
    }

    var returning = false; // «Ya he empezado»
    function renderMode(){
        show('hwForm', true);
        show('hwRecoveryRow', returning);
        $('hwModeToggle').textContent = returning ? t('hw_new_here') : t('hw_have_code');
        $('hwSubmit').textContent = returning ? t('hw_enter') : t('hw_start');
        $('hwSubmit').disabled = !returning && !info.open;
        setError('');
    }

    function submit(ev){
        ev.preventDefault();
        setError('');
        var name = $('hwName').value.trim();
        var recovery = returning ? $('hwRecovery').value.trim() : '';
        $('hwSubmit').disabled = true;
        fetch(API + '/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, recovery: recovery || undefined, icon: ICONS[Math.floor(Math.random() * ICONS.length)] })
        }).then(function(res){ return res.json().catch(function(){ return {}; }).then(function(body){ return { status: res.status, body: body }; }); })
        .then(function(res){
            $('hwSubmit').disabled = false;
            if(res.status !== 200){ setError(ERRORS[res.body.error] || 'hw_err_generic'); return; }
            hw.name = res.body.student.name;
            hw.recovery = res.body.student.recovery;
            save();
            if(recovery){ startGame(); return; }
            // Alta nueva: se enseña el código una vez.
            show('hwForm', false);
            $('hwCodeValue').textContent = hw.recovery;
            show('hwCodeBox', true);
        }).catch(function(){ $('hwSubmit').disabled = false; setError('hw_err_generic'); });
    }

    function init(){
        $('hwHeading').textContent = t('hw_heading');
        $('hwNameLabel').textContent = t('hw_name_label');
        $('hwNameHint').textContent = t('hw_name_hint');
        $('hwRecoveryLabel').textContent = t('hw_code_label');
        $('hwCodeTitle').textContent = t('hw_code_title');
        $('hwCodeText').textContent = t('hw_code_text');
        $('hwCodeGo').textContent = t('hw_code_go');
        show('hwEntry', true);
        fetch(API).then(function(res){
            if(res.status === 404){ setError('hw_err_not_found'); show('hwForm', false); return null; }
            return res.json();
        }).then(function(body){
            if(!body) return;
            info = body;
            fillInfo();
            var saved = loadSaved();
            if(saved){
                // Dispositivo conocido: se comprueba el código y se entra directamente.
                fetch(API + '/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: saved.name, recovery: saved.recovery }) })
                    .then(function(r){ return r.json().then(function(b){ return { status: r.status, body: b }; }); })
                    .then(function(r){
                        if(r.status === 200){ hw.name = r.body.student.name; hw.recovery = saved.recovery; startGame(); }
                        else if(r.status === 401){ forget(); renderMode(); }
                        else renderMode();
                    }).catch(renderMode);
            }else if(!info.open){
                // Cerrado y sin código: solo pueden entrar quienes ya participaron.
                returning = true;
                renderMode();
            }else{
                renderMode();
            }
        }).catch(function(){ setError('hw_err_generic'); });
    }

    document.addEventListener('DOMContentLoaded', function(){
        $('hwForm').addEventListener('submit', submit);
        $('hwModeToggle').addEventListener('click', function(){ returning = !returning; renderMode(); });
        $('hwCodeGo').addEventListener('click', startGame);
        init();
    });
})();
