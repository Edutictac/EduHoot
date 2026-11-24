// Pregunta d'ordenar (feature 7, part «ordenar»): model i puntuació, sense E/S.
// Els elements es guarden en l'ordre correcte: items[i] és el que ha d'anar a la posició i.
// Una resposta és una permutació: answer[k] = índex (de items) col·locat en la posició k.
// Les regles de puntuació segueixen els modes de qtype_ordering de Moodle (vore ORDER_PLAN.md, decisió 5b).

const MIN_ITEMS = 2;
const MAX_ITEMS = 8;

// Constants de gradingtype (com a Moodle).
const ORDER_GRADING = {
  ALL_OR_NOTHING: -1,
  ABSOLUTE_POSITION: 0,
  RELATIVE_NEXT_EXCLUDE_LAST: 1,
  RELATIVE_NEXT_INCLUDE_LAST: 2,
  RELATIVE_ONE_PREVIOUS_AND_NEXT: 3,
  RELATIVE_ALL_PREVIOUS_AND_NEXT: 4,
  LONGEST_ORDERED_SUBSET: 5,
  LONGEST_CONTIGUOUS_SUBSET: 6,
  RELATIVE_TO_CORRECT: 7
};

// Normalitza els elements de la pregunta (en ordre correcte). Retorna { items } o { error }.
function normalizeOrderItems(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const items = list
    .map((v) => (v === null || v === undefined ? '' : String(v).trim()))
    .filter((v) => v !== '');
  if (items.length < MIN_ITEMS) return { error: 'Calen almenys 2 elements.' };
  if (items.length > MAX_ITEMS) return { error: 'Com a màxim 8 elements.' };
  if (new Set(items).size !== items.length) return { error: 'Els elements no es poden repetir.' };
  return { items };
}

// És una permutació de 0..n-1?
function isPermutation(answer, n) {
  if (!Array.isArray(answer) || answer.length !== n) return false;
  const seen = new Set();
  for (const v of answer) {
    if (!Number.isInteger(v) || v < 0 || v >= n || seen.has(v)) return false;
    seen.add(v);
  }
  return true;
}

// Mida de la subseqüència creixent més llarga (valors diferents, ja és una permutació).
function longestIncreasing(values) {
  const tails = [];
  for (const v of values) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < v) lo = mid + 1; else hi = mid;
    }
    tails[lo] = v;
  }
  return tails.length;
}

// Proporció de la puntuació (0..1) segons el mode de Moodle. Resposta incompleta o no vàlida: 0.
function orderScoreRatio(answer, n, mode = ORDER_GRADING.ABSOLUTE_POSITION) {
  if (!Number.isInteger(n) || n < 2) return 0;
  if (!isPermutation(answer, n)) return 0;
  const last = n - 1;
  switch (mode) {
    case ORDER_GRADING.ALL_OR_NOTHING:
      return answer.every((v, i) => v === i) ? 1 : 0;
    case ORDER_GRADING.ABSOLUTE_POSITION:
      return answer.filter((v, i) => v === i).length / n;
    case ORDER_GRADING.RELATIVE_TO_CORRECT: {
      // Cada element puntua (n-1) menys la distància a la seua posició correcta, sense baixar de zero.
      const total = answer.reduce((sum, v, i) => sum + Math.max(0, last - Math.abs(i - v)), 0);
      return total / (n * last);
    }
    case ORDER_GRADING.RELATIVE_NEXT_EXCLUDE_LAST: {
      // Un punt per cada element (excepte l'últim de la resposta) seguit del correcte.
      let hits = 0;
      for (let i = 0; i < last; i++) if (answer[i + 1] === answer[i] + 1) hits++;
      return hits / last;
    }
    case ORDER_GRADING.RELATIVE_NEXT_INCLUDE_LAST: {
      // Igual, i a més l'últim de la resposta ha de ser l'últim correcte.
      let hits = 0;
      for (let i = 0; i < last; i++) if (answer[i + 1] === answer[i] + 1) hits++;
      if (answer[last] === last) hits++;
      return hits / n;
    }
    case ORDER_GRADING.RELATIVE_ONE_PREVIOUS_AND_NEXT: {
      // Fins a dos punts per element: l'anterior i el posterior correctes. Als extrems, el «buit» també compta si és correcte.
      let total = 0;
      for (let i = 0; i < n; i++) {
        const prevOk = i === 0 ? answer[i] === 0 : answer[i - 1] === answer[i] - 1;
        const nextOk = i === last ? answer[i] === last : answer[i + 1] === answer[i] + 1;
        if (prevOk) total++;
        if (nextOk) total++;
      }
      return total / (2 * n);
    }
    case ORDER_GRADING.RELATIVE_ALL_PREVIOUS_AND_NEXT: {
      // Un punt per cada altre element que està bé respecte a aquest, en qualsevol distància.
      let total = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          if ((j < i && answer[j] < answer[i]) || (j > i && answer[j] > answer[i])) total++;
        }
      }
      return total / (n * last);
    }
    case ORDER_GRADING.LONGEST_ORDERED_SUBSET: {
      const len = longestIncreasing(answer);
      return len >= 2 ? len / n : 0;
    }
    case ORDER_GRADING.LONGEST_CONTIGUOUS_SUBSET: {
      let best = 1;
      let run = 1;
      for (let i = 0; i < last; i++) {
        run = answer[i + 1] === answer[i] + 1 ? run + 1 : 1;
        if (run > best) best = run;
      }
      return best >= 2 ? best / n : 0;
    }
    default:
      return 0;
  }
}

// Correcta si la puntuació és total (com a la correspondència: només l'encert total compta per a la ratxa).
function orderIsCorrect(answer, n, mode) {
  return orderScoreRatio(answer, n, mode) === 1;
}

module.exports = {
  MIN_ITEMS,
  MAX_ITEMS,
  ORDER_GRADING,
  normalizeOrderItems,
  isPermutation,
  orderScoreRatio,
  orderIsCorrect
};
