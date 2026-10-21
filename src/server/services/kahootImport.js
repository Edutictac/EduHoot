const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KAHOOT_IMG_DOMAIN = 'media.kahoot.it';
const KAHOOT_IMG_MAX_BYTES = 5 * 1024 * 1024; // 5 MB por imagen
const KAHOOT_IMG_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']);
const KAHOOT_IMG_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg' };

function isExternalImgHost(hostname) {
  if (!hostname) return false;
  if (hostname === KAHOOT_IMG_DOMAIN) return true;
  if (hostname.endsWith('.amazonaws.com') || hostname === 'amazonaws.com') return true;
  return false;
}

function extractKahootId(raw = '') {
  if (!raw) return '';
  const idMatch = raw.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (idMatch) return idMatch[1];
  const clean = raw.trim();
  if (clean.length === 36) return clean;
  return '';
}

// Factoria d'importació de Kahoot: mirroritza imatges externes/de Kahoot i
// mapeja preguntes del format Kahoot al format propi. Mou el contingut de
// server.js, sense canviar comportament.
module.exports = function createKahootImportService({ publicPath, normalizeQuestions, cleanImportedText }) {
  const uploadsPath = path.join(publicPath, 'uploads', 'quiz-images');
  fs.mkdirSync(uploadsPath, { recursive: true });

  async function mirrorExternalImage(imageUrl) {
    if (!imageUrl || imageUrl.startsWith('/') || imageUrl.startsWith('data:')) return imageUrl;
    try {
      const parsed = new URL(imageUrl);
      if (!isExternalImgHost(parsed.hostname)) return imageUrl;
      const hash = crypto.createHash('sha256').update(imageUrl).digest('hex');
      const existing = fs.readdirSync(uploadsPath).find(f => f.startsWith(hash));
      if (existing) return `/uploads/quiz-images/${existing}`;
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) return imageUrl;
      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!KAHOOT_IMG_ALLOWED_TYPES.has(contentType)) return imageUrl;
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > KAHOOT_IMG_MAX_BYTES) return imageUrl;
      const ext = KAHOOT_IMG_EXT[contentType] || '.bin';
      const filename = hash + ext;
      fs.writeFileSync(path.join(uploadsPath, filename), Buffer.from(buffer));
      return `/uploads/quiz-images/${filename}`;
    } catch (err) {
      console.warn('mirrorExternalImage failed for', imageUrl, err.message);
      return imageUrl;
    }
  }

  async function mirrorKahootImage(imageUrl) {
    if (!imageUrl) return '';
    try {
      const parsed = new URL(imageUrl);
      if (parsed.hostname !== KAHOOT_IMG_DOMAIN) return imageUrl; // solo mirrorizar imágenes de Kahoot
      const hash = crypto.createHash('sha256').update(imageUrl).digest('hex');
      // Buscar si ya existe en disco (cualquier extensión)
      const existing = fs.readdirSync(uploadsPath).find(f => f.startsWith(hash));
      if (existing) return `/uploads/quiz-images/${existing}`;
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) return imageUrl;
      const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!KAHOOT_IMG_ALLOWED_TYPES.has(contentType)) return imageUrl;
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > KAHOOT_IMG_MAX_BYTES) return imageUrl;
      const ext = KAHOOT_IMG_EXT[contentType] || '.bin';
      const filename = hash + ext;
      fs.writeFileSync(path.join(uploadsPath, filename), Buffer.from(buffer));
      return `/uploads/quiz-images/${filename}`;
    } catch (err) {
      console.warn('mirrorKahootImage failed for', imageUrl, err.message);
      return imageUrl; // fallback a URL original
    }
  }

  function mapKahootQuestions(kQuestions = []) {
    function detectPointsMultiplier(kQuestion) {
      if (!kQuestion || typeof kQuestion !== 'object') return 1;
      if (kQuestion.doublePoints === true) return 2;
      const rawCandidates = [
        kQuestion.pointsMultiplier,
        kQuestion.points_multiplier,
        kQuestion.scoreMultiplier,
        kQuestion.multiplier
      ];
      for (let i = 0; i < rawCandidates.length; i += 1) {
        const n = Number(rawCandidates[i]);
        if (Number.isFinite(n) && n > 1) return 2;
      }
      const textCandidates = [kQuestion.pointsType, kQuestion.pointType, kQuestion.points, kQuestion.scoringType]
        .map((v) => String(v || '').toLowerCase());
      const hasDouble = textCandidates.some((value) => value.includes('double') || value.includes('2x'));
      return hasDouble ? 2 : 1;
    }

    return normalizeQuestions(
      (kQuestions || []).map((q) => {
        const answers = Array.isArray(q.choices) ? q.choices : [];
        const textAnswers = answers.map((a) => cleanImportedText((a && a.answer) || '')).slice(0, 4);
        while (textAnswers.length < 4) textAnswers.push('');
        const correctIdx = Math.max(
          0,
          answers.findIndex((a) => a && a.correct)
        );
        return {
          question: cleanImportedText(q.question || ''),
          answers: textAnswers,
          correct: correctIdx + 1,
          time: Math.round((q.time || 20000) / 1000) || 20,
          pointsMultiplier: detectPointsMultiplier(q),
          image: q.image || '',
          video: (q.video && q.video.full_url) || ''
        };
      })
    );
  }

  return { extractKahootId, mirrorExternalImage, mirrorKahootImage, mapKahootQuestions };
};
