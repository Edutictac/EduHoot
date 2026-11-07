// Exportaciones de /create/: CSV, Moodle XML, PDF, DOCX y ODT (y sus utilidades de imágenes), extraído de create.js
function getJsPdf(){
    try{
        if(window.jspdf && window.jspdf.jsPDF){
            return window.jspdf.jsPDF;
        }
    }catch(e){
        // ignore
    }
    return null;
}

function sanitizeFilename(name, fallback){
    var base = (name || '').toString().trim();
    if(!base) base = fallback || 'quiz';
    base = base.replace(/[\\/\n\r\t\0]+/g, ' ');
    base = base.replace(/[:*?"<>|]+/g, '');
    base = base.replace(/\s+/g, ' ').trim();
    if(!base) base = fallback || 'quiz';
    return base;
}

function toLetterAnswer(n){
    var num = parseInt(n, 10);
    if(!isFinite(num)) return '';
    if(num === 1) return 'A';
    if(num === 2) return 'B';
    if(num === 3) return 'C';
    if(num === 4) return 'D';
    return String(num);
}

function getTfLabelsForPdf(question){
    var raw = Array.isArray(question && question.answers) ? question.answers : [];
    var a = (raw[0] || '').toString().trim();
    var b = (raw[1] || '').toString().trim();
    if(!a) a = t('tfTrue');
    if(!b) b = t('tfFalse');
    return [a, b];
}

function pdfAddWrapped(doc, text, x, y, maxWidth, opts){
    opts = opts || {};
    var fontSize = opts.fontSize || 11;
    var lineHeight = opts.lineHeight || Math.round(fontSize * 1.25);
    var isBold = !!opts.bold;
    var marginBottom = (opts.marginBottom === undefined ? 0 : opts.marginBottom);

    doc.setFontSize(fontSize);
    try{
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    }catch(e){
        // ignore if font set fails
    }

    var pageHeight = doc.internal.pageSize.getHeight();
    var marginTop = opts.marginTop || 40;
    var bottomLimit = pageHeight - (opts.marginBottomLimit || 40);

    var safeText = (text === undefined || text === null) ? '' : String(text);
    var lines = doc.splitTextToSize(safeText, maxWidth);
    for(var i = 0; i < lines.length; i++){
        if(y + lineHeight > bottomLimit){
            doc.addPage();
            y = marginTop;
        }
        doc.text(lines[i], x, y);
        y += lineHeight;
    }
    y += marginBottom;
    return y;
}

function normalizeSvgDataUrlForImg(url){
    if(!url) return url;
    var raw = String(url).trim();
    if(!raw) return raw;
    var lower = raw.toLowerCase();
    if(!lower.startsWith('data:image/svg+xml')) return raw;
    var comma = raw.indexOf(',');
    if(comma === -1) return raw;
    var header = raw.slice(0, comma + 1);
    var payload = raw.slice(comma + 1);
    if(!payload) return raw;
    if(/;base64/i.test(header)) return raw;

    if(/%[0-9a-fA-F]{2}/.test(payload)){
        var lp = payload.toLowerCase();
        var endEnc = '%3c%2fsvg%3e';
        var posEnc = lp.lastIndexOf(endEnc);
        if(posEnc !== -1) return header + payload.slice(0, posEnc + endEnc.length);
        return raw;
    }

    var lpr = payload.toLowerCase();
    var endRaw = '</svg>';
    var posRaw = lpr.lastIndexOf(endRaw);
    if(posRaw !== -1){
        payload = payload.slice(0, posRaw + endRaw.length);
    }
    if(payload.indexOf('<') !== -1 || payload.indexOf('#') !== -1 || payload.indexOf('"') !== -1 || payload.indexOf("'") !== -1){
        return header + encodeURIComponent(payload);
    }
    return raw;
}

function extractSvgTextFromDataUrl(dataUrl){
    var comma = dataUrl.indexOf(',');
    if(comma === -1) return '';
    var header = dataUrl.slice(0, comma);
    var payload = dataUrl.slice(comma + 1);
    try{
        if(/;base64/i.test(header)){
            return atob(payload);
        }
        return decodeURIComponent(payload);
    }catch(e){
        return '';
    }
}

function getSvgSizeFromText(svgText){
    if(!svgText) return { width: 0, height: 0 };
    var widthMatch = svgText.match(/\bwidth=["']?([\d.]+)/i);
    var heightMatch = svgText.match(/\bheight=["']?([\d.]+)/i);
    var width = widthMatch ? parseFloat(widthMatch[1]) : 0;
    var height = heightMatch ? parseFloat(heightMatch[1]) : 0;
    if(width > 0 && height > 0) return { width: width, height: height };

    var viewBoxMatch = svgText.match(/\bviewBox=["']?([-\d.\s,]+)["']?/i);
    if(viewBoxMatch && viewBoxMatch[1]){
        var parts = viewBoxMatch[1].trim().split(/[,\s]+/).map(function(n){ return parseFloat(n); });
        if(parts.length === 4 && isFinite(parts[2]) && isFinite(parts[3])){
            return { width: Math.abs(parts[2]), height: Math.abs(parts[3]) };
        }
    }
    return { width: 0, height: 0 };
}

function rasterizeSvgDataUrl(dataUrl){
    return new Promise(function(resolve){
        var svgText = extractSvgTextFromDataUrl(dataUrl);
        if(!svgText) return resolve('');
        var size = getSvgSizeFromText(svgText);
        var img = new Image();
        img.onload = function(){
            var width = size.width || img.naturalWidth || img.width || 800;
            var height = size.height || img.naturalHeight || img.height || 600;
            var canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(width));
            canvas.height = Math.max(1, Math.round(height));
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = function(){ resolve(''); };
        img.src = dataUrl;
    });
}

function dataUrlToUint8Array(dataUrl){
    var comma = dataUrl.indexOf(',');
    if(comma === -1) return new Uint8Array();
    var header = dataUrl.slice(0, comma);
    var payload = dataUrl.slice(comma + 1);
    var binary = '';
    if(/;base64/i.test(header)){
        binary = atob(payload);
    }else{
        binary = decodeURIComponent(payload);
    }
    var len = binary.length;
    var bytes = new Uint8Array(len);
    for(var i = 0; i < len; i++){
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function ensurePngDataUrl(dataUrl){
    return new Promise(function(resolve){
        var lower = (dataUrl || '').toLowerCase();
        if(lower.startsWith('data:image/png')){
            return resolve(dataUrl);
        }
        var img = new Image();
        img.onload = function(){
            var canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width || 800;
            canvas.height = img.naturalHeight || img.height || 600;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = function(){ resolve(''); };
        img.src = dataUrl;
    });
}

function getImageFormatFromDataUrl(dataUrl){
    var match = /^data:image\/(png|jpeg|jpg|webp);/i.exec(dataUrl || '');
    if(!match) return '';
    var ext = match[1].toLowerCase();
    if(ext === 'png') return 'PNG';
    if(ext === 'webp') return 'WEBP';
    return 'JPEG';
}

function blobToDataUrl(blob){
    return new Promise(function(resolve){
        var reader = new FileReader();
        reader.onload = function(){ resolve(reader.result || ''); };
        reader.onerror = function(){ resolve(''); };
        reader.readAsDataURL(blob);
    });
}

function loadImageForPdf(url){
    return new Promise(function(resolve){
        var raw = (url || '').toString().trim();
        if(!raw) return resolve(null);
        var normalized = normalizeSvgDataUrlForImg(raw);
        var isDataUrl = normalized.toLowerCase().startsWith('data:image/');
    var dataUrlPromise = isDataUrl
        ? Promise.resolve(normalized)
        : fetch(normalized, { mode: 'cors', cache: 'no-store' })
            .then(function(res){ return res && res.ok ? res.blob() : null; })
            .then(function(blob){ return blob ? blobToDataUrl(blob) : ''; })
            .catch(function(){ return ''; });

    dataUrlPromise.then(function(dataUrl){
        if(!dataUrl) return resolve(null);
        var lower = dataUrl.toLowerCase();
        var finalize = function(finalUrl){
            var format = getImageFormatFromDataUrl(finalUrl);
            if(!format) return resolve(null);
            var img = new Image();
            img.onload = function(){
                resolve({
                    dataUrl: finalUrl,
                    format: format,
                    width: img.naturalWidth || img.width || 0,
                    height: img.naturalHeight || img.height || 0
                });
            };
            img.onerror = function(){ resolve(null); };
            img.src = finalUrl;
        };

        if(lower.startsWith('data:image/svg+xml')){
            rasterizeSvgDataUrl(dataUrl).then(function(pngUrl){
                if(!pngUrl) return resolve(null);
                finalize(pngUrl);
            });
        }else{
            finalize(dataUrl);
        }
    });
});
}

function pdfAddImage(doc, image, x, y, maxWidth, opts){
    opts = opts || {};
    var marginTop = opts.marginTop || 40;
    var bottomLimit = doc.internal.pageSize.getHeight() - (opts.marginBottomLimit || 40);
    var maxHeight = opts.maxHeight || 240;
    var marginBottom = opts.marginBottom === undefined ? 6 : opts.marginBottom;
    if(!image || !image.width || !image.height) return y;

    var scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    var drawWidth = image.width * scale;
    var drawHeight = image.height * scale;

    if(y + drawHeight > bottomLimit){
        doc.addPage();
        y = marginTop;
    }

    doc.addImage(image.dataUrl, image.format, x, y, drawWidth, drawHeight);
    y += drawHeight + marginBottom;
    return y;
}

function shuffleArray(arr){
    for(var i = arr.length - 1; i > 0; i--){
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

function normalizePdfAnswers(question, qType){
    var answers = Array.isArray(question && question.answers) ? question.answers.slice() : [];
    if(qType === 'true-false'){
        if(answers.length < 2){
            answers = getTfLabelsForPdf(question).slice();
        }else{
            answers = [answers[0] || t('tfTrue'), answers[1] || t('tfFalse')];
        }
    }else{
        while(answers.length < 4) answers.push('');
    }
    return answers;
}

function getCorrectListForPdf(question){
    var list = (question && Array.isArray(question.correctAnswers) && question.correctAnswers.length)
        ? question.correctAnswers.slice()
        : [question && question.correct];
    return list
        .map(function(v){ return parseInt(v, 10); })
        .filter(function(v){ return isFinite(v) && v > 0; });
}

function shuffleAnswersForPdf(question, qType){
    var answers = normalizePdfAnswers(question, qType);
    var items = answers.map(function(text, idx){ return { text: text, idx: idx }; });
    shuffleArray(items);
    var newAnswers = items.map(function(item){ return item.text; });
    var correct = getCorrectListForPdf(question);
    var mapped = correct.map(function(c){
        var origIdx = c - 1;
        var newIdx = items.findIndex(function(item){ return item.idx === origIdx; });
        return newIdx >= 0 ? newIdx + 1 : null;
    }).filter(function(v){ return v !== null; });
    return { answers: newAnswers, correct: mapped };
}

function downloadCsv(id){
    fetch('/api/quizzes/' + id + '/csv')
        .then(function(res){
            if(!res.ok){
                    return res.json().then(function(body){
                    alert((body && body.error) || t('downloadCsvError'));
                    throw new Error('Download failed');
                }).catch(function(){
                    alert(t('downloadCsvError'));
                    throw new Error('Download failed');
                });
            }
            var name = res.headers.get('Content-Disposition') || '';
            var match = name.match(/filename=\"?([^\";]+)\"?/i);
            var filename = match && match[1] ? match[1] : ('quiz-' + id + '.csv');
            return res.blob().then(function(blob){
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            });
        })
        .catch(function(){
            // ya se alertó
        });
}

function downloadMoodleXml(id){
    fetch('/api/quizzes/' + id + '/moodle-xml', { credentials: 'include' })
        .then(function(res){
            if(!res.ok){
                return res.json().then(function(body){
                    alert((body && body.error) || t('downloadCsvError'));
                    throw new Error('Download failed');
                }).catch(function(){
                    alert(t('downloadCsvError'));
                    throw new Error('Download failed');
                });
            }
            var fileName = 'quiz-' + id + '.xml';
            var disposition = res.headers.get('Content-Disposition') || '';
            var match = disposition.match(/filename=\"?([^\";]+)\"?/i);
            if(match && match[1]) fileName = match[1];
            return res.blob().then(function(blob){
                var url = window.URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            });
        })
        .catch(function(){
            // ya se alertó
        });
}

async function downloadPdf(id, options){
    options = options || {};
    var includeAnswers = options.includeAnswers !== false;
    var shuffleQuestions = options.shuffleQuestions === true;
    var shuffleAnswers = options.shuffleAnswers === true;
    var JsPdfCtor = getJsPdf();
    if(!JsPdfCtor){
        alert(t('pdfMissingLib'));
        return;
    }
    try{
        var res = await fetch('/api/quizzes/' + id, { credentials: 'include' });
        if(!res.ok){
            alert(t('pdfDownloadError'));
            return;
        }
        var quiz = await res.json();
        var title = (quiz.name || '').toString().trim() || 'EduHoot quiz';
        var doc = new JsPdfCtor({ unit: 'pt', format: 'a4' });
        var pageWidth = doc.internal.pageSize.getWidth();
        var margin = 40;
        var maxWidth = pageWidth - (margin * 2);
        var y = margin;

        y = pdfAddWrapped(doc, title, margin, y, maxWidth, { fontSize: 18, bold: true, marginBottom: 10 });

        if(Array.isArray(quiz.tags) && quiz.tags.length){
            y = pdfAddWrapped(
                doc,
                t('pdfTags') + ': ' + quiz.tags.join(', '),
                margin,
                y,
                maxWidth,
                { fontSize: 11, bold: false, marginBottom: 12 }
            );
        }else{
            y += 6;
        }

        var questions = Array.isArray(quiz.questions) ? quiz.questions.slice() : [];
        if(shuffleQuestions){
            shuffleArray(questions);
        }
        for(var idx = 0; idx < questions.length; idx++){
            var q = questions[idx];
            var qNum = idx + 1;
            var qText = (q && q.question) ? String(q.question).trim() : '';
            var qType = (q && q.type) ? String(q.type) : 'quiz';
            var localAnswers = null;
            var localCorrect = null;
            if(shuffleAnswers && (qType === 'quiz' || qType === 'multiple' || qType === 'true-false')){
                var shuffled = shuffleAnswersForPdf(q, qType);
                localAnswers = shuffled.answers;
                localCorrect = shuffled.correct;
            }else if(qType === 'true-false'){
                localAnswers = normalizePdfAnswers(q, qType);
            }

            y = pdfAddWrapped(doc, qNum + '. ' + (qText || ''), margin, y, maxWidth, { fontSize: 12, bold: true, marginBottom: 6 });

            if(qType === 'short-answer'){
                var accepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
                if(includeAnswers && accepted.length){
                    y = pdfAddWrapped(doc, t('pdfAcceptedAnswers') + ': ' + accepted.join(' | '), margin, y, maxWidth, { fontSize: 11 });
                    y = pdfAddWrapped(doc, t('pdfCorrect') + ': ' + accepted.join(' | '), margin, y, maxWidth, { fontSize: 10, marginBottom: 8 });
                }else{
                    y += 8;
                }
            }else if(qType === 'numeric'){
                var n = (q.numericAnswer === undefined || q.numericAnswer === null) ? '' : String(q.numericAnswer);
                var tol = (q.tolerance === undefined || q.tolerance === null) ? '0' : String(q.tolerance);
                if(includeAnswers){
                    y = pdfAddWrapped(doc, t('pdfNumericAnswer') + ': ' + n + ' (± ' + t('pdfTolerance') + ': ' + tol + ')', margin, y, maxWidth, { fontSize: 11 });
                    y = pdfAddWrapped(doc, t('pdfCorrect') + ': ' + n + ' (± ' + tol + ')', margin, y, maxWidth, { fontSize: 10, marginBottom: 8 });
                }else{
                    y += 8;
                }
            }else if(qType === 'true-false'){
                var tfAnswers = localAnswers || getTfLabelsForPdf(q);
                y = pdfAddWrapped(doc, 'A) ' + tfAnswers[0], margin, y, maxWidth, { fontSize: 11 });
                y = pdfAddWrapped(doc, 'B) ' + tfAnswers[1], margin, y, maxWidth, { fontSize: 11, marginBottom: 6 });
            }else{
                var answers = localAnswers || (Array.isArray(q.answers) ? q.answers : []);
                var labels = ['A', 'B', 'C', 'D'];
                for(var i = 0; i < 4; i++){
                    var ans = (answers[i] || '').toString().trim();
                    if(!ans) continue;
                    y = pdfAddWrapped(doc, labels[i] + ') ' + ans, margin, y, maxWidth, { fontSize: 11 });
                }
                y += 6;
            }

            if(q && q.image){
                var imageData = await loadImageForPdf(q.image);
                if(imageData){
                    y = pdfAddImage(doc, imageData, margin, y, maxWidth);
                }else{
                    y = pdfAddWrapped(doc, t('pdfImage') + ': ' + String(q.image), margin, y, maxWidth, { fontSize: 10 });
                }
            }
            if(q && q.video){
                y = pdfAddWrapped(doc, t('pdfVideo') + ': ' + String(q.video), margin, y, maxWidth, { fontSize: 10 });
            }

            if(includeAnswers && (qType === 'quiz' || qType === 'multiple' || qType === 'true-false')){
                var correct = localCorrect || ((Array.isArray(q.correctAnswers) && q.correctAnswers.length) ? q.correctAnswers : [q.correct]);
                var printable = [];
                correct.forEach(function(v){
                    if(qType === 'true-false'){
                        var num = parseInt(v, 10);
                        if(num === 1) printable.push('A');
                        else if(num === 2) printable.push('B');
                    }else{
                        var letter = toLetterAnswer(v);
                        if(letter) printable.push(letter);
                    }
                });
                if(printable.length){
                    var seen = {};
                    printable = printable.filter(function(x){ if(seen[x]) return false; seen[x] = true; return true; });
                    y = pdfAddWrapped(doc, t('pdfCorrect') + ': ' + printable.join(', '), margin, y, maxWidth, { fontSize: 10, marginBottom: 10 });
                }else{
                    y += 6;
                }
            }else{
                y += 10;
            }
        }

        var baseName = sanitizeFilename(title, 'quiz');
        var suffix = includeAnswers ? '' : '_sin_respuestas';
        doc.save(baseName + suffix + '.pdf');
    }catch(err){
        alert(t('pdfDownloadError'));
    }
}

function escapeXml(value){
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function pxToMm(px){
    return (px * 25.4) / 96;
}

function getDocx(){
    if(window.docx) return window.docx;
    return null;
}

async function downloadDocx(id, options){
    var docxLib = getDocx();
    if(!docxLib){
        alert(t('docMissingLib'));
        return;
    }
    options = options || {};
    var includeAnswers = options.includeAnswers !== false;
    var includeImages = options.includeImages !== false;
    try{
        var res = await fetch('/api/quizzes/' + id, { credentials: 'include' });
        if(!res.ok){
            alert(t('docDownloadError'));
            return;
        }
        var quiz = await res.json();
        var title = (quiz.name || '').toString().trim() || 'EduHoot quiz';

        var parts = [];
        parts.push(new docxLib.Paragraph({
            text: title,
            heading: docxLib.HeadingLevel.HEADING_1
        }));
        if(Array.isArray(quiz.tags) && quiz.tags.length){
            parts.push(new docxLib.Paragraph(t('pdfTags') + ': ' + quiz.tags.join(', ')));
        }

        for(var idx = 0; idx < (quiz.questions || []).length; idx++){
            var q = quiz.questions[idx];
            var qNum = idx + 1;
            var qText = (q && q.question) ? String(q.question).trim() : '';
            var qType = (q && q.type) ? String(q.type) : 'quiz';

            parts.push(new docxLib.Paragraph({
                children: [
                    new docxLib.TextRun({ text: qNum + '. ' + qText, bold: true })
                ]
            }));

            if(qType === 'short-answer'){
                var accepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
                if(includeAnswers && accepted.length){
                    parts.push(new docxLib.Paragraph(t('pdfAcceptedAnswers') + ': ' + accepted.join(' | ')));
                    parts.push(new docxLib.Paragraph(t('pdfCorrect') + ': ' + accepted.join(' | ')));
                }
            }else if(qType === 'numeric'){
                var n = (q.numericAnswer === undefined || q.numericAnswer === null) ? '' : String(q.numericAnswer);
                var tol = (q.tolerance === undefined || q.tolerance === null) ? '0' : String(q.tolerance);
                if(includeAnswers){
                    parts.push(new docxLib.Paragraph(t('pdfNumericAnswer') + ': ' + n + ' (± ' + t('pdfTolerance') + ': ' + tol + ')'));
                    parts.push(new docxLib.Paragraph(t('pdfCorrect') + ': ' + n + ' (± ' + tol + ')'));
                }
            }else if(qType === 'true-false'){
                var tfAnswers = normalizePdfAnswers(q, qType);
                parts.push(new docxLib.Paragraph({ text: 'A) ' + tfAnswers[0], bullet: { level: 0 } }));
                parts.push(new docxLib.Paragraph({ text: 'B) ' + tfAnswers[1], bullet: { level: 0 } }));
            }else{
                var answers = Array.isArray(q.answers) ? q.answers : [];
                var labels = ['A', 'B', 'C', 'D'];
                for(var i = 0; i < 4; i++){
                    var ans = (answers[i] || '').toString().trim();
                    if(!ans) continue;
                    parts.push(new docxLib.Paragraph({ text: labels[i] + ') ' + ans, bullet: { level: 0 } }));
                }
            }

            if(includeImages && q && q.image){
                var imageData = await loadImageForPdf(q.image);
                if(imageData){
                    var data = dataUrlToUint8Array(imageData.dataUrl);
                    var maxWidth = 500;
                    var scale = Math.min(maxWidth / imageData.width, 1);
                    var width = Math.round(imageData.width * scale);
                    var height = Math.round(imageData.height * scale);
                    parts.push(new docxLib.Paragraph({
                        children: [
                            new docxLib.ImageRun({
                                data: data,
                                transformation: { width: width, height: height }
                            })
                        ]
                    }));
                }
            }

            if(q && q.video){
                parts.push(new docxLib.Paragraph(t('pdfVideo') + ': ' + String(q.video)));
            }

            if(includeAnswers && (qType === 'quiz' || qType === 'multiple' || qType === 'true-false')){
                var correct = (Array.isArray(q.correctAnswers) && q.correctAnswers.length) ? q.correctAnswers : [q.correct];
                var printable = [];
                correct.forEach(function(v){
                    if(qType === 'true-false'){
                        var num = parseInt(v, 10);
                        if(num === 1) printable.push('A');
                        else if(num === 2) printable.push('B');
                    }else{
                        var letter = toLetterAnswer(v);
                        if(letter) printable.push(letter);
                    }
                });
                if(printable.length){
                    var seen = {};
                    printable = printable.filter(function(x){ if(seen[x]) return false; seen[x] = true; return true; });
                    parts.push(new docxLib.Paragraph(t('pdfCorrect') + ': ' + printable.join(', ')));
                }
            }
        }

        var doc = new docxLib.Document({
            sections: [{ children: parts }]
        });
        var blob = await docxLib.Packer.toBlob(doc);
        var baseName = sanitizeFilename(title, 'quiz');
        var a = document.createElement('a');
        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = baseName + '.docx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }catch(err){
        alert(t('docDownloadError'));
    }
}

async function downloadOdt(id, options){
    if(!window.JSZip){
        alert(t('docMissingLib'));
        return;
    }
    options = options || {};
    var includeAnswers = options.includeAnswers !== false;
    var includeImages = options.includeImages !== false;
    try{
        var res = await fetch('/api/quizzes/' + id, { credentials: 'include' });
        if(!res.ok){
            alert(t('docDownloadError'));
            return;
        }
        var quiz = await res.json();
        var title = (quiz.name || '').toString().trim() || 'EduHoot quiz';

        var zip = new JSZip();
        zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });

        var images = [];
        var contentParts = [];
        contentParts.push('<text:h text:outline-level="1">' + escapeXml(title) + '</text:h>');
        if(Array.isArray(quiz.tags) && quiz.tags.length){
            contentParts.push('<text:p>' + escapeXml(t('pdfTags') + ': ' + quiz.tags.join(', ')) + '</text:p>');
        }

        for(var idx = 0; idx < (quiz.questions || []).length; idx++){
            var q = quiz.questions[idx];
            var qNum = idx + 1;
            var qText = (q && q.question) ? String(q.question).trim() : '';
            var qType = (q && q.type) ? String(q.type) : 'quiz';
            contentParts.push('<text:p><text:span text:style-name="Bold">' + escapeXml(qNum + '. ' + qText) + '</text:span></text:p>');

            if(qType === 'short-answer'){
                var accepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
                if(includeAnswers && accepted.length){
                    contentParts.push('<text:p>' + escapeXml(t('pdfAcceptedAnswers') + ': ' + accepted.join(' | ')) + '</text:p>');
                    contentParts.push('<text:p>' + escapeXml(t('pdfCorrect') + ': ' + accepted.join(' | ')) + '</text:p>');
                }
            }else if(qType === 'numeric'){
                var n = (q.numericAnswer === undefined || q.numericAnswer === null) ? '' : String(q.numericAnswer);
                var tol = (q.tolerance === undefined || q.tolerance === null) ? '0' : String(q.tolerance);
                if(includeAnswers){
                    contentParts.push('<text:p>' + escapeXml(t('pdfNumericAnswer') + ': ' + n + ' (± ' + t('pdfTolerance') + ': ' + tol + ')') + '</text:p>');
                    contentParts.push('<text:p>' + escapeXml(t('pdfCorrect') + ': ' + n + ' (± ' + tol + ')') + '</text:p>');
                }
            }else if(qType === 'true-false'){
                var tfAnswers = normalizePdfAnswers(q, qType);
                contentParts.push('<text:p>' + escapeXml('A) ' + tfAnswers[0]) + '</text:p>');
                contentParts.push('<text:p>' + escapeXml('B) ' + tfAnswers[1]) + '</text:p>');
            }else{
                var answers = Array.isArray(q.answers) ? q.answers : [];
                var labels = ['A', 'B', 'C', 'D'];
                for(var i = 0; i < 4; i++){
                    var ans = (answers[i] || '').toString().trim();
                    if(!ans) continue;
                    contentParts.push('<text:p>' + escapeXml(labels[i] + ') ' + ans) + '</text:p>');
                }
            }

            if(includeImages && q && q.image){
                var imageData = await loadImageForPdf(q.image);
                if(imageData){
                    var pngUrl = await ensurePngDataUrl(imageData.dataUrl);
                    if(pngUrl){
                        var fileName = 'Pictures/image_' + idx + '_' + images.length + '.png';
                        var bytes = dataUrlToUint8Array(pngUrl);
                        images.push({ name: fileName, bytes: bytes });
                        var widthMm = pxToMm(imageData.width || 800);
                        var heightMm = pxToMm(imageData.height || 600);
                        contentParts.push(
                            '<text:p><draw:frame text:anchor-type="as-char" svg:width="' + widthMm.toFixed(2) + 'mm" svg:height="' + heightMm.toFixed(2) + 'mm">' +
                            '<draw:image xlink:href="' + escapeXml(fileName) + '" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>' +
                            '</draw:frame></text:p>'
                        );
                    }
                }
            }

            if(q && q.video){
                contentParts.push('<text:p>' + escapeXml(t('pdfVideo') + ': ' + String(q.video)) + '</text:p>');
            }

            if(includeAnswers && (qType === 'quiz' || qType === 'multiple' || qType === 'true-false')){
                var correct = (Array.isArray(q.correctAnswers) && q.correctAnswers.length) ? q.correctAnswers : [q.correct];
                var printable = [];
                correct.forEach(function(v){
                    if(qType === 'true-false'){
                        var num = parseInt(v, 10);
                        if(num === 1) printable.push('A');
                        else if(num === 2) printable.push('B');
                    }else{
                        var letter = toLetterAnswer(v);
                        if(letter) printable.push(letter);
                    }
                });
                if(printable.length){
                    var seen = {};
                    printable = printable.filter(function(x){ if(seen[x]) return false; seen[x] = true; return true; });
                    contentParts.push('<text:p>' + escapeXml(t('pdfCorrect') + ': ' + printable.join(', ')) + '</text:p>');
                }
            }
        }

        var contentXml = '' +
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<office:document-content ' +
            'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ' +
            'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ' +
            'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ' +
            'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" ' +
            'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
            'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" ' +
            'office:version="1.2">' +
            '<office:styles>' +
            '<style:style style:name="Bold" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>' +
            '</office:styles>' +
            '<office:body><office:text>' + contentParts.join('') + '</office:text></office:body>' +
            '</office:document-content>';

        var stylesXml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.2"></office:document-styles>';
        var metaXml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.2"></office:document-meta>';

        zip.file('content.xml', contentXml);
        zip.file('styles.xml', stylesXml);
        zip.file('meta.xml', metaXml);

        if(images.length){
            images.forEach(function(img){
                zip.file(img.name, img.bytes);
            });
        }

        var manifestEntries = [
            '<manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.text" manifest:full-path="/"/>',
            '<manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>',
            '<manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>',
            '<manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>'
        ];
        images.forEach(function(img){
            manifestEntries.push('<manifest:file-entry manifest:media-type="image/png" manifest:full-path="' + escapeXml(img.name) + '"/>');
        });
        var manifestXml = '<?xml version="1.0" encoding="UTF-8"?>' +
            '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">' +
            manifestEntries.join('') +
            '</manifest:manifest>';
        zip.file('META-INF/manifest.xml', manifestXml);

        var blob = await zip.generateAsync({ type: 'blob' });
        var baseName = sanitizeFilename(title, 'quiz');
        var a = document.createElement('a');
        var url = window.URL.createObjectURL(blob);
        a.href = url;
        a.download = baseName + '.odt';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }catch(err){
        alert(t('docDownloadError'));
    }
}
