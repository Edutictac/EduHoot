# Guia: dockeritzar l'entorn de desenvolupament d'EduHoot

> **Nota:** `docker-compose.yml` i `Dockerfile.dev` ja existixen en el repositori i estan verificats d'extrem a extrem (vore secció corresponent). El `Dockerfile` de producció continua intacte i separat (usat per a construir la imatge, no per al desplegament real, que va per systemd+nginx).

## Índex

- [Objectiu](#objectiu)
- [Troballes del codi que condicionen el disseny](#troballes-del-codi-que-condicionen-el-disseny)
- [Enfocament general](#enfocament-general)
- [Fitxers creats](#fitxers-creats)
- [Per què estes decisions de disseny](#per-què-estes-decisions-de-disseny)
- [Alçar i parar l'entorn de desenvolupament](#alçar-i-parar-lentorn-de-desenvolupament)
- [Verificació d'extrem a extrem](#verificació-dextrem-a-extrem)
- [Pròxim pas: Pull Request](#pròxim-pas-pull-request)

## Objectiu

Alçar EduHoot en local amb una sola orde (`docker compose up`), sense haver d'instal·lar Node ni MongoDB a mà, i que en editar codi el servidor es recarregue sol.

## Troballes del codi que condicionen el disseny

- `src/server/server.js:2321` usa `HOST = process.env.HOST || '127.0.0.1'` i `server.listen(PORT, HOST, ...)`. Si el contenidor escolta en `127.0.0.1`, el mapatge de ports de Docker (`-p 3000:3000`) **no funciona** — cal forçar `HOST=0.0.0.0` dins del contenidor.
- `DB_NAME` està fixat a `'kahootDB'` (`server.js:232`), així que `MONGO_URL` no necessita incloure el nom de la base de dades.
- Els directoris de pujades (`src/public/uploads/quiz-images`) i logs (`src/logs/finished-session-reports`) ja es creen sols amb `fs.mkdirSync(..., { recursive: true })` dins de `server.js` — el `mkdir`/`chown` de l'`entrypoint.sh` de producció és només per a permisos d'un usuari no-root, no es necessita en desenvolupament.
- `src/package.json` no tenia scripts `start` ni `dev` (ja afegits, vore «Fitxers creats»).
- `.gitignore` no excloïa `.env` (només ho feia `.dockerignore`) — ja afegit.

## Enfocament general

- **`Dockerfile.dev` separat** del `Dockerfile` de producció (que continua intacte, usat només per a construir la imatge de producció).
- **`docker-compose.yml`** amb dos serveis: `mongo` (imatge oficial, amb volum anomenat per a persistència) i `app` (construït a partir de `Dockerfile.dev`).
- **Bind mount** de `src/` dins del contenidor `app`, amb un **volum anomenat a banda per a `node_modules`** (perquè el muntatge de l'amfitrió no esborre les dependències instal·lades en la imatge).
- El contenidor de desenvolupament funciona com **root** (sense l'usuari no-root ni l'`entrypoint.sh` de producció), per a evitar problemes de permisos per UID distint entre l'amfitrió i el contenidor. Acceptable perquè és un entorn local d'un sol desenvolupador.
- Recàrrega automàtica amb **`node --watch`** (natiu de Node 20), sense afegir `nodemon` com a dependència nova.

## Fitxers creats

### 1. `docker-compose.yml`

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

No es mapeja el port `27017` de Mongo a l'amfitrió per defecte (es pot descomentar) per a no xocar amb un Mongo natiu que ja tingues corrent segons el `README.md`.

### 2. `Dockerfile.dev`

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

`npm install` (no `npm ci`) per a instal·lar també les `devDependencies`. El `COPY src/ ./` final queda tapat pel bind mount en ús normal, però manté la imatge usable de forma autònoma si algun dia cal construir-la sense compose.

### 3. `src/package.json` — scripts afegits

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

No cal tocar el `Dockerfile` de producció (pot continuar amb `CMD ["node", "server/server.js"]` tal qual).

### 4. `.env.example` + entrada en `.gitignore`

```
# Copia este fitxer a .env i omple només allò que necessites per a provar l'inici de sessió.
APP_PORT=3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
PUBLIC_BASE_URL=
```

Afegir `.env` a `.gitignore` (hui només està exclòs en `.dockerignore`) per a evitar que algú comitege credencials reals.

Per a saber com aconseguir `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` i què és `PUBLIC_BASE_URL`, vore la secció **"Accés amb Google"** del `README.md`. `APP_PORT` no requerix cap configuració externa: és només el port que `docker-compose.yml` mapeja a l'amfitrió (per defecte `3000`).

### 5. Punter en `README.md`

Afegir una línia en cada bloc d'"Inici ràpid" (valencià ~línia 17, castellà ~línia 83, English ~línia 189) apuntant a este document (o a un `DOCKER.md` final), per exemple en castellà:

> 5. Alternativa con Docker: consulta [docs/DEV_DOCKER_SETUP.md](docs/DEV_DOCKER_SETUP.md) para desarrollar sin instalar Node ni MongoDB localmente.

## Per què estes decisions de disseny

- **Dockerfile separat en lloc de reutilitzar el de producció**: el de producció fixa `NODE_ENV=production` i fa `npm ci --omit=dev` (sense devDependencies), i usa `entrypoint.sh` amb un usuari no-root que generaria conflictes de permisos en fer bind-mount del codi de l'amfitrió amb un UID distint. Separar els Dockerfiles evita qualsevol risc sobre el flux de producció.
- **Root en el contenidor de desenvolupament**: és un entorn local d'un sol desenvolupador, sense exposició a la xarxa externa — el risc de seguretat és pràcticament nul. A canvi, s'evita el problema d'UID-mismatch. Compensació a tindre en compte: els fitxers que l'aplicació cree en calent en `src/public/uploads/quiz-images` i `src/logs/finished-session-reports` quedaran amb propietari `root` en l'amfitrió. Si cal netejar-los sense `sudo`:
  ```
  docker compose exec -u root app rm -rf public/uploads/quiz-images/* logs/finished-session-reports/*
  ```
  o recuperar la propietat amb:
  ```
  sudo chown -R $(id -u):$(id -g) src/public/uploads src/logs
  ```
- **`node --watch` en lloc de `nodemon`**: Node 20 ho admet de forma nativa, evitant afegir una dependència nova només per a això. Pot imprimir un `ExperimentalWarning` per stderr; és inofensiu.
- **Volum anomenat per a `node_modules`**: el bind mount `./src:/app` tapa tot `/app`, inclòs el `node_modules` instal·lat durant la construcció de la imatge. Sense un volum anomenat a banda muntat sobre `/app/node_modules`, les dependències desapareixerien en arrancar el contenidor.
- **`.env` només per a variables opcionals**: `MONGO_URL`, `HOST`, `PORT`, `NODE_ENV` van fixos en el compose perquè són necessaris sempre dins de la xarxa Docker. El `.env` en la raïl només servix perquè Compose substituïsca `${VAR}` dins del propi `docker-compose.yml` (no hi ha `dotenv` instal·lat, així que no el llig directament el procés de Node).

## Alçar i parar l'entorn de desenvolupament

Si acabes d'afegir el teu usuari al grup `docker`
(`sudo usermod -aG docker $USER`), cal tancar i tornar a obrir la sessió
(o fer `newgrp docker` en un terminal nou) perquè el canvi tinga efecte
abans d'executar `docker compose` sense `sudo`.

```bash
cp .env.example .env          # només la primera vegada, i omplir el que calga
```

**Per a alçar-ho:**

```bash
docker compose up --build     # primera vegada, o quan canvie Dockerfile.dev/package.json
docker compose up             # la resta de vegades (ja no cal --build)
docker compose up -d          # en segon pla, sense bloquejar el terminal
```

- Obri `http://localhost:3000/create/`.
- Edita codi en `src/` amb normalitat: `node --watch` reinicia el servidor
  sol dins del contenidor.
- Si l'has alçat amb `-d`, veure els logs en viu amb `docker compose logs -f app`.

**Per a parar-ho:**

```bash
# Si l'has alçat en primer pla (sense -d): Ctrl+C

docker compose down           # para i elimina els contenidors, manté les dades de Mongo
docker compose down -v        # esborra també el volum de Mongo (torna a un estat net)
```

## Verificació d'extrem a extrem

1. `docker compose config` — valida la sintaxi i la resolució de variables.
2. `docker compose up --build` — comprovar en els logs `Server started on 0.0.0.0:3000` i la connexió a Mongo.
3. Obrir `http://localhost:3000/create/` i crear un qüestionari de prova.
4. `docker compose restart` i comprovar que el qüestionari continua ahí (persistència del volum de Mongo).
5. Editar `src/server/server.js` (p. ex. un `console.log` temporal) amb l'estiba alçada i veure en `docker compose logs -f app` que `node --watch` reinicia sol, sense necessitat de `--build`.
6. Pujar una imatge en crear un qüestionari i comprovar que apareix en `src/public/uploads/quiz-images/` en l'amfitrió.
7. `docker compose down -v` al finalitzar, per a netejar els volums de prova.

## Pròxim pas: Pull Request

Una vegada el canvi funciona en l'entorn de desenvolupament i passa
`npm run lint` i `npm test` (vore [`TESTING.md`](../TESTING.md)), el pas
següent **no** és desplegar-ho directament: és obrir un Pull Request cap a
la branca `main` del repositori principal (`Edutictac/EduHoot`), perquè
algú el revise abans de fusionar-lo.

```bash
git push <el-teu-remot> <la-teua-branca>
gh pr create --repo Edutictac/EduHoot --base main \
  --head <el-teu-usuari>:<la-teua-branca> \
  --title "..." --body "..."
```

Una vegada fusionat a `main`, el següent pas del mateix camí (abans de
producció) és validar-ho en l'entorn de preproducció descrit en
[`STAGE_SETUP.md`](../STAGE_SETUP.md).
