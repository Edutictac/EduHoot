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
- [Cicle de vida d'una partida: PIN, lobby i temps d'espera](#cicle-de-vida-duna-partida-pin-lobby-i-temps-despera)
- [Distintiu visual d'entorn (dev/stage)](#distintiu-visual-dentorn-devstage)
- [Deute tècnic conegut](#deute-tècnic-conegut)
- [Unió a la partida: nom i icona del jugador](#unió-a-la-partida-nom-i-icona-del-jugador)
- [Informe de partida (descàrrega en CSV)](#informe-de-partida-descàrrega-en-csv)
- [Exportació a Moodle XML](#exportació-a-moodle-xml)
- [Panell d'administració (estadístiques)](#panell-dadministració-estadístiques)
- [Logs del servidor (/admin/logs)](#logs-del-servidor-adminlogs)
- [Modes de joc](#modes-de-joc)
- [Avanç de pregunta: automàtic o manual?](#avanç-de-pregunta-automàtic-o-manual)
- [Comparativa de tipus amb Kahoot, Wayground i AULES](#comparativa-de-tipus-amb-kahoot-wayground-i-aules)
- [Càlcul de la puntuació](#càlcul-de-la-puntuació)

## Arquitectura tècnica (resum)

- **Express + Socket.IO en un sol procés Node**, organitzat en capes
  (`src/server/`): `data/` (accés a MongoDB), `services/` (lògica de
  negoci), `routes/` (rutes HTTP, una per recurs) i `sockets/`
  (esdeveniments de Socket.IO). `server.js` és només el punt d'entrada:
  configura Express, instancia els serveis, munta els
  routers i registra els handlers de Socket.IO. Els mòduls amb estat o
  que depenen d'altres instàncies s'exporten com a factories
  (`createXxx({ dependències })`); la resta són mòduls plans que es
  requereixen directament. Vore `docs/MIGRATING.md` (Subfase A) per al
  perquè d'esta divisió.
- **Sense build step**: el client és JS vanilla servit directament des de
  `src/public/`, sense bundler (webpack/vite). Cada pantalla (`create`,
  `host`, `player`, `solo`, `multiplayer`) carrega els seus propis
  `<script>` solts. Excepcions de framework, totes amb Vue 3 i sense build
  step: el lobby de `/host/` i les pantalles de joc `/player/game/` i
  `/host/game/` (vore "Lobby de l'amfitrió amb Vue" i les seccions de
  Subfase B).
- **Dependències de producció mínimes** (`src/package.json`): `express`,
  `socket.io`, `mongodb` (driver natiu, sense ORM/Mongoose), `helmet`
  (capçaleres de seguretat), `multer` (pujada d'imatges), `moment`,
  `winston` i `winston-transport` (logging persistent).
- **Persistència**: MongoDB és l'únic magatzem persistent. Les partides
  en curs i les sessions HTTP viuen en memòria del procés Node, no en
  Mongo (vore "Model de dades" i "Autenticació i sessions").

## Estructura de directoris

```
src/
├── server/
│   ├── server.js          # punt d'entrada: Express + Socket.IO, munta tot
│   ├── data/
│   │   ├── db.js              # connexió a MongoDB (MONGO_URL, MONGO_DB) i índexs
│   │   └── repositories.js    # una funció per col·lecció (getGamesCollection...)
│   ├── services/
│   │   ├── scoring.js         # càlcul de puntuació
│   │   ├── moodleExport.js    # quiz -> Moodle XML
│   │   ├── sessionReport.js   # informe CSV de partida (memòria + disc)
│   │   ├── sessions.js        # sessions HTTP en memòria i cookies
│   │   ├── passwords.js       # hash/verificació de contrasenyes
│   │   ├── oauth.js           # login Google i Authentik (OIDC)
│   │   ├── authMiddleware.js  # límit d'intents, req.user, requireRole
│   │   ├── commons.js         # Edutictac ID / Commons (identitat alumnat)
│   │   ├── quizNormalize.js   # neteja/normalització pura (text, preguntes, tags)
│   │   ├── quizzes.js         # accés, permisos i creació de quizzes
│   │   ├── ephemeralQuizzes.js # quizzes "local-*" sense compte (caduquen)
│   │   ├── soloScores.js      # rànquing Solo amb escriptura en lots
│   │   └── kahootImport.js    # importació de Kahoot i rèplica d'imatges
│   ├── routes/
│   │   ├── quizzes.js         # /api/quizzes..., /api/public-quizzes, /api/tags
│   │   ├── games.js           # validate-pin, report.csv
│   │   ├── auth.js            # /api/auth/... (login, Google, Authentik, usuaris)
│   │   ├── playerAuth.js      # /api/player-auth/... (Edutictac ID)
│   │   ├── admin.js           # /api/admin/..., /admin
│   │   └── devLogin.js        # /dev/login (només amb NODE_ENV=development)
│   ├── sockets/
│   │   ├── index.js           # io.on('connection') i sessió del socket
│   │   ├── hostEvents.js      # host-join, startGame, nextQuestion...
│   │   ├── playerEvents.js    # player-join, playerAnswer...
│   │   ├── common.js          # disconnect, timeUp, getScore...
│   │   └── gameHelpers.js     # temporitzadors, preguntes, neteja de partides
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
│   ├── js/                     # tot el JS del frontend; create.js i solo.js
│   │                           # repartits en create-*.js / solo-*.js i
│   │                           # i18n-create.js / i18n-solo.js
│   └── css/, icons/, fonts/, svg/, effects/, music/
├── test/
│   ├── unit/, integration/, browser/   (vore TESTING.md)
└── scripts/                             # scripts puntuals (vore TESTING.md)
```

Els fitxers més grans, per si cal ubicar alguna cosa ràpid: en el
backend, `routes/quizzes.js` (~1.100 línies), `sockets/hostEvents.js`
(~440) i `sockets/gameHelpers.js` (~370); en el frontend, `multiplayer.js` (~82 KB),
`hostGame.js` (~51 KB), `i18n-create.js`
(~41 KB, només traduccions) i `playerGame.js` (~35 KB). `create.js` i
`solo.js` ja estan repartits en fitxers més menuts (cap passa de ~35 KB).

## Pantalles del frontend

Cada pàgina és un HTML dins de `src/public/` que carrega el seu propi
JS d'orquestració amb `<script>` clàssics (sense build step):

| Pantalla | JS principal | Per a què servix |
|---|---|---|
| `/` (`index.html`) | *(sense JS propi; usa `i18n-player.js`, `pwa-install.js`)* | Portada: triar mode (aula / multijugador / solo), accés professorat, instal·lar com a PWA |
| `/join.html` | `join.js` | Alumnat: PIN + nom (o login EduTicTac) per a unir-se a una partida del mode "Jugar a l'aula" |
| `/player/` | `lobby.js` | Alumnat: sala d'espera des que s'uneix fins que el professorat inicia la partida |
| `/player/game/` | `playerGame.js` | Alumnat: pantalla de joc — pregunta, respostes, resultat, rànquing, reconnexió |
| `/host/` | `host.js` (ja amb Vue, pilot fet) | Professorat: lobby amb PIN/QR, opcions de partida, llista de jugadors, botó d'inici |
| `/host/game/` | `hostGame.js` | Professorat: pantalla de joc en directe — pregunta, temporitzador, rànquing, música/gong |
| `/create/` | `create.js` + mòduls `create-*.js` + `i18n-create.js` (ja repartits, Subfase A) | Professorat: biblioteca de qüestionaris — llistat, filtres, exportació, importació, panell d'admin |
| `/create/quiz-creator/` | `quizCreator.js` (ja amb Vue) | Professorat: editor d'un qüestionari (preguntes, respostes, tipus) |
| `/solo/` | `solo.js` + mòduls `solo-*.js` + `i18n-solo.js` (ja repartits, Subfase A) | Mode individual, a ritme propi, fora de classe |
| `/multiplayer/` | `multiplayer.js` (ja amb Vue) | Mode 2-4 jugadors compartint una sola pantalla |
| `/admin-stats.html` | `admin-stats.js` | Estadístiques del panell d'administració |

A banda, fitxers transversals que no pertanyen a una sola pantalla:
`languages.js`, `i18n-host.js`/`i18n-player.js`/`i18n-solo.js`/
`i18n-create.js`, `env-badge.js`, `edutictac-chip.js`,
`music-player.js`, `app-version.js`, `pwa-install.js`, i `js/libs/`
(jQuery, deparam, Vue).

## Model de dades (MongoDB)

Huit col·leccions, totes en la mateixa base de dades: `kahootDB` per
defecte, configurable amb `MONGO_DB` (`DB_NAME` en `data/db.js`). Els noms
de col·lecció es definixen en `data/db.js` i s'hi accedix sempre a través
de `data/repositories.js`:

| Col·lecció | Constant en el codi | Contingut |
|---|---|---|
| `kahootGames` | `GAMES_COLLECTION` | Els qüestionaris guardats: preguntes, respostes, metadades, propietat, visibilitat. |
| `users` | `USERS_COLLECTION` | Comptes de professorat (Google/Authentik/correu+contrasenya), rol, vincles d'identitat. |
| `soloScores` | `SOLO_SCORES_COLLECTION` | Resultats del mode Solo (rànquing visible, estadístiques). |
| `ephemeralQuizzes` | `EPHEMERAL_COLLECTION` | Qüestionaris del mode "Només jo" (efímers, amb caducitat). |
| `quizRatings` | `RATINGS_COLLECTION` | Valoracions agregades de cada qüestionari. |
| `quizRatingVotes` | `RATING_VOTES_COLLECTION` | Vot individual de valoració, per a evitar vots duplicats. |
| `appLogs` | `LOGS_COLLECTION` | Logs del servidor, en una col·lecció capped (circular) redimensionable. |
| `appSettings` | `SETTINGS_COLLECTION` | Configuració editable en calent, com el nivell i la mida del logging. |

Les partides en curs ("live games") **no estan en Mongo**: viuen en un
`Map` en memòria del procés Node mentre la partida està activa. Només al
finalitzar es bolquen com a fitxers d'informe en disc
(`src/logs/finished-session-reports/`, vore "Informe de partida" més
avall). Si el servidor es reinicia a mitat d'una partida, esa partida es
perd.

## Autenticació i sessions

Des de la versió 1.0.10, l'**únic accés del professorat en la interfície**
és el xip de compte d'EduTicTac (`account-widget.js`, servit per Commons;
la integració local està en `src/public/js/edutictac-chip.js`). Des de
`/create/`, el xip fa de pont cap a la sessió **Authentik (OIDC)** d'EduHoot
quan EduHoot i Commons són del mateix lloc. Només identitats amb rol docent
en la claim configurada poden entrar. Vore
`docs/PLA-MIGRACIO-AUTHENTIK-2026-10.md`.

- L'adreça de Commons es pot canviar amb `EDUTICTAC_COMMONS_URL` (per a un
  Commons local); el servidor la reescriu a les pàgines amb xip
  (constant `CHIP_PAGES` en `server.js`).
- El backend encara accepta **correu + contrasenya** (`POST /api/auth/login`)
  i **Google** mentre no s'active el mode només Authentik
  (`AUTHENTIK_ONLY`), però la interfície ja no té cap formulari per a fer-ho.
- En desenvolupament, `/dev/login` (`src/server/routes/devLogin.js`, només
  amb `NODE_ENV=development`) permet entrar amb els usuaris de prova del
  seed, i `docker compose` porta un OIDC simulat (`src/scripts/dev-oidc.js`)
  que fa d'Authentik per a provar el flux OIDC real; vore
  `docs/DEV_DOCKER_SETUP.md`.

Les sessions HTTP **no es guarden en Mongo ni en un store extern**: és
un `Map` en memòria (`sessions` en `services/sessions.js`) indexat per un
`sessionId` aleatori que s'envia com a cookie. Això significa que
**reiniciar el servidor tanca la sessió de tothom** — no hi ha
persistència de sessió entre reinicis del procés.

L'alumnat mai passa per este sistema: entra amb un nom lliure + una icona
per partida (vore "Unió a la partida" més avall), sense cap compte ni
login.

## Comunicació en temps real (Socket.IO)

Esdeveniments principals que rep el servidor (registrats en
`src/server/sockets/`: `hostEvents.js`, `playerEvents.js` i `common.js`):

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

## Cicle de vida d'una partida: PIN, lobby i temps d'espera

El handler `host-join` de `sockets/hostEvents.js` crea la partida en
memòria amb un PIN nou i `gameLive: false` (sala d'espera). Eixe PIN ja és
vàlid: l'alumnat pot entrar-hi (`/join.html?pin=...`) i quedar-se esperant
abans que el professorat pulse "Començar". El handler `startGame` posa
`gameLive: true` i arranca la primera pregunta.

No hi ha cap col·lecció de base de dades per a "partides" — tot açò viu
només en l'array en memòria de `src/server/utils/liveGames.js`, i es
borra sol segons les constants de temps de `sockets/gameHelpers.js`:

- **100 s** després d'acabar la partida (`GameOver`), abans d'esborrar-la.
- **30 min** sense cap activitat.
- **30 s** de marge per a que el professorat reconnecte si es desconnecta
  (p. ex. si tanca el navegador per error).
- **40 s** de marge per a que un alumne reconnecte.

Hui en dia estos quatre temps estan fixats al codi: no es poden ajustar
ni per variable d'entorn ni des d'un panell, i tampoc hi ha manera de
crear o programar una partida amb antelació — naix quan el professorat
obri el host i mor quan es neteja per algun dels motius de dalt. Millora
de fer-los configurables (global + per partida) plantejada per al futur.

### Lobby de l'amfitrió amb Vue

El lobby de `/host/` és el pilot de la Subfase B de `docs/MIGRATING.md`:
una app de Vue 3 (Options API) sense build step.

- **Vue**: còpia local en `src/public/js/libs/vue.global.prod.js` (versió
  amb compilador de plantilles), precachejada en `sw.js`.
- **Plantilla**: `<template id="host-lobby-tpl">` en
  `src/public/host/index.html`, muntada en `<div id="host-lobby">`. Només
  cobrix el bloc central (PIN i QR, opcions, jugadors, botó d'inici); la
  barra de dalt, la música i el peu queden fora.
- **Estat** (`src/public/js/host.js`, variable global `lobby`): `pin`,
  `players`, `options`, l'error i l'idioma. Els handlers de Socket.IO
  només canvien estes dades i Vue repinta; l'enllaç d'unió i el QR es
  calculen a partir del PIN i l'idioma.
- **Textos**: dins de la plantilla, `{{ t('clau') }}` (no
  `data-i18n-host`); `t()` usa `getHostTranslation` d'`i18n-host.js`. Els
  errors es guarden per clau perquè canvien d'idioma amb la resta.
- **Proves**: `src/test/browser/host-lobby.spec.js`, amb un Socket.IO fals.

### Pantalla de joc de l'alumnat amb Vue

Segona pantalla de la Subfase B: `/player/game/`
(`src/public/js/playerGame.js`), feta en dos blocs (un commit cada un).
A diferència del lobby de l'amfitrió, ací **tota la pàgina** és l'arrel
de Vue (`<div id="player-game">` + `<template id="player-game-tpl">`
en `src/public/player/game/index.html`); només `#lang-switcher` queda
fora (es oculta just en connectar).

- **Bloc 1**: pregunta, respostes (normal/múltiple/a cegues), resposta
  lliure, temporitzador i compte arrere.
- **Bloc 2**: nom/icona/puntuació/rànquing (`#stats`), el missatge gran
  de resultat (`#message`, amb el detall de la resposta correcta via
  `v-html`) i el modal de rànquing.
- **`#stats`, `#message` i `#playerRankingModal` van dins de la mateixa
  arrel des del bloc 1**, com a HTML estàtic sense directives de Vue:
  Vue mai torna a tocar un node sense bindings encara que la resta del
  component es repinte, així que el codi (encara imperatiu, fins al
  bloc 2) que els pintava a mà seguia funcionant igual mentre no
  s'afegien els bindings. Açò va permetre fer els dos blocs sense
  moure ni duplicar l'arrel.
- **`document.body.style.backgroundColor` (el flaix de color en
  encertar/fallar) i el `wakeLock`/temporitzadors d'interval queden
  fora de Vue**, com a crides directes dins dels mètodes/handlers de
  Socket.IO — mateix patró que `host.js` amb l'àudio del gong.
- **Visibilitat dels botons de resposta**: un únic booleà
  (`answersVisible`) substituïx les dos propietats CSS que tocava el
  codi antic (`style.visibility` i `style.display`) als mateixos punts
  (connectar, pregunta nova, enviar resposta, resultat, `GameOver`,
  compte arrere). **Important**: `playerQuestion` l'ha de tornar a
  `true` sempre (a cegues o no) — és l'únic cas (la primera pregunta de
  cada partida) on no hi ha un `connect`/`nextQuestionPlayer` previ que
  ja ho faça; oblidar-ho va deixar la primera pregunta de cada partida
  sense botons visibles, trobat jugant una partida real contra el
  contenidor de dev (vore `test/browser/player-game.spec.js`, cas
  "primera pregunta de la partida").
- **`showMessage()`/`hideMessage()`**: el codi antic feia
  `messageEl.textContent = X`, que esborra qualsevol `<span>` afegit
  abans amb `appendChild` (el detall de "Resposta correcta: ..."). Els
  dos helpers repliquen eixe mateix esborrat (`messageDetailHtml = ''`)
  cada vegada que canvia el text, per no deixar un detall ranci visible.
- **Compte arrere i insígnia de punts dobles**: en lloc del truc manual
  de `classList.remove/add` + reflow per a repetir l'animació CSS cada
  segon, es fa amb `:key` sobre el node que porta l'animació (Vue el
  recrea i el navegador la reprodueix en inserir-se). Només la part
  interna que fa l'efecte de "tic" (el rellotge) es recrea; el
  contenidor exterior (la lluentor contínua de fons) no, perquè no es
  talle.
- **Tipus de pregunta provats en una partida real**: `quiz`, `multiple`,
  `short-answer` i `numeric`, en mode normal i a cegues ([issue #24](https://github.com/Edutictac/EduHoot/issues/24),
  resolta: el filtre que les excloïa de "Jugar a l'aula" era el del
  mode Multijugador, aplicat per error també ací).
- **Proves**: `src/test/browser/player-game.spec.js`, amb un Socket.IO
  fals que admet diversos arguments per esdeveniment (p. ex.
  `questionOver(playerData, payload)`).

### Pantalla de joc de l'amfitrió amb Vue

Tercera pantalla de la Subfase B: `/host/game/`
(`src/public/js/hostGame.js`), mateix patró que `/player/game/` (tota
la pàgina és l'arrel de Vue, dos blocs, un commit cada un).

- **Bloc 1**: pregunta, respostes (amb el ressaltat de correcta/
  incorrecta), temporitzador, comptador "Han respost X/Y", insígnia de
  punts dobles i compte arrere. A diferència de `/player/game/`,
  canviar d'idioma ací **no recarrega la pàgina** (`setLang()` només
  repinta), així que cal un camp `lang` reactiu i un mètode `t()` que
  en depenga — mateix patró que `lobby` a `host.js`. Només els textos
  que ja canviaven en calent abans de Vue (botons saltar/següent/
  mostra-rànquing, l'etiqueta "Temps restant:", el compte arrere) s'han
  fet reactius a `lang`; la resta (número de pregunta, comptador de
  jugadors, insígnia) seguixen "congelats" en el text que tenien quan
  es van pintar per última vegada — és el comportament real d'abans de
  Vue (`applyStaticText()` no els tocava), no una millora.
- **Bloc 2**: el modal de resultats (gràfica de barres o resum per a
  tipus lliures, rànquing en dos passos amb fletxes), la celebració de
  grup i `GameOver` (top 5, botó de descarregar informe, enllaç
  «Tornar»). `#downloadReportBtn`/`#backToLibraryBtn` eren botons
  creats per JS en temps d'execució (`ensureDownloadReportButton()`/
  `ensureBackToLibraryLink()`); ara són marcatge estàtic de la
  plantilla i les dos funcions s'han eliminat.
- **Trobada real durant la conversió** (abans de la prova real, el
  spec ja ho va detectar): `v-show` només alterna cap al valor
  *original* de l'estil en línia de l'element (buit si no en tenia cap
  al muntar), no cap a un valor concret. Per a elements amagats per
  defecte per CSS compartida amb elements encara no convertits
  (`#skipQButton`, que compartix regla amb `#nextQButton`), cal
  `:style="{ display: ... }"` amb el valor exacte ('inline-block'),
  no `v-show`.
- **Regressió real trobada per `language.spec.js`** (no pel spec nou
  d'esta pantalla): en moure `#lang-select` dins de l'arrel de Vue,
  `languages.js` ja no podia omplir-ne les opcions en la seua primera
  passada (l'element encara no existia, atrapat dins del `<template>`
  inert): es perdia l'idioma inicial de la URL. Corregit cridant
  `EduhootLang.render()` just després de muntar Vue.
- **Troballes d'un comportament real pre-existent, corregides**
  (`#playersAnswered` es quedava ocult per sempre després de la
  primera pregunta; no es podia saltar la primera pregunta de cada
  partida) **i de codi mort, sense tocar** (`#nextQButton`/
  `.square1-4`): vore "Deute tècnic conegut" més avall.
- **Proves**: `src/test/browser/host-game.spec.js`, amb el mateix
  Socket.IO fals (diversos arguments per esdeveniment) que
  `player-game.spec.js`. Complementa `host-game-timer.spec.js`
  (issue #21) i `host-game-end.spec.js` (issue #17), ja existents.

### Pantalla multijugador amb Vue

Quarta pantalla de la Subfase B: `/multiplayer/`
(`src/public/js/multiplayer.js`). A diferència de les anteriors, no
usa Socket.IO: tot passa en el navegador (2-4 jugadors a la mateixa
pantalla) i només parla amb el servidor per REST (catàleg, preferits,
valoracions). L'arrel de Vue és `#multiplayer-app`, amb
`display: contents` perquè no altere el maquetat. Dos blocs, un commit
cada un.

- **Bloc 1**: el catàleg (cerca, filtres, etiquetes, ordre, paginació,
  preferits i valoracions). Marcar un preferit o valorar no reordena
  la llista a l'instant (l'ordre es calcula sobre les dades sense
  reactivitat, `Vue.toRaw`), igual que abans.
- **Bloc 2**: configuració (jugadors, noms, icones, nombre de preguntes
  i temps), partida (un panell per jugador, resposta única i múltiple,
  temporitzador, rànquing de ronda en modal) i resultats. L'estat de la
  partida és un objecte reactiu (`state`) amb un camp `view` que diu
  quina part es mostra. Les funcions de lògica (puntuació, rondes,
  temps esgotat) quasi no canvien; s'han eliminat les que construïen
  l'HTML a mà.
- **Puntuació visible**: cada jugador té `shownScore` a banda de
  `score`, i només s'actualitza en començar la pregunta i en revelar la
  ronda. Així ningú veu qui ha encertat abans que responguen tots.
- **Diferència mínima**: si s'acaba el temps en una pregunta de resposta
  múltiple, el botó «Enviar respostes» queda desactivat (abans quedava
  actiu, però no feia res).
- **Proves**: `src/test/browser/multiplayer.spec.js`, amb la REST
  simulada i `Math.random` fixat perquè l'ordre de preguntes i
  respostes siga previsible.

### Editor de qüestionaris amb Vue

Última pantalla de la Subfase B: `/create/quiz-creator/`
(`src/public/js/quizCreator.js`). L'arrel de Vue és `#creator-app` i
inclou els tres panells (dades del quiz, preguntes i botons); la
capçalera (títol, idioma, subtítol) queda fora i la tradueix
`applyI18n()`. Dos blocs, un commit cada un.

- **Abans de migrar**: s'ha eliminat l'exportació a CSV, Moodle XML i
  PDF que hi havia en `quizCreator.js` (~770 línies). La pàgina no tenia
  botons per a usar-la; la de la biblioteca és `create-export.js`.
- **Bloc 1**: les targetes de preguntes. Cada una és un objecte de
  `questionCards` (reactiu) i «Guardar»/«Jugar» llegixen d'ací, no dels
  camps. Els `id` (`q1`, `1a1`, `type1`…) es mantenen.
- **Bloc 2**: dades del quiz (`form`), etiquetes suggerides, avís de
  visibilitat i botons. Ja no queden `onclick` en l'HTML.
- **Diferència mínima**: en canviar d'idioma també es tradueixen les
  targetes i el text «Permetre còpia» (abans quedaven en l'idioma
  anterior).
- **Proves**: `src/test/browser/quiz-creator.spec.js`, amb la REST i
  Socket.IO simulats.

## Distintiu visual d'entorn (dev/stage)

Per a no confondre un entorn de desenvolupament o stage amb producció,
`src/public/js/env-badge.js` es carrega en totes les pantalles públiques
principals (`index`, `join`, `create`, `create/quiz-creator`, `host`,
`host/game`, `player`, `player/game`, `solo`, `multiplayer`,
`admin-stats`) i consulta l'endpoint `GET /api/env` de `server.js`
(retorna `{ env: process.env.NODE_ENV || '' }`).

- Si `NODE_ENV` és `development` o `staging`, afig un distintiu fix a
  dalt de la pàgina ("🛠️ Entorn: desenvolupament" / "🧪 Entorn: stage"),
  un tint de fons (taronja/verd) i un prefix al títol de la pestanya
  (`🛠️ DEV — ` / `🧪 STAGE — `). En desenvolupament, el distintiu és un
  enllaç a `/dev/login`; en stage, a `/` (la portada del mateix origen —
  per exemple `https://eduhoot-stage.edutictac.es/`).
- En qualsevol altre valor (`production`, buit...) no fa absolutament
  res: cap petició ni canvi visual addicional.
- També afig una classe `env-development`/`env-staging` a `<html>`
  (`src/public/js/env-badge.js`). D'ahí es penja una regla d'
  `edutictac-shared.css` que amaga l'enllaç "Inici" del xip de compte
  (`<edutictac-account>`, widget extern servit per Commons: classe
  `.eta-home`, vista només en els mocks de test de
  `chip-footer.spec.js`/`auth-state.spec.js`, no documentada per
  Commons). El motiu: eixe enllaç porta a `https://edutictac.es` sense
  cap manera evident de tornar, i confonia al professorat en proves
  d'stage/dev. En producció es manté visible. És una dependència fràgil
  d'una classe interna no documentada del widget extern: si Commons la
  canvia, la regla simplement deixa d'aplicar-se i "Inici" torna a
  mostrar-se (no trenca res més).
- El distintiu pot portar una segona línia, més menuda, davall del
  text principal (`applyBadge(cfg, tag)`): en stage, la tag amb què es
  va publicar la imatge (`GET /api/version`); **en desenvolupament**,
  el professorat loguejat (`nickname` o, si no en té, l'email, via
  `GET /api/auth/me`) — el mateix nom que ja ix entre claudàtors al
  títol de la pestanya quan s'està a `/create/` o
  `/create/quiz-creator/` (`updateTitleUserId()` en
  `create-auth.js`/`quizCreator.js`). Com que `env-badge.js` es carrega
  a totes les pantalles i la sessió és la mateixa cookie en tot el
  lloc, el nom apareix encara que la pàgina actual no siga `/create/`
  (p. ex. a `/solo/` o `/host/`). Si no hi ha sessió, no es mostra eixa
  segona línia (igual que en stage sense tag).
- Vore `docs/STAGE-AUTOMATIC.md` per a com es configura `NODE_ENV` i
  `AUTO_SEED_STAGE` al VPS de stage.

El peu comú de pàgina mostra la versió desplegada amb `app-version.js`, que
consulta `GET /api/version` de `server.js` (versió de `package.json`).

## Deute tècnic conegut

- ~~`server.js` concentrava tot el backend (5.123 línies).~~
  **Corregit** (Subfase A de `docs/MIGRATING.md`): dividit en `data/`,
  `services/`, `routes/` i `sockets/`; `server.js` és ara un punt
  d'entrada de ~355 línies. En el frontend s'ha fet el
  mateix amb `create.js` i `solo.js`; queden sense repartir
  `multiplayer.js`, `quizCreator.js` i `hostGame.js`.
- Els routers i els handlers de Socket.IO reben moltes dependències per
  injecció des de `server.js` (`routes/quizzes.js` en rep més de 30).
  Funciona i és explícit, però moltes d'eixes dependències són mòduls
  sense estat que els fitxers podrien requerir directament; és una
  simplificació possible, no un requisit.
- Les partides en curs i les sessions HTTP viuen només en memòria: no
  sobreviuen a un reinici del procés (vore seccions anteriors).
- `POPULAR_FEATURES.md` (secció "Fase 0") marcava separar
  responsabilitats de `server.js` com a **requisit** abans de seguir
  afegint mecàniques de joc de dificultat alta; la part del backend ja
  està feta (vore punt anterior).
- ~~Stage i producció comparteixen hui la mateixa base de dades.~~
  **Corregit.** `DB_NAME` en `data/db.js` ja és configurable
  (`process.env.MONGO_DB || 'kahootDB'`, mateix patró que ja usen
  `src/scripts/normalize-tags.js` i `src/scripts/seed-dev-data.js`). Stage
  definix `MONGO_DB=eduhoot_stage` en la seua configuració i desplega amb
  Docker (vore `docs/STAGE-AUTOMATIC.md`), així que l'aïllament de base de
  dades és efectiu.
- ~~El panell `/admin/stats` no estava integrat amb el xip
  d'EduTicTac/Authentik com la resta de pàgines, i el seu formulari antic
  de correu+contrasenya/Google havia quedat trencat en producció amb
  `AUTHENTIK_ONLY=true`.~~ **Corregit.** Ara usa el mateix xip que
  `/create/` (vore "Panell d'administració"). S'ha triat **no** extraure
  un mòdul compartit amb `src/public/js/create-auth.js`: eixes funcions
  no són un mòdul independent, operen sobre variables globals de
  `create.js` (`authState`, `adminPanel`, etc.), i tocar-ho per a
  parametritzar-les suposaria arriscar codi en producció de `/create/`
  (biblioteca, IA, sockets) per a cap benefici real en `/admin/stats`
  (que no comparteix res d'això). En lloc d'això, `admin-stats.js` porta
  la seua pròpia còpia reduïda (~50 línies) de només les parts 100%
  genèriques (`loginWithAuthentik`, `sameSiteAsPage`,
  `syncCentralSession`, `applyCentralSession`), amb una clau de
  `sessionStorage` pròpia (`eduh_auth_bridge_admin`) perquè no interferisca
  amb la de `/create/`.
- La **CSP** (*Content Security Policy*) està desactivada
  (`contentSecurityPolicy: false` en la configuració de Helmet de
  `server.js`); Helmet només posa la resta de capçaleres. Activar-la
  afegiria una segona barrera contra XSS: si algun `innerHTML` deixa
  passar text d'usuari (noms de jugador, quizzes importats), el navegador
  no executaria el codi injectat ni enviaria dades a dominis no permesos.
  Seguiment en la [issue #20](https://github.com/Edutictac/EduHoot/issues/20).
  - **Requisit**: passar a `addEventListener` els atributs `on…=` que
    queden (ja només els `onerror` del widget de
    Commons). Sense açò caldria `'unsafe-inline'` en els scripts, que
    anul·la quasi tota la protecció. En els estils, `'unsafe-inline'`
    sí és acceptable.
  - **Orígens a permetre hui**: `cdn.jsdelivr.net` (llibreries de
    `/create/`), `commons.edutictac.es` (widget i API),
    `www.youtube-nocookie.com` (vídeos) i imatges `https:`/`data:` (QR,
    miniatures, quizzes).
  - **Com**: primer amb `reportOnly: true` en dev i stage (només avisa
    en la consola, no bloqueja), després en mode real.
  - **Vue**: el lobby de `/host/` i les pantalles de joc de `/player/game/`
    i `/host/game/` ja l'usen, i el seu compilador de plantilles necessita
    també `'unsafe-eval'`. Risc baix mentre les plantilles no continguen
    text d'usuari.
- **Reconnexió trencada a `/player/game/` després de la primera**
  (trobat provant en real la Subfase B de `playerGame.js`, 2026-11-08;
  [issue #23](https://github.com/Edutictac/EduHoot/issues/23)):
  `Players.tokens` (en `src/server/utils/players.js`) guarda
  `{hostId, playerId}` quan es crea el jugador i mai s'actualitza quan
  `playerId` canvia en una reconnexió posterior (`player.playerId =
  socket.id` a `sockets/playerEvents.js`, als tres llocs on es
  reassigna). `getByToken()` seguix buscant pel `playerId` antic, que ja
  no coincidix amb cap jugador, així que la segona reconnexió (p. ex.
  recarregar la pestanya una segona vegada) rep `noGameFound` i torna a
  la portada. La primera reconnexió (el pas de `/player/` a
  `/player/game/`) funciona per casualitat: encara no s'havia reassignat
  `playerId` quan es consulta. No és cosa de la Subfase B (Vue): el
  mateix passaria amb el codi anterior.
- ~~`short-answer`/`numeric` sempre filtrades de "Jugar a l'aula"~~
  **Corregit** ([issue #24](https://github.com/Edutictac/EduHoot/issues/24)):
  `isMultiplayerFreeTypeQuestion` les llevava dos vegades (en crear la
  partida, al handler `host-join` de `hostEvents.js`, i en
  `buildQuestions()` de `gameHelpers.js`) — eixe filtre és el del mode
  Multijugador (pantalla compartida, sense teclat), reutilitzat per
  error també en "Jugar a l'aula". Es va llevar d'eixos dos llocs
  (`playerGame.js`/`hostGame.js` ja tenien el codi llest per a
  pintar-les); el filtre seguix aplicant-se, com toca, només en
  `?mode=multiplayer` (`routes/quizzes.js`).
- ~~`#playersAnswered` (`/host/game/`) es quedava ocult per sempre
  després de la primera pregunta.~~ **Corregit** (trobat auditant
  `hostGame.js` en preparar la Subfase B, 2026-11-09): `questionOver`
  l'oculta (`app.playersAnsweredVisible = false`), però ara
  `gameQuestions`, `questionCountdown` i `nextQuestion()` també
  tornen `app.playersAnsweredVisible = true`, no només el text. El
  professorat ja no perd el comptador "Han respost X/Y" a partir de la
  segona pregunta.
- ~~No es podia saltar la primera pregunta de cada partida.~~
  **Corregit** (mateixa auditoria): `#skipQButton` només es mostrava
  dins de `nextQuestion()` (mai a la primera pregunta); ara
  `gameQuestions` també el mostra. `#nextQButton` seguix sent codi
  mort (mai arriba a mostrar-se enlloc del fitxer; l'avanç real es fa
  des del modal de resultats), i els 4 `.square` (barres de recompte
  substituïdes fa temps pel modal de resultats) també ho són
  (`updateSquareHeights()` ni es crida mai) — estos dos, sense
  comportament visible, no s'han tocat. Vore
  `test/browser/host-game.spec.js`.

## Unió a la partida: nom i icona del jugador

Quan un alumne s'uneix a una partida (pantalla de `join`, codi en
`src/public/js/join.js`):

- **El nom l'escriu el propi alumne**, en un camp de text lliure. No
  existix cap generador de sobrenoms aleatoris (és una millora proposada
  en `POPULAR_FEATURES.md`, pendent d'implementar).
- El nom es normalitza abans d'enviar-se: es retallen espais al
  principi/final, es col·lapsen espais múltiples, i es limita a un
  màxim de caràcters (funcions `normalizeGuestName` /
  `normalizeGuestNameLive` en `join.js`). Segons el `README.md`, el límit en multijugador és
  de 40 caràcters.
- A més del nom, l'alumne tria una **icona/emoji** d'un selector visual
  (`icon-picker`) que l'identifica en la partida.
- En la vista de l'amfitrió (lobby de `/host/`), cada jugador que
  s'uneix apareix com una targeta (no una llista de text pla), amb la
  seua icona i el seu nom: el handler de Socket.IO `updatePlayerLobby`
  (`src/public/js/host.js`) actualitza la llista `players`, i la
  plantilla de Vue (`v-for` en `src/public/host/index.html`) la pinta
  (vore "Lobby de l'amfitrió amb Vue").

No hi ha, per tant, cap sistema de comptes d'alumne ni login previ per a
jugar: el nom que escriu cada alumne és l'únic identificador dins d'esa
partida concreta.

## Informe de partida (descàrrega en CSV)

En acabar una partida, el professorat/amfitrió pot descarregar un
informe complet dels resultats:

- **Botons**: "Descargar informe (CSV)" (`#downloadReportBtn`, mètode
  `downloadReport` de l'app Vue, que crida
  `downloadSessionReportCsv()` en `hostGame.js`) i «Tornar»
  (`#backToLibraryBtn`, cap a `/create/`). Eixos botons només es mostren
  en acabar la partida.
- **Endpoint**: `GET /api/live-games/:pin/report.csv?hostId=...`
  (ruta de `routes/games.js`). El servidor comprova que el `hostId`
  que arriba en la petició coincidix amb l'amfitrió real d'esa partida;
  si no, respon `403 No autorizado para descargar este informe`. Això
  evita que qualsevol amb el PIN de la partida puga descarregar els
  resultats.
- **Disponibilitat després de la partida**: l'informe es servix primer
  des de la partida en memòria si el servidor continua alçat; si no, es
  busca en disc (els fitxers d'informe es guarden i es netegen de forma
  programada, `src/server/services/sessionReport.js`, vore també
  `CHANGELOG.md` 1.0.5).
  Això permet descarregar l'informe encara que el servidor s'haja
  reiniciat després que acabara la partida (abans de la versió 1.0.5
  això retornava un 404).
- **Nom del fitxer**: `informe-<quiz>-<timestamp>-<pin>.csv`
  (`buildReportFileName`, `sessionReport.js`), amb el nom del
  qüestionari sanejat i acotat a 60 caràcters. Abans era sempre
  `informe-partida-<PIN>.csv`; com el PIN es reutilitza entre partides,
  dos sessions distintes podien generar el mateix nom i sobreescriure's.

### Columnes del CSV

Capçalera definida per `liveSessionToCsv()` en `sessionReport.js`:

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
  va ser correcte, i quant va tardar. `resultado` pot ser `correcta`,
  `incorrecta`, `parcial` (encert parcial en preguntes de resposta
  múltiple), `encuesta` (preguntes `poll`, sense valoració) o
  `sin responder` (mapeig de `resultado` en `sessionReport.js`).

**No hi ha una columna de "% d'encerts" ja calculada.** Per a obtindre'l
cal calcular-lo a partir d'`aciertos` / `preguntasTotales` en un full de
càlcul (per exemple, amb una fórmula `=aciertos/preguntasTotales` per
fila d'alumne).

## Exportació a Moodle XML

Cada qüestionari de la biblioteca (`/create/`) té, junt al botó de
descàrrega en CSV, un botó amb la icona de Moodle
(funció `downloadMoodleXml()` en `create-export.js`, enllaçada des de
`create-library.js`) que descarrega eixe mateix qüestionari convertit al
format Moodle XML, llest per a importar-lo al banc de preguntes de
Moodle/AULES i muntar ahí un "Qüestionari" natiu.

- **Endpoint**: `GET /api/quizzes/:id/moodle-xml` (ruta de
  `routes/quizzes.js`), que crida la funció `quizToMoodleXml()` de
  `services/moodleExport.js`.
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

## Panell d'administració (estadístiques)

- **Accés**: `/admin/stats` (`/admin`, `/admin/` i `/admin-stats.html`
  redirigixen ahí). Pàgina: `src/public/admin-stats.html` + lògica en
  `src/public/js/admin-stats.js`.
- **Rol necessari**: `admin` (no `editor`). El propi HTML es servix a
  qualsevol visitant (el handler `router.get('/admin/stats', ...)` de
  `routes/admin.js` no té `requireRole`); és la crida a l'endpoint de
  dades la que exigix el rol. Segons el `README.md`, el primer usuari que
  entra per la via antigua de Google es crea com `admin`; la resta entra
  com `editor`.
- **Endpoint de dades**: `GET /api/admin/stats`, protegit amb
  `requireRole('admin')` en `routes/admin.js` (vore també
  `services/authMiddleware.js`). Si no hi ha sessió respon `401`; si hi
  ha sessió però el rol és insuficient, `403`.
- **Login des de la mateixa pàgina, pel xip EduTicTac/Authentik**: igual
  que `/create/`, la pàgina carrega `<edutictac-account>` +
  `/js/edutictac-chip.js` + `account-widget.js` i registra `/admin/stats`
  en `CHIP_PAGES` (`server.js`) perquè la reescriptura
  d'`EDUTICTAC_COMMONS_URL` també hi funcione. `admin-stats.js` porta una
  versió reduïda i pròpia (sense dependències de la UI de `/create/`) del
  pont de sessió de `src/public/js/create-auth.js`: si Commons té sessió
  docent i EduHoot no, redirigix a
  `/api/auth/authentik/start?next=/admin/stats`; si la petició a
  `/api/admin/stats` falla amb 401, es mostra el botó "Entrar con
  EduTicTac" (`#login-fallback`); amb 403 (sessió vàlida, rol
  insuficient) el botó es manté amagat perquè no té sentit reintentar.
- **Dades que mostra** (totes agregades, cap dada identificativa
  d'alumnat):
  - Total de quizzes i de preguntes, i mitjana de preguntes per quiz.
  - Partides jugades i jugadors totals (històric, camps `playsCount` /
    `playersCount` de cada quiz).
  - Partides i jugadors actius **en directe** (llegits de l'array en
    memòria `games.games`, no de la base de dades).
  - Desglossament de visibilitat (`public` / `unlisted` / `private`).
  - Quizzes i preguntes "efímers" (col·lecció de
    `getEphemeralCollection`, qüestionaris `local-*` sense compte, que
    caduquen).
- **El mateix router (`admin.js`) també allotja** ferramentes afins
  sense interfície pròpia (només API): exportar/importar quizzes en
  bloc, i rèplica ("mirror") d'imàtgens de Kahoot o externes.

## Logs del servidor (`/admin/logs`)

- **Llibreria**: Winston (`src/server/logger.js`), amb eixida a consola
  i un *transport* propi que persistix cada entrada com a document a la
  col·lecció `appLogs` (`src/server/data/db.js`), creada explícitament
  com a **capped** (circular, mida fixa en bytes) perquè `collection()`
  no ho fa sol. Camps de correlació a cada document: `level`, `message`,
  `tag`, `pin`, `hostId`, `playerId`, `meta` (la resta de dades), i
  `createdAt`.
- **Nivell i mida configurables** sense redesplegar: col·lecció
  `appSettings` (document `_id: 'logging'`), editable des del propi
  visor o per `GET`/`POST /api/admin/settings/logging`
  (`src/server/routes/admin.js`, `requireRole('admin')`). Canviar la
  mida redimensiona la col·lecció en calent (`collMod` amb
  `cappedSize`); per defecte, nivell `info` i 10MB.
- **Visor**: `/admin/logs` (`src/public/admin-logs.html` +
  `src/public/js/admin-logs.js`, mateix patró vanilla JS que
  `/admin/stats`, sense Vue), amb filtres per nivell, PIN, `hostId` i
  text lliure (`GET /api/admin/logs`, mateixa protecció de rol). Les
  files amb `meta` no buit (p. ex. `uncaughtException`) tenen un botó
  "Ver" que obri un `<dialog>` amb la resta de camps i el stack trace
  complet — l'API ja tornava `meta` sencer, només faltava pintar-lo.
- **`uncaughtException` és un cas especial**: el *transport* normal no
  bloqueja el bucle d'esdeveniments (escriu en segon pla), però ahí el
  procés es tanca (`process.exit(1)`) just després de l'error. Per no
  perdre eixe log concret, `server.js` intenta persistir-lo directament
  amb un marge curt (1,5s) abans d'eixir, a banda del `logger.error`
  normal.
- **Esdeveniments de partida registrats**: creació/inici/fi de partida
  (`game-start`/`game-end`/`host-join` en `hostEvents.js`), unió/
  reconnexió/eixida de jugador (`player-join`/`player-rejoin`/
  `player-leave` en `playerEvents.js`/`common.js`, incloent-hi el cas
  de reutilitzar una fila amb el mateix nom quan el token no resol —
  vore la issue de jugadors duplicats), i els errors no controlats de
  cada mòdul de sockets/rutes.

## Modes de joc

Al crear o llançar un qüestionari des de la biblioteca
(`src/public/js/create.js`), hi ha tres botons/modes distints. Només un
d'ells està pensat per a una classe amb un dispositiu per alumne:

| Mode (botó) | Funció / destí | Per a què servix |
|---|---|---|
| **"Jugar a l'aula"** | `startGame(quiz.id)` → `/host/` (`create-quiz-actions.js`) | El mode clàssic tipus Kahoot: es genera un PIN/QR, cada alumne s'uneix des del seu propi mòbil/tablet via `/join`, i el professorat projecta les preguntes des de `/host/`. **És el mode a usar amb un grup d'alumnes, cada un amb el seu dispositiu.** És *host-paced*: el professorat controla el ritme (vore secció següent). |
| **"Multijugador"** | `startMultiplayer(quiz.id)` → `/multiplayer/` | Pensat per a 2-4 jugadors compartint **una sola pantalla/dispositiu** (text "Juega en la misma pantalla" en `src/public/multiplayer/index.html`). No servix per a una classe amb un dispositiu per alumne. |
| **"Solo"** | `startSolo(quiz.id)` → `/solo/` | Mode individual, per a practicar fora de classe (vore també els [enllaços directes al mode Solo](README.md) del README). No és un mode de grup. |

Per a una classe amb molts alumnes, cada un amb el seu propi dispositiu,
l'única opció correcta hui és **"Jugar a l'aula"**.

### Opció "Mostra la pregunta a l'alumnat" (pantalla `/host/`)

Casella en `#host-options` (plantilla del lobby en
`src/public/host/index.html`, opció
`sendToStudents` dins `game.gameData.options`), marcada per defecte,
que decideix si el dispositiu de cada alumne (mòbil, tauleta o PC —
no és exclusiu de mòbils) rep el **text** de la pregunta i de les
respostes, a banda de la pantalla compartida del professorat:

- **Marcada**: el servidor emet `playerQuestion` amb la pregunta
  completa (`buildStudentPlayerPayload()` en `gameHelpers.js`); el
  dispositiu pinta el text i els botons de resposta amb el seu contingut
  (listener `playerQuestion` en `playerGame.js`).
- **Desmarcada**: el mateix event `playerQuestion` es segueix enviant,
  però amb un payload "a cegues" — `{ blind: true, answerCount, type,
  pointsMultiplier, time }`, sense text de la pregunta ni de les
  respostes. El dispositiu mostra un avís ("Mira la pantalla per a
  veure la pregunta", clau `blind_hint`) i pinta només els `answerCount`
  botons actius amb la seua forma/color fixos per CSS (triangle verd,
  romb taronja, cercle blau, quadrat roig — regles de forma/color de
  `src/public/css/playerGameView.css`), sense text visible.
  Cada botó porta un `aria-label` amb el nom de la forma (p. ex.
  "Opció A: triangle") perquè seguisca sent accessible sense text
  (vore `docs/ACCESSIBILITY.md`).

L'alumnat sempre pot respondre prement un botó, en els dos casos
(`answerSubmitted(num)` només depén de l'índex del botó, mai del seu
text). La imatge/vídeo de la pregunta, si en té, seguix mostrant-se
igual en els dos casos (event `questionMedia`, independent d'esta
opció). **Decisió de disseny**: en mode "a cegues", el dispositiu de
l'alumne mai rep el text — ni durant la pregunta ni en el resum
posterior ("Resposta correcta: X" queda buit en este mode) — el repàs
de respostes es fa sempre a la pantalla compartida, igual que en el
Kahoot clàssic.

## Avanç de pregunta: automàtic o manual?

**Hui no existix cap opció perquè les preguntes avancen soles.** No hi
ha cap interruptor ni en el creador del qüestionari
(`src/public/create/index.html`, `src/public/js/quizCreator.js`) ni en
la pantalla d'amfitrió (`src/public/host/index.html`,
`src/public/js/host.js`) per a activar un avanç automàtic.

El que sí és automàtic és el **tancament d'una pregunta**:
- Si tots els jugadors responen abans de temps, el servidor ho detecta
  (quan `playersAnswered === playerNum.length`, al handler de resposta de
  `playerEvents.js`) i mostra resultats.
- Si s'acaba el temps, l'amfitrió emet `timeUp` i el servidor fa el
  mateix (handler `timeUp` de `common.js`).

Però això només obri la pantalla de resultats/rànquing. **Passar a la
pregunta següent requerix sempre una acció explícita del professorat**:
prémer el botó "Siguiente pregunta" (o la tecla Enter) en eixe modal
(`handleResultsModalNext()` → `nextQuestion()`, en
`src/public/js/hostGame.js`), el que emet l'esdeveniment
de Socket.IO `nextQuestion`. El servidor només avança la pregunta dins
d'eixe handler (`socket.on('nextQuestion', ...)`,
`src/server/sockets/hostEvents.js:199-308`) — no existix cap temporitzador en el
servidor que dispare eixe avanç per si sol.

En resum: en el mode "Jugar a l'aula", el professorat ha d'estar
pendent de prémer "Siguiente pregunta" després de cada pregunta. Un mode
"autoritme" (cada alumne avança sol) o un mode de presentació que avance
sense intervenció del professorat són millores pendents, encara no
implementades — estan recollides en `POPULAR_FEATURES.md` ("Mode
autoritme (self-paced)" i "Mode 'presentació' híbrid").

## Tipus de pregunta suportats

El tipus es normalitza i es valida en `normalizeQuestionType()` /
`VALID_TYPES` (`src/server/questionUtils.js`), que és també on cal
mirar per a conéixer l'únic llistat autoritatiu (useat tant en l'editor
de `/create/` com en la importació de CSV):

- **`quiz`**: opció múltiple clàssica, una única resposta correcta
  (fins a 4 opcions, `toValidAnswerIndex()` les limita a l'1-4).
- **`multiple`**: opció múltiple amb diverses respostes correctes alhora;
  cal marcar-les totes i només elles (`isSubmissionCorrect()`) per a
  l'encert complet, amb crèdit parcial si no s'encerta del tot (vore
  "Càlcul de la puntuació" més avall).
- **`true-false`**: com `quiz` però amb només 2 opcions (reserva els
  índexs a l'1-2).
- **`short-answer`**: resposta lliure de text. S'accepten diverses
  respostes vàlides (`acceptedAnswers`, separades per `|`, `,` o salt de
  línia en el CSV, `splitAcceptedAnswers()`) i la comparació ignora
  accents, majúscules i puntuació (`normalizeFreeText()`).
- **`numeric`**: resposta lliure numèrica amb tolerància
  (`numericAnswer` ± `tolerance`, admet coma decimal,
  `parseLenientNumber()`).
- **`poll`** (encuesta/enquesta): sense resposta correcta, mai compta en
  la puntuació (vore "Preguntes d'enquesta" més avall).

**Tipus provats en partida real de "Jugar a l'aula"**: `quiz`,
`multiple`, `short-answer` i `numeric` ([issue #24](https://github.com/Edutictac/EduHoot/issues/24),
resolta). El mode Multijugador (pantalla compartida) seguix excloent
`short-answer`/`numeric` perquè el mòbil hi funciona com a mando sense
teclat.

**Noms alternatius acceptats en la importació de CSV**: la funció de
normalització és tolerant amb sinònims i variants en català/castellà
(p. ex. `encuesta`/`enquesta` → `poll`, `respuesta corta`/`resposta
curta` → `short-answer`, `verdadero/falso`/`vertader/fals` →
`true-false`). Qualsevol valor no reconegut cau per defecte a `quiz`.

**Noms diferents en l'exportació a Moodle XML**: Moodle fa servir una
altra nomenclatura pels mateixos conceptes (`multichoice`, `truefalse`,
`shortanswer`, `numerical`, vore "Exportació a Moodle XML" més avall);
no hi ha equivalent per a `poll`, que no s'exporta.

## Comparativa de tipus amb Kahoot, Wayground i AULES

Comparativa de tipus de pregunta entre EduHoot i les plataformes on el
professorat sol reutilitzar el mateix qüestionari: Kahoot, Wayground
(antes Quizizz) i AULES (Moodle). Serveix per a decidir quins tipus es
poden crear una vegada i usar en cada entorn.

> **Estat de la informació:** les dades de Kahoot i Wayground provenen de
> cerca web i de la documentació d'ajuda pública, no d'un compte real.
> Poden variar segons el pla de subscripció. Abans de tractar-les com a
> definitives, cal verificar-les en un compte de cada plataforma. Les
> dades d'AULES (Moodle) i d'EduHoot sí estan contrastades amb el codi i
> amb els bancos de preguntes del repositori.

### Tipus disponibles per plataforma

- **Kahoot.** *Test de coneixements:* opció múltiple (quiz), vertader/fals,
  resposta escrita (*type answer*, fins a 20 caràcters), control lliscant
  (*slider*), *pin answer* (marcar un punt en una imatge) i *puzzle*
  (ordenar alternatives). *Opinió:* enquesta (*poll*), escala, NPS,
  *drop pin* i núvol de paraules. No hi ha cap tipus de resposta llarga.
- **Wayground (antes Quizizz).** Opció múltiple (en tots els plans),
  amb varies correctes (*multi-select*, de pagament), resposta curta o
  oberta, emplenar buits, enquesta, núvol de paraules, dibuix i
  diapositives. *Interactius:* emparellament (*Match*), desplegable,
  arrossegar i deixar anar, i etiquetat sobre imatge (arrossegar text a
  zones d'una imatge). No s'ha trobat un tipus d'ordenar ni de *hotspot*
  (fer clic en una zona de la imatge).
- **AULES (Moodle).** Els tipus del nucli de Moodle: opció múltiple (una o
  varies correctes), vertader/fals, resposta curta, emparellament,
  numèrica, assaig, incrustades (*Cloze*), emplenar buits amb desplegable,
  arrossegar i deixar anar en text o sobre imatge, calculada i descripció
  (no puntua). Un XML de Moodle pot incloure emparellaments encara que
  EduHoot no els exporte.

### Comparativa

| Tipus | EduHoot (aula) | Kahoot | Wayground | AULES (Moodle) |
|---|---|---|---|---|
| Opció múltiple (una correcta) | Sí (`quiz`) | Sí | Sí | Sí |
| Opció múltiple (varies correctes) | Sí (`multiple`) | No confirmat | Sí (de pagament) | Sí |
| Vertader/fals | Sí (`true-false`), sense prova en aula | Sí | No confirmat | Sí |
| Resposta curta | Sí (`short-answer`), no en Multijugador | Sí (*type answer*, 20 car.) | Sí (oberta, buits) | Sí |
| Numèrica | Sí (`numeric`), no en Multijugador | No confirmat | No confirmat | Sí |
| Emparellament | No | No | Sí (*Match*) | Sí |
| Ordenar | No | Sí (*puzzle*) | Aproximat (desplegable, arrossegar) | Sí (arrossegar) |
| Imatge amb marcador | No | Sí (*pin answer*) | Etiquetat (arrossegar text) | Sí (arrossegar sobre imatge) |
| Enquesta (no puntua) | Sí (`poll`) | Sí | Sí | No (no és tipus del banc) |
| Assaig / text llarg | No | No | Sí (oberta) | Sí |

### Implicacions per a EduHoot

- **Exportació a Moodle XML:** `services/moodleExport.js` només converteix
  `multichoice`, `truefalse`, `shortanswer` i `numerical`. Els
  emparellaments, els assajos i les incrustades no es poden exportar
  des d'EduHoot, tot i que el format Moodle sí els admet.
- **Partida a l'aula:** en els tipus que EduHoot pot fer a l'aula, només
  `quiz` i `multiple` estan provats en partida real; `true-false` té el
  codi però no consta com a provat.
- **Interoperabilitat:** les opcions comunes a les quatre plataformes són
  l'opció múltiple d'una correcta i, en la majoria de casos, el
  vertader/fals. Qualsevol altre tipus limita el qüestionari a una
  plataforma concreta.

Fonts (cerca web, a verificar):
- [Kahoot, tipus de pregunta (suport oficial)](https://support.kahoot.com/hc/articles/115002308428)
- [Kahoot, nous tipus de pregunta i opcions de joc (2019)](https://kahoot.com/blog/2019/10/08/new-question-types-and-game-options/)
- [Wayground, tipus de pregunta explicats](https://help.wayground.com/support/solutions/articles/158000411419-question-types-explained)
- [Wayground per a empreses, tots els tipus de pregunta](https://forbusiness-help.wayground.com/support/solutions/articles/158000411109-all-questions-types-on-quizizz-for-work)

## Càlcul de la puntuació

**EduHoot puntua a l'estil Kahoot/Wayground, no per simple % d'encerts**
(`calculateQuestionScore`, `src/server/services/scoring.js:5`):

- Cada pregunta val fins a **1000 punts base**
  (`MAX_POINTS_PER_QUESTION`), multiplicats per la fracció de temps que
  queda quan es respon (`remainingRatio`): quant més ràpid s'encerta,
  més punts.
- S'aplica el multiplicador del power-up de doble puntuació
  (`pointsMultiplier`) si està actiu en eixa pregunta.
- En preguntes de resposta múltiple hi ha **crèdit parcial amb
  penalització** (`getSubmissionScoreRatio`, `services/scoring.js:21`): cada opció
  correcta marcada suma, cada opció incorrecta marcada resta el mateix,
  amb un mínim de 0 — no és tot o res.
- La puntuació final (`puntuacionFinal` en el CSV) és la **suma
  acumulada d'estos punts per pregunta**. El rànquing i el podi es
  basen en els punts, no en el % d'encerts; el CSV guarda eixe recompte
  (`aciertos`/`fallos`/`sinResponder`) només com a dada informativa a
  banda.

### Preguntes d'enquesta («opinió»): com es comporten en cada mode

Les preguntes de tipus `poll` (sense resposta correcta) queden **fora
del càlcul de puntuació** en tots els modes, però cada un ho implementa
a la seua manera:

**Mode Solo** (`src/public/js/solo-game.js:500-504`,
`getScoredQuestionCount()` les filtra):

- Cap opció marcada apareix com a «incorrecta» (`solo-game.js:380`): es
  passa a la pregunta següent igual que si fora un encert
  (`solo-game.js:456`), sense obrir el diàleg d'error.
- El resum final separa els encerts puntuats de les enquestes
  respostes (p. ex. «Encerts 1/1 · Enquestes: 1 · sense puntuació»,
  `solo-game.js:484-491`).
- Si **tot** el qüestionari és d'enquestes, no s'envia cap puntuació al
  rànquing global (`solo-game.js:497`, `prepareScoreSubmission()` només es
  crida si `getScoredQuestionCount() > 0`).

Cobert per `src/test/browser/solo-poll.spec.js` (vore `TESTING.md`).

**Mode "Jugar a l'aula"** (host + mòbils, `/host/` i `/player/`):

- El servidor calcula `scoreRatio = 0` i `isCorrect = false` per a
  qualsevol resposta a una pregunta `poll`
  (`getSubmissionScoreRatio`, `src/server/services/scoring.js:21`), però
  no la compta com a fallada: en el handler de resposta
  (`src/server/sockets/playerEvents.js:228-240`) les `poll` tenen la
  seua pròpia branca (`isPoll`) que emet `answerResult: { outcome: 'poll' }`
  en lloc d'incrementar `wrongCount`.
- Al mòbil (`src/public/js/playerGame.js:553-557`), eixe resultat pinta
  la pantalla de color gris i mostra «¡Gracias por responder!» — no es
  marca com a encert ni com a error.
- El comptador de progrés "Pregunta X de N" (`totalQuestions`) sí que
  inclou les `poll`, perquè seguixen formant part normal de la partida.
  El que **no** les inclou és el comptador que es reporta a Commons
  (`scoredQuestionsCount`, `src/server/sockets/hostEvents.js:381-382` i
  `src/server/services/commons.js:119`).
- En l'informe CSV ixen amb `resultado = encuesta`
  (`src/server/services/sessionReport.js:203-209`), no com a
  `incorrecta`.

El mode "Multijugador" (pantalla compartida, `src/public/js/multiplayer.js`)
no té una branca pròpia per a `poll` fora del cas de resposta múltiple
(`multiplayer.js:488-492`); no s'ha revisat este mode en detall ací.
