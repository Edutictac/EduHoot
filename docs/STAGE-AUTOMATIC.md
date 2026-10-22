# Publicar en stage amb una etiqueta

L'entorn de preproducció és https://eduhoot-stage.edutictac.es. Està protegit
amb usuari i contrasenya (demaneu-los a l'administració d'EduTicTac) i no
l'indexen els cercadors. Té la seua pròpia base de dades i el seu propi
proveïdor d'Authentik: el que s'hi faça no afecta producció.

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

## Què no fa

- No desplega mai en producció. Producció continua amb el procediment manual.
- GitHub no té cap credencial del servidor: és el servidor qui descarrega
  la imatge pública.

## Comprovar quina versió hi ha

La imatge porta les etiquetes OCI `org.opencontainers.image.version` (nom de
l'etiqueta) i `org.opencontainers.image.revision` (commit).

## Sembra de dades d'exemple

El seed és `src/scripts/seed-stage-data.js` (`npm run seed:stage`; desfer amb
`npm run unseed:stage`). Insereix 50 qüestionaris públics de primària i
secundària i **no crea cap usuari**: l'accés a stage va per Authentik. És
idempotent per `devSeedKey` i es nega a executar-se si `NODE_ENV` no és
`staging` o si `MONGO_DB` val `kahootDB` (la base de producció).

### Instal·lació real al VPS

El stage de producció **no** utilitza el disseny systemd de
`docs/STAGE_SETUP.md` (pensat per a una instal·lació manual). Corre amb Docker
a `/opt/eduhoot-stage/`:

- `compose.yml`: serveis `mongo` (`eduhoot-stage-mongo`, volum `mongo_data`,
  base `eduhoot_stage`) i `app` (`eduhoot-stage`, imatge
  `eduhoot-stage:current`, publicat només en `127.0.0.1:3100`).
- `eduhoot-stage.env`: variables del servei (permisos 600).
- `stage-update.sh` i `eduhoot-stage-update.timer`: desplegament automàtic
  cada 2 minuts des de `ghcr.io/edutictac/eduhoot-stage:latest`.
- `state/deployed` i `state/failed`: versió activa i imatge que ha fallat.

No hi ha `/opt/eduhoot-stage/src`, ni `/etc/eduhoot/stage.env`, ni cap servei
`eduhoot-stage-server.service`. Per tant `AUTO_SEED_STAGE=1` **no té cap
efecte** en esta instal·lació: només el llegiria l'`ExecStartPre` del servei
systemd descrit a `docs/STAGE_SETUP.md`.

### Sembra automàtica

El `compose.yml` del VPS sobreescriu l'`entrypoint` de la imatge per a
replicar-lo i executar el seed abans d'arrancar:

```yaml
entrypoint:
  - /bin/sh
  - -c
  - |
    mkdir -p public/uploads/quiz-images logs/finished-session-reports
    chown -R app:app public/uploads logs
    exec su -s /bin/sh app -c 'npm run seed:stage || true; exec node server/server.js'
```

Així, cada reinici o desplegament comprova el seed (idempotent). L'`entrypoint`
està sobreescrit en el compose; si algun dia canvia `entrypoint.sh` a la
imatge, cal revisar esta còpia. Si es vol incorporar al repositori, el lloc
correcte és `entrypoint.sh` respectant `AUTO_SEED_STAGE`, i caldria publicar
un tag `stage-*` nou.

Sembra manual puntual, des del VPS:

```bash
docker exec -u app eduhoot-stage npm run seed:stage
docker exec -u app eduhoot-stage npm run unseed:stage
```
