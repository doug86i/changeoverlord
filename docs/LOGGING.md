# Logging (API + web)

**Canonical behaviour** for assistants and contributors: structured logs, **no secrets** in fields, **`LOG_LEVEL`** controls verbosity on the server, optional client debug for the SPA.

**Navigation:** [`docs/README.md`](README.md) · [`AGENTS.md`](../AGENTS.md) · [`docs/DECISIONS.md`](DECISIONS.md)

---

## API (Pino + Fastify)

- **Library:** [Pino](https://github.com/pinojs/pino) via **`api/src/lib/log.ts`** (`LOG_LEVEL` env, default **`info`**).
- **In HTTP handlers:** use **`req.log`** (request id + route context). Log **structured objects** first, then a short **message** string:  
  `req.log.debug({ eventId }, "event updated");`
- **Outside requests** (migrations, Yjs persistence, realtime bus, collab WebSocket setup): use **`createLogger("component")`** from **`api/src/lib/log.ts`**.
- **Levels (typical use):**
  - **`error`** — failures that need attention (persist errors, uncaught handler errors).
  - **`warn`** — auth failures, invalid WebSocket ids, recoverable issues.
  - **`info`** — security-relevant **outcomes** (login success/failure without password values, password settings changes, template upload/clear).
  - **`debug`** — per-request details, **Drizzle SQL** (when `LOG_LEVEL=debug`), SSE open/close, invalidate broadcasts, Yjs load/persist detail, route mutations with entity ids.
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
| **API** | Set **`CLIENT_LOG_FILE`** to a path **under the API process cwd** (e.g. **`/app/logs/client-debug.ndjson`** in Docker, or **`logs/client-debug.ndjson`** when running the API from the repo root). If unset, **`POST /api/v1/debug/client-log`** is **not registered**. |
| **Web** | Set **`VITE_CLIENT_LOG_FILE=true`** at Vite dev/build time so **`logClientDebugCollab`** in **`web/src/lib/clientDebugLog.ts`** batches POSTs. Default **`make dev-fast`**: enabled in **`docker-compose.fast.yml`** with **`./logs`** mounted into the API container. |
| **Output** | One JSON object per line (timestamp, scope, message, optional **`roomId`**, optional **`meta`**). Tail with **`tail -f logs/client-debug.ndjson`**. |

**Security:** do not enable **`CLIENT_LOG_FILE`** on untrusted networks without understanding that authenticated session holders can append to that file. Omit **`meta`** fields that could contain secrets (the collab path logs op summaries / bounded JSON only).

### Troubleshooting: spreadsheet stuck on “Syncing…” or empty

1. **Server logs** (`docker compose logs -f app`): look for **`collab-ws`** and **`yjs-persist`**. A **`TypeError`** in **`setupWSConnection`** / **`getStateVector`** usually means **two incompatible Yjs packages** — see **[`DECISIONS.md`](DECISIONS.md)** (*Yjs / WebSocket npm compatibility*).
2. **Client:** open DevTools → Network → **WS** — confirm **`/ws/v1/collab/…`** (or **`collab-template/…`**) connects (**101**) and is not **401** (password session).
3. **Saved HTML** (`file://`): the SPA will not load assets or WebSockets — use **`http://localhost/`** (see **[`DEVELOPMENT.md`](DEVELOPMENT.md)**).

---

## Consistency checklist (agents)

1. **New REST route:** log successful **mutations** at **`debug`** with **entity ids**; use **`info`** / **`warn`** for auth or settings outcomes as in existing routes.
2. **New background path** (bus, Yjs, WS): **`createLogger("area")`** and **`debug`** / **`error`** as appropriate.
3. **Replace `console.log` / `console.error`** in app code with **`req.log`** or **`createLogger`** (except **`logDebug`** / **`logClientDebugCollab`** on the web).
4. **Change logging shape** → update this doc and **[`docs/DECISIONS.md`](DECISIONS.md)** if behaviour is product-relevant.

---

## Related

- **[`docs/DECISIONS.md`](DECISIONS.md)** — `LOG_LEVEL` policy  
- **[`docs/REALTIME.md`](REALTIME.md)** — SSE invalidate stream (server logs SSE at **debug**)
