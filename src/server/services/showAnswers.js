// «Mostrar respuestas» (por defecto activado): si el anfitrión lo desactiva, al alumnado
// no le llega la respuesta correcta. El anfitrión siempre recibe el resultado completo.
const ANSWER_FIELDS = ['correctAnswers', 'acceptedAnswers', 'numericAnswer', 'tolerance', 'matchSolution', 'pairs'];

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

module.exports = { showCorrectAnswersOf, studentMetaOf };
