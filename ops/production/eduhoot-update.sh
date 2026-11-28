#!/usr/bin/env bash
# Instal·lar com a fitxer propietat de root; el timer l'executa com samgua.
set -euo pipefail
umask 077

COMPOSE_DIR=/opt/eduhoot/docker
COMPOSE_FILE=$COMPOSE_DIR/compose.yml
MAINTENANCE_FLAG=/var/www/eduhoot-maintenance/ON
STATE_DIR=/opt/eduhoot/production-update-state
STATUS_FILE=/var/www/eduhoot-deployment/current.json
REMOTE_IMAGE=ghcr.io/edutictac/eduhoot:prod-latest
SERVICE=eduhoot
STAGE_CONTAINER=eduhoot-stage
APP_PORT=3000
# Fitxer opcional (mode 600) amb TELEGRAM_TOKEN i TELEGRAM_CHAT_ID per als avisos.
NOTIFY_ENV=${EDUHOOT_NOTIFY_ENV:-/opt/eduhoot-stage/notify.env}
# Si una candidata espera més d'este temps per partides en curs, s'avisa una vegada.
WAIT_ALERT_SECONDS=${EDUHOOT_WAIT_ALERT_SECONDS:-10800}
CHECK_ONLY=false
[[ ${1:-} == --check ]] && CHECK_ONLY=true
[[ $# -le 1 && ( $# -eq 0 || $CHECK_ONLY == true ) ]] || { echo 'Ús: eduhoot-update.sh [--check]' >&2; exit 2; }

exec 9>/run/lock/eduhoot-production-update.lock
flock -n 9 || exit 0

log() { printf '%s\n' "$*" >&2; }
healthy() { [[ $(docker inspect "$SERVICE" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null) == healthy ]]; }
notify() {
  # Envia un avís per Telegram. El token no apareix en la línia d'ordres.
  [[ -r $NOTIFY_ENV ]] || { log "Avís no enviat (falta $NOTIFY_ENV): $1"; return 0; }
  (
    # shellcheck disable=SC1090
    . "$NOTIFY_ENV"
    printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$TELEGRAM_TOKEN" |
      curl --silent --max-time 20 -K - --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" \
        --data-urlencode "text=$1" >/dev/null
  ) || log 'No s’ha pogut enviar l’avís per Telegram.'
}
alert_once() {
  # Evita repetir el mateix avís cada dos minuts mentre el problema continua.
  local key=$1 message=$2
  [[ -f $STATE_DIR/alerted && $(<"$STATE_DIR/alerted") == "$key" ]] && return 0
  notify "$message"
  printf '%s\n' "$key" > "$STATE_DIR/alerted"
}
idle() {
  # Amb network_mode: host, tota connexió a l'app (nginx, Socket.IO) es veu ací.
  # Una partida en directe manté sempre connexions obertes; sense cap, no n'hi ha.
  [[ -z $(ss -H -tn state established "( sport = :$APP_PORT )") ]]
}
wait_for_games() {
  # Esperar partides no és un error: es torna a provar en el cicle següent.
  local since now
  now=$(date +%s)
  if [[ -f $STATE_DIR/waiting-since && $(cut -d' ' -f1 "$STATE_DIR/waiting-since") == "$candidate_id" ]]; then
    since=$(cut -d' ' -f2 "$STATE_DIR/waiting-since")
  else
    since=$now
    printf '%s %s\n' "$candidate_id" "$since" > "$STATE_DIR/waiting-since"
  fi
  log "$1 Es torna a provar en el cicle següent."
  if (( now - since >= WAIT_ALERT_SECONDS )); then
    alert_once "waiting $candidate_id" "EduHoot producció: $stage_tag espera des de fa $(( (now - since) / 3600 )) h perquè sempre hi ha connexions obertes. Revisa-ho si cal desplegar-la."
  fi
  exit 0
}
report_failure() {
  local status=$1
  (( status == 0 )) && return 0
  alert_once "failed $status ${last_error:-}" "EduHoot producció: l’actualitzador ha fallat (codi $status). ${last_error:-Revisa journalctl -u eduhoot-production-update.service.}"
}
fail() {
  last_error=$1
  log "$1"
  exit 1
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

last_error=
stage_tag=
candidate_id=
trap 'report_failure $?' EXIT
healthy || fail 'Producció no està sana; no es desplega.'
docker pull "$REMOTE_IMAGE" >/dev/null || fail 'No s’ha pogut descarregar la imatge candidata de GHCR.'
candidate_id=$(docker image inspect "$REMOTE_IMAGE" --format '{{.Id}}')
current_id=$(docker inspect "$SERVICE" --format '{{.Image}}')
mkdir -p "$STATE_DIR"
if [[ $candidate_id == "$current_id" ]]; then
  # Res a fer: es netegen els avisos d'un problema que ja no existix.
  rm -f "$STATE_DIR/alerted" "$STATE_DIR/waiting-since"
  exit 0
fi
if [[ -f $STATE_DIR/failed && $(<"$STATE_DIR/failed") == "$candidate_id" ]]; then
  log 'La imatge candidata ja va fallar; espera una nova publicació.'
  exit 0
fi
if [[ -f $STATE_DIR/ignored && $(<"$STATE_DIR/ignored") == "$candidate_id" ]]; then
  # L'usuari va restaurar la imatge anterior; cal una nova publicació explícita.
  exit 0
fi
stage_id=$(docker inspect "$STAGE_CONTAINER" --format '{{.Image}}')
stage_health=$(docker inspect "$STAGE_CONTAINER" --format '{{.State.Health.Status}}')
[[ $stage_health == healthy && $stage_id == "$candidate_id" ]] || fail 'La candidata de prod-latest no és la imatge activa i sana de stage.'
stage_tag=$(docker image inspect "$REMOTE_IMAGE" --format '{{index .Config.Labels "org.opencontainers.image.version"}}')
[[ $stage_tag =~ ^stage-[0-9]{4}\.[0-9]{2}\.[0-9]{2}-[0-9]+$ ]] || fail 'La candidata no porta una etiqueta stage vàlida.'
idle || wait_for_games "Hi ha connexions obertes a l'app (possible partida en curs)."
if $CHECK_ONLY; then
  log "Preparada per a promoure $stage_tag ($candidate_id)."
  exit 0
fi

backup_dir=
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
        last_error="$stage_tag no arranca i la restauració tampoc està sana: es manté el mode manteniment. Cal revisar-ho ja."
        log "$last_error"
        report_failure 1
        exit 1
      fi
      printf '%s\n' "$candidate_id" > "$STATE_DIR/failed"
      last_error="$stage_tag no ha passat la comprovació; s'ha restaurat la imatge anterior (còpia en $backup_dir). ${last_error:-}"
    fi
    if $maintenance; then sudo -n rm -f "$MAINTENANCE_FLAG"; fi
  fi
  report_failure "$status"
  exit "$status"
}
trap cleanup EXIT

sudo -n touch "$MAINTENANCE_FLAG"
maintenance=true
idle || wait_for_games 'Hi ha connexions obertes després d’activar el manteniment.'

backup_dir=/home/samgua/backups/eduhoot-production-$(date -u +%Y%m%dT%H%M%SZ)-$$
mkdir -m 700 "$backup_dir"
cp "$COMPOSE_FILE" "$backup_dir/compose.yml"
cp "$COMPOSE_DIR/eduhoot.env" "$backup_dir/eduhoot.env"
mongodump --db kahootDB --gzip --archive="$backup_dir/mongo.archive.gz" >/dev/null || fail 'Ha fallat la còpia de MongoDB; no es desplega.'
tar -C /opt/eduhoot/src/public -czf "$backup_dir/uploads.tgz" uploads || fail 'Ha fallat la còpia d’uploads; no es desplega.'
idle || wait_for_games 'Ha començat una connexió abans del reinici.'

docker tag "$REMOTE_IMAGE" "eduhoot-prod:$stage_tag"
set_compose_image "eduhoot-prod:$stage_tag"
deployment_started=true
docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate "$SERVICE"
wait_healthy || fail 'La nova imatge no ha passat la comprovació de salut.'
[[ $(docker inspect "$SERVICE" --format '{{.Image}}') == "$candidate_id" ]] || fail 'La imatge en execució no coincidix.'
printf '%s %s\n' "$stage_tag" "$candidate_id" > "$STATE_DIR/deployed"
printf '{"tag":"%s","imageId":"%s","updatedAt":"%s"}\n' \
  "$stage_tag" "$candidate_id" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" |
  sudo -n install -o root -g root -m 0644 /dev/stdin "$STATUS_FILE"
sudo -n rm -f "$MAINTENANCE_FLAG"
maintenance=false
completed=true
rm -f "$STATE_DIR/alerted" "$STATE_DIR/waiting-since"
log "Desplegat $stage_tag; còpia en $backup_dir."
notify "EduHoot producció: desplegada $stage_tag. Còpia prèvia en $backup_dir."
