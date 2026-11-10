# Publicar en stage amb una etiqueta

L'entorn de preproducció és https://eduhoot-stage.edutictac.es. Té la seua
pròpia base de dades i el seu propi proveïdor d'Authentik: el que s'hi faça no
afecta producció. L'accés web és públic i no demana cap contrasenya del VPS.
Els cercadors poden indexar-lo.

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

> **Atenció amb el nivell de codi.** Les etiquetes han d'eixir d'una branca
> que fusione `fork_edumillan3t` amb `main`, no de `main` directament (a
> `main` només publica l'administració). El motiu és que `main` encara no
> inclou el refactor que permet apuntar a `eduhoot_stage` i sembrar dades;
> sense ell, `server.js` fixa `DB_NAME = 'kahootDB'` i l'entrypoint falla.
> Exemple: una branca `stage-integration`.

## Què no fa

- Una etiqueta de stage no desplega en producció. La promoció a producció
  requerix executar expressament el workflow corresponent de GitHub.
- GitHub no té cap credencial del servidor: és el servidor qui descarrega
  la imatge pública.

## Comprovar quina versió hi ha

La imatge porta les etiquetes OCI `org.opencontainers.image.version` (nom de
l'etiqueta) i `org.opencontainers.image.revision` (commit). Des del navegador,
el peu de pàgina (o `GET /api/version`) mostra la versió de `package.json`.

## Accés: docents i alumnat

### Docents

Qualsevol persona pot entrar a `/create/`, crear un qüestionari local i
organitzar una partida sense compte. Les proves de stage s'emmagatzemen en la
seua base de dades independent. Per a guardar qüestionaris en una biblioteca
personal, recuperar-los des d'un altre dispositiu o administrar-los, cal
iniciar sessió amb EduTicTac. El xip de compte de `/create/` carrega
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

### Alumnat i accés públic

La portada `/`, `/join.html`, `/player/`, `/solo/`, `/multiplayer/` i la resta
de rutes de stage estan obertes sense autenticació HTTP. L'alumnat entra a la
partida amb el PIN, com en producció. Les operacions de compte de l'API
continuen exigint una sessió d'EduHoot; la creació de qüestionaris locals és
pública. La base de dades és `eduhoot_stage`, separada de producció.

El vhost és `/etc/nginx/sites-available/eduhoot-stage.edutictac.es` i la
configuració anterior es va guardar en
`/etc/nginx/sites-available/eduhoot-stage.edutictac.es.bak-public-20261106T184253Z`.
El fitxer de contrasenyes HTTP anterior es va eliminar. `robots.txt` permet
l'accés i el vhost no envia `X-Robots-Tag: noindex`.

## Sembra de dades d'exemple

El seed és `src/scripts/seed-stage-data.js` (`npm run seed:stage`; desfer amb
`npm run unseed:stage`). Insereix 50 qüestionaris públics de primària i
secundària i **no crea cap usuari**: l'accés a stage va per Authentik. És
idempotent per `devSeedKey` i es nega a executar-se si `NODE_ENV` no és
`staging` o si `MONGO_DB` val `kahootDB` (la base de producció).

### Instal·lació real al VPS

El stage de producció es desplega automàticament des de GitHub (compose,
`eduhoot-stage.env`, actualitza cada 2 minuts). El disseny systemd de
`STAGE_SETUP.md` ja no s'utiliza.
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
