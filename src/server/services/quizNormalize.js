const {
  normalizeQuestionMeta,
  isFreeAnswerType,
  looksLikeFreeTypeQuestion,
  buildAnswerFields
} = require('../questionUtils');

// Funcions pures de normalització i neteja (text importat, preguntes,
// etiquetes, visibilitat, noms de jugador, dates, ids). Sense estat ni
// accés a BD. Mou el contingut de server.js, sense canviar comportament.

function normalizeSoloName(name) {
  const clean = (name || '').toString().trim();
  if (!clean) return 'Anónimo';
  return clean.slice(0, 40);
}

function normalizePlayerName(name) {
  const chars = (name || '').toString().match(/[0-9a-zA-Z]/g) || [];
  const trimmed = chars.join('').toUpperCase().slice(0, 3);
  return trimmed || '???';
}

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '-',
    mdash: '-',
    hellip: '...',
    lsquo: "'",
    rsquo: "'",
    ldquo: '"',
    rdquo: '"',
    aacute: 'á',
    eacute: 'é',
    iacute: 'í',
    oacute: 'ó',
    uacute: 'ú',
    agrave: 'à',
    egrave: 'è',
    igrave: 'ì',
    ograve: 'ò',
    ugrave: 'ù',
    auml: 'ä',
    euml: 'ë',
    iuml: 'ï',
    ouml: 'ö',
    uuml: 'ü',
    ntilde: 'ñ',
    ccedil: 'ç',
    Aacute: 'Á',
    Eacute: 'É',
    Iacute: 'Í',
    Oacute: 'Ó',
    Uacute: 'Ú',
    Agrave: 'À',
    Egrave: 'È',
    Igrave: 'Ì',
    Ograve: 'Ò',
    Ugrave: 'Ù',
    Auml: 'Ä',
    Euml: 'Ë',
    Iuml: 'Ï',
    Ouml: 'Ö',
    Uuml: 'Ü',
    Ntilde: 'Ñ',
    Ccedil: 'Ç'
  };
  return (value || '').toString().replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1] && entity[1].toLowerCase() === 'x';
      const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isFinite(code) && code > 0) {
        try {
          return String.fromCodePoint(code);
        } catch (e) {}
      }
      return match;
    }
    return Object.prototype.hasOwnProperty.call(named, entity) ? named[entity] : match;
  });
}

function cleanImportedText(value) {
  let text = (value || '').toString();
  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeHtmlEntities(text);
    if (decoded === text) break;
    text = decoded;
  }
  text = text.replace(/<\s*br\s*\/?\s*>/gi, ' ');
  text = text.replace(/<\/?[a-z][^>]*>/gi, '');
  text = text.replace(/\u00a0/g, ' ');
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeVideoUrl(value) {
  const raw = (value || '').toString().trim();
  if (!raw) return '';
  if (raw.startsWith('/uploads/')) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? raw : '';
  } catch (err) {
    return '';
  }
}

// Texto opcional de metadatos (idioma, licencia, descripción) con límite de tamaño.
function cleanMetaText(value, maxLength = 500) {
  if (value === undefined || value === null) return '';
  return cleanImportedText(value).slice(0, maxLength);
}

function normalizeQuestions(list = []) {
  return list
    .map((item) => {
      const answers = Array.isArray(item.answers) ? item.answers : [];
      const safeAnswers = [
        cleanImportedText(answers[0] || ''),
        cleanImportedText(answers[1] || ''),
        cleanImportedText(answers[2] || ''),
        cleanImportedText(answers[3] || '')
      ];
      const meta = normalizeQuestionMeta({
        ...item,
        question: cleanImportedText(item.question || ''),
        answers: safeAnswers,
        texto: cleanImportedText(item.texto || item.text || item.acceptedAnswers || item.correctText || ''),
        acceptedAnswers: Array.isArray(item.acceptedAnswers)
          ? item.acceptedAnswers.map(cleanImportedText)
          : cleanImportedText(item.acceptedAnswers || ''),
        correcta: cleanImportedText(item.correcta || ''),
        correct: Array.isArray(item.correct) ? item.correct : cleanImportedText(item.correct || ''),
        correctText: cleanImportedText(item.correctText || '')
      });
      const video = normalizeVideoUrl(item.video);
      const base = {
        question: cleanImportedText(item.question || ''),
        answers: safeAnswers,
        correct: meta.correct,
        correctAnswers: meta.correctAnswers,
        type: meta.type,
        time: Number(item.time) || 20,
        pointsMultiplier: Number(item.pointsMultiplier) > 1 ? 2 : 1,
        image: item.image || '',
        video
      };
      const answerFields = buildAnswerFields(item, meta, { hasVideo: Boolean(video) });
      if (Array.isArray(answerFields.acceptedAnswers)) {
        answerFields.acceptedAnswers = answerFields.acceptedAnswers.map(cleanImportedText);
      }
      return { ...base, ...answerFields };
    })
    .filter((q) => q.question.trim().length > 0);
}

function normalizeTags(list = []) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    let clean = (raw || '').toString().trim().toLowerCase();
    if (!clean) continue;
    try {
      clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (err) {}
    clean = clean.replace(
      /(^|[^a-z0-9])(\d+)\s*[\.\-]?\s*(º|ª|°|o|a|er|ero|era|ro|ra|do|da|to|ta|mo|ma|vo|va)(?=$|[^a-z0-9])/g,
      '$1$2'
    );
    clean = clean
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
      .replace(/^-|-$/g, '');
    if (!clean || out.includes(clean)) continue;
    out.push(clean);
  }
  return out;
}

function parseTagQuery(query = {}) {
  const values = [];
  const addValue = (value) => {
    if (Array.isArray(value)) {
      value.forEach(addValue);
      return;
    }
    if (typeof value !== 'string') return;
    value.split(',').forEach((part) => {
      if (part && part.trim()) values.push(part.trim());
    });
  };
  addValue(query.tag);
  addValue(query.tags);
  return normalizeTags(values);
}

function matchesTags(quiz, tags, tagMode = 'all') {
  if (!tags.length) return true;
  const quizTags = normalizeTags(quiz.tags || []);
  if (tagMode === 'all') {
    return tags.every((tag) => quizTags.includes(tag));
  }
  return tags.some((tag) => quizTags.includes(tag));
}

function toFiniteNumber(value, fallback = 0) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof value === 'object') {
    if (typeof value.toNumber === 'function') {
      try {
        const n = value.toNumber();
        return Number.isFinite(n) ? n : fallback;
      } catch (_) {
        // ignore
      }
    }
    if (typeof value.valueOf === 'function') {
      try {
        const v = value.valueOf();
        if (v !== value) return toFiniteNumber(v, fallback);
      } catch (_) {
        // ignore
      }
    }
    if (typeof value.toString === 'function') {
      try {
        const n = Number(value.toString());
        return Number.isFinite(n) ? n : fallback;
      } catch (_) {
        // ignore
      }
    }
  }
  return fallback;
}

function normalizeVisibility(value, fallback = 'private') {
  const allowed = ['private', 'unlisted', 'public'];
  if (!value) return fallback;
  const val = value.toString().toLowerCase();
  return allowed.includes(val) ? val : fallback;
}

function currentVisibility(quiz) {
  // legacy quizzes without visibility are treated as public
  return normalizeVisibility(quiz && quiz.visibility, 'public');
}

function normalizeAllowClone(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
}

// Multijugador: preguntas de respuesta libre (se omiten en multijugador).
function isMultiplayerFreeTypeQuestion(q) {
  if (!q) return false;
  const meta = normalizeQuestionMeta(q);
  if (isFreeAnswerType(meta.type)) return true;
  return looksLikeFreeTypeQuestion(q);
}

function coerceDate(value, fallback = null) {
  if (!value) return fallback;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

function normalizeQuizId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  if (!raw) return null;
  const num = parseInt(raw, 10);
  if (!Number.isNaN(num) && String(num) === raw) return num;
  return raw;
}

module.exports = {
  normalizeSoloName,
  normalizePlayerName,
  cleanImportedText,
  cleanMetaText,
  normalizeQuestions,
  normalizeTags,
  parseTagQuery,
  matchesTags,
  toFiniteNumber,
  normalizeVisibility,
  currentVisibility,
  normalizeAllowClone,
  isMultiplayerFreeTypeQuestion,
  coerceDate,
  normalizeQuizId
};
