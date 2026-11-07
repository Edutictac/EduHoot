const express = require('express');
const { getUsersCollection } = require('../data/repositories');

// Usuaris de prova creats per src/scripts/seed-dev-data.js (camp devSeedKey).
const USER_SEED_KEY_PREFIX = 'eduhoot-seed-user-';
const DEV_USER_PASSWORD = 'exemple1234';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPage(seedUsers, oidcEnabled) {
  const userButtons = seedUsers.length
    ? seedUsers.map((user) => `
        <li>
          <button type="button" data-email="${escapeHtml(user.email)}">
            Entrar com a <strong>${escapeHtml(user.nickname || user.email)}</strong>
            <span class="meta">${escapeHtml(user.email)} · ${escapeHtml(user.role || 'editor')}</span>
          </button>
        </li>`).join('')
    : '<li class="empty">No hi ha usuaris de prova. Executa <code>npm run seed:dev</code>.</li>';

  const oidcSection = oidcEnabled
    ? `<section>
        <h2>OIDC simulat (flux d'Authentik)</h2>
        <p>Passa pel mateix flux que l'Authentik real: rol docent segons <code>groups</code>.</p>
        <a class="link-button" href="/api/auth/authentik/start?next=%2Fcreate%2F">Entrar amb l'OIDC simulat</a>
      </section>`
    : '';

  return `<!doctype html>
<html lang="ca-valencia">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accés de desenvolupament · EduHoot</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 16px; color: #1f2937; }
  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.1rem; margin-top: 2rem; }
  ul { list-style: none; padding: 0; }
  li { margin: 0.5rem 0; }
  button, .link-button { display: block; width: 100%; text-align: left; padding: 0.75rem 1rem; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; font: inherit; color: inherit; cursor: pointer; text-decoration: none; box-sizing: border-box; }
  button:hover, .link-button:hover { background: #f3f4f6; }
  .meta { display: block; font-size: 0.85rem; color: #6b7280; }
  form { display: grid; gap: 0.5rem; }
  input { padding: 0.5rem; font: inherit; border: 1px solid #d1d5db; border-radius: 6px; }
  form button { text-align: center; }
  .warning { background: #fff7ed; border: 1px solid #fdba74; padding: 0.75rem 1rem; border-radius: 8px; }
  #status { min-height: 1.5rem; font-weight: 600; }
  #session { display: none; }
</style>
</head>
<body>
  <h1>🛠️ Accés de desenvolupament</h1>
  <p class="warning">Esta pàgina només existix quan <code>NODE_ENV=development</code>. En stage i producció l'únic accés docent és el xip d'EduTicTac.</p>
  <p id="status" role="status"></p>
  <section id="session">
    <p>Sessió actual: <strong id="session-user"></strong></p>
    <a class="link-button" href="/create/">Anar a /create/</a>
    <p><button type="button" id="logout">Eixir</button></p>
  </section>
  ${oidcSection}

  <section>
    <h2>Usuaris de prova del seed</h2>
    <ul id="seed-users">${userButtons}</ul>
  </section>

  <section>
    <h2>Altres usuaris locals</h2>
    <form id="login-form">
      <input name="email" type="email" placeholder="correu@exemple.local" autocomplete="username" required>
      <input name="password" type="password" placeholder="Contrasenya" autocomplete="current-password" required>
      <button type="submit">Entrar</button>
    </form>
  </section>

<script>
(function(){
  var statusEl = document.getElementById('status');

  function login(email, password){
    statusEl.textContent = 'Entrant…';
    fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    }).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(data){
        if(!res.ok) throw new Error(data.error || ('Error ' + res.status));
        window.location.href = '/create/';
      });
    }).catch(function(err){
      statusEl.textContent = 'No s\\'ha pogut entrar: ' + err.message;
    });
  }

  document.querySelectorAll('#seed-users button[data-email]').forEach(function(btn){
    btn.addEventListener('click', function(){ login(btn.getAttribute('data-email'), ${JSON.stringify(DEV_USER_PASSWORD)}); });
  });

  document.getElementById('login-form').addEventListener('submit', function(e){
    e.preventDefault();
    login(this.email.value, this.password.value);
  });

  document.getElementById('logout').addEventListener('click', function(){
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .then(function(){ window.location.reload(); });
  });

  fetch('/api/auth/me', { credentials: 'include' })
    .then(function(res){ return res.ok ? res.json() : null; })
    .then(function(user){
      if(!user) return;
      document.getElementById('session-user').textContent = user.email + ' (' + user.role + ')';
      document.getElementById('session').style.display = 'block';
    })
    .catch(function(){});
})();
</script>
</body>
</html>`;
}

module.exports = function createDevLoginRouter({ authentikConfigured }) {
  const router = express.Router();

  router.get('/dev/login', async (req, res) => {
    let seedUsers = [];
    try {
      const users = await getUsersCollection();
      seedUsers = await users
        .find({ devSeedKey: { $regex: `^${USER_SEED_KEY_PREFIX}` } }, { projection: { email: 1, nickname: 1, role: 1, devSeedKey: 1 } })
        .sort({ devSeedKey: 1 })
        .toArray();
    } catch (err) {
      console.error('dev-login: no s\'han pogut llegir els usuaris de prova', err.message);
    }
    res.set('Cache-Control', 'no-store');
    res.type('html').send(renderPage(seedUsers, authentikConfigured()));
  });

  return router;
};
