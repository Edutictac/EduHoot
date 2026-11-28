/* Alinea el xip de compte amb el costat dret del recuadre principal de la pàgina
 * (portada: .landing-shell; biblioteca: .top-row). Escriu --chip-right (xip, edutictac-shared.css) i --back-left («Tornar»). Sense recuadre, el xip es queda al marge per defecte. */
(function () {
  'use strict';

  function align() {
    var box = document.querySelector('.landing-shell, .page-shell .top-row');
    var root = document.documentElement;
    if (!box) return;
    var rect = box.getBoundingClientRect();
    if (!rect.width) return;
    var right = root.clientWidth - rect.right;
    if (right >= 0) root.style.setProperty('--chip-right', Math.round(right) + 'px');
    // «Volver» (solo en la biblioteca) también sigue el borde izquierdo del recuadro.
    if (document.getElementById('back') && rect.left >= 0) root.style.setProperty('--back-left', Math.round(rect.left) + 'px');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', align);
  else align();
  window.addEventListener('load', align);
  window.addEventListener('resize', align);
})();
