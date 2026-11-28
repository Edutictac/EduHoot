// Llegeix l'informe guardat d'una partida (CSV amb «RESUM FINAL» i el detall per alumne i pregunta)
// i en treu la classificació i els aciertos per pregunta, per mostrar-los a Mis partidas.

// Parser de CSV amb punt i coma, amb camps entre cometes (les cometes dobles i els salts de línia dins de cometes).
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ';') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const RESULT_KEYS = { correcta: 'correct', parcial: 'partial', incorrecta: 'wrong', 'sin responder': 'unanswered', encuesta: 'poll' };
const DETAIL_COLUMNS = 18;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseReportResults(csv) {
  const rows = parseCsvRows(String(csv || ''));
  const players = [];
  const questions = new Map();
  let section = null; // 'summaryHead' | 'summary' | 'detail' | null

  for (const row of rows) {
    const isBlank = row.length === 1 && row[0] === '';
    if (row[0] === 'RESUMEN FINAL') { section = 'summaryHead'; continue; }
    if (section === 'summaryHead') { section = 'summary'; continue; }
    if (section === 'summary') {
      if (isBlank) { section = null; continue; }
      players.push({
        position: num(row[4]),
        name: row[5] || '',
        score: num(row[6]),
        correct: num(row[7]),
        wrong: num(row[8]),
        unanswered: num(row[9])
      });
      continue;
    }
    if (row.length >= DETAIL_COLUMNS && row[10] === 'preguntaNumero') { section = 'detail'; continue; }
    if (section === 'detail' && row.length >= DETAIL_COLUMNS && row[10] !== '') {
      const number = num(row[10]);
      if (!questions.has(number)) {
        questions.set(number, { number, type: row[11] || 'quiz', text: row[12] || '', correct: 0, partial: 0, wrong: 0, unanswered: 0, poll: 0 });
      }
      const key = RESULT_KEYS[row[16]];
      if (key) questions.get(number)[key] += 1;
    }
  }

  players.sort((a, b) => a.position - b.position);
  const questionList = Array.from(questions.values()).sort((a, b) => a.number - b.number);
  return { players, questions: questionList };
}

module.exports = { parseReportResults, parseCsvRows };
