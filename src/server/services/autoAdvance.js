// Avance automático entre preguntas: el anfitrión elige 3–20 s (o manual = 0).
// El temporizador vive en el servidor para que no lo frene el navegador del anfitrión
// (las pestañas en segundo plano retrasan los temporizadores del cliente).

const MIN_SECONDS = 3;
const MAX_SECONDS = 20;

// Valor válido: 0 (manual) o un entero entre 5 y 20. Cualquier otra cosa se toma como manual.
function normalizeAutoAdvance(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < MIN_SECONDS || n > MAX_SECONDS) return 0;
  return n;
}

// Cuenta atrás de un paso de resultados. Se puede pausar, reanudar, rearmar y cancelar.
class AutoAdvanceTimer {
  constructor(ms, onFire) {
    this.totalMs = ms;
    this.remainingMs = ms;
    this.onFire = onFire;
    this.timer = null;
    this.startedAt = 0;
    this.paused = false;
    this.cancelled = false;
  }

  start() {
    this.arm(this.remainingMs);
  }

  // Nuevo paso con la misma duración (p. ej. de resultados a clasificación).
  rearm() {
    this.remainingMs = this.totalMs;
    this.paused = false;
    this.arm(this.totalMs);
  }

  arm(ms) {
    clearTimeout(this.timer);
    this.startedAt = Date.now();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.remainingMs = 0;
      if (!this.cancelled) this.onFire();
    }, ms);
  }

  pause() {
    if (this.paused || this.cancelled || !this.timer) return;
    this.remainingMs = Math.max(0, this.remainingMs - (Date.now() - this.startedAt));
    clearTimeout(this.timer);
    this.timer = null;
    this.paused = true;
  }

  resume() {
    if (!this.paused || this.cancelled) return;
    this.paused = false;
    this.arm(this.remainingMs);
  }

  cancel() {
    clearTimeout(this.timer);
    this.timer = null;
    this.cancelled = true;
  }

  snapshot() {
    return { totalMs: this.totalMs, remainingMs: this.remainingMs, paused: this.paused };
  }
}

module.exports = { MIN_SECONDS, MAX_SECONDS, normalizeAutoAdvance, AutoAdvanceTimer };
