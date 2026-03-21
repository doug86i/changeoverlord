# Changeoverlord — user guide

**Audience:** operators and crew using the app at a show or in prep (not developers).  
**Deploy and hosting:** see the root **[`README.md`](../README.md)**.

Changeoverlord helps festival **sound crew** run **multi-day schedules**, **changeovers**, **riders** / **plots**, **collaborative input patch and RF** spreadsheets, and **stage clocks**. It is built for **LAN use** (often **offline** at the venue).

---

## Signing in

- If an administrator has set a **shared password** in **Settings**, browsers must sign in once; the session lasts about a week.
- If **no password** is set, the app is open on the LAN (still treat the network as trusted).

---

## Main navigation

| Area | What it's for |
|------|----------------|
| **Events** | List and open **events** (festivals, tours, etc.). |
| **Clock** | **Stage clocks** — now/next and fullscreen display for a stage day. |
| **Settings** | Shared password, **patch / RF spreadsheet templates** (global library), and other app options. |

The header links **Events**, **Clock**, and **Settings** on every screen. On **mobile**, tap the **hamburger menu** (☰) to expand the navigation.

### Quick access

- **Search** — Press **`/`** or **`Ctrl+K`** (or tap the 🔍 icon) to open the **search dialog**. Search by band name, event, or stage; results link directly to the relevant page.
- **My stage today** — In the header, **My stage today** opens **today’s** stage-day **running order** (same screen as drilling in from Events → Stage → Day). It uses the **server date** and, when it matches, your **last visited** stage-day. If several stages have a day today, you’re sent to **Clock** to pick one. Shortcut: **`g`** then **`m`**.
- **Keyboard shortcuts** — Press **`?`** to see all shortcuts (e.g. `g e` = Events, `g m` = My stage today, `g c` = Clock).
- **Last visited stage-day** — The app remembers your last visited stage-day in the browser (for **My stage today** when that day is today).

### Connection status

A **banner** appears at the top of the screen when the connection to the server is lost:
- **Yellow "Reconnecting"** — the browser is trying to restore the live connection.
- **Red "Connection lost"** — data on screen may be outdated; edits will sync when the connection returns.

---

## Schedule workflow (events → stages → days → performances)

1. **Events** — Create or open an **event** (one location; times are **local event time**). You can **edit** or **delete** events using the ✎ and ✕ buttons.
2. **Stages** — Inside an event, add **stages** (e.g. Main, Second). Stages are editable and deletable inline.
3. **Stage days** — For each stage, add **days** (individual dates or **bulk add** from a date range). Days can be deleted.
4. **Performances** — On a **stage day**, add **performances** (bands/slots) with start time and either an **end time** or a **set length** (minutes), plus notes.

### Performance management

**Adding performances** — In **Add performance**, choose **End time** or **Set length**:
- **End time** — Optional end clock time (same as editing a row).
- **Set length** — Enter the slot length in **minutes**; the app stores it as an end time (start + length).
- **Changeover (min)** — Not saved. After you click **Add**, the **next** suggested **Start** time is filled as: this act’s **end** + changeover, or — if you left no end — **start + 60 minutes + changeover** (a one-hour placeholder gap).

On the **stage day page**, each performance supports:
- **Inline editing** — Click band name, start time, or end time to edit in place.
- **Notes** — Expand the notes section to add/edit notes for each act.
- **Duplicate** — Adds a copy **after the last act** (with spacing so times do not overlap). If more than one act is listed, the **last** act must have an **end time** first. The copy uses the same duration as the original when possible.
- **Delete** — Remove with confirmation.
- **Duration display** — Shows calculated duration (e.g. "45 min") and changeover time between acts.
- **Now/Next indicators** — Green "ON STAGE" and amber "NEXT" badges based on server-synced time.
- **Time colours** — As an act's remaining time runs low, the duration displays in green → amber → red.
- **Print** — Click 🖨 to print a clean running order table.

### Export and import

- **Export** — From an event's detail page, click **Export event** to download a JSON package of all stages, days, performances, and patch workbook snapshots.
- **Import** — On the Events page, click **Import event** to load a previously exported package. The import creates a new event (with " (imported)" suffix).

Typical URL shape as you drill in: `/events/:eventId` → `/stages/:stageId` → `/stage-days/:stageDayId`.

**Live updates:** when someone else on the LAN changes the schedule, lists usually refresh automatically (server push). If something looks stale, reload the page.

---

## Patch and RF spreadsheet (workbook)

Each **performance** can have a **patch / RF workbook** — a multi-sheet grid (e.g. **Input**, **RF**) that **multiple people can edit at once** in real time.

- Open the workbook from the **stage day** view: each performance row has a **Patch / RF** link to `/patch/:performanceId`.
- The app opens a **full-width** spreadsheet view (`/patch/:performanceId`).
- **Collaboration** uses a live connection to the server; keep the tab open while editing.

### Band-to-band navigation

When viewing a patch workbook or performance files, a **navigation bar** shows:
- **← Previous** and **Next →** to jump between acts on the same day.
- A **dropdown** to jump to any act directly.
- **Alt+← / Alt+→** keyboard shortcuts for quick switching.
- A **mini clock** showing server-synced time.
- Connection status with colour: green (live), amber (syncing), red (error).

### Templates (shared library)

**Spreadsheet templates** are **global**: manage them in **Settings** (or add from a **stage**), then **assign a default template per stage** on the **stage** screen. New performances get a copy seeded from that template.

**Creating templates**

- **New blank** — Builds a minimal **Input** + **RF** workbook with column headers so you can fill everything in the app (no Excel required).
- **New from example** — Adds a **DH-style** multi-sheet layout (channel list, mic/DI list, RF, stage box patch), simplified from the Doug Hunt field workbook pattern.
- **Upload Excel** — Import from **Excel** (`.xlsx`, `.xltx`, macro-enabled `.xlsm` / `.xltm`, etc.) or **Google Sheets** (export to Excel-compatible format first).

A fresh install also includes one bundled example template (**DH Pick & Patch (example)**); you can duplicate it with **New from example** under another name if you removed it.

On **Settings** and on the **stage** template picker you can:

- **Edit spreadsheet** — Open the full **FortuneSheet** editor for that template; changes save automatically to the library (same tech as performance patch sheets).
- **Preview** — See a sample of sheets/cells without opening the full editor.
- **Edit name** — Change the **display name** of a template in the library.
- **Duplicate** — Copy a template to a new library entry (name becomes **"… (copy)"**; rename if you like).
- **Replace** — Upload a new Excel-compatible workbook for an existing template (updates the stored file and snapshot for new use).
- **Delete** — Remove a template from the library (stages using it may need a new assignment).

---

## Clock

- **Clock** in the nav shows today's stage days (if any exist for today's date). If there's only one, it auto-redirects.
- **All stage days** are listed below for quick access to any day's clock.
- The clock display shows **server-synced time** (corrected for any device clock drift).

### Stage day clock features

On a stage day clock (`/clock/day/:stageDayId`):

- **Normal view** — Lists all acts, focus card, and server-synced time.
- **Fullscreen (distance view)** — Press **F** or **Fullscreen** for a layout meant to be read from across the room:
  - **Top** — Band name, then the **countdown** as the **largest** text on screen (time left on stage, or **until the next act**). During **changeover** (between acts), a **Changeover** banner appears with **Next: …** and the upcoming band.
  - **Middle** — **Local time** (**HH:MM:SS**) — smaller than the countdown, still easy to read.
  - **Bottom** — Stage, date, countdown pace, and slot/next start in a compact **multi-column** row.
  - **Countdown colours** (high-contrast in both light and dark theme):
    - **Green** — more than 5 minutes
    - **Amber** — 1–5 minutes
    - **Red** — under 1 minute (the **last minute flashes** red/white for visibility)
- **Auto-advance** — In normal view, focus follows the current act (toggle on/off).
- **Changeover display** — In normal view, shows changeover duration between acts.
- **Band navigation** — In normal view, click any band in the list, or use **← / →** arrow keys.
- **Message overlay** — Type a message and click "Show" to display it full-screen (click to dismiss). Useful for "STOP" or timing cues.
- **Distance view (no fullscreen)** — On the stage day clock, click **Distance view** for the same large layout as fullscreen **without** the browser fullscreen API. Use this when you want a **bookmark**, **home-screen shortcut**, **split-screen** with another app, or when fullscreen is awkward on a tablet. The URL is `?kiosk=1` (legacy name). Use **Full clock — controls & schedule** to return to the normal view.

---

## Files and uploads

All uploaded files (patch templates, riders, plots) live on the **server's data directory** — see **[`data/README.md`](../data/README.md)** for **backups**.

### Riders and plots (attachments)

- **Stage** — On a **stage** screen, **Stage files** lets you upload **documents and images** (PDF, photos, text, Word/ODT, etc.). These are **stage-wide** (not tied to one band).
- **Performance** — On a **stage day**, each performance row has a **Files** link. Upload files that belong to **that band only** (e.g. their rider).
- **Drag and drop** — Drop files directly onto the upload zone, or click to browse.
- **PDF viewer** — Click the 👁 icon to view a PDF inline without leaving the page.
- **Open** — View the file in a new browser tab.
- **Extract page…** — For **PDFs** only: pick a **page number** (1 = first page) and **Extract as new PDF** to save a **single-page** copy. The original PDF is unchanged; the extract is tagged as derived from the source.
- **Delete** — Remove files with confirmation.

Maximum upload size is **100 MB** per file (see **[`DECISIONS.md`](DECISIONS.md)** for limits).

---

## Responsive layout

The app works on **desktop**, **tablet**, and **phone**:
- **Desktop** — Full layout with sidebar navigation.
- **Tablet** — Content expands to full width.
- **Phone** — Hamburger menu, stacked forms, touch-friendly targets (44px minimum).

---

## Theming

**Light / dark** mode can be toggled from the header (☀ / ☾ icon). Visual tokens are described for designers in **[`DESIGN.md`](DESIGN.md)**.

---

## Where to read more

| Need | Document |
|------|----------|
| Install & Docker | **[`README.md`](../README.md)** |
| Product vision & roadmap | **[`PLAN.md`](PLAN.md)** |
| Feature requirements | **[`FEATURE_REQUIREMENTS.md`](FEATURE_REQUIREMENTS.md)** |
| Engineering behaviour (API, limits) | **[`DECISIONS.md`](DECISIONS.md)** |

If something in this guide doesn't match the app, the app wins — please report or fix the doc (see **[`MAINTAINING_DOCS.md`](MAINTAINING_DOCS.md)**).
