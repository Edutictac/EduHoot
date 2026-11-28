// «Mostrar respuestas» (por defecto activado): si el anfitrión lo desactiva, al alumnado
// no le llega la respuesta correcta. El anfitrión siempre recibe el resultado completo.
const ANSWER_FIELDS = ['correctAnswers', 'acceptedAnswers', 'numericAnswer', 'tolerance', 'matchSolution', 'pairs', 'items', 'orderShown', 'orderSolution'];

function showCorrectAnswersOf(game) {
  return !(game && game.gameData && game.gameData.options && game.gameData.options.showCorrectAnswers === false);
}

// Copia de los datos de la pregunta sin la respuesta correcta.
function studentMetaOf(game, meta) {
  if (showCorrectAnswersOf(game)) return meta;
  const copy = { ...meta };
  ANSWER_FIELDS.forEach((f) => { delete copy[f]; });
  return copy;
}

// Lista de jugadores para el alumnado: el historial de respuestas (con «isCorrect» y lo enviado por cada
// jugador) delataría la solución, así que se retira si «Mostrar respuestas» está desactivado.
function studentPlayersOf(game, list) {
  if (showCorrectAnswersOf(game) || !Array.isArray(list)) return list;
  return list.map((p) => {
    if (!p || !p.gameData || !('answerHistory' in p.gameData)) return p;
    const gameData = { ...p.gameData };
    delete gameData.answerHistory;
    return { ...p, gameData };
  });
}

module.exports = { showCorrectAnswersOf, studentMetaOf, studentPlayersOf };
