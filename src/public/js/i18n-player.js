// Lightweight i18n for player-facing screens (join, lobby, game)
(function () {
  const translations = {
    es: {
      join_title: 'Únete a una partida',
      join_name: 'Nombre a mostrar',
      join_pin: 'PIN de la partida',
      join_button: 'Entrar',
      join_icon: 'Icono',
      join_pin_prompt: 'Ingresa el PIN del juego',
      join_pin_blocked: 'Necesitas un PIN válido para continuar.',
      join_continue: 'Continuar',
      join_pin_error: 'PIN incorrecto. Intenta de nuevo.',
      join_name_hint: 'Juega sin PIN, elige tú el nombre',
      join_student_intro: 'O entra con tu identidad EduTicTac',
      join_student_code: 'Código EduTicTac',
      join_student_pin: 'PIN personal',
      join_student_missing: 'Introduce el código y el PIN.',
      join_student_checking: 'Validando credenciales...',
      join_student_error: 'Código o PIN incorrecto.',
      install_title: 'Instala EduHoot como app',
      install_subtitle: 'Acceso directo y pantalla completa desde tu dispositivo.',
      install_now: 'Instalar',
      install_skip: 'Ahora no',
      player_ranking_title: 'Top 10',
      player_ranking_close: 'Continuar',
      player_ranking_you: 'Tú',
      join_host: 'Haz clic aquí para crear una partida',
      lobby_wait: 'Esperando a que el anfitrión inicie la partida',
      lobby_check: '¿Ves tu nombre en pantalla?',
      correct: '¡Correcto!',
      incorrect: '¡Incorrecto!',
      correct_answer: 'Respuesta correcta:',
      submitted: 'Respuesta enviada. Esperando al resto...',
      submit_multiple: 'Enviar respuestas',
      status_pending: 'Responde ahora',
      status_submitted: 'Respuesta enviada',
      host_skipped: 'El anfitrión saltó la pregunta',
      question_countdown: 'Prepara la siguiente pregunta...',
      question_countdown_hint: 'La siguiente empieza en',
      points_double: 'Puntos dobles',
      score: 'Puntuación:',
      name: 'Nombre:',
      game_over: 'PARTIDA TERMINADA',
      reconnecting_saved_spot: 'Reconectando... te hemos guardado el sitio durante {seconds} s',
      reconnecting_waiting_network: 'Sin conexión - esperando red... ({seconds} s)',
      reconnecting_kicked: 'Has salido de la partida',
      rank_top: 'Top 10 - Puesto',
      rank_out: 'Fuera del Top 10',
      reconnecting: 'Reconectando...',
      landing_title: 'EduHoot',
      landing_tagline: 'Juega desde cualquier aula o en solitario.',
      landing_play_multi: 'Jugar en el aula',
      landing_play_local_multi: 'Multijugador',
      landing_play_solo: 'Jugar solo',
      landing_install_app: 'Instalar app',
      landing_langLabel: 'Idioma',
      landing_prof_access: 'Acceso profesorado',
      footerLicense: 'EduHoot · Licencia GNU Affero General Public License v3.0 (AGPL-3.0)',
      footerSource: 'Código fuente',
      footerPrivacy: 'Privacidad',
      footerContactLabel: 'Incidencias'
    },
    ca: {
      join_title: 'Uneix-te a una partida',
      join_name: 'Nom a mostrar',
      join_pin: 'PIN de la partida',
      join_button: 'Entrar',
      join_icon: 'Icona',
      join_pin_prompt: 'Introdueix el PIN de la partida',
      join_pin_blocked: 'Necessites un PIN vàlid per continuar.',
      join_continue: 'Continua',
      join_pin_error: 'PIN incorrecte. Torna-ho a provar.',
      join_name_hint: 'Juga sense PIN, tria tu el nom',
      join_student_intro: 'O entra amb la teva identitat EduTicTac',
      join_student_code: 'Codi EduTicTac',
      join_student_pin: 'PIN personal',
      join_student_missing: 'Introdueix el codi i el PIN.',
      join_student_checking: 'Validant credencials...',
      join_student_error: 'Codi o PIN incorrecte.',
      install_title: 'Instal·la EduHoot com a app',
      install_subtitle: 'Accés directe i pantalla completa al teu dispositiu.',
      install_now: 'Instal·lar',
      install_skip: 'Ara no',
      player_ranking_title: 'Top 10',
      player_ranking_close: 'Continua',
      player_ranking_you: 'Tu',
      join_host: 'Fes clic aquí per crear una partida',
      lobby_wait: 'Esperant que l\'amfitrió iniciï la partida',
      lobby_check: 'Veus el teu nom en pantalla?',
      correct: 'Correcte!',
      incorrect: 'Incorrecte!',
      correct_answer: 'Resposta correcta:',
      submitted: 'Resposta enviada. Esperant la resta...',
      submit_multiple: 'Envia les respostes',
      status_pending: 'Respon ara',
      status_submitted: 'Resposta enviada',
      host_skipped: 'L\'amfitrió ha saltat la pregunta',
      question_countdown: 'Prepara la pregunta següent...',
      question_countdown_hint: 'La següent comença en',
      points_double: 'Punts dobles',
      score: 'Puntuació:',
      name: 'Nom:',
      game_over: 'PARTIDA ACABADA',
      reconnecting_saved_spot: 'Reconnectant... t\'hem guardat el lloc durant {seconds} s',
      reconnecting_waiting_network: 'Sense connexió - esperant xarxa... ({seconds} s)',
      reconnecting_kicked: 'Has sortit de la partida',
      rank_top: 'Top 10 - Posició',
      rank_out: 'Fora del Top 10',
      reconnecting: 'Reconnectant...',
      landing_title: 'EduHoot',
      landing_tagline: 'Juga des de qualsevol aula o en solitari.',
      landing_play_multi: 'Jugar a l\'aula',
      landing_play_local_multi: 'Multijugador',
      landing_play_solo: 'Jugar sol',
      landing_install_app: 'Instal·lar app',
      landing_langLabel: 'Idioma',
      landing_prof_access: 'Accés professorat',
      footerLicense: 'EduHoot · Llicència GNU Affero General Public License v3.0 (AGPL-3.0)',
      footerSource: 'Codi font',
      footerPrivacy: 'Privacitat',
      footerContactLabel: 'Incidències'
    },
    va: {
      join_student_intro: 'O entra amb la teua identitat EduTicTac',
      join_host: 'Fes clic ací per crear una partida',
      lobby_wait: 'Esperant que l\'amfitrió inicie la partida',
      reconnecting_kicked: 'Has eixit de la partida'
    },
    en: {
      join_title: 'Join a Game',
      join_name: 'Display Name',
      join_pin: 'Game Pin',
      join_button: 'Join',
      join_icon: 'Icon',
      join_pin_prompt: 'Enter the game PIN',
      join_pin_blocked: 'You need a valid PIN to continue.',
      join_continue: 'Continue',
      join_pin_error: 'Invalid PIN. Please try again.',
      join_name_hint: 'Play without a PIN, choose your own name',
      join_student_intro: 'Or sign in with your EduTicTac identity',
      join_student_code: 'EduTicTac code',
      join_student_pin: 'Personal PIN',
      join_student_missing: 'Enter your code and PIN.',
      join_student_checking: 'Checking credentials...',
      join_student_error: 'Invalid code or PIN.',
      install_title: 'Install EduHoot as an app',
      install_subtitle: 'Quick access and fullscreen on your device.',
      install_now: 'Install',
      install_skip: 'Not now',
      player_ranking_title: 'Top 10',
      player_ranking_close: 'Continue',
      player_ranking_you: 'You',
      join_host: 'Click here to host an EduHoot',
      lobby_wait: 'Waiting on host to start the game',
      lobby_check: 'Do you see your name on the screen?',
      correct: 'Correct!',
      incorrect: 'Incorrect!',
      correct_answer: 'Correct answer:',
      submitted: 'Answer Submitted! Waiting on other players...',
      submit_multiple: 'Submit answers',
      status_pending: 'Answer now',
      status_submitted: 'Answer received',
      host_skipped: 'Host skipped the question',
      question_countdown: 'Get ready for the next question...',
      question_countdown_hint: 'Next question starts in',
      points_double: 'Double points',
      score: 'Score:',
      name: 'Name:',
      game_over: 'GAME OVER',
      reconnecting_saved_spot: 'Reconnecting... we saved your spot for {seconds} s',
      reconnecting_waiting_network: 'Offline - waiting for network... ({seconds} s)',
      reconnecting_kicked: 'You have left the game',
      rank_top: 'Top 10 - Rank',
      rank_out: 'Outside Top 10',
      reconnecting: 'Reconnecting...',
      landing_title: 'EduHoot',
      landing_tagline: 'Play from any classroom or on your own.',
      landing_play_multi: 'Play in the classroom',
      landing_play_local_multi: 'Multiplayer',
      landing_play_solo: 'Play solo',
      landing_install_app: 'Install app',
      landing_langLabel: 'Language',
      landing_prof_access: 'Teacher access',
      footerLicense: 'EduHoot · GNU Affero General Public License v3.0 (AGPL-3.0)',
      footerSource: 'Source code',
      footerPrivacy: 'Privacy',
      footerContactLabel: 'Issues'
    }
  };

  const LANG_KEYS = ['lang-player', 'lang', 'lang-host', 'edutictac-portal-lang', 'edutictac-lang'];

  function normalizeLang(raw) {
    const value = String(raw || '').toLowerCase();
    if (value.indexOf('valencia') !== -1) return 'va';
    const base = value.split('-')[0];
    return translations[base] ? base : '';
  }

  function queryLang() {
    try {
      return normalizeLang(new URLSearchParams(window.location.search).get('lang'));
    } catch (e) {
      return '';
    }
  }

  function storedLang() {
    for (const key of LANG_KEYS) {
      const value = normalizeLang(window.localStorage.getItem(key));
      if (value) return value;
    }
    return '';
  }

  function persistLang(value) {
      try {
          var url = new URL(window.location.href);
          if (url.searchParams.has('lang')) {
              url.searchParams.set('lang', value);
              window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
          }
      } catch (e) {}
    for (const key of LANG_KEYS) {
      try { window.localStorage.setItem(key, value); } catch (e) {}
    }
  }

  function detectLang() {
    const fromQuery = queryLang();
    if (fromQuery) return fromQuery;
    const stored = storedLang();
    if (stored) return stored;
    const nav = (navigator.language || navigator.userLanguage || 'es').toLowerCase();
    const browserLang = normalizeLang(nav);
    if (browserLang) return browserLang;
    return 'en';
  }

  const lang = detectLang();
  persistLang(lang);
  if (document && document.documentElement) {
    document.documentElement.setAttribute('lang', lang);
  }

  function t(key) {
    const chain = lang === 'va' ? ['va', 'ca', 'en'] : [lang, 'en'];
    for (const l of chain) {
      const d = translations[l];
      if (d && d[key]) return d[key];
    }
    return key;
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const txt = t(key);
      if (txt) el.textContent = txt;
    });
    const selector = document.getElementById('lang-switcher');
    if (selector) {
      selector.querySelectorAll('button[data-lang]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
      });
    }
  }

  function setLang(newLang) {
    if (translations[newLang]) {
      persistLang(newLang);
      window.location.reload();
    }
  }

  window.i18nPlayer = { t, lang, setLang };
  document.addEventListener('DOMContentLoaded', applyTranslations);
})();
