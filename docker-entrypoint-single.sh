#!/bin/bash
set -eu

cd /opt/pixcape-next

: "${DATABASE_URL:?DATABASE_URL is required. CDPC supports PostgreSQL only.}"
case "$DATABASE_URL" in
  postgres://*|postgresql://*) ;;
  *)
    echo "CDPC supports PostgreSQL only. DATABASE_URL must use postgres:// or postgresql://." >&2
    exit 1
    ;;
esac

echo "Applying PostgreSQL Prisma migrations..."
npm run db:migrate

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
