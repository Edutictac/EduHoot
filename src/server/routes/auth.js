const express = require('express');
const crypto = require('crypto');
const { ObjectId } = require('mongodb');
const { getUsersCollection } = require('../data/repositories');
const { sessions, getCookieOptions, createSession, parseCookies } = require('../services/sessions');

module.exports = function createAuthRouter({
  requireRole,
  authRateLimiter,
  authentikOnly,
  hashPassword,
  verifyPassword,
  setPasswordFields,
  hashResetToken,
  googleOAuthConfig,
  authentikConfigured,
  authentikEndpoints,
  cleanupOauthStates,
  base64Url,
  sanitizeRedirectTarget,
  authentikCallbackUrl,
  exchangeAuthentikCode,
  fetchAuthentikProfile,
  findOrCreateAuthentikUser,
  exchangeGoogleCode,
  fetchGoogleProfile,
  findOrCreateGoogleUser,
  oauthStates,
  authentikOauthStates,
  AUTHENTIK_CLIENT_ID,
  AUTHENTIK_CLIENT_SECRET,
  AUTHENTIK_SCOPE,
  AUTHENTIK_OAUTH_STATE_TTL_MS,
  GOOGLE_OAUTH_STATE_TTL_MS,
  GOOGLE_OAUTH_SCOPE,
  GOOGLE_OAUTH_AUTH_URL
}) {
  const router = express.Router();

  router.post('/api/auth/bootstrap', async (req, res) => {
    if (authentikOnly()) return res.status(404).json({ error: 'Utiliza el acceso EduTicTac.' });
    try {
      const users = await getUsersCollection();
      const count = await users.countDocuments();
      if (count > 0) {
        return res.status(400).json({ error: 'Ya existe un usuario, usa login.' });
      }
      const email = (req.body.email || '').toLowerCase().trim();
      const password = req.body.password || '';
      if (!email || !password) return res.status(400).json({ error: 'Faltan email o contraseña.' });
      const { salt, hash } = hashPassword(password);
      const nickname = (req.body.nickname || '').trim();
      const user = { email, passwordSalt: salt, passwordHash: hash, role: 'admin', createdAt: new Date() };
      if (nickname) user.nickname = nickname;
      await users.insertOne(user);
      return res.json({ ok: true });
    } catch (err) {
      console.error('bootstrap error', err);
      return res.status(500).json({ error: 'No se pudo crear el usuario.' });
    }
  });

  router.post('/api/auth/login', authRateLimiter, async (req, res) => {
    if (authentikOnly()) return res.status(404).json({ error: 'Utiliza el acceso EduTicTac.' });
    try {
      const email = (req.body.email || '').toLowerCase().trim();
      const password = req.body.password || '';
      const users = await getUsersCollection();
      const user = await users.findOne({ email });
      if (!user || !verifyPassword(password, user)) {
        return res.status(401).json({ error: 'Credenciales no válidas.' });
      }
      const sid = createSession(user);
      res.cookie('sessionId', sid, getCookieOptions(req));
      return res.json({
        ok: true,
        id: (user._id || user.id || '').toString(),
        email: user.email,
        role: user.role || 'editor',
        nickname: user.nickname || ''
      });
    } catch (err) {
      console.error('login error', err);
      return res.status(500).json({ error: 'No se pudo iniciar sesión.' });
    }
  });

  router.get('/api/auth/google/config', (req, res) => {
    const config = googleOAuthConfig(req);
    res.json({ enabled: !authentikOnly() && !!(config.clientId && config.clientSecret) });
  });

  router.get('/api/auth/migration', (req, res) => {
    res.json({ end: process.env.AUTHENTIK_MIGRATION_END || null, authentikOnly: authentikOnly() });
  });

  router.get('/api/auth/authentik/config', (req, res) => {
    res.json({ enabled: authentikConfigured(), teacherOnly: true });
  });

  router.get('/api/auth/authentik/start', async (req, res) => {
    if (!authentikConfigured()) return res.status(503).json({ error: 'Authentik OIDC no está configurado.' });
    try {
      const endpoints = await authentikEndpoints();
      if (!endpoints.authorization_endpoint || !endpoints.token_endpoint || !endpoints.userinfo_endpoint) {
        throw new Error('El descubrimiento OIDC de Authentik está incompleto.');
      }
      cleanupOauthStates();
      const state = base64Url(crypto.randomBytes(24));
      const verifier = base64Url(crypto.randomBytes(48));
      const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
      const next = sanitizeRedirectTarget(req.query.next);
      authentikOauthStates.set(state, { next, verifier, endpoints, expiresAt: Date.now() + AUTHENTIK_OAUTH_STATE_TTL_MS });
      res.cookie('authentikOAuthState', state, getCookieOptions(req, { maxAge: AUTHENTIK_OAUTH_STATE_TTL_MS }));
      const params = new URLSearchParams({
        client_id: AUTHENTIK_CLIENT_ID,
        redirect_uri: authentikCallbackUrl(req),
        response_type: 'code',
        scope: AUTHENTIK_SCOPE,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256'
      });
      return res.redirect(`${endpoints.authorization_endpoint}?${params.toString()}`);
    } catch (err) {
      console.error('authentik-discovery error', err.message);
      return res.status(503).json({ error: 'No se ha podido conectar con Authentik.' });
    }
  });

  router.get('/api/auth/authentik/callback', async (req, res) => {
    let nextTarget = '/create/';
    try {
      const code = (req.query.code || '').toString();
      const state = (req.query.state || '').toString();
      const cookies = parseCookies(req.headers.cookie || '');
      const stored = authentikOauthStates.get(state);
      authentikOauthStates.delete(state);
      res.cookie('authentikOAuthState', '', getCookieOptions(req, { expires: new Date(0) }));
      if (stored && stored.next) nextTarget = sanitizeRedirectTarget(stored.next);
      if (!code || !state || !stored || stored.expiresAt <= Date.now()) throw new Error('Estado OIDC inválido o caducado.');
      if (cookies.authentikOAuthState !== state) throw new Error('La cookie de estado OIDC no coincide.');
      const config = {
        clientId: AUTHENTIK_CLIENT_ID,
        clientSecret: AUTHENTIK_CLIENT_SECRET,
        redirectUri: authentikCallbackUrl(req)
      };
      const tokenData = await exchangeAuthentikCode(code, config, stored.verifier, stored.endpoints);
      if (!tokenData.access_token) throw new Error('Authentik no devolvió access_token.');
      const profile = await fetchAuthentikProfile(tokenData.access_token, stored.endpoints.userinfo_endpoint);
      const user = await findOrCreateAuthentikUser(profile);
      const sid = createSession(user, 'authentik');
      res.cookie('sessionId', sid, getCookieOptions(req));
      const separator = nextTarget.includes('?') ? '&' : '?';
      return res.redirect(`${nextTarget}${separator}authentik=ok`);
    } catch (err) {
      console.error('authentik-auth error', err.message);
      const separator = nextTarget.includes('?') ? '&' : '?';
      return res.redirect(`${nextTarget}${separator}authentik=error`);
    }
  });

  router.get('/api/auth/google/start', (req, res) => {
    if (authentikOnly()) {
      return res.status(404).json({ error: 'Google está desactivado en el modo Authentik.' });
    }
    const config = googleOAuthConfig(req);
    if (!config.clientId || !config.clientSecret) {
      return res.status(503).json({ error: 'Google OAuth no está configurado.' });
    }
    cleanupOauthStates();
    const state = crypto.randomBytes(24).toString('hex');
    const next = sanitizeRedirectTarget(req.query.next);
    oauthStates.set(state, { next, expiresAt: Date.now() + GOOGLE_OAUTH_STATE_TTL_MS });
    res.cookie('googleOAuthState', state, getCookieOptions(req, {
      maxAge: GOOGLE_OAUTH_STATE_TTL_MS
    }));
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: GOOGLE_OAUTH_SCOPE,
      state,
      prompt: 'select_account'
    });
    return res.redirect(`${GOOGLE_OAUTH_AUTH_URL}?${params.toString()}`);
  });

  router.get('/api/auth/google/callback', async (req, res) => {
    if (authentikOnly()) return res.status(404).json({ error: 'Utiliza el acceso EduTicTac.' });
    let nextTarget = '/create/';
    try {
      const code = (req.query.code || '').toString();
      const state = (req.query.state || '').toString();
      const cookies = parseCookies(req.headers.cookie || '');
      const stored = oauthStates.get(state);
      oauthStates.delete(state);
      res.cookie('googleOAuthState', '', getCookieOptions(req, { expires: new Date(0) }));
      if (stored && stored.next) {
        nextTarget = sanitizeRedirectTarget(stored.next);
      }
      if (!code || !state || !stored || stored.expiresAt <= Date.now()) {
        const separator = nextTarget.includes('?') ? '&' : '?';
        return res.redirect(`${nextTarget}${separator}google=error`);
      }
      if (cookies.googleOAuthState && cookies.googleOAuthState !== state) {
        console.warn('google-auth state cookie mismatch; continuing with server-side OAuth state');
      }
      const config = googleOAuthConfig(req);
      if (!config.clientId || !config.clientSecret) {
        const separator = nextTarget.includes('?') ? '&' : '?';
        return res.redirect(`${nextTarget}${separator}google=error`);
      }
      const tokenData = await exchangeGoogleCode(code, config);
      if (!tokenData.access_token) {
        throw new Error('Google no devolvió access_token.');
      }
      const profile = await fetchGoogleProfile(tokenData.access_token);
      if (!profile.email_verified) {
        throw new Error('Email de Google no verificado.');
      }
      const user = await findOrCreateGoogleUser(profile);
      const sid = createSession(user, 'google');
      res.cookie('sessionId', sid, getCookieOptions(req));
      const separator = nextTarget.includes('?') ? '&' : '?';
      return res.redirect(`${nextTarget}${separator}google=ok`);
    } catch (err) {
      console.error('google-auth error', err);
      const separator = nextTarget.includes('?') ? '&' : '?';
      return res.redirect(`${nextTarget}${separator}google=error`);
    }
  });

  router.post('/api/auth/users', requireRole('admin'), async (req, res) => {
    if (authentikOnly()) return res.status(404).json({ error: 'Gestiona las cuentas desde EduTicTac.' });
    try {
      const email = (req.body.email || '').toLowerCase().trim();
      const password = req.body.password || '';
      const role = (req.body.role || 'editor').toLowerCase();
      const nickname = (req.body.nickname || '').trim();
      if (!email || !password) return res.status(400).json({ error: 'Faltan email o contraseña.' });
      if (!['editor', 'admin'].includes(role)) return res.status(400).json({ error: 'Rol no válido.' });
      const users = await getUsersCollection();
      const exists = await users.findOne({ email });
      if (exists) return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });
      const { salt, hash } = hashPassword(password);
      const user = { email, passwordSalt: salt, passwordHash: hash, role, createdAt: new Date() };
      if (nickname) user.nickname = nickname;
      await users.insertOne(user);
      return res.json({ ok: true });
    } catch (err) {
      console.error('create-user error', err);
      return res.status(500).json({ error: 'No se pudo crear el usuario.' });
    }
  });

  router.post('/api/auth/reset-admin', requireRole('admin'), async (req, res) => {
    if (authentikOnly()) return res.status(404).json({ error: 'Gestiona las cuentas desde EduTicTac.' });
    try {
      const email = (req.body.email || '').toLowerCase().trim();
      const password = req.body.password || '';
      if (!email || !password) return res.status(400).json({ error: 'Faltan email o contraseña.' });
      const users = await getUsersCollection();
      const user = await users.findOne({ email });
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
      const newFields = setPasswordFields(password);
      await users.updateOne({ _id: user._id }, { $set: { ...newFields } });
      return res.json({ ok: true });
    } catch (err) {
      console.error('reset-admin error', err);
      return res.status(500).json({ error: 'No se pudo actualizar la contraseña.' });
    }
  });

  router.post('/api/auth/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie || '');
    const sid = cookies.sessionId;
    if (sid) sessions.delete(sid);
    res.cookie('sessionId', '', getCookieOptions(req, { expires: new Date(0) }));
    return res.json({ ok: true });
  });

  router.get('/api/auth/me', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    return res.json({ id: req.user.id, email: req.user.email, role: req.user.role || 'editor', nickname: req.user.nickname || '' });
  });

  router.patch('/api/auth/profile', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    try {
      const nickname = (req.body.nickname || '').trim();
      const users = await getUsersCollection();
      await users.updateOne({ _id: new ObjectId(req.user.id) }, { $set: { nickname } });
      // Update session data
      for (const [sid, session] of sessions.entries()) {
        if (session.userId === req.user.id) {
          sessions.set(sid, { ...session, nickname });
        }
      }
      return res.json({ ok: true, nickname });
    } catch (err) {
      console.error('update-nick error', err);
      return res.status(500).json({ error: 'No se pudo actualizar el perfil.' });
    }
  });

  // Solicitar token de reseteo (se guarda en BD y se muestra en logs)
  router.post('/api/auth/request-reset', authRateLimiter, async (req, res) => {
    if (authentikOnly()) return res.status(404).json({ error: 'Utiliza el acceso EduTicTac.' });
    try {
      const email = (req.body.email || '').toLowerCase().trim();
      if (!email) return res.status(400).json({ error: 'Falta email.' });
      const users = await getUsersCollection();
      const user = await users.findOne({ email });
      if (user) {
        const token = crypto.randomBytes(24).toString('hex');
        const tokenHash = hashResetToken(token);
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
        await users.updateOne(
          { _id: user._id },
          { $set: { resetTokenHash: tokenHash, resetExpires: expires }, $unset: { resetToken: '' } }
        );
        // El token solo se muestra en desarrollo local; en cualquier otro entorno no se registra ni token ni email.
        if (process.env.NODE_ENV === 'development') {
          console.log(`[password-reset] Para ${email} usa el token: ${token} (caduca ${expires.toISOString()})`);
        } else {
          console.log(`[password-reset] Token generado (caduca ${expires.toISOString()})`);
        }
      }
      // responder genérico para no filtrar emails
      return res.json({ ok: true });
    } catch (err) {
      console.error('request-reset error', err);
      return res.status(500).json({ error: 'No se pudo procesar la solicitud.' });
    }
  });

  // Resetear contraseña usando token
  router.post('/api/auth/reset', authRateLimiter, async (req, res) => {
    if (authentikOnly()) return res.status(404).json({ error: 'Utiliza el acceso EduTicTac.' });
    try {
      const token = (req.body.token || '').trim();
      const tokenHash = hashResetToken(token);
      const password = req.body.password || '';
      if (!token || !password) return res.status(400).json({ error: 'Faltan token o contraseña.' });
      const users = await getUsersCollection();
      const user = await users.findOne({
        resetTokenHash: tokenHash,
        resetExpires: { $gt: new Date() }
      });
      if (!user) {
        return res.status(400).json({ error: 'Token no válido o caducado.' });
      }
      const newFields = setPasswordFields(password);
      await users.updateOne(
        { _id: user._id },
        { $set: { ...newFields }, $unset: { resetTokenHash: '', resetToken: '', resetExpires: '' } }
      );
      return res.json({ ok: true });
    } catch (err) {
      console.error('reset error', err);
      return res.status(500).json({ error: 'No se pudo actualizar la contraseña.' });
    }
  });

  return router;
};
