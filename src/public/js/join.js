// Pantalla d'entrada (/join.html): modal del PIN, icona, nom i identitat
// d'alumne. Subfase B: tot és estat reactiu d'una app de Vue (#join-app).
(function(){
    var ICONS = ['🦊', '🐱', '🐶', '🐼', '🐧', '🐸', '🦉', '🦄', '🐰', '🐢', '🐙', '🦁', '🐨', '🐝', '🐯',
        '🐻', '🦕', '🦖', '🐉', '🚀', '🌈', '⚽️', '🏀', '🏆', '🎮', '🎧', '📚', '🎨', '🐵', '🐮',
        '🐷', '🐔', '🦋', '🐬', '🐳', '🦈', '🐘', '🦒', '🦩', '🐥'];

    // Máximo de cambios voluntarios de nombre (botón del dado) por alumno y partida.
    var RANDOM_NAME_MAX_REROLLS = 2;
    function rerollsKey(pin){ return 'eduhoot-rerolls-' + pin; }
    function readRerolls(pin){
        try{
            var n = parseInt(sessionStorage.getItem(rerollsKey(pin)), 10);
            return isFinite(n) && n > 0 ? Math.min(n, RANDOM_NAME_MAX_REROLLS) : 0;
        }catch(e){ return 0; }
    }
    function saveRerolls(pin, used){
        try{ sessionStorage.setItem(rerollsKey(pin), String(used)); }catch(e){}
    }

    function t(key, fallback){
        if(window.i18nPlayer && typeof window.i18nPlayer.t === 'function'){
            return window.i18nPlayer.t(key);
        }
        return fallback || key;
    }

    // Nombres aleatorios (feature 12): lista del servidor, cacheada en la página.
    var randomNameList = null;
    function loadRandomNameList(){
        if(randomNameList) return Promise.resolve(randomNameList);
        return fetch('/api/random-names', { headers: { 'Accept': 'application/json' } })
            .then(function(res){ return res.json(); })
            .then(function(list){
                randomNameList = Array.isArray(list) ? list : [];
                return randomNameList;
            });
    }

    // Elige un nombre de la lista que no esté ya en uso en la partida (se reintenta hasta 15 veces).
    function pickFreeRandomName(pin, list, tries){
        if(!list.length) return Promise.resolve('');
        var candidate = list[Math.floor(Math.random() * list.length)];
        return checkNameAvailable(pin, candidate).then(function(available){
            if(available) return candidate;
            if(tries <= 1) return '';
            return pickFreeRandomName(pin, list, tries - 1);
        }).catch(function(){ return candidate; });
    }

    function delay(ms){
        return new Promise(function(resolve){ setTimeout(resolve, ms); });
    }

    function loadTokens(){
        try{
            return JSON.parse(localStorage.getItem('playerTokens') || '{}');
        }catch(e){
            return {};
        }
    }
    function saveTokens(obj){
        localStorage.setItem('playerTokens', JSON.stringify(obj));
    }
    function genToken(){
        var arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
    }

    function checkNameAvailable(pin, name){
        return fetch('/api/validate-name?pin=' + encodeURIComponent(pin) + '&name=' + encodeURIComponent(name), { headers: { 'Accept': 'application/json' } })
            .then(function(res){ return res.json(); })
            .then(function(data){ return !(data && data.available === false); })
            .catch(function(){ return true; });
    }

    function normalizeStudentCode(value){
        return (value || '').replace(/[^0-9a-zA-Z]/g, '').toUpperCase().slice(0, 3);
    }

    function normalizeStudentPin(value){
        return (value || '').replace(/[^0-9]/g, '').slice(0, 6);
    }

    function normalizeGuestName(value){
        return (value || '').toString().replace(/\s+/g, ' ').trim().slice(0, 20);
    }

    // Versión "en vivo" para mientras se escribe: no recorta los espacios del
    // final (si no, sería imposible teclear un nombre con varias palabras,
    // p.ej. "Ana Maria", porque cada espacio se borraría solo).
    // Nombre escrito: letras y números, sin empezar por número, de 3 a 20 caracteres.
    // Sin espacios, símbolos ni signos de puntuación (igual que el servidor).
    function normalizeGuestNameLive(value){
        return (value || '').toString().replace(/[^\p{L}0-9]/gu, '').replace(/^[0-9]+/, '').slice(0, 20);
    }
    function isValidTypedName(name){
        return typeof name === 'string' && name.length >= 3 && name.length <= 20 && /^\p{L}[\p{L}0-9]*$/u.test(name);
    }

    // Aplica el filtre a l'input i torna el valor net. Cal tocar el DOM perquè,
    // si el valor filtrat coincidix amb l'anterior, Vue no repinta l'input.
    function filterInput(ev, normalize){
        var filtered = normalize(ev.target.value);
        if(ev.target.value !== filtered) ev.target.value = filtered;
        return filtered;
    }

    var app = Vue.createApp({
        template: '#join-tpl',
        data: function(){
            return {
                icons: ICONS,
                iconIndex: 0,
                modalOpen: true,
                pinModalValue: '',
                pinError: '',
                validating: false,
                pinValidated: false,
                pin: '',
                // Con nombres aleatorios el alumnado no escribe el suyo: se le asigna uno de la lista.
                randomNames: false,
                // Quien ha abandonado la partida recupera su nombre: no lo puede elegir ni escribir.
                nameLocked: false,
                rolling: false,
                rerollsUsed: 0,
                name: '',
                studentAuthEnabled: false,
                studentAuthRequired: false,
                studentCode: '',
                studentPin: '',
                studentAuthStatus: '',
                nameError: '',
                studentJoinToken: '',
                token: '',
                submitting: false
            };
        },
        computed: {
            icon: function(){ return this.icons[this.iconIndex] || ''; }
        },
        watch: {
            modalOpen: {
                immediate: true,
                handler: function(open){ document.body.classList.toggle('modal-open', open); }
            }
        },
        methods: {
            t: t,
            selectIcon: function(idx){ this.iconIndex = idx; },
            focusRef: function(name){
                var self = this;
                Vue.nextTick(function(){
                    var el = self.$refs[name];
                    if(el) el.focus();
                });
            },
            // Salir (tras validar el PIN): se olvida el PIN y se vuelve a pedirlo.
            leavePin: function(){
                this.pinValidated = false;
                this.pin = '';
                this.pinModalValue = '';
                this.pinError = '';
                this.randomNames = false;
                this.nameLocked = false;
                this.name = '';
                this.nameError = '';
                this.rerollsUsed = 0;
                this.showModal();
            },
            showModal: function(){
                this.modalOpen = true;
                this.focusRef('pinModalInput');
            },
            onNameInput: function(ev){ this.name = filterInput(ev, normalizeGuestNameLive); this.nameError = ''; },
            onStudentCodeInput: function(ev){ this.studentCode = filterInput(ev, normalizeStudentCode); },
            onStudentPinInput: function(ev){ this.studentPin = filterInput(ev, normalizeStudentPin); },
            configureStudentAuth: function(config){
                this.studentAuthEnabled = !!(config && config.enabled);
                this.studentAuthRequired = !!(config && config.required);
            },
            loadStudentAuthConfig: function(){
                var self = this;
                fetch('/api/player-auth/config', { headers: { 'Accept': 'application/json' } })
                    .then(function(res){ return res.json(); })
                    .then(function(config){ self.configureStudentAuth(config); })
                    .catch(function(){
                        self.configureStudentAuth({ enabled: false, required: false });
                    });
            },
            authenticateStudent: function(){
                var self = this;
                var code = normalizeStudentCode(this.studentCode);
                var pin = normalizeStudentPin(this.studentPin);
                if(!this.studentAuthEnabled && !code && !pin){
                    return Promise.resolve('');
                }
                if(!this.studentAuthRequired && !code && !pin){
                    return Promise.resolve('');
                }
                if(!code || !pin){
                    return Promise.reject(new Error(t('join_student_missing', 'Introdueix el codi i el PIN.')));
                }
                this.studentAuthStatus = t('join_student_checking', 'Validant credencials...');
                return fetch('/api/player-auth/student', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ public_code: code, pin: pin })
                })
                    .then(function(res){
                        return res.json().then(function(body){
                            if(!res.ok || !body || !body.join_token){
                                throw new Error((body && body.error) || t('join_student_error', 'Codi o PIN incorrecte.'));
                            }
                            return body;
                        });
                    })
                    .then(function(body){
                        self.studentJoinToken = body.join_token;
                        self.name = normalizeStudentCode(body.display_name || body.public_code || code);
                        if(body.avatar_icon){
                            var idx = self.icons.indexOf(body.avatar_icon);
                            if(idx !== -1) self.iconIndex = idx;
                        }
                        self.studentPin = '';
                        self.studentAuthStatus = '';
                        return body.join_token;
                    });
            },
            applyValidPin: function(pin, randomNames, lockedName){
                this.pinValidated = true;
                this.pin = pin;
                this.modalOpen = false;
                if(lockedName){
                    this.name = lockedName;
                    this.nameLocked = true;
                    this.randomNames = true;
                    this.nameError = '';
                    return;
                }
                this.randomNames = !!randomNames;
                if(this.randomNames){
                    this.rerollsUsed = readRerolls(pin);
                    this.rerollName(false);
                    return;
                }
                this.focusRef(this.studentAuthRequired ? 'studentCodeInput' : 'nameInput');
            },
            // Asigna otro nombre aleatorio libre. Con animate (botón de dado) el dado gira
            // y el nombre nuevo aparece tras 3 s; sin animate, al momento (al validar el PIN).
            rerollName: function(animate){
                var self = this;
                if(this.rolling) return Promise.resolve();
                var wait = animate ? delay(3000) : Promise.resolve();
                this.rolling = !!animate;
                var pick = loadRandomNameList()
                    .then(function(list){ return pickFreeRandomName(self.pin, list, 15); });
                return Promise.all([pick, wait])
                    .then(function(results){
                        if(results[0]) self.name = results[0];
                        self.nameError = '';
                    })
                    .catch(function(){})
                    .then(function(){ self.rolling = false; });
            },
            rerollsLeft: function(){
                return Math.max(0, RANDOM_NAME_MAX_REROLLS - this.rerollsUsed);
            },
            // Botón del dado: cuenta como cambio voluntario y se limita a 2 por alumno.
            rerollByStudent: function(){
                if(this.rolling || this.rerollsLeft() <= 0) return Promise.resolve();
                this.rerollsUsed += 1;
                saveRerolls(this.pin, this.rerollsUsed);
                return this.rerollName(true);
            },
            validatePin: function(pin){
                var self = this;
                if(!pin || this.validating){
                    this.pinError = t('join_pin_error', 'Ingresa un PIN valido.');
                    return;
                }
                this.validating = true;
                this.pinError = '';
                // Tokens guardados en este navegador para este PIN (sirven para recuperar el nombre tras abandonar).
                var storedTokens = loadTokens();
                var tokenList = Object.keys(storedTokens)
                    .filter(function(k){ return k.indexOf(pin + ':') === 0; })
                    .map(function(k){ return storedTokens[k]; })
                    .join(',');
                var url = '/api/validate-pin/' + encodeURIComponent(pin) + (tokenList ? '?tokens=' + encodeURIComponent(tokenList) : '');
                fetch(url, {
                    headers: { 'Accept': 'application/json' }
                })
                    .then(function(res){ return res.json(); })
                    .then(function(data){
                        if(data && data.valid){
                            self.applyValidPin(pin, !!data.randomNames, data.lockedName || null);
                        }else{
                            self.pinError = t('join_pin_error', 'PIN incorrecto. Intenta de nuevo.');
                            self.focusRef('pinModalInput');
                        }
                    })
                    .catch(function(){
                        self.pinError = t('join_pin_error', 'No pudimos validar el PIN. Intenta nuevamente.');
                    })
                    .finally(function(){
                        self.validating = false;
                    });
            },
            submitPinModal: function(){
                this.validatePin(String(this.pinModalValue === null ? '' : this.pinModalValue).trim());
            },
            submitJoin: function(ev){
                var self = this;
                if(this.submitting) return;
                ev.preventDefault();
                var pinVal = (this.pin || '').trim();
                if(!this.pinValidated || !pinVal){
                    this.showModal();
                    this.pinError = t('join_pin_error', 'Necesitas un PIN válido para entrar.');
                    return;
                }
                var name = normalizeGuestName(this.name);
                var hasStudentCredentials = Boolean(
                    normalizeStudentCode(this.studentCode) &&
                    normalizeStudentPin(this.studentPin)
                );
                if(!name && !this.studentAuthRequired && !hasStudentCredentials){
                    this.nameError = t('join_name_invalid');
                    this.focusRef('nameInput');
                    return;
                }
                // Nombre escrito a mano (no aleatorio ni recuperado): debe cumplir la regla.
                if(!this.randomNames && !this.studentAuthRequired && !hasStudentCredentials && !isValidTypedName(name)){
                    this.nameError = t('join_name_invalid');
                    this.focusRef('nameInput');
                    return;
                }
                this.authenticateStudent()
                    .then(function(){
                        name = normalizeGuestName(self.name || name);
                        self.name = name;
                        if(!name){
                            self.focusRef('nameInput');
                            return;
                        }
                        // Issue #28: el nom no es pot repetir en la partida. Si la
                        // consulta falla, s'entra igual: el servidor també ho comprova.
                        return checkNameAvailable(pinVal, name).then(function(available){
                            if(!available && self.randomNames && !self.nameLocked){
                                // Nombre aleatorio ya usado en esta partida: se asigna otro sin pedir nada al alumnado.
                                return self.rerollName(false);
                            }
                            if(!available){
                                self.nameError = t('join_name_taken');
                                self.focusRef(self.studentAuthRequired ? 'studentCodeInput' : 'nameInput');
                                return;
                            }
                            return self.enterGame(pinVal, name);
                        });
                    })
                    .catch(function(err){
                        self.studentAuthStatus = err && err.message ? err.message : t('join_student_error', 'Codi o PIN incorrecte.');
                        self.focusRef('studentPinInput');
                    });
            },
            enterGame: function(pinVal, name){
                var self = this;
                var tokens = loadTokens();
                var key = pinVal + ':' + name;
                if(!tokens[key]){
                    tokens[key] = genToken();
                    saveTokens(tokens);
                }
                self.token = tokens[key];
                self.submitting = true;
                // Espera que els camps ocults tinguen els valors nous.
                return Vue.nextTick().then(function(){ self.$refs.joinForm.submit(); });
            }
        },
        mounted: function(){
            // Si la URL ya trae un pin, validarlo automáticamente para agilizar
            var query = new URLSearchParams(window.location.search);
            var presetPin = query.get('pin');
            // Tornada des de la sala d'espera: el nom ja estava en ús (issue #28).
            if(query.get('nameTaken')) this.nameError = t('join_name_taken');
            if(query.get('nameInvalid')) this.nameError = t('join_name_invalid');
            if(presetPin){
                this.pinModalValue = presetPin;
                this.validatePin(presetPin.trim());
            }else{
                this.showModal();
            }
            this.loadStudentAuthConfig();
        }
    });
    app.mount('#join-app');

    if('serviceWorker' in navigator){
        window.addEventListener('load', function(){
            navigator.serviceWorker.register('/sw.js').then(function(reg){
                if(reg && typeof reg.update === 'function'){
                    reg.update();
                }
            }).catch(function(err){
                console.warn('SW registration failed', err);
            });
        });
    }
})();
