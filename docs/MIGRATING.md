# Proposta: separar responsabilitats i avaluar un framework de frontend

Document de treball per a migrar a un sistema més mantenible. Resumix el
deute tècnic actual d'EduHoot (monòlit sense separació de
responsabilitats) i si tindria sentit, una vegada resolt eixe deute,
introduir un framework de frontend — i quin.

## Índex

- [Contexte i motivació](#contexte-i-motivació)
- [Estat actual: sense separació de responsabilitats](#estat-actual-sense-separació-de-responsabilitats)
- [Pas previ (requisit): separar responsabilitats](#pas-previ-requisit-separar-responsabilitats)
- [Opcions de framework de frontend avaluades](#opcions-de-framework-de-frontend-avaluades)
  - [Què és un "build step"](#què-és-un-build-step)
  - [Vue amb CDN (Options API o `<script setup>` compilat en el navegador)](#vue-amb-cdn-options-api-o-script-setup-compilat-en-el-navegador)
- [Recomanació](#recomanació)
- [Impacte en el pipeline dev → stage → producció](#impacte-en-el-pipeline-dev--stage--producció)
- [Pròxims passos](#pròxims-passos)
- [Subfase A — Proposta concreta de separació](#subfase-a--proposta-concreta-de-separació)
  - [Arbre de directoris proposat](#arbre-de-directoris-proposat)
- [Subfase B — Proposta concreta d'implementació amb Vue](#subfase-b--proposta-concreta-dimplementació-amb-vue)
  - [Arbre de directoris proposat (Vue)](#arbre-de-directoris-proposat-vue)
- [Taula comparativa entre subfases](#taula-comparativa-entre-subfases)
- [Tests automàtics de la jugabilitat: què desbloqueja Vue i què no](#tests-automàtics-de-la-jugabilitat-què-desbloqueja-vue-i-què-no)

## Contexte i motivació

`POPULAR_FEATURES.md` (secció "Fase 0") ja marca separar
responsabilitats de `server.js` com a **requisit**, no com a millora
opcional, abans de seguir afegint mecàniques de joc de dificultat alta.
Esta proposta afig el costat del frontend a eixa mateixa idea, i respon
a la pregunta de si, una vegada feta eixa separació, valdria la pena
anar més enllà i introduir un framework (React/Vue/altres).

## Estat actual: sense separació de responsabilitats

No hi ha res paregut a MVC hui, ni en el backend ni en el frontend (vore
`ARCHITECTURE.md` → "Deute tècnic conegut"):

- **Backend**: `src/server/server.js` (5.123 línies) mescla, dins de la
  mateixa funció, anàlisi de la petició HTTP, lògica de negoci i accés
  directe a MongoDB amb el driver natiu. Només hi ha mòduls solts
  d'utilitats (`importCsv.js`, `questionUtils.js`, `authentikUsers.js`,
  `utils/liveGames.js`, `utils/players.js`, ~500 línies en total) — no
  són "controladors" en sentit MVC.
- **Frontend**: cada pàgina té el seu script (`create.js` ~4.184
  línies, `solo.js`, `multiplayer.js`, `quizCreator.js`, `hostGame.js`,
  `playerGame.js`) que mescla manipulació directa del DOM, lògica de
  partida i els listeners de Socket.IO, sense separació entre
  vista/estat/lògica.
- Tot això és JS vanilla servit directament per Express, **sense build
  step** (vore més avall què significa açò).

## Pas previ (requisit): separar responsabilitats

Abans de pensar en cap framework, el que de veritat resol el problema de
mantenibilitat a curt termini és partir el monòlit en mòduls amb
responsabilitats més acotades — sense canviar de tecnologia:

- Backend: separar rutes HTTP, lògica de Socket.IO, càlcul de
  puntuació, generació de CSV/Moodle XML i accés a dades en fitxers
  propis dins de `src/server/` (seguint el patró que ja existix amb
  `importCsv.js` o `questionUtils.js`, però aplicat a tota la resta).
- Frontend: dividir els fitxers més grans (`create.js`, `solo.js`) en
  mòduls més petits per responsabilitat (p. ex. estat de la partida,
  renderitzat del DOM, listeners de socket), igual en JS vanilla, sense
  introduir encara cap framework.

Això és barat, reversible, i no toca el pipeline de dev/stage/producció
en absolut. És el pas que desbloqueja poder seguir afegint
funcionalitat (Fase 2 en avant de `POPULAR_FEATURES.md`) sense seguir
agreujant el problema.

## Opcions de framework de frontend avaluades

| Opció | Necessita build step? | Com s'adoptaria | Nivell de canvi |
|---|---|---|---|
| **Alpine.js** | No | Reactivitat declarativa directament sobre l'HTML ja existent (`x-data`, `x-on`); es pot anar ficant pàgina a pàgina sense reescriure res. | Mínim |
| **Vue** | No, si s'usa via CDN (Options API o `<script setup>` compilat en el navegador) | Igual que Alpine, però amb més estructura per component/pàgina; adopció incremental. | Baix-mitjà |
| **Svelte** | Sí | Compila a JS vanilla molt lleuger (sense runtime de framework pel mig); reactivitat que encaixa bé amb "actualitzar la pantalla quan arriba un esdeveniment de socket". | Mitjà (exigix acceptar un build step) |
| **React** | Sí | JSX + bundler obligatoris en la pràctica habitual; el salt d'arquitectura és més brusc. | Alt |

### Què és un "build step"

Un **build step** és un pas que convertix el
codi font que s'escriu en el contingut que realment es servix al navegador,
abans de poder executar-lo.

**Hui EduHoot no en té cap**: els fitxers de `src/public/js/` són JS tal
qual, servits directament per Express, carregats amb una simple etiqueta
`<script src="...">`. S'edita el fitxer, es recarrega la pàgina, i ja
està.

Amb React (i també amb Svelte en la seua forma
habitual) cal una ferramenta que:

1. Traduïsca sintaxi que el navegador no entén de forma nativa (fitxers propis del framework triat) a JS normal.
2. Junte (bundle) desenes de mòduls en un o pocs fitxers optimitzats.
3. Sovint minifique el codi i gestione els imports de dependències
   (`node_modules`, molts fitxers de llibreries node.js).

Això implica: una orde (`npm run build`) que cal executar cada vegada
que canvia alguna cosa per a veure el resultat (o un mode "watch" que
ho fa automàticament), una carpeta d'eixida (`dist/`) distinta del codi
font, i una peça més en el pipeline de desplegament que **hui no existix**.

Hi ha opcions que **eviten** este pas afegit: carregar la llibreria ja
compilada des d'un CDN amb `<script>`, igual que ara, i escriure
components JS. Açò és clau per a la recomanació d'ací baix.

### Vue amb CDN (Options API o `<script setup>` compilat en el navegador)

Esta frase junta tres idees de Vue que convé separar:

- **"Via CDN"**: en lloc d'instal·lar Vue amb `npm install` i passar-lo
  per un bundler, es carrega directament amb una etiqueta
  `<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js">`,
  igual que hui ja es carreguen altres llibreries en EduHoot. El
  navegador descarrega eixe fitxer i ja té Vue disponible — zero
  instal·lació, zero build step.
- **"Options API"**: és la manera "clàssica" d'escriure un component de
  Vue, com un objecte JavaScript normal amb propietats `data`,
  `methods`, `computed`, etc. No cal cap sintaxi especial ni fitxer
  `.vue` — es pot escriure en un `.js` normal, exactament com ja es fa
  en `create.js` o `solo.js` hui, però amb Vue gestionant la reactivitat
  (quan canvia una dada, Vue actualitza el DOM sol, sense haver
  d'escriure a mà el codi que actualitza cada tros de pantalla).
- **"`<script setup>` compilat en el navegador"**: `<script setup>` és
  la sintaxi més moderna i compacta de Vue (normalment dins d'un fitxer
  `.vue`), que **sol** necessitar un build step perquè el navegador no
  entén els fitxers `.vue` de forma nativa. Però Vue té una versió del
  seu compilador (`@vue/compiler-sfc`) que pot executar-se **dins del
  navegador en temps real**, traduint eixe component just abans de
  pintar-lo. És una alternativa poc habitual i una miqueta més lenta en
  carregar que un build fet per avant, però evita instal·lar cap
  ferramenta nova.

En resum: per a EduHoot, l'opció realista i sense complicacions seria
**Vue via CDN amb Options API** (el primer punt combinat amb el segon),
escrivint els components com a objectes JS normals, sense arribar a
necessitar mai `<script setup>` ni fitxers `.vue`.

El projecte és de **pàgines separades per ruta** (`create`, `host`,
`player`, `solo`, `multiplayer`), no una SPA amb routing — la
complexitat real està en l'estat que arriba per Socket.IO, no en la
navegació entre vistes. Açò pesa a favor de les opcions que no exigixen
reescriure l'arquitectura completa de l'aplicació per a adoptar-les.

## Recomanació

**Aposta per Vue** (via CDN, amb Options API, sense build
step), no per Alpine.js ni pels altres. Motius concrets:

- **Les pantalles d'EduHoot no són "sprinkles" d'interactivitat, són
  estat complex de llarga duració.** Alpine.js està pensat per a coses
  acotades (un desplegable, un modal, un formulari). Però
  `hostGame.js`, `playerGame.js`, `solo.js` i `multiplayer.js` gestionen
  tot el cicle d'una partida (lobby → pregunta → resultats → següent
  pregunta → rànquing final) amb moltes variables interrelacionades que
  canvien en temps real per Socket.IO. El sistema de reactivitat
  complet de Vue (`computed`, `watch`, components amb el seu propi
  estat) encaixa amb això molt millor que el model minimalista d'Alpine,
  que és precisament el seu límit per disseny.
- **Vue té marge de creixement; Alpine no.** Si en el futur es fan
  realitat propostes de `POPULAR_FEATURES.md` que afegixen complexitat
  d'interfície (mode autoritme, nous tipus de pregunta, mode
  presentació híbrid), Vue té un ecosistema ampli (Vue Router, Pinia,
  DevTools, llibreries de components) al qual recórrer sense haver de
  canviar de framework una altra vegada. Alpine.js no té eixe camí de
  creixement: és deliberadament senzill i es quedaria curt.
- **La corba d'aprenentatge és semblant a la d'Alpine, però amb molt
  més poder expressiu.** Vue amb Options API s'escriu com un objecte JS
  normal (`data`, `methods`, `computed`), molt paregut a com ja estan
  organitzades les funcions en `create.js`/`solo.js` hui — no és un
  salt conceptual gran per a qui ja coneix el codi actual. A canvi,
  dona components reutilitzables amb props/events/slots, que és
  justament el que fa falta per a la separació de responsabilitats que
  és l'objectiu d'este document.
- **Millors ferramentes de depuració.** Vue Devtools (extensió de
  navegador) permet inspeccionar l'estat dels components en viu —
  valuós per a depurar problemes de sincronització d'estat en partides
  en directe. Alpine no té un equivalent tan madur.
- **No es perd l'avantatge clau que feia atractiu Alpine.js.** Vue via
  CDN amb Options API manté exactament el mateix benefici central
  d'Alpine (zero impacte en el pipeline de dev/stage/producció, vore
  secció següent) — és "igual de fàcil d'adoptar, però amb molta més
  capacitat de créixer".

**Svelte i React queden descartats** per a l'abast d'esta proposta: Svelte
exigiria acceptar un build step des del principi, i React, a més
d'exigir-lo, suposa el salt d'arquitectura més brusc dels quatre.

### Alpine.js com a pas previ a Vue?

No compensa. Vue via CDN amb Options API ja té el mateix cost
d'adopció que Alpine (zero build step, sintaxi d'objecte JS normal,
pàgina a pàgina), així que fer Alpine primer només duplicaria la faena:
aprendre les seues directives (`x-data`, `x-on`) i després reescriure-les
en Vue quan arribe el moment, sense guanyar res a canvi.

L'única versió amb sentit seria com a **elecció permanent** per a
widgets aïllats (un desplegable, un modal puntual) mentre Vue gestiona
les pantalles de partida — però mantindre dos paradigmes de reactivitat
a la vegada xoca amb la senzillesa que busca este projecte amb poca
gent mantenint-lo. La prova acotada de Vue ja proposada en una sola
pantalla (pas 2 de "Pròxims passos") dona la mateixa validació de baix
risc sense passar per Alpine.

## Impacte en el pipeline dev → stage → producció

**Amb l'opció proposada (Vue via CDN, sense build step): impacte nul.**
Es continua servint tot igual que ara; no cal tocar
`docs/DEV_DOCKER_SETUP.md`, `STAGE_SETUP.md` ni `docs/DOCKER.md`.

*Però, **si s'elegix una opció amb build step -Svelte, React-,** l'impacte és real en els tres entorns*:

| | Desenvolupament (dev) | Preproducció (stage) | Producció |
|---|---|---|---|
| **Què canvia** | Cal fer córrer el bundler en mode watch (p. ex. servidor de desenvolupament de Vite amb HMR) junt al backend (`node --watch`) — dos processos en lloc d'un. | `scripts/deploy-stage.sh` hauria d'executar `npm run build` abans de reiniciar el servici, i Express passaria a servir `dist/` en lloc de `public/js/` directament. | El `Dockerfile` de producció (que hui fa `npm ci --omit=dev`, sense devDependencies) necessitaria convertir-se en un **build multi-stage**: una fase amb devDependencies que execute `npm run build`, i una fase final que només copie el `dist/` resultant — patró estàndard de Docker, però nou ací. |
| **Documents a actualitzar** | `docs/DEV_DOCKER_SETUP.md` (encara ni implementat) necessitaria un segon servici o procés per al bundler. | `STAGE_SETUP.md`, punt 5 (desplegar a stage). | `docs/DOCKER.md` (publicació d'imatge) i, si aplica, `scripts/deploy.example.sh`. |
| **Risc** | Baix (entorn d'un sol desenvolupador). | Mitjà (és justament l'entorn pensat per a detectar este tipus de problema abans de producció). | Mitjà-alt si no es prova abans a fons en stage — és l'entorn real dels centres. |

Esta taula és, en si mateixa, part de l'argument a favor de Vue via CDN
sense build step: permet avaluar el benefici de "tindre reactivitat
declarativa" sense pagar el cost de tocar els tres entorns del pipeline
a la vegada.

## Pròxims passos

1. Plantejar la separació de responsabilitats (backend i
   frontend) com a pas 0, independent de qualsevol framework.
2. Realitzar una prova acotada amb Vue (via
   CDN, Options API) en una sola pantalla (p. ex. el lobby de
   `host.js`) abans de decidir si s'estén a la resta.
3. Revisar esta nota junt amb `ARCHITECTURE.md` (deute tècnic) i
   `POPULAR_FEATURES.md` (Fase 0) perquè les tres fonts queden
   coherents.

## Subfase A — Proposta concreta de separació

Una divisió possible de `server.js` (5.123 línies) en mòduls per
responsabilitat, sense canviar cap comportament ni tecnologia — només
moure codi:

- **`routes/`** — rutes HTTP, agrupades per recurs (quizzes, partides en
  directe, autenticació, Edutictac ID/Commons, administració).
- **`sockets/`** — gestors d'esdeveniments de Socket.IO, separats entre
  els que llança l'amfitrió i els que llança l'alumnat.
- **`services/`** — lògica de negoci pura (càlcul de puntuació,
  exportació a Moodle XML, generació de l'informe CSV, gestió de
  sessions), sense dependre d'Express ni de Socket.IO directament.
- **`data/`** — accés a MongoDB (connexió i una funció per col·lecció),
  perquè `services/` i `routes/` no criden mai `dbInstance.collection(...)`
  directament.
- `server.js` queda com a **punt d'entrada mínim**: configura Express,
  monta els routers, arranca Socket.IO i prou.

El mateix principi s'aplicaria als fitxers més grans del frontend
(`create.js`, `solo.js`): separar l'orquestador de la pàgina de la
lògica d'estat, el renderitzat del DOM i les exportacions (CSV/Moodle
XML), cada cosa en el seu propi mòdul, sense introduir encara cap
framework.

### Arbre de directoris proposat

```
src/server/
├── server.js                  # punt d'entrada: Express + Socket.IO, monta tot açò
├── routes/
│   ├── quizzes.js              # CRUD de qüestionaris, exportació Moodle XML
│   ├── games.js                 # partides en directe, informe CSV
│   ├── auth.js                   # Google / Authentik / correu+contrasenya, reset
│   ├── playerAuth.js               # Edutictac ID / Commons
│   └── admin.js                     # rutes d'administració
├── sockets/
│   ├── index.js                # registre de tots els handlers
│   ├── hostEvents.js            # host-join, startGame, nextQuestion, skipQuestion, newQuiz
│   ├── playerEvents.js           # player-join, playerAnswer
│   └── common.js                  # disconnect, getScore, requestDbNames, time, timeUp
├── services/
│   ├── scoring.js              # calculateQuestionScore, getSubmissionScoreRatio
│   ├── moodleExport.js          # quizToMoodleXml
│   ├── sessionReport.js          # generació del CSV d'informe
│   └── sessions.js                # Map de sessions HTTP, cookies
├── data/
│   ├── db.js                   # connexió a MongoDB
│   └── repositories.js          # una funció d'accés per col·lecció
├── utils/                      # ja existent: liveGames.js, players.js
├── importCsv.js                # ja existent
├── questionUtils.js            # ja existent
└── authentikUsers.js           # ja existent

src/public/js/
├── create/
│   ├── index.js                # orquestador de la pàgina (abans create.js)
│   ├── library.js                # llistat/targetes de qüestionaris
│   ├── quizActions.js             # duplicar, esborrar, llançar modes
│   └── exports.js                   # descàrrega CSV / Moodle XML
└── solo/
    ├── index.js                # orquestador de la pàgina (abans solo.js)
    ├── gameState.js              # estat de la partida individual
    ├── render.js                   # pintat del DOM
    └── stats.js                      # rànquing/estadístiques
```

Cap d'estos noms és definitiu — l'objectiu de l'arbre és fer visible la
mida del canvi (quants fitxers nous, de quina grandària aproximada) més
que fixar l'estructura final exacta.

## Subfase B — Proposta concreta d'implementació amb Vue

Esta secció només afecta al **frontend**; el backend ja queda resolt amb
la separació de la Subfase A (`routes/`, `sockets/`,
`services/`, `data/`) — Vue es monta sobre eixos mateixos endpoints i
esdeveniments de Socket.IO, sense tocar-los.

Com s'integraria, sense build step:

- Cada pàgina (`create`, `solo`, i després `host`/`player`) arranca una
  app Vue amb `Vue.createApp({...}).mount('#app')`, cridat des del
  mateix `index.js` que hui arranca eixa pàgina.
- Els components **no són fitxers `.vue`** (açò exigiria build step):
  són objectes JS normals (Options API) que referencien una plantilla
  ja present en l'HTML existent, amb `template: '#el-seu-id'`. L'HTML
  de cada pàgina es manté quasi igual, només s'afigen etiquetes
  `<template>` noves per cada component.
- La lògica que hui ja existix (crides `fetch` als endpoints, listeners
  de Socket.IO) es mou als mateixos mòduls que ja proposa la Subfase A
  — no se'n creen de nous només pel canvi de framework.

Per a que es puga comparar directament amb la Subfase A, l'arbre
d'ací baix manté **exactament els mateixos fitxers i la mateixa forma**
(backend intacte, mateixos noms en `create/` i `solo/`); l'única
diferència és què conté cada fitxer per dins (un component Vue en lloc
d'un grup de funcions).

### Arbre de directoris proposat (Vue)

```
src/server/                   # = Subfase A, sense cap canvi (Vue no toca el backend)

src/public/js/create/
├── index.js                    # abans: orquestador pla → ara: Vue.createApp({...}).mount('#app')
├── library.js                   # abans: funcions de llistat/targetes → ara: component Vue (mateixa responsabilitat)
├── quizActions.js                # abans: funcions de duplicar/esborrar/llançar → ara: mètodes del component
└── exports.js                      # abans: funcions de descàrrega CSV/Moodle XML → ara: component amb els mateixos botons

src/public/js/solo/
├── index.js                    # abans: orquestador pla → ara: Vue.createApp({...}).mount('#app')
├── gameState.js                  # abans: objecte d'estat pla → ara: estat reactiu (Vue.reactive)
├── render.js                       # ja no cal escriure'l a mà: Vue actualitza el DOM sol a partir de l'estat
└── stats.js                          # abans: funcions de rànquing/estadístiques → ara: component Vue
```

`host/`, `player/` i `multiplayer/` seguirien el mateix patró (els
mateixos fitxers que ja proposaria la Subfase A per a eixes pàgines,
convertits en components Vue).

Cap d'estos noms és definitiu, igual que en l'arbre de la Subfase A —
l'objectiu és que els dos arbres es puguen llegir fitxer a fitxer, un
davall de l'altre, per a veure exactament què canvia i què no.

## Taula comparativa entre subfases

| | Subfase A — separar en mòduls plans | Subfase B — Vue sobre eixa separació |
|---|---|---|
| **Abast** | Backend (`src/server/`) + frontend (`create/`, `solo/`...) | Només frontend; reutilitza el backend de la Subfase A sense tocar-lo |
| **Tecnologia** | JS vanilla, la mateixa de sempre | Vue 3 (via CDN, Options API) |
| **Build step** | No | No |
| **Canvi en l'HTML existent** | Cap | S'afigen etiquetes `<template>` noves; la resta es manté igual |
| **Patró de fitxers** | Un fitxer = un grup de funcions amb una responsabilitat | Els mateixos fitxers; cada un passa a ser un component Vue (data + methods + template) |
| **Relació entre ambdues** | És la base; no depén de res més | Parteix dels mateixos noms i responsabilitats de la Subfase A — `render.js` deixa de fer falta perquè Vue ho fa sol |
| **Impacte en dev/stage/producció** | Cap | Cap |
| **Risc** | Baix (moure codi, sense canviar comportament) | Baix-mitjà (nova dependència en temps d'execució, corba d'aprenentatge de Vue) |
| **Esforç estimat** | Mitjà (reorganitzar ~5.600 línies sense canviar lògica) | Mitjà-alt (reescriure la interacció de cada pantalla amb el patró de Vue) |
| **Reversibilitat** | Alta (és només moure codi) | Mitjana (desfer-ho implica tornar a JS pla) |
| **Es pot fer sense l'altra?** | Sí, és un requisit independent | No té sentit sense la Subfase A feta primer |
| **Benefici principal** | Mantenibilitat: localitzar i tocar codi sense rellegir tot `server.js`/`create.js` | Reactivitat declarativa: **s'acaba per sempre el codi manual per a sincronitzar la pàgina**. Canvia una dada i Vue repinta sol, a l'instant, exactament el que toca — adeu als bugs de "la pantalla no s'ha actualitzat" i a les desenes de línies que hui calen en `hostGame.js`/`playerGame.js` per a actualitzar a mà cada número, cada targeta i cada rànquing. |
| **Temps estimat d'implementació** | Uns **2-3 dies de treball**: extracció per blocs (`routes/`, `sockets/`, `services/`, `data/` al backend, i els mateixos 4 fitxers en `create/`/`solo/`), verificant amb `npm test` i `npm run lint` després de cada bloc | Uns **3-5 dies** per a la prova acotada en `create/` i `solo/` (disseny dels components + verificació manual en navegador, ja que no hi ha tests automàtics de la jugabilitat); més si s'estén després a `host/`/`player/`/`multiplayer/` |

## Tests automàtics de la jugabilitat: què desbloqueja Vue i què no

Esta aclaració és rellevant per a la fila de "Temps estimat" de dalt, on
la Subfase B necessita verificació manual en navegador. Hi ha dos nivells
de test:

### 1. Tests de component — açò sí que ho desbloqueja Vue

Amb components Vue, es pot usar **Vue Test Utils** junt amb un runner com
Vitest o Jest per a muntar un component aïllat (p. ex. `Question.js`)
amb unes props/estat concrets i comprovar què pinta, sense necessitar
navegador real ni servidor ni Socket.IO. Açò és el que hui és
pràcticament impossible de fer net amb `playerGame.js`, perquè la
lògica de pintat està mesclada amb els listeners de socket en la
mateixa funció.

Important: açò és ferramenta de test, només per a desenvolupament — no
afig cap build step a producció, no contradiu l'argument d'este
document sobre el pipeline dev/stage/producció.

### 2. Tests d'extrem a extrem d'una partida completa — açò ja és possible hui, sense Vue

Orquestar un test amb l'amfitrió i diversos jugadors a la vegada,
contra un Socket.IO real, **ja és possible hui** amb JS vanilla, amb
Playwright i diversos "browser contexts" en el mateix test — el mateix
mecanisme que ja usa `test/browser/auth-state.spec.js`, però obrint
diverses pestanyes a la vegada en lloc d'una sola.

El motiu de que hui `TESTING.md` només cobrisca i18n i auth-state no és
una limitació tècnica del JS vanilla: és que encara no s'han escrit,
pel propi esforç d'orquestrar diversos clients en temps real. Vue no
desbloqueja ni bloqueja açò — l'únic que ajuda és que, en tindre
marcatge més estructurat per component, els selectors del test
(`data-testid`, etc.) solen ser més estables i fàcils de mantindre que
buscar nodes solts de l'DOM actual.

**En resum**: si la prioritat és tindre tests de veritat de la
jugabilitat d'extrem a extrem, això es pot abordar ja mateix,
independentment de Vue. El que Vue afig de nou és la possibilitat de
testejar cada peça d'interfície per separat, de forma ràpida i sense
navegador.
