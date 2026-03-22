#!/usr/bin/env sh
# Same logic as `make dev-fast` for environments without Make (e.g. npm on Windows + Git Bash).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
COMPOSE_FAST="docker compose -f docker-compose.fast.yml"
GATE="$ROOT/scripts/docker-build-gate.sh"
if [ "${FORCE_DOCKER_REBUILD:-}" = "1" ]; then
  $COMPOSE_FAST build && $COMPOSE_FAST up -d && "$GATE" fast stamp
elif "$GATE" fast needs; then
  $COMPOSE_FAST build && $COMPOSE_FAST up -d && "$GATE" fast stamp
else
  $COMPOSE_FAST up -d
fi
