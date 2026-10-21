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
