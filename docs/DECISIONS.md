# Engineering decisions (pre-build)

Canonical choices before implementation. Update when something changes.

---

## Product

### Multi-person prep (events / stages / days)

- Different people may prepare **different events, stages, or stage-days** on **different machines**.
- **Export scope** (separate packages): **whole event**, **one stage** (all its days), or **one stage-day** — so preparers move **only** the slice they own.
- **Import** always creates **new** records (see **IDs** below) so nothing is silently overwritten.
- Operators can **delete** obsolete events/stages/days in the UI when a newer package has been imported or prep was wrong.
- **"Replace with new"** (optional UX): **delete** the old scope then **import** again — same effect as replace without a dangerous merge. Automated "swap" can be a later convenience.

### Time (local event)

- Each **event = one physical location** — schedule times are **local event time** in v1 (store and display as local; no cross-timezone rules).
- **Server time API** answers "what time is it now" on the host for countdowns; comparing to the running order uses **event-local** times.

### v1 deployment posture

- **Audience**: **DHSL staff**; **offline** private LAN at show — **no** internet required for runtime.
- **Backups**: **External** (host backup of **`DATA_DIR`**, snapshots, etc.). **In-app backup/restore** — **future** version, not v1.

### Accountability

- **Not required** for v1 (no per-user edit history).

### Spreadsheet shape

- **One collaborative workbook per performance** — multiple **sheets** inside it (e.g. **Input**, **RF**). Patch and RF material live in that file.
- **Stage default template** (authored **in-app** or imported from **Excel / GSheets → `.xlsx`**) is **cloned** into each new performance.

### Visual UI

- **Two first-class themes**: **light** (daylight / outdoor prep) and **dark** (venue). Shared **design tokens** (spacing, type, radius, colours) — **no** one-off screens.
- **Brand accent** from **DHSL logo** — **industrial red** for interactive / "now" emphasis; **re-sample** hex from bundled **`dhsl-logo.svg`** when added. See the **Visual design** section below.
- **Default** follows **`prefers-color-scheme`**; **manual** theme toggle in Settings (persist locally).

### Internationalisation

- **English only** for MVP (UI copy, errors, docs).

---

## Identity & import/export

### IDs (UUIDs)

- Use **UUID v4 (or v7)** for all primary keys exposed in APIs and **export packages** — stable across systems, no collision on import, no sequential guessing.

### Event package import

- **Always import as new** entities (new UUIDs) — never merge by reusing old IDs from another server unless we add an explicit **advanced** flow later.
- **Deletion** of old data is manual (or bulk "delete event") so crews stay in control on the **live** machine.
- Export **manifest** must record **scope** (event / stage / stage-day) so imports validate expected contents.
- **`POST /api/v1/import`** uses a **64 MiB** JSON **`bodyLimit`** — **version 2** packages embed every performance workbook (**`sheets`**); Fastify’s default **1 MiB** cap would reject typical exports.

---

## Auth & threat model

### Modes

- **Default: no password** — assume **trusted LAN** (festival private network).
- **Optional: single shared password** — stored hashed in DB; session cookie; same password for all users in MVP.

### When no password is set

- Treat as **trusted environment**: still follow **normal HTTP security hygiene** (CSRF for cookie-changing actions when we add forms, sane cookies) but **no** forced HTTPS requirement for LAN IP access.
- When a password **is** set or the app is **internet-facing**, follow **stricter** defaults: `Secure` cookies where HTTPS, rate limits on login (**15 attempts / 5 minutes** per IP on **`POST /auth/login`**, fixed *try again* copy), **`@fastify/helmet`** without **Content-Security-Policy** for the SPA until nonces/hashes are justified (LAN-first).

---

## Limits (avoid "computer says no" on stage)

Set **generous** server-side maximums; **soft** warnings in UI before hard failures where possible.

| Area | Starting point (tune with real use) | UX |
|------|-------------------------------------|-----|
| **Upload** (single file) | **100 MB** | Clear message if exceeded; suggest split/compress PDFs |
| **Export package** (zip) | **500 MB** | Warn when approaching limit |
| **Spreadsheet** | **50k cells** per performance **workbook** (configurable; tune if multi-sheet totals differ) | Warn before limit; prefer scrolling over hard cap if performance allows |
| **Request body** | Match largest upload + headroom | Same as upload limit |

If a limit is hit, message must be **short, actionable** ("File too large — max 100 MB — try compressing the PDF") — **no** stack traces to end users.

---

## Browsers

- Support **current** and **previous major** versions of **Chrome, Firefox, Safari, Edge** (desktop + mobile).
- Avoid **brand-new** APIs without fallbacks; assume devices are **reasonably up to date** (crew phones/tablets refreshed within a few years).
- **Fullscreen** clock: progressive enhancement if Fullscreen API missing (still show clock, "tap for fullscreen" optional).

---

## Stack (locked for v1)

| Layer | Choice |
|-------|--------|
| Runtime | **Node.js** (LTS) |
| API | **Fastify** + **TypeScript** |
| DB access | **Drizzle ORM** + **PostgreSQL** (migrations in repo) |
| Validation | **Zod** |
| Realtime | **WebSockets** JSON op relay (patch workbook); **SSE** (`/api/v1/realtime`) for schedule / domain cache invalidation |
| Frontend | **Vite** + **React** + **TypeScript** + **TanStack Query** |
| Spreadsheet UI | **FortuneSheet** + **`@zenmrp/fortune-sheet-excel`** (Excel import) + **ExcelJS** (blank template export) |
| Tests (later) | **Vitest** (unit) + **Playwright** (e2e smoke) |

*Rationale: one language end-to-end, strong typing, Fastify is fast and simple, Drizzle keeps migrations SQL-first.*

### FortuneSheet — fork (`doug86i/fortune-sheet`, branch `dhsl/v1.0.4`)

**Where tarballs live, Docker `COPY vendor`, and the contributor/agent steps to rebuild and refresh the lockfile:** **[`AGENTS.md`](../AGENTS.md)** § *Docker image: FortuneSheet fork and dependencies* (subsection *FortuneSheet fork — updating tarballs*). **Git/upstream workflow** (one commit per fix, **`git push origin dhsl/v1.0.4`** after each fork commit, merging upstream): **[`../.cursor/rules/fortune-sheet-fork-upstream.mdc`](../.cursor/rules/fortune-sheet-fork-upstream.mdc)**.

This section records **rationale**, the **pinned fork commits**, and **how the editor interacts with this app** (Immer, collab, relay) — not the tarball update checklist.

**Why fork instead of `patch-package`:** `patch-package` edited compiled 80k-line dist bundles — fragile, unreadable, no type checking, breaks on upstream version bumps. The fork applies fixes as **TypeScript source commits** (`packages/core/src/`) with the upstream build tooling (`father-build`), then `npm pack` produces tarballs committed to `vendor/`.

**Commits on `dhsl/v1.0.4`** (each isolated):

1. **Touch pan** (`modules/mobile.ts`): anchor scroll to `initialScrollLeft`/`initialScrollTop` at `touchstart` instead of cumulative delta. Fixes iOS pan speed.
2. **`getSheetIndex`** (`utils/index.ts`): compare `String(id)` for id string/number round-trip safety; return `null` when id is nullish.
3. **`addSheet`** (`modules/sheet.ts`): only block when `allowEdit === false` AND no `sheetData`; collab replay with `sheetData` runs on read-only viewers.
4. **`deleteSheet`** (`modules/sheet.ts`): remove `allowEdit === false` guard so remote deletes apply everywhere.
5. **`applyOp` + `initSheetData` (remote add tab):** `patchToOp` can emit **`addSheet`** with **`value: addSheetOps[0]?.value`** — that value is sometimes **`undefined`**. Upstream **`applyOp`** still called **`api.initSheetData(ctx_, fileIndex, specialOp.value)`**, which destructures **`newData`** and **throws**. Fork guards: skip when payload is missing; call **`initSheetData`** only when **`getSheetIndex`** is non-null (`packages/react/src/components/Workbook/api.ts`).
6. **`initSheetData` (core):** return **`null`** when **`newData`** is nullish; resolve the target row in **`luckysheetfile`** by **`newData.id`** when the passed index is null or does not match that id (`packages/core/src/api/sheet.ts`).
7. **React `Workbook` `initSheetData` (duplicate helper):** upstream has a **second** `initSheetData` in **`packages/react/src/components/Workbook/index.tsx`** (separate from **`api.initSheetData`** in core). It used to destructure **`newData`** with no null check and wrote **`d[index]`** with **`index`** from **`getSheetIndex`** cast to **`number`**. When **`getSheetIndex`** was **`null`** (e.g. id mismatch during collab / empty-workbook bootstrap), remotes crashed. Fork guards: null **`newData`/`index`**, bounds-check, skip **`forEach`** rows when index or sheet is missing (`packages/react/src/components/Workbook/index.tsx`).
8. **Defer collab `onOp` out of React state updaters:** **`packages/react/src/components/Workbook/index.tsx`** — **`setContextWithProduce`**, **`handleUndo`**, and **`handleRedo`** used to call **`emitOp` / `onOp`** *inside* **`setContext`** functional updaters (a **side effect in an updater**). React can invoke those updaters more than once; each **`addSheet`** batch carries a **new sheet UUID**, so **server `addSheet` idempotency by `id`** does not dedupe duplicate emissions. **Fix:** queue **`{ ctx, patches, options, undo }`** on a ref and flush the queue from **`useLayoutEffect`** after commit (preserves order when multiple emits enqueue in one batch). On **`doug86i/fortune-sheet`** branch **`dhsl/v1.0.4`**: commit *Defer collab onOp to useLayoutEffect (avoid duplicate addSheet)* — **push the fork after commit** before refreshing **`vendor/fortune-sheet-react-1.0.4.tgz`** here (see **AGENTS.md**). Suitable for an **upstream PR** to `ruilisi/fortune-sheet`.

**Op apply & Immer paths (this app):** FortuneSheet **`applyOp`** turns each remote **`Op[]`** batch into Immer patches whose paths include **`data/<row>/<col>`** (and related keys) on the **sheet `data` matrix** in editor context — not Excel **`A1`** addresses. Patches assume the target **`luckysheetfile[].data`** rows/columns **already exist**. If a client mounts **`Workbook`** with **`data`** that is **too small** for an incoming op batch, **`applyOp`** can throw **`[Immer] Cannot apply patch, path doesn't resolve`**. Mitigations: the server keeps a full **`Sheet[]`** in **`sheets_json`** and sends **`fullState`** on WebSocket connect / reconnect so clients remount with matching dimensions; REST **`GET …/sheets-export`** mirrors the same JSON. On client **`applyOp`** failure (e.g. corrupt message), log and skip; operator recovery: reload or re-open the patch page.

**`jfrefreshgrid` vs `batchCallApis`:** The React **`Workbook`** **`batchCallApis`** helper only invokes functions on the frozen **`api`** object from **`@fortune-sheet/core`**. **`jfrefreshgrid`** is a **separate named export** in core and is **not** registered on **`api`**, so **`batchCallApis([{ name: "jfrefreshgrid", … }])`** only logged a console warning. Collab recalc uses **`api.calculateFormula`** per sheet (via **`batchCallApis`**) plus **`WorkbookRef.calculateFormula()`**.

**Immer `autoFreeze` (this app):** FortuneSheet's `setContext` uses **`produceWithPatches`** (Immer). After `produce` finishes, Immer's `autoFreeze` recursively freezes the returned state tree. React 18 may **replay** the state-updater function (concurrent mode / Strict Mode double-invoke). `addSheet` mutates its `sheetData` argument (`delete sheetData.data`) then pushes it to `ctx.luckysheetfile` — making it part of the state and therefore frozen. A replayed updater captures the **same `ops` closure** → `opToPatch` returns the **same frozen** `sheetData` reference → `delete` throws **`Unable to delete property`**. Fix: **`setAutoFreeze(false)`** in **`web/src/main.tsx`** before FortuneSheet loads. This is the standard Immer production configuration and prevents this entire class of freeze-vs-replay crashes without touching the fork.

**Patch workbook collaboration (relay):** Aligns with FortuneSheet’s documented collab flow ([**op.md**](https://github.com/ruilisi/fortune-sheet/blob/master/docs/guide/op.md), [**applyOp**](https://github.com/ruilisi/fortune-sheet/blob/master/docs/guide/api.md), [**Collaboration.stories.tsx**](https://github.com/ruilisi/fortune-sheet/blob/master/stories/Collabration.stories.tsx), [**backend-demo**](https://github.com/ruilisi/fortune-sheet/tree/master/backend-demo)): **`onOp` → WebSocket `{ type: "op", data: Op[] }` → server `applyOpBatchToSheets` on in-memory `Sheet[]` → **other** clients receive either **`{ type: "op", data }`** (typical cell edits) or **`{ type: "fullState", sheets }`** (structural batches: **`addSheet`**, **`deleteSheet`**, full **`luckysheetfile`** replace) so peers match server **`room.sheets` without replaying duplicate structural ops**. Postgres stores **`sheets_json`**; the relay debounces writes (~1.5s) and flushes on room empty / process shutdown. **Yjs was removed** (2026): it duplicated upstream’s design and interacted badly with React 18 Strict Mode duplicate **`onOp`** pushes for non-idempotent ops.

**Duplicate sheet tabs (mitigated):** Server **`addSheet`** idempotency (same **`id`**) plus structural **`fullState`** to peers; **duplicate `onOp` with new UUIDs** is addressed by fork commit **#8** (`emitOp` deferred — **`vendor/fortune-sheet-react-1.0.4.tgz`**). See **[`docs/KNOWN_ISSUES.md`](KNOWN_ISSUES.md) §83**. Persisted duplicates from older builds still need **Export → edit JSON → Import**.

---

## API shape

- **REST** under **`/api/v1/...`** (resources: events, stages, stage-days, performances, **files** (PDF upload/list/extract/raw), patch-templates, settings).
- **WebSocket** patch collab at the **app root** (same origin as the SPA; Vite proxies **`/ws`** in **`make dev-fast`**): **`/ws/v1/collab/:performanceId`**, **`/ws/v1/collab-template/:templateId`**. Session cookie auth matches REST when a password is enabled — not under **`/api/v1`**. See **`docs/REALTIME.md`**.
- **Live updates (schedule / lists)** — **`GET /api/v1/realtime`** (SSE): after mutations, server broadcasts **TanStack Query** `queryKey` tuples to invalidate; clients refetch without refresh. See **[`REALTIME.md`](REALTIME.md)**. (Not used for spreadsheet workbook bytes — those use the collab WebSocket.)
- **Server time**: **`GET /api/v1/time`** (or `/api/v1/health` including skew info later).

---

## Patch workbook persistence (Postgres `sheets_json`)

- **Performances:** table **`performance_workbooks`** — one row per performance, column **`sheets_json jsonb`** (FortuneSheet **`Sheet[]`**). Seeded when the performance is created from the stage’s default template.
- **Templates:** **`patch_templates.sheets_json`** — same shape; updated on upload/replace/JSON import and by the template collab relay.
- **Not** an unbounded event log: the relay may apply ops in memory between debounced writes, but durability is the latest **`sheets_json`** snapshot.

---

## Migrations & upgrades

- **Drizzle** **migrations** run **automatically** on API container start (`migrate` then `listen`) — documented in README. They apply **incremental SQL**; they do **not** wipe the database.
- **CI / `git push`** publishes container images only — **no** database reset is performed in the pipeline.
- **Operators**: **backup `DATA_DIR`** before upgrading **image tag**; release notes call out breaking DB changes. Optional full reset (delete Postgres data dir / volume) is a **manual** decision on a given host, not something that happens on every deploy.

---

## Testing & load

### E2E

- **Playwright** smoke: **login (if password)** → create event → add performance → open patch view — run in **CI** on PRs (optional: only `main` to save minutes).

### Load (planning numbers)

- Design for **~30 concurrent** WebSocket connections per **stage** (patch + RF viewers); **~100** HTTP RPS peak on API for a single host — adjust after first real festival.

---

## Logging & debug

- **`LOG_LEVEL`** env: `error` \| `warn` \| `info` \| `debug` \| `trace` — **`docker-compose.yml`** defaults **`debug`** for local **`make dev`** (verbose structured logs); set **`LOG_LEVEL=info`** in **`.env`** for quieter operation on a **show LAN** (**never** leave **`trace`** on shared laptops without need).
- Passed via **`docker-compose.yml`** into the **`app`** service (`LOG_LEVEL`).
- **API:** Pino JSON logs (one line per event); use **`req.log`** in routes, **`createLogger(component)`** elsewhere; redact password/cookie paths — see **[`LOGGING.md`](LOGGING.md)**.
- **Web:** optional **`logDebug()`** in **`web/src/lib/debug.ts`**; enable in prod builds only with **`VITE_LOG_DEBUG=true`** (see **`LOGGING.md`**).

---

## Visual design

Goals: **clean**, **modern**, and **consistent** — readable in **bright daylight** (office, festival compound, outdoor prep) and **dark venues** (FOH, stage wings, dim backstage).

### Principles

| Principle | Meaning |
|-----------|---------|
| **One system** | Shared spacing scale, type scale, radius, and component patterns — no one-off screens. |
| **Clarity over decoration** | Flat surfaces, subtle borders or shadows only where hierarchy needs it; no busy gradients on core work surfaces. |
| **Glanceable at distance** | Timeline and clock: large time labels, strong figure/ground contrast, limited simultaneous accents. |
| **Touch-first where it matters** | Minimum 44x44 px tap targets on primary actions (prev/next band, clock, tab switches). |

### DHSL logo → UI (brand cues)

The **Doug Hunt** wordmark drives palette and personality; the app chrome stays calm so schedules and grids stay readable.

| Cue from logo | In the product |
|---------------|----------------|
| **Industrial red** | Primary accent — links, focus rings, "now playing" row, primary buttons. Token `--color-brand` ≈ `#E30613` — re-sample from official `dhsl-logo.svg` when it lands. |
| **Wide, geometric caps** | Optional wide `letter-spacing` on the app title or section headers only — not on body copy or spreadsheet cells. |
| **Slight rounding** on letterforms | Consistent `border-radius` on controls and cards (6-8px) — crisp, not playful blobs. |
| **High contrast** | Red reads on white (daylight) and on near-black (venue) — same accent in both themes. |

**Neutrals:** cool greys for backgrounds and borders so the red stays the single loud colour.

### Light and dark (two first-class themes)

| Context | Theme | Why |
|---------|-------|-----|
| **Daylight / bright** | **Light** | Paper-like screens; dark UI washes out in sun. |
| **Dark venue** | **Dark** | Protects night vision; matches typical stage tooling; less eye strain on long shifts. |

Both themes ship in v1. Default follows `prefers-color-scheme` (OS), with a manual override in Settings.

### Tokens

CSS variables (`:root[data-theme]` in `web/src/global.css`):

- **Background / surface / elevated** — 2-3 layers (page, card, modal).
- **Text** — primary, secondary, muted; never rely on grey-on-grey below WCAG AA contrast.
- **Accent** — one primary accent (DHSL brand red); one semantic set (success / warning / danger) for schedule state.
- **Borders** — hairline separators; slightly stronger in dark mode.
- **Radius** — one small (inputs, chips) and one medium (cards, sheets).

Typography: one sans family (system stack). Hierarchy = size + weight (600 for section titles, 400-500 for body).

### Surfaces by feature

| Area | Notes |
|------|-------|
| **Running order / day** | Neutral surfaces; "now" row uses accent background or strong left border. |
| **Spreadsheet** | FortuneSheet skinned to match tokens (grid + headers align with app chrome). |
| **Fullscreen clock** | Maximum contrast: huge numerals, minimal chrome. |
| **Settings / admin** | Same chrome as rest of app. |

### Branding (within the system)

- **Client logo** in header: contained in a predictable slot; no stretching full-bleed.
- **DHSL footer** — wordmark + "Powered by…" uses `--color-brand`; must pass contrast checks on both themes.
- **Canonical files** — `web/public/branding/README.md`.

---

## Related docs

- **[`README.md`](README.md)** — index of all `docs/` files
- **[`../README.md`](../README.md)** — project overview and Docker deploy
- **[`../AGENTS.md`](../AGENTS.md)** — AI assistants and architecture obligations
- **[`ROADMAP.md`](ROADMAP.md)** — product vision and roadmap
- **[`DEVELOPMENT.md`](DEVELOPMENT.md)** — local Docker workflow
- **[`REALTIME.md`](REALTIME.md)** — SSE live invalidation vs patch workbook WebSocket collaboration
- **[`LICENSING.md`](LICENSING.md)** — repo + dependency licences
