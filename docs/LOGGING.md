# Logging (API + web)

**Canonical behaviour** for assistants and contributors: structured logs, **no secrets** in fields, **`LOG_LEVEL`** controls verbosity on the server, optional client debug for the SPA.

**Navigation:** [`docs/README.md`](README.md) · [`AGENTS.md`](../AGENTS.md) · [`docs/DECISIONS.md`](DECISIONS.md)

---

## API (Pino + Fastify)

- **Library:** [Pino](https://github.com/pinojs/pino) via **`api/src/lib/log.ts`** (`LOG_LEVEL` env, default **`info`**).
- **In HTTP handlers:** use **`req.log`** (request id + route context). Log **structured objects** first, then a short **message** string:  
  `req.log.debug({ eventId }, "event updated");`
- **Outside requests** (migrations, collab relay, realtime bus, WebSocket setup): use **`createLogger("component")`** from **`api/src/lib/log.ts`**.
- **Levels (typical use):**
  - **`error`** — failures that need attention (persist errors, uncaught handler errors).
  - **`warn`** — auth failures, invalid WebSocket ids, recoverable issues.
  - **`info`** — security-relevant **outcomes** (login success/failure without password values, password settings changes, template upload/clear).
  - **`debug`** — per-request details, **Drizzle SQL** (when `LOG_LEVEL=debug`), SSE open/close, invalidate broadcasts, collab relay persist detail, route mutations with entity ids.
- **Never log:** passwords, session tokens, full `Cookie` / `Authorization` headers, or raw multipart bodies. Redaction paths are configured on the root logger; still avoid putting secrets in log objects.
- **Drizzle:** when **`LOG_LEVEL`** is **`debug`** or **`trace`**, **`api/src/db/client.ts`** attaches **`drizzleDebugLogger`** so SQL + params appear at **debug** (params may include ids — not secrets).
- **HTTP request lines:** when **`LOG_LEVEL=debug`** (or **`trace`**), Fastify **request logging** stays enabled even if **`NODE_ENV=production`**, so each request gets timing + method + URL (see **`api/src/app.ts`**).

### Enable verbose API logs (Docker)

In **`.env`** next to **`docker-compose.yml`**:

```bash
LOG_LEVEL=debug
```

Then **`make dev-fast`** or **`make dev`**. Inspect with **`docker compose -f docker-compose.fast.yml logs -f api`** or **`docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f app`**.

---

## Web (browser)

- **Helper:** **`web/src/lib/debug.ts`** — **`logDebug(scope, message, ...meta)`** uses **`console.debug`** only when **`import.meta.env.DEV`** or **`VITE_LOG_DEBUG=true`** at build time.
- **Do not** log tokens, passwords, or full API responses with PII. Prefer ids and short labels.
- **Production bundle with client debug** (rare — LAN troubleshooting only): build with **`VITE_LOG_DEBUG=true`** (see Vite docs). Default production builds stay quiet.
- **Patch / template workbook pages** emit **`logDebug("patch-workbook", …)`** for WebSocket status and sync (enable **`VITE_LOG_DEBUG`** to see in the browser console). FortuneSheet render failures are caught by an error boundary and logged the same way.

### Client debug log file (collab / FortuneSheet)

Browsers do not persist console output. For **patch workbook** troubleshooting, the SPA can POST structured lines to the API, which appends **newline-delimited JSON** to a file on disk:

| Piece | Env / behaviour |
|--------|------------------|
| **API** | Set **`CLIENT_LOG_FILE`** to a path under the **monorepo root**, under **`dirname(UPLOADS_DIR)`** (Compose: **`/var/changeoverlord/logs/…`** next to **`uploads/`**), or under the **`api/`** workspace parent when cwd is **`api/`**. If unset, **`POST /api/v1/debug/client-log`** is **not registered**. |
| **Web** | Set **`VITE_CLIENT_LOG_FILE=true`** at Vite dev/build time so **`logClientDebugCollab`** in **`web/src/lib/clientDebugLog.ts`** batches POSTs. Default **`make dev-fast`**: enabled in **`docker-compose.fast.yml`** with **`${DATA_DIR}/logs`** mounted at **`/var/changeoverlord/logs`**. |
| **Output** | One JSON object per line (timestamp, scope, message, optional **`roomId`**, **`meta`**). Default host path: **`${DATA_DIR:-./data}/logs/client-debug.ndjson`** — e.g. **`tail -f data/logs/client-debug.ndjson`**. |

**`meta` envelope (automatic):** every **`logClientDebugCollab`** line merges a per-tab context so you can separate windows and sort by time:

| Field | Meaning |
|--------|---------|
| **`tabId`** | Random UUID for this browser tab — **same `tabId`** ⇒ same window; multiple ids ⇒ multiple tabs or reloads. |
| **`seq`** | Monotonic counter per tab (order of log calls). |
| **`t`** | `performance.now()` (ms since navigation), rounded — compare ordering inside one tab. |
| **`path`** | `location.pathname` (no query string; length in **`searchLen`** only). |
| **`vis`** | `document.visibilityState`. |
| **`viteMode`** | `import.meta.env.MODE` (`development` / `production`). |
| **`strictDev`** | `true` when **`import.meta.env.DEV`** (React Strict Mode may double-invoke). |
| **`online`** / **`net`** | `navigator.onLine` and **`connection.effectiveType`** when available. |
| **`sw` / `sh`** | Screen width / height (coarse). |

**Collab-specific `meta` (when relevant):** patch hook uses **`logDebug("patch-workbook-collab", …)`** with **`roomId`**, **`mode`**, reconnect timing, and **`applyOp`** errors. Optional NDJSON ingest (**`logClientDebugCollab`**) still adds **`tabId`**, **`seq`**, path, visibility, etc. In DevTools: **`getClientLogTabId()`** (exported from **`web/src/lib/clientDebugLog.ts`**) prints this tab’s id.

**Security:** do not enable **`CLIENT_LOG_FILE`** on untrusted networks without understanding that authenticated session holders can append to that file. Omit **`meta`** fields that could contain secrets (the collab path logs op summaries / bounded JSON only).

### Troubleshooting: spreadsheet stuck on “Syncing…” or empty

1. **Server logs** (`docker compose logs -f app` or fast **`api`**): look for **`collab-ws-relay`** — connection errors, failed **`applyOpBatchToSheets`**, or DB persist failures.
2. **Client:** open DevTools → Network → **WS** — confirm **`/ws/v1/collab/…`** (or **`collab-template/…`**) connects (**101**) and is not **401** (password session).
3. **Saved HTML** (`file://`): the SPA will not load assets or WebSockets — use **`http://localhost/`** (see **[`DEVELOPMENT.md`](DEVELOPMENT.md)**).

### Investigating patch collab (saving / duplicate tabs)

Use **`make dev-fast`** (or classic stack) so the API and Vite proxy match **[`docs/DEVELOPMENT.md`](DEVELOPMENT.md)**.

1. **Server (`LOG_LEVEL=debug` in `.env`)**  
   Tail: **`docker compose -f docker-compose.fast.yml logs -f api`**.  
   Component **`collab-ws-relay`** logs each applied batch as **`relay op batch applied`** with:
   - **`broadcast`:** **`fullState-to-peers`** (structural: new/delete tab or whole-workbook replace) vs **`op`** (cell edits).
   - **`sheetCount`**, **`structural`**, **`opCount`**, **`kinds`** (op names, truncated), **`addSheetIds`** (including **`(no-id)`** when Fortune omitted an id — server cannot dedupe).
   - **`workbook persisted`** (debug) after debounced flush; **`workbook persisted; follow-up flush scheduled (edits during write)`** (debug) when ops landed during the DB round-trip; **`skip persist: sheets failed minimum persist checks`** (warn) if tabs lack ids.
   - **`collab room closed with unsaved sheets; keeping in-memory room for reconnect`** (warn) — last client disconnected while **`dirty`** (persist not written yet); next **`fullState`** comes from memory, not Postgres.
   - **`collab ws: client json parse failed`** (debug) — malformed frame; **`collab ws: client message rejected`** (warn) — Zod shape mismatch (first few **`issues`** only); **`collab ws: op payload is not an array`** (warn).

2. **Browser console**  
   Set **`VITE_LOG_DEBUG=true`** for the **web** service in **`docker-compose.fast.yml`** (or local **`.env`**) and rebuild/restart **web** so **`logDebug("patch-workbook-collab", …)`** appears in DevTools.

3. **NDJSON file (two browsers / repro)**  
   Default fast stack: **`data/logs/client-debug.ndjson`** on the host (or **`$DATA_DIR/logs/…`**) with **`VITE_CLIENT_LOG_FILE=true`** and **`CLIENT_LOG_FILE`** on the API. **`logClientDebugCollab`** records:
   - **`onOp skipped: websocket not open`** / **`readOnly`** / **`suppressLocalOps`** — edits **not** sent to the relay (common “not saving” cause).
   - **`outbound cell op batches (aggregated)`** — debounced summary of **cell** batches **after** a successful **`ws.send`** (no cell payloads); if edits “don’t save” and this line **never** appears, Fortune may not be emitting **`onOp`** or the socket never reached **OPEN**.
   - **`outbound structural op batch sent`** — includes **`addSheetIds`**.
   - **`fullState received`** — **`sheetCount`**, **`midSessionRemount`** when the grid key bumps. If **`roomId`** (from the hook) and **`path`** (URL at flush time) disagree for the same tab, suspect a **stale WebSocket** applying another performance’s **`fullState`** — fixed in **`patchWorkbookCollab`** by always closing the socket when **`workbookReady`** is false and by ignoring events from non-current sockets.
   - **`applyOp failed for remote batch`** — client could not apply peer ops.  
   Sort by time or filter by **`tabId`** (see table above).

4. **Network → WS**  
   Confirm **`/ws/v1/collab/…`** or **`/ws/v1/collab-template/…`** stays **101** (not **401** when a password is set).

---

## Consistency checklist (agents)

1. **New REST route:** log successful **mutations** at **`debug`** with **entity ids**; use **`info`** / **`warn`** for auth or settings outcomes as in existing routes.
2. **New background path** (bus, collab relay, WS): **`createLogger("area")`** and **`debug`** / **`error`** as appropriate.
3. **Replace `console.log` / `console.error`** in app code with **`req.log`** or **`createLogger`** (except **`logDebug`** / **`logClientDebugCollab`** on the web).
4. **Change logging shape** → update this doc and **[`docs/DECISIONS.md`](DECISIONS.md)** if behaviour is product-relevant.

---

## Related

- **[`docs/DECISIONS.md`](DECISIONS.md)** — `LOG_LEVEL` policy  
- **[`docs/REALTIME.md`](REALTIME.md)** — SSE invalidate stream (server logs SSE at **debug**)
