// Herramientas de administración de /create/ (exportar/importar todos los quizzes), extraído de create.js
function exportAllQuizzesAsAdmin(){
    if(!authState.user || authState.user.role !== 'admin'){
        warnNoPermission();
        return;
    }
    // Descargar como archivo (cookies incluidas al navegar)
    window.location.href = '/api/admin/quizzes/export';
}

async function importAllQuizzesAsAdmin(){
    if(!authState.user || authState.user.role !== 'admin'){
        warnNoPermission();
        return;
    }
    if(!adminImportFile || !adminImportFile.files || !adminImportFile.files[0]){
        if(adminImportStatus) adminImportStatus.textContent = t('adminImportPickFile');
        return;
    }
    var replaceAll = !!(adminImportReplace && adminImportReplace.checked);
    if(replaceAll){
        var ok = false;
        try{ ok = window.confirm(t('adminReplaceConfirm')); }catch(e){ ok = false; }
        if(!ok) return;
    }
    if(adminImportStatus) adminImportStatus.textContent = t('adminImportWorking');
    try{
        var fd = new FormData();
        fd.append('file', adminImportFile.files[0]);
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
            if(adminImportStatus) adminImportStatus.textContent = (body && body.error) ? body.error : t('adminImportError');
            return;
        }
        if(adminImportStatus){
            var detail = '';
            if(body && body.mode === 'replace'){
                detail = ' (' + (body.imported || 0) + ')';
            }else{
                detail = ' (' + (body.processed || 0) + ')';
            }
            adminImportStatus.textContent = t('adminImportOk') + detail;
        }
        adminImportFile.value = '';
        if(adminImportReplace) adminImportReplace.checked = false;
        fetchWithFilters();
        fetchTags();
    }catch(err){
        if(adminImportStatus) adminImportStatus.textContent = t('adminImportError');
    }
}
