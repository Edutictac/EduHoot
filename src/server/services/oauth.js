const http = require('http');
const { linkAuthentikUser } = require('../authentikUsers');
const { getUsersCollection } = require('../data/repositories');

const GOOGLE_OAUTH_SCOPE = 'openid email profile';
const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_OAUTH_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const AUTHENTIK_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const AUTHENTIK_TEACHER_ROLES = new Set(
  (process.env.AUTHENTIK_TEACHER_ROLES || 'professorat,profesor,teacher,docente,administrador,admin')
    .split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
);
const AUTHENTIK_ROLE_CLAIM = (process.env.AUTHENTIK_ROLE_CLAIM || 'groups').trim();
const AUTHENTIK_ISSUER = (process.env.AUTHENTIK_ISSUER || '').trim().replace(/\/+$/, '');
const AUTHENTIK_CLIENT_ID = (process.env.AUTHENTIK_CLIENT_ID || '').trim();
const AUTHENTIK_CLIENT_SECRET = process.env.AUTHENTIK_CLIENT_SECRET || '';
const AUTHENTIK_REDIRECT_URI = (process.env.AUTHENTIK_REDIRECT_URI || '').trim();
const AUTHENTIK_DISCOVERY_URL = (process.env.AUTHENTIK_DISCOVERY_URL || '').trim();
const AUTHENTIK_AUTHORIZATION_URL = (process.env.AUTHENTIK_AUTHORIZATION_URL || '').trim();
const AUTHENTIK_TOKEN_URL = (process.env.AUTHENTIK_TOKEN_URL || '').trim();
const AUTHENTIK_USERINFO_URL = (process.env.AUTHENTIK_USERINFO_URL || '').trim();
const AUTHENTIK_SCOPE = (process.env.AUTHENTIK_SCOPE || 'openid profile email groups').trim();
const AUTHENTIK_ONLY = /^(1|true|yes)$/i.test(process.env.AUTHENTIK_ONLY || '');

// Login amb Google i amb Authentik (OIDC): configuració, estats OAuth
// pendents, intercanvi de codi, perfil i alta/vinculació d'usuari.
// Mou el contingut de server.js, sense canviar comportament. Factoria
// perquè publicBaseUrl necessita el PORT del servidor.
module.exports = function createOAuthService({ PORT }) {
  const oauthStates = new Map();
  const authentikOauthStates = new Map();

  function publicBaseUrl(req) {
    const configured = (process.env.PUBLIC_BASE_URL || process.env.BASE_URL || '').trim();
    if (configured) return configured.replace(/\/+$/, '');
    const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
    const host = (req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`).toString().split(',')[0].trim();
    return `${proto}://${host}`;
  }

  function googleCallbackUrl(req) {
    const configured = (process.env.GOOGLE_CALLBACK_URL || '').trim();
    if (configured) return configured;
    return `${publicBaseUrl(req)}/api/auth/google/callback`;
  }

  function googleOAuthConfig(req) {
    return {
      clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
      clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
      redirectUri: googleCallbackUrl(req)
    };
  }

  function authentikCallbackUrl(req) {
    return AUTHENTIK_REDIRECT_URI || `${publicBaseUrl(req)}/api/auth/authentik/callback`;
  }

  function authentikDiscoveryUrl() {
    return AUTHENTIK_DISCOVERY_URL || (AUTHENTIK_ISSUER ? `${AUTHENTIK_ISSUER}/.well-known/openid-configuration` : '');
  }

  function authentikConfigured() {
    return !!(AUTHENTIK_ISSUER && AUTHENTIK_CLIENT_ID && AUTHENTIK_CLIENT_SECRET);
  }

  function authentikOnly() {
    const deadline = Date.parse(process.env.AUTHENTIK_MIGRATION_END || '');
    return AUTHENTIK_ONLY || (authentikConfigured() && Number.isFinite(deadline) && Date.now() >= deadline);
  }

  function base64Url(value) {
    return Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function authentikTeacher(profile) {
    const raw = profile && profile[AUTHENTIK_ROLE_CLAIM];
    const values = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return values.some((value) => AUTHENTIK_TEACHER_ROLES.has(String(value).trim().toLowerCase()));
  }

  function sanitizeRedirectTarget(raw) {
    const target = (raw || '').toString().trim();
    if (!target || !target.startsWith('/') || target.startsWith('//')) return '/create/';
    if (target === '/admin' || target === '/admin/' || target === '/admin-stats.html') {
      return '/admin/stats';
    }
    return target;
  }

  function cleanupOauthStates() {
    const now = Date.now();
    for (const [state, data] of oauthStates.entries()) {
      if (!data || data.expiresAt <= now) oauthStates.delete(state);
    }
    for (const [state, data] of authentikOauthStates.entries()) {
      if (!data || data.expiresAt <= now) authentikOauthStates.delete(state);
    }
  }

  function httpsJsonRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const target = new URL(url);
      const transport = target.protocol === 'http:' ? http : require('https');
      const body = options.body || '';
      const req = transport.request({
        method: options.method || 'GET',
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        headers: {
          Accept: 'application/json',
          ...(body ? {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body)
          } : {}),
          ...(options.headers || {})
        }
      }, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let data = {};
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch (err) {
            return reject(new Error('Respuesta OAuth no válida.'));
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            const msg = data.error_description || data.error || `HTTP ${res.statusCode}`;
            return reject(new Error(msg));
          }
          return resolve(data);
        });
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  async function exchangeGoogleCode(code, config) {
    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code'
    }).toString();
    return httpsJsonRequest(GOOGLE_OAUTH_TOKEN_URL, { method: 'POST', body });
  }

  async function fetchGoogleProfile(accessToken) {
    return httpsJsonRequest(GOOGLE_OAUTH_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  }

  async function authentikEndpoints() {
    const configured = {
      authorization_endpoint: AUTHENTIK_AUTHORIZATION_URL,
      token_endpoint: AUTHENTIK_TOKEN_URL,
      userinfo_endpoint: AUTHENTIK_USERINFO_URL
    };
    if (configured.authorization_endpoint && configured.token_endpoint && configured.userinfo_endpoint) return configured;
    const discoveryUrl = authentikDiscoveryUrl();
    if (!discoveryUrl) throw new Error('Authentik OIDC no está configurado.');
    const discovery = await httpsJsonRequest(discoveryUrl);
    return {
      authorization_endpoint: configured.authorization_endpoint || discovery.authorization_endpoint,
      token_endpoint: configured.token_endpoint || discovery.token_endpoint,
      userinfo_endpoint: configured.userinfo_endpoint || discovery.userinfo_endpoint
    };
  }

  async function exchangeAuthentikCode(code, config, verifier, endpoints) {
    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: verifier
    }).toString();
    return httpsJsonRequest(endpoints.token_endpoint, { method: 'POST', body });
  }

  async function fetchAuthentikProfile(accessToken, endpoint) {
    return httpsJsonRequest(endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
  }

  async function findOrCreateAuthentikUser(profile) {
    if (!authentikTeacher(profile)) throw new Error('La cuenta de Authentik no tiene rol docente.');
    return linkAuthentikUser(await getUsersCollection(), profile, AUTHENTIK_ISSUER);
  }

  async function findOrCreateGoogleUser(profile) {
    const email = (profile.email || '').toLowerCase().trim();
    if (!email) throw new Error('Google no devolvió email.');
    const users = await getUsersCollection();
    const now = new Date();
    const adminCount = await users.countDocuments({ role: 'admin' });
    const noAdminExists = adminCount === 0;
    const existing = await users.findOne({ email });
    if (existing) {
      const providers = Array.isArray(existing.authProviders) ? existing.authProviders : [];
      const update = {
        googleId: profile.sub,
        googlePicture: profile.picture || '',
        googleVerifiedEmail: !!profile.email_verified,
        lastLoginAt: now,
        updatedAt: now
      };
      if (!existing.nickname && profile.name) update.nickname = profile.name;
      if (!providers.includes('google')) update.authProviders = [...providers, 'google'];
      if (noAdminExists && existing.role !== 'admin') update.role = 'admin';
      await users.updateOne({ _id: existing._id }, { $set: update });
      return { ...existing, ...update };
    }
    const user = {
      email,
      googleId: profile.sub,
      googlePicture: profile.picture || '',
      googleVerifiedEmail: !!profile.email_verified,
      authProviders: ['google'],
      role: noAdminExists ? 'admin' : 'editor',
      nickname: profile.name || '',
      createdAt: now,
      lastLoginAt: now
    };
    const result = await users.insertOne(user);
    return { ...user, _id: result.insertedId };
  }

  return {
    oauthStates,
    authentikOauthStates,
    GOOGLE_OAUTH_SCOPE,
    GOOGLE_OAUTH_AUTH_URL,
    GOOGLE_OAUTH_STATE_TTL_MS,
    AUTHENTIK_OAUTH_STATE_TTL_MS,
    AUTHENTIK_CLIENT_ID,
    AUTHENTIK_CLIENT_SECRET,
    AUTHENTIK_SCOPE,
    googleOAuthConfig,
    authentikCallbackUrl,
    authentikConfigured,
    authentikOnly,
    base64Url,
    sanitizeRedirectTarget,
    cleanupOauthStates,
    exchangeGoogleCode,
    fetchGoogleProfile,
    authentikEndpoints,
    exchangeAuthentikCode,
    fetchAuthentikProfile,
    findOrCreateAuthentikUser,
    findOrCreateGoogleUser
  };
};
