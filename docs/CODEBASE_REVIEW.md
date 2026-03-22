# Codebase review findings

**Audience:** developers and AI assistants.  
**Purpose:** single canonical list of known issues, doc drift, and follow-ups from a full-repo audit (API, web, DB, Docker, CSS, docs, realtime).  
**Maintenance:** update this file when items are fixed or superseded; do not duplicate operator-facing detail in [`USER_GUIDE.md`](USER_GUIDE.md).

---

## Critical / high severity

### 1. Import endpoint has no input validation and is non-transactional

[`api/src/routes/v1/export-import.ts`](../api/src/routes/v1/export-import.ts) (`POST /import`)

- Request body is cast to a TypeScript type with **no Zod (or other) runtime validation**.
- If `stages`, `stageDays`, or `performances` is missing, `for...of` loops can throw.
- Inserts are **not wrapped in a DB transaction** — partial import leaves inconsistent data.
- `event.name` is not length/type validated before use.

### 2. Sparse matrix / celldata crashes and DoS risk in Excel utilities

- [`api/src/lib/excel-to-sheets.ts`](../api/src/lib/excel-to-sheets.ts): `sanitizeFortuneSheetDataMatrix` can read `row.length` when `row` is undefined (sparse `data`).
- [`api/src/lib/sheets-to-excel.ts`](../api/src/lib/sheets-to-excel.ts): `matrix[r]` can be undefined.
- [`api/src/lib/excel-to-sheets.ts`](../api/src/lib/excel-to-sheets.ts): no cap on `celldata[].r` / `.c` — huge indices can allocate excessive memory.
- [`api/src/lib/sheet-preview.ts`](../api/src/lib/sheet-preview.ts): negative `entry.r` / `entry.c` not rejected.

### 3. No path-under-uploads guard on file resolution

[`api/src/routes/v1/files.ts`](../api/src/routes/v1/files.ts) and [`api/src/routes/v1/patch-templates.ts`](../api/src/routes/v1/patch-templates.ts) use `path.join(uploadsRoot, row.storageKey)` without verifying the resolved path stays under `uploadsRoot` (defence in depth if `storageKey` is ever wrong).

### 4. Raw file download: missing read error handling

[`api/src/routes/v1/files.ts`](../api/src/routes/v1/files.ts) `GET /files/:id/raw` — `fs.readFile` without try/catch; missing files on disk can surface as 500 instead of 404.

---

## Medium severity

### 5. Y.Doc created when `roomId` is falsy

[`web/src/lib/patchWorkbookCollab.ts`](../web/src/lib/patchWorkbookCollab.ts) — `useMemo(() => new Y.Doc(), [roomId])` runs even when `roomId` is undefined; the provider effect returns early so **`ydoc.destroy()`** may never run for that doc.

### 6. Partial failure risk: swap and template replace

- [`api/src/routes/v1/performances.ts`](../api/src/routes/v1/performances.ts) `POST .../swap` — two updates without a transaction.
- [`api/src/routes/v1/patch-templates.ts`](../api/src/routes/v1/patch-templates.ts) `POST .../replace` — unlink/write file before DB update can orphan files on failure.

### 7. `loadSheetsForPatchTemplateRow` swallows errors

[`api/src/routes/v1/patch-templates.ts`](../api/src/routes/v1/patch-templates.ts) — broad `catch` returns `[]`, hiding I/O vs parse failures.

### 8. Auth guard: `hasPassword()` hits DB every request

[`api/src/plugins/auth-guard.ts`](../api/src/plugins/auth-guard.ts) — consider short TTL cache or invalidate on password change only.

### 9. SSE: writes on disconnected clients

[`api/src/routes/v1/realtime-sse.ts`](../api/src/routes/v1/realtime-sse.ts) — `reply.raw.write` may throw; wrap heartbeats / sends.

### 10. `hhmmToMinutes` without validation

[`api/src/lib/performance-overlap.ts`](../api/src/lib/performance-overlap.ts) — malformed strings yield `NaN` and unstable sort/overlap behaviour.

### 11. Postgres pool: no `error` listener

[`api/src/db/client.ts`](../api/src/db/client.ts) — add `pool.on('error', ...)`.

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

### 17. SSE invalidation gaps (stale data across browsers)

- `["allStagesForClock", eventIds]` in [`web/src/pages/ClockPage.tsx`](../web/src/pages/ClockPage.tsx) — not invalidated when events/stages/days change.
- `["patchTemplatePreview", id]` in [`web/src/components/PatchTemplateTools.tsx`](../web/src/components/PatchTemplateTools.tsx) — template edits do not broadcast this key.

See [`REALTIME.md`](REALTIME.md) and [`AGENTS.md`](../AGENTS.md) for the invalidation contract.

---

## Documentation inconsistencies

### 18. [`AGENTS.md`](../AGENTS.md) file map stale

Missing (non-exhaustive): `pdf-thumbnails.ts`, `convert-to-pdf.ts`, `yjs-oplog-replay.ts`, `drizzle-logger.ts`; web: `ClockNavContext`, `PatchPageSidebar`, `ClockEndOfDayOverlay`, `PerformanceFilesPage`, `stageDayClockMetrics`, `clockSchedule`, `useFitCountdownInBox`, `patchWorkbookYjs`; migration `0005_*.sql`.

### 19. [`REALTIME.md`](REALTIME.md) — template WebSocket path

Document `/ws/v1/collab-template/:templateId` alongside performance collab (see [`api/src/plugins/collab-ws.ts`](../api/src/plugins/collab-ws.ts)).

### 20. [`FEATURE_REQUIREMENTS.md`](FEATURE_REQUIREMENTS.md) — “Current navigation problems”

Several listed items are **already implemented**; section should be reframed or removed to match current product state.

### 21. [`LICENSING.md`](LICENSING.md) — Excel pipeline wording

Clarify: **import** via `@zenmrp/fortune-sheet-excel`; **export** / xlsx generation via ExcelJS where applicable.

### 22. [`CHANGELOG.md`](../CHANGELOG.md) — `[Unreleased]` structure

Merge duplicate `### Fixed` / `### Changed` blocks per Keep a Changelog style.

### 23. [`.cursor/rules/pitfalls.mdc`](../.cursor/rules/pitfalls.mdc) vs [`yjs-oplog-replay.ts`](../api/src/lib/yjs-oplog-replay.ts)

Pitfall text should acknowledge controlled server-side op replay for templates/preview and warn against extending it without understanding FortuneSheet ops.

### 24. [`.cursor/rules/pitfalls.mdc`](../.cursor/rules/pitfalls.mdc) — FortuneSheet bridge location

Point to [`patchWorkbookCollab.ts`](../web/src/lib/patchWorkbookCollab.ts) / [`patchWorkbookYjs.ts`](../web/src/lib/patchWorkbookYjs.ts), not only page components.

### 25. Root [`README.md`](../README.md) docs table

Add [`PATCH_TEMPLATE_JSON.md`](PATCH_TEMPLATE_JSON.md) if missing.

### 26. [`.cursor/rules/code-patterns.mdc`](../.cursor/rules/code-patterns.mdc)

Frontend mutation example should show `useQueryClient()` when using `qc.invalidateQueries`.

---

## Low severity

### 27. N+1 patterns

[`export-import.ts`](../api/src/routes/v1/export-import.ts) export loops; [`events.ts`](../api/src/routes/v1/events.ts) delete invalidation queries — batch opportunities.

### 28. Inconsistent API response shapes

Some mutations return `{ ok: true }` instead of `{ resourceName: row }` — document or align.

### 29. Dead CSS in [`global.css`](../web/src/global.css)

Unused classes (e.g. `.bg-ok`/`.bg-warn`/`.bg-danger`, unused clock helpers, `.skeleton*`, `.toast`) — remove or wire up.

### 30. Breakpoint sprawl in `global.css`

Mix of 700 / 768 / 960 / 1024px — consider consolidating tokens or media-query constants.

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

### 36. Remove FortuneSheet `patch-package` patches

**Decision:** patches under `patches/@fortune-sheet+*.patch` are **not required** — remove them.

**Checklist when doing so:** delete patch files; if `patches/` is empty, remove root `postinstall` / `patch-package` / Dockerfile `COPY patches` as appropriate; update [`CHANGELOG.md`](../CHANGELOG.md); align [`AGENTS.md`](../AGENTS.md), [`DEVELOPMENT.md`](DEVELOPMENT.md), [`MAINTAINING_DOCS.md`](MAINTAINING_DOCS.md), root [`README.md`](../README.md); run `make dev` and smoke-test patch + template editor.

---

## Informational / design notes

- **Single API instance:** SSE `broadcastInvalidate` uses an in-process bus — multi-replica needs another channel (see [`REALTIME.md`](REALTIME.md)).
- **Collab auth:** session cookie gates WebSockets; no per-performance / per-template ACL (LAN / shared-password model).
- **`SESSION_SECRET`:** must be set for real deployments; dev fallback exists in code.
- **`excelBufferToSheets`:** temporarily suppresses `console.log` around third-party transform — fragile if upstream throws before restore (mitigated by try/finally in current code).

---

## Related docs

| Topic | Doc |
|-------|-----|
| Realtime contract | [`REALTIME.md`](REALTIME.md) |
| Agent workflow | [`AGENTS.md`](../AGENTS.md) |
| Doc ownership | [`MAINTAINING_DOCS.md`](MAINTAINING_DOCS.md) |
| Local build / patches | [`DEVELOPMENT.md`](DEVELOPMENT.md) |
