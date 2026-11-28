// Nombre escrito por el alumnado: letras y números, sin empezar por número, de 3 a 20 caracteres.
// Sin espacios, símbolos ni signos de puntuación. Las letras acentuadas (ñ, à…) cuentan como letras.
const NAME_MIN = 3;
const NAME_MAX = 20;
const NAME_RE = /^\p{L}[\p{L}0-9]*$/u;

function isValidTypedName(name) {
  if (typeof name !== 'string') return false;
  if (name.length < NAME_MIN || name.length > NAME_MAX) return false;
  return NAME_RE.test(name);
}

module.exports = { NAME_MIN, NAME_MAX, isValidTypedName };
