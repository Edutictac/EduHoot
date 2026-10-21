const { sessions, parseCookies } = require('./sessions');

// Middlewares d'autenticació: límit d'intents, càrrega de la sessió a
// req.user i control de rol. Mou el contingut de server.js, sense canviar
// comportament. Factoria perquè sessionMiddleware depén d'authentikOnly.
module.exports = function createAuthMiddleware({ authentikOnly }) {
  const authRate = new Map(); // clave: ip:endpoint -> { count, windowStart }

  function authRateLimiter(req, res, next) {
    const windowMs = 10 * 60 * 1000; // 10 minutos
    const max = 20; // máximo intentos por endpoint en la ventana
    const now = Date.now();
    const endpoint = (req.path || req.originalUrl || 'auth').toString();
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `${ip}:${endpoint}`;
    const entry = authRate.get(key) || { count: 0, windowStart: now };
    if (now - entry.windowStart > windowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }
    entry.count += 1;
    authRate.set(key, entry);
    if (entry.count > max) {
      return res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' });
    }
    // limpieza ocasional
    if (authRate.size > 3000) {
      for (const [k, v] of authRate.entries()) {
        if (now - v.windowStart > windowMs) authRate.delete(k);
      }
    }
    return next();
  }

  async function sessionMiddleware(req, res, next) {
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionId = cookies.sessionId;
    if (sessionId && sessions.has(sessionId) && (!authentikOnly() || sessions.get(sessionId).provider === 'authentik')) {
      const session = sessions.get(sessionId);
      req.user = { id: session.userId, email: session.email, role: session.role, nickname: session.nickname || '' };
    }
    next();
  }

  function requireRole(role) {
    return function roleMiddleware(req, res, next) {
      if (!req.user) return res.status(401).json({ error: 'No autorizado' });
      const rolesOrder = { editor: 1, admin: 2 };
      const current = rolesOrder[req.user.role] || 0;
      const needed = rolesOrder[role] || 0;
      if (current < needed) return res.status(403).json({ error: 'Permiso insuficiente' });
      return next();
    };
  }

  return { authRateLimiter, sessionMiddleware, requireRole };
};
