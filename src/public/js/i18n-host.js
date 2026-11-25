(function(){
  var translations = {
    es: {
      join_title: 'Únete a la partida',
      opt_rand_q: 'Preguntas aleatorias',
      opt_rand_a: 'Respuestas aleatorias',
      opt_send_students: 'Mostrar preguntas',
      opt_matching_blind: 'Correspondencias a ciegas',
      opt_matching_extra: 'Tiempo extra en preguntas compuestas',
      opt_matching_blind_codes: 'Toques con números y letras',
      opt_matching_blind_select: 'Desplegables',
      opt_matching_blind_steps: 'Paso a paso',
      opt_show_scores: 'Puntuaciones y ranking',
      opt_show_answers: 'Mostrar respuestas',
      opt_streak: 'Racha de aciertos',
      opt_mode: 'Modo de partida',
      opt_mode_live: 'En directo (todos a la vez)',
      opt_mode_self: 'A su ritmo (cada alumno avanza solo)',
      tip_mode: 'En directo, todo el grupo ve la misma pregunta y tú decides cuándo pasar a la siguiente. A su ritmo, cada alumno responde en su dispositivo a su velocidad y tú ves el progreso; la partida acaba cuando tú la cierras.',
      opt_auto: 'Avance automático',
      opt_auto_manual: 'Manual',
      opt_group_checks: 'Opciones de la partida',
      opt_group_values: 'Ajustes',
      tip_rand_q: 'Presenta las preguntas en un orden distinto en cada partida.',
      tip_rand_a: 'Cambia de sitio las respuestas de cada pregunta, para que no salgan siempre en el mismo orden.',
      tip_send_students: 'Si está marcada, el alumnado ve la pregunta y las respuestas en su dispositivo. Si no, solo ve formas y colores y lee la pregunta en la pantalla compartida.',
      tip_show_scores: 'Muestra la puntuación y el ranking entre preguntas y el podio final. Si se desmarca, cada alumno solo ve su propia puntuación.',
      tip_show_answers: 'Tras cada pregunta, el alumnado ve cuál era la respuesta correcta. Si se desmarca, no se le muestra.',
      tip_streak: 'Da puntos extra a quien acierta varias preguntas seguidas (desde la tercera: +50 por acierto, hasta +250).',
      tip_name_mode: 'Cómo se pone el nombre el alumnado. No se puede cambiar cuando ya ha entrado el primer alumno.',
      tip_name_typed: 'Cada alumno escribe su propio nombre al entrar.',
      tip_name_random: 'Cada alumno recibe un nombre aleatorio de una lista, y puede pedir otro. No se repiten dentro de la partida.',
      tip_auto: 'Pasa solo a la siguiente pregunta tras los resultados, esperando los segundos indicados. «Manual» = lo decides tú con el botón.',
      tip_time: 'Tiempo para responder cada pregunta, de 5 a 120 s. Vacío = se usa el tiempo de cada pregunta.',
      tip_matching_extra: 'Tiempo extra (en %) para las preguntas de correspondencia y de ordenar, que llevan más tiempo. Por defecto, +50 %.',
      tip_matching_blind: 'Cómo responde el alumnado las correspondencias cuando no ve la pregunta en su dispositivo: toques con números y letras, desplegables o paso a paso.',
      help_aria: 'Ayuda sobre esta opción',
      tip_advanced: 'Ajustes de reconexión y limpieza de la partida. Normalmente no hace falta tocarlos.',
      tip_t_host: 'Segundos que se espera a que el anfitrión vuelva a conectarse antes de cerrar la partida. Mínimo 120 (2 minutos), máximo 300 (5 minutos).',
      tip_t_player: 'Segundos que se espera a que un alumno que ha perdido la conexión vuelva antes de quitarlo. Mínimo 40, máximo 120.',
      tip_t_cleanup: 'Segundos que la partida sigue guardada tras terminar, por si se quiere descargar el informe. Mínimo 100, máximo 600.',
      tip_t_inactivity: 'Minutos sin actividad tras los cuales se cierra la partida. Mínimo 30, máximo 60.',
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
      opt_matching_blind: 'Blind matching',
      opt_matching_extra: 'Extra time on composite questions',
      opt_matching_blind_codes: 'Taps with numbers and letters',
      opt_matching_blind_select: 'Drop-down lists',
      opt_matching_blind_steps: 'Step by step',
      opt_show_scores: 'Scores and ranking',
      opt_show_answers: 'Show answers',
      opt_streak: 'Answer streak',
      opt_mode: 'Game mode',
      opt_mode_live: 'Live (everyone together)',
      opt_mode_self: 'Self-paced (each student goes on their own)',
      tip_mode: 'Live: the whole group sees the same question and you decide when to move on. Self-paced: each student answers on their own device at their own speed and you see the progress; the game ends when you close it.',
      opt_auto: 'Automatic advance',
      opt_auto_manual: 'Manual',
      opt_group_checks: 'Game options',
      opt_group_values: 'Settings',
      tip_rand_q: 'Shows the questions in a different order each game.',
      tip_rand_a: 'Shuffles the answers of each question so they do not always appear in the same order.',
      tip_send_students: 'If checked, students see the question and answers on their device. If not, they only see shapes and colors and read the question on the shared screen.',
      tip_show_scores: 'Shows scores and ranking between questions and the final podium. If unchecked, each student only sees their own score.',
      tip_show_answers: 'After each question, students see the correct answer. If unchecked, it is not shown to them.',
      tip_streak: 'Gives extra points to students who answer several questions correctly in a row (from the third: +50 each, up to +250).',
      tip_name_mode: 'How students get their name. It cannot be changed once the first student has joined.',
      tip_name_typed: 'Each student types their own name when joining.',
      tip_name_random: 'Each student gets a random name from a list and can ask for another one. Names are not repeated within the game.',
      tip_auto: 'Moves on to the next question by itself after the results, waiting the seconds shown. "Manual" = you decide with the button.',
      tip_time: 'Time to answer each question, from 5 to 120 s. Empty = each question\'s own time is used.',
      tip_matching_extra: 'Extra time (in %) for matching and ordering questions, since they take longer. Default: +50 %.',
      tip_matching_blind: 'How students answer matching questions when they cannot see the question on their device: taps with numbers and letters, drop-downs, or step by step.',
      help_aria: 'Help about this option',
      tip_advanced: 'Reconnection and cleanup settings for the game. Usually you do not need to change them.',
      tip_t_host: 'Seconds to wait for the host to reconnect before closing the game. Minimum 120 (2 minutes), maximum 300 (5 minutes).',
      tip_t_player: 'Seconds to wait for a student who lost connection to come back before removing them. Minimum 40, maximum 120.',
      tip_t_cleanup: 'Seconds the game stays stored after it ends, in case you want to download the report. Minimum 100, maximum 600.',
      tip_t_inactivity: 'Minutes without activity after which the game is closed. Minimum 30, maximum 60.',
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
      opt_matching_blind: 'Correspondències a cegues',
      opt_matching_extra: 'Temps extra en preguntes compostes',
      opt_matching_blind_codes: 'Tocs amb números i lletres',
      opt_matching_blind_select: 'Desplegables',
      opt_matching_blind_steps: 'Pas a pas',
      opt_show_scores: 'Puntuacions i rànquing',
      opt_show_answers: 'Mostrar respostes',
      opt_streak: 'Ratxa d\'encerts',
      opt_mode: 'Mode de partida',
      opt_mode_live: 'En directe (tots alhora)',
      opt_mode_self: 'Al seu ritme (cada alumne avança sol)',
      tip_mode: 'En directe, tot el grup veu la mateixa pregunta i tu decidixes quan passar a la següent. Al seu ritme, cada alumne respon al seu dispositiu a la seua velocitat i tu veus el progrés; la partida acaba quan la tanques tu.',
      opt_auto: 'Avanç automàtic',
      opt_auto_manual: 'Manual',
      opt_group_checks: 'Opcions de la partida',
      opt_group_values: 'Ajustos',
      tip_rand_q: 'Presenta les preguntes en un ordre diferent en cada partida.',
      tip_rand_a: 'Canvia de lloc les respostes de cada pregunta, perquè no isquen sempre en el mateix ordre.',
      tip_send_students: 'Si està marcada, l\'alumnat veu la pregunta i les respostes en el seu dispositiu. Si no, només veu formes i colors i llig la pregunta en la pantalla compartida.',
      tip_show_scores: 'Mostra la puntuació i el rànquing entre preguntes i el podi final. Si es desmarca, cada alumne només veu la seua puntuació.',
      tip_show_answers: 'Després de cada pregunta, l\'alumnat veu quina era la resposta correcta. Si es desmarca, no se li mostra.',
      tip_streak: 'Dona punts extra a qui encerta diverses preguntes seguides (des de la tercera: +50 per encert, fins a +250).',
      tip_name_mode: 'Com es posa el nom l\'alumnat. No es pot canviar quan ja ha entrat el primer alumne.',
      tip_name_typed: 'Cada alumne escriu el seu propi nom en entrar.',
      tip_name_random: 'Cada alumne rep un nom aleatori d\'una llista, i en pot demanar un altre. No es repetixen dins de la partida.',
      tip_auto: 'Passa sol a la pregunta següent després dels resultats, esperant els segons indicats. «Manual» = ho decidixes tu amb el botó.',
      tip_time: 'Temps per a respondre cada pregunta, de 5 a 120 s. Buit = s\'usa el temps de cada pregunta.',
      tip_matching_extra: 'Temps extra (en %) per a les preguntes de correspondència i d\'ordenar, que duren més. Per defecte, +50 %.',
      tip_matching_blind: 'Com respon l\'alumnat les correspondències quan no veu la pregunta en el seu dispositiu: tocs amb números i lletres, desplegables o pas a pas.',
      help_aria: 'Ajuda sobre esta opció',
      tip_advanced: 'Ajustos de reconnexió i neteja de la partida. Normalment no cal tocar-los.',
      tip_t_host: 'Segons que s\'espera que l\'amfitrió torne a connectar-se abans de tancar la partida. Mínim 120 (2 minuts), màxim 300 (5 minuts).',
      tip_t_player: 'Segons que s\'espera que un alumne que ha perdut la connexió torne abans d\'ixir-lo. Mínim 40, màxim 120.',
      tip_t_cleanup: 'Segons que la partida continua guardada en acabar, per si es vol descarregar l\'informe. Mínim 100, màxim 600.',
      tip_t_inactivity: 'Minuts sense activitat després dels quals es tanca la partida. Mínim 30, màxim 60.',
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
    va: {}
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
