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

## Estat de la instal·lació (6-11-2026)

El timer `eduhoot-production-update.timer` està actiu al VPS. La clau privada
del drenatge està en `/opt/eduhoot/docker/eduhoot.env` i en
`deploy-readiness.header` (mode 600); GitHub no la té. nginx retorna 404 a
Internet per a les dos rutes internes. El VPS les consulta directament en
`127.0.0.1:3000`.

La primera versió `stage-2026.11.06-1` es va desplegar manualment amb còpia
prèvia en `/home/samgua/backups/eduhoot-bootstrap-20261106T171614Z-425312`.
Es va provar tornar a `eduhoot:1.0.13-claustro-20261102` i reinstal·lar la
nova imatge: les dos van arrancar sanes. La portada, l'API pública i
Socket.IO van donar HTTP 200; les rutes internes, 404 des d'Internet.

`main` encara no inclou tot el treball de la branca d'Eduardo. Les futures
etiquetes de stage han de continuar eixint de la seua branca sincronitzada
amb `main`, fins que faça el PR corresponent.

## Publicar després de la instal·lació

1. Publicar i provar una etiqueta `stage-*` segons
   [STAGE-AUTOMATIC.md](STAGE-AUTOMATIC.md).
2. En **Actions → Prepara una imatge per a producció → Run workflow**, triar
   `main` i escriure l'etiqueta exacta de stage.
3. Esperar el resultat del workflow i consultar
   `https://eduhoot.edutictac.es/.well-known/eduhoot-deployment.json` per a
   vore l'etiqueta que executa producció. El timer comprova cada dos minuts;
   si hi ha partides actives, ajorna el canvi fins que acaben. El registre
   detallat queda en `eduhoot-production-update.service` al VPS.

El desplegament reinicia el contenidor i les sessions en memòria. Cal evitar
promocions durant activitats del centre i revisar els canvis de dades abans
d'una versió que requerisca migracions.
