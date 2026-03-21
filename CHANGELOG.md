# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) where version tags are used.

## [Unreleased]

### Fixed

- **API — patch workbooks:** **`GET …/sheets-export`** (templates and performances) now rebuilds **`Sheet[]`** by **replaying the full persisted Yjs `opLog`** through FortuneSheet’s **`opToPatch`** and **Immer `applyPatches`** (same idea as the browser **`Workbook.applyOp`**). Previously the server only read the last **`replace luckysheetfile`** batch, so **Export JSON** matched the **upload**, not edits saved in the template editor or patch page.

- **Web — patch / template workbook:** After the initial **Yjs opLog** replay, the grid runs **`calculateFormula`** twice (covers cross-sheet dependency order). **Imported** or **synced** workbooks with cross-sheet formulas (e.g. **SatBox** labels reading **Channel List**) now show evaluated values instead of staying stale. **`onOp`** is ignored during that pass so formula value patches are **not** appended to **Yjs**.

- **API — patch templates:** **Replace** (multipart) now accepts **FortuneSheet JSON** when the browser sends **`text/plain`** or omits a **`.json`** filename — content sniffing plus storing **`.json`** on disk when the body looks like workbook JSON (avoids saving JSON under a **`.xlsx`** key). **Replace** also persists via **`workbookSnapshotBufferForPersist`** so an open **template editor** collab session picks up the new sheets.

- **API — build:** `yjs-collab-replace` imports **`@y/websocket-server/utils`** without the **`.js`** suffix so **TypeScript** resolves the module the same way as **`collab-ws.ts`** (Docker **`npm run build -w api`**).

- **API — patch templates:** Normalizing imported sheets now **fills `mc.r` / `mc.c`** on merge-master cells when only **`rs`/`cs`** were present (common in JSON exports), and **coerces numeric `tb` to string** so FortuneSheet’s text-wrap checks match. Fixes template **Edit spreadsheet** crashes / errors for those workbooks; **re-upload or Replace** an affected template to refresh the stored snapshot.

### Changed

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
- **Domain features:** Patch template library (upload OOXML Excel, presets, stage defaults), file attachments with PDF viewer and page extract, global search, event JSON export/import, performance overlap hints, swap/shift scheduling, stage clocks (including distance/fullscreen/kiosk-style views), “My stage today”, keyboard shortcuts, connection status banner, offline-first TanStack network mode.
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
