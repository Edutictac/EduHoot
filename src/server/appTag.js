'use strict';
// Etiqueta amb la qual es va publicar la imatge (p. ex. stage-2026.11.28-2).
// 1) APP_TAG de l'entorn; 2) si està buida (p. ex. el VPS la sobreescriu), el
// fitxer `.app-tag` que el Dockerfile guarda en construir la imatge; 3) només
// en desenvolupament, el commit curt de Git (HEAD), per a saber què s'està provant.
const fs = require('fs');
const path = require('path');

function readFileOrEmpty(file) {
    try {
        return fs.readFileSync(file, 'utf8').trim();
    } catch (err) {
        return '';
    }
}

// Commit curt (7 caràcters) del HEAD d'un directori .git, sense executar git.
function shortCommit(gitDir) {
    const head = readFileOrEmpty(path.join(gitDir, 'HEAD'));
    if (!head) return '';
    if (!head.startsWith('ref: ')) return /^[0-9a-f]{40}$/.test(head) ? head.slice(0, 7) : '';
    const ref = head.slice(5).trim();
    let sha = readFileOrEmpty(path.join(gitDir, ref));
    if (!sha) {
        for (const line of readFileOrEmpty(path.join(gitDir, 'packed-refs')).split('\n')) {
            const [hash, name] = line.split(' ');
            if (name === ref) { sha = hash; break; }
        }
    }
    return /^[0-9a-f]{40}$/.test(sha) ? sha.slice(0, 7) : '';
}

// En docker-compose, `.git` es munta a /repo-git; fora de Docker, és el del projecte.
const DEFAULT_GIT_DIRS = ['/repo-git', path.join(__dirname, '..', '..', '.git')];

function readAppTag(env = process.env, file = path.join(__dirname, '..', '.app-tag'), gitDirs = DEFAULT_GIT_DIRS) {
    const fromEnv = String(env.APP_TAG || '').trim();
    if (fromEnv) return fromEnv;
    const fromFile = readFileOrEmpty(file);
    if (fromFile) return fromFile;
    if (env.NODE_ENV !== 'development') return '';
    for (const dir of gitDirs) {
        const sha = shortCommit(dir);
        if (sha) return sha;
    }
    return '';
}

module.exports = { readAppTag, shortCommit };
