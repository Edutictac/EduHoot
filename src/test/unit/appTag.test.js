const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { readAppTag, shortCommit } = require('../../server/appTag');

function tagFile(content) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apptag-'));
    const file = path.join(dir, '.app-tag');
    if (content !== null) fs.writeFileSync(file, content);
    return file;
}

test('APP_TAG de l\'entorn mana', () => {
    assert.equal(readAppTag({ APP_TAG: 'stage-2026.11.28-2' }, tagFile('stage-altra')), 'stage-2026.11.28-2');
});

test('amb APP_TAG buida (o absent) es llig el fitxer de la imatge', () => {
    assert.equal(readAppTag({ APP_TAG: '' }, tagFile('stage-2026.11.28-2')), 'stage-2026.11.28-2');
    assert.equal(readAppTag({}, tagFile('stage-2026.11.28-2\n')), 'stage-2026.11.28-2');
});

test('sense entorn ni fitxer (dev) torna buit', () => {
    assert.equal(readAppTag({}, tagFile(null)), '');
    assert.equal(readAppTag({ APP_TAG: '  ' }, tagFile('')), '');
});

const SHA = '0123456789abcdef0123456789abcdef01234567';

function gitDir({ head, refs = {}, packed = '' }) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitdir-'));
    fs.writeFileSync(path.join(dir, 'HEAD'), head);
    for (const [ref, sha] of Object.entries(refs)) {
        fs.mkdirSync(path.dirname(path.join(dir, ref)), { recursive: true });
        fs.writeFileSync(path.join(dir, ref), sha + '\n');
    }
    if (packed) fs.writeFileSync(path.join(dir, 'packed-refs'), packed);
    return dir;
}

test('shortCommit: branca, packed-refs, HEAD solt i res', () => {
    assert.equal(shortCommit(gitDir({ head: 'ref: refs/heads/x\n', refs: { 'refs/heads/x': SHA } })), '0123456');
    assert.equal(shortCommit(gitDir({ head: 'ref: refs/heads/y\n', packed: `# pack\n${SHA} refs/heads/y\n` })), '0123456');
    assert.equal(shortCommit(gitDir({ head: SHA + '\n' })), '0123456');
    assert.equal(shortCommit(gitDir({ head: 'ref: refs/heads/z\n' })), '');
    assert.equal(shortCommit(path.join(os.tmpdir(), 'no-existeix-git')), '');
});

test('el commit curt només es mostra en desenvolupament i després de l\'etiqueta', () => {
    const dir = gitDir({ head: SHA });
    const none = tagFile(null);
    assert.equal(readAppTag({ NODE_ENV: 'development' }, none, [dir]), '0123456');
    assert.equal(readAppTag({ NODE_ENV: 'development', APP_TAG: 'stage-1' }, none, [dir]), 'stage-1');
    assert.equal(readAppTag({ NODE_ENV: 'production' }, none, [dir]), '');
    assert.equal(readAppTag({ NODE_ENV: 'staging' }, none, [dir]), '');
    assert.equal(readAppTag({ NODE_ENV: 'development' }, none, [path.join(os.tmpdir(), 'cap')]), '');
});
