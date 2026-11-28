const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// WCAG 1.4.3: el texto blanco sobre los botones de respuesta debe tener al menos 4,5:1 en todo el degradado.
const CSS = path.join(__dirname, '..', '..', 'public', 'css');

function lum(hex) {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrastWithWhite(hex) {
    return 1.05 / (lum(hex) + 0.05);
}

// Selectores cuyo texto es blanco sobre un degradado de color.
const FILES = {
    'answers.css': /\.answer-shape--\d\s*\{\s*background:\s*linear-gradient\(135deg,\s*(#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/gi,
    'hostGameView.css': /(?:#answer\d|\.results-bar--\d \.results-bar-key)\s*\{\s*background:\s*linear-gradient\(135deg,\s*(#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/gi,
    'multiplayer.css': /\.answer:nth-child\(\d\)\s*\{\s*background:\s*linear-gradient\(135deg,\s*(#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/gi
};

for (const [file, re] of Object.entries(FILES)) {
    test(`${file}: texto blanco sobre los botones de respuesta con contraste ≥ 4,5:1`, () => {
        const css = fs.readFileSync(path.join(CSS, file), 'utf8');
        const found = [...css.matchAll(re)];
        assert.ok(found.length >= 4, 'se esperaban los cuatro colores de respuesta');
        for (const m of found) {
            for (const color of [m[1], m[2]]) {
                const ratio = contrastWithWhite(color);
                assert.ok(ratio >= 4.5, `${m[0].split('{')[0].trim()} ${color}: ${ratio.toFixed(2)}`);
            }
        }
    });
}
