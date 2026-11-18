// Estado de cada alumno para la vista del anfitrión durante una pregunta:
// si ha enviado la respuesta, si ha levantado la mano y si está fuera de la pestaña.
// Solo se envía a la sala del anfitrión, nunca a los alumnos.
function buildAnswerStatus(playersList, questionNumber) {
  return (playersList || []).map((player) => {
    const data = player.gameData || {};
    return {
      playerId: player.playerId,
      name: player.name,
      icon: player.icon || '',
      answered: data.answeredQuestion === questionNumber,
      hand: data.handRaisedQuestion === questionNumber,
      away: !!data.tabAway,
      streak: Number(data.streak) || 0
    };
  });
}

module.exports = { buildAnswerStatus };
