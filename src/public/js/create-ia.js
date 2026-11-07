// Generador de quizzes con IA de /create/: prompt, limpieza y vista previa del CSV, extraído de create.js
// --- Generador IA ---
function buildPrompt(params){
    var idioma = params.idioma === 'otro' && params.idiomaCustom ? params.idiomaCustom : params.idioma;
    var tipos = Array.isArray(params.tipos) && params.tipos.length ? params.tipos : ['quiz'];
    var useDocs = !!params.useDocs;
    var genSvg = !!params.genSvg;
    var tema = useDocs ? '' : (params.tema || '');
    var prompt = {
        objetivo: "Generar un cuestionario en CSV con separador ';' siguiendo el formato: tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia",
        nivel: params.nivel || '',
        tema: tema,
        idioma: idioma || 'Español',
        numero_preguntas: params.num,
        tipos: tipos,
        usar_documentos: useDocs,
        generar_imagenes_svg: genSvg,
        instrucciones: params.extra || '',
        notas: [
            "Usa el punto y coma ';' como separador.",
            "Cada fila debe contener exactamente las 13 columnas de la cabecera, incluidos los campos vacíos. No omitas separadores: 'imagen', 'video' y 'texto' son columnas distintas.",
            "Si algún campo contiene ';' o comillas o saltos de línea, envuélvelo en comillas dobles y escapa comillas internas como \"\" (CSV estándar).",
            "Columna 'tipo': usa uno de: quiz | multiple | true-false | short-answer | numeric.",
            "Tipos quiz/multiple/true-false: usa r1..r4 y 'correcta' (quiz/tf: índice; multiple: lista 1,3).",
            "Tipo short-answer: deja r1..r4 vacío y pon respuestas válidas en 'texto' separadas por '|' (ej: madrid|barcelona).",
            "Tipo numeric: deja r1..r4 vacío y pon la respuesta en 'numero' (acepta coma decimal) y la tolerancia en 'tolerancia' (0 si exacta).",
            "Si 'usar_documentos' es true, genera las preguntas SOLO a partir de los documentos adjuntos en la IA (no inventes contenido fuera de ellos).",
            "Imágenes: PROHIBIDO usar URLs externas (http/https) y PROHIBIDO Wikimedia. Si no puedes generar una imagen embebida, deja 'imagen' vacío.",
            (genSvg
                ? "Columna 'imagen': genera SVG como data URL con el SVG URL-encoded una sola vez ('#' se convierte en '%23', nunca en '%2523'). Ejemplo: \"data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2010%2010%22%3E%3Crect%20width%3D%2210%22%20height%3D%2210%22%20fill%3D%22%23ff0000%22%2F%3E%3C%2Fsvg%3E\". Si contiene ';', pon el campo entrecomillado."
                : "Columna 'imagen': déjala VACÍA (no uses URLs externas)."),
            "Columna 'video': URLs de vídeo (YouTube/Vimeo/MP4). Si hay vídeo, deja 'imagen' vacía.",
            "Tiempo: en segons (ex: 20)."
        ]
    };
    return JSON.stringify(prompt, null, 2);
}

function getSelectedIaTypes(){
    var selected = [];
    var quiz = document.getElementById('ia-type-quiz');
    var multiple = document.getElementById('ia-type-multiple');
    var tf = document.getElementById('ia-type-tf');
    var shortAns = document.getElementById('ia-type-short');
    var numeric = document.getElementById('ia-type-numeric');
    if(quiz && quiz.checked) selected.push('quiz');
    if(multiple && multiple.checked) selected.push('multiple');
    if(tf && tf.checked) selected.push('true-false');
    if(shortAns && shortAns.checked) selected.push('short-answer');
    if(numeric && numeric.checked) selected.push('numeric');
    if(!selected.length) selected.push('quiz');
    return selected;
}

function buildIaTags(){
    // Objetivo: pocas tags útiles (sin ruido tipo "generado-ia" o prefijos "ia-").
    // Priorizamos: tema(s), nivel(es), idioma, y si usa documentos.
    var tags = [];
    var seen = new Set();

    function addTag(text){
        var clean = normalizeTagSlug(text);
        if(!clean) return;
        // filtros anti-ruido
        if(clean === 'generado-ia') return;
        if(clean.indexOf('ia-') === 0) return;
        if(clean.indexOf('ai-') === 0) return;
        if(seen.has(clean)) return;
        seen.add(clean);
        tags.push(clean);
    }

    function addFromList(text){
        (text || '').split(/[,;]+/).forEach(function(part){
            addTag(part);
        });
    }

    function addSingleFromList(text){
        // Para campos como "nivel educativo": nos interesa solo 1 etiqueta.
        var raw = (text || '').toString();
        var parts = raw.split(/[,;|]+/);
        for(var i=0;i<parts.length;i++){
            var p = (parts[i] || '').toString().trim();
            if(p){
                addTag(p);
                return;
            }
        }
    }

    var temaVal = document.getElementById('ia-tema') ? document.getElementById('ia-tema').value : '';
    var nivelVal = document.getElementById('ia-nivel') ? document.getElementById('ia-nivel').value : '';
    // Nivel: solo una etiqueta (la primera si hay varias)
    addSingleFromList(nivelVal);
    // Tema: puede aportar 1-2 tags útiles
    addFromList(temaVal);

    var idiomaVal = '';
    if(iaIdioma){
        idiomaVal = iaIdioma.value === 'otro' && iaIdiomaCustom ? iaIdiomaCustom.value : iaIdioma.value;
    }
    addTag(idiomaVal);

    if(iaUseDocs && iaUseDocs.checked){
        addTag('con-documentos');
    }

    // límite: suficientemente informativas sin volverse repetitivas
    return tags.slice(0, 4);
}

function applyIaDocsMode(){
    if(!iaUseDocs) return;
    var active = !!iaUseDocs.checked;
    if(iaDocsHint) iaDocsHint.classList.toggle('hidden', !active);
    if(iaTema){
        iaTema.disabled = active;
        if(active) iaTema.value = '';
    }
}

function normalizeCsvForDownload(csvText){
    var text = (csvText || '').trim();
    if(!text) return '';
    var header = 'Tipo;Pregunta;R1;R2;R3;R4;Tiempo;Correcta;URL Imagen;Video;Texto;Numero;Tolerancia';
    if(!text.toLowerCase().includes('tipo;pregunta')){
        text = header + '\n' + text;
    }
    return text;
}

function escapeCsvField(value){
    var s = (value === undefined || value === null) ? '' : String(value);
    if(/[";\r\n]/.test(s)){
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function sanitizeIaCsv(csvText){
    // Objetivo: evitar portadas rotas por URLs externas (Wikimedia y similares).
    // Solo se aplica al flujo de IA (textarea/archivo) antes de previsualizar/guardar/subir.
    var raw = (csvText || '').trim();
    if(!raw) return '';

    var linesRaw = raw.split(/\r?\n/);
    var headerIndex = -1;
    for(var i=0;i<linesRaw.length;i++){
        if((linesRaw[i] || '').toLowerCase().includes('tipo;pregunta')){ headerIndex = i; break; }
    }

    var outLines = [];
    if(headerIndex !== -1){
        for(var h=0;h<=headerIndex;h++) outLines.push(linesRaw[h]);
    }

    var start = headerIndex !== -1 ? headerIndex + 1 : 0;
    for(var li=start; li<linesRaw.length; li++){
        var line = (linesRaw[li] || '').trim();
        if(!line) continue;
        var fields = splitSemicolons(line);
        if(!fields || fields.length < 8){
            outLines.push(linesRaw[li]);
            continue;
        }
        while(fields.length < 13) fields.push('');

        var img = (fields[8] || '').toString().trim();
        // Quita URLs externas (http/https) y especialmente Wikimedia.
        if(/^https?:\/\//i.test(img) || /upload\.wikimedia\.org/i.test(img)){
            fields[8] = '';
        }

        outLines.push(fields.map(escapeCsvField).join(';'));
    }

    return outLines.join('\n');
}

function splitSemicolons(line){
    var parts = [];
    var current = '';
    var inQuotes = false;
    for(var i=0;i<line.length;i++){
        var ch = line[i];
        if(ch === '"'){
            if(inQuotes && line[i+1] === '"'){
                current += '"';
                i += 1;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }
        if(ch === ';' && !inQuotes){
            parts.push(current);
            current = '';
        }else{
            current += ch;
        }
    }
    parts.push(current);
    return parts.map(function(field){
        return (field || '').toString().trim();
    });
}

function parseCsvLines(csvText){
    var text = (csvText || '').trim();
    if(!text) return [];
    var linesRaw = text.split(/\r?\n/);
    var headerIndex = -1;
    for(var i=0;i<linesRaw.length;i++){
        if((linesRaw[i] || '').toLowerCase().includes('tipo;pregunta')){ headerIndex = i; break; }
    }
    var lines = headerIndex !== -1 ? linesRaw.slice(headerIndex + 1) : linesRaw;
    var out = [];
    lines.forEach(function(line){
        var l = (line || '').trim();
        if(!l) return;
        var fields = splitSemicolons(l);
        if(!fields || fields.length < 8) return;
        out.push({
            tipo: fields[0],
            pregunta: fields[1],
            respuestas: fields.slice(2, 6).concat(['','','','']).slice(0,4),
            tiempo: fields[6],
            correcta: fields[7],
            imagen: fields[8] || '',
            video: fields[9] || '',
            texto: fields[10] || '',
            numero: fields[11] || '',
            tolerancia: fields[12] || ''
        });
    });
    return out;
}

function renderIaPreview(csvText){
    if(!iaPreviewBox || !iaPreviewContent) return;
    var questions = parseCsvLines(csvText);
    iaPreviewContent.innerHTML = '';
    if(!questions.length){
        iaPreviewContent.textContent = t('alertPasteCsv');
        iaPreviewBox.classList.remove('hidden');
        return;
    }
    questions.forEach(function(q, idx){
        var card = document.createElement('div');
        card.className = 'ia-preview__q';
        var title = document.createElement('div');
        title.className = 'ia-preview__qtitle';
        title.textContent = (idx + 1) + '. ' + (q.pregunta || '');
        card.appendChild(title);
        var list = document.createElement('div');
        list.className = 'ia-preview__answers';

        var qType = (q.tipo || '').toString().toLowerCase().trim();

        function splitAccepted(raw){
            var s = (raw || '').toString().trim();
            if(!s) return [];
            var parts = s.split(/[|\n]+/g);
            var out = [];
            parts.forEach(function(p){
                p.split(',').forEach(function(pp){
                    var clean = (pp || '').toString().trim();
                    if(clean) out.push(clean);
                });
            });
            return out;
        }

        if(qType === 'short-answer' || qType === 'shortanswer'){
            var accepted = splitAccepted(q.texto || q.correcta);
            if(!accepted.length) accepted = [''];
            accepted.forEach(function(a){
                var row = document.createElement('div');
                row.className = 'ia-preview__answer is-correct';
                var bullet = document.createElement('span');
                bullet.className = 'ia-preview__bullet';
                bullet.textContent = '✓';
                var txt = document.createElement('span');
                txt.className = 'ia-preview__text';
                txt.textContent = a;
                row.appendChild(bullet);
                row.appendChild(txt);
                list.appendChild(row);
            });
        }else if(qType === 'numeric' || qType === 'numerical'){
            var n = (q.numero || q.correcta || '').toString().trim();
            var tol = (q.tolerancia || '').toString().trim();
            var label = n;
            if(tol && tol !== '0') label = n + ' ± ' + tol;
            var row = document.createElement('div');
            row.className = 'ia-preview__answer is-correct';
            var bullet = document.createElement('span');
            bullet.className = 'ia-preview__bullet';
            bullet.textContent = '✓';
            var txt = document.createElement('span');
            txt.className = 'ia-preview__text';
            txt.textContent = label;
            row.appendChild(bullet);
            row.appendChild(txt);
            list.appendChild(row);
        }else{
            var correctIdx = [];
            (q.correcta || '').split(',').forEach(function(n){
                var i = parseInt(String(n).trim(), 10);
                if(!isNaN(i)) correctIdx.push(i - 1);
            });
            q.respuestas.forEach(function(a, i){
                if(!a) return;
                var row = document.createElement('div');
                row.className = 'ia-preview__answer' + (correctIdx.indexOf(i) !== -1 ? ' is-correct' : '');
                var bullet = document.createElement('span');
                bullet.className = 'ia-preview__bullet';
                bullet.textContent = (correctIdx.indexOf(i) !== -1 ? '✓' : '•');
                var txt = document.createElement('span');
                txt.className = 'ia-preview__text';
                txt.textContent = a;
                row.appendChild(bullet);
                row.appendChild(txt);
                list.appendChild(row);
            });
        }
        card.appendChild(list);
        iaPreviewContent.appendChild(card);
    });
    iaPreviewBox.classList.remove('hidden');
}
