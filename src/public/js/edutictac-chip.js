/* Xip de compte central d'EduTicTac a EduHoot.
 *
 * Defineix el contracte window.edutictacLanguage que espera account-widget.js
 * i decidix quan els selectors d'idioma propis de cada pàgina fan de respost.
 * No carrega cap tema: EduHoot és fosc i el xip es queda clar, com al Banc.
 */
(function () {
  'use strict';

  var LANGS = ['ca', 'va', 'es', 'en'];
  var LANG_KEYS = ['lang', 'lang-player', 'lang-host', 'edutictac-portal-lang', 'edutictac-lang'];
  var ACCOUNT_TIMEOUT_MS = 5000;

  function normalize(raw) {
    var value = String(raw || '').toLowerCase();
    if (value.indexOf('valencia') !== -1) return 'va';
    var base = value.split('-')[0];
    return LANGS.indexOf(base) !== -1 ? base : '';
  }

  function langSelect() {
    return document.getElementById('lang-select') || document.getElementById('host-lang-select');
  }

  function storedLang() {
    for (var i = 0; i < LANG_KEYS.length; i++) {
      try {
        var value = normalize(window.localStorage.getItem(LANG_KEYS[i]));
        if (value) return value;
      } catch (error) {}
    }
    return '';
  }

  function pageLang() {
    if (window.i18nPlayer && LANGS.indexOf(window.i18nPlayer.lang) !== -1) {
      return window.i18nPlayer.lang;
    }
    return storedLang() || normalize(document.documentElement.lang) || 'es';
  }

  function persistLang(value) {
    for (var i = 0; i < LANG_KEYS.length; i++) {
      try { window.localStorage.setItem(LANG_KEYS[i], value); } catch (error) {}
    }
  }

  function setLang(value) {
    if (LANGS.indexOf(value) === -1) return;
    document.documentElement.lang = value === 'va' ? 'ca-ES-valencia' : value;

    var select = langSelect();
    if (select) {
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (window.i18nPlayer && typeof window.i18nPlayer.setLang === 'function') {
      window.i18nPlayer.setLang(value);
    } else {
      persistLang(value);
      window.location.reload();
    }

    window.dispatchEvent(new CustomEvent('edutictac:langchange', { detail: { lang: value } }));
  }

  window.edutictacLanguage = { languages: LANGS.slice(), get: pageLang, set: setLang };

  function fallback() {
    document.documentElement.classList.remove('has-account-chip');
    document.documentElement.classList.add('account-fallback');
  }

  function chipReady() {
    document.documentElement.classList.remove('account-fallback');
    document.documentElement.classList.add('has-account-chip');
  }

  var timer = window.setTimeout(function () {
    if (!document.querySelector('edutictac-account nav.eta')) fallback();
  }, ACCOUNT_TIMEOUT_MS);

  if (!window.customElements || typeof window.customElements.whenDefined !== 'function') {
    fallback();
    return;
  }

  window.customElements.whenDefined('edutictac-account').then(function () {
    var tries = 0;
    (function check() {
      if (document.querySelector('edutictac-account nav.eta')) {
        window.clearTimeout(timer);
        chipReady();
      } else if (++tries < 50) {
        window.setTimeout(check, 100);
      } else {
        fallback();
      }
    })();
  });
})();
