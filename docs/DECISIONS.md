# Engineering decisions (pre-build)

Canonical choices before implementation. Update when something changes.

---

## Product

### Multi-person prep (events / stages / days)

- Different people may prepare **different events, stages, or stage-days** on **different machines**.
- **Export scope** (separate packages): **whole event**, **one stage** (all its days), or **one stage-day** — so preparers move **only** the slice they own.
- **Import** always creates **new** records (see **IDs** below) so nothing is silently overwritten.
- Operators can **delete** obsolete events/stages/days in the UI when a newer package has been imported or prep was wrong.
- **“Replace with new”** (optional UX): **delete** the old scope then **import** again — same effect as replace without a dangerous merge. Automated “swap” can be a later convenience.

### Time (local event)

- Each **event = one physical location** — schedule times are **local event time** in v1 (store and display as local; no cross-timezone rules).
- **Server time API** answers “what time is it now” on the host for countdowns; comparing to the running order uses **event-local** times.

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
- **Brand accent** from **DHSL logo** — **industrial red** for interactive / “now” emphasis; **re-sample** hex from bundled **`dhsl-logo.svg`** when added. See **[`DESIGN.md`](DESIGN.md)**.
- **Default** follows **`prefers-color-scheme`**; **manual** theme toggle in Settings (persist locally).

### Internationalisation

- **English only** for MVP (UI copy, errors, docs).

---

## Identity & import/export

### IDs (UUIDs)

- Use **UUID v4 (or v7)** for all primary keys exposed in APIs and **export packages** — stable across systems, no collision on import, no sequential guessing.

### Event package import

- **Always import as new** entities (new UUIDs) — never merge by reusing old IDs from another server unless we add an explicit **advanced** flow later.
- **Deletion** of old data is manual (or bulk “delete event”) so crews stay in control on the **live** machine.
- Export **manifest** must record **scope** (event / stage / stage-day) so imports validate expected contents.

---

## Auth & threat model

### Modes

- **Default: no password** — assume **trusted LAN** (festival private network).
- **Optional: single shared password** — stored hashed in DB; session cookie; same password for all users in MVP.

### When no password is set

- Treat as **trusted environment**: still follow **normal HTTP security hygiene** (CSRF for cookie-changing actions when we add forms, sane cookies) but **no** forced HTTPS requirement for LAN IP access.
- When a password **is** set or the app is **internet-facing**, follow **stricter** defaults: `Secure` cookies where HTTPS, rate limits on login, etc.

---

## Limits (avoid “computer says no” on stage)

Set **generous** server-side maximums; **soft** warnings in UI before hard failures where possible.

| Area | Starting point (tune with real use) | UX |
|------|-------------------------------------|-----|
| **Upload** (single file) | **100 MB** | Clear message if exceeded; suggest split/compress PDFs |
| **Export package** (zip) | **500 MB** | Warn when approaching limit |
| **Spreadsheet** | **50k cells** per performance **workbook** (configurable; tune if multi-sheet totals differ) | Warn before limit; prefer scrolling over hard cap if performance allows |
| **Request body** | Match largest upload + headroom | Same as upload limit |

If a limit is hit, message must be **short, actionable** (“File too large — max 100 MB — try compressing the PDF”) — **no** stack traces to end users.

---

## Browsers

- Support **current** and **previous major** versions of **Chrome, Firefox, Safari, Edge** (desktop + mobile).
- Avoid **brand-new** APIs without fallbacks; assume devices are **reasonably up to date** (crew phones/tablets refreshed within a few years).
- **Fullscreen** clock: progressive enhancement if Fullscreen API missing (still show clock, “tap for fullscreen” optional).

---

## Stack (locked for v1)

| Layer | Choice |
|-------|--------|
| Runtime | **Node.js** (LTS) |
| API | **Fastify** + **TypeScript** |
| DB access | **Drizzle ORM** + **PostgreSQL** (migrations in repo) |
| Validation | **Zod** |
| Realtime | **WebSockets** + **Yjs** |
| Frontend | **Vite** + **React** + **TypeScript** + **TanStack Query** |
| Spreadsheet UI | **FortuneSheet** + **ExcelJS** (import) |
| Tests (later) | **Vitest** (unit) + **Playwright** (e2e smoke) |

*Rationale: one language end-to-end, strong typing, Fastify is fast and simple, Drizzle keeps migrations SQL-first.*

---

## API shape

- **REST** under **`/api/v1/...`** (resources: events, stages, stage-days, performances, files, settings).
- **WebSocket** for collaboration: e.g. **`/ws/v1/collab`** (or nested under `/api` — pick one and keep it consistent); **subprotocol** or **query token** for auth when password enabled.
- **Server time**: **`GET /api/v1/time`** (or `/api/v1/health` including skew info later).

---

## Yjs persistence

- Store **incremental Yjs updates** in Postgres (`performance_id`, `update` bytea, `created_at`) for durability and crash recovery.
- **Periodic snapshot** (e.g. every N minutes or every M updates) stored as a single blob per doc to **speed up load** and **compact** history — compaction job can run async.
- **MVP simplification** allowed: **snapshot-only** on timer if incremental is too much for first slice — but plan to add **updates** before production festivals.

---

## Migrations & upgrades

- **Drizzle** (or chosen tool) **migrations** run **automatically** on API container start (`migrate` then `listen`) — documented in README.
- **Operators**: **backup `DATA_DIR`** before upgrading **image tag**; release notes call out breaking DB changes.

---

## Testing & load

### E2E

- **Playwright** smoke: **login (if password)** → create event → add performance → open patch view — run in **CI** on PRs (optional: only `main` to save minutes).

### Load (planning numbers)

- Design for **~30 concurrent** WebSocket connections per **stage** (patch + RF viewers); **~100** HTTP RPS peak on API for a single host — adjust after first real festival.

---

## Logging & debug

- **`LOG_LEVEL`** env: `error` \| `warn` \| `info` \| `debug` — default **`info`** in production images; set **`debug`** in `.env` on a **dev** machine for troubleshooting (**never** default `debug` on shared show laptops without need).
- Passed via **`docker-compose.yml`** into the **`app`** service once the Node API image replaces the nginx placeholder.
- Structured JSON logs in API (one line per event) for grep/journald.

---

## Related docs

- **[`PLAN.md`](PLAN.md)** — product vision and roadmap  
- **[`DESIGN.md`](DESIGN.md)** — visual design (themes, tokens)  
- **[`LICENSING.md`](LICENSING.md)** — repo + dependency licences  
