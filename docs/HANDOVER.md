# Handover — new computer or teammate

Use this when **moving the project** to another machine or **onboarding** someone who will run or develop Changeoverlord.

---

## What you need

| Requirement | Notes |
|-------------|--------|
| **Git** | To clone the repository. |
| **Docker** | Desktop or Engine with **Compose v2** (same as root **[`README.md`](../README.md)**). |
| **Network** | First **`docker compose pull`** (deploy) or **`make dev`** (develop) may pull images (`postgres`, **`ghcr.io/.../app`**, or Node build bases). After that, local runs can be offline. |

---

## Fresh clone (code only)

From the machine where you want the repo:

```bash
git clone <repository-url>
cd <repo-directory>
```

Copy **`.env.example`** to **`.env`** if you need a non-default **port** (`HOST_PORT`), **data path** (`DATA_DIR`), **log level**, or **session secret** — see **`.env.example`** and **[`DEVELOPMENT.md`](DEVELOPMENT.md)**.

Then from the **repository root**, choose one:

**Deploy** (pre-built app from GHCR — no source build):

```bash
docker compose pull && docker compose up -d
```

**Develop** (build app image from this clone):

```bash
make dev
```

Open **`http://localhost/`** (or **`http://localhost:<HOST_PORT>/`** if you set `HOST_PORT`). The first run creates **`data/db/`** and **`data/uploads/`** under your `DATA_DIR` (default **`./data`**).

**Health check:** `curl -s http://localhost/api/v1/health` should return JSON with `"ok":true`.

Canonical workflow detail: **[`DEVELOPMENT.md`](DEVELOPMENT.md)**.

---

## Moving show / prep data to another computer

**Option A — Full data directory (Postgres + files)**  
1. On the old machine: stop the stack (`make dev-down` or `docker compose down`).  
2. Copy the entire **`DATA_DIR`** tree (see **[`data/README.md`](../data/README.md)**).  
3. On the new machine: put it at the same relative path, or set **`DATA_DIR`** in **`.env`** to that absolute path.  
4. Start with **`make dev`**.

**Option B — Logical export (schedules + patch snapshots)**  
Use **Export event** in the app (event detail) to download a JSON package, then **Import event** on the new instance (see **[`USER_GUIDE.md`](USER_GUIDE.md)**). This does not replace a full DB file copy but is enough for many handovers.

---

## Development habits (same on any machine)

- After changing **`api/`**, **`web/`**, **`Dockerfile`**, **`docker-compose.yml`**, **`patches/`**, or root **`package.json`** / **`package-lock.json`**, run **`make dev`** so the **image** rebuilds (no bind-mount of source). See **[`AGENTS.md`](../AGENTS.md)** and **[`DEVELOPMENT.md`](DEVELOPMENT.md)**.
- **Do not** commit **`.env`** (secrets). **`.env.example`** is the template.

---

## Documentation map

| Start here | Purpose |
|------------|---------|
| Root **[`README.md`](../README.md)** | Quick start, ports, layout |
| **[`README.md`](README.md)** (this folder’s index) | All **`docs/`** files |
| **[`USER_GUIDE.md`](USER_GUIDE.md)** | Operators — clocks, **My stage today**, patch/RF, files |
| **[`AGENTS.md`](../AGENTS.md)** | Architecture, realtime, query keys, logging |

---

## Repository URL

Replace `<repository-url>` with your remote (e.g. GitHub). The root README may show an example clone URL; use the one your team actually pushes to.
