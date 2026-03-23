#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

STAMP=$(date +"%Y%m%d-%H%M%S")
OUT_DIR="$ROOT_DIR/backups/$STAMP"
mkdir -p "$OUT_DIR"

echo "Creating backup in $OUT_DIR"

docker compose exec -T db sh -c 'pg_dump -U stageops -d stageops' >"$OUT_DIR/db.sql"

if [ -d "$ROOT_DIR/data/uploads" ]; then
  tar -czf "$OUT_DIR/uploads.tgz" -C "$ROOT_DIR/data" uploads
else
  mkdir -p "$OUT_DIR/empty"
  tar -czf "$OUT_DIR/uploads.tgz" -C "$OUT_DIR" empty
  rm -rf "$OUT_DIR/empty"
fi

cat >"$OUT_DIR/README.txt" <<EOF
Backup created: $STAMP
Files:
- db.sql
- uploads.tgz
Restore:
  ./scripts/restore-data.sh "$OUT_DIR"
EOF

echo "Backup complete: $OUT_DIR"
