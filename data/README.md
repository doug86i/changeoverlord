# Data directory (`DATA_DIR`)

**Documentation index:** [`../docs/README.md`](../docs/README.md).

Everything that must **survive restarts** lives under this single tree so you can:

- Move it to a **larger disk** (set `DATA_DIR` in `.env` to an absolute path)
- **Back up** one folder on a schedule
- **Browse** contents with ordinary file tools (see below)

Default location is **`./data`** next to `docker-compose.yml`. Override with **`DATA_DIR`** in `.env` (see `.env.example`). On **Windows** with Docker Desktop, use forward slashes, e.g. `DATA_DIR=C:/changeoverlord/data`.

## Layout

| Path | Contents |
|------|----------|
| **`db/`** | PostgreSQL data directory (cluster files). |
| **`uploads/`** | User-uploaded files (riders, plots, templates, etc.) — used by the app container. |
| **`logs/`** | Fast dev stack only: optional **`client-debug.ndjson`** from **`POST /api/v1/debug/client-log`** (patch collab troubleshooting). Created when the API first appends a line. |

Create these automatically: they appear the first time you run Compose (Docker creates the host paths when binding mounts).

## Backup

1. Prefer **quiet traffic** or **stop** the stack: `docker compose down`, **`make dev-down`**, or **`make dev-fast-down`** (whichever stack you started).
2. Copy or archive the **entire** `DATA_DIR` directory (e.g. `tar czf changeoverlord-data.tgz -C /parent data` if `DATA_DIR=/parent/data`).

Restoring: extract into the same paths, fix ownership if needed (`chown` for Postgres UIDs on Linux), then start Compose again.

## Permissions (Linux)

If `DATA_DIR` is on a mounted disk, ensure the Docker user can write there. Postgres expects to own its data dir inside the container; host UID mapping may require `chown` or matching volume options — see Docker docs if restores fail to start.
