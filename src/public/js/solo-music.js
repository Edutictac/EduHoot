// Música de fondo del modo individual, extraído de solo.js
var soloMusicPlayerInstance = null;
var SOLO_MUSIC_STORAGE_KEY = 'eduhoot-solo-music';
var SOLO_MUSIC_STORAGE_KEY_LEGACY = 'eduhook-solo-music';

function updateSoloMusicLabels(){
    if(!soloMusicPlayerInstance || typeof soloMusicPlayerInstance.updateLabels !== 'function') return;
    soloMusicPlayerInstance.updateLabels({
        title: t('bgMusicTitle'),
        choose: t('bgMusicChoose'),
        play: t('bgMusicPlay'),
        pause: t('bgMusicPause'),
        prev: t('bgMusicPrev'),
        next: t('bgMusicNext'),
        volume: t('bgMusicVolume')
    });
}

function initSoloMusicPlayer(){
    if(typeof initBackgroundMusic !== 'function') return;

    // Evita duplicar el widget si ya está inicializado.
    if(soloMusicPlayerInstance && soloMusicPlayerInstance.audio) return;

    // Migración: la clave antigua guardaba la URL de la pista.
    try{
        if(!localStorage.getItem(SOLO_MUSIC_STORAGE_KEY)){
            var legacy = localStorage.getItem(SOLO_MUSIC_STORAGE_KEY_LEGACY);
            if(legacy){
                localStorage.setItem(SOLO_MUSIC_STORAGE_KEY, legacy);
            }
        }
    }catch(e){}

    soloMusicPlayerInstance = initBackgroundMusic('#solo-music-player', {
        storageKey: SOLO_MUSIC_STORAGE_KEY,
        randomStart: true,
        volume: 0.6
    });
    updateSoloMusicLabels();
}

function ensureSoloMusicPlaying(){
    if(!soloMusicPlayerInstance) return;
    if(typeof soloMusicPlayerInstance.play === 'function'){
        soloMusicPlayerInstance.play();
        return;
    }
    if(!soloMusicPlayerInstance.audio) return;
    var audio = soloMusicPlayerInstance.audio;
    if(!audio.paused) return;
    audio.play().catch(function(){});
}

function pauseSoloMusic(){
    if(!soloMusicPlayerInstance) return;
    if(typeof soloMusicPlayerInstance.pause === 'function'){
        soloMusicPlayerInstance.pause();
        return;
    }
    if(!soloMusicPlayerInstance.audio) return;
    try{ soloMusicPlayerInstance.audio.pause(); }catch(e){}
}
