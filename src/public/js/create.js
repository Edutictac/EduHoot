var socket = io();

socket.on('connect', function(){
    socket.emit('requestDbNames');//Get database names to display to user
});

socket.on('gameNamesData', function(data){
    fetchWithFilters();
    fetchTags();
});

// Filtros de la biblioteca; reactivos porque la plantilla de Vue los usa.
var currentFilters = Vue.reactive({
    tags: [],
    mineOnly: false,
    search: '',
    tagMode: 'all'
});
var TAG_SUGGESTIONS_LIMIT = 12;
var LIBRARY_PAGE_SIZE = 12;
var PENDING_ACCOUNT_SAVE_KEY = 'eduhoot-pending-account-save';

readFiltersFromUrl();

function setLang(newLang){
    lang = newLang;
    EduhootLang.persist(lang);
    applyStaticTranslations();
    libState.lang += 1;
    socket.emit('requestDbNames');
}

// --- Auth ---
// L'accés és el xip de compte d'EduTicTac (Commons); el pont de sessió està
// en session-bridge.js i es configura en create-auth.js.
var authState = Vue.reactive({ user: null, checked: false });

var openAccountBtn = document.getElementById('open-account');
if(openAccountBtn) openAccountBtn.addEventListener('click', openAuthModal);

document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && accountState.modalOpen){
        closeAuthModal();
    }
});

// Tareas de administración que solo informan del resultado.
async function runAdminJob(job, url, workingKey, onOk, errorKey){
    job.text = t(workingKey);
    job.busy = true;
    try{
        var res = await fetch(url, { method: 'POST', credentials: 'include' });
        var data = await res.json();
        if(!res.ok) throw new Error(data.error || '');
        job.text = onOk(data);
    }catch(e){
        job.text = t(errorKey) + (e.message ? ' ' + e.message : '');
    }finally{
        job.busy = false;
    }
}

// App de Vue de la zona de cuenta (#account-tpl): aviso de entrada, mensaje
// de sesión y modal de preferencias con las herramientas de administración.
var accountApp = {
    template: '#account-tpl',
    data: function(){
        return { acc: accountState, auth: authState, lib: libState };
    },
    computed: {
        isAdmin: function(){
            return !!(this.auth.user && this.auth.user.role === 'admin');
        },
        statusText: function(){
            var user = this.auth.user;
            if(!user) return this.t('authStatus');
            return user.email + (user.nickname ? ' · ' + user.nickname : '') + ' (' + user.role + ')';
        }
    },
    methods: {
        t: function(key){
            this.lib.lang;
            return t(key);
        },
        openAccountMenu: function(){ openCentralAccountMenu(); },
        close: function(){ closeAuthModal(); },
        saveNickname: function(){ saveNickname(); },
        exportAll: function(){ exportAllQuizzesAsAdmin(); },
        importAll: function(){ importAllQuizzesAsAdmin(this.$refs.adminImportFile); },
        mirrorKahoot: function(){
            runAdminJob(this.acc.jobs.kahoot, '/api/admin/mirror-kahoot-images', 'mirrorKahootWorking',
                function(){ return t('mirrorKahootOk'); }, 'mirrorKahootError');
        },
        mirrorExternal: function(){
            runAdminJob(this.acc.jobs.external, '/api/admin/mirror-external-images', 'mirrorExternalWorking',
                function(){ return t('mirrorExternalOk'); }, 'mirrorExternalError');
        },
        importPublic: function(){
            runAdminJob(this.acc.jobs.importPublic, '/api/admin/import-public-activities', 'importPublicWorking', function(data){
                socket.emit('requestDbNames');
                return t('importPublicOk') + ': ' + data.imported + ' / ' + data.total + ' (' + data.skipped + ' ' + t('importPublicSkipped') + ')';
            }, 'importPublicError');
        }
    }
};
Vue.createApp(accountApp).mount('#account-app');

// Tornada d'Authentik (?authentik=…)
var authentikResult = sessionBridge.handleReturnParam();
if(authentikResult && authentikResult !== 'ok'){
    accountState.authMessage = t('loginError');
}
fetchMe().then(syncCentralSession);
fetchTags();

fetch('/api/auth/authentik/config', { credentials: 'include' })
    .then(function(res){ return res.ok ? res.json() : { enabled: false }; })
    .then(function(cfg){
        accountState.authentikEnabled = !!cfg.enabled;
        updateAuthUI();
        syncCentralSession();
    })
    .catch(function(){});

fetch('/api/admin/import-public-activities/config', { credentials: 'include' })
    .then(function(res){ return res.ok ? res.json() : { enabled: false }; })
    .then(function(cfg){
        accountState.importPublicEnabled = !!cfg.enabled;
    })
    .catch(function(){});


var langSelector = document.getElementById('lang-select');
if(langSelector){
    langSelector.value = lang;
    langSelector.addEventListener('change', function(){
        setLang(langSelector.value);
    });
}
applyStaticTranslations();

function reconnectSocket(){
    try{
        socket.disconnect();
        socket.connect();
    }catch(e){}
}

Vue.createApp(libraryApp).mount('#library-app');

// --- Generador IA e importaciones (Subfase B, bloque 2) ---
// Estado de las importaciones (CSV y Kahoot); el del generador IA es iaState.
var importState = Vue.reactive({
    csvName: '',
    csvStatus: { text: '', playId: null },
    kahootUrl: '',
    kahootVisibility: 'public',
    kahootBusy: false,
    kahootStatus: { text: '', playId: null, editId: null }
});

try{
    iaState.useDocs = localStorage.getItem('eduh_ia_use_docs') === '1';
    iaState.genSvg = localStorage.getItem('eduh_ia_gen_svg') === '1';
}catch(e){}
applyIaDocsMode();

// Limpia el CSV del cuadro (imágenes externas) y lo deja limpio en el cuadro.
function cleanIaCsv(){
    var cleaned = sanitizeIaCsv(iaState.csv);
    if(cleaned) iaState.csv = cleaned;
    return cleaned;
}

var toolsApp = {
    template: '#tools-tpl',
    data: function(){
        return { ia: iaState, imp: importState, auth: authState, lib: libState };
    },
    methods: {
        t: function(key){
            this.lib.lang;
            return t(key);
        },
        startGame: function(id){ startGame(id); },
        editQuiz: function(id){ window.location.href = '/create/quiz-creator/?id=' + id; },
        // Generador IA
        onIdioma: function(){
            if(this.ia.idioma !== 'otro') this.ia.idiomaCustom = '';
        },
        onUseDocs: function(){
            try{ localStorage.setItem('eduh_ia_use_docs', this.ia.useDocs ? '1' : '0'); }catch(e){}
            applyIaDocsMode();
        },
        onGenSvg: function(){
            try{ localStorage.setItem('eduh_ia_gen_svg', this.ia.genSvg ? '1' : '0'); }catch(e){}
        },
        generatePrompt: function(){
            var ia = this.ia;
            this.ia.prompt = buildPrompt({
                nombre: ia.name.trim(),
                nivel: ia.nivel.trim(),
                tema: ia.tema.trim(),
                idioma: ia.idioma,
                idiomaCustom: ia.idiomaCustom.trim(),
                num: parseInt(ia.num, 10) || 10,
                extra: ia.extra.trim(),
                tipos: getSelectedIaTypes(),
                useDocs: ia.useDocs,
                genSvg: ia.genSvg
            });
        },
        copyPrompt: function(){
            if(!this.ia.prompt.trim()) return;
            navigator.clipboard.writeText(this.ia.prompt).catch(function(){});
        },
        preview: function(){
            var raw = this.ia.csv;
            var cleaned = cleanIaCsv();
            renderIaPreview(cleaned || raw);
        },
        openCsv: function(){
            this.$refs.iaCsvFile.click();
        },
        onCsvFile: function(e){
            var file = e.target.files && e.target.files[0];
            if(!file) return;
            var reader = new FileReader();
            reader.onload = function(ev){
                iaState.csv = String(ev.target.result || '');
                iaState.preview.visible = false;
            };
            reader.readAsText(file, 'UTF-8');
            e.target.value = '';
        },
        downloadCsv: function(){
            var raw = this.ia.csv;
            var cleaned = cleanIaCsv();
            var normalized = normalizeCsvForDownload(cleaned || raw);
            if(!normalized){
                alert(t('alertNothingToSave'));
                return;
            }
            var blob = new Blob(['﻿' + normalized], { type: 'text/csv;charset=utf-8;' });
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'quiz.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        },
        editIaQuiz: function(){
            if(!this.ia.lastUploadedId) return;
            window.location.href = 'quiz-creator/?id=' + encodeURIComponent(this.ia.lastUploadedId);
        },
        uploadIa: async function(){
            var ia = this.ia;
            var csvText = ia.csv.trim();
            var cleaned = cleanIaCsv();
            if(cleaned) csvText = cleaned.trim();
            var quizName = ia.name.trim();
            if(!csvText){
                ia.status = { text: t('selectCsv'), playId: null };
                return;
            }
            ia.status = { text: t('importing'), playId: null };
            ia.lastUploadedId = null;
            try{
                var file = new File([new Blob([csvText], { type: 'text/csv' })], 'ia.csv', { type: 'text/csv' });
                var formData = new FormData();
                formData.append('file', file);
                if(quizName) formData.append('name', quizName);
                formData.append('ownerToken', getAnonOwnerToken());
                buildIaTags().forEach(function(tag){ formData.append('tags', tag); });
                var response = await fetch('/api/upload-csv', { method: 'POST', body: formData });
                var result = await response.json();
                if(!response.ok){
                    ia.status = { text: result.error || t('uploadCsvError'), playId: null };
                    return;
                }
                ia.status = { text: t('importSuccess') + ': ' + result.name + ' (' + result.count + ')', playId: result.id || null };
                if(result.id){
                    ia.lastUploadedId = result.id;
                    rememberClaimableQuizId(result.id);
                }
                currentFilters.tags = [];
                socket.emit('requestDbNames');
                fetchWithFilters();
            }catch(err){
                ia.status = { text: t('uploadCsvError'), playId: null };
            }
        },
        // Importar CSV
        uploadCsv: async function(){
            var imp = this.imp;
            var fileInput = this.$refs.csvFile;
            if(!fileInput.files || fileInput.files.length === 0){
                imp.csvStatus = { text: t('selectCsv'), playId: null };
                return;
            }
            var formData = new FormData();
            formData.append('file', fileInput.files[0]);
            if(imp.csvName && imp.csvName.trim()){
                formData.append('name', imp.csvName.trim());
            }
            formData.append('ownerToken', getAnonOwnerToken());
            imp.csvStatus = { text: t('uploadCsv'), playId: null };
            try{
                var response = await fetch('/api/upload-csv', { method: 'POST', body: formData });
                var result = await response.json();
                if(!response.ok){
                    imp.csvStatus = { text: result.error || t('uploadCsvError'), playId: null };
                    return;
                }
                imp.csvStatus = { text: t('importSuccess') + ': ' + result.name + ' (' + result.count + ') ', playId: result.id };
                this.$refs.csvForm.reset();
                imp.csvName = '';
                rememberClaimableQuizId(result.id);
                socket.emit('requestDbNames');
                fetchWithFilters();
            }catch(err){
                imp.csvStatus = { text: t('uploadCsvError'), playId: null };
            }
        },
        // Importar Kahoot público
        importKahoot: async function(){
            var imp = this.imp;
            var raw = (imp.kahootUrl || '').trim();
            if(!raw) return;
            var token = getAnonOwnerToken();
            var payload = { visibility: imp.kahootVisibility || 'public', ownerToken: token };
            if(/^https?:\/\//i.test(raw)) payload.url = raw;
            else payload.id = raw;
            imp.kahootBusy = true;
            imp.kahootStatus = { text: t('importing'), playId: null, editId: null };
            try{
                var headers = { 'Content-Type': 'application/json' };
                if(token) headers['X-Owner-Token'] = token;
                var res = await fetch('/api/import/kahoot', { method: 'POST', headers: headers, body: JSON.stringify(payload) });
                var body = {};
                try{ body = await res.json(); }catch(e){}
                if(!res.ok){
                    imp.kahootStatus = { text: body.error || t('importError'), playId: null, editId: null };
                    return;
                }
                imp.kahootStatus = { text: t('importSuccess') + ': ' + (body.name || '') + ' (' + body.count + ') ', playId: body.id, editId: body.id || null };
                if(body.id) rememberClaimableQuizId(body.id);
                socket.emit('requestDbNames');
            }catch(err){
                imp.kahootStatus = { text: t('importError'), playId: null, editId: null };
            }finally{
                imp.kahootBusy = false;
            }
        }
    }
};

Vue.createApp(toolsApp).mount('#tools-app');
