(function(){
  var translations = {
    es: {
      join_title: 'Únete a esta partida con el PIN:',
      opt_rand_q: 'Preguntas aleatorias',
      opt_rand_a: 'Respuestas aleatorias',
      opt_send_mobile: 'Enviar pregunta a los móviles',
      opt_show_scores: 'Mostrar puntuaciones entre preguntas',
      opt_time: 'Tiempo por pregunta (s)',
      opt_time_help: 'Déjalo vacío para usar el tiempo definido en cada pregunta del quiz.',
      start_btn: 'Iniciar partida',
      cancel_btn: 'Cancelar partida',
      lang_label: 'Idioma',
      scan_qr: 'Escanea el código QR para entrar',
      pin_label: 'PIN',
      host_error: 'No se pudo iniciar la partida. Vuelve a elegir el quiz y prueba de nuevo.',
      host_error_missing_id: 'Falta el quiz para generar la partida. Vuelve a elegirlo.',
      host_error_timeout: 'No pudimos obtener el PIN. Revisa la conexión y vuelve a elegir el quiz.'
    },
    en: {
      join_title: 'Join this game with the PIN:',
      opt_rand_q: 'Shuffle questions',
      opt_rand_a: 'Shuffle answers',
      opt_send_mobile: 'Send questions to mobiles',
      opt_show_scores: 'Show scores between questions',
      opt_time: 'Time per question (s)',
      opt_time_help: 'Leave empty to use each quiz question time.',
      start_btn: 'Start game',
      cancel_btn: 'Cancel game',
      lang_label: 'Language',
      scan_qr: 'Scan the QR code to join',
      pin_label: 'PIN',
      host_error: 'Could not start the game. Pick the quiz again and retry.',
      host_error_missing_id: 'Missing quiz to create the game. Please pick it again.',
      host_error_timeout: 'Could not retrieve the PIN. Check your connection and pick the quiz again.'
    },
    ca: {
      join_title: 'Uneix-te a la partida amb el PIN:',
      opt_rand_q: 'Preguntes aleatòries',
      opt_rand_a: 'Respostes aleatòries',
      opt_send_mobile: 'Envia preguntes als mòbils',
      opt_show_scores: 'Mostra puntuacions entre preguntes',
      opt_time: 'Temps per pregunta (s)',
      opt_time_help: 'Deixa-ho buit per usar el temps definit a cada pregunta del qüestionari.',
      start_btn: 'Inicia partida',
      cancel_btn: 'Cancel·la la partida',
      lang_label: 'Idioma',
      scan_qr: 'Escaneja el codi QR per entrar',
      pin_label: 'PIN',
      host_error: 'No s\'ha pogut iniciar la partida. Torna a triar el qüestionari i prova-ho de nou.',
      host_error_missing_id: 'Falta el qüestionari per generar la partida. Torna a triar-lo.',
      host_error_timeout: 'No hem pogut obtenir el PIN. Comprova la connexió i torna a triar el qüestionari.'
    },
    va: {}
  };

  function detectLang(){
    var stored = localStorage.getItem('lang-host');
    if(stored && translations[stored]) return stored;
    var nav = (navigator.language || 'es').toLowerCase();
    if(nav.startsWith('ca')) return 'ca';
    if(nav.startsWith('es')) return 'es';
    return 'en';
  }

  var lang = detectLang();

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
    var cancelBtn = document.getElementById('cancel');
    if(cancelBtn){
      cancelBtn.textContent = t('cancel_btn');
    }
    var langLabel = document.querySelector('.host-lang span');
    if(langLabel){
      langLabel.textContent = t('lang_label');
    }
    var select = document.getElementById('host-lang-select');
    if(select){
      select.value = lang;
    }
    var hostError = document.getElementById('host-error');
    if(hostError){
      if(hostError.style.display !== 'none'){
        hostError.textContent = t('host_error');
      }
      hostError.setAttribute('data-i18n-host-msg', t('host_error'));
    }
  }

  function setLang(newLang){
    if(translations[newLang]){
      lang = newLang;
      localStorage.setItem('lang-host', newLang);
      try{ localStorage.setItem('lang', newLang); }catch(e){}
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
