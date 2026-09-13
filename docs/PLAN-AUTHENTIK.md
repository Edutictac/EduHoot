# Plan: añadir Authentik como login en EduHoot

Estado: PENDIENTE (diseñado 2026-09-08, revisado 2026-09-13). Las fuentes de
Google **ya están autoalojadas**.

**Cambio de estrategia (2026-09-13):** ya no se plantea sustituir Google por
Authentik en producción. El objetivo final es distinto según el entorno:

- **`eduhoot.edutictac.es` (producción):** Google y Authentik **conviven** como
  dos opciones de login permanentes. El profesorado que ya usa Google sigue
  pudiendo hacerlo; Authentik añade SSO real del Commons para quien lo tenga.
  No hay fase de retirada de Google.
- **`edutictac-commons` (stack local Docker):** **solo Authentik**. Google
  nunca se configura en este entorno — desde 2026-09-13 el banner "Entrar con
  Google" ya se oculta automáticamente cuando `GOOGLE_CLIENT_ID`/`SECRET` no
  están definidos (endpoint `/api/auth/google/config`, ver commit
  `12e2822`). Cuando se añada el módulo Authentik al stack local (Fase 4 de
  `PLA-DESENVOLUPAMENT-LOCAL-DOCKER.md`, todavía no iniciado — el propio pla
  avisa de no introduir-lo massa aviat), EduHoot de Commons se conectará
  únicamente a ese Authentik local.

## Objetivo

- **Google Fonts** → HECHO (2026-09-08): Raleway, Tajawal, Inter y Poppins
  autoalojadas en `public/fonts/` + `public/css/fonts.css`
  (`src/scripts/fetch-fonts.mjs`). 0 referencias a `fonts.googleapis.com`.
- **Google OAuth (login)** → en producción, **añadir** Authentik junto a
  Google (no sustituirlo). En edutictac-commons, Authentik es la única opción
  (Google no se configura ahí).

## Fases

1. **[HECHO]** Autoalojar Google Fonts.
2. Añadir Authentik como login de EduHoot (espejo del flujo Google actual),
   visible junto al botón de Google cuando ambos estén configurados.
3. Desplegar el módulo Authentik en `edutictac-commons` (fuera del alcance de
   este documento — ver `PLA-DESENVOLUPAMENT-LOCAL-DOCKER.md`) y conectar
   EduHoot de Commons solo a ese Authentik, sin credenciales de Google.

## Fase 2 — Authentik como login (backend + frontend)

### Authentik (IdP)
- Provider OIDC + application "EduHoot":
  - `client_id`: `eduhoot.edutictac.es`
  - `redirect_uri`: `https://eduhoot.edutictac.es/api/auth/authentik/callback`
  - `grant_types`: `authorization_code` + `refresh_token` (⚠️ GOTCHA: por
    defecto queda vacío al crearlo por shell; hay que setearlo explícito).
  - `client_secret` en `pass edutictac/authentik-eduhoot-client-secret`.

### Backend (`src/server/server.js`) — espejo del flujo Google
- Constantes + endpoints `/api/auth/authentik/start` y
  `/api/auth/authentik/callback`.
- Flujo OIDC **authorization code + PKCE (S256)** con `crypto` + `https` nativo
  (sin dependencias nuevas, coherente con el estilo actual).
- `findOrCreateAuthentikUser(profile)`: busca por `email` (único); si existe →
  añade `authentikId` (sub) y `'authentik'` a `authProviders`; si no → crea
  (primer usuario sin admin = `admin`; resto `editor`).
- `createSession(user)` existente (cookie `sessionId`, sesión en memoria).
- Env: `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET`, `AUTHENTIK_ISSUER`,
  `AUTHENTIK_REDIRECT_URI`.

### Frontend (`public/create/index.html` + `public/js/create.js`)
- Botón "Entrar con EduTicTac" junto a Google (`#auth-google-hero`).
- `loginWithAuthentik()` → `/api/auth/authentik/start?next=...`.
- Manejo de `?authentik=ok/error`.
- i18n en 3 idiomas (valencià, castellano, inglés).

## Consideraciones

- **Identidad por email** (único): mismo email Google/Authentik se enlaza (no
  duplica). Campo `authProviders` ya preparado para multi-proveedor.
- Sesiones en memoria (se pierden al reiniciar el servidor), igual que con Google.
- Los usuarios Google existentes **no se migran automáticamente**: se enlazan al
  entrar con Authentik usando el mismo email.
- Si se elige la Fase 3 (Google como source en Authentik), el `sub` cambia (Authentik
  genera el suyo), pero el enlace sigue por `email`.

## Alternativa (descartada por ahora)

Centralizar todo en Authentik desde el inicio sin fase puente (quitar Google de
golpe). Más limpio, pero deja sin acceso a los usuarios de Google hasta que
entren por Authentik. La Fase 3 permite una transición sin cortar el acceso.

## Estado de Google en EduHoot (para auditoría)

- Login OAuth: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_CALLBACK_URL`
  (endpoints `/api/auth/google/start` y `/api/auth/google/callback`).
- `gsiApi`/`googleOAuth2Id` hardcodeado en el bundle del cliente
  (`public/js/*.js`, id `628119593973-...apps.googleusercontent.com`).
- Google Fonts: eliminado (autoalojado 2026-09-08).
