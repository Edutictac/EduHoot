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
- [Exportación a Moodle XML](#exportación-a-moodle-xml)
- [Modos de juego](#modos-de-juego)
- [Avance de pregunta: ¿automático o manual?](#avance-de-pregunta-automático-o-manual)

## Unión a la partida: nombre e icono del jugador

Cuando un alumno se une a una partida (pantalla de `join`, código en
`src/public/js/join.js`):

- **El nombre lo escribe el propio alumno**, en un campo de texto libre. No
  existe ningún generador de apodos aleatorios (es una mejora propuesta en
  `POPULAR_FEATURES.md`, pendiente de implementar).
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

## Exportación a Moodle XML

Cada quiz de la biblioteca (`/create/`) tiene, junto al botón de descarga en
CSV, un botón con el icono de Moodle (`src/public/js/create.js:2046`,
función `downloadMoodleXml()` en la línea 2396) que descarga ese mismo quiz
convertido al formato Moodle XML, listo para importarlo al banco de
preguntas de Moodle/AULES y montar ahí un "Cuestionario" nativo.

- **Endpoint**: `GET /api/quizzes/:id/moodle-xml` (`src/server/server.js:2901`),
  que llama a la función `quizToMoodleXml()` (línea 1095).
- **Tipos de pregunta que convierte**: opción múltiple de una o varias
  respuestas correctas (`multichoice`), verdadero/falso (`truefalse`),
  respuesta corta (`shortanswer`) y numérica con tolerancia (`numerical`).
  El enunciado y las respuestas se exportan en HTML.
- **Qué no incluye**: esto exporta solo el banco de preguntas, no la
  partida en sí. En Moodle/AULES el alumno resolvería el cuestionario de
  forma independiente, sin la mecánica de juego de EduHoot (marcador,
  ritmo marcado por el profesor, PIN, etc.) ni paso automático de la nota
  a EduHoot.

Esta función no requiere que el centro habilite nada a nivel de servidor
(a diferencia de una integración LTI): el profesorado solo necesita poder
importar un fichero XML al banco de preguntas de su propio curso.

## Modos de juego

Al crear o lanzar un quiz desde la biblioteca (`src/public/js/create.js`),
hay tres botones/modos distintos. Solo uno de ellos está pensado para una
clase con un dispositivo por alumno:

| Modo (botón) | Función / destino | Para qué sirve |
|---|---|---|
| **"Jugar en el aula"** | `startGame(quiz.id)` → `/host/` (`create.js:2249-2251`) | El modo clásico tipo Kahoot: se genera un PIN/QR, cada alumno se une desde su propio móvil/tablet vía `/join`, y el profesor proyecta las preguntas desde `/host/`. **Es el modo a usar con un grupo de alumnos, cada uno con su dispositivo.** Es *host-paced*: el profesor controla el ritmo (ver sección siguiente). |
| **"Multijugador"** | `startMultiplayer(quiz.id)` → `/multiplayer/` | Pensado para 2-4 jugadores compartiendo **una sola pantalla/dispositivo** ("Juega en la misma pantalla", `src/public/multiplayer/index.html:18-19`). No sirve para una clase con un dispositivo por alumno. |
| **"Solo"** | `startSolo(quiz.id)` → `/solo/` | Modo individual, para practicar fuera de clase (ver también los [enlaces directos al modo Solo](README.md) del README). No es un modo de grupo. |

Para una clase con muchos alumnos, cada uno con su propio dispositivo, la
única opción correcta hoy es **"Jugar en el aula"**.

## Avance de pregunta: ¿automático o manual?

**Hoy no existe ninguna opción para que las preguntas avancen solas.** No
hay ningún toggle ni en el creador del quiz (`src/public/create/index.html`,
`src/public/js/quizCreator.js`) ni en la pantalla de host
(`src/public/host/index.html`, `src/public/js/host.js`) para activar un
avance automático.

Lo que sí es automático es el **cierre de una pregunta**:
- Si todos los jugadores responden antes de tiempo, el servidor lo detecta
  (`playersAnswered === playerNum.length`, `src/server/server.js:3692-3697`)
  y muestra resultados.
- Si se acaba el tiempo, el host emite `timeUp` y el servidor hace lo mismo
  (`src/server/server.js:3725-3747`).

Pero eso solo abre la pantalla de resultados/ranking. **Pasar a la pregunta
siguiente requiere siempre una acción explícita del profesor**: pulsar el
botón "Siguiente pregunta" (o la tecla Enter) en ese modal
(`handleResultsModalNext()` → `nextQuestion()`, `src/public/js/hostGame.js:983-1007,1263`),
lo que emite el evento de Socket.IO `nextQuestion`. El servidor solo avanza
la pregunta dentro de ese handler (`socket.on('nextQuestion', ...)`,
`src/server/server.js:3773-3882`) — no existe ningún temporizador en el
servidor que dispare ese avance por sí solo.

En resumen: en el modo "Jugar en el aula", el profesor tiene que estar
pendiente de pulsar "Siguiente pregunta" después de cada pregunta. Un modo
"autoritmo" (cada alumno avanza solo) o un modo de presentación que avance
sin intervención del profesor son mejoras pendientes, no implementadas
todavía — están recogidas en `POPULAR_FEATURES.md` ("Modo autoritmo
(self-paced)" y "Modo 'presentación' híbrido").
