(function(){
  var translations = {
    es: {
      join_title: 'Únete a la partida',
      opt_rand_q: 'Preguntas aleatorias',
      opt_rand_a: 'Respuestas aleatorias',
      opt_send_students: 'Mostrar preguntas',
      opt_send_students_hint: 'Si se desactiva, el alumnado solo verá formas y colores para responder; deberá mirar la pantalla compartida para leer la pregunta.',
      opt_show_scores: 'Puntuaciones y ranking',
      opt_show_answers: 'Mostrar respuestas',
      opt_streak: 'Racha de aciertos',
      opt_auto: 'Avance automático',
      opt_auto_manual: 'Manual',
      opt_advanced: 'Opciones avanzadas',
      opt_t_host: 'Reconexión del anfitrión (s)',
      opt_t_player: 'Reconexión del alumnado (s)',
      opt_t_cleanup: 'Limpieza tras terminar (s)',
      opt_t_inactivity: 'Inactividad antes de cerrar (min)',
      opt_t_help: 'Vacío = valor normal. Solo se pueden ampliar, y solo para esta partida.',
      opt_name_mode: 'Nombre del alumnado',
      opt_name_typed: 'Que lo escriba',
      opt_name_random: 'Aleatorio',
      kick_btn: 'Expulsar',
      kick_confirm: 'Confirmar',
      kicked_title: 'Expulsados',
      unkick_btn: 'Permitir entrar',
      opt_time: 'Tiempo por pregunta (s)',
      opt_time_help: 'Vacío = tiempo de cada pregunta.',
      start_btn: 'Iniciar partida',
      starting: 'Iniciando partida… espera',
      cancel_btn: 'Cancelar partida',
      cancel_confirm: 'Confirmar cancelación',
      lang_label: 'Idioma',
      scan_qr: 'Escanea el código QR para entrar',
      pin_label: 'PIN',
      host_error: 'No se pudo iniciar la partida. Vuelve a elegir el quiz y prueba de nuevo.',
      host_error_missing_id: 'Falta el quiz para generar la partida. Vuelve a elegirlo.',
      host_error_timeout: 'No pudimos obtener el PIN. Revisa la conexión y vuelve a elegir el quiz.',
      footerPrivacy: 'Privacidad',
      footerCookies: 'Cookies',
      footerSource: 'Código fuente'
    },
    en: {
      join_title: 'Join the game',
      opt_rand_q: 'Shuffle questions',
      opt_rand_a: 'Shuffle answers',
      opt_send_students: 'Show questions',
      opt_send_students_hint: 'If disabled, students only see colored shapes to answer; they must look at the shared screen to read the question.',
      opt_show_scores: 'Scores and ranking',
      opt_show_answers: 'Show answers',
      opt_streak: 'Answer streak',
      opt_auto: 'Automatic advance',
      opt_auto_manual: 'Manual',
      opt_advanced: 'Advanced options',
      opt_t_host: 'Host reconnection (s)',
      opt_t_player: 'Student reconnection (s)',
      opt_t_cleanup: 'Cleanup after the game ends (s)',
      opt_t_inactivity: 'Inactivity before closing (min)',
      opt_t_help: 'Empty = normal value. Can only be extended, and only for this game.',
      opt_name_mode: 'Student name',
      opt_name_typed: 'Students type it',
      opt_name_random: 'Random',
      kick_btn: 'Remove',
      kick_confirm: 'Confirm',
      kicked_title: 'Removed',
      unkick_btn: 'Allow back',
      opt_time: 'Time per question (s)',
      opt_time_help: 'Empty = each question time.',
      start_btn: 'Start game',
      starting: 'Starting game… please wait',
      cancel_btn: 'Cancel game',
      cancel_confirm: 'Confirm cancellation',
      lang_label: 'Language',
      scan_qr: 'Scan the QR code to join',
      pin_label: 'PIN',
      host_error: 'Could not start the game. Pick the quiz again and retry.',
      host_error_missing_id: 'Missing quiz to create the game. Please pick it again.',
      host_error_timeout: 'Could not retrieve the PIN. Check your connection and pick the quiz again.',
      footerPrivacy: 'Privacy',
      footerCookies: 'Cookies',
      footerSource: 'Source code'
    },
    ca: {
      join_title: 'Uneix-te a la partida',
      opt_rand_q: 'Preguntes aleatòries',
      opt_rand_a: 'Respostes aleatòries',
      opt_send_students: 'Mostra les preguntes',
      opt_send_students_hint: 'Si es desactiva, l\'alumnat només veu formes i colors per a respondre; haurà de mirar la pantalla compartida per a llegir la pregunta.',
      opt_show_scores: 'Puntuacions i rànquing',
      opt_show_answers: 'Mostrar respostes',
      opt_streak: 'Ratxa d\'encerts',
      opt_auto: 'Avanç automàtic',
      opt_auto_manual: 'Manual',
      opt_advanced: 'Opcions avançades',
      opt_t_host: 'Reconnexió de l\'amfitrió (s)',
      opt_t_player: 'Reconnexió de l\'alumnat (s)',
      opt_t_cleanup: 'Neteja en acabar (s)',
      opt_t_inactivity: 'Inactivitat abans de tancar (min)',
      opt_t_help: 'Buit = valor normal. Només es poden ampliar, i només per a esta partida.',
      opt_name_mode: 'Nom de l\'alumnat',
      opt_name_typed: 'Que l\'escriga',
      opt_name_random: 'Aleatori',
      kick_btn: 'Expulsar',
      kick_confirm: 'Confirmar',
      kicked_title: 'Expulsats',
      unkick_btn: 'Permetre entrar',
      opt_time: 'Temps per pregunta (s)',
      opt_time_help: 'Buit = temps de cada pregunta.',
      start_btn: 'Inicia partida',
      starting: 'Iniciant la partida… espera',
      cancel_btn: 'Cancel·la la partida',
      cancel_confirm: 'Confirmar cancel·lació',
      lang_label: 'Idioma',
      scan_qr: 'Escaneja el codi QR per entrar',
      pin_label: 'PIN',
      host_error: 'No s\'ha pogut iniciar la partida. Torna a triar el qüestionari i prova-ho de nou.',
      host_error_missing_id: 'Falta el qüestionari per generar la partida. Torna a triar-lo.',
      host_error_timeout: 'No hem pogut obtenir el PIN. Comprova la connexió i torna a triar el qüestionari.',
      footerPrivacy: 'Privacitat',
      footerCookies: 'Galetes',
      footerSource: 'Codi font'
    },
    va: {
      opt_time_help: 'Buit = temps de cada pregunta.'
    }
  };

  var lang = EduhootLang.init({ preferKey: 'lang-host', fallback: 'en' });

  function t(key){
    var chain = lang === 'va' ? ['va', 'ca', 'en'] : [lang, 'en'];
    for (var i = 0; i < chain.length; i++) {
      var d = translations[chain[i]];
      if (d && d[key]) return d[key];
    }
    return key;
  }

  function apply(){
    document.querySelectorAll('[data-i18n-host]').forEach(function(el){
      var key = el.getAttribute('data-i18n-host');
      var txt = t(key);
      if(txt) el.textContent = txt;
    });
    document.querySelectorAll('[data-i18n]').forEach(function(el){
      var key = el.getAttribute('data-i18n');
      var txt = t(key);
      if(txt) el.textContent = txt;
    });
    var langLabel = document.querySelector('.host-lang span');
    if(langLabel){
      langLabel.textContent = t('lang_label');
    }
    var select = document.getElementById('host-lang-select');
    if(select){
      select.value = lang;
    }
    // El lobby (host.js, Vue) traduce sus textos y su error con
    // getHostTranslation; aquí solo se tocan los textos fuera de él.
  }

  function setLang(newLang){
    if(translations[newLang]){
      lang = newLang;
      EduhootLang.persist(newLang);
      apply();
    }
  }

  document.addEventListener('DOMContentLoaded', function(){
    apply();
    var select = document.getElementById('host-lang-select');
    if(select){
      select.addEventListener('change', function(){
        setLang(select.value);
      });
    }
  });

  // Exponer para host.js
  window.applyHostTranslations = function(newLang){
    setLang(newLang || lang);
  };
  window.getHostTranslation = function(key){
    return t(key);
  };
})();
