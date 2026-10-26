#!/usr/bin/env node

// Proveïdor OIDC simulat per a l'entorn de desenvolupament (docker compose).
// Fa d'Authentik: /authorize mostra uns usuaris de prova per a triar amb un
// clic, /token valida el codi i el PKCE (S256) i /userinfo retorna email,
// email_verified i groups. Només mòduls de Node; mai s'ha d'usar fora de dev.

const http = require('http');
const crypto = require('crypto');

const CODE_TTL_MS = 2 * 60 * 1000;
const TOKEN_TTL_MS = 60 * 60 * 1000;

// Els correus coincidixen amb els usuaris de seed-dev-data.js: en entrar, EduHoot
// els vincula per correu i conserven el rol del seed (admin/editor).
const USERS = [
  { sub: 'admin@exemple.local', email: 'admin@exemple.local', name: 'Admin de prova', groups: ['professorat', 'admin'] },
  { sub: 'docent1@exemple.local', email: 'docent1@exemple.local', name: 'Docent de prova 1', groups: ['professorat'] },
  { sub: 'docent2@exemple.local', email: 'docent2@exemple.local', name: 'Docent de prova 2', groups: ['professorat'] },
  { sub: 'docent3@exemple.local', email: 'docent3@exemple.local', name: 'Docent de prova 3', groups: ['professorat'] },
  { sub: 'docent4@exemple.local', email: 'docent4@exemple.local', name: 'Docent de prova 4', groups: ['professorat'] },
  { sub: 'docent.nou@exemple.local', email: 'docent.nou@exemple.local', name: 'Docent nou (sense compte)', groups: ['professorat'] },
  { sub: 'alumne@exemple.local', email: 'alumne@exemple.local', name: 'Alumne (sense rol docent)', groups: ['alumnat'] }
];

function base64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(new URLSearchParams(data)));
  });
}

function renderAuthorizePage(query) {
  const items = USERS.map((user) => {
    const params = new URLSearchParams(query);
    params.set('user', user.sub);
    return `<li><a href="/authorize/approve?${escapeHtml(params.toString())}">
      <strong>${escapeHtml(user.name)}</strong>
      <span>${escapeHtml(user.email)} · groups: ${escapeHtml(user.groups.join(', '))}</span></a></li>`;
  }).join('');
  return `<!doctype html>
<html lang="ca-valencia">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>OIDC simulat · EduHoot dev</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 16px; color: #1f2937; }
  ul { list-style: none; padding: 0; }
  li { margin: 0.5rem 0; }
  a { display: block; padding: 0.75rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; color: inherit; text-decoration: none; }
  a:hover { background: #f3f4f6; }
  span { display: block; font-size: 0.85rem; color: #6b7280; }
  .warning { background: #fff7ed; border: 1px solid #fdba74; padding: 0.75rem 1rem; border-radius: 8px; }
</style>
</head>
<body>
  <h1>🛠️ OIDC simulat</h1>
  <p class="warning">Fa d'Authentik en l'entorn de desenvolupament. Tria amb qui vols entrar a EduHoot.</p>
  <ul>${items}</ul>
</body>
</html>`;
}

function createDevOidcServer({ issuer, clientId, clientSecret }) {
  const codes = new Map();
  const tokens = new Map();

  function cleanup() {
    const now = Date.now();
    for (const [key, value] of codes) if (value.expiresAt <= now) codes.delete(key);
    for (const [key, value] of tokens) if (value.expiresAt <= now) tokens.delete(key);
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const query = url.searchParams;
    cleanup();

    if (req.method === 'GET' && url.pathname === '/.well-known/openid-configuration') {
      return sendJson(res, 200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        userinfo_endpoint: `${issuer}/userinfo`,
        response_types_supported: ['code'],
        code_challenge_methods_supported: ['S256']
      });
    }

    if (req.method === 'GET' && url.pathname === '/authorize') {
      if (query.get('client_id') !== clientId || query.get('response_type') !== 'code' || !query.get('redirect_uri')) {
        return sendJson(res, 400, { error: 'invalid_request' });
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(renderAuthorizePage(query));
    }

    if (req.method === 'GET' && url.pathname === '/authorize/approve') {
      const user = USERS.find((u) => u.sub === query.get('user'));
      const redirectUri = query.get('redirect_uri');
      if (!user || query.get('client_id') !== clientId || !redirectUri) {
        return sendJson(res, 400, { error: 'invalid_request' });
      }
      const code = base64Url(crypto.randomBytes(24));
      codes.set(code, {
        user,
        redirectUri,
        challenge: query.get('code_challenge') || '',
        expiresAt: Date.now() + CODE_TTL_MS
      });
      const target = new URL(redirectUri);
      target.searchParams.set('code', code);
      if (query.get('state')) target.searchParams.set('state', query.get('state'));
      res.writeHead(302, { Location: target.toString() });
      return res.end();
    }

    if (req.method === 'POST' && url.pathname === '/token') {
      const body = await readBody(req);
      const stored = codes.get(body.get('code') || '');
      codes.delete(body.get('code') || '');
      if (body.get('client_id') !== clientId || body.get('client_secret') !== clientSecret) {
        return sendJson(res, 401, { error: 'invalid_client' });
      }
      if (!stored || body.get('grant_type') !== 'authorization_code' || body.get('redirect_uri') !== stored.redirectUri) {
        return sendJson(res, 400, { error: 'invalid_grant' });
      }
      const verifier = body.get('code_verifier') || '';
      const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
      if (!stored.challenge || challenge !== stored.challenge) {
        return sendJson(res, 400, { error: 'invalid_grant', error_description: 'PKCE no vàlid' });
      }
      const accessToken = base64Url(crypto.randomBytes(32));
      tokens.set(accessToken, { user: stored.user, expiresAt: Date.now() + TOKEN_TTL_MS });
      return sendJson(res, 200, { access_token: accessToken, token_type: 'Bearer', expires_in: TOKEN_TTL_MS / 1000 });
    }

    if (req.method === 'GET' && url.pathname === '/userinfo') {
      const auth = req.headers.authorization || '';
      const stored = tokens.get(auth.replace(/^Bearer\s+/i, ''));
      if (!stored) return sendJson(res, 401, { error: 'invalid_token' });
      const { sub, email, name, groups } = stored.user;
      return sendJson(res, 200, { sub, email, email_verified: true, name, preferred_username: email, groups });
    }

    return sendJson(res, 404, { error: 'not_found' });
  });
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || '8080', 10);
  const issuer = (process.env.OIDC_ISSUER || `http://localhost:${port}`).replace(/\/+$/, '');
  const clientId = process.env.OIDC_CLIENT_ID || 'eduhoot-dev';
  const clientSecret = process.env.OIDC_CLIENT_SECRET || 'dev-secret';
  createDevOidcServer({ issuer, clientId, clientSecret }).listen(port, '0.0.0.0', () => {
    console.log(`[dev-oidc] OIDC simulat en el port ${port} (issuer ${issuer})`);
  });
}

module.exports = { createDevOidcServer, USERS };
