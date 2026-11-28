const { test } = require('node:test');
const assert = require('node:assert/strict');

const { buildCspDirectives, cspOptions } = require('../../server/csp');

// Issue #20: la CSP ha de permetre el Commons configurat, no un de fix.
test('inclou l’origen del Commons configurat, sense el camí', () => {
    const d = buildCspDirectives('http://edutictac.local:8082/commons');
    for (const name of ['scriptSrc', 'connectSrc', 'styleSrc', 'fontSrc']) {
        assert.ok(d[name].includes('http://edutictac.local:8082'), name);
        assert.ok(!d[name].includes('https://commons.edutictac.es'), name);
    }
});

test('no permet scripts en línia ni objectes', () => {
    const d = buildCspDirectives('https://commons.edutictac.es');
    assert.ok(!d.scriptSrc.includes("'unsafe-inline'"));
    assert.ok(d.scriptSrc.includes("'unsafe-eval'"), 'Vue compila les plantilles en el navegador');
    assert.deepEqual(d.objectSrc, ["'none'"]);
    assert.deepEqual(d.frameAncestors, ["'self'"]);
});

test('el WebSocket del mateix host segueix el protocol de la petició', () => {
    const fn = buildCspDirectives('https://commons.edutictac.es').connectSrc.find(v => typeof v === 'function');
    assert.equal(fn({ secure: false, headers: { host: 'localhost:3000' } }), 'ws://localhost:3000');
    assert.equal(fn({ secure: false, headers: { host: 'eduhoot.edutictac.es', 'x-forwarded-proto': 'https' } }), 'wss://eduhoot.edutictac.es');
});

test('sense valors per defecte de Helmet (no força https) i amb mode informe opcional', () => {
    assert.equal(cspOptions('https://commons.edutictac.es', false).useDefaults, false);
    assert.equal(cspOptions('https://commons.edutictac.es', false).reportOnly, false);
    assert.equal(cspOptions('https://commons.edutictac.es', true).reportOnly, true);
});
