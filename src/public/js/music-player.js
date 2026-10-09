(function(){
    var defaultTracks = [
        {
            id: '8bit-game',
            label: '8-bit game',
            url: '/music/8-bit-game-158815.mp3'
        },
        {
            id: 'best-game-console',
            label: 'Best game console',
            url: '/music/best-game-console-301284.mp3'
        },
        {
            id: 'roblox-fortnite',
            label: 'Roblox & Fortnite energy',
            url: '/music/roblox-minecraft-fortnite-video-game-music-358426.mp3'
        },
        {
            id: 'game-is-on',
            label: 'Game is on',
            url: '/music/game-is-on-video-game-music-no-copyright-426131.mp3'
        },
        {
            id: 'minecraft-anthem',
            label: 'Minecraft gaming loop',
            url: '/music/game-gaming-minecraft-background-music-377647.mp3'
        },
        {
            id: 'minecraft-loop-2',
            label: 'Minecraft background (alt)',
            url: '/music/game-gaming-minecraft-background-music-370830.mp3'
        },
        {
            id: 'retro-arcade-1',
            label: 'Retro arcade synth',
            url: '/music/retro-arcade-game-music-297305.mp3'
        },
        {
            id: 'gaming-chill',
            label: 'Gaming chill lounge',
            url: '/music/gaming-game-minecraft-background-music-372242.mp3'
        },
        {
            id: 'retro-arcade-2',
            label: 'Retro arcade anthem',
            url: '/music/retro-arcade-game-music-408074.mp3'
        },
        {
            id: '8bit-console-love',
            label: 'I love my 8-bit console',
            url: '/music/i-love-my-8-bit-game-console-301272.mp3'
        },
        {
            id: '8bit-happy',
            label: 'So happy with my 8-bit game',
            url: '/music/so-happy-with-my-8-bit-game-301275.mp3'
        }
    ];

    function safeGetStorage(key){
        if(!key || !window.localStorage) return null;
        try{
            return localStorage.getItem(key);
        }catch(e){
            return null;
        }
    }

    function safeSetStorage(key, value){
        if(!key || !window.localStorage) return;
        try{
            localStorage.setItem(key, value);
        }catch(e){}
    }

    function trackExists(url){
        return defaultTracks.some(function(track){ return track.url === url; });
    }

    function createTrackOptions(select, savedValue){
        defaultTracks.forEach(function(track, index){
            var option = document.createElement('option');
            option.value = track.url;
            option.textContent = track.label;
            if(savedValue && track.url === savedValue){
                option.selected = true;
            }else if(!savedValue && index === 0){
                option.selected = true;
            }
            select.appendChild(option);
        });
    }

    function initBackgroundMusic(containerSelector, options){
        var container = document.querySelector(containerSelector);
        if(!container) return null;
        var opts = options || {};
        var labels = opts.labels || {};
        var storageKey = opts.storageKey;
        var volumeStorageKey = opts.volumeStorageKey || (storageKey ? (storageKey + ':volume') : null);
        // sharedAudio: <audio> ya creado (y desbloqueado por un gesto) en otra vista,
        // p. ej. la sala del anfitrión cuando la partida se carga en un iframe.
        var sharedAudio = opts.sharedAudio || null;
        var sharedTrack = null;
        if(sharedAudio){
            try{ sharedTrack = new URL(sharedAudio.currentSrc || sharedAudio.src, window.location.href).pathname; }catch(e){}
        }
        var savedTrack = storageKey ? safeGetStorage(storageKey) : null;
        if(savedTrack && !trackExists(savedTrack)){
            savedTrack = null;
        }

        var savedVolume = volumeStorageKey ? safeGetStorage(volumeStorageKey) : null;
        var initialVolume = typeof opts.volume === 'number' ? opts.volume : 0.6;
        if(savedVolume != null){
            var parsed = parseFloat(savedVolume);
            if(!isNaN(parsed)){
                if(parsed < 0) parsed = 0;
                if(parsed > 1) parsed = 1;
                initialVolume = parsed;
            }
        }

        var selectedTrack = (sharedTrack && trackExists(sharedTrack)) ? sharedTrack : savedTrack;
        // Solo rotamos aleatoriamente si:
        // - randomStart está activo
        // - NO hay pista guardada
        // - NO hay defaultTrack explícito
        var randomRotationEnabled = !!opts.randomStart && !savedTrack && !(opts.defaultTrack && trackExists(opts.defaultTrack));
        var userSelectedTrack = false;

        function pickRandomTrack(excludeUrl){
            if(!defaultTracks.length) return null;
            if(defaultTracks.length === 1) return defaultTracks[0].url;
            var candidate = null;
            for(var i = 0; i < 8; i++){
                candidate = defaultTracks[Math.floor(Math.random() * defaultTracks.length)].url;
                if(!excludeUrl || candidate !== excludeUrl) return candidate;
            }
            // Fallback si por azar repite
            return defaultTracks.find(function(t){ return t.url !== excludeUrl; }).url;
        }

        if(!selectedTrack){
            if(opts.defaultTrack && trackExists(opts.defaultTrack)){
                selectedTrack = opts.defaultTrack;
            }else if(opts.randomStart){
                selectedTrack = pickRandomTrack(null) || defaultTracks[0].url;
            }else{
                selectedTrack = defaultTracks[0].url;
            }
        }
        var wrapper = document.createElement('div');
        wrapper.className = 'music-player';
        var title = document.createElement('div');
        title.className = 'music-player__header';
        title.textContent = labels.title || 'Background music';
        var chooseLabel = document.createElement('label');
        chooseLabel.className = 'music-player__label';
        var chooseText = document.createElement('span');
        chooseText.className = 'music-player__label-text';
        chooseText.textContent = labels.choose || 'Choose track';
        var select = document.createElement('select');
        select.className = 'music-player__select';
        chooseLabel.appendChild(chooseText);
        chooseLabel.appendChild(select);
        var controls = document.createElement('div');
        controls.className = 'music-player__controls';

        var prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'music-player__nav music-player__nav--prev';
        prevBtn.textContent = labels.prev || 'Prev';

        var playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'music-player__toggle';
        playBtn.textContent = labels.play || 'Play music';

        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'music-player__nav music-player__nav--next';
        nextBtn.textContent = labels.next || 'Next';

        var volumeLabel = document.createElement('label');
        volumeLabel.className = 'music-player__label music-player__label--inline';
        var volumeText = document.createElement('span');
        volumeText.className = 'music-player__label-text';
        volumeText.textContent = labels.volume || 'Volume';
        var volumeInput = document.createElement('input');
        volumeInput.type = 'range';
        volumeInput.min = '0';
        volumeInput.max = '1';
        volumeInput.step = '0.05';
        volumeInput.value = initialVolume;
        volumeInput.className = 'music-player__volume';
        volumeLabel.appendChild(volumeText);
        volumeLabel.appendChild(volumeInput);

        controls.appendChild(prevBtn);
        controls.appendChild(playBtn);
        controls.appendChild(nextBtn);
        controls.appendChild(volumeLabel);
        wrapper.appendChild(title);
        wrapper.appendChild(chooseLabel);
        wrapper.appendChild(controls);
        var audio = sharedAudio;
        if(audio){
            // No lo movemos de documento: debe seguir siendo el elemento que el gesto desbloqueó.
            audio.loop = !randomRotationEnabled;
            volumeInput.value = audio.volume;
        }else{
            audio = document.createElement('audio');
            audio.preload = 'auto';
            audio.loop = !randomRotationEnabled;
            audio.volume = initialVolume;
            audio.src = selectedTrack;
            audio.style.display = 'none';
            wrapper.appendChild(audio);
        }
        container.appendChild(wrapper);
        createTrackOptions(select, selectedTrack);
        select.value = selectedTrack;
        var isPlaying = !!sharedAudio && !sharedAudio.paused;
        var autoplayBlocked = false;
        function updatePlayButton(){
            if(isPlaying){
                playBtn.textContent = labels.pause || 'Pause music';
                playBtn.setAttribute('aria-pressed', 'true');
            }else{
                playBtn.textContent = labels.play || 'Play music';
                playBtn.setAttribute('aria-pressed', 'false');
            }
        }

        function getTrackIndex(url){
            if(!url) return -1;
            for(var i = 0; i < defaultTracks.length; i++){
                if(defaultTracks[i].url === url) return i;
            }
            return -1;
        }

        function applyUserTrackSelection(url){
            if(!url) return;
            userSelectedTrack = true;
            if(randomRotationEnabled){
                randomRotationEnabled = false;
                audio.loop = true;
            }
            audio.src = url;
            select.value = url;
            if(storageKey){
                safeSetStorage(storageKey, url);
            }
            if(isPlaying){
                audio.play().catch(function(){});
            }
        }

        function goToDelta(delta){
            var currentUrl = select.value || audio.src;
            var idx = getTrackIndex(currentUrl);
            if(idx < 0) idx = 0;
            var nextIndex = (idx + delta) % defaultTracks.length;
            if(nextIndex < 0) nextIndex = defaultTracks.length - 1;
            applyUserTrackSelection(defaultTracks[nextIndex].url);
        }

        function onEnded(){
            if(!randomRotationEnabled || userSelectedTrack) return;
            var nextUrl = pickRandomTrack(audio.src);
            if(!nextUrl) return;
            audio.src = nextUrl;
            select.value = nextUrl;
            if(isPlaying){
                audio.play().catch(function(){});
            }
        }
        audio.addEventListener('ended', onEnded);

        prevBtn.addEventListener('click', function(){
            goToDelta(-1);
        });
        nextBtn.addEventListener('click', function(){
            goToDelta(1);
        });

        function play(forceAttempt){
            if(isPlaying) return Promise.resolve();
            if(autoplayBlocked && !forceAttempt){
                return Promise.resolve(false);
            }
            return audio.play().then(function(){
                isPlaying = true;
                autoplayBlocked = false;
                updatePlayButton();
                return true;
            }).catch(function(err){
                isPlaying = false;
                updatePlayButton();
                if(err && err.name === 'NotAllowedError'){
                    autoplayBlocked = true;
                }
                return false;
            });
        }

        function pause(){
            if(!isPlaying) return;
            audio.pause();
            isPlaying = false;
            updatePlayButton();
        }

        playBtn.addEventListener('click', function(){
            if(isPlaying){
                pause();
                return;
            }
            play(true);
        });
        select.addEventListener('change', function(){
            var value = select.value;
            if(!value) return;
            applyUserTrackSelection(value);
        });
        volumeInput.addEventListener('input', function(){
            var v = parseFloat(volumeInput.value);
            if(isNaN(v)) return;
            if(v < 0) v = 0;
            if(v > 1) v = 1;
            audio.volume = v;
            if(volumeStorageKey){
                safeSetStorage(volumeStorageKey, String(v));
            }
        });
        function updateLabels(newLabels){
            if(!newLabels) return;
            if(newLabels.title){
                title.textContent = newLabels.title;
            }
            if(newLabels.choose){
                chooseText.textContent = newLabels.choose;
            }
            if(newLabels.volume){
                volumeText.textContent = newLabels.volume;
            }
            if(newLabels.prev){
                prevBtn.textContent = newLabels.prev;
            }
            if(newLabels.next){
                nextBtn.textContent = newLabels.next;
            }
            if(isPlaying){
                if(newLabels.pause){
                    playBtn.textContent = newLabels.pause;
                }
            }else{
                if(newLabels.play){
                    playBtn.textContent = newLabels.play;
                }
            }
        }
        updatePlayButton();
        return {
            audio: audio,
            updateLabels: updateLabels,
            play: play,
            pause: pause,
            isPlaying: function(){ return isPlaying; },
            // Deja de gobernar el <audio> (sin pararlo) para que otra vista lo reutilice.
            detach: function(){ audio.removeEventListener('ended', onEnded); }
        };
    }
    window.initBackgroundMusic = initBackgroundMusic;
})();
