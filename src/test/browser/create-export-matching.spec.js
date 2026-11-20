const { test, expect } = require('@playwright/test');

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });
}

// Exportar una correspondencia a PDF, DOCX y ODT desde /create/ (create-export.js).
// Las librerías (jsPDF, docx y JSZip) llegan del CDN, que los specs no cargan: se
// sustituyen por versiones mínimas que guardan en window.__exported el texto que
// recibiría cada documento.
//
// Con Math.random = 0.999 el barajado deja el orden guardado y, como la derecha no
// puede quedar igual, se rota una posición: A) Roma, B) Berlín, C) Lisboa, D) París.
const FAKE_LIBS = {
    'jspdf': `window.jspdf = { jsPDF: function(){
        var doc = {
            internal: { pageSize: { getHeight: function(){ return 842; }, getWidth: function(){ return 595; } } },
            setFontSize: function(){}, setFont: function(){}, addPage: function(){}, addImage: function(){},
            splitTextToSize: function(text){ return [text]; },
            text: function(line){ window.__exported.pdf.push(String(line)); },
            save: function(name){ window.__exported.pdfName = name; }
        };
        return doc;
    } };`,
    'docx': `(function(){
        function textOf(arg){
            if(typeof arg === 'string') return arg;
            if(arg && arg.text) return arg.text;
            if(arg && Array.isArray(arg.children)) return arg.children.map(function(c){ return c.text || ''; }).join('');
            return '';
        }
        window.docx = {
            HeadingLevel: { HEADING_1: 'h1' },
            Paragraph: function(arg){ window.__exported.docx.push(textOf(arg)); },
            TextRun: function(opts){ this.text = opts && opts.text; },
            ImageRun: function(){},
            Document: function(){},
            Packer: { toBlob: function(){ return Promise.resolve(new Blob(['docx'])); } }
        };
    })();`,
    'jszip': `window.JSZip = function(){
        this.file = function(name, content){ window.__exported.odt[name] = typeof content === 'string' ? content : '(binari)'; };
        this.generateAsync = function(){ return Promise.resolve(new Blob(['odt'])); };
    };`
};

const quiz = {
    id: 'm1',
    name: 'Capitales',
    tags: [],
    questions: [{
        question: 'Relaciona cada país con su capital',
        type: 'matching',
        answers: ['', '', '', ''],
        time: 30,
        pairs: [
            { left: 'Francia', right: 'París' },
            { left: 'Italia', right: 'Roma' },
            { left: 'Alemania', right: 'Berlín' },
            { left: '', right: 'Lisboa' }
        ]
    }]
};

const COLUMNS = ['1. Francia', '2. Italia', '3. Alemania', 'A) Roma', 'B) Berlín', 'C) Lisboa', 'D) París'];
const SOLUTION = 'Correcta: 1 → D, 2 → A, 3 → B';

test.beforeEach(async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('dialog', (dialog) => { errors.push('dialog: ' + dialog.message()); dialog.dismiss(); });
    page.__errors = errors;
    await page.addInitScript(() => {
        Math.random = () => 0.999;
        window.__exported = { pdf: [], docx: [], odt: {} };
    });
    await page.route(/^https:\/\//, route => route.abort());
    for (const [name, body] of Object.entries(FAKE_LIBS)) {
        await page.route(new RegExp('^https://cdn\\.jsdelivr\\.net/npm/' + name + '@'), route => route.fulfill({ contentType: 'application/javascript', body }));
    }
    await page.route('**/socket.io/socket.io.js', route => route.fulfill({ contentType: 'application/javascript', body: 'window.io = function(){ return { on: function(){}, emit: function(){}, disconnect: function(){}, connect: function(){} }; };' }));
    await page.route('**/api/**', route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/api/quizzes/m1') return route.fulfill({ json: quiz });
        if (pathname === '/api/auth/me') return route.fulfill({ status: 401, json: { error: 'no' } });
        return route.fulfill({ json: pathname === '/api/quizzes' ? [] : {} });
    });
    await page.goto('/create/?lang=es');
    await page.waitForLoadState('load');
});

test.afterEach(async ({ page }) => {
    expect(page.__errors).toEqual([]);
});

const exported = (page) => page.evaluate(() => window.__exported);

test('PDF: la izquierda numerada, la derecha con letras y, con respuestas, la solución', async ({ page }) => {
    await page.evaluate(() => window.downloadPdf('m1', { includeAnswers: true }));
    const { pdf, pdfName } = await exported(page);
    expect(pdfName).toMatch(/\.pdf$/);
    const start = pdf.indexOf('1. Relaciona cada país con su capital');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(pdf.slice(start + 1, start + 1 + COLUMNS.length)).toEqual(COLUMNS);
    expect(pdf).toContain(SOLUTION);
});

test('PDF sin respuestas: las columnas, pero no la solución', async ({ page }) => {
    await page.evaluate(() => window.downloadPdf('m1', { includeAnswers: false }));
    const { pdf } = await exported(page);
    for (const line of COLUMNS) expect(pdf).toContain(line);
    expect(pdf.join('\n')).not.toContain('→');
});

test('DOCX: un párrafo por elemento y la solución', async ({ page }) => {
    await page.evaluate(() => window.downloadDocx('m1', { includeAnswers: true }));
    const { docx } = await exported(page);
    const start = docx.indexOf('1. Relaciona cada país con su capital');
    expect(start).toBeGreaterThanOrEqual(0);
    expect(docx.slice(start + 1, start + 1 + COLUMNS.length)).toEqual(COLUMNS);
    expect(docx).toContain(SOLUTION);
});

test('ODT: las columnas y la solución en content.xml', async ({ page }) => {
    await page.evaluate(() => window.downloadOdt('m1', { includeAnswers: true }));
    const { odt } = await exported(page);
    const content = odt['content.xml'] || '';
    const paragraphs = [...content.matchAll(/<text:p>([^<]*)<\/text:p>/g)].map((m) => m[1]);
    const start = paragraphs.indexOf(COLUMNS[0]);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(paragraphs.slice(start, start + COLUMNS.length)).toEqual(COLUMNS);
    expect(paragraphs).toContain(SOLUTION);
});
