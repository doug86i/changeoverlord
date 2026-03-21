# Changeoverlord

Web app for festival **sound crew**: multi-day **schedules**, **changeovers**, **riders** / **stage plots**, collaborative **input patch** and **RF** grids, and **stage clocks**. Designed for **LAN / offline** deployment with optional cloud hosting.

**Powered by [Doug Hunt Sound & Light](https://www.doughunt.co.uk/).**

## Stack (implemented)

| Part | Tech |
|------|------|
| API | **Fastify** + **TypeScript**, **Drizzle ORM**, **PostgreSQL**, **Zod** |
| Web | **Vite** + **React** + **TypeScript**, **TanStack Query**, **React Router** |
| Realtime / grid | **WebSockets + Yjs + FortuneSheet** — planned (see [`docs/PLAN.md`](docs/PLAN.md)) |
| Deploy | **Docker Compose**: Postgres, Redis (for future sessions/pub-sub), single **Node** container serving **REST** + **static SPA** |

The API is mounted at **`/api/v1`**. The same origin serves the SPA for offline-friendly LAN use.

## Development process (local testing)

**Default:** after changes, deploy with **`make dev`** — same as **`docker compose up -d --build`** — so the **Compose file and image stay the source of truth**. No extra manual deploy steps. Full detail: **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** (includes Cursor/AI workflow).

## Quick start (Docker)

Requires [Docker](https://docs.docker.com/get-docker/) with Compose v2 on **Linux**, **macOS**, or **Windows** (Docker Desktop).

```bash
git clone https://github.com/doug86i/changeoverlord.git
cd changeoverlord
make dev
# same as: docker compose up -d --build
```

Open **http://\<server-ip\>** (default **port 80** — no `:port` in the URL).

- **`.env`**: optional — copy **`.env.example`**. Infrastructure only (`DATA_DIR`, `HOST_PORT`, `LOG_LEVEL`, …). Product settings (auth, branding, …) will live in the **app UI** as features land.
- **Offline after first image build**: no registry pull required once images are local.

### Fresh database

If you change schema during development, wipe the Postgres volume (or delete `data/db/`) before `docker compose up` so migrations apply cleanly. **Back up** `DATA_DIR` before doing this on a machine with real prep data.

## Local development (without rebuilding the image every time)

From the repo root (requires **Node.js 22+** and `npm`):

```bash
npm install
# Terminal 1 — API (default http://127.0.0.1:3000)
export DATABASE_URL=postgresql://stageops:stageops@127.0.0.1:5432/stageops
npm run dev -w api
# Terminal 2 — Vite dev server (proxies /api → :3000)
npm run dev -w web
```

Run Postgres locally or `docker compose up -d db redis` and point `DATABASE_URL` at `db`.

Production build:

```bash
npm run build
```

## What lives in Compose vs the UI

| In **Compose** / `.env` | In the **app UI** |
|-------------------------|-------------------|
| Data directory (`DATA_DIR`), host **port**, **`LOG_LEVEL`** | Passwords, branding, clocks copy, … |
| **`DATABASE_URL`**, **`SESSION_SECRET`** (Compose defaults; override in production) | — |
| Optional **shared password** (Settings UI) | — |

## Data directory (one place for DB, Redis, uploads)

All persistent state uses a **single host directory** — default **`./data`**.

| Subfolder | Role |
|-----------|------|
| `data/db/` | PostgreSQL files |
| `data/redis/` | Redis AOF (reserved for WS / sessions) |
| `data/uploads/` | User uploads (riders, plots, logos) — wired for future file APIs |

Set **`DATA_DIR`** in **`.env`** if needed. Details: **[data/README.md](data/README.md)**.

## Repository layout

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | Postgres, Redis, app (Node + built SPA) |
| `Dockerfile` | Multi-stage: build `web/` + `api/`, run Fastify |
| `api/` | REST API, Drizzle schema & SQL migrations |
| `web/` | Vite React SPA |
| `package.json` | npm workspaces (root) |
| `data/` | Persistent data root (`DATA_DIR`); see `data/README.md` |
| `.env.example` | Optional infrastructure env |
| `docs/PLAN.md` | Product vision, architecture, roadmap |
| `docs/DECISIONS.md` | Engineering decisions |
| `docs/DESIGN.md` | UI themes & tokens |
| `docs/DEVELOPMENT.md` | Local Docker workflow (`make dev`), AI deploy expectations |
| `docs/LICENSING.md` | Licences |
| `.cursor/rules/` | Cursor rules (e.g. auto-deploy to local Compose) |

## Status

Core **CRUD** for **events → stages → stage-days → performances**, **health** / **time** / **settings** stubs, **light/dark** UI shell, and **Docker** deployment are in place. **Collaborative spreadsheet (FortuneSheet + Yjs)**, **PDF plots**, **export/import packages**, and **optional auth** are next — see **[`docs/PLAN.md`](docs/PLAN.md)**.

## License

MIT — see [LICENSE](LICENSE).
