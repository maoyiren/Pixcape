#!/bin/bash
set -eu

cd /opt/pixcape-next

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Applying PostgreSQL Prisma migrations..."
  npm run db:migrate
else
  echo "WARNING: DATABASE_URL is unset; database-backed account features are unavailable."
fi

node /opt/pixcape-ai-api/server.mjs &
AI_PID=$!
npm run next:start &
NEXT_PID=$!
nginx -g 'daemon off;' &
NGINX_PID=$!

shutdown() {
  kill "$AI_PID" "$NEXT_PID" "$NGINX_PID" 2>/dev/null || true
}
trap shutdown TERM INT

set +e
wait -n "$AI_PID" "$NEXT_PID" "$NGINX_PID"
STATUS=$?
shutdown
wait "$AI_PID" 2>/dev/null || true
wait "$NEXT_PID" 2>/dev/null || true
wait "$NGINX_PID" 2>/dev/null || true
exit "$STATUS"
