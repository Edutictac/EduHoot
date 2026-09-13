#!/bin/sh
set -eu

mkdir -p public/uploads/quiz-images logs/finished-session-reports
chown -R app:app public/uploads logs

exec su -s /bin/sh app -c "$*"
