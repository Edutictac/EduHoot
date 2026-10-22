# Entorn Stage en servidor

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
- `MONGO_DB=eduhoot_stage`
- `PUBLIC_BASE_URL=https://stage.tu-dominio`

> **Important:** cal definir `MONGO_DB=eduhoot_stage` (ja present en
> `install-files/stage.env.example`). `DB_NAME` en `server.js` ara és
> configurable (`process.env.MONGO_DB || 'kahootDB'`), però si
> s'oblida esta variable, stage tornaria a llegir i escriure la base
> `kahootDB` real de producció en compartir el mateix mongod.

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

## 6) Sembrar quizzes d'exemple

Hi ha un script independent (`src/scripts/seed-stage-data.js`) que insertix
50 quizzes d'exemple de primària i secundària (música, informàtica,
matemàtiques, llengües, ciències, anglés, educació física...) en la BD de
stage, sense crear cap usuari (l'autenticació en stage ja va per Authentik
d'EduTicTac). És idempotent (no duplica si ja existixen) i es pot desfer amb
`--remove`. Mai s'executa si `NODE_ENV` no és `staging` o si `MONGO_DB` val
`kahootDB` (el nom de la BD de producció).

**Qui ho pot llançar**: qualsevol persona amb accés SSH al VPS de stage —
les mateixes autoritzades hui per a `deploy-stage.sh` (les indicades en
`.github/workflows/stage-image.yml` per a publicar tags). No cal cap
credencial nova.

**Com, manual (per defecte)** — des de l'equip local, sense entrar a mà per
SSH:

```bash
./scripts/seed-stage-data-remote.sh seed      # sembrar
./scripts/seed-stage-data-remote.sh unseed    # desfer
```

o, ja connectat per SSH en `/opt/eduhoot-stage/src`:

```bash
npm run seed:stage
npm run unseed:stage
```

**Com, automàtic (apagat per defecte)** — si es definix `AUTO_SEED_STAGE=1`
en `/etc/eduhoot/stage.env` (vore `install-files/stage.env.example`), el
mateix `eduhoot-stage-server.service` siembra en cada arrancada o reinici
(via `ExecStartPre`), sense intervenció manual. Mentres eixa variable no
estiga definida, no fa res.

## 7) Checklist de validació fiable

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

## 8) Promoció a producció

Promociona només si stage està en verd:
- Lint OK.
- Auditoria de seguretat en el nivell esperat.
- Fluxos crítics validats.
- Sense errors recurrents en els logs.
