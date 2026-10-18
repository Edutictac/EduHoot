# Cómo probar cambios en desarrollo

Documento único con todo lo necesario para probar un cambio en EduHoot
antes de darlo por bueno: cómo arrancar la app, qué comandos de test existen,
qué cubre cada uno, y cómo probar manualmente cada modo de juego en el
navegador. 

Todos los comandos se ejecutan desde `src/`.

## Resumen rápido

```bash
cd src
npm ci                                      # o npm install
npx playwright install --with-deps chromium # solo la primera vez / tras actualizar Playwright
npm run lint                                # comprobación de sintaxis
npm test                                    # tests unitarios + integración
npm run test:i18n                           # tests de navegador (Playwright)
```

Este es también el orden exacto que usa la CI de GitHub Actions
(`.github/workflows/tests.yml`, con Node 24).

## Arrancar la app para probarla a mano

1. MongoDB corriendo en `127.0.0.1:27017` (`sudo systemctl start mongod`), o
   `MONGO_URL` apuntando a otra instancia.
2. `cd src && npm install`
3. `node server/server.js`
4. Abrir `http://localhost:3000/create/`.

No hay script `start` ni `dev` en `package.json` todavía — ver
`docs/DOCKER_HOWTO.md` para una propuesta (aún sin implementar) de entorno de
desarrollo con recarga automática.

## Tests automáticos

> **¿Qué es Playwright?** Es una herramienta de Microsoft para probar
> aplicaciones web automatizando un navegador real (en este proyecto,
> Chrome) sin que nadie tenga que hacer clic a mano: abre la página,
> navega, rellena campos, pulsa botones y comprueba que lo que aparece en
> pantalla es lo esperado. A diferencia de `npm test` (que prueba funciones
> y la API del servidor directamente), Playwright prueba la aplicación
> "desde fuera", igual que la vería una persona real usando el navegador.
> En EduHoot se usa solo para `npm run test:i18n` (cambio de idioma y
> estado de sesión), ejecutando cada test dos veces: una emulando escritorio
> y otra emulando un móvil (`src/playwright.config.js`).

| Comando | Qué ejecuta | Necesita Mongo real | Necesita algo más |
|---|---|---|---|
| `npm test` | `node --test "test/**/*.test.js"` (todo: unit + integration) | No | — |
| `npm run test:unit` | Solo `test/unit/*.test.js` | No | — |
| `npm run test:integration` | Solo `test/integration/*.test.js` | No | — |
| `npm run test:i18n` | `playwright test` sobre `test/browser/*.spec.js` | No | `npx playwright install --with-deps chromium`, y `python3` en el `PATH` |
| `npm run lint` | `node scripts/lint.js`: recorre `server/` y `public/js/` y valida la sintaxis de cada fichero con `node --check` | No | — |

Ninguno de los tests (`test`, `test:unit`, `test:integration`, `test:i18n`)
requiere un Mongo real: `test/integration/*.test.js` levanta un Mongo en
memoria con `mongodb-memory-server` (devDependency) y arranca el servidor
Express en un puerto aleatorio (`app.listen(0)`). `test:i18n` ni siquiera
arranca el servidor Node: Playwright sirve los estáticos de `public/` con
`python3 -m http.server 18090` (ver `src/playwright.config.js`), con dos
proyectos de navegador — `desktop` (Chrome de escritorio) y `mobile`
(emulación Pixel 7).

`lint` **no** es ESLint ni un linter de estilo: es un script propio mínimo
que solo comprueba que cada fichero JS del backend (`server/`) y del
frontend (`public/js/`) tenga sintaxis válida (`node --check`). No detecta
problemas de estilo, variables sin usar, etc.

### Qué cubre cada carpeta de test

- **`test/unit/`** — lógica aislada sin servidor HTTP: idiomas
  (`language.test.js`), importación de CSV (`importCsv.test.js`), gestión
  de jugadores (`players.test.js`), utilidades de preguntas
  (`questionUtils.test.js`), partidas en vivo (`liveGames.test.js`).
- **`test/integration/`** — levanta el servidor Express real (con Mongo en
  memoria) y prueba la API HTTP de extremo a extremo: `api.test.js`,
  `sessionReport.test.js`, y los más recientes `auth-migration.test.js` y
  `authentik.test.js` (migración de cuentas a Authentik).
- **`test/browser/`** — tests de navegador con Playwright: `language.spec.js`
  (cambio de idioma) y el más reciente `auth-state.spec.js` (estado de
  sesión tras la migración a Authentik).

### Scripts puntuales que NO son parte del flujo de test estándar

Estos no se ejecutan con `npm test` ni en la CI; son herramientas manuales
para tareas concretas de administración/migración, no pruebas automáticas:

- `scripts/configure-authentik-migration.py` — configura la migración de
  cuentas a Authentik.
- `scripts/test-authentik-google-verification.py` — verifica manualmente
  la vinculación de Google dentro de Authentik.
- `scripts/normalize-tags.js` (`npm run normalize-tags`) — normaliza
  etiquetas de quizzes existentes en la base de datos.

## Pruebas manuales en el navegador

Para comprobar un cambio "a ojo" después de arrancar el servidor
(ver [Arrancar la app](#arrancar-la-app-para-probarla-a-mano)):

- **Crear/editar un quiz**: `http://localhost:3000/create/`
- **Jugar en el aula** (host + varios dispositivos/pestañas como jugador,
  el modo real de clase): botón "Jugar en el aula" desde la biblioteca →
  `/host/`, y unirse desde `/join` con el PIN. Ver el detalle de este y los
  otros modos en [FEATURES.md → Modos de juego](FEATURES.md#modos-de-juego).
- **Multijugador** (pantalla compartida, 2-4 jugadores): botón
  "Multijugador" → `/multiplayer/`.
- **Solo** (modo individual): botón "Solo" → `/solo/`, o enlaces directos
  como `/solo/?id=<quizId>` o `/solo/?tag=musica` (ver `README.md`).

Para probar cambios de idioma, usar el selector de idioma de la interfaz o
añadir `?lang=va|es|en` a la URL.

## Antes de etiquetar una versión (checklist)

Equivalente a lo que hacían las secciones "Comprovacions" de
`RELEASE-1.0.2.md`/`RELEASE-1.0.5.md`, pero como referencia única y
reutilizable para cualquier versión futura:

```bash
cd src
npm ci
npx playwright install --with-deps chromium
npm run lint
npm test
npm run test:i18n
npm audit
```

Si el cambio afecta a sesiones/autenticación, ejecutar también de forma
manual el flujo de login afectado (Google, Authentik) en local antes de
publicar, ya que los tests automáticos de `authentik.test.js`/
`auth-state.spec.js` cubren casos concretos, no toda la superficie de la UI.
