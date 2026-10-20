# Arquitectura i funcionament d'EduHoot

Document viu que explica, amb referències concretes al codi, com està
construït EduHoot per dins (stack, estructura de directoris, model de
dades, autenticació, temps real) i com funcionen les seues distintes
funcions de cara al professorat i a l'alumnat. A diferència del
`README.md` (orientat a qui vol instal·lar/usar l'app) o el
`CHANGELOG.md` (què va canviar en cada versió), este document explica
**com està fet i com funciona cada cosa hui**, amb el nivell de detall
necessari per a respondre preguntes de suport, redactar documentació de
cara al professorat, o reprendre el desenvolupament d'una funció sense
haver de rellegir tot el codi.

Es completarà progressivament, a mesura que sorgisquen preguntes sobre el
funcionament del projecte.

## Índex

- [Arquitectura tècnica (resum)](#arquitectura-tècnica-resum)
- [Estructura de directoris](#estructura-de-directoris)
- [Model de dades (MongoDB)](#model-de-dades-mongodb)
- [Autenticació i sessions](#autenticació-i-sessions)
- [Comunicació en temps real (Socket.IO)](#comunicació-en-temps-real-socketio)
- [Deute tècnic conegut](#deute-tècnic-conegut)
- [Unió a la partida: nom i icona del jugador](#unió-a-la-partida-nom-i-icona-del-jugador)
- [Informe de partida (descàrrega en CSV)](#informe-de-partida-descàrrega-en-csv)
- [Exportació a Moodle XML](#exportació-a-moodle-xml)
- [Modes de joc](#modes-de-joc)
- [Avanç de pregunta: automàtic o manual?](#avanç-de-pregunta-automàtic-o-manual)
- [Càlcul de la puntuació](#càlcul-de-la-puntuació)

## Arquitectura tècnica (resum)

- **Monòlit Express + Socket.IO** (`src/server/server.js`, 5.123 línies):
  rutes HTTP, esdeveniments de Socket.IO, lògica de partida, càlcul de
  puntuació, generació de CSV/Moodle XML i autenticació conviuen en el
  mateix fitxer. Només una petita part està separada en mòduls propis:
  `importCsv.js`, `questionUtils.js`, `authentikUsers.js` i
  `utils/liveGames.js` / `utils/players.js` (unes 500 línies en total).
- **Sense build step ni framework de frontend**: el client és JS vanilla
  servit directament des de `src/public/`, sense React/Vue ni bundler
  (webpack/vite). Cada pantalla (`create`, `host`, `player`, `solo`,
  `multiplayer`) carrega els seus propis `<script>` solts.
- **Dependències de producció mínimes** (`src/package.json`): `express`,
  `socket.io`, `mongodb` (driver natiu, sense ORM/Mongoose), `helmet`
  (capçaleres de seguretat), `multer` (pujada d'imatges), `moment`.
- **Persistència**: MongoDB és l'únic magatzem persistent. Les partides
  en curs i les sessions HTTP viuen en memòria del procés Node, no en
  Mongo (vore "Model de dades" i "Autenticació i sessions").

## Estructura de directoris

```
src/
├── server/
│   ├── server.js          # monòlit: rutes HTTP, Socket.IO, lògica de joc
│   ├── importCsv.js       # anàlisi de CSV -> preguntes
│   ├── questionUtils.js   # utilitats de tipus de pregunta
│   ├── authentikUsers.js  # vinculació d'identitats Authentik
│   └── utils/
│       ├── liveGames.js   # helpers de partides en memòria
│       └── players.js     # helpers de jugadors
├── public/
│   ├── create/             # creador de qüestionaris (+ quiz-creator/)
│   ├── host/                # vista del professorat (+ game/)
│   ├── player/              # vista de l'alumnat (+ game/)
│   ├── solo/                 # mode individual
│   ├── multiplayer/           # mode pantalla compartida
│   ├── js/                     # tot el JS del frontend
│   └── css/, icons/, fonts/, svg/, effects/, music/
├── test/
│   ├── unit/, integration/, browser/   (vore TESTING.md)
└── scripts/                             # scripts puntuals (vore TESTING.md)
```

Els fitxers més grans, per si cal ubicar alguna cosa ràpid: `server.js`
(5.123 línies) en el backend; en el frontend, `create.js` (~4.184
línies / 174 KB), `solo.js` (~94 KB), `multiplayer.js` (~83 KB),
`quizCreator.js` (~71 KB), `hostGame.js` (~52 KB) i `playerGame.js`
(~35 KB).

## Model de dades (MongoDB)

Sis col·leccions, totes en la base `kahootDB` (nom fixat en el codi —
`server.js:232` — no configurable per `MONGO_URL`):

| Col·lecció | Constant en el codi | Contingut |
|---|---|---|
| `kahootGames` | `GAMES_COLLECTION` | Els qüestionaris guardats: preguntes, respostes, metadades, propietat, visibilitat. |
| `users` | `USERS_COLLECTION` | Comptes de professorat (Google/Authentik/correu+contrasenya), rol, vincles d'identitat. |
| `soloScores` | `SOLO_SCORES_COLLECTION` | Resultats del mode Solo (rànquing visible, estadístiques). |
| `ephemeralQuizzes` | `EPHEMERAL_COLLECTION` | Qüestionaris del mode "Només jo" (efímers, amb caducitat). |
| `quizRatings` | `RATINGS_COLLECTION` | Valoracions agregades de cada qüestionari. |
| `quizRatingVotes` | `RATING_VOTES_COLLECTION` | Vot individual de valoració, per a evitar vots duplicats. |

Les partides en curs ("live games") **no estan en Mongo**: viuen en un
`Map` en memòria del procés Node mentre la partida està activa. Només al
finalitzar es bolquen com a fitxers d'informe en disc
(`src/logs/finished-session-reports/`, vore "Informe de partida" més
avall). Si el servidor es reinicia a mitat d'una partida, esa partida es
perd.

## Autenticació i sessions

Tres vies de login per al professorat conviuen hui (migració en curs,
vore `docs/PLA-MIGRACIO-AUTHENTIK-2026-10.md`):

- **Correu + contrasenya local** (comptes antics).
- **Google OAuth 2.0** directe.
- **Authentik (OIDC)** — substituirà les dos anteriors en tancar la
  migració; només identitats amb rol docent en la claim configurada
  poden entrar.

Les sessions HTTP **no es guarden en Mongo ni en un store extern**: és
un `Map` en memòria (`sessions`, `server.js:1561`) indexat per un
`sessionId` aleatori que s'envia com a cookie. Això significa que
**reiniciar el servidor tanca la sessió de tothom** — no hi ha
persistència de sessió entre reinicis del procés.

L'alumnat mai passa per este sistema: entra amb un nom lliure + una icona
per partida (vore "Unió a la partida" més avall), sense cap compte ni
login.

## Comunicació en temps real (Socket.IO)

Esdeveniments principals que rep el servidor en `server.js`:

| Esdeveniment | Qui l'envia | Per a què |
|---|---|---|
| `host-join` / `host-join-game` | Professorat (amfitrió) | Entrar a la sala de la partida com a amfitrió. |
| `player-join` / `player-join-game` | Alumne | Unir-se a la partida amb el seu nom/icona. |
| `startGame` | Amfitrió | Arrancar la partida (primera pregunta). |
| `nextQuestion` | Amfitrió | Avançar a la pregunta següent (vore "Avanç de pregunta"). |
| `skipQuestion` | Amfitrió | Saltar la pregunta actual sense esperar respostes. |
| `playerAnswer` | Alumne | Enviar una resposta. |
| `timeUp` | Client de l'amfitrió | Avisa al servidor que s'ha acabat el temps de la pregunta. |
| `getScore` | Client | Demanar la puntuació/rànquing actual. |
| `newQuiz` | Amfitrió | Carregar un qüestionari nou en una sala ja oberta. |
| `requestDbNames` | Client | Demanar llistat de noms/qüestionaris (ús administratiu). |
| `disconnect` | Socket.IO (automàtic) | Neteja quan cau la connexió d'un jugador/amfitrió. |

## Deute tècnic conegut

- `server.js` ha crescut de 3.588 a 5.123 línies des de l'auditoria
  d'abril (`REVISION_MEJORAS.md`) sense dividir-se en mòduls — concentra
  rutes HTTP, lògica de Socket.IO, càlcul de puntuació, generació de
  CSV/Moodle XML i autenticació. `src/public/js/create.js` (4.184
  línies) té un problema equivalent en el frontend.
- Les partides en curs i les sessions HTTP viuen només en memòria: no
  sobreviuen a un reinici del procés (vore seccions anteriors).
- `POPULAR_FEATURES.md` (secció "Fase 0") marca separar
  responsabilitats de `server.js` com a **requisit**, no com a millora
  opcional, abans de seguir afegint mecàniques de joc de dificultat
  alta.

## Unió a la partida: nom i icona del jugador

Quan un alumne s'uneix a una partida (pantalla de `join`, codi en
`src/public/js/join.js`):

- **El nom l'escriu el propi alumne**, en un camp de text lliure. No
  existix cap generador de sobrenoms aleatoris (és una millora proposada
  en `POPULAR_FEATURES.md`, pendent d'implementar).
- El nom es normalitza abans d'enviar-se: es retallen espais al
  principi/final, es col·lapsen espais múltiples, i es limita a un
  màxim de caràcters (`normalizeGuestName` / `normalizeGuestNameLive`,
  `join.js:122-131`). Segons el `README.md`, el límit en multijugador és
  de 40 caràcters.
- A més del nom, l'alumne tria una **icona/emoji** d'un selector visual
  (`icon-picker`) que l'identifica en la partida.
- En la vista de l'amfitrió (`src/public/js/host.js:349-369`), cada
  jugador que s'uneix apareix com una targeta (no una llista de text
  pla), amb la seua icona i el seu nom, mitjançant l'esdeveniment de
  Socket.IO `updatePlayerLobby`.

No hi ha, per tant, cap sistema de comptes d'alumne ni login previ per a
jugar: el nom que escriu cada alumne és l'únic identificador dins d'esa
partida concreta.

## Informe de partida (descàrrega en CSV)

En acabar una partida, el professorat/amfitrió pot descarregar un
informe complet dels resultats:

- **Botó**: "Descargar informe (CSV)" en la vista de l'amfitrió
  (`src/public/js/hostGame.js:130`, funció `downloadSessionReportCsv()`
  en la línia 382).
- **Endpoint**: `GET /api/live-games/:pin/report.csv?hostId=...`
  (`src/server/server.js:2943`). El servidor comprova que el `hostId`
  que arriba en la petició coincidix amb l'amfitrió real d'esa partida;
  si no, respon `403 No autorizado para descargar este informe`. Això
  evita que qualsevol amb el PIN de la partida puga descarregar els
  resultats.
- **Disponibilitat després de la partida**: l'informe es servix primer
  des de la partida en memòria si el servidor continua alçat; si no, es
  busca en disc (els fitxers d'informe es guarden i es netegen de forma
  programada, `src/server/server.js`, vore també `CHANGELOG.md` 1.0.5).
  Això permet descarregar l'informe encara que el servidor s'haja
  reiniciat després que acabara la partida (abans de la versió 1.0.5
  això retornava un 404).

### Columnes del CSV

Capçalera definida en `src/server/server.js:832`:

```
pin;quizId;quizNombre;preguntasTotales;posicion;alumno;puntuacionFinal;
aciertos;fallos;sinResponder;preguntaNumero;tipo;enunciado;
tiempoLimiteSegundos;respuestaJugador;respuestaCorrecta;resultado;
tiempoRespuestaMs
```

El CSV mescla dos nivells d'informació en el mateix fitxer:

- **Resum per alumne** (columnes `pin`, `quizId`, `quizNombre`,
  `preguntasTotales`, `posicion`, `alumno`, `puntuacionFinal`,
  `aciertos`, `fallos`, `sinResponder`): una fila-resum per jugador amb
  la seua posició final, puntuació total, i recompte d'encerts/fallades/
  preguntes sense respondre.
- **Detall per pregunta** (columnes `preguntaNumero`, `tipo`,
  `enunciado`, `tiempoLimiteSegundos`, `respuestaJugador`,
  `respuestaCorrecta`, `resultado`, `tiempoRespuestaMs`): una fila per
  cada pregunta responguda per cada alumne, amb el que va respondre, si
  va ser correcte, i quant va tardar.

**No hi ha una columna de "% d'encerts" ja calculada.** Per a obtindre'l
cal calcular-lo a partir d'`aciertos` / `preguntasTotales` en un full de
càlcul (per exemple, amb una fórmula `=aciertos/preguntasTotales` per
fila d'alumne).

## Exportació a Moodle XML

Cada qüestionari de la biblioteca (`/create/`) té, junt al botó de
descàrrega en CSV, un botó amb la icona de Moodle
(`src/public/js/create.js:2046`, funció `downloadMoodleXml()` en la
línia 2396) que descarrega eixe mateix qüestionari convertit al format
Moodle XML, llest per a importar-lo al banc de preguntes de Moodle/AULES
i muntar ahí un "Qüestionari" natiu.

- **Endpoint**: `GET /api/quizzes/:id/moodle-xml`
  (`src/server/server.js:2901`), que crida la funció `quizToMoodleXml()`
  (línia 1095).
- **Tipus de pregunta que convertix**: opció múltiple d'una o diverses
  respostes correctes (`multichoice`), verdader/fals (`truefalse`),
  resposta curta (`shortanswer`) i numèrica amb tolerància
  (`numerical`). L'enunciat i les respostes s'exporten en HTML.
- **Què no inclou**: això exporta només el banc de preguntes, no la
  partida en si. En Moodle/AULES l'alumne resoldria el qüestionari de
  forma independent, sense la mecànica de joc d'EduHoot (marcador, ritme
  marcat pel professorat, PIN, etc.) ni pas automàtic de la nota a
  EduHoot.

Esta funció no requerix que el centre habilite res a nivell de servidor
(a diferència d'una integració LTI): el professorat només necessita
poder importar un fitxer XML al banc de preguntes del seu propi curs.

## Modes de joc

Al crear o llançar un qüestionari des de la biblioteca
(`src/public/js/create.js`), hi ha tres botons/modes distints. Només un
d'ells està pensat per a una classe amb un dispositiu per alumne:

| Mode (botó) | Funció / destí | Per a què servix |
|---|---|---|
| **"Jugar a l'aula"** | `startGame(quiz.id)` → `/host/` (`create.js:2249-2251`) | El mode clàssic tipus Kahoot: es genera un PIN/QR, cada alumne s'uneix des del seu propi mòbil/tablet via `/join`, i el professorat projecta les preguntes des de `/host/`. **És el mode a usar amb un grup d'alumnes, cada un amb el seu dispositiu.** És *host-paced*: el professorat controla el ritme (vore secció següent). |
| **"Multijugador"** | `startMultiplayer(quiz.id)` → `/multiplayer/` | Pensat per a 2-4 jugadors compartint **una sola pantalla/dispositiu** ("Juega en la misma pantalla", `src/public/multiplayer/index.html:18-19`). No servix per a una classe amb un dispositiu per alumne. |
| **"Solo"** | `startSolo(quiz.id)` → `/solo/` | Mode individual, per a practicar fora de classe (vore també els [enllaços directes al mode Solo](README.md) del README). No és un mode de grup. |

Per a una classe amb molts alumnes, cada un amb el seu propi dispositiu,
l'única opció correcta hui és **"Jugar a l'aula"**.

## Avanç de pregunta: automàtic o manual?

**Hui no existix cap opció perquè les preguntes avancen soles.** No hi
ha cap interruptor ni en el creador del qüestionari
(`src/public/create/index.html`, `src/public/js/quizCreator.js`) ni en
la pantalla d'amfitrió (`src/public/host/index.html`,
`src/public/js/host.js`) per a activar un avanç automàtic.

El que sí és automàtic és el **tancament d'una pregunta**:
- Si tots els jugadors responen abans de temps, el servidor ho detecta
  (`playersAnswered === playerNum.length`, `src/server/server.js:3692-3697`)
  i mostra resultats.
- Si s'acaba el temps, l'amfitrió emet `timeUp` i el servidor fa el
  mateix (`src/server/server.js:3725-3747`).

Però això només obri la pantalla de resultats/rànquing. **Passar a la
pregunta següent requerix sempre una acció explícita del professorat**:
prémer el botó "Siguiente pregunta" (o la tecla Enter) en eixe modal
(`handleResultsModalNext()` → `nextQuestion()`,
`src/public/js/hostGame.js:983-1007,1263`), el que emet l'esdeveniment
de Socket.IO `nextQuestion`. El servidor només avança la pregunta dins
d'eixe handler (`socket.on('nextQuestion', ...)`,
`src/server/server.js:3773-3882`) — no existix cap temporitzador en el
servidor que dispare eixe avanç per si sol.

En resum: en el mode "Jugar a l'aula", el professorat ha d'estar
pendent de prémer "Siguiente pregunta" després de cada pregunta. Un mode
"autoritme" (cada alumne avança sol) o un mode de presentació que avance
sense intervenció del professorat són millores pendents, encara no
implementades — estan recollides en `POPULAR_FEATURES.md` ("Mode
autoritme (self-paced)" i "Mode 'presentació' híbrid").

## Càlcul de la puntuació

**EduHoot puntua a l'estil Kahoot/Wayground, no per simple % d'encerts**
(`calculateQuestionScore`, `src/server/server.js:133`):

- Cada pregunta val fins a **1000 punts base**
  (`MAX_POINTS_PER_QUESTION`), multiplicats per la fracció de temps que
  queda quan es respon (`remainingRatio`): quant més ràpid s'encerta,
  més punts.
- S'aplica el multiplicador del power-up de doble puntuació
  (`pointsMultiplier`) si està actiu en eixa pregunta.
- En preguntes de resposta múltiple hi ha **crèdit parcial amb
  penalització** (`getSubmissionScoreRatio`, línia 2183): cada opció
  correcta marcada suma, cada opció incorrecta marcada resta el mateix,
  amb un mínim de 0 — no és tot o res.
- La puntuació final (`puntuacionFinal` en el CSV) és la **suma
  acumulada d'estos punts per pregunta**. El rànquing i el podi es
  basen en els punts, no en el % d'encerts; el CSV guarda eixe recompte
  (`aciertos`/`fallos`/`sinResponder`) només com a dada informativa a
  banda.

### Preguntes d'enquesta («opinió») en mode Solo

Les preguntes de tipus `poll` (sense resposta correcta) queden **fora
del càlcul de puntuació** en el mode Solo
(`src/public/js/solo.js:1932-1936`, `getScoredQuestionCount()` les
filtra). En concret:

- Cap opció marcada apareix com a «incorrecta» (`solo.js:1831`): es
  passa a la pregunta següent igual que si fora un encert
  (`solo.js:1888`), sense obrir el diàleg d'error.
- El resum final separa els encerts puntuats de les enquestes
  respostes (p. ex. «Encerts 1/1 · Enquestes: 1 · sense puntuació»,
  `solo.js:1915-1923`).
- Si **tot** el qüestionari és d'enquestes, no s'envia cap puntuació al
  rànquing global (`solo.js:1929`, `prepareScoreSubmission()` només es
  crida si `getScoredQuestionCount() > 0`).

Cobert per `src/test/browser/solo-poll.spec.js` (vore `TESTING.md`).
