const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// tts.js es un script de navegador; en Node exporta las funciones puras.
const tts = require(path.join(__dirname, '..', '..', 'public', 'js', 'tts.js'));

test('plainText treu les etiquetes i converteix <br> en pausa', () => {
    assert.equal(tts.plainText('Capital de <b>França</b>?'), 'Capital de França?');
    assert.equal(tts.plainText('Primera línia<br>Segona línia'), 'Primera línia. Segona línia');
    assert.equal(tts.plainText('  molts   espais\n\tiguals '), 'molts espais iguals');
});

test('plainText decodifica entitats bàsiques sense tornar a interpretar-les', () => {
    assert.equal(tts.plainText('A &amp; B'), 'A & B');
    assert.equal(tts.plainText('&lt;b&gt; literal'), '<b> literal');
    assert.equal(tts.plainText('&#233;s'), 'és');
    assert.equal(tts.plainText('&#x4F60;'), '你');
    assert.equal(tts.plainText(null), '');
    assert.equal(tts.plainText(undefined), '');
});

test('splitForSpeech deixa un text curt en un sol fragment', () => {
    assert.deepEqual(tts.splitForSpeech('Quant és 2 + 2?'), ['Quant és 2 + 2?']);
    assert.deepEqual(tts.splitForSpeech(''), []);
});

test('splitForSpeech no supera el màxim i no perd paraules', () => {
    const sentence = 'Aquesta frase és bastant llarga i repetida per a provar el trossejat. ';
    const text = sentence.repeat(12).trim();
    const chunks = tts.splitForSpeech(text, 100);
    assert.ok(chunks.length > 1, 'ha de partir-se en diversos fragments');
    chunks.forEach((c) => {
        assert.ok(c.length <= 100, `fragment massa llarg (${c.length})`);
        assert.ok(c.trim().length > 0, 'fragment buit');
    });
    assert.equal(chunks.join(' ').split(/\s+/).length, text.split(/\s+/).length);
});

test('splitForSpeech talla per espais una frase sense puntuació massa llarga', () => {
    const words = Array.from({ length: 60 }, (_, i) => 'paraula' + i).join(' ');
    const chunks = tts.splitForSpeech(words, 80);
    chunks.forEach((c) => assert.ok(c.length <= 80));
    assert.equal(chunks.join(' '), words);
});

test('bcp47 tria el codi de llengua segons l’idioma de l’app', () => {
    assert.equal(tts.bcp47('ca'), 'ca-ES');
    assert.equal(tts.bcp47('va'), 'ca-ES');
    assert.equal(tts.bcp47('ca-ES-valencia'), 'ca-ES');
    assert.equal(tts.bcp47('es'), 'es-ES');
    assert.equal(tts.bcp47('en'), 'en-US');
    assert.equal(tts.bcp47(''), 'es-ES');
});

test('sense speechSynthesis el botó no es mostra i no es parla', () => {
    assert.equal(tts.supported(), false);
    assert.equal(tts.canSpeak('es'), false);
    assert.equal(tts.speakParts(['Hola'], 'es', () => {}), false);
    assert.doesNotThrow(() => tts.cancel());
});
