# EduHoot

Versió actual del paquet: [1.0.2](RELEASE-1.0.2.md), amb proves automàtiques
d'idiomes (`cd src` i `npm run test:i18n`; preparació en les notes de versió).

## Valencià

**EduHoot** és una aplicació tipus Kahoot per a l’aula: pots crear, importar i llançar qüestionaris amb imatges, vídeos i temps configurables. Admet CSV (inclosos els generats per IA) i importació de Kahoot públic. Està inspirada i reutilitza idees de [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot en lliurex](https://github.com/lliurex/llixhoot) i [qplay](https://github.com/jjdeharo/qplay).

- Modes: **Només jo** (efímer sense login), **Per enllaç/Públic** (persistents encara que no hi haja sessió) i control de permisos per a clonar.
- Idiomes: valencià, castellà i anglès (autodetecta el navegador i es pot canviar).
- Host: botó de “Saltar pregunta”, indicador de progrés i reentrada ràpida quan algun jugador perd la connexió.
- Importació Kahoot: enganxa la URL pública i juga des d’EduHoot.

**Llicència:** GNU Affero General Public License v3.0 (AGPL-3.0).

### Inici ràpid

1. `cd src && npm install`
2. Inicia MongoDB local (`sudo systemctl start mongod`) o defineix `MONGO_URL`.
3. Executa `node server/server.js`.
4. Obri `http://localhost:3000/create/`.

### Accés amb Google

Configura un client OAuth 2.0 de Google amb la URL de retorn `https://tu-dominio/api/auth/google/callback` (o `http://localhost:3000/api/auth/google/callback` en local) i arranca el servidor amb:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUBLIC_BASE_URL` (recomanat en producció, per exemple `https://tu-dominio`)

El primer usuari que entra amb Google es crea com `admin`; els següents entren com `editor`. Si ja existeix un usuari amb el mateix email, se li enllaça Google i conserva el rol.

En la pantalla de create, el bloc d'alta ràpida mostra només el botó de Google. El botó `Entrar/Compte` continua obrint el modal d'accés amb email per a usuaris antics.

### Deploy simple al VPS

- Plantilla segura versionable: `scripts/deploy.example.sh`
- Recomanat: copia-la a `scripts/deploy.sh`, ompli les teues dades i no la puges al repo.
- Exemple: `DEPLOY_TARGET=usuari@vps:/var/www/eduhoot bash scripts/deploy.example.sh`
- Amb reinici remot opcional: `DEPLOY_TARGET=usuari@vps:/var/www/eduhoot DEPLOY_REMOTE_CMD='cd /var/www/eduhoot/src && npm ci --omit=dev && pm2 restart eduhoot' bash scripts/deploy.example.sh`
- Per previsualitzar canvis sense copiar: `DRY_RUN=1 bash scripts/deploy.example.sh`

### Funcions clau

- Importació de CSV i de contingut generat per IA.
- Importació pública de Kahoot per URL o ID.
- Control de visibilitat (privat, per enllaç, públic) i permisos de clonació.
- Botó de “Saltar pregunta” i marcador de progrés.
- Recuperació ràpida de jugadors quan la connexió cau.

### Actualitzacions recents

- Landing principal redissenyada amb accessos separats, selector d’idioma i footer comú amb el logo d’EduTicTac.
- Biblioteca amb ordenació per data i alfabètica, tags rellevants i estadístiques de partides.
- El mode Solo ara registra partides i mostra estadístiques visibles al ranking i un feedback més clar.

### Enllaços directes al mode Solo

- Quiz concret: `/solo/?id=<quizId>`
- Una etiqueta: `/solo/?tag=musica`
- Diverses etiquetes amb coincidència de qualsevol: `/solo/?tags=musica,primaria`
- Diverses etiquetes exigint totes: `/solo/?tags=musica,primaria&tagMode=all`

## Castellano

**EduHoot** es una aplicación tipo Kahoot para el aula: crea, importa y lanza quizzes con imágenes, vídeos y tiempos configurables. Admite CSV (también generados por IA) e importación de Kahoot público. Se inspira y reutiliza ideas de [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot en lliurex](https://github.com/lliurex/llixhoot) y [qplay](https://github.com/jjdeharo/qplay).

- Modos: **Solo yo** (efímero sin login), **Por enlace/Público** (persisten aunque no haya sesión) y control de permisos para clonar.
- Idiomas: valenciano, castellano e inglés (autodetecta el navegador y se puede cambiar).
- Host: botón de “Saltar pregunta”, indicador de progreso y reincorporación rápida cuando los jugadores pierden la conexión.
- Importación Kahoot: pega la URL pública y juega desde EduHoot.

**Licencia:** GNU Affero General Public License v3.0 (AGPL-3.0).

### Inicio rápido

1. `cd src && npm install`
2. Inicia MongoDB local (`sudo systemctl start mongod`) o configura `MONGO_URL`.
3. Ejecuta `node server/server.js`.
4. Abre `http://localhost:3000/create/`.

### Acceso con Google

Configura un cliente OAuth 2.0 de Google con la URL de retorno `https://tu-dominio/api/auth/google/callback` (o `http://localhost:3000/api/auth/google/callback` en local) y arranca el servidor con:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUBLIC_BASE_URL` (recomendado en producción, por ejemplo `https://tu-dominio`)

El primer usuario que entra con Google se crea como `admin`; los siguientes entran como `editor`. Si ya existe un usuario con el mismo email, se le enlaza Google y conserva su rol.

En la pantalla de create, el bloque de alta rápida muestra solo el botón de Google. El botón `Entrar/Cuenta` sigue abriendo el modal de acceso con email para usuarios antiguos.

### Acceso docente con Authentik

EduHoot admite login OIDC con Authentik. Solo las identidades que incluyen un
rol docente en la claim configurada pueden iniciar sesión; el alumnado no puede
usar este login para crear o gestionar cuestionarios. Configura
`AUTHENTIK_ISSUER`, `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET` y
`AUTHENTIK_REDIRECT_URI` (por defecto `/api/auth/authentik/callback`), y registra
esa URL en Authentik. La claim de roles/grupos es `groups` por defecto y se
puede cambiar con `AUTHENTIK_ROLE_CLAIM`; los roles aceptados se configuran con
`AUTHENTIK_TEACHER_ROLES`.

### Integración con EduTicTac Commons

EduHoot puede validar al alumnado contra el servicio de identidad pseudónima de EduTicTac Commons y registrar la puntuación final en Commons.

Variables principales:

- `EDUTICTAC_ID_API_URL`: URL interna de `id-api`, por ejemplo `http://id-api:8005`.
- `EDUTICTAC_ID_AUTH_REQUIRED`: `0` permite entrar con nombre corto o con código + PIN Commons; `1` obliga a usar código + PIN Commons.
- `EDUTICTAC_ID_APP_TOKEN`: token interno compartido con Commons para enviar resultados.

En modo mixto (`EDUTICTAC_ID_AUTH_REQUIRED=0`), si el alumno rellena código + PIN Commons, EduHoot no debe pedir también nombre: usa el código público como alias corto. Si deja esos campos vacíos, puede jugar con nombre corto como antes.

Al terminar una partida, EduHoot envía resumen de puntuación a `/api/apps/eduhoot/scores` cuando `EDUTICTAC_ID_API_URL` y `EDUTICTAC_ID_APP_TOKEN` están configurados.

### Deploy simple al VPS

- Plantilla segura versionable: `scripts/deploy.example.sh`
- Recomendado: cópiala a `scripts/deploy.sh`, rellena tus datos y no la subas al repo.
- Ejemplo: `DEPLOY_TARGET=usuario@vps:/var/www/eduhoot bash scripts/deploy.example.sh`
- Con reinicio remoto opcional: `DEPLOY_TARGET=usuario@vps:/var/www/eduhoot DEPLOY_REMOTE_CMD='cd /var/www/eduhoot/src && npm ci --omit=dev && pm2 restart eduhoot' bash scripts/deploy.example.sh`
- Para previsualizar cambios sin copiar: `DRY_RUN=1 bash scripts/deploy.example.sh`

### Entorno stage (preproducción)

- Guía completa: `STAGE_SETUP.md`
- Plantilla de deploy stage: `scripts/deploy-stage.example.sh`
- Servicio systemd stage: `install-files/service/eduhoot-stage-server.service`
- Config Nginx stage: `install-files/nginx/eduhoot-stage.conf`
- Variables de entorno stage: `install-files/stage.env.example`

Flujo recomendado:

1. Monta stage una vez siguiendo `STAGE_SETUP.md`.
2. Despliega cambios a `/opt/eduhoot-stage/src` con `scripts/deploy-stage.sh`.
3. Valida en `stage.tu-dominio` (flujos host/player, login y CSV).
4. Solo después promueve a producción.

### Funciones clave

- Importación de CSV y de contenido generado por IA.
- Importación pública de Kahoot por URL o ID.
- Control de visibilidad (privado, por enlace, público) y permisos para clonar.
- Botón de “Saltar pregunta” y contador de progreso.
- Reincorporación ágil de jugadores si se cae la conexión.

### Actualizaciones recientes

- Landing principal renovada con accesos diferenciados, selector de idioma y footer compartido con el logo de EduTicTac.
- Biblioteca con orden por fecha y alfabético, etiquetas relevantes y estadísticas visibles en cada ficha.
- Modo Solo registra partidas y mejora el ranking/feedback, además de mostrar estadísticas de partidas jugadas.

### Enlaces directos al modo Solo

- Quiz concreto: `/solo/?id=<quizId>`
- Una etiqueta: `/solo/?tag=musica`
- Varias etiquetas con coincidencia de cualquiera: `/solo/?tags=musica,primaria`
- Varias etiquetas exigiendo todas: `/solo/?tags=musica,primaria&tagMode=all`

## English

**EduHoot** is a Kahoot-like app for classrooms: create, import, and launch quizzes with images, videos, and configurable timers. Supports CSV (including AI-generated) and public Kahoot import. It’s inspired by and reuses ideas from [llixhoot](https://github.com/llixhoot/llixhoot), [llixhoot on lliurex](https://github.com/lliurex/llixhoot), and [qplay](https://github.com/jjdeharo/qplay).

- Modes: **Only me** (ephemeral without login), **By link/Public** (persist even without login), with clone-permission control.
- Languages: Valencian, Spanish, English (auto-detects browser and is switchable).
- Host: “Skip question” button, progress counter, and quick player rejoin when connections drop.
- Kahoot import: paste a public URL and play it from EduHoot.

**License:** GNU Affero General Public License v3.0 (AGPL-3.0).

### Quick start

1. `cd src && npm install`
2. Start local MongoDB (`sudo systemctl start mongod`) or set `MONGO_URL`.
3. Run `node server/server.js`.
4. Open `http://localhost:3000/create/`.

### Google Sign-In

Create a Google OAuth 2.0 client with the redirect URL `https://your-domain/api/auth/google/callback` (or `http://localhost:3000/api/auth/google/callback` locally) and start the server with:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUBLIC_BASE_URL` (recommended in production, for example `https://your-domain`)

The first Google user becomes `admin`; later users become `editor`. If a user with the same email already exists, Google is linked to that account and the current role is preserved.

### Simple VPS Deploy

- Safe versioned template: `scripts/deploy.example.sh`
- Recommended: copy it to `scripts/deploy.sh`, fill your real values, and keep it out of the repo.
- Example: `DEPLOY_TARGET=user@vps:/var/www/eduhoot bash scripts/deploy.example.sh`
- With optional remote restart: `DEPLOY_TARGET=user@vps:/var/www/eduhoot DEPLOY_REMOTE_CMD='cd /var/www/eduhoot/src && npm ci --omit=dev && pm2 restart eduhoot' bash scripts/deploy.example.sh`
- Preview without copying: `DRY_RUN=1 bash scripts/deploy.example.sh`

### Stage Environment (pre-production)

- Full guide: `STAGE_SETUP.md`
- Stage deploy template: `scripts/deploy-stage.example.sh`
- Stage systemd service: `install-files/service/eduhoot-stage-server.service`
- Stage Nginx config: `install-files/nginx/eduhoot-stage.conf`
- Stage environment variables: `install-files/stage.env.example`

Recommended flow:

1. Set up stage once using `STAGE_SETUP.md`.
2. Deploy changes to `/opt/eduhoot-stage/src` via `scripts/deploy-stage.sh`.
3. Validate on `stage.your-domain` (host/player flows, login, CSV import).
4. Promote to production only after stage is green.

### Key features

- CSV import and AI-generated content ingestion.
- Public Kahoot import via URL or ID.
- Visibility controls (private, by link, public) with clone permissions.
- “Skip question” button and progress tracking.
- Fast player rejoin if the connection drops.

### Recent updates

- Redesigned landing with separate entry points, language selector, and shared footer pointing to EduTicTac.
- Library now supports ordering by date/alpha, shows only related tags, and surfaces quiz stats.
- Solo mode logs plays so the ranking/counts include solo sessions, plus brighter feedback and stats.

### Solo Deep Links

- Specific quiz: `/solo/?id=<quizId>`
- One tag: `/solo/?tag=music`
- Multiple tags matching any: `/solo/?tags=music,primary`
- Multiple tags requiring all: `/solo/?tags=music,primary&tagMode=all`
