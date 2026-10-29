# Publicar en stage amb una etiqueta

L'entorn de preproducció és https://eduhoot-stage.edutictac.es. Té la seua
pròpia base de dades i el seu propi proveïdor d'Authentik: el que s'hi faça no
afecta producció. No l'indexen els cercadors i la part docent està protegida
amb usuari i contrasenya.

## Com es publica

1. Assegureu-vos que la branca conté `.github/workflows/stage-image.yml`
   (si treballeu en una branca pròpia, feu `git merge main` una vegada).
2. Creeu una etiqueta que comence per `stage-` i pugeu-la al repositori
   `Edutictac/EduHoot` (no al fork: les etiquetes del fork no activen res):

   ```bash
   git remote add edutictac https://github.com/Edutictac/EduHoot.git   # només la primera vegada
   git tag stage-2026.10.22-1
   git push edutictac stage-2026.10.22-1
   ```

3. GitHub Actions passa el lint i els tests, construïx la imatge i la publica
   en `ghcr.io/edutictac/eduhoot-stage` amb l'etiqueta i com a `latest`.
   El resultat es veu en la pestanya **Actions**.
4. El servidor comprova cada 2 minuts si `latest` ha canviat. Si és així, la
   desplega i espera que el contenidor estiga sa. Si no ho està en 2 minuts,
   torna a la versió anterior i no reintenta eixa imatge.

Només poden publicar les persones indicades en el workflow; per a la resta,
el workflow s'omet. Es pot publicar qualsevol commit: l'etiqueta no ha d'estar
en `main`.

> **Atenció amb el nivell de codi.** No etiqueteu des de `main` mentres `main`
> no incloga el refactor de la branca `fork_edumillan3t` (`MONGO_DB` i
> `seed:stage`). Eixe refactor és el que permet apuntar a `eduhoot_stage` i
> sembrar dades; sense ell, `server.js` fixa `DB_NAME = 'kahootDB'` i
> l'entrypoint falla. Feu l'etiqueta des d'un commit que fusione eixa branca
> amb `main` (per exemple una branca `stage-integration`).

## Què no fa

- No desplega mai en producció. Producció continua amb el procediment manual.
- GitHub no té cap credencial del servidor: és el servidor qui descarrega
  la imatge pública.

## Comprovar quina versió hi ha

La imatge porta les etiquetes OCI `org.opencontainers.image.version` (nom de
l'etiqueta) i `org.opencontainers.image.revision` (commit). Des del navegador,
el peu de pàgina (o `GET /api/version`) mostra la versió de `package.json`.

## Accés: docents i alumnat

### Docents

El personal docent entra amb l'autenticació bàsica del nginx del VPS (usuari
`stage`; la contrasenya la guarda l'administració d'EduTicTac). Dins de
l'aplicació, l'únic accés és el xip de compte d'EduTicTac: `/create/` carrega
`https://commons.edutictac.es/assets/account-widget.js`, que consulta la
sessió en `https://commons.edutictac.es/api/auth/session`.

Perquè el xip funcione, **Commons ha de permetre l'origen
`https://eduhoot-stage.edutictac.es`** (CORS amb credencials) en
`EDUTICTAC_ID_ALLOWED_ORIGINS` del seu `id-api`. Ja està configurat; per a
comprovar-ho (ha d'aparéixer `access-control-allow-origin:
https://eduhoot-stage.edutictac.es`):

```bash
curl -s -D - -o /dev/null -H "Origin: https://eduhoot-stage.edutictac.es" \
  https://commons.edutictac.es/api/auth/session | grep -i access-control
```

Si el xip no estiguera disponible, l'Authentik propi de stage es pot provar
sense passar per ell:
`https://eduhoot-stage.edutictac.es/api/auth/authentik/start?next=/create/`.

EduHoot decidix el rol docent per la claim `groups`. Si en tornar d'Authentik
apareix `/create/?authentik=error`, cal revisar que `AUTHENTIK_SCOPE` (en
`/opt/eduhoot-stage/eduhoot-stage.env`) incloga `groups`, o que Authentik
envie els grups dins de `profile`.

### Alumnat

Les rutes que necessita l'alumnat estan **obertes sense autenticació bàsica**,
de manera permanent, perquè només calga el PIN com en producció:

- `/join.html`, `/player/`, `/socket.io/`, `/api/`, `/js/`, `/css/`,
  `/fonts/`, `/icons/`, `/uploads/`, `/sw.js` i `/manifest.webmanifest`.

Continuen protegides amb usuari i contrasenya: `/`, `/create/`, `/host/`,
`/multiplayer/`, `/solo/` i `/admin-stats.html`.

Les cabeceres de proxy d'eixes rutes són a
`/etc/nginx/snippets/eduhoot-stage-proxy.conf`, i cada `location` oberta hi
fa `include` amb `auth_basic off`. Per a tornar a protegir-ho tot, lleveu
eixos blocs `location` del vhost i feu `systemctl reload nginx`; el vhost
original està guardat al costat amb el sufix `.bak-<data>`.

Conseqüència assumida: `/api/` oberta inclou també els endpoints de creació,
però exigixen sessió d'EduHoot i la base és d'exemple (`eduhoot_stage`), no
la de producció.

## Sembra de dades d'exemple

El seed és `src/scripts/seed-stage-data.js` (`npm run seed:stage`; desfer amb
`npm run unseed:stage`). Insereix 50 qüestionaris públics de primària i
secundària i **no crea cap usuari**: l'accés a stage va per Authentik. És
idempotent per `devSeedKey` i es nega a executar-se si `NODE_ENV` no és
`staging` o si `MONGO_DB` val `kahootDB` (la base de producció).

### Instal·lació real al VPS

El stage de producció **no** utilitza el disseny systemd de `STAGE_SETUP.md`
(pensat per a una instal·lació manual i ja obsolet). Corre amb Docker a
`/opt/eduhoot-stage/`:

- `compose.yml`: serveis `mongo` (`eduhoot-stage-mongo`, volum `mongo_data`,
  base `eduhoot_stage`) i `app` (`eduhoot-stage`, imatge
  `eduhoot-stage:current`, publicat només en `127.0.0.1:3100`).
- `eduhoot-stage.env`: variables del servei (permisos 600).
- `stage-update.sh` i `eduhoot-stage-update.timer`: desplegament automàtic
  cada 2 minuts des de `ghcr.io/edutictac/eduhoot-stage:latest`.
- `state/deployed` i `state/failed`: versió activa i imatge que ha fallat.

No hi ha `/opt/eduhoot-stage/src`, ni `/etc/eduhoot/stage.env`, ni cap servei
`eduhoot-stage-server.service`. Les variables del contenidor estan en
`/opt/eduhoot-stage/eduhoot-stage.env`.

### Sembra automàtica

L'`entrypoint.sh` de la imatge respecta `AUTO_SEED_STAGE`: si val `1` i
`NODE_ENV` és `staging`, executa `npm run seed:stage || true` abans d'arrancar
el servidor. Un error del seed no impedix l'arrancada, i el propi script es
nega a executar-se fora de `staging` o contra `kahootDB`.

En el VPS, `AUTO_SEED_STAGE=1` està definit en
`/opt/eduhoot-stage/eduhoot-stage.env`. Així, cada reinici o desplegament
comprova el seed (idempotent).

Sembra manual puntual, des del VPS:

```bash
docker exec -u app eduhoot-stage npm run seed:stage
docker exec -u app eduhoot-stage npm run unseed:stage
```
