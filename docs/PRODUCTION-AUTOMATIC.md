# Desplegament de producció des de GitHub

## Funcionament

Eduardo (`eduardomillan`) i Samuel (`sasogu`) poden executar manualment el
workflow **Prepara una imatge per a producció** des de `main`. El workflow
detecta l'etiqueta `stage-AAAA.MM.DD-N` que executa stage i verifica que la imatge
publicada en stage correspon al commit de l'etiqueta i copia exactament les
mateixes capes a `ghcr.io/edutictac/eduhoot:prod-latest`. No té accés al VPS.

El workflow també comprova que el commit etiquetat en stage ja està en
`main`. El VPS consulta eixa etiqueta cada dos minuts. Només accepta la imatge si el
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

## Estat de la instal·lació (6-11-2026)

El timer `eduhoot-production-update.timer` està actiu al VPS. La clau privada
del drenatge està en `/opt/eduhoot/docker/eduhoot.env` i en
`deploy-readiness.header` (mode 600); GitHub no la té. nginx retorna 404 a
Internet per a les dos rutes internes. El VPS les consulta directament en
`127.0.0.1:3000`.

La primera versió `stage-2026.11.06-1` es va desplegar manualment amb còpia
prèvia en `/home/samgua/backups/eduhoot-bootstrap-20261106T171614Z-425312`.
Es va provar tornar a `eduhoot:1.0.13-claustro-20261102` i reinstal·lar la
nova imatge: les dos van arrancar sanes. A petició de l'usuari, es va deixar
**la imatge antiga en producció**. Còpia immediatament anterior a la
restauració: `/home/samgua/backups/eduhoot-before-restore-20261106T172628Z-443348`.
La candidata `stage-2026.11.06-1` queda ignorada per l'actualitzador; no es
reinstal·larà sola.

La imatge antiga no té l'API de drenatge. Només per al primer desplegament
futur des d'eixa imatge, l'actualitzador exigeix que l'última instantània de
partides estiga buida (o que no n'hi haja des de l'arrancada) **i** que no hi
haja connexions TCP al port 3000. Activa manteniment i repetix la comprovació
abans del reinici. Després, la nova imatge ja disposarà de l'API de drenatge.

`main` encara no inclou tot el treball de la branca d'Eduardo. El primer pas
és integrar en la seua branca `feat/delegated-deploy-readiness`, obrir un PR a
`main` i fusionar-lo després que passe el job `tests`. Eduardo pot fusionar
els seus propis PR; el push directe a `main` continua bloquejat. Després
d'això, les noves etiquetes de stage han d'eixir de `main`.

## Publicar després de la instal·lació

1. Fusionar a `main` un PR amb els canvis desitjats, quan el job `tests`
   estiga verd. Crear des de `main` una **etiqueta nova** `stage-*` i comprovar
   que es desplega bé en stage segons [STAGE-AUTOMATIC.md](STAGE-AUTOMATIC.md).
   `stage-2026.11.06-1` està ignorada perquè l'usuari va restaurar la versió
   anterior.
2. En **Actions → Prepara una imatge per a producció → Run workflow**, triar
   `main` i executar-lo. El workflow llig la versió activa de stage; no cal
   copiar cap etiqueta.
3. Esperar el resultat del workflow i consultar
   `https://eduhoot.edutictac.es/.well-known/eduhoot-deployment.json` per a
   vore l'etiqueta que executa producció. El timer comprova cada dos minuts;
   si hi ha partides actives, ajorna el canvi fins que acaben. El registre
   detallat queda en `eduhoot-production-update.service` al VPS.

El desplegament reinicia el contenidor i les sessions en memòria. Cal evitar
promocions durant activitats del centre i revisar els canvis de dades abans
d'una versió que requerisca migracions.
