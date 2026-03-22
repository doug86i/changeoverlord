# Patch / RF starter workbooks (optional)

Place **Excel** (`.xlsx`, etc.) or **FortuneSheet JSON** (`.json`) files here if you want them **in the repository** for operators to **Upload** or **Replace** under **Settings → Patch / RF spreadsheet templates** (or **Import workbook JSON**).

The app does **not** read this folder at runtime. **Blank** patch sheets are **not** library rows: when a stage has **no** default template, new performances use an **empty** grid in the browser only (see **`web/src/lib/patchWorkbookCollab.ts`**).

## DH Pick & Patch v7.0

**Source Excel:** `DH Pick & Patch TEMPLATE v7.0 - human made.xlsx` — the human-authored master.

**Generated JSON:** `DH_Pick_Patch_TEMPLATE_v7.json` — built from the Excel by `scripts/build-v7-template.mjs`. This JSON includes `luckysheet_conditionformat_save` rules for SatBox colour coding and zero-value grey-out that the Excel library cannot extract automatically.

### Importing

- **JSON import** (recommended): Settings → *Import workbook JSON* or `PUT /api/v1/patch-templates/:id/sheets-import`. The JSON carries conditional formatting and cross-sheet formulas.
- **Excel upload**: Settings → *Upload*. The API now extracts conditional formatting from OOXML XML during import (`api/src/lib/excel-cf-extract.ts`), so direct `.xlsx` uploads also preserve CF rules.

### Structure (4 sheets)

| Sheet | Purpose |
|-------|---------|
| **Channel List** | Main patch list — one row per input. Columns: Stage Box Input, SatBox#, Desk Ch#, Item, Mic/DI, Stand, Position, Notes. Hidden helper columns (AA–AD) drive the Mic & DI and SatBox lookups. |
| **Mic & DI List** | Auto-populated from Channel List — unique mic/DI items with quantities, plus stand total counts (Tall, Short, Round). |
| **SatBox Lables** | Auto-populated from Channel List — label lookup by SatBox# (Red, Green, Blue, Yellow, Orange, Purple sections). |
| **Equipment Pick List** | Manual checklist for packing — Type, Item, Quantity, Pack Where?, Notes. |

### Conditional formatting

- **Channel List** (B2:C98): SatBox prefix colour coding — **R** red, **G** green, **B** blue, **Y** yellow, **O** orange, **P** purple. Both upper and lowercase prefixes are matched (FortuneSheet's `textContains` is case-sensitive, so rules exist for both).
- **SatBox Lables** (rows 4–46): Cells equal to `0` shown in grey text to hide empty lookup results.

### Cross-sheet formulas

Mic & DI List, SatBox Lables, and Equipment Pick List contain formulas referencing Channel List. FortuneSheet evaluates these via `@formulajs/formulajs` with `calcChain`.

**Limitation:** FortuneSheet's incremental recalculation only updates same-sheet formulas in real time. Cross-sheet formulas (e.g. Mic & DI List totals) may not refresh until the page is reloaded or a different sheet tab is visited. For this reason, the **stand count summary** (Tall/Short/Round) is duplicated on the Channel List sheet itself (rows 103–106) so it updates immediately during editing.

### Case handling

FortuneSheet does not support auto-uppercase on input. The template handles mixed case:
- **Helper columns** (AA–AC) use `UPPER()` so cross-sheet lookups are case-insensitive
- **CF rules** exist for both upper and lowercase SatBox prefixes
- **COUNTIF / MATCH** in `@formulajs/formulajs` are case-insensitive by default

### Template variability

Users upload their **own** templates — sheet names, column layout, row count, and formula structure **will vary**. The DH v7 template is a reference for testing. The application treats template content as opaque FortuneSheet data; no application code depends on specific sheet names or column positions.

### Regenerating

```bash
node scripts/build-v7-template.mjs > examples/DH_Pick_Patch_TEMPLATE_v7.json
```
