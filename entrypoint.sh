#!/bin/sh
set -eu

mkdir -p public/uploads/quiz-images logs/finished-session-reports
chown -R app:app public/uploads logs

if [ "${AUTO_SEED_STAGE:-}" = "1" ] && [ "${NODE_ENV:-}" = "staging" ]; then
  su -s /bin/sh app -c "npm run seed:stage || true"
fi

exec su -s /bin/sh app -c "$*"
