const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { normalizeQuestionMeta } = require('./questionUtils');

// CSV parser (separador ;) con soporte de:
// - Campos entrecomillados
// - Comillas escapadas ("" => ")
// - Saltos de línea dentro de comillas
function parseCsvRecords(content) {
  const text = (content || '').toString().replace(/^\uFEFF/, '');
  const records = [];

  let row = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field.trim());
    field = '';
  };

  const pushRow = () => {
    // Ignorar filas completamente vacías.
    const any = row.some((c) => (c || '').toString().trim().length > 0);
    if (any) records.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (ch === '"') {
      // Comilla escapada dentro de comillas: "" => "
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === ';') {
      pushField();
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      // Fin de línea (soporta \r\n)
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      pushField();
      pushRow();
      continue;
    }

    field += ch;
  }

  // Última fila
  pushField();
  pushRow();
  return records;
}

function parseCsv(content) {
  const records = parseCsvRecords(content);
  const rows = [];

  // Esquema esperado (retrocompatible):
  // 0 tipo
  // 1 pregunta
  // 2..5 r1..r4
  // 6 tiempo
  // 7 correcta
  // 8 imagen
  // 9 video
  // 10 texto
  // 11 numero
  // 12 tolerancia
  const EXPECTED_COLS = 13;

  for (const rawCells of records) {
    const cells = rawCells.map((c) => (c === undefined || c === null) ? '' : String(c).trim());
    if (cells.length < 8) continue;

    const first = (cells[0] || '').toLowerCase();
    if (first === 'tipo' || first === 'type') continue; // header lines

    // Heurística: si hay más columnas de las esperadas, suele ser por ';' dentro del SVG
    // pegado en `imagen` sin comillas. Para no desplazar `video` y extras, unimos el exceso
    // al campo `imagen`.
    let fixed = cells;
    if (cells.length > EXPECTED_COLS) {
      const extra = cells.length - EXPECTED_COLS;
      const imageStart = 8;
      const imageEnd = imageStart + extra; // inclusive merge into imagen
      const mergedImage = cells.slice(imageStart, imageEnd + 1).join(';');
      fixed = [
        ...cells.slice(0, imageStart),
        mergedImage,
        ...cells.slice(imageEnd + 1)
      ];
    }

    rows.push({
      tipo: fixed[0] || '',
      pregunta: fixed[1] || '',
      r1: fixed[2] || '',
      r2: fixed[3] || '',
      r3: fixed[4] || '',
      r4: fixed[5] || '',
      tiempo: fixed[6] || '',
      correcta: fixed[7] || '',
      imagen: fixed[8] || '',
      video: fixed[9] || '',
      texto: fixed[10] || '',
      numero: fixed[11] || '',
      tolerancia: fixed[12] || ''
    });
  }

  return rows;
}

function normalizeSvgDataUrl(value) {
  const raw = (value || '').toString().trim();
  if (!raw) return '';
  // Soportamos las variantes más comunes.
  // Ej: data:image/svg+xml;utf8,<svg ...>
  //     data:image/svg+xml;charset=utf-8,<svg ...>
  const lower = raw.toLowerCase();
  if (!lower.startsWith('data:image/svg+xml')) return raw;

  const commaIdx = raw.indexOf(',');
  if (commaIdx === -1) return raw;
  const header = raw.slice(0, commaIdx + 1);
  const payload = raw.slice(commaIdx + 1);
  if (!payload) return raw;

  const lowerPayload = payload.toLowerCase();
  const encodedEndTag = '%3c%2fsvg%3e';
  const encodedEndPos = lowerPayload.lastIndexOf(encodedEndTag);
  if (encodedEndPos !== -1) {
    return header + payload.slice(0, encodedEndPos + encodedEndTag.length);
  }

  const rawEndPos = lowerPayload.lastIndexOf('</svg>');
  if (rawEndPos !== -1) {
    const cut = payload.slice(0, rawEndPos + '</svg>'.length);
    // Si parece ya URL-encoded no tocamos más.
    if (/%[0-9a-fA-F]{2}/.test(payload)) return header + cut;
    if (/;base64/i.test(header)) return raw;
    return header + encodeURIComponent(cut);
  }

  // Si ya parece URL-encoded (tiene %3C, %23, etc.), no tocamos.
  if (/%[0-9a-fA-F]{2}/.test(payload)) return raw;

  // Si parece base64, tampoco.
  if (/;base64/i.test(header)) return raw;

  // Si contiene un SVG literal, lo codificamos.
  if (payload.includes('<svg') || payload.includes('<?xml') || payload.includes('<')) {
    return header + encodeURIComponent(payload);
  }
  return raw;
}

function toQuestion(row) {
  const answers = [row.r1, row.r2, row.r3, row.r4];
  const meta = normalizeQuestionMeta({
    type: row.tipo,
    correct: row.correcta,
    texto: row.texto,
    // Correspondencia importada de Moodle o GIFT: parejas ya separadas.
    pairs: Array.isArray(row.pairs) ? row.pairs : undefined,
    numero: row.numero,
    tolerancia: row.tolerancia
  });

  const base = {
    question: row.pregunta,
    answers,
    type: meta.type,
    correct: meta.correct,
    correctAnswers: meta.correctAnswers,
    time: Number(row.tiempo) || 0,
    image: normalizeSvgDataUrl(row.imagen || ''),
    video: row.video || ''
  };

  if (meta.type === 'short-answer') {
    return {
      ...base,
      acceptedAnswers: Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers : []
    };
  }

  if (meta.type === 'matching') {
    return {
      ...base,
      answers: ['', '', '', ''],
      pairs: meta.pairs || []
    };
  }

  if (meta.type === 'numeric') {
    return {
      ...base,
      numericAnswer: meta.numericAnswer,
      tolerance: meta.tolerance
    };
  }

  return base;
}

async function insertQuiz(filePath, quizName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCsv(content);

  if (rows.length === 0) {
    throw new Error('No se pudieron leer preguntas del CSV.');
  }

  // Prefer IPv4 loopback to evitar problemas de conexión con ::1
  const url = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/';
  const client = new MongoClient(url);
  await client.connect();

  const db = client.db('kahootDB');
  const collection = db.collection('kahootGames');

  const existing = await collection.find().toArray();
  const nextId = existing.length === 0
    ? 1
    : Math.max(...existing.map((doc) => doc.id || 0)) + 1;

  const quiz = {
    id: nextId,
    name: quizName,
    questions: rows.map(toQuestion)
  };

  await collection.insertOne(quiz);
  await client.close();

  return { id: nextId, count: quiz.questions.length };
}

async function main() {
  const [, , csvPath, nameArg] = process.argv;
  if (!csvPath) {
    console.error('Uso: node server/importCsv.js <ruta_csv> [nombre_quiz]');
    process.exit(1);
  }

  const quizName = nameArg || path.basename(csvPath, path.extname(csvPath));

  try {
    const result = await insertQuiz(csvPath, quizName);
    console.log(`Insertado quiz "${quizName}" (id ${result.id}) con ${result.count} preguntas desde ${csvPath}`);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { parseCsv, toQuestion, insertQuiz };
