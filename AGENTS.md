# Agent & architecture guide

**Primary audience:** AI coding assistants and contributors changing **API shape**, **realtime behaviour**, or **TanStack query keys**.

**Humans** new to the project should read the root **[`README.md`](README.md)** (overview and deploy) and the **[`docs/README.md`](docs/README.md)** index.

---

## Development process (agents — follow end-to-end)

This is the **canonical workflow** for implementation tasks: **commit** (small logical units), **test** (Compose), **deploy** (rebuild image), **observe** (health + logs), **record** (changelog). Cursor rules **`git-commits`**, **`local-docker-deploy`**, **`changelog`**, **`logging`**, and **`agents-process`** (always apply — **full checklist without the user having to repeat “follow the process”**) restate parts of this; details live in the docs below.

| Phase | Requirement |
|-------|----------------|
| **Commits** | When the repo is **Git**: **`git commit`** after each **logical unit** of work (one feature slice, one bug, one refactor, one test batch) — **not** one giant commit at the end. Messages: **short**, **specific**, **imperative** (e.g. “Add…”, “Fix…”, “Refactor…”). See **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** § *Git commits* and **[`.cursor/rules/git-commits.mdc`](.cursor/rules/git-commits.mdc)**. |
| **Testing** | Local integration testing is **Docker Compose only** — same **`Dockerfile`** and **`docker-compose.yml`** as production. After code changes that affect runtime, run **`make dev`** from the repo root. Confirm **`GET /api/v1/health`** (or **`docker compose ps`**) succeeds. If the browser still shows old UI/API, run **`make dev-fresh`**. Rebuild when **`api/`**, **`web/`**, **`Dockerfile`**, **`docker-compose.yml`**, **`patches/`**, or root **`package.json`** / **`package-lock.json`** change — see **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** (*What gets exercised*, *Patches*, *Faster Docker rebuilds*). |
| **Deployment** | There is **no** bind-mounted dev server: the app is **`web/dist` + `api/dist`** inside the image. Do **not** tell the user to “just refresh” without a rebuild unless the change is docs-only. Always give the **exact** base URL (**`http://localhost/`** or **`http://localhost:<HOST_PORT>/`**). |
| **Logging** | Follow **[`docs/LOGGING.md`](docs/LOGGING.md)** for all new or changed server and client logging: **`req.log`** / **`createLogger`**, levels (**`debug`** for routine mutations with ids), **never** secrets or tokens. For local troubleshooting, **`LOG_LEVEL=debug`** in **`.env`** and **`docker compose logs -f app`** — see **DEVELOPMENT.md** and **LOGGING.md**. |
| **Changelog** | For any change that affects **build output** or **runtime behaviour** (`api/`, `web/`, **`Dockerfile`**, **`docker-compose.yml`**, migrations, dependency changes that ship), add a bullet under **`[Unreleased]`** in **[`CHANGELOG.md`](CHANGELOG.md)** in the **same change**. See **[`.cursor/rules/changelog.mdc`](.cursor/rules/changelog.mdc)** for skip rules (docs-only / comment-only / no ship impact). |

**Skip** `make dev` only for **docs-only** or **comment-only** changes with **zero** build or runtime effect.

**Skip** a changelog entry only when the change **cannot** affect what ships or how the app behaves (same bar as changelog rule — pure docs, comment-only, or non-shipping metadata).

### Docker image: patches and dependencies

- **`patches/`** — **`patch-package`** applies fixes under **`node_modules`** at **`npm install`** (e.g. **FortuneSheet**). The **builder** stage **`COPY patches`** before **`npm install`** so Docker builds include the same patches as local dev. **Commit** new **`patches/*.patch`** files with the change that needs them.
- **Runner stage** uses **`npm install --omit=dev --ignore-scripts`** for the API workspace only — **`patch-package`** is **not** required at runtime; the SPA is already compiled into **`web/dist`**.
- **Heavy OS packages** (Poppler, ImageMagick, **LibreOffice**) install in the **runner** image in **separate layers** with **BuildKit** **`apk`** cache mounts — first builds or cache misses are slow; see **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** → *Faster Docker rebuilds* and *Heavy runtime packages*.

---

## Read in this order

| Doc | Purpose |
|-----|---------|
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Locked product + stack choices |
| [`docs/FEATURE_REQUIREMENTS.md`](docs/FEATURE_REQUIREMENTS.md) | User-journey analysis, competitive research, prioritised feature requirements |
| [`docs/REALTIME.md`](docs/REALTIME.md) | Authoritative realtime model: SSE vs Yjs, wire format, implementation checklist |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Local testing = **Compose only** (`make dev`); **Git commits** — small logical units, message style |
| [`docs/LOGGING.md`](docs/LOGGING.md) | **Structured logging:** `req.log` / `createLogger`, levels, no secrets, web `logDebug` |
| [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) | **Operator-facing** how-to (keep in sync when UX changes) |
| [`docs/MAINTAINING_DOCS.md`](docs/MAINTAINING_DOCS.md) | **Doc ownership** — what to update when |
| [`docs/CODEBASE_REVIEW.md`](docs/CODEBASE_REVIEW.md) | **Audit backlog** — known issues, doc drift, follow-ups (update when fixed) |
| [`CHANGELOG.md`](CHANGELOG.md) | **Release notes** — **`[Unreleased]`** entries for fixes/features that ship |
| [`.cursor/rules/agents-process.mdc`](.cursor/rules/agents-process.mdc) | **Default:** full **commit + `make dev` + health + changelog + USER_GUIDE + report URL** — do not wait for the user to say “follow the process” |
| [`.cursor/rules/git-commits.mdc`](.cursor/rules/git-commits.mdc) | Commit **each logical unit** separately; **short, specific, imperative** messages |
| [`.cursor/rules/local-docker-deploy.mdc`](.cursor/rules/local-docker-deploy.mdc) | After code changes, run **`make dev`** yourself |
| [`.cursor/rules/changelog.mdc`](.cursor/rules/changelog.mdc) | After notable code/build changes, update **`CHANGELOG.md`** |
| [`.cursor/rules/logging.mdc`](.cursor/rules/logging.mdc) | Structured logging — **`req.log`**, **`createLogger`**, no secrets |
| [`.cursor/rules/code-patterns.mdc`](.cursor/rules/code-patterns.mdc) | Concrete examples: new routes, pages, queries, CSS tokens |
| [`.cursor/rules/pitfalls.mdc`](.cursor/rules/pitfalls.mdc) | Explicit **do-not** list — Yjs, Redis, styling, migrations |

---

## Local testing after each change (checklist)

**Goal:** One process — **Docker Compose** rebuilds and runs the full stack. The human opens the same URL operators would use on a LAN.

**Agent checklist at end of a coding task** (skip only when [Development process](#development-process-agents--follow-end-to-end) says to skip):

1. From the **repository root**, run **`make dev`** (`docker compose up -d --build`) so the **app image** matches what ships. The image embeds **`web/dist`** and **`api/dist`** — there is no hot reload from host source; if the UI/API still looks stale after `make dev`, run **`make dev-fresh`** (no-cache rebuild of `app`). Rebuild after changes to **`patches/`** or root **`package.json`** / **`package-lock.json`** (not only **`api/`** / **`web/`**). Faster rebuild tips: **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)** → *Faster Docker rebuilds*.
2. Confirm the stack is up (e.g. **`docker compose ps`**, or **`GET /api/v1/health`** on the app port).
3. **Tell the user the exact base URL:** **`http://localhost/`** when **`HOST_PORT`** is unset or **80**; otherwise **`http://localhost:<HOST_PORT>/`** (from **`.env`**).
4. If you changed **logging** or need to verify server behaviour, tail **`docker compose logs -f app`** with **`LOG_LEVEL=debug`** as needed — see **[`docs/LOGGING.md`](docs/LOGGING.md)**.
5. If the task required a **changelog entry** (see [Development process](#development-process-agents--follow-end-to-end)), confirm **`CHANGELOG.md`** has an **`[Unreleased]`** bullet — do not finish without it.
6. If the workspace is a **Git** repo: **`git commit`** after each **logical unit** of work completed in the session (see **Commits** in [Development process](#development-process-agents--follow-end-to-end)); do not leave a large uncommitted diff unless the user asked to hold commits.

---

## Two realtime systems (do not merge them)

1. **Schedule & domain data** (events, stages, days, performances, settings)  
   - **Source of truth:** REST under `/api/v1/...`.  
   - **Live updates:** `GET /api/v1/realtime` (Server-Sent Events). After mutations, the API calls `broadcastInvalidate()` with **TanStack Query `queryKey` tuples**; the web client’s `RealtimeSync` invalidates those keys.  
   - **Do not** put this data in Yjs for “simplicity.”

2. **Collaborative patch / RF workbook (FortuneSheet)**  
   - **Sync:** WebSocket `/ws/v1/collab/:performanceId` (performances) and `/ws/v1/collab-template/:templateId` (templates) + **Yjs** binary protocol.  
   - **Persistence:** Postgres `performance_yjs_snapshots` (seeded from the stage’s chosen global `patch_templates` workbook when a performance is created).  
   - **Do not** route workbook updates through the SSE channel.

---

## Obligations when you change code

- **User-visible behaviour** (routes, settings, clocks, templates, labels): update [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) when practical in the same change; follow [`docs/MAINTAINING_DOCS.md`](docs/MAINTAINING_DOCS.md). Cursor rule **`user-documentation`** restates this.
- **Notable fixes and features** (anything that ships in the image or changes runtime): add a line under **`[Unreleased]`** in [`CHANGELOG.md`](CHANGELOG.md); Cursor rule **`changelog`** restates when to skip.
- **Git history:** commit in **small logical steps** with **clear messages**; Cursor rule **`git-commits`** restates granularity and message style.
- **New or changed REST mutation** that affects UI-visible data: extend `broadcastInvalidate([...])` in the API route (immediately after success) with keys that match **`queryKey` usage in `web/src/`**. See [`docs/REALTIME.md`](docs/REALTIME.md).
- **New TanStack `useQuery`:** ensure relevant mutations invalidate that key via `broadcastInvalidate`.
- **Do not** add a second global realtime mechanism without updating [`docs/DECISIONS.md`](docs/DECISIONS.md) and [`docs/REALTIME.md`](docs/REALTIME.md).
- **Logging:** follow [`docs/LOGGING.md`](docs/LOGGING.md) — mutations at **`debug`** with entity ids, **`info`** / **`warn`** for auth/settings outcomes, **`req.log`** in handlers, **`createLogger`** off-request; never log passwords or tokens.

---

## Current implementation status

| Track | Status | Notes |
|-------|--------|-------|
| CRUD (events → stages → days → performances) | **Done** | Full REST API + SSE invalidation, inline edit/delete all entities |
| Auth (optional shared password) | **Done** | Session cookie, `@fastify/cookie` |
| Stage clocks | **Done** | Day clock, distance layout (fullscreen or `?kiosk=1`), band nav, auto-advance, message overlay, warning colours |
| Collaborative patch/RF workbook (Yjs + FortuneSheet) | **Done** | WebSocket sync, Yjs persistence, template cloning, band-to-band nav, patch **sidebar** (changeover, clock, now/next, rider/plot, collapsible), theme-aligned **toolbar / sheet chrome**; **cell selection / editor** use **FortuneSheet defaults** |
| Global patch template library | **Done** | Upload OOXML Excel (`.xlsx`, `.xltx`, `.xlsm`, `.xltm`, …); **blank** patch = no stored template (stage **None**); optional **`examples/`** starters; in-app edit, preview, rename, replace, duplicate, delete |
| DHSL footer branding | **Done** | Fixed "Powered by" footer |
| Rider / plot attachments (stage + performance) | **Done** | Upload (Other by default), **Rider** / **Stage plot** toggles, drag-drop, inline PDF viewer, **convert to PDF** (ImageMagick / LibreOffice / pdf-lib), extract page via **pdf-lib** with **server-side** Poppler thumbnails, delete with confirmation |
| Responsive layouts | **Done** | Hamburger nav, stacked forms, 768/1024 breakpoints, print styles, reduced motion, skip-to-content |
| Event export / import packages | **Done** | JSON export/import of full event with stages, days, performances, and Yjs snapshots |
| Global search | **Done** | `GET /api/v1/search?q=` searches bands/events/stages; `Ctrl+K` / `/` shortcut |
| Connection status | **Done** | SSE connection state via React context; yellow/red banners |
| Keyboard shortcuts | **Done** | `/` search, `?` help, `g e/m/c/s` nav (incl. **My stage today**), `Alt+Arrow` band nav, `F` fullscreen clock |
| Performance management | **Done** | Now/next, changeover display, duration, inline notes, swap/shift, duplicate, overlap hints, print |
| Offline resilience | **Done** | TanStack `networkMode: offlineFirst`, beforeunload warning |
| Client logo branding | **Not started** | Configurable logo in header |

---

## Known constraints (read before making changes)

- **Yjs version pin**: `@y/protocols` must stay at `1.0.6-1` and `yjs` at `13.6.30`. The `@y/websocket-server` package wants Yjs 14 (`@y/y`), but the rest of the app uses Yjs 13. Upgrading without careful testing will break WebSocket connections. See [`docs/DECISIONS.md`](docs/DECISIONS.md) for details.
- **FortuneSheet**: Core spreadsheet dependency. Collaboration uses its `onOp`/`applyOp` API with a Yjs `opLog` (append-only `Y.Array` of serialized ops). **Server-side decode** for export/preview clones replays the opLog in **`api/src/lib/yjs-oplog-replay.ts`** (direct JSON mutation — not Immer `applyPatches`, which must capture return values). The Yjs snapshot in **Postgres** is the source of truth for live workbook state; the **`.xlsx`** / **`.json`** on disk is the upload artifact only until replaced. **Upstream bugs** may be fixed via **`patches/`** + **`patch-package`** (see **Docker image: patches and dependencies** above); prefer **upstream PRs** when practical.
- **In-process EventEmitter**: SSE invalidation uses an in-process bus. The app is designed for a single API instance. Adding a second replica requires Redis pub/sub or Postgres `LISTEN/NOTIFY` — see [`docs/REALTIME.md`](docs/REALTIME.md).
- **No Redis**: Redis is not in the stack. Do not attempt to use Redis clients without first adding the service to `docker-compose.yml`.
- **Container runs as `node` user**: The Dockerfile switches to a non-root user. Ensure file writes (uploads) go to the mounted volume at `UPLOADS_DIR`.

---

## File map (where things live)

```
api/
  src/
    index.ts              # entry point — migrations, start server
    app.ts                # Fastify setup — plugins, routes, error handler, static SPA
    db/
      client.ts           # Drizzle client
      schema.ts           # all tables (events, stages, stageDays, performances, patchTemplates, fileAssets, performanceYjsSnapshots)
    schemas/
      api.ts              # shared Zod schemas (params, bodies)
    routes/v1/
      index.ts            # route registration — add new route files here
      events.ts           # Event CRUD
      stages.ts           # Stage CRUD
      stage-days.ts       # StageDay CRUD
      performances.ts     # Performance CRUD + template cloning + GET/PUT …/sheets-export|sheets-import (JSON workbook)
      patch-templates.ts  # Template library CRUD + Excel upload + POST …/blank + JSON sheets import/export
      files.ts            # Attachments upload, list, raw download, PDF extract page, delete
      search.ts           # GET /search?q= — band/event/stage ILIKE search
      export-import.ts    # GET /events/:id/export, POST /import — JSON event packages
      auth.ts             # login / logout / session
      settings-routes.ts  # password management
      meta.ts             # /health, /time
      realtime-sse.ts     # SSE endpoint
    plugins/
      auth-guard.ts       # cookie auth middleware
      collab-ws.ts        # WebSocket routes for Yjs collaboration (performance + template)
    lib/
      log.ts              # Pino logger, createLogger
      drizzle-logger.ts   # optional Drizzle SQL logger when LOG_LEVEL=debug
      realtime-bus.ts     # broadcastInvalidate (EventEmitter → SSE)
      uploads-dir.ts      # getUploadsDir()
      pdf.ts              # PDF page count + single-page extract (pdf-lib)
      pdf-thumbnails.ts   # Poppler JPEG data URLs for PDF previews
      convert-to-pdf.ts   # ImageMagick / LibreOffice / pdf-lib → PDF
      upload-allowlists.ts # allowed MIME/extensions for files + patch templates
      excel-to-sheets.ts  # OOXML Excel → Sheet[]; normalizeSheetFromRaw (+ JSON native passthrough)
      json-patch-template.ts  # FortuneSheet JSON → Sheet[] (upload + REST import; envelope + raw roots)
      workbook-json-envelope.ts  # changeoverlordWorkbook v1 export shape + safe download basename
      yjs-collab-replace.ts  # replace live collab opLog from sheets; snapshot buffer for persist
      default-patch-sheets.ts  # two-tab empty shell for POST …/patch-templates/blank
      sheets-to-excel.ts  # Sheet[] → .xlsx buffer
      sheet-preview.ts    # Sheet[] → preview JSON
      yjs-persistence.ts  # Yjs doc save/load (Postgres snapshots)
      yjs-template-snapshot.ts  # encode/decode template Yjs snapshots
      yjs-oplog-replay.ts       # replay persisted opLog → Sheet[] (export + decode fallback)
      performance-overlap.ts    # schedule validation helpers (same-day intervals)
      session-token.ts    # HMAC session cookie
  drizzle/
    0000_initial.sql      # base schema
    0001_file_assets.sql  # file_assets table
    0002_patch_templates.sql  # templates + stage FK
    0003_add_fk_indexes.sql   # FK column indexes
    0004_file_assets_scope.sql  # performance_id, parent_file_id on file_assets
    0005_file_purpose_drop_plot_from_rider.sql  # migrate plot_from_rider → plot_pdf
    meta/_journal.json    # migration journal — update when adding migrations

web/
  index.html              # SPA entry — includes inline theme script
  src/
    main.tsx              # React root — QueryClient, ThemeProvider, imports CSS
    App.tsx               # routes + Layout + root ErrorBoundary
    ClockNavContext.tsx   # clock nav + “My stage today” preferred stage-day
    global.css            # ALL CSS — tokens, base styles, utility classes
    api/
      client.ts           # apiGet, apiSend, apiSendForm, 401 redirect
      types.ts            # shared response types
    auth/
      AuthGate.tsx        # session check wrapper
    components/
      ErrorBoundary.tsx           # root crash recovery
      PatchWorkbookErrorBoundary.tsx  # FortuneSheet error boundary
      PatchTemplateTools.tsx      # template library UI + stage picker + modals
      ConfirmDialog.tsx           # reusable confirmation modal
      ConnectionStatus.tsx        # header banner: connected/connecting/offline
      SearchDialog.tsx            # global search modal (Ctrl+K, /)
      KeyboardShortcuts.tsx       # ? help overlay + useGlobalShortcuts hook
      PerformanceBandNav.tsx      # prev/next/jump band navigation
      MiniClock.tsx               # small server-synced clock widget
      ClockEndOfDayOverlay.tsx    # post-last-act / next-day crew messaging on clock
      FileAttachments.tsx         # drag-drop upload, inline PDF viewer, extract
      PatchPageSidebar.tsx        # patch page sticky context (clock, changeover, files)
      ExportImportTools.tsx       # export/import event buttons
      PrintDaySheet.tsx           # print-friendly running order table
    pages/                # one file per route (incl. PerformanceFilesPage, PatchPage, …)
    realtime/
      ConnectionContext.tsx  # ConnectionProvider + useConnectionState
      RealtimeSync.tsx       # SSE → TanStack Query invalidation + connection state
    theme/
      ThemeContext.tsx     # light/dark toggle + localStorage
    lib/
      debug.ts            # logDebug() for browser console
      dateFormat.ts        # formatDateFriendly, formatDateShort, minutesBetween, formatDuration, formatCountdown
      useLastVisited.ts    # last-visited stage-day id (localStorage key exported)
      myStageToday.ts      # resolve /stage-days/:id for “today” (My stage today nav)
      patchWorkbookCollab.ts   # shared Yjs/WebSocket workbook hook + op routing
      patchWorkbookYjs.ts      # Yjs hydrate/recalc / sheet activation helpers
      stageDayClockMetrics.ts  # clock page derived metrics (incl. changeover)
      clockSchedule.ts         # clock schedule helpers
    hooks/
      useFitCountdownInBox.ts  # countdown text scaling for clock UI
```

## Handoff — next agent (patch templates / FortuneSheet)

**Last consolidated commit:** patch workbook export replay, **`calcChain`** generation, blank-template **`data`** matrices, DH v6 example + builder script, root **`build:test`** / **`docker:build:app`** scripts.

1. **Verify end-to-end** (Docker must be running — `docker info`):
   - **`make dev`** or **`npm run docker:build:app`** then **`docker compose up -d app`**.
   - **`GET /api/v1/health`**, open **`http://localhost/`** (or **`HOST_PORT`**).
2. **Blank template:** Create **Settings → Create blank template**, edit cells, reload editor — edits should persist (depends on **`data`** + Yjs; see **`api/src/lib/default-patch-sheets.ts`**, **`web/src/lib/patchWorkbookCollab.ts`** **`WORKBOOK_PLACEHOLDER`**).
3. **DH starter:** Import **`examples/DH_Pick_Patch_TEMPLATE_v6.json`** via **Import workbook JSON** or **`PUT /api/v1/patch-templates/:id/sheets-import`** to refresh a library template; confirm cross-sheet formulas and **Export JSON** match live state.
4. **Regenerate v6:** **`node scripts/build-dh-template.mjs > examples/DH_Pick_Patch_TEMPLATE_v6.json`** — then commit if structure changes.
5. **Open questions (if user still reports issues):** First-paint formula display vs **`calculateFormula`** (headless **`execfunction`** works); merge / **“Merge info is null”** console noise; FortuneSheet **`deleteRowCol`** adjusting formulas on other sheets (known upstream risk — prefer JSON import to reset).
6. **Docs:** Keep **`docs/PATCH_TEMPLATE_JSON.md`** and **`docs/USER_GUIDE.md`** aligned if export/import or blank-template behaviour changes (**`docs/MAINTAINING_DOCS.md`**).

---

## Cursor rules

Project rules live in **`.cursor/rules/`**:
- **`pitfalls.mdc`** — things that will break the app (read first)
- **`code-patterns.mdc`** — concrete examples to copy
- **`git-commits.mdc`** — one commit per logical unit; short, specific, imperative messages
- **`local-docker-deploy.mdc`** — run `make dev` after changes
- **`changelog.mdc`** — update `CHANGELOG.md` for notable code/build changes
- **`realtime-and-data-sync.mdc`** — SSE vs Yjs split
- **`logging.mdc`** — structured logging
- **`user-documentation.mdc`** — keep USER_GUIDE.md in sync
