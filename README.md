# EduHoot

Historial de versions: [CHANGELOG](CHANGELOG.md). Proves automàtiques
d'idiomes (`cd src` i `npm run test:i18n`; preparació en les notes de versió).

Imatge Docker i publicació en GitHub: [documentació](docs/DOCKER.md).

## Valencià

**EduHoot** és una aplicació tipus Kahoot per a l’aula: pots crear, importar i llançar qüestionaris amb imatges, vídeos i temps configurables. Admet CSV (inclosos els generats per IA) i importació de Kahoot públic. Està inspirada i reutilitza idees de [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot en lliurex](https://github.com/lliurex/llixhoot) i [qplay](https://github.com/jjdeharo/qplay).

- Visibilitat: **privat**, **per enllaç** o **públic**, amb control de permisos per a clonar.
- Idiomes: valencià, castellà i anglès (autodetecta el navegador i es pot canviar).
- Host: botó de “Saltar pregunta”, indicador de progrés i reentrada ràpida quan algun jugador perd la connexió.
- Importació Kahoot: enganxa la URL pública i juga des d’EduHoot.

**Llicència:** GNU Affero General Public License v3.0 (AGPL-3.0).

### Inici ràpid

1. `cd src && npm install`
2. Inicia MongoDB local (`sudo systemctl start mongod`) o defineix `MONGO_URL`.
3. Executa `node server/server.js`.
4. Obri `http://localhost:3000/create/`.
5. Alternativa amb Docker: consulta [docs/DEV_DOCKER_SETUP.md](docs/DEV_DOCKER_SETUP.md) per a desenvolupar sense instal·lar Node ni MongoDB en local.

### Accés amb Google (llegat)

Configura un client OAuth 2.0 de Google amb la URL de retorn `https://tu-dominio/api/auth/google/callback` (o `http://localhost:3000/api/auth/google/callback` en local) i arranca el servidor amb:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUBLIC_BASE_URL` (recomanat en producció, per exemple `https://tu-dominio`)
- `EDUTICTAC_COMMONS_URL` (opcional): Commons al qual apunta el xip de compte. Per defecte `https://commons.edutictac.es`; en un Commons local, l'adreça pública del portal, per exemple `http://edutictac.local:8082`.
- `CSP_REPORT_ONLY` (opcional): amb `true`, la CSP només avisa en la consola del navegador i no bloqueja res.

El primer usuari que entra per esta via antiga es crea com `admin`; els següents entren com `editor`. Si ja existeix un usuari amb el mateix email, se li enllaça Google i conserva el rol.

La interfície de `/create/` ja no mostra Google ni el formulari de correu+contrasenya: l'accés docent és el xip d'EduTicTac amb Authentik. Google es manté al backend i dins del propi Authentik.

### Accés docent amb Authentik

El xip d'EduTicTac obri la sessió Authentik d'EduHoot. Configura `AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET` i `AUTHENTIK_REDIRECT_URI` (per defecte `/api/auth/authentik/callback`), i registra eixa URL en Authentik. Només les identitats amb un rol docent en la claim configurada poden crear o gestionar qüestionaris; l'alumnat no pot entrar per esta via. La claim de grups és `groups` per defecte (`AUTHENTIK_ROLE_CLAIM`) i els rols acceptats es configuren amb `AUTHENTIK_TEACHER_ROLES`.

### Funcions clau

- Importació de CSV i de contingut generat per IA.
- Importació pública de Kahoot per URL o ID.
- Control de visibilitat (privat, per enllaç, públic) i permisos de clonació.
- Botó de “Saltar pregunta” i marcador de progrés.
- Recuperació ràpida de jugadors quan la connexió cau.
- Tres modes de joc: **Jugar a l’aula** (amb PIN), **Multijugador**
  (pantalla compartida) i **Solo** (individual, al teu ritme).
- L’alumnat s’uneix amb un nom lliure i una icona; l’amfitrió avança les
  preguntes a mà, no hi ha avanç automàtic.
- Informe de partida en CSV, i exportació del banc de preguntes a Moodle
  XML per a AULES.

Vols saber amb detall com funciona cada funcionalitat (modes de joc, avanç
de preguntes, informe CSV...)? Consulta [ARCHITECTURE.md](ARCHITECTURE.md).

Per als canvis recents, consulta el [CHANGELOG](CHANGELOG.md).

### Enllaços directes al mode Solo

- Quiz concret: `/solo/?id=<quizId>`
- Una etiqueta: `/solo/?tag=musica`
- Diverses etiquetes amb coincidència de qualsevol: `/solo/?tags=musica,primaria`
- Diverses etiquetes exigint totes: `/solo/?tags=musica,primaria&tagMode=all`

## Castellano

**EduHoot** es una aplicación tipo Kahoot para el aula: crea, importa y lanza quizzes con imágenes, vídeos y tiempos configurables. Admite CSV (también generados por IA) e importación de Kahoot público. Se inspira y reutiliza ideas de [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot en lliurex](https://github.com/lliurex/llixhoot) y [qplay](https://github.com/jjdeharo/qplay).

- Visibilidad: **privado**, **por enlace** o **público**, con control de permisos para clonar.
- Idiomas: valenciano, castellano e inglés (autodetecta el navegador y se puede cambiar).
- Host: botón de “Saltar pregunta”, indicador de progreso y reincorporación rápida cuando los jugadores pierden la conexión.
- Importación Kahoot: pega la URL pública y juega desde EduHoot.

**Licencia:** GNU Affero General Public License v3.0 (AGPL-3.0).

### Inicio rápido

1. `cd src && npm install`
2. Inicia MongoDB local (`sudo systemctl start mongod`) o configura `MONGO_URL`.
3. Ejecuta `node server/server.js`.
4. Abre `http://localhost:3000/create/`.
5. Alternativa con Docker: consulta [docs/DEV_DOCKER_SETUP.md](docs/DEV_DOCKER_SETUP.md) para desarrollar sin instalar Node ni MongoDB localmente.

### Acceso con Google (legado)

Configura un cliente OAuth 2.0 de Google con la URL de retorno `https://tu-dominio/api/auth/google/callback` (o `http://localhost:3000/api/auth/google/callback` en local) y arranca el servidor con:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUBLIC_BASE_URL` (recomendado en producción, por ejemplo `https://tu-dominio`)
- `EDUTICTAC_COMMONS_URL` (opcional): Commons al que apunta el chip de cuenta. Por defecto `https://commons.edutictac.es`; en un Commons local, la dirección pública del portal, por ejemplo `http://edutictac.local:8082`.
- `CSP_REPORT_ONLY` (opcional): con `true`, la CSP solo avisa en la consola del navegador y no bloquea nada.

El primer usuario que entra por esta vía antigua se crea como `admin`; los siguientes entran como `editor`. Si ya existe un usuario con el mismo email, se le enlaza Google y conserva su rol.

La interfaz de `/create/` ya no muestra Google ni el formulario de correo+contraseña: el acceso docente es el chip de EduTicTac con Authentik. Google se mantiene en el backend y dentro del propio Authentik.

### Acceso docente con Authentik

El chip de EduTicTac abre la sesión Authentik de EduHoot. Configura
`AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET` y
`AUTHENTIK_REDIRECT_URI` (por defecto `/api/auth/authentik/callback`), y registra
esa URL en Authentik. Solo las identidades con un rol docente en la claim
configurada pueden crear o gestionar cuestionarios; el alumnado no puede usar
este acceso. La claim de grupos es `groups` por defecto
(`AUTHENTIK_ROLE_CLAIM`) y los roles aceptados se configuran con
`AUTHENTIK_TEACHER_ROLES`.

### Integración con EduTicTac Commons

EduHoot puede validar al alumnado contra el servicio de identidad pseudónima de EduTicTac Commons y registrar la puntuación final en Commons.

Variables principales:

- `EDUTICTAC_ID_API_URL`: URL interna de `id-api`, por ejemplo `http://id-api:8005`.
- `EDUTICTAC_ID_AUTH_REQUIRED`: `0` permite entrar con nombre corto o con código + PIN Commons; `1` obliga a usar código + PIN Commons.
- `EDUTICTAC_ID_APP_TOKEN`: token interno compartido con Commons para enviar resultados.

En modo mixto (`EDUTICTAC_ID_AUTH_REQUIRED=0`), si el alumno rellena código + PIN Commons, EduHoot no debe pedir también nombre: usa el código público como alias corto. Si deja esos campos vacíos, puede jugar con nombre corto como antes.

Al terminar una partida, EduHoot envía resumen de puntuación a `/api/apps/eduhoot/scores` cuando `EDUTICTAC_ID_API_URL` y `EDUTICTAC_ID_APP_TOKEN` están configurados.

### Entorno stage (preproducción)

Stage se publica con una etiqueta `stage-*` en GitHub y se despliega
automáticamente desde la imagen publicada. La guía vigente es
[`docs/STAGE-AUTOMATIC.md`](docs/STAGE-AUTOMATIC.md).

### Funciones clave

- Importación de CSV y de contenido generado por IA.
- Importación pública de Kahoot por URL o ID.
- Control de visibilidad (privado, por enlace, público) y permisos para clonar.
- Botón de “Saltar pregunta” y contador de progreso.
- Reincorporación ágil de jugadores si se cae la conexión.
- Tres modos de juego: **Jugar en el aula** (con PIN), **Multijugador**
  (pantalla compartida) y **Solo** (individual, a tu ritmo).
- El alumnado se une con un nombre libre y un icono; el profesorado avanza
  las preguntas a mano, no hay avance automático.
- Informe de partida en CSV, y exportación del banco de preguntas a Moodle
  XML para AULES.

¿Quieres saber en detalle cómo funciona cada funcionalidad (modos de
juego, avance de preguntas, informe CSV...)? Consulta [ARCHITECTURE.md](ARCHITECTURE.md).

Para los cambios recientes, consulta el [CHANGELOG](CHANGELOG.md).

### Enlaces directos al modo Solo

- Quiz concreto: `/solo/?id=<quizId>`
- Una etiqueta: `/solo/?tag=musica`
- Varias etiquetas con coincidencia de cualquiera: `/solo/?tags=musica,primaria`
- Varias etiquetas exigiendo todas: `/solo/?tags=musica,primaria&tagMode=all`

## English

**EduHoot** is a Kahoot-like app for classrooms: create, import, and launch quizzes with images, videos, and configurable timers. Supports CSV (including AI-generated) and public Kahoot import. It’s inspired by and reuses ideas from [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot on lliurex](https://github.com/lliurex/llixhoot), and [qplay](https://github.com/jjdeharo/qplay).

- Visibility: **private**, **by link**, or **public**, with clone-permission control.
- Languages: Valencian, Spanish, English (auto-detects browser and is switchable).
- Host: “Skip question” button, progress counter, and quick player rejoin when connections drop.
- Kahoot import: paste a public URL and play it from EduHoot.

**License:** GNU Affero General Public License v3.0 (AGPL-3.0).

### Quick start

1. `cd src && npm install`
2. Start local MongoDB (`sudo systemctl start mongod`) or set `MONGO_URL`.
3. Run `node server/server.js`.
4. Open `http://localhost:3000/create/`.
5. Docker alternative: see [docs/DEV_DOCKER_SETUP.md](docs/DEV_DOCKER_SETUP.md) to develop without installing Node or MongoDB locally.

### Google Sign-In (legacy)

Create a Google OAuth 2.0 client with the redirect URL `https://your-domain/api/auth/google/callback` (or `http://localhost:3000/api/auth/google/callback` locally) and start the server with:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUBLIC_BASE_URL` (recommended in production, for example `https://your-domain`)
- `EDUTICTAC_COMMONS_URL` (optional): Commons the account chip points to. Defaults to `https://commons.edutictac.es`; in a local Commons, the portal's public address, for example `http://edutictac.local:8082`.
- `CSP_REPORT_ONLY` (optional): with `true`, the CSP only warns in the browser console and blocks nothing.

The first user through this legacy route becomes `admin`; later users become `editor`. If a user with the same email already exists, Google is linked to that account and the current role is preserved.

The `/create/` interface no longer shows Google or the email+password form: teacher access is the EduTicTac chip with Authentik. Google remains in the backend and inside Authentik itself.

### Teacher sign-in with Authentik

The EduTicTac chip opens EduHoot's Authentik session. Configure
`AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET`, and
`AUTHENTIK_REDIRECT_URI` (defaults to `/api/auth/authentik/callback`), and
register that URL in Authentik. Only identities with a teacher role in the
configured claim can create or manage quizzes; students cannot use this login.
The groups claim is `groups` by default (`AUTHENTIK_ROLE_CLAIM`) and accepted
roles are configured with `AUTHENTIK_TEACHER_ROLES`.

### Stage Environment (pre-production)

Stage is published with a `stage-*` tag on GitHub and deployed automatically
from the published image. See
[`docs/STAGE-AUTOMATIC.md`](docs/STAGE-AUTOMATIC.md).

### Key features

- CSV import and AI-generated content ingestion.
- Public Kahoot import via URL or ID.
- Visibility controls (private, by link, public) with clone permissions.
- “Skip question” button and progress tracking.
- Fast player rejoin if the connection drops.
- Three game modes: **Classroom** (with a PIN), **Multiplayer** (shared
  screen), and **Solo** (individual, self-paced).
- Students join with a free-text name and an icon; the teacher advances
  questions manually — there's no auto-advance.
- CSV game report, plus exporting the question bank to Moodle XML for
  Moodle/AULES.

Want the full details on how each feature works (game modes, question
advancing, CSV report...)? See [ARCHITECTURE.md](ARCHITECTURE.md).

For recent changes, see the [CHANGELOG](CHANGELOG.md).

### Solo Deep Links

- Specific quiz: `/solo/?id=<quizId>`
- One tag: `/solo/?tag=music`
- Multiple tags matching any: `/solo/?tags=music,primary`
- Multiple tags requiring all: `/solo/?tags=music,primary&tagMode=all`
