// Importación de XML de Moodle (feature 15). Lee el formato que exporta EduHoot
// (services/moodleExport.js) y los tipos habituales de Moodle: opción múltiple,
// verdadero/falso, respuesta corta, numérica, emparejamiento (correspondencia) y ordenar (tipo «ordering» de AULES). Las demás preguntas se omiten y se
// devuelven en `skipped`.
//
// Sin dependencias: un lector de etiquetas acotado a este formato, para no añadir
// una librería XML a las dependencias de producción.

const { toQuestion } = require('../importCsv');
const { MATCHING_MAX_ITEMS, normalizeFreeText } = require('../questionUtils');
const { ORDER_GRADING, MIN_ITEMS: ORDER_MIN_ITEMS, MAX_ITEMS: ORDER_MAX_ITEMS } = require('./orderQuestion');

// Token: CDATA (contenido literal), comentario, etiqueta de cierre, etiqueta de
// apertura (con sus atributos) o texto.
const TOKEN_RE = /<!\[CDATA\[([\s\S]*?)\]\]>|<!--[\s\S]*?-->|<\/([A-Za-z][\w.:-]*)\s*>|<([A-Za-z][\w.:-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
const ATTR_RE = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function decodeEntities(value) {
  return String(value || '').replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X'
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[entity];
  });
}

// Texto plano de un fragmento HTML o de texto: sin etiquetas y con entidades decodificadas.
function plainText(raw) {
  return decodeEntities(String(raw || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Árbol mínimo: { name, attrs, children, text }. El texto se guarda en bruto (sin
// decodificar), y plainText() lo decodifica al usarlo.
function parseXml(content) {
  const root = { name: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  const xml = String(content || '');
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(xml)) !== null) {
    const current = stack[stack.length - 1];
    if (m[1] !== undefined) {
      current.text += m[1];
    } else if (m[2] !== undefined) {
      // Cierre: desapila hasta la etiqueta correspondiente.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].name === m[2]) {
          stack.length = i;
          break;
        }
      }
    } else if (m[3] !== undefined) {
      const attrs = {};
      let a;
      ATTR_RE.lastIndex = 0;
      while ((a = ATTR_RE.exec(m[4] || '')) !== null) {
        attrs[a[1]] = decodeEntities(a[2] !== undefined ? a[2] : a[3]);
      }
      const node = { name: m[3], attrs, children: [], text: '' };
      current.children.push(node);
      if (!m[5]) stack.push(node);
    } else if (m[6] !== undefined) {
      current.text += m[6];
    }
    // Los comentarios no capturan nada y se ignoran.
  }
  return root;
}

function child(node, name) {
  return node.children.find((c) => c.name === name) || null;
}

function children(node, name) {
  return node.children.filter((c) => c.name === name);
}

function textChild(node, name) {
  const c = child(node, name);
  if (!c) return '';
  const t = child(c, 'text');
  return t ? t.text : c.text;
}

// Primera imagen o vídeo incrustados en el enunciado (los exporta EduHoot como data: URL).
function mediaFromHtml(html) {
  const img = String(html || '').match(/<img[^>]*\ssrc="([^"]+)"/i);
  const video = String(html || '').match(/<video[^>]*\ssrc="([^"]+)"/i);
  return {
    image: img ? decodeEntities(img[1]) : '',
    video: video ? decodeEntities(video[1]) : ''
  };
}

function answersOf(question) {
  return children(question, 'answer').map((answer) => {
    const tolerance = child(answer, 'tolerance');
    return {
      text: plainText(child(answer, 'text') ? child(answer, 'text').text : answer.text),
      fraction: parseFloat(answer.attrs.fraction || '0') || 0,
      tolerance: tolerance ? plainText(tolerance.text) : ''
    };
  });
}

// Convierte una <question> de Moodle en una fila con las mismas columnas que el CSV.
// Devuelve null si el tipo no se admite (con el motivo).
function questionToRow(question) {
  const type = question.attrs.type || '';
  const htmlRaw = textChild(question, 'questiontext');
  const media = mediaFromHtml(decodeEntities(htmlRaw));
  const pregunta = plainText(htmlRaw) || plainText(textChild(question, 'name')) || 'Pregunta importada';
  const answers = answersOf(question);

  const base = {
    pregunta,
    r1: '', r2: '', r3: '', r4: '',
    texto: '', numero: '', tolerancia: '', correcta: '',
    tiempo: 0,
    imagen: media.image,
    video: media.video
  };

  if (type === 'multichoice') {
    if (answers.length > 4) return { skipped: 'too-many-answers' };
    const correct = answers.map((a, i) => (a.fraction > 0 ? i + 1 : 0)).filter(Boolean);
    if (!correct.length) return { skipped: 'no-correct-answer' };
    const single = (textChild(question, 'single') || 'true').trim() === 'true';
    answers.forEach((a, i) => { base['r' + (i + 1)] = a.text; });
    return {
      row: { ...base, tipo: single ? 'quiz' : 'multiple', correcta: single ? correct[0] : correct }
    };
  }

  if (type === 'truefalse') {
    if (answers.length < 2) return { skipped: 'bad-truefalse' };
    const trueIndex = answers[0].fraction > 0 ? 1 : 2;
    base.r1 = answers[0].text;
    base.r2 = answers[1].text;
    return { row: { ...base, tipo: 'true-false', correcta: trueIndex } };
  }

  if (type === 'shortanswer') {
    const accepted = answers.filter((a) => a.fraction > 0 && a.text).map((a) => a.text);
    if (!accepted.length) return { skipped: 'no-accepted-answer' };
    return { row: { ...base, tipo: 'short-answer', texto: accepted.join('|') } };
  }

  if (type === 'numerical') {
    if (!answers.length || !answers[0].text) return { skipped: 'no-numeric-answer' };
    return {
      row: { ...base, tipo: 'numeric', numero: answers[0].text, tolerancia: answers[0].tolerance || '0' }
    };
  }

  if (type === 'matching') {
    const pairs = children(question, 'subquestion').map((sub) => {
      const answer = child(sub, 'answer');
      return {
        left: plainText(child(sub, 'text') ? child(sub, 'text').text : sub.text),
        right: answer ? plainText(child(answer, 'text') ? child(answer, 'text').text : answer.text) : ''
      };
    }).filter((p) => p.right);
    const result = checkMatchingPairs(pairs);
    if (result.skipped) return result;
    return { row: { ...base, tipo: 'matching', pairs } };
  }

  if (type === 'ordering') {
    // La posició correcta és la fracció: en ordenar els elements per fracció surt l'ordre correcte.
    const items = answers.slice().sort((a, b) => a.fraction - b.fraction).map((a) => a.text).filter(Boolean);
    const check = checkOrderItems(items);
    if (check.skipped) return check;
    const layout = (textChild(question, 'layouttype') || 'VERTICAL').trim().toUpperCase() === 'HORIZONTAL' ? 'horizontal' : 'vertical';
    const gradingName = (textChild(question, 'gradingtype') || 'ABSOLUTE_POSITION').trim();
    const orderGrading = Object.prototype.hasOwnProperty.call(ORDER_GRADING, gradingName) ? ORDER_GRADING[gradingName] : ORDER_GRADING.ABSOLUTE_POSITION;
    return { row: { ...base, tipo: 'order', items, orderGrading, layout } };
  }

  if (type === 'category') return null;
  return { skipped: 'unsupported-type:' + type };
}

// Correspondencia importada (Moodle o GIFT): al menos 2 parejas, como mucho 8
// elementos y sin repetir la derecha (EduHoot no admite una respuesta para varias).
function checkMatchingPairs(pairs) {
  if (pairs.filter((p) => p.left).length < 2) return { skipped: 'not-enough-pairs' };
  if (pairs.length > MATCHING_MAX_ITEMS) return { skipped: 'too-many-pairs' };
  const seen = new Set();
  for (const p of pairs) {
    const key = normalizeFreeText(p.right) || p.right.toLowerCase();
    if (seen.has(key)) return { skipped: 'repeated-match-answer' };
    seen.add(key);
  }
  return {};
}

// Ordenar importada: entre 2 i 8 elements, sense repetir (els mateixos límits que EduHoot).
function checkOrderItems(items) {
  if (items.length < ORDER_MIN_ITEMS) return { skipped: 'not-enough-items' };
  if (items.length > ORDER_MAX_ITEMS) return { skipped: 'too-many-items' };
  if (new Set(items).size !== items.length) return { skipped: 'repeated-order-item' };
  return {};
}

// Motivo legible (en castellano) para el docente, a partir del código interno.
function describeSkipReason(code) {
  const reasons = {
    'too-many-answers': 'tiene más de 4 respuestas',
    'no-correct-answer': 'no tiene respuesta correcta',
    'bad-truefalse': 'verdadero/falso incompleto',
    'no-accepted-answer': 'no tiene respuesta aceptada',
    'no-numeric-answer': 'no tiene valor numérico',
    'not-enough-pairs': 'la correspondencia necesita al menos 2 parejas',
    'too-many-pairs': 'la correspondencia tiene más de 8 elementos',
    'repeated-match-answer': 'la correspondencia repite una respuesta en varias parejas',
    'not-enough-items': 'ordenar necesita al menos 2 elementos',
    'too-many-items': 'ordenar tiene más de 8 elementos',
    'repeated-order-item': 'ordenar repite un elemento'
  };
  if (reasons[code]) return reasons[code];
  if (String(code).startsWith('unsupported-type:')) {
    return 'tipo no compatible (' + String(code).slice('unsupported-type:'.length) + ')';
  }
  return 'no compatible';
}

// Devuelve { questions, skipped } con las preguntas en el formato de toQuestion().
// `skipped` lista las preguntas omitidas con su nombre y el motivo, para mostrárselo al docente.
// Lanza error si el contenido no es un <quiz> de Moodle.
function parseMoodleXml(content) {
  const doc = parseXml(content);
  const quiz = child(doc, 'quiz');
  if (!quiz) throw new Error('no-moodle-quiz');

  const rows = [];
  const skipped = [];
  children(quiz, 'question').forEach((question) => {
    const result = questionToRow(question);
    if (result === null) return; // categorías: no son preguntas
    if (result.skipped) {
      skipped.push({
        name: plainText(textChild(question, 'name')) || 'Sin nombre',
        code: result.skipped,
        reason: describeSkipReason(result.skipped)
      });
      return;
    }
    rows.push(result.row);
  });

  return { questions: rows.map(toQuestion), skipped };
}

module.exports = { parseMoodleXml, parseXml, decodeEntities, plainText, describeSkipReason, checkMatchingPairs };
