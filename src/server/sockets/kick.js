// Expulsión de alumnado por parte del anfitrión (issue #29).
// Cada expulsión queda como una entrada de la partida con el token del navegador y
// el nombre del alumno. Mientras esté la entrada, ese token o ese nombre no pueden
// volver a entrar con el mismo PIN. El anfitrión puede quitar la entrada para
// permitir la reentrada. No se identifica el dispositivo: el servidor solo conoce
// el token que guarda el navegador.

let nextKickId = 1;

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function kickedEntries(game) {
  if (!game.kicked) game.kicked = [];
  return game.kicked;
}

// Registra al jugador expulsado. Devuelve la entrada creada.
function recordKick(game, player) {
  const entry = {
    id: nextKickId++,
    name: String(player.name || ''),
    token: player.token || ''
  };
  kickedEntries(game).push(entry);
  return entry;
}

// ¿Está bloqueado este token o este nombre en la partida?
function isKicked(game, { token, name } = {}) {
  if (!game || !game.kicked) return false;
  return game.kicked.some((entry) =>
    (token && entry.token === token) ||
    (name && normalizeKey(entry.name) === normalizeKey(name))
  );
}

// Lista para el anfitrión: sin tokens, solo identificador y nombre.
function listKicked(game) {
  if (!game || !game.kicked) return [];
  return game.kicked.map((entry) => ({ id: entry.id, name: entry.name }));
}

// Quita una expulsión para permitir la reentrada. Devuelve true si existía.
function unkick(game, id) {
  if (!game || !game.kicked) return false;
  const before = game.kicked.length;
  game.kicked = game.kicked.filter((entry) => entry.id !== Number(id));
  return game.kicked.length !== before;
}

module.exports = { recordKick, isKicked, listKicked, unkick, normalizeKey };
