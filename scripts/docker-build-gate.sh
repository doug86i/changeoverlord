#!/usr/bin/env sh
# Decide whether Docker images need rebuilding, and record stamps after builds.
# Used by the Makefile so `make dev` / `make dev-fast` skip `--build` when inputs are unchanged.
#
#   scripts/docker-build-gate.sh classic needs   # exit 0 => run compose with --build
#   scripts/docker-build-gate.sh classic stamp   # write stamp after a successful build
#   scripts/docker-build-gate.sh fast needs|stamp
#
# Override: FORCE_DOCKER_REBUILD=1 make dev  (always --build; still updates classic stamp on success)

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP_DIR="$ROOT/.docker"
CLASSIC_STAMP="$STAMP_DIR/classic-image.hash"
FAST_STAMP="$STAMP_DIR/fast-image.hash"

_aggregate_stream() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum | awk '{print $1}'
  else
    shasum -a 256 | awk '{print $1}'
  fi
}

# Hash everything that invalidates the production-style app image build (Dockerfile context).
classic_tree_hash() {
  (
    cd "$ROOT" || exit 1
    if git rev-parse --git-dir >/dev/null 2>&1; then
      git ls-files \
        Dockerfile docker-compose.yml docker-compose.dev.yml \
        package.json package-lock.json \
        api/package.json web/package.json \
        patches api web 2>/dev/null \
        | LC_ALL=C sort -u \
        | while IFS= read -r rel; do
            [ -n "$rel" ] || continue
            [ -f "$rel" ] || continue
            case "$rel" in
              */node_modules/*|*/dist/*|*/.cache/*) continue ;;
            esac
            if command -v sha256sum >/dev/null 2>&1; then
              sha256sum "$rel"
            else
              shasum -a 256 "$rel"
            fi
          done
    else
      for f in Dockerfile docker-compose.yml docker-compose.dev.yml package.json package-lock.json \
        api/package.json web/package.json; do
        if [ -f "$f" ]; then
          if command -v sha256sum >/dev/null 2>&1; then
            sha256sum "$f"
          else
            shasum -a 256 "$f"
          fi
        fi
      done
      if [ -d patches ]; then
        find patches -type f 2>/dev/null | LC_ALL=C sort | while IFS= read -r f; do
          if command -v sha256sum >/dev/null 2>&1; then
            sha256sum "$f"
          else
            shasum -a 256 "$f"
          fi
        done
      fi
      find api web -type f \
        ! -path '*/node_modules/*' ! -path '*/dist/*' ! -path '*/.cache/*' 2>/dev/null \
        | LC_ALL=C sort | while IFS= read -r f; do
          if command -v sha256sum >/dev/null 2>&1; then
            sha256sum "$f"
          else
            shasum -a 256 "$f"
          fi
        done
    fi
  ) | LC_ALL=C sort | _aggregate_stream
}

fast_image_hash() {
  (
    cd "$ROOT" || exit 1
    for f in Dockerfile.fast docker-compose.fast.yml; do
      [ -f "$f" ] || {
        echo "docker-build-gate: missing $f" >&2
        exit 2
      }
      if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$f"
      else
        shasum -a 256 "$f"
      fi
    done
  ) | LC_ALL=C sort | _aggregate_stream
}

mkdir -p "$STAMP_DIR"

case "$1" in
classic)
  case "$2" in
  needs)
    if [ "${FORCE_DOCKER_REBUILD:-}" = "1" ]; then
      exit 0
    fi
    current="$(classic_tree_hash)"
    if [ ! -f "$CLASSIC_STAMP" ]; then
      exit 0
    fi
    prev="$(cat "$CLASSIC_STAMP")"
    if [ "$current" != "$prev" ]; then
      exit 0
    fi
    exit 1
    ;;
  stamp)
    classic_tree_hash >"$CLASSIC_STAMP"
    ;;
  *)
    echo "usage: $0 classic needs|stamp" >&2
    exit 2
    ;;
  esac
  ;;
fast)
  case "$2" in
  needs)
    if [ "${FORCE_DOCKER_REBUILD:-}" = "1" ]; then
      exit 0
    fi
    current="$(fast_image_hash)"
    if [ ! -f "$FAST_STAMP" ]; then
      exit 0
    fi
    prev="$(cat "$FAST_STAMP")"
    if [ "$current" != "$prev" ]; then
      exit 0
    fi
    exit 1
    ;;
  stamp)
    fast_image_hash >"$FAST_STAMP"
    ;;
  *)
    echo "usage: $0 fast needs|stamp" >&2
    exit 2
    ;;
  esac
  ;;
*)
  echo "usage: $0 classic needs|stamp | fast needs|stamp" >&2
  exit 2
  ;;
esac
