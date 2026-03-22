# Known issues

**Audience:** developers and AI assistants.  
**Purpose:** single canonical list of known issues, technical debt, and follow-ups (API, web, DB, Docker, CSS, docs, realtime).  
**Maintenance:** update this file when items are fixed or superseded; do not duplicate operator-facing detail in [`USER_GUIDE.md`](USER_GUIDE.md).

**2026-03 sweep:** Many security, API, realtime, and web items below were implemented in code; see root **[`CHANGELOG.md`](../CHANGELOG.md)** § **`[Unreleased]`** for the concrete list. This file still contains the original write-ups for traceability. **Critical §1–4, §37–§40** are reconciled with current code (Mar 2026); medium/low sections may still list superseded items until reviewed.

**Recently addressed (low-risk, 2025-03):** **#4** raw download **ENOENT → 404**; **#11** pool **`error`** listener + log; **#13** PDF iframe background uses **`var(--color-surface)`** in **`FileAttachments`**; **#14** header **`aria-label`**s (**`App.tsx`**); **#15** **`KeyboardShortcuts`** / **`SearchDialog`** timer cleanup; **#19** **`REALTIME.md`** template collab path; **#22** merged duplicate **`[Unreleased] ### Fixed`** in **`CHANGELOG.md`**; **#23–24** **`pitfalls.mdc`** (oplog replay caveat + bridge file paths); **#25** root **`README.md`** already lists **`PATCH_TEMPLATE_JSON.md`**; **#26** **`code-patterns.mdc`** shows **`useQueryClient()`**; **#32** deferred **`revokeObjectURL`** in **`downloadWorkbookJson`**; **#18** partial **`AGENTS.md`** file map refresh (lib + web modules + **`0005`** migration).

**Recently addressed (2026-03 continuation):** **#1** import **`importBodySchema`** + **`db.transaction`** + array/snapshot size caps (**`export-import.ts`**); **#2** Excel/JSON path: sparse matrix guards, **`MAX_CELLDATA_ENTRIES`** / **`MAX_CELL_INDEX`**, **`sheets-to-excel`** skips missing rows, **`sheet-preview`** skips negative **`r`/`c`**; **#3** **`resolvePathUnderUploadsRoot`** (**`safe-upload-path.ts`**) on **`files.ts`** + **`patch-templates.ts`**; **#4** raw download missing file → **404**; **#37** CORS: production denies unknown origins unless **`CORS_ALLOWED_ORIGINS`**; dev allows all; **#38** production boot **`assertProductionSessionSecret`** exits if secret missing or equals dev fallback (**`index.ts`**); **#39** collab WebSocket **`maxPayload`** 5 MB (**`collab-ws-relay.ts`**); **#40** **`LoginPage`** **`safeReturnTo`**; **#47** collab WebSocket rejects missing performance/template (**`collab-ws-relay.ts`**); **#50** JSON workbook **`celldata`** capped via **`normalizeSheetFromRaw`** / **`MAX_CELLDATA_ENTRIES`** in **`excel-to-sheets.ts`** (same path as Excel import); **#65** **`ConfirmDialog`** for template delete (**`PatchTemplateTools`**); **#66** mutation errors use **`--color-danger`** + **`role="alert"`** on **Patch** / **Settings** / **PatchTemplateTools** / **Events** create; **#69** **Patch** / **Performance files** breadcrumbs use **`formatDateShort(dayDate)`**; **#76** template rename modals close on **Escape** (window listener); **#78** **`SearchDialog`** results are **`Link`**s; **#79** **`flexShrink: 0`** on list action clusters (**Events**, **Event detail**, **Stage detail** day row, **Stage day** perf actions, **FileAttachments**); **#81** Settings + template library **`minWidth: 0`**, **`maxWidth: "100%"`**, responsive flex labels, full-width **`select`**, **`overflowWrap: "anywhere"`** on long template names.

**Recently addressed (2026-03 doc sweep — medium/low):** **#6** **`POST …/performances/:id/swap`** runs inside **`db.transaction`**; template **`POST …/replace`** writes the new file then updates DB, **`unlink`**s the new path on DB failure, then removes the old file; **#9** **`realtime-sse.ts`** uses **`safeWrite`** (try/catch, **`writableEnded`** check); **#10** **`hhmmToMinutes`** rejects non-**`HH:mm`**, out-of-range values (**`NaN`**); **`validatePerformanceSchedule`** returns explicit error strings; **#11** **`pool.on("error", …)`** in **`db/client.ts`**; **#44** **`POST /files/:id/convert-to-pdf`** returns generic **`Could not convert to PDF`** to clients, logs detail; **#46** performance create wraps **`insert(performances)`** + **`insert(performanceWorkbooks)`** (seed **`sheets_json`**) in **`db.transaction`**; **#47** collab WebSocket rejects missing performance/template (**`collab-ws-relay.ts`** DB lookup before the socket joins the relay room); **#48** per-IP SSE cap via **`reserveSseSlot`** (**`sse-ip-cap.ts`**, max 20); **#52** index **`stages_default_patch_template_id_key`** (**`0007_stages_default_patch_template_index.sql`**); **#53** pool **`connectionTimeoutMillis`** / **`idleTimeoutMillis`**; **`pool.end()`** on SIGTERM/SIGINT (**`index.ts`**); **#56** shift endpoint uses **`db.transaction`** around the update loop.

**Recently addressed (2026-03 — UX / lists / realtime):** **#17** **`RealtimeSync`** **`invalidateQueries({ exact: false })`** so **`["allStagesForClock"]`** invalidates **`["allStagesForClock", …]`**; **#41** **`@fastify/helmet`** with **`contentSecurityPolicy: false`** (no CSP for now — comment in **`app.ts`**); **#42** login **`rateLimit`** 15 / 5 min, message *Too many attempts, try again in 5 minutes.*; **#49** **`ErrorBoundary`** friendly copy + **Copy technical details** only when **`isClientDebugLoggingEnabled`**; **`PatchWorkbookErrorBoundary`** always offers copy (see §49); **#7** **`loadSheetsForPatchTemplateRow`** throws when disk read fails and stored **`sheets_json`** is empty; **preview** / **sheets-export** → **503**; **#54** paginated **`GET /events`** and **`GET /patch-templates`** (default limit **200**, max **500**, **`hasMore`**); web **Load more**; Clock / My stage today use **`fetchAllEvents()`** / **`fetchAllPatchTemplates()`**; **#83** duplicate sheet tabs on collab — idempotent **`addSheet`** (**`workbook-ops.ts`**), remote op filter + consecutive identical **`onOp`** dedup (**`patchWorkbookCollab.ts`**).

---

## Confirm before changing operator-visible behaviour

*No open items from the Mar 2026 UX sweep.* Decisions were shipped: **Helmet** without CSP (see **`api/src/app.ts`**); login rate limit + fixed copy; generic error boundaries + optional **Copy technical details** when client debug is on; template disk read failure → **503** on preview/export when stored **`sheets_json`** is empty; SSE invalidation uses **prefix** matching for clock queries; **GET /events** and **GET /patch-templates** are paginated (long pages). See **[`CHANGELOG.md`](../CHANGELOG.md)** **`[Unreleased]`**.

---

## Critical / high severity

### 1. Import endpoint has no input validation and is non-transactional *(fixed)*

[`api/src/routes/v1/export-import.ts`](../api/src/routes/v1/export-import.ts) (`POST /import`)

**Update:** **`importBodySchema`** (Zod) + **`safeParse`** → 400 on bad packages; full import runs inside **`db.transaction`**; staged array and base64 snapshot sizes are capped.

- ~~Request body is cast to a TypeScript type with **no Zod (or other) runtime validation**.~~
- ~~If `stages`, `stageDays`, or `performances` is missing, `for...of` loops can throw.~~
- ~~Inserts are **not wrapped in a DB transaction** — partial import leaves inconsistent data.~~
- ~~`event.name` is not length/type validated before use.~~
- ~~Large base64 `snapshots` arrays can cause excessive memory allocation (DoS).~~

### 2. Sparse matrix / celldata crashes and DoS risk in Excel utilities *(mostly addressed)*

**Update:** **`sanitizeFortuneSheetDataMatrix`** skips undefined rows before reading **`row.length`**; **`normalizeSheetFromRaw`** enforces **`MAX_CELLDATA_ENTRIES`** and **`MAX_CELL_INDEX`**; **`sheets-to-excel`** skips undefined **`matrix[r]`**; **`sheet-preview`** skips negative **`r`/`c`**. Re-open if a new code path bypasses these helpers.

- ~~[`api/src/lib/excel-to-sheets.ts`](../api/src/lib/excel-to-sheets.ts): `sanitizeFortuneSheetDataMatrix` can read `row.length` when `row` is undefined (sparse `data`).~~
- ~~[`api/src/lib/sheets-to-excel.ts`](../api/src/lib/sheets-to-excel.ts): `matrix[r]` can be undefined.~~
- ~~[`api/src/lib/excel-to-sheets.ts`](../api/src/lib/excel-to-sheets.ts): no cap on `celldata[].r` / `.c` — huge indices can allocate excessive memory.~~
- ~~[`api/src/lib/sheet-preview.ts`](../api/src/lib/sheet-preview.ts): negative `entry.r` / `entry.c` not rejected.~~

### 3. No path-under-uploads guard on file resolution *(fixed)*

**Update:** Both routes resolve storage paths with **`resolvePathUnderUploadsRoot`** from [`api/src/lib/safe-upload-path.ts`](../api/src/lib/safe-upload-path.ts).

~~[`api/src/routes/v1/files.ts`](../api/src/routes/v1/files.ts) and [`api/src/routes/v1/patch-templates.ts`](../api/src/routes/v1/patch-templates.ts) use `path.join(uploadsRoot, row.storageKey)` without verifying the resolved path stays under `uploadsRoot` (defence in depth if `storageKey` is ever wrong).~~

### 4. Raw file download: missing read error handling *(fixed)*

**Update:** Raw read uses try/catch; **`ENOENT`** → **404**.

~~[`api/src/routes/v1/files.ts`](../api/src/routes/v1/files.ts) `GET /files/:id/raw` — `fs.readFile` without try/catch; missing files on disk can surface as 500 instead of 404.~~

### 37. CORS `origin: true` with credentials *(addressed for production)*

**Update:** [`api/src/app.ts`](../api/src/app.ts) — if **`CORS_ALLOWED_ORIGINS`** is set, only listed origins get **`true`**; in **`NODE_ENV=production`** with an empty allowlist, unknown origins are denied. Development still reflects any origin when the allowlist is empty.

### 38. SESSION_SECRET known fallback enables session forgery *(addressed in production)*

**Update:** [`api/src/index.ts`](../api/src/index.ts) **`assertProductionSessionSecret`** — process exits in production if **`SESSION_SECRET`** is unset or equals the dev fallback string. [`api/src/lib/session-token.ts`](../api/src/lib/session-token.ts) still uses the fallback string when **`NODE_ENV`≠`production`** (local dev only).

### 39. No WebSocket message size limit (DoS) *(addressed)*

**Update:** [`api/src/plugins/collab-ws-relay.ts`](../api/src/plugins/collab-ws-relay.ts) registers WebSockets with **`maxPayload: 5 * 1024 * 1024`**.

### 40. Open redirect in login *(fixed)*

**Update:** [`web/src/pages/LoginPage.tsx`](../web/src/pages/LoginPage.tsx) uses **`safeReturnTo`** (relative path only, rejects **`//`** and **`://`**).

---

## Medium severity

### 5. Y.Doc created when `roomId` is falsy *(closed)*

**Closed (2026):** Yjs was removed. [`patchWorkbookCollab.ts`](../web/src/lib/patchWorkbookCollab.ts) opens a WebSocket only when **`roomId`** and **`workbookReady`** are set; there is no CRDT document lifecycle.

### 6. Partial failure risk: swap and template replace *(addressed for swap + replace rollback)*

- ~~[`api/src/routes/v1/performances.ts`](../api/src/routes/v1/performances.ts) `POST .../swap` — two updates without a transaction.~~ **Update:** both updates run inside **`db.transaction`**.
- [`api/src/routes/v1/patch-templates.ts`](../api/src/routes/v1/patch-templates.ts) `POST .../replace` — **Update:** writes the new file, then updates the DB; on DB failure **`unlink`**s the **new** file and rethrows; on success removes the **old** file. Residual edge case: process crash after DB commit but before old-file delete leaves an orphan on disk (low probability).

### 7. `loadSheetsForPatchTemplateRow` disk failure when `sheets_json` empty *(addressed)*

**Update:** When **`patch_templates.sheets_json`** yields **no sheets**, the server reads the on-disk file. If that read/parse fails, the helper **throws** (after **`warn`** log). **`GET …/preview`** and **`GET …/sheets-export`** catch and return **503** with a short operator-facing **`message`** instead of an empty preview/export.

### 8. Auth guard: `hasPassword()` hits DB every request

[`api/src/plugins/auth-guard.ts`](../api/src/plugins/auth-guard.ts) — consider short TTL cache or invalidate on password change only.

### 9. SSE: writes on disconnected clients *(fixed)*

**Update:** [`api/src/routes/v1/realtime-sse.ts`](../api/src/routes/v1/realtime-sse.ts) — **`safeWrite`** wraps **`reply.raw.write`** in try/catch and skips when **`writableEnded`**.

### 10. `hhmmToMinutes` without validation *(addressed)*

**Update:** [`api/src/lib/performance-overlap.ts`](../api/src/lib/performance-overlap.ts) — **`hhmmToMinutes`** requires exactly two integer parts, hour **0–23**, minute **0–59**; otherwise **`NaN`**. **`validatePerformanceSchedule`** returns explicit user-facing errors for bad times and overlaps instead of relying on sort stability alone.

### 11. Postgres pool: no `error` listener *(fixed)*

**Update:** [`api/src/db/client.ts`](../api/src/db/client.ts) — **`pool.on("error", …)`** logs idle client errors.

### 12. Drizzle schema vs migrations drift

[`api/src/db/schema.ts`](../api/src/db/schema.ts) missing vs SQL migrations:

- `file_assets.parent_file_id` FK (`0004`)
- Unique `(stage_id, day_date)` on `stage_days` (`0000`)
- `settings` singleton CHECK (`0000`)
- `patch_templates` `created_at` index (`0002`)

### 13. Hardcoded colours (project rule: CSS variables)

- [`web/src/components/FileAttachments.tsx`](../web/src/components/FileAttachments.tsx) — PDF iframe background.
- [`web/src/components/PrintDaySheet.tsx`](../web/src/components/PrintDaySheet.tsx) — print styles.
- [`web/src/global.css`](../web/src/global.css) — connection banners / status helpers.

### 14. Accessibility

- [`web/src/App.tsx`](../web/src/App.tsx) — search / theme controls: prefer `aria-label` (not only `title`).
- [`web/src/global.css`](../web/src/global.css) — `.inline-edit:focus` drops default outline.
- [`web/src/components/PrintDaySheet.tsx`](../web/src/components/PrintDaySheet.tsx) — print control labelling.

### 15. Timeouts not cleared

- [`web/src/components/KeyboardShortcuts.tsx`](../web/src/components/KeyboardShortcuts.tsx) — `gPending` timeout.
- [`web/src/components/SearchDialog.tsx`](../web/src/components/SearchDialog.tsx) — debounce when dialog closes.

### 16. Docker Compose: DB credentials

[`docker-compose.yml`](../docker-compose.yml) — `POSTGRES_*` / embedded `DATABASE_URL` hardcoded; consider env-driven overrides for non-local deploys.

**Update:** base compose is **pull-only** for the app image (**`docker compose pull && docker compose up -d`**); **`docker-compose.dev.yml`** adds **`build: .`** for **`make dev`**.

### 17. SSE invalidation gaps (stale data across browsers) *(clock prefix addressed)*

**Update:** [`web/src/realtime/RealtimeSync.tsx`](../web/src/realtime/RealtimeSync.tsx) calls **`invalidateQueries({ queryKey, exact: false })`**, so a broadcast **`["allStagesForClock"]`** also invalidates **`["allStagesForClock", "<eventIds-json>"]`** on **ClockPage**.

- `["patchTemplatePreview", id]` in [`web/src/components/PatchTemplateTools.tsx`](../web/src/components/PatchTemplateTools.tsx) — template **workbook** edits over **WebSocket** may not invalidate an open preview query until **`["patchTemplates"]`** / related REST paths refetch (low frequency).

See [`REALTIME.md`](REALTIME.md) and [`AGENTS.md`](../AGENTS.md) for the invalidation contract.

### 41. Security response headers *(Helmet; CSP deferred)*

**Update:** [`api/src/app.ts`](../api/src/app.ts) registers **`@fastify/helmet`** with **`contentSecurityPolicy: false`** (no CSP for the SPA for now — comment in source). Other Helmet defaults still apply. **`Strict-Transport-Security`** follows deployment (HTTPS behind reverse proxy).

### 42. Rate limiting *(login + other caps)*

**Update:** [`api/src/routes/v1/auth.ts`](../api/src/routes/v1/auth.ts) — **`POST /auth/login`**: **15** requests per IP per **5 minutes**; **429** with message *Too many attempts, try again in 5 minutes.* See **[`CHANGELOG.md`](../CHANGELOG.md)** for **`POST /files`**, **`POST /import`**, and patch-template upload limits.

### 43. Rider upload file type validation uses MIME/extension only

[`api/src/lib/upload-allowlists.ts`](../api/src/lib/upload-allowlists.ts) — rider and attachment uploads check client-reported MIME type and filename extension, not file magic bytes. A disguised file reaching ImageMagick or LibreOffice could exploit parser bugs. Template uploads are more robust (PK header check for OOXML, `bufferLooksLikeWorkbookJson` for JSON). Fix: add magic-byte validation for image and document types before conversion.

### 44. Convert-to-PDF errors leak internal paths *(addressed for API response)*

**Update:** [`api/src/routes/v1/files.ts`](../api/src/routes/v1/files.ts) **`POST /files/:id/convert-to-pdf`** catches conversion errors and responds with **`Could not convert to PDF`**; **`req.log.warn`** records the failure. Thrown errors from [`convert-to-pdf.ts`](../api/src/lib/convert-to-pdf.ts) may still embed stderr internally — avoid surfacing them on other code paths if new routes call **`convertFileToPdfBuffer`** directly.

### 45. Orphan files on DB insert failure

[`api/src/routes/v1/files.ts`](../api/src/routes/v1/files.ts) — upload, extract-page, and convert-to-pdf routes write the file to disk with `writeFile` before `db.insert()`. If the insert fails, the file remains on disk with no DB record. Fix: wrap in try/catch and `unlink` the orphaned file on DB failure, or insert the DB record first with a placeholder and update after write.

### 46. Performance creation not transactional *(fixed)*

**Update:** [`api/src/routes/v1/performances.ts`](../api/src/routes/v1/performances.ts) — **`POST /stage-days/:stageDayId/performances`** wraps **`insert(performances)`** and **`insert(performanceWorkbooks)`** / **`onConflictDoUpdate`** in **`db.transaction`**.

### 47. WebSocket allows connections to non-existent rooms *(fixed)*

**Update:** [`api/src/plugins/collab-ws-relay.ts`](../api/src/plugins/collab-ws-relay.ts) — after UUID validation, **`db.select`** verifies **`performances.id`** or **`patchTemplates.id`**; missing rows → **`socket.close(1008, …)`** before joining a room.

### 48. No per-client SSE connection limit *(fixed)*

**Update:** [`api/src/routes/v1/realtime-sse.ts`](../api/src/routes/v1/realtime-sse.ts) calls **`reserveSseSlot(req)`** from [`api/src/lib/sse-ip-cap.ts`](../api/src/lib/sse-ip-cap.ts) (max **20** concurrent SSE connections per IP); excess → **429** **`TooManyConnections`**.

### 49. ErrorBoundary user-facing copy *(addressed)*

**Update:** [`web/src/components/ErrorBoundary.tsx`](../web/src/components/ErrorBoundary.tsx) shows a **generic** message; **Copy technical details** appears only when **`isClientDebugLoggingEnabled`** (dev build or **`VITE_LOG_DEBUG=true`**). **[`PatchWorkbookErrorBoundary`](../web/src/components/PatchWorkbookErrorBoundary.tsx)** always offers **Copy technical details** (room / collab hints, mode, FortuneSheet version string, UA, timestamp; no secrets) because spreadsheet failures are hard to reproduce without a support bundle.

### 50. No celldata size limit per sheet in JSON uploads

[`api/src/lib/json-patch-template.ts`](../api/src/lib/json-patch-template.ts) — `parseWorkbookJsonRoot` caps sheet count (MAX_TEMPLATE_SHEETS = 40) but does not limit the `celldata` array length per sheet. A sheet with hundreds of thousands of entries can cause high CPU/memory usage or OOM. Fix: add a per-sheet celldata cap (e.g. 100k entries).

### 51. bindState race: clients can edit before DB snapshot loads *(closed)*

**Closed (2026):** Yjs **`bindState`** path removed. The collab relay loads **`sheets_json`** (or uses the warm in-memory room) before sending **`fullState`** to a new socket; local edits are not applied until the workbook mounts from that payload.

### 52. Missing index on `stages.default_patch_template_id` *(fixed)*

**Update:** Migration **`0007_stages_default_patch_template_index.sql`** — partial unique index on **`stages(default_patch_template_id)`** where not null (see [`api/drizzle/`](../api/drizzle/)).

### 53. Connection pool missing timeouts and shutdown *(fixed)*

**Update:** [`api/src/db/client.ts`](../api/src/db/client.ts) — **`connectionTimeoutMillis: 10_000`**, **`idleTimeoutMillis: 30_000`**. [`api/src/index.ts`](../api/src/index.ts) — graceful shutdown calls **`await pool.end()`** after **`app.close()`**.

### 54. GET /events and GET /patch-templates pagination *(addressed)*

**Update:** Both list endpoints accept **`page`** and **`limit`** (default **200**, max **500**), returning **`total`** and **`hasMore`**. The **Events** and **Settings** template library UIs use **Load more**; screens that need the full set (**Clock**, **My stage today**, stage template picker) fetch all pages client-side via helpers in [`web/src/api/paginated.ts`](../web/src/api/paginated.ts).

---

## Documentation inconsistencies

### 18. [`AGENTS.md`](../AGENTS.md) file map stale

Missing (non-exhaustive): `pdf-thumbnails.ts`, `convert-to-pdf.ts`, `workbook-ops.ts`, `collab-ws-relay.ts`, `drizzle-logger.ts`; web: `ClockNavContext`, `PatchPageSidebar`, `ClockEndOfDayOverlay`, `PerformanceFilesPage`, `stageDayClockMetrics`, `clockSchedule`, `useFitCountdownInBox`, `patchWorkbookCollab`; migration `0005_*.sql`, `0010_*.sql`.

### 19. [`REALTIME.md`](REALTIME.md) — template WebSocket path

Document `/ws/v1/collab-template/:templateId` alongside performance collab (see [`api/src/plugins/collab-ws-relay.ts`](../api/src/plugins/collab-ws-relay.ts)) — covered in [`REALTIME.md`](REALTIME.md).

### 20. Navigation problems — resolved

The original "Current navigation problems" (formerly in `FEATURE_REQUIREMENTS.md`, now [`ROADMAP.md`](ROADMAP.md)) listed items that are **all implemented** in v1.0.0. Resolved.

### 21. [`LICENSING.md`](LICENSING.md) — Excel pipeline wording

Clarify: **import** via `@zenmrp/fortune-sheet-excel`; **export** / xlsx generation via ExcelJS where applicable.

### 22. [`CHANGELOG.md`](../CHANGELOG.md) — `[Unreleased]` structure

Merge duplicate `### Fixed` / `### Changed` blocks per Keep a Changelog style.

### 23. [`.cursor/rules/pitfalls.mdc`](../.cursor/rules/pitfalls.mdc) vs [`workbook-ops.ts`](../api/src/lib/workbook-ops.ts)

Pitfall text should acknowledge controlled server-side **`applyOpBatchToSheets`** (relay + import/export) and warn against extending it without understanding FortuneSheet ops.

### 24. [`.cursor/rules/pitfalls.mdc`](../.cursor/rules/pitfalls.mdc) — FortuneSheet bridge location

Point to [`patchWorkbookCollab.ts`](../web/src/lib/patchWorkbookCollab.ts) (and [`collab-ws-relay.ts`](../api/src/plugins/collab-ws-relay.ts) on the server), not only page components.

### 25. Root [`README.md`](../README.md) docs table

Add [`PATCH_TEMPLATE_JSON.md`](PATCH_TEMPLATE_JSON.md) if missing.

### 26. [`.cursor/rules/code-patterns.mdc`](../.cursor/rules/code-patterns.mdc)

Frontend mutation example should show `useQueryClient()` when using `qc.invalidateQueries`.

---

## Low severity

### 27. N+1 patterns

- [`export-import.ts`](../api/src/routes/v1/export-import.ts) export: nested loops for stages → days → performances → snapshots (O(stages * days * performances) queries).
- [`events.ts`](../api/src/routes/v1/events.ts) delete: per-stage query to collect day IDs for `broadcastInvalidate`.
- [`performances.ts`](../api/src/routes/v1/performances.ts) shift: one `UPDATE` per performance in a loop.

### 28. Inconsistent API response shapes

Some mutations return `{ ok: true }` instead of `{ resourceName: row }` — document or align.

### 29. Dead CSS in [`global.css`](../web/src/global.css)

Unused classes (e.g. `.bg-ok`/`.bg-warn`/`.bg-danger`, unused clock helpers, `.skeleton*`, `.toast`) — remove or wire up.

### 30. Breakpoint sprawl in `global.css`

**Update:** Patch page breakpoints aligned to **768px** (phone) and **1023px** (tablet sidebar width / collapsed-rail layout); the old **960px** patch stack-to-column rule was removed. Remaining mix (**480** / **640** clock, **767** nav, **1023** main narrow) is intentional per surface — further consolidation optional.

### 31. [`.dockerignore`](../.dockerignore)

Consider ignoring `examples/`, `docs/`, `.cursor/` for smaller build context.

### 32. [`web/src/api/client.ts`](../web/src/api/client.ts) — `revokeObjectURL`

Defer revoke after programmatic download click (e.g. `setTimeout(..., 0)`).

### 33. Breadcrumb loading states

[`PatchPage.tsx`](../web/src/pages/PatchPage.tsx), [`PerformanceFilesPage.tsx`](../web/src/pages/PerformanceFilesPage.tsx) — include parent queries in loading gates where needed.

### 34. Upstream `@y/websocket-server`

Possible race: doc destroyed after async `writeState` while a new client attaches — upstream limitation; monitor when upgrading.

### 35. z-index scale

[`global.css`](../web/src/global.css) — document stacking scale (skip-link, overlays, header, nav).

### 36. FortuneSheet dependency management

**Status:** **Done** — FortuneSheet is now consumed from a **source-level fork** (`doug86i/fortune-sheet`, branch `dhsl/v1.0.4`) as local tarballs in `vendor/`. The previous `patch-package` patches against compiled dist bundles have been removed. See [`DECISIONS.md`](DECISIONS.md) § *FortuneSheet — fork* for the full rationale and update procedure.

### 55. Dockerfile.fast runs as root

[`Dockerfile.fast`](../Dockerfile.fast) — no `USER` directive, so the container runs as root. The production `Dockerfile` correctly uses `USER node`. Fix: add `USER node` to `Dockerfile.fast`.

### 56. Performance shift updates not batched *(fixed)*

**Update:** [`api/src/routes/v1/performances.ts`](../api/src/routes/v1/performances.ts) — **`POST /stage-days/:stageDayId/shift`** runs the per-row **`UPDATE`** loop inside **`db.transaction`**.

### 57. Session cookie missing `secure` flag

[`api/src/routes/v1/auth.ts`](../api/src/routes/v1/auth.ts) — `setCookie` does not set `secure: true`. By design for LAN/HTTP use, but sessions can be intercepted on non-HTTPS networks. Fix: set `secure` conditionally based on whether the app is behind HTTPS (e.g. check `X-Forwarded-Proto` or a config flag).

### 58. `clearCookie` flags don't mirror `setCookie`

[`api/src/routes/v1/auth.ts`](../api/src/routes/v1/auth.ts) — logout `clearCookie` omits `secure` and `sameSite` flags that are set on `setCookie`. Browsers may not clear the cookie if the attributes don't match. Fix: pass the same flags to both.

### 59. Excel CF extract regex may backtrack heavily

[`api/src/lib/excel-cf-extract.ts`](../api/src/lib/excel-cf-extract.ts) — uses regex-based XML parsing on OOXML content. Crafted input with large or deeply nested tags could cause heavy backtracking. Low risk since input is gated by the 10 MB template upload limit.

### 60. Search LIKE wildcards not escaped

[`api/src/routes/v1/search.ts`](../api/src/routes/v1/search.ts) — user input containing `%` or `_` is passed directly into ILIKE patterns, allowing broader matches than the user intended. Not SQL injection, but can return unexpected results. Fix: escape `%` and `_` in user input before building the pattern.

### 61. ClockPage sequential API requests

[`web/src/pages/ClockPage.tsx`](../web/src/pages/ClockPage.tsx) — fetches stages per event sequentially in a loop. For multi-event deployments, this creates a waterfall of requests. Fix: parallelize with `Promise.all` or a batch endpoint.

---

## UI consistency and code duplication

### 62. Server-time sync pattern duplicated five times

The same `useQuery(["serverTime"])` + `offsetMs` + `setInterval` + `now = new Date(tick + offsetMs)` pattern is independently implemented in [`ClockPage.tsx`](../web/src/pages/ClockPage.tsx), [`ClockDayPage.tsx`](../web/src/pages/ClockDayPage.tsx), [`StageDayPage.tsx`](../web/src/pages/StageDayPage.tsx), and [`PatchPageSidebar.tsx`](../web/src/components/PatchPageSidebar.tsx). Tick intervals vary (250ms vs 1000ms) without clear reason. Fix: extract a `useServerTime(opts?: { tickIntervalMs?: number })` hook that returns `{ now: Date; isLoading: boolean }`.

### 63. Duplicated clock/countdown logic across three files

- `parseLocal` (parse `HH:MM` to a Date) is defined independently in [`stageDayClockMetrics.ts`](../web/src/lib/stageDayClockMetrics.ts), [`StageDayPage.tsx`](../web/src/pages/StageDayPage.tsx), and [`ClockDayPage.tsx`](../web/src/pages/ClockDayPage.tsx).
- `sortPerformances` / `sortPerfs` / `sortPerformancesByStart` — identical sort-by-start logic in all three files.
- Urgency thresholds (60s / 300s → danger / warn / ok) are computed inline in `PatchPageSidebar.tsx` and `ClockDayPage.tsx` with the same values but different return shapes.
- `StageDayPage.tsx` reimplements a subset of `computeStageDayClockMetrics` (current index, next index, seconds to next) instead of calling it.

Fix: export `parseLocal` and `sortPerformancesByStart` from `stageDayClockMetrics.ts`, extract a shared `getUrgencyClass(seconds)` helper, and have `StageDayPage` call `computeStageDayClockMetrics`.

### 64. PatchTemplateTools uses custom modal pattern instead of shared overlay

[`web/src/components/PatchTemplateTools.tsx`](../web/src/components/PatchTemplateTools.tsx) — `PreviewModal` and the rename/edit dialogs use inline `position: fixed` + `zIndex: 1000` + `background: var(--color-overlay)` styles repeated four times, instead of the `.confirm-overlay` CSS class used by `ConfirmDialog`, `SearchDialog`, `KeyboardShortcuts`, and `FileAttachments`. Fix: use `.confirm-overlay` (or extract a shared `BaseModal` component) for all overlays.

### 65. PatchTemplateTools uses native `confirm()` instead of ConfirmDialog

[`web/src/components/PatchTemplateTools.tsx`](../web/src/components/PatchTemplateTools.tsx) — template deletion uses `window.confirm()` (native browser dialog), while all other destructive actions use the themed `ConfirmDialog` component. Fix: replace `confirm()` with `ConfirmDialog` for visual consistency and accessibility.

### 66. Inconsistent error display colours across pages *(mostly fixed)*

**Update:** **Patch**, **Settings**, **PatchTemplateTools**, **Events** create, and **Login** now use **`--color-danger`** + **`role="alert"`** where applicable. Spot-check any newer mutations for the same pattern.

### 67. Missing loading and error states on ClockPage and SettingsPage

- [`ClockPage.tsx`](../web/src/pages/ClockPage.tsx) — no loading or error handling for `eventsQ` or `stagesQs`; errors silently render as empty lists.
- [`SettingsPage.tsx`](../web/src/pages/SettingsPage.tsx) — no loading state for the settings query; shows "not set (open LAN)" while data is still loading, which is misleading.
- [`ClockDayPage.tsx`](../web/src/pages/ClockDayPage.tsx) — checks `!dayQ.data` but not `dayQ.error`; `perfQ.error` is never surfaced.

Fix: add standard `isLoading` / `error` early returns matching the pattern used by other pages.

### 68. Template rename modal duplicated in PatchTemplateTools

[`web/src/components/PatchTemplateTools.tsx`](../web/src/components/PatchTemplateTools.tsx) — the rename modal (title bar, text input, Save/Cancel buttons) is implemented nearly identically in both `PatchTemplateLibrarySettings` and `StagePatchTemplatePicker`. Fix: extract a shared `RenameTemplateModal` component.

### 69. Raw ISO dates in PatchPage and PerformanceFilesPage breadcrumbs *(fixed)*

**Update:** [`PatchPage.tsx`](../web/src/pages/PatchPage.tsx) and [`PerformanceFilesPage.tsx`](../web/src/pages/PerformanceFilesPage.tsx) now use **`formatDateShort(day.dayDate)`** in the trail.

### 70. No page sets `document.title`

No page component sets `document.title`, so browser tabs always show the generic HTML title. Fix: add `useEffect` with `document.title` on key pages (e.g. "Main Stage — Fri 20 Jun" on the stage-day page, band name on the patch page).

### 71. Inline `toLocaleTimeString` in five places instead of shared formatter

[`ClockPage.tsx`](../web/src/pages/ClockPage.tsx), [`ClockDayPage.tsx`](../web/src/pages/ClockDayPage.tsx), [`PatchPageSidebar.tsx`](../web/src/components/PatchPageSidebar.tsx), and [`StageChatDock.tsx`](../web/src/components/StageChatDock.tsx) each call `toLocaleTimeString` with slightly different options (some include seconds, some use 24-hour, some omit seconds). Fix: add a shared `formatWallClock(date, opts?)` to `dateFormat.ts` and reuse it.

### 72. ExportEventButton uses raw `fetch` instead of shared download helper

[`web/src/components/ExportImportTools.tsx`](../web/src/components/ExportImportTools.tsx) — `ExportEventButton` uses a raw `fetch` call with manual `useState(downloading)` and no error UI, while template exports use `downloadWorkbookJson` from `client.ts`. Fix: add a shared `apiDownload` helper or reuse the `downloadWorkbookJson` pattern, including 401 handling and error display.

### 73. `useLastVisited` hook is dead code

[`web/src/lib/useLastVisited.ts`](../web/src/lib/useLastVisited.ts) — the `useLastVisited` hook is never imported or used. Only the exported `LAST_STAGE_DAY_STORAGE_KEY` constant is used (by `ClockNavContext` and `myStageToday.ts`). Fix: remove the unused hook, keep the constant.

### 74. Unused CSS classes

[`web/src/global.css`](../web/src/global.css) — `.skeleton`, `.skeleton-line`, `.skeleton-block`, `.clock-arena-label--top`, and `.toast` are defined but never used in any component. Fix: remove or wire up.

### 75. Inconsistent `localStorage` key naming

Storage keys use mixed conventions: `changeoverlord-theme` (hyphenated), `changeoverlord_chat_display_name` (underscored), `PATCH_SIDEBAR_COLLAPSED_KEY` (constant naming varies). Fix: adopt a single naming convention (e.g. `changeoverlord-*` with hyphens).

### 76. PatchTemplateTools rename modals lack Escape key handling

[`web/src/components/PatchTemplateTools.tsx`](../web/src/components/PatchTemplateTools.tsx) — rename modals in both `PatchTemplateLibrarySettings` and `StagePatchTemplatePicker` do not close on Escape. `ConfirmDialog`, `SearchDialog`, and `KeyboardShortcuts` all handle Escape via `useEffect` + `keydown` listener. Fix: add Escape handling, or use a shared modal base.

### 77. Template action buttons duplicated between Settings and Stage picker

[`web/src/components/PatchTemplateTools.tsx`](../web/src/components/PatchTemplateTools.tsx) — the row of template actions (Edit, Duplicate, Preview, Edit name, Replace, Export JSON, Import JSON, Delete) is implemented nearly identically in both `PatchTemplateLibrarySettings` and `StagePatchTemplatePicker`, including the same mutations, error handling, and button layout. Fix: extract a shared `TemplateActionRow` component.

### 78. Navigation actions use `<button>` + `navigate()` instead of `<Link>`

Semantic HTML: elements that navigate to a new URL should be links so users can right-click → Open in new tab, and assistive technology announces them as links.

- [`web/src/components/PatchTemplateTools.tsx`](../web/src/components/PatchTemplateTools.tsx) — "Edit spreadsheet" buttons in both `PatchTemplateLibrarySettings` and `StagePatchTemplatePicker` call `navigate(`/patch-templates/${id}/edit`)` on click instead of rendering a `<Link to={...}>`.
- [`web/src/components/SearchDialog.tsx`](../web/src/components/SearchDialog.tsx) — search result rows are `<button>` elements that call `navigate()`. These should be `<Link to={path} onClick={onClose}>` so search results behave like standard links (middle-click, context menu, keyboard).

Fix: replace with `<Link>` (styled as a button where needed via className).

### 79. Action buttons shift position when adjacent text length varies

Six list/card layouts use `flex-wrap: wrap` with variable-length text followed by action buttons. When names or dates are long (or the viewport is narrow), the button row wraps to a new line, making button positions inconsistent across items:

- [`web/src/pages/EventsPage.tsx`](../web/src/pages/EventsPage.tsx) — event name + date on the left, Edit/Delete on the right.
- [`web/src/pages/EventDetailPage.tsx`](../web/src/pages/EventDetailPage.tsx) — stage name on the left, action buttons on the right.
- [`web/src/pages/StageDetailPage.tsx`](../web/src/pages/StageDetailPage.tsx) — day date on the left, Delete button on the right.
- [`web/src/pages/StageDayPage.tsx`](../web/src/pages/StageDayPage.tsx) — performance cards with band name + time, then a separate actions row below.
- [`web/src/components/PatchTemplateTools.tsx`](../web/src/components/PatchTemplateTools.tsx) — template name + metadata, action buttons on the right.
- [`web/src/components/FileAttachments.tsx`](../web/src/components/FileAttachments.tsx) — file name on the left, View/Open/Delete on the right.

Fix: add `flex-shrink: 0` (and `white-space: nowrap` where appropriate) to each action container so buttons stay pinned to the right and don't wrap independently of text length. For `StageDayPage` performance cards, consider placing actions in the same flex row with `margin-left: auto` instead of a separate row.

### 80. Attachment allowlist vs real-world desk and rider files

**Operator need:** Crews routinely attach **desk showfiles** (vendor-specific formats, often renamed or opaque extensions), **Excel riders**, plot exports, and other files that do not fit today’s curated extension/MIME allowlist. New consoles and software versions appear often; a fixed deny-by-default list will frustrate users and force workarounds (zip everything, rename to `.pdf`, etc.).

**Current behaviour:** Stage and performance attachments are gated by [`api/src/lib/upload-allowlists.ts`](../api/src/lib/upload-allowlists.ts) (extensions + MIME). Anything outside the list is rejected at upload.

**Tension:** “Allow almost anything” is unsafe for a **web** app: stored blobs can be served back and opened in-browser (PDF iframe, downloads with sniffing), which raises risks around **executable content**, **polyglot files**, **MIME confusion**, and **storage abuse**. Patch **templates** are a separate, stricter path (Excel/JSON only) and should stay validated for parsing.

**Direction (product + engineering):** Treat attachments as **opaque archives for crew reference**, not as content the server must interpret beyond size limits and optional virus scanning. Options to explore: configurable admin allowlist; “known safe” vs “download-only” tiers (no inline preview for unknown types); strict **Content-Disposition: attachment** and **nosniff** for non-preview types; generous size caps per file and per scope; optional per-event “allow arbitrary extension” flag for trusted LANs. Document operator expectations in [`USER_GUIDE.md`](USER_GUIDE.md) when behaviour changes.

### 81. Settings page: buttons can overflow the card / viewport *(addressed)*

**Update:** Mitigated in **`SettingsPage`** (constrained root, password fields **`max-width: min(20rem, 100%)`**, **`box-sizing`**) and **`PatchTemplateLibrarySettings`** / **`StagePatchTemplatePicker`** (flex children **`minWidth: 0`**, **`overflowWrap: "anywhere"`** on long names, upload toolbars as column **`label`**s, stage **`select`** **`width: 100%`**). Re-open if a specific viewport still scrolls horizontally.

### 82. FortuneSheet ops vs initial `data` matrix *(mitigated — relay)*

**Risk:** Serialized FortuneSheet ops assume a concrete **`luckysheetfile[].data`** shape (rows/columns materialized). Applying ops on a **too-small grid** can throw **`[Immer] Cannot apply patch, path doesn't resolve`**.

**Update (2026):** The collab server sends **`fullState`** (`Sheet[]` from **`sheets_json`**) on connect/reconnect; the client remounts **`<Workbook data={…}>`** from that payload before applying live **`op`** batches. Remote **`applyOp`** failures are logged in the hook; reload the patch page if the grid errors. See [`docs/DECISIONS.md`](DECISIONS.md) (FortuneSheet fork section).

### 83. Duplicate sheet tabs on remote peers after **Add sheet** *(addressed — 2026-03)*

**Root cause:** FortuneSheet **`addSheet`** is **not idempotent**; applying the **same** batch twice appends twice. Duplicate batches reached the relay from **double `onOp`** (e.g. React 18 Strict Mode) and from **multiple WebSocket messages** for one user action; remotes ran **`applyOp`** for every broadcast.

**Mitigation (current code):**

| Layer | Behaviour |
|--------|-----------|
| **`applyOpBatchToSheets`** ([`api/src/lib/workbook-ops.ts`](../api/src/lib/workbook-ops.ts)) | **`addSheet`**: if the new sheet’s **`id`** is already in the workbook, **skip** (server state + persist stay correct when duplicate batches arrive). |
| **`usePatchWorkbookCollab`** ([`web/src/lib/patchWorkbookCollab.ts`](../web/src/lib/patchWorkbookCollab.ts)) | **Outgoing:** if **`JSON.stringify(ops)`** matches the **immediately previous** send (same synchronous double-invoke), **do not send**; ref clears on a microtask. **Incoming:** **`filterRedundantRemoteOps`** drops **`addSheet`** for ids already present (and respects **`deleteSheet`** / full **`luckysheetfile`** replace ordering). |

**Still not idempotent:** other structural ops (**`deleteSheet`**, row/column insert/delete) — reopen if those show duplicate-apply bugs.

**Workaround if duplicates are already in `sheets_json`:** **Export JSON** → remove extra **`luckysheetfile`** entries → **Import JSON** for that act/template. **Reload alone** does not remove persisted duplicates.

**Code:** [`web/src/lib/patchWorkbookCollab.ts`](../web/src/lib/patchWorkbookCollab.ts), [`api/src/plugins/collab-ws-relay.ts`](../api/src/plugins/collab-ws-relay.ts).

---

## Informational / design notes

- **Single API instance:** SSE `broadcastInvalidate` uses an in-process bus — multi-replica needs another channel (see [`REALTIME.md`](REALTIME.md)).
- **Collab auth:** session cookie gates WebSockets; no per-performance / per-template ACL (LAN / shared-password model).
- **`SESSION_SECRET`:** must be set for real deployments; dev fallback exists in code (see **#38**).
- **`excelBufferToSheets`:** temporarily suppresses `console.log` around third-party transform — fragile if upstream throws before restore (mitigated by try/finally in current code).
- **esbuild dev-server vulnerability** (GHSA-67mh-4wv8-2f99): moderate severity; affects `make dev-fast` only, not production images. Fix when `drizzle-kit` updates its esbuild dependency.
- **Workbook JSON validation:** `parseWorkbookJsonRoot` does basic structural checks; a full Zod schema for the FortuneSheet data shape (cell types, style objects, formula fields) would be more robust but may be impractical given the complexity of the format.

---

## Related docs

| Topic | Doc |
|-------|-----|
| Realtime contract | [`REALTIME.md`](REALTIME.md) |
| Agent workflow | [`AGENTS.md`](../AGENTS.md) |
| Doc ownership | [`DEVELOPMENT.md`](DEVELOPMENT.md) § *Documentation maintenance* |
| Local build / patches | [`DEVELOPMENT.md`](DEVELOPMENT.md) |
