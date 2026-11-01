#!/usr/bin/env bash
set -Eeuo pipefail

# Run from the 1Panel Compose project directory.
cd "$(dirname "$0")"
# Reuse the running container's Compose project label so 1Panel and this script
# operate on the same project (and the same project-scoped named volumes).
if docker inspect pixcape >/dev/null 2>&1; then
  EXISTING_PROJECT="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' pixcape 2>/dev/null || true)"
  if [[ -n "$EXISTING_PROJECT" && "$EXISTING_PROJECT" != "<no value>" ]]; then
    export COMPOSE_PROJECT_NAME="$EXISTING_PROJECT"
  fi
fi
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')}"
export COMPOSE_PROJECT_NAME
COMMIT_SHA="${1:-}"
if [[ ! "$COMMIT_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: $0 <full-git-commit-sha>" >&2
  exit 2
fi

IMAGE="ghcr.io/maoyiren/pixcape"
NEW_TAG="sha-${COMMIT_SHA:0:7}"
ENV_FILE=".env"
LOCK_DIR=".cdpc-deploy.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another CDPC deployment appears to be running ($LOCK_DIR exists)." >&2
  exit 1
fi
cleanup() { rmdir "$LOCK_DIR" 2>/dev/null || true; }
trap cleanup EXIT

if [[ ! -f docker-compose.yml ]]; then
  echo "docker-compose.yml is missing from $(pwd)" >&2
  exit 1
fi

# Preserve the currently running image locally under a rollback tag before pulling.
ROLLBACK_TAG=""
CURRENT_ID="$(docker compose ps -q pixcape 2>/dev/null | head -n1 || true)"
if [[ -n "$CURRENT_ID" ]]; then
  CURRENT_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$CURRENT_ID" 2>/dev/null || true)"
  if [[ -n "$CURRENT_IMAGE_ID" ]]; then
    ROLLBACK_TAG="rollback-$(date -u +%Y%m%d%H%M%S)"
    docker image tag "$CURRENT_IMAGE_ID" "$IMAGE:$ROLLBACK_TAG"
    echo "Saved current image as $IMAGE:$ROLLBACK_TAG"
  fi
fi

ENV_BACKUP=""
if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env is missing. Create it in the 1Panel project directory before enabling deployment." >&2
  exit 1
fi
ENV_BACKUP="$(mktemp)"
cp -p "$ENV_FILE" "$ENV_BACKUP"

write_tag() {
  local tag="$1" tmp
  tmp="$(mktemp)"
  awk '!/^PIXSCAPE_IMAGE_TAG=/' "$ENV_FILE" > "$tmp"
  printf 'PIXSCAPE_IMAGE_TAG=%s\n' "$tag" >> "$tmp"
  cat "$tmp" > "$ENV_FILE"
  rm -f "$tmp"
}

rollback() {
  local status=$?
  if [[ "$status" -ne 0 ]]; then
    echo "Deployment failed; attempting rollback." >&2
    if [[ -n "$ROLLBACK_TAG" ]]; then
      write_tag "$ROLLBACK_TAG"
      docker compose up -d --no-build --remove-orphans || true
      for _ in $(seq 1 30); do
        CID="$(docker compose ps -q pixcape 2>/dev/null | head -n1 || true)"
        [[ -n "$CID" ]] || { sleep 2; continue; }
        HEALTH="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CID" 2>/dev/null || true)"
        APP_READY=0
        docker exec "$CID" wget -q -O /dev/null http://127.0.0.1/ && APP_READY=1 || true
        [[ "$HEALTH" == "healthy" && "$APP_READY" -eq 1 ]] && { echo "Rollback healthy: $ROLLBACK_TAG"; break; }
        sleep 2
      done
    else
      echo "No previously running container image was available for automatic rollback." >&2
    fi
    if [[ -n "$ENV_BACKUP" && -f "$ENV_BACKUP" ]]; then
      cp -p "$ENV_BACKUP" "$ENV_FILE"
    fi
  fi
  [[ -n "$ENV_BACKUP" ]] && rm -f "$ENV_BACKUP"
  cleanup
  return "$status"
}
trap rollback EXIT

if [[ -n "${CDPC_GHCR_USERNAME:-}" && -n "${CDPC_GHCR_TOKEN:-}" ]]; then
  printf '%s' "$CDPC_GHCR_TOKEN" | docker login ghcr.io --username "$CDPC_GHCR_USERNAME" --password-stdin
fi

write_tag "$NEW_TAG"
docker compose config -q
docker compose pull pixcape
docker compose up -d --no-build --remove-orphans

echo "Waiting for container health..."
healthy=0
for attempt in $(seq 1 60); do
  CID="$(docker compose ps -q pixcape 2>/dev/null | head -n1 || true)"
  if [[ -n "$CID" ]]; then
    HEALTH="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CID" 2>/dev/null || true)"
    APP_READY=0
    docker exec "$CID" wget -q -O /dev/null http://127.0.0.1/ && APP_READY=1 || true
    if [[ "$HEALTH" == "healthy" && "$APP_READY" -eq 1 ]]; then
      healthy=1
      break
    fi
    if [[ "$HEALTH" == "unhealthy" ]]; then
      docker compose logs --tail=150 pixcape >&2 || true
      break
    fi
  fi
  sleep 5
done

if [[ "$healthy" -ne 1 ]]; then
  echo "CDPC did not become healthy after deployment." >&2
  docker compose ps >&2 || true
  docker compose logs --tail=150 pixcape >&2 || true
  exit 1
fi

echo "CDPC deployment succeeded: $IMAGE:$NEW_TAG"
if [[ -n "$ENV_BACKUP" ]]; then rm -f "$ENV_BACKUP"; ENV_BACKUP=""; fi
trap cleanup EXIT
