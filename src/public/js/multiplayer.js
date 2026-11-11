// Multiplayer local (2-4 jugadores en la misma pantalla)
(function(){
  // Estat de la partida. És reactiu: la plantilla de Vue el llig directament
  // (Subfase B, bloc 2), així que les funcions de lògica només el modifiquen.
  var state = Vue.reactive({
    view: 'none',
    currentQuizId: null,
    quizData: null,
    desiredQuestionCount: null,
    desiredQuestionTime: null,
    questionMode: 'shared',
    questions: [],
    rounds: [],
    idx: 0,
    timer: null,
    timerTotal: 20,
    timerLeft: 20,
    playerCount: 2,
    players: [],
    playerNames: [],
    playerIcons: [],
    phaseLocked: false,
    revealed: false,
    sharedQuestionText: '',
    sharedMedia: mediaInfo(null, null, false),
    questionCountInput: '',
    questionTimeInput: '',
    roundRankingOpen: false
  });

  var NAMES_KEY = 'multiplayerPlayerNames';
  var ICONS_KEY = 'multiplayerPlayerIcons';
  var FAVORITES_STORAGE_KEY = 'eduhoot-favorite-quizzes';
  var USER_RATING_STORAGE_KEY = 'eduhoot-user-ratings';
  var DEVICE_ID_STORAGE_KEY = 'eduhoot-device-id';
  var deviceId = '';
  var PAGE_SIZE = 12;

  function loadFavorites(){
    try{
      var raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if(!raw) return new Set();
      var parsed = JSON.parse(raw);
      if(!Array.isArray(parsed)) return new Set();
      return new Set(parsed.map(function(id){ return String(id); }));
    }catch(e){
      return new Set();
    }
  }

  function saveFavorites(ids){
    try{
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(ids)));
    }catch(e){}
  }

  function getDeviceId(){
    try{
      var existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
      if(existing) return existing;
      var bytes = new Uint8Array(12);
      if(window.crypto && window.crypto.getRandomValues){
        window.crypto.getRandomValues(bytes);
      }else{
        for(var i = 0; i < bytes.length; i++){
          bytes[i] = Math.floor(Math.random() * 256);
        }
      }
      var id = Array.from(bytes).map(function(b){ return b.toString(16).padStart(2, '0'); }).join('');
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
      return id;
    }catch(e){
      return 'anon-' + Math.random().toString(16).slice(2);
    }
  }

  function loadUserRatings(){
    try{
      var raw = localStorage.getItem(USER_RATING_STORAGE_KEY);
      if(!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    }catch(e){
      return {};
    }
  }

  function saveUserRatings(ratings){
    try{
      localStorage.setItem(USER_RATING_STORAGE_KEY, JSON.stringify(ratings));
    }catch(e){}
  }

  function formatRatingSummary(avg, count){
    if(!count){
      return t('ratingEmpty');
    }
    return format(t('ratingSummary'), { avg: avg.toFixed(1), count: count });
  }

  // Reutilizamos el set de iconos del selector de /join.
  var ICONS = [
    '🦊','🐱','🐶','🐼','🐧','🐸','🦉','🦄','🐰','🐢','🐙','🦁','🐨','🐝','🐯','🐻','🦕','🦖','🐉','🚀','🌈','⚽️','🏀','🏆','🎮','🎧','📚','🎨'
  ];

  var multiplayerMusicPlayerInstance = null;
  var MULTI_MUSIC_STORAGE_KEY = 'eduhoot-multiplayer-music';
  var gongAudio = null;
  var gongUrl = '/effects/gong.mp3';
  var GONG_VOLUME_BOOST = 1.25;

  var roundRankingDelayMs = 1100;

  var lang = EduhootLang.init();

  var i18n = {
    es: {
      back: 'Volver',
      footerPrivacy: 'Privacidad',
      footerSource: 'Código fuente',
      eyebrow: 'Multiplayer local',
      title: 'Juega en la misma pantalla',
      subtitle: 'Elige un quiz público, selecciona 2–4 jugadores y responde por turnos en pantalla dividida.',
      langLabel: 'Idioma',
      publicListEyebrow: 'Catálogo público',
      publicListTitle: 'Quizzes públicos',
      publicListDesc: 'Elige un quiz para configurar la partida local.',
      searchPlaceholder: 'Buscar por nombre o etiqueta',
      filterTagLabel: 'Etiquetas',
      filterTagSelectAll: 'Seleccionar todas',
      filterTagClear: 'Limpiar',
      filterTagShowMore: 'Mostrar etiquetas',
      filterTagShowLess: 'Ocultar etiquetas',
      filterQuestionsLabel: 'Preguntas',
      filterMinPlaceholder: 'mín',
      filterMaxPlaceholder: 'máx',
      filterOnlyImage: 'Solo con imagen',
      sortLabel: 'Ordenar por',
      sortPlays: 'Más jugados',
      sortLeastPlays: 'Menos jugados',
      sortNewest: 'Más recientes',
      sortRating: 'Mejor valorados',
      sortAlphaAsc: 'A-Z',
      sortAlphaDesc: 'Z-A',
      playsShort: 'partidas',
      playersShort: 'jugadores',
      ratingSummary: '{avg} · {count} votos',
      ratingEmpty: 'Sin valoraciones',
      ratingStarLabel: '{stars} estrellas',
      favoriteAdd: 'Guardar en favoritos',
      favoriteRemove: 'Quitar de favoritos',
      gameEyebrow: 'Partida local',
      gameTitle: 'Elige un quiz para empezar',
      startSelect: 'Selecciona un quiz público.',
      selectQuiz: 'Seleccionar',
      playerCountLabel: 'Jugadores',
      questionModeLabel: 'Preguntas',
      questionModeShared: 'La misma para todos',
      questionModePerPlayer: 'Una diferente por jugador',
      questionCountLabel: 'Preguntas a jugar',
      questionCountTotal: 'de {total}',
      questionTimeLabel: 'Tiempo por pregunta (segundos)',
      questionTimePlaceholder: 'Auto',
      playerNamesLabel: 'Nombres de jugadores',
      bgMusicTitle: 'Música de fondo',
      bgMusicChoose: 'Elige un tema',
      bgMusicPlay: 'Reproducir música',
      bgMusicPause: 'Pausar música',
      bgMusicPrev: 'Anterior',
      bgMusicNext: 'Siguiente',
      bgMusicVolume: 'Volumen',
      roundRankingTitle: 'Ranking',
      roundContinue: 'Continuar',
      startButton: 'Empezar',
      questionsLabel: 'Preguntas: {count}',
      questionOf: 'Pregunta {current} de {total}',
      timer: 'Tiempo',
      player: 'Jugador {n}',
      score: 'Puntos',
      correctText: '¡Correcto!',
      wrongText: 'Incorrecto',
      partialText: 'Parcialmente correcto',
      timeup: 'Tiempo',
      finishTitle: 'Partida terminada',
      playAgain: 'Repetir',
      playSame: 'Repetir mismas preguntas',
      pickAnother: 'Elegir otro quiz',
      submitAnswers: 'Enviar respuestas',
      iconLabel: 'Icono'
    },
    en: {
      back: 'Back',
      footerPrivacy: 'Privacy',
      footerSource: 'Source code',
      eyebrow: 'Local multiplayer',
      title: 'Play on the same screen',
      subtitle: 'Pick a public quiz, choose 2–4 players and answer on a split screen.',
      langLabel: 'Language',
      publicListEyebrow: 'Public catalog',
      publicListTitle: 'Public quizzes',
      publicListDesc: 'Pick a quiz to set up a local match.',
      searchPlaceholder: 'Search by name or tag',
      filterTagLabel: 'Tags',
      filterTagSelectAll: 'Select all',
      filterTagClear: 'Clear',
      filterTagShowMore: 'Show tags',
      filterTagShowLess: 'Hide tags',
      filterQuestionsLabel: 'Questions',
      filterMinPlaceholder: 'min',
      filterMaxPlaceholder: 'max',
      filterOnlyImage: 'Only with image',
      sortLabel: 'Sort by',
      sortPlays: 'Most played',
      sortLeastPlays: 'Least played',
      sortNewest: 'Newest',
      sortRating: 'Top rated',
      sortAlphaAsc: 'A-Z',
      sortAlphaDesc: 'Z-A',
      playsShort: 'plays',
      playersShort: 'players',
      ratingSummary: '{avg} · {count} votes',
      ratingEmpty: 'No ratings yet',
      ratingStarLabel: '{stars} stars',
      favoriteAdd: 'Save as favorite',
      favoriteRemove: 'Remove favorite',
      gameEyebrow: 'Local match',
      gameTitle: 'Pick a quiz to start',
      startSelect: 'Select a public quiz.',
      selectQuiz: 'Select',
      playerCountLabel: 'Players',
      questionModeLabel: 'Questions',
      questionModeShared: 'Same for everyone',
      questionModePerPlayer: 'Different per player',
      questionCountLabel: 'Questions to play',
      questionCountTotal: 'of {total}',
      questionTimeLabel: 'Time per question (seconds)',
      questionTimePlaceholder: 'Auto',
      playerNamesLabel: 'Player names',
      bgMusicTitle: 'Background music',
      bgMusicChoose: 'Choose a track',
      bgMusicPlay: 'Play music',
      bgMusicPause: 'Pause music',
      bgMusicPrev: 'Prev',
      bgMusicNext: 'Next',
      bgMusicVolume: 'Volume',
      roundRankingTitle: 'Ranking',
      roundContinue: 'Continue',
      startButton: 'Start',
      questionsLabel: 'Questions: {count}',
      questionOf: 'Question {current} of {total}',
      timer: 'Time',
      player: 'Player {n}',
      score: 'Score',
      correctText: 'Correct!',
      wrongText: 'Wrong',
      partialText: 'Partially correct',
      timeup: 'Time',
      finishTitle: 'Match finished',
      playAgain: 'Play again',
      playSame: 'Play same questions',
      pickAnother: 'Pick another quiz',
      submitAnswers: 'Submit answers',
      iconLabel: 'Icon'
    },
    ca: {
      back: 'Tornar',
      footerPrivacy: 'Privacitat',
      footerSource: 'Codi font',
      eyebrow: 'Multiplayer local',
      title: 'Juga a la mateixa pantalla',
      subtitle: 'Tria un quiz públic, selecciona 2–4 jugadors i respon en una pantalla dividida.',
      langLabel: 'Idioma',
      publicListEyebrow: 'Catàleg públic',
      publicListTitle: 'Quizzes públics',
      publicListDesc: 'Tria un quiz per configurar la partida local.',
      searchPlaceholder: 'Cerca per nom o etiqueta',
      filterTagLabel: 'Etiquetes',
      filterTagSelectAll: 'Seleccionar totes',
      filterTagClear: 'Netejar',
      filterTagShowMore: 'Mostrar etiquetes',
      filterTagShowLess: 'Ocultar etiquetes',
      filterQuestionsLabel: 'Preguntes',
      filterMinPlaceholder: 'mín',
      filterMaxPlaceholder: 'màx',
      filterOnlyImage: 'Només amb imatge',
      sortLabel: 'Ordenar per',
      sortPlays: 'Més jugats',
      sortLeastPlays: 'Menys jugats',
      sortNewest: 'Més recents',
      sortRating: 'Més ben valorats',
      sortAlphaAsc: 'A-Z',
      sortAlphaDesc: 'Z-A',
      playsShort: 'partides',
      playersShort: 'jugadors',
      ratingSummary: '{avg} · {count} vots',
      ratingEmpty: 'Sense valoracions',
      ratingStarLabel: '{stars} estrelles',
      favoriteAdd: 'Desar a favorits',
      favoriteRemove: 'Treure de favorits',
      gameEyebrow: 'Partida local',
      gameTitle: 'Tria un quiz per començar',
      startSelect: 'Selecciona un quiz públic.',
      selectQuiz: 'Seleccionar',
      playerCountLabel: 'Jugadors',
      questionModeLabel: 'Preguntes',
      questionModeShared: 'La mateixa per a tots',
      questionModePerPlayer: 'Una diferent per jugador',
      questionCountLabel: 'Preguntes a jugar',
      questionCountTotal: 'de {total}',
      questionTimeLabel: 'Temps per pregunta (segons)',
      questionTimePlaceholder: 'Auto',
      playerNamesLabel: 'Noms de jugadors',
      bgMusicTitle: 'Música de fons',
      bgMusicChoose: 'Tria un tema',
      bgMusicPlay: 'Reprodueix música',
      bgMusicPause: 'Atura la música',
      bgMusicPrev: 'Anterior',
      bgMusicNext: 'Següent',
      bgMusicVolume: 'Volum',
      roundRankingTitle: 'Rànquing',
      roundContinue: 'Continuar',
      startButton: 'Començar',
      questionsLabel: 'Preguntes: {count}',
      questionOf: 'Pregunta {current} de {total}',
      timer: 'Temps',
      player: 'Jugador {n}',
      score: 'Punts',
      correctText: 'Correcte!',
      wrongText: 'Incorrecte',
      partialText: 'Parcialment correcte',
      timeup: 'Temps',
      finishTitle: 'Partida acabada',
      playAgain: 'Tornar a jugar',
      playSame: 'Repetir mateixes preguntes',
      pickAnother: 'Triar un altre quiz',
      submitAnswers: 'Enviar respostes',
      iconLabel: 'Icona'
    },
    va: {
      favoriteAdd: 'Guardar en favorits',
      favoriteRemove: 'Llevar de favorits',
      playSame: 'Repetir les mateixes preguntes'
    }
  };

  deviceId = getDeviceId();

  function t(key){
    var chain = lang === 'va' ? ['va', 'ca', 'es'] : [lang, 'es'];
    for(var i = 0; i < chain.length; i++){
      var dict = i18n[chain[i]];
      if(dict && dict[key]) return dict[key];
    }
    return key;
  }

  function togglePlayerMultiSelection(playerId, choice){
    if(state.phaseLocked) return;
    var q = getQuestionForPlayer(playerId);
    if(!q || normalizeQuestionMeta(q).type !== 'multiple') return;
    var player = state.players[playerId];
    if(!player || player.answered) return;
    var existingIdx = player.multiSelections.indexOf(choice);
    if(existingIdx === -1){
      player.multiSelections.push(choice);
    }else{
      player.multiSelections.splice(existingIdx, 1);
    }
  }

  function handlePlayerAnswerClick(playerId, choice){
    var q = getQuestionForPlayer(playerId);
    if(!q) return;
    if(normalizeQuestionMeta(q).type === 'multiple'){
      togglePlayerMultiSelection(playerId, choice);
      return;
    }
    answerForPlayer(playerId, choice);
  }

  function submitMultiAnswer(playerId){
    if(state.phaseLocked) return;
    var player = state.players[playerId];
    if(!player || player.answered) return;
    var q = getQuestionForPlayer(playerId);
    if(!q) return;
    var meta = normalizeQuestionMeta(q);
    if(meta.type !== 'multiple') return;
    var selections = player.multiSelections.slice();
    if(!selections.length) return;
    var normalizedSelections = selections.sort(function(a, b){ return a - b; });
    player.selectedAnswers = normalizedSelections;
    player.choice = null;
    player.multiSelections = normalizedSelections.slice();
    player.answered = true;
    player.multiSubmitted = true;
    var hits = meta.correctAnswers.filter(function(answer){ return normalizedSelections.indexOf(answer) !== -1; }).length;
    var wrongs = normalizedSelections.length - hits;
    var ratio = meta.correctAnswers.length ? Math.max(0, hits - wrongs) / meta.correctAnswers.length : 0;
    player.outcome = ratio === 1 ? 'ok' : (ratio > 0 ? 'partial' : 'bad');
    if(ratio > 0){
      player.correct += 1;
      var bonus = Math.max(100, Math.round(1000 * (state.timerLeft / state.timerTotal)));
      player.score += Math.round(bonus * ratio);
    }
    if(allAnswered()){
      finishRoundAndContinue();
    }
  }

  function format(str, data){
    if(!str) return '';
    return str.replace(/{(\w+)}/g, function(_, k){ return data[k] !== undefined ? data[k] : ''; });
  }

  function shuffleArray(arr){
    var copy = arr.slice();
    for(var i = copy.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function scrollToBottom(opts){
    try{
      var behavior = (opts && opts.behavior) || 'smooth';
      // Dos frames para asegurar que el DOM ya ha pintado.
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          var container = document.getElementById('game-panel');
          // Si estamos en modo playing, el scroll real puede vivir en #game-panel.
          if(container && document.body.classList.contains('playing')){
            var maxScroll = container.scrollHeight - container.clientHeight;
            if(maxScroll > 0){
              if(behavior === 'smooth' && typeof container.scrollTo === 'function'){
                try{ container.scrollTo({ top: container.scrollHeight, left: 0, behavior: 'smooth' }); return; }catch(e){}
              }
              container.scrollTop = container.scrollHeight;
              return;
            }
          }

          var se = document.scrollingElement || document.documentElement || document.body;
          if(!se) return;
          var pageMax = se.scrollHeight - se.clientHeight;
          if(pageMax <= 0) return;
          if(behavior === 'smooth' && typeof window.scrollTo === 'function'){
            try{ window.scrollTo({ top: se.scrollHeight, left: 0, behavior: 'smooth' }); return; }catch(e){}
          }
          se.scrollTop = se.scrollHeight;
        });
      });
    }catch(e){
      try{ window.scrollTo(0, document.body.scrollHeight || 0); }catch(_e){}
    }
  }

  function requestFullscreen(){
    try{
      if(document.fullscreenElement) return;
      var el = document.documentElement;
      var req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if(!req) return;
      var maybePromise = req.call(el);
      if(maybePromise && typeof maybePromise.catch === 'function'){
        maybePromise.catch(function(){});
      }
    }catch(e){}
  }

  function exitFullscreen(){
    try{
      if(!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) return;
      var exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
      if(!exit) return;
      var maybePromise = exit.call(document);
      if(maybePromise && typeof maybePromise.catch === 'function'){
        maybePromise.catch(function(){});
      }
    }catch(e){}
  }

  function randomizeQuestions(baseQuestions){
    var source = Array.isArray(baseQuestions) ? baseQuestions : [];
    var shuffledOrder = shuffleArray(source);
    return shuffledOrder.map(function(q){
      return randomizeOneQuestion(q);
    });
  }

  function normalizeQuestionMeta(q){
    var type = (q && q.type) ? String(q.type).toLowerCase() : 'quiz';
    if(type !== 'multiple' && type !== 'true-false') type = 'quiz';
    var answers = Array.isArray(q && q.correctAnswers) ? q.correctAnswers.slice() : [];
    if(!answers.length && q && typeof q.correct !== 'undefined'){
      var parsed = parseInt(q.correct, 10);
      if(!Number.isNaN(parsed)){
        answers.push(parsed);
      }
    }
    if(!answers.length){
      answers.push(1);
    }
    var maxAnswerIndex = (type === 'true-false') ? 2 : 4;
    return {
      type: type,
      correctAnswers: answers.map(function(value){
        var num = parseInt(value, 10);
        if(Number.isNaN(num)) return 1;
        return Math.max(1, Math.min(maxAnswerIndex, num));
      })
    };
  }

  function isMultipleQuestion(q){
    return normalizeQuestionMeta(q).type === 'multiple';
  }

  function randomizeOneQuestion(q){
    var meta = normalizeQuestionMeta(q);

    var answers = Array.isArray(q && q.answers) ? q.answers.slice(0, 4) : ['', '', '', ''];
    while(answers.length < 4) answers.push('');

    // En true/false solo se muestran 2 opciones: barajamos solo 2.
    var baseOrder = (meta.type === 'true-false') ? [0, 1] : [0, 1, 2, 3];
    var answerOrder = shuffleArray(baseOrder);
    var newAnswers = answerOrder.map(function(idx){ return answers[idx]; });
    if(meta.type === 'true-false'){
      while(newAnswers.length < 4) newAnswers.push('');
    }

    var newCorrectAnswers = [];
    meta.correctAnswers.forEach(function(orig){
      var zero = Math.max(0, Math.min(3, orig - 1));
      var newIdx = answerOrder.indexOf(zero);
      if(newIdx !== -1){
        var candidate = newIdx + 1;
        if(newCorrectAnswers.indexOf(candidate) === -1){
          newCorrectAnswers.push(candidate);
        }
      }
    });
    if(!newCorrectAnswers.length){
      newCorrectAnswers.push(1);
    }
    var newCorrect = newCorrectAnswers[0];
    return {
      question: (q && q.question) || '',
      answers: newAnswers,
      correct: newCorrect,
      correctAnswers: newCorrectAnswers,
      type: meta.type,
      image: (q && q.image) || '',
      video: (q && q.video) || '',
      time: q && q.time
    };
  }

  function getVisibleAnswers(q, type){
    var answers = Array.isArray(q && q.answers) ? q.answers.slice(0, 4) : ['', '', '', ''];
    while(answers.length < 4) answers.push('');
    if(type === 'true-false'){
      return answers.slice(0, 2);
    }
    return answers;
  }

  function areAnswerSetsEqual(left, right){
    if(!Array.isArray(left) || !Array.isArray(right)) return false;
    var sortedLeft = left.slice().sort(function(a, b){ return a - b; });
    var sortedRight = right.slice().sort(function(a, b){ return a - b; });
    if(sortedLeft.length !== sortedRight.length) return false;
    for(var i = 0; i < sortedLeft.length; i++){
      if(sortedLeft[i] !== sortedRight[i]) return false;
    }
    return true;
  }

  function buildRounds(baseQuestions, playerCount, roundsCount){
    var source = Array.isArray(baseQuestions) ? baseQuestions : [];
    var total = source.length;
    var rounds = [];
    if(total === 0) return rounds;

    var indices = [];
    for(var i = 0; i < total; i++) indices.push(i);
    indices = shuffleArray(indices);
    var cursor = 0;

    function nextIndex(usedSet){
      // Intenta evitar repetir dentro de la misma ronda.
      for(var tries = 0; tries < total + 2; tries++){
        if(cursor >= indices.length){
          indices = shuffleArray(indices);
          cursor = 0;
        }
        var idx = indices[cursor++];
        if(!usedSet[idx]){
          usedSet[idx] = true;
          return idx;
        }
      }
      // Si no se puede (pocas preguntas), acepta repetición.
      if(cursor >= indices.length){
        indices = shuffleArray(indices);
        cursor = 0;
      }
      return indices[cursor++ % indices.length];
    }

    for(var r = 0; r < roundsCount; r++){
      var used = {};
      var roundQs = [];
      for(var p = 0; p < playerCount; p++){
        var baseIdx = nextIndex(used);
        roundQs.push(randomizeOneQuestion(source[baseIdx]));
      }
      rounds.push(roundQs);
    }
    return rounds;
  }

  function applyStaticText(){
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var key = el.getAttribute('data-i18n');
      if(el.classList && el.classList.contains('is-icon')){
        var label = t(key);
        el.setAttribute('aria-label', label);
        var sr = el.querySelector('.sr-only');
        if(sr) sr.textContent = label;
      }else{
        el.textContent = t(key);
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el){
      var key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });
    var langSelect = document.getElementById('lang-select');
    if(langSelect) langSelect.value = lang;
  }

  function showRoundRankingModal(){
    state.roundRankingOpen = true;
  }

  function hideRoundRankingModalAndContinue(){
    if(!state.roundRankingOpen) return;
    state.roundRankingOpen = false;
    nextQuestion();
  }

  function setLang(newLang){
    lang = newLang;
    EduhootLang.persist(lang);
    app.lang = newLang;
    applyStaticText();
    updateMultiplayerMusicLabels();
  }

  function updateMultiplayerMusicLabels(){
    if(!multiplayerMusicPlayerInstance || typeof multiplayerMusicPlayerInstance.updateLabels !== 'function') return;
    multiplayerMusicPlayerInstance.updateLabels({
      title: t('bgMusicTitle'),
      choose: t('bgMusicChoose'),
      play: t('bgMusicPlay'),
      pause: t('bgMusicPause'),
      prev: t('bgMusicPrev'),
      next: t('bgMusicNext'),
      volume: t('bgMusicVolume')
    });
  }

  function initMultiplayerMusicPlayer(){
    if(typeof initBackgroundMusic !== 'function') return;
    if(multiplayerMusicPlayerInstance && multiplayerMusicPlayerInstance.audio) return;
    multiplayerMusicPlayerInstance = initBackgroundMusic('#multiplayer-music-player', {
      storageKey: MULTI_MUSIC_STORAGE_KEY,
      randomStart: true,
      volume: 0.6
    });
    updateMultiplayerMusicLabels();
  }

  function ensureMultiplayerMusicPlaying(){
    if(!multiplayerMusicPlayerInstance) return;
    if(typeof multiplayerMusicPlayerInstance.play === 'function'){
      multiplayerMusicPlayerInstance.play();
      return;
    }
    if(!multiplayerMusicPlayerInstance.audio) return;
    var audio = multiplayerMusicPlayerInstance.audio;
    if(!audio.paused) return;
    audio.play().catch(function(){});
  }

  function pauseMultiplayerMusic(){
    if(!multiplayerMusicPlayerInstance) return;
    if(typeof multiplayerMusicPlayerInstance.pause === 'function'){
      multiplayerMusicPlayerInstance.pause();
      return;
    }
    if(!multiplayerMusicPlayerInstance.audio) return;
    try{ multiplayerMusicPlayerInstance.audio.pause(); }catch(e){}
  }

  function initGong(){
    if(gongAudio) return;
    try{
      gongAudio = new Audio(gongUrl);
      gongAudio.preload = 'auto';
    }catch(e){
      gongAudio = null;
    }
  }

  function getMultiplayerMusicVolume(){
    try{
      if(multiplayerMusicPlayerInstance && multiplayerMusicPlayerInstance.audio && typeof multiplayerMusicPlayerInstance.audio.volume === 'number'){
        return multiplayerMusicPlayerInstance.audio.volume;
      }
    }catch(e){}
    try{
      var v = localStorage.getItem(MULTI_MUSIC_STORAGE_KEY + ':volume');
      if(v != null){
        var parsed = parseFloat(v);
        if(!isNaN(parsed)) return parsed;
      }
    }catch(e){}
    return 0.6;
  }

  function getGongVolume(){
    var base = getMultiplayerMusicVolume();
    if(typeof base !== 'number' || isNaN(base)) base = 0.6;
    if(base < 0) base = 0;
    if(base > 1) base = 1;
    var v = base * GONG_VOLUME_BOOST;
    if(v > 1) v = 1;
    if(v < 0) v = 0;
    return v;
  }

  function playGong(){
    initGong();
    if(!gongAudio) return;
    try{ gongAudio.pause(); gongAudio.currentTime = 0; }catch(e){}
    try{ gongAudio.volume = getGongVolume(); }catch(e){}
    gongAudio.play().catch(function(){});
  }

  function loadStoredNames(){
    try{
      var raw = localStorage.getItem(NAMES_KEY);
      var data = raw ? JSON.parse(raw) : null;
      if(Array.isArray(data)) return data.map(function(x){ return (x || '').toString().trim(); });
    }catch(e){}
    return [];
  }

  function loadStoredIcons(){
    try{
      var raw = localStorage.getItem(ICONS_KEY);
      var data = raw ? JSON.parse(raw) : null;
      if(Array.isArray(data)) return data.map(function(x){ return (x || '').toString(); });
    }catch(e){}
    return [];
  }

  function saveStoredNames(names){
    try{ localStorage.setItem(NAMES_KEY, JSON.stringify(names || [])); }catch(e){}
  }

  function saveStoredIcons(icons){
    try{ localStorage.setItem(ICONS_KEY, JSON.stringify(icons || [])); }catch(e){}
  }

  function defaultPlayerIcon(idx){
    return ICONS[idx % ICONS.length] || '🙂';
  }

  function normalizePlayerTag(str){
    var s = (str || '').toString();
    try{
      s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }catch(e){}
    return s
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3);
  }

  function normalizePlayerName(name, idx){
    var tag = normalizePlayerTag(name);
    if(tag) return tag;
    // Fallback corto y válido (1-4) si se deja vacío.
    return String(idx + 1);
  }

  function ensurePlayerNames(){
    if(!Array.isArray(state.playerNames)) state.playerNames = [];
    var stored = loadStoredNames();
    for(var i = 0; i < 4; i++){
      var fromState = state.playerNames[i];
      var fromStore = stored[i];
      state.playerNames[i] = (fromState && fromState.trim()) ? fromState.trim() : (fromStore && fromStore.trim()) ? fromStore.trim() : '';
    }
  }

  function ensurePlayerIcons(){
    if(!Array.isArray(state.playerIcons)) state.playerIcons = [];
    var stored = loadStoredIcons();
    for(var i = 0; i < 4; i++){
      var fromState = state.playerIcons[i];
      var fromStore = stored[i];
      var value = (fromState && fromState.toString()) ? fromState.toString() : (fromStore && fromStore.toString()) ? fromStore.toString() : '';
      state.playerIcons[i] = value || defaultPlayerIcon(i);
    }
  }

  function mediaThumb(data){
    if(!data) return '';
    var yt = parseYouTubeId(data);
    if(yt) return 'https://img.youtube.com/vi/' + yt + '/hqdefault.jpg';
    return normalizeSvgDataUrlForImg(data);
  }

  function parseYouTubeId(url){
    if(!url) return null;
    try{
      var u = new URL(url);
      if(u.hostname.includes('youtu.be')) return u.pathname.replace('/', '');
      if(u.hostname.includes('youtube.com')){
        if(u.searchParams.get('v')) return u.searchParams.get('v');
        var parts = u.pathname.split('/');
        var last = parts[parts.length - 1];
        if(last) return last;
      }
    }catch(e){}
    return null;
  }

  function normalizeSvgDataUrlForImg(url){
    if(!url) return url;
    var raw = String(url).trim();
    if(!raw) return raw;
    var lower = raw.toLowerCase();
    if(!lower.startsWith('data:image/svg+xml')) return raw;
    var comma = raw.indexOf(',');
    if(comma === -1) return raw;
    var header = raw.slice(0, comma + 1);
    var payload = raw.slice(comma + 1);
    if(!payload) return raw;
    if(/;base64/i.test(header)) return raw;

    // Ya URL-encoded: recortar cualquier sufijo tras </svg>
    if(/%[0-9a-fA-F]{2}/.test(payload)){
      var lp = payload.toLowerCase();
      var endEnc = '%3c%2fsvg%3e';
      var posEnc = lp.lastIndexOf(endEnc);
      if(posEnc !== -1) return header + payload.slice(0, posEnc + endEnc.length);
      return raw;
    }

    // Raw: recortar tras </svg> y URL-encode
    var lpr = payload.toLowerCase();
    var endRaw = '</svg>';
    var posRaw = lpr.lastIndexOf(endRaw);
    if(posRaw !== -1){
      payload = payload.slice(0, posRaw + endRaw.length);
    }
    if(payload.indexOf('<') !== -1 || payload.indexOf('#') !== -1 || payload.indexOf('"') !== -1 || payload.indexOf("'") !== -1){
      return header + encodeURIComponent(payload);
    }
    return raw;
  }

  function mediaInfo(imageUrl, videoUrl, normalizeSvg){
    var info = { has: false, image: '', video: '', iframe: '' };
    if(imageUrl){
      info.image = normalizeSvg ? normalizeSvgDataUrlForImg(imageUrl) : imageUrl;
      info.has = true;
    }
    var ytId = parseYouTubeId(videoUrl);
    if(ytId){
      info.iframe = 'https://www.youtube-nocookie.com/embed/' + ytId;
      info.has = true;
    }else if(videoUrl){
      info.video = videoUrl;
      info.has = true;
    }
    return info;
  }

  function setMedia(imageUrl, videoUrl){
    state.sharedMedia = mediaInfo(imageUrl, videoUrl, true);
  }

  function fetchPublicQuizzes(){
    app.loading = true;
    fetch('/api/public-quizzes?mode=multiplayer')
      .then(function(res){ return res.json(); })
      .then(function(data){
        app.quizzes = shuffleArray(Array.isArray(data) ? data : []);
        app.page = 0;
        app.pruneTags();
        app.loading = false;
      })
      .catch(function(){
        app.quizzes = [];
        app.loading = false;
      });
  }

  function sortPublicQuizzes(list, sortOrder){
    return list.slice().sort(function(a, b){
      if(sortOrder === 'recent'){
        var ta = Date.parse(a && (a.createdAt || a.updatedAt)) || 0;
        var tb = Date.parse(b && (b.createdAt || b.updatedAt)) || 0;
        if(ta === tb) return Math.random() - 0.5;
        return tb - ta;
      }
      if(sortOrder === 'alpha'){
        var na = (a && a.name ? a.name : '').toLowerCase();
        var nb = (b && b.name ? b.name : '').toLowerCase();
        return na.localeCompare(nb);
      }
      if(sortOrder === 'alpha-desc'){
        var nda = (a && a.name ? a.name : '').toLowerCase();
        var ndb = (b && b.name ? b.name : '').toLowerCase();
        return ndb.localeCompare(nda);
      }
      if(sortOrder === 'rating'){
        var ra = Number(a && a.ratingAvg) || 0;
        var rb = Number(b && b.ratingAvg) || 0;
        if(ra !== rb) return rb - ra;
        var ca = Number(a && a.ratingCount) || 0;
        var cb = Number(b && b.ratingCount) || 0;
        if(ca !== cb) return cb - ca;
      }
      var pa = a && typeof a.playsCount === 'number' ? a.playsCount : 0;
      var pb = b && typeof b.playsCount === 'number' ? b.playsCount : 0;
      if(sortOrder === 'least'){
        if(pa === pb) return Math.random() - 0.5;
        return pa - pb;
      }
      if(pa === pb) return Math.random() - 0.5;
      return pb - pa;
    });
  }

  function quizQuestionTotal(){
    return Array.isArray(state.quizData && state.quizData.questions) ? state.quizData.questions.length : 0;
  }

  // Per defecte, el màxim de preguntes; es conserva l'elecció anterior si cap.
  function syncQuestionCount(){
    var total = quizQuestionTotal();
    if(!state.desiredQuestionCount){
      state.desiredQuestionCount = total;
    }
    var desired = clampQuestionCount(state.desiredQuestionCount, total);
    state.desiredQuestionCount = desired;
    state.questionCountInput = desired ? String(desired) : '';
  }

  function clampQuestionCount(n, total){
    var v = parseInt(n, 10);
    var tTotal = parseInt(total, 10);
    if(isNaN(tTotal) || tTotal < 1) tTotal = 0;
    if(isNaN(v) || v < 1) v = tTotal;
    if(tTotal > 0 && v > tTotal) v = tTotal;
    return v;
  }

  function getDesiredQuestionCount(){
    var v = clampQuestionCount(state.questionCountInput, quizQuestionTotal());
    state.desiredQuestionCount = v;
    state.questionCountInput = v ? String(v) : '';
    return v;
  }

  function selectQuiz(id){
    state.currentQuizId = id;
    state.quizData = null;
    state.view = 'none';
    state.questionCountInput = '';

    function isFreeTypeQuestion(q){
      if(!q) return false;
      var rawType = (q.type || '').toString().toLowerCase().trim();
      if(rawType === 'short-answer' || rawType === 'shortanswer') return true;
      if(rawType === 'numeric' || rawType === 'numerical') return true;

      // Señales defensivas si el tipo está mal pero vienen campos libres.
      var acc = q.acceptedAnswers;
      var hasAccepted = Array.isArray(acc) ? acc.length > 0 : (typeof acc === 'string' && acc.trim().length > 0);
      var hasNumeric =
        (typeof q.numericAnswer === 'number') ||
        (q.numericAnswer !== null && q.numericAnswer !== undefined && typeof q.numericAnswer === 'string' && q.numericAnswer.trim().length > 0) ||
        (q.numero !== null && q.numero !== undefined && String(q.numero).trim().length > 0) ||
        (q.tolerancia !== null && q.tolerancia !== undefined && String(q.tolerancia).trim().length > 0) ||
        (q.tolerance !== null && q.tolerance !== undefined && String(q.tolerance).trim().length > 0);
      return hasAccepted || hasNumeric;
    }

    fetch('/api/quizzes/' + encodeURIComponent(id) + '?mode=multiplayer')
      .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
      .then(function(payload){
        if(!payload.ok){
          state.quizData = null;
          document.body.classList.remove('playing');
          document.body.classList.remove('preparing');
          return;
        }
        state.quizData = payload.body;
        // Defensa extra: aunque el backend no esté actualizado/reiniciado, filtramos aquí.
        if(state.quizData && Array.isArray(state.quizData.questions)){
          state.quizData.questions = state.quizData.questions.filter(function(q){ return !isFreeTypeQuestion(q); });
        }
        // En setup queremos scroll normal (especialmente en móvil).
        // Reservamos `playing` para la partida en sí.
        document.body.classList.remove('playing');
        document.body.classList.add('preparing');
        state.view = 'setup';
        syncQuestionCount();
      })
      .catch(function(){
        state.quizData = null;
        document.body.classList.remove('playing');
        document.body.classList.remove('preparing');
      });
  }

  function setupPlayers(){
    ensurePlayerNames();
    ensurePlayerIcons();
    state.players = [];
    for(var i = 0; i < state.playerCount; i++){
      state.players.push({
        id: i,
        name: normalizePlayerName(state.playerNames[i], i),
        icon: state.playerIcons[i] || defaultPlayerIcon(i),
        score: 0,
        correct: 0,
        answered: false,
        choice: null,
        outcome: null,
        multiSelections: [],
        selectedAnswers: [],
        multiSubmitted: false,
        shownScore: 0
      });
    }

    // Persistimos los nombres normalizados para la próxima partida.
    for(var k = 0; k < state.playerCount; k++){
      state.playerNames[k] = state.players[k].name;
      state.playerIcons[k] = state.players[k].icon;
    }
    saveStoredNames(state.playerNames);
    saveStoredIcons(state.playerIcons);
  }

  function getRoundCount(){
    if(state.questionMode === 'per-player') return Array.isArray(state.rounds) ? state.rounds.length : 0;
    return Array.isArray(state.questions) ? state.questions.length : 0;
  }

  function getQuestionForPlayer(playerId){
    if(state.questionMode === 'per-player'){
      var round = state.rounds && state.rounds[state.idx];
      return round && round[playerId];
    }
    return state.questions && state.questions[state.idx];
  }

  // La puntuació visible (shownScore) només s'actualitza en començar la
  // pregunta i en revelar la ronda: si no, es veuria qui ha encertat abans
  // que hagen respost tots.
  function resetPlayersForQuestion(){
    state.revealed = false;
    state.players.forEach(function(p){
      p.answered = false;
      p.choice = null;
      p.outcome = null;
      p.multiSelections = [];
      p.selectedAnswers = [];
      p.multiSubmitted = false;
      p.shownScore = p.score;
    });
  }

  function startTimer(seconds){
    state.timerTotal = Math.max(5, Math.min(120, seconds));
    state.timerLeft = state.timerTotal;
    if(state.timer) clearInterval(state.timer);

    state.timer = setInterval(function(){
      state.timerLeft = Math.max(0, state.timerLeft - 0.1);
      if(state.timerLeft <= 0){
        clearInterval(state.timer);
        state.timer = null;
        onTimeUp();
      }
    }, 100);
  }

  function stopTimer(){
    if(state.timer){
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function allAnswered(){
    return state.players.every(function(p){ return p.answered; });
  }

  function revealRound(){
    state.revealed = true;
    state.players.forEach(function(p){
      p.shownScore = p.score;
    });
  }

  function finishRoundAndContinue(){
    state.phaseLocked = true;
    stopTimer();
    playGong();
    revealRound();
    // Pequeña pausa para ver ✓/✕ antes del modal.
    setTimeout(function(){
      showRoundRankingModal();
    }, roundRankingDelayMs);
  }

  function answerForPlayer(playerId, choice){
    if(state.phaseLocked) return;
    var q = getQuestionForPlayer(playerId);
    if(!q) return;

    var p = state.players[playerId];
    if(!p || p.answered) return;

    p.answered = true;
    p.choice = choice;
    p.selectedAnswers = [choice];
    p.multiSelections = [choice];

    var meta = normalizeQuestionMeta(q);
    var correctList = Array.isArray(meta.correctAnswers) && meta.correctAnswers.length
      ? meta.correctAnswers
      : [(parseInt(q.correct, 10) || 1)];
    var isCorrect = choice === (correctList[0] || 1);
    if(isCorrect){
      p.correct += 1;
      var bonus = Math.max(100, Math.round(1000 * (state.timerLeft / state.timerTotal)));
      p.score += bonus;
      p.outcome = 'ok';
    }else{
      p.outcome = 'bad';
    }

    // No revelamos correcto/incorrecto aquí: la plantilla solo bloquea la selección.
    if(allAnswered()){
      finishRoundAndContinue();
    }
  }

  function onTimeUp(){
    if(state.phaseLocked) return;
    // Marca a quien no respondió como timeout y revela todo al final.
    state.players.forEach(function(p){
      if(p.answered) return;
      p.answered = true;
      p.choice = null;
      p.outcome = 'timeout';
      p.selectedAnswers = [];
      p.multiSelections = [];
    });

    finishRoundAndContinue();
  }

  function renderQuestion(){
    if(state.idx >= getRoundCount()){
      finishGame();
      return;
    }

    state.phaseLocked = false;
    var forcedTime = (typeof state.desiredQuestionTime === 'number' && state.desiredQuestionTime > 0)
      ? state.desiredQuestionTime
      : null;

    if(state.questionMode === 'per-player'){
      state.sharedQuestionText = '';
      setMedia(null, null);

      // Para el timer compartido, usa el mayor tiempo de las preguntas de esta ronda.
      var round = state.rounds[state.idx] || [];
      var maxTime = 20;
      round.forEach(function(qp){
        var tVal = (typeof qp.time === 'number' && qp.time > 0) ? qp.time : 0;
        if(tVal > maxTime) maxTime = tVal;
      });
      resetPlayersForQuestion();
      startTimer(forcedTime || maxTime);
      scrollToBottom({ behavior: 'auto' });
      return;
    }

    var q = state.questions[state.idx];
    state.sharedQuestionText = q.question || '';
    setMedia(q.image, q.video);
    resetPlayersForQuestion();

    var time = (typeof q.time === 'number' && q.time > 0) ? q.time : 20;
    startTimer(forcedTime || time);

    scrollToBottom({ behavior: 'auto' });
  }

  function nextQuestion(){
    state.idx += 1;
    renderQuestion();
  }

  function finishGame(){
    stopTimer();
    setMedia(null, null);
    state.view = 'results';
  }

  function startGame(){
    if(!state.quizData || !Array.isArray(state.quizData.questions) || !state.quizData.questions.length) return;

    document.body.classList.remove('preparing');
    document.body.classList.add('playing');

    // Audio: iniciar desde el gesto del usuario.
    initMultiplayerMusicPlayer();
    ensureMultiplayerMusicPlaying();

    // Fullscreen solo puede activarse desde un gesto del usuario.
    requestFullscreen();

    state.playerCount = clampPlayerCount(state.playerCount);
    setupPlayers();
    var desiredCount = getDesiredQuestionCount();
    state.questions = [];
    state.rounds = [];
    document.body.classList.remove('mode-per-player');
    document.body.classList.remove('mode-shared');
    if(state.questionMode === 'per-player'){
      document.body.classList.add('mode-per-player');
      state.rounds = buildRounds(state.quizData.questions, state.playerCount, desiredCount);
    }else{
      document.body.classList.add('mode-shared');
      var randomized = randomizeQuestions(state.quizData.questions);
      if(desiredCount > 0 && desiredCount < randomized.length){
        state.questions = randomized.slice(0, desiredCount);
      }else{
        state.questions = randomized;
      }
    }
    state.idx = 0;
    state.phaseLocked = false;

    state.view = 'game';
    renderQuestion();
    scrollToBottom({ behavior: 'auto' });
  }

  function playSameQuestions(){
    if(!state.quizData) return;
    var hasShared = state.questionMode !== 'per-player' && Array.isArray(state.questions) && state.questions.length;
    var hasPerPlayer = state.questionMode === 'per-player' && Array.isArray(state.rounds) && state.rounds.length;
    if(!hasShared && !hasPerPlayer){
      startGame();
      return;
    }

    // Audio: iniciar desde el gesto del usuario.
    initMultiplayerMusicPlayer();
    ensureMultiplayerMusicPlaying();

    // Fullscreen solo puede activarse desde un gesto del usuario.
    requestFullscreen();

    state.playerCount = clampPlayerCount(state.playerCount);
    setupPlayers();
    state.phaseLocked = false;
    state.idx = 0;

    document.body.classList.remove('mode-per-player');
    document.body.classList.remove('mode-shared');
    if(state.questionMode === 'per-player'){
      document.body.classList.add('mode-per-player');
      state.rounds = state.rounds.map(function(round){
        var items = Array.isArray(round) ? round : [];
        return items.map(function(q){ return randomizeOneQuestion(q); });
      });
    }else{
      document.body.classList.add('mode-shared');
      state.questions = state.questions.map(function(q){ return randomizeOneQuestion(q); });
    }

    state.view = 'game';
    renderQuestion();
    scrollToBottom({ behavior: 'auto' });
  }

  function clampPlayerCount(n){
    var v = parseInt(n, 10);
    if(isNaN(v)) v = 2;
    if(v < 2) v = 2;
    if(v > 4) v = 4;
    return v;
  }

  function resetToCatalog(){
    stopTimer();
    state.currentQuizId = null;
    state.quizData = null;
    state.desiredQuestionCount = null;
    state.questionMode = 'shared';
    state.questions = [];
    state.rounds = [];
    state.idx = 0;
    state.view = 'none';
    state.questionCountInput = '';

    document.body.classList.remove('playing');
    document.body.classList.remove('preparing');
    exitFullscreen();
    document.body.classList.remove('mode-per-player');
    document.body.classList.remove('mode-shared');

    pauseMultiplayerMusic();
  }

  function bindEvents(){
    var backLink = document.querySelector('a.back-link');
    if(backLink){
      backLink.addEventListener('click', function(){
        exitFullscreen();
        pauseMultiplayerMusic();
      });
    }

    var langSelect = document.getElementById('lang-select');
    if(langSelect){
      langSelect.addEventListener('change', function(){ setLang(langSelect.value); });
    }
  }

  ensurePlayerNames();
  ensurePlayerIcons();

  // Tota la zona central (catàleg, configuració, partida, resultats i modal
  // de rànquing) és una app de Vue (Subfase B). Capçalera, música i peu
  // queden fora de l'arrel.
  var app = Vue.createApp({
    template: '#multiplayer-tpl',
    data: function(){
      return {
        lang: lang,
        loading: true,
        quizzes: [],
        page: 0,
        sortOrder: 'plays',
        search: '',
        filters: { tags: [], minQuestions: '', maxQuestions: '', onlyImage: false },
        tagFilterExpanded: false,
        favoriteIds: loadFavorites(),
        userRatings: loadUserRatings(),
        thumbLoaded: {},
        thumbFailed: {},
        s: state,
        icons: ICONS
      };
    },
    computed: {
      quizQuestionTotal: function(){
        return quizQuestionTotal();
      },
      roundCount: function(){
        return getRoundCount();
      },
      sortedPlayers: function(){
        return state.players.slice().sort(function(a, b){ return (b.score || 0) - (a.score || 0); });
      },
      // Es llig la llista "en cru" (toRaw) perquè marcar un favorit o
      // valorar un quiz no reordene el llistat a l'instant: com abans de
      // Vue, l'ordre només es refà en canviar filtres, cerca o ordre.
      allTags: function(){
        var map = {};
        Vue.toRaw(this.quizzes).forEach(function(q){
          (Array.isArray(q.tags) ? q.tags : []).forEach(function(tag){
            var clean = (tag || '').toString().trim();
            if(!clean) return;
            var key = clean.toLowerCase();
            if(!map[key]) map[key] = { tag: clean, count: 0 };
            map[key].count++;
          });
        });
        return Object.keys(map).map(function(k){ return map[k]; }).sort(function(a, b){
          if(b.count !== a.count) return b.count - a.count;
          return a.tag.localeCompare(b.tag);
        });
      },
      tagToggleLabel: function(){
        return this.tagFilterExpanded ? this.t('filterTagShowLess') : this.t('filterTagShowMore');
      },
      filteredQuizzes: function(){
        var searchVal = (this.search || '').toLowerCase();
        var tagsFilter = this.filters.tags.slice();
        var minQ = parseInt(this.filters.minQuestions, 10);
        var maxQ = parseInt(this.filters.maxQuestions, 10);
        var onlyImage = this.filters.onlyImage;
        var favorites = Vue.toRaw(this.favoriteIds);
        var list = Vue.toRaw(this.quizzes).filter(function(q){
          if(searchVal){
            var haystack = (q.name || '') + ' ' + (Array.isArray(q.tags) ? q.tags.join(' ') : '');
            if(!haystack.toLowerCase().includes(searchVal)) return false;
          }
          if(tagsFilter.length){
            var tags = Array.isArray(q.tags) ? q.tags : [];
            if(!tagsFilter.some(function(tag){ return tags.indexOf(tag) !== -1; })) return false;
          }
          var count = typeof q.questionsCount === 'number' ? q.questionsCount : 0;
          if(!Number.isNaN(minQ) && count < minQ) return false;
          if(!Number.isNaN(maxQ) && count > maxQ) return false;
          if(onlyImage && !q.coverImage) return false;
          return true;
        });
        var favs = list.filter(function(q){ return favorites.has(String(q.id)); });
        var rest = list.filter(function(q){ return !favorites.has(String(q.id)); });
        return sortPublicQuizzes(favs, this.sortOrder).concat(sortPublicQuizzes(rest, this.sortOrder));
      },
      totalPages: function(){
        return Math.max(1, Math.ceil(this.filteredQuizzes.length / PAGE_SIZE));
      },
      currentPage: function(){
        return Math.min(this.page, this.totalPages - 1);
      },
      pageItems: function(){
        var start = this.currentPage * PAGE_SIZE;
        return this.filteredQuizzes.slice(start, start + PAGE_SIZE).map(function(q){ return Vue.reactive(q); });
      }
    },
    methods: {
      t: function(key){
        this.lang;
        return t(key);
      },
      format: format,
      thumbUrl: function(q){
        return mediaThumb(q.coverImage || q.coverVideo) || '/icons/logo.svg';
      },
      cleanTags: function(q){
        return (Array.isArray(q.tags) ? q.tags : []).map(function(tag){ return (tag || '').toString().trim(); }).filter(Boolean);
      },
      pruneTags: function(){
        var existing = {};
        this.allTags.forEach(function(it){ existing[it.tag.toLowerCase()] = true; });
        this.filters.tags = this.filters.tags.filter(function(tag){
          return !!existing[(tag || '').toString().trim().toLowerCase()];
        });
      },
      selectAllTags: function(){
        this.filters.tags = this.allTags.map(function(it){ return it.tag; });
        this.tagFilterExpanded = true;
        this.page = 0;
      },
      clearTags: function(){
        this.filters.tags = [];
        this.page = 0;
      },
      isFavorite: function(id){
        return this.favoriteIds.has(String(id));
      },
      favoriteLabel: function(id){
        return this.isFavorite(id) ? this.t('favoriteRemove') : this.t('favoriteAdd');
      },
      toggleFavorite: function(id){
        var key = String(id);
        if(this.favoriteIds.has(key)){
          this.favoriteIds.delete(key);
        }else{
          this.favoriteIds.add(key);
        }
        saveFavorites(Vue.toRaw(this.favoriteIds));
      },
      displayRating: function(q){
        var own = this.userRatings[String(q.id)];
        if(own) return own;
        var avg = Number(q.ratingAvg);
        return Math.round(Number.isFinite(avg) ? avg : 0);
      },
      ratingSummary: function(q){
        var avg = Number(q.ratingAvg);
        if(!Number.isFinite(avg)) avg = 0;
        var count = Number(q.ratingCount);
        if(!Number.isFinite(count)) count = 0;
        return formatRatingSummary(avg, Math.max(0, Math.round(count)));
      },
      rate: function(q, rating){
        var self = this;
        var key = String(q.id);
        self.userRatings[key] = rating;
        saveUserRatings(Vue.toRaw(self.userRatings));
        fetch('/api/quizzes/' + encodeURIComponent(q.id) + '/rating', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: rating, deviceId: deviceId })
        })
          .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
          .then(function(payload){
            if(!payload.ok) return;
            var avg = Number(payload.body && payload.body.avg);
            var count = Number(payload.body && payload.body.count);
            q.ratingAvg = Number.isFinite(avg) ? avg : 0;
            q.ratingCount = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
            self.userRatings[key] = rating;
            saveUserRatings(Vue.toRaw(self.userRatings));
          })
          .catch(function(){});
      },
      selectQuiz: function(id){
        selectQuiz(id);
      },

      normalizePlayerTag: normalizePlayerTag,
      setPlayerCount: function(value){
        state.playerCount = clampPlayerCount(value);
      },
      // Com abans: el camp es reescriu al moment amb la versió normalitzada
      // (3 caràcters, majúscules, sense accents).
      onNameInput: function(idx, ev){
        var filtered = normalizePlayerTag(ev.target.value);
        if(ev.target.value !== filtered) ev.target.value = filtered;
        state.playerNames[idx] = filtered;
        saveStoredNames(Vue.toRaw(state.playerNames));
      },
      pickIcon: function(idx, icon){
        state.playerIcons[idx] = icon;
        saveStoredIcons(Vue.toRaw(state.playerIcons));
      },
      onQuestionCountChange: function(ev){
        if(!state.quizData) return;
        state.desiredQuestionCount = clampQuestionCount(ev.target.value, quizQuestionTotal());
        state.questionCountInput = state.desiredQuestionCount ? String(state.desiredQuestionCount) : '';
        ev.target.value = state.questionCountInput;
      },
      onQuestionTimeInput: function(ev){
        var el = ev.target;
        if(!el.value){
          state.desiredQuestionTime = null;
          state.questionTimeInput = '';
          return;
        }
        var v = parseInt(el.value, 10);
        if(isNaN(v)) return;
        if(v < 5) v = 5;
        if(v > 120) v = 120;
        el.value = String(v);
        state.questionTimeInput = String(v);
        state.desiredQuestionTime = v;
      },
      start: function(){
        startGame();
      },
      playSame: function(){
        playSameQuestions();
      },
      pickAnother: function(){
        resetToCatalog();
      },
      continueRound: function(){
        hideRoundRankingModalAndContinue();
      },

      answerClick: function(playerId, choice){
        handlePlayerAnswerClick(playerId, choice);
      },
      submitMulti: function(playerId){
        submitMultiAnswer(playerId);
      },
      questionTextFor: function(p){
        var q = getQuestionForPlayer(p.id);
        return (q && q.question) ? q.question : '';
      },
      mediaFor: function(p){
        var q = getQuestionForPlayer(p.id);
        return mediaInfo(q && q.image, q && q.video, false);
      },
      answersFor: function(p){
        var q = getQuestionForPlayer(p.id) || { answers: [] };
        return getVisibleAnswers(q, normalizeQuestionMeta(q).type);
      },
      showMultiSubmit: function(p){
        var q = getQuestionForPlayer(p.id);
        return !!q && normalizeQuestionMeta(q).type === 'multiple' && !p.multiSubmitted;
      },
      answerClass: function(p, n){
        var q = getQuestionForPlayer(p.id);
        var finals = p.selectedAnswers.length ? p.selectedAnswers : (p.choice !== null ? [p.choice] : []);
        var cls = {
          'multi-selected': !p.answered && p.multiSelections.indexOf(n) !== -1,
          selected: p.answered && finals.indexOf(n) !== -1
        };
        if(state.revealed && q){
          var correctList = Array.isArray(q.correctAnswers) && q.correctAnswers.length ? q.correctAnswers : [(parseInt(q.correct, 10) || 1)];
          cls.correct = correctList.indexOf(n) !== -1;
          cls.wrong = p.outcome === 'bad' && finals.indexOf(n) !== -1 && correctList.indexOf(n) === -1;
        }
        return cls;
      },
      feedbackFor: function(p){
        if(!state.revealed) return { text: '', cls: '' };
        if(p.outcome === 'ok') return { text: this.t('correctText'), cls: 'ok' };
        if(p.outcome === 'partial') return { text: this.t('partialText'), cls: 'partial' };
        if(p.outcome === 'bad') return { text: this.t('wrongText'), cls: 'bad' };
        if(p.outcome === 'timeout') return { text: this.t('timeup'), cls: 'muted' };
        return { text: '', cls: 'muted' };
      },
      rankingLine: function(p){
        return (p.icon ? p.icon + ' ' : '') + p.name + ' — ' + (p.score || 0);
      }
    }
  }).mount('#multiplayer-app');

  applyStaticText();
  bindEvents();
  initMultiplayerMusicPlayer();
  fetchPublicQuizzes();

  // Permite abrir directamente un quiz desde Create: /multiplayer/?id=<quizId>
  (function(){
    var id = null;
    try{
      var params = new URLSearchParams(window.location.search || '');
      id = params.get('id');
    }catch(e){}
    if(id){
      selectQuiz(id);
    }
  })();
})();
