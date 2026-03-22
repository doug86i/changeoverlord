# Changeoverlord

A web app for festival **sound crew** — schedules, changeovers, collaborative patch sheets, riders, and stage clocks. Built for **LAN use** at live events; runs offline once set up.

**Powered by [Doug Hunt Sound & Light](https://www.doughunt.co.uk/).**

---

## What it does

- **Schedule management** — Events, stages, days, and performances with inline editing, now/next indicators, changeover timers, and live updates across all connected devices.
- **Collaborative patch & RF sheets** — Real-time multi-user spreadsheets for input lists and RF. Upload templates from Excel or build them in-app. Each band gets their own workbook, seeded from the stage's default template.
- **Stage clocks** — Countdown timers with changeover mode, warning colours (green → amber → red), auto-advance, message overlay, and fullscreen/distance view for FOH displays.
- **Riders & stage plots** — Upload PDFs, view inline, extract individual pages as stage plots, drag-and-drop.
- **Fast navigation** — "My stage today" one-tap access, band-to-band navigation in the patch view, global search (`Ctrl+K`), keyboard shortcuts (`?` for help).
- **Export & import** — Move event data between machines via JSON packages (prep laptop → show server via USB).
- **Stage chat** — Short coordination messages between crew on the same stage or across the whole event.

---

## Quick start

**Requirements:** [Docker](https://docs.docker.com/get-docker/) with Compose v2 (Linux, macOS, or Windows with Docker Desktop).

```bash
git clone https://github.com/doug86i/changeoverlord.git
cd changeoverlord
docker compose pull && docker compose up -d
```

Open **http://localhost/** — that's it. Other devices on the LAN can reach the same address using the server's IP or hostname.

After the first `docker compose pull`, the stack can run **fully offline**.

### Configuration

Copy `.env.example` to `.env` if you need to change any defaults:

| Variable | Default | When to change |
|----------|---------|----------------|
| `HOST_PORT` | `80` | Port 80 is in use (e.g. use `8080`) |
| `DATA_DIR` | `./data` | Store database and uploads elsewhere |
| `SESSION_SECRET` | dev fallback | Set a random string for shared or internet-facing installs |
| `LOG_LEVEL` | `debug` | Use `info` for quieter logs on a show machine |
| `APP_IMAGE_TAG` | `latest` | Pin to a specific release tag (e.g. `v1.0.0`) |

Schedules, the optional shared password, and other show settings are configured **inside the app**, not in `.env`.

### Updates

```bash
git pull && docker compose pull && docker compose up -d
```

Database migrations run automatically on startup. **Pushing code or pulling a new image does not erase your data** — your **`DATA_DIR`** (Postgres files + uploads) stays on disk unless you explicitly remove it. See **`docs/DEVELOPMENT.md`** § *Database resets* if you ever need a deliberate clean Postgres (throwaway / dev only).

### Stop

```bash
docker compose down
```

Data under `DATA_DIR` (default `./data`) is kept.

### Troubleshooting

- **Port conflict** — Set `HOST_PORT=8080` (or another free port) in `.env`.
- **Patch workbook not persisting** — Make sure `DATA_DIR` points to a stable path. If using a reverse proxy, it must allow WebSocket upgrade on `/ws/v1/collab/…`.
- **Stale UI after update** — Try `docker compose build --no-cache app && docker compose up -d app`.

---

## Using the app

See the **[User Guide](docs/USER_GUIDE.md)** for detailed instructions on schedules, patch sheets, templates, clocks, file management, and chat.

---

## Moving data to another machine

**Full copy** — Stop the stack, copy `DATA_DIR` to the new machine, set the path in `.env`, start the stack.

**Logical export** — Use **Export event** in the app to download a JSON package, then **Import event** on the other instance. See the [User Guide](docs/USER_GUIDE.md).

---

## Development

See **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)** for building from source, Docker workflows, and contributing.

| Command | What it does |
|---------|--------------|
| `make dev-fast` | Postgres + hot-reload API and UI (bind-mounted source) |
| `make dev` | Production-like single container build |

### Stack

| Layer | Technology |
|-------|------------|
| API | Fastify, TypeScript, Drizzle ORM, PostgreSQL, Zod |
| Web | Vite, React, TypeScript, TanStack Query, React Router |
| Live updates | SSE (schedule) · WebSockets JSON op relay (patch workbooks) |
| Spreadsheet | FortuneSheet |
| Deploy | Docker Compose: Postgres + Node container serving REST + static SPA |

---

## Documentation

| Doc | Purpose |
|-----|---------|
| **[User Guide](docs/USER_GUIDE.md)** | How to use the app |
| **[Development](docs/DEVELOPMENT.md)** | Building, testing, setup on a new machine |
| **[Roadmap](docs/ROADMAP.md)** | User personas, feature requirements, competitive analysis |
| **[Decisions](docs/DECISIONS.md)** | Engineering and product decisions, visual design |
| **[Realtime](docs/REALTIME.md)** | SSE vs collab WebSocket architecture |
| **[Logging](docs/LOGGING.md)** | Structured logs; fast-stack **client NDJSON** (`data/logs/client-debug.ndjson` under `DATA_DIR`) for patch collab troubleshooting |
| **[Changelog](CHANGELOG.md)** | Release notes and version history |

Full index: **[docs/README.md](docs/README.md)**.

**AI assistants:** **[AGENTS.md](AGENTS.md)**.

---

## Licence

MIT — see **[LICENSE](LICENSE)**.
