#!/usr/bin/env bash
set -euo pipefail

REMOTE_USER_HOST="${REMOTE_USER_HOST:-user@example.org}"
REMOTE_PORT="${REMOTE_PORT:-22}"
REMOTE_BASE_DIR="${REMOTE_BASE_DIR:-/opt/eduhoot-stage/src}"
LOCAL_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/src/scripts/seed-stage-data.js"
REMOTE_SCRIPT_DIR="${REMOTE_BASE_DIR}/scripts"
REMOTE_SCRIPT_PATH="${REMOTE_SCRIPT_DIR}/seed-stage-data.js"
MODE="${1:-seed}"

if [[ ! -f "${LOCAL_SCRIPT}" ]]; then
  echo "No existe el script local: ${LOCAL_SCRIPT}" >&2
  exit 1
fi

case "${MODE}" in
  seed)
    REMOTE_ARGS=""
    ;;
  unseed)
    REMOTE_ARGS="--remove"
    ;;
  *)
    echo "Uso: $0 [seed|unseed]" >&2
    exit 1
    ;;
esac

echo "Subiendo script a ${REMOTE_USER_HOST}:${REMOTE_SCRIPT_PATH}"
ssh -p "${REMOTE_PORT}" "${REMOTE_USER_HOST}" "mkdir -p '${REMOTE_SCRIPT_DIR}'"
scp -P "${REMOTE_PORT}" "${LOCAL_SCRIPT}" "${REMOTE_USER_HOST}:${REMOTE_SCRIPT_PATH}"

echo "Ejecutando en remoto (${MODE})"
ssh -p "${REMOTE_PORT}" "${REMOTE_USER_HOST}" "cd '${REMOTE_BASE_DIR}' && node scripts/seed-stage-data.js ${REMOTE_ARGS}"

echo "Proceso completado."
