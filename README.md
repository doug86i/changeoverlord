# Changeoverlord

Web app for festival **sound crew**: multi-day **schedules**, **changeovers**, **riders** / **stage plots**, collaborative **input patch** and **RF** grids, and **stage clocks**. Designed for **LAN / offline** deployment with optional cloud hosting.

**Powered by [Doug Hunt Sound & Light](https://www.doughunt.co.uk/).**

## Quick start (Docker)

Requires [Docker](https://docs.docker.com/get-docker/) with Compose v2 on **Linux**, **macOS**, or **Windows** (Docker Desktop).

```bash
git clone https://github.com/doug86i/changeoverlord.git
cd changeoverlord
docker compose pull   # first run: pulls images from GHCR
docker compose up -d
```

Open **http://\<server-ip\>** (default **port 80** — no `:port` in the URL).

- **`.env`**: optional — copy **`.env.example`**. Only **infrastructure** belongs here (data path, port, image tag). **Product** settings (auth, timezone, logos, etc.) will live in the **app UI**.
- **Offline after first pull**: images stay in Docker’s cache; no internet needed on show site.

## What lives in Compose vs the UI

| In **Compose** / `.env` | In the **app UI** (when built) |
|-------------------------|--------------------------------|
| Data directory (`DATA_DIR`), host **port**, image **tag** | Passwords, timezone, clocks, riders, patch sheets, branding, … |
| **Bind mounts** (repo files + `data/`) | — |

All defaults are set in **`docker-compose.yml`** so a plain `docker compose up` works without a `.env` file.

## Data directory (one place for DB, Redis, uploads)

All persistent state uses a **single host directory** — default **`./data`** — so you can aim it at a **larger disk**, **sync**, or **back up** one tree.

| Subfolder | Role |
|-----------|------|
| `data/db/` | PostgreSQL files |
| `data/redis/` | Redis AOF |
| `data/uploads/` | User uploads (riders, plots, logos) |

Set **`DATA_DIR`** in `.env` if the default path is wrong for your disk layout (see **`.env.example`** for Linux/Windows examples). Details: **[data/README.md](data/README.md)**.

## Local development (live edits)

The same **`docker-compose.yml`** bind-mounts **`docker/html/`** and **`docker/nginx/default.conf`** so you can edit on disk and **refresh the browser** without rebuilding for static changes.

```bash
make dev
# open http://localhost:PORT/  (PORT = HOST_PORT from .env, default 80)
```

- **Change `docker/html/`** → save → reload the page.
- **Change `Dockerfile`** → `docker compose up -d --build`, or **`make dev-watch`** (foreground: rebuilds when the Dockerfile changes).
- **Change `docker/nginx/default.conf`** → save, then: `docker compose exec app nginx -s reload`

Stop: `make dev-down`.

**Port 80 on Windows**: binding **80** sometimes needs elevated rights — set **`HOST_PORT=8080`** in `.env` and open `http://localhost:8080/`.

## Repository layout

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | **Single** stack file: Postgres, Redis, app; defaults in-file; see header comment |
| `docker/html/` | Static placeholder (bind-mounted for live dev) |
| `docker/nginx/default.conf` | Nginx site config (bind-mounted) |
| `Dockerfile` | App image (placeholder until UI/API land) |
| `Makefile` | `make dev`, `make dev-watch`, `make dev-down` |
| `data/` | Persistent data root (`DATA_DIR`); see `data/README.md` |
| `.env.example` | Optional `DATA_DIR`, `HOST_PORT`, `APP_IMAGE_TAG` |
| `compose.override.example.yml` | Optional deeper overrides (prefer `.env` first) |
| `.github/workflows/` | Build and push `app` image to **GHCR** |
| `docs/PLAN.md` | Product vision, architecture, roadmap |
| `docs/DECISIONS.md` | Pre-build engineering decisions (stack, limits, auth, logging) |
| `docs/LICENSING.md` | Repo + dependency licence notes |

## Status

**Early scaffold** — application features are tracked in project issues and **[`docs/PLAN.md`](docs/PLAN.md)** (product & engineering plan). PRs welcome.

## License

MIT — see [LICENSE](LICENSE).
