# Development process — local Docker

**See also:** **[`docs/README.md`](README.md)** (documentation index for this folder).

Changeoverlord is developed **against the same path we ship**: **`docker compose`** builds the **API + SPA** image and runs it with **Postgres**, so local testing always matches what operators would run.

## Goal

- **No manual deploy steps** to the local test environment: one repeatable command brings the stack up with a fresh build.
- **Compose is the contract**: if it works in `docker compose up`, we trust it for LAN installs.
- **Changelog is part of the same contract** for code changes: update **`[Unreleased]`** in **[`CHANGELOG.md`](../CHANGELOG.md)** when your change ships or affects runtime — see **[`AGENTS.md`](../AGENTS.md)** and **`.cursor/rules/changelog.mdc`**.
- **Git:** commit **each logical unit** separately as you go — see **§ Git commits** below and **`.cursor/rules/git-commits.mdc`**.

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

See **[`.cursor/rules/git-commits.mdc`](../.cursor/rules/git-commits.mdc)** for examples and **[`AGENTS.md`](../AGENTS.md)** for how this fits with **`make dev`** and **`CHANGELOG.md`**.

## Deploy to local testing (every time)

**There is no separate “dev server” path** — local testing **is** Compose: you always exercise the **same Dockerfile + `docker-compose.yml`** you would ship.

From the **repository root** (where `docker-compose.yml` lives):

```bash
make dev
```

This runs **`docker compose up -d --build`** — rebuilds the app image when **`Dockerfile`**, **`api/`**, **`web/`**, **`patches/`**, or workspace **`package.json`** / **`package-lock.json`** change, recreates the container if needed, and starts dependencies. Use this **after each meaningful code change** so what you see in the browser matches production.

The container serves **compiled** assets (`vite build`, `tsc`) from the image — **not** live-mounted source. If you change code and the browser still shows the old app, rebuild without cache:

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
| `docker-compose.yml` | Ports, `DATABASE_URL`, `WEB_PUBLIC_DIR`, healthchecks |
| `Dockerfile` | Multi-stage build: Vite → `public/`, `tsc` → `api/dist`; **`patches/`** is copied before **`npm install`** in the builder so **`patch-package`** applies (FortuneSheet fixes); the runner uses **`npm install --ignore-scripts`** so production does not need **`patch-package`**. |
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

To verify TypeScript and Vite builds locally (e.g. in CI), **`npm install`** at the repo root then **`npm run build`** — that is what the **Dockerfile** runs. It does **not** replace **`make dev`** for interactive testing. Use this for a **fast compile-only** loop when you do not need Postgres/browser integration.

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
- Rebuild **only** the app service: **`docker compose build app && docker compose up -d app`** (Compose still rebuilds when sources change; this is the same scope as **`make dev`** for the `app` image).
- **BuildKit** must be on (Docker Desktop: **Settings → Docker Engine** or ensure `{"features":{"buildkit":true}}`; CLI: `export DOCKER_BUILDKIT=1` — usually the default).
- **Docker Desktop (Mac / Windows):** give the VM **enough CPUs and RAM** (**Settings → Resources**) — slow builds are often under-resourced VMs. On **Mac**, enabling **VirtioFS** for file sharing (when available) can help I/O-heavy builds.

**Heavy runtime packages (LibreOffice, etc.)**

- **Why it feels slow:** **Word/ODT/RTF → PDF** uses **LibreOffice** headless, which pulls a **large** dependency graph on Alpine. That is separate from the **Node/Vite** build; **`make dev`** still has to rebuild the **app image** when **`Dockerfile`**, **`api/`**, **`web/`**, or **`patches/`** change.
- **What already helps:** **Two `apk` layers** + **BuildKit cache** for **`/var/cache/apk`** so repeated **`apk add`** work is cheaper when the layer invalidates; **builder** still uses **`npm`** and **Vite** cache mounts as above.
- **Optional — publish a “runtime deps” base image:** If CI or local builds are still too slow, maintain a small **`Dockerfile`** that is only **`FROM node:22-alpine`** + the **`apk add`** lines, **build and push** it to your registry (e.g. **`ghcr.io/…/changeoverlord-app-runtime-deps:v1`**), then change the app **`Dockerfile`** to **`FROM`** that image instead of plain **`node:22-alpine`** for the **runner** stage. Day-to-day app rebuilds then **skip** re-downloading LibreOffice as long as the base tag is unchanged.
- **When you do not need Word:** For **local** iteration without Docker, **`npm run build`** at the repo root avoids the image entirely. There is **no** slim Compose profile in-repo yet; skipping LibreOffice would require a **build-arg** and a **runtime** guard so **Convert to PDF** for Office docs does not silently mislead the UI.

**What this repo does *not* do**

- No bind-mounted **`web/src`** / **`api/src`** in the production image path — that would diverge from what operators run. Fast iteration without Docker remains **`npm run build`** (or per-workspace dev servers if you add them locally — not part of the shipped Compose contract).

## UI: compact action buttons

**Reference:** **`StageDayPage`** running-order row actions (**Patch / RF**, **Files**, **Notes**, **Swap**).

- Use **`button.icon-btn`** or **`a.icon-btn`** with a **short text label**.
- **Do not** mix **emoji-only** buttons, **unstyled text links**, and **`icon-btn`** in the same action row — pick one system (`icon-btn` + label).
- **`global.css`** defines **`button.icon-btn`** / **`a.icon-btn`** (padding, **36px** min touch target, **`0.8rem`** text on both).
- **Primary** actions on the same row may use **`button.primary`**; **destructive** text actions use **`button.icon-btn.danger-text`** (e.g. **Delete**).

**PDF page extract:** **`GET /api/v1/files/:id/page-previews`** returns **`pageCount`** and **`thumbnails`** (JPEG **data URLs**) rendered server-side with **Poppler** **`pdftoppm`** (`api/src/lib/pdf-thumbnails.ts`). The API container installs **`poppler-utils`**; local dev needs **`pdftoppm`** on **`PATH`** (e.g. **`brew install poppler`** on macOS). The web UI shows these in **`FileAttachments`** when **Extract** is open — no **pdf.js** in the browser.

**Convert to PDF:** **`POST /api/v1/files/:id/convert-to-pdf`** builds a PDF from the stored file using **`api/src/lib/convert-to-pdf.ts`**: **pdf-lib** for **JPEG/PNG** (single-page A4, scaled) and plain text (`.txt`, `.md`, `.csv`); **ImageMagick** (`magick` / `convert`) for other raster types (**WebP**, **GIF**, **TIFF**, **HEIC**, …). The Docker image installs **`imagemagick`**, **`libwebp-tools`** (so ImageMagick can decode **WebP** via the `dwebp` delegate), **`libreoffice`**, and **`ttf-dejavu`** (large layer; fonts help LibreOffice PDF output). Local dev without Docker needs **`magick`**/**`convert`**, **`libwebp-tools`** (or equivalent WebP decode) for WebP, **`libreoffice`** for Office docs, and sensible fonts on **`PATH`**; text-only conversion works with **pdf-lib** only.

## AI / Cursor workflow

**Agent development process** (commits, testing, deployment, changelog, logging): **[`../AGENTS.md`](../AGENTS.md)** → *Development process (agents)*. Rules: **`.cursor/rules/git-commits.mdc`**, **`.cursor/rules/local-docker-deploy.mdc`**, **`.cursor/rules/changelog.mdc`**, **`.cursor/rules/logging.mdc`**. After implementation, **`make dev`** keeps the local stack aligned with production.

## Database resets

Schema changes use **Drizzle migrations**. If a dev database is in a bad state, stop Compose, remove **`data/db/`** (only on throwaway data), then `make dev` again. **Never delete production `DATA_DIR` without a backup.**

## New machine or teammate

Clone, `.env`, **`make dev`**, and moving **`DATA_DIR`** are documented in **[`HANDOVER.md`](HANDOVER.md)** so setup on another computer stays consistent with this repo.
