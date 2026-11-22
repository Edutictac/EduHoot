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
    var hw = window.EDUHOOT_HOMEWORK = { code: code, name: '', recovery: '', attemptNo: 1, maxAttempts: 1 };
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
        if(body.attemptNo) hw.attemptNo = body.attemptNo;
        trigger('quizInfo', [{ quizName: body.title || '', attemptNo: hw.attemptNo, maxAttempts: hw.maxAttempts }]);
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

    // ----- Entrada (app de Vue: #hw-entry, plantilla #hw-entry-tpl) -----
    var ERRORS = {
        'bad-name': 'hw_err_bad_name', 'name-taken': 'hw_err_name_taken', 'bad-recovery': 'hw_err_bad_recovery',
        closed: 'hw_err_closed', full: 'hw_err_full', 'too-many-attempts': 'hw_err_too_many', 'not-found': 'hw_err_not_found'
    };

    function json(res){ return res.json().catch(function(){ return {}; }).then(function(body){ return { status: res.status, body: body }; }); }

    function startGame(vm){
        document.body.classList.remove('hw-entry-open');
        vm.visible = false;
        socket.connected = true;
        trigger('connect', []);
    }

    // Intento en curso (n de m) para la cabecera de la partida: lo da el servidor al entrar y al reintentar.
    function setAttempt(n, max){
        hw.attemptNo = n;
        hw.maxAttempts = max;
    }

    var entry = Vue.createApp({
        template: '#hw-entry-tpl',
        data: function(){
            return { visible: true, loading: true, info: null, notFound: false, returning: false, name: '', recovery: '', busy: false, errorKey: '', codeValue: '', showCode: false };
        },
        computed: {
            title: function(){ return this.info ? (this.info.title || this.info.quizName || t('hw_heading')) : ''; },
            deadlineText: function(){
                if(!this.info) return '';
                var d = new Date(this.info.deadline);
                return fmt('hw_deadline', { d: d.toLocaleString(window.i18nPlayer ? window.i18nPlayer.lang : undefined, { dateStyle: 'medium', timeStyle: 'short' }) });
            },
            metaText: function(){
                if(!this.info) return '';
                var max = this.info.maxAttempts;
                // Sufijo de la clave según la puntuación: _avg, _first o _last (sin sufijo: cuenta el mejor).
                var suffix = { average: '_avg', first: '_first', last: '_last' }[this.info.scoring] || '';
                var attempts = max === 1 ? t('hw_attempts_one') : (max === 0 ? t('hw_attempts_unlimited' + suffix) : fmt('hw_attempts_n' + suffix, { n: max }));
                return fmt('hw_questions', { n: this.info.totalQuestions }) + ' · ' + attempts;
            },
            formVisible: function(){ return !this.loading && !this.notFound && !this.showCode; },
            submitDisabled: function(){ return this.busy || (!this.returning && !!this.info && !this.info.open); }
        },
        mounted: function(){ this.load(); },
        methods: {
            t: t,
            toggleMode: function(){ this.returning = !this.returning; this.errorKey = ''; },
            load: function(){
                var vm = this;
                fetch(API).then(function(res){
                    if(res.status === 404){ vm.notFound = true; vm.errorKey = 'hw_err_not_found'; vm.loading = false; return null; }
                    return res.json();
                }).then(function(body){
                    if(!body) return;
                    vm.info = body;
                    var saved = loadSaved();
                    if(!saved){
                        // Cerrado y sin código: solo pueden entrar quienes ya participaron.
                        if(!body.open) vm.returning = true;
                        vm.loading = false;
                        return;
                    }
                    // Dispositivo conocido: se comprueba el código y se entra directamente.
                    fetch(API + '/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: saved.name, recovery: saved.recovery }) })
                        .then(json)
                        .then(function(r){
                            if(r.status === 200){
                                hw.name = r.body.student.name; hw.recovery = saved.recovery;
                                setAttempt((r.body.attempts || []).length || 1, r.body.maxAttempts);
                                startGame(vm);
                                return;
                            }
                            if(r.status === 401) forget();
                            vm.loading = false;
                        }).catch(function(){ vm.loading = false; });
                }).catch(function(){ vm.errorKey = 'hw_err_generic'; vm.loading = false; });
            },
            submit: function(){
                var vm = this;
                var name = this.name.trim();
                var recovery = this.returning ? this.recovery.trim() : '';
                this.errorKey = '';
                this.busy = true;
                fetch(API + '/join', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name, recovery: recovery || undefined, icon: ICONS[Math.floor(Math.random() * ICONS.length)] })
                }).then(json).then(function(res){
                    vm.busy = false;
                    if(res.status !== 200){ vm.errorKey = ERRORS[res.body.error] || 'hw_err_generic'; return; }
                    hw.name = res.body.student.name;
                    hw.recovery = res.body.student.recovery;
                    setAttempt((res.body.attempts || []).length || 1, res.body.maxAttempts);
                    save();
                    if(recovery){ startGame(vm); return; }
                    // Alta nueva: se enseña el código una vez.
                    vm.codeValue = hw.recovery;
                    vm.showCode = true;
                }).catch(function(){ vm.busy = false; vm.errorKey = 'hw_err_generic'; });
            },
            go: function(){ startGame(this); }
        }
    });

    document.addEventListener('DOMContentLoaded', function(){ entry.mount('#hw-entry'); });
})();
