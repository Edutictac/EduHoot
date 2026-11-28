// Estado de cada alumno para la vista del anfitrión durante una pregunta:
// si ha enviado la respuesta, si ha levantado la mano y si está fuera de la pestaña.
// Solo se envía a la sala del anfitrión, nunca a los alumnos.
// Quien ha abandonado la partida y aún no ha vuelto a entrar (mismo nombre).
// Se muestra en la lista de estado como «Abandono», sin contar en el resumen.
function leftListOf(game, currentPlayers) {
  const current = (currentPlayers || []).map((p) => p.name);
  return ((game && game.leftPlayers) || []).filter((l) => !current.includes(l.name));
}

function buildAnswerStatus(playersList, questionNumber, leftList) {
  const rows = (playersList || []).map((player) => {
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
  const left = (leftList || []).map((l) => ({
    playerId: l.id,
    name: l.name,
    icon: l.icon || '',
    answered: false,
    hand: false,
    away: false,
    streak: 0,
    left: true
  }));
  return rows.concat(left);
}

module.exports = { buildAnswerStatus, leftListOf };
