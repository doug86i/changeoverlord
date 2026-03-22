# Changeoverlord

Web app for festival **sound crew**: multi-day **schedules**, **changeovers**, **riders** / **stage plots**, collaborative **input patch** and **RF** grids, and **stage clocks**. Built for **LAN / offline** use at shows; the same stack can be hosted online later.

**Powered by [Doug Hunt Sound & Light](https://www.doughunt.co.uk/).**

---

## Quick start (Docker)

**Requirements:** [Docker](https://docs.docker.com/get-docker/) with Compose v2 (Linux, macOS, or Windows with Docker Desktop).

| Goal | Command |
|------|---------|
| **Deploy** pre-built app (typical show / LAN) | See **[Deployment](#deployment)** below — `docker compose pull && docker compose up -d` |
| **Develop** from source (fast — hot reload) | `make dev-fast` (**`docker-compose.fast.yml`**) — UI at **`http://localhost:5173/`** |
| **Develop** from source (classic — same `app` image as ship) | `make dev` (merges **`docker-compose.dev.yml`**) |

After install, open **http://\<this-machine\>/** — default **port 80**. If port 80 is busy, set **`HOST_PORT`** in **`.env`** (from **`.env.example`**) and use **http://\<this-machine\>:\<HOST_PORT\>/**.

- **`.env`** is optional and **infrastructure-only** (paths, port, log level, secrets). Schedules, optional shared password, etc. are set in the **app UI**.
- After the first **`docker compose pull`** (deploy) or **`make dev`** / **`make dev-fast`** (develop), you can run **offline** if images are already local.

**Fresh DB during development:** stop Compose, remove **`data/db/`** under **`DATA_DIR`** (throwaway data only), then **`make dev-fast`** or **`make dev`** again. **Back up `DATA_DIR`** before wiping real prep data.

More detail: **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** · moving data: **[`docs/HANDOVER.md`](docs/HANDOVER.md)**.

---

## Deployment

Use this for a **production-style** or **show laptop** install: run the **published** app container from **GitHub Container Registry** — **no** local `Dockerfile` build (only **`docker-compose.yml`** + optional **`.env`**).

### 1. Prerequisites

- **Docker** with **Compose v2** (Docker Desktop or Engine).
- **Network** once: `docker compose pull` needs to reach **GHCR** (`ghcr.io`). After images are cached, the stack can run on an isolated LAN.

### 2. Get the compose files

```bash
git clone https://github.com/doug86i/changeoverlord.git
cd changeoverlord
```

You only need the repo for **`docker-compose.yml`**, **`.env.example`**, and (implicitly) Compose’s project name from the folder — not the app source at runtime.

### 3. Configure (optional)

```bash
cp .env.example .env
```

Edit **`.env`** if needed (see comments in **`.env.example`**):

| Variable | When to change |
|----------|----------------|
| **`HOST_PORT`** | Port **80** is in use or blocked (e.g. use **8080** on Windows without admin). |
| **`DATA_DIR`** | Store Postgres + uploads somewhere other than **`./data`** (absolute path; forward slashes, including on Windows). |
| **`SESSION_SECRET`** | **Set a long random string** for any shared or internet-facing deploy (defaults are for quick local use only). |
| **`LOG_LEVEL`** | Use **`info`** for quieter logs on a show machine; **`debug`** for troubleshooting (**[`docs/LOGGING.md`](docs/LOGGING.md)**). |
| **`APP_IMAGE_TAG`** | Pin a release tag instead of **`latest`** if you track versions (see GHCR package tags). |

### 4. Start the stack

```bash
docker compose pull    # app image from GHCR + postgres:16-alpine
docker compose up -d
```

First start creates **`${DATA_DIR}/db`** and **`${DATA_DIR}/uploads`** (default **`./data/...`**).

### 5. Verify

```bash
docker compose ps
curl -sS http://127.0.0.1/api/v1/health
# If HOST_PORT is not 80:
curl -sS "http://127.0.0.1:${HOST_PORT}/api/v1/health"
```

Expect **`{"ok":true,...}`** from **`/api/v1/health`**.

### 6. Open in the browser

- This machine: **http://localhost/** or **http://127.0.0.1/** (or **`http://localhost:<HOST_PORT>/`**).
- Other devices on the LAN: **http://\<server-hostname-or-IP\>/** (same port). Ensure the host firewall allows inbound **TCP** on **`HOST_PORT`** if clients connect from elsewhere.

### 7. Updates (new app version)

From the same repo directory:

```bash
git pull                    # latest compose / docs
docker compose pull
docker compose up -d
```

Database migrations run when the **app** container starts.

### 8. Stop

```bash
docker compose down
```

Data under **`DATA_DIR`** is kept. To remove containers **and** named volumes (if you ever add any), see Docker docs; default Postgres data is in the **`DATA_DIR/db`** bind mount, not an anonymous volume.

### Patch / RF workbook not persisting

- **Postgres must stay on disk:** patch workbooks are stored in **`${DATA_DIR}/db`** (table **`performance_yjs_snapshots`**). If **`DATA_DIR`** is not a stable host path/volume, or the DB directory is wiped on every deploy, edits will disappear after restart.
- **WebSockets:** the browser uses **`ws:`** / **`wss:`** to **`/ws/v1/collab/…`**. A reverse proxy must allow **WebSocket upgrade** (HTTP/1.1 **`Upgrade`** / **`Connection`**). Without it, the sheet may not stay connected long enough to sync.
- **App version:** releases **after** the fix in **`api/src/lib/yjs-persistence.ts`** avoid a race where a slow DB load could overwrite a good snapshot; **`docker compose pull`** to update.

---

## Development (build from source)

From the repo root, with Docker:

```bash
# Fast: Postgres + tsx watch + Vite (bind mounts)
make dev-fast

# Classic: single app image (compiled SPA + API), same shape as production build
make dev
# same as: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Use **`make dev-fresh`** if the **classic** image layers look stale. See **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)**.

Do not run **`make dev-fast`** and **`make dev`** together against the same **`DATA_DIR`** (Postgres data bind-mount conflict) — stop one stack before starting the other.

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

Interactive testing uses **`make dev-fast`** or **`make dev`** above. To compile **`web/`** + **`api/`** without Compose (e.g. CI), from the repo root: **`npm install`** then **`npm run build`**. See **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)**.

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
| `docker-compose.yml` | Postgres + app (**GHCR** image; `docker compose pull` + `up`) |
| `docker-compose.dev.yml` | Adds **`build: .`** — merged by **`make dev`** |
| `docker-compose.fast.yml` | Postgres + dev **api** + **web** — merged by **`make dev-fast`** |
| `Dockerfile` | Build `web/` + `api/`, run Fastify |
| `Dockerfile.fast` | Base image for **`make dev-fast`** (Node + PDF/convert tools) |
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
