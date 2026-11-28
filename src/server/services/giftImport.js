// Importación de GIFT de Moodle (feature 15). Formato de texto plano:
//   ::Título:: Enunciado {=correcta ~incorrecta ~incorrecta}
// Tipos admitidos: opción múltiple (una o varias correctas con %peso%), verdadero/falso,
// respuesta corta (varias respuestas «=»), numérica (#valor, #valor:tolerancia o
// #mín..máx) y emparejamiento (=izquierda -> derecha; «= -> texto» es una impostora). Las categorías, los comentarios y el resto de tipos se omiten o ignoran
// y las omitidas se devuelven en `skipped`, igual que en el XML.
//
// Sin dependencias, como el lector de XML.

const { toQuestion } = require('../importCsv');
const { describeSkipReason, checkMatchingPairs } = require('./moodleXmlImport');

// Primera posición de `ch` sin escapar (un «\» escapa el carácter siguiente).
function findUnescaped(str, ch, from = 0) {
  for (let i = from; i < str.length; i++) {
    if (str[i] === '\\') { i++; continue; }
    if (str[i] === ch) return i;
  }
  return -1;
}

function unescape(str) {
  return String(str || '').replace(/\\(.)/g, '$1');
}

// Quita el [html] inicial y las marcas de GIFT del enunciado.
function cleanQuestionText(raw) {
  return unescape(String(raw || '').replace(/^\s*\[html\]/i, '')).replace(/\s+/g, ' ').trim();
}

// Separa las respuestas de un bloque {…}: cada una empieza por «=» (correcta) o «~» (incorrecta).
function splitAnswers(inner) {
  const segments = [];
  let current = null;
  let raw = '';
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '\\') {
      raw += c + (inner[i + 1] || '');
      i++;
      continue;
    }
    if (c === '=' || c === '~') {
      if (current) segments.push({ prefix: current, raw });
      current = c;
      raw = '';
      continue;
    }
    raw += c;
  }
  if (current) segments.push({ prefix: current, raw });
  return segments.map((seg) => {
    let text = seg.raw.trim();
    let weight = seg.prefix === '=' ? 100 : 0;
    const pct = text.match(/^%(-?\d+(?:\.\d+)?)%/);
    if (pct) {
      weight = parseFloat(pct[1]);
      text = text.slice(pct[0].length);
    }
    // Retroalimentación: lo que va después de un «#» sin escapar.
    const hash = findUnescaped(text, '#');
    if (hash >= 0) text = text.slice(0, hash);
    return { prefix: seg.prefix, weight, text: unescape(text).trim() };
  });
}

// Bloque de respuestas numéricas: #valor, #valor:tolerancia o #mín..máx.
function numericFromInner(inner) {
  const m = inner.trim().match(/^#\s*(-?\d+(?:\.\d+)?)(?:\s*:\s*(-?\d+(?:\.\d+)?)|\s*\.\.\s*(-?\d+(?:\.\d+)?))?/);
  if (!m) return null;
  if (m[3] !== undefined) {
    const low = parseFloat(m[1]);
    const high = parseFloat(m[3]);
    return { numero: String((low + high) / 2), tolerancia: String(Math.abs(high - low) / 2) };
  }
  return { numero: m[1], tolerancia: m[2] !== undefined ? m[2] : '0' };
}

// Convierte un bloque (sin el título) en una fila o en un motivo de omisión.
function blockToRow(body) {
  const open = findUnescaped(body, '{');
  const close = open >= 0 ? findUnescaped(body, '}', open + 1) : -1;
  if (open < 0 || close < 0) return { skipped: 'malformed' };

  const enunciado = cleanQuestionText(body.slice(0, open));
  const inner = body.slice(open + 1, close).trim();
  const base = {
    pregunta: enunciado || 'Pregunta importada',
    r1: '', r2: '', r3: '', r4: '',
    texto: '', numero: '', tolerancia: '', correcta: '',
    tiempo: 0, imagen: '', video: ''
  };

  if (inner === '') return { skipped: 'unsupported-type:essay' };

  if (/^(T|TRUE|F|FALSE)$/i.test(inner)) {
    const isTrue = /^T/i.test(inner);
    return { row: { ...base, tipo: 'true-false', r1: 'Verdadero', r2: 'Falso', correcta: isTrue ? 1 : 2 } };
  }

  if (inner.startsWith('#')) {
    const numeric = numericFromInner(inner);
    if (!numeric) return { skipped: 'no-numeric-answer' };
    return { row: { ...base, tipo: 'numeric', numero: numeric.numero, tolerancia: numeric.tolerancia } };
  }

  // Emparejamiento: «=izquierda -> derecha» (correspondencia). Sin izquierda, impostora.
  if (/->/.test(inner)) {
    const pairs = splitAnswers(inner)
      .filter((a) => a.prefix === '=')
      .map((a) => {
        const idx = a.text.indexOf('->');
        return idx < 0
          ? { left: '', right: a.text.trim() }
          : { left: a.text.slice(0, idx).trim(), right: a.text.slice(idx + 2).trim() };
      })
      .filter((p) => p.right);
    const result = checkMatchingPairs(pairs);
    if (result.skipped) return result;
    return { row: { ...base, tipo: 'matching', pairs } };
  }

  const answers = splitAnswers(inner).filter((a) => a.text !== '' || a.weight !== 0);
  const correct = answers.filter((a) => a.weight > 0 && a.text !== '');

  // Sin incorrectas: respuesta corta (cada «=» es una respuesta aceptada).
  if (!answers.some((a) => a.prefix === '~')) {
    const accepted = correct.map((a) => a.text);
    if (!accepted.length) return { skipped: 'no-accepted-answer' };
    return { row: { ...base, tipo: 'short-answer', texto: accepted.join('|') } };
  }

  // Opción múltiple: hasta 4 respuestas, con una o varias correctas.
  if (answers.length > 4) return { skipped: 'too-many-answers' };
  if (!correct.length) return { skipped: 'no-correct-answer' };
  answers.forEach((a, i) => { base['r' + (i + 1)] = a.text; });
  const indexes = answers.map((a, i) => (a.weight > 0 ? i + 1 : 0)).filter(Boolean);
  const multiple = correct.length > 1;
  return {
    row: { ...base, tipo: multiple ? 'multiple' : 'quiz', correcta: multiple ? indexes : indexes[0] }
  };
}

// Devuelve { questions, skipped } con las preguntas en el formato de toQuestion().
function parseGift(content) {
  const text = String(content || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line) && !/^\s*\$CATEGORY/i.test(line))
    .join('\n');

  const rows = [];
  const skipped = [];
  text.split(/\n\s*\n/).forEach((chunk) => {
    let body = chunk.trim();
    if (!body) return;

    let title = '';
    if (body.startsWith('::')) {
      const end = body.indexOf('::', 2);
      if (end > 1) {
        title = body.slice(2, end).trim();
        body = body.slice(end + 2).trim();
      }
    }

    const result = blockToRow(body);
    if (result.skipped) {
      skipped.push({
        name: title || cleanQuestionText(body.slice(0, Math.max(0, body.indexOf('{')))).slice(0, 60) || 'Sin nombre',
        code: result.skipped,
        reason: describeSkipReason(result.skipped)
      });
      return;
    }
    if (title) result.row.pregunta = result.row.pregunta === 'Pregunta importada' ? title : result.row.pregunta;
    rows.push(result.row);
  });

  return { questions: rows.map(toQuestion), skipped };
}

module.exports = { parseGift, splitAnswers, numericFromInner };
