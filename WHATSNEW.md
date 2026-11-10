# Què és nové (Valencian)

- **Noves pantalles Vue 3**: El lobby de l'amfitrió (`/host/`), la pantalla de joc de l'alumnat (`/player/game/`) i la pantalla de joc de l'amfitrió (`/host/game/`) són ara apps Vue 3 Sense passos de build: es carreguen directament des del navegador.
- **Compte arrere 3-2-1**: abans de cada pregunta en el mode "Jugar a l'aula" es mostren els números 3, 2, 1.
- **Mod "a cegues"**: L'amfitrió pot ocultar l'enunciat i només mostrar botons amb formes i colors a l'alumnat; el resum de respostes es fa sempre a la pantalla compartida.
- **Visualització d'logs administratrics**: Des del `/admin/logs` es poden filtrar per nivell, etiqueta i cerca de text; es poden descarregar en CSV i NDJSON.
- **Informe de partida CSV**: Després de acabar una partida, l'amfitrió pot descarregar un informe complet amb dades per alumne i per pregunta; el fitxer inclou columnes de puntuació, acerts, falls i temps de resposta.
- **Distintiu d'entorn**: A la pestanya del navegador i amb colour de fons es indica si l'està en `development`, `stage` o `production`. En development i stage és un enllaç a `/dev/login` o a la porta principal.
- **Accés Authentik per a professors**: El login artixual de Google i correu+contrasenya ha estat substituït per el xip d'EduTicTac amb Authentik en producció; les identitats docents han de configurar `AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID` i `AUTHENTIK_CLIENT_SECRET`.
- **Contador de reconnexió**: Si un alumne es desconnecta, té 40 segons per reconnectar; el servidor envia el temps de gràcia al seu socket.
- **Wake Lock**: El navegador es pot sollicitar per mantenir la pantalla encesa mentre thereu una pregunta activa (en dispositius que ho suportin).
- **Puntuació basada en el temps**: Cada pregunta val fins a 1000 punts màxim, multiplicats per la fracció de temps que queda quan es respondeix; també s'apliquen multiplicadors de power-up "doble puntuació".
- **Noves opcions de mode**: Multijugador per 2-4 jugadors en una sola pantalla, mode individual (solo) per a practicar fora de classe.
- **Mejora del Socket.IO**: S'han augmentat els intents de reconnexió del client i s'han afegit listeners `online`/`offline`/`visibilitychange` per millorar la gestió de la connexió.

# ¿Qué hay de nuevo? (Spanish)

- **Nuevas pantallas Vue 3**: El lobby del profesor (`/host/`), la pantalla del alumno (`/player/game/`) y la pantalla del profesor (`/host/game/`) son ahora apps Vue 3 sin paso de build: se cargan directamente en el navegador.
- **Cuenta regresiva 3-2-1**: Antes de cada pregunta en el modo "Jugar a la clase" se muestran los números 3, 2, 1.
- **Mod "a ciegas"**: El profesor puede ocultar el enunciado y mostrar solo botones con formas y colores al alumno; el resumen de respuestas siempre se hace en la pantalla compartida.
- **Visualización de logs administrativos**: Desde `/admin/logs` se pueden filtrar por nivel, etiqueta y búsqueda de texto; se pueden descargar en CSV y NDJSON.
- **Informe de partida CSV**: Después de terminar una partida, el profesor puede descargar un informe completo con datos por alumno y por pregunta; el archivo incluye columnas de puntuación, aciertos, fallos y tiempo de respuesta.
- **Distintivo de entorno**: En la pestaña del navegador y con color de fondo se indica si se está en `development`, `stage` o `production`. En development y stage es un enlace a `/dev/login` o a la portada principal.
- **Acceso Authentik para profesores**: El login tradicional de Google y correo+contraseña ha sido sustituido por el chip de EduTicTac con Authentik en producción; las identidades docentes deben configurar `AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID` y `AUTHENTIK_CLIENT_SECRET`.
- **Contador de reconexión**: Si un alumno se desconecta, tiene 40 segundos para reconectar; el servidor envía el tiempo de gracia a su socket.
- **Wake Lock**: El navegador puede solicitar mantener la pantalla encendida mientras hay una pregunta activa (en dispositivos que lo soporten).
- **Puntuación basada en el tiempo**: Cada pregunta vale hasta 1000 puntos máximo, multiplicados por la fracción de tiempo que queda al responder; también se aplican multiplicadores de power-up "doble puntuación".
- **Nuevas opciones de modo**: Multijugador para 2-4 jugadores en una sola pantalla, y modo individual (solo) para practicar fuera de clase.
- **Mejora del Socket.IO**: Se han aumentado los intentos de reconexión del cliente y se han añadido listeners `online`/`offline`/`visibilitychange` para mejorar la gestión de la conexión.

# What's new (English)

- **New Vue 3 screens**: The host lobby (`/host/`), student game screen (`/player/game/`), and host game screen (`/host/game/`) are now Vue 3 apps loading directly in the browser without a build step.
- **3-2-1 countdown**: Before each question in "Play in class" mode, a countdown of 3, 2, 1 is shown.
- **Blind mode**: The host can hide the question text and show only shape/color buttons to students; answer summary always appears on the shared screen.
- **Admin logs viewer**: From `/admin/logs` you can filter by level, tag, and free-text search; download in CSV and NDJSON formats.
- **CSV game report**: After a game ends, the host can download a full report with per-student and per-question data; the file includes score, correct/incorrect counts, and response time columns.
- **Environment badge**: A colored badge and link in the browser tab indicates whether you are in `development`, `stage`, or `production`. In development and stage, it links to `/dev/login` or the homepage.
- **Authentik login for teachers**: Traditional Google and email+password login have been replaced by the EduTicTac chip with Authentik in production; teacher identities must configure `AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID`, and `AUTHENTIK_CLIENT_SECRET`.
- **Reconnection counter**: If a student disconnects, they have 40 seconds to reconnect; the server sends the grace period to their socket.
- **Wake Lock**: The browser can be requested to keep the screen awake while a question is active (on devices that support it).
- **Time-based scoring**: Each question is worth up to 1000 maximum points, multiplied by the remaining time ratio when answered; power-up "double score" multipliers also apply.
- **New game modes**: Multiplayer for 2-4 players on one screen, and individual (solo) mode for practicing outside class.
- **Socket.IO improvements**: Client reconnection attempts have been increased, and `online`/`offline`/`visibilitychange` listeners have been added to improve connection handling.