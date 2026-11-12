// Herramientas de administración de /create/ (exportar/importar todos los quizzes), extraído de create.js
function exportAllQuizzesAsAdmin(){
    if(!authState.user || authState.user.role !== 'admin'){
        warnNoPermission();
        return;
    }
    // Descargar como archivo (cookies incluidas al navegar)
    window.location.href = '/api/admin/quizzes/export';
}

async function importAllQuizzesAsAdmin(fileInput){
    if(!authState.user || authState.user.role !== 'admin'){
        warnNoPermission();
        return;
    }
    if(!fileInput || !fileInput.files || !fileInput.files[0]){
        accountState.adminImportStatus = t('adminImportPickFile');
        return;
    }
    var replaceAll = !!accountState.adminReplace;
    if(replaceAll){
        var ok = false;
        try{ ok = window.confirm(t('adminReplaceConfirm')); }catch(e){ ok = false; }
        if(!ok) return;
    }
    accountState.adminImportStatus = t('adminImportWorking');
    try{
        var fd = new FormData();
        fd.append('file', fileInput.files[0]);
        if(replaceAll) fd.append('confirm', 'REPLACE_ALL');
        var url = '/api/admin/quizzes/import' + (replaceAll ? '?mode=replace' : '?mode=upsert');
        var res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            body: fd
        });
        var body = {};
        try{ body = await res.json(); }catch(e){}
        if(!res.ok){
            accountState.adminImportStatus = (body && body.error) ? body.error : t('adminImportError');
            return;
        }
        var detail = (body && body.mode === 'replace')
            ? ' (' + (body.imported || 0) + ')'
            : ' (' + (body.processed || 0) + ')';
        accountState.adminImportStatus = t('adminImportOk') + detail;
        fileInput.value = '';
        accountState.adminReplace = false;
        fetchWithFilters();
        fetchTags();
    }catch(err){
        accountState.adminImportStatus = t('adminImportError');
    }
}
