# Funcionamiento de EduHoot

Documento vivo que explica, con referencias concretas al código, cómo
funcionan por dentro las distintas funciones de EduHoot. A diferencia del
`README.md` (orientado a quien quiere instalar/usar la app) o el
`CHANGELOG.md` (qué cambió en cada versión), este documento explica **cómo
funciona cada cosa hoy**, con el nivel de detalle necesario para responder
preguntas de soporte, redactar documentación de cara al profesorado, o
retomar el desarrollo de una función sin tener que releer todo el código.

Se completará progresivamente, a medida que surjan preguntas sobre el
funcionamiento del proyecto.

## Índice

- [Unión a la partida: nombre e icono del jugador](#unión-a-la-partida-nombre-e-icono-del-jugador)
- [Informe de partida (descarga en CSV)](#informe-de-partida-descarga-en-csv)

## Unión a la partida: nombre e icono del jugador

Cuando un alumno se une a una partida (pantalla de `join`, código en
`src/public/js/join.js`):

- **El nombre lo escribe el propio alumno**, en un campo de texto libre. No
  existe ningún generador de apodos aleatorios (es una mejora propuesta en
  `KAHOOT_FEATURES.md`, pendiente de implementar).
- El nombre se normaliza antes de enviarse: se recortan espacios al
  principio/final, se colapsan espacios múltiples, y se limita a un máximo
  de caracteres (`normalizeGuestName` / `normalizeGuestNameLive`,
  `join.js:122-131`). Según el `README.md`, el límite en multijugador es de
  40 caracteres.
- Además del nombre, el alumno elige un **icono/emoji** de un selector
  visual (`icon-picker`) que lo identifica en la partida.
- En la vista del host (`src/public/js/host.js:349-369`), cada jugador que
  se une aparece como una tarjeta (no una lista de texto plano), con su
  icono y su nombre, mediante el evento de Socket.IO `updatePlayerLobby`.

No hay, por tanto, ningún sistema de cuentas de alumno ni login previo para
jugar: el nombre que escribe cada alumno es el único identificador dentro de
esa partida concreta.

## Informe de partida (descarga en CSV)

Al terminar una partida, el profesor/host puede descargar un informe
completo de los resultados:

- **Botón**: "Descargar informe (CSV)" en la vista del host
  (`src/public/js/hostGame.js:130`, función `downloadSessionReportCsv()`
  en la línea 382).
- **Endpoint**: `GET /api/live-games/:pin/report.csv?hostId=...`
  (`src/server/server.js:2943`). El servidor comprueba que el `hostId` que
  llega en la petición coincide con el host real de esa partida; si no,
  responde `403 No autorizado para descargar este informe`. Esto evita que
  cualquiera con el PIN de la partida pueda descargar los resultados.
- **Disponibilidad tras la partida**: el informe se sirve primero desde la
  partida en memoria si el servidor sigue arriba; si no, se busca en disco
  (los ficheros de informe se guardan y se limpian de forma programada,
  `src/server/server.js`, ver también `CHANGELOG.md` 1.0.5). Esto permite
  descargar el informe incluso si el servidor se ha reiniciado después de
  que terminara la partida (antes de la versión 1.0.5 esto devolvía un 404).

### Columnas del CSV

Cabecera definida en `src/server/server.js:832`:

```
pin;quizId;quizNombre;preguntasTotales;posicion;alumno;puntuacionFinal;
aciertos;fallos;sinResponder;preguntaNumero;tipo;enunciado;
tiempoLimiteSegundos;respuestaJugador;respuestaCorrecta;resultado;
tiempoRespuestaMs
```

El CSV mezcla dos niveles de información en el mismo fichero:

- **Resumen por alumno** (columnas `pin`, `quizId`, `quizNombre`,
  `preguntasTotales`, `posicion`, `alumno`, `puntuacionFinal`, `aciertos`,
  `fallos`, `sinResponder`): una fila-resumen por jugador con su posición
  final, puntuación total, y recuento de aciertos/fallos/preguntas sin
  responder.
- **Detalle por pregunta** (columnas `preguntaNumero`, `tipo`, `enunciado`,
  `tiempoLimiteSegundos`, `respuestaJugador`, `respuestaCorrecta`,
  `resultado`, `tiempoRespuestaMs`): una fila por cada pregunta respondida
  por cada alumno, con lo que respondió, si fue correcto, y cuánto tardó.

**No hay una columna de "% de aciertos" ya calculada.** Para obtenerlo hay
que calcularlo a partir de `aciertos` / `preguntasTotales` en una hoja de
cálculo (por ejemplo, con una fórmula `=aciertos/preguntasTotales` por fila
de alumno).
