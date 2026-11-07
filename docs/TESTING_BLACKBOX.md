# Es poden automatitzar les proves de caixa negra?

El "Recorregut complet" de `TESTING.md`
(proves fetes "des de fora", com ho faria una persona usuària real, sense
mirar el codi) es pot automatitzar? Amb què, i amb quin esforç.

## Resum

Sí, amb **Playwright** — ja és una dependència del projecte i ja s'usa
(`npm run test:i18n`, fitxers en `src/test/browser/`). Però el projecte fa
servir hui un enfocament molt lleuger (simula les respostes del backend) que
no cobrix el joc en viu. Per a això caldria un segon enfocament, més pesat,
que encara no existix.

## Dos enfocaments molt distints, no un de sol

### 1. Enfocament actual: mockejar el backend sencer

`language.spec.js` i `auth-state.spec.js` **no arranquen el servidor Node**.
El `webServer` de `playwright.config.js` només servix els fitxers estàtics
de `public/` amb `python3 -m http.server`, sense Express, sense Socket.IO i
sense MongoDB.

Per a simular el backend, `auth-state.spec.js` intercepta cada petició amb
`page.route(...)`:

- Totes les crides a `/api/**` es responen a mà (`route.fulfill(...)`) amb
  un JSON fabricat — p. ex. `/api/auth/me` torna un usuari fals o un 401
  segons una variable local del test.
- `socket.io.js` (el script del client) es substituïx sencer per un objecte
  fals (`window.io = function(){ return { on(){}, emit(){}, ... } }`), que
  no es connecta a res de veritat.

Això és ràpid, no necessita Mongo ni cap servidor real, i és perfecte per a
provar **lògica de la interfície** que no depén del resultat real d'una
partida: canvi d'idioma i que persistisca, mostrar/amagar botons segons si
hi ha sessió, etc. És el que ja cobrixen `language.spec.js` i
`auth-state.spec.js`.

### 2. Enfocament que faria falta per al joc en viu: servidor real

Per a automatitzar "Jugar a l'aula" o "Multijugador" de veritat (amfitrió +
alumnat enviant-se esdeveniments de Socket.IO en viu, puntuació calculada en
temps real), el mock de dalt no val — cal:

- Arrancar el servidor Node de veritat (`server/server.js`), amb una
  MongoDB real al darrere. El projecte ja sap fer açò sense dependre d'un
  Mongo extern: els tests d'integració (`npm run test:integration`) ho fan
  amb `mongodb-memory-server` (vore `src/test/integration/api.test.js`).
  El mateix patró servix ací.
- Un `webServer` de Playwright distint (o un segon fitxer de configuració)
  que llance eixe servidor en lloc del `python3 -m http.server` actual.
- **Múltiples `BrowserContext` dins del mateix test**: Playwright permet
  obrir diverses "sessions de navegador" independents (una per l'amfitrió,
  una per cada alumne) dins d'un sol test, cada una amb les seues pròpies
  cookies i la seua pròpia connexió de Socket.IO — exactament el que fa
  falta per a simular una partida real amb diversos dispositius.

Este segon enfocament no existix encara en el projecte. És factible, però
és una inversió real: els tests serien més lents (arrancar servidor +
Mongo en cada execució) i més fràgils (dependre del cronòmetre, de l'orde
dels esdeveniments de Socket.IO) que els actuals.

## Què es pot automatitzar de cada part del recorregut

| Part del "Recorregut complet" | Amb el mock actual | Necessita servidor real |
|---|---|---|
| Crear/editar qüestionari | ✅ Sí, mockejant `/api/quizzes*` com ja fa `auth-state.spec.js` amb `/api/auth/me` | — |
| Jugar a l'aula (PIN, amfitrió + diversos dispositius) | ❌ No (necessita Socket.IO de veritat) | ✅ Sí |
| Multijugador | ❌ No | ✅ Sí |
| Solo | ⚠️ Parcial — és només HTTP (`/api/quizzes/:id/solo-run`, etc.), sense Socket.IO, així que es pot mockejar igual que l'auth | — |
| Informe CSV / exportació Moodle XML | ⚠️ No fa falta Playwright per a açò: ja és exactament el que proven `sessionReport.test.js` i `moodleExport.test.js` contra l'API real (amb Mongo en memòria) | — |
| Idiomes | ✅ Ja fet (`language.spec.js`) | — |
| Sessió i accés (tancar/obrir sessió) | ✅ Ja fet (`auth-state.spec.js`); un login real contra Google/Authentik no es pot automatitzar sense credencials de prova d'eixos proveïdors | — |
| Accessibilitat bàsica (contrast, navegació per teclat) | ✅ Es pot afegir amb `@axe-core/playwright` (no instal·lat encara) + `page.keyboard.press('Tab')` per a la navegació | — |

## Recomanació

No fer-ho tot de colp. Per ordre de cost/benefici:

1. **Accessibilitat automàtica**: afegir `@axe-core/playwright` i cridar-lo
   des de `language.spec.js`/`auth-state.spec.js` ja existents (mateix
   mock, cost mínim, detecta contrast i problemes d'ARIA de forma
   objectiva).
2. **Un sol camí feliç amb servidor real**: un test nou, en una
   configuració de Playwright a banda, que arranque `server.js` amb
   `mongodb-memory-server` (igual que `api.test.js`), òbriga dos
   `BrowserContext` (amfitrió + un alumne), jugue una partida curta d'una
   pregunta de cada tipus i comprove el resultat. Això ja cobriria la part
   que hui no té cap automatització (ni esta ni les altres).
3. Ampliar eixe camí feliç a més dispositius/multijugador només si l'anterior
   demostra que val la pena mantindre'l (són els tests més lents i fràgils
   de tota la suite).

Les proves manuals de `TESTING.md` no deixarien de fer falta: encara que
s'implementara tot l'anterior, el "Recorregut complet" seguiria sent el que
capta regressions que cap test automàtic cobrix (vore l'avís al final
d'eixa secció en `TESTING.md`).
