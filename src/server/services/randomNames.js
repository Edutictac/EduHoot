// Nombres aleatorios para el alumnado (feature 12). La lista vive en
// server/data/random-names.txt: una línea por nombre, editable a mano.
const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'random-names.txt');

function loadRandomNames(file = DEFAULT_FILE) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const RANDOM_NAMES = loadRandomNames();

// ¿Es un nombre de la lista? Con la opción activa, el servidor solo admite estos.
function isRandomName(name) {
  return RANDOM_NAMES.includes(String(name || '').trim());
}

module.exports = { RANDOM_NAMES, isRandomName, loadRandomNames };
