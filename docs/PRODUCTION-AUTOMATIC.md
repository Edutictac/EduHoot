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
desplega la candidata.

Abans del canvi, l'actualitzador comprova que **no hi ha cap connexió oberta**
al port 3000 de l'app (el contenidor usa `network_mode: host`, de manera que
el VPS veu totes les connexions de nginx i de Socket.IO). Una partida en
directe manté sempre connexions obertes, així que, mentre n'hi haja, el canvi
s'ajorna al cicle següent sense comptar com a error. No cal cap ruta interna a
l'aplicació.

Quan no hi ha connexions, el VPS activa el manteniment, torna a comprovar-ho,
guarda MongoDB, imatges pujades i configuració, ho comprova una última vegada i
reinicia **només EduHoot**. Si la nova imatge no es posa sana, torna a la
imatge anterior. Una imatge que ha fallat no es torna a provar
automàticament. Cap etiqueta de GitHub desplega per si sola sense passar per
estes comprovacions.

## Avisos

L'actualitzador envia un avís per Telegram (credencials en
`/opt/eduhoot-stage/notify.env`, mode 600, les mateixes que stage) quan:

- desplega una versió nova;
- falla qualsevol pas (producció no sana, GHCR, còpia, salut de la nova
  imatge, restauració);
- una candidata porta més de 3 hores esperant perquè sempre hi ha connexions.

Cada problema s'avisa una sola vegada (estat en
`/opt/eduhoot/production-update-state/alerted`) i l'avís s'esborra quan
producció torna a estar al dia.

La restauració automàtica canvia la imatge del contenidor. La còpia de MongoDB
queda disponible per a una restauració manual si una versió ha modificat les
dades de manera incompatible.

## Estat de la instal·lació (6-11-2026)

El timer `eduhoot-production-update.timer` està actiu al VPS. GitHub no té
cap credencial del VPS.

La primera versió `stage-2026.11.06-1` es va desplegar manualment amb còpia
prèvia en `/home/samgua/backups/eduhoot-bootstrap-20261106T171614Z-425312`.
Es va provar tornar a `eduhoot:1.0.13-claustro-20261102` i reinstal·lar la
nova imatge: les dos van arrancar sanes. A petició de l'usuari, es va deixar
**la imatge antiga en producció**. Còpia immediatament anterior a la
restauració: `/home/samgua/backups/eduhoot-before-restore-20261106T172628Z-443348`.
La candidata `stage-2026.11.06-1` queda ignorada per l'actualitzador; no es
reinstal·larà sola.

### Canvi del 28-11-2026

Fins a esta data, l'actualitzador consultava les rutes internes
`/api/internal/deploy-readiness` i `/api/internal/deploy-drain`. Eixes rutes
mai van arribar a `main`, i per això, després de desplegar `stage-2026.11.27-4`,
el timer bloquejava tota candidata nova. Ara només comprova les connexions
obertes i ja no necessita `deploy-readiness.header` ni
`EDUHOOT_DEPLOY_READINESS_TOKEN`.

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
