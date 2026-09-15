// Multiplayer local (2-4 jugadores en la misma pantalla)
(function(){
  var state = {
    quizzes: [],
    page: 0,
    pageSize: 12,
    sortOrder: 'plays',
    filters: {
      tags: [],
      minQuestions: '',
      maxQuestions: '',
      onlyImage: false
    },
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
    favoriteIds: new Set()
  };

  var NAMES_KEY = 'multiplayerPlayerNames';
  var ICONS_KEY = 'multiplayerPlayerIcons';
  var FAVORITES_STORAGE_KEY = 'eduhoot-favorite-quizzes';
  var USER_RATING_STORAGE_KEY = 'eduhoot-user-ratings';
  var DEVICE_ID_STORAGE_KEY = 'eduhoot-device-id';
  var userRatings = {};
  var deviceId = '';

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

  function saveFavorites(){
    try{
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(state.favoriteIds)));
    }catch(e){}
  }

  function isFavorite(id){
    return state.favoriteIds && state.favoriteIds.has(String(id));
  }

  function toggleFavorite(id){
    var key = String(id);
    if(isFavorite(key)){
      state.favoriteIds.delete(key);
    }else{
      state.favoriteIds.add(key);
    }
    saveFavorites();
  }

  function updateFavoriteButton(btn, id){
    if(!btn) return;
    var active = isFavorite(id);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    var label = active ? t('favoriteRemove') : t('favoriteAdd');
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.textContent = active ? '❤' : '♡';
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

  function saveUserRatings(){
    try{
      localStorage.setItem(USER_RATING_STORAGE_KEY, JSON.stringify(userRatings));
    }catch(e){}
  }

  function getUserRating(id){
    return userRatings && userRatings[String(id)];
  }

  function setUserRating(id, rating){
    userRatings[String(id)] = rating;
    saveUserRatings();
  }

  function formatRatingSummary(avg, count){
    if(!count){
      return t('ratingEmpty');
    }
    return format(t('ratingSummary'), { avg: avg.toFixed(1), count: count });
  }

  function updateRatingStars(starsWrap, displayRating){
    if(!starsWrap) return;
    var buttons = starsWrap.querySelectorAll('button[data-value]');
    Array.prototype.forEach.call(buttons, function(btn){
      var value = parseInt(btn.getAttribute('data-value'), 10);
      btn.classList.toggle('is-filled', value <= displayRating);
    });
  }

  function submitRating(quizId, rating, summaryEl, starsWrap, quizRef){
    if(!deviceId) deviceId = getDeviceId();
    fetch('/api/quizzes/' + encodeURIComponent(quizId) + '/rating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: rating, deviceId: deviceId })
    })
      .then(function(res){ return res.json().then(function(body){ return { ok: res.ok, body: body }; }); })
      .then(function(payload){
        if(!payload.ok) return;
        var avg = Number(payload.body && payload.body.avg);
        if(!Number.isFinite(avg)) avg = 0;
        var count = Number(payload.body && payload.body.count);
        if(!Number.isFinite(count)) count = 0;
        count = Math.max(0, Math.round(count));
        if(quizRef){
          quizRef.ratingAvg = avg;
          quizRef.ratingCount = count;
        }
        setUserRating(quizId, rating);
        if(summaryEl) summaryEl.textContent = formatRatingSummary(avg, count);
        updateRatingStars(starsWrap, rating);
      })
      .catch(function(){});
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

  var roundRankingOpen = false;
  var roundRankingDelayMs = 1100;

  var LANG_KEYS = ['lang', 'lang-player', 'lang-host', 'edutictac-portal-lang', 'edutictac-lang'];
  function normalizeLang(raw){
    var value = String(raw || '').toLowerCase();
    if(value.indexOf('valencia') !== -1) return 'va';
    var base = value.split('-')[0];
    return ['ca','va','es','en'].indexOf(base) !== -1 ? base : '';
  }
  function getQueryLang(){
    try{ return normalizeLang(new URLSearchParams(window.location.search).get('lang')); }catch(e){ return ''; }
  }
  function getStoredLang(){
    for(var i = 0; i < LANG_KEYS.length; i++){
      try{
        var value = normalizeLang(localStorage.getItem(LANG_KEYS[i]));
        if(value) return value;
      }catch(e){}
    }
    return '';
  }
  function persistLang(value){
      try {
          var url = new URL(window.location.href);
          if (url.searchParams.has('lang')) {
              url.searchParams.set('lang', value);
              window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
          }
      } catch (e) {}
    for(var i = 0; i < LANG_KEYS.length; i++){
      try{ localStorage.setItem(LANG_KEYS[i], value); }catch(e){}
    }
  }
  var browserLang = normalizeLang(navigator.language || 'es');
  var lang = getQueryLang() || getStoredLang() || browserLang || 'es';
  persistLang(lang);

  var i18n = {
    es: {
      back: 'Volver',
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

  state.favoriteIds = loadFavorites();
  userRatings = loadUserRatings();
  deviceId = getDeviceId();

  function t(key){
    var chain = lang === 'va' ? ['va', 'ca', 'es'] : [lang, 'es'];
    for(var i = 0; i < chain.length; i++){
      var dict = i18n[chain[i]];
      if(dict && dict[key]) return dict[key];
    }
    return key;
  }

  function getPlayerPanel(playerId){
    var wrap = document.getElementById('players');
    if(!wrap) return null;
    return wrap.querySelector('.player-panel[data-player="' + playerId + '"]');
  }

  function updateMultiSubmitState(panel, player){
    if(!panel || !player) return;
    var multiSubmit = panel.querySelector('[data-multi-submit]');
    if(!multiSubmit) return;
    var hasSelection = Array.isArray(player.multiSelections) && player.multiSelections.length > 0;
    multiSubmit.disabled = !hasSelection;
    multiSubmit.classList.toggle('has-selection', hasSelection);
  }

  function togglePlayerMultiSelection(playerId, choice){
    if(state.phaseLocked) return;
    var q = getQuestionForPlayer(playerId);
    if(!q || normalizeQuestionMeta(q).type !== 'multiple') return;
    var player = state.players[playerId];
    if(!player || player.answered) return;
    var panel = getPlayerPanel(playerId);
    if(!panel) return;
    var answersWrap = panel.querySelector('[data-answers]');
    if(!answersWrap) return;
    var btn = answersWrap.querySelector('[data-answer="' + choice + '"]');
    if(!btn) return;
    var selections = Array.isArray(player.multiSelections) ? player.multiSelections.slice() : [];
    var existingIdx = selections.indexOf(choice);
    if(existingIdx === -1){
      selections.push(choice);
    }else{
      selections.splice(existingIdx, 1);
    }
    player.multiSelections = selections;
    btn.classList.toggle('multi-selected', existingIdx === -1);
    updateMultiSubmitState(panel, player);
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
    var selections = Array.isArray(player.multiSelections) ? player.multiSelections.slice() : [];
    if(!selections.length) return;
    var normalizedSelections = selections.slice().sort(function(a, b){ return a - b; });
    player.selectedAnswers = normalizedSelections;
    player.choice = null;
    player.multiSelections = normalizedSelections.slice();
    player.answered = true;
    player.outcome = areAnswerSetsEqual(normalizedSelections, meta.correctAnswers) ? 'ok' : 'bad';
    if(player.outcome === 'ok'){
      player.correct += 1;
      var bonus = Math.max(100, Math.round(1000 * (state.timerLeft / state.timerTotal)));
      player.score += bonus;
    }
    var panel = getPlayerPanel(playerId);
    if(panel){
      var multiSubmit = panel.querySelector('[data-multi-submit]');
      if(multiSubmit){
        multiSubmit.classList.add('hidden');
      }
    }
    lockPlayerSelection(playerId);
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

  function getAllTagsFromQuizzes(){
    var map = {};
    state.quizzes.forEach(function(q){
      var list = Array.isArray(q.tags) ? q.tags : [];
      list.forEach(function(tag){
        var clean = (tag || '').toString().trim();
        if(!clean) return;
        var key = clean.toLowerCase();
        if(!map[key]) map[key] = { tag: clean, count: 0 };
        map[key].count++;
      });
    });
    var items = Object.keys(map).map(function(k){ return map[k]; });
    items.sort(function(a, b){
      if(b.count !== a.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });
    return items;
  }

  var tagFilterExpanded = false;

  function ensureTagToggleButton(total){
    var clearBtn = document.getElementById('tags-clear');
    if(!clearBtn || !clearBtn.parentElement) return;
    var actions = clearBtn.parentElement;
    var btn = document.getElementById('tags-toggle');
    if(!btn){
      btn = document.createElement('button');
      btn.id = 'tags-toggle';
      btn.type = 'button';
      btn.className = 'tag-filter__btn is-icon';
      btn.setAttribute('aria-label', t('filterTagShowMore'));
      btn.innerHTML = '<span class="tag-filter__icon" aria-hidden="true">▾</span><span class="sr-only"></span>';
      btn.addEventListener('click', function(){
        tagFilterExpanded = !tagFilterExpanded;
        updateTagFilterOptions();
      });
      actions.insertBefore(btn, clearBtn);
    }
    var label = tagFilterExpanded ? t('filterTagShowLess') : t('filterTagShowMore');
    var icon = tagFilterExpanded ? '▴' : '▾';
    btn.setAttribute('aria-label', label);
    var iconEl = btn.querySelector('.tag-filter__icon');
    if(iconEl) iconEl.textContent = icon;
    var sr = btn.querySelector('.sr-only');
    if(sr) sr.textContent = label;
    btn.style.display = total > 0 ? '' : 'none';
  }

  function getVisibleTagItems(allItems){
    return tagFilterExpanded ? allItems : [];
  }

  function updateTagFilterOptions(){
    var wrap = document.getElementById('tag-filter');
    if(!wrap) return;
    var allItems = getAllTagsFromQuizzes();
    var allKeys = {};
    allItems.forEach(function(it){ allKeys[it.tag.toLowerCase()] = true; });
    wrap.innerHTML = '';
    state.filters.tags = state.filters.tags.filter(function(tag){
      var key = (tag || '').toString().trim().toLowerCase();
      return !!allKeys[key];
    });

    ensureTagToggleButton(allItems.length);
    if(!tagFilterExpanded) return;
    var items = getVisibleTagItems(allItems);

    items.forEach(function(item){
      var tag = item.tag;
      var label = document.createElement('label');
      label.className = 'tag-filter__item';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.value = tag;
      input.checked = state.filters.tags.indexOf(tag) !== -1;
      input.addEventListener('change', function(){
        var selected = [];
        var inputs = wrap.querySelectorAll('input[type="checkbox"]');
        Array.prototype.forEach.call(inputs, function(el){
          if(el.checked) selected.push(el.value);
        });
        state.filters.tags = selected;
        state.page = 0;
        renderList();
      });
      var span = document.createElement('span');
      span.textContent = tag;
      label.appendChild(input);
      label.appendChild(span);
      wrap.appendChild(label);
    });
  }

  function renderRoundRanking(){
    var list = document.getElementById('round-ranking-list');
    if(!list) return;
    list.innerHTML = '';
    var sorted = state.players.slice().sort(function(a, b){
      var sa = (a && a.score) || 0;
      var sb = (b && b.score) || 0;
      return sb - sa;
    });
    sorted.forEach(function(p, idx){
      var li = document.createElement('li');
      var icon = p && p.icon ? (p.icon + ' ') : '';
      li.textContent = icon + p.name + ' — ' + ((p && p.score) || 0);
      list.appendChild(li);
    });
  }

  function showRoundRankingModal(){
    var modal = document.getElementById('round-ranking-modal');
    if(!modal) return;
    renderRoundRanking();
    roundRankingOpen = true;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }

  function hideRoundRankingModalAndContinue(){
    var modal = document.getElementById('round-ranking-modal');
    if(modal){
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
    }
    if(!roundRankingOpen) return;
    roundRankingOpen = false;
    nextQuestion();
  }

  function setLang(newLang){
    lang = newLang;
    persistLang(lang);
    applyStaticText();
    updateTagFilterOptions();
    renderList();
    renderSelected();
    renderPlayerNameInputs();
    renderPlayers();
    renderQuestionHeader();
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

  function defaultPlayerName(n){
    return format(t('player'), { n: n });
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

  function renderPlayerNameInputs(){
    ensurePlayerNames();
    ensurePlayerIcons();
    var wrap = document.getElementById('player-names');
    if(!wrap) return;
    wrap.innerHTML = '';

    for(var i = 0; i < state.playerCount; i++){
      var field = document.createElement('div');
      field.className = 'player-name-field';

      var label = document.createElement('label');
      label.setAttribute('for', 'player-name-' + i);
      label.textContent = defaultPlayerName(i + 1);

      var input = document.createElement('input');
      input.id = 'player-name-' + i;
      input.type = 'text';
      input.autocomplete = 'off';
      input.maxLength = 3;
      input.setAttribute('pattern', '[A-Za-z0-9]{1,3}');
      input.value = normalizePlayerTag(state.playerNames[i] || '');
      input.placeholder = 'AAA';
      input.addEventListener('input', (function(idx){
        return function(){
          ensurePlayerNames();
          var filtered = normalizePlayerTag(this.value);
          if(this.value !== filtered){
            this.value = filtered;
          }
          state.playerNames[idx] = filtered;
          saveStoredNames(state.playerNames);
        };
      })(i));

      var iconLabel = document.createElement('div');
      iconLabel.className = 'player-icon-label';
      iconLabel.textContent = t('iconLabel');

      var picker = document.createElement('div');
      picker.className = 'mp-icon-picker';
      picker.setAttribute('role', 'group');
      picker.setAttribute('aria-label', t('iconLabel'));

      ICONS.forEach(function(icon){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mp-icon-btn';
        btn.textContent = icon;
        btn.setAttribute('data-icon', icon);
        var isSelected = state.playerIcons[i] === icon;
        btn.classList.toggle('selected', isSelected);
        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        btn.addEventListener('click', (function(playerIdx, iconValue, pickerEl){
          return function(){
            ensurePlayerIcons();
            state.playerIcons[playerIdx] = iconValue;
            saveStoredIcons(state.playerIcons);
            try{
              pickerEl.querySelectorAll('button[data-icon]').forEach(function(b){
                var sel = b.getAttribute('data-icon') === iconValue;
                b.classList.toggle('selected', sel);
                b.setAttribute('aria-pressed', sel ? 'true' : 'false');
              });
            }catch(e){}
          };
        })(i, icon, picker));
        picker.appendChild(btn);
      });

      field.appendChild(label);
      field.appendChild(input);
      field.appendChild(iconLabel);
      field.appendChild(picker);
      wrap.appendChild(field);
    }
  }

  function mediaThumb(data){
    if(!data) return '';
    var yt = parseYouTubeId(data);
    if(yt) return 'https://img.youtube.com/vi/' + yt + '/hqdefault.jpg';
    return data;
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

  function setMedia(imageUrl, videoUrl){
    var wrap = document.getElementById('question-media');
    var img = document.getElementById('question-image');
    var vid = document.getElementById('question-video');
    var iframe = document.getElementById('question-iframe');
    if(!wrap || !img || !vid || !iframe) return;

    wrap.classList.add('hidden');
    img.style.display = 'none';
    vid.style.display = 'none';
    iframe.style.display = 'none';
    img.removeAttribute('src');
    vid.removeAttribute('src');
    iframe.removeAttribute('src');

    var hasMedia = false;
    if(imageUrl){
      img.src = normalizeSvgDataUrlForImg(imageUrl);
      img.style.display = 'block';
      hasMedia = true;
    }
    var ytId = parseYouTubeId(videoUrl);
    if(ytId){
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + ytId;
      iframe.style.display = 'block';
      hasMedia = true;
    }else if(videoUrl){
      vid.src = videoUrl;
      vid.style.display = 'block';
      hasMedia = true;
    }

    if(hasMedia) wrap.classList.remove('hidden');
  }

  function fetchPublicQuizzes(){
    var empty = document.getElementById('public-empty');
    if(empty) empty.textContent = '…';
    fetch('/api/public-quizzes?mode=multiplayer')
      .then(function(res){ return res.json(); })
      .then(function(data){
        state.quizzes = shuffleArray(Array.isArray(data) ? data : []);
        state.page = 0;
        updateTagFilterOptions();
        renderList();
      })
      .catch(function(){
        var list = document.getElementById('public-list');
        if(list) list.innerHTML = '';
        if(empty) empty.textContent = '';
      });
  }

  function sortPublicQuizzes(list){
    if(!Array.isArray(list)) return list;
    return list.slice().sort(function(a, b){
      if(state.sortOrder === 'recent'){
        var ta = Date.parse(a && (a.createdAt || a.updatedAt)) || 0;
        var tb = Date.parse(b && (b.createdAt || b.updatedAt)) || 0;
        if(ta === tb) return Math.random() - 0.5;
        return tb - ta;
      }
      if(state.sortOrder === 'alpha'){
        var na = (a && a.name ? a.name : '').toLowerCase();
        var nb = (b && b.name ? b.name : '').toLowerCase();
        return na.localeCompare(nb);
      }
      if(state.sortOrder === 'alpha-desc'){
        var nda = (a && a.name ? a.name : '').toLowerCase();
        var ndb = (b && b.name ? b.name : '').toLowerCase();
        return ndb.localeCompare(nda);
      }
      var pa = a && typeof a.playsCount === 'number' ? a.playsCount : 0;
      var pb = b && typeof b.playsCount === 'number' ? b.playsCount : 0;
      if(state.sortOrder === 'least'){
        if(pa === pb) return Math.random() - 0.5;
        return pa - pb;
      }
      if(pa === pb) return Math.random() - 0.5;
      return pb - pa;
    });
  }

  function renderPagination(totalFiltered){
    var controls = document.getElementById('public-pagination');
    if(!controls) return;
    controls.innerHTML = '';
    var totalPages = Math.max(1, Math.ceil(totalFiltered / state.pageSize));
    if(totalPages <= 1){
      controls.classList.add('hidden');
      return;
    }
    controls.classList.remove('hidden');

    var prev = document.createElement('button');
    prev.textContent = '<';
    prev.disabled = state.page === 0;
    prev.onclick = function(){
      if(state.page > 0){
        state.page -= 1;
        renderList();
      }
    };

    var info = document.createElement('span');
    info.textContent = (state.page + 1) + ' / ' + totalPages;

    var next = document.createElement('button');
    next.textContent = '>';
    next.disabled = state.page >= totalPages - 1;
    next.onclick = function(){
      if(state.page < totalPages - 1){
        state.page += 1;
        renderList();
      }
    };

    controls.appendChild(prev);
    controls.appendChild(info);
    controls.appendChild(next);
  }

  function renderList(){
    var list = document.getElementById('public-list');
    var empty = document.getElementById('public-empty');
    if(!list) return;

    list.innerHTML = '';
    var searchVal = ((document.getElementById('search') && document.getElementById('search').value) || '').toLowerCase();
    var minQ = parseInt(state.filters.minQuestions, 10);
    var maxQ = parseInt(state.filters.maxQuestions, 10);
    if(Number.isNaN(minQ)) minQ = null;
    if(Number.isNaN(maxQ)) maxQ = null;
    var filtered = state.quizzes.filter(function(q){
      if(!searchVal) return true;
      var haystack = (q.name || '') + ' ' + (Array.isArray(q.tags) ? q.tags.join(' ') : '');
      return haystack.toLowerCase().includes(searchVal);
    });
    if(state.filters.tags.length){
      filtered = filtered.filter(function(q){
        var tags = Array.isArray(q.tags) ? q.tags : [];
        return state.filters.tags.some(function(tag){ return tags.indexOf(tag) !== -1; });
      });
    }
    if(minQ !== null){
      filtered = filtered.filter(function(q){
        var count = typeof q.questionsCount === 'number' ? q.questionsCount : 0;
        return count >= minQ;
      });
    }
    if(maxQ !== null){
      filtered = filtered.filter(function(q){
        var count = typeof q.questionsCount === 'number' ? q.questionsCount : 0;
        return count <= maxQ;
      });
    }
    if(state.filters.onlyImage){
      filtered = filtered.filter(function(q){
        return !!(q.coverImage);
      });
    }

    if(filtered.length === 0){
      if(empty) empty.textContent = '';
      renderPagination(0);
      return;
    }
    if(empty) empty.textContent = '';

    var favorites = [];
    var nonFavorites = [];
    filtered.forEach(function(q){
      if(isFavorite(q.id)){
        favorites.push(q);
      }else{
        nonFavorites.push(q);
      }
    });
    favorites = sortPublicQuizzes(favorites);
    nonFavorites = sortPublicQuizzes(nonFavorites);
    filtered = favorites.concat(nonFavorites);
    var totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    if(state.page >= totalPages) state.page = totalPages - 1;
    var start = state.page * state.pageSize;
    var pageItems = filtered.slice(start, start + state.pageSize);

    pageItems.forEach(function(q){
      var card = document.createElement('div');
      card.className = 'card';

      var header = document.createElement('div');
      header.className = 'card-header';
      var title = document.createElement('h3');
      title.textContent = q.name || 'Quiz';
      var favBtn = document.createElement('button');
      favBtn.type = 'button';
      favBtn.className = 'favorite-btn';
      favBtn.addEventListener('click', function(ev){
        ev.stopPropagation();
        toggleFavorite(q.id);
        updateFavoriteButton(favBtn, q.id);
      });
      updateFavoriteButton(favBtn, q.id);
      header.appendChild(title);
      header.appendChild(favBtn);

      var meta = document.createElement('p');
      meta.className = 'muted';
      meta.textContent = format(t('questionsLabel'), { count: q.questionsCount || 0 });

      var tagsWrap = document.createElement('div');
      if(Array.isArray(q.tags)){
        q.tags.forEach(function(tag){
          var clean = (tag || '').toString().trim();
          if(!clean) return;
          var el = document.createElement('span');
          el.className = 'tag';
          el.textContent = clean;
          tagsWrap.appendChild(el);
        });
      }

      var ratingWrap = document.createElement('div');
      ratingWrap.className = 'card-rating';
      var ratingStars = document.createElement('div');
      ratingStars.className = 'rating-stars';
      for(var i = 1; i <= 5; i++){
        (function(stars){
          var starBtn = document.createElement('button');
          starBtn.type = 'button';
          starBtn.className = 'rating-star';
          starBtn.setAttribute('data-value', String(stars));
          starBtn.textContent = '★';
          var label = format(t('ratingStarLabel'), { stars: stars });
          starBtn.setAttribute('aria-label', label);
          starBtn.title = label;
          starBtn.addEventListener('click', function(ev){
            ev.stopPropagation();
            updateRatingStars(ratingStars, stars);
            setUserRating(q.id, stars);
            submitRating(q.id, stars, ratingSummary, ratingStars, q);
          });
          ratingStars.appendChild(starBtn);
        })(i);
      }
      var ratingSummary = document.createElement('span');
      ratingSummary.className = 'rating-summary muted';
      var avg = Number(q && q.ratingAvg);
      if(!Number.isFinite(avg)) avg = 0;
      var count = Number(q && q.ratingCount);
      if(!Number.isFinite(count)) count = 0;
      count = Math.max(0, Math.round(count));
      ratingSummary.textContent = formatRatingSummary(avg, count);
      var userRating = getUserRating(q.id);
      var displayRating = userRating ? userRating : Math.round(avg || 0);
      updateRatingStars(ratingStars, displayRating);
      ratingWrap.appendChild(ratingStars);
      ratingWrap.appendChild(ratingSummary);

      var stats = document.createElement('p');
      stats.className = 'muted';
      var plays = q.playsCount || 0;
      var players = q.playersCount || 0;
      stats.textContent = plays + ' ' + t('playsShort') + ' · ' + players + ' ' + t('playersShort');

      var thumb = document.createElement('div');
      thumb.className = 'card-thumb placeholder';
      var img = document.createElement('img');
      img.alt = '';
      var thumbUrl = mediaThumb(q.coverImage || q.coverVideo);
      if(thumbUrl){
        img.onload = function(){ thumb.classList.add('has-media'); thumb.classList.remove('placeholder'); };
        img.onerror = function(){ img.removeAttribute('src'); };
        img.src = thumbUrl;
      } else {
        img.onload = function(){ thumb.classList.add('has-media'); thumb.classList.remove('placeholder'); };
        img.src = '/icons/logo.svg';
      }
      thumb.appendChild(img);

      var btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.type = 'button';
      btn.textContent = t('selectQuiz');
      btn.onclick = function(){ selectQuiz(q.id); };

      card.appendChild(thumb);
      card.appendChild(header);
      card.appendChild(meta);
      card.appendChild(tagsWrap);
      card.appendChild(ratingWrap);
      card.appendChild(stats);
      card.appendChild(btn);
      list.appendChild(card);
    });

    renderPagination(filtered.length);
  }

  function renderSelected(){
    var title = document.getElementById('selected-title');
    var meta = document.getElementById('selected-meta');
    var setup = document.getElementById('setup');
    var gamePanel = document.getElementById('game-panel');
    var qCountInput = document.getElementById('question-count');
    var qCountTotal = document.getElementById('question-count-total');
    var qModeSelect = document.getElementById('question-mode');
    var qTimeInput = document.getElementById('question-time');

    if(!state.quizData){
      if(gamePanel) gamePanel.classList.add('hidden');
      if(title) title.textContent = t('gameTitle');
      if(meta) meta.textContent = t('startSelect');
      if(setup) setup.classList.add('hidden');
      if(qCountInput){
        qCountInput.value = '';
        qCountInput.removeAttribute('max');
      }
      if(qCountTotal) qCountTotal.textContent = '';
      if(qTimeInput){
        qTimeInput.value = state.desiredQuestionTime == null ? '' : String(state.desiredQuestionTime);
      }
      if(qModeSelect) qModeSelect.value = state.questionMode || 'shared';
      return;
    }

    if(gamePanel) gamePanel.classList.remove('hidden');

    if(title) title.textContent = state.quizData.name || t('gameTitle');
    if(meta) meta.textContent = format(t('questionsLabel'), { count: Array.isArray(state.quizData.questions) ? state.quizData.questions.length : 0 });
    if(setup) setup.classList.remove('hidden');

    // Sincroniza el selector de nº preguntas (por defecto: máximo).
    var total = Array.isArray(state.quizData.questions) ? state.quizData.questions.length : 0;
    if(qCountInput){
      qCountInput.min = '1';
      if(total > 0) qCountInput.max = String(total);
      if(!state.desiredQuestionCount){
        state.desiredQuestionCount = total;
      }
      var desired = clampQuestionCount(state.desiredQuestionCount, total);
      state.desiredQuestionCount = desired;
      qCountInput.value = desired ? String(desired) : '';
    }
    if(qCountTotal){
      qCountTotal.textContent = total ? format(t('questionCountTotal'), { total: total }) : '';
    }

    if(qTimeInput){
      qTimeInput.value = state.desiredQuestionTime == null ? '' : String(state.desiredQuestionTime);
    }

    if(qModeSelect){
      qModeSelect.value = state.questionMode || 'shared';
    }
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
    var input = document.getElementById('question-count');
    var total = Array.isArray(state.quizData && state.quizData.questions) ? state.quizData.questions.length : 0;
    if(!input) return clampQuestionCount(state.desiredQuestionCount, total);
    var v = parseInt(input.value, 10);
    v = clampQuestionCount(v, total);
    state.desiredQuestionCount = v;
    input.value = v ? String(v) : '';
    return v;
  }

  function selectQuiz(id){
    state.currentQuizId = id;
    state.quizData = null;
    renderSelected();

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
          renderSelected();
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
        renderSelected();
      })
      .catch(function(){
        state.quizData = null;
        document.body.classList.remove('playing');
        document.body.classList.remove('preparing');
        renderSelected();
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
        selectedAnswers: []
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

  function setPlayerMedia(panel, imageUrl, videoUrl){
    if(!panel) return;
    var wrap = panel.querySelector('[data-player-media]');
    var img = panel.querySelector('[data-player-image]');
    var vid = panel.querySelector('[data-player-video]');
    var iframe = panel.querySelector('[data-player-iframe]');
    if(!wrap || !img || !vid || !iframe) return;

    wrap.classList.add('hidden');
    img.style.display = 'none';
    vid.style.display = 'none';
    iframe.style.display = 'none';
    img.removeAttribute('src');
    vid.removeAttribute('src');
    iframe.removeAttribute('src');

    var hasMedia = false;
    if(imageUrl){
      img.src = imageUrl;
      img.style.display = 'block';
      hasMedia = true;
    }
    var ytId = parseYouTubeId(videoUrl);
    if(ytId){
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + ytId;
      iframe.style.display = 'block';
      hasMedia = true;
    }else if(videoUrl){
      vid.src = videoUrl;
      vid.style.display = 'block';
      hasMedia = true;
    }
    if(hasMedia) wrap.classList.remove('hidden');
  }

  function renderPlayers(){
    var wrap = document.getElementById('players');
    if(!wrap) return;
    wrap.innerHTML = '';

    wrap.className = 'players players-' + state.playerCount;

    state.players.forEach(function(p){
      var panel = document.createElement('section');
      panel.className = 'player-panel';
      panel.setAttribute('data-player', String(p.id));

      var header = document.createElement('div');
      header.className = 'player-header';

      var name = document.createElement('div');
      name.className = 'player-name';
      var iconSpan = document.createElement('span');
      iconSpan.className = 'player-icon';
      iconSpan.textContent = p.icon || '';
      var nameSpan = document.createElement('span');
      nameSpan.className = 'player-name-text';
      nameSpan.textContent = p.name;
      name.appendChild(iconSpan);
      name.appendChild(nameSpan);

      var score = document.createElement('div');
      score.className = 'player-score';
      score.textContent = t('score') + ': ' + p.score;
      score.setAttribute('data-score', '1');

      header.appendChild(name);
      header.appendChild(score);

      var feedback = document.createElement('div');
      feedback.className = 'player-feedback';
      feedback.setAttribute('data-feedback', '1');

      // Siempre mostramos la pregunta dentro de cada panel para que sea visible sin depender del scroll.
      var qCard = document.createElement('div');
      qCard.className = 'player-question-card';

      var qText = document.createElement('p');
      qText.className = 'question-text';
      qText.setAttribute('data-player-question', '1');

      var media = document.createElement('div');
      media.className = 'question-media hidden';
      media.setAttribute('data-player-media', '1');

      var img = document.createElement('img');
      img.alt = '';
      img.setAttribute('data-player-image', '1');

      var vid = document.createElement('video');
      vid.setAttribute('controls', '');
      vid.setAttribute('playsinline', '');
      vid.setAttribute('data-player-video', '1');

      var iframe = document.createElement('iframe');
      iframe.title = 'video';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('data-player-iframe', '1');

      media.appendChild(img);
      media.appendChild(vid);
      media.appendChild(iframe);

      qCard.appendChild(qText);
      qCard.appendChild(media);
      panel.appendChild(qCard);

      var answers = document.createElement('div');
      answers.className = 'answers';
      answers.setAttribute('data-answers', '1');

      panel.appendChild(header);
      panel.appendChild(feedback);
      panel.appendChild(answers);
      var multiSubmit = document.createElement('button');
      multiSubmit.type = 'button';
      multiSubmit.className = 'btn multi-submit hidden';
      multiSubmit.setAttribute('data-multi-submit', '1');
      multiSubmit.textContent = t('submitAnswers');
      multiSubmit.addEventListener('click', function(){ submitMultiAnswer(p.id); });
      panel.appendChild(multiSubmit);
      wrap.appendChild(panel);
    });

    scrollToBottom({ behavior: 'auto' });
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

  function updatePlayerPanelsForQuestion(q){
    var wrap = document.getElementById('players');
    if(!wrap) return;

    state.players.forEach(function(p){
      p.answered = false;
      p.choice = null;
      p.outcome = null;
      p.multiSelections = [];
      p.selectedAnswers = [];

      var panel = wrap.querySelector('.player-panel[data-player="' + p.id + '"]');
      if(!panel) return;

      var scoreEl = panel.querySelector('[data-score]');
      if(scoreEl) scoreEl.textContent = t('score') + ': ' + p.score;

      var feedbackEl = panel.querySelector('[data-feedback]');
      if(feedbackEl){
        feedbackEl.textContent = '';
        feedbackEl.classList.remove('ok', 'bad', 'muted');
      }

      var pq = getQuestionForPlayer(p.id);
      var qTextEl = panel.querySelector('[data-player-question]');
      if(qTextEl) qTextEl.textContent = (pq && pq.question) ? pq.question : '';
      setPlayerMedia(panel, pq && pq.image, pq && pq.video);

      var answersWrap = panel.querySelector('[data-answers]');
      if(!answersWrap) return;
      answersWrap.innerHTML = '';

      var qForPanel = getQuestionForPlayer(p.id) || q;
      var meta = normalizeQuestionMeta(qForPanel);
      var answersToShow = getVisibleAnswers(qForPanel, meta.type);
      answersToShow.forEach(function(ans, idx){
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'answer';
        btn.textContent = ans || ('A' + (idx + 1));
        btn.setAttribute('data-answer', String(idx + 1));
        btn.addEventListener('click', function(){ handlePlayerAnswerClick(p.id, idx + 1); });
        answersWrap.appendChild(btn);
      });

      var multiSubmit = panel.querySelector('[data-multi-submit]');
      if(multiSubmit){
        if(meta.type === 'multiple'){
          multiSubmit.classList.remove('hidden');
          multiSubmit.disabled = true;
          multiSubmit.classList.remove('has-selection');
        }else{
          multiSubmit.classList.add('hidden');
        }
      }
    });
  }

  function renderQuestionHeader(){
    var progress = document.getElementById('question-progress');
    if(progress){
      var current = state.idx + 1;
      var total = getRoundCount();
      progress.textContent = format(t('questionOf'), { current: current, total: total });
    }
    var timerEl = document.getElementById('timer-pill');
    if(timerEl){
      timerEl.textContent = t('timer') + ': ' + Math.ceil(state.timerLeft) + 's';
    }
  }

  function startTimer(seconds){
    state.timerTotal = Math.max(5, Math.min(120, seconds));
    state.timerLeft = state.timerTotal;
    renderQuestionHeader();
    if(state.timer) clearInterval(state.timer);

    state.timer = setInterval(function(){
      state.timerLeft = Math.max(0, state.timerLeft - 0.1);
      renderQuestionHeader();
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

  function lockPlayerSelection(playerId){
    var wrap = document.getElementById('players');
    if(!wrap) return;
    var panel = wrap.querySelector('.player-panel[data-player="' + playerId + '"]');
    if(!panel) return;

    var answersWrap = panel.querySelector('[data-answers]');
    if(!answersWrap) return;
    var player = state.players[playerId];
    var finalSelections = [];
    if(player){
      if(Array.isArray(player.selectedAnswers) && player.selectedAnswers.length){
        finalSelections = player.selectedAnswers.slice();
      }else if(player.choice !== null){
        finalSelections = [player.choice];
      }
    }
    Array.prototype.slice.call(answersWrap.children).forEach(function(btn, idx){
      btn.disabled = true;
      btn.classList.remove('multi-selected');
      var n = idx + 1;
      if(finalSelections.indexOf(n) !== -1){
        btn.classList.add('selected');
      }
    });
  }

  function revealRound(){
    var wrap = document.getElementById('players');
    if(!wrap) return;

    state.players.forEach(function(p){
      var q = getQuestionForPlayer(p.id);
      if(!q) return;

      var panel = wrap.querySelector('.player-panel[data-player="' + p.id + '"]');
      if(!panel) return;

      var scoreEl = panel.querySelector('[data-score]');
      if(scoreEl) scoreEl.textContent = t('score') + ': ' + p.score;

      var feedbackEl = panel.querySelector('[data-feedback]');
      if(feedbackEl){
        feedbackEl.classList.remove('ok', 'bad', 'muted');
        if(p.outcome === 'ok'){
          feedbackEl.textContent = t('correctText');
          feedbackEl.classList.add('ok');
        }else if(p.outcome === 'bad'){
          feedbackEl.textContent = t('wrongText');
          feedbackEl.classList.add('bad');
        }else if(p.outcome === 'timeout'){
          feedbackEl.textContent = t('timeup');
          feedbackEl.classList.add('muted');
        }else{
          feedbackEl.textContent = '';
          feedbackEl.classList.add('muted');
        }
      }

      var answersWrap = panel.querySelector('[data-answers]');
      if(!answersWrap) return;
      var correctList = Array.isArray(q.correctAnswers) && q.correctAnswers.length ? q.correctAnswers : [(parseInt(q.correct, 10) || 1)];
      var playerSelections = Array.isArray(p.selectedAnswers) && p.selectedAnswers.length ? p.selectedAnswers : (p.choice !== null ? [p.choice] : []);
      Array.prototype.slice.call(answersWrap.children).forEach(function(btn, idx){
        var n = idx + 1;
        btn.disabled = true;
        if(correctList.indexOf(n) !== -1){
          btn.classList.add('correct');
        }
        if(playerSelections.indexOf(n) !== -1 && p.outcome === 'bad' && correctList.indexOf(n) === -1){
          btn.classList.add('wrong');
        }
      });
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

    // No revelamos correcto/incorrecto aquí. Solo bloqueamos la selección.
    lockPlayerSelection(playerId);

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
      var questionEl = document.getElementById('question-text');
      if(questionEl) questionEl.textContent = '';
      setMedia(null, null);

      // Para el timer compartido, usa el mayor tiempo de las preguntas de esta ronda.
      var round = state.rounds[state.idx] || [];
      var maxTime = 20;
      round.forEach(function(qp){
        var tVal = (typeof qp.time === 'number' && qp.time > 0) ? qp.time : 0;
        if(tVal > maxTime) maxTime = tVal;
      });
      updatePlayerPanelsForQuestion({ answers: [] });
      startTimer(forcedTime || maxTime);
      scrollToBottom({ behavior: 'auto' });
      return;
    }

    var q = state.questions[state.idx];
    var questionElShared = document.getElementById('question-text');
    if(questionElShared) questionElShared.textContent = q.question || '';
    setMedia(q.image, q.video);

    updatePlayerPanelsForQuestion(q);

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

    var game = document.getElementById('game');
    var results = document.getElementById('results');
    if(game) game.classList.add('hidden');
    if(results) results.classList.remove('hidden');

    var list = document.getElementById('ranking-list');
    if(list){
      list.innerHTML = '';
      var sorted = state.players.slice().sort(function(a, b){ return (b.score || 0) - (a.score || 0); });
      sorted.forEach(function(p, idx){
        var li = document.createElement('li');
        var icon = p && p.icon ? (p.icon + ' ') : '';
        li.textContent = icon + p.name + ' — ' + (p.score || 0);
        list.appendChild(li);
      });
    }
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

    renderPlayers();

    var setup = document.getElementById('setup');
    var game = document.getElementById('game');
    var results = document.getElementById('results');
    if(setup) setup.classList.add('hidden');
    if(results) results.classList.add('hidden');
    if(game) game.classList.remove('hidden');

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

    renderPlayers();

    var setup = document.getElementById('setup');
    var game = document.getElementById('game');
    var results = document.getElementById('results');
    if(setup) setup.classList.add('hidden');
    if(results) results.classList.add('hidden');
    if(game) game.classList.remove('hidden');

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

    document.body.classList.remove('playing');
    document.body.classList.remove('preparing');
    exitFullscreen();
    document.body.classList.remove('mode-per-player');
    document.body.classList.remove('mode-shared');

    pauseMultiplayerMusic();

    var setup = document.getElementById('setup');
    var game = document.getElementById('game');
    var results = document.getElementById('results');
    if(setup) setup.classList.add('hidden');
    if(game) game.classList.add('hidden');
    if(results) results.classList.add('hidden');

    renderSelected();
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

    var search = document.getElementById('search');
    if(search){
      search.addEventListener('input', function(){ state.page = 0; renderList(); });
    }
    var sortSelect = document.getElementById('sort');
    if(sortSelect){
      sortSelect.value = state.sortOrder;
      sortSelect.addEventListener('change', function(){
        state.sortOrder = sortSelect.value;
        state.page = 0;
        renderList();
      });
    }
    var tagsSelectAll = document.getElementById('tags-select-all');
    if(tagsSelectAll){
      tagsSelectAll.addEventListener('click', function(){
        // Selecciona todas las etiquetas (y las muestra)
        var all = getAllTagsFromQuizzes().map(function(it){ return it.tag; });
        state.filters.tags = all;
        tagFilterExpanded = true;
        updateTagFilterOptions();
        state.page = 0;
        renderList();
      });
    }
    var tagsClear = document.getElementById('tags-clear');
    if(tagsClear){
      tagsClear.addEventListener('click', function(){
        state.filters.tags = [];
        updateTagFilterOptions();
        state.page = 0;
        renderList();
      });
    }
    var minQuestions = document.getElementById('min-questions');
    if(minQuestions){
      minQuestions.value = state.filters.minQuestions;
      minQuestions.addEventListener('input', function(){
        state.filters.minQuestions = minQuestions.value;
        state.page = 0;
        renderList();
      });
    }
    var maxQuestions = document.getElementById('max-questions');
    if(maxQuestions){
      maxQuestions.value = state.filters.maxQuestions;
      maxQuestions.addEventListener('input', function(){
        state.filters.maxQuestions = maxQuestions.value;
        state.page = 0;
        renderList();
      });
    }
    var onlyImage = document.getElementById('only-image');
    if(onlyImage){
      onlyImage.checked = !!state.filters.onlyImage;
      onlyImage.addEventListener('change', function(){
        state.filters.onlyImage = !!onlyImage.checked;
        state.page = 0;
        renderList();
      });
    }

    var playerCount = document.getElementById('player-count');
    if(playerCount){
      playerCount.value = String(state.playerCount);
      playerCount.addEventListener('change', function(){
        state.playerCount = clampPlayerCount(playerCount.value);
        renderPlayerNameInputs();
      });
    }

    var questionMode = document.getElementById('question-mode');
    if(questionMode){
      questionMode.value = state.questionMode || 'shared';
      questionMode.addEventListener('change', function(){
        state.questionMode = (questionMode.value === 'per-player') ? 'per-player' : 'shared';
      });
    }

    var questionCount = document.getElementById('question-count');
    if(questionCount){
      questionCount.addEventListener('change', function(){
        if(!state.quizData) return;
        var total = Array.isArray(state.quizData.questions) ? state.quizData.questions.length : 0;
        state.desiredQuestionCount = clampQuestionCount(questionCount.value, total);
        questionCount.value = state.desiredQuestionCount ? String(state.desiredQuestionCount) : '';
      });
    }
    var questionTime = document.getElementById('question-time');
    if(questionTime){
      questionTime.addEventListener('input', function(){
        if(!questionTime.value){
          state.desiredQuestionTime = null;
          return;
        }
        var v = parseInt(questionTime.value, 10);
        if(isNaN(v)) return;
        if(v < 5) v = 5;
        if(v > 120) v = 120;
        questionTime.value = String(v);
        state.desiredQuestionTime = v;
      });
    }

    var startBtn = document.getElementById('start-btn');
    if(startBtn){
      startBtn.addEventListener('click', startGame);
    }

    var playAgain = document.getElementById('play-again');
    if(playAgain){
      playAgain.addEventListener('click', function(){
        var results = document.getElementById('results');
        if(results) results.classList.add('hidden');
        startGame();
      });
    }
    var playSame = document.getElementById('play-same');
    if(playSame){
      playSame.addEventListener('click', function(){
        var results = document.getElementById('results');
        if(results) results.classList.add('hidden');
        playSameQuestions();
      });
    }

    var pickAnother = document.getElementById('pick-another');
    if(pickAnother){
      pickAnother.addEventListener('click', resetToCatalog);
    }

    var roundContinue = document.getElementById('round-ranking-continue');
    if(roundContinue){
      roundContinue.addEventListener('click', hideRoundRankingModalAndContinue);
    }
  }

  applyStaticText();
  bindEvents();
  initMultiplayerMusicPlayer();
  fetchPublicQuizzes();
  renderSelected();
  renderPlayerNameInputs();

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
