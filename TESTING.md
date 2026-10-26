# Com provar canvis en desenvolupament

Document únic amb tot el necessari per a provar un canvi en EduHoot abans
de donar-lo per bo: com arrancar l'app, quines ordes de test existeixen,
què cobrix cada una, i com provar manualment cada mode de joc en el
navegador.

Totes les ordes s'executen des de `src/`.

## Resum ràpid

```bash
cd src
npm ci                                      # o npm install
npx playwright install --with-deps chromium # només la primera vegada / després d'actualitzar Playwright
npm run lint                                # comprovació de sintaxi
npm test                                    # tests unitaris + integració
npm run test:i18n                           # tests de navegador (Playwright)
```

Este és també l'orde exacte que usa la CI de GitHub Actions
(`.github/workflows/tests.yml`, amb Node 24).

## Arrancar l'app per a provar-la a mà

1. MongoDB funcionant en `127.0.0.1:27017` (`sudo systemctl start mongod`), o
   `MONGO_URL` apuntant a una altra instància.
2. `cd src && npm install`
3. `node server/server.js`
4. Obrir `http://localhost:3000/create/`.

Alternativa amb recàrrega automàtica i sense instal·lar Node ni MongoDB
en local: vore `docs/DEV_DOCKER_SETUP.md` (`docker compose up`), que a
més carrega 5 qüestionaris de mostra.

## Tests automàtics

> **Què és Playwright?** És una ferramenta de Microsoft per a provar
> aplicacions web automatitzant un navegador real (en este projecte,
> Chrome) sense que ningú haja de fer clic a mà: obri la pàgina, navega,
> emplena camps, prem botons i comprova que allò que apareix en pantalla
> és l'esperat. A diferència de `npm test` (que prova funcions i l'API
> del servidor directament), Playwright prova l'aplicació "des de fora",
> igual que la veuria una persona real usant el navegador. En EduHoot
> s'usa només per a `npm run test:i18n` (canvi d'idioma i estat de
> sessió), executant cada test dos vegades: una emulant escriptori i
> l'altra emulant un mòbil (`src/playwright.config.js`).

| Orde | Què executa | Necessita Mongo real | Necessita alguna cosa més |
|---|---|---|---|
| `npm test` | `node --test test/unit/*.test.js test/integration/*.test.js` (tot: unit + integració) | No | — |
| `npm run test:unit` | Només `test/unit/*.test.js` | No | — |
| `npm run test:integration` | Només `test/integration/*.test.js` | No | — |
| `npm run test:i18n` | `playwright test` sobre `test/browser/*.spec.js` | No | `npx playwright install --with-deps chromium`, i `python3` en el `PATH` |
| `npm run lint` | `node scripts/lint.js`: recorre `server/` i `public/js/` i valida la sintaxi de cada fitxer amb `node --check` | No | — |

Cap dels tests (`test`, `test:unit`, `test:integration`, `test:i18n`)
requerix un Mongo real: `test/integration/*.test.js` alça un Mongo en
memòria amb `mongodb-memory-server` (devDependency) i arranca el servidor
Express en un port aleatori (`app.listen(0)`). `test:i18n` ni tan sols
arranca el servidor Node: Playwright servix els estàtics de `public/` amb
`python3 -m http.server 18090` (vore `src/playwright.config.js`), amb dos
projectes de navegador — `desktop` (Chrome d'escriptori) i `mobile`
(emulació Pixel 7).

`lint` **no** és ESLint ni un linter d'estil: és un script propi mínim
que només comprova que cada fitxer JS del backend (`server/`) i del
frontend (`public/js/`) tinga sintaxi vàlida (`node --check`). No detecta
problemes d'estil, variables sense usar, etc.

### Què cobrix cada carpeta de test

- **`test/unit/`** — lògica aïllada sense servidor HTTP: idiomes
  (`language.test.js`), importació de CSV (`importCsv.test.js`), gestió
  de jugadors (`players.test.js`), utilitats de preguntes
  (`questionUtils.test.js`), partides en directe (`liveGames.test.js`).
- **`test/integration/`** — alça el servidor Express real (amb Mongo en
  memòria) i prova l'API HTTP d'extrem a extrem: `api.test.js`,
  `sessionReport.test.js`, `auth-migration.test.js` i `authentik.test.js`
  (migració de comptes a Authentik), `commonsUrl.test.js` (el xip apunta al
  Commons de `EDUTICTAC_COMMONS_URL`), i `devLogin.test.js` /
  `devLoginOff.test.js` (`/dev/login` funciona en desenvolupament i dona 404
  fora d'ell).
- **`test/browser/`** — tests de navegador amb Playwright: `language.spec.js`
  (canvi d'idioma), `auth-state.spec.js` (estat de sessió i pont amb el xip),
  `solo-poll.spec.js` (les preguntes d'enquesta en mode Solo no compten com a
  error ni puntuen) i `chip-footer.spec.js` (xip de compte i peu comú).

### Scripts puntuals que NO són part del flux de test estàndard

Estos no s'executen amb `npm test` ni en la CI; són ferramentes manuals
per a tasques concretes d'administració/migració, no proves automàtiques:

- `scripts/configure-authentik-migration.py` — configura la migració de
  comptes a Authentik.
- `scripts/test-authentik-google-verification.py` — verifica manualment
  la vinculació de Google dins d'Authentik.
- `scripts/normalize-tags.js` (`npm run normalize-tags`) — normalitza
  etiquetes de qüestionaris existents en la base de dades.

## Proves de caixa negra (al navegador)

Proves fetes "des de fora", com ho faria una persona usuària real,
**sense mirar el codi** — a diferència de les automàtiques i de
`npm run lint`, que sí coneixen l'estructura interna. Totes es fan amb
l'app alçada (vore [Arrancar l'app](#arrancar-lapp-per-a-provar-la-a-mà)
o `docs/DEV_DOCKER_SETUP.md` si vols partir ja amb 5 qüestionaris i 5
usuaris de mostra carregats). Sobre si estes proves es poden
automatitzar i amb què, vore `docs/TESTING_BLACKBOX.md`.

**Accés ràpid a cada mode**, per a comprovar un canvi puntual sense fer
el recorregut complet de baix:

- **Crear/editar un qüestionari**: `http://localhost:3000/create/`
- **Jugar a l'aula** (amfitrió + diversos dispositius/pestanyes com a
  jugador, el mode real de classe): botó "Jugar a l'aula" des de la
  biblioteca → `/host/`, i unir-se des de `/join` amb el PIN. Vore el
  detall d'este i la resta de modes en
  [ARCHITECTURE.md → Modes de joc](ARCHITECTURE.md#modes-de-joc).
- **Multijugador** (pantalla compartida, 2-4 jugadors): botó
  "Multijugador" → `/multiplayer/`.
- **Solo** (mode individual): botó "Solo" → `/solo/`, o enllaços directes
  com `/solo/?id=<quizId>` o `/solo/?tag=musica` (vore `README.md`).
- Per a provar canvis d'idioma: selector d'idioma de la interfície, o
  afegir `?lang=va|es|en` a la URL.

**Recorregut complet**, per a validar tot el projecte de dalt a baix
abans de publicar un canvi gran o etiquetar una versió — capta
regressions que cap test automàtic ni comprovació puntual cobrix:

1. **Biblioteca i creació** (`/create/`):
   - Crear un qüestionari nou amb almenys una pregunta de cada tipus
     (`quiz`, `multiple`, `true-false`, `short-answer`, `numeric`,
     `poll`) — vore `ARCHITECTURE.md` si cal recordar què és cada u.
   - Editar-lo, afegir etiquetes, canviar la visibilitat
     (privat/no llistat/públic), clonar-lo i esborrar el clon.
   - Pujar un qüestionari per CSV (vore `README.md`).
2. **Jugar a l'aula** (mode classe, amb PIN): llançar la partida des de
   la biblioteca, unir-se amb almenys dos dispositius/pestanyes com a
   alumnat des de `/join`, respondre totes les preguntes (cada tipus
   inclòs), comprovar el compte arrere, l'avanç manual entre preguntes,
   el rànquing final i la celebració d'encert/fallada col·lectiva.
3. **Multijugador** (pantalla compartida, 2-4 jugadors): jugar una
   partida sencera des d'un sol dispositiu.
4. **Solo**: jugar amb un enllaç directe (`/solo/?id=<quizId>` o
   `/solo/?tag=...`), comprovar que les preguntes d'enquesta no obrin
   el diàleg d'error ni puntuen, i que l'estadística final i el
   rànquing global es mostren bé.
5. **Informe i exportació**: des de "Jugar a l'aula", descarregar
   l'informe CSV de la partida i comprovar que les columnes tenen
   sentit; exportar el qüestionari a Moodle XML i comprovar que
   s'importa sense error en un Moodle/AULES de prova (si n'hi ha a
   l'abast).
6. **Idiomes**: canviar entre els 4 idiomes disponibles (català,
   valencià, castellà, anglés) amb el selector de la interfície, i
   comprovar que el canvi persistix en recarregar i en navegar entre
   `/create/`, `/host/`, `/join`, `/solo/` i `/multiplayer/`.
7. **Sessió i accés**: tancar sessió i tornar a entrar; si hi ha Google
   o Authentik configurats en l'entorn de prova, provar també eixos
   fluxos d'inici de sessió.
8. **Accessibilitat bàsica**: comprovar que les respostes es distingixen
   per forma a més de color, i navegar almenys una pantalla amb només
   el teclat — vore `docs/ACCESSIBILITY.md` per a l'abast complet.

Si algun pas d'estos falla o es comporta de manera inesperada, és un
senyal fiable encara que els tests automàtics donen tots en verd — el
recorregut complet és el que capta regressions que cap test aïllat
cobrix.

## Abans d'etiquetar una versió (checklist)

Equivalent a allò que feien les seccions "Comprovacions" de
`RELEASE-1.0.2.md`/`RELEASE-1.0.5.md`, però com a referència única i
reutilitzable per a qualsevol versió futura:

```bash
cd src
npm ci
npx playwright install --with-deps chromium
npm run lint
npm test
npm run test:i18n
npm audit
```

Si el canvi afecta a sessions/autenticació, executar també de forma
manual el flux de login afectat (Google, Authentik) en local abans de
publicar, ja que els tests automàtics d'`authentik.test.js`/
`auth-state.spec.js` cobrixen casos concrets, no tota la superfície de la
interfície.
