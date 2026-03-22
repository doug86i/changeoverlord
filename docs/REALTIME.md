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
4. The web app opens **one** `EventSource` in **`RealtimeSync`** (`web/src/realtime/RealtimeSync.tsx`). It only connects when **`GET /api/v1/auth/session`** allows API access (open LAN or logged in). On each message, it runs `queryClient.invalidateQueries({ queryKey, exact: false })` so a broadcast key also matches **longer** client keys (e.g. **`["allStagesForClock"]`** invalidates **`["allStagesForClock", "<serialized-event-ids>"]`** on **ClockPage**).

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
- **`invalidate`:** each inner array is a **`queryKey` prefix** as used in **`web/src/`** (string segments; `null` allowed if a query uses it). The client applies **`exact: false`**, so the tuple may be shorter than the **`useQuery`** key (see **Clock** **`allStagesForClock`**).

---

## Implementation checklist (agents & developers)

### When adding or changing a REST mutation

1. After a **successful** write (same request, after DB commit), call **`broadcastInvalidate([...])`** with every **`queryKey`** that should refresh for other users.
2. Reuse **existing** keys from `useQuery` in `web/src/pages/` and related hooks. Common patterns:
   - `["events"]`, `["event", eventId]`
   - `["stages", eventId]`, `["stage", stageId]`, `["patchTemplates"]`, `["patchTemplate"]` (global patch/RF templates — REST; template workbook saves via collab relay → debounced `sheets_json`)
   - `["stageDays", stageId]`, `["stageDay", stageDayId]`
   - `["performances", stageDayId]`, `["performance", performanceId]`
   - `["allStagesForClock"]` — prefix key for the multi-event stages aggregator on **`ClockPage`** (invalidate after event / stage / stage-day mutations that change which days exist)
   - `["patchTemplatePreview"]` — prefix for template preview queries when templates change
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

## Collaboration spreadsheet (WebSocket op relay) — separate system

The **FortuneSheet** patch / RF workbook uses **WebSockets** with **JSON messages** (FortuneSheet ops), not SSE and not Yjs:

- **Performances (patch & RF):** **`/ws/v1/collab/:performanceId`**
- **Template editor (Settings):** **`/ws/v1/collab-template/:templateId`**

**Wire protocol (JSON):**

- **Server → client (on connect):** `{ "type": "fullState", "sheets": Sheet[] }` — current workbook from Postgres (or the in-memory room if already warm).
- **Client → server:** `{ "type": "op", "data": Op[] }` — same batches FortuneSheet emits from **`onOp`**.
- **Server → other clients:** `{ "type": "op", "data": Op[] }` — broadcast after the server applies the batch to its copy with **`applyOpBatchToSheets`** (`api/src/lib/workbook-ops.ts`).

**Rules:**

- **Do not** send workbook updates through `/api/v1/realtime`.
- **Do not** move schedule/performance rows into the collab channel — use REST + invalidation above.
- **Phone patch (read-only viewer):** `usePatchWorkbookCollab` closes the WebSocket when the document is hidden if **`pauseWhenHidden`** is set, and reconnects when visible; the server sends **`fullState`** again after reconnect.

**Persistence:** **`performance_workbooks.sheets_json`** and **`patch_templates.sheets_json`**. The relay debounces writes (**~2 seconds** after the last op). On **SIGTERM / SIGINT**, **`flushCollabRelayRooms`** persists all non-empty rooms. Stage **default template** is cloned into a new performance row when the performance is created — see **`docs/DECISIONS.md`**.

**REST import / export:** **`GET/PUT …/sheets-export` / `sheets-import`** read and write the same **`sheets_json`**. If a live room exists, the API can **`broadcastFullState*`** so connected clients remount from the new JSON.

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
