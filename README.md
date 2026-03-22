# Changeoverlord

Web app for festival **sound crew**: multi-day **schedules**, **changeovers**, **riders** / **stage plots**, collaborative **input patch** and **RF** grids, and **stage clocks**. Built for **LAN / offline** use at shows; the same stack can be hosted online later.

**Powered by [Doug Hunt Sound & Light](https://www.doughunt.co.uk/).**

---

## Quick start (Docker)

**Requirements:** [Docker](https://docs.docker.com/get-docker/) with Compose v2 (Linux, macOS, or Windows with Docker Desktop).

```bash
git clone https://github.com/doug86i/changeoverlord.git
cd changeoverlord
make dev
# same as: docker compose up -d --build
```

Open **http://\<this-machine\>/** — default **port 80** (no `:port` in the URL). If port 80 is busy, set **`HOST_PORT`** in **`.env`** (copy from **`.env.example`**) and use that port instead.

- **`.env`** is optional and **infrastructure-only** (paths, port, log level, secrets for Compose). Product behaviour (password, schedules, etc.) lives in the **app**.
- After the first image build, runtime can be **offline** — no registry pull needed for already-local images.

**Fresh database during development:** if migrations get out of sync, stop Compose and remove **`data/db/`** (only on throwaway data), then run **`make dev`** again. **Back up `DATA_DIR`** before wiping on a machine with real prep data.

More detail (aliases, stopping the stack, **`patches/`**, speeding up image builds): **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)**.

---

## What’s in the box

| Layer | Technology |
|-------|----------------|
| API | **Fastify**, **TypeScript**, **Drizzle ORM**, **PostgreSQL**, **Zod** |
| Web | **Vite**, **React**, **TypeScript**, **TanStack Query**, **React Router** |
| Live schedule / lists | **SSE** `GET /api/v1/realtime` + TanStack cache invalidation |
| Patch / RF workbook | **WebSockets**, **Yjs**, **FortuneSheet** |
| Deploy | **Docker Compose**: Postgres + one **Node** container serving **REST** + **static SPA** |

The API lives at **`/api/v1`**. The browser loads the SPA from the **same origin** (good for cookies and LAN use).

---

## Documentation

| Doc | Audience |
|-----|----------|
| **This file** | Overview and **how to run** the stack |
| **[`docs/README.md`](docs/README.md)** | **Index** of all docs (humans vs agents) |
| **[`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)** | **Operators** — using events, patch/RF, templates, clocks |
| **[`docs/MAINTAINING_DOCS.md`](docs/MAINTAINING_DOCS.md)** | **Contributors** — when and how to update docs |
| **[`docs/PLAN.md`](docs/PLAN.md)** | Product vision and roadmap |
| **[`docs/FEATURE_REQUIREMENTS.md`](docs/FEATURE_REQUIREMENTS.md)** | User-journey analysis, competitive research, feature requirements |
| **[`docs/DECISIONS.md`](docs/DECISIONS.md)** | Engineering decisions |
| **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** | Docker workflow, **`patches/`**, faster rebuilds, dev tips |
| **[`docs/REALTIME.md`](docs/REALTIME.md)** | Live updates (SSE) vs collaborative grid (Yjs) |
| **[`docs/PATCH_TEMPLATE_JSON.md`](docs/PATCH_TEMPLATE_JSON.md)** | Patch template **JSON** upload — file shape and API |
| **[`docs/CODEBASE_REVIEW.md`](docs/CODEBASE_REVIEW.md)** | **Contributors** — engineering audit backlog (known issues, doc drift) |
| **[`docs/LOGGING.md`](docs/LOGGING.md)** | Structured logging (`LOG_LEVEL`, `req.log`, web `logDebug`) |
| **[`docs/DESIGN.md`](docs/DESIGN.md)** | UI themes and tokens |
| **[`docs/LICENSING.md`](docs/LICENSING.md)** | Licences |
| **[`docs/HANDOVER.md`](docs/HANDOVER.md)** | **New machine or teammate** — clone, env, data move |
| **[`CHANGELOG.md`](CHANGELOG.md)** | **What changed** — unreleased fixes/features and version history |

**AI assistants and architecture rules:** **[`AGENTS.md`](AGENTS.md)** (not required for deploy-only readers).

---

## Build only (CI / sanity check)

The interactive app is always tested via **Docker** above. To compile **`web/`** + **`api/`** without Compose (e.g. CI), from the repo root: **`npm install`** then **`npm run build`**. See **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)**.

---

## Compose vs app settings

| In **Compose** / **`.env`** | In the **app UI** |
|-----------------------------|-------------------|
| `DATA_DIR`, host **port**, `LOG_LEVEL`, DB URL, `SESSION_SECRET` | Shared password, schedules, clocks content, … |

---

## Data directory

Persistent data defaults to **`./data`** on the host (`data/db/`, `data/uploads/`). Override with **`DATA_DIR`**. See **[`data/README.md`](data/README.md)**.

---

## Repository layout

| Path | Role |
|------|------|
| `docker-compose.yml` | Postgres + app |
| `Dockerfile` | Build `web/` + `api/`, run Fastify |
| `api/` | REST API, Drizzle schema, migrations |
| `web/` | Vite React SPA |
| `docs/` | Documentation — start at **[`docs/README.md`](docs/README.md)** |
| `AGENTS.md` | Rules for AI assistants and core architecture work |
| `.cursor/rules/` | Cursor automation rules |
| `.env.example` | Example infrastructure env |

---

## Current status

**Shipped in this repo:** Full **events → stages → stage-days → performances** CRUD with **inline editing**, **swap/shift** scheduling helpers, **SSE** live updates, **global search**, **export/import** event packages, **stage clocks** (distance/fullscreen layout, changeover mode), header **My stage today**, **collaborative patch/RF** workbook (Yjs + FortuneSheet), **template library**, **PDF** attachments with **inline viewer** and **page extract**, **responsive** shell (hamburger nav, breakpoints), **connection status**, keyboard shortcuts, optional **shared password**, **Docker** deployment.

**Handover to another machine:** **[`docs/HANDOVER.md`](docs/HANDOVER.md)**.

**Roadmap / backlog:** **[`docs/PLAN.md`](docs/PLAN.md)** and **[`docs/FEATURE_REQUIREMENTS.md`](docs/FEATURE_REQUIREMENTS.md)** (e.g. configurable client logo, further polish).

---

## Licence

MIT — see **[LICENSE](LICENSE)**.
