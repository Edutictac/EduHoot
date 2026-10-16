# Imatge Docker en GitHub

La imatge d'EduHoot es distribueix com a paquet del repositori en GitHub
Container Registry:

```bash
docker pull ghcr.io/edutictac/eduhoot:1.0.5
```

És la mateixa imatge publicada en
`registry.edutictac.es/edutictac/eduhoot:1.0.5`: es copien les capes i es
comprova el digest, sense reconstruir el codi. L'aplicació necessita MongoDB;
el contenidor exposa el port 3000 i usa `MONGO_URL` per a connectar-s'hi.
Cal persistir `/app/public/uploads`, `/app/logs` i les dades de MongoDB.

## Publicar una versió existent

En **Actions → Publica la imatge Docker → Run workflow**, indica la versió
que ja existeix en el registre d'EduTicTac. El workflow publica únicament
eixa etiqueta; no modifica `latest` ni desplega l'aplicació.

El workflow usa el `GITHUB_TOKEN` temporal amb permís `packages: write`.
No necessita cap secret addicional. GitHub vincula el paquet al repositori.

GitHub crea els paquets nous amb visibilitat privada. Després de la primera
publicació, un administrador ha de seleccionar **Package settings → Change
visibility → Public** perquè es puga descarregar sense autenticar-se. La
visibilitat del repositori no fa públic el paquet automàticament.
