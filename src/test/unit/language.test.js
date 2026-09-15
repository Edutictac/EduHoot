const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../../public/js/i18n-player.js'), 'utf8');

function browser(href, values = new Map()) {
    const window = {
        location: { href, search: new URL(href).search, reload() {} },
        localStorage: {
            getItem: key => values.get(key) || null,
            setItem: (key, value) => values.set(key, value)
        },
        history: {
            state: { retained: true },
            replaceState(state, title, relative) {
                this.state = state;
                window.location.href = new URL(relative, window.location.href).href;
                window.location.search = new URL(window.location.href).search;
            }
        }
    };
    const document = { documentElement: { setAttribute() {} }, addEventListener() {} };
    function boot() {
        vm.runInNewContext(source, { window, document, navigator: { language: 'es' }, URL, URLSearchParams });
        return window.i18nPlayer;
    }
    return { window, boot, values };
}

test('explicit language change survives reload after a Valencian join link', () => {
    const page = browser('http://localhost:8090/join.html?pin=12345&lang=va#join');
    assert.equal(page.boot().lang, 'va');
    page.window.i18nPlayer.setLang('en');
    assert.equal(page.boot().lang, 'en');
    const url = new URL(page.window.location.href);
    assert.equal(url.searchParams.get('pin'), '12345');
    assert.equal(url.hash, '#join');
    assert.equal(page.window.history.state.retained, true);
});

test('Commons link overrides an old preference and persists for other pages', () => {
    const values = new Map([['lang-player', 'es']]);
    const launch = browser('http://localhost:8090/?lang=va', values);
    assert.equal(launch.boot().lang, 'va');
    assert.equal(browser('http://localhost:8090/join.html', values).boot().lang, 'va');
});

test('Catalan and Valencian links keep separate translations', () => {
    assert.match(browser('http://localhost:8090/?lang=ca').boot().t('join_student_intro'), /teva/);
    assert.match(browser('http://localhost:8090/?lang=va').boot().t('join_student_intro'), /teua/);
});
