# Contribuir a EduHoot

## Valencià

Gràcies per l'interés en contribuir a EduHoot! Esta guia resumix el flux
de treball esperat per a proposar un canvi.

### Abans de començar

1. Fes un fork de [`Edutictac/EduHoot`](https://github.com/Edutictac/EduHoot)
   a la teua compte de GitHub.
2. Clona el teu fork i crea una branca pròpia a partir de `main`:
   ```bash
   git clone https://github.com/<el-teu-usuari>/EduHoot.git
   cd EduHoot
   git checkout -b <nom-descriptiu-de-la-branca>
   ```
3. Instal·la dependències i arranca l'app en local seguint l'"Inici ràpid"
   del [`README.md`](README.md), o la guia de Docker en desenvolupament
   [`docs/DEV_DOCKER_SETUP.md`](docs/DEV_DOCKER_SETUP.md) (`docker compose up`,
   amb 5 qüestionaris de mostra ja carregats).

### Abans d'obrir un Pull Request

- Executa la bateria de proves descrita en [`TESTING.md`](TESTING.md):
  ```bash
  cd src
  npm ci
  npm run lint
  npm test
  npm run test:i18n
  ```
- Si el canvi afecta a sessions o autenticació, prova també a mà el flux
  de login afectat (vore `TESTING.md`).
- Si el canvi toca el comportament d'una funcionalitat, actualitza
  [`ARCHITECTURE.md`](ARCHITECTURE.md) i, si aplica, el `README.md` — mantenint
  sincronitzats els tres idiomes.

### Obrir el Pull Request

```bash
git push <el-teu-remot> <la-teua-branca>
gh pr create --repo Edutictac/EduHoot --base main \
  --head <el-teu-usuari>:<la-teua-branca> \
  --title "..." --body "..."
```

Descriu clarament què canvia i per què. Un mantenidor revisarà el PR
abans de fusionar-lo.

### Després de fusionar-se

El canvi es valida en l'entorn de preproducció descrit en
[`STAGE_SETUP.md`](STAGE_SETUP.md) abans de promocionar-se a producció.

### Llicència

En contribuir, acceptes que el teu codi es publique sota la mateixa
llicència del projecte: GNU Affero General Public License v3.0 (AGPL-3.0).

## Castellano

¡Gracias por el interés en contribuir a EduHoot! Esta guía resume el
flujo de trabajo esperado para proponer un cambio.

### Antes de empezar

1. Haz un fork de [`Edutictac/EduHoot`](https://github.com/Edutictac/EduHoot)
   en tu cuenta de GitHub.
2. Clona tu fork y crea una rama propia a partir de `main`:
   ```bash
   git clone https://github.com/<tu-usuario>/EduHoot.git
   cd EduHoot
   git checkout -b <nombre-descriptivo-de-la-rama>
   ```
3. Instala dependencias y arranca la app en local siguiendo el "Inicio
   rápido" del [`README.md`](README.md), o la guía de Docker en
   desarrollo [`docs/DEV_DOCKER_SETUP.md`](docs/DEV_DOCKER_SETUP.md)
   (`docker compose up`, con 5 cuestionarios de ejemplo ya cargados).

### Antes de abrir un Pull Request

- Ejecuta la batería de pruebas descrita en [`TESTING.md`](TESTING.md):
  ```bash
  cd src
  npm ci
  npm run lint
  npm test
  npm run test:i18n
  ```
- Si el cambio afecta a sesiones o autenticación, prueba también a mano
  el flujo de login afectado (ver `TESTING.md`).
- Si el cambio toca el comportamiento de una funcionalidad, actualiza
  [`ARCHITECTURE.md`](ARCHITECTURE.md) y, si aplica, el `README.md` — manteniendo
  sincronizados los tres idiomas.

### Abrir el Pull Request

```bash
git push <tu-remoto> <tu-rama>
gh pr create --repo Edutictac/EduHoot --base main \
  --head <tu-usuario>:<tu-rama> \
  --title "..." --body "..."
```

Describe con claridad qué cambia y por qué. Un mantenedor revisará el PR
antes de fusionarlo.

### Después de fusionarse

El cambio se valida en el entorno de preproducción descrito en
[`STAGE_SETUP.md`](STAGE_SETUP.md) antes de promocionarse a producción.

### Licencia

Al contribuir, aceptas que tu código se publique bajo la misma licencia
del proyecto: GNU Affero General Public License v3.0 (AGPL-3.0).

## English

Thanks for your interest in contributing to EduHoot! This guide
summarizes the expected workflow for proposing a change.

### Before you start

1. Fork [`Edutictac/EduHoot`](https://github.com/Edutictac/EduHoot) to
   your own GitHub account.
2. Clone your fork and create your own branch from `main`:
   ```bash
   git clone https://github.com/<your-username>/EduHoot.git
   cd EduHoot
   git checkout -b <descriptive-branch-name>
   ```
3. Install dependencies and run the app locally following the "Quick
   start" section of [`README.md`](README.md), or the development Docker
   guide [`docs/DEV_DOCKER_SETUP.md`](docs/DEV_DOCKER_SETUP.md)
   (`docker compose up`, with 5 sample quizzes already loaded).

### Before opening a Pull Request

- Run the test suite described in [`TESTING.md`](TESTING.md):
  ```bash
  cd src
  npm ci
  npm run lint
  npm test
  npm run test:i18n
  ```
- If the change affects sessions or authentication, also test the
  affected login flow manually (see `TESTING.md`).
- If the change affects how a feature behaves, update
  [`ARCHITECTURE.md`](ARCHITECTURE.md) and, if relevant, `README.md` — keeping
  all three languages in sync.

### Opening the Pull Request

```bash
git push <your-remote> <your-branch>
gh pr create --repo Edutictac/EduHoot --base main \
  --head <your-username>:<your-branch> \
  --title "..." --body "..."
```

Clearly describe what changes and why. A maintainer will review the PR
before merging it.

### After merging

The change is validated in the pre-production environment described in
[`STAGE_SETUP.md`](STAGE_SETUP.md) before being promoted to production.

### License

By contributing, you agree that your code will be published under the
project's license: GNU Affero General Public License v3.0 (AGPL-3.0).
