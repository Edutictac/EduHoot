const { test } = require('node:test');
const assert = require('node:assert/strict');

const { stageGate, stageNoIndex, redirectState, effectiveKey, COOKIE, HEADER } = require('../../server/stageGate');

const KEY = 'clau-de-prova-12345';
const STAGE = { NODE_ENV: 'staging', STAGE_DEV_KEY: KEY };

function run(mw, { method = 'GET', url = '/', headers = {} } = {}) {
    return new Promise(resolve => {
        const out = { headers: {}, next: false, status: 200 };
        const req = { method, originalUrl: url, path: url.split('?')[0], headers, secure: false };
        const res = {
            set(k, v) { out.headers[String(k).toLowerCase()] = v; return this; },
            type() { return this; },
            status(code) { out.status = code; return this; },
            json(body) { out.body = body; resolve(out); },
            send(body) { out.body = body; resolve(out); },
            redirect(code, to) { out.status = code; out.location = to; resolve(out); }
        };
        Promise.resolve(mw(req, res, () => { out.next = true; resolve(out); })).catch(e => resolve({ error: e }));
    });
}

test('fora de stage o sense clau no fa res', async () => {
    assert.equal((await run(stageGate({ NODE_ENV: 'production', STAGE_DEV_KEY: KEY }))).next, true);
    assert.equal((await run(stageGate({ NODE_ENV: 'staging' }))).next, true);
    assert.equal((await run(stageGate({ NODE_ENV: 'staging', STAGE_DEV_KEY: 'curta' }))).next, true);
});

test('en stage la gent sense cookie va a producció amb el mateix camí (302)', async () => {
    const r = await run(stageGate(STAGE), { url: '/create/?lang=va' });
    assert.equal(r.next, false);
    assert.equal(r.status, 302);
    assert.equal(r.location, 'https://eduhoot.edutictac.es/create/?lang=va');
    assert.equal(r.headers['cache-control'], 'no-store');
});

test('STAGE_REDIRECT_URL canvia el destí', async () => {
    const r = await run(stageGate({ ...STAGE, STAGE_REDIRECT_URL: 'https://prod.example/' }), { url: '/x' });
    assert.equal(r.location, 'https://prod.example/x');
});

test('amb /?dev=<clau> es guarda la cookie i es lleva el paràmetre', async () => {
    const mw = stageGate(STAGE);
    const r = await run(mw, { url: `/create/?lang=va&dev=${KEY}` });
    assert.equal(r.status, 302);
    assert.equal(r.location, '/create/?lang=va');
    const cookie = r.headers['set-cookie'];
    assert.match(cookie, new RegExp(`^${COOKIE}=[0-9a-f]{64};`));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.ok(!cookie.includes(KEY), 'la cookie no du la clau');
    const again = await run(mw, { headers: { cookie: cookie.split(';')[0] } });
    assert.equal(again.next, true);
});

test('una clau o una cookie errònies no entren', async () => {
    const mw = stageGate(STAGE);
    assert.equal((await run(mw, { url: '/?dev=equivocada-12345' })).location, 'https://eduhoot.edutictac.es/?dev=equivocada-12345');
    assert.equal((await run(mw, { headers: { cookie: `${COOKIE}=abc` } })).status, 302);
});

test('Secure només darrere de HTTPS', async () => {
    const r = await run(stageGate(STAGE), { url: `/?dev=${KEY}`, headers: { 'x-forwarded-proto': 'https' } });
    assert.match(r.headers['set-cookie'], /; Secure/);
});

test('la capçalera de les eines deixa passar; /api/version i robots.txt sempre', async () => {
    const mw = stageGate(STAGE);
    assert.equal((await run(mw, { headers: { [HEADER]: KEY } })).next, true);
    assert.equal((await run(mw, { headers: { [HEADER]: 'no' } })).status, 302);
    assert.equal((await run(mw, { url: '/api/version' })).next, true);
    assert.equal((await run(mw, { url: '/robots.txt' })).next, true);
});

test('els mètodes que no són GET no es redirigixen: 403', async () => {
    const r = await run(stageGate(STAGE), { method: 'POST', url: '/api/x' });
    assert.equal(r.status, 403);
    assert.equal(r.location, undefined);
});

test('interruptor: l\'ajust guardat el desactiva i el torna a activar', async () => {
    let setting = { enabled: true };
    const mw = stageGate(STAGE, async () => setting);
    assert.equal((await run(mw)).status, 302);
    setting = { enabled: false };
    const { setTimeout: wait } = require('node:timers/promises');
    await wait(3100);
    assert.equal((await run(mw)).next, true);
    setting = { enabled: true };
    await wait(3100);
    assert.equal((await run(mw)).status, 302);
});

test('interruptor: STAGE_REDIRECT=off preval sobre l\'ajust', async () => {
    const mw = stageGate({ ...STAGE, STAGE_REDIRECT: 'off' }, async () => ({ enabled: true }));
    assert.equal((await run(mw)).next, true);
});

test('si no es pot llegir l\'ajust, es manté la redirecció activa', async () => {
    const mw = stageGate(STAGE, async () => { throw new Error('sense BD'); });
    assert.equal((await run(mw)).status, 302);
});

test('redirectState resumix què s\'aplica', () => {
    assert.deepEqual(redirectState(STAGE, {}), { stage: true, keyConfigured: true, forcedOff: false, enabled: true, active: true });
    assert.equal(redirectState(STAGE, { enabled: false }).active, false);
    assert.equal(redirectState({ ...STAGE, STAGE_REDIRECT: 'OFF' }, { enabled: true }).active, false);
    assert.equal(redirectState({ NODE_ENV: 'production', STAGE_DEV_KEY: KEY }, {}).active, false);
});

test('sense clau d\'entorn: apagada per defecte i, amb clau guardada, mana l\'ajust', async () => {
    const env = { NODE_ENV: 'staging' };
    assert.equal(redirectState(env, {}).active, false);
    assert.equal(redirectState(env, { enabled: true }).active, false, 'sense clau no pot activar-se');
    assert.equal(redirectState(env, { enabled: true, key: KEY }).active, true);
    assert.equal(redirectState(env, { enabled: false, key: KEY }).active, false);
    assert.equal(effectiveKey(env, { key: 'curta' }), '');
    assert.equal(effectiveKey({ ...env, STAGE_DEV_KEY: KEY }, { key: 'una-altra-clau-12345' }), KEY, 'l\'entorn preval');
    const mw = stageGate(env, async () => ({ enabled: true, key: KEY }));
    assert.equal((await run(mw)).status, 302);
    assert.equal((await run(mw, { url: `/?dev=${KEY}` })).location, '/');
});

test('stage no s\'indexa: capçalera i robots.txt; la resta d\'entorns no canvia', async () => {
    const r = await run(stageNoIndex({ NODE_ENV: 'staging' }), { url: '/robots.txt' });
    assert.equal(r.headers['x-robots-tag'], 'noindex, nofollow');
    assert.equal(r.body, 'User-agent: *\nDisallow: /\n');
    const p = await run(stageNoIndex({ NODE_ENV: 'production' }), { url: '/robots.txt' });
    assert.equal(p.next, true);
    assert.equal(p.headers['x-robots-tag'], undefined);
});
