const VALID_TYPES = new Set(['quiz', 'multiple', 'true-false', 'short-answer', 'numeric', 'poll', 'matching']);

// Correspondencia: como máximo 8 elementos en la columna derecha (parejas + impostoras).
const MATCHING_MAX_ITEMS = 8;

function normalizeFreeText(value) {
  let str = (value || '').toString().trim().toLowerCase();
  if (!str) return '';
  try {
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (e) {}
  // Quitar puntuación/símbolos y colapsar espacios.
  str = str.replace(/[^a-z0-9\s]/g, ' ');
  str = str.replace(/\s+/g, ' ').trim();
  return str;
}

function splitAcceptedAnswers(raw) {
  const text = (raw || '').toString().trim();
  if (!text) return [];
  // Permitimos separadores | y , (y también saltos de línea).
  const parts = text.split(/[|\n]+/g).flatMap((chunk) => chunk.split(','));
  const out = [];
  const seen = new Set();
  for (const part of parts) {
    const original = (part || '').toString().trim();
    if (!original) continue;
    const key = normalizeFreeText(original);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(original);
  }
  return out;
}

function parseLenientNumber(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  // Acepta coma decimal.
  const normalized = raw.replace(/\s+/g, '').replace(',', '.');
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function normalizeQuestionType(rawType) {
  const value = (rawType || '').toString().toLowerCase().trim();
  if (!value) return 'quiz';

  // Normaliza: quita acentos y convierte separadores (_, -, /, etc.) a espacios.
  let ascii = value;
  try {
    ascii = ascii.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (e) {}
  const key = ascii.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (key === 'quiz') return 'quiz';
  if (['poll', 'survey', 'encuesta', 'enquesta'].includes(key)) return 'poll';
  if (
    ['matching', 'match', 'correspondencia', 'emparejar', 'emparejamiento', 'emparellar',
      'emparellament', 'relacionar'].includes(key)
  ) {
    return 'matching';
  }
  if (key === 'multiple' || key.includes('multi')) return 'multiple';

  if (
    key === 'short answer' ||
    key === 'shortanswer' ||
    key === 'short' ||
    key.includes('short answer') ||
    key.includes('respuesta corta') ||
    key.includes('resposta curta')
  ) {
    return 'short-answer';
  }

  if (
    key === 'numeric' ||
    key === 'numerical' ||
    key === 'numerica' ||
    key === 'num' ||
    key === 'numero' ||
    key.includes('numeric') ||
    key.includes('numerical') ||
    key.includes('numerica') ||
    key.includes('resposta numerica') ||
    key.includes('respuesta numerica')
  ) {
    return 'numeric';
  }

  if (
    key === 'true false' ||
    key === 'truefalse' ||
    key === 'true false question' ||
    key === 'tf' ||
    (key.includes('true') && key.includes('false')) ||
    (key.includes('verdadero') && key.includes('falso')) ||
    (key.includes('vertader') && key.includes('fals')) ||
    (key.includes('veritable') && key.includes('fals'))
  ) {
    return 'true-false';
  }

  return 'quiz';
}

function toValidAnswerIndex(value) {
  if (value === undefined || value === null) return null;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return null;
  if (parsed < 1) return 1;
  if (parsed > 4) return 4;
  return parsed;
}

function isFreeAnswerType(type) {
  return type === 'short-answer' || type === 'numeric';
}

// Correspondencia: lee las parejas de un array [{ left, right }] o de un texto
// «izquierda -> derecha | ... | -> impostora». Una pareja sin izquierda es una
// impostora (solo aparece en la columna derecha). Se descartan las derechas vacías
// o repetidas y se limita a MATCHING_MAX_ITEMS.
function parseMatchingPairs(raw) {
  let list = [];
  if (Array.isArray(raw)) {
    list = raw.map((p) => ({
      left: p && p.left !== undefined && p.left !== null ? String(p.left) : '',
      right: p && p.right !== undefined && p.right !== null ? String(p.right) : ''
    }));
  } else if (typeof raw === 'string' && raw.includes('->')) {
    list = raw.split(/[|\n]+/g).map((chunk) => {
      const idx = chunk.indexOf('->');
      if (idx === -1) return { left: '', right: chunk };
      return { left: chunk.slice(0, idx), right: chunk.slice(idx + 2) };
    });
  }
  const out = [];
  const seen = new Set();
  for (const p of list) {
    const left = p.left.trim();
    const right = p.right.trim();
    if (!right) continue;
    const key = normalizeFreeText(right) || right.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ left, right });
    if (out.length >= MATCHING_MAX_ITEMS) break;
  }
  return out;
}

// Parejas en una línea de texto (columna `texto` del CSV): «a -> b | -> impostora».
function formatMatchingPairs(pairs) {
  return parseMatchingPairs(pairs)
    .map((p) => (p.left ? `${p.left} -> ${p.right}` : `-> ${p.right}`))
    .join(' | ');
}

function looksLikeMatchingText(raw) {
  if (typeof raw !== 'string') return false;
  return raw.split(/[|\n]+/g).filter((chunk) => /\S\s*->\s*\S/.test(chunk)).length >= 2;
}

// Disposición de una correspondencia en partida: la izquierda en el orden guardado
// (solo las parejas reales), la derecha (con impostoras) en el orden que dé `order`,
// y la solución: para cada elemento de la izquierda, el índice (desde 0) de su
// derecha. Sin `order`, la derecha sigue el orden guardado.
function buildMatchingLayout(pairs, order) {
  const list = Array.isArray(pairs) ? pairs : [];
  const domain = list.map((_, idx) => idx);
  const rightOrder = Array.isArray(order) && order.length === domain.length ? order : domain;
  const right = rightOrder.map((idx) => list[idx].right);
  const left = [];
  const solution = [];
  list.forEach((pair, idx) => {
    if (!pair.left) return;
    left.push(pair.left);
    solution.push(rightOrder.indexOf(idx));
  });
  return { matchLeft: left, matchRight: right, matchSolution: solution };
}

// Disposición ya barajada que trae una pregunta de partida, si es coherente.
function readMatchingLayout(item) {
  const left = item.matchLeft;
  const right = item.matchRight;
  const solution = item.matchSolution;
  if (!Array.isArray(left) || !Array.isArray(right) || !Array.isArray(solution)) return null;
  if (!left.length || solution.length !== left.length) return null;
  const valid = solution.every((v) => Number.isInteger(v) && v >= 0 && v < right.length);
  if (!valid) return null;
  return {
    matchLeft: left.map(String),
    matchRight: right.map(String),
    matchSolution: solution.slice()
  };
}

// Respuesta del alumno: para cada elemento de la izquierda, el índice elegido de la
// derecha (desde 0) o null si lo deja sin emparejar.
function normalizeMatchingSubmission(raw, leftCount, rightCount) {
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.matches) ? raw.matches : []);
  const out = [];
  for (let i = 0; i < leftCount; i += 1) {
    const v = list[i];
    const n = v === null || v === undefined || v === '' ? NaN : Number(v);
    out.push(Number.isInteger(n) && n >= 0 && n < rightCount ? n : null);
  }
  return out;
}

// Proporción de parejas acertadas (0..1).
function matchingScoreRatio(meta, submission) {
  const solution = meta && Array.isArray(meta.matchSolution) ? meta.matchSolution : [];
  if (!solution.length) return 0;
  const rightCount = Array.isArray(meta.matchRight) ? meta.matchRight.length : 0;
  const answer = normalizeMatchingSubmission(submission, solution.length, rightCount);
  const hits = solution.filter((value, idx) => answer[idx] === value).length;
  return hits / solution.length;
}

function normalizeCorrectAnswers(rawCorrect, fallback = true) {
  const answers = [];
  const seen = new Set();
  const add = (candidate) => {
    const idx = toValidAnswerIndex(candidate);
    if (!idx || seen.has(idx)) return;
    seen.add(idx);
    answers.push(idx);
  };

  if (Array.isArray(rawCorrect)) {
    rawCorrect.forEach(add);
  } else if (typeof rawCorrect === 'string') {
    rawCorrect.split(',').forEach((part) => add(part.trim()));
  } else if (typeof rawCorrect === 'number') {
    add(rawCorrect);
  }

  if (!answers.length && fallback) {
    answers.push(1);
  }

  return answers;
}

function normalizeQuestionMeta(item = {}) {
  let type = normalizeQuestionType(item.type || item.tipo);

  // Inferencia retrocompatible: si el CSV trae columnas nuevas pero el tipo viene
  // vacío/ruidoso (o no reconocido), deducimos el tipo a partir de esos campos.
  if (type === 'quiz') {
    const inferredNumber = parseLenientNumber(item.numero || item.number || item.numericAnswer);
    const inferredTol = parseLenientNumber(item.tolerancia || item.tolerance || item.numericTolerance);
    const hasNumericSignals = inferredNumber !== null || inferredTol !== null;
    if (hasNumericSignals) {
      type = 'numeric';
    } else if (looksLikeMatchingText(item.texto || item.text) || (Array.isArray(item.pairs) && item.pairs.length)) {
      type = 'matching';
    } else {
      const rawText = (item.texto || item.text || item.acceptedAnswers || item.correctText || '').toString().trim();
      if (rawText) type = 'short-answer';
    }
  }
  const correctCandidates = item.correctAnswers || item.correcta || item.correct;
  let correctAnswers = type === 'poll' ? [] : normalizeCorrectAnswers(correctCandidates);

  let acceptedAnswers = [];
  let numericAnswer = null;
  let tolerance = null;
  let pairs = [];
  let layout = null;

  if (type === 'matching') {
    pairs = parseMatchingPairs(Array.isArray(item.pairs) ? item.pairs : (item.pairs || item.texto || item.text || ''));
    layout = readMatchingLayout(item) || buildMatchingLayout(pairs);
  }

  if (type === 'short-answer') {
    const rawText = item.texto || item.text || item.acceptedAnswers || item.correctText || item.correcta || item.correct;
    acceptedAnswers = splitAcceptedAnswers(rawText);
  }

  if (type === 'numeric') {
    const rawNumber = item.numero || item.number || item.numericAnswer || item.correcta || item.correct;
    numericAnswer = parseLenientNumber(rawNumber);
    tolerance = parseLenientNumber(item.tolerancia || item.tolerance || item.numericTolerance);
    if (tolerance === null) tolerance = 0;
  }

  if (type === 'true-false') {
    // En verdadero/falso solo hay 2 opciones visibles.
    const seen = new Set();
    const clamped = [];
    correctAnswers.forEach((value) => {
      let v = parseInt(value, 10);
      if (Number.isNaN(v)) return;
      if (v < 1) v = 1;
      if (v > 2) v = 2;
      if (seen.has(v)) return;
      seen.add(v);
      clamped.push(v);
    });
    correctAnswers = clamped.length ? clamped : [1];
  }

  // Para tipos no indexados, mantenemos defaults para compatibilidad.
  if (type === 'short-answer' || type === 'numeric' || type === 'matching') {
    correctAnswers = [1];
  }
  const meta = {
    type,
    correctAnswers,
    correct: correctAnswers[0] || 1,
    acceptedAnswers,
    numericAnswer,
    tolerance
  };
  if (type === 'matching') {
    meta.pairs = pairs;
    Object.assign(meta, layout);
  }
  return meta;
}

function getQuestionMeta(question) {
  if (!question) {
    return { correctAnswers: [1], type: 'quiz' };
  }
  const meta = normalizeQuestionMeta(question);
  const out = {
    correctAnswers: meta.correctAnswers,
    type: meta.type,
    acceptedAnswers: meta.acceptedAnswers,
    numericAnswer: meta.numericAnswer,
    tolerance: meta.tolerance
  };
  if (meta.type === 'matching') {
    out.matchLeft = meta.matchLeft;
    out.matchRight = meta.matchRight;
    out.matchSolution = meta.matchSolution;
  }
  return out;
}

function looksLikeFreeTypeQuestion(q) {
  if (!q) return false;
  // Señales defensivas por si el tipo está corrupto pero vienen campos libres.
  const accepted = q.acceptedAnswers;
  const hasAccepted = Array.isArray(accepted)
    ? accepted.length > 0
    : (typeof accepted === 'string' && accepted.trim().length > 0);

  const hasNumeric =
    (typeof q.numericAnswer === 'number') ||
    (q.numericAnswer !== null && q.numericAnswer !== undefined && typeof q.numericAnswer === 'string' && q.numericAnswer.trim().length > 0) ||
    (q.numero !== null && q.numero !== undefined && String(q.numero).trim().length > 0) ||
    (q.tolerancia !== null && q.tolerancia !== undefined && String(q.tolerancia).trim().length > 0) ||
    (q.tolerance !== null && q.tolerance !== undefined && String(q.tolerance).trim().length > 0);

  return hasAccepted || hasNumeric;
}

function isSubmissionCorrect(meta, submission) {
  if (!meta || !Array.isArray(meta.correctAnswers) || !meta.correctAnswers.length) {
    return false;
  }
  if (meta.type === 'matching') {
    return matchingScoreRatio(meta, submission) === 1;
  }
  if (meta.type === 'short-answer') {
    const raw = submission && typeof submission === 'object' && submission.text !== undefined ? submission.text : submission;
    const normalized = normalizeFreeText(raw);
    if (!normalized) return false;
    const accepted = Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers : splitAcceptedAnswers(meta.acceptedAnswers);
    return accepted.some((ans) => normalizeFreeText(ans) === normalized);
  }
  if (meta.type === 'numeric') {
    const raw = submission && typeof submission === 'object' && submission.number !== undefined ? submission.number : submission;
    const num = parseLenientNumber(raw);
    if (num === null) return false;
    const target = typeof meta.numericAnswer === 'number' ? meta.numericAnswer : parseLenientNumber(meta.numericAnswer);
    if (target === null) return false;
    const tol = typeof meta.tolerance === 'number' ? meta.tolerance : (parseLenientNumber(meta.tolerance) || 0);
    return Math.abs(num - target) <= Math.max(0, tol);
  }
  if (meta.type === 'multiple') {
    if (!Array.isArray(submission) || submission.length === 0) {
      return false;
    }
    const submissionSet = new Set(submission);
    if (submissionSet.size !== meta.correctAnswers.length) {
      return false;
    }
    return meta.correctAnswers.every((value) => submissionSet.has(value));
  }
  const normalized = Array.isArray(submission) ? submission[0] : submission;
  return Number(normalized) === meta.correctAnswers[0];
}

function buildAnswerFields(item = {}, meta, { hasVideo = false } = {}) {
  if (meta.type === 'short-answer') {
    const recoveredAnswers = !meta.acceptedAnswers.length && !hasVideo
      ? splitAcceptedAnswers(item.video)
      : [];
    return {
      acceptedAnswers: [
        ...(Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers : []),
        ...recoveredAnswers
      ]
    };
  }
  if (meta.type === 'numeric') {
    return {
      numericAnswer: meta.numericAnswer,
      tolerance: meta.tolerance
    };
  }
  if (meta.type === 'matching') {
    return { pairs: Array.isArray(meta.pairs) ? meta.pairs.map((p) => ({ ...p })) : [] };
  }
  return {};
}

// Cómo responde el móvil a ciegas una correspondencia (lo elige el profesor en el lobby):
// select = desplegables, codes = toques con números y letras, steps = paso a paso.
const MATCHING_BLIND_STYLES = ['codes', 'select', 'steps'];

function normalizeMatchingBlindStyle(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return MATCHING_BLIND_STYLES.includes(value) ? value : 'codes';
}

// Más tiempo para las correspondencias (lo elige el anfitrión): porcentaje sobre el
// tiempo de la pregunta. Por defecto, un 50 % más.
const MATCHING_EXTRA_TIME_PERCENTS = [25, 50, 75, 100];
const MATCHING_EXTRA_TIME_DEFAULT = 50;

function normalizeMatchingExtraTime(raw) {
  const value = parseInt(raw, 10);
  return MATCHING_EXTRA_TIME_PERCENTS.includes(value) ? value : MATCHING_EXTRA_TIME_DEFAULT;
}

function hasMatchingQuestion(questions) {
  return (Array.isArray(questions) ? questions : [])
    .some((q) => q && normalizeQuestionMeta(q).type === 'matching');
}

module.exports = {
  normalizeQuestionType,
  normalizeCorrectAnswers,
  normalizeQuestionMeta,
  getQuestionMeta,
  splitAcceptedAnswers,
  parseLenientNumber,
  normalizeFreeText,
  isFreeAnswerType,
  looksLikeFreeTypeQuestion,
  isSubmissionCorrect,
  buildAnswerFields,
  parseMatchingPairs,
  formatMatchingPairs,
  buildMatchingLayout,
  normalizeMatchingSubmission,
  matchingScoreRatio,
  normalizeMatchingBlindStyle,
  hasMatchingQuestion,
  normalizeMatchingExtraTime,
  MATCHING_EXTRA_TIME_PERCENTS,
  MATCHING_EXTRA_TIME_DEFAULT,
  MATCHING_BLIND_STYLES,
  MATCHING_MAX_ITEMS,
  VALID_TYPES
};
