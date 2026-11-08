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
- [Modes de joc](#modes-de-joc)
- [Avanç de pregunta: automàtic o manual?](#avanç-de-pregunta-automàtic-o-manual)
- [Càlcul de la puntuació](#càlcul-de-la-puntuació)

## Arquitectura tècnica (resum)

- **Express + Socket.IO en un sol procés Node**, organitzat en capes
  (`src/server/`): `data/` (accés a MongoDB), `services/` (lògica de
  negoci), `routes/` (rutes HTTP, una per recurs) i `sockets/`
  (esdeveniments de Socket.IO). `server.js` (~355 línies) és només el
  punt d'entrada: configura Express, instancia els serveis, munta els
  routers i registra els handlers de Socket.IO. Els mòduls amb estat o
  que depenen d'altres instàncies s'exporten com a factories
  (`createXxx({ dependències })`); la resta són mòduls plans que es
  requereixen directament. Vore `docs/MIGRATING.md` (Subfase A) per al
  perquè d'esta divisió.
- **Sense build step**: el client és JS vanilla servit directament des de
  `src/public/`, sense bundler (webpack/vite). Cada pantalla (`create`,
  `host`, `player`, `solo`, `multiplayer`) carrega els seus propis
  `<script>` solts. Única excepció de framework: el lobby de `/host/`, un
  pilot amb Vue 3 també sense build step (vore "Lobby de l'amfitrió amb
  Vue").
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
`quizCreator.js` (~70 KB), `hostGame.js` (~51 KB), `i18n-create.js`
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
| `/create/quiz-creator/` | `quizCreator.js` | Professorat: editor d'un qüestionari (preguntes, respostes, tipus) |
| `/solo/` | `solo.js` + mòduls `solo-*.js` + `i18n-solo.js` (ja repartits, Subfase A) | Mode individual, a ritme propi, fora de classe |
| `/multiplayer/` | `multiplayer.js` | Mode 2-4 jugadors compartint una sola pantalla |
| `/admin-stats.html` | `admin-stats.js` | Estadístiques del panell d'administració |

A banda, fitxers transversals que no pertanyen a una sola pantalla:
`languages.js`, `i18n-host.js`/`i18n-player.js`/`i18n-solo.js`/
`i18n-create.js`, `env-badge.js`, `edutictac-chip.js`,
`music-player.js`, `app-version.js`, `pwa-install.js`, i `js/libs/`
(jQuery, deparam, Vue).

## Model de dades (MongoDB)

Sis col·leccions, totes en la mateixa base de dades: `kahootDB` per
defecte, configurable amb `MONGO_DB` (`src/server/data/db.js:6`). Els noms
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
  (`CHIP_PAGES`, `src/server/server.js:147`).
- El backend encara accepta **correu + contrasenya** (`POST /api/auth/login`)
  i **Google** mentre no s'active el mode només Authentik
  (`AUTHENTIK_ONLY`), però la interfície ja no té cap formulari per a fer-ho.
- En desenvolupament, `/dev/login` (`src/server/routes/devLogin.js`, només
  amb `NODE_ENV=development`) permet entrar amb els usuaris de prova del
  seed, i `docker compose` porta un OIDC simulat (`src/scripts/dev-oidc.js`)
  que fa d'Authentik per a provar el flux OIDC real; vore
  `docs/DEV_DOCKER_SETUP.md`.

Les sessions HTTP **no es guarden en Mongo ni en un store extern**: és
un `Map` en memòria (`sessions`, `src/server/services/sessions.js:3`) indexat per un
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

`host-join` (`src/server/sockets/hostEvents.js:36-125`) crea la partida en
memòria amb un PIN nou i `gameLive: false` (sala d'espera). Eixe PIN ja és
vàlid: l'alumnat pot entrar-hi (`/join.html?pin=...`) i quedar-se esperant
abans que el professorat pulse "Començar". `startGame`
(`hostEvents.js:334-400`) posa `gameLive: true` i arranca la primera
pregunta.

No hi ha cap col·lecció de base de dades per a "partides" — tot açò viu
només en l'array en memòria de `src/server/utils/liveGames.js`, i es
borra sol segons uns temps fixats a `src/server/sockets/gameHelpers.js:9-12`:

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

## Distintiu visual d'entorn (dev/stage)

Per a no confondre un entorn de desenvolupament o stage amb producció,
`src/public/js/env-badge.js` es carrega en totes les pantalles públiques
principals (`index`, `join`, `create`, `create/quiz-creator`, `host`,
`host/game`, `player`, `player/game`, `solo`, `multiplayer`,
`admin-stats`) i consulta l'endpoint `GET /api/env`
(`src/server/server.js:179`, retorna `{ env: process.env.NODE_ENV || '' }`).

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
- Vore `docs/STAGE-AUTOMATIC.md` per a com es configura `NODE_ENV` i
  `AUTO_SEED_STAGE` al VPS de stage.

El peu comú de pàgina mostra la versió desplegada amb `app-version.js`, que
consulta `GET /api/version` (`src/server/server.js:183`, versió de
`package.json`).

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
  **Corregit.** `DB_NAME` (`src/server/data/db.js:6`) ja és configurable
  (`process.env.MONGO_DB || 'kahootDB'`, mateix patró que ja usen
  `src/scripts/normalize-tags.js` i `src/scripts/seed-dev-data.js`), i
  `install-files/stage.env.example` ja definix
  `MONGO_DB=eduhoot_stage`. Cal que `/etc/eduhoot/stage.env` en el VPS
  incloga eixa variable (vore `docs/STAGE_SETUP.md`) perquè l'aïllament de
  base de dades siga efectiu.
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
  (`contentSecurityPolicy: false`, `src/server/server.js:178`); Helmet
  només posa la resta de capçaleres. Activar-la afegiria una segona
  barrera contra XSS: si algun `innerHTML` deixa passar text d'usuari
  (noms de jugador, quizzes importats), el navegador no executaria el
  codi injectat ni enviaria dades a dominis no permesos. Seguiment en
  la [issue #20](https://github.com/Edutictac/EduHoot/issues/20).
  - **Requisit**: passar a `addEventListener` els 22 atributs `on…=`
    dels HTML (14 `onclick`, p. ex. `endGame()` en `host/index.html`,
    i 8 `onerror` del widget de Commons). Sense això caldria
    `'unsafe-inline'` en els scripts, que anul·la quasi tota la
    protecció. En els estils, `'unsafe-inline'` sí és acceptable.
  - **Orígens a permetre hui**: `cdn.jsdelivr.net` (llibreries de
    `/create/`), `commons.edutictac.es` (widget i API),
    `www.youtube-nocookie.com` (vídeos) i imatges `https:`/`data:` (QR,
    miniatures, quizzes).
  - **Com**: primer amb `reportOnly: true` en dev i stage (només avisa
    en la consola, no bloqueja), després en mode real.
  - **Vue**: el lobby de `/host/` ja l'usa, i el seu compilador de
    plantilles necessita també `'unsafe-eval'`. Risc baix mentre les
    plantilles no continguen text d'usuari.

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

- **Botó**: "Descargar informe (CSV)" en la vista de l'amfitrió
  (`src/public/js/hostGame.js`: el botó el crea
  `ensureDownloadReportButton()` i la descàrrega la fa
  `downloadSessionReportCsv()`). Al costat ix «Tornar», que porta a la
  biblioteca (`ensureBackToLibraryLink()`).
- **Endpoint**: `GET /api/live-games/:pin/report.csv?hostId=...`
  (`src/server/routes/games.js:17`). El servidor comprova que el `hostId`
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

Capçalera definida en `src/server/services/sessionReport.js:174`:

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
  `sin responder` (`src/server/services/sessionReport.js:203-209`).

**No hi ha una columna de "% d'encerts" ja calculada.** Per a obtindre'l
cal calcular-lo a partir d'`aciertos` / `preguntasTotales` en un full de
càlcul (per exemple, amb una fórmula `=aciertos/preguntasTotales` per
fila d'alumne).

## Exportació a Moodle XML

Cada qüestionari de la biblioteca (`/create/`) té, junt al botó de
descàrrega en CSV, un botó amb la icona de Moodle
(`src/public/js/create-library.js:704`, funció `downloadMoodleXml()` en
`create-export.js:362`) que descarrega eixe mateix qüestionari convertit al format
Moodle XML, llest per a importar-lo al banc de preguntes de Moodle/AULES
i muntar ahí un "Qüestionari" natiu.

- **Endpoint**: `GET /api/quizzes/:id/moodle-xml`
  (`src/server/routes/quizzes.js:147`), que crida la funció
  `quizToMoodleXml()` (`src/server/services/moodleExport.js:43`).
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
  qualsevol visitant (`router.get('/admin/stats', ...)` en
  `src/server/routes/admin.js:349` no té `requireRole`); és la crida a
  l'endpoint de dades la que exigix el rol. Segons `README.md:36/115`,
  el primer usuari que entra amb Google es crea com `admin`; la resta
  entra com `editor`.
- **Endpoint de dades**: `GET /api/admin/stats`
  (`src/server/routes/admin.js:299-347`, protegit amb
  `requireRole('admin')`, vore `src/server/services/authMiddleware.js:45`).
  Si no hi ha sessió respon `401`; si hi ha sessió però el rol és
  insuficient, `403`.
- **Login des de la mateixa pàgina, pel xip EduTicTac/Authentik**: igual
  que `/create/`, la pàgina carrega `<edutictac-account>` +
  `/js/edutictac-chip.js` + `account-widget.js` i registra `/admin/stats`
  en `CHIP_PAGES` (`src/server/server.js:161-174`) perquè la reescriptura
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

## Modes de joc

Al crear o llançar un qüestionari des de la biblioteca
(`src/public/js/create.js`), hi ha tres botons/modes distints. Només un
d'ells està pensat per a una classe amb un dispositiu per alumne:

| Mode (botó) | Funció / destí | Per a què servix |
|---|---|---|
| **"Jugar a l'aula"** | `startGame(quiz.id)` → `/host/` (`create-quiz-actions.js:2-4`) | El mode clàssic tipus Kahoot: es genera un PIN/QR, cada alumne s'uneix des del seu propi mòbil/tablet via `/join`, i el professorat projecta les preguntes des de `/host/`. **És el mode a usar amb un grup d'alumnes, cada un amb el seu dispositiu.** És *host-paced*: el professorat controla el ritme (vore secció següent). |
| **"Multijugador"** | `startMultiplayer(quiz.id)` → `/multiplayer/` | Pensat per a 2-4 jugadors compartint **una sola pantalla/dispositiu** ("Juega en la misma pantalla", `src/public/multiplayer/index.html:18-19`). No servix per a una classe amb un dispositiu per alumne. |
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
  completa (`src/server/sockets/gameHelpers.js:281-295`,
  `buildStudentPlayerPayload()`); el dispositiu pinta el text i els
  botons de resposta amb el seu contingut
  (`src/public/js/playerGame.js:768-800`).
- **Desmarcada**: el mateix event `playerQuestion` es segueix enviant,
  però amb un payload "a cegues" — `{ blind: true, answerCount, type,
  pointsMultiplier, time }`, sense text de la pregunta ni de les
  respostes. El dispositiu mostra un avís ("Mira la pantalla per a
  veure la pregunta", clau `blind_hint`) i pinta només els `answerCount`
  botons actius amb la seua forma/color fixos per CSS (triangle verd,
  romb taronja, cercle blau, quadrat roig —
  `src/public/css/playerGameView.css:321-348`), sense text visible.
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
  (`playersAnswered === playerNum.length`, `src/server/sockets/playerEvents.js:247`)
  i mostra resultats.
- Si s'acaba el temps, l'amfitrió emet `timeUp` i el servidor fa el
  mateix (`src/server/sockets/common.js:71-93`).

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
