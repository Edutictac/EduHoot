const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

function readPrecacheList() {
    const sw = fs.readFileSync(path.join(PUBLIC_DIR, 'sw.js'), 'utf8');
    const start = sw.indexOf('const ASSETS = [');
    const end = sw.indexOf('];', start);
    assert.ok(start !== -1 && end !== -1, 'no se encuentra la lista ASSETS en sw.js');
    return new Set(Array.from(sw.slice(start, end).matchAll(/'(\/[^']*)'/g), m => m[1]));
}

function localScripts(pagePath) {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, pagePath), 'utf8');
    const base = path.posix.dirname(pagePath);
    return Array.from(html.matchAll(/<script[^>]*\ssrc\s*=\s*"([^"]+)"/g), m => m[1])
        .filter(src => !/^https?:\/\//.test(src))
        .map(src => (src.startsWith('/') ? src : path.posix.normalize(path.posix.join(base, src))))
        .filter(src => !src.startsWith('/socket.io/'));
}

// Si una página se guarda para usarla sin conexión pero alguno de sus
// scripts no, la página carga offline y se queda a medias. Pasa cada vez
// que se reparte un JS en varios ficheros y se olvida actualizar sw.js.
test('sw.js precachea todos los scripts locales de las páginas que precachea', () => {
    const assets = readPrecacheList();
    const pages = Array.from(assets).filter(asset => asset.endsWith('.html'));
    assert.ok(pages.length > 0);
    const missing = [];
    for (const page of pages) {
        for (const script of localScripts(page)) {
            if (!assets.has(script)) missing.push(script + ' (' + page + ')');
        }
    }
    assert.deepEqual(missing, [], 'Añade a ASSETS de sw.js (y sube CACHE_NAME): ' + missing.join(', '));
});
