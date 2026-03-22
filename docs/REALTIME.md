# Realtime UI updates (schedule & domain data)

This document is **canonical** for how live updates work in Changeoverlord. **AI agents and contributors:** follow this; do not introduce parallel realtime patterns without updating **`docs/DECISIONS.md`** and this file.

**Navigation:** [`docs/README.md`](README.md) · [`AGENTS.md`](../AGENTS.md) · [`README.md`](../README.md) (deploy)

---

## Goal

When one browser changes schedule or domain data (events, stages, days, performances, settings), **other** browsers update **without a manual refresh**. We do **not** use CRDTs for the schedule: concurrent edits to the same row are rare; **server-authoritative REST** stays the source of truth.

---

## Approach (SSE + TanStack Query)

1. **REST** unchanged — mutations stay `POST` / `PATCH` / `DELETE` under `/api/v1/...`.
2. **Server-Sent Events (SSE)** — `GET /api/v1/realtime` is a long-lived stream (same auth as other API routes when a password is set).
3. After a successful mutation, the API calls **`broadcastInvalidate()`** (`api/src/lib/realtime-bus.ts`) with a small JSON payload listing **TanStack Query `queryKey` tuples** to invalidate.
4. The web app opens **one** `EventSource` in **`RealtimeSync`** (`web/src/realtime/RealtimeSync.tsx`). It only connects when **`GET /api/v1/auth/session`** allows API access (open LAN or logged in). On each message, it runs `queryClient.invalidateQueries({ queryKey })` so affected screens **refetch** immediately.

### Wire format (versioned)

```json
{ "v": 1, "invalidate": [["performances", "<stageDayId>"], ["performance", "<performanceId>"]] }
```

Optional **`chat`** (same `v: 1`): after **`POST /api/v1/chat/messages`**, the server may include an instant payload so the web chat dock can open and highlight without waiting for refetch:

```json
{
  "v": 1,
  "invalidate": [["chatMessages", "<eventId>"]],
  "chat": {
    "id": "<uuid>",
    "eventId": "<uuid>",
    "stageId": "<uuid> | null",
    "scope": "stage | event",
    "author": "",
    "body": "",
    "createdAt": "<ISO8601>"
  }
}
```

Clients that do not implement chat should **ignore** unknown top-level fields and still process **`invalidate`**.

- **`v`:** increment when the payload shape changes; update **`RealtimeSync`** to handle new versions in parallel if needed.
- **`invalidate`:** each inner array is a **`queryKey`** exactly as used in **`web/src/`** (string segments; `null` allowed if a query uses it).

---

## Implementation checklist (agents & developers)

### When adding or changing a REST mutation

1. After a **successful** write (same request, after DB commit), call **`broadcastInvalidate([...])`** with every **`queryKey`** that should refresh for other users.
2. Reuse **existing** keys from `useQuery` in `web/src/pages/` and related hooks. Common patterns:
   - `["events"]`, `["event", eventId]`
   - `["stages", eventId]`, `["stage", stageId]`, `["patchTemplates"]`, `["patchTemplate"]` (global patch/RF templates — REST or Yjs autosave from the template editor)
   - `["stageDays", stageId]`, `["stageDay", stageDayId]`
   - `["performances", stageDayId]`, `["performance", performanceId]`
   - `["files", stageId]` (stage-scoped PDF list), `["files", "performance", performanceId]` (performance-scoped PDF list)
   - `["settings"]`, `["authSession"]` (password / auth visibility)
3. **Deletes** that cascade (e.g. event → stages → days → performances) should prefetch child IDs **before** delete (see existing **`events`** / **`stages`** route handlers) and invalidate **all** keys a client might have cached.
4. **Do not** forget: if a screen shows the data, some mutation path must invalidate that screen’s **queryKey**.

### When adding a new `useQuery` on the client

- List which mutations affect that data; ensure those API handlers include the corresponding keys in **`broadcastInvalidate`**.
- If nothing invalidates the new query, other users will see stale data until refresh.

### When adding a new domain area

- Prefer **REST + SSE invalidation** as here. Do **not** add a second “notification WebSocket” for the same purpose without an explicit decision record.

---

## Collaboration spreadsheet (Yjs) — separate system

The **FortuneSheet / Yjs** workbook uses **WebSockets** — **binary Yjs sync**, not SSE:

- **Performances (patch & RF):** **`/ws/v1/collab/:performanceId`**
- **Template editor (Settings):** **`/ws/v1/collab-template/:templateId`**

- **Do not** send workbook updates through `/api/v1/realtime`.
- **Do not** move schedule/performance rows into Yjs “to get realtime” — use REST + invalidation above.

Persistence: **`performance_yjs_snapshots`** and **`patch_templates.snapshot`**; stage **default template** clone on new performance — see schema and `docs/DECISIONS.md`.

**Yjs persistence details** (`api/src/lib/yjs-persistence.ts`):

- **Load-before-persist:** the DB snapshot is loaded and applied **before** subscribing to `doc.on("update")` for debounced writes. Otherwise the WebSocket sync handshake can trigger a persist while the doc is still empty and **clobber** a good row in Postgres (more likely when DB I/O is slow).
- **Debounce:** changes are persisted to Postgres **1 second** after the last edit (debounced). Previously 3 seconds.
- **Graceful shutdown:** on **SIGTERM / SIGINT**, all active Yjs docs are flushed to Postgres before the process exits. Without this, edits in the debounce window are lost on container restart.
- **OpLog compaction:** when the append-only `opLog` exceeds **200 entries**, the persist layer replays it to the current sheet state and replaces it with a single `replace luckysheetfile` op. This keeps snapshots small and page-load replay fast. Compaction runs in **one Yjs transaction** (read `opLog` → replay → replace) and is **skipped** if replay output is not **structurally usable** (every sheet needs a non-empty `id` and either a non-empty `data` matrix or `celldata`), so a divergent headless replay cannot overwrite the log with a blank workbook.

**Are workbooks rebuilt from “all history” forever?** No. The browser replays the **`opLog`** after sync, but **`opLog` length is capped** by compaction (≤ **200** batches between compactions; often **1** batch — a full `luckysheetfile` replace — after compaction). Postgres stores one **Yjs binary snapshot** per doc, not an unbounded event log. Cost still grows with **workbook size** (big grids), not unbounded edit count.

---

## Limits (single API process)

The invalidate bus is **in-process** (`EventEmitter`). It is correct for **one** API container (typical LAN deployment). Redis is **not** in the stack.

If you ever run **multiple** API replicas, you **must** add **Redis pub/sub** or **Postgres `LISTEN/NOTIFY`** (or equivalent) so every instance receives the same broadcast; the **handler** that fans out to SSE connections would subscribe to that shared bus. This requires adding a Redis service to `docker-compose.yml` and a Redis client to the API.

---

## Development

Vite proxies `/api` to the API; `EventSource("/api/v1/realtime")` stays **same-origin** with the dev server so session cookies apply.

---

## Related

- [`docs/README.md`](README.md) — full documentation index  
- [`AGENTS.md`](../AGENTS.md) — agent entry point  
- [`DECISIONS.md`](DECISIONS.md) — stack and API shape  
- [`DEVELOPMENT.md`](DEVELOPMENT.md) — local run  
