#!/usr/bin/env bash
# Instal·lar com a fitxer propietat de root; el timer l'executa com samgua.
set -euo pipefail
umask 077

COMPOSE_DIR=/opt/eduhoot/docker
COMPOSE_FILE=$COMPOSE_DIR/compose.yml
HEADER_FILE=$COMPOSE_DIR/deploy-readiness.header
MAINTENANCE_FLAG=/var/www/eduhoot-maintenance/ON
STATE_DIR=/opt/eduhoot/production-update-state
REMOTE_IMAGE=ghcr.io/edutictac/eduhoot:prod-latest
SERVICE=eduhoot
STAGE_CONTAINER=eduhoot-stage
READY_URL=http://127.0.0.1:3000/api/internal/deploy-readiness
DRAIN_URL=http://127.0.0.1:3000/api/internal/deploy-drain
CHECK_ONLY=false
[[ ${1:-} == --check ]] && CHECK_ONLY=true
[[ $# -le 1 && ( $# -eq 0 || $CHECK_ONLY == true ) ]] || { echo 'Ús: eduhoot-update.sh [--check]' >&2; exit 2; }

exec 9>/run/lock/eduhoot-production-update.lock
flock -n 9 || exit 0

log() { printf '%s\n' "$*" >&2; }
healthy() { [[ $(docker inspect "$SERVICE" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null) == healthy ]]; }
ready() {
  curl --silent --fail --max-time 5 -H "@$HEADER_FILE" "$READY_URL" |
    python3 -c 'import json,sys
try:
    state=json.load(sys.stdin)
except (ValueError, UnicodeError):
    raise SystemExit(1)
raise SystemExit(0 if isinstance(state, dict) and state.get("ready") is True and state.get("activeGames") == 0 else 1)'
}
drain() {
  local enabled=$1
  curl --silent --show-error --fail --max-time 5 -H "@$HEADER_FILE" \
    -H 'Content-Type: application/json' --data "{\"enabled\":$enabled}" "$DRAIN_URL" >/dev/null
}
wait_healthy() {
  local attempt
  for attempt in $(seq 1 24); do
    if healthy && curl --silent --show-error --fail --max-time 5 -o /dev/null http://127.0.0.1:3000/; then
      return 0
    fi
    sleep 5
  done
  return 1
}
set_compose_image() {
  local image=$1
  python3 - "$COMPOSE_FILE" "$image" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
image = sys.argv[2]
if not re.fullmatch(r'eduhoot-prod:stage-[0-9]{4}\.[0-9]{2}\.[0-9]{2}-[0-9]+', image):
    raise SystemExit('Nom d’imatge no vàlid')
text = path.read_text()
updated, count = re.subn(r'(?m)^([ \t]*image:[ \t]*)\S+([ \t]*)$', lambda m: m[1] + image + m[2], text)
if count != 1:
    raise SystemExit('El compose ha de tindre exactament una línia image:')
temporary = path.with_suffix('.new')
temporary.write_text(updated)
temporary.replace(path)
PY
}

[[ -f $HEADER_FILE && $(stat -c %a "$HEADER_FILE") == 600 ]] || { log 'Falta la capçalera privada de desplegament (mode 600).'; exit 1; }
healthy || { log 'Producció no està sana; no es desplega.'; exit 1; }
docker pull "$REMOTE_IMAGE" >/dev/null
candidate_id=$(docker image inspect "$REMOTE_IMAGE" --format '{{.Id}}')
current_id=$(docker inspect "$SERVICE" --format '{{.Image}}')
[[ $candidate_id != "$current_id" ]] || exit 0
mkdir -p "$STATE_DIR"
if [[ -f $STATE_DIR/failed && $(<"$STATE_DIR/failed") == "$candidate_id" ]]; then
  log 'La imatge candidata ja va fallar; espera una nova publicació.'
  exit 0
fi
stage_id=$(docker inspect "$STAGE_CONTAINER" --format '{{.Image}}')
stage_health=$(docker inspect "$STAGE_CONTAINER" --format '{{.State.Health.Status}}')
[[ $stage_health == healthy && $stage_id == "$candidate_id" ]] || { log 'La candidata no és la imatge activa i sana de stage.'; exit 1; }
stage_tag=$(docker image inspect "$REMOTE_IMAGE" --format '{{index .Config.Labels "org.opencontainers.image.version"}}')
[[ $stage_tag =~ ^stage-[0-9]{4}\.[0-9]{2}\.[0-9]{2}-[0-9]+$ ]] || { log 'La candidata no porta una etiqueta stage vàlida.'; exit 1; }
ready || { log 'La comprovació de partides no està disponible o hi ha una partida activa.'; exit 1; }
if $CHECK_ONLY; then
  log "Preparada per a promoure $stage_tag ($candidate_id)."
  exit 0
fi

backup_dir=
drained=false
maintenance=false
deployment_started=false
completed=false
cleanup() {
  local status=$?
  trap - EXIT
  if ! $completed; then
    if $deployment_started && [[ -n $backup_dir ]]; then
      log 'El desplegament ha fallat. Es restaura la imatge anterior.'
      cp "$backup_dir/compose.yml" "$COMPOSE_FILE"
      docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate "$SERVICE" || true
      if ! wait_healthy; then
        log 'La restauració no està sana: es manté el mode manteniment.'
        exit 1
      fi
      printf '%s\n' "$candidate_id" > "$STATE_DIR/failed"
    fi
    if $drained; then drain false || true; fi
    if $maintenance; then sudo -n rm -f "$MAINTENANCE_FLAG"; fi
  fi
  exit "$status"
}
trap cleanup EXIT

drain true
drained=true
sudo -n touch "$MAINTENANCE_FLAG"
maintenance=true
ready || { log 'Hi ha partides actives després de bloquejar-ne de noves.'; exit 75; }

backup_dir=/home/samgua/backups/eduhoot-production-$(date -u +%Y%m%dT%H%M%SZ)-$$
mkdir -m 700 "$backup_dir"
cp "$COMPOSE_FILE" "$backup_dir/compose.yml"
cp "$COMPOSE_DIR/eduhoot.env" "$backup_dir/eduhoot.env"
mongodump --db kahootDB --gzip --archive="$backup_dir/mongo.archive.gz" >/dev/null
tar -C /opt/eduhoot/src/public -czf "$backup_dir/uploads.tgz" uploads
ready || { log 'Ha començat una partida abans del reinici.'; exit 75; }

docker tag "$REMOTE_IMAGE" "eduhoot-prod:$stage_tag"
set_compose_image "eduhoot-prod:$stage_tag"
deployment_started=true
docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate "$SERVICE"
wait_healthy || { log 'La nova imatge no ha passat la comprovació de salut.'; exit 1; }
[[ $(docker inspect "$SERVICE" --format '{{.Image}}') == "$candidate_id" ]] || { log 'La imatge en execució no coincidix.'; exit 1; }
printf '%s %s\n' "$stage_tag" "$candidate_id" > "$STATE_DIR/deployed"
sudo -n rm -f "$MAINTENANCE_FLAG"
maintenance=false
completed=true
log "Desplegat $stage_tag; còpia en $backup_dir."
