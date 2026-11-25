// Mode fantasma (ítem 26): la marca de cada alumne és al seu navegador i es comparteix entre solo i aula.
// El servidor només diu si el mode està activat i quina és l'empremta del quiz (la mateixa que calcula
// el navegador a solo-ghost.js), perquè la marca antiga no es compare amb un quiz que ha canviat.
// Sense dades personals.

// Hash FNV-1a de 32 bits: idèntic al de solo-ghost.js.
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

// Empremta del contingut de les preguntes: qualsevol canvi (text, respostes, temps, puntuació) la canvia.
function liveGhostFingerprint(questions) {
  const list = (Array.isArray(questions) ? questions : []).map((q) => {
    const x = q || {};
    return [x.type, x.question, x.answers, x.correctAnswers, x.correct, x.items, x.pairs,
      x.acceptedAnswers, x.numericAnswer, x.tolerance, x.time, x.pointsMultiplier,
      x.orderGrading, x.layout, x.image, x.video];
  });
  return list.length + ':' + fnv1a(JSON.stringify(list));
}

// Informació que rep l'alumnat: si el mode està actiu i l'empremta del quiz.
function ghostStartInfo(game) {
  const options = (game && game.gameData && game.gameData.options) || {};
  const on = options.ghostMode === true;
  return {
    ghostMode: on,
    ghostFingerprint: on ? liveGhostFingerprint(game.gameData.originalQuestions) : null
  };
}

module.exports = { liveGhostFingerprint, ghostStartInfo };
