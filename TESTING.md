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

No hi ha script `start` ni `dev` en `package.json` encara — vore
`docs/DEV_DOCKER_SETUP.md` per a una proposta (encara sense implementar)
d'entorn de desenvolupament amb recàrrega automàtica.

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
| `npm test` | `node --test "test/**/*.test.js"` (tot: unit + integració) | No | — |
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
  `sessionReport.test.js`, i els més recents `auth-migration.test.js` i
  `authentik.test.js` (migració de comptes a Authentik).
- **`test/browser/`** — tests de navegador amb Playwright: `language.spec.js`
  (canvi d'idioma) i el més recent `auth-state.spec.js` (estat de sessió
  després de la migració a Authentik).

### Scripts puntuals que NO són part del flux de test estàndard

Estos no s'executen amb `npm test` ni en la CI; són ferramentes manuals
per a tasques concretes d'administració/migració, no proves automàtiques:

- `scripts/configure-authentik-migration.py` — configura la migració de
  comptes a Authentik.
- `scripts/test-authentik-google-verification.py` — verifica manualment
  la vinculació de Google dins d'Authentik.
- `scripts/normalize-tags.js` (`npm run normalize-tags`) — normalitza
  etiquetes de qüestionaris existents en la base de dades.

## Proves manuals en el navegador

Per a comprovar un canvi "a ull" després d'arrancar el servidor
(vore [Arrancar l'app](#arrancar-lapp-per-a-provar-la-a-mà)):

- **Crear/editar un qüestionari**: `http://localhost:3000/create/`
- **Jugar a l'aula** (amfitrió + diversos dispositius/pestanyes com a
  jugador, el mode real de classe): botó "Jugar a l'aula" des de la
  biblioteca → `/host/`, i unir-se des de `/join` amb el PIN. Vore el
  detall d'este i la resta de modes en
  [FEATURES.md → Modos de juego](FEATURES.md#modos-de-juego).
- **Multijugador** (pantalla compartida, 2-4 jugadors): botó
  "Multijugador" → `/multiplayer/`.
- **Solo** (mode individual): botó "Solo" → `/solo/`, o enllaços directes
  com `/solo/?id=<quizId>` o `/solo/?tag=musica` (vore `README.md`).

Per a provar canvis d'idioma, usar el selector d'idioma de la interfície o
afegir `?lang=va|es|en` a la URL.

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
