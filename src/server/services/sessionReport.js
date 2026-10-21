const fs = require('fs');
const path = require('path');
const { splitAcceptedAnswers, parseLenientNumber, getQuestionMeta } = require('../questionUtils');

const finishedSessionReports = new Map(); // pin -> { csv, hostId, createdAt, cleanupTimer }
const FINISHED_SESSION_REPORT_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const FINISHED_SESSION_REPORT_DIR = path.join(__dirname, '../../logs/finished-session-reports');

function escapeCsvField(value) {
  const str = String(value === undefined || value === null ? '' : value);
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function quizToCsv(quiz) {
  const header = 'tipo;pregunta;r1;r2;r3;r4;tiempo;correcta;imagen;video;texto;numero;tolerancia';
  const lines = (quiz.questions || []).map((q) => {
    const answers = Array.isArray(q.answers) ? q.answers : ['', '', '', ''];
    const type = (q && q.type) ? String(q.type) : 'quiz';
    let correctVals = Array.isArray(q && q.correctAnswers) && q.correctAnswers.length
      ? q.correctAnswers.join(',')
      : (q && q.correct ? q.correct : 1);
    if (type === 'poll') correctVals = '';

    let texto = '';
    let numero = '';
    let tolerancia = '';

    if (type === 'short-answer') {
      const accepted = Array.isArray(q.acceptedAnswers)
        ? q.acceptedAnswers
        : splitAcceptedAnswers(q.texto || q.correctText || q.correcta || q.correct);
      texto = accepted.join('|');
      // Compatibilidad: en correctVals también ponemos las respuestas.
      correctVals = texto;
    }

    if (type === 'numeric') {
      const n = parseLenientNumber(q.numericAnswer ?? q.numero ?? q.correcta ?? q.correct);
      const t = parseLenientNumber(q.tolerance ?? q.tolerancia ?? q.numericTolerance);
      numero = n === null ? '' : String(n);
      tolerancia = t === null ? '0' : String(t);
      correctVals = numero;
    }

    const row = [
      escapeCsvField(type),
      escapeCsvField(q.question || ''),
      escapeCsvField(answers[0] || ''),
      escapeCsvField(answers[1] || ''),
      escapeCsvField(answers[2] || ''),
      escapeCsvField(answers[3] || ''),
      escapeCsvField(q.time || 20),
      escapeCsvField(correctVals),
      escapeCsvField(q.image || ''),
      escapeCsvField(q.video || ''),
      escapeCsvField(texto),
      escapeCsvField(numero),
      escapeCsvField(tolerancia)
    ];
    return row.join(';');
  });
  return [header].concat(lines).join('\n');
}

// Al arrancar el proceso, reengancha la limpieza de los informes ya escritos en disco:
// el temporizador que los borra vive solo en memoria, así que un reinicio del servidor
// (despliegue, crash, restart de PM2) lo pierde y el CSV con nombres/puntuaciones del
// alumnado se quedaría en disco para siempre. Recalculamos el tiempo restante a partir
// de la fecha de modificación del fichero y, si ya ha caducado, lo borramos ya mismo.
function resumeFinishedSessionReportCleanup() {
  let entries;
  try {
    entries = fs.readdirSync(FINISHED_SESSION_REPORT_DIR);
  } catch (err) {
    return;
  }
  const now = Date.now();
  entries
    .filter((name) => name.endsWith('.csv'))
    .forEach((csvName) => {
      const pinSafe = csvName.slice(0, -4);
      const csvPath = path.join(FINISHED_SESSION_REPORT_DIR, csvName);
      const metaPath = path.join(FINISHED_SESSION_REPORT_DIR, `${pinSafe}.json`);
      const removeFiles = () => {
        try { fs.unlinkSync(csvPath); } catch (e) { if (!e || e.code !== 'ENOENT') console.error('resumeFinishedSessionReportCleanup unlink csv', e); }
        try { fs.unlinkSync(metaPath); } catch (e) { if (!e || e.code !== 'ENOENT') console.error('resumeFinishedSessionReportCleanup unlink meta', e); }
      };
      let mtimeMs;
      try {
        mtimeMs = fs.statSync(csvPath).mtimeMs;
      } catch (err) {
        return;
      }
      const remaining = FINISHED_SESSION_REPORT_TTL_MS - (now - mtimeMs);
      if (remaining <= 0) {
        removeFiles();
        return;
      }
      const timer = setTimeout(removeFiles, remaining);
      if (timer && typeof timer.unref === 'function') timer.unref();
    });
}
resumeFinishedSessionReportCleanup();

// Factoría en vez d'exportar les funcions soltes: liveSessionToCsv necessita accedir al
// registre en viu de jugadors (players.getPlayers) quan no li passen una foto explícita
// (vore src/test/integration/sessionReport.test.js), i eixe registre és un únic Players()
// compartit, instanciat una sola vegada en server.js — no es pot duplicar ací.
module.exports = function createSessionReportService({ players }) {
  function liveSessionToCsv(game, playersOverride) {
    const playersInGame = Array.isArray(playersOverride) ? playersOverride : (players.getPlayers(game.hostId) || []);
    const totalQuestions = Math.max(0, Number(game && game.gameData && game.gameData.totalQuestions) || 0);
    const quizName = game && game.gameData && game.gameData.quizName ? game.gameData.quizName : '';
    const questions = (game && game.gameData && Array.isArray(game.gameData.questions)) ? game.gameData.questions : [];
    const globalTimePerQuestion = Number(game && game.gameData && game.gameData.options && game.gameData.options.timePerQuestion) || 0;
    const sorted = playersInGame.slice().sort((a, b) => {
      const scoreA = Number(a && a.gameData && a.gameData.score) || 0;
      const scoreB = Number(b && b.gameData && b.gameData.score) || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return String(a && a.name ? a.name : '').localeCompare(String(b && b.name ? b.name : ''), 'es');
    });

    function formatChoiceList(indices, answers) {
      const letters = ['A', 'B', 'C', 'D'];
      const list = Array.isArray(indices) ? indices : [];
      const out = [];
      list.forEach((raw) => {
        const idx = Number(raw);
        if (!Number.isFinite(idx) || idx < 1 || idx > 4) return;
        const label = letters[idx - 1] || String(idx);
        const text = (Array.isArray(answers) ? (answers[idx - 1] || '') : '').toString().trim();
        out.push(text ? `${label}: ${text}` : label);
      });
      return out.join(' | ');
    }

    function formatSubmissionForCsv(meta, question, submission) {
      if (submission === undefined || submission === null || submission === '') return '';
      if (meta.type === 'short-answer') {
        const text = submission && typeof submission === 'object' && submission.text !== undefined
          ? submission.text
          : submission;
        return String(text || '').trim();
      }
      if (meta.type === 'numeric') {
        const value = submission && typeof submission === 'object' && submission.number !== undefined
          ? submission.number
          : submission;
        return String(value === undefined || value === null ? '' : value).trim();
      }
      if (meta.type === 'multiple') {
        return formatChoiceList(Array.isArray(submission) ? submission : [], question.answers || []);
      }
      return formatChoiceList([submission], question.answers || []);
    }

    function formatCorrectForCsv(meta, question) {
      if (meta.type === 'short-answer') {
        const accepted = Array.isArray(meta.acceptedAnswers) ? meta.acceptedAnswers : [];
        return accepted.join(' | ');
      }
      if (meta.type === 'numeric') {
        const base = (meta.numericAnswer !== undefined && meta.numericAnswer !== null) ? meta.numericAnswer : '';
        const tol = (meta.tolerance !== undefined && meta.tolerance !== null) ? meta.tolerance : 0;
        if (base === '') return '';
        return Number(tol) > 0 ? `${base} +/- ${tol}` : String(base);
      }
      return formatChoiceList(meta.correctAnswers || [], question.answers || []);
    }

    const header = 'pin;quizId;quizNombre;preguntasTotales;posicion;alumno;puntuacionFinal;aciertos;fallos;sinResponder;preguntaNumero;tipo;enunciado;tiempoLimiteSegundos;respuestaJugador;respuestaCorrecta;resultado;tiempoRespuestaMs';
    const summaryHeader = 'RESUMEN FINAL';
    const summaryColumns = 'pin;quizId;quizNombre;preguntasTotales;posicion;alumno;puntuacionFinal;aciertos;fallos;sinResponder';
    const lines = [];
    const summaryLines = [];

    sorted.forEach((player, index) => {
      const score = Number(player && player.gameData && player.gameData.score) || 0;
      const correctCount = Number(player && player.gameData && player.gameData.correctCount) || 0;
      const wrongCount = Number(player && player.gameData && player.gameData.wrongCount) || 0;
      const answered = Math.max(0, correctCount + wrongCount);
      const unanswered = Math.max(0, totalQuestions - answered);
      const answerHistory = Array.isArray(player && player.gameData && player.gameData.answerHistory)
        ? player.gameData.answerHistory
        : [];
      const historyByQuestion = new Map();
      answerHistory.forEach((entry) => {
        const num = Number(entry && entry.questionNumber);
        if (!Number.isFinite(num) || num <= 0) return;
        historyByQuestion.set(num, entry);
      });

      for (let qIdx = 0; qIdx < questions.length; qIdx += 1) {
        const questionNumber = qIdx + 1;
        const question = questions[qIdx] || {};
        const meta = getQuestionMeta(question);
        const historyEntry = historyByQuestion.get(questionNumber);
        const playerAnswer = historyEntry ? formatSubmissionForCsv(meta, question, historyEntry.submission) : '';
        const correctAnswer = formatCorrectForCsv(meta, question);
        const result = historyEntry
          ? (historyEntry.isCorrect ? 'correcta' : 'incorrecta')
          : 'sin responder';
        const responseMs = historyEntry && typeof historyEntry.elapsedMs === 'number'
          ? Math.max(0, Math.round(historyEntry.elapsedMs))
          : '';
        const timeLimitSeconds = globalTimePerQuestion > 0
          ? globalTimePerQuestion
          : (Number(question.time) > 0 ? Number(question.time) : 20);

        lines.push([
          escapeCsvField(game.pin),
          escapeCsvField(game.gameData && game.gameData.gameid ? game.gameData.gameid : ''),
          escapeCsvField(quizName),
          escapeCsvField(totalQuestions),
          escapeCsvField(index + 1),
          escapeCsvField(player && player.name ? player.name : ''),
          escapeCsvField(Math.round(score)),
          escapeCsvField(correctCount),
          escapeCsvField(wrongCount),
          escapeCsvField(unanswered),
          escapeCsvField(questionNumber),
          escapeCsvField(meta.type || 'quiz'),
          escapeCsvField(question.question || ''),
          escapeCsvField(timeLimitSeconds),
          escapeCsvField(playerAnswer),
          escapeCsvField(correctAnswer),
          escapeCsvField(result),
          escapeCsvField(responseMs)
        ].join(';'));
      }

      if (questions.length === 0) {
        lines.push([
          escapeCsvField(game.pin),
          escapeCsvField(game.gameData && game.gameData.gameid ? game.gameData.gameid : ''),
          escapeCsvField(quizName),
          escapeCsvField(totalQuestions),
          escapeCsvField(index + 1),
          escapeCsvField(player && player.name ? player.name : ''),
          escapeCsvField(Math.round(score)),
          escapeCsvField(correctCount),
          escapeCsvField(wrongCount),
          escapeCsvField(unanswered),
          '', '', '', '', '', '', '', ''
        ].join(';'));
      }

      summaryLines.push([
        escapeCsvField(game.pin),
        escapeCsvField(game.gameData && game.gameData.gameid ? game.gameData.gameid : ''),
        escapeCsvField(quizName),
        escapeCsvField(totalQuestions),
        escapeCsvField(index + 1),
        escapeCsvField(player && player.name ? player.name : ''),
        escapeCsvField(Math.round(score)),
        escapeCsvField(correctCount),
        escapeCsvField(wrongCount),
        escapeCsvField(unanswered)
      ].join(';'));
    });

    return [summaryHeader, summaryColumns]
      .concat(summaryLines)
      .concat(['', header])
      .concat(lines)
      .join('\n');
  }

  function cacheFinishedSessionReport(game, playersOverride) {
    if (!game || !game.pin) return;
    try {
      const pinKey = String(game.pin);
      const pinSafe = pinKey.replace(/[^a-z0-9-_]+/gi, '_');
      const reportPath = path.join(FINISHED_SESSION_REPORT_DIR, `${pinSafe}.csv`);
      const metaPath = path.join(FINISHED_SESSION_REPORT_DIR, `${pinSafe}.json`);
      console.log('[cacheFinishedSessionReport] pin=' + pinKey + ', path=' + reportPath);
      const prev = finishedSessionReports.get(pinKey);
      if (prev && prev.cleanupTimer) {
        clearTimeout(prev.cleanupTimer);
      }

      const csv = liveSessionToCsv(game, playersOverride);
      const hostIdAtFinish = String(game.hostId || '');
      console.log('[cacheFinishedSessionReport] csv length=' + csv.length);

      try {
        fs.mkdirSync(FINISHED_SESSION_REPORT_DIR, { recursive: true });
        fs.writeFileSync(reportPath, csv, 'utf8');
        // Guardamos el hostId vigente en el momento del GameOver junto al CSV para poder
        // verificar la autoría del informe también cuando se sirve desde disco (partida
        // ya fuera de memoria), sin depender de que finishedSessionReports siga viva.
        fs.writeFileSync(metaPath, JSON.stringify({ hostId: hostIdAtFinish }), 'utf8');
        console.log('[cacheFinishedSessionReport] file written successfully');
      } catch (diskErr) {
        console.error('[cacheFinishedSessionReport] write disk error', diskErr);
      }

      const cleanupTimer = setTimeout(() => {
        finishedSessionReports.delete(pinKey);
        try {
          fs.unlinkSync(reportPath);
        } catch (unlinkErr) {
          if (!unlinkErr || unlinkErr.code !== 'ENOENT') {
            console.error('cacheFinishedSessionReport cleanup disk error', unlinkErr);
          }
        }
        try {
          fs.unlinkSync(metaPath);
        } catch (unlinkErr) {
          if (!unlinkErr || unlinkErr.code !== 'ENOENT') {
            console.error('cacheFinishedSessionReport cleanup meta error', unlinkErr);
          }
        }
      }, FINISHED_SESSION_REPORT_TTL_MS);
      if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
        cleanupTimer.unref();
      }

      finishedSessionReports.set(pinKey, {
        csv,
        hostId: hostIdAtFinish,
        createdAt: Date.now(),
        cleanupTimer
      });
    } catch (err) {
      console.error('cacheFinishedSessionReport error', err);
    }
  }

  return {
    quizToCsv,
    liveSessionToCsv,
    cacheFinishedSessionReport,
    finishedSessionReports,
    FINISHED_SESSION_REPORT_DIR
  };
};
