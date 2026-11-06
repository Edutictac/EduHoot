# Desplegament de producció des de GitHub

## Funcionament

Eduardo (`eduardomillan`) i Samuel (`sasogu`) poden executar manualment el
workflow **Prepara una imatge per a producció** des de `main`, indicant una
etiqueta `stage-AAAA.MM.DD-N` existent. El workflow verifica que la imatge
publicada en stage correspon al commit de l'etiqueta i copia exactament les
mateixes capes a `ghcr.io/edutictac/eduhoot:prod-latest`. No té accés al VPS.

El VPS consulta eixa etiqueta cada dos minuts. Només accepta la imatge si el
contenidor `eduhoot-stage` està sa **i executa exactament la mateixa imatge**.
Per tant, si stage canvia entre la petició i la comprovació del VPS, no es
desplega la candidata. L'actualitzador també exigeix la comprovació de
partides documentada en [PRODUCTION-DEPLOY-READINESS.md](PRODUCTION-DEPLOY-READINESS.md).

Quan la candidata supera estes comprovacions, el VPS deté la creació de
partides noves, activa el manteniment, comprova que no queda cap partida,
guarda MongoDB, imatges pujades i configuració, i reinicia **només EduHoot**.
Si la nova imatge no es posa sana, torna a la imatge anterior. Una imatge que
ha fallat no es torna a provar automàticament. Els logs del servei systemd
registren el resultat. Cap etiqueta de GitHub desplega per si sola sense
passar per estes comprovacions.

La restauració automàtica canvia la imatge del contenidor. La còpia de MongoDB
queda disponible per a una restauració manual si una versió ha modificat les
dades de manera incompatible.

## Instal·lació inicial

**No activar el timer fins que l'endpoint de drenatge estiga en producció i
validat.** La imatge actual `eduhoot:1.0.13-claustro-20261102` encara no el
porta. Cal integrar la branca `feat/delegated-deploy-readiness` amb el treball
d'Eduardo, provar-la en stage i fer un primer desplegament manual amb còpia i
comprovació dels canvis de codi. `main` encara no conté tota la seua branca.

Després del primer desplegament manual, al VPS:

1. Crear una clau aleatòria de 32 bytes com a mínim. Guardar-la en
   `EDUHOOT_DEPLOY_READINESS_TOKEN` de `/opt/eduhoot/docker/eduhoot.env` i
   en `/opt/eduhoot/docker/deploy-readiness.header` com a línia
   `X-EduHoot-Deploy-Token: <clau>`, amb mode 600 i propietari `samgua`.
   No mostrar-la en la terminal, en els logs ni en GitHub.
2. Configurar nginx perquè `/api/internal/deploy-readiness` i
   `/api/internal/deploy-drain` retornen 404 a Internet. L'actualitzador
   consulta el port local 3000 directament.
3. Instal·lar `ops/production/eduhoot-update.sh` com
   `/usr/local/sbin/eduhoot-update.sh`, propietari root i mode 755. Instal·lar
   els dos fitxers systemd de `ops/production/` en `/etc/systemd/system/`.
4. Executar `sudo -u samgua /usr/local/sbin/eduhoot-update.sh --check` amb
   una candidata publicada i comprovar que identifica la mateixa imatge que
   stage. Provar també la negativa quan stage no coincidix o hi ha partida.
5. Fer `systemctl daemon-reload` i activar
   `eduhoot-production-update.timer`. Comprovar els logs després del primer
   cicle i fer una prova de restauració controlada abans d'usar-lo en classe.

## Publicar després de la instal·lació

1. Publicar i provar una etiqueta `stage-*` segons
   [STAGE-AUTOMATIC.md](STAGE-AUTOMATIC.md).
2. En **Actions → Prepara una imatge per a producció → Run workflow**, triar
   `main` i escriure l'etiqueta exacta de stage.
3. Esperar el resultat del workflow i del servei
   `eduhoot-production-update.service` al VPS. Si hi ha partides actives, el
   VPS ajornarà el canvi fins que acaben.

El desplegament reinicia el contenidor i les sessions en memòria. Cal evitar
promocions durant activitats del centre i revisar els canvis de dades abans
d'una versió que requerisca migracions.
