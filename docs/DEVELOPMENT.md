# Development process — local Docker

**See also:** **[`docs/README.md`](README.md)** (documentation index for this folder).

Changeoverlord supports **two** local Compose paths: a **fast** bind-mounted stack (**`make dev-fast`**) for day-to-day iteration, and a **classic** path (**`make dev`**) that builds the **same monolithic `app` image** shape used in production (compiled **`web/dist`** + **`api/dist`**). Operators on show laptops typically **`docker compose pull`** the pre-built image only — see root **[`README.md`](../README.md)**.

## Goal

- **No manual deploy steps** to the local test environment: one repeatable command brings the stack up.
- **Compose is the contract**: if it works in `docker compose up`, we trust it for LAN installs.
- **Changelog is part of the same contract** for code changes: update **`[Unreleased]`** in **[`CHANGELOG.md`](../CHANGELOG.md)** when your change ships or affects runtime — see **[`AGENTS.md`](../AGENTS.md)** and **`.cursor/rules/changelog.mdc`**.
- **Git:** commit **each logical unit** separately as you go — see **§ Git commits** below and **`.cursor/rules/git-commits.mdc`**.

## Smarter Docker rebuilds (stamps)

**`make dev`** and **`make dev-fast`** skip **`docker compose --build`** when a hash of image inputs matches the last successful build (stored under **`.docker/`**, gitignored — see **`scripts/docker-build-gate.sh`**).

| Stack | What is fingerprinted |
|-------|------------------------|
| **Fast** | **`Dockerfile.fast`** and **`docker-compose.fast.yml`** only. Edits under **`api/`** / **`web/`** are bind-mounted — **no image rebuild** for normal code changes. |
| **Classic** | **`Dockerfile`**, compose files, **`package.json`** / **`package-lock.json`**, workspace **`package.json`**, **`patches/`**, and **git-tracked** **`api/`** + **`web/`** (excluding `node_modules`, `dist`, `.cache`). **Source changes still require a rebuild**; running **`make dev` again** without changing anything skips **`--build`**. |

- **Force a rebuild:** **`FORCE_DOCKER_REBUILD=1 make dev`** (or **`make dev-fast`**) — still refreshes the stamp on success.
- **Always rebuild (ignore stamp):** **`make dev-rebuild`** or **`make dev-fast-rebuild`**.
- **After you build images outside Make** (e.g. raw **`docker compose build`**), run **`./scripts/docker-build-gate.sh classic stamp`** or **`fast stamp`** so the next **`make dev`** doesn’t skip **`--build`** incorrectly.

## Git commits

Use **Git** to record work in **small, reviewable steps** — not one enormous commit at the end of a session.

**Commit after** a single coherent unit, for example:

- One feature component or vertical slice
- One bug fix (one cause / one fix)
- One refactor of a specific module or area
- Tests for one behaviour or file

**Message style:** short, specific, imperative — what the commit *does*.

| Good | Weak |
|------|------|
| `Add set-length option to performance form` | `changes` |
| `Fix bulk add range when event dates shown` | `fixes` |
| `Refactor stage day time helpers` | `wip` |

See **[`.cursor/rules/git-commits.mdc`](../.cursor/rules/git-commits.mdc)** for examples and **[`AGENTS.md`](../AGENTS.md)** for how this fits with **`make dev-fast`** / **`make dev`** and **`CHANGELOG.md`**.

## Fast local testing (hot reload)

**Preferred** for iterating on **`api/`** and **`web/`** without rebuilding the production-style image.

From the **repository root**:

```bash
make dev-fast
```

This uses **`docker-compose.fast.yml`** + **`Dockerfile.fast`**: **Postgres**, an **api** container running **`npm install`** (first start can be slow) then **`tsx watch`**, and a **web** container running **Vite** on **`0.0.0.0:5173`**. Source is **bind-mounted**; **`node_modules`** for the repo live in **named volumes** so the host tree is not overwritten.

- **Open the UI:** **`http://localhost/`** by default (**`FAST_WEB_PORT=80`** in **`.env`** / compose; Vite still listens on **5173** inside the **web** container).
- **Health (direct API):** **`http://localhost:3000/api/v1/health`** (or **`FAST_API_PORT`**).
- **Health (through Vite proxy):** **`http://localhost/api/v1/health`** (same host port as the UI).

Stop:

```bash
make dev-fast-down
```

Rebuild/restart **api** + **web** only:

```bash
make dev-fast-app
```

Rebuild fast images even when the stamp says they are current:

```bash
make dev-fast-rebuild
```

**Caveats:** This path is **not** identical to the single **`app`** container (different process layout, **development** `NODE_ENV` on the API). Use **`make dev`** before a release or when debugging image-only issues.

**Do not** run **`make dev-fast`** and **`make dev`** at the same time with the same **`DATA_DIR`**: both stacks include a Postgres service that bind-mounts **`${DATA_DIR}/db`** — two containers must not use the same data directory. Stop one stack (`make dev-down` or **`make dev-fast-down`**) before starting the other. **Port 80:** both stacks default the UI to host port **80**; you cannot bind it twice — stop one stack first, or set **`FAST_WEB_PORT=5173`** (or **`HOST_PORT=8080`** for classic) in **`.env`**.

## Classic local testing (production-like image)

From the **repository root** (where `docker-compose.yml` lives):

```bash
make dev
```

This runs **`docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`**, adding **`--build`** only when build inputs changed (see **§ Smarter Docker rebuilds**) or on first run. The container serves **compiled** assets (`vite build`, `tsc`) from the image — **not** live-mounted source.

To rebuild the **`app`** image unconditionally: **`make dev-rebuild`**.

**Deploy / LAN installs** without building from source: use **only** **`docker-compose.yml`** — **`docker compose pull && docker compose up -d`** (see root **`README.md`**).

If you change code and the browser still shows the old app, rebuild without cache:

```bash
make dev-fresh
```

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
| `docker-compose.yml` | Ports, `DATABASE_URL`, `WEB_PUBLIC_DIR`, healthchecks, GHCR **`image`** |
| `docker-compose.dev.yml` | **`build: .`** — merged by **`make dev`** |
| `docker-compose.fast.yml` | **Postgres + api (tsx watch) + web (Vite)** — merged by **`make dev-fast`** |
| `Dockerfile` | Multi-stage build: Vite → `public/`, `tsc` → `api/dist`; **`patches/`** is copied before **`npm install`** in the builder so **`patch-package`** applies (FortuneSheet fixes); the runner uses **`npm install --ignore-scripts`** so production does not need **`patch-package`**. |
| `Dockerfile.fast` | **Node + Alpine PDF/convert tools** for **`make dev-fast`** containers only |
| Postgres | Real DB for all persistent state |
| SSE (`/api/v1/realtime`) | Live TanStack invalidation after REST mutations — see [`REALTIME.md`](REALTIME.md) |

## Patches (`patches/`)

Some **npm** dependencies may use **patch-package** fixes under **`patches/*.patch`**. When there are no **`*.patch`** files, **`patch-package`** is a no-op but **`postinstall`** still runs. The **builder** stage **`COPY patches`** before **`npm install`** so patches apply during **`npm install`** — **Docker builds must include the `patches/` directory** in the build context (it is **not** in **`.dockerignore`**; an empty dir or **`.gitkeep`** only is fine).

- **Local:** Root **`npm install`** runs **`patch-package`** after install.
- **Runner image:** Uses **`npm install --omit=dev --ignore-scripts`** for **`@changeoverlord/api`** only — **`patch-package`** is not installed in production; the **SPA** is already built in the **builder** with patched **`node_modules`**.

Adding or changing a patch: edit **`node_modules`**, run **`npx patch-package <package-name>`**, commit the new file under **`patches/`**, and **`CHANGELOG.md`** if behaviour changes.

## Environment

- Optional **`.env`** next to `docker-compose.yml` — see **`.env.example`** (`HOST_PORT`, `DATA_DIR`, `LOG_LEVEL`). **`docker-compose.yml`** defaults **`LOG_LEVEL=debug`** for local testing; set **`LOG_LEVEL=info`** in **`.env`** when you want production-style quiet logs (e.g. show laptop).
- Default **HTTP**: `http://localhost/` (port **80**). Use **`HOST_PORT=8080`** if 80 is busy.
- **Verbose API logs:** set **`LOG_LEVEL=debug`** in **`.env`**, then **`make dev`** — follow **`docker compose logs -f app`**. Conventions: **[`LOGGING.md`](LOGGING.md)**.
- **Do not** test by opening a **saved “Web Page, Complete”** HTML from the browser (`file://…`): asset URLs like **`/assets/…`** will not load, the SPA bundle won’t run, and WebSockets/API calls have no host. Always use **`http://localhost/`** (or your LAN URL) served by the app container.

## CI / compile check without running containers

To verify TypeScript and Vite builds locally (e.g. in CI), **`npm install`** at the repo root then **`npm run build`** — that is what the **Dockerfile** runs. It does **not** replace **`make dev-fast`** / **`make dev`** for interactive testing. Use this for a **fast compile-only** loop when you do not need Postgres/browser integration.

## Faster Docker rebuilds

What usually costs time:

| Step | Notes |
|------|--------|
| **`npm install`** | Cached by Docker **layer** when `package.json` / `package-lock.json` are unchanged. The **Dockerfile** also uses **BuildKit cache mounts** (`/root/.npm`) so repeated installs stay quicker when layers invalidate. Requires **BuildKit** (default in current Docker Desktop / Engine). |
| **`vite build` + `tsc`** | Re-runs when **`api/`** or **`web/`** source changes. This repo’s **Dockerfile** splits them into **two `RUN` steps** (`build -w api` then `COPY web` + `build -w web`) so a change in **only one** workspace reuses the cached layer for the **other** — the biggest win for day-to-day work. |
| **Tool caches (BuildKit)** | The builder mounts **Vite’s** cache (`node_modules/.vite`) and **tsc incremental** metadata (`api/.cache/`) so repeated builds of the same tree stay faster even when a layer re-runs. |
| **API `tsc` + empty `dist`** | The **Dockerfile** removes **`api/dist`** and **`api/.cache/tsconfig.tsbuildinfo`** before **`npm run build -w api`**. Clearing only **`dist`** while the incremental file still says “up to date” could make **`tsc` emit nothing** (still exit **0**), producing an **empty or partial** `api/dist` and a broken runtime image (e.g. missing `db/client.js`). |
| **`--no-cache`** | Only use **`make dev-fresh`** when the running app is clearly stale; it disables **all** layer cache and is much slower. |
| **LibreOffice + Poppler + ImageMagick** | The **runner** image installs **`apk`** packages in **two layers** (small tools first, **LibreOffice + fonts** second) with **BuildKit cache mounts** on **`/var/cache/apk`** so repeated downloads are faster when the layer re-runs. **LibreOffice** is the largest cost — expect a slow step on first build or after a cache miss. |

**Practical tips**

- Prefer **`make dev`** over **`make dev-fresh`** unless you suspect bad cache.
- Touch **`package-lock.json`** only when dependencies change — unnecessary lockfile churn busts the **`npm install`** layer.
- For a **quick compile** without Docker: **`npm run build`** at the repo root (same as CI) — no image rebuild; use this when you only need to verify TypeScript/Vite.
- Rebuild **only** the app service: **`make dev-app`** or **`docker compose -f docker-compose.yml -f docker-compose.dev.yml build app && docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d app`**.
- **BuildKit** must be on (Docker Desktop: **Settings → Docker Engine** or ensure `{"features":{"buildkit":true}}`; CLI: `export DOCKER_BUILDKIT=1` — usually the default).
- **Docker Desktop (Mac / Windows):** give the VM **enough CPUs and RAM** (**Settings → Resources**) — slow builds are often under-resourced VMs. On **Mac**, enabling **VirtioFS** for file sharing (when available) can help I/O-heavy builds.

**Heavy runtime packages (LibreOffice, etc.)**

- **Why it feels slow:** **Word/ODT/RTF → PDF** uses **LibreOffice** headless, which pulls a **large** dependency graph on Alpine. That is separate from the **Node/Vite** build; **`make dev`** still has to rebuild the **app image** when **`Dockerfile`**, **`api/`**, **`web/`**, or **`patches/`** change.
- **What already helps:** **Two `apk` layers** + **BuildKit cache** for **`/var/cache/apk`** so repeated **`apk add`** work is cheaper when the layer invalidates; **builder** still uses **`npm`** and **Vite** cache mounts as above.
- **Optional — publish a “runtime deps” base image:** If CI or local builds are still too slow, maintain a small **`Dockerfile`** that is only **`FROM node:22-alpine`** + the **`apk add`** lines, **build and push** it to your registry (e.g. **`ghcr.io/…/changeoverlord-app-runtime-deps:v1`**), then change the app **`Dockerfile`** to **`FROM`** that image instead of plain **`node:22-alpine`** for the **runner** stage. Day-to-day app rebuilds then **skip** re-downloading LibreOffice as long as the base tag is unchanged.
- **When you do not need Word:** For **local** iteration without Docker, **`npm run build`** at the repo root avoids the image entirely. There is **no** slim Compose profile in-repo yet; skipping LibreOffice would require a **build-arg** and a **runtime** guard so **Convert to PDF** for Office docs does not silently mislead the UI.

**What this repo does *not* do**

- No bind-mounted **`web/src`** / **`api/src`** in the **classic** **`app`** image — that is what operators run from GHCR. **Fast** mode (**`make dev-fast`**) intentionally bind-mounts for developer speed. Host-only **`npm run dev`** without a reachable Postgres is not a supported integration path — use Compose.

## UI: compact action buttons

**Reference:** **`StageDayPage`** running-order row actions (**Patch / RF**, **Files**, **Notes**, **Swap**).

- Use **`button.icon-btn`** or **`a.icon-btn`** with a **short text label**.
- **Do not** mix **emoji-only** buttons, **unstyled text links**, and **`icon-btn`** in the same action row — pick one system (`icon-btn` + label).
- **`global.css`** defines **`button.icon-btn`** / **`a.icon-btn`** (padding, **36px** min touch target, **`0.8rem`** text on both).
- **Primary** actions on the same row may use **`button.primary`**; **destructive** text actions use **`button.icon-btn.danger-text`** (e.g. **Delete**).

**PDF page extract:** **`GET /api/v1/files/:id/page-previews`** returns **`pageCount`** and **`thumbnails`** (JPEG **data URLs**) rendered server-side with **Poppler** **`pdftoppm`** (`api/src/lib/pdf-thumbnails.ts`). The API container installs **`poppler-utils`**; local dev needs **`pdftoppm`** on **`PATH`** (e.g. **`brew install poppler`** on macOS). The web UI shows these in **`FileAttachments`** when **Extract** is open — no **pdf.js** in the browser.

**Convert to PDF:** **`POST /api/v1/files/:id/convert-to-pdf`** builds a PDF from the stored file using **`api/src/lib/convert-to-pdf.ts`**: **pdf-lib** for **JPEG/PNG** (single-page A4, scaled) and plain text (`.txt`, `.md`, `.csv`); **ImageMagick** (`magick` / `convert`) for other raster types (**WebP**, **GIF**, **TIFF**, **HEIC**, …). The Docker image installs **`imagemagick`**, **`libwebp-tools`** (so ImageMagick can decode **WebP** via the `dwebp` delegate), **`libreoffice`**, and **`ttf-dejavu`** (large layer; fonts help LibreOffice PDF output). Local dev without Docker needs **`magick`**/**`convert`**, **`libwebp-tools`** (or equivalent WebP decode) for WebP, **`libreoffice`** for Office docs, and sensible fonts on **`PATH`**; text-only conversion works with **pdf-lib** only.

## AI / Cursor workflow

**Agent development process** (commits, testing, deployment, changelog, logging): **[`../AGENTS.md`](../AGENTS.md)** → *Development process (agents)*. Rules: **`.cursor/rules/git-commits.mdc`**, **`.cursor/rules/local-docker-deploy.mdc`**, **`.cursor/rules/changelog.mdc`**, **`.cursor/rules/logging.mdc`**. After implementation, **`make dev-fast`** (or **`make dev`** for image parity) exercises the local stack.

## Database resets

Schema changes use **Drizzle migrations**. If a dev database is in a bad state, stop Compose, remove **`data/db/`** (only on throwaway data), then `make dev` again. **Never delete production `DATA_DIR` without a backup.**

## New machine or teammate

Clone, `.env`, **`make dev`**, and moving **`DATA_DIR`** are documented in **[`HANDOVER.md`](HANDOVER.md)** so setup on another computer stays consistent with this repo.
