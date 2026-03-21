# Development process — local Docker

Changeoverlord is developed **against the same path we ship**: **`docker compose`** builds the **API + SPA** image and runs it with **Postgres** and **Redis**, so local testing always matches what operators would run.

## Goal

- **No manual deploy steps** to the local test environment: one repeatable command brings the stack up with a fresh build.
- **Compose is the contract**: if it works in `docker compose up`, we trust it for LAN installs.

## Deploy to local testing (every time)

From the **repository root** (where `docker-compose.yml` lives):

```bash
make dev
```

This runs **`docker compose up -d --build`** — rebuilds the app image when `Dockerfile`, `api/`, `web/`, or workspace deps change, recreates the container if needed, and starts dependencies.

Aliases (same behaviour):

```bash
make deploy-local
make up
```

Stop the stack:

```bash
make dev-down
# or: docker compose down
```

## What gets exercised

| Piece | Role |
|-------|------|
| `docker-compose.yml` | Ports, `DATABASE_URL`, `WEB_PUBLIC_DIR`, healthchecks |
| `Dockerfile` | Multi-stage build: Vite → `public/`, `tsc` → `api/dist` |
| Postgres / Redis | Real DB and future session/WS use |

## Environment

- Optional **`.env`** next to `docker-compose.yml` — see **`.env.example`** (`HOST_PORT`, `DATA_DIR`, `LOG_LEVEL`).
- Default **HTTP**: `http://localhost/` (port **80**). Use **`HOST_PORT=8080`** if 80 is busy.

## Faster inner loop (optional, not required)

For UI-only or API-only work without rebuilding the image every time, you can run **Node** and **Vite** on the host (see **[README.md](../README.md)**). The **canonical** check before merge remains **`make dev`**.

## AI / Cursor workflow

Project rules tell the assistant to **run `make dev` (or equivalent `docker compose up -d --build`) after implementing changes** so the local stack stays live without asking you to deploy manually. See **`.cursor/rules/`**.

## Database resets

Schema changes use **Drizzle migrations**. If a dev database is in a bad state, stop Compose, remove **`data/db/`** (only on throwaway data), then `make dev` again. **Never delete production `DATA_DIR` without a backup.**
