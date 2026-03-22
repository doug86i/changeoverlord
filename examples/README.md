# Patch / RF starter workbooks (optional)

Place **Excel** (`.xlsx`, etc.) or **FortuneSheet JSON** (`.json`) files here if you want them **in the repository** for operators to **Upload** or **Replace** under **Settings → Patch / RF spreadsheet templates** (or **Import workbook JSON**).

The app does **not** read this folder at runtime. **Blank** patch sheets are **not** library rows: when a stage has **no** default template, new performances use an **empty** grid in the browser only (see **`web/src/lib/patchWorkbookCollab.ts`**).

## DH Pick & Patch v7.0

**Source Excel:** `DH Pick & Patch TEMPLATE v7.0 - human made.xlsx` — the human-authored master (still has multiple sheets on disk; the **generated JSON** is a single-sheet workbook).

**Generated JSON:** `DH_Pick_Patch_TEMPLATE_v7.json` — built from the Excel by `scripts/build-v7-template.mjs`. One sheet (**Channel List**) with patch data in **A–J**, stand/mic summaries in **M–N**, and a compact **SatBox label grid** in **M–R** (same-sheet `INDEX`/`MATCH` only — no cross-sheet formulas).

### Importing

- **JSON import** (recommended): Settings → *Import workbook JSON* or `PUT /api/v1/patch-templates/:id/sheets-import`.
- **Excel upload**: Settings → *Upload*. The API extracts conditional formatting from OOXML (`api/src/lib/excel-cf-extract.ts`). Uploading the **human Excel** still yields a multi-sheet workbook; use the **generated JSON** for the single-sheet reference layout.

### Structure (1 sheet)

| Area | Columns | Purpose |
|------|---------|---------|
| **Patch list** | **A–J** | Stage Box Input, SatBox#, Desk Ch#, Item, Mic/DI, Stand, Position, Notes (same as Excel Channel List). Rows 2–101. |
| **Summary** | **M–N**, rows 1–6 | Tall / Short / Round stand counts (`COUNTIF` on column G), total channels / mics (`COUNTA` on D and E). Updates live with edits. |
| **SatBox labels** | **M–R**, rows 8–20 and 22–33 | Six colour groups (R/G/B then Y/O/P): static SatBox IDs plus **Lable** columns with `=IFERROR(VLOOKUP(id,$B$2:$D$101,3,0),"")` (Item in column D) for printing. |

Legacy Excel rows 98–101 (“Additional Stands”) are **cleared** in the JSON so counts come only from the summary formulas.

### Conditional formatting

- **B–C** (data rows): SatBox prefix colours — **R** red, **G** green, **B** blue, **Y** yellow, **O** orange, **P** purple. Upper **and** lowercase prefixes (FortuneSheet `textContains` is case-sensitive).
- **N, P, R** (label columns): empty string → grey text so unused slots are easy to read.

### Formulas (same sheet only)

All formulas reference **this sheet**. FortuneSheet recalculates them as you edit; no helper columns and no dependency on other tabs.

**Note:** `VLOOKUP` exact match (`0`) is **case-sensitive** in `@formulajs/formulajs`. SatBox IDs in column **B** should match the grid text (e.g. **G7** not **g7**), or use uppercase consistently. Conditional formatting still highlights lowercase prefixes in **B** for visibility.

### Template variability

Users upload their **own** templates — sheet count, names, layout, and formulas **will vary**. The DH v7 JSON is a **reference** for testing. Application code does **not** assume this sheet name or column layout.

### Regenerating

```bash
node scripts/build-v7-template.mjs > examples/DH_Pick_Patch_TEMPLATE_v7.json
```
