// Content Security Policy (issue #20). Segona barrera contra XSS: encara que
// algun text d'usuari (noms, quizzes importats) arribara a pintar-se com a
// HTML, el navegador no executaria scripts en línia ni de llocs no permesos.
//
// - 'unsafe-eval': Vue compila en el navegador les plantilles <template> de
//   les pàgines (no hi ha pas de build). Les plantilles són fixes; el text
//   d'usuari hi entra com a dades.
// - Estils en línia permesos (`style="…"` i els que posa Vue): risc baix.
// - Imatges i vídeos de qualsevol lloc https: els qüestionaris en porten.
// - CSP_REPORT_ONLY=true la deixa en mode informe (no bloqueja, només avisa
//   en la consola), per si cal provar un origen nou sense trencar res.

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch (e) {
    return '';
  }
}

// Socket.IO: alguns navegadors antics (Safari < 15.4) no inclouen ws/wss
// del mateix host dins de 'self'.
function sameHostWebSocket(req) {
  const proto = req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' ? 'wss:' : 'ws:';
  return proto + '//' + (req.headers.host || 'localhost');
}

function buildCspDirectives(commonsUrl) {
  const commons = originOf(commonsUrl);
  const withCommons = (list) => (commons ? list.concat(commons) : list);
  return {
    defaultSrc: ["'self'"],
    scriptSrc: withCommons(["'self'", "'unsafe-eval'", 'https://cdn.jsdelivr.net']),
    connectSrc: withCommons(["'self'", (req) => sameHostWebSocket(req)]),
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
    frameSrc: ["'self'", 'https://www.youtube-nocookie.com'],
    styleSrc: withCommons(["'self'", "'unsafe-inline'"]),
    fontSrc: withCommons(["'self'", 'data:']),
    workerSrc: ["'self'"],
    manifestSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'"]
  };
}

// Opcions per a helmet({ contentSecurityPolicy: ... }). Sense els valors per
// defecte de Helmet: el seu upgrade-insecure-requests trencaria una
// instal·lació local servida per http.
function cspOptions(commonsUrl, reportOnly) {
  return {
    useDefaults: false,
    reportOnly: !!reportOnly,
    directives: buildCspDirectives(commonsUrl)
  };
}

module.exports = { buildCspDirectives, cspOptions, originOf };
