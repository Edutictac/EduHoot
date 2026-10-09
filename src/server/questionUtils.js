const VALID_TYPES = new Set(['quiz', 'multiple', 'true-false', 'short-answer', 'numeric', 'poll']);

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
  if (type === 'short-answer' || type === 'numeric') {
    correctAnswers = [1];
  }
  return {
    type,
    correctAnswers,
    correct: correctAnswers[0] || 1,
    acceptedAnswers,
    numericAnswer,
    tolerance
  };
}

module.exports = {
  normalizeQuestionType,
  normalizeCorrectAnswers,
  normalizeQuestionMeta,
  splitAcceptedAnswers,
  parseLenientNumber,
  VALID_TYPES
};
