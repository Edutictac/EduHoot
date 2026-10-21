const { splitAcceptedAnswers, parseLenientNumber } = require('../questionUtils');

function escapeHtmlText(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttrValue(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function wrapCdata(value = '') {
  const str = String(value || '');
  const safe = str.replace(/]]>/g, ']]]]><![CDATA[>');
  return `<![CDATA[${safe}]]>`;
}

function buildQuestionHtml(question) {
  const parts = [];
  const text = (question.question || '').trim();
  if (text) {
    parts.push(`<p>${escapeHtmlText(text)}</p>`);
  }
  if (question.image) {
    parts.push(`<p><img src="${escapeAttrValue(question.image)}" alt=""/></p>`);
  }
  if (question.video) {
    parts.push(
      `<p><video controls="controls" preload="metadata" src="${escapeAttrValue(
        question.video
      )}"></video></p>`
    );
  }
  return parts.join('');
}

function quizToMoodleXml(quiz) {
  const title = (quiz.name || 'EduHoot quiz').trim() || 'EduHoot quiz';
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<quiz>'];

  function normalizeCorrectAnswersForExport(question, maxAnswerIndex) {
    const limit = Math.max(1, parseInt(maxAnswerIndex, 10) || 4);
    const list = Array.isArray(question && question.correctAnswers) && question.correctAnswers.length
      ? question.correctAnswers.slice()
      : (typeof question?.correct !== 'undefined' ? [question.correct] : []);
    const seen = new Set();
    const out = [];
    list.forEach((v) => {
      let num = parseInt(v, 10);
      if (!Number.isFinite(num)) return;
      num = Math.max(1, Math.min(limit, num));
      if (seen.has(num)) return;
      seen.add(num);
      out.push(num);
    });
    if (!out.length) out.push(1);
    out.sort((a, b) => a - b);
    return out;
  }

  function getNonEmptyAnswersForExport(question, maxCount) {
    const raw = Array.isArray(question && question.answers) ? question.answers.slice(0, maxCount) : [];
    while (raw.length < maxCount) raw.push('');
    const out = [];
    raw.forEach((text, idx) => {
      const clean = (text || '').toString().trim();
      if (!clean) return;
      out.push({ index: idx + 1, text: clean });
    });
    return out;
  }

  function getTfFallbackAnswers() {
    return ['Verdadero', 'Falso'];
  }

  questions.forEach((question, index) => {
    const qType = (question && question.type) ? String(question.type) : 'quiz';
    const nameText = `${title} pregunta ${index + 1}`;
    const html = buildQuestionHtml(question) || `<p>${escapeHtmlText((question && question.question) || '')}</p>`;

    if (qType === 'short-answer') {
      lines.push('  <question type="shortanswer">');
      lines.push(`    <name><text>${wrapCdata(nameText)}</text></name>`);
      lines.push('    <questiontext format="html">');
      lines.push(`      <text>${wrapCdata(html)}</text>`);
      lines.push('    </questiontext>');
      lines.push('    <defaultgrade>1</defaultgrade>');
      lines.push('    <penalty>0.0</penalty>');
      lines.push('    <hidden>0</hidden>');
      // Moodle: 0 = no distinguir mayúsculas/minúsculas.
      lines.push('    <usecase>0</usecase>');

      const accepted = Array.isArray(question.acceptedAnswers)
        ? question.acceptedAnswers
        : splitAcceptedAnswers(question.texto || question.correctText || question.correcta || question.correct);

      const safe = accepted.length ? accepted : [''];
      safe.forEach((ans) => {
        lines.push('    <answer fraction="100" format="html">');
        lines.push(`      <text>${wrapCdata(escapeHtmlText(ans || ''))}</text>`);
        lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
        lines.push('    </answer>');
      });
      lines.push('  </question>');
      return;
    }

    if (qType === 'numeric') {
      lines.push('  <question type="numerical">');
      lines.push(`    <name><text>${wrapCdata(nameText)}</text></name>`);
      lines.push('    <questiontext format="html">');
      lines.push(`      <text>${wrapCdata(html)}</text>`);
      lines.push('    </questiontext>');
      lines.push('    <defaultgrade>1</defaultgrade>');
      lines.push('    <penalty>0.0</penalty>');
      lines.push('    <hidden>0</hidden>');

      const n = parseLenientNumber(question.numericAnswer ?? question.numero ?? question.correcta ?? question.correct);
      const t = parseLenientNumber(question.tolerance ?? question.tolerancia ?? question.numericTolerance);
      const tol = t === null ? 0 : t;
      lines.push('    <answer fraction="100" format="html">');
      lines.push(`      <text>${wrapCdata(escapeHtmlText(n === null ? '' : String(n)))}</text>`);
      lines.push(`      <tolerance>${wrapCdata(escapeHtmlText(String(tol)))}</tolerance>`);
      lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
      lines.push('    </answer>');
      lines.push('  </question>');
      return;
    }

    if (qType === 'true-false') {
      lines.push('  <question type="truefalse">');
      lines.push(`    <name><text>${wrapCdata(nameText)}</text></name>`);
      lines.push('    <questiontext format="html">');
      lines.push(`      <text>${wrapCdata(html)}</text>`);
      lines.push('    </questiontext>');
      lines.push('    <defaultgrade>1</defaultgrade>');
      lines.push('    <penalty>0.0</penalty>');
      lines.push('    <hidden>0</hidden>');

      const tfAnswers = getNonEmptyAnswersForExport(question, 2);
      const tfFallback = getTfFallbackAnswers();
      const trueLabel = (tfAnswers[0] && tfAnswers[0].text) ? tfAnswers[0].text : tfFallback[0];
      const falseLabel = (tfAnswers[1] && tfAnswers[1].text) ? tfAnswers[1].text : tfFallback[1];
      const tfCorrect = normalizeCorrectAnswersForExport(question, 2);
      const correctIsTrue = tfCorrect[0] === 1;

      lines.push(`    <answer fraction="${correctIsTrue ? '100' : '0'}" format="html">`);
      lines.push(`      <text>${wrapCdata(escapeHtmlText(trueLabel))}</text>`);
      lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
      lines.push('    </answer>');
      lines.push(`    <answer fraction="${correctIsTrue ? '0' : '100'}" format="html">`);
      lines.push(`      <text>${wrapCdata(escapeHtmlText(falseLabel))}</text>`);
      lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
      lines.push('    </answer>');
      lines.push('  </question>');
      return;
    }

    // Por defecto: multichoice (single o multiple)
    const isMultiple = qType === 'multiple';
    lines.push('  <question type="multichoice">');
    lines.push(`    <name><text>${wrapCdata(nameText)}</text></name>`);
    lines.push('    <questiontext format="html">');
    lines.push(`      <text>${wrapCdata(html)}</text>`);
    lines.push('    </questiontext>');
    lines.push('    <defaultgrade>1</defaultgrade>');
    lines.push('    <penalty>0.0</penalty>');
    lines.push('    <hidden>0</hidden>');
    lines.push(`    <single>${isMultiple ? 'false' : 'true'}</single>`);
    lines.push('    <shuffleanswers>true</shuffleanswers>');
    lines.push('    <answernumbering>abc</answernumbering>');

    let answerItems = getNonEmptyAnswersForExport(question, 4);
    if (answerItems.length < 2) {
      const fallback = getTfFallbackAnswers();
      answerItems = [
        { index: 1, text: fallback[0] },
        { index: 2, text: fallback[1] }
      ];
    }

    const correctAnswers = normalizeCorrectAnswersForExport(question, 4);
    let correctMap = {};
    correctAnswers.forEach((n) => { correctMap[n] = true; });
    const anyCorrectVisible = answerItems.some((it) => !!correctMap[it.index]);
    if (!anyCorrectVisible) {
      correctMap = {};
      correctMap[answerItems[0].index] = true;
    }

    let correctCount = answerItems.reduce((acc, it) => acc + (correctMap[it.index] ? 1 : 0), 0);
    if (correctCount <= 0) correctCount = 1;
    const perCorrect = isMultiple ? (100 / correctCount) : 100;

    answerItems.forEach((item) => {
      const fraction = correctMap[item.index] ? perCorrect : 0;
      const fractionStr = (Math.round(fraction * 100000) / 100000).toString();
      lines.push(`    <answer fraction="${fractionStr}" format="html">`);
      lines.push(`      <text>${wrapCdata(escapeHtmlText(item.text || ''))}</text>`);
      lines.push('      <feedback><text><![CDATA[]]></text></feedback>');
      lines.push('    </answer>');
    });
    lines.push('  </question>');
  });

  lines.push('</quiz>');
  return lines.join('\n');
}

module.exports = {
  quizToMoodleXml
};
