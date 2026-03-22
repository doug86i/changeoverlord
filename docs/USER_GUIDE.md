# Changeoverlord — user guide

**Audience:** operators and crew using the app at a show or in prep (not developers).  
**Deploy and hosting:** see the root **[`README.md`](../README.md)**.

Changeoverlord helps festival **sound crew** run **multi-day schedules**, **changeovers**, **riders** / **plots**, **collaborative input patch and RF** spreadsheets, and **stage clocks**. It is built for **LAN use** (often **offline** at the venue).

---

## Signing in

- If an administrator has set a **shared password** in **Settings**, browsers must sign in once; the session lasts about a week.
- If **no password** is set, the app is open on the LAN (still treat the network as trusted).
- Too many failed sign-in attempts from one device in a short window show **Too many attempts, try again in 5 minutes.** (this limits password guessing).

---

## Main navigation

| Area | What it's for |
|------|----------------|
| **Events** | List and open **events** (festivals, tours, etc.). |
| **Clock** | **Stage clocks** — now/next and fullscreen display for a stage day. |
| **Settings** | Shared password, **global patch / RF templates**, and other app options. |

The header links **Events**, **Clock**, and **Settings** on every screen. On **mobile**, tap the **hamburger menu** (☰) to expand the navigation.

### Quick access

- **Search** — Press **`/`** or **`Ctrl+K`** (or tap the 🔍 icon) to open the **search dialog**. Search by band name, event, or stage; results link directly to the relevant page.
- **My stage today** — In the header, **My stage today** opens **today’s** stage-day **running order** (same screen as drilling in from Events → Stage → Day). It uses the **server date** and, when it matches, your **last visited** stage-day. If several stages have a day today, you’re sent to **Clock** to pick one. Shortcut: **`g`** then **`m`**.
- **Keyboard shortcuts** — Press **`?`** to see all shortcuts (e.g. `g e` = Events, `g m` = My stage today, `g c` = Clock).
- **Last visited stage-day** — The app remembers your last visited stage-day in the browser (for **My stage today** when that day is today).

### If the page crashes

You may see **Something went wrong** with a **Reload** button — use it to recover. Operators normally **screenshot** that screen and share **when** it happened; **server logs** carry the technical detail. A **Copy technical details** control appears only in **developer** builds (not typical show laptops).

### Connection status

A **banner** appears at the top of the screen when the connection to the server is lost:
- **Yellow "Reconnecting"** — the browser is trying to restore the live connection.
- **Red "Connection lost"** — data on screen may be outdated; edits will sync when the connection returns.

---

## Schedule workflow (events → stages → days → performances)

1. **Events** — Create or open an **event** (one location; times are **local event time**). You can **edit** or **delete** events using the ✎ and ✕ buttons. With **many** events, use **Load more** at the bottom of the list to fetch the next page.
2. **Stages** — Inside an event, add **stages** (e.g. Main, Second). Stages are editable and deletable inline.
3. **Stage days** — For each stage, add **days** (individual dates or **bulk add** from a date range). Days can be deleted.
4. **Performances** — On a **stage day**, add **performances** (bands/slots) with **start**, **end** (either as a clock time or as **set length** in minutes), plus notes. Every slot has a finite end.

### Performance management

**Adding performances** — In **Add performance**, choose **End time** or **Set length**:
- **End time** — End must be **after** start (same as editing a row).
- **Set length** — Enter the slot length in **minutes**; the app stores it as an end time (start + length). Switching between **End time** and **Set length** keeps the **same duration** where possible.
- **Defaults** — First act on an empty day: **1 hour** slot and **30 minutes** changeover. After each **Add**, the next row suggests the **same length** as the act you just added, and **changeover** only affects the gap before that next start (not saved on the performance).
- **Changeover (min)** — Not saved on the performance. After **Add**, the next **Start** is this act’s **end + changeover**.
- **Enter** — In **Band / act**, **Enter** submits **Add** (same as the button).
- **Band / act name** — If you leave it blank or only spaces, the app saves **Untitled act** (keeps exports, duplicates, and patch pages consistent).
- **Multi-user** — If someone else adds an act on another machine, the **next suggested start / end / length** updates to match the new last slot (same rules as after your own **Add**).

On the **stage day page**, each performance supports:
- **Inline editing** — Click band name, start time, or end time to edit in place.
- **Notes** — Expand the notes section to add/edit notes for each act. When an act **has notes**, a **Note** badge appears next to the band name and the **Notes** button is highlighted so you can see it without opening the section (hover the badge for a text preview).
- **Duplicate** — Adds a copy **after the last act** (with spacing so times do not overlap). If more than one act is listed, the **last** act must have an **end time** first. The copy uses the same duration as the original when possible.
- **Delete** — Remove with confirmation.
- **Duration display** — Shows calculated duration (e.g. "45 min") and changeover time between acts.
- **Now/Next indicators** — Green "ON STAGE" and amber "NEXT" badges based on server-synced time.
- **Time colours** — As an act's remaining time runs low, the duration displays in green → amber → red.
- **Print** — Click 🖨 to print a clean running order table.

### Export and import

- **Export** — From an event's detail page, click **Export event** to download a JSON package of all stages, days, performances, and per-performance workbook **`sheets`** (FortuneSheet JSON). Packages use **`version`: 2**; older exports with base64 Yjs snapshots are not imported by current builds.
- **Import** — On the Events page, click **Import event** to load a previously exported package. The import creates a new event (with " (imported)" suffix).

Typical URL shape as you drill in: `/events/:eventId` → `/stages/:stageId` → `/stage-days/:stageDayId`.

**Live updates:** when someone else on the LAN changes the schedule, lists usually refresh automatically (server push). If something looks stale, reload the page.

### Stage and event chat

While you are inside an **event** (event detail, a **stage**, a **stage day**, **patch / RF** for a band, or **performance files**), **Chat** appears at the **bottom-right**: either a small **Chat** button (closed) or the full panel (open). It is rendered at the **top level of the page** (not inside the main content tree) and offset from the **viewport scrollbar** when one is present, so it stays usable while you scroll. It does **not** appear on **Clock** pages (including clock day URLs), so fullscreen displays stay clear.

- **Stage context** — You see messages for **that stage** plus anything sent to the **whole event**. On the **event** detail page, open **Options** and use **Stage** there to pick which thread you are viewing.
- **Sending** — **Enter** sends; **Shift+Enter** adds a new line (also noted in the message box placeholder). **Options** holds **Name**, **Stage** (when you opened the event from its detail page), and **This stage** vs **Whole event**.
- **Open / minimize** — Tap **Chat** to open the full window; **Minimize** (or **click outside** / **Escape** after closing **Options**) returns to the small **Chat** button. **New messages** open the panel and **flash until you click or focus the dock** (including the **Chat** button when it is collapsed). If you close the panel without touching the dock, the **Chat** button keeps flashing. Your own sends do not flash the dock.

Chat is meant for **short coordination** on the LAN; there is no private DM or edit/delete.

---

## Patch and RF spreadsheet (workbook)

Each **performance** can have a **patch / RF workbook** — a multi-sheet grid (e.g. **Input**, **RF**) that **multiple people can edit at once** in real time.

- Open the workbook from the **stage day** view: each performance row has a **Patch / RF** link to `/patch/:performanceId`.
- **Tablet and desktop (768px and wider):** the spreadsheet sits beside a **context sidebar** you can **Hide »** / **« Context** to collapse to a thin rail. On **tablet** the sidebar column is slightly narrower so the grid has more room.
- **Phone (narrow portrait):** the sheet is **read-only** and uses almost the full screen: a thin bar shows the **band name** and a **Menu** button. Open **Menu** for breadcrumbs, **prev/next band**, **connection status**, and the same **sidebar** content (clock, now/next, files, plot). The grid keeps **layout, conditional formatting, and formulas**; **toolbar** and **formula bar** are hidden. **Pinch-zoom** and **drag to pan** the sheet (movement matches your finger). Edits from a desktop still **update live** on the phone. When you **switch away** or the **screen turns off**, the app **disconnects** the patch sync to save battery and **reconnects** when you return.
- **Collaboration** uses a live connection to the server; keep the tab open while **editing** on desktop/tablet.

### Patch page sidebar (stay on the sheet)

On the **patch / RF** page, once the **stage day** has loaded, the **sidebar** keeps schedule, plot, and files next to the sheet.

- **Hide »** / **« Context** — Collapse or expand the sidebar; preference is remembered on this device.
- **Changeover** — Shown when the day is in a gap between acts (same condition as the stage clock).
- **Local time** → **Now** → **Countdown** → **Next** — same timing rules as the stage day clock. **Now** and **Next** band names are **links** to that act’s patch page.
- **This spreadsheet** — The act you’re editing; **Alt+←** / **Alt+→** switch acts on this day.
- **Quick links** — **All files**, **Rider PDF** when **this act’s** Files list has a file marked **Rider** (stage-wide uploads are not used here), **Stage clock**, **Running order**.
- **Stage plot** — Preview of a file marked **Stage plot** on **this act’s Files** page only. **Stage-wide** plots (uploaded under **Stage → Stage files**) are **not** shown here, so a new act does not inherit another band’s sidebar preview by mistake. Use **this act’s Files** to attach a plot for patch preview, or open **Stage files** when you need the shared plot.

The spreadsheet **toolbar, formula bar, and sheet tabs** use the app’s **sans-serif** font and theme colours; **cell selection** uses **FortuneSheet’s default** styling. **Text you type** in the active cell is shown in **high-contrast** colour so it stays readable on the edit box.

### Rows, columns, and scrolling

- The grid starts with a fixed number of **rows** and **columns**; you can **scroll** right or down to use cells beyond what fits on screen.
- To **add columns**: **right-click** a **column letter** (the header above the grid, e.g. A, B, C) and choose **Insert columns** (you can insert before or after the selection).
- To **add rows**: **right-click** a **row number** on the left and choose **Insert rows**.
- Extra toolbar actions (e.g. freeze panes) may appear under **More** on the toolbar.

### Band-to-band navigation

When viewing a patch workbook or performance files, a **navigation bar** shows:
- **← Previous** and **Next →** to jump between acts on the same day.
- A **dropdown** to jump to any act directly.
- **Alt+← / Alt+→** keyboard shortcuts for quick switching.
- On the **patch** page (tablet/desktop), **time** and **countdown** are in the **sidebar** (see above). Connection status is next to the page title; on **phone** it is inside **Menu**. Green (live), amber (syncing or **Loading workbook…** / **Loading sheet layout…** while the grid catches up), red (error or **Out of sync**). The same loading overlays can appear on **Edit spreadsheet** (library templates) — wait until they clear before editing so the sheet is not an empty placeholder. If you see **Workbook out of sync**, reload the page or switch to another band (or leave the template editor and return). If the grid shows **Something went wrong**, use **Try again** to remount the sheet without reloading the whole app (or refresh the page if it persists). **Copy technical details** on that error includes safe diagnostics for support.

**Export / import workbook JSON (this act)** — Next to the title on **tablet/desktop**, **Export JSON** downloads the current band’s spreadsheet as a JSON file (FortuneSheet-native; includes a small **`changeoverlordWorkbook`** envelope). **Import JSON** replaces this act’s workbook from a file you choose. The page **reloads** after import so everyone sees the same grid. Use this to edit in external tools, share with agents, or copy a sheet between servers. Details: **`docs/PATCH_TEMPLATE_JSON.md`**. These actions are **not** on the **phone** read-only view.

### Templates (global and stage)

Templates come in two tiers:

- **Global templates** — managed in **Settings**, available to every stage.
- **Stage templates** — created on a **stage** page, belong to that stage only. Safe to edit, rename, replace, or delete without affecting other stages.

Each stage picks one template (global or stage) as its **default for new performances**. New performances get a copy of the template **`sheets_json`** when created; existing band patch workbooks are not updated.

Adding a stage template (file upload, **Import workbook JSON**, or **Create blank template**) **selects it automatically** as that stage’s default when the upload succeeds; you can still pick another template in the dropdown.

**Creating templates**

- **Upload Excel or JSON** — Import from **Excel** (`.xlsx`, `.xltx`, macro-enabled `.xlsm` / `.xltm`, etc.) or **Google Sheets** (export to Excel-compatible format first), **or** upload **FortuneSheet-native JSON** (`.json`) to avoid Excel conversion loss (e.g. some conditional formatting). JSON shape and limits are documented in **`docs/PATCH_TEMPLATE_JSON.md`**. The server reads **cell values** (and formulas where supported); prepare anything FortuneSheet-specific in your workbook or JSON, or fix it in **Edit spreadsheet** after. **Replace** a template after changing the source file so the library snapshot matches. Starter workbooks may ship under **`examples/`** (see **`examples/README.md`**) — upload them in **Settings** to add them to your library. For a **FortuneSheet-safe** reference layout (literal **`COUNTIF`**, normalizer column, full **`calcChain`**), import **`examples/OPERATOR_PATCH_REFERENCE_v1.json`**.

- **Create blank template** — In **Settings**, add a new library entry with two empty tabs (**Input**, **RF**), then use **Edit spreadsheet** to build it. Optional **display name** applies when you use **Create blank template** (defaults to **New template** if you leave the name blank).

If the spreadsheet shows **`sheet not found`** (FortuneSheet error), the workbook usually has a **cross-sheet formula** pointing at a **missing or renamed tab**, **hidden columns** from Excel that confuse the grid (`colhidden`), or a bad import — see **`docs/PATCH_TEMPLATE_JSON.md`** § *FortuneSheet browser error: `sheet not found`* for fixes (single-sheet templates, re-import JSON, clear column hides in Excel).

**Global template actions (Settings)** — full control: **Edit spreadsheet**, **Preview**, **Edit name**, **Duplicate**, **Replace (Excel/JSON)**, **Export JSON**, **Import JSON**, **Delete**. A long library may show **Load more templates** at the bottom.

**Stage template actions (stage page)** — same full control, but scoped to this stage only.

**Global template on the stage page** — when a global template is selected as the stage default, destructive actions (rename, replace, delete, import) are hidden. Instead you can **Copy to stage template** to create a local copy, plus **Edit spreadsheet**, **Preview**, and **Export JSON**.


---

## Clock

- **Clock** in the nav opens the **last stage day you were viewing** (running order or stage-day clock), when that is known — same remembered day as **My stage today** uses. Otherwise it opens the **Clock** picker (`/clock`). The **`g c`** shortcut follows the same rule.
- On the **Clock** picker, **today’s stages** are listed when any exist for today’s date. If there’s only one today, it **auto-redirects** to that day’s clock.
- **All stage days** are listed below for quick access to any day's clock.
- The clock display shows **server-synced time** (corrected for any device clock drift).

### Stage day clock features

On a stage day clock (`/clock/day/:stageDayId`):

- **One clock face everywhere** — The **top** of the page shows the same **arena** layout performers see on a TV: band / changeover context, **hero countdown** (sized to fit the panel), **local time**, and footer metadata (stage, date, pace, slot). **Below** that, a full-width **controls** area has **urgent message**, focus card, navigation, and the **schedule** list.
- **Countdown** — The numbers **scale to fill** the available space as the label/text changes. The main readout is **minutes:seconds** (e.g. **`12:05`** = 12 minutes 5 seconds, **`90:00`** = one and a half hours). If the next relevant time is **a day or more** away, it shows **N days** instead of a huge minute count.
- **Countdown colours** (high-contrast in both light and dark theme):
  - **Green** — more than 5 minutes
  - **Amber** — 1–5 minutes
  - **Red** — under 1 minute (the **last minute flashes** red/white for visibility)
- **Auto-advance** — Focus in the **controls** area follows the current act (toggle on/off).
- **Changeover & handover (read at a distance)** — A **large banner** above the countdown makes it obvious when the **big timer is not “time left in your set”**:
  - **Changeover** — Scheduled **gap between acts** (stage empty; next act not on yet). A large **CHANGEOVER** banner appears above the countdown.
  - **Next act** (before the first act of the day) — Waiting for **show start**; same idea.
  - **Next act in** (while someone is still listed **on stage**) — The current slot has **no published end time**, so the countdown runs to the **next act’s start**. The banner states this explicitly so overrunning bands do not treat it as their own set length.
  The **patch** sidebar uses the same rules with a small **badge** (**Changeover**, **Before show**, **Next act in**). The **focus** card uses **Time left** only when the running order has an **end time** for that slot; otherwise it says **Until next act**. It can still show **changeover duration** between the previous act’s end and the focused act’s start when applicable.
- **Band navigation** — Click any band in the **schedule** list, or use **← / →** arrow keys (when not typing in a field).
- **Focus — files** — For the focused act, **Patch / RF**, **Files page**, and an expandable **Files (this act)** block match the running-order **Files** behaviour (upload, rider/plot toggles, PDF tools). Collapsed by default so the clock stays readable; use **Show (n)** to manage attachments without leaving the clock.
- **Urgent message (synced)** — In the controls section, type an **urgent message** and **Send to clocks**. It appears **on every browser** open to this **stage’s** clock: the **clock arena** (the big countdown area — **not** the controls below) pulses with a high-contrast flash behind a large, centered message, so you can still **Clear** or edit from the controls. In **fullscreen**, the arena fills the screen, so performers see the same flash edge-to-edge. **Clear** removes it for everyone. Updates use the API and **live refresh** on other browsers.
- **Fullscreen** — Press **F** or **Fullscreen** so the **clock arena** uses the whole screen (browser fullscreen); the controls below stay on the page but are hidden behind the fullscreen surface until you exit. While fullscreen is on, the footer shows **Exit fullscreen (F)** only (not both buttons). Old bookmarks with **`?kiosk=1`** are redirected to the normal clock URL (query removed).
- **End of day** — After the **last performance finishes** on that stage day, for **up to one hour** an overlay appears for the crew: it looks ahead to the **next day on this stage** and lists that day’s **lineup** (when configured). **One hour after** the last finish, the clock **automatically switches** to that next day. After the **final** day on the stage, a **thank-you** screen stays up until you navigate away. If a slot has no end time, the clock treats its end as **one hour after start** for this timing only.

---

## Files and uploads

All uploaded files (patch templates, riders, plots) live on the **server's data directory** — see **[`data/README.md`](../data/README.md)** for **backups**.

### Riders and plots (attachments)

- **Stage** — On a **stage** screen, **Stage files** starts **collapsed**; expand **Show (n)** for **stage-wide** reference uploads (not tied to a band). There are **no Rider / Stage plot toggles** on this list — use each act’s **Files** page for band riders and plots. If anything band-scoped ever appeared here, it is hidden; manage it on that act’s **Files** page.
- **Performance** — On a **stage day**, each performance row has a **Files** link. Upload files that belong to **that band only** (e.g. their rider).
- **New uploads are Other** — Everything uploads as **Other** (general attachments). There is no “upload as” step.
- **Rider and Stage plot (per file)** — On each row, use **Rider** or **Stage plot** so the patch sidebar can link the rider and show a plot preview. **Click the active choice again** to clear it back to **Other**. A file cannot be both at once.
- **One rider and one stage plot per list** — For each **stage** or **performance** file list, only **one** file can be **Rider** and only **one** can be **Stage plot** at a time. Choosing a different file for either role moves the previous one to **Other**.
- **Extract** — When you **extract a page** from a PDF, the new single-page file is saved as **Stage plot** (and follows the same “one stage plot” rule).
- **Drag and drop** — Drop files directly onto the upload zone, or click to browse.
- **View** — Open a **PDF** in an inline viewer without leaving the page.
- **Open** — Open the file in a **new browser tab** (same control style as **View** — compact **button-shaped** actions).
- **Convert to PDF** — When the button appears (images, Word/ODT/RTF, plain text), the **server** creates a **new PDF attachment** linked to the original. You can then use **Extract** on that PDF. The original file is unchanged. **WebP** and other non-JPEG/PNG images rely on server **ImageMagick** helpers (Docker includes **WebP** decode tools).
- **Extract** — For **PDFs** only: click **Extract**, then **choose a page** from the **thumbnail previews** (rendered on the server), and **Extract as new PDF** to save a **single-page** copy. The original PDF is unchanged; the extract is the **Stage plot** for that list unless you change it.
- **Delete** — Remove files with confirmation.

Maximum upload size is **100 MB** per file (see **[`DECISIONS.md`](DECISIONS.md)** for limits).

**Server validation** — The API checks that common types (PDF, images, Office docs, etc.) match their real file signatures, so renaming a random file to `.pdf` is rejected. Deployers who need **extra extensions** (e.g. proprietary desk files) can set **`RIDER_EXTRA_EXTENSIONS`** in **`.env`** (comma-separated, with or without a leading dot); those extensions are accepted without magic checks. See **`.env.example`**.

---

## Responsive layout

The app works on **desktop**, **tablet**, and **phone**:
- **Desktop** — Full layout with sidebar navigation.
- **Tablet** — Content expands to full width.
- **Phone** — Hamburger menu, stacked forms, touch-friendly targets (44px minimum).

---

## Theming

**Light / dark** mode can be toggled from the header (☀ / ☾ icon). Visual tokens are described in **[`DECISIONS.md`](DECISIONS.md)** (Visual design section).

---

## Where to read more

| Need | Document |
|------|----------|
| Install & Docker | **[`README.md`](../README.md)** |
| Product vision & roadmap | **[`ROADMAP.md`](ROADMAP.md)** |
| Engineering behaviour (API, limits) | **[`DECISIONS.md`](DECISIONS.md)** |

If something in this guide doesn't match the app, the app wins — please report or fix the doc (see the documentation maintenance section in **[`DEVELOPMENT.md`](DEVELOPMENT.md)**).
