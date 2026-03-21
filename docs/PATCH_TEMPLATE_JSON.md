# Patch template upload: FortuneSheet-native JSON

This document is for **operators** generating tooling exports and for **agents** implementing or validating JSON-based patch templates.

## Why JSON exists

**Excel (`.xlsx`) → server** uses `@zenmrp/fortune-sheet-excel`. That path does not map every Excel feature into FortuneSheet’s model (notably **conditional formatting** and some validation UI). Uploading **native FortuneSheet JSON** skips that conversion so structures that FortuneSheet already understands can be preserved—**if** they are present in the JSON and supported by the in-app **FortuneSheet** build.

## API (same as Excel upload)

- **Create:** `POST /api/v1/patch-templates` — multipart field **`file`**, optional query **`name`**.
- **Replace:** `POST /api/v1/patch-templates/:id/replace` — multipart field **`file`** (same formats as create).

Accepted when the part is **`.json`** and/or MIME **`application/json`**, **`text/json`**, or (common from some file pickers) **`text/plain`** with a **`.json`** name. If the filename/MIME are wrong but the bytes start with **`{`** or **`[`** (after BOM/whitespace), the server treats the upload as workbook **JSON**. Maximum body size matches Excel templates (**10 MiB** in `api/src/routes/v1/patch-templates.ts`).

## Workbook JSON export / import (REST, agents & cross-server)

These endpoints move **FortuneSheet `Sheet[]` data** as JSON (with an optional **envelope**) so you can edit offline, diff in git, or copy a workbook between deployments without a full event package.

**Body limit:** JSON bodies for import are capped at **12 MiB** (`JSON_SHEETS_BODY_LIMIT`).

### Envelope (`changeoverlordWorkbook`)

Exports use **`api/src/lib/workbook-json-envelope.ts`**:

| Field | Meaning |
|-------|--------|
| `changeoverlordWorkbook` | Always **`1`** for this format |
| `exportedAt` | ISO timestamp |
| `kind` | **`patchTemplate`** or **`performance`** |
| `label` | Display name (template name or band name) |
| `templateId` / `performanceId` | Present when known |
| `sheets` | Array of FortuneSheet sheets |

**Imports** accept the same shapes as multipart JSON upload (array, `{ sheets }`, `{ luckysheetfile }`) **or** an envelope with **`changeoverlordWorkbook: 1`** and **`sheets`** — see `parseWorkbookJsonRoot` in `api/src/lib/json-patch-template.ts`.

### Patch template library

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/patch-templates/:id/sheets-export` | Download workbook as JSON (**attachment**) |
| `PUT` | `/api/v1/patch-templates/:id/sheets-import` | Replace template workbook from JSON body (updates disk file, DB snapshot, live template collab room if open) |
| `POST` | `/api/v1/patch-templates/sheets-import?name=` | Create a **new** library template from JSON body (optional **`name`** query) |

### Performance (per-band) workbook

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/performances/:id/sheets-export` | Download this band’s workbook (**404** if no snapshot yet) |
| `PUT` | `/api/v1/performances/:id/sheets-import` | Replace workbook from JSON body (persists snapshot; updates live performance collab room if open) |

**UI:** **Settings** and **stage** template cards expose **Export JSON** / **Import JSON** / **Import workbook JSON**; the **Patch & RF** page exposes **Export JSON** / **Import JSON** for the current performance. After a performance import, the page **reloads** so the grid reconnects with the new state.

Stored on disk as **`patch-templates/<uuid>.json`** with **`mimeType`** **`application/json`**. The Postgres **`snapshot`** column still holds the usual **Yjs**-encoded template seed (same as Excel uploads).

## JSON document shape (root)

The parser (`api/src/lib/json-patch-template.ts`) accepts **one** of:

1. **Array of sheets** — `[ { ...sheet }, ... ]`
2. **Wrapper object** — `{ "sheets": [ ... ] }`
3. **FortuneSheet-style wrapper** — `{ "luckysheetfile": [ ... ] }`
4. **Changeoverlord envelope** — `{ "changeoverlordWorkbook": 1, "sheets": [ ... ], ... }`

UTF-8 encoding. A leading **UTF-8 BOM** is stripped before `JSON.parse`.

**Sheet count:** at least **1**, at most **40** (constant `MAX_TEMPLATE_SHEETS`).

## Per-sheet requirements (`@fortune-sheet/core` `Sheet`)

Each array element must be a **plain object** (one FortuneSheet **sheet**).

### Grid data (required in practice)

The server normalizer (`normalizeSheetFromRaw` in `api/src/lib/excel-to-sheets.ts`) builds a dense **`data`** matrix for FortuneSheet’s `applyOp` pipeline:

- Prefer **`data`**: a 2D array (`Cell | null` per cell), **or**
- **`celldata`**: sparse `[{ "r", "c", "v" }, ...]` (merged into `data`), **or**
- Both (if **`data`** is missing, it is derived from **`celldata`**).

**`row`** and **`column`**: numbers describing grid size. If missing, size is inferred from **`celldata`**; the normalizer enforces minimum **36 × 18** (same as Excel import path).

### Naming and identity

- **`name`**: string; used as the tab name.
- **`id`**: optional string (UUID generated if absent).

### Merge cells (`mc`)

- **`config.merge`** should use keys like `"0_0"` with `{ "r", "c", "rs", "cs" }` (FortuneSheet/Luckysheet shape).
- The **master** cell in **`data`** (top-left of the merge) must have **`mc.r`** and **`mc.c`** set to that cell’s row/column indices, plus **`rs`** / **`cs`**. Exports that only include `{ "rs", "cs" }` under **`mc`** will **break** the grid in the browser until fixed. The API normalizer **fills in missing `mc.r` / `mc.c`** on master cells when **`rs` or `cs` is present**.

### Text wrap (`tb`)

- FortuneSheet compares **`tb`** to **strings** such as **`"1"`** and **`"2"`**. JSON that uses numeric **`tb`** (e.g. **`2`**) is **coerced to a string** on import.

### Always normalized `config` keys

From **`sheet.config`**, these are copied into the stored sheet (Excel and JSON):

- **`merge`**, **`borderInfo`**, **`rowlen`**, **`columnlen`**, **`rowhidden`**, **`colhidden`**, **`customHeight`**, **`customWidth`**

**JSON-only** (`nativeJson: true`): also copies if present:

- **`authority`**, **`rowReadOnly`**, **`colReadOnly`**

### Passthrough fields (JSON upload only)

If present on the **sheet object** (top level, not only inside `config`), these are copied onto the stored **`Sheet`** so FortuneSheet can use them:

| Field | Typical use |
|-------|-------------|
| `luckysheet_conditionformat_save` | Conditional formatting rules |
| `luckysheet_alternateformat_save` | Alternate row/column shading |
| `dataVerification` | Data validation / dropdowns |
| `filter`, `filter_select` | Filters |
| `frozen` | Frozen panes |
| `hyperlink` | Hyperlinks |
| `showGridLines`, `zoomRatio`, `color` | Display |
| `pivotTable`, `isPivotTable` | Pivot metadata |
| `luckysheet_select_save`, `luckysheet_selection_range` | Selection state |
| `dynamicArray_compute`, `dynamicArray` | Dynamic arrays |

**Not** passed through: **`images`** (can break rendering if shaped incorrectly—re-add in **Edit spreadsheet** if needed).

### Other fields handled on both Excel and JSON paths

- **`defaultColWidth`**, **`defaultRowHeight`** (numbers)
- **`calcChain`** (array)
- **`hide`** (`1` = hidden sheet)

**`status`**: the normalizer sets the active sheet flag from **sheet order** (`0` → active); do not rely on string `"status"` values in JSON.

## Validation and errors

- Invalid JSON → **`Invalid JSON`**
- Wrong root shape → message referencing **`sheets`** / **`luckysheetfile`**
- Empty workbook → **`Workbook has no sheets`**
- Too many sheets → **`Too many sheets (max 40)`**
- Non-object sheet entry → **`Invalid sheet at index N`**
- Unsupported file type (neither JSON nor OOXML Excel) → **`Unsupported file: upload Excel ... or FortuneSheet JSON (.json)`**

## Example file (repository)

**`examples/patch-template-conditional-format-demo.json`** — ready to **Upload** / **Replace (Excel/JSON)** / **Import workbook JSON**. It includes **`luckysheet_conditionformat_save`** with **`colorGradation`** and **`dataBar`** rules (Luckysheet sheet-config shape). If a rule type does not render, the bundled FortuneSheet build may not implement it yet; the field is still preserved on the sheet for forward compatibility.

## Compatibility notes

1. **FortuneSheet version** in this app defines what rule types actually run; JSON preserves **data**, not guarantees of Excel parity.
2. **Formulas** must be in FortuneSheet’s formula dialect; Excel-only functions may not evaluate.
3. After upload, **Edit spreadsheet** remains the supported way to fix gaps.

## Related code

| Piece | Path |
|-------|------|
| JSON parse + sheet array extraction | `api/src/lib/json-patch-template.ts` |
| Normalization + JSON passthrough | `api/src/lib/excel-to-sheets.ts` (`normalizeSheetFromRaw`) |
| Upload / replace / preview / sheets export-import | `api/src/routes/v1/patch-templates.ts` |
| Performance sheets export-import | `api/src/routes/v1/performances.ts` |
| Export envelope | `api/src/lib/workbook-json-envelope.ts` |
| Live collab replace + persist buffer | `api/src/lib/yjs-collab-replace.ts` |
| Extension / MIME helpers | `api/src/lib/upload-allowlists.ts` (`isPatchTemplateJsonFile`, `patchTemplateStorageExtension`, `stripPatchTemplateBasename`) |
| Yjs snapshot encode/decode | `api/src/lib/yjs-template-snapshot.ts` |
