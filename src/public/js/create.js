var socket = io();

socket.on('connect', function(){
    socket.emit('requestDbNames');//Get database names to display to user
});

socket.on('gameNamesData', function(data){
    fetchWithFilters();
    fetchTags();
});

var currentFilters = {
    tags: [],
    mineOnly: false,
    search: '',
    tagMode: 'all'
};
var currentSort = 'newest';
var knownTags = [];
var currentDisplayedQuizzes = [];
var TAG_SUGGESTIONS_LIMIT = 12;
var tagSuggestionsExpanded = false;

var LIBRARY_PAGE_SIZE = 12;
var libraryCurrentPage = 1;
var libraryTotalPages = 1;
var libraryLatestData = [];
var PENDING_ACCOUNT_SAVE_KEY = 'eduhoot-pending-account-save';

readFiltersFromUrl();

function setLang(newLang){
    lang = newLang;
    EduhootLang.persist(lang);
    applyStaticTranslations();
    renderTagSuggestions();
    socket.emit('requestDbNames');
}

var mineFilter = document.getElementById('filter-mine');
if(mineFilter){
    mineFilter.addEventListener('change', function(){
        currentFilters.mineOnly = mineFilter.checked;
        fetchWithFilters();
    });
}
var clearFiltersBtn = document.getElementById('clear-filters');
if(clearFiltersBtn){
    clearFiltersBtn.addEventListener('click', clearFilters);
}
var tagModeToggleBtn = document.getElementById('tag-mode-toggle');
if(tagModeToggleBtn){
    tagModeToggleBtn.addEventListener('click', toggleTagMode);
    renderTagModeToggle();
}

var librarySearch = document.getElementById('library-search');
if(librarySearch){
    librarySearch.addEventListener('input', function(){
        currentFilters.search = librarySearch.value || '';
        fetchWithFilters();
    });
}

var librarySortSelect = document.getElementById('library-sort');
if(librarySortSelect){
    librarySortSelect.value = currentSort;
    librarySortSelect.addEventListener('change', function(){
        currentSort = librarySortSelect.value;
        libraryCurrentPage = 1;
        renderGames(libraryLatestData);
    });
}

var paginationPrevBtn = document.getElementById('library-pagination-prev');
if(paginationPrevBtn){
    paginationPrevBtn.addEventListener('click', function(){
        if(libraryCurrentPage <= 1) return;
        libraryCurrentPage -= 1;
        renderGames(libraryLatestData);
    });
}
var paginationNextBtn = document.getElementById('library-pagination-next');
if(paginationNextBtn){
    paginationNextBtn.addEventListener('click', function(){
        if(libraryCurrentPage >= libraryTotalPages) return;
        libraryCurrentPage += 1;
        renderGames(libraryLatestData);
    });
}

var csvForm = document.getElementById('csv-form');
if (csvForm) {
    csvForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        var fileInput = document.getElementById('csv-file');
        var nameInput = document.getElementById('csv-name');
        var status = document.getElementById('csv-status');

        if (!fileInput.files || fileInput.files.length === 0) {
            status.textContent = t('selectCsv');
            return;
        }

        var formData = new FormData();
        formData.append('file', fileInput.files[0]);
        if (nameInput.value && nameInput.value.trim()) {
            formData.append('name', nameInput.value.trim());
        }
        formData.append('ownerToken', getAnonOwnerToken());

        status.textContent = t('uploadCsv');
        try {
            var response = await fetch('/api/upload-csv', {
                method: 'POST',
                body: formData
            });
            var result = await response.json();
            if (!response.ok) {
                status.textContent = result.error || t('uploadCsvError');
                return;
            }
            status.textContent = t('importSuccess') + ': ' + result.name + ' (' + result.count + ') ';
            var startBtn = document.createElement('button');
            startBtn.textContent = t('startNow') || t('play');
            startBtn.onclick = function() { startGame(result.id); };
            status.appendChild(startBtn);
            csvForm.reset();
            rememberClaimableQuizId(result.id);
            socket.emit('requestDbNames');
            fetchWithFilters();
        } catch (err) {
            status.textContent = t('uploadCsvError');
        }
    });
}

var iaGenerate = document.getElementById('ia-generate');
var iaCopy = document.getElementById('ia-copy');
var iaPrompt = document.getElementById('ia-prompt');
var iaIdioma = document.getElementById('ia-idioma');
var iaIdiomaCustom = document.getElementById('ia-idioma-custom');
var iaUseDocs = document.getElementById('ia-use-docs');
var iaGenSvg = document.getElementById('ia-gen-svg');
var iaGenSvgWrap = document.getElementById('ia-gen-svg-wrap');
var iaDocsHint = document.getElementById('ia-docs-hint');
var iaTema = document.getElementById('ia-tema');

// --- Auth ---
// L'accés és el xip de compte d'EduTicTac (Commons). EduHoot manté la seua sessió
// Authentik: quan el xip ja té sessió de professorat, s'entra a EduHoot sense
// demanar res més (SSO), i quan el xip la tanca, EduHoot també.
var authModal = document.getElementById('auth-modal');
var openAccountBtn = document.getElementById('open-account');
var openAccountMenuBtn = document.getElementById('open-account-menu');
var newUserSignin = document.getElementById('new-user-signin');
var accountChip = document.querySelector('edutictac-account');
var AUTH_BRIDGE_KEY = 'eduh_auth_bridge';
var AUTH_BRIDGE_RETRY_MS = 2 * 60 * 1000;
var authBridgeFailed = false;

if(openAccountBtn) openAccountBtn.addEventListener('click', openAuthModal);

if(authModal){
    authModal.querySelectorAll('[data-modal-close]').forEach(function(el){
        el.addEventListener('click', function(){
            closeAuthModal();
        });
    });
}

document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && authModal && !authModal.classList.contains('hidden')){
        closeAuthModal();
    }
});

var authNick = document.getElementById('auth-nick');
var authStatus = document.getElementById('auth-status');
var authMsg = document.getElementById('auth-message');
var accountMsg = document.getElementById('account-message');
var authSaveNickBtn = document.getElementById('auth-save-nick');
var adminPanel = document.getElementById('user-admin');
var adminExportAllBtn = document.getElementById('admin-export-quizzes');
var adminImportFile = document.getElementById('admin-import-quizzes-file');
var adminImportReplace = document.getElementById('admin-import-quizzes-replace');
var adminImportBtn = document.getElementById('admin-import-quizzes');
var adminImportStatus = document.getElementById('admin-import-quizzes-status');
var adminMirrorKahootBtn = document.getElementById('admin-mirror-kahoot-images');
var adminMirrorKahootStatus = document.getElementById('admin-mirror-kahoot-status');
var adminMirrorExternalBtn = document.getElementById('admin-mirror-external-images');
var adminMirrorExternalStatus = document.getElementById('admin-mirror-external-status');
var adminImportPublicWrap = document.getElementById('admin-import-public-wrap');
var adminImportPublicBtn = document.getElementById('admin-import-public-btn');
var adminImportPublicStatus = document.getElementById('admin-import-public-status');
var authState = { user: null, checked: false };
var authentikAuthEnabled = false;

window.addEventListener('edutictac:sessionchange', function(e){
    if(accountChip && sameSiteAsPage(accountChip.getAttribute('data-base') || '')) applyCentralSession(e.detail);
});

if(openAccountMenuBtn){
    openAccountMenuBtn.addEventListener('click', openCentralAccountMenu);
}
if(authSaveNickBtn){
    authSaveNickBtn.addEventListener('click', saveNickname);
}
if(adminExportAllBtn){
    adminExportAllBtn.addEventListener('click', exportAllQuizzesAsAdmin);
}
if(adminImportBtn){
    adminImportBtn.addEventListener('click', importAllQuizzesAsAdmin);
}
if(adminMirrorKahootBtn){
    adminMirrorKahootBtn.addEventListener('click', async function(){
        if(adminMirrorKahootStatus) adminMirrorKahootStatus.textContent = t('mirrorKahootWorking');
        adminMirrorKahootBtn.disabled = true;
        try{
            var res = await fetch('/api/admin/mirror-kahoot-images', { method: 'POST', credentials: 'include' });
            var data = await res.json();
            if(!res.ok) throw new Error(data.error || '');
            if(adminMirrorKahootStatus) adminMirrorKahootStatus.textContent = t('mirrorKahootOk');
        }catch(e){
            if(adminMirrorKahootStatus) adminMirrorKahootStatus.textContent = t('mirrorKahootError') + (e.message ? ' ' + e.message : '');
        }finally{
            adminMirrorKahootBtn.disabled = false;
        }
    });
}
if(adminMirrorExternalBtn){
    adminMirrorExternalBtn.addEventListener('click', async function(){
        if(adminMirrorExternalStatus) adminMirrorExternalStatus.textContent = t('mirrorExternalWorking');
        adminMirrorExternalBtn.disabled = true;
        try{
            var res = await fetch('/api/admin/mirror-external-images', { method: 'POST', credentials: 'include' });
            var data = await res.json();
            if(!res.ok) throw new Error(data.error || '');
            if(adminMirrorExternalStatus) adminMirrorExternalStatus.textContent = t('mirrorExternalOk');
        }catch(e){
            if(adminMirrorExternalStatus) adminMirrorExternalStatus.textContent = t('mirrorExternalError') + (e.message ? ' ' + e.message : '');
        }finally{
            adminMirrorExternalBtn.disabled = false;
        }
    });
}
if(adminImportPublicBtn){
    adminImportPublicBtn.addEventListener('click', async function(){
        if(adminImportPublicStatus) adminImportPublicStatus.textContent = t('importPublicWorking');
        adminImportPublicBtn.disabled = true;
        try{
            var res = await fetch('/api/admin/import-public-activities', { method: 'POST', credentials: 'include' });
            var data = await res.json();
            if(!res.ok) throw new Error(data.error || '');
            if(adminImportPublicStatus) adminImportPublicStatus.textContent =
                t('importPublicOk') + ': ' + data.imported + ' / ' + data.total + ' (' + data.skipped + ' ' + t('importPublicSkipped') + ')';
            socket.emit('requestDbNames');
        }catch(e){
            if(adminImportPublicStatus) adminImportPublicStatus.textContent = t('importPublicError') + (e.message ? ' ' + e.message : '');
        }finally{
            adminImportPublicBtn.disabled = false;
        }
    });
}
// Start auth check on load
try{
    var authParams = new URLSearchParams(window.location.search);
    var authentikResult = authParams.get('authentik');
    if(authentikResult){
        if(authentikResult !== 'ok'){
            authBridgeFailed = true;
            if(authMsg) authMsg.textContent = t('loginError');
        }
        authParams.delete('authentik');
        var cleanUrl = window.location.pathname + (authParams.toString() ? '?' + authParams.toString() : '') + window.location.hash;
        window.history.replaceState({}, '', cleanUrl);
    }
}catch(e){}
fetchMe().then(syncCentralSession);
fetchTags();

fetch('/api/auth/authentik/config', { credentials: 'include' })
    .then(function(res){ return res.ok ? res.json() : { enabled: false }; })
    .then(function(cfg){
        authentikAuthEnabled = !!cfg.enabled;
        updateAuthUI();
        syncCentralSession();
    })
    .catch(function(){});

fetch('/api/admin/import-public-activities/config', { credentials: 'include' })
    .then(function(res){ return res.ok ? res.json() : { enabled: false }; })
    .then(function(cfg){
        if(adminImportPublicWrap) adminImportPublicWrap.classList.toggle('hidden', !cfg.enabled);
    })
    .catch(function(){});

if (iaIdioma) {
    iaIdioma.addEventListener('change', function(){
        if (iaIdioma.value === 'otro') {
            iaIdiomaCustom.classList.remove('hidden');
        } else {
            iaIdiomaCustom.classList.add('hidden');
            iaIdiomaCustom.value = '';
        }
    });
}

if(iaUseDocs){
    try{
        iaUseDocs.checked = localStorage.getItem('eduh_ia_use_docs') === '1';
    }catch(e){}
    applyIaDocsMode();
    iaUseDocs.addEventListener('change', function(){
        try{ localStorage.setItem('eduh_ia_use_docs', iaUseDocs.checked ? '1' : '0'); }catch(e){}
        applyIaDocsMode();
    });
}

if(iaGenSvg){
    try{
        iaGenSvg.checked = localStorage.getItem('eduh_ia_gen_svg') === '1';
    }catch(e){}
    iaGenSvg.addEventListener('change', function(){
        try{ localStorage.setItem('eduh_ia_gen_svg', iaGenSvg.checked ? '1' : '0'); }catch(e){}
    });
}

if (iaGenerate) {
    iaGenerate.addEventListener('click', function(){
        var params = {
            nombre: document.getElementById('ia-name').value.trim(),
            nivel: document.getElementById('ia-nivel').value.trim(),
            tema: document.getElementById('ia-tema').value.trim(),
            idioma: iaIdioma ? iaIdioma.value : 'Español',
            idiomaCustom: iaIdiomaCustom ? iaIdiomaCustom.value.trim() : '',
            num: parseInt(document.getElementById('ia-num').value, 10) || 10,
            extra: document.getElementById('ia-extra').value.trim(),
            tipos: getSelectedIaTypes(),
            useDocs: iaUseDocs ? iaUseDocs.checked : false,
            genSvg: iaGenSvg ? iaGenSvg.checked : false
        };
        iaPrompt.textContent = buildPrompt(params);
    });
}

if (iaCopy) {
    iaCopy.addEventListener('click', function(){
        if (!iaPrompt || !iaPrompt.textContent.trim()) return;
        navigator.clipboard.writeText(iaPrompt.textContent).catch(function(){});
    });
}

var iaUpload = document.getElementById('ia-upload');
var iaPreviewBtn = document.getElementById('ia-preview');
var iaOpenBtn = document.getElementById('ia-open');
var iaDownloadBtn = document.getElementById('ia-download');
var iaEditBtn = document.getElementById('ia-edit');
var iaCsvFile = document.getElementById('ia-csv-file');
var iaPreviewBox = document.getElementById('ia-preview-box');
var iaPreviewContent = document.getElementById('ia-preview-content');

var lastIaUploadedQuizId = null;

if(iaPreviewBtn){
    iaPreviewBtn.addEventListener('click', function(){
        var csvText = document.getElementById('ia-csv') ? document.getElementById('ia-csv').value : '';
        var clean = sanitizeIaCsv(csvText);
        var ta = document.getElementById('ia-csv');
        if(ta && clean) ta.value = clean;
        renderIaPreview(clean || csvText);
    });
}

if(iaOpenBtn && iaCsvFile){
    iaOpenBtn.addEventListener('click', function(){ iaCsvFile.click(); });
    iaCsvFile.addEventListener('change', function(e){
        var file = e.target.files && e.target.files[0];
        if(!file) return;
        var reader = new FileReader();
        reader.onload = function(ev){
            var ta = document.getElementById('ia-csv');
            if(ta) ta.value = String(ev.target.result || '');
            if(iaPreviewBox) iaPreviewBox.classList.add('hidden');
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = '';
    });
}

if(iaDownloadBtn){
    iaDownloadBtn.addEventListener('click', function(){
        var csvText = document.getElementById('ia-csv') ? document.getElementById('ia-csv').value : '';
        var cleaned = sanitizeIaCsv(csvText);
        var ta = document.getElementById('ia-csv');
        if(ta && cleaned) ta.value = cleaned;
        var normalized = normalizeCsvForDownload(cleaned || csvText);
        if(!normalized){
            alert(t('alertNothingToSave'));
            return;
        }
        var blob = new Blob(['\uFEFF' + normalized], { type: 'text/csv;charset=utf-8;' });
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'quiz.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    });
}

if(iaEditBtn){
    iaEditBtn.addEventListener('click', function(){
        if(!lastIaUploadedQuizId) return;
        window.location.href = 'quiz-creator/?id=' + encodeURIComponent(lastIaUploadedQuizId);
    });
}

if (iaUpload) {
    iaUpload.addEventListener('click', async function(){
        var status = document.getElementById('ia-status');
        var csvText = document.getElementById('ia-csv').value.trim();
        var cleaned = sanitizeIaCsv(csvText);
        if(cleaned){
            csvText = cleaned.trim();
            try{ document.getElementById('ia-csv').value = cleaned; }catch(e){}
        }
        var quizName = document.getElementById('ia-name').value.trim();
        if (!csvText) {
            status.textContent = t('selectCsv');
            return;
        }
        status.textContent = t('importing');
        if(iaEditBtn) iaEditBtn.disabled = true;
        lastIaUploadedQuizId = null;
        try{
            var blob = new Blob([csvText], { type: 'text/csv' });
            var file = new File([blob], 'ia.csv', { type: 'text/csv' });
            var formData = new FormData();
            formData.append('file', file);
            if (quizName) formData.append('name', quizName);
            formData.append('ownerToken', getAnonOwnerToken());
            var iaTags = buildIaTags();
            iaTags.forEach(function(tag){
                formData.append('tags', tag);
            });

            var response = await fetch('/api/upload-csv', { method: 'POST', body: formData });
            var result = await response.json();
            if (!response.ok) {
                status.textContent = result.error || t('uploadCsvError');
                return;
            }
            status.textContent = t('importSuccess') + ': ' + result.name + ' (' + result.count + ')';
            if (result.id) {
                lastIaUploadedQuizId = result.id;
                if(iaEditBtn) iaEditBtn.disabled = false;
                var startBtn = document.createElement('button');
                startBtn.className = 'btn btn-primary';
                startBtn.textContent = t('play');
                startBtn.style.marginLeft = '8px';
                startBtn.onclick = function(){ startGame(result.id); };
                status.appendChild(startBtn);
                rememberClaimableQuizId(result.id);
            }
            currentFilters.tags = [];
            socket.emit('requestDbNames');
            fetchWithFilters();
        }catch(err){
            status.textContent = t('uploadCsvError');
        }
    });
}

// Start auth check on load
fetchMe();

var langSelector = document.getElementById('lang-select');
if(langSelector){
    langSelector.value = lang;
    langSelector.addEventListener('change', function(){
        setLang(langSelector.value);
    });
}
applyStaticTranslations();
renderTagModeToggle();

function reconnectSocket(){
    try{
        socket.disconnect();
        socket.connect();
    }catch(e){}
}

// Importar Kahoot públic
var kahootForm = document.getElementById('kahoot-form');
var kahootUrlInput = document.getElementById('kahoot-url');
var kahootStatus = document.getElementById('kahoot-status');
var kahootVisSelect = document.getElementById('kahoot-visibility');
if(kahootForm){
    kahootForm.addEventListener('submit', async function(e){
        e.preventDefault();
        if(!kahootUrlInput || !kahootUrlInput.value.trim()){
            return;
        }
        var raw = kahootUrlInput.value.trim();
        var payload = {
            visibility: kahootVisSelect ? kahootVisSelect.value : 'public',
            ownerToken: getAnonOwnerToken()
        };
        if(/^https?:\/\//i.test(raw)) payload.url = raw;
        else payload.id = raw;

        var submitBtn = kahootForm.querySelector('button[type="submit"]');
        if(submitBtn) submitBtn.disabled = true;
        if(kahootStatus) kahootStatus.textContent = t('importing');
    try{
        var res = await fetch('/api/import/kahoot', {
            method: 'POST',
            headers: (function(){
                var base = { 'Content-Type': 'application/json' };
                var token = getAnonOwnerToken();
                if(token) base['X-Owner-Token'] = token;
                return base;
            })(),
            body: JSON.stringify(payload)
        });
        var body = {};
        try { body = await res.json(); } catch(e){}
        if(!res.ok){
                if(kahootStatus) kahootStatus.textContent = body.error || t('importError');
                if(submitBtn) submitBtn.disabled = false;
                return;
            }
            if(kahootStatus){
                kahootStatus.innerHTML = t('importSuccess') + ': ' + (body.name || '') + ' (' + body.count + ') ';
                var btn = document.createElement('button');
                btn.textContent = t('play');
                btn.onclick = function(){ startGame(body.id); };
                btn.className = 'btn btn-primary btn-small';
                kahootStatus.appendChild(btn);
                if(body.id){
                    var editBtn = document.createElement('button');
                    editBtn.textContent = t('editQuiz');
                    editBtn.className = 'btn btn-ghost btn-small';
                    editBtn.onclick = function(){ window.location.href = '/create/quiz-creator/?id=' + body.id; };
                    kahootStatus.appendChild(editBtn);
                }
            }
            if(submitBtn) submitBtn.disabled = false;
            if(body.id) rememberClaimableQuizId(body.id);
            socket.emit('requestDbNames');
        }catch(err){
            if(kahootStatus) kahootStatus.textContent = t('importError');
            if(submitBtn) submitBtn.disabled = false;
        }
    });
}
