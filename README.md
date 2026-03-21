# Changeoverlord

Web app for festival **sound crew**: multi-day **schedules**, **changeovers**, **riders** / **stage plots**, collaborative **input patch** and **RF** grids, and **stage clocks**. Designed for **LAN / offline** deployment with optional cloud hosting.

**Powered by [Doug Hunt Sound & Light](https://www.doughunt.co.uk/).**

## Quick start (Docker)

Requires [Docker](https://docs.docker.com/get-docker/) with Compose v2.

```bash
git clone https://github.com/doug86i/changeoverlord.git
cd changeoverlord
docker compose pull   # first run: pulls images from GHCR
docker compose up -d
```

Open **http://\<server-ip\>** (port **80** by default — no port in the URL).

- **Alternate host port** (e.g. 8080): see `compose.override.example.yml`.
- **Offline after first pull**: images stay in Docker’s cache; no internet needed on show site.

## Data directory (one place for DB, Redis, uploads)

All persistent state uses a **single host directory** — default **`./data`** — so you can aim it at a **larger disk**, **sync**, or **back up** one tree.

| Subfolder | Role |
|-----------|------|
| `data/db/` | PostgreSQL files |
| `data/redis/` | Redis AOF |
| `data/uploads/` | User uploads (riders, plots, logos) |

Optional **`.env`**: set **`DATA_DIR`** to an absolute path (e.g. `/mnt/raid/changeoverlord`). See **`.env.example`**.

Details and backup notes: **[data/README.md](data/README.md)**.

## Local development (live edits)

Use the **dev** Compose override: it **bind-mounts** `docker/html/` and `docker/nginx/default.conf` into the `app` container so you can edit files on disk and **refresh the browser** — no image rebuild for HTML/CSS/JS in `docker/html/`.

```bash
make dev
# open http://localhost/  (or http://127.0.0.1/)
```

- **Change `docker/html/`** (e.g. `index.html`) → save → reload the page; updates appear immediately (bind mount).
- **Change `Dockerfile`** → rebuild: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`, **or** stop the stack and run **`make dev-watch`** (foreground). **Watch** rebuilds the `app` image when the Dockerfile changes; Ctrl+C stops it.
- **Change `docker/nginx/default.conf`** → save, then reload nginx:  
  `docker compose -f docker-compose.yml -f docker-compose.dev.yml exec app nginx -s reload`

Stop the stack: `make dev-down`.

## Repository layout

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | Stack: Postgres, Redis, app |
| `docker-compose.dev.yml` | Dev overrides: bind mounts + `watch` (Dockerfile rebuild) |
| `docker/html/` | Static placeholder (mounted live in dev) |
| `docker/nginx/default.conf` | Nginx site config (mounted live in dev) |
| `Dockerfile` | App image (placeholder until UI/API land) |
| `Makefile` | `make dev`, `make dev-watch`, `make dev-down` |
| `data/` | Persistent data root (`DATA_DIR`); see `data/README.md` |
| `.env.example` | Optional `DATA_DIR` for another disk |
| `.github/workflows/` | Build and push `app` image to **GHCR** |

## Status

**Early scaffold** — application features are tracked in project issues and the internal product plan. PRs welcome.

## License

MIT — see [LICENSE](LICENSE).
