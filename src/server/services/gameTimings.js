// Tiempos de espera y limpieza por partida (issue #13). Los valores por defecto son
// los mínimos actuales: por partida solo se pueden ampliar, hasta el tope de cada uno.
const DEFAULTS_MS = {
  hostReconnectMs: 30 * 1000,
  playerReconnectMs: 40 * 1000,
  cleanupMs: 100 * 1000,
  inactivityMs: 30 * 60 * 1000
};

// Límites de cada ajuste en la unidad en la que se introduce (segundos o minutos).
const LIMITS = {
  hostReconnectSec: { min: 30, max: 120 },
  playerReconnectSec: { min: 40, max: 120 },
  cleanupSec: { min: 100, max: 600 },
  inactivityMin: { min: 30, max: 60 }
};

// Solo guarda los ajustes válidos. Vacío o fuera de rango = se usa el mínimo.
function normalizeTimings(input) {
  const out = {};
  const src = input && typeof input === 'object' ? input : {};
  Object.keys(LIMITS).forEach((key) => {
    const raw = src[key];
    if (raw === '' || raw === null || raw === undefined) return;
    const value = Number(raw);
    const { min, max } = LIMITS[key];
    if (Number.isInteger(value) && value >= min && value <= max) out[key] = value;
  });
  return out;
}

// Tiempos vigentes de una partida, en milisegundos.
function getTimings(game) {
  const overrides = (game && game.timingOverrides) || {};
  const pick = (key, fallbackMs, unitMs) => (Number.isInteger(overrides[key]) ? overrides[key] * unitMs : fallbackMs);
  return {
    hostReconnectMs: pick('hostReconnectSec', DEFAULTS_MS.hostReconnectMs, 1000),
    playerReconnectMs: pick('playerReconnectSec', DEFAULTS_MS.playerReconnectMs, 1000),
    cleanupMs: pick('cleanupSec', DEFAULTS_MS.cleanupMs, 1000),
    inactivityMs: pick('inactivityMin', DEFAULTS_MS.inactivityMs, 60 * 1000)
  };
}

module.exports = { DEFAULTS_MS, LIMITS, normalizeTimings, getTimings };
