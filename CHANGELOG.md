# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) where version tags are used.

## [Unreleased]

### Added

- **Web:** **QR codes** on the **stage day running order** (left of each act, compact) and in the **patch page sidebar** open this act’s **Patch / RF** URL on a phone; respects **Settings → links / QR base URL** when set (`getPublicAppOrigin`). Dependency: **qrcode.react**.
- **API / Web / DB:** Optional **public base URL** (`settings.public_base_url`) — **`GET /api/v1/settings`** includes **`publicBaseUrl`**; **`PATCH /api/v1/settings`** sets or clears it (normalized `http(s)://host[:port]` only). **Settings** has **Advanced — links & QR base URL**; **`getPublicAppOrigin()`** uses the override when set, otherwise **`window.location.origin`** for share links and **patch QR codes** (running order + patch sidebar).
- **Web:** **Event dashboard** (`/dashboard`) — main nav link **`g d`**; for each stage with a day **today**, a **mini `ClockArena`** (same layout as the full stage clock) plus expandable **Running order** per stage. **`/clock`** redirects here (old clock hub removed).
- **Web / API:** **Patch & RF** — **Export Excel** (`GET /api/v1/performances/:id/sheets-excel`), **Print patch** (print stylesheet hides chrome), **collab presence** when **more than one** connection (`GET …/collab-presence`, refreshed every few seconds), and a short **highlight** when another user applies edits over collab.
- **API / Web / DB:** **Per-event logo** — `events.logo_file_id`, `file_assets.event_id`, uploads with `?eventId=`, `PATCH /events/:id` `{ logoFileId }`; header shows the logo on event / stage / day / patch / performance-files routes.
- **API / Web:** **Copy a day’s schedule** — `POST /api/v1/stage-days/:id/duplicate-schedule` with `targetStageDayId` and optional `replaceExisting`; UI on the **stage day** page when the stage has other days.
- **Web:** **PWA** — **vite-plugin-pwa** precaches the built SPA (large bundle limit raised for FortuneSheet); API/WebSocket stay **network-only**. The generated service worker is built in **development** mode (unminified) so production `vite build` stays reliable in constrained CI/sandbox environments. Add to home screen / install where the browser supports it.

### Changed

- **Web:** **Stage day** **Print** (🖨) outputs only **event name**, **stage name**, **day**, and the **performances table** — navigation, forms, and the rest of the page are hidden. Print styles use **high-contrast** ink on white for readability.
- **Web:** Running order and **print** show **+Nd** (not only **+1d**): **N** is how many **local** calendar days after the stage day the resolved **start** falls (**+2d**, **+3d**, … when the overnight chain crosses further midnights).
- **API / Web:** Performances may **run past midnight** — end time can be “earlier” than start on the wall clock (e.g. 23:00–01:00). Schedule validation uses **extended** time and **running order** (`sort_order`); the API **normalizes** `sort_order` to chronological extended order after create/update/delete/shift and lists performances by `sort_order` then time. **Web** uses a shared **overnight-aware** timeline for stage day, clock, and print views; **add** form and **shift** wrap times modulo 24h like HTML time inputs.
- Root **package-lock.json** refreshed (npm `peer` metadata; no intentional dependency version bumps).

### Fixed

- **Web:** **Clock arena** — **Changeover / handover** banners disappeared in **very short arenas** (e.g. Event dashboard): **`min-height: 0`** on the top block let flex **collapse it to nothing** vs. the hero’s **`min-height`**. When a **`.clock-arena-handover-banner`** is present, the top block now **`flex-shrink: 0`**, a **`min-height`** floor (**`max(2.75rem, …)`** so **`cqh`** cannot zero it), **`max-height`** with scroll; **footer + local time** may **`flex-shrink`** with tighter typography; hero floor is lower; **`@container (max-height: 280px)`** compresses footer/wall and scales banner type.
- **Web:** **Clock arena** — **`max-height: min(52cqh, …)`** on the top block could resolve to **0** when **`cqh`** was unset, collapsing the **changeover / handover** banners. **`max-height`** now uses **`max(6rem, 52cqh)`**; countdown **`min-height`** uses **`max(4rem, …)`** so **`cqh`** cannot zero out the hero region.
- **Web:** **Clock arena** — typography used **viewport `vmin`**, so embedded / small arenas (e.g. Event dashboard previews) could clip or starve the hero countdown on large monitors. The arena is now a **size container**; fonts use **`cqmin` / `cqh`** so they scale with the panel. Top meta can scroll if needed; countdown has a **minimum flex height**; **`useFitCountdownInBox` / `useFitTextInBox`** handle tiny boxes and **`ResizeObserver`** runs after **`requestAnimationFrame`**. Dashboard mini preview uses **`overflow: auto`** as a last resort.
- **Web:** **Stage day** page — **`otherStageDays`** `useMemo` was placed after loading/error **early returns**, so the hook ran only after data loaded and React threw **“Rendered more hooks than during the previous render.”** The memo is now declared with the other hooks before any return.
- **Web:** **Clock** and **Dashboard** — “today” matched **`stage_days.day_date`** using **`toISOString()`** (UTC), so the wrong day could appear near midnight or in non-UTC time zones. Filters now use the **local calendar** date, aligned with **My stage today** (`formatLocalCalendarDate`).
- **API / Web:** Collab structural-op detection now treats only whole-workbook `replace ["luckysheetfile"]` as structural. Routine cell edits often use nested `replace` paths under `luckysheetfile/...`; those now stay on op relay instead of forcing `fullState` remounts that reloaded the grid and could jump users to the first tab.
- **Web:** Remote-op formula recalc no longer cycles `activateSheet` across every tab before calculating. Recalc now runs by sheet id without changing tab focus, avoiding visible tab refresh/jump during normal remote edits.
- **Web:** Patch workbook now preserves the currently active sheet when a mid-session collab **`fullState`** remount arrives, so remote structural sync no longer jumps users back to the first tab.
- **Web / vendor:** Forked FortuneSheet now generates a **stable sheet ID per Add Sheet click** in `SheetTab` and enforces **core `addSheet` idempotency by ID**. This closes the remaining path where one UI action could emit multiple structural batches with different UUIDs and create duplicate **Sheet2** tabs on peers.
- **API:** Collab relay now drops rapid duplicate **`addSheet`** batches from the **same socket** (short cooldown) and sends sender **`fullState`** to resync. Logs/DB showed one click emitting multiple structural batches with different sheet UUIDs (e.g. **dfggfh**), creating duplicate **Sheet2** tabs on remotes.
- **API:** Collab relay **cold room** load used **`sheetsUsableForServing`**, which rejects Fortune **`addSheet`** tabs that only have **`row` / `column`** (no **`data`** / **`celldata`** yet). Persist used the looser **`sheetsSafeForCollabPersist`**, so after leaving and reopening a patch the DB snapshot was discarded and replaced with the blank **Input / RF** default. Relay seeding now matches persist + **`hydrateSheetsForCollabRoom`**; **`applyOpBatchToSheets`** materializes matrices on **`addSheet`** / full **`luckysheetfile`** replace. **`docs/REALTIME.md`**.
- **Web / vendor:** **`@fortune-sheet/react`** (fork) — **`onOp` / `emitOp`** no longer run inside **`setContext`** updaters; batches queue and flush in **`useLayoutEffect`** so a single **Add sheet** does not emit duplicate WebSocket batches (each had a new UUID, bypassing server **`addSheet`** id-by-id dedupe). Rebuilt **`vendor/fortune-sheet-react-1.0.4.tgz`** from **`doug86i/fortune-sheet`**; **`docs/DECISIONS.md`** fork bullet **#8**.
- **Web:** Patch / RF **`fullState`** — FortuneSheet React **`initSheetData`** only hydrates from **`celldata`**; workbooks stored as dense **`data`** matrices (relay / Postgres) had **`celldata`** omitted, so first mount replaced **`data`** with an empty grid and **cell text disappeared** even though export / DB were correct. **`normalizeSheetsForFortuneMount`** derives sparse **`celldata`** from **`data`** before **`setWorkbookSheets`** (`fortuneSheetMountNormalize.ts`).
- **API:** Collab relay — **`persistTail`** chains **`persistRoom`** per room so a **debounced** flush and a **disconnect** flush never run two **`await db`** writes at once (stale **last-writer** could overwrite **`sheets_json`** after you switched performances — e.g. jhbg edits lost when returning from kjkhg). **`LOG_LEVEL=debug`**: **`workbook persisted`** logs **`seqAtClone`** and approximate **`serializedBytes`**.
- **Web:** **`usePatchWorkbookCollab`** — when **`workbookReady`** was false (e.g. navigating to another performance while the new row was still loading), the effect returned without closing the previous WebSocket, so **two** collab sockets could run; stale **`fullState`** from the old room overwrote **`workbookSheets`** for the page you opened (edits looked “not saved” after reload). Cleanup now always closes the socket; **`connectWs`** retires the prior socket with **`wsRef.current === ws`** guards so orphan handlers cannot mutate state.
- **API:** Collab relay — **`persistRoom`** no longer clears **`dirty`** after the DB round-trip when new ops arrived during **`await`** (debounced flush could drop the follow-up save). **`sheetMutationSeq`** tracks mutations; concurrent edits reschedule flush. Last-socket disconnect no longer **`rooms.delete`** while **`dirty`** or persist skipped/failed, so in-memory workbooks are reused on reconnect instead of reloading stale Postgres.
- **Web:** Patch / RF uses shared **`PHONE_MAX_MEDIA`** (**`max-width: 767px`**, same as **`global.css`**) for phone layout, collab **read-only**, and **WebSocket** pause when hidden. After remote collab ops, **`suppressLocalOps`** clears after **microtask + one** animation frame (was two rAF), reducing dropped **`onOp`** with multiple tabs.
- **API:** **`applyOpBatchToSheets`** **`insertRowCol`** now follows FortuneSheet’s **`index` / `count` / `direction`** (server **`sheets_json`** stayed wrong on row/column insert when only **`start`/`end`** were read).
- **API:** **Event import** — embedded **`workbooks[].sheets`** are normalized with **`parseWorkbookJsonRoot`** (same **`normalizeSheetFromRaw`** path as template JSON import) before **`performance_workbooks`** insert; invalid workbook JSON returns **400** with a clear message.
- **Web / API:** Patch collab — structural batches (**`addSheet`**, **`deleteSheet`**, full workbook **`replace`**) broadcast **`fullState`** to **other** clients instead of **`op`**, with **`Workbook` `key`** bumps on mid-session **`fullState`** so remotes match server tabs. Cell edits still use **`op`** relay. Server **`insertRowCol`** mirror fix above; relay sends **`fullState`** to the **sender** when **`applyOpBatchToSheets`** throws. Persist debounce **~1.5s**. **`docs/KNOWN_ISSUES.md`** §83, **`docs/REALTIME.md`**, **`docs/DECISIONS.md`** updated.
- **API / Web:** **Event import** — **`POST /api/v1/import`** now allows **64 MiB** JSON bodies (**`bodyLimit`**). Fastify’s default **1 MiB** rejected typical **version 2** exports (embedded per-performance **`sheets`**). Clearer validation error text; workbook rows set **`updatedAt`** on insert. **Import event** in the UI shows a friendly message for invalid JSON and refetches **`["events", "allForClock"]`** after success. **`docs/DECISIONS.md`**, **`docs/USER_GUIDE.md`**, **`docs/KNOWN_ISSUES.md`** §1 note the limit.

### Changed

- **Web:** **Event dashboard** — mini clock previews are **slightly taller** (`min(48vh, 26rem)` / **`min-height` 13rem**) for more arena room.
- **Web:** **Clock arena** — **Changeover / handover** banners use **larger type** (higher `cqmin` caps, more padding); top block **`max-height`** raised so they are not clipped. **Fullscreen** controls are **compact** and sit on the **same row** as the footer metadata grid. **`docs/USER_GUIDE.md`**.
- **Web:** **Clock hub** (`/clock` listing) removed in favour of **Event dashboard**; nav **Stage clock** / **`g c`** / **My stage today** fall back to **`/dashboard`** when no last-viewed stage day is remembered. **`docs/USER_GUIDE.md`**, **`docs/REALTIME.md`**, **`docs/KNOWN_ISSUES.md`**.
- **Deployment / security:** Added internet beta hardening guidance for HAProxy deployments (`docs/SECURITY_BETA_DEPLOY.md`), including required production env (`FORCE_SECURE_COOKIES`, `CORS_ALLOWED_ORIGINS`, `REQUIRE_PASSWORD`), preflight checks, and backup/restore runbooks.
- **Ops:** Added `scripts/backup-data.sh`, `scripts/restore-data.sh`, and `scripts/preflight-beta.sh` plus `make backup-data`, `make restore-data BACKUP_DIR=...`, and `make preflight-beta BASE_URL=...`.
- **Docker / env:** `docker-compose.yml` now passes through `CORS_ALLOWED_ORIGINS`, `FORCE_SECURE_COOKIES`, and `REQUIRE_PASSWORD`, and supports `HOST_BIND` so app traffic can be bound to localhost behind HAProxy.
- **API:** Production startup now honors `REQUIRE_PASSWORD=1` and exits when no shared password is configured, preventing accidental internet launch in open mode.
- **API / Docs:** **`collab-ws-relay`** logs **`collab ws: client json parse failed`** (debug), **`collab ws: client message rejected`** (warn, first Zod **issues**), and **`collab ws: op payload is not an array`** (warn) when inbound WebSocket frames are dropped. **`docs/LOGGING.md`** — **`outbound cell op batches (aggregated)`** in NDJSON vs server **`relay op batch applied`** for save diagnostics.

- **Docker (fast) / API:** Client collab debug NDJSON is written under **`${DATA_DIR}/logs/client-debug.ndjson`** (Compose mount **`…/logs` → `/var/changeoverlord/logs`**, with **`db/`** and **`uploads/`**). **`POST /api/v1/debug/client-log`** allows paths under **`dirname(UPLOADS_DIR)`** as well as the repo cwd. Docs: **`data/README.md`**, **`docs/LOGGING.md`**.

- **API / Web / DB (breaking):** Replaced **Yjs** patch workbook sync with a **WebSocket JSON op relay** (`fullState` + `op` batches). Persistence is **`performance_workbooks.sheets_json`** and **`patch_templates.sheets_json`** (migration **`0010_replace_yjs_with_json`** — drops **`performance_yjs_snapshots`** and template **`snapshot` bytea**). Event **export/import** uses **`version`: 2** with workbook **`sheets`** arrays; **v1** packages with base64 Yjs snapshots are no longer supported. See **`docs/DECISIONS.md`**, **`docs/REALTIME.md`**, **`AGENTS.md`**.

### Added

- **API / Web / Docs:** **`LOG_LEVEL=debug`** — **`collab-ws-relay`** logs **`relay op batch applied`** (broadcast mode, sheet count, **`addSheetIds`**, op kinds). **`patchWorkbookCollab`** uses **`logClientDebugCollab`** for **`onOp` skipped** reasons, **`fullState received`**, structural outbound batches, and failed remote **`applyOp`**. **`summarizeOpsForClientLog`** includes **`addSheetIds`** ( **`(no-id)`** when missing). Playbook: **`docs/LOGGING.md`** (*Investigating patch collab*).

- **Web:** **Patch & RF** and **Edit patch template** show a short **Edits may not save — reconnecting…** banner when the collab WebSocket is not connected while the grid is loaded (e.g. phone tab backgrounded).

- **API / Web / Docker (fast):** **`POST /api/v1/debug/client-log`** (when **`CLIENT_LOG_FILE`** is set) appends **NDJSON** lines from the browser; **`logClientDebugCollab`** batches patch-workbook sender/receiver events. **`make dev-fast`** mounts **`${DATA_DIR}/logs`**, defaults **`CLIENT_LOG_FILE=/var/changeoverlord/logs/client-debug.ndjson`** and **`VITE_CLIENT_LOG_FILE=true`**. See **`docs/LOGGING.md`** (*Client debug log file*).


---

## [1.2.1] — 2026-03-24

### Added

- **API / Web:** Chat **presence** — `GET/POST /api/v1/chat/presence` with in-memory per-event heartbeats (~90s TTL, single API process). **Web:** **Who’s online** next to **Options**, and **first-time chat name** screen before messages load; send requires a non-empty display name. **`docs/REALTIME.md`**, **`docs/USER_GUIDE.md`**.

### Changed

- **Web:** Stage chat uses **WhatsApp-style bubbles**: your messages (same **Name** as in Options) align **right** with a brand-tinted bubble; others align **left**. **`docs/ROADMAP.md`** (CH-1), **`docs/USER_GUIDE.md`**.
- **Web:** Chat **Options** / **Who’s online** panels open **above** the button row (fixed above the composer); drawer titles and tinted backgrounds separate the message list, expanded panels, and input area. **`docs/USER_GUIDE.md`**.
- **Docs:** **`docs/README.md`** index row for **`USER_GUIDE.md`** mentions chat presence and layout.

## [1.2.0] — 2026-03-23

### Fixed

- **Web:** On narrow screens, **Edit stage** / **New stage** text fields no longer stretch tall: `flex: 1 1 200px` was meant for row layout (min width) but in a stacked `.form-row` it became a large min height.

### Changed

- **Web:** Stage detail page shows the **Days** list first; **Add day** and **bulk date range** live in one collapsible **Add days** section with clearer labels and layout. **`docs/USER_GUIDE.md`** (schedule workflow).
- **Web:** Stage page **Default patch / RF template** collapses after a default is chosen (summary shows the selection); expand to change template, add stage templates, or use template actions. **`docs/USER_GUIDE.md`** (templates).

## [1.0.0] — 2026-03-22

### Fixed

- **API — Yjs persist (lost patch workbook):** **(1)** If loading the DB snapshot in **`bindState`** fails, the server no longer runs the immediate debounced catch-up persist (only real **`update`** events schedule saves), avoiding an **empty doc** overwriting a good row after a transient DB error. **(2)** Before replacing an existing performance or template snapshot **≥ 256 bytes**, the new encoded state is **headless-replayed**; if the result is not **structurally usable** (same bar as opLog compaction), the write is **skipped** with a **warn** log and the previous snapshot is kept.

- **API — Yjs persist:** Persisting a performance workbook snapshot no longer **crashes the process** when the **performance row was deleted** but a collab WebSocket was still open (PostgreSQL **FK** `23503`). The flush is skipped with a **warn** log; **`writeState`** errors are caught so disconnect handlers cannot kill the server.

- **Web — stage chat:** Chat dock is **`createPortal`’d to `document.body`** (avoids stacking traps under **`#root`** / spreadsheet hosts) and **`right`** uses **`--app-scrollbar-width`** (set by **`ViewportScrollbarVar`**) so it clears classic viewport scrollbars. **`z-index`** remains **`999`** (**`--z-stage-chat-dock`**); modals (**1000**) and toasts stay on top. **`isolation: isolate`** on **`.patch-workbook-host`** contains FortuneSheet's internal z-indexes (up to 100 003) so spreadsheet scrollbars no longer paint above the chat dock.

- **Web — patch sidebar:** **Rider PDF** quick link no longer falls back to a **stage-wide** rider; only a file marked **Rider** on **this act’s** Files page is linked (matches stage-plot behaviour and avoids showing another band’s rider).

- **Web — patch template editor + docs:** In-app copy matches behaviour (automatic persistence, no “close tab to save”; **copy-at-creation** vs unchanged existing band workbooks). **`docs/USER_GUIDE.md`** **Edit spreadsheet** bullet aligned.

- **Web — patch / RF workbook:** Opening a performance patch sheet or **Edit spreadsheet** (template) right after navigation or upload could show a **blank** grid: Yjs reported synced before the server finished merging the DB snapshot, and remote `opLog` updates were ignored until hydration finished. The client now **drains the log until quiescent** (extra animation frames), **defers local `onOp`** until replay completes, and shows **Loading workbook…** over the grid until then.

### Changed

- **Web — stage chat:** The message list and composer textarea use **slim, themed scrollbars** (tokens + **`color-mix`**) so they match light/dark UI instead of the browser default.

- **Web — stage chat:** Only two states — compact **Chat** button or **full panel** with **Minimize** (removed the extra bar + **Hide** + session “tucked” state).

- **Web — stage chat:** Wider open panel (**`min(56rem, 92vw, 100vw − 2rem)`**); collapsed **Chat** control stays compact (full width only when open). Taller panel (**`max-height` ~72vh / 720px**) and message list grows with flex (**no fixed 280px cap**).

- **Process / agents:** **`AGENTS.md`** and Cursor rules (**`agents-process`**, **`local-docker-deploy`**) state that agents **always** run **`make dev-fast`** / **`make dev`** after code changes when Docker is available (not optional hand-off text only).

- **Docker / dev:** Fast stack (**`make dev-fast`**) maps the Vite UI to host port **80** by default (**`FAST_WEB_PORT`** default **`80`** in **`docker-compose.fast.yml`** and **`.env.example`**), matching classic **`HOST_PORT`**. Set **`FAST_WEB_PORT=5173`** if port 80 is busy or the classic stack already uses it.

### Added

- **Docker / dev workflow:** **`make dev-fast`** + **`docker-compose.fast.yml`** / **`Dockerfile.fast`** — Postgres with bind-mounted **`api/`** + **`web/`**, **tsx** watch + **Vite** on **`5173`** (proxies **`/api`** and **`/ws`**). **`Makefile`** targets **`dev-fast`**, **`dev-fast-app`**, **`dev-fast-down`**; **`web/vite.config.ts`** reads **`VITE_API_PROXY`** for containerized Vite. Classic **`make dev`** remains for production-like image testing. Docs and agent rules updated so **`make dev`** is no longer the only supported local integration path.

- **Docker / dev:** **`scripts/docker-build-gate.sh`** + **`.docker/`** stamps — **`make dev`** and **`make dev-fast`** skip **`docker compose --build`** when image inputs are unchanged (fast stack: **`Dockerfile.fast`** / compose only; classic: full **`api/`** + **`web/`** + Dockerfile context). **`make dev-rebuild`**, **`make dev-fast-rebuild`**, and **`FORCE_DOCKER_REBUILD=1`** force builds. **`npm run docker:dev-fast`** uses **`scripts/npm-dev-fast.sh`** with the same logic.

- **API / Web — stage & event chat:** `GET/POST /api/v1/chat/messages` with `stage_chat_messages` table; SSE payloads may include optional **`chat`** (see **`docs/REALTIME.md`**) so the bottom-right **Chat** dock opens and highlights on new messages. Messages can target **one stage** or the **whole event**; shown on event, stage, day, patch, and performance-files routes (**not** on Clock screens).

### Changed

- **Web — stage chat:** Hide the chat dock on **`/clock`** and **`/clock/day/...`**; stage picker state no longer leaks into other routes after leaving an event page.

- **Web — stage chat:** **Options** toggle for name and audience; **Enter** sends (Shift+Enter newline); dock sits above the **footer** so it does not cover “Powered by”.

- **Web — stage chat:** **Hide** collapses to a small **Chat** control (remembered for the tab); **click outside** the open panel or **Escape** closes the panel; incoming messages still expand and flash.

- **Web — stage chat:** Slimmer panel (no instruction blurb); **Stage** + **Name** live under **Options**; bar is **Chat** + **Hide** only; outside click / Escape closes **Options** first then the panel so the stage dropdown works reliably.

### Fixed

- **API — Yjs opLog compaction:** Compaction could replace the log with a **`replace luckysheetfile`** built from a **headless replay** that diverged from FortuneSheet (unsupported / skipped op batches), yielding an **empty or unusable** grid. Compaction now uses a **single `transact`** (snapshot `opLog` → replay → validate → replace), **`JSON.stringify`** errors abort, and replay output must pass **`sheetsUsableForServing`** (non-empty sheet list, ids, `data` or `celldata`) or compaction is skipped with a warning log.

- **API — Yjs / patch workbook:** **`bindState`** registered **`update` → debounced persist** before the async DB snapshot finished loading. The WebSocket sync step could fire a persist on an **incomplete** server doc and **overwrite `performance_yjs_snapshots` / template snapshots** in Postgres — especially under higher DB latency (typical **prod**). The listener is now attached **after** load (with a catch-up **`schedulePersist`**). See **`docs/REALTIME.md`**.

- **Web — patch / template workbook (hydration races):** **`hydratedRef`** was set **before** post-replay **`calculateFormula`**, so remote **`yops`** updates and user edits could run with a stale **`currentSheetId`** (intermittent **sheet not found**). Hydration now marks ready **only after** recalc, replays the opLog with a **dynamic-length** drain (so tail inserts during replay are not skipped), uses a **run-id** guard so stale async hydration cannot finish after reconnect / effect churn, adds an **extra animation frame** before recalc, and **activates a coherent first tab** before **`jfrefreshgrid`**.

- **Web — patch / template workbook:** Post–Yjs-hydration recalc called **`activateSheet`** with **`{ sheetId }`**, but FortuneSheet’s **`getSheet`** only reads **`options.id`**, so it fell back to the stale **`placeholder`** tab id after **`luckysheetfile`** replace. That broke **`jfrefreshgrid` / `calculateFormula`** (e.g. **#REF!** in **A1**, **sheet not found** on edit until reload). Recalc now passes **`{ id: sheetId }`**. **API:** Excel → sheets normalisation assigns a **UUID** when a sheet’s **`id` is `""`** (library quirk) and aligns **`calcChain`** ids so incremental recalc stays consistent.

- **API / Web — performances:** Blank or whitespace-only **band / act** names are stored as **Untitled act** on create, patch, and event import (duplicate rows use the same fallback before **(copy)**). This avoids fragile patch-workbook edge cases tied to unnamed acts. Post-replay formula refresh also **skips sheets with an empty `id`** so FortuneSheet does not call **`activateSheet`** with an invalid target.

- **Web — patch workbook formulas:** After **`applyOp`** / Yjs replay, FortuneSheet could keep a **stale `formulaCellInfoMap`** built from the pre-replay grid, so **`execFunctionGroup`** did not walk the right dependency edges and **dependent formulas did not refresh** on cell edits. Post-replay and post-remote-batch recalc now runs **`jfrefreshgrid`** over each sheet’s **`data`** bounds (rebuilds **`setFormulaCellInfo`**) before **`calculateFormula`**, and clears **`onOp` suppression** after **two `requestAnimationFrame`** ticks so nested updates finish before local ops resume.

- **Web — collaborative patch workbook:** Remote **`applyOp`** updates applied only **Immer patches** to the grid; FortuneSheet’s **`execFunctionGroup`** (dependent formula refresh) does not run for those mutations. After **hydration** we already called **`calculateFormula`**; we now **queue the same full recalc** (with **`onOp` suppressed**) when **remote** Yjs ops arrive so summaries and lookups stay in sync with other editors.

- **API — Yjs persistence:** Edits could be silently lost on container restart. The 3-second debounce timer was killed by SIGTERM with no shutdown handler to flush pending writes. Added **graceful shutdown** (SIGTERM / SIGINT) that persists every active Yjs doc to Postgres before exit. Debounce reduced from **3 s → 1 s**. Compose now uses `init: true` and `stop_grace_period: 15s` for reliable signal delivery.

- **API — Yjs opLog compaction:** The Yjs opLog (append-only array of cell edits) grew unboundedly, making page-load replay slow and fragile. Persistence now **compacts** the opLog to a single `replace luckysheetfile` op when it exceeds 200 entries, keeping snapshots small and replay fast.

- **API — patch workbooks:** **`GET …/sheets-export`** now replays the full persisted **Yjs `opLog`** as **direct JSON mutations** (set-at-path, splice for row/column ops). The previous implementation routed ops through FortuneSheet’s `opToPatch` + Immer `applyPatches`, but the return value of `applyPatches` was never captured — every edit after the initial upload was silently discarded. Exports now match the live collaborative state. **`immer`** removed from API dependencies.

- **API — formula recalculation:** **`normalizeSheetFromRaw`** now **builds `calcChain`** from the data matrix when the source (Excel or JSON) omits it. FortuneSheet’s incremental recalc (`execFunctionGroup`) only re-evaluates formulas registered in `calcChain` — without entries, cell edits never trigger formula updates. The opLog replay also fills missing entries on exported sheets.

- **API — patch templates:** **`POST …/patch-templates/blank`** now seeds each sheet with a dense **`data`** matrix (null cells) and an empty **`calcChain`**. Previously blank workbooks had **no** `data` array, so FortuneSheet/Yjs cell ops could not persist reliably.

- **Web — patch workbook placeholder:** **`WORKBOOK_PLACEHOLDER`** includes **`data`** and **`calcChain`** so the pre-sync mount matches what FortuneSheet expects.

- **API — file download:** **`GET /files/:id/raw`** returns **404** when the DB row exists but the blob is missing on disk (**ENOENT**), with a **warn** log, instead of surfacing as **500**.

- **API / Docker — Convert to PDF (images):** **WebP** (and other formats ImageMagick decodes via delegates) failed in the container because **`dwebp`** was not installed. The app image now includes **`libwebp-tools`**. **JPEG** and **PNG** are converted with **pdf-lib** first (single-page A4, scaled); ImageMagick errors include a short **stderr** snippet for debugging.

- **API — database:** Postgres pool **`error`** events on idle clients are **logged** (`db-pool` component) instead of failing silently.

- **Web — search / shortcuts:** **`g`** navigation prefix and search **debounce** timers are **cleared** on unmount / when the search dialog closes so callbacks cannot run after teardown; workbook JSON **download** revokes the blob URL on the **next macrotask** so the browser can start the save reliably.

- **Web — a11y:** Header **search**, **theme toggle**, and **My stage today** expose **`aria-label`** (still with **`title`** where helpful).

### Changed

- **Docker / deploy:** **`docker-compose.yml`** is **pull-only** for the app service (**`pull_policy: missing`**, no **`build:`**). **`docker-compose.dev.yml`** adds **`build: .`**; **`make dev`** / **`Makefile`** merge both files. Operators can deploy with **`docker compose pull && docker compose up -d`** using only the base compose + **`.env.example`** (see **`README.md`**, **`HANDOVER.md`**).

- **Docs / tooling:** **`docs/REALTIME.md`** documents the **template editor** WebSocket path (**`/ws/v1/collab-template/:templateId`**). **`AGENTS.md`** file map and **`.cursor/rules`** (**`pitfalls.mdc`**, **`code-patterns.mdc`**) aligned with **`docs/CODEBASE_REVIEW.md`** follow-ups (Yjs bridge paths, oplog-replay caveat, `useQueryClient` mutation example). **`[Unreleased]`** changelog merged duplicate **`### Fixed`** blocks.

- **Web — stage files:** **Rider** / **Stage plot** toggles are **hidden** on the stage-wide file list (use each act’s **Files** page). The list **filters out** any row with a `performanceId` so band files never show on the stage screen; a short notice appears if the API/cache returned any. **API:** `GET /files` must pass **exactly one** of `stageId` or `performanceId` (reject both or neither).

- **Web — stage page:** **Stage files** is **collapsed by default** (header shows **Show (n)**). Expanded copy explains stage vs per-act uploads. **Performance Files** page intro is shortened to avoid duplicating the file-list help.

- **Web — patch sidebar:** **Stage plot** preview no longer falls back to **stage-wide** plots (those live under **Stage → Stage files**). Only a file marked **Stage plot** on **this act’s Files** is previewed, so a new performance is not shown another act’s shared plot by mistake. **Rider** still falls back to the stage rider when the act has none.

- **Web — Settings:** Removed the redundant **Import workbook JSON** button from patch template library controls; **FortuneSheet JSON** (`.json`) is still added via the same **Upload Excel … or FortuneSheet JSON** file picker (and **Import workbook JSON** remains on the **stage** template picker).

### Changed

- **Docs:** **`docs/PATCH_TEMPLATE_JSON.md`** — FortuneSheet **`sheet not found`** troubleshooting (cross-sheet refs, **`colhidden`**, missing **`data`**); example file list aligned with **`examples/`**. **`docs/USER_GUIDE.md`** — pointer for operators.

- **Dependencies:** Removed **`patch-package`** overrides for **`@fortune-sheet/core`** and **`@fortune-sheet/react`** (default font order + context-menu “add column” input lookup). Upstream **1.0.4** ships those files unpatched; `patches/` may be empty aside from **`.gitkeep`**.

### Added

- **`examples/OPERATOR_PATCH_REFERENCE_v1.json`** + **`scripts/generate-operator-patch-v1.mjs`** — new **single-sheet** operator patch reference built **without Excel** (pure Node): **literal `COUNTIF`** stand summaries (no `*` criteria), **`LOWER(TRIM())`** normalizer column, compact **`VLOOKUP`** label preview, **dense `data`** and **full `calcChain`** for reliable incremental recalc in FortuneSheet.

- **API — Excel CF extraction:** Direct `.xlsx` template uploads now extract conditional formatting rules from the raw OOXML XML (`api/src/lib/excel-cf-extract.ts`). The `@zenmrp/fortune-sheet-excel` library does not support CF; the new module parses `conditionalFormatting` blocks, resolves dxf styles and theme colours, and maps `beginsWith`/`cellIs`/`expression` rules to FortuneSheet's `luckysheet_conditionformat_save` format.

- **`examples/DH_Pick_Patch_TEMPLATE_v7.json`** — single-sheet **Channel List** reference workbook: patch data **A–J**, stand/mic summaries **M–N**, compact SatBox label grid **M–R** with same-sheet **`VLOOKUP`** lookups (no cross-sheet formulas, no AA–AD helpers). Conditional formatting: SatBox prefix colours (upper + lower) and grey empty label cells (`changeoverlordWorkbook: 1` envelope).

- **`scripts/build-v7-template.mjs`** — builds that JSON from the human-made Excel (first sheet only + right-side layout); run `node scripts/build-v7-template.mjs > examples/DH_Pick_Patch_TEMPLATE_v7.json`.

- **Root `package.json` scripts:** **`build:test`** (api then web) and **`docker:build:app`** (`docker compose build app`).

- **Docs:** Add **`docs/CODEBASE_REVIEW.md`** — canonical engineering audit backlog (code, infra, CSS, realtime, doc drift). Indexed from **`docs/README.md`**, **`docs/MAINTAINING_DOCS.md`**, **`AGENTS.md`**, and root **`README.md`** (also lists **`docs/PATCH_TEMPLATE_JSON.md`** in the root doc table).

- **Web — patch / template workbook:** After the initial **Yjs opLog** replay, the grid runs **`calculateFormula`** twice (covers cross-sheet dependency order). **Imported** or **synced** workbooks with cross-sheet formulas (e.g. **SatBox** labels reading **Channel List**) now show evaluated values instead of staying stale. **`onOp`** is ignored during that pass so formula value patches are **not** appended to **Yjs**.

- **API — patch templates:** **Replace** (multipart) now accepts **FortuneSheet JSON** when the browser sends **`text/plain`** or omits a **`.json`** filename — content sniffing plus storing **`.json`** on disk when the body looks like workbook JSON (avoids saving JSON under a **`.xlsx`** key). **Replace** also persists via **`workbookSnapshotBufferForPersist`** so an open **template editor** collab session picks up the new sheets.

- **API — build:** `yjs-collab-replace` imports **`@y/websocket-server/utils`** without the **`.js`** suffix so **TypeScript** resolves the module the same way as **`collab-ws.ts`** (Docker **`npm run build -w api`**).

- **API — patch templates:** Normalizing imported sheets now **fills `mc.r` / `mc.c`** on merge-master cells when only **`rs`/`cs`** were present (common in JSON exports), and **coerces numeric `tb` to string** so FortuneSheet’s text-wrap checks match. Fixes template **Edit spreadsheet** crashes / errors for those workbooks; **re-upload or Replace** an affected template to refresh the stored snapshot.

### Changed

- **Examples — DH v7 template:** `DH_Pick_Patch_TEMPLATE_v7.json` is now a **single-sheet** workbook (patch **A–J**, summaries and SatBox label grid **M–R** on **Channel List**). Removes Mic & DI List, SatBox Lables, Equipment Pick List, helper columns AA–AD, and cross-sheet formulas so FortuneSheet recalc stays reliable. Build script **drops Excel `colhidden`** on M–R (and stale AA–AD keys) so the grid is visible; label cells use **`VLOOKUP`** + **`IFERROR`** instead of `INDEX`/`MATCH` (avoids `#ERROR!` in the browser).

- **Web — FortuneSheet (patch + template editors):** **`.patch-workbook-host`** pins **light-theme** CSS variables (`--color-bg`, `--color-surface`, `--color-text`, …) so toolbar icons and sheet chrome stay readable when the app is in **dark** mode.

- **Web + API — patch workbooks:** Removed the server-side `initialSheets` decode layer from API responses. The Yjs WebSocket sync is now the single path for delivering workbook state. `<Workbook>` mounts with a trivial placeholder; the opLog replay sets the real structure. Deleted `patchWorkbookSeed.ts` / `sheetsFromApiSeed`. Templates come from Excel upload or **Create blank template** (Settings). Stages pick a stored template; **`PATCH /stages/:id`** no longer accepts `defaultPatchTemplateId: null`.

- **API — patch templates:** **No** automatic database seed and **no** in-repo generation of example workbooks. Optional starter **`.xlsx`** files may be added under **`examples/`** (upload via Settings). **`POST /api/v1/patch-templates/new`** removed.

- **Web + API — patch templates:** **`usePatchWorkbookCollab`** (shared Yjs/WebSocket + **`usePatchWorkbookOpLogEffects`**) drives both **performance patch** and **template editor** pages.

- **API — patch templates:** Excel import switched from the hand-rolled **ExcelJS** parser (values and formulas only) to **`@zenmrp/fortune-sheet-excel`**, which preserves cell styles, fonts, borders, number formatting, merged cells, column widths, row heights, formulas (with cached results), and calc chains. The preview endpoint now also handles the library's sparse `celldata` format.

- **Web — stage day clock:** **Compact** (normal) view shows the same **Changeover** banner as fullscreen/distance when the day is between acts.

### Added

- **Examples:** **`examples/DH_Pick_Patch_TEMPLATE_v5.3_formulajs.json`** — DH Pick & Patch workbook (**v5.3**) with **Channel List** helpers **AA** (mic text), **AD** (running mic index), **AE** (stand tokens for **tall**/**short**/**round**); **Mic & DI List** stand counts use **`COUNTIF`** on **AE** (no **`Tall*`** wildcards). **SatBox** labels use **`VLOOKUP(..., 0)`** + **`TRIM`**. Replaces **`DH_Pick_Patch_TEMPLATE_v5.2_satbox_vlookup.json`**.

- **Examples:** **`examples/patch-template-conditional-format-demo.json`** — uploadable FortuneSheet JSON with **`luckysheet_conditionformat_save`** (color scale + data bars); **`examples/README.md`** updated for **`.json`** starters.

- **Web + API — patch workbooks:** **Export JSON** / **Import JSON** for **library templates** (`GET`/`PUT` `/api/v1/patch-templates/:id/sheets-export|sheets-import`), **new template from JSON body** (`POST` `/api/v1/patch-templates/sheets-import`), and **per-performance** workbooks (`GET`/`PUT` `/api/v1/performances/:id/sheets-export|sheets-import`). Envelope **`changeoverlordWorkbook: 1`** plus raw sheet-array uploads are accepted on import. UI: **Settings**, **stage** template picker, and **Patch & RF** page. See **`docs/PATCH_TEMPLATE_JSON.md`**.

- **Web + API — patch templates:** Upload **FortuneSheet-native JSON** (`.json`) on create/replace (same multipart **`file`** field as Excel). Preserves extra sheet fields (e.g. conditional formatting metadata) that the Excel import path drops; see **`docs/PATCH_TEMPLATE_JSON.md`**.

- **Web + API — patch templates:** **Create blank template** on the **Settings** page (`POST /api/v1/patch-templates/blank`) adds a library workbook with two empty tabs; opens the template editor after creation.

- **Docs / process:** **`AGENTS.md`**, **`docs/DEVELOPMENT.md`** (new § *Patches*), **`docs/README.md`**, **`README.md`**, **`docs/MAINTAINING_DOCS.md`**, **`docs/HANDOVER.md`**, and **`.cursor/rules/local-docker-deploy.mdc`** / **`agents-process.mdc`** updated for **`patches/`**, **`patch-package`**, Docker **runner** vs **builder**, and when to **`make dev`**.

- **Docker build:** Runner **`apk`** installs use **BuildKit cache mounts** on **`/var/cache/apk`** and **split layers** (Poppler + ImageMagick vs LibreOffice + fonts) so repeated image builds reuse package downloads more often; see **`docs/DEVELOPMENT.md`** → *Faster Docker rebuilds* and *Heavy runtime packages*.

- **API — Files:** **`POST /api/v1/files/:id/convert-to-pdf`** creates a **new PDF** from supported non-PDFs (images via **ImageMagick**, Word/ODT/RTF via **LibreOffice** headless, plain text via **pdf-lib**). Responses include **`canConvertToPdf`** on file rows. **Docker** installs **`imagemagick`**, **`libreoffice`**, and **`ttf-dejavu`** (see **`docs/DEVELOPMENT.md`**).

- **Web — Files:** **Convert to PDF** action when **`canConvertToPdf`**; **Use as:** label tweak (removed redundant “Other” hint).

- **Web — Patch & RF:** **Sticky sidebar** on the patch workbook: **server-synced** time, **countdown** (same rules as the stage day clock), **changeover** badge when between acts, **this act** + **Alt+arrow** hint, **on stage** / **next**, **All files** + **Rider PDF** when uploaded, **stage clock** / **running order** links, **collapsible** sidebar (**Hide »** / **« Context**, preference in `localStorage`), **stage plot** preview (`plot_pdf`, performance then stage). **`stageDayClockMetrics`** includes **`isChangeover`**. **FortuneSheet** (patch + template editors): **app font** and theme-aligned **toolbar / sheet chrome** (`.patch-workbook-host`).

- **Web — stage day:** Acts with **non-empty notes** show a **Note** badge next to the band name and a **highlighted Notes** control so it is obvious before expanding the notes field.

- **Docker build:** Split **api** and **web** `npm run build` into separate Dockerfile layers so changes in one workspace reuse the other’s cached build; BuildKit cache mounts for **tsc** incremental (`api/.cache`) and **Vite** (`node_modules/.vite`). **`api/tsconfig.json`** enables incremental builds. **`make dev-app`** rebuilds only the app image. See **`docs/DEVELOPMENT.md`** → *Faster Docker rebuilds*.

- **Web — time display:** `formatCountdownOrDays` / `formatClockHeroCountdown` in `dateFormat.ts` — countdowns to the **next act** use explicit units: **m/s** under 1 hour, **h/m** from 1 hour until 24 hours, **days** from 24 hours up; **time left** on the current act still uses **M:SS**.

- **Web — stage day:** When **adding** a performance, choose **End time** or **Set length** (minutes); set length is stored as end time — **end is always required** (no open-ended slots). **Changeover** (default **30 min**) only pre-fills the next start; first slot defaults to **1 h** length. After each add, the next row pre-fills **length** and **end time** to match the previous slot; switching **End time** ↔ **Set length** keeps the same duration. **Duplicate** spacing after the last end uses the same default changeover (**30 min**).

- **Web — stage day clock:** From **one hour after** the **last performance** on that day (same stage), the clock **automatically opens** the **next configured stage day** on that stage. Between **last finish** and that moment, a full-screen **crew message** shows the **next day’s lineup** when another day exists; after the **last** day on the stage, a **thank-you** message remains (no navigation). Applies to **normal** and **distance/fullscreen** views. If the last slot has no end time, its end is treated as **start + 1 hour** for this logic. Empty days do not auto-advance.

### Fixed

- **Web + API — patch template editor:** **Immer** could throw **“Cannot apply patch, path doesn’t resolve”** (e.g. `data/6/1`) when **replaying** the full **Yjs** **opLog** onto the **two-tab default** shell — **FortuneSheet** never committed the large initial **`replace luckysheetfile`** batch before later ops ran. **`GET /api/v1/patch-templates/:id`** now includes **`initialSheets`** (decoded from the stored snapshot, else from the uploaded **Excel**), and **`usePatchWorkbookOpLogEffects`** **yields one animation frame per opLog batch** so each **`applyOp`** run can finish before the next.

- **Web — patch template editor:** After the first open, **FortuneSheet** could stay **blank** (same template id, **React Strict Mode** remount, or navigate away and back): **`hydratedRef`** for **opLog** replay stayed **true** while the workbook **remounted** empty. **Unmount** now **clears** hydration so the full **opLog** **replays** onto the new instance.

- **Web — patch workbook (template + performance):** **Yjs** could fill **`opLog`** before **FortuneSheet** mounted, so **`observe`** ran with **`wbRef` null** and updates were **lost** (empty sheet, wrong content, edits vanishing). The shared **`opLog`** is **replayed** once after **sync** and workbook mount; **`observe`** applies only after that. **Collab `synced`** resets when the **template** or **performance** id changes so status is not stale across navigations.

- **Docker build:** **`patches/`** is copied into the **builder** image before **`npm install`** so **`patch-package`** applies FortuneSheet fixes during **`vite build`**. The **runner** stage uses **`npm install --ignore-scripts`** so production installs do not require **`patch-package`** (dev-only).

- **Web — FortuneSheet:** **Insert columns** (context menu) reads the count from the menu row’s **container** (same as insert rows), not `event.target`, so clicking the label instead of the input no longer does nothing.

- **API — Files:** **PDF extract** page previews are rendered **server-side** with **Poppler** **`pdftoppm`** (`GET /api/v1/files/:id/page-previews`); the Docker image includes **`poppler-utils`**. This avoids **pdf.js** in the browser (including **`getOrInsertComputed`** errors in some embedded runtimes).

- **API — Files:** At most **one** **Stage plot** / **one** **Rider** per **stage** or **performance** file scope; **PATCH** or **extract-page** to set a plot or rider **demotes** the previous file in that role to **Other** (`generic`).

- **Web — Patch workbook (FortuneSheet):** **In-cell editor** (`.luckysheet-input-box-inner`) forces **`#000`** text / **`-webkit-text-fill-color`** (including nested spans) with **`!important`** in **light** and **dark** theme so typing stays readable; **dark** mode does **not** override the library’s default **white** editor background — **black-on-white** only.

- **Web — PDF extract:** **Extract** uses inline server thumbnails; **Extract as new PDF** failures show the **API error message** under the controls.

- **Web — Patch sidebar:** Block order: **Local time** → **Now** → **Countdown** → **Next** → **This spreadsheet** (then quick links and plot). **Now** / **Next** band names **link to `/patch/:performanceId`**.

- **Docker build:** The **API** builder step now removes **`api/dist`** and **`api/.cache/tsconfig.tsbuildinfo`** before **`tsc`**. Without clearing incremental metadata, **`tsc` could emit no files** while exiting successfully, yielding an **empty `api/dist`** in the image and a **crash loop** at runtime (`ERR_MODULE_NOT_FOUND` for `db/client.js`, etc.).

- **Web — file uploads:** New uploads are stored as **Other** (`generic`); each row uses **Rider** / **Stage plot** **`icon-btn`** toggles (active = **`primary`**; click again for **Other**). **`PATCH /api/v1/files/:id`** updates **purpose**. Database **`plot_from_rider`** is folded into **`plot_pdf`** (migration **0005**).

- **Web — stage days:** **Add performance** — **Enter** in **Band / act** submits the form (same as **Add**). Suggested **start / end / length** update when the **last slot** in the running order changes on **another device** (SSE refetch), not only after a local add.

- **Web — stage day clock:** Leaving **browser fullscreen** (e.g. window resize or snap that ends fullscreen) no longer drops the **distance** layout — **`fsIntent`** is only cleared from **F** / **Exit fullscreen** / **Compact clock**, not from `fullscreenchange`. Added **Compact clock** when the large layout is active without fullscreen.

- **Web — stage days:** “Bulk add days” → “Add range” now uses the same date fallbacks as the From/To fields (event start/end when the fields were never edited). Previously the UI could show event dates while React state stayed empty, so the range was computed as empty and no days were created.

### Changed

- **Web — Files (performance / stage):** **Upload** has no purpose picker; **per-file** **Rider** / **Stage plot** toggles match **`icon-btn`** styling elsewhere. PDF **extract** shows **server-rendered** per-page thumbnails. Row actions (**View**, **Open**, **Extract**, **Delete**) use **`icon-btn`** + text labels to match **stage day** compact actions. **`docs/DEVELOPMENT.md`** and **`.cursor/rules/code-patterns.mdc`** document the pattern.

- **Web — FortuneSheet:** `.patch-workbook-host` themes **toolbar**, **formula bar**, **sheet tabs**, **row/column headers**, **resize handles**, and **modals** with **`var(--color-*)`** / **`var(--color-brand)`** (better **light/dark** alignment). **Cell selection** and related chrome use **library defaults** (no custom fill on the active cell); **typed text** in the editor is overridden for **readability** (see **Fixed**).

- **Docs:** **`docs/USER_GUIDE.md`** — patch / RF page **sidebar** (clock, countdown, now/next, links, plot preview) and band-nav wording; **`AGENTS.md`** — implementation status for the patch workbook updated (sidebar replaces the old “mini clock” note).

- **Web — Clock nav:** The header **Clock** link and **`g c`** go to **`/clock/day/{id}`** for the **last viewed stage day** (running order or stage-day clock), using **`ClockNavContext`** and the same **`localStorage`** key as **My stage today** / last visit. If none is stored, behaviour is unchanged (**`/clock`** picker).

- **Web — stage day clock (distance/fullscreen):** The hero **countdown** sits in a **flex** region and **scales its font** (ResizeObserver + fit-to-box) so it uses available space without overlapping; **local time** and vertical **gaps/padding** are tightened so the view wastes less space.

- **Process:** Documented release notes workflow — `CHANGELOG.md`, `AGENTS.md`, `MAINTAINING_DOCS.md`, `docs/DEVELOPMENT.md`, and Cursor rules (`changelog.mdc`, `local-docker-deploy.mdc`) so shipped changes are recorded with the same bar as Docker deploy verification.
- **Process:** Document **Git** workflow — commit **each logical unit** separately with **short, specific, imperative** messages (`git-commits.mdc`, `AGENTS.md`, `docs/DEVELOPMENT.md` § Git commits).

---

## [0.1.0] — 2026-03-21

First integrated release: festival sound-ops web app (schedules, changeovers, patch/RF workbook, clocks) with Docker Compose deployment. Summarises history through `9b1ff8d`.

### Added

- **Scaffold & deploy:** Docker Compose, GHCR image workflow, single `DATA_DIR` tree for Postgres and uploads, `HOST_PORT` / `APP_IMAGE_TAG` / `LOG_LEVEL` / `SESSION_SECRET` in Compose, multi-stage `Dockerfile` serving built SPA + Fastify API.
- **API:** Fastify + TypeScript, Drizzle ORM + PostgreSQL migrations, REST under `/api/v1` for events → stages → stage-days → performances; health and server time; optional shared-password auth (`@fastify/cookie`, HMAC session, bcrypt); settings routes; structured logging (`req.log`, `LOG_LEVEL`).
- **Realtime:** SSE `GET /api/v1/realtime` with TanStack Query invalidation after mutations; WebSocket Yjs collaboration for patch/RF workbooks (performances and templates).
- **Domain features:** Patch template library (upload OOXML Excel, presets, stage defaults), file attachments with PDF viewer and page extract, global search, event JSON export/import, performance overlap hints, swap/shift scheduling, stage clocks (arena + fullscreen), “My stage today”, keyboard shortcuts, connection status banner, offline-first TanStack network mode.
- **Web:** Vite + React + TypeScript, responsive shell and navigation, FortuneSheet-based workbook UI, light/dark themes.
- **Docs & tooling:** `USER_GUIDE`, `REALTIME`, `LOGGING`, `DESIGN`, `PLAN`, `HANDOVER`, `AGENTS.md`, Cursor rules for deploy and patterns.

### Changed

- Replaced early nginx / bind-mount placeholder workflow with the current Node image serving `web/dist` and `api/dist` (no hot-reload from host source in production path).

---

## How to maintain (contributors & agents)

- Edit the **`[Unreleased]`** section in **this file** in the **same change** as the behaviour fix or feature, unless the change is **docs-only**, **comment-only**, or **metadata-only** with **no** runtime or build impact (see **[`AGENTS.md`](AGENTS.md)** and **`.cursor/rules/changelog.mdc`**).
- Use **Added** / **Changed** / **Fixed** / **Removed** / **Security** subsections under `[Unreleased]` as appropriate.
- On release, move `[Unreleased]` content under a new **`## [x.y.z] — YYYY-MM-DD`** heading and start a fresh `[Unreleased]`.
- **Git:** Commit **each logical unit** as you go (see **`docs/DEVELOPMENT.md`** and **`.cursor/rules/git-commits.mdc`**), not one bulk commit at the end of a session.
