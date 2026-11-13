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

// Ducking: mentre la lectura en veu alta sona, la música baixa al 25 % del
// volum de l'usuari; en acabar (o en cancel·lar) torna al volum anterior.
// Si l'usuari mou el control de volum durant la lectura, el nou valor passa a
// ser el bo i el ducking s'acaba.
var SOLO_MUSIC_DUCK_FACTOR = 0.25;
var soloMusicDuck = null;

function duckSoloMusic(){
    var audio = soloMusicPlayerInstance && soloMusicPlayerInstance.audio;
    if(!audio || soloMusicDuck) return;
    var base = audio.volume;
    var level = base * SOLO_MUSIC_DUCK_FACTOR;
    var duck = { audio: audio, base: base, level: level, onChange: null };
    duck.onChange = function(){
        if(soloMusicDuck !== duck) return;
        if(Math.abs(audio.volume - duck.level) > 0.001){
            soloMusicDuck = null;
            audio.removeEventListener('volumechange', duck.onChange);
        }
    };
    soloMusicDuck = duck;
    audio.addEventListener('volumechange', duck.onChange);
    audio.volume = level;
}

function unduckSoloMusic(){
    var duck = soloMusicDuck;
    if(!duck) return;
    soloMusicDuck = null;
    duck.audio.removeEventListener('volumechange', duck.onChange);
    duck.audio.volume = duck.base;
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
