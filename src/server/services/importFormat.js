// Detección del formato de un fichero de importación (feature 15): CSV de EduHoot,
// GIFT de Moodle o XML de Moodle. La extensión decide cuando es clara (.gift, .xml);
// un .txt (o un .csv de nombre dudoso) se decide por el contenido.

// Cabecera del CSV de EduHoot: la primera celda es «tipo» (o «type»).
function looksLikeCsvHeader(firstLine) {
  return /^(tipo|type)\s*;/i.test(firstLine.trim());
}

// Marcas de GIFT: un bloque {…} que empieza por respuesta («=», «~», «#»), «T»/«F»/«TRUE»/«FALSE»
// o vacío («{}» de redacción), o un título «::…::».
function looksLikeGift(content) {
  const block = /\{\s*(?:[=~#]|T\b|F\b|TRUE\b|FALSE\b|\})/i;
  return block.test(content) || /(^|\n)\s*::[^:\n]+::/.test(content);
}

// Devuelve 'gift', 'xml' o 'csv'.
function detectImportFormat(filename, content) {
  const name = String(filename || '').toLowerCase();
  const text = String(content || '').replace(/^﻿/, '');
  if (name.endsWith('.gift')) return 'gift';
  if (name.endsWith('.xml')) return 'xml';

  const trimmed = text.trimStart();
  if (trimmed.startsWith('<')) return 'xml';

  const firstLine = trimmed.split(/\r?\n/)[0] || '';
  if (looksLikeCsvHeader(firstLine)) return 'csv';
  if (looksLikeGift(text)) return 'gift';
  return 'csv';
}

module.exports = { detectImportFormat, looksLikeGift, looksLikeCsvHeader };
