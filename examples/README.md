# Patch / RF starter workbooks (optional)

Place **Excel** (`.xlsx`, etc.) or **FortuneSheet JSON** (`.json`) files here if you want them **in the repository** for operators to **Upload** or **Replace** under **Settings → Patch / RF spreadsheet templates** (or **Import workbook JSON**).

The app does **not** read this folder at runtime. **Blank** patch sheets are **not** library rows: when a stage has **no** default template, new performances use an **empty** grid in the browser only (see **`web/src/lib/patchWorkbookCollab.ts`**).

## Example JSON (conditional formatting)

**`patch-template-conditional-format-demo.json`** — small two-tab workbook with **`luckysheet_conditionformat_save`** rules (**color scale** on column **B**, **data bars** on column **D**) in the shape described in Luckysheet’s sheet config docs. Upload it as a template to confirm native JSON keeps conditional formatting metadata (see **`docs/PATCH_TEMPLATE_JSON.md`**).

## DH Pick & Patch v5.1 (SatBox labels)

**`DH_Pick_Patch_TEMPLATE_v5.1_satbox_index_match.json`** — derived from the v5.0 **Changeoverlord-native** workbook: every **SatBox Lables** item cell used a **~10k-character nested `IF`** scanning **`Channel List`!B5:B104**. FortuneSheet often fails on that depth, so labels stayed blank. Those cells now use a short **`INDEX`/`MATCH`** on **`Channel List`!D5:D104** keyed by the slot code in the cell to the left (**`TRIM(A…)`**, **`TRIM(D…)`**, etc.). Enter **`B1`**, **`O2`**, **`R3`**, **`Y1`**, **`P2`**, … in **SatBox#** (column **B**) on **Channel List**; the matching **Item** (column **D**) appears beside the coloured slot code on **SatBox Lables**. Re-import or replace your library template with this file if v5.0 labels misbehave.
