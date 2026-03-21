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
4. **Performances** — On a **stage day**, add **performances** (bands/slots) with **start**, **end** (either as a clock time or as **set length** in minutes), plus notes. Every slot has a finite end.

### Performance management

**Adding performances** — In **Add performance**, choose **End time** or **Set length**:
- **End time** — End must be **after** start (same as editing a row).
- **Set length** — Enter the slot length in **minutes**; the app stores it as an end time (start + length). Switching between **End time** and **Set length** keeps the **same duration** where possible.
- **Defaults** — First act on an empty day: **1 hour** slot and **30 minutes** changeover. After each **Add**, the next row suggests the **same length** as the act you just added, and **changeover** only affects the gap before that next start (not saved on the performance).
- **Changeover (min)** — Not saved on the performance. After **Add**, the next **Start** is this act’s **end + changeover**.
- **Enter** — In **Band / act**, **Enter** submits **Add** (same as the button).
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

- **Export** — From an event's detail page, click **Export event** to download a JSON package of all stages, days, performances, and patch workbook snapshots.
- **Import** — On the Events page, click **Import event** to load a previously exported package. The import creates a new event (with " (imported)" suffix).

Typical URL shape as you drill in: `/events/:eventId` → `/stages/:stageId` → `/stage-days/:stageDayId`.

**Live updates:** when someone else on the LAN changes the schedule, lists usually refresh automatically (server push). If something looks stale, reload the page.

---

## Patch and RF spreadsheet (workbook)

Each **performance** can have a **patch / RF workbook** — a multi-sheet grid (e.g. **Input**, **RF**) that **multiple people can edit at once** in real time.

- Open the workbook from the **stage day** view: each performance row has a **Patch / RF** link to `/patch/:performanceId`.
- The app opens the spreadsheet with a **context sidebar** on wide screens (`/patch/:performanceId`); on narrow screens the sidebar stacks **above** the grid.
- **Collaboration** uses a live connection to the server; keep the tab open while editing.

### Patch page sidebar (stay on the sheet)

On the **patch / RF** page, once the **stage day** has loaded, the **sidebar** keeps schedule, plot, and files next to the sheet (see **`docs/FEATURE_REQUIREMENTS.md`**).

- **Hide »** / **« Context** — Collapse or expand the sidebar; preference is remembered on this device.
- **Changeover** — Shown when the day is in a gap between acts (same condition as the stage clock).
- **Local time** → **Now** → **Countdown** → **Next** — same timing rules as the stage day clock. **Now** and **Next** band names are **links** to that act’s patch page.
- **This spreadsheet** — The act you’re editing; **Alt+←** / **Alt+→** switch acts on this day.
- **Quick links** — **All files**, **Rider PDF** when uploaded, **Stage clock**, **Running order**.
- **Stage plot** — Preview of the file uploaded as **Stage plot** (see **Files** below); performance files take priority over stage files.

The spreadsheet **toolbar, formula bar, and sheet tabs** use the app’s **sans-serif** font and theme colours; **cell selection** uses **FortuneSheet’s default** styling. **Text you type** in the active cell is shown in **high-contrast** colour so it stays readable on the edit box.

### Band-to-band navigation

When viewing a patch workbook or performance files, a **navigation bar** shows:
- **← Previous** and **Next →** to jump between acts on the same day.
- A **dropdown** to jump to any act directly.
- **Alt+← / Alt+→** keyboard shortcuts for quick switching.
- On the **patch** page, **time** and **countdown** are in the **sidebar** (see above). Connection status is next to the page title: green (live), amber (syncing), red (error).

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

- **Clock** in the nav opens the **last stage day you were viewing** (running order or stage-day clock), when that is known — same remembered day as **My stage today** uses. Otherwise it opens the **Clock** picker (`/clock`). The **`g c`** shortcut follows the same rule.
- On the **Clock** picker, **today’s stages** are listed when any exist for today’s date. If there’s only one today, it **auto-redirects** to that day’s clock.
- **All stage days** are listed below for quick access to any day's clock.
- The clock display shows **server-synced time** (corrected for any device clock drift).

### Stage day clock features

On a stage day clock (`/clock/day/:stageDayId`):

- **Normal view** — Lists all acts, focus card, and server-synced time.
- **Fullscreen (distance view)** — Press **F** or **Fullscreen** for a layout meant to be read from across the room:
  - **Top** — Band / changeover context, then the **countdown** — it **grows as large as the space allows** (without overlapping other elements) as the timer text changes.
  - **Middle** — **Local time** (**HH:MM:SS**) — readable but secondary to the countdown.
  - **Bottom** — Stage, date, countdown pace, and slot/next start in a compact **multi-column** row.
  - **Countdown colours** (high-contrast in both light and dark theme):
    - **Green** — more than 5 minutes
    - **Amber** — 1–5 minutes
    - **Red** — under 1 minute (the **last minute flashes** red/white for visibility)
- **Auto-advance** — In normal view, focus follows the current act (toggle on/off).
- **Changeover display** — In normal view, shows changeover duration between acts.
- **Band navigation** — In normal view, click any band in the list, or use **← / →** arrow keys.
- **Message overlay** — Type a message and click "Show" to display it full-screen (click to dismiss). Useful for "STOP" or timing cues.
- **End of day** — After the **last performance finishes** on that stage day, for **up to one hour** a full-screen message appears for the crew: it looks ahead to the **next day on this stage** and lists that day’s **lineup** (when configured). **One hour after** the last finish, the clock **automatically switches** to that next day. After the **final** day on the stage, a **thank-you** screen stays up until you navigate away. If a slot has no end time, the clock treats its end as **one hour after start** for this timing only.
- **Distance view (no fullscreen)** — On the stage day clock, click **Distance view** for the same large layout as fullscreen **without** the browser fullscreen API. Use this when you want a **bookmark**, **home-screen shortcut**, **split-screen** with another app, or when fullscreen is awkward on a tablet. The URL is `?kiosk=1` (legacy name). Use **Full clock — controls & schedule** to return to the normal view.
- **Fullscreen + resize** — If the browser **leaves fullscreen** (e.g. window resize or snap), the **large distance layout stays**; use **F** to go fullscreen again, or **Compact clock** to return to the normal clock with the band list. **Exit fullscreen (F)** still appears while the page is actually in fullscreen.

---

## Files and uploads

All uploaded files (patch templates, riders, plots) live on the **server's data directory** — see **[`data/README.md`](../data/README.md)** for **backups**.

### Riders and plots (attachments)

- **Stage** — On a **stage** screen, **Stage files** lets you upload **documents and images** (PDF, photos, text, Word/ODT, etc.). These are **stage-wide** (not tied to one band).
- **Performance** — On a **stage day**, each performance row has a **Files** link. Upload files that belong to **that band only** (e.g. their rider).
- **Upload new files as** — Choose radio options: **Rider / tech pack**, **Stage plot**, **Plot from rider PDF**, or **Other**. **Stage plot** is what the patch page sidebar and stage views use for plot previews. **Plot from rider PDF** is also set automatically when you **extract a page** from a PDF.
- **One plot per list** — For each **stage** or **performance** file list, only **one** file can be **Stage plot** or **Plot from rider** at a time. Marking a different file as the plot reclassifies the previous one as **Other**.
- **Use as (per file)** — After upload, change the **Type** on each row using the same radio options if you picked the wrong category.
- **Drag and drop** — Drop files directly onto the upload zone, or click to browse.
- **View** — Open a **PDF** in an inline viewer without leaving the page.
- **Open** — Open the file in a **new browser tab** (same control style as **View** — compact **button-shaped** actions).
- **Extract** — For **PDFs** only: click **Extract**, then **choose a page** from the **thumbnail previews**, and **Extract as new PDF** to save a **single-page** copy. The original PDF is unchanged; the extract is tagged as derived from the source.
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
