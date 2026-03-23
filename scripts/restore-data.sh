#!/usr/bin/env sh
set -eu

if [ $# -ne 1 ]; then
  echo "Usage: ./scripts/restore-data.sh <backup-directory>"
  exit 1
fi

BACKUP_DIR=$1
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup directory not found: $BACKUP_DIR"
  exit 1
fi

if [ ! -f "$BACKUP_DIR/db.sql" ]; then
  echo "Missing file: $BACKUP_DIR/db.sql"
  exit 1
fi

if [ ! -f "$BACKUP_DIR/uploads.tgz" ]; then
  echo "Missing file: $BACKUP_DIR/uploads.tgz"
  exit 1
fi

echo "Stopping app service for restore"
docker compose stop app

echo "Restoring database from $BACKUP_DIR/db.sql"
docker compose exec -T db sh -c 'psql -U stageops -d stageops -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
docker compose exec -T db sh -c 'psql -U stageops -d stageops' <"$BACKUP_DIR/db.sql"

echo "Restoring uploads from $BACKUP_DIR/uploads.tgz"
mkdir -p "$ROOT_DIR/data"
rm -rf "$ROOT_DIR/data/uploads"
tar -xzf "$BACKUP_DIR/uploads.tgz" -C "$ROOT_DIR/data"

echo "Starting app service"
docker compose up -d app

echo "Restore complete"
