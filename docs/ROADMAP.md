# Roadmap

Product vision, user personas, feature status, and what comes next.

**Audience:** Product owner, contributors, AI agents.

---

## Product identity

| | |
|--|--|
| **Name** | **Changeoverlord** (stage-audio focused; distinct from generic "changeover" hospitality apps) |
| **Repository** | [github.com/doug86i/changeoverlord](https://github.com/doug86i/changeoverlord) |
| **Container image** | `ghcr.io/doug86i/changeoverlord/app` (tags: `latest`, semver on release) |

---

## Goals

| Area | Direction |
|------|-----------|
| **Connectivity** | **v1**: DHSL staff, offline-only use (private LAN; no internet assumed at runtime). Same stack can be hosted online behind HTTPS later. |
| **Ease of deploy** | Non-IT staff: `docker compose up` with sensible defaults; optional `.env` only for infrastructure. |
| **Config split** | Infrastructure (paths, ports, image tag) in Compose / `.env`. Product behaviour (auth, schedule times, riders, patch data) in the app UI. |
| **Clients** | One responsive web app: desktop (incl. 32" touch), tablet, mobile — layouts tuned per form factor. |
| **Domain** | Event → Stage(s) → Day schedule(s) → Performance(s) with times, changeovers, uploads, collaborative patch/RF from stage-level default templates. |
| **Collaboration** | Real-time shared spreadsheet (cell grid, multi-sheet) for input list + RF. |
| **Media** | Upload riders and plots; pick a PDF page to extract when the plot is inside a multi-page rider. |
| **Clock** | Server time + countdown to next performance/changeover; fullscreen clock for stage displays. |
| **Branding** | Client/event logo configurable in-app; fixed "Powered by Doug Hunt Sound & Light" footer. |
| **Prep off-site** | Events can be prepared on another machine and moved to the live show server via downloadable packages. |

---

## How real users spend their day

Features that don't serve a real moment are wasted work.

### The patch tech / stage tech

**All weekend, one stage.** They arrive at 08:00, plug in the monitor console, and don't leave that stage until the headliner's last note at midnight. Their phone is in a back pocket. Their tablet might be on a music stand behind the drum riser.

**Their day, hour by hour:**
- **08:00–10:00 (setup):** Check the first band's rider, compare it to the patch template, update the workbook if the band has changed their lineup. They need: patch list, rider PDF, stage plot.
- **10:00–10:30 (soundcheck):** Band walks on. The tech needs the patch list on their tablet *right now* — channel 1 is kick, channel 2 is snare, etc. They're walking the stage plugging in mics. They do not want to tap Events → Festival → Main Stage → Friday → 10:00 AM Band → Patch/RF. That's five taps while holding an XLR cable.
- **10:30–10:45 (changeover):** The countdown clock is on the 32" screen at FOH. The tech glances at it to know how long until the next band. They open the next band's patch on their tablet. They might need to compare it to the current band's patch to see what changes.
- **Repeat 6–10 times per day.**

**What they need:**
- Land on *their stage, today* with one tap — not navigate through Events every time.
- Jump between bands within their stage-day without leaving the patch view.
- See the rider/plot alongside the patch list.
- Know what time it is and how long until the next changeover.

### The FOH engineer

**Sits at the mix position all day.** Has a laptop open on the console. Looks at the patch list on screen 2 while mixing on screen 1. Needs keyboard shortcuts because their hands are on faders, not a mouse.

**What they need:**
- The patch workbook open full-screen on a second monitor.
- Prev/next band navigation without leaving the patch view.
- A clock/countdown visible somewhere (sidebar, not a separate page).
- To know if a stage tech just changed something in the patch.

### The RF coordinator

**Moves between stages.** Checks RF assignments on a tablet. Needs to see all RF sheets across performances quickly.

**What they need:**
- Quick access to the RF sheet (second tab in each band's workbook).
- The ability to jump between stages without drilling through Events each time.

### The production / stage manager

**Roams the site.** Phone in hand. Needs to know: what's happening now across all stages, is anything running late, who's next.

**What they need:**
- A dashboard showing now/next for every stage.
- The clock page to be useful without first navigating to a specific stage-day.
- Quick status: are we on time?

### The system engineer (pre-show)

**Sits in an office or at the advance desk.** Sets up the event structure, uploads templates, imports riders. Uses a laptop.

**What they need:**
- The current CRUD flow is fine for them.
- Bulk operations: add multiple days at once.
- Duplicate a day's running order to another day (Saturday often mirrors Friday).

---

## Shipped in v1.0.0

All tier-1 features from the original requirements are implemented:

| Feature | Status |
|---------|--------|
| "My stage today" fast access + last-visited memory | **Done** |
| Band-to-band navigation in patch view (prev/next, dropdown, keyboard) | **Done** |
| Mini clock + countdown in patch sidebar | **Done** |
| Running order: inline editing, delete, now/next, changeover durations, time colours | **Done** |
| Duplicate performance, swap/shift scheduling | **Done** |
| Stage clock: warning colours, changeover countdown, auto-advance, message overlay, fullscreen arena, end-of-day | **Done** |
| Global search (Ctrl+K, /) | **Done** |
| Confirmation dialogs on all deletes | **Done** |
| Responsive layouts (desktop, tablet, phone) | **Done** |
| Export/import event packages | **Done** |
| PDF thumbnails + page extract | **Done** |
| Inline PDF viewer, drag-and-drop upload, convert-to-PDF | **Done** |
| Empty state guidance | **Done** |
| Connection status banners (SSE + WebSocket) | **Done** |
| Keyboard shortcuts + help overlay (?) | **Done** |
| Offline resilience (offlineFirst, beforeunload warning) | **Done** |
| Collaborative patch/RF workbook (Yjs + FortuneSheet) | **Done** |
| Patch phone read-only view (full FortuneSheet, menu for context, visibility-aware sync) | **Done** |
| Global patch template library (Excel upload, JSON upload, presets, edit, preview) | **Done** |
| Auth (optional shared password, session cookie) | **Done** |
| DHSL footer branding | **Done** |
| Stage chat | **Done** |
| Print day sheet | **Done** |

---

## What's next

### Must-have

| ID | Feature | Notes |
|----|---------|-------|
| B-1 | **Client logo upload** in Settings — PNG or SVG, displayed in the header | Not started |
| B-2 | **Logo safe-area preview** — show how it will look before saving | |
| M-1 | **Event dashboard** — each stage with current/next band and changeover status for today | |

### Should-have

| ID | Feature | Notes |
|----|---------|-------|
| A-1 | **Active users count** — "2 people editing" on the patch page | |
| A-2 | **Change highlighting** — flash cells changed by another user | |
| B-3 | **Per-event logo** — different festivals may have different clients | |
| M-2 | **Multi-stage clock** — now/next for all stages side by side | |
| PR-2 | **Print patch list** — printable patch workbook formatted for paper | |
| PR-3 | **Export patch as Excel** — download `.xlsx` of a performance's workbook | |
| S-11 | **Bulk day creation** — "Add days from [start] to [end]" | |
| S-12 | **Duplicate a day's running order** — copy Saturday's schedule to Sunday | |
| W-4 | **PWA / service worker** — cache the app shell for faster reload on poor Wi-Fi | |

### Post-MVP ideas

| Idea | Notes |
|------|-------|
| Activity log | Append-only schedule/patch history |
| Kiosk / guest mode | Read-only URL for visiting engineers |
| Light roles | FOH / monitors / stage — same data, different default views |
| Contingency slots | TBD acts without breaking the clock |
| Stage notes | Weather / intercom / SM notes per day (not the spreadsheet) |
| Mic line / walk checklist | Optional separate from patch grid |
| QR codes on running order | Display a QR code next to each performance in the running order (stage-day view / print sheet) linking directly to that band's patch workbook — patch crew can scan with their phone camera to jump straight to the right patch without navigating the app |
| Cloud folder sync | Push/pull event packages via SeaDrive, Dropbox, Google Drive |
| Live Google Sheets sync | Optional integration when internet + OAuth are acceptable |
| In-app backup/restore | Currently relies on external backup of `DATA_DIR` |

---

## Competitive landscape

| Product | What they do well | Gap Changeoverlord fills |
|---------|-------------------|--------------------------|
| **Shoflo** (Lasso) | Real-time collaborative rundown; prompter view; automatic time recalculation; guest pass sharing | Cloud-only (no offline LAN); no audio patch list; no RF sheet; no stage clock; enterprise pricing |
| **Flowstage** | Audio-specific patch planning; visual signal flow; RF pairing; QR code sharing | Cloud SaaS; no schedule or changeover management; no stage clock; no collaboration on the same patch |
| **Patchify** | 4,500+ equipment database; auto-generated patch lists from signal flow diagrams; rack layouts | Subscription ($11–188/mo); no live changeover workflow; no real-time collaboration; desktop-focused |
| **SoundBase** | Role-based apps (FOH, monitors, RF, intercom); frequency coordination with scan data; offline desktop app | Complex multi-app ecosystem; subscription; no stage schedule; no changeover management |
| **StageOn** | Free; instant drag-and-drop stage plot creation; auto-routing; PDF export | Stage plots only; no patch list management; no changeover clock; no real-time collaboration |
| **Stage Portal** | Single source of truth for artists, venues, and crew; standardised rider collection | Focused on advancing/booking, not live changeover ops; cloud-only; no collaborative patch list |
| **RoadOps** | Mobile-native; offline editing with sync; activity feed; push notifications | Tour/artist focused; no audio patch list; no RF coordination; no spreadsheet collaboration |
| **Crescat** | Multi-stage drag-and-drop scheduler; volunteer management; accreditation | Enterprise pricing; too heavy for one stage crew; no patch/RF; no stage clock |

**Changeoverlord's position:** The only tool combining changeover-specific scheduling + collaborative patch/RF spreadsheets + stage clocks + offline LAN operation in a single free, self-hosted package aimed at the stage audio crew.

---

## Reference products (inspiration only)

| Product / area | Ideas to borrow |
|----------------|-----------------|
| [Shoflo](https://shoflo.tv/) (Lasso) | Timeline collaboration, time math, production "Docs", prompter-style focused views |
| [Stage Portal](https://stageportal.gg/) | Tech riders, run sheets, shared updates |
| [RoadOps](https://roadops.app/) | Offline-friendly flows, day sheets, activity feeds |
| Crescat / FestivalPro | Multi-day scheduling, advancing |
| Shure WWB, RF Venue, RFCoordinator | RF coordination math / scans — deep device integration is optional |

---

## Maintaining this doc

- Update when features are implemented or priorities change.
- When a feature is completed, update the [User Guide](USER_GUIDE.md) in the same change.
