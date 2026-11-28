'use strict';
// Stage: ningú que no siga desenvolupador entra; la resta va a producció.
// Només actua amb NODE_ENV=staging i amb una clau (STAGE_DEV_KEY o la que genera
// l'admin amb el botó; sense clau, stage queda obert, com abans). Qui entra una vegada amb /?dev=<clau> rep una cookie
// i ja no es redirigix. Les eines (curl, proves) poden enviar la capçalera
// X-Stage-Dev-Key. Stage tampoc s'indexa mai (X-Robots-Tag i robots.txt).
// Interruptor: l'admin de stage activa o desactiva la redirecció en calent
// (ajust `stageRedirectEnabled` de la col·lecció settings, per defecte activada);
// STAGE_REDIRECT=off la desactiva per a tothom i preval sobre l'ajust.
const crypto = require('crypto');

const COOKIE = 'eduhoot_stage_dev';
const HEADER = 'x-stage-dev-key';
const MIN_KEY_LENGTH = 12;
const COOKIE_MAX_AGE_S = 90 * 24 * 3600;
const DEFAULT_TARGET = 'https://eduhoot.edutictac.es';
// Sempre accessibles, perquè les comprovacions de salut no seguisquen redireccions.
const OPEN_PATHS = new Set(['/api/version', '/robots.txt']);

function cookieValue(key) {
    return crypto.createHash('sha256').update('eduhoot-stage-gate:' + key).digest('hex');
}

function sameText(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function readCookie(header, name) {
    for (const part of String(header || '').split(';')) {
        const i = part.indexOf('=');
        if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
    }
    return '';
}

function isStage(env) {
    return env.NODE_ENV === 'staging';
}

// X-Robots-Tag en totes les respostes i robots.txt que ho prohibix tot.
function stageNoIndex(env = process.env) {
    return (req, res, next) => {
        if (!isStage(env)) return next();
        res.set('X-Robots-Tag', 'noindex, nofollow');
        if (req.path === '/robots.txt') return res.type('text/plain').send('User-agent: *\nDisallow: /\n');
        next();
    };
}

// Clau efectiva: STAGE_DEV_KEY (entorn) o, si no n'hi ha, la que genera l'admin en
// activar la redirecció des del botó (guardada amb l'ajust, sense tocar el VPS).
// `setting` = { enabled, key } guardat a la BD (pot ser buit).
function effectiveKey(env, setting) {
    const fromEnv = String(env.STAGE_DEV_KEY || '');
    if (fromEnv.length >= MIN_KEY_LENGTH) return fromEnv;
    const stored = String((setting && setting.key) || '');
    return stored.length >= MIN_KEY_LENGTH ? stored : '';
}

// `active` és el que s'aplica. Sense ajust guardat, la redirecció està activa només si
// hi ha STAGE_DEV_KEY; amb ajust, mana l'ajust. `forcedOff` = STAGE_REDIRECT=off.
function redirectState(env, setting) {
    const key = effectiveKey(env, setting);
    const forcedOff = String(env.STAGE_REDIRECT || '').toLowerCase() === 'off';
    const saved = setting && typeof setting.enabled === 'boolean' ? setting.enabled : undefined;
    const enabled = saved !== undefined ? saved : String(env.STAGE_DEV_KEY || '').length >= MIN_KEY_LENGTH;
    return {
        stage: isStage(env),
        keyConfigured: key !== '',
        forcedOff,
        enabled,
        active: isStage(env) && key !== '' && !forcedOff && enabled
    };
}

function newKey() {
    return crypto.randomBytes(18).toString('base64url');
}

function cookieHeader(key, secure) {
    return `${COOKIE}=${cookieValue(key)}; Path=/; Max-Age=${COOKIE_MAX_AGE_S}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

function isSecure(req) {
    return Boolean(req.secure || (req.headers && req.headers['x-forwarded-proto'] === 'https'));
}

// readSetting() torna (promesa de) { enabled, key }; es llig com a molt cada SETTING_TTL_MS.
const SETTING_TTL_MS = 3000;

function stageGate(env = process.env, readSetting = async () => ({})) {
    if (!isStage(env)) return (req, res, next) => next();
    const target = String(env.STAGE_REDIRECT_URL || DEFAULT_TARGET).replace(/\/+$/, '');
    let cached = {};
    let readAt = 0;

    async function current() {
        if (Date.now() - readAt > SETTING_TTL_MS) {
            readAt = Date.now();
            try { cached = (await readSetting()) || {}; } catch (err) { /* sense BD, es manté l'últim valor */ }
        }
        return cached;
    }

    return async (req, res, next) => {
        if (OPEN_PATHS.has(req.path)) return next();
        const setting = await current();
        const state = redirectState(env, setting);
        if (!state.active) return next();
        const key = effectiveKey(env, setting);
        if (sameText(readCookie(req.headers.cookie, COOKIE), cookieValue(key))) return next();
        const sent = req.headers[HEADER];
        if (typeof sent === 'string' && sameText(sent, key)) return next();

        const canRedirect = req.method === 'GET' || req.method === 'HEAD';
        const url = new URL(req.originalUrl, 'http://stage.invalid');
        const offered = url.searchParams.get('dev');
        if (canRedirect && offered !== null && sameText(offered, key)) {
            res.set('Set-Cookie', cookieHeader(key, isSecure(req)));
            url.searchParams.delete('dev');
            res.set('Cache-Control', 'no-store');
            return res.redirect(302, url.pathname + url.search);
        }
        res.set('Cache-Control', 'no-store');
        if (!canRedirect) return res.status(403).json({ error: 'Stage' });
        // 302 i no 301: un 301 quedaria en la caché del navegador i impediria entrar després.
        return res.redirect(302, target + req.originalUrl);
    };
}

module.exports = { stageGate, stageNoIndex, redirectState, effectiveKey, newKey, cookieHeader, isSecure, COOKIE, HEADER };
