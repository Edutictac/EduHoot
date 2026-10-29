# Entorn Stage en servidor

> **OBSOLET.** La instal·lació real de stage és amb Docker a
> `/opt/eduhoot-stage/` (compose, `eduhoot-stage.env`, desplegament automàtic
> des de `ghcr.io/edutictac/eduhoot-stage`). No hi ha `/opt/eduhoot-stage/src`,
> ni `/etc/eduhoot/stage.env`, ni `eduhoot-stage-server.service`. El document
> vigent és [docs/STAGE-AUTOMATIC.md](docs/STAGE-AUTOMATIC.md); este es
> conserva només com a referència històrica d'una instal·lació systemd manual
> que no s'usa.

Este document definix una preproducció (stage) aïllada per a validar canvis abans de passar a producció.

## Objectiu

- Codi separat en `/opt/eduhoot-stage/src`.
- Procés Node separat (`eduhoot-stage-server.service`).
- Port propi (`3100`).
- Host propi (`stage.tu-dominio`).
- Base de dades separada (`eduhoot_stage`).

## 1) Preparar el servidor

```bash
sudo mkdir -p /opt/eduhoot-stage/src
sudo mkdir -p /etc/eduhoot
sudo mkdir -p /var/log/eduhoot-stage
sudo chown -R $USER:$USER /opt/eduhoot-stage
sudo chown -R root:adm /var/log/eduhoot-stage
sudo chmod 755 /var/log/eduhoot-stage
```

## 2) Variables d'entorn de stage

```bash
sudo cp install-files/stage.env.example /etc/eduhoot/stage.env
sudo nano /etc/eduhoot/stage.env
sudo chmod 640 /etc/eduhoot/stage.env
```

Ajusta com a mínim:
- `PORT=3100`
- `MONGO_URL=mongodb://127.0.0.1:27017/eduhoot_stage`
- `PUBLIC_BASE_URL=https://stage.tu-dominio`

> **Avís:** hui este `/eduhoot_stage` no té cap efecte real. El nom de
> base de dades està fix en el codi (`DB_NAME` en `server.js`), que
> ignora el nom que porte `MONGO_URL` — stage llig i escriu la mateixa
> base `kahootDB` que producció, en compartir el mateix mongod. Vore
> `ARCHITECTURE.md` → "Deute tècnic conegut" per al detall i la
> solució recomanada (`MONGO_DB=eduhoot_stage` una vegada `DB_NAME`
> siga configurable).

## 3) Servici systemd de stage

```bash
sudo cp install-files/service/eduhoot-stage-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable eduhoot-stage-server
```

## 4) Nginx per a stage

```bash
sudo cp install-files/nginx/eduhoot-stage.conf /etc/nginx/sites-available/eduhoot-stage.conf
sudo ln -sf /etc/nginx/sites-available/eduhoot-stage.conf /etc/nginx/sites-enabled/eduhoot-stage.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 5) Desplegar a stage

```bash
cp scripts/deploy-stage.example.sh scripts/deploy-stage.sh
chmod +x scripts/deploy-stage.sh
```

Edita les variables en `scripts/deploy-stage.sh` i executa:

```bash
./scripts/deploy-stage.sh
```

Per a provar-ho sense copiar fitxers:

```bash
DRY_RUN=1 ./scripts/deploy-stage.sh
```

## 6) Checklist de validació fiable

```bash
curl -I http://127.0.0.1:3100/
curl -I https://stage.tu-dominio/
sudo systemctl --no-pager --full status eduhoot-stage-server
sudo tail -n 120 /var/log/eduhoot-stage/server.log
```

Validacions recomanades per cada canvi:
- Login i recuperació de contrasenya.
- Flux host/jugador complet amb 2 navegadors.
- Importació de CSV i arrancada de partida.
- Revisió visual ràpida de landing/create/host/player.
- `npm run lint` abans de desplegar.

## 7) Promoció a producció

Promociona només si stage està en verd:
- Lint OK.
- Auditoria de seguretat en el nivell esperat.
- Fluxos crítics validats.
- Sense errors recurrents en els logs.
