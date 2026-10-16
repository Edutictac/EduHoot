# Guía: dockerizar el entorno de desarrollo de EduHoot

> **Nota:** este documento es una guía de diseño para implementar más adelante. A día de hoy **no existen** `docker-compose.yml` ni `Dockerfile.dev` en el repo — solo el `Dockerfile` de producción (usado para build/imagen, no para el despliegue real, que va por systemd+nginx). Esta guía describe cómo añadir un flujo de desarrollo con Docker sin tocar ni arriesgar ese `Dockerfile` existente.

## Índice

- [Objetivo](#objetivo)
- [Hallazgos del código que condicionan el diseño](#hallazgos-del-código-que-condicionan-el-diseño)
- [Enfoque general](#enfoque-general)
- [Ficheros a crear (cuando se implemente)](#ficheros-a-crear-cuando-se-implemente)
  - [1. `docker-compose.yml` (raíz)](#1-docker-composeyml-raíz)
  - [2. `Dockerfile.dev` (raíz)](#2-dockerfiledev-raíz)
  - [3. `src/package.json` — añadir dos scripts](#3-srcpackagejson--añadir-dos-scripts)
  - [4. `.env.example` (raíz) + entrada en `.gitignore`](#4-envexample-raíz--entrada-en-gitignore)
  - [5. Puntero en `README.md`](#5-puntero-en-readmemd)
- [Por qué estas decisiones de diseño](#por-qué-estas-decisiones-de-diseño)
- [Verificación de extremo a extremo (una vez implementado)](#verificación-de-extremo-a-extremo-una-vez-implementado)

## Objetivo

Levantar EduHoot en local con un solo comando (`docker compose up`), sin tener que instalar Node ni MongoDB a mano, y que al editar código el servidor se recargue solo.

## Hallazgos del código que condicionan el diseño

- `src/server/server.js:2321` usa `HOST = process.env.HOST || '127.0.0.1'` y `server.listen(PORT, HOST, ...)`. Si el contenedor escucha en `127.0.0.1`, el mapeo de puertos de Docker (`-p 3000:3000`) **no funciona** — hay que forzar `HOST=0.0.0.0` dentro del contenedor.
- `DB_NAME` está fijo a `'kahootDB'` (`server.js:232`), así que `MONGO_URL` no necesita incluir el nombre de la base de datos.
- Los directorios de subidas (`src/public/uploads/quiz-images`) y logs (`src/logs/finished-session-reports`) ya se crean solos con `fs.mkdirSync(..., { recursive: true })` dentro de `server.js` — el `mkdir`/`chown` del `entrypoint.sh` de producción es solo para permisos de un usuario no-root, no se necesita en desarrollo.
- `src/package.json` todavía no tiene scripts `start` ni `dev`.
- `.gitignore` no excluye `.env` (solo `.dockerignore` lo hace) — hay que añadirlo si se promueve un `.env` local.

## Enfoque general

- **`Dockerfile.dev` separado** del `Dockerfile` de producción (que sigue intacto, usado solo para build de imagen/producción).
- **`docker-compose.yml`** con dos servicios: `mongo` (imagen oficial, con volumen nombrado para persistencia) y `app` (build de `Dockerfile.dev`).
- **Bind mount** de `src/` dentro del contenedor `app`, con un **volumen nombrado aparte para `node_modules`** (para que el mount del host no borre las dependencias instaladas en la imagen).
- El contenedor de desarrollo corre como **root** (sin el usuario no-root ni el `entrypoint.sh` de producción), para evitar problemas de permisos por UID distinto entre host y contenedor. Aceptable porque es un entorno local de un solo desarrollador.
- Recarga automática con **`node --watch`** (nativo de Node 20), sin añadir `nodemon` como dependencia nueva.

## Ficheros a crear (cuando se implemente)

### 1. `docker-compose.yml` (raíz)

```yaml
services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    volumes:
      - eduhoot_mongo_data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    depends_on:
      mongo:
        condition: service_healthy
    environment:
      - MONGO_URL=mongodb://mongo:27017/
      - HOST=0.0.0.0
      - PORT=3000
      - NODE_ENV=development
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
      - PUBLIC_BASE_URL=${PUBLIC_BASE_URL:-}
    ports:
      - "${APP_PORT:-3000}:3000"
    volumes:
      - ./src:/app
      - eduhoot_node_modules:/app/node_modules
    command: npm run dev

volumes:
  eduhoot_mongo_data:
  eduhoot_node_modules:
```

No se mapea el puerto `27017` de Mongo al host por defecto (se puede descomentar) para no chocar con un Mongo nativo que ya tengas corriendo según el `README.md`.

### 2. `Dockerfile.dev` (raíz)

```dockerfile
FROM node:20-alpine

LABEL org.opencontainers.image.title="EduHoot (dev)"

WORKDIR /app

COPY src/package.json src/package-lock.json ./
RUN npm install

COPY src/ ./

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

`npm install` (no `npm ci`) para instalar también las `devDependencies`. El `COPY src/ ./` final queda tapado por el bind mount en uso normal, pero mantiene la imagen usable de forma autónoma si algún día hace falta construirla sin compose.

### 3. `src/package.json` — añadir dos scripts

```json
"scripts": {
  "start": "node server/server.js",
  "dev": "node --watch server/server.js",
  "test:i18n": "playwright test",
  "lint": "node scripts/lint.js",
  "normalize-tags": "node scripts/normalize-tags.js",
  "test": "node --test \"test/**/*.test.js\"",
  "test:unit": "node --test \"test/unit/*.test.js\"",
  "test:integration": "node --test \"test/integration/*.test.js\""
}
```

No es necesario tocar el `Dockerfile` de producción (puede seguir con `CMD ["node", "server/server.js"]` tal cual).

### 4. `.env.example` (raíz) + entrada en `.gitignore`

```
# Copia este fichero a .env y rellena solo lo que necesites para probar login.
APP_PORT=3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
PUBLIC_BASE_URL=
```

Añadir `.env` a `.gitignore` (hoy solo está excluido en `.dockerignore`) para evitar que alguien commitee credenciales reales.

### 5. Puntero en `README.md`

Añadir una línea en cada bloque de "Inicio rápido" (valencià ~línea 17, castellano ~línea 83, English ~línea 189) apuntando a este documento (o a un `DOCKER.md` final), por ejemplo en castellano:

> 5. Alternativa con Docker: consulta [DOCKER_HOWTO.md](DOCKER_HOWTO.md) para desarrollar sin instalar Node ni MongoDB localmente.

## Por qué estas decisiones de diseño

- **Dockerfile separado en vez de reusar el de producción**: el de producción fija `NODE_ENV=production` y hace `npm ci --omit=dev` (sin devDependencies), y usa `entrypoint.sh` con un usuario no-root que generaría conflictos de permisos al bind-montear código del host con un UID distinto. Separar los Dockerfiles evita cualquier riesgo sobre el flujo de producción.
- **Root en el contenedor de desarrollo**: es un entorno local de un solo desarrollador, sin exposición a red externa — el riesgo de seguridad es prácticamente nulo. A cambio, se evita el problema de UID-mismatch. Trade-off a tener en cuenta: los ficheros que la app cree en caliente en `src/public/uploads/quiz-images` y `src/logs/finished-session-reports` quedarán con propietario `root` en el host. Si hace falta limpiarlos sin `sudo`:
  ```
  docker compose exec -u root app rm -rf public/uploads/quiz-images/* logs/finished-session-reports/*
  ```
  o recuperar la propiedad con:
  ```
  sudo chown -R $(id -u):$(id -g) src/public/uploads src/logs
  ```
- **`node --watch` en vez de `nodemon`**: Node 20 lo soporta de forma nativa, evitando añadir una dependencia nueva solo para esto. Puede imprimir un `ExperimentalWarning` por stderr; es inofensivo.
- **Volumen nombrado para `node_modules`**: el bind mount `./src:/app` tapa todo `/app`, incluido el `node_modules` instalado durante el build de la imagen. Sin un volumen nombrado aparte montado sobre `/app/node_modules`, las dependencias desaparecerían al arrancar el contenedor.
- **`.env` solo para variables opcionales**: `MONGO_URL`, `HOST`, `PORT`, `NODE_ENV` van fijos en el compose porque son necesarios siempre dentro de la red Docker. El `.env` en la raíz solo sirve para que Compose sustituya `${VAR}` dentro del propio `docker-compose.yml` (no hay `dotenv` instalado, así que no lo lee directamente el proceso de Node).

## Verificación de extremo a extremo (una vez implementado)

1. `docker compose config` — valida sintaxis y resolución de variables.
2. `docker compose up --build` — comprobar en los logs `Server started on 0.0.0.0:3000` y la conexión a Mongo.
3. Abrir `http://localhost:3000/create/` y crear un quiz de prueba.
4. `docker compose restart` y comprobar que el quiz sigue ahí (persistencia del volumen de Mongo).
5. Editar `src/server/server.js` (p. ej. un `console.log` temporal) con el stack levantado y ver en `docker compose logs -f app` que `node --watch` reinicia solo, sin necesidad de `--build`.
6. Subir una imagen al crear un quiz y comprobar que aparece en `src/public/uploads/quiz-images/` en el host.
7. `docker compose down -v` al terminar, para limpiar los volúmenes de prueba.
