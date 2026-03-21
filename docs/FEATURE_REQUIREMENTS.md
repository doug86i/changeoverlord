# Changeoverlord — feature requirements for completion

**Audience:** Product owner, contributors, AI agents.
**Method:** Analysis of the full codebase (every page, component, data model, API route) combined with competitive research across Shoflo, Flowstage, Patchify, SoundBase, StageOn, Stage Portal, RoadOps, and Crescat.
**Lens:** Ease of use for **stage audio crew** — people working under extreme time pressure, often outdoors, on phones and tablets, with unreliable Wi-Fi.

**Related docs:** [`PLAN.md`](PLAN.md) (vision, architecture, post-MVP backlog §12, roadmap checklist §14), [`DECISIONS.md`](DECISIONS.md) (locked engineering choices), [`USER_GUIDE.md`](USER_GUIDE.md) (current operator guide).

---

## How real users actually spend their day

Before listing features, we need to think hard about who these people are, what device is in their hand, and what moment of their day they're in. Features that don't serve a real moment are wasted work.

### The patch tech / stage tech

**All weekend, one stage.** They arrive at 08:00, plug in the monitor console, and don't leave that stage until the headliner's last note at midnight. Their phone is in a back pocket. Their tablet might be on a music stand behind the drum riser.

**Their day, hour by hour:**
- **08:00–10:00 (setup):** Check the first band's rider, compare it to the patch template, update the workbook if the band has changed their lineup. They need: patch list, rider PDF, stage plot.
- **10:00–10:30 (soundcheck):** Band walks on. The tech needs the patch list on their tablet *right now* — channel 1 is kick, channel 2 is snare, etc. They're walking the stage plugging in mics. They do not want to tap Events → Festival → Main Stage → Friday → 10:00 AM Band → Patch/RF. That's five taps while holding an XLR cable.
- **10:30–10:45 (changeover):** The countdown clock is on the 32" screen at FOH. The tech glances at it to know how long until the next band. They open the next band's patch on their tablet. They might need to compare it to the current band's patch to see what changes.
- **Repeat 6–10 times per day.**

**What they need from the app:**
- A way to land on *their stage, today* with one tap — not navigate through Events every time.
- Jump between bands within their stage-day without leaving the patch view.
- See the rider/plot alongside the patch list.
- Know what time it is and how long until the next changeover.
- Rarely (maybe never) visit the Events page after initial setup.

### The FOH engineer

**Sits at the mix position all day.** Has a laptop open on the console. Looks at the patch list on screen 2 while mixing on screen 1. Needs keyboard shortcuts because their hands are on faders, not a mouse.

**What they need:**
- The patch workbook open full-screen on a second monitor.
- Prev/next band navigation without leaving the patch view.
- A read-only clock/countdown visible somewhere (maybe a small widget, not a separate page).
- To know if a stage tech just changed something in the patch ("channel 15 was moved").

### The RF coordinator

**Moves between stages.** Checks RF assignments on a tablet. Needs to see all RF sheets across performances quickly. May coordinate frequencies across stages.

**What they need:**
- Quick access to the RF sheet (second tab in each band's workbook).
- Ideally a consolidated RF view across all bands on a day.
- The ability to jump between stages without drilling through Events each time.

### The production / stage manager

**Roams the site.** Phone in hand. Needs to know: what's happening now across all stages, is anything running late, who's next.

**What they need:**
- A dashboard showing now/next for every stage (currently doesn't exist).
- The clock page to be useful *without* first navigating to a specific stage-day (currently the Clock page is just a clock with no schedule context).
- Quick status: are we on time?

### The system engineer (pre-show)

**Sits in an office or at the advance desk.** Sets up the event structure, uploads templates, imports riders. Uses a laptop.

**What they need:**
- The current CRUD flow is fine for them.
- Bulk operations: add multiple days at once (a three-day festival shouldn't require three separate "add day" clicks).
- Duplicate a day's running order to another day (Saturday often mirrors Friday).

---

## Current navigation problems (from the code)

Walking through the actual code reveals specific friction:

1. **No "home stage" concept.** Every session starts at `/` (Events list). A patch tech on the Main Stage on Saturday has to tap: Events → "Reading Festival" → "Main Stage" → "2026-06-20" → then find their band. That's 4 taps minimum before any useful information appears.

2. **No way back to the running order from the patch view without the browser back button.** The patch page breadcrumb goes Event / Stage / Day / Band, but there's no prev/next band navigation. To switch bands, you go back to the stage-day page and pick another one.

3. **The Clock page (`/clock`) is a dead end.** It shows the server time and says "open a day from an event → stage → day, then use Open stage clock." It doesn't help users get to a stage clock — it makes them navigate away and come back.

4. **No search anywhere.** If you know the band name ("Architects") but not which day or stage they're on, you have to click through every stage-day manually.

5. **No inline editing of performances.** You can add performances to a day but there's no way to edit a band name, change a time, reorder, or delete a performance from the UI. (The API likely supports PATCH/DELETE but the UI doesn't expose it.)

6. **No changeover duration shown.** The stage-day page lists bands with start/end times but doesn't show the gap between acts — the changeover duration is the most critical number for the crew.

7. **No confirmation on destructive actions** except template delete (which uses `window.confirm`). Events, stages, days, and performances have no delete UI at all.

8. **The patch page has no connection to the running order.** Once you're editing a patch, you're isolated from the schedule. There's no "this band is on in 45 minutes" or "next band" or "prev band" context.

---

## 1. "My stage today" — fast context switching (critical)

This is the single most impactful change for daily usability.

### The problem
Every crew member is assigned to a stage. They work that stage all day (or all weekend). The Events list is for the system engineer who set things up last Tuesday. For everyone else, it's an obstacle.

### Requirements

| ID | Feature | Priority |
|----|---------|----------|
| H-1 | **"Last visited" memory** — reopen the app to the stage-day you were last viewing (localStorage), not the Events list | Must |
| H-2 | **Stage-day quick picker in the header** — dropdown or sidebar showing all stages and their days for the current event, accessible from any page | Must |
| H-3 | **Direct-link URLs** — the URL `/stage-days/:id` already works; ensure crew can bookmark "my stage today" and share it (it does, but the app should encourage this) | Already works |
| H-4 | **"My stage" header display** — when viewing a stage-day or any child page (patch, files, clock), show the stage name and day prominently in the header/nav, not just in breadcrumbs | Should |
| H-5 | **Skip the events page for single-event deployments** — if there's only one event, bypass the event list entirely and go straight to the stage list | Should |

---

## 2. Band-to-band navigation within the patch view (critical)

### The problem
The patch page (`/patch/:performanceId`) is isolated. To switch to the next band's patch, the tech must: click the "Day" breadcrumb → find the next band in the list → click "Patch / RF". That's three clicks during an 8-minute changeover when they should be plugging in microphones.

### Requirements

| ID | Feature | Priority |
|----|---------|----------|
| N-1 | **Prev/next band buttons in the patch view** — arrows at the top of the patch page to go to the previous or next performance in today's running order | Must |
| N-2 | **Band dropdown/jump list in the patch view** — quick picker showing all bands for this stage-day, with the current one highlighted | Must |
| N-3 | **"Current band" auto-highlight** — based on server time, indicate which band is on stage now (or about to be) | Should |
| N-4 | **Keyboard shortcuts in patch view** — `Alt+Left`/`Alt+Right` for prev/next band (plain arrow keys must stay for spreadsheet cell navigation) | Should |
| N-5 | **Mini clock in patch view** — small current time + countdown to next changeover visible in the patch page header, so the tech doesn't need a separate clock tab | Should |
| N-6 | **Same navigation in the Files page** — the PerformanceFilesPage is equally isolated; add the same prev/next/jump controls | Should |

---

## 3. Running order UX on the stage-day page (critical)

### The problem
The stage-day page is the "home screen" during a show day, but it's currently add-only. You can't edit, delete, or reorder performances. You can't see changeover durations. There's no visual indication of what's happening now.

### Requirements

| ID | Feature | Priority |
|----|---------|----------|
| S-1 | **Now/next indicator** — highlight the current performance (based on server time) and show which is next, with a countdown | Must |
| S-2 | **Changeover duration display** — show the gap between each act (e.g. "15 min changeover") calculated from end of one act to start of the next | Must |
| S-3 | **Inline editing of performances** — click a band name to rename, click a time to change it; no separate edit page | Must |
| S-4 | **Delete performance** — with confirmation dialog | Must |
| S-5 | **Drag-and-drop reordering** — or at minimum up/down arrow buttons to reorder performances | Must |
| S-6 | **Colour-coded time status** — green (on schedule), amber (tight changeover, less than planned), red (overrunning) | Should |
| S-7 | **Performance notes visible inline** — expandable notes section per performance, visible without navigation | Should |
| S-8 | **Duplicate performance** — copy a slot to quickly create similar entries | Should |
| S-9 | **Edit event, stage, day names and dates** — currently no edit UI for any of these after creation | Must |
| S-10 | **Delete event, stage, day** — with confirmation and cascade warnings ("this will delete 12 performances") | Must |
| S-11 | **Bulk day creation** — "Add days from [start] to [end]" for a multi-day festival instead of one-by-one | Should |
| S-12 | **Duplicate a day's running order** — copy Saturday's schedule to Sunday as a starting point | Should |

---

## 4. Stage clock improvements (high priority)

### The problem
The clock page (`/clock`) shows server time but doesn't connect to any schedule. The stage-day clock (`/clock/day/:id`) works but lacks production-essential features: no colour warnings, no changeover timer, no auto-advance, and no kiosk mode.

### Requirements

| ID | Feature | Priority |
|----|---------|----------|
| C-1 | **Make `/clock` useful** — show a list of stages with today's day linked to their clock, or auto-select the only stage/day if there's just one | Must |
| C-2 | **Warning colour thresholds** — configurable (default 5 min / 1 min), clock text changes green → amber → red | Must |
| C-3 | **Changeover countdown** — after a set's end time, show countdown to next act's start ("Changeover: 12:34 remaining") | Must |
| C-4 | **Auto-advance** — automatically move focus to the next band when the current set's end time passes | Must |
| C-5 | **Set duration timer** — show how long the current act has been playing ("Set time: 23:45") | Should |
| C-6 | **Message overlay** — a button to flash a short message on the clock screen ("WIND UP", "STOP", or custom text) visible to the band | Should |
| C-7 | **Kiosk / chrome-free mode** — option to hide header, footer, nav, and breadcrumbs entirely; just the clock, band name, and countdown | Should |
| C-8 | **Large-screen optimisation** — when fullscreen on a 32" display, scale text larger; current `clamp()` sizing is reasonable but could be more aggressive | Should |

---

## 5. Responsive layouts (critical — currently desktop-only)

### The problem
Every page uses a desktop layout. The running order form uses `grid-template-columns: 1fr 1fr 1fr auto` which breaks badly on a phone. The nav has no mobile treatment. The patch spreadsheet is desktop-only by nature, but the schedule and clock pages have no excuse not to work on phones.

### Requirements

| ID | Feature | Priority |
|----|---------|----------|
| R-1 | **Three layout breakpoints** — large (desktop ≥1024px), medium (tablet 768–1023px), small (phone <768px) | Must |
| R-2 | **Touch-friendly tap targets** — buttons already have `min-height: 44px` in CSS (good); ensure all interactive list items do too | Must |
| R-3 | **Collapsible navigation** — hamburger menu on tablet/phone; current horizontal nav wraps awkwardly | Must |
| R-4 | **Stage-day page on phone** — stack the "add performance" form vertically; performance list should be full-width cards | Must |
| R-5 | **Clock on phone** — already uses `clamp()` for sizing (good); ensure fullscreen works on mobile browsers | Should |
| R-6 | **Patch view on tablet** — horizontal scroll with frozen first column; toolbar may need to collapse | Should |
| R-7 | **Patch view on phone** — read-only card layout showing channel, instrument, mic in a list format (not the full spreadsheet) | Could |
| R-8 | **Settings page on phone** — template list buttons should stack or use a dropdown menu per template | Should |

---

## 6. Search (high priority)

### The problem
There is no search anywhere in the app. A crew member who knows the band name "Architects" but not which stage or day they're on has to click through every stage-day listing manually. At a multi-stage festival with 100+ performances across four days, this is untenable.

### Requirements

| ID | Feature | Priority |
|----|---------|----------|
| Q-1 | **Global search** — search bar in the header; searches band names, event names, stage names across the whole database | Must |
| Q-2 | **Search results link directly** — clicking a result goes to the stage-day page with that performance highlighted, or directly to their patch | Must |
| Q-3 | **Keyboard trigger** — `/` or `Ctrl+K` to focus the search bar from any page | Should |
| Q-4 | **Search within patch view** — find text within the spreadsheet (FortuneSheet may have this built in) | Should |

---

## 7. Export / import event packages (high priority — not started)

### The problem
Core workflow in the plan: prep on a laptop at the office, transfer to the live server at the festival via USB stick. Without this, everything must be re-entered on-site or the prep laptop must physically travel to the venue.

(Detailed requirements in [`PLAN.md`](PLAN.md) §6.2.)

### Requirements

| ID | Feature | Priority |
|----|---------|----------|
| E-1 | **Export event** — download a `.zip` containing all stages, days, performances, patch templates, Yjs snapshots, uploaded files, and a manifest | Must |
| E-2 | **Export stage** — download a single stage with all its days | Must |
| E-3 | **Export stage-day** — download a single day | Should |
| E-4 | **Import** — upload a `.zip` on another instance; always creates new records (no silent overwrite) | Must |
| E-5 | **Import preview** — show what will be created before importing (event name, number of stages/days/performances) | Must |
| E-6 | **Schema versioning** — export format includes version so older packages can be migrated or rejected clearly | Must |
| E-7 | **Progress indicator** — show progress for large imports/exports | Should |

---

## 8. PDF and rider workflow improvements (medium priority — partially done)

### The problem
PDFs upload and page extraction works, but the page picker requires typing a number (which page?) without seeing the pages. The rider lives on a separate page from the patch view — the tech has to switch tabs to compare.

### Requirements

| ID | Feature | Priority |
|----|---------|----------|
| F-1 | **PDF thumbnail page picker** — render page thumbnails so users can visually select the stage plot page to extract | Must |
| F-2 | **Inline PDF viewer** — view a PDF within the app in a modal or panel, not a new browser tab | Should |
| F-3 | **View rider from the patch page** — a "Rider / Plot" button in the patch view that opens the performance's (or stage's) attached PDF in a sidebar or overlay | Should |
| F-4 | **Image upload support** — accept JPG/PNG stage plots directly (currently limited to PDF and document types on the server; the `accept` attribute includes `image/*` but verify server-side handling) | Should |
| F-5 | **Drag-and-drop upload** — drop a file onto the upload area instead of using the file picker | Could |

---

## 9. Data safety and editing (must-have)

### The problem
There is currently no way to edit or delete events, stages, or days from the UI after creation. Performance editing is also missing. There are no confirmation dialogs for destructive operations (except template delete). One misclick can lose work.

### Requirements

| ID | Feature | Priority |
|----|---------|----------|
| D-1 | **Confirmation dialogs on all deletes** — events, stages, days, performances, files, templates; show what will be lost ("This stage has 3 days and 18 performances") | Must |
| D-2 | **Edit all entities** — rename events, change dates, rename stages, change day dates | Must |
| D-3 | **Delete all entities** — with cascade warnings | Must |
| D-4 | **Undo toast** — after delete, show a brief "Undo" toast (soft delete + timer before permanent removal) | Could |
| D-5 | **Unsaved changes warning** — if the user navigates away from a patch with unsynced changes, warn before leaving | Should |

---

## 10. Onboarding and empty states (medium priority)

### The problem
The app opens to an empty Events list. The Clock page tells you to navigate somewhere else. Empty lists say "No X yet." — technically accurate but unhelpful. A new user doesn't know the data model (events contain stages which contain days which contain performances).

### Requirements

| ID | Feature | Priority |
|----|---------|----------|
| O-1 | **Empty state with illustrated guidance** — "Create your first event to get started. An event is a festival, tour, or gig. You'll add stages and days inside it." with a prominent button | Must |
| O-2 | **First-run wizard** (optional) — "Set up your first show" → event name + dates → add a stage → pick a template → add day → done. Skip button for experienced users. | Should |
| O-3 | **Password setup prompt** — on first visit when no password is set, show a dismissible banner: "No password set — anyone on this network can access the app. Set one in Settings if needed." | Should |
| O-4 | **Empty states on every page** — stage has no days ("Add a day to start building the running order"), day has no performances ("Add your first act — tip: you can import a template for their patch list"), etc. | Must |
| O-5 | **Help text on complex features** — the template picker, PDF extract, and clock fullscreen could each benefit from a one-line explanation the first time they're used | Should |

---

## 11. Collaboration awareness (medium priority)

### The problem
The Yjs engine enables real-time collaboration, and the connection status shows "Live (Yjs)" / "Syncing..." / "Error". But there's no indication of *who else* is looking at the same workbook or what they changed. In a live show, a tech might edit channel 15 and the FOH engineer needs to know it changed.

### Requirements

| ID | Feature | Priority |
|----|---------|----------|
| A-1 | **Active users count** — "2 people editing" indicator on the patch page | Should |
| A-2 | **Change highlighting** — briefly flash/highlight cells that were changed by another user | Should |
| A-3 | **Connection status improvements** — show reconnecting state more visibly; currently "Syncing..." covers both initial load and reconnection; distinguish between them | Should |
| A-4 | **Connection lost banner** — full-width warning bar when WebSocket or SSE is disconnected (currently only shown as small muted text on the patch page; other pages show nothing when SSE drops) | Must |

---

## 12. Client branding (low priority — partially done)

DHSL footer is in place. Client logo is pending.

| ID | Feature | Priority |
|----|---------|----------|
| B-1 | **Client logo upload** in Settings — PNG or SVG, displayed in the header next to "Changeoverlord" | Must |
| B-2 | **Logo safe-area preview** — show how it will look before saving | Should |
| B-3 | **Per-event logo** — optional; different festivals may have different clients | Could |

---

## 13. Print and PDF export (deferred — post-MVP per PLAN.md §12)

### Why it still matters
Even in 2026, stage managers print the day sheet. The monitor engineer tapes a patch list to the console. Having a "Print day sheet" button that produces a clean PDF of the running order and/or patch list is a competitive advantage over "screenshot the screen."

| ID | Feature | Priority |
|----|---------|----------|
| PR-1 | **Print day sheet** — one-click printable running order (times, bands, changeover durations) | Post-MVP |
| PR-2 | **Print patch list** — printable version of the patch workbook, formatted for paper | Post-MVP |
| PR-3 | **Export patch as Excel** — download a `.xlsx` of a performance's current patch workbook (reverse of import) | Post-MVP |

---

## 14. Multi-stage overview (production manager view)

### The problem
A production manager needs to see all stages at a glance. Currently you can only view one stage-day at a time. Competitors like Crescat show a multi-stage timeline; Shoflo shows a multi-rundown dashboard.

| ID | Feature | Priority |
|----|---------|----------|
| M-1 | **Event dashboard** — when opening an event, show a summary: each stage with its current/next band and changeover status for today | Should |
| M-2 | **Multi-stage clock** — a single clock page showing now/next for all stages side by side | Could |

---

## 15. Keyboard shortcuts and efficiency (medium priority)

| ID | Feature | Priority |
|----|---------|----------|
| K-1 | **Shortcut help** — `?` key shows an overlay of all available shortcuts | Should |
| K-2 | **Global shortcuts** — `/` for search, `C` for clock (from non-input context) | Should |
| K-3 | **Clock view shortcuts** — Left/Right for prev/next (already implemented), `F` for fullscreen (already implemented) | Done |
| K-4 | **Patch view shortcuts** — `Alt+Left`/`Alt+Right` for prev/next band (see N-4); ensure FortuneSheet's built-in shortcuts work correctly | Should |

---

## 16. Offline resilience and connection handling (medium priority)

The app runs on a LAN, but Wi-Fi at festivals drops constantly — a tablet on stage side loses signal when the crowd packs in, when generators cause interference, or simply when the tech walks behind a speaker stack.

| ID | Feature | Priority |
|----|---------|----------|
| W-1 | **Visible connection status on every page** — not just the patch view; a persistent indicator in the header showing "Connected" / "Reconnecting..." / "Offline" | Must |
| W-2 | **Graceful degradation** — show last-known data when offline instead of error states; mark stale data as potentially outdated | Should |
| W-3 | **Auto-reconnect for SSE** — the EventSource in `RealtimeSync.tsx` may reconnect on its own (browser behaviour), but there's no user-facing indication or manual reconnect button | Should |
| W-4 | **PWA / service worker** — cache the app shell so the SPA loads even if the server is momentarily unreachable | Could (PLAN.md §12 backlog) |

---

## 17. Accessibility (ongoing)

| ID | Feature | Priority |
|----|---------|----------|
| X-1 | **Colour contrast** — verify WCAG AA for both themes; `--color-text-muted` (#6b7280 on #f4f5f7) may be borderline | Must |
| X-2 | **Focus management** — `:focus-visible` is styled (good); verify tab order makes sense, especially in modals and the patch view | Must |
| X-3 | **ARIA labels** — icon-only buttons (theme toggle says "Light"/"Dark" which is good; verify others), clock display, spreadsheet | Should |
| X-4 | **Reduced motion** — respect `prefers-reduced-motion` for any transitions or animations | Should |
| X-5 | **Skip to content link** — useful for keyboard users navigating past the header | Should |

---

## 18. Minor UX polish (medium priority)

Issues noticed during code review:

| ID | Feature | Priority |
|----|---------|----------|
| U-1 | **Breadcrumbs say "Event" not the event name** — the patch page breadcrumb shows `Event / Stage Name / Day / Band` but the first segment is always the generic word "Event", not "Reading Festival" | Should |
| U-2 | **Performance times should show duration** — "14:00 – 14:45 (45 min)" rather than just "14:00 – 14:45" | Should |
| U-3 | **Stage-day page title** — currently says "Running order" for every day; should include the stage name and date: "Main Stage — Fri 20 Jun" | Should |
| U-4 | **Clock Day page title** — should show stage name, not just breadcrumbs | Should |
| U-5 | **Loading states** — the brief "Loading..." text is fine but a skeleton loader for the running order and patch view would feel more responsive | Could |
| U-6 | **Error messages** — API errors are shown as raw text; format them more helpfully ("Could not save — the server may be unreachable") | Should |
| U-7 | **Consistent date formatting** — dates show as ISO "2026-06-20"; use locale-friendly formatting ("Fri 20 Jun 2026" or "Jun 20") | Should |
| U-8 | **Theme toggle** — the button says "Light" / "Dark" as text; an icon (sun/moon) would be more compact and recognisable | Could |
| U-9 | **Sort order for stages** — stages list shows in database order; should be alphabetical or user-sortable | Should |
| U-10 | **Sort order for events** — events should sort newest first (by start date), not by creation order | Should |

---

## Priority summary

### Tier 1: Must-have for a usable product (blocks real-world use)

These are the features without which a real stage crew would abandon the app and go back to a shared Google Sheet:

1. **"My stage today" fast access** (H-1, H-2, H-5) — crew can't click through Events every time
2. **Band-to-band navigation in the patch view** (N-1, N-2) — switching bands during changeover must be instant
3. **Edit/delete performances** (S-3, S-4, S-5, S-9, S-10) — the app is add-only right now
4. **Changeover duration display** (S-2) — this is literally what the app is named after
5. **Now/next indicator** (S-1) — crew need to see where they are in the day
6. **Connection status everywhere** (A-4, W-1) — crew must know if their data is live
7. **Search** (Q-1, Q-2) — finding a band across 100+ performances
8. **Confirmation dialogs** (D-1) — prevent accidental data loss
9. **Responsive layouts** (R-1, R-2, R-3, R-4) — the app must work on tablets at minimum
10. **Clock improvements** (C-1, C-2, C-3, C-4) — the clock must run a real show
11. **Export/import** (E-1, E-2, E-4, E-5, E-6) — the prep-to-venue workflow
12. **PDF thumbnails** (F-1) — page picker is unusable without visual preview
13. **Empty state guidance** (O-1, O-4) — first-time users must not be lost

### Tier 2: Should-have for a polished product

- Mini clock in patch view (N-5), time status colours (S-6), performance notes inline (S-7)
- Bulk day creation (S-11), duplicate day/performance (S-8, S-12)
- Clock warnings (C-2 detail), kiosk mode (C-7), set duration (C-5), message overlay (C-6)
- Inline PDF viewer (F-2), rider from patch page (F-3), image uploads (F-4)
- First-run wizard (O-2), password banner (O-3)
- Active user count (A-1), change highlighting (A-2)
- Keyboard shortcut help (K-1), global shortcuts (K-2)
- Client logo (B-1, B-2)
- Unsaved changes warning (D-5)
- Graceful offline (W-2, W-3)
- Breadcrumb and date formatting polish (U-1–U-10)

### Tier 3: Could-have (post-v1 or nice-to-have)

- Phone-optimised patch cards (R-7), patch on phone (read-only card view)
- Multi-stage dashboard (M-1, M-2)
- Undo toast (D-4)
- Drag-and-drop file upload (F-5)
- Per-event logos (B-3)
- Print/PDF export (PR-1, PR-2, PR-3)
- PWA/service worker (W-4)
- Loading skeleton animations (U-5), theme toggle icon (U-8)

---

## Competitive landscape

| Product | What they do well | What they lack (Changeoverlord's gap to fill) |
|---------|------------------|-----------------------------------------------|
| **Shoflo** (Lasso) | Real-time collaborative rundown; prompter view; automatic time recalculation; guest pass sharing | Cloud-only (no offline LAN); no audio patch list; no RF sheet; no stage clock; enterprise pricing |
| **Flowstage** | Audio-specific patch planning; visual signal flow; RF pairing; QR code sharing of patch lists | Cloud SaaS; no schedule or changeover management; no stage clock; no collaboration on the same patch |
| **Patchify** | 4,500+ equipment database; auto-generated patch lists from signal flow diagrams; rack layouts | Subscription ($11–188/mo); no live changeover workflow; no real-time collaboration; desktop-focused |
| **SoundBase** | Role-based apps (different tools for FOH, monitors, RF, intercom); frequency coordination with scan data; offline desktop app | Complex multi-app ecosystem; subscription; no stage schedule; no changeover management |
| **StageOn** | Free; instant drag-and-drop stage plot creation; auto-routing; PDF export; works in any browser | Stage plots only; no patch list management; no changeover clock; no real-time collaboration |
| **Stage Portal** | Single source of truth for artists, venues, and crew; standardised rider collection; booking management | Focused on advancing/booking, not live changeover ops; cloud-only; no collaborative patch list |
| **RoadOps** | Mobile-native; offline editing with sync; activity feed; push notifications with read receipts | Tour/artist focused; no audio patch list; no RF coordination; no spreadsheet collaboration |
| **Crescat** | Multi-stage drag-and-drop scheduler; volunteer management; accreditation; comprehensive festival platform | Enterprise pricing; too heavy for one stage crew; no patch/RF; no stage clock |

**Changeoverlord's unique position:** The only tool combining **changeover-specific scheduling** + **collaborative patch/RF spreadsheets** + **stage clocks** + **offline LAN operation** in a single free, self-hosted package aimed at the **stage audio crew** — not the festival organisation, not the booking agent, not the artist.

---

## Maintaining this doc

- Update when features are implemented or priorities change.
- Cross-reference with [`PLAN.md`](PLAN.md) §12 (post-MVP backlog) and §14 (roadmap checklist) — this document adds user-journey depth and competitive context to the feature list there; avoid duplicating the same status tracking in both places.
- When a Tier 1 item is completed, update [`USER_GUIDE.md`](USER_GUIDE.md) in the same change.
